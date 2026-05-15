import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, appendFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { normalizeWallet } from './auth.js';

type StorageTier = 'open' | 'private';
type PaymentStatus = 'none' | 'required' | 'paid' | 'failed';

export type UsageBillingContext = {
  operation?: 'write' | 'read' | 'delete' | 'metadata' | 'list' | 'share' | 'health' | 'test';
  resourceKey?: string;
  tier?: StorageTier;
  billableAmount?: number;
  storageBytesAdded?: number;
  storageBytesDeleted?: number;
  storageBytesDelta?: number;
  storageBytesTotalAfter?: number;
  requestBytes?: number;
  responseBytes?: number;
};

export type UsageEvent = {
  eventId: string;
  timestamp: string;
  method: string;
  path: string;
  endpoint: string;
  statusCode: number;
  durationMs: number;
  userId: string;
  userKind: 'wallet' | 'api_key' | 'payment' | 'anonymous';
  authWallet?: string;
  apiKeyHash?: string;
  paymentHeaderHash?: string;
  paymentResponseHash?: string;
  paymentStatus: PaymentStatus;
  payer?: string;
  paymentNetwork?: string;
  paymentTransaction?: string;
  operation?: UsageBillingContext['operation'];
  resourceKey?: string;
  tier?: StorageTier;
  requestBytes: number;
  responseBytes: number;
  storageBytesAdded: number;
  storageBytesDeleted: number;
  storageBytesDelta: number;
  storageBytesTotalAfter?: number;
  billableAmount: number;
  revenueUsd: number;
  userAgent?: string;
  ipHash?: string;
};

type UsageSummary = {
  window: string;
  calls: number;
  billableCalls: number;
  paidCalls: number;
  failedCalls: number;
  uniqueUsers: number;
  revenueUsd: number;
  requestBytes: number;
  responseBytes: number;
  storageBytesAdded: number;
  storageBytesDeleted: number;
  netStorageBytesDelta: number;
  byEndpoint: Array<{ endpoint: string; calls: number; revenueUsd: number; uniqueUsers: number }>;
  byUser: Array<{ userId: string; userKind: UsageEvent['userKind']; calls: number; revenueUsd: number; lastSeen: string }>;
};

const DEFAULT_LEDGER_PATH = 'state/vaultline-usage-events.jsonl';
let postgresStore: PostgresUsageStore | undefined;

export function usageMeteringMiddleware(req: Request, res: Response, next: NextFunction) {
  const startedAt = Date.now();
  let responseBytes = 0;
  const originalWrite = res.write.bind(res);
  const originalEnd = res.end.bind(res);

  res.write = function write(chunk: any, ...args: any[]) {
    responseBytes += getChunkByteLength(chunk);
    return originalWrite(chunk, ...args);
  } as typeof res.write;

  res.end = function end(chunk: any, ...args: any[]) {
    responseBytes += getChunkByteLength(chunk);
    return originalEnd(chunk, ...args);
  } as typeof res.end;

  res.on('finish', () => {
    const context = getUsageBilling(res);
    const event = buildUsageEvent(req, res, {
      ...context,
      responseBytes: context.responseBytes ?? responseBytes,
      requestBytes: context.requestBytes ?? getRequestBytes(req),
    }, Date.now() - startedAt);

    appendUsageEvent(event).catch((err) => {
      console.error(`usage metering failed: ${err instanceof Error ? err.message : String(err)}`);
    });
  });

  next();
}

export function setUsageBilling(res: Response, context: UsageBillingContext) {
  const current = getUsageBilling(res);
  res.locals.vaultlineUsage = {
    ...current,
    ...context,
  };
}

export async function getUsageSummary(input: { since?: Date; limitUsers?: number; limitEndpoints?: number } = {}) {
  const events = (await readUsageEvents()).filter((event) => !input.since || new Date(event.timestamp) >= input.since);
  return summarizeUsageEvents(events, {
    window: input.since ? `since ${input.since.toISOString()}` : 'all_time',
    limitUsers: input.limitUsers,
    limitEndpoints: input.limitEndpoints,
  });
}

export async function getUsageWindows() {
  const events = await readUsageEvents();
  const now = Date.now();
  return {
    allTime: summarizeUsageEvents(events, { window: 'all_time' }),
    last24h: summarizeUsageEvents(events.filter((event) => new Date(event.timestamp).getTime() >= now - 24 * 60 * 60 * 1000), { window: '24h' }),
    last7d: summarizeUsageEvents(events.filter((event) => new Date(event.timestamp).getTime() >= now - 7 * 24 * 60 * 60 * 1000), { window: '7d' }),
    last30d: summarizeUsageEvents(events.filter((event) => new Date(event.timestamp).getTime() >= now - 30 * 24 * 60 * 60 * 1000), { window: '30d' }),
  };
}

export function getUsageStoreInfo() {
  if (getDatabaseUrl()) {
    return {
      backend: 'postgres',
      table: 'vaultline_usage_events',
      note: 'Durable Postgres ledger. Set NEON_DATABASE_URL or DATABASE_URL in production.',
    };
  }

  return {
    backend: 'jsonl',
    path: process.env.VAULTLINE_USAGE_LEDGER_PATH ?? DEFAULT_LEDGER_PATH,
    note: 'Append-only local JSONL ledger. Use Postgres for production or mount this path as persistent storage.',
  };
}

async function appendUsageEvent(event: UsageEvent) {
  const store = getPostgresStore();
  if (store) {
    await store.append(event);
    return;
  }

  const path = getLedgerPath();
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(event)}\n`, 'utf8');
}

async function readUsageEvents(): Promise<UsageEvent[]> {
  const store = getPostgresStore();
  if (store) return store.read();

  const path = getLedgerPath();
  let raw = '';
  try {
    raw = await readFile(path, 'utf8');
  } catch (err: any) {
    if (err?.code === 'ENOENT') return [];
    throw err;
  }

  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as UsageEvent;
      } catch {
        return undefined;
      }
    })
    .filter(Boolean) as UsageEvent[];
}

function summarizeUsageEvents(
  events: UsageEvent[],
  options: { window: string; limitUsers?: number; limitEndpoints?: number }
): UsageSummary {
  const users = new Set<string>();
  const endpointMap = new Map<string, { endpoint: string; calls: number; revenueUsd: number; users: Set<string> }>();
  const userMap = new Map<string, { userId: string; userKind: UsageEvent['userKind']; calls: number; revenueUsd: number; lastSeen: string }>();

  const summary = events.reduce(
    (acc, event) => {
      users.add(event.userId);
      acc.calls += 1;
      if (event.billableAmount > 0) acc.billableCalls += 1;
      if (event.paymentStatus === 'paid') acc.paidCalls += 1;
      if (event.statusCode >= 400) acc.failedCalls += 1;
      acc.revenueUsd += event.revenueUsd;
      acc.requestBytes += event.requestBytes;
      acc.responseBytes += event.responseBytes;
      acc.storageBytesAdded += event.storageBytesAdded;
      acc.storageBytesDeleted += event.storageBytesDeleted;
      acc.netStorageBytesDelta += event.storageBytesDelta;

      const endpoint = endpointMap.get(event.endpoint) ?? {
        endpoint: event.endpoint,
        calls: 0,
        revenueUsd: 0,
        users: new Set<string>(),
      };
      endpoint.calls += 1;
      endpoint.revenueUsd += event.revenueUsd;
      endpoint.users.add(event.userId);
      endpointMap.set(event.endpoint, endpoint);

      const user = userMap.get(event.userId) ?? {
        userId: event.userId,
        userKind: event.userKind,
        calls: 0,
        revenueUsd: 0,
        lastSeen: event.timestamp,
      };
      user.calls += 1;
      user.revenueUsd += event.revenueUsd;
      if (event.timestamp > user.lastSeen) user.lastSeen = event.timestamp;
      userMap.set(event.userId, user);

      return acc;
    },
    {
      window: options.window,
      calls: 0,
      billableCalls: 0,
      paidCalls: 0,
      failedCalls: 0,
      uniqueUsers: 0,
      revenueUsd: 0,
      requestBytes: 0,
      responseBytes: 0,
      storageBytesAdded: 0,
      storageBytesDeleted: 0,
      netStorageBytesDelta: 0,
      byEndpoint: [],
      byUser: [],
    } as UsageSummary
  );

  summary.uniqueUsers = users.size;
  summary.revenueUsd = roundMoney(summary.revenueUsd);
  summary.byEndpoint = [...endpointMap.values()]
    .sort((a, b) => b.calls - a.calls)
    .slice(0, options.limitEndpoints ?? 20)
    .map((item) => ({
      endpoint: item.endpoint,
      calls: item.calls,
      revenueUsd: roundMoney(item.revenueUsd),
      uniqueUsers: item.users.size,
    }));
  summary.byUser = [...userMap.values()]
    .sort((a, b) => b.calls - a.calls)
    .slice(0, options.limitUsers ?? 20)
    .map((item) => ({
      ...item,
      revenueUsd: roundMoney(item.revenueUsd),
    }));

  return summary;
}

function buildUsageEvent(req: Request, res: Response, context: UsageBillingContext, durationMs: number): UsageEvent {
  const paymentHeader = getHeader(req, 'x-payment') ?? getHeader(req, 'payment-signature');
  const paymentResponseHeader = stringHeader(res.getHeader('x-payment-response'));
  const paymentResponse = parsePaymentResponse(paymentResponseHeader);
  const authWallet = normalizeWallet(getHeader(req, 'x-auth-wallet'));
  const apiKey = getHeader(req, 'x-api-key') ?? getHeader(req, 'authorization');
  const paymentHeaderHash = paymentHeader ? hashValue(paymentHeader) : undefined;
  const paymentResponseHash = paymentResponseHeader ? hashValue(paymentResponseHeader) : undefined;
  const identity = getIdentity({ authWallet, apiKey, paymentHeaderHash, payer: paymentResponse.payer });
  const billableAmount = toMoney(context.billableAmount ?? 0);
  const settled = res.statusCode < 400 && Boolean(paymentHeader) && billableAmount > 0;

  return {
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    method: req.method,
    path: sanitizePath(req.originalUrl || req.path),
    endpoint: endpointFor(req),
    statusCode: res.statusCode,
    durationMs,
    userId: identity.userId,
    userKind: identity.userKind,
    authWallet,
    apiKeyHash: apiKey ? hashValue(apiKey) : undefined,
    paymentHeaderHash,
    paymentResponseHash,
    paymentStatus: settled ? 'paid' : billableAmount > 0 && res.statusCode === 402 ? 'required' : res.statusCode >= 400 && paymentHeader ? 'failed' : 'none',
    payer: paymentResponse.payer,
    paymentNetwork: paymentResponse.network,
    paymentTransaction: paymentResponse.transaction,
    operation: context.operation,
    resourceKey: context.resourceKey,
    tier: context.tier,
    requestBytes: context.requestBytes ?? 0,
    responseBytes: context.responseBytes ?? 0,
    storageBytesAdded: context.storageBytesAdded ?? 0,
    storageBytesDeleted: context.storageBytesDeleted ?? 0,
    storageBytesDelta: context.storageBytesDelta ?? 0,
    storageBytesTotalAfter: context.storageBytesTotalAfter,
    billableAmount,
    revenueUsd: settled ? billableAmount : 0,
    userAgent: getHeader(req, 'user-agent'),
    ipHash: req.ip ? hashValue(req.ip) : undefined,
  };
}

function getUsageBilling(res: Response): UsageBillingContext {
  return (res.locals.vaultlineUsage ?? {}) as UsageBillingContext;
}

function getIdentity(input: {
  authWallet?: string;
  apiKey?: string;
  paymentHeaderHash?: string;
  payer?: string;
}): { userId: string; userKind: UsageEvent['userKind'] } {
  if (input.authWallet) return { userId: input.authWallet, userKind: 'wallet' };
  if (input.payer) return { userId: input.payer, userKind: 'wallet' };
  if (input.apiKey) return { userId: `api_key:${hashValue(input.apiKey).slice(0, 16)}`, userKind: 'api_key' };
  if (input.paymentHeaderHash) return { userId: `payment:${input.paymentHeaderHash.slice(0, 16)}`, userKind: 'payment' };
  return { userId: 'anonymous', userKind: 'anonymous' };
}

function parsePaymentResponse(header: string | undefined): { payer?: string; network?: string; transaction?: string } {
  if (!header) return {};
  const candidates = [header, decodeBase64Json(header)];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      return {
        payer: typeof parsed.payer === 'string' ? normalizeWallet(parsed.payer) : undefined,
        network: typeof parsed.network === 'string' ? parsed.network : undefined,
        transaction: typeof parsed.transaction === 'string' ? parsed.transaction : undefined,
      };
    } catch {
      continue;
    }
  }
  return {};
}

function decodeBase64Json(value: string) {
  try {
    return Buffer.from(value, 'base64').toString('utf8');
  } catch {
    return undefined;
  }
}

function endpointFor(req: Request) {
  const path = req.path;
  if (path.startsWith('/v1/files/')) return `${req.method} /v1/files/*`;
  if (path.startsWith('/v1/list')) return `${req.method} /v1/list/*`;
  if (path.startsWith('/v1/shares/')) return `${req.method} /v1/shares/*`;
  if (path === '/v1/shares') return `${req.method} /v1/shares`;
  if (path === '/v1/usage') return `${req.method} /v1/usage`;
  if (path === '/v1/health') return `${req.method} /v1/health`;
  if (path === '/v1/test/paid-ping') return `${req.method} /v1/test/paid-ping`;
  return `${req.method} ${path}`;
}

function sanitizePath(path: string) {
  if (path.startsWith('/v1/shares/')) return '/v1/shares/[redacted]';
  return path.split('?')[0];
}

function getRequestBytes(req: Request) {
  const contentLength = getHeader(req, 'content-length');
  const parsed = Number.parseInt(contentLength ?? '0', 10);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  if (Buffer.isBuffer(req.body)) return req.body.length;
  if (typeof req.body === 'string') return Buffer.byteLength(req.body);
  if (req.body && typeof req.body === 'object') return Buffer.byteLength(JSON.stringify(req.body));
  return 0;
}

function getChunkByteLength(chunk: unknown) {
  if (!chunk) return 0;
  if (Buffer.isBuffer(chunk)) return chunk.length;
  if (typeof chunk === 'string') return Buffer.byteLength(chunk);
  if (chunk instanceof Uint8Array) return chunk.byteLength;
  return 0;
}

function getHeader(req: Request, name: string) {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function stringHeader(value: number | string | string[] | undefined) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0];
  if (typeof value === 'number') return String(value);
  return undefined;
}

function hashValue(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function getLedgerPath() {
  return resolve(process.cwd(), process.env.VAULTLINE_USAGE_LEDGER_PATH ?? DEFAULT_LEDGER_PATH);
}

function getDatabaseUrl() {
  return process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL;
}

function getPostgresStore() {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) return undefined;
  if (!postgresStore) postgresStore = new PostgresUsageStore(databaseUrl);
  return postgresStore;
}

class PostgresUsageStore {
  private readonly sql: NeonQueryFunction<false, false>;
  private ensurePromise: Promise<void> | undefined;

  constructor(databaseUrl: string) {
    this.sql = neon(databaseUrl);
  }

  async append(event: UsageEvent) {
    await this.ensureSchema();
    await this.sql`
      insert into vaultline_usage_events (
        event_id,
        timestamp,
        method,
        path,
        endpoint,
        status_code,
        duration_ms,
        user_id,
        user_kind,
        auth_wallet,
        api_key_hash,
        payment_header_hash,
        payment_response_hash,
        payment_status,
        payer,
        payment_network,
        payment_transaction,
        operation,
        resource_key,
        tier,
        request_bytes,
        response_bytes,
        storage_bytes_added,
        storage_bytes_deleted,
        storage_bytes_delta,
        storage_bytes_total_after,
        billable_amount,
        revenue_usd,
        user_agent,
        ip_hash,
        raw_event
      ) values (
        ${event.eventId},
        ${event.timestamp},
        ${event.method},
        ${event.path},
        ${event.endpoint},
        ${event.statusCode},
        ${event.durationMs},
        ${event.userId},
        ${event.userKind},
        ${event.authWallet ?? null},
        ${event.apiKeyHash ?? null},
        ${event.paymentHeaderHash ?? null},
        ${event.paymentResponseHash ?? null},
        ${event.paymentStatus},
        ${event.payer ?? null},
        ${event.paymentNetwork ?? null},
        ${event.paymentTransaction ?? null},
        ${event.operation ?? null},
        ${event.resourceKey ?? null},
        ${event.tier ?? null},
        ${event.requestBytes},
        ${event.responseBytes},
        ${event.storageBytesAdded},
        ${event.storageBytesDeleted},
        ${event.storageBytesDelta},
        ${event.storageBytesTotalAfter ?? null},
        ${event.billableAmount},
        ${event.revenueUsd},
        ${event.userAgent ?? null},
        ${event.ipHash ?? null},
        ${JSON.stringify(event)}
      )
      on conflict (event_id) do nothing
    `;
  }

  async read(): Promise<UsageEvent[]> {
    await this.ensureSchema();
    const rows = await this.sql`
      select raw_event
      from vaultline_usage_events
      order by timestamp asc
    ` as Array<{ raw_event: UsageEvent | string }>;

    return rows
      .map((row) => typeof row.raw_event === 'string' ? JSON.parse(row.raw_event) as UsageEvent : row.raw_event)
      .filter(Boolean);
  }

  private ensureSchema() {
    this.ensurePromise ??= this.sql`
      create table if not exists vaultline_usage_events (
        event_id uuid primary key,
        timestamp timestamptz not null,
        method text not null,
        path text not null,
        endpoint text not null,
        status_code integer not null,
        duration_ms integer not null,
        user_id text not null,
        user_kind text not null,
        auth_wallet text,
        api_key_hash text,
        payment_header_hash text,
        payment_response_hash text,
        payment_status text not null,
        payer text,
        payment_network text,
        payment_transaction text,
        operation text,
        resource_key text,
        tier text,
        request_bytes bigint not null default 0,
        response_bytes bigint not null default 0,
        storage_bytes_added bigint not null default 0,
        storage_bytes_deleted bigint not null default 0,
        storage_bytes_delta bigint not null default 0,
        storage_bytes_total_after bigint,
        billable_amount numeric(18, 6) not null default 0,
        revenue_usd numeric(18, 6) not null default 0,
        user_agent text,
        ip_hash text,
        raw_event jsonb not null
      )
    `.then(async () => {
      await this.sql`create index if not exists vaultline_usage_events_timestamp_idx on vaultline_usage_events (timestamp desc)`;
      await this.sql`create index if not exists vaultline_usage_events_user_id_idx on vaultline_usage_events (user_id)`;
      await this.sql`create index if not exists vaultline_usage_events_endpoint_idx on vaultline_usage_events (endpoint)`;
      await this.sql`create index if not exists vaultline_usage_events_payment_status_idx on vaultline_usage_events (payment_status)`;
    });

    return this.ensurePromise;
  }
}

function roundMoney(value: number) {
  return Number(value.toFixed(6));
}

function toMoney(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return roundMoney(value);
}

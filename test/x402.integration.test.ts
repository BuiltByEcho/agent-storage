import { rm } from 'node:fs/promises';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { x402Client } from '@x402/core/client';
import { x402HTTPClient } from '@x402/core/http';
import { x402ResourceServer } from '@x402/core/server';
import { ExactEvmScheme as ClientExactEvmScheme, toClientEvmSigner } from '@x402/evm';
import { ExactEvmScheme as ServerExactEvmScheme } from '@x402/evm/exact/server';
import { buildStorageAuthMessage } from '../src/auth.ts';

type StoredFile = {
  data: Buffer;
  contentType?: string;
  lastModified: Date;
  etag: string;
  tier: 'open' | 'private';
  ownerWallet?: `0x${string}`;
  allowedWallets: `0x${string}`[];
};

const files = new Map<string, StoredFile>();
const network = 'eip155:8453' as const;
const payTo = '0x712374b58b957644A73C48F7CFbbd6365eaCbC73' as Address;
const payerKey = '0x39ad39ad39ad39ad39ad39ad39ad39ad39ad39ad39ad39ad39ad39ad39ad39ad' as const;
const intruderKey = '0x59ad39ad39ad39ad39ad39ad39ad39ad39ad39ad39ad39ad39ad39ad39ad39ad' as const;
const payer = privateKeyToAccount(payerKey);
const intruder = privateKeyToAccount(intruderKey);
const client = new x402Client().register('eip155:*', new ClientExactEvmScheme(toClientEvmSigner(payer)));
const httpClient = new x402HTTPClient(client);
const usageLedgerPath = `state/test-usage-events-${Date.now()}.jsonl`;

const resourceServer = new x402ResourceServer({
  async getSupported() {
    return {
      kinds: [{ x402Version: 2, scheme: 'exact', network }],
      extensions: [],
      signers: {},
    };
  },
  async verify(paymentPayload, paymentRequirements) {
    return {
      isValid: paymentPayload.accepted.network === paymentRequirements.network,
      payer: payer.address,
    };
  },
  async settle(_paymentPayload, paymentRequirements) {
    return {
      success: true,
      payer: payer.address,
      transaction: '0xsettled',
      network: paymentRequirements.network,
      amount: paymentRequirements.amount,
    };
  },
}).register(network, new ServerExactEvmScheme());

vi.mock('../src/cdpFacilitator.ts', () => ({
  X402_MAINNET_NETWORK: network,
  getResourceServer: () => resourceServer,
  initializeResourceServer: () => Promise.resolve(),
}));

vi.mock('../src/services/storage.ts', () => ({
  async uploadFile(
    key: string,
    data: Buffer,
    contentType?: string,
    accessPolicy: { tier: 'open' | 'private'; ownerWallet?: `0x${string}`; allowedWallets?: `0x${string}`[] } = { tier: 'open' }
  ) {
    const stored: StoredFile = {
      data: Buffer.from(data),
      contentType,
      lastModified: new Date(),
      etag: `etag-${key}-${data.length}`,
      tier: accessPolicy.tier ?? 'open',
      ownerWallet: accessPolicy.ownerWallet,
      allowedWallets: accessPolicy.allowedWallets ?? [],
    };
    files.set(key, stored);
    return {
      key,
      size: stored.data.length,
      lastModified: stored.lastModified,
      contentType: stored.contentType,
      etag: stored.etag,
      tier: stored.tier,
      ownerWallet: stored.ownerWallet,
      allowedWallets: stored.allowedWallets,
    };
  },
  async downloadFile(key: string) {
    const file = files.get(key);
    if (!file) {
      const error = new Error(`File not found: ${key}`) as Error & { name: string };
      error.name = 'NoSuchKey';
      throw error;
    }
    return {
      data: Buffer.from(file.data),
      metadata: {
        key,
        size: file.data.length,
        lastModified: file.lastModified,
        contentType: file.contentType,
        etag: file.etag,
        tier: file.tier,
        ownerWallet: file.ownerWallet,
        allowedWallets: file.allowedWallets,
      },
    };
  },
  async deleteFile(key: string) {
    files.delete(key);
  },
  async getFileMetadata(key: string) {
    const file = files.get(key);
    if (!file) {
      const error = new Error(`File not found: ${key}`) as Error & { name: string };
      error.name = 'NoSuchKey';
      throw error;
    }
    return {
      key,
      size: file.data.length,
      lastModified: file.lastModified,
      contentType: file.contentType,
      etag: file.etag,
      tier: file.tier,
      ownerWallet: file.ownerWallet,
      allowedWallets: file.allowedWallets,
    };
  },
  async listFiles(prefix: string) {
    const matched = [...files.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, file]) => ({
        key,
        size: file.data.length,
        lastModified: file.lastModified,
        contentType: file.contentType,
        etag: file.etag,
        tier: file.tier,
        ownerWallet: file.ownerWallet,
        allowedWallets: file.allowedWallets,
      }));

    return {
      files: matched,
      directories: [],
      prefix,
      truncated: false,
    };
  },
}));

describe('x402 integration', () => {
  let baseUrl = '';
  let closeServer: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    process.env.X402_TEST_PAYTO = payTo;
    process.env.X402_TREASURY_WALLET = payTo;
    process.env.X402_USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
    process.env.FREE_READ_MAX_BYTES = '1048576';
    process.env.VAULTLINE_USAGE_LEDGER_PATH = usageLedgerPath;

    await resourceServer.initialize();
    const { createApp } = await import('../src/app.ts');
    const app = createApp();
    const server = await new Promise<import('node:http').Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Failed to bind test server');
    baseUrl = `http://127.0.0.1:${address.port}`;
    closeServer = () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  });

  afterAll(async () => {
    await closeServer?.();
  });

  beforeEach(async () => {
    files.clear();
    await rm(usageLedgerPath, { force: true });
  });

  it('requires payment then accepts a paid upload', async () => {
    const body = Buffer.from('hello paid upload');
    const paid = await makePaidRequest('PUT', `${baseUrl}/v1/files/demo.txt`, body, { 'content-type': 'text/plain' });

    expect(paid.status).toBe(200);
    expect(await paid.json()).toMatchObject({
      ok: true,
      file: { key: 'demo.txt', size: body.length, contentType: 'text/plain', tier: 'open' },
      cost: '0.001000',
    });
    expect(files.get('demo.txt')?.data.toString('utf8')).toBe('hello paid upload');
  });

  it('accepts binary uploads with non-octet-stream content types', async () => {
    const body = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08]);
    const paid = await makePaidRequest('PUT', `${baseUrl}/v1/files/photo.jpg`, body, { 'content-type': 'image/jpeg' });

    expect(paid.status).toBe(200);
    expect(await paid.json()).toMatchObject({
      ok: true,
      file: { key: 'photo.jpg', size: body.length, contentType: 'image/jpeg', tier: 'open' },
    });
    expect(files.get('photo.jpg')?.data).toEqual(body);
  });

  it('serves small files without payment', async () => {
    files.set('small.txt', {
      data: Buffer.from('tiny file'),
      contentType: 'text/plain',
      lastModified: new Date(),
      etag: 'etag-small',
      tier: 'open',
      allowedWallets: [],
    });

    const response = await fetch(`${baseUrl}/v1/files/small.txt`);
    expect(response.status).toBe(200);
    expect(response.headers.get('x-storage-cost')).toBe('0.000000');
    expect(await response.text()).toBe('tiny file');
  });

  it('requires payment for large downloads and returns the file after a paid retry', async () => {
    const data = Buffer.alloc(2 * 1024 * 1024, 7);
    files.set('large.bin', {
      data,
      contentType: 'application/octet-stream',
      lastModified: new Date(),
      etag: 'etag-large',
      tier: 'open',
      allowedWallets: [],
    });

    const initial = await fetch(`${baseUrl}/v1/files/large.bin`);
    const initialText = await initial.text();
    if (initial.status !== 402) {
      throw new Error(`Expected 402, got ${initial.status}: ${initialText}`);
    }
    expect(initial.headers.get('payment-required')).toBeTruthy();

    const paid = await makePaidRequest('GET', `${baseUrl}/v1/files/large.bin`);
    expect(paid.status).toBe(200);
    expect(paid.headers.get('x-storage-cost')).not.toBe('0.000000');
    expect(Buffer.from(await paid.arrayBuffer())).toEqual(data);
  }, 15_000);

  it('stores a private file and only allows the owner wallet to read it', async () => {
    const body = Buffer.from('top secret');
    const upload = await makePaidRequest('PUT', `${baseUrl}/v1/files/private.txt`, body, {
      'content-type': 'text/plain',
      'x-storage-tier': 'private',
      ...(await authHeaders(payer, 'PUT', 'private.txt')),
    });

    expect(upload.status).toBe(200);
    expect(await upload.json()).toMatchObject({
      ok: true,
      file: {
        key: 'private.txt',
        tier: 'private',
        ownerWallet: payer.address,
      },
    });

    const noAuth = await fetch(`${baseUrl}/v1/files/private.txt`);
    expect(noAuth.status).toBe(401);

    const wrongWallet = await fetch(`${baseUrl}/v1/files/private.txt`, {
      headers: await authHeaders(intruder, 'GET', 'private.txt'),
    });
    expect(wrongWallet.status).toBe(403);

    const ownerRead = await fetch(`${baseUrl}/v1/files/private.txt`, {
      headers: await authHeaders(payer, 'GET', 'private.txt'),
    });
    expect(ownerRead.status).toBe(200);
    expect(await ownerRead.text()).toBe('top secret');
  });

  it('shows private files in listings only to authorized wallets', async () => {
    files.set('public.txt', {
      data: Buffer.from('public'),
      contentType: 'text/plain',
      lastModified: new Date(),
      etag: 'etag-public',
      tier: 'open',
      allowedWallets: [],
    });
    files.set('vault/secret.txt', {
      data: Buffer.from('secret'),
      contentType: 'text/plain',
      lastModified: new Date(),
      etag: 'etag-secret',
      tier: 'private',
      ownerWallet: payer.address,
      allowedWallets: [],
    });

    const anonymous = await fetch(`${baseUrl}/v1/list`);
    const anonymousJson = await anonymous.json();
    expect(anonymousJson.files.map((f: any) => f.key)).toEqual(['public.txt']);

    const owner = await fetch(`${baseUrl}/v1/list`, {
      headers: await authHeaders(payer, 'GET', '/v1/list'),
    });
    const ownerJson = await owner.json();
    expect(ownerJson.files.map((f: any) => f.key).sort()).toEqual(['public.txt', 'vault/secret.txt']);
  });

  it('returns storage metadata on HEAD requests instead of falling through to GET', async () => {
    files.set('meta.txt', {
      data: Buffer.from('metadata'),
      contentType: 'text/plain',
      lastModified: new Date('2026-01-01T00:00:00Z'),
      etag: 'etag-meta',
      tier: 'private',
      ownerWallet: payer.address,
      allowedWallets: [],
    });

    const head = await fetch(`${baseUrl}/v1/files/meta.txt`, {
      method: 'HEAD',
      headers: await authHeaders(payer, 'HEAD', 'meta.txt'),
    });

    expect(head.status).toBe(200);
    expect(head.headers.get('x-storage-tier')).toBe('private');
    expect(head.headers.get('x-storage-monthly-cost')).toBeTruthy();
    expect(head.headers.get('x-storage-cost-if-read')).toBeTruthy();
    expect(head.headers.get('x-storage-cost')).toBeNull();
  });

  it('creates expiring share links for private files without exposing wallet auth', async () => {
    const body = Buffer.from('share me with another agent');
    const upload = await makePaidRequest('PUT', `${baseUrl}/v1/files/share/private.txt`, body, {
      'content-type': 'text/plain',
      'x-storage-tier': 'private',
      ...(await authHeaders(payer, 'PUT', 'share/private.txt')),
    });
    expect(upload.status).toBe(200);

    const noAuthShare = await fetch(`${baseUrl}/v1/shares`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: 'share/private.txt', expiresInSeconds: 60 }),
    });
    expect(noAuthShare.status).toBe(401);

    const intruderShare = await fetch(`${baseUrl}/v1/shares`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(await authHeaders(intruder, 'POST', 'share/private.txt')),
      },
      body: JSON.stringify({ path: 'share/private.txt', expiresInSeconds: 60 }),
    });
    expect(intruderShare.status).toBe(403);

    const ownerShare = await fetch(`${baseUrl}/v1/shares`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(await authHeaders(payer, 'POST', 'share/private.txt')),
      },
      body: JSON.stringify({ path: 'share/private.txt', expiresInSeconds: 60 }),
    });
    expect(ownerShare.status).toBe(200);
    const shareJson = await ownerShare.json();
    expect(shareJson).toMatchObject({ ok: true, key: 'share/private.txt', expiresInSeconds: 60 });
    expect(shareJson.url).toMatch(/^\/v1\/shares\//);

    const sharedRead = await fetch(`${baseUrl}${shareJson.url}`);
    expect(sharedRead.status).toBe(200);
    expect(sharedRead.headers.get('x-vaultline-share-key')).toBe('share/private.txt');
    expect(sharedRead.headers.get('x-storage-tier')).toBe('private');
    expect(await sharedRead.text()).toBe('share me with another agent');
  });

  it('reports API calls, paid calls, unique users, and revenue from the usage ledger', async () => {
    const body = Buffer.from('meter this upload');
    const paid = await makePaidRequest('PUT', `${baseUrl}/v1/files/metered.txt`, body, { 'content-type': 'text/plain' });
    expect(paid.status).toBe(200);

    const usage = await waitForUsageSummary(baseUrl);
    expect(usage.totalFiles).toBe(1);
    expect(usage.metering.windows.allTime.calls).toBeGreaterThanOrEqual(2);
    expect(usage.metering.windows.allTime.paidCalls).toBeGreaterThanOrEqual(1);
    expect(usage.metering.windows.allTime.revenueUsd).toBeGreaterThanOrEqual(0.001);
    expect(usage.metering.windows.allTime.uniqueUsers).toBeGreaterThanOrEqual(1);
    expect(usage.metering.windows.allTime.byEndpoint.some((item: any) => item.endpoint === 'PUT /v1/files/*')).toBe(true);
    expect(usage.metering.revenueVsStorage.revenue30d).toBeTruthy();
  });
});

async function makePaidRequest(
  method: 'GET' | 'PUT',
  url: string,
  body?: Buffer,
  headers: Record<string, string> = {}
) {
  const initial = await fetch(url, { method, body, headers });
  const initialBodyText = await initial.text();
  if (initial.status !== 402) {
    throw new Error(`Expected 402, got ${initial.status}: ${initialBodyText}`);
  }
  const initialBody = initialBodyText ? JSON.parse(initialBodyText) : {};
  const paymentRequired = httpClient.getPaymentRequiredResponse((name) => initial.headers.get(name), initialBody);
  const paymentPayload = await client.createPaymentPayload(paymentRequired);

  return fetch(url, {
    method,
    body,
    headers: {
      ...headers,
      ...httpClient.encodePaymentSignatureHeader(paymentPayload),
    },
  });
}

async function authHeaders(account: ReturnType<typeof privateKeyToAccount>, method: string, path: string) {
  const timestamp = Date.now();
  const message = buildStorageAuthMessage({
    method,
    path,
    wallet: account.address,
    timestamp,
  });
  const signature = await account.signMessage({ message });

  return {
    'x-auth-wallet': account.address,
    'x-auth-timestamp': String(timestamp),
    'x-auth-signature': signature,
  };
}

async function waitForUsageSummary(baseUrl: string) {
  for (let i = 0; i < 10; i += 1) {
    const response = await fetch(`${baseUrl}/v1/usage`);
    const json = await response.json();
    if (json.metering?.windows?.allTime?.paidCalls >= 1) return json;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  const response = await fetch(`${baseUrl}/v1/usage`);
  return response.json();
}

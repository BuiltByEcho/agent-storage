import { createHmac, timingSafeEqual } from 'node:crypto';

const MAX_EXPIRES_IN_SECONDS = 7 * 24 * 60 * 60;
const DEFAULT_EXPIRES_IN_SECONDS = 60 * 60;

type SharePayload = {
  v: 1;
  key: string;
  exp: number;
};

export type ShareTokenPayload = SharePayload;

export function createShareToken(input: { key: string; expiresInSeconds?: number; nowMs?: number }) {
  const nowMs = input.nowMs ?? Date.now();
  const expiresInSeconds = normalizeExpiresInSeconds(input.expiresInSeconds);
  const payload: SharePayload = {
    v: 1,
    key: input.key,
    exp: Math.floor(nowMs / 1000) + expiresInSeconds,
  };
  const payloadPart = base64urlEncode(JSON.stringify(payload));
  const signaturePart = sign(payloadPart);
  return {
    token: `${payloadPart}.${signaturePart}`,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
    expiresInSeconds,
  };
}

export function verifyShareToken(token: string, nowMs = Date.now()): SharePayload {
  const [payloadPart, signaturePart, extra] = token.split('.');
  if (!payloadPart || !signaturePart || extra !== undefined) {
    throw new Error('Invalid share token');
  }

  const expected = sign(payloadPart);
  if (!safeEqual(signaturePart, expected)) {
    throw new Error('Invalid share token signature');
  }

  let payload: SharePayload;
  try {
    payload = JSON.parse(base64urlDecode(payloadPart).toString('utf8')) as SharePayload;
  } catch {
    throw new Error('Invalid share token payload');
  }

  if (payload.v !== 1 || !payload.key || typeof payload.exp !== 'number') {
    throw new Error('Invalid share token payload');
  }

  if (payload.exp <= Math.floor(nowMs / 1000)) {
    throw new Error('Share token expired');
  }

  return payload;
}

export function normalizeExpiresInSeconds(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_EXPIRES_IN_SECONDS;
  return Math.min(Math.floor(parsed), MAX_EXPIRES_IN_SECONDS);
}

function sign(payloadPart: string) {
  return createHmac('sha256', getShareSecret()).update(payloadPart).digest('base64url');
}

function getShareSecret() {
  const secret = process.env.VAULTLINE_SHARE_SECRET || '';
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('VAULTLINE_SHARE_SECRET is required in production');
  }
  return 'vaultline-dev-share-secret';
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function base64urlEncode(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64urlDecode(value: string) {
  return Buffer.from(value, 'base64url');
}

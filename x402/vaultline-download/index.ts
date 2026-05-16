declare const process: { env?: Record<string, string | undefined> };

const VAULTLINE_BASE_URL = 'https://storage.builtbyecho.xyz';
const MAX_TRANSFER_BYTES = 5 * 1024 * 1024;
const MIN_CHARGE = 0.002;
const PRICE_MULTIPLIER = 2;
const RETRIEVAL_PER_GB = 0.015;

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST required' }, 405, MIN_CHARGE);

  try {
    const body = await req.json();
    const path = normalizePath(body.path);
    const maxBytes = clampMaxBytes(body.maxBytes);
    const encodedPath = encodeURIComponent(path).replaceAll('%2F', '/');

    const head = await fetch(`${VAULTLINE_BASE_URL}/v1/files/${encodedPath}`, { method: 'HEAD' });
    if (!head.ok) return json({ ok: false, error: `Vaultline object metadata lookup failed: ${head.status}` }, head.status, MIN_CHARGE);

    const size = Number.parseInt(head.headers.get('content-length') || '0', 10);
    if (Number.isFinite(size) && size > maxBytes) {
      return json({ ok: false, error: `Object is ${size} bytes, above requested maxBytes ${maxBytes}` }, 413, MIN_CHARGE);
    }

    const amount = priceByGb(Number.isFinite(size) ? size : 0, RETRIEVAL_PER_GB);
    const upstream = await fetch(`${VAULTLINE_BASE_URL}/v1/files/${encodedPath}`, {
      headers: {
        'x-vaultline-bankr-proxy-token': getProxyToken(),
        'x-vaultline-payment-provider': 'bankr',
        'x-bankr-service': 'vaultline-download',
        'x-bankr-network': 'base',
        'x-bankr-settle-amount': amount.toFixed(6),
      },
    });
    if (!upstream.ok) return json({ ok: false, error: `Vaultline download failed: ${upstream.status}` }, upstream.status, amount);

    const bytes = new Uint8Array(await upstream.arrayBuffer());
    if (bytes.byteLength > maxBytes) {
      return json({ ok: false, error: `Object is ${bytes.byteLength} bytes, above requested maxBytes ${maxBytes}` }, 413, amount);
    }

    const asText = body.asText === true;
    return json({
      ok: true,
      path,
      content: asText ? new TextDecoder().decode(bytes) : toBase64(bytes),
      encoding: asText ? 'text' : 'base64',
      contentType: upstream.headers.get('content-type') || 'application/octet-stream',
      size: bytes.byteLength,
      price: amount.toFixed(6),
      bankr: {
        service: 'vaultline-download',
        paymentScheme: 'exact',
        settledAmount: amount.toFixed(6),
      },
    }, 200, amount);
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Bad request' }, 400, MIN_CHARGE);
  }
}

function normalizePath(value: unknown) {
  const path = String(value || '').trim();
  if (!path || path.startsWith('/') || path.includes('\0') || path.length > 1024 || path.split('/').some((part) => part === '..')) {
    throw new Error('path must be a relative Vaultline object path');
  }
  return path;
}

function clampMaxBytes(value: unknown) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return MAX_TRANSFER_BYTES;
  return Math.min(parsed, MAX_TRANSFER_BYTES);
}

function getProxyToken() {
  const token = process.env?.VAULTLINE_BANKR_PROXY_TOKEN ?? process.env?.BANKR_PROXY_TOKEN;
  if (!token) throw new Error('VAULTLINE_BANKR_PROXY_TOKEN is not configured in Bankr x402 env');
  return token;
}

function priceByGb(bytes: number, rate: number) {
  const gb = bytes / (1024 * 1024 * 1024);
  return Number(Math.max(gb * rate * PRICE_MULTIPLIER, MIN_CHARGE).toFixed(6));
}

function toBase64(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function atomicUsdc(amount: number) {
  return String(Math.max(1, Math.round(amount * 1_000_000)));
}

function json(value: unknown, status = 200, amount = MIN_CHARGE) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json',
      'x-402-settle-amount': atomicUsdc(amount),
    },
  });
}

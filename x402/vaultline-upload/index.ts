declare const process: { env?: Record<string, string | undefined> };

const VAULTLINE_BASE_URL = 'https://storage.builtbyecho.xyz';
const MAX_TRANSFER_BYTES = 5 * 1024 * 1024;
const MIN_CHARGE = 0.002;
const PRICE_MULTIPLIER = 2;
const WRITE_PER_GB = 0.03;

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST required' }, 405, MIN_CHARGE);

  try {
    const body = await req.json();
    const path = normalizePath(body.path);
    const bytes = decodeContent(body.content, body.encoding);
    if (bytes.byteLength > MAX_TRANSFER_BYTES) {
      return json({ ok: false, error: `Bankr upload endpoint currently caps payloads at ${MAX_TRANSFER_BYTES} bytes` }, 413, MIN_CHARGE);
    }

    const amount = priceByGb(bytes.byteLength, WRITE_PER_GB);
    const upstream = await fetch(`${VAULTLINE_BASE_URL}/v1/files/${encodeURIComponent(path).replaceAll('%2F', '/')}`, {
      method: 'PUT',
      headers: {
        'content-type': String(body.contentType || 'application/octet-stream'),
        'x-vaultline-bankr-proxy-token': getProxyToken(),
        'x-vaultline-payment-provider': 'bankr',
        'x-bankr-service': 'vaultline-upload',
        'x-bankr-network': 'base',
        'x-bankr-settle-amount': amount.toFixed(6),
      },
      body: bytes,
    });

    const data = await upstream.json().catch(async () => ({ body: await upstream.text() }));
    return json({
      ok: upstream.ok,
      ...data,
      price: amount.toFixed(6),
      bankr: {
        service: 'vaultline-upload',
        paymentScheme: 'exact',
        settledAmount: amount.toFixed(6),
        note: 'Bankr x402 is the primary public payment route; Vaultline direct x402 remains available as fallback.',
      },
    }, upstream.status, amount);
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

function decodeContent(content: unknown, encoding: unknown) {
  const raw = String(content || '');
  if (!raw) throw new Error('content is required');
  const mode = String(encoding || 'text').toLowerCase();
  if (mode === 'base64') {
    const binary = atob(raw);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  }
  if (mode === 'text') return new TextEncoder().encode(raw);
  throw new Error('encoding must be text or base64');
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

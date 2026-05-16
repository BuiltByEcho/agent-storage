declare const process: { env?: Record<string, string | undefined> };

const VAULTLINE_BASE_URL = 'https://storage.builtbyecho.xyz';
const AMOUNT = 0.002;

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST required' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const prefix = body.prefix ? normalizePath(body.prefix) : '';
    const path = prefix ? `/v1/list/${encodeURIComponent(prefix).replaceAll('%2F', '/')}` : '/v1/list';
    const upstream = await fetch(`${VAULTLINE_BASE_URL}${path}`, {
      headers: {
        'x-vaultline-bankr-proxy-token': getProxyToken(),
        'x-vaultline-payment-provider': 'bankr',
        'x-bankr-service': 'vaultline-list',
        'x-bankr-network': 'base',
        'x-bankr-settle-amount': AMOUNT.toFixed(6),
      },
    });
    const data = await upstream.json().catch(async () => ({ body: await upstream.text() }));
    return json({
      ok: upstream.ok,
      ...data,
      price: AMOUNT.toFixed(6),
      bankr: {
        service: 'vaultline-list',
        paymentScheme: 'exact',
        settledAmount: AMOUNT.toFixed(6),
      },
    }, upstream.status);
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Bad request' }, 400);
  }
}

function normalizePath(value: unknown) {
  const path = String(value || '').trim();
  if (!path || path.startsWith('/') || path.includes('\0') || path.length > 1024 || path.split('/').some((part) => part === '..')) {
    throw new Error('prefix must be a relative Vaultline object path');
  }
  return path;
}

function getProxyToken() {
  const token = process.env?.VAULTLINE_BANKR_PROXY_TOKEN ?? process.env?.BANKR_PROXY_TOKEN;
  if (!token) throw new Error('VAULTLINE_BANKR_PROXY_TOKEN is not configured in Bankr x402 env');
  return token;
}

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

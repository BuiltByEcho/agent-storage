import { describe, expect, it, vi } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { VaultlineClient } from '../src/client.js';
import { VaultlineError } from '../src/errors.js';

const privateKey = '0x39ad39ad39ad39ad39ad39ad39ad39ad39ad39ad39ad39ad39ad39ad39ad39ad' as const;
const account = privateKeyToAccount(privateKey);

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

describe('VaultlineClient', () => {
  it('uploads open files and retries after 402', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            x402Version: 2,
            accepts: [
              {
                scheme: 'exact',
                network: 'eip155:8453',
                asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
                amount: '1000',
                payTo: '0x712374b58b957644A73C48F7CFbbd6365eaCbC73',
                maxTimeoutSeconds: 60,
                extra: { name: 'USD Coin', version: '2' },
              },
            ],
          },
          {
            status: 402,
            headers: {
              'payment-required': Buffer.from(
                JSON.stringify({
                  x402Version: 2,
                  accepts: [
                    {
                      scheme: 'exact',
                      network: 'eip155:8453',
                      asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
                      amount: '1000',
                      payTo: '0x712374b58b957644A73C48F7CFbbd6365eaCbC73',
                      maxTimeoutSeconds: 60,
                      extra: { name: 'USD Coin', version: '2' },
                    },
                  ],
                  resource: { uri: '/v1/files/demo.txt' },
                })
              ).toString('base64'),
            },
          }
        )
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          file: { key: 'demo.txt', size: 5, lastModified: new Date().toISOString(), tier: 'open' },
          cost: '0.001000',
        })
      );

    const client = new VaultlineClient({ baseUrl: 'https://vaultline.example.com', account, fetch: fetchMock });
    const result = await client.upload('demo.txt', 'hello', { contentType: 'text/plain' });

    expect(result.data.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryHeaders = new Headers(fetchMock.mock.calls[1]?.[1]?.headers);
    expect(retryHeaders.get('payment-signature')).toBeTruthy();
  });

  it('adds private auth headers for private uploads', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        ok: true,
        file: { key: 'secret.txt', size: 6, lastModified: new Date().toISOString(), tier: 'private', ownerWallet: account.address },
        cost: '0.001000',
      })
    );

    const client = new VaultlineClient({ baseUrl: 'https://vaultline.example.com', account, fetch: fetchMock });
    await client.upload('secret.txt', 'secret', { tier: 'private', contentType: 'text/plain' });

    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(headers.get('x-storage-tier')).toBe('private');
    expect(headers.get('x-auth-wallet')).toBe(account.address);
    expect(headers.get('x-auth-signature')).toBeTruthy();
  });

  it('adds auth headers when listing private files', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ files: [], directories: [], prefix: '', truncated: false })
    );

    const client = new VaultlineClient({ baseUrl: 'https://vaultline.example.com', account, fetch: fetchMock });
    await client.list('', { includePrivate: true });

    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(headers.get('x-auth-wallet')).toBe(account.address);
  });

  it('creates private share links with wallet auth headers', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        ok: true,
        token: 'token',
        url: '/v1/shares/token',
        key: 'secret.txt',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        expiresInSeconds: 60,
      })
    );

    const client = new VaultlineClient({ baseUrl: 'https://vaultline.example.com', account, fetch: fetchMock });
    const share = await client.createShare('secret.txt', { tier: 'private', expiresInSeconds: 60 });

    expect(share.data.url).toBe('https://vaultline.example.com/v1/shares/token');
    expect(fetchMock).toHaveBeenCalledWith('https://vaultline.example.com/v1/shares', expect.objectContaining({ method: 'POST' }));
    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('x-auth-wallet')).toBe(account.address);
    expect(headers.get('x-auth-signature')).toBeTruthy();
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ path: 'secret.txt', expiresInSeconds: 60 });
  });

  it('downloads share links without wallet auth or x402 handling', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('shared text'));
    const client = new VaultlineClient({ baseUrl: 'https://vaultline.example.com', account, fetch: fetchMock });

    const result = await client.downloadShareText('token');

    expect(result.text).toBe('shared text');
    expect(fetchMock).toHaveBeenCalledWith('https://vaultline.example.com/v1/shares/token', expect.objectContaining({ method: 'GET' }));
  });

  it('throws typed errors with parsed response bodies for failed SDK helpers', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ error: 'file not found', key: 'missing.txt' }, { status: 404, statusText: 'Not Found' })
    );

    const client = new VaultlineClient({ baseUrl: 'https://vaultline.example.com', account, fetch: fetchMock });

    await expect(client.downloadText('missing.txt')).rejects.toMatchObject({
      name: 'VaultlineError',
      status: 404,
      body: { error: 'file not found', key: 'missing.txt' },
    });
  });

  it('passes an abort signal when a default timeout is configured', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ files: [], directories: [], prefix: '', truncated: false })
    );

    const client = new VaultlineClient({
      baseUrl: 'https://vaultline.example.com',
      account,
      fetch: fetchMock,
      timeoutMs: 5000,
    });
    await client.list('workspace');

    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('exports VaultlineError for instanceof checks', () => {
    const error = new VaultlineError('boom', { status: 500 });
    expect(error).toBeInstanceOf(VaultlineError);
    expect(error.status).toBe(500);
  });
});

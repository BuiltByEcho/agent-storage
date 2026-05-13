import { describe, expect, it, vi } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { AgentStorageClient } from '../src/client.js';

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

describe('AgentStorageClient', () => {
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

    const client = new AgentStorageClient({ baseUrl: 'https://agent-storage.example.com', account, fetch: fetchMock });
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

    const client = new AgentStorageClient({ baseUrl: 'https://agent-storage.example.com', account, fetch: fetchMock });
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

    const client = new AgentStorageClient({ baseUrl: 'https://agent-storage.example.com', account, fetch: fetchMock });
    await client.list('', { includePrivate: true });

    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(headers.get('x-auth-wallet')).toBe(account.address);
  });
});

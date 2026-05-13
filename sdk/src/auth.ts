import { getAddress } from 'viem';
import type { PrivateKeyAccount } from 'viem/accounts';

export function buildStorageAuthMessage(input: {
  method: string;
  path: string;
  wallet: string;
  timestamp: number;
}) {
  return [
    'Vaultline auth',
    `method:${input.method.toUpperCase()}`,
    `path:${normalizeStoragePath(input.path)}`,
    `wallet:${getAddress(input.wallet)}`,
    `timestamp:${input.timestamp}`,
  ].join('\n');
}

export async function createStorageAuthHeaders(input: {
  account: PrivateKeyAccount;
  method: string;
  path: string;
  timestamp?: number;
}) {
  const timestamp = input.timestamp ?? Date.now();
  const message = buildStorageAuthMessage({
    method: input.method,
    path: input.path,
    wallet: input.account.address,
    timestamp,
  });

  const signature = await input.account.signMessage({ message });

  return {
    'x-auth-wallet': input.account.address,
    'x-auth-timestamp': String(timestamp),
    'x-auth-signature': signature,
  };
}

export function normalizeStoragePath(path: string) {
  return path.replace(/^\/+/, '');
}

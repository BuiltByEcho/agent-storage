import { getAddress, isAddress, verifyMessage } from 'viem';

export type AuthenticatedWallet = {
  wallet: `0x${string}`;
  timestamp: number;
};

const AUTH_WINDOW_MS = 5 * 60 * 1000;

export function buildStorageAuthMessage(input: {
  method: string;
  path: string;
  wallet: string;
  timestamp: number;
}) {
  return [
    'AgentStorage auth',
    `method:${input.method.toUpperCase()}`,
    `path:${input.path}`,
    `wallet:${normalizeWallet(input.wallet)}`,
    `timestamp:${input.timestamp}`,
  ].join('\n');
}

export async function verifyStorageRequestAuth(input: {
  method: string;
  path: string;
  wallet: string | undefined;
  signature: string | undefined;
  timestamp: string | undefined;
  now?: number;
}): Promise<AuthenticatedWallet> {
  const wallet = normalizeWallet(input.wallet);
  if (!wallet) throw new Error('Missing x-auth-wallet header');
  if (!input.signature) throw new Error('Missing x-auth-signature header');
  if (!input.timestamp) throw new Error('Missing x-auth-timestamp header');

  const timestamp = Number.parseInt(input.timestamp, 10);
  if (!Number.isFinite(timestamp)) throw new Error('Invalid x-auth-timestamp header');

  const now = input.now ?? Date.now();
  if (Math.abs(now - timestamp) > AUTH_WINDOW_MS) {
    throw new Error('Authentication timestamp expired');
  }

  const message = buildStorageAuthMessage({
    method: input.method,
    path: input.path,
    wallet,
    timestamp,
  });

  const valid = await verifyMessage({
    address: wallet,
    message,
    signature: input.signature as `0x${string}`,
  });

  if (!valid) throw new Error('Invalid wallet signature');

  return { wallet, timestamp };
}

export function normalizeWallet(value: string | undefined): `0x${string}` | undefined {
  if (!value || !isAddress(value)) return undefined;
  return getAddress(value);
}

export function parseWalletList(value: string | undefined): `0x${string}`[] {
  if (!value) return [];
  const wallets = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => normalizeWallet(item));

  if (wallets.some((wallet) => !wallet)) {
    throw new Error('Invalid wallet address in x-allowed-wallets');
  }

  return Array.from(new Set(wallets as `0x${string}`[]));
}

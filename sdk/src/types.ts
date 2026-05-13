import type { PrivateKeyAccount } from 'viem/accounts';

export type StorageTier = 'open' | 'private';

export type AgentStorageClientOptions = {
  baseUrl: string;
  account: PrivateKeyAccount;
  fetch?: typeof fetch;
};

export type PrivateAccessOptions = {
  ownerWallet?: `0x${string}`;
  allowedWallets?: `0x${string}`[];
};

export type UploadOptions = {
  contentType?: string;
  tier?: StorageTier;
} & PrivateAccessOptions;

export type DownloadOptions = {
  tier?: StorageTier;
};

export type HeadOptions = {
  tier?: StorageTier;
};

export type DeleteOptions = {
  tier?: StorageTier;
};

export type ListOptions = {
  includePrivate?: boolean;
};

export type UploadResponse = {
  ok: boolean;
  file: {
    key: string;
    size: number;
    lastModified: string;
    contentType?: string;
    etag?: string;
    tier: StorageTier;
    ownerWallet?: `0x${string}`;
    allowedWallets?: `0x${string}`[];
  };
  cost: string;
};

export type DeleteResponse = {
  ok: boolean;
  deleted: string;
};

export type ListResponse = {
  files: Array<{
    key: string;
    size: number;
    lastModified: string;
    contentType?: string;
    etag?: string;
    tier?: StorageTier;
    ownerWallet?: `0x${string}`;
    allowedWallets?: `0x${string}`[];
  }>;
  directories: string[];
  prefix: string;
  truncated: boolean;
};

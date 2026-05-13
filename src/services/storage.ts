import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PRICING, R2_CONFIG } from '../config.js';
import { calculateStorageCost, calculateRetrievalCost, calculateWriteCost } from '../pricing.js';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: R2_CONFIG.endpoint,
  credentials: {
    accessKeyId: R2_CONFIG.accessKeyId,
    secretAccessKey: R2_CONFIG.secretAccessKey,
  },
  tls: true,
});

export type StorageTier = 'open' | 'private';

export interface AccessPolicy {
  tier: StorageTier;
  ownerWallet?: `0x${string}`;
  allowedWallets?: `0x${string}`[];
}

export interface FileMetadata {
  key: string;
  size: number;
  lastModified: Date;
  contentType?: string;
  etag?: string;
  tier: StorageTier;
  ownerWallet?: `0x${string}`;
  allowedWallets: `0x${string}`[];
}

export interface ListResult {
  files: FileMetadata[];
  directories: string[];
  prefix: string;
  truncated: boolean;
}

export async function uploadFile(
  key: string,
  data: Buffer,
  contentType?: string,
  accessPolicy: AccessPolicy = { tier: 'open', allowedWallets: [] }
): Promise<FileMetadata> {
  const command = new PutObjectCommand({
    Bucket: R2_CONFIG.bucketName,
    Key: key,
    Body: data,
    ContentType: contentType,
    Metadata: encodeAccessPolicy(accessPolicy),
  });

  await s3Client.send(command);
  return getFileMetadata(key);
}

export async function downloadFile(key: string): Promise<{ data: Buffer; metadata: FileMetadata }> {
  const command = new GetObjectCommand({
    Bucket: R2_CONFIG.bucketName,
    Key: key,
  });

  const response = await s3Client.send(command);
  if (!response.Body) throw new Error(`File not found: ${key}`);

  const bytes = await response.Body.transformToByteArray();
  const data = Buffer.from(bytes);

  return {
    data,
    metadata: {
      key,
      size: data.length,
      lastModified: response.LastModified ?? new Date(),
      contentType: response.ContentType,
      etag: response.ETag,
      ...decodeAccessPolicy(response.Metadata),
    },
  };
}

export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: R2_CONFIG.bucketName,
    Key: key,
  });
  await s3Client.send(command);
}

export async function getFileMetadata(key: string): Promise<FileMetadata> {
  const command = new HeadObjectCommand({
    Bucket: R2_CONFIG.bucketName,
    Key: key,
  });

  const response = await s3Client.send(command);
  return {
    key,
    size: response.ContentLength ?? 0,
    lastModified: response.LastModified ?? new Date(),
    contentType: response.ContentType,
    etag: response.ETag,
    ...decodeAccessPolicy(response.Metadata),
  };
}

export async function listFiles(prefix: string, maxKeys = 1000): Promise<ListResult> {
  const command = new ListObjectsV2Command({
    Bucket: R2_CONFIG.bucketName,
    Prefix: prefix,
    MaxKeys: maxKeys,
  });

  const response = await s3Client.send(command);
  const files: FileMetadata[] = (response.Contents ?? []).map((obj) => ({
    key: obj.Key!,
    size: obj.Size ?? 0,
    lastModified: obj.LastModified ?? new Date(),
    tier: 'open',
    allowedWallets: [],
  }));

  const directories = new Set<string>();
  for (const f of files) {
    const parts = f.key.replace(prefix, '').split('/');
    if (parts.length > 1) {
      directories.add(prefix + parts[0] + '/');
    }
  }

  return {
    files,
    directories: Array.from(directories),
    prefix,
    truncated: response.IsTruncated ?? false,
  };
}

export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: R2_CONFIG.bucketName,
    Key: key,
  });
  return getSignedUrl(s3Client, command, { expiresIn });
}

function encodeAccessPolicy(policy: AccessPolicy): Record<string, string> {
  return {
    tier: policy.tier,
    ownerwallet: policy.ownerWallet ?? '',
    allowedwallets: (policy.allowedWallets ?? []).join(','),
  };
}

function decodeAccessPolicy(metadata?: Record<string, string>): Pick<FileMetadata, 'tier' | 'ownerWallet' | 'allowedWallets'> {
  const tier = metadata?.tier === 'private' ? 'private' : 'open';
  const ownerWallet = metadata?.ownerwallet ? (metadata.ownerwallet as `0x${string}`) : undefined;
  const allowedWallets = metadata?.allowedwallets
    ? metadata.allowedwallets
        .split(',')
        .map((wallet) => wallet.trim())
        .filter(Boolean) as `0x${string}`[]
    : [];

  return { tier, ownerWallet, allowedWallets };
}

export { PRICING, calculateStorageCost, calculateRetrievalCost, calculateWriteCost };

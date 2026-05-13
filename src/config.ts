import 'dotenv/config';

function envOrDefault(name: string, fallback: string): string {
  const value = process.env[name];
  if (value) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required production env var: ${name}`);
  }
  return fallback;
}

function parseBytes(value: string | undefined, fallback: string): string {
  return value && value.trim() ? value : fallback;
}

export const PRICING = {
  open: {
    storage: parseFloat(process.env.PRICE_STORAGE_PER_GB_MONTH ?? '0.08'),
    retrieval: parseFloat(process.env.PRICE_RETRIEVAL_PER_GB ?? '0.015'),
    write: parseFloat(process.env.PRICE_WRITE_PER_GB ?? '0.03'),
  },
  private: {
    storage: parseFloat(process.env.PRICE_PRIVATE_STORAGE_PER_GB_MONTH ?? '0.12'),
    retrieval: parseFloat(process.env.PRICE_PRIVATE_RETRIEVAL_PER_GB ?? '0.02'),
    write: parseFloat(process.env.PRICE_PRIVATE_WRITE_PER_GB ?? '0.045'),
  },
  freeReadMaxBytes: parseInt(process.env.FREE_READ_MAX_BYTES ?? '1048576', 10),
} as const;

export const X402_CONFIG = {
  network: process.env.X402_NETWORK ?? 'base',
  usdcContract: process.env.X402_USDC_CONTRACT ?? '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  treasuryWallet: envOrDefault('X402_TREASURY_WALLET', '0x13843882c89444bd2ba55ea9ade90c5b26b92d90'),
  facilitatorUrl: process.env.X402_FACILITATOR_URL ?? 'https://x402.org/facilitator',
  cdpApiKeyId: process.env.CDP_API_KEY_ID ?? process.env.CDP_KEY_NAME ?? '',
  cdpApiKeySecret: process.env.CDP_API_KEY_SECRET ?? process.env.CDP_KEY_SECRET ?? '',
} as const;

export const R2_CONFIG = {
  accountId: process.env.R2_ACCOUNT_ID ?? '',
  accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  bucketName: process.env.R2_BUCKET_NAME ?? 'agent-storage',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
} as const;

export const B2_CONFIG = {
  applicationKeyId: process.env.B2_APPLICATION_KEY_ID ?? '',
  applicationKey: process.env.B2_APPLICATION_KEY ?? '',
  bucketName: process.env.B2_BUCKET_NAME ?? 'agent-storage',
} as const;

export const SERVER_CONFIG = {
  port: parseInt(process.env.PORT ?? '3001', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  bodyLimit: parseBytes(process.env.REQUEST_BODY_LIMIT, '100mb'),
  corsOrigins: (process.env.CORS_ORIGINS ?? '*')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
} as const;

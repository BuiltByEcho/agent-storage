import { Router } from 'express';
import { paymentMiddleware } from '@x402/express';
import {
  uploadFile,
  downloadFile,
  deleteFile,
  getFileMetadata,
  listFiles,
  type AccessPolicy,
  type FileMetadata,
} from '../services/storage.js';
import { calculatePaymentAmount } from '../pricing.js';
import { PRICING, X402_CONFIG } from '../config.js';
import { getResourceServer, X402_MAINNET_NETWORK } from '../cdpFacilitator.js';
import { parseWalletList, verifyStorageRequestAuth, type AuthenticatedWallet } from '../auth.js';

const router = Router();
const resourceServer = getResourceServer();
const testPayTo = (process.env.X402_TEST_PAYTO || X402_CONFIG.treasuryWallet) as `0x${string}` | '';

type RouteRequest = {
  method: string;
  headers: Record<string, unknown>;
  params: Record<string, unknown>;
  authWallet?: AuthenticatedWallet;
};

const uploadPaymentMiddleware = testPayTo
  ? paymentMiddleware(
      {
        'PUT /v1/files/*': {
          accepts: {
            scheme: 'exact',
            price: async ({ adapter }) =>
              formatUsd(calculatePaymentAmount('write', getRequestSizeBytes(adapter), getRequestedStorageTierFromAdapter(adapter))),
            network: X402_MAINNET_NETWORK,
            payTo: testPayTo,
          },
          description: 'Upload a file to Vaultline',
          mimeType: 'application/json',
          unpaidResponseBody: async ({ adapter, path }) => {
            const sizeBytes = getRequestSizeBytes(adapter);
            const tier = getRequestedStorageTierFromAdapter(adapter);
            const amount = calculatePaymentAmount('write', sizeBytes, tier);
            return {
              contentType: 'application/json',
              body: {
                error: 'payment_required',
                operation: 'write',
                path,
                amount: amount.toFixed(6),
                currency: 'USDC',
                network: X402_MAINNET_NETWORK,
                payTo: testPayTo,
                sizeBytes,
                tier,
                description: `Upload ${path} (${formatBytes(sizeBytes)})`,
              },
            };
          },
        },
      },
      resourceServer
    )
  : (_req: any, _res: any, next: () => void) => next();

const downloadPaymentMiddleware = testPayTo
  ? paymentMiddleware(
      {
        'GET /v1/files/*': {
          accepts: {
            scheme: 'exact',
            price: async ({ path }) => formatUsd(await getDownloadCostFromPath(path)),
            network: X402_MAINNET_NETWORK,
            payTo: testPayTo,
          },
          description: 'Download a file from Vaultline',
          mimeType: 'application/octet-stream',
          unpaidResponseBody: async ({ path }) => {
            const { key, size, amount } = await getDownloadPricingFromPath(path);
            return {
              contentType: 'application/json',
              body: {
                error: 'payment_required',
                operation: 'read',
                path,
                key,
                amount: amount.toFixed(6),
                currency: 'USDC',
                network: X402_MAINNET_NETWORK,
                payTo: testPayTo,
                sizeBytes: size,
                description: `Download ${key} (${formatBytes(size)})`,
              },
            };
          },
        },
      },
      resourceServer
    )
  : (_req: any, _res: any, next: () => void) => next();

router.put('/v1/files/*path', enforcePrivateUploadAuth, uploadPaymentMiddleware, async (req, res) => {
  const filePath = getParamPath(req.params.path);
  if (!filePath) {
    res.status(400).json({ error: 'File path required' });
    return;
  }

  const data = normalizeBodyToBuffer(req.body);

  try {
    const contentType = typeof req.headers['content-type'] === 'string' ? req.headers['content-type'] : undefined;
    const accessPolicy = getRequestedAccessPolicy(req as RouteRequest, filePath);
    const metadata = await uploadFile(filePath, data, contentType, accessPolicy);
    res.json({
      ok: true,
      file: metadata,
      cost: calculatePaymentAmount('write', data.length, metadata.tier).toFixed(6),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.head('/v1/files/*path', authorizePrivateFileAccess, async (req, res) => {
  const filePath = getParamPath(req.params.path);
  if (!filePath) {
    res.status(400).json({ error: 'File path required' });
    return;
  }

  try {
    const meta = await getFileMetadata(filePath);
    const readCost = calculatePaymentAmount('read', meta.size, meta.tier);
    res.setHeader('Content-Length', meta.size.toString());
    res.setHeader('Content-Type', meta.contentType ?? 'application/octet-stream');
    res.setHeader('Last-Modified', meta.lastModified.toUTCString());
    res.setHeader('X-Storage-Cost-If-Read', readCost.toFixed(6));
    res.setHeader('X-Storage-Monthly-Cost', calculatePaymentAmount('storage', meta.size, meta.tier).toFixed(6));
    res.setHeader('X-Storage-Tier', meta.tier);
    if (meta.ownerWallet) res.setHeader('X-Storage-Owner-Wallet', meta.ownerWallet);
    res.sendStatus(200);
  } catch {
    res.status(404).json({ error: 'File not found' });
  }
});

router.get('/v1/files/*path', authorizePrivateFileAccess, freeDownloadBypass, downloadPaymentMiddleware, async (req, res) => {
  const filePath = getParamPath(req.params.path);
  if (!filePath) {
    res.status(400).json({ error: 'File path required' });
    return;
  }

  try {
    const result = await downloadFile(filePath);
    const cost = calculatePaymentAmount('read', result.metadata.size, result.metadata.tier);
    res.setHeader('Content-Type', result.metadata.contentType ?? 'application/octet-stream');
    res.setHeader('X-Storage-Cost', cost.toFixed(6));
    res.send(result.data);
  } catch (err: any) {
    if (err.name === 'NoSuchKey' || err.message?.includes('not found')) {
      res.status(404).json({ error: 'File not found' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

router.delete('/v1/files/*path', authorizePrivateFileAccess, async (req, res) => {
  const filePath = getParamPath(req.params.path);
  if (!filePath) {
    res.status(400).json({ error: 'File path required' });
    return;
  }

  try {
    await deleteFile(filePath);
    res.json({ ok: true, deleted: filePath });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/v1/list', async (req, res) => {
  try {
    const result = await filterListForViewer('', req as RouteRequest);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/v1/list/*prefix', async (req, res) => {
  const prefix = getParamPath(req.params.prefix) ?? '';
  try {
    const result = await filterListForViewer(prefix, req as RouteRequest);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/v1/usage', async (_req, res) => {
  try {
    const allFiles = await listFiles('');
    const totalBytes = allFiles.files.reduce((sum, f) => sum + f.size, 0);
    const monthlyCost = allFiles.files.reduce(
      (sum, file) => sum + calculatePaymentAmount('storage', file.size, file.tier),
      0
    );

    res.json({
      totalFiles: allFiles.files.length,
      totalBytes,
      totalGB: totalBytes / (1024 * 1024 * 1024),
      estimatedMonthlyCost: monthlyCost.toFixed(4),
      pricing: {
        open: {
          storagePerGBMonth: PRICING.open.storage,
          retrievalPerGB: PRICING.open.retrieval,
          writePerGB: PRICING.open.write,
        },
        private: {
          storagePerGBMonth: PRICING.private.storage,
          retrievalPerGB: PRICING.private.retrieval,
          writePerGB: PRICING.private.write,
        },
        freeReadMaxBytes: PRICING.freeReadMaxBytes,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/v1/health', (_req, res) => {
  res.json({ status: 'ok', service: 'vaultline', version: '0.1.0' });
});

async function enforcePrivateUploadAuth(req: any, res: any, next: () => void) {
  const filePath = getParamPath(req.params.path);
  if (!filePath) {
    res.status(400).json({ error: 'File path required' });
    return;
  }

  if (getRequestedStorageTier(req) !== 'private') {
    next();
    return;
  }

  try {
    req.authWallet = await verifyRequestWallet(req, filePath);
    next();
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
}

async function authorizePrivateFileAccess(req: any, res: any, next: () => void) {
  const filePath = getParamPath(req.params.path);
  if (!filePath) {
    res.status(400).json({ error: 'File path required' });
    return;
  }

  try {
    const meta = await getFileMetadata(filePath);
    if (meta.tier !== 'private') {
      next();
      return;
    }

    const authWallet = await verifyRequestWallet(req, filePath);
    req.authWallet = authWallet;

    if (!canAccessPrivateFile(meta, authWallet.wallet)) {
      res.status(403).json({ error: 'Wallet is not authorized for this private file' });
      return;
    }

    next();
  } catch (err: any) {
    if (err.name === 'NoSuchKey' || err.message?.includes('not found')) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const status = err.message?.includes('Missing x-auth-') || err.message?.includes('Invalid x-auth-') || err.message?.includes('expired') || err.message?.includes('Invalid wallet signature') ? 401 : 500;
    res.status(status).json({ error: err.message });
  }
}

async function freeDownloadBypass(req: any, res: any, next: () => void) {
  const filePath = getParamPath(req.params.path);
  if (!filePath) {
    res.status(400).json({ error: 'File path required' });
    return;
  }

  try {
    const meta = await getFileMetadata(filePath);
    const cost = calculatePaymentAmount('read', meta.size, meta.tier);
    if (cost > 0) {
      next();
      return;
    }

    const result = await downloadFile(filePath);
    res.setHeader('Content-Type', result.metadata.contentType ?? 'application/octet-stream');
    res.setHeader('X-Storage-Cost', '0.000000');
    res.send(result.data);
  } catch (err: any) {
    if (err.name === 'NoSuchKey' || err.message?.includes('not found')) {
      res.status(404).json({ error: 'File not found' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
}

function getRequestedAccessPolicy(req: RouteRequest, filePath: string): AccessPolicy {
  const tier = getRequestedStorageTier(req);
  if (tier === 'open') {
    return { tier: 'open', allowedWallets: [] };
  }

  const authWallet = req.authWallet?.wallet;
  if (!authWallet) {
    throw new Error('Private storage requires wallet authentication');
  }

  const ownerWalletHeader = getHeader(req.headers, 'x-owner-wallet');
  const allowedWallets = parseWalletList(getHeader(req.headers, 'x-allowed-wallets'));
  const ownerWallet = ownerWalletHeader ?? authWallet;

  if (ownerWallet !== authWallet) {
    throw new Error(`Authenticated wallet ${authWallet} cannot create a private file owned by ${ownerWallet}`);
  }

  return {
    tier: 'private',
    ownerWallet,
    allowedWallets: allowedWallets.filter((wallet) => wallet !== ownerWallet),
  };
}

function getRequestedStorageTier(req: RouteRequest): 'open' | 'private' {
  const raw = (getHeader(req.headers, 'x-storage-tier') ?? 'open').toLowerCase();
  if (raw !== 'open' && raw !== 'private') {
    throw new Error('x-storage-tier must be either open or private');
  }
  return raw;
}

async function verifyRequestWallet(req: RouteRequest, filePath: string) {
  return verifyStorageRequestAuth({
    method: req.method,
    path: filePath,
    wallet: getHeader(req.headers, 'x-auth-wallet'),
    signature: getHeader(req.headers, 'x-auth-signature'),
    timestamp: getHeader(req.headers, 'x-auth-timestamp'),
  });
}

function canAccessPrivateFile(meta: FileMetadata, wallet: `0x${string}`) {
  return meta.ownerWallet === wallet || meta.allowedWallets.includes(wallet);
}

async function filterListForViewer(prefix: string, req: RouteRequest) {
  const result = await listFiles(prefix);
  const auth = await getOptionalAuth(req, prefix || '/v1/list');
  const files = await Promise.all(
    result.files.map(async (file) => {
      try {
        const meta = await getFileMetadata(file.key);
        if (meta.tier === 'open') return meta;
        if (auth && canAccessPrivateFile(meta, auth.wallet)) return meta;
        return undefined;
      } catch {
        return undefined;
      }
    })
  );

  return {
    ...result,
    files: files.filter(Boolean),
  };
}

async function getOptionalAuth(req: RouteRequest, path: string) {
  const hasAuthHeaders = Boolean(getHeader(req.headers, 'x-auth-wallet') || getHeader(req.headers, 'x-auth-signature') || getHeader(req.headers, 'x-auth-timestamp'));
  if (!hasAuthHeaders) return undefined;
  return verifyStorageRequestAuth({
    method: req.method,
    path,
    wallet: getHeader(req.headers, 'x-auth-wallet'),
    signature: getHeader(req.headers, 'x-auth-signature'),
    timestamp: getHeader(req.headers, 'x-auth-timestamp'),
  });
}

function normalizeBodyToBuffer(rawBody: unknown): Buffer {
  if (Buffer.isBuffer(rawBody)) return rawBody;
  if (typeof rawBody === 'string') return Buffer.from(rawBody, 'utf-8');
  if (rawBody && typeof rawBody === 'object') return Buffer.from(JSON.stringify(rawBody), 'utf-8');
  return Buffer.alloc(0);
}

function getParamPath(value: unknown): string | undefined {
  const path = Array.isArray(value) ? value.join('/') : typeof value === 'string' ? value : undefined;
  if (!path || path.length > 1024 || path.includes('\0')) return undefined;
  const parts = path.split('/');
  if (path.startsWith('/') || parts.some((part) => part === '..')) return undefined;
  return path;
}

function getRequestedStorageTierFromAdapter(adapter: { getHeader(name: string): string | undefined }): 'open' | 'private' {
  const raw = (adapter.getHeader('x-storage-tier') ?? 'open').toLowerCase();
  return raw === 'private' ? 'private' : 'open';
}

function getRequestSizeBytes(adapter: { getHeader(name: string): string | undefined }): number {
  const contentLength = adapter.getHeader('content-length');
  const parsed = Number.parseInt(contentLength ?? '0', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function formatUsd(amount: number): `$${string}` {
  return `$${amount.toFixed(6)}`;
}

async function getDownloadCostFromPath(path: string): Promise<number> {
  const { amount } = await getDownloadPricingFromPath(path);
  return amount;
}

async function getDownloadPricingFromPath(path: string) {
  const key = stripFilesPrefix(path);
  const meta = await getFileMetadata(key);
  return {
    key,
    size: meta.size,
    amount: calculatePaymentAmount('read', meta.size, meta.tier),
  };
}

function stripFilesPrefix(path: string): string {
  return path.replace(/^\/v1\/files\//, '');
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getHeader(headers: Record<string, unknown>, name: string): string | undefined {
  const value = headers[name.toLowerCase()];
  return typeof value === 'string' ? value : undefined;
}

export default router;

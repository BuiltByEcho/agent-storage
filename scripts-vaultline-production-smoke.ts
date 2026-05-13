import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { VaultlineClient } from './sdk/src/client.js';

const DEFAULT_URL = 'https://storage.builtbyecho.xyz';

const args = process.argv.slice(2);
const positionalUrl = args.find((arg) => !arg.startsWith('--'));
const getFlagValue = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const baseUrl = (
  getFlagValue('--url') ??
  positionalUrl ??
  process.env.VAULTLINE_URL ??
  process.env.AGENT_STORAGE_URL ??
  DEFAULT_URL
).replace(/\/$/, '');

const privateKey = (
  process.env.VAULTLINE_PAYER_PRIVATE_KEY ??
  process.env.X402_PAYER_PRIVATE_KEY
) as `0x${string}` | undefined;

const includePaidRead = args.includes('--paid-read') || args.includes('--full');
const keepFiles = args.includes('--keep');
const prefix = getFlagValue('--prefix') ?? 'smoke';

if (!privateKey) {
  console.error('Missing payer key. Set VAULTLINE_PAYER_PRIVATE_KEY to a funded Base USDC wallet private key.');
  console.error('Backward-compatible alias still works: X402_PAYER_PRIVATE_KEY.');
  process.exit(1);
}

const account = privateKeyToAccount(privateKey);
const client = new VaultlineClient({ baseUrl, account, timeoutMs: 90_000 });

type StepResult = Record<string, unknown> & { step: string };
const results: StepResult[] = [];

function record(result: StepResult) {
  results.push(result);
  console.log(JSON.stringify(result));
}

async function expectBlocked(label: string, operation: () => Promise<unknown>, status: number) {
  try {
    await operation();
    throw new Error(`${label} unexpectedly succeeded`);
  } catch (error: any) {
    if (error?.status !== status) throw error;
    record({ step: label, ok: true, status: error.status, name: error.name });
  }
}

async function main() {
  const runId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const publicKey = `${prefix}/public/${runId}.txt`;
  const privateKeyPath = `${prefix}/private/${runId}.txt`;
  const publicLargeKey = `${prefix}/public/${runId}-large.txt`;
  const privateLargeKey = `${prefix}/private/${runId}-large.txt`;
  const smallBody = `Vaultline production smoke ${runId}\nwallet=${account.address}\n`;
  const largeBody = `Vaultline paid-read smoke ${runId}\n` + 'x'.repeat(1_050_000);

  record({ step: 'start', baseUrl, wallet: account.address, includePaidRead, keepFiles });

  const healthResponse = await fetch(`${baseUrl}/v1/health`);
  const healthBody = await healthResponse.json().catch(() => undefined);
  record({ step: 'health', status: healthResponse.status, body: healthBody });
  if (!healthResponse.ok) throw new Error('Health check failed');

  const publicUpload = await client.upload(publicKey, smallBody, { contentType: 'text/plain' });
  record({ step: 'public-upload', status: publicUpload.response.status, key: publicKey, cost: publicUpload.data.cost, tier: publicUpload.data.file.tier });

  const publicRead = await client.downloadText(publicKey);
  record({ step: 'public-read', status: publicRead.response.status, matches: publicRead.text === smallBody, bytes: publicRead.text.length, cost: publicRead.response.headers.get('x-storage-cost') });
  if (publicRead.text !== smallBody) throw new Error('Public read content mismatch');

  const privateUpload = await client.upload(privateKeyPath, smallBody, { tier: 'private', contentType: 'text/plain' });
  record({ step: 'private-upload', status: privateUpload.response.status, key: privateKeyPath, cost: privateUpload.data.cost, tier: privateUpload.data.file.tier, ownerWallet: privateUpload.data.file.ownerWallet });

  const missingAuth = await fetch(`${baseUrl}/v1/files/${privateKeyPath}`);
  record({ step: 'private-read-missing-auth', ok: missingAuth.status === 401, status: missingAuth.status, body: (await missingAuth.text()).slice(0, 160) });
  if (missingAuth.status !== 401) throw new Error(`Expected missing-auth private read to return 401, got ${missingAuth.status}`);

  const privateRead = await client.downloadText(privateKeyPath, { tier: 'private' });
  record({ step: 'private-owner-read', status: privateRead.response.status, matches: privateRead.text === smallBody, bytes: privateRead.text.length, cost: privateRead.response.headers.get('x-storage-cost') });
  if (privateRead.text !== smallBody) throw new Error('Private owner read content mismatch');

  const share = await client.createShare(privateKeyPath, { tier: 'private', expiresInSeconds: 300 });
  record({ step: 'private-share-created', status: share.response.status, key: share.data.key, expiresAt: share.data.expiresAt });
  const sharedRead = await fetch(share.data.url);
  const sharedText = await sharedRead.text();
  record({ step: 'private-share-read', status: sharedRead.status, matches: sharedText === smallBody, bytes: sharedText.length, tier: sharedRead.headers.get('x-storage-tier') });
  if (sharedText !== smallBody) throw new Error('Private share read content mismatch');

  const unauthorized = privateKeyToAccount(generatePrivateKey());
  const unauthorizedClient = new VaultlineClient({ baseUrl, account: unauthorized, timeoutMs: 30_000 });
  await expectBlocked('private-read-unauthorized-wallet', () => unauthorizedClient.downloadText(privateKeyPath, { tier: 'private' }), 403);

  if (includePaidRead) {
    const publicLargeUpload = await client.upload(publicLargeKey, largeBody, { contentType: 'text/plain' });
    record({ step: 'public-large-upload', status: publicLargeUpload.response.status, key: publicLargeKey, cost: publicLargeUpload.data.cost, bytes: largeBody.length });

    const publicLargeRead = await client.downloadText(publicLargeKey);
    record({ step: 'public-large-paid-read', status: publicLargeRead.response.status, matches: publicLargeRead.text === largeBody, bytes: publicLargeRead.text.length, cost: publicLargeRead.response.headers.get('x-storage-cost') });
    if (publicLargeRead.text !== largeBody) throw new Error('Public large paid read content mismatch');

    const privateLargeUpload = await client.upload(privateLargeKey, largeBody, { tier: 'private', contentType: 'text/plain' });
    record({ step: 'private-large-upload', status: privateLargeUpload.response.status, key: privateLargeKey, cost: privateLargeUpload.data.cost, bytes: largeBody.length });

    const privateLargeRead = await client.downloadText(privateLargeKey, { tier: 'private' });
    record({ step: 'private-large-paid-read', status: privateLargeRead.response.status, matches: privateLargeRead.text === largeBody, bytes: privateLargeRead.text.length, cost: privateLargeRead.response.headers.get('x-storage-cost') });
    if (privateLargeRead.text !== largeBody) throw new Error('Private large paid read content mismatch');
  }

  const list = await client.list(`${prefix}/`, { includePrivate: true });
  const expectedKeys = [publicKey, privateKeyPath, ...(includePaidRead ? [publicLargeKey, privateLargeKey] : [])].sort();
  const foundKeys = list.data.files.map((file) => file.key).filter((key) => expectedKeys.includes(key)).sort();
  record({ step: 'authenticated-list', status: list.response.status, foundKeys });
  if (foundKeys.length !== expectedKeys.length) throw new Error(`List did not include all expected keys: ${foundKeys.join(', ')}`);

  if (!keepFiles) {
    for (const key of expectedKeys) {
      const tier = key.includes('/private/') ? 'private' : 'open';
      const deleted = await client.delete(key, { tier });
      record({ step: 'cleanup-delete', status: deleted.response.status, key, tier });
    }
  }

  record({ step: 'passed', baseUrl, wallet: account.address, runId, testedKeys: expectedKeys, paymentsExpected: includePaidRead ? 5 : 2 });
}

main().catch((error) => {
  console.error(JSON.stringify({ step: 'failed', name: error?.name, status: error?.status, message: error?.message }));
  process.exit(1);
});

import 'dotenv/config';
import { x402Client } from '@x402/core/client';
import { x402HTTPClient } from '@x402/core/http';
import { ExactEvmScheme, toClientEvmSigner } from '@x402/evm';
import { privateKeyToAccount } from 'viem/accounts';

const baseUrl = (process.argv[2] ?? process.env.AGENT_STORAGE_URL ?? 'http://localhost:3001').replace(/\/$/, '');
const privateKey = (process.env.X402_PAYER_PRIVATE_KEY || process.env.X402_TEST_PAYER_PRIVATE_KEY) as
  | `0x${string}`
  | undefined;

if (!privateKey) {
  console.error('Missing X402_PAYER_PRIVATE_KEY or X402_TEST_PAYER_PRIVATE_KEY');
  process.exit(1);
}

const account = privateKeyToAccount(privateKey);
const client = new x402Client().register('eip155:*', new ExactEvmScheme(toClientEvmSigner(account)));
const httpClient = new x402HTTPClient(client);

async function main() {
  const fileKey = `smoke/${Date.now()}-demo.txt`;
  const fileUrl = `${baseUrl}/v1/files/${fileKey}`;
  const body = Buffer.from(`vaultline smoke test ${new Date().toISOString()}\n`);

  console.log(`payer: ${account.address}`);
  console.log(`baseUrl: ${baseUrl}`);
  console.log(`file: ${fileKey}`);

  const health = await fetch(`${baseUrl}/v1/health`);
  console.log('health status:', health.status);
  if (!health.ok) {
    console.error(await health.text());
    process.exit(1);
  }

  const upload = await paidFetch(fileUrl, {
    method: 'PUT',
    body,
    headers: {
      'content-type': 'text/plain',
      'content-length': String(body.length),
    },
  });
  console.log('upload status:', upload.status);
  console.log(await upload.text());
  if (!upload.ok) process.exit(1);

  const freeRead = await fetch(fileUrl);
  console.log('free read status:', freeRead.status);
  console.log('free read cost:', freeRead.headers.get('x-storage-cost'));
  const freeText = await freeRead.text();
  console.log(freeText);
  if (!freeRead.ok || freeText !== body.toString('utf8')) process.exit(1);

  const head = await fetch(fileUrl, { method: 'HEAD' });
  console.log('head status:', head.status);
  console.log('head read cost:', head.headers.get('x-storage-cost-if-read'));
  if (!head.ok) process.exit(1);

  console.log('\n✅ smoke test passed');
}

async function paidFetch(url: string, init: RequestInit) {
  const initial = await fetch(url, init);
  if (initial.status !== 402) {
    throw new Error(`Expected 402, got ${initial.status}: ${await initial.text()}`);
  }

  const bodyText = await initial.text();
  const body = bodyText ? JSON.parse(bodyText) : {};
  const paymentRequired = httpClient.getPaymentRequiredResponse((name) => initial.headers.get(name), body);
  const paymentPayload = await client.createPaymentPayload(paymentRequired);

  return fetch(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...httpClient.encodePaymentSignatureHeader(paymentPayload),
    },
  });
}

main().catch((err) => {
  console.error('smoke test failed:', err);
  process.exit(1);
});

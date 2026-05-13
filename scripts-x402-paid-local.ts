import 'dotenv/config';
import { x402Client } from '@x402/core/client';
import { x402HTTPClient } from '@x402/core/http';
import { ExactEvmScheme, toClientEvmSigner } from '@x402/evm';
import { privateKeyToAccount } from 'viem/accounts';

const url = process.argv[2] ?? 'http://localhost:3001/v1/test/paid-ping';
const privateKey = (process.env.VAULTLINE_PAYER_PRIVATE_KEY || process.env.X402_PAYER_PRIVATE_KEY || process.env.X402_TEST_PAYER_PRIVATE_KEY) as
  | `0x${string}`
  | undefined;

if (!privateKey) {
  console.error('Missing VAULTLINE_PAYER_PRIVATE_KEY, X402_PAYER_PRIVATE_KEY, or X402_TEST_PAYER_PRIVATE_KEY');
  process.exit(1);
}

const account = privateKeyToAccount(privateKey);
const client = new x402Client().register('eip155:*', new ExactEvmScheme(toClientEvmSigner(account)));
const httpClient = new x402HTTPClient(client);

async function main() {
  console.log(`payer: ${account.address}`);
  console.log(`url: ${url}`);

  const initial = await fetch(url);
  console.log('initial status:', initial.status);
  const initialBody = await initial.json();

  if (initial.status !== 402) {
    console.log(JSON.stringify(initialBody, null, 2));
    return;
  }

  const paymentRequired = httpClient.getPaymentRequiredResponse(
    (name) => initial.headers.get(name),
    initialBody
  );
  const paymentPayload = await client.createPaymentPayload(paymentRequired);

  const paid = await fetch(url, {
    headers: httpClient.encodePaymentSignatureHeader(paymentPayload),
  });

  console.log('paid status:', paid.status);
  console.log('payment-response:', paid.headers.get('payment-response'));
  console.log(await paid.text());
}

main().catch((err) => {
  console.error('paid test failed:', err);
  process.exit(1);
});

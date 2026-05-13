import 'dotenv/config';

const baseUrl = process.env.AGENT_STORAGE_URL ?? 'http://localhost:3001';
const path = process.argv[2] ?? 'workspace/demo.txt';

async function main() {
  console.log(`Checking x402 flow for ${baseUrl}/v1/files/${path}`);
  const response = await fetch(`${baseUrl}/v1/files/${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'text/plain' },
    body: 'hello from x402 test',
  });

  console.log('status:', response.status);
  if (response.status !== 402) {
    console.error('Expected 402 Payment Required');
    console.error(await response.text());
    process.exit(1);
  }

  const paymentRequiredHeader = response.headers.get('payment-required');
  const bodyText = await response.text();
  const body = bodyText ? JSON.parse(bodyText) : {};

  if (!paymentRequiredHeader) {
    console.error('Missing payment-required header');
    process.exit(1);
  }

  const paymentRequired = JSON.parse(Buffer.from(paymentRequiredHeader, 'base64url').toString('utf8'));
  const firstAccept = paymentRequired?.accepts?.[0];

  if (!firstAccept?.payTo || !firstAccept?.amount || !firstAccept?.network) {
    console.error('x402 v2 payment-required payload incomplete');
    process.exit(1);
  }

  console.log('\n✅ x402 v2 discovery response looks valid');
  console.log(`Pay ${firstAccept.amount} base units on ${firstAccept.network} to ${firstAccept.payTo}`);
  if (body?.amount) {
    console.log(`Quoted price: $${body.amount}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

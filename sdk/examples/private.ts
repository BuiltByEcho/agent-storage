import { privateKeyToAccount } from 'viem/accounts';
import { VaultlineClient } from '../dist/index.js';

const privateKey = process.env.X402_PAYER_PRIVATE_KEY as `0x${string}` | undefined;
if (!privateKey) throw new Error('Missing X402_PAYER_PRIVATE_KEY');

const client = new VaultlineClient({
  baseUrl: process.env.AGENT_STORAGE_URL ?? 'http://localhost:3001',
  account: privateKeyToAccount(privateKey),
});

const main = async () => {
  const upload = await client.upload('sdk/private.txt', 'private sdk example\n', {
    tier: 'private',
    contentType: 'text/plain',
  });
  console.log('uploaded private file:', upload.data);

  const read = await client.downloadText('sdk/private.txt', { tier: 'private' });
  console.log('read private file:', read.text);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

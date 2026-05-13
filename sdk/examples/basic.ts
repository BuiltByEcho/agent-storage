import { privateKeyToAccount } from 'viem/accounts';
import { AgentStorageClient } from '../dist/index.js';

const privateKey = process.env.X402_PAYER_PRIVATE_KEY as `0x${string}` | undefined;
if (!privateKey) throw new Error('Missing X402_PAYER_PRIVATE_KEY');

const client = new AgentStorageClient({
  baseUrl: process.env.AGENT_STORAGE_URL ?? 'http://localhost:3001',
  account: privateKeyToAccount(privateKey),
});

const main = async () => {
  const upload = await client.upload('sdk/basic.txt', 'hello from sdk example\n', {
    contentType: 'text/plain',
  });
  console.log('uploaded:', upload.data);

  const read = await client.downloadText('sdk/basic.txt');
  console.log('read:', read.text);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

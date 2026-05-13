# Vaultline Quickstart

This is the shortest path to one successful paid upload and read-back against production.

## What you need

- Node.js 20+
- A fresh EVM wallet private key
- A tiny amount of **Base USDC** in that wallet
- No API key, account signup, or dashboard token

A first small upload costs the current minimum write charge: `$0.001` USDC. Small reads under the free-read threshold are free.

> Keep the wallet low-balance. Treat the private key like a normal hot wallet key.

## 1. Create a clean test folder

```bash
mkdir vaultline-first-upload
cd vaultline-first-upload
npm init -y
npm install @builtbyecho/vaultline-sdk viem
```

## 2. Add your funded payer key

```bash
export VAULTLINE_PAYER_PRIVATE_KEY=0xYOUR_FUNDED_BASE_WALLET_PRIVATE_KEY
export VAULTLINE_URL=https://storage.builtbyecho.xyz
```

Backward-compatible URL alias `AGENT_STORAGE_URL` and payer-key alias `X402_PAYER_PRIVATE_KEY` still work, but new docs should use the `VAULTLINE_*` names. Production smoke intentionally ignores `X402_TEST_PAYER_PRIVATE_KEY` so stale local test keys do not accidentally spend or fail.

## 3. Create `first-upload.mjs`

```js
import { privateKeyToAccount } from 'viem/accounts';
import { VaultlineClient } from '@builtbyecho/vaultline-sdk';

const privateKey = process.env.VAULTLINE_PAYER_PRIVATE_KEY;
if (!privateKey) throw new Error('Set VAULTLINE_PAYER_PRIVATE_KEY first');

const account = privateKeyToAccount(privateKey);
const client = new VaultlineClient({
  baseUrl: process.env.VAULTLINE_URL ?? 'https://storage.builtbyecho.xyz',
  account,
});

const key = `quickstart/${Date.now()}-${account.address.slice(2, 8)}.txt`;
const body = `hello from Vaultline\nwallet=${account.address}\n`;

const upload = await client.upload(key, body, {
  contentType: 'text/plain',
});
console.log('uploaded:', upload.data.file.key, 'cost:', upload.data.cost, 'tier:', upload.data.file.tier);

const read = await client.downloadText(key);
console.log('read status:', read.response.status);
console.log('read cost:', read.response.headers.get('x-storage-cost'));
console.log(read.text);

if (read.text !== body) throw new Error('read-back mismatch');
console.log('✅ first Vaultline upload passed');
```

## 4. Run it

```bash
node first-upload.mjs
```

Expected shape:

```text
uploaded: quickstart/1778689000000-c225c4.txt cost: 0.001000 tier: open
read status: 200
read cost: 0.000000
hello from Vaultline
wallet=0x...

✅ first Vaultline upload passed
```

## Private storage check

Private files require wallet-auth headers. The SDK adds them when you set `tier: 'private'`:

```js
await client.upload(key, body, { tier: 'private', contentType: 'text/plain' });
const privateRead = await client.downloadText(key, { tier: 'private' });
```

Unauthenticated reads should return `401`; wrong-wallet reads should return `403`.

## Full production smoke

From the Vaultline repo, with a funded payer key:

```bash
VAULTLINE_PAYER_PRIVATE_KEY=0x... npm run check:prod
```

That tests:

- health endpoint
- public paid upload
- public small read-back
- private paid upload
- private owner read-back
- missing-auth private read blocked (`401`)
- wrong-wallet private read blocked (`403`)
- authenticated list includes the test objects
- cleanup deletes test objects

For paid large-read coverage too:

```bash
VAULTLINE_PAYER_PRIVATE_KEY=0x... npm run check:prod:full
```

The full smoke adds large public/private paid reads. At current minimums, expect about 5 × `$0.001` USDC in payments.

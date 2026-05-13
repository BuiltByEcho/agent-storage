# @builtbyecho/agent-storage-sdk

TypeScript SDK for AgentStorage.

This SDK removes the two biggest friction points for developers:
- x402 pay-and-retry handling
- wallet-auth header creation for private storage

## Current status

Live tiers supported by the SDK:
- `open`
- `private`

Planned later:
- `encrypted` *(coming soon)*

## Install

```bash
npm install @builtbyecho/agent-storage-sdk viem
```

## Quick start

```ts
import { privateKeyToAccount } from 'viem/accounts';
import { AgentStorageClient } from '@builtbyecho/agent-storage-sdk';

const account = privateKeyToAccount(process.env.X402_PAYER_PRIVATE_KEY as `0x${string}`);

const client = new AgentStorageClient({
  baseUrl: 'https://agent-storage.example.com',
  account,
});
```

## Open upload

```ts
const result = await client.upload('workspace/demo.txt', 'hello from sdk', {
  contentType: 'text/plain',
});

console.log(result.data);
```

## Private upload

```ts
const result = await client.upload('workspace/secret.txt', 'private notes', {
  tier: 'private',
  contentType: 'text/plain',
  allowedWallets: ['0x1234567890123456789012345678901234567890'],
});
```

## Private read

```ts
const result = await client.downloadText('workspace/secret.txt', {
  tier: 'private',
});

console.log(result.text);
```

## What the SDK handles automatically

- `402 Payment Required` parsing
- x402 payment payload creation
- retry with payment headers
- private-tier wallet auth headers

## Notes

- use `open` for shared/public-by-key files
- use `private` for wallet-restricted files
- do not treat `encrypted` as a live tier yet

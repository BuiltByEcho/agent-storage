# @builtbyecho/vaultline-sdk

TypeScript SDK for **Vaultline** — x402-native storage rails for autonomous agents.

Live API: `https://storage.builtbyecho.xyz`

This SDK removes the biggest friction points for developers:
- x402 pay-and-retry handling
- wallet-auth header creation for private storage
- typed failures you can safely catch in agents and CLIs
- default request timeouts so long-running agent workflows do not hang forever

## Current status

Live tiers supported by the SDK:
- `open`
- `private`

Planned later:
- `encrypted` *(coming soon)*

## Install

```bash
npm install @builtbyecho/vaultline-sdk viem
```

## Quick start

```ts
import { privateKeyToAccount } from 'viem/accounts';
import { VaultlineClient } from '@builtbyecho/vaultline-sdk';

const account = privateKeyToAccount(process.env.VAULTLINE_PAYER_PRIVATE_KEY as `0x${string}`);

const client = new VaultlineClient({
  baseUrl: 'https://storage.builtbyecho.xyz',
  account,
  timeoutMs: 30_000,
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


## Share links

Create signed, expiring share links when another agent or human needs retrieval access without holding the owner wallet. Private files require owner/allowlisted wallet auth when creating the share.

```ts
const share = await client.createShare('workspace/secret.txt', {
  tier: 'private',
  expiresInSeconds: 300,
});

console.log(share.data.url);

const shared = await client.downloadShareText(share.data.url);
console.log(shared.text);
```

## Typed errors

SDK helper methods throw `VaultlineError` for non-2xx responses after any x402 retry is complete. The parsed JSON/text response body is attached for logging, retries, and agent decision-making.

```ts
import { VaultlineClient, VaultlineError } from '@builtbyecho/vaultline-sdk';

try {
  await client.downloadText('workspace/missing.txt');
} catch (error) {
  if (error instanceof VaultlineError && error.status === 404) {
    console.log('not found', error.body);
  } else {
    throw error;
  }
}
```

## Timeouts

Requests default to a 30 second timeout using `AbortSignal.timeout`. Override per client, or pass `0` to disable.

```ts
const client = new VaultlineClient({
  baseUrl: 'https://storage.builtbyecho.xyz',
  account,
  timeoutMs: 10_000,
});
```

## What the SDK handles automatically

- `402 Payment Required` parsing
- x402 payment payload creation
- retry with payment headers
- private-tier wallet auth headers
- typed error creation with parsed response bodies
- default request timeouts

## Pricing notes

- reads under `1 MB` are free
- paid reads above the free threshold have a `$0.001` minimum to avoid dust-sized x402 payments
- write and storage pricing are exposed by the live API metadata/routes

## Notes

- use `open` for shared/public-by-key files
- use `private` for wallet-restricted files
- do not treat `encrypted` as a live tier yet

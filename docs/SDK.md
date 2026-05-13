# Vaultline SDK

The developer SDK for Vaultline is a TypeScript package in this repo:

- package path: `sdk/`
- package name: `@builtbyecho/vaultline-sdk`
- package README: `sdk/README.md`

Its job is to remove the two annoying parts of direct integration:
- x402 pay-and-retry handling
- private-tier wallet-auth header creation

## What it provides

- `VaultlineClient`
- `buildStorageAuthMessage()`
- `createStorageAuthHeaders()`

## Current capabilities

- upload open files
- upload private files
- download files
- download text
- head metadata
- delete files
- list files
- include private files in list calls when authenticated
- automatically retry paid requests after `402`

## Current status

This is the first SDK pass.

It is optimized for:
- TypeScript developers
- Node / modern runtimes with `fetch`
- wallet-based private storage

Package polish now includes:
- explicit package exports
- `prepublishOnly` verification
- package-level README
- example scripts under `sdk/examples/`
- publishing checklist in `docs/SDK_PUBLISHING.md`
- release notes in `docs/SDK_RELEASE_v0.1.0.md`

## Install shape

When published, developers will use:

```bash
npm install @builtbyecho/vaultline-sdk viem
```

The package is live on npm and lives in this repo under `sdk/`.

## Quick start

```ts
import { privateKeyToAccount } from 'viem/accounts';
import { VaultlineClient } from '@builtbyecho/vaultline-sdk';

const account = privateKeyToAccount(process.env.VAULTLINE_PAYER_PRIVATE_KEY as `0x${string}`);

const client = new VaultlineClient({
  baseUrl: 'https://storage.builtbyecho.xyz',
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

## Notes

- `open` and `private` are the live tiers.
- `encrypted` is not a live SDK tier yet.
- private-tier operations automatically attach wallet-auth headers.
- paid operations automatically follow the x402 pay-and-retry flow.
- for publish steps, see `docs/SDK_PUBLISHING.md`.

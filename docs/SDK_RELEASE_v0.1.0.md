# AgentStorage SDK Release Notes — v0.1.0

## Package

- name: `@builtbyecho/agent-storage-sdk`
- version: `0.1.0`

## Summary

First public TypeScript SDK release for AgentStorage.

This release gives developers a clean client for:
- x402 pay-and-retry flows
- open storage operations
- private wallet-auth storage operations

## What’s included

- `AgentStorageClient`
- `buildStorageAuthMessage()`
- `createStorageAuthHeaders()`

## Supported operations

- upload
- download
- download text
- head metadata
- delete
- list

## Live storage tiers

- `open`
- `private`

## Not in this release

- `encrypted` storage support
- browser wallet integration helpers
- richer custom error classes

## Developer value

Developers no longer need to hand-roll:
- `402` parsing
- x402 payload generation/retry
- private wallet-auth header creation

## Runtime target

- Node `>=20`
- modern `fetch`-capable runtimes

## Publish note

Publish as:

```bash
cd projects/agent-storage/sdk
npm publish --access public
```

# Vaultline Architecture

## High-level flow

```text
HTTP client
  -> Express route
  -> x402 middleware
  -> x402 resource server
  -> CDP facilitator (supported / verify / settle)
  -> storage handler
  -> Cloudflare R2
```

## Main components

### `src/app.ts`

Creates the Express app, common middleware, the paid ping route, and attaches the file routes.

### `src/routes/files.ts`

Defines the storage API routes.

Important behavior:
- `PUT /v1/files/*` is x402-gated
- `GET /v1/files/*` uses a free bypass for small files and x402 for larger reads
- `HEAD`, `DELETE`, `LIST`, `USAGE`, `HEALTH` are free routes

### `src/cdpFacilitator.ts`

Encapsulates facilitator concerns:
- chooses authenticated CDP flow when using the CDP facilitator URL
- generates short-lived JWT auth headers for `/supported`, `/verify`, and `/settle`
- creates and initializes the shared x402 resource server
- verifies that the configured facilitator actually supports the requested mainnet network

### `src/services/storage.ts`

Wraps Cloudflare R2 through the AWS S3-compatible SDK.

Responsibilities:
- upload
- download
- delete
- metadata lookup
- listing
- optional presigned URL generation

### `src/pricing.ts`

Holds pricing logic for:
- writes
- reads
- storage estimate
- free-read threshold
- minimum write/storage charges

## Payment architecture

Vaultline currently uses:
- x402 v2
- exact scheme
- Base mainnet `eip155:8453`
- USDC on Base
- authenticated CDP facilitator

This matters because public `x402.org/facilitator` is not enough for Base mainnet production use.

## Why the shared resource server matters

The shared x402 resource server is initialized once at startup so route handling does not race facilitator capability discovery.

Without that, a route can fail early with messages like:
- facilitator does not support exact on `eip155:8453`

That is not necessarily a real network limitation — it can also mean support was not initialized yet.

## Pricing behavior

Current rules:
- writes: paid, with minimum charge
- reads under `FREE_READ_MAX_BYTES`: free
- larger reads: paid by size
- storage estimate: computed for metadata/usage reporting
- delete/list/head: free

## Known design edge case

Very tiny paid reads can produce extremely small amounts. Large paid downloads work correctly, but tiny paid reads may deserve one of these policy decisions later:
- minimum read charge
- keep a generous free threshold
- batch retrieval pricing

## Test strategy

There are two layers now:

### 1) Repository integration tests

`test/x402.integration.test.ts`

These tests use:
- mocked in-memory storage
- mocked facilitator/resource server behavior
- real x402 client payload generation

That gives repeatable CI-friendly coverage for:
- paid upload
- free small download
- paid large download

### 2) Live smoke scripts

Scripts in the repo can hit a real running service for:
- 402 discovery
- facilitator support/auth
- paid ping
- deploy smoke test

# AgentStorage

**Dropbox for Agents**

Persistent file storage for autonomous agents, priced one request at a time.

AgentStorage lets agents buy uploads and downloads directly over HTTP using x402 v2 on Base mainnet. Instead of forcing every client through buyer accounts, API keys, and dashboard billing, it treats payment as the access primitive.

```text
request -> 402 -> sign -> retry -> done
```

## Why it exists

Most storage products assume a human operator:
- create an account
- issue API keys
- attach a billing method
- then let software use the service

That model is fine for traditional SaaS. It is awkward for autonomous systems.

Agents want:
- direct HTTP access
- per-request pricing
- machine-readable payment requirements
- no signup flow in the critical path
- cryptographic settlement

AgentStorage is built around that shape.

## What it does

- paid uploads
- free small downloads under a configurable threshold
- paid large downloads
- free metadata, listing, and delete operations
- Cloudflare R2-backed object storage
- CDP-facilitated verification and settlement on Base mainnet

## Why it’s interesting

AgentStorage is not just “S3 with crypto.”

The point is that storage becomes a machine-buyable capability.
An agent can discover a price, authorize payment, retry the same request, and continue its workflow without a human in the loop.

That opens up patterns like:
- shared workspaces for autonomous systems
- paid retrieval APIs
- artifact handoff between agents
- metered file access without customer API key provisioning

## Current state

Verified locally:
- x402 v2 flow on Base mainnet
- paid ping route
- paid uploads
- free small reads
- paid large reads
- R2 storage operations
- integration tests
- deploy smoke scripts

## Quick start

```bash
npm install
npm run lint
npm test
npm run dev
```

## Verification

```bash
npm run check:x402
npm run check:x402:facilitator
npm run check:x402:paid
npm run check:x402:smoke
```

## Core routes

- `PUT /v1/files/{path}` — paid upload
- `GET /v1/files/{path}` — free for small files, paid for larger reads
- `DELETE /v1/files/{path}` — free delete
- `HEAD /v1/files/{path}` — free metadata
- `GET /v1/list/{prefix}` — free listing
- `GET /v1/usage` — free usage summary
- `GET /v1/health` — health check

## Stack

- Node.js + TypeScript
- Express
- `@x402/core`
- `@x402/express`
- `@x402/evm`
- Coinbase CDP facilitator
- Cloudflare R2

## Docs

- `README.md`
- `docs/OVERVIEW.md`
- `docs/API.md`
- `docs/ARCHITECTURE.md`
- `docs/OPERATIONS.md`
- `docs/INTEGRATION_EXAMPLES.md`
- `docs/LANDING_PAGE_COPY.md`
- `docs/LANDING_PAGE_STRUCTURE.md`

## Short thesis

AgentStorage turns file storage into a paid HTTP primitive for agents.

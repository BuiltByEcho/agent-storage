# Vaultline

**Dropbox for Agents — live at `https://storage.builtbyecho.xyz`**

Persistent file storage for autonomous agents, priced one request at a time.

Vaultline lets agents buy uploads and downloads directly over HTTP using x402 v2 on Base mainnet. Instead of forcing every client through buyer accounts, API keys, and dashboard billing, it treats payment as the access primitive.

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

Vaultline is built around that shape.

## What it does

- paid uploads
- open storage for shared/public-by-key objects
- wallet-based private storage for owner-only or allowlisted reads
- signed, expiring share links for handing files to another agent or human
- append-only usage metering for API calls, unique callers, paid calls, revenue, and storage deltas
- encrypted storage planned as a higher-privacy tier *(coming soon)*
- free small downloads under a configurable threshold
- paid large downloads
- free metadata, listing, and delete operations
- Cloudflare R2-backed object storage
- CDP-facilitated verification and settlement on Base mainnet

## Why it’s interesting

Vaultline is not just “S3 with crypto.”

The point is that storage becomes a machine-buyable capability.
An agent can discover a price, authorize payment, retry the same request, and continue its workflow without a human in the loop.

That opens up patterns like:
- shared workspaces for autonomous systems
- paid retrieval APIs
- artifact handoff between agents
- metered file access without customer API key provisioning

## Current state

Verified in production:
- primary Bankr x402 endpoints:
  - `vaultline-upload`: `https://x402.bankr.bot/0x13843882c89444bd2ba55ea9ade90c5b26b92d90/vaultline-upload`
  - `vaultline-download`: `https://x402.bankr.bot/0x13843882c89444bd2ba55ea9ade90c5b26b92d90/vaultline-download`
  - `vaultline-list`: `https://x402.bankr.bot/0x13843882c89444bd2ba55ea9ade90c5b26b92d90/vaultline-list`
- direct/fallback API at `https://storage.builtbyecho.xyz`
- x402 v2 flow on Base mainnet
- paid ping route
- paid uploads
- free small reads
- paid large reads
- R2 storage operations
- integration tests
- deploy smoke scripts
- paid upload, free read, private wallet-gated read, and paid large read against the live endpoint

## Pricing

Primary Bankr endpoints use a fixed public minimum of `$0.002 USDC/request` for upload, download, and list. Upload/download payloads are currently capped at 5 MB on the Bankr endpoint surface.

The direct Vaultline API remains available as a lower-level fallback with dynamic size/tier pricing:

Current default pricing:

**Open**
- storage: `$0.08 / GB / month`
- retrieval: `$0.015 / GB` after free threshold, minimum paid read `$0.001`
- write: `$0.03 / GB`

**Private**
- storage: `$0.12 / GB / month`
- retrieval: `$0.02 / GB` after free threshold, minimum paid read `$0.001`
- write: `$0.045 / GB`

**Encrypted**
- coming soon
- planned as the highest-privacy tier

**Common**
- list / head / delete: free
- reads under `1 MB`: free

## First successful upload

If you just want to prove it works, follow `docs/QUICKSTART.md`. It walks through a funded Base USDC wallet, one paid upload, and a read-back with expected output.

```bash
npm install @builtbyecho/vaultline-sdk viem
export VAULTLINE_PAYER_PRIVATE_KEY=0xYOUR_FUNDED_BASE_WALLET_PRIVATE_KEY
export VAULTLINE_URL=https://storage.builtbyecho.xyz
```

Then run the copy-paste `first-upload.mjs` from `docs/QUICKSTART.md`.

## SDK quick start

```bash
npm install @builtbyecho/vaultline-sdk viem
```

```ts
import { privateKeyToAccount } from 'viem/accounts';
import { VaultlineClient } from '@builtbyecho/vaultline-sdk';

const account = privateKeyToAccount(process.env.VAULTLINE_PAYER_PRIVATE_KEY as `0x${string}`);

const client = new VaultlineClient({
  baseUrl: 'https://storage.builtbyecho.xyz',
  account,
});

await client.upload('workspace/demo.txt', 'hello from Vaultline', {
  contentType: 'text/plain',
});

const result = await client.downloadText('workspace/demo.txt');
console.log(result.text);
```

## Local server quick start

```bash
cd projects/vaultline
npm install
npm run lint
npm test
npm run dev
```

## Mainnet configuration

Required env vars:

```env
PORT=3001
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=vaultline

X402_NETWORK=base
X402_USDC_CONTRACT=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
X402_TREASURY_WALLET=
X402_FACILITATOR_URL=https://api.cdp.coinbase.com/platform/v2/x402
CDP_API_KEY_ID=
CDP_API_KEY_SECRET=

PRICE_STORAGE_PER_GB_MONTH=0.08
PRICE_RETRIEVAL_PER_GB=0.015
PRICE_WRITE_PER_GB=0.03
FREE_READ_MAX_BYTES=1048576

# Optional. Mount this path as persistent storage in production.
VAULTLINE_USAGE_LEDGER_PATH=state/vaultline-usage-events.jsonl

# Recommended for production metering.
NEON_DATABASE_URL=postgresql://...

# Required only for Bankr x402 Cloud proxying into the backend.
BANKR_PROXY_TOKEN=...
```

## Verification

```bash
npm run check:x402
npm run check:x402:facilitator
npm run check:x402:paid
npm run check:x402:smoke
npm run check:prod
npm run check:prod:full
```

## Core routes

Primary Bankr routes:

- `POST https://x402.bankr.bot/0x13843882c89444bd2ba55ea9ade90c5b26b92d90/vaultline-upload` — paid upload, JSON body `{ path, content, encoding, contentType }`
- `POST https://x402.bankr.bot/0x13843882c89444bd2ba55ea9ade90c5b26b92d90/vaultline-download` — paid download, JSON body `{ path, asText, maxBytes }`
- `POST https://x402.bankr.bot/0x13843882c89444bd2ba55ea9ade90c5b26b92d90/vaultline-list` — paid listing, JSON body `{ prefix }`

Direct/fallback API routes:

- `PUT /v1/files/{path}` — paid upload
- `GET /v1/files/{path}` — free for small files, paid for larger reads
- `POST /v1/shares` — create an expiring share link for an existing file
- `GET /v1/shares/{token}` — retrieve a file through a signed expiring share link
- `DELETE /v1/files/{path}` — free delete
- `HEAD /v1/files/{path}` — free metadata
- `GET /v1/list/{prefix}` — free listing
- `GET /v1/usage` — storage, usage, revenue, user, and endpoint summary
- `GET /v1/health` — health check
- `GET /v1/test/paid-ping` — minimal paid route for verification

## Docs

- `docs/QUICKSTART.md` — first successful upload + production smoke walkthrough
- `docs/OVERVIEW.md` — product framing and positioning
- `docs/API.md` — route behavior and payment flow
- `docs/SDK.md` — developer SDK overview and usage
- `docs/SDK_PUBLISHING.md` — SDK publish checklist
- `docs/SDK_RELEASE_v0.1.1.md` — SDK hardening release notes
- `docs/SDK_RELEASE_v0.1.0.md` — SDK release notes for first publish
- `docs/STORAGE_TIERS.md` — open vs private vs encrypted-tier guide
- `docs/ARCHITECTURE.md` — internals and system design
- `docs/OPERATIONS.md` — env, deploy, smoke tests, operational notes
- `docs/INTEGRATION_EXAMPLES.md` — TypeScript and Python client payment/retry examples
- `docs/LANDING_PAGE_COPY.md` — marketing/front-page copy options
- `docs/GITHUB_HOMEPAGE_VARIANT.md` — alternate polished repo-front-page copy
- `docs/LANDING_PAGE_STRUCTURE.md` — future site section structure/spec
- `DEPLOY.md` — Railway-first deployment checklist
- `NOTES.md` — concise project state and follow-up notes

## Important notes

- Base mainnet requires the authenticated CDP facilitator; public `x402.org/facilitator` is not enough.
- R2 TLS works normally in this project on Node 24.15.0; the old global TLS bypass was removed.
- `/v1/usage` uses Neon/Postgres when `NEON_DATABASE_URL`, `DATABASE_URL`, or `POSTGRES_URL` is set. Without Postgres, it falls back to the append-only JSONL ledger at `VAULTLINE_USAGE_LEDGER_PATH`.
- If secrets were exposed in chat, rotate them before public launch.

## Short thesis

Vaultline turns file storage into a paid HTTP primitive for agents.

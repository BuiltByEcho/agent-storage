# Vaultline Operations

## Environment

Required production env vars:

```env
PORT=3001
NODE_ENV=production

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
PRICE_PRIVATE_STORAGE_PER_GB_MONTH=0.12
PRICE_PRIVATE_RETRIEVAL_PER_GB=0.02
PRICE_PRIVATE_WRITE_PER_GB=0.045
FREE_READ_MAX_BYTES=1048576
```

## Build and run

```bash
npm install
npm run lint
npm test
npm run build
npm start
```

## Local verification commands

```bash
npm run check:x402
npm run check:x402:facilitator
npm run check:x402:paid
npm run check:x402:smoke
```

## Tier operations note

Current live tiers:
- open
- private

Planned tier:
- encrypted *(coming soon)*

Operationally, that means:
- do not expose `encrypted` as a working upload option yet
- do expose/document `private` as the premium live tier
- keep pricing/config/docs explicit about which tiers are live today

## Recommended deployment flow

1. set production env vars
2. deploy container
3. verify `/v1/health`
4. run facilitator support check
5. run smoke test
6. run one larger paid download test if you want settlement confidence on a non-free read path

## Production smoke tests

### Basic deploy smoke

```bash
AGENT_STORAGE_URL=https://your-service.example.com npm run check:x402:smoke
```

This checks:
- health endpoint
- paid upload
- free read-back for a small file
- metadata endpoint

### Paid ping check

```bash
AGENT_STORAGE_URL=https://your-service.example.com npm run check:x402:paid https://your-service.example.com/v1/test/paid-ping
```

### Facilitator support check

```bash
npm run check:x402:facilitator
```

Use this in the deployed env or any environment with the same CDP credentials.

## Operational risks to watch

### 1) Secrets exposure

If any env secrets were pasted into chat, rotate them before public launch.

### 2) Runtime drift

R2 TLS works correctly with normal verification on Node 24.15.0 in this repo. If the runtime changes significantly, rerun the R2 smoke test.

### 3) Very small paid reads

Large paid reads use a minimum paid-read charge to avoid dust-sized x402 amounts.

## What “healthy” looks like

A good deploy should satisfy all of these:
- `GET /v1/health` returns 200
- `npm run check:x402:facilitator` succeeds with Base mainnet support
- `npm run check:x402:smoke` succeeds
- one paid route settles successfully on the deployed URL

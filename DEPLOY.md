# Deploy Vaultline

## Recommended: Railway

Railway is still the easiest first deploy for this service:
- simple Docker deploy
- env var management
- health checks
- good fit for a state-light HTTP API

## Steps

1. Create a new Railway project from this folder.
2. Let Railway use `Dockerfile` + `railway.json`.
3. Set env vars from `.env`.
4. Deploy.
5. Verify `GET /v1/health`.
6. Run `npm run check:x402:facilitator` in the deployed env or with deployed env vars locally.
7. Run `AGENT_STORAGE_URL=https://your-service.up.railway.app npm run check:x402:smoke`.
8. Optionally run `AGENT_STORAGE_URL=https://your-service.up.railway.app npm run check:x402:paid https://your-service.up.railway.app/v1/test/paid-ping`.

## Required env vars

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `X402_NETWORK`
- `X402_USDC_CONTRACT`
- `X402_TREASURY_WALLET`
- `X402_FACILITATOR_URL`
- `CDP_API_KEY_ID`
- `CDP_API_KEY_SECRET`
- `PRICE_STORAGE_PER_GB_MONTH`
- `PRICE_RETRIEVAL_PER_GB`
- `PRICE_WRITE_PER_GB`
- `FREE_READ_MAX_BYTES`

## Production blockers

### 1) Rotate exposed secrets
At minimum:
- rotate the Cloudflare/R2 secret if it was exposed in chat
- rotate the CDP API key because the secret was pasted into chat

### 2) Verify runtime stays on a good Node version
The old `NODE_TLS_REJECT_UNAUTHORIZED=0` workaround has been removed after confirming R2 works normally on Node 24.15.0.

Before production, keep deployment on a confirmed-good runtime and re-run the R2 smoke test if the Node version changes.

### 3) Verify deployed mainnet payments
Local mainnet verification is already working.
Still do one production-side check after deploy:
- paid upload
- paid large download
- confirm settlement and treasury receipt

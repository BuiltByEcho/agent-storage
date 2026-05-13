# Vaultline Notes

## Current state

Built and verified locally:
- Express API
- x402 v2 payment flow on Base mainnet
- authenticated CDP facilitator integration
- Cloudflare R2 storage backend
- integration tests for paid upload / free small read / paid large read
- smoke scripts for local and deployed verification

## What is proven

- facilitator auth works on Base mainnet
- paid ping works end-to-end
- paid upload works end-to-end
- free small downloads work
- paid large downloads work
- R2 works with normal TLS verification on Node 24.15.0

## Known product decision still open

Tiny paid reads can become awkward because the amount rounds down to a very small value.

Possible future choices:
- keep the current free threshold and accept that tiny paid reads are rare
- add a minimum read charge
- batch retrieval pricing differently

## Operational reminders

- rotate any exposed secrets before public launch
- keep deployment on a known-good Node runtime and rerun the smoke tests if it changes
- do at least one deployed paid upload and one deployed paid large download before calling production solid

## Useful commands

```bash
npm run lint
npm test
npm run build
npm run check:x402
npm run check:x402:facilitator
npm run check:x402:paid
npm run check:x402:smoke
```

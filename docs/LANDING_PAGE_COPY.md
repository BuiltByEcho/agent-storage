# Landing Page Copy

## Hero options

### Option 1
**Persistent storage for autonomous agents**

Pay for file operations directly over HTTP with x402.
No buyer accounts. No API keys. No dashboard-first billing.
Just request, pay, retry, and move data.

### Option 2
**Dropbox for Agents**

A storage API built for machine clients.
Uploads and large downloads are paid with x402 on Base mainnet.
Small reads stay frictionless.

### Option 3
**Storage as a paid primitive**

Vaultline turns file access into a metered HTTP capability.
Agents can buy exactly the storage operations they need, one request at a time.

---

## Subhead options

### Subhead A
Traditional storage APIs assume human accounts and API key provisioning.
Vaultline assumes autonomous clients, per-request pricing, and crypto-native settlement.

### Subhead B
If an agent can make an HTTP request, it can buy storage access.
That is the whole product thesis.

### Subhead C
Built for artifact exchange, shared workspaces, retrieval APIs, and machine-to-machine file flows.

---

## “How it works” section

### Short version
1. An agent requests a file operation.
2. Vaultline returns `402 Payment Required` when payment is needed.
3. The agent signs payment using x402.
4. The agent retries the request.
5. Vaultline verifies and settles, then serves the response.

### One-line version
Request -> 402 -> sign -> retry -> done.

---

## Problem section

### Version 1
APIs for humans are full of account machinery.
That is fine when a person is clicking around a dashboard.
It is awkward when one agent wants to buy storage access from another service in the middle of a workflow.

Vaultline removes that mismatch.

### Version 2
Machine clients do not want signup flows.
They want protocol-level access, predictable pricing, and a way to pay inline.
Vaultline gives them that for file storage.

---

## Benefits section

### Headline
Why this is better for agents

### Bullets
- No buyer account creation in the critical path
- No API key issuance for customers
- Per-request pricing instead of subscription-first billing
- Simple HTTP interface
- x402-native payment flow
- Works well for autonomous workflows and paid retrieval

---

## Use cases section

### Headline
What it is good for

### Bullets
- Shared agent workspaces
- Paid file retrieval APIs
- Artifact storage for autonomous workflows
- Cross-agent handoff of models, outputs, and logs
- Metered storage access without traditional auth overhead
- Tiered storage: open now, private now, encrypted coming soon

---

## Technical credibility section

### Headline
Built on real payment rails

### Copy
Vaultline uses x402 v2 on Base mainnet and verifies/settles through the Coinbase CDP facilitator.
Storage is backed by Cloudflare R2.
That gives the system a simple interface on the outside and real settlement behavior underneath.

---

## CTA options

### CTA 1
**Start with a normal HTTP request**
Hit a paid route, get the x402 requirement, sign, retry.

### CTA 2
**See the flow in code**
The repo includes live smoke scripts and integration examples for paid upload and download flows.

### CTA 3
**Build storage-native agents**
Use Vaultline when file access should be bought, not pre-provisioned.

---

## Short GitHub/social blurb

Vaultline is paid file storage for autonomous agents.
It uses x402 on Base mainnet so clients can buy uploads and downloads directly over HTTP instead of going through account creation, API keys, and dashboard billing.

---

## Product thesis

The product is not “another S3 wrapper.”
The product is turning storage access into a machine-buyable capability — with storage tiers that map cleanly to sharing, ownership, and eventually maximum privacy.

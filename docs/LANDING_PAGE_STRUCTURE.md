# Landing Page Structure

This document is a content/spec artifact for a future site build.
It is intentionally focused on structure, narrative, and section goals — not implementation.

## Page goal

A visitor should understand three things within a few seconds:
1. what Vaultline is
2. why it is different from normal storage APIs
3. why x402-native storage matters for agent workflows

## Audience

Primary:
- agent builders
- AI infra developers
- protocol/tooling people
- developers exploring paid machine-to-machine APIs

Secondary:
- crypto-native builders
- infra-curious founders
- people who want a memorable “Dropbox for Agents” concept

## Tone

- credible
- technical but not dry
- product-forward
- clear enough for non-specialists
- no buzzword soup

## Recommended page outline

### 1) Hero

**Goal:** make the product legible in one screen.

Suggested content:
- headline: `Persistent storage for autonomous agents`
- subhead: `Pay for file operations directly over HTTP with x402. No buyer accounts. No API keys. Just request, pay, retry, and move data.`
- supporting line: `Built for paid retrieval, shared agent workspaces, artifact exchange, and machine-to-machine storage flows.`
- CTA ideas:
  - `Read the docs`
  - `See the payment flow`
  - `View integration examples`

Optional visual:
- very simple request-flow diagram:
  `request -> 402 -> sign -> retry -> file`

### 2) Problem

**Goal:** explain why normal storage APIs are awkward for agents.

Key points:
- traditional storage assumes human-owned accounts
- customers are expected to create keys before work begins
- billing is separated from the request itself
- autonomous clients want inline payment and immediate access

Suggested headline:
- `Storage APIs were built for humans first`

### 3) Product thesis

**Goal:** explain the deeper idea, not just the features.

Key points:
- Vaultline treats payment as the access primitive
- x402 lets a route quote price and settle inline
- this makes storage machine-buyable

Suggested headline:
- `Storage as a paid primitive`

### 4) How it works

**Goal:** demystify the x402 interaction.

Recommended format:
- 4 to 6 step visual sequence

Suggested steps:
1. agent requests a file operation
2. server returns `402 Payment Required`
3. response includes x402 requirements
4. client signs payment and retries
5. server verifies/settles through CDP facilitator
6. operation succeeds

### 5) What you can do with it

**Goal:** anchor the product in real use cases.

Suggested cards:
- shared agent workspaces
- paid artifact retrieval
- workflow output storage
- cross-agent handoff
- metered dataset/model file access

### 6) Why this model is better

**Goal:** make the contrast explicit.

Suggested comparison points:
- no buyer onboarding in the critical path
- no customer API key provisioning
- per-request pricing
- standard HTTP semantics
- crypto-native settlement

Could be presented as:
- bullets
- or a simple side-by-side “traditional API vs agent-native API” section

### 7) Technical credibility

**Goal:** show it is real, not conceptual.

Suggested points:
- x402 v2 on Base mainnet
- authenticated CDP facilitator
- Cloudflare R2-backed object storage
- verified flows for paid upload and paid large download
- integration tests and smoke scripts included

Suggested headline:
- `Built on real payment rails`

### 8) Developer proof

**Goal:** reduce skepticism and encourage exploration.

Suggested content:
- short code sample of pay-and-retry helper
- links to:
  - API docs
  - integration examples
  - smoke scripts

### 9) Pricing section

**Goal:** make the business model concrete.

Suggested content:
- storage per GB/month
- retrieval per GB
- write per GB
- free small reads
- free metadata/list/delete

Optional note:
- pricing is configurable by deployment

### 10) FAQ

**Goal:** handle predictable objections.

Suggested questions:
- Why not just use S3 with API keys?
- Why x402 instead of prepaid billing?
- Is every request paid?
- Are small reads free?
- Which network does this use?
- Does this require a custom client?

### 11) Final CTA

**Goal:** give a clean next action.

Suggested CTA options:
- `Read the docs`
- `See integration examples`
- `Run the smoke test`

## Content assets already available

These files already provide most of the source material:
- `README.md`
- `docs/OVERVIEW.md`
- `docs/API.md`
- `docs/INTEGRATION_EXAMPLES.md`
- `docs/LANDING_PAGE_COPY.md`

## Suggested future page blocks beyond MVP

Optional later additions:
- animation of 402 -> sign -> retry flow
- architecture graphic
- use-case callouts by persona
- “why agents need different infra” essay section
- live code tabs for TypeScript / Python client examples

## Success criteria for the future page

A good landing page should make a new visitor say:
- `Oh, this is storage you can buy inline over HTTP.`
- `I get why agents would want this.`
- `This feels real enough to try.`

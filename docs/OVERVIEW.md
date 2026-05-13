# Vaultline Overview

Vaultline is paid file storage for autonomous agents.

It gives an agent a simple contract:
- make a normal HTTP request
- get back an x402 payment requirement when payment is needed
- sign and retry
- receive the file or write confirmation

That makes it feel like "Dropbox for Agents," but with one major difference:
there are no buyer accounts, API keys, or billing dashboards in the critical path. Payment is the access primitive.

## Why this exists

Most storage products assume a human account owner:
- create an account
- issue API keys
- manage permissions
- prepay or attach a card
- deal with quotas and subscriptions

That model is awkward for agent-to-agent usage.

Agents want:
- direct machine-readable access
- per-request pricing
- no manual account creation
- composable HTTP interfaces
- cryptographic payment and settlement

Vaultline is built around that shape.

## What it does today

- paid uploads with x402 v2 on Base mainnet
- open storage for shared/public-by-key objects
- wallet-based private storage for owner-only or allowlisted reads
- encrypted storage positioned as a coming-soon tier
- free small downloads under a configurable threshold
- paid large downloads
- free file metadata, listing, and deletes
- Cloudflare R2-backed object storage
- CDP facilitator-backed verification and settlement

## Core idea

A file route can behave like an API product:
- small or cheap operations can be free
- expensive operations can require payment
- payment happens inline with the request lifecycle

That means agents can treat storage as a metered primitive rather than a subscription service.

## Current positioning

Vaultline is best thought of as:
- a paid storage API
- a reference implementation for x402-gated file operations
- a building block for agent sync, shared workspaces, artifact exchange, and paid retrieval

It is not yet positioned as:
- a polished end-user Dropbox replacement
- a full multi-tenant SaaS with dashboards and auth
- a finalized sync engine

## Who it is for

Best-fit users right now:
- agent builders
- autonomous workflow developers
- teams experimenting with paid machine-to-machine APIs
- people who want storage gated by crypto payment instead of traditional auth/billing

## One-line pitch

Vaultline is persistent file storage for agents, sold one request at a time over x402, with a tier ladder from open to private and eventually encrypted.

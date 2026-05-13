# AgentStorage API

Base URL examples:
- local: `http://localhost:3001`
- deployed: `https://your-service.example.com`

## Payment model

AgentStorage uses x402 v2 on Base mainnet for paid routes.

When a request requires payment:
1. client sends request normally
2. server responds `402 Payment Required`
3. response includes a `payment-required` header with x402 v2 requirements
4. client signs payment and retries with the x402 payment signature header (`payment-signature` in the current x402 v2 flow; `x-payment` is also accepted for compatibility)
5. server verifies and settles through the CDP facilitator
6. server returns the normal route response

## Routes

### `PUT /v1/files/{path}`

Upload a file.

Payment:
- paid
- priced by bytes written
- write minimum charge currently applies

Request:
- body: raw bytes, text, or JSON body
- recommended header: `content-type`
- optional header: `x-storage-tier: open|private`

Note:
- `encrypted` is not a live upload tier yet; treat it as coming soon for now

For private uploads, also send wallet auth headers:
- `x-auth-wallet`
- `x-auth-timestamp`
- `x-auth-signature`

Optional private-upload headers:
- `x-owner-wallet` — defaults to the authenticated wallet
- `x-allowed-wallets` — comma-separated wallet allowlist

Success response:
```json
{
  "ok": true,
  "file": {
    "key": "workspace/demo.txt",
    "size": 123,
    "lastModified": "2026-05-12T22:11:39.000Z",
    "contentType": "text/plain",
    "etag": "\"...\"",
    "tier": "open"
  },
  "cost": "0.001000"
}
```

Pricing notes:
- open writes use the open-tier write rate
- private writes use the private-tier write rate

### `GET /v1/files/{path}`

Download a file.

Payment:
- open files: free when file size is under `FREE_READ_MAX_BYTES`, otherwise paid by bytes retrieved
- private files: same payment rules, but access is restricted to the owner wallet or allowed wallets

Private file auth headers:
- `x-auth-wallet`
- `x-auth-timestamp`
- `x-auth-signature`

Success response:
- raw file contents
- `content-type` from stored object metadata when available
- `x-storage-cost` header with quoted dollar amount

### `HEAD /v1/files/{path}`

Fetch metadata without downloading the file.

Payment:
- free

For private files, the same wallet auth headers are required.

Useful headers:
- `content-length`
- `content-type`
- `last-modified`
- `x-storage-cost-if-read`
- `x-storage-monthly-cost`

### `DELETE /v1/files/{path}`

Delete a file.

Payment:
- free

For private files, the same wallet auth headers are required.

Success response:
```json
{
  "ok": true,
  "deleted": "workspace/demo.txt"
}
```

### `GET /v1/list`
### `GET /v1/list/{prefix}`

List files.

Payment:
- free

Behavior:
- open files are listed normally
- private files are hidden unless the caller sends valid wallet auth headers and is authorized for those objects

Success response:
```json
{
  "files": [
    {
      "key": "workspace/demo.txt",
      "size": 123,
      "lastModified": "2026-05-12T22:11:39.000Z"
    }
  ],
  "directories": [],
  "prefix": "workspace/",
  "truncated": false
}
```

### `GET /v1/usage`

Returns summary storage stats.

Payment:
- free

### `GET /v1/health`

Basic health endpoint for deploy checks.

Payment:
- free

### `GET /v1/test/paid-ping`

A minimal paid route used to verify the mainnet x402 flow.

Payment:
- paid
- fixed test price

## Private storage auth message

Private storage uses a wallet-signed message for ownership/access checks.

Message format:

```text
AgentStorage auth
method:PUT
path:private.txt
wallet:0xYourWallet
timestamp:1715576400000
```

The server verifies:
- wallet address
- signature validity
- timestamp freshness
- authorization against the file owner/allowlist for private objects

## 402 response shape

For paid routes, the canonical machine-readable source is the `payment-required` header.

AgentStorage may also include a JSON body with convenience fields like:
- `error`
- `operation`
- `amount`
- `currency`
- `network`
- `payTo`
- `description`

Clients should treat the x402 v2 header as the source of truth.

## Tier guidance

Current live tiers:
- `open`
- `private`

Planned tier:
- `encrypted` *(coming soon)*

For the deeper product/usage guidance, see `docs/STORAGE_TIERS.md`.

## Client scripts in this repo

- `npm run check:x402` — validate a 402 discovery response
- `npm run check:x402:paid` — exercise the paid ping route
- `npm run check:x402:smoke` — health + paid upload + free read smoke test

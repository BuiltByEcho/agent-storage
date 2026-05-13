# Vaultline Storage Tiers

Vaultline is moving toward a 3-tier storage model:

1. **Open storage**
2. **Private storage**
3. **Encrypted storage** *(coming soon)*

The idea is simple: each tier adds stronger privacy and control, and each tier is priced accordingly.

## 1) Open storage

Open storage is the default and lowest-cost tier.

### What it means
- files are stored normally
- anyone who knows the path/key can attempt to read them
- reads may still require payment depending on file size
- small reads under the free threshold may be free

### Best for
- shared artifacts
- agent handoffs
- cached outputs
- generated images meant for reuse
- public-by-key storage flows

### How to upload
Send a normal file upload, or explicitly set:

```http
x-storage-tier: open
```

### Default pricing
- storage: `$0.08 / GB / month`
- retrieval: `$0.015 / GB`
- write: `$0.03 / GB`

## 2) Private storage

Private storage is the current premium tier.

### What it means
- each private object is bound to an owner wallet
- only the owner wallet or explicitly allowlisted wallets can access it
- private access applies even when a read would otherwise be free
- files remain stored in normal server-side object storage, but access is restricted by wallet-signed auth

### Best for
- internal agent memory
- client files
- private workspaces
- controlled collaboration
- proprietary outputs that should not be readable by anyone who simply knows the path

### How it works
For private storage, the client uploads with:
- `x-storage-tier: private`
- wallet auth headers

Required auth headers:
- `x-auth-wallet`
- `x-auth-timestamp`
- `x-auth-signature`

Optional headers:
- `x-owner-wallet`
- `x-allowed-wallets`

The server verifies a signed message containing:
- request method
- file path
- wallet address
- timestamp

### Example upload headers

```http
x-storage-tier: private
x-auth-wallet: 0xYourWallet
x-auth-timestamp: 1715576400000
x-auth-signature: 0x...
```

### Default pricing
- storage: `$0.12 / GB / month`
- retrieval: `$0.02 / GB`
- write: `$0.045 / GB`

### Why it costs more
Private storage adds real value and real system work:
- ownership metadata
- access-control checks
- wallet signature verification
- allowlist support
- protected reads even on low-cost/free-size objects

## 3) Encrypted storage *(coming soon)*

Encrypted storage is the planned highest-privacy tier.

### What it will mean
- files will be encrypted before or as they are stored
- the service will store ciphertext rather than plain file contents
- access will require both authorization and decryption capability
- this tier is for data where “private in app logic” is not strong enough

### Best for
- sensitive documents
- private datasets
- high-trust agent memory
- confidential internal artifacts
- use cases where operators should not be able to casually inspect file contents

### Current status
Encrypted storage is **not live yet**.

For now, treat it as a clearly planned next tier:
- private storage is available today
- encrypted storage is a coming-soon tier, not an active feature

### How to talk about it right now
Good framing:
- “Encrypted storage is coming soon.”
- “Private wallet-based storage is available now.”
- “Encrypted storage will be the highest-privacy tier.”

Bad framing:
- do not imply ciphertext storage already exists
- do not imply zero-knowledge guarantees yet
- do not imply the service cannot read private-tier objects today

## Recommended positioning

Use this ladder in product copy:

- **Open** — cheapest, best for collaboration
- **Private** — wallet-owned, best for controlled access
- **Encrypted** — coming soon, best for maximum privacy

## Which tier should users choose?

### Choose Open when:
- the file is meant to be shared by key/path
- the workflow is collaborative
- low cost matters most
- retrieval does not need owner-only restrictions

### Choose Private when:
- only one agent or a known set of wallets should read the file
- the file is operationally sensitive
- ownership and access control matter
- you want stronger protection without waiting for full encryption support

### Choose Encrypted when it ships if:
- the service should store ciphertext, not readable plaintext
- the file is especially sensitive
- access control alone is not enough

## Short product framing

Vaultline now has a clear storage ladder:
- open for sharing
- private for ownership
- encrypted for maximum privacy, coming soon

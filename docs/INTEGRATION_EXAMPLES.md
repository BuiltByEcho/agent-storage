# Vaultline Integration Examples

This page shows how an agent client can interact with Vaultline routes that use x402 v2.

Examples below assume:
- Base mainnet payments
- a client wallet/private key is available
- the server returns a `payment-required` header for paid routes

## Core pattern

Every paid interaction follows the same shape:

1. send the request normally
2. if the response is not `402`, handle it normally
3. if the response is `402`, parse the x402 payment requirement
4. create a payment payload
5. retry the same request with the x402 payment signature header (`payment-signature` in the current x402 v2 flow; `x-payment` can still be accepted for compatibility)

That is the only mental model most agent clients need.

---

## TypeScript example: generic pay-and-retry helper

```ts
import { x402Client } from '@x402/core/client';
import { x402HTTPClient } from '@x402/core/http';
import { ExactEvmScheme, toClientEvmSigner } from '@x402/evm';
import { privateKeyToAccount } from 'viem/accounts';

const privateKey = process.env.X402_PAYER_PRIVATE_KEY as `0x${string}`;
const account = privateKeyToAccount(privateKey);

const client = new x402Client().register(
  'eip155:*',
  new ExactEvmScheme(toClientEvmSigner(account))
);

const httpClient = new x402HTTPClient(client);

export async function payAndRetry(url: string, init: RequestInit = {}) {
  const initial = await fetch(url, init);

  if (initial.status !== 402) {
    return initial;
  }

  const bodyText = await initial.text();
  const body = bodyText ? JSON.parse(bodyText) : {};

  const paymentRequired = httpClient.getPaymentRequiredResponse(
    (name) => initial.headers.get(name),
    body
  );

  const paymentPayload = await client.createPaymentPayload(paymentRequired);

  return fetch(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...httpClient.encodePaymentSignatureHeader(paymentPayload),
    },
  });
}
```

---

## Python example: generic pay-and-retry helper

This example shows the request flow a Python client should follow. The payment-signing call is represented as a stub because the exact Python x402 client you use may vary.

```py
import json
import os
import requests

BASE_URL = os.getenv("AGENT_STORAGE_URL", "https://vaultline.example.com")
PRIVATE_KEY = os.environ["X402_PAYER_PRIVATE_KEY"]


def create_payment_header(payment_required: dict, private_key: str) -> dict:
    """
    Replace this with your actual x402 payment creation/signing call.
    It should return headers like: {"payment-signature": "..."}
    """
    raise NotImplementedError("Hook up your Python x402 signer here")



def pay_and_retry(method: str, url: str, **kwargs) -> requests.Response:
    initial = requests.request(method, url, **kwargs)
    if initial.status_code != 402:
        return initial

    body = initial.json() if initial.content else {}
    payment_required_header = initial.headers.get("payment-required")

    payment_required = {
        "header": payment_required_header,
        "body": body,
    }

    payment_headers = create_payment_header(payment_required, PRIVATE_KEY)

    retry_headers = dict(kwargs.get("headers", {}))
    retry_headers.update(payment_headers)
    kwargs["headers"] = retry_headers

    return requests.request(method, url, **kwargs)
```

If you want a concrete Python implementation later, the main thing to add is a real x402 payload/signature generator that emits the x402 payment signature header for the retry (`payment-signature` in the current x402 v2 flow).

---

## Example: paid upload

### Open upload
This is the default tier unless you explicitly request `private`.

### TypeScript

```ts
const fileBody = Buffer.from('hello from an agent\n');

const response = await payAndRetry(
  'https://vaultline.example.com/v1/files/workspace/demo.txt',
  {
    method: 'PUT',
    body: fileBody,
    headers: {
      'content-type': 'text/plain',
      'content-length': String(fileBody.length),
    },
  }
);

console.log(response.status);
console.log(await response.json());
```

### Python

```py
file_body = b"hello from an agent\n"
response = pay_and_retry(
    "PUT",
    f"{BASE_URL}/v1/files/workspace/demo.txt",
    data=file_body,
    headers={
        "content-type": "text/plain",
        "content-length": str(len(file_body)),
    },
)

print(response.status_code)
print(response.json())
```

### Private upload

For private uploads, add `x-storage-tier: private` and wallet-auth headers.

```ts
import { buildStorageAuthMessage } from '../src/auth';

const timestamp = Date.now();
const message = buildStorageAuthMessage({
  method: 'PUT',
  path: 'workspace/secret.txt',
  wallet: account.address,
  timestamp,
});

const authSignature = await account.signMessage({ message });
const fileBody = Buffer.from('private agent notes\n');

const response = await payAndRetry(
  'https://vaultline.example.com/v1/files/workspace/secret.txt',
  {
    method: 'PUT',
    body: fileBody,
    headers: {
      'content-type': 'text/plain',
      'content-length': String(fileBody.length),
      'x-storage-tier': 'private',
      'x-auth-wallet': account.address,
      'x-auth-timestamp': String(timestamp),
      'x-auth-signature': authSignature,
    },
  }
);
```

Expected behavior:
- first request gets `402`
- second request succeeds with `200`
- response body includes file metadata and quoted cost
- private uploads return file metadata with `tier: "private"`

---

## Example: free small download

### TypeScript

```ts
const response = await fetch(
  'https://vaultline.example.com/v1/files/workspace/demo.txt'
);

console.log(response.status);
console.log(response.headers.get('x-storage-cost'));
console.log(await response.text());
```

### Python

```py
response = requests.get(f"{BASE_URL}/v1/files/workspace/demo.txt")
print(response.status_code)
print(response.headers.get("x-storage-cost"))
print(response.text)
```

For files smaller than `FREE_READ_MAX_BYTES`, this should succeed directly without payment.

---

## Example: paid large download

### TypeScript

```ts
const response = await payAndRetry(
  'https://vaultline.example.com/v1/files/artifacts/model-output.bin'
);

console.log(response.status);
console.log(response.headers.get('x-storage-cost'));

const bytes = Buffer.from(await response.arrayBuffer());
console.log('downloaded bytes:', bytes.length);
```

### Python

```py
response = pay_and_retry(
    "GET",
    f"{BASE_URL}/v1/files/artifacts/model-output.bin",
)

print(response.status_code)
print(response.headers.get("x-storage-cost"))
print("downloaded bytes:", len(response.content))
```

Expected behavior:
- first request gets `402`
- second request succeeds with `200`
- `x-storage-cost` reflects the billed retrieval amount

---

## Example: inspect metadata before reading

### TypeScript

```ts
const head = await fetch(
  'https://vaultline.example.com/v1/files/artifacts/model-output.bin',
  { method: 'HEAD' }
);

console.log(head.status);
console.log('content-length:', head.headers.get('content-length'));
console.log('read cost if fetched:', head.headers.get('x-storage-cost-if-read'));
console.log('monthly storage estimate:', head.headers.get('x-storage-monthly-cost'));
```

### Python

```py
head = requests.head(f"{BASE_URL}/v1/files/artifacts/model-output.bin")
print(head.status_code)
print("content-length:", head.headers.get("content-length"))
print("read cost if fetched:", head.headers.get("x-storage-cost-if-read"))
print("monthly storage estimate:", head.headers.get("x-storage-monthly-cost"))
```

This is useful when an agent wants to decide whether to fetch a file before paying.

---

## Example: paid ping route

This is the simplest route to test that a client wallet can complete the x402 flow.

### TypeScript

```ts
const response = await payAndRetry(
  'https://vaultline.example.com/v1/test/paid-ping'
);

console.log(response.status);
console.log(await response.text());
```

### Python

```py
response = pay_and_retry("GET", f"{BASE_URL}/v1/test/paid-ping")
print(response.status_code)
print(response.text)
```

---

## What to treat as source of truth

For paid routes, use the x402 data returned by the server as the source of truth.

In practice:
- rely on the `payment-required` header for x402 v2 requirements
- treat any convenience JSON body as helpful but secondary

---

## Encrypted tier note

`encrypted` is not a live upload tier yet.

For now:
- use `open` for shared/public-by-key objects
- use `private` for wallet-restricted access
- treat encrypted storage as a coming-soon tier in product planning and UI copy

## Practical client advice

- Keep the original request intact when retrying after payment.
- Preserve headers like `content-type` and `content-length` on uploads.
- Use `HEAD` when you want to inspect file size and read cost before downloading.
- Expect some routes to be free and skip the payment path entirely.
- Prefer a reusable `payAndRetry()` helper so your agent tooling stays simple.
- In Python, keep the payment-signing step isolated so you can swap in a real x402 SDK/client later.

---

## Scripts in this repo you can copy from

- `scripts-x402-paid-local.ts` — minimal paid ping example
- `scripts-x402-smoke.ts` — health + paid upload + free read smoke test
- `test/x402.integration.test.ts` — repo integration coverage for upload/download flows

# AgentStorage SDK v0.1.1

Small hardening release for agent and CLI consumers.

## What changed

- Added exported `AgentStorageError` for `instanceof`-safe error handling.
- SDK helper methods now throw typed errors for non-2xx responses after any x402 retry.
- Error objects include HTTP status, method, URL, response, and parsed JSON/text body.
- Added default request timeouts with `timeoutMs` client option (`30_000` ms by default, `0` disables).
- Expanded tests for error handling and timeout signal wiring.
- Updated README with practical catch/retry examples.

## Why it matters

Agents need to decide whether to retry, fall back, ask a human, or mark a task blocked. Raw failed `Response` objects and JSON parse failures are awkward in autonomous workflows. Typed errors make AgentStorage safer to embed in tools and MCP servers.

## Verification

```bash
cd sdk
npm test
npm run build
```

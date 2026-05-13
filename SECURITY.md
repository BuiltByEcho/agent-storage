# Security Policy

Vaultline / AgentStorage is an x402-native storage service. Treat it as payment and storage infrastructure, not a demo toy.

## Supported surface

The currently supported public surfaces are:

- `open` storage tier
- `private` wallet-gated storage tier
- TypeScript SDK package: `@builtbyecho/agent-storage-sdk`

The `encrypted` tier is planned, but not live. Do not rely on it for confidentiality.

## Secret handling

Never commit or share production secrets, including:

- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `CDP_API_KEY_ID`
- `CDP_API_KEY_SECRET`
- wallet private keys / mnemonics
- deployment `.env` files

Production deployments must provide `X402_TREASURY_WALLET`; the development fallback is only for local/test convenience.

## Reporting vulnerabilities

Please report security issues privately to the maintainers before public disclosure. Do not open a public GitHub issue containing exploit details, secrets, or live abuse paths.

Useful report details:

- affected route/package/version
- reproduction steps
- expected vs actual behavior
- whether funds, private files, or credentials could be exposed

## Operational checklist before public promotion

- Rotate any credentials that were pasted into chats, logs, screenshots, or CI output.
- Keep `.env` files out of git and deployment logs.
- Confirm R2 bucket is private and accessible only via scoped service credentials.
- Confirm CDP/x402 credentials are scoped and rotated on suspicion.
- Run the test suite and deployed smoke tests against the production URL.
- Enable host-level rate limiting and log rotation on the deployed API.
- Set `REQUEST_BODY_LIMIT` deliberately for production traffic.
- Set `CORS_ORIGINS` deliberately if browser clients should be restricted.

# Releasing @builtbyecho/vaultline-sdk

## 1. Confirm package name and auth

```bash
npm whoami
npm view @builtbyecho/vaultline-sdk version
```

Expected today:
- `npm whoami` returns `builtbyecho`
- `npm view ... version` returns `404 Not Found` before first publish

## 2. Verify package quality

```bash
npm install
npm run lint
npm test
npm run build
npm pack --dry-run
```

## 3. Publish

```bash
npm publish --access public
```

## 4. Verify after publish

```bash
npm view @builtbyecho/vaultline-sdk version
npm view @builtbyecho/vaultline-sdk dist-tags --json
```

## 5. Install smoke test

```bash
mkdir -p /tmp/vaultline-sdk-smoke && cd /tmp/vaultline-sdk-smoke
npm init -y
npm install @builtbyecho/vaultline-sdk viem
```

## Current release target

- version: `0.1.0`
- live tiers: `open`, `private`
- `encrypted` remains coming soon

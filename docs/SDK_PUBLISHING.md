# Vaultline SDK Publishing

This is the publishing checklist for `@builtbyecho/vaultline-sdk`.

## Package location

- `sdk/`

## Package name sanity check

Current checked state:
- `npm whoami` -> `builtbyecho`
- `npm view @builtbyecho/vaultline-sdk version` -> `404 Not Found`

That means the package name appears available for a first publish under the current logged-in npm account.

## Pre-publish checklist

1. update version in `sdk/package.json`
2. run:

```bash
cd sdk
npm install
npm run lint
npm test
npm run build
```

3. verify package contents:

```bash
npm pack --dry-run
```

4. confirm README examples still match the current API
5. confirm `open` and `private` are the only live tiers documented
6. make sure `encrypted` is still described as coming soon unless it is actually implemented

## Publish

```bash
cd sdk
npm publish --access public
```

## Exact first-release flow

```bash
cd projects/vaultline/sdk
npm whoami
npm run prepublishOnly
npm pack --dry-run
npm publish --access public
npm view @builtbyecho/vaultline-sdk version
```

## Current publish posture

The package has:
- explicit `exports`
- `files` whitelist
- `prepublishOnly` verification
- README
- example scripts
- tests

## Notes

- target Node `>=20`
- depends on `viem`, `@x402/core`, and `@x402/evm`
- designed for TypeScript / modern fetch-capable runtimes first

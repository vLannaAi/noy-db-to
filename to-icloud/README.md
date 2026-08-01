# @noy-db/to-icloud

[![npm](https://img.shields.io/npm/v/%40noy-db/to-icloud.svg)](https://www.npmjs.com/package/@noy-db/to-icloud)

> iCloud Drive bundle store for noy-db

Part of [**`@noy-db/hub`**](https://www.npmjs.com/package/@noy-db/hub) — the zero-knowledge, offline-first, encrypted document store.

## Install

```bash
pnpm add @noy-db/hub @noy-db/to-icloud
```

Requires `@noy-db/hub >= 0.4.0-pre.11`: this store conforms through the hub's `wrapPodStore()`, and concurrent-write correctness lives in that wrapper (fixed in noy-db#908).

## What it is

iCloud Drive bundle store for noy-db — macOS-aware persistence that detects eviction stubs (.icloud) and conflict files automatically. Treats each vault as a single .noydb bundle, safe for the Apple ecosystem.

## Status

**Pre-release** (`0.1.0-pre.1`). API may change before `1.0`.

## Documentation

See the [main repository](https://github.com/vLannaAi/noy-db#readme) for setup, examples, and the full subsystem catalog.

- Source — [`to-icloud`](https://github.com/vLannaAi/noy-db-to/tree/main/to-icloud)
- Issues — [github.com/vLannaAi/noy-db-to/issues](https://github.com/vLannaAi/noy-db-to/issues)
- Spec — [`SPEC.md`](https://github.com/vLannaAi/noy-db/blob/main/SPEC.md)

## License

[MIT](./LICENSE) © vLannaAi

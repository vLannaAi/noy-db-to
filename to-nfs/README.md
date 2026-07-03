# @noy-db/to-nfs

[![npm](https://img.shields.io/npm/v/%40noy-db/to-nfs.svg)](https://www.npmjs.com/package/@noy-db/to-nfs)

> NFS network-file store for noy-db. Same JSON-file indexed layout as the local file store, with pre-flight checks for nolock / noac mount options that silently break versioning guarantees on stock NFS mounts.

Part of [**`@noy-db/hub`**](https://www.npmjs.com/package/@noy-db/hub) — the zero-knowledge, offline-first, encrypted document store.

## Install

```bash
pnpm add @noy-db/hub @noy-db/to-nfs
```

## What it is

NFS network-file store for noy-db. Same JSON-file indexed layout as the local file store, with pre-flight checks for nolock / noac mount options that silently break versioning guarantees on stock NFS mounts.

## Status

**Pre-release** (`0.1.0-pre.1`). API may change before `1.0`.

## Documentation

See the [main repository](https://github.com/vLannaAi/noy-db#readme) for setup, examples, and the full subsystem catalog.

- Source — [`to-nfs`](https://github.com/vLannaAi/noy-db-to/tree/main/to-nfs)
- Issues — [github.com/vLannaAi/noy-db-to/issues](https://github.com/vLannaAi/noy-db-to/issues)
- Spec — [`SPEC.md`](https://github.com/vLannaAi/noy-db/blob/main/SPEC.md)

## License

[MIT](./LICENSE) © vLannaAi

# noy-db-to

Extended storage adapters for [noy-db](https://github.com/vLannaAi/noy-db) — the non-essential
`to-*` family (cloud, server, remote filesystem). Each adapter is a thin, zero-knowledge
`NoydbStore` implementation bound to the published `@noy-db/hub/to` contract; the hub encrypts
before any adapter is called, so stores only ever see ciphertext.

The essential default stores (`to-memory`, `to-file`, `to-browser-idb`) ship from the `noy-db`
core repo. Install only the adapter you need, e.g. `pnpm add @noy-db/to-aws-s3 @noy-db/hub`.

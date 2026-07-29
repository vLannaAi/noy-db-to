/**
 * Shared store-contract conformance (noy-db-to#26).
 *
 * Runs against a REAL SQLite engine: `node:sqlite` (in-memory) wrapped in the
 * `LibsqlClient` duck shape — libSQL is a SQLite fork, so the SQL surface the
 * store emits (RETURNING, ON CONFLICT upserts, unixepoch) executes natively.
 * A mock can only fail the ways its author anticipated; this cannot.
 *
 * `batch()` wraps its statements in BEGIN…COMMIT, mirroring libSQL's implicit
 * one-transaction batch semantics — which is exactly the atomicity claim the
 * store's `txAtomic` capability makes (#22).
 */
import { DatabaseSync } from 'node:sqlite'
import { runStoreConformanceTests } from '@noy-db/test-adapter-conformance'
import type { LibsqlClient, LibsqlResultSet } from '../src/index.js'
import { toTurso } from '../src/index.js'

function libsqlOverNodeSqlite(): LibsqlClient {
  const db = new DatabaseSync(':memory:')

  function runOne(sql: string, args: readonly unknown[] = []): LibsqlResultSet {
    const stmt = db.prepare(sql)
    if (/^\s*(select|with)\b/i.test(sql) || /\breturning\b/i.test(sql)) {
      return { rows: stmt.all(...(args as never[])) as Record<string, unknown>[] }
    }
    stmt.run(...(args as never[]))
    return { rows: [] }
  }

  return {
    async execute(args) {
      return typeof args === 'string' ? runOne(args) : runOne(args.sql, args.args)
    },
    async batch(statements) {
      db.exec('BEGIN')
      try {
        const out = statements.map(s => runOne(s.sql, s.args))
        db.exec('COMMIT')
        return out
      } catch (err) {
        db.exec('ROLLBACK')
        throw err
      }
    },
  }
}

runStoreConformanceTests('to-turso (node:sqlite via LibsqlClient shape)', async () =>
  toTurso({ client: libsqlOverNodeSqlite() }),
)

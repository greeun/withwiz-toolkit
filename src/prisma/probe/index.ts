import { readdir } from "node:fs/promises";
import path from "node:path";
import { c } from "@withwiz/toolkit/core/utils/startup-banner";

/**
 * One-shot database check for a startup banner: round trip, server version and pending
 * migrations, read together.
 *
 * Pending migrations do not show up in a health check (it passes, and only signed-in users
 * hit 500s). So at boot the `prisma/migrations` directory listing is compared against the
 * finished rows in `_prisma_migrations`, and missing ones are printed by name. A failed check
 * never throws: the banner is a diagnostic, not a gate.
 *
 * The `*Line` helpers return values for `printStartupBanner` (`core/utils/startup-banner`):
 *   const probe = await probeDatabase(prisma, await listMigrationDirs());
 *   printStartupBanner({ title, sections: [{ emoji: '🗄️', title: 'Database', lines: [
 *     ['Ping', pingLine(probe)], ['Server', serverLine(probe)], ['Migrations', migrationsLine(probe)],
 *   ]}] });
 *
 * Does not import `@prisma/client`: the client is typed structurally (`$queryRawUnsafe` only).
 * Server only (uses node:fs).
 */

export type DbProbe =
  | {
      ok: true;
      latencyMs: number;
      serverVersion: string;
      /** Rows recorded as finished in `_prisma_migrations`. 0 when the table is missing. */
      applied: number;
      /** Migrations on disk without an applied record. null when the directory could not be read. */
      pending: string[] | null;
    }
  | { ok: false; reason: string };

/** The Prisma surface the probe needs, narrow enough for a test stub. */
export type ProbeClient = {
  $queryRawUnsafe<T = unknown>(query: string): Promise<T>;
};

export const PROBE_TIMEOUT_MS = 3000;

/**
 * Migration directory names on disk, sorted. null when the directory is missing
 * (e.g. a runtime image that ships without `prisma/`).
 */
export async function listMigrationDirs(
  root: string = process.cwd(),
  migrationsDir: string = path.join("prisma", "migrations"),
): Promise<string[] | null> {
  try {
    const entries = await readdir(path.resolve(root, migrationsDir), { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch {
    return null;
  }
}

/**
 * One-line failure reason. Prisma 7 driver adapters leave the message empty on connection
 * failure (`Invalid ... invocation:`) and put the cause only in `code` (e.g. ECONNREFUSED),
 * so `code` wins. Multi-line messages are folded into one line.
 */
export function describeProbeError(e: unknown): string {
  const code = (e as { code?: unknown } | null)?.code;
  if (typeof code === "string" && code) return code;
  return (e instanceof Error ? e.message : String(e)).replace(/\s+/g, " ").trim();
}

/**
 * No answer within the timeout counts as failure. A Prisma query cannot be aborted, so this
 * only races it and drops a late answer.
 */
export async function probeDatabase(
  client: ProbeClient,
  migrationDirs: string[] | null,
  timeoutMs: number = PROBE_TIMEOUT_MS,
): Promise<DbProbe> {
  const started = Date.now();
  const work = (async (): Promise<DbProbe> => {
    const [{ version }] = await client.$queryRawUnsafe<[{ version: string }]>("SELECT version()");
    const latencyMs = Date.now() - started;
    // No table (migrations never ran on this DB) counts as 0 applied.
    let appliedNames = new Set<string>();
    try {
      const rows = await client.$queryRawUnsafe<{ migration_name: string }[]>(
        'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL',
      );
      appliedNames = new Set(rows.map((r) => r.migration_name));
    } catch {
      appliedNames = new Set();
    }
    const pending = migrationDirs ? migrationDirs.filter((d) => !appliedNames.has(d)) : null;
    return {
      ok: true,
      latencyMs,
      // "PostgreSQL 16.4 on x86_64-pc-linux-musl, compiled by ...": keep the first two tokens.
      serverVersion: version.split(" ").slice(0, 2).join(" "),
      applied: appliedNames.size,
      pending,
    };
  })();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<DbProbe>((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, reason: `timeout ${timeoutMs}ms` }), timeoutMs);
    timer.unref?.();
  });
  try {
    return await Promise.race([work, timeout]);
  } catch (e) {
    return { ok: false, reason: describeProbeError(e) };
  } finally {
    clearTimeout(timer);
  }
}


/** Banner value for the round trip: `✓ 12ms` or `✗ FAILED (reason)`, ANSI-colored. */
export function pingLine(probe: DbProbe): string {
  return probe.ok ? c("green", `✓ ${probe.latencyMs}ms`) : c("red", `✗ FAILED (${probe.reason})`);
}

/** Banner value for the server version, e.g. `PostgreSQL 16.4`. */
export function serverLine(probe: DbProbe): string {
  return probe.ok ? probe.serverVersion : c("dim", "-");
}

/** Banner value for the migration state. */
export function migrationsLine(probe: DbProbe): string {
  if (!probe.ok) return c("dim", "(DB 응답 없음)");
  if (probe.pending === null) return c("yellow", `⚠ 확인 불가 — prisma/migrations 없음 (${probe.applied} applied)`);
  if (probe.pending.length === 0) return c("green", `✓ up to date (${probe.applied} applied)`);
  return c("red", `✗ ${probe.pending.length} PENDING: ${probe.pending.join(", ")}`);
}

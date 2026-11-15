import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  describeProbeError,
  listMigrationDirs,
  migrationsLine,
  pingLine,
  probeDatabase,
  serverLine,
  type DbProbe,
  type ProbeClient,
} from "@withwiz/toolkit/prisma/probe";
import * as probeModule from "@withwiz/toolkit/prisma/probe";

// eslint-disable-next-line no-control-regex
const strip = (s: string) => s.replace(/\x1B\[[0-9;]*m/g, "");

function stub(opts: { version?: string; applied?: string[] | Error; fail?: unknown; delayMs?: number }): ProbeClient {
  return {
    async $queryRawUnsafe<T>(query: string): Promise<T> {
      if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
      if (query.startsWith("SELECT version()")) {
        if (opts.fail) throw opts.fail;
        return [{ version: opts.version ?? "PostgreSQL 16.4 on x86_64-pc-linux-musl, compiled by gcc" }] as T;
      }
      if (opts.applied instanceof Error) throw opts.applied;
      return (opts.applied ?? []).map((migration_name) => ({ migration_name })) as T;
    },
  };
}

describe("listMigrationDirs", () => {
  let root: string | undefined;
  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = undefined;
  });

  it("returns sorted directory names and ignores files", async () => {
    root = mkdtempSync(path.join(tmpdir(), "withwiz-prisma-"));
    const dir = path.join(root, "prisma", "migrations");
    mkdirSync(path.join(dir, "m2_b"), { recursive: true });
    mkdirSync(path.join(dir, "m1_a"));
    writeFileSync(path.join(dir, "migration_lock.toml"), "");
    expect(await listMigrationDirs(root)).toEqual(["m1_a", "m2_b"]);
  });

  it("accepts a custom migrations directory", async () => {
    root = mkdtempSync(path.join(tmpdir(), "withwiz-prisma-"));
    mkdirSync(path.join(root, "db", "mig", "x1"), { recursive: true });
    expect(await listMigrationDirs(root, "db/mig")).toEqual(["x1"]);
  });

  it("returns null when the directory is missing", async () => {
    expect(await listMigrationDirs(path.join(tmpdir(), "withwiz-prisma-does-not-exist"))).toBeNull();
  });
});

describe("describeProbeError", () => {
  it("prefers a string code", () => {
    expect(describeProbeError(Object.assign(new Error("Invalid invocation:\n"), { code: "ECONNREFUSED" }))).toBe("ECONNREFUSED");
  });
  it("folds a multi-line message", () => {
    expect(describeProbeError(new Error("line one\n\n  line two  "))).toBe("line one line two");
  });
  it("handles non-errors", () => {
    expect(describeProbeError("plain")).toBe("plain");
    expect(describeProbeError(null)).toBe("null");
  });
});

describe("probeDatabase", () => {
  it("reports version, applied count and pending names", async () => {
    const probe = await probeDatabase(stub({ applied: ["m1", "m2"] }), ["m1", "m2", "m3"]);
    expect(probe).toMatchObject({ ok: true, serverVersion: "PostgreSQL 16.4", applied: 2, pending: ["m3"] });
  });

  it("treats a missing _prisma_migrations table as 0 applied", async () => {
    const probe = await probeDatabase(stub({ applied: new Error("relation does not exist") }), ["m1"]);
    expect(probe).toMatchObject({ ok: true, applied: 0, pending: ["m1"] });
  });

  it("keeps pending null when the directory was not readable", async () => {
    const probe = await probeDatabase(stub({ applied: ["m1"] }), null);
    expect(probe).toMatchObject({ ok: true, applied: 1, pending: null });
  });

  it("returns the error code on connection failure", async () => {
    const probe = await probeDatabase(stub({ fail: Object.assign(new Error(""), { code: "ECONNREFUSED" }) }), []);
    expect(probe).toEqual({ ok: false, reason: "ECONNREFUSED" });
  });

  it("gives up after the timeout", async () => {
    const probe = await probeDatabase(stub({ delayMs: 200 }), [], 20);
    expect(probe).toEqual({ ok: false, reason: "timeout 20ms" });
  });
});

describe("banner lines", () => {
  const ok = (pending: string[] | null, applied = 3): DbProbe => ({
    ok: true,
    latencyMs: 12,
    serverVersion: "PostgreSQL 16.4",
    applied,
    pending,
  });
  const failed: DbProbe = { ok: false, reason: "ECONNREFUSED" };

  it("pingLine", () => {
    expect(strip(pingLine(ok([])))).toBe("✓ 12ms");
    expect(strip(pingLine(failed))).toBe("✗ FAILED (ECONNREFUSED)");
    expect(pingLine(ok([]))).toBe("\x1B[32m✓ 12ms\x1B[0m");
  });

  it("serverLine", () => {
    expect(serverLine(ok([]))).toBe("PostgreSQL 16.4");
    expect(strip(serverLine(failed))).toBe("-");
  });

  it("migrationsLine defaults to en", () => {
    expect(strip(migrationsLine(failed))).toBe("(no DB response)");
    expect(strip(migrationsLine(ok(null)))).toBe("⚠ unknown — prisma/migrations not found (3 applied)");
    expect(strip(migrationsLine(ok([])))).toBe("✓ up to date (3 applied)");
    expect(strip(migrationsLine(ok(["a", "b"])))).toBe("✗ 2 PENDING: a, b");
    expect(migrationsLine(failed, { locale: "en" })).toBe(migrationsLine(failed));
    expect(migrationsLine(ok(null), { locale: "en" })).toBe(migrationsLine(ok(null)));
  });

  it("migrationsLine with locale ko matches the original galpi output byte for byte", () => {
    expect(migrationsLine(failed, { locale: "ko" })).toBe("\x1B[2m(DB 응답 없음)\x1B[0m");
    expect(migrationsLine(ok(null), { locale: "ko" })).toBe(
      "\x1B[33m⚠ 확인 불가 — prisma/migrations 없음 (3 applied)\x1B[0m",
    );
    expect(migrationsLine(ok([]), { locale: "ko" })).toBe("\x1B[32m✓ up to date (3 applied)\x1B[0m");
    expect(migrationsLine(ok(["a", "b"]), { locale: "ko" })).toBe("\x1B[31m✗ 2 PENDING: a, b\x1B[0m");
  });

  it("migrationsLine with locale en keeps the same colors", () => {
    expect(migrationsLine(failed, { locale: "en" })).toBe("\x1B[2m(no DB response)\x1B[0m");
    expect(migrationsLine(ok(null), { locale: "en" })).toBe(
      "\x1B[33m⚠ unknown — prisma/migrations not found (3 applied)\x1B[0m",
    );
  });
});

describe("public API", () => {
  it("exports the probe helpers", () => {
    expect(Object.keys(probeModule).sort()).toEqual(
      ["PROBE_TIMEOUT_MS", "describeProbeError", "listMigrationDirs", "migrationsLine", "pingLine", "probeDatabase", "serverLine"].sort(),
    );
  });
});

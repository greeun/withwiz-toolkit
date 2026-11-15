import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  attachPrismaLogging,
  prismaLogDefinitions,
  resolvePrismaLogConfig,
  type PrismaLogger,
} from "@withwiz/toolkit/prisma/log";
import * as logModule from "@withwiz/toolkit/prisma/log";
import { logger as toolkitLogger } from "@withwiz/toolkit/core/logger/logger";

// Ported from galpi tests/unit/logging-config.test.ts (resolvePrismaLogConfig block).
describe("resolvePrismaLogConfig", () => {
  it("defaults to warn,error with slow query detection only in development", () => {
    expect(resolvePrismaLogConfig({}).levels).toEqual(["warn", "error"]);
    expect(resolvePrismaLogConfig({}).queryEvent).toBe(false);
    expect(resolvePrismaLogConfig({ NODE_ENV: "development" }).queryEvent).toBe(true);
  });

  it("drops unknown levels and falls back on an invalid threshold", () => {
    const cfg = resolvePrismaLogConfig({ PRISMA_LOG_LEVEL: "query, bogus ,error", PRISMA_SLOW_QUERY_MS: "abc" });
    expect(cfg.levels).toEqual(["query", "error"]);
    expect(cfg.slowQueryMs).toBe(100);
  });

  it("emits every enabled level as an event", () => {
    const defs = prismaLogDefinitions(resolvePrismaLogConfig({ PRISMA_LOG_LEVEL: "error", PRISMA_LOG_QUERY_EVENT: "true" }));
    expect(defs).toEqual([
      { emit: "event", level: "error" },
      { emit: "event", level: "query" },
    ]);
  });

  it("reads file options and an explicit query-event opt-out", () => {
    const cfg = resolvePrismaLogConfig({
      NODE_ENV: "development",
      PRISMA_LOG_QUERY_EVENT: "false",
      PRISMA_LOG_TO_FILE: " TRUE ",
      PRISMA_LOG_FILE: " /var/log/p.log ",
      PRISMA_SLOW_QUERY_MS: "250",
    });
    expect(cfg).toEqual({ levels: ["warn", "error"], queryEvent: false, slowQueryMs: 250, toFile: true, file: "/var/log/p.log" });
  });
});

type Handler = (e: unknown) => void;
function fakeClient() {
  const handlers = new Map<string, Handler>();
  return {
    handlers,
    $on(event: string, cb: Handler) {
      handlers.set(event, cb);
    },
  };
}
function fakeLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } satisfies PrismaLogger;
}

describe("attachPrismaLogging", () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it("subscribes only to enabled events", () => {
    const client = fakeClient();
    attachPrismaLogging(client, { env: {}, logger: fakeLogger() });
    expect([...client.handlers.keys()].sort()).toEqual(["error", "warn"]);
  });

  it("reports only slow queries when the query level is off", () => {
    const client = fakeClient();
    const logger = fakeLogger();
    attachPrismaLogging(client, { config: resolvePrismaLogConfig({ PRISMA_LOG_QUERY_EVENT: "true" }), logger });
    const onQuery = client.handlers.get("query")!;
    onQuery({ query: "SELECT 1", params: "[]", duration: 5 });
    expect(logger.debug).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    onQuery({ query: "SELECT 2", params: "[]", duration: 101 });
    expect(logger.warn).toHaveBeenCalledWith("[Prisma] Slow query (101ms)", { query: "SELECT 2", duration: 101 });
  });

  it("logs every query at debug when the query level is on, and truncates slow ones", () => {
    const client = fakeClient();
    const logger = fakeLogger();
    attachPrismaLogging(client, { env: { PRISMA_LOG_LEVEL: "query" }, logger });
    const onQuery = client.handlers.get("query")!;
    onQuery({ query: "SELECT 1", params: "[1]", duration: 3 });
    expect(logger.debug).toHaveBeenCalledWith("[Prisma] Query (3ms)", { query: "SELECT 1", params: "[1]", duration: 3 });
    onQuery({ query: "x".repeat(800), params: "[]", duration: 500 });
    expect((logger.warn.mock.calls[0]![1] as { query: string }).query).toHaveLength(500);
  });

  it("forwards message events to the matching logger method with target", () => {
    const client = fakeClient();
    const logger = fakeLogger();
    attachPrismaLogging(client, { env: { PRISMA_LOG_LEVEL: "info,warn,error" }, logger });
    client.handlers.get("info")!({ message: "hello", target: "quaint" });
    client.handlers.get("error")!({ message: "boom" });
    expect(logger.info).toHaveBeenCalledWith("[Prisma] hello", { target: "quaint" });
    expect(logger.error).toHaveBeenCalledWith("[Prisma] boom", undefined);
  });

  it("defaults to the toolkit logger", () => {
    const spy = vi.spyOn(toolkitLogger, "error").mockImplementation(() => toolkitLogger);
    const client = fakeClient();
    attachPrismaLogging(client, { env: {} });
    client.handlers.get("error")!({ message: "boom" });
    expect(spy).toHaveBeenCalledWith("[Prisma] boom", undefined);
    spy.mockRestore();
  });

  it("appends to the log file when enabled", async () => {
    dir = mkdtempSync(path.join(tmpdir(), "withwiz-prisma-"));
    const file = path.join(dir, "nested", "prisma.log");
    const client = fakeClient();
    attachPrismaLogging(client, { env: { PRISMA_LOG_TO_FILE: "true", PRISMA_LOG_FILE: file }, logger: fakeLogger() });
    client.handlers.get("warn")!({ message: "careful" });
    await vi.waitFor(() => expect(readFileSync(file, "utf8")).toMatch(/Z \[WARN\] careful\n$/));
  });
});

describe("public API", () => {
  it("exports only the log helpers", () => {
    expect(Object.keys(logModule).sort()).toEqual(["attachPrismaLogging", "prismaLogDefinitions", "resolvePrismaLogConfig"]);
  });
});

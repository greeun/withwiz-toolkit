/**
 * Routes Prisma log events to a logger (default: the toolkit logger).
 *
 * Usage (where the PrismaClient is created):
 *   import { attachPrismaLogging, prismaLogDefinitions, resolvePrismaLogConfig } from '@withwiz/toolkit/prisma/log';
 *
 *   const config = resolvePrismaLogConfig(process.env);
 *   const client = new PrismaClient({ adapter, log: prismaLogDefinitions(config) });
 *   attachPrismaLogging(client, { config });
 *
 * Does not import `@prisma/client`: the client is typed structurally (`$on` only).
 *
 * Environment variables (all optional):
 *   PRISMA_LOG_LEVEL        comma list of query,info,warn,error      (default: warn,error)
 *                           `query` logs every query at debug level.
 *   PRISMA_LOG_QUERY_EVENT  true → subscribe to query events for slow-query reports even when
 *                           PRISMA_LOG_LEVEL has no `query` (default: true in development)
 *   PRISMA_SLOW_QUERY_MS    slow-query threshold in ms                (default: 100)
 *   PRISMA_LOG_TO_FILE      true → also append Prisma logs to PRISMA_LOG_FILE (default: false)
 *   PRISMA_LOG_FILE         log file path                             (default: ./logs/prisma.log)
 *
 * Server only (uses node:fs). Do not import from browser or edge code.
 */
import fs from "node:fs";
import path from "node:path";
import { logger as toolkitLogger } from "@withwiz/toolkit/core/logger/logger";

/** Environment map. `process.env` satisfies it. */
export type EnvLike = Record<string, string | undefined>;

/**
 * Structural logger. Any logger with these four methods works
 * (the toolkit logger, pino, winston, `console`, ...).
 */
export interface PrismaLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export type PrismaLogLevel = "query" | "info" | "warn" | "error";
export type PrismaEventLogDefinition = { emit: "event"; level: PrismaLogLevel };

const VALID_LEVELS: readonly PrismaLogLevel[] = ["query", "info", "warn", "error"];

export interface PrismaLogConfig {
  levels: PrismaLogLevel[];
  queryEvent: boolean;
  slowQueryMs: number;
  toFile: boolean;
  file: string;
}

function readBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") return fallback;
  return value.trim().toLowerCase() === "true";
}

export function resolvePrismaLogConfig(env: EnvLike = process.env): PrismaLogConfig {
  const raw = env.PRISMA_LOG_LEVEL ?? "warn,error";
  const levels = raw
    .split(",")
    .map((l) => l.trim())
    .filter((l): l is PrismaLogLevel => (VALID_LEVELS as readonly string[]).includes(l));
  const slow = Number(env.PRISMA_SLOW_QUERY_MS);
  return {
    levels,
    queryEvent: readBool(env.PRISMA_LOG_QUERY_EVENT, env.NODE_ENV === "development"),
    slowQueryMs: Number.isFinite(slow) && slow > 0 ? slow : 100,
    toFile: readBool(env.PRISMA_LOG_TO_FILE, false),
    file: env.PRISMA_LOG_FILE?.trim() || "./logs/prisma.log",
  };
}

/** The `log` option of `new PrismaClient()`. Every level is emitted as an event. */
export function prismaLogDefinitions(config: PrismaLogConfig = resolvePrismaLogConfig()): PrismaEventLogDefinition[] {
  const levels = new Set<PrismaLogLevel>(config.levels);
  if (config.queryEvent) levels.add("query");
  return [...levels].map((level) => ({ emit: "event", level }));
}

const preparedDirs = new Set<string>();
function appendToFile(file: string, line: string): void {
  try {
    const dir = path.dirname(file);
    if (!preparedDirs.has(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      preparedDirs.add(dir);
    }
    fs.appendFile(file, `${new Date().toISOString()} ${line}\n`, () => {});
  } catch {
    // Best effort: the logger already received the entry.
  }
}

export type PrismaQueryEvent = { query: string; params: string; duration: number; target?: string };
export type PrismaMessageEvent = { message: string; target?: string };

/**
 * The part of PrismaClient this module touches. Typed loosely on purpose so that a generated
 * client (whose `$on` is generic over its configured log levels) is assignable without casts.
 */
export interface PrismaEventClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $on(event: any, callback: (event: any) => void): void;
}

export interface AttachPrismaLoggingOptions {
  /** Defaults to `resolvePrismaLogConfig(env)`. Pass the same object given to `prismaLogDefinitions`. */
  config?: PrismaLogConfig;
  /** Used only when `config` is omitted. Defaults to `process.env`. */
  env?: EnvLike;
  /** Defaults to the toolkit logger (`@withwiz/toolkit/core/logger/logger`). */
  logger?: PrismaLogger;
}

/** Subscribes to the events enabled by `prismaLogDefinitions()`. */
export function attachPrismaLogging(client: PrismaEventClient, options: AttachPrismaLoggingOptions = {}): void {
  const config = options.config ?? resolvePrismaLogConfig(options.env ?? process.env);
  const logger: PrismaLogger = options.logger ?? toolkitLogger;
  const write = (line: string) => {
    if (config.toFile) appendToFile(config.file, line);
  };
  const logAllQueries = config.levels.includes("query");

  if (logAllQueries || config.queryEvent) {
    client.$on("query", (e: PrismaQueryEvent) => {
      const { query, params, duration } = e;
      const slow = duration > config.slowQueryMs;
      if (slow) {
        logger.warn(`[Prisma] Slow query (${duration}ms)`, { query: query.slice(0, 500), duration });
        write(`[SLOW:${duration}ms] ${query} | Params: ${params}`);
      } else if (logAllQueries) {
        logger.debug(`[Prisma] Query (${duration}ms)`, { query, params, duration });
        write(`[${duration}ms] ${query} | Params: ${params}`);
      }
    });
  }
  for (const level of ["info", "warn", "error"] as const) {
    if (!config.levels.includes(level)) continue;
    client.$on(level, (e: PrismaMessageEvent) => {
      const { message, target } = e;
      logger[level](`[Prisma] ${message}`, target ? { target } : undefined);
      write(`[${level.toUpperCase()}] ${message}`);
    });
  }
}

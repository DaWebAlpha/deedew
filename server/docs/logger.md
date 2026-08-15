# `src/logger/pino.logger.js` — Structured Logging

## What problem this solves

`console.log` is fine for a tutorial script, but it doesn't scale: everything goes to one place, nothing is structured (searchable/filterable), nothing is automatically saved to disk, and there's no way to accidentally-proof it against leaking a password into a log file. This file replaces every `console.log`/`console.error` in the app with **pino** — a fast, structured (JSON-based) logging library — configured into three separate, purpose-specific loggers.

```js
import pino from "pino";
import path from "node:path";
import fs from "node:fs";
import { config } from "../config/index.js";

const isDevelopment = config.nodeEnv === "development";
const logLevel = isDevelopment ? "debug" : "info";

const logDirectory = path.resolve(config.logDirectory);

if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory, { recursive: true });
}

const buildTransportTarget = (fileLocation, frequency, fileSize, minLevel = "info", retentionCount) => ({
    target: "pino-roll",
    level: minLevel,
    options: {
        file: path.join(logDirectory, fileLocation),
        extension: ".json",
        frequency,
        size: fileSize,
        mkdir: true,
        dateFormat: "yyyy-MM-dd",
        sync: false,
        limit: { count: retentionCount },
    },
});

const terminalTargets = isDevelopment
    ? [{ target: "pino-pretty", options: { colorize: true, ignore: "pid,hostname", translateTime: "SYS:yyyy-MM-dd HH:mm:ss" } }]
    : [];

const systemTransport = pino.transport({
    targets: [
        buildTransportTarget("system/app-info", "daily", "20m", "info", 90),
        buildTransportTarget("system/app-error", "daily", "20m", "error", 90),
        ...terminalTargets,
    ],
});

const auditTransport = pino.transport({
    targets: [buildTransportTarget("audit/app-audit", "daily", "20m", "info", 180), ...terminalTargets],
});

const accessTransport = pino.transport({
    targets: [buildTransportTarget("access/app-access", "daily", "20m", "info", 180), ...terminalTargets],
});

const getBaseConfig = () => ({
    level: logLevel,
    timestamp: pino.stdTimeFunctions.isoTime,
    base: { service: "superdeedew-api", environment: config.nodeEnv },
    redact: {
        paths: [
            "password", "*.password", "token", "*.token", "access_token", "refresh_token",
            "*.access_token", "*.refresh_token", "accessToken", "*.accessToken",
            "refreshToken", "*.refreshToken", "apiKey", "*.apiKey", "authorization",
            "*.authorization", "headers.authorization", "*.headers.authorization",
            "cookie", "*.cookie", "headers.cookie", "*.headers.cookie",
            "req.headers.authorization", "req.headers.cookie",
        ],
        remove: true,
    },
    mixin(_context, levelNumber) {
        const labels = { 10: "trace", 20: "debug", 30: "info", 40: "warn", 50: "error", 60: "fatal" };
        return { level_label: labels[levelNumber] || "info" };
    },
});

export const systemLogger = pino(getBaseConfig(), systemTransport);
export const auditLogger = pino(getBaseConfig(), auditTransport);
export const accessLogger = pino(getBaseConfig(), accessTransport);

export const loggers = { systemLogger, auditLogger, accessLogger };
```

## Line by line

- `isDevelopment` / `logLevel` — in development, log everything down to `"debug"` level (verbose); in production, only `"info"` and above (skip debug noise). Pino's levels, from least to most severe, are: `trace` (10) < `debug` (20) < `info` (30) < `warn` (40) < `error` (50) < `fatal` (60) — setting `level: "info"` means anything *below* info (like a `trace`/`debug` call) is silently skipped, cheaply, without even formatting the message.
- `logDirectory` / the `fs.existsSync`/`mkdirSync` check — resolves the configured log folder (from `config.logDirectory`, see `docs/config.md`) to an absolute path, and creates it if it doesn't exist yet — so the very first time this app runs on a fresh machine, it doesn't crash trying to write a log file into a folder that was never created.
- **`buildTransportTarget(...)` — a factory for one log *destination*.** In pino, a "transport" is *where* logs actually get written, and you can have multiple at once. This function builds one target using **`pino-roll`** — a pino plugin that writes to a file that automatically "rolls over" to a new one, so log files don't grow forever. `frequency: "daily"` rolls to a new file once a day; `size: "20m"` also rolls early if a single day's file passes 20 megabytes, whichever comes first. `limit: { count: retentionCount }` caps how many old rolled files are kept before pino-roll starts deleting the oldest ones — a real, automatic retention policy, not "log everything forever."
- **`terminalTargets`** — in development *only*, an extra target using **`pino-pretty`**, which reformats pino's normal raw JSON output into the colorized, human-readable lines you actually see in the terminal while running `npm run dev`. In production this array is empty — production logs are pure JSON, meant to be read by log-aggregation tooling, not a human's terminal.
- **Three separate `pino.transport({...})` calls, each combining a file target with (in dev) the same terminal target** — `systemTransport`, `auditTransport`, `accessTransport`. Each writes to its *own* subfolder (`system/`, `audit/`, `access/`) and has its own retention: system logs (regular app info/errors) are kept 90 days; audit and access logs are kept longer, 180 days — a deliberate choice, since an audit trail (see `docs/models.md`'s `LoginLog` section) or access record might matter for a security review or dispute months after the fact, longer than a routine debug log would need to be kept.
- `systemTransport` specifically has **two** file targets, not one: one capturing `info`-level-and-up (`app-info`), and a *second* capturing only `error`-level-and-up (`app-error`) — so a genuine error is never buried in a huge volume of routine info logs; anyone debugging a production incident can open just the error file.
- **`getBaseConfig()`** — settings shared by all three loggers, called fresh for each one (a function, not a shared object, so nothing about one logger's config is accidentally the *same object reference* as another's):
  - `timestamp: pino.stdTimeFunctions.isoTime` — stamps every log line with a standard ISO 8601 timestamp (e.g. `2026-08-15T09:12:03.000Z`), rather than pino's default (a raw millisecond epoch number, less immediately readable).
  - `base: { service, environment }` — a small object merged into *every single log line* from every logger. This matters the moment logs from multiple services or environments ever get aggregated together somewhere (a log-viewing dashboard, say) — without this, a log line has no built-in way of saying which app or environment it even came from.
  - **`redact`** — the most important block in this file, security-wise. `paths` lists specific property paths pino should scrub *before a log line is ever written anywhere* — not just the top-level `password` field, but also `*.password` (a wildcard — "a `password` field nested one level inside any object"), request headers that commonly carry secrets (`authorization`, `cookie`), and more. `remove: true` means pino **deletes** the matching key entirely rather than replacing it with a placeholder like `"[Redacted]"` — so `systemLogger.info({ password: "hunter2" }, "debug")` produces a log line with no `password` key at all, not one that visibly announces a password was hidden. This is the exact same defense-in-depth idea as `SENSITIVE_FIELDS` in `models/base/mongoose.schema.options.js` (see `docs/constants.md`), applied to logs instead of API responses.
  - `mixin(_context, levelNumber)` — pino calls this function on *every* log call, letting it inject extra fields dynamically. Here, it converts the raw numeric level (`30`) into a readable label (`"info"`) and adds it as `level_label` on every line — useful for filtering log files by level without having to remember pino's numeric scale.
- `export const systemLogger = pino(getBaseConfig(), systemTransport);` — this is where a logger actually gets created: pino's own function, given a config object and a transport. Same pattern for `auditLogger`/`accessLogger`, each with their own transport but otherwise-identical base config.
- `export const loggers = { systemLogger, auditLogger, accessLogger };` — a convenience bundle grouping all three under one object, for any code that might want to reference "all the loggers" generically (not currently used anywhere in this app, but available).

## Used in this project

**`systemLogger`** is by far the most widely used — every catch block that logs an unexpected error, `config/database.js`'s connection event listeners, `utils/gracefulShutdown.js`'s entire shutdown sequence, and `middleware/errorHandler.middleware.js` (every single request failure, operational or not, gets logged here — see `docs/middleware.md`) all call it.

**`auditLogger`** is called specifically at the moment of a security-relevant *action* completing — `"User registered"`, `"User logged in"`, `"User banned"`, `"User role changed"`, and so on, throughout `services/`. The calling convention used everywhere is the same two-argument shape: `auditLogger.info({ userId, ...otherContext }, "Human-readable message")` — the first argument is structured data (searchable/filterable later), the second is the actual log line text.

**`accessLogger`** — defined and exported, but not currently called anywhere in the app yet (no HTTP access-logging middleware has been built). It's ready for the moment one is — e.g. a middleware that logs every incoming request's method/path/status/duration.

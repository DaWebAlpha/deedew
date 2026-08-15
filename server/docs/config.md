# `src/config/` — Environment Configuration & Database Connection

## Index

- [`index.js`](#indexjs) — `config`
- [`database.js`](#databasejs) — `connectDatabase`

---

## `index.js`

```js
import dotenv from "dotenv";

dotenv.config();

const {
    PORT, MONGO_URI, FRONTEND_URL, NODE_ENV, LOG_DIRECTORY,
    JWT_ACCESS_EXPIRY_SECONDS, JWT_ACCESS_SECRET, JWT_REFRESH_EXPIRY_DAYS,
    ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE,
} = process.env;

const requiredEnvVars = [
    "MONGO_URI",
    "FRONTEND_URL",
    "JWT_ACCESS_SECRET",
];

for(const key of requiredEnvVars){
    if(!process.env[key]){
        throw new Error(`Missing required env: ${key}`)
    }
}

const toNumber = (value, fallback) => {
    if(!value){
        return fallback
    }

    const validNumber = Number(value);

    return Number.isFinite(validNumber) &&
           validNumber > 0 ?
           validNumber : fallback;
}

const allowedNodeEnvs = ["development", "test", "production"];
const resolvedNodeEnv = allowedNodeEnvs.includes(NODE_ENV) ?
                        NODE_ENV :
                        "development";

const config = Object.freeze({
    mongoUri: MONGO_URI,
    port: toNumber(PORT, 5700),
    frontendUrl: FRONTEND_URL,
    logDirectory: LOG_DIRECTORY || "logs",
    nodeEnv: resolvedNodeEnv,
    jwtAccessExpirySeconds: toNumber(JWT_ACCESS_EXPIRY_SECONDS, 900),
    jwtAccessSecret: JWT_ACCESS_SECRET,
    jwtRefreshExpiryDays: toNumber(JWT_REFRESH_EXPIRY_DAYS, 30),
    accessTokenCookie: ACCESS_TOKEN_COOKIE || "accessToken",
    refreshTokenCookie: REFRESH_TOKEN_COOKIE || "refreshToken",
})

export { config };
```

### What problem this solves

`.env` holds every secret and environment-specific setting (database credentials, JWT secret, port number) — this file is the *only* place in the entire codebase allowed to read `process.env` directly. Every other file that needs a setting imports `config` from here instead. That single rule means: no secret value is ever hardcoded anywhere else, changing an environment (dev → production) never requires touching application code, and a missing required setting is caught once, loudly, at startup — not discovered later as a mysterious runtime failure.

### Line by line

- `import dotenv from "dotenv"; dotenv.config();` — `dotenv` is a small library that reads a `.env` file (a plain text file, `KEY=value` per line) sitting in the project and copies its contents into Node's own `process.env` object, which is otherwise how environment variables are normally set (e.g. by the operating system, or a hosting platform). Without calling `dotenv.config()`, the `.env` file would just sit there unread — this line is what actually loads it.
- `const { PORT, MONGO_URI, ... } = process.env;` — **destructuring** every relevant variable out of `process.env` into its own local constant. Important detail: *everything* on `process.env` is always a plain string, even something that looks like a number (`PORT` is the string `"5700"`, not the number `5700`) — that's exactly why `toNumber` exists below.
- **The fail-fast block:**
  ```js
  const requiredEnvVars = ["MONGO_URI", "FRONTEND_URL", "JWT_ACCESS_SECRET"];
  for(const key of requiredEnvVars){
      if(!process.env[key]){
          throw new Error(`Missing required env: ${key}`)
      }
  }
  ```
  This runs the moment this file is first imported — which happens right at the very start of the app's startup sequence. If any of these three genuinely required settings is missing from `.env`, the whole app refuses to start at all, with a clear message naming exactly which one is missing. This is a deliberate design choice called **failing fast**: compare this to the alternative of *not* checking — the app would start up looking perfectly healthy, and only fail later, confusingly, the first time some unrelated request happened to need that missing value (e.g. the first login attempt failing with a cryptic JWT-signing error because `JWT_ACCESS_SECRET` was `undefined`).
- **`toNumber(value, fallback)`** — converts a raw (string) env var into an actual usable number, falling back to a sensible default if the value is missing or isn't a valid positive number. `Number(value)` attempts the conversion (`Number("5700")` → `5700`, but `Number("abc")` → `NaN`). `Number.isFinite(validNumber) && validNumber > 0` rejects `NaN`, `Infinity`, zero, and negative numbers — all nonsensical for something like a port number or an expiry duration — falling back to `fallback` in any of those cases.
- **The `NODE_ENV` allowlist:**
  ```js
  const allowedNodeEnvs = ["development", "test", "production"];
  const resolvedNodeEnv = allowedNodeEnvs.includes(NODE_ENV) ? NODE_ENV : "development";
  ```
  Rather than trusting whatever string happens to be in `.env`, this checks it against a known list of three valid values. If `NODE_ENV` is missing, empty, or has a typo (like `"developmnet"`), this silently and safely falls back to `"development"` — rather than, say, `config.nodeEnv` ending up as a typo'd string that then fails to match `=== "production"` anywhere it's checked, in a way that's easy to miss.
- **`const config = Object.freeze({...})`** — the actual exported object. Every property here reads from one of the local constants above, most with a sensible fallback (`|| "logs"`, `|| "accessToken"`) baked in. `Object.freeze` (see `docs/constants.md` for the full explanation of what this does) means nothing anywhere in the app can accidentally mutate shared config at runtime.

### Used in this project

Imported as `import { config } from "../config/index.js";` (or the equivalent relative path) by nearly every part of the app that needs an environment-specific value:
- `config/database.js` — `config.mongoUri`.
- `utils/jwt.js` — `config.jwtAccessSecret`, `config.jwtAccessExpirySeconds`.
- `utils/refreshTokenUtils.js` — `config.jwtRefreshExpiryDays`.
- `utils/authCookies.js` — `config.nodeEnv` (to decide `secure: true/false`), `config.accessTokenCookie`, `config.jwtAccessExpirySeconds`, and more.
- `middleware/authenticate.middleware.js` — `config.accessTokenCookie`, to know which cookie name to read off an incoming request.
- `app.js` — `config.frontendUrl`, to configure which origins CORS allows.
- `logger/pino.logger.js` — `config.nodeEnv` (to decide whether to enable pretty-printed console logs) and `config.logDirectory`.
- `server.js` — `config.port`.

---

## `database.js`

```js
import mongoose from "mongoose";
import { config } from "./index.js";
import { OPTIONS } from "../constants/index.js";
import { systemLogger } from "../logger/pino.logger.js";

const connectDatabase = async() => {
    await mongoose.connect(config.mongoUri, OPTIONS);
}

mongoose.connection.on("connected", () => {
    systemLogger.info("MongoDB connection established");
})

mongoose.connection.on("error", (error) => {
    systemLogger.error({ err: error }, "MongoDB connection error");
})

export { connectDatabase };
```

### Line by line

- **`connectDatabase()`** — a small `async` function whose entire job is `await mongoose.connect(config.mongoUri, OPTIONS)`: open the actual connection to MongoDB, using the connection string from `config` and the pool/timeout settings from `constants/mongoose.options.js` (see `docs/constants.md`).
- **The two `mongoose.connection.on(...)` listeners** — registered at the *top level* of this module, meaning they run once, the moment this file is first imported — **before** `connectDatabase()` is ever actually called. This ordering matters: `mongoose.connection` is one single, shared connection object for the app's entire lifetime, and it emits events not just once at startup but any time its state changes — including hours later, if the connection unexpectedly drops (a network blip, the database restarting) and later reconnects. Registering the listeners up front, independent of the initial connection attempt, means *every* one of those events gets logged, not just the very first one.
  - `"connected"` — fires every time a connection is successfully established (including a reconnect after a drop).
  - `"error"` — fires on a connection-level error; logged via `systemLogger.error` with the full error object attached (`{ err: error }`), so the real cause is visible in the logs even though nothing about connection failures is ever shown to an API client.

### Used in this project

`connectDatabase` is called exactly once, in `src/server.js`:
```js
const startServer = async () => {
    await connectDatabase();
    const server = app.listen(config.port, () => {...});
    gracefulShutdown(server);
}
```
Notice the order: the app waits for the database connection to succeed *before* it starts accepting HTTP traffic at all (`app.listen(...)` doesn't run until after `connectDatabase()` resolves). If the database is unreachable, the server never opens its port — a server that "looks" up but can't actually serve any request that touches the database would be worse than one that simply doesn't start.

**A real quirk worth knowing about:** this is also *why* a MongoDB connection failure during the very first startup shows up in the terminal as a raw, unformatted Node.js crash dump instead of a clean, pino-logged error line. `gracefulShutdown(server)` — which is what wires up clean handling of unexpected crashes — is only reached *after* `connectDatabase()` succeeds. If the very first connection attempt itself fails, that safety net isn't registered yet. Once the server is actually running, though, this same class of error (MongoDB dropping the connection later, mid-flight) *is* caught and logged cleanly, because by then `gracefulShutdown`'s handlers are already active. See `docs/utils.md`'s `gracefulShutdown.js` section for the full explanation.

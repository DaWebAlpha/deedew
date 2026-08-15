# `src/app.js` & `src/server.js` — The Composition Root

These are the two files that don't belong to any single folder — they're where every other piece documented elsewhere (`docs/middleware.md`, `docs/routes.md`, `docs/config.md`, `docs/utils.md`) actually gets assembled into one running program. If you're trying to understand "what actually happens when this server starts," start here.

## `app.js`

```js
import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import cors from "cors";
import { notFound, errorHandler } from "./middleware/index.js";
import {
    authRouter, adminUsersRouter, adminLoginLogsRouter,
    adminSessionsRouter, adminSecurityRouter, adminPingsRouter,
} from "./routes/index.js";
import { config } from "./config/index.js";

const app = express();

const allowedOrigins = config.frontendUrl.split(",").map((url) => url.trim());

app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(cors({
    origin: allowedOrigins,
    credentials: true,
}));
app.use(cookieParser());

app.use("/api", authRouter);
app.use("/api/admin/users", adminUsersRouter);
app.use("/api/admin/login-logs", adminLoginLogsRouter);
app.use("/api/admin/sessions", adminSessionsRouter);
app.use("/api/admin/security", adminSecurityRouter);
app.use("/api/admin/pings", adminPingsRouter);

// Must be registered last: catches unmatched routes, then any error passed via next()/thrown.
app.use(notFound);
app.use(errorHandler);

export { app };
```

### What this file does, and why the order of every line matters

This file builds the Express application object and wires every global middleware and every router into it — but never starts listening for real network connections itself (that's `server.js`'s job, next section). Express middleware runs **top to bottom, in registration order**, for every request — which is why the order things appear in this file isn't cosmetic, it's the actual control flow.

- **`const app = express();`** — creates the application object everything else in this file attaches to.
- **`const allowedOrigins = config.frontendUrl.split(",").map((url) => url.trim());`** — `config.frontendUrl` (see `docs/config.md`) is a plain string from `.env`, potentially holding more than one allowed origin separated by commas (e.g. `"http://localhost:3000,https://myapp.com"`). `.split(",")` breaks it into an array; `.map((url) => url.trim())` removes any accidental whitespace around each one (e.g. if someone wrote `"a, b"` with a space after the comma). The result is the real array of origins CORS will actually check requests against.
- **`app.use(helmet());`** — registered *first*, before anything else touches the request. `helmet` is a well-known security-headers library — it adds a batch of protective HTTP response headers (like blocking the page from being embedded in a hostile iframe, disabling MIME-type sniffing) with sensible defaults, in one line. You can see its effect directly: every response from this API includes a `Content-Security-Policy` header and no longer advertises `X-Powered-By: Express` (a small information-leak helmet disables by default) — both visible in this project's own curl testing during development.
- **`app.use(express.json());` / `app.use(express.urlencoded({extended: true}));`** — Express's own built-in body-parsing middleware. Without these, `request.body` would always be `undefined`, no matter what a client sent — `express.json()` parses a JSON request body (what every controller in this app actually expects); `express.urlencoded({extended: true})` additionally handles traditional HTML form submissions (`application/x-www-form-urlencoded`), not currently exercised by this app's own testing but there for compatibility with any client that submits that way.
- **`app.use(cors({ origin: allowedOrigins, credentials: true }));`** — configures **CORS** (Cross-Origin Resource Sharing), the browser-enforced rule that stops a webpage on one domain from freely making authenticated requests to an API on a different domain. `origin: allowedOrigins` means only requests whose `Origin` header matches one of those configured URLs are allowed at all — not a wildcard `*`. **`credentials: true` is specifically required for this app's cookie-based auth to work in a real browser at all** — without it, even a request from an allowed origin would have its cookies stripped by the browser, since sending cookies cross-origin requires the server to explicitly opt in.
- **`app.use(cookieParser());`** — parses the raw `Cookie` header on incoming requests into the `request.cookies` object every controller/middleware in this app reads from (`request.cookies?.[config.accessTokenCookie]`, etc. — see `docs/middleware.md`'s `authenticate.middleware.js`). This has to run **before** `authenticate` or any route that reads a cookie — which it does, since it's registered before any router below.
- **The six `app.use("/api/...", someRouter)` lines** — this is where every router documented in `docs/routes.md` actually becomes reachable, each mounted at its own URL prefix. Mounting order among these six doesn't itself matter (their prefixes don't overlap/conflict the way a single router's internal route order can — see `docs/routes.md`'s explanation of that separate concern), but all six have to come *after* the body-parsing/cookie/CORS middleware above (a route can't read `request.body`/`request.cookies` if nothing has parsed them yet) and *before* the final two lines below.
- **`app.use(notFound); app.use(errorHandler);` — deliberately the very last two lines in the file.** See `docs/middleware.md` for what each does individually; the reason they're *last* is structural: Express only reaches middleware registered after everything that already handled (or failed to handle) the request. If either of these were registered earlier, they'd intercept requests that a real route further down was supposed to handle.

### Used in this project

`export { app };` — imported by exactly one file, `server.js`, which is the only thing that actually starts it listening.

---

## `server.js`

```js
import { app } from "./app.js";
import { config } from "./config/index.js";
import { connectDatabase } from "./config/database.js";
import { systemLogger } from "./logger/pino.logger.js";
import { gracefulShutdown } from "./utils/index.js";

const startServer = async () => {
    await connectDatabase();

    const server = app.listen(config.port, () => {
        systemLogger.info(`Listening on port: ${config.port}`);
    })

    gracefulShutdown(server);
}

startServer();
```

### What this file does — the entire startup sequence of the app, in four steps

This is the actual entry point (`package.json`'s `"main"` field points here, and it's what `npm run dev`/`node ./src/server.js` executes).

1. **`await connectDatabase();`** — opens the MongoDB connection first, and *waits* for it to succeed before doing anything else (see `docs/config.md`). If this fails, none of the following steps ever run — the app doesn't start listening for HTTP traffic at all rather than accepting requests it can't actually serve.
2. **`const server = app.listen(config.port, () => {...});`** — this is the line that actually opens a real network port and starts accepting connections. `app.listen(...)` returns a real Node.js `http.Server` object, captured here as `server` — that object is what step 4 needs. The callback fires once, exactly when the port is successfully opened, logging confirmation via `systemLogger` (not `console.log` — see `docs/logger.md`).
3. *(Implicit — every request from this point on flows through everything documented in `app.js` above, `docs/middleware.md`, and `docs/routes.md`.)*
4. **`gracefulShutdown(server);`** — wires up clean-shutdown handling (see `docs/utils.md`) for this specific running server instance. This line is only reached *after* both the database connection and the HTTP listener have successfully started — meaning a failure during either of the first two steps happens *before* this safety net exists yet, which is exactly why (as noted in both `docs/config.md` and `docs/utils.md`) a MongoDB connection failure during the very first startup shows up as a raw, unhandled Node.js crash dump in the terminal, while a connection drop *after* the server is already running is caught and logged cleanly.
5. **`startServer();`** — actually calls the function defined above. Note this call has no `.catch(...)` attached, and `startServer` is `async` — if `connectDatabase()` (or anything else inside it) throws before `gracefulShutdown`'s handlers are registered, that becomes an unhandled promise rejection, printed by Node's own default (unformatted) crash behavior — the same phenomenon described in `docs/config.md`.

### The complete picture

Put together with everything documented elsewhere in this `docs/` folder, this is the full chain a single incoming request travels, start to finish:

```
npm run dev
  → server.js: connectDatabase() succeeds, app.listen() opens the port, gracefulShutdown() arms
  → a request arrives
  → app.js: helmet → express.json/urlencoded → cors → cookieParser
  → app.js: routed into the matching router (routes/**/*.routes.js)
  → that router: authenticate (and, on admin routes, roleMiddleware) → the controller
  → the controller (controllers/**/*.controller.js): reads the request, calls...
  → ...the service (services/**/*.service.js): the real business logic, reading/writing...
  → ...the model (models/**/*.model.js): the actual MongoDB document
  → back up through the controller: response shaped and sent
  (or, at any point above: a throw → asyncHandler → errorHandler.middleware.js → a clean JSON error response)
```

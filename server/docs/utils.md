# `src/utils/` — Shared Utility Functions

This document explains every function in the `utils/` folder: what it does, how the code works line by line, and every place in the project that actually calls it (with real before/after examples). 

**How to read this doc:** each section shows the real source code for one file, then a plain-English walkthrough, then a "Used in this project" list showing every real call site with a concrete example of what goes in and what comes out.

## Index

- [`asyncHandler.js`](#asynchandlerjs) — `asyncHandler`
- [`authCookies.js`](#authcookiesjs) — `setAuthCookies`, `clearAuthCookies`
- [`fetchOrNotFound.js`](#fetchornotfoundjs) — `fetchOrNotFound`
- [`gracefulShutdown.js`](#gracefulshutdownjs) — `gracefulShutdown`
- [`jwt.js`](#jwtjs) — `generateAccessToken`, `verifyAccessToken`
- [`normalizer.js`](#normalizerjs) — `normalizeString`, `normalizeEmail`, `normalizeCountry`, `normalizeText`
- [`paginateQuery.js`](#paginatequeryjs) — `paginateQuery`
- [`password.argon2.js`](#passwordargon2js) — `hashPassword`, `verifyPassword`
- [`phone.js`](#phonejs) — `normalizePhoneNumber`
- [`refreshTokenUtils.js`](#refreshtokenutilsjs) — `generateRefreshToken`, `verifyRefreshToken`, `hashToken`
- [`request.js`](#requestjs) — `getClientIP`, `getUserAgent`, `getDeviceName`, `getDeviceId`
- [`withTransaction.js`](#withtransactionjs) — `withTransaction`, `isTransientTransactionError`
- [`index.js`](#indexjs) — the barrel file that re-exports everything above

---

## `asyncHandler.js`

```js
const asyncHandler = (fn) => (request, response, next) => {
    return Promise.resolve(fn(request, response, next)).catch(next);
}

export {
    asyncHandler,
};
```

### What problem this solves

Every controller in this app is `async` (it uses `await` to talk to the database). In plain Express, if an `async` function throws an error, Express does not automatically know what to do with it — the request can hang, or the error can crash the server, or (in Express 5) get handled inconsistently. `asyncHandler` is a small wrapper that guarantees any error thrown inside a controller gets forwarded to the app's central error handler (`errorHandler.middleware.js`), the same way a normal (non-async) Express error would be.

### Line by line

- `const asyncHandler = (fn) => ...` — `asyncHandler` is a function that takes **another function** (`fn`, your controller) and returns a **new** function. This pattern — a function that wraps another function and returns a new one — is called a **higher-order function**.
- `(request, response, next) => {...}` — the function `asyncHandler` returns has the exact same shape Express expects for a route handler: `(request, response, next)`. This is what actually gets registered on the route (e.g. `router.post("/login", asyncHandler(loginController))`).
- `Promise.resolve(fn(request, response, next))` — calls your real controller (`fn`) with the request/response/next. Wrapping the result in `Promise.resolve(...)` guarantees we always have a real Promise to work with, even in the rare case `fn` doesn't return one.
- `.catch(next)` — this is the whole trick. If the Promise from your controller **rejects** (meaning something inside it threw, e.g. `throw new BadRequestError(...)`), `.catch(next)` catches that rejection and calls Express's `next(error)` — which is exactly the standard way to hand an error to Express's error-handling middleware.

### Used in this project

Every single controller in the app is wrapped in `asyncHandler`. For example, in `controllers/auth/login.controller.js`:

```js
const loginUserController = asyncHandler(async (request, response) => {
    const { user, accessToken, refreshToken } = await loginUserService({...});
    // ...
});
```

If `loginUserService` throws (say, `UnauthenticatedError("Invalid credentials")`), that error is caught by `asyncHandler` and passed to `errorHandler.middleware.js`, which turns it into a clean JSON response like `{"success": false, "message": "Invalid credentials"}` — instead of the request hanging forever or the server crashing.

---

## `authCookies.js`

```js
import { config } from "../config/index.js";

const isProduction = config.nodeEnv === "production";
const ACCESS_TOKEN_COOKIE = config.accessTokenCookie;
const REFRESH_TOKEN_COOKIE = config.refreshTokenCookie;

const setAuthCookies = (response, { accessToken, refreshToken }) => {
    response.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        maxAge: config.jwtAccessExpirySeconds * 1000,
    });

    response.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        maxAge: config.jwtRefreshExpiryDays * 24 * 60 * 60 * 1000,
    });
};

const clearAuthCookies = (response) => {
    response.clearCookie(ACCESS_TOKEN_COOKIE);
    response.clearCookie(REFRESH_TOKEN_COOKIE);
};

export {
    setAuthCookies,
    clearAuthCookies,
    ACCESS_TOKEN_COOKIE,
    REFRESH_TOKEN_COOKIE
};
```

### What problem this solves

After a user logs in, the server needs to hand back two tokens — an access token and a refresh token (see `jwt.js` and `refreshTokenUtils.js` below). This file is the *one place* that decides how those tokens get sent to the browser: as **cookies**, with a specific set of safety settings. Every controller that needs to set or clear these cookies calls these two functions instead of writing `response.cookie(...)` by hand each time — so the safety settings can never drift between one controller and another.

### Line by line

- `const isProduction = config.nodeEnv === "production";` — reads once, at file-load time, whether the app is running in production. Used below to decide whether cookies require HTTPS.
- `const ACCESS_TOKEN_COOKIE = config.accessTokenCookie;` — the *name* of the cookie (e.g. the string `"accessToken"`), read from config so it's configurable via `.env` rather than hardcoded everywhere.
- **`setAuthCookies(response, { accessToken, refreshToken })`**
  - `response.cookie(NAME, value, options)` — this is Express's built-in method for adding a `Set-Cookie` header to the response.
  - `httpOnly: true` — tells the browser "JavaScript running on the page can never read this cookie." This is a real security feature: if the site ever had an XSS bug (malicious JavaScript injected into the page), that malicious script still couldn't steal the token, because `httpOnly` cookies are invisible to `document.cookie`.
  - `secure: isProduction` — in production, the cookie is only ever sent over HTTPS, never plain HTTP. In development, this is `false` so you can test on `http://localhost` without HTTPS.
  - `sameSite: "lax"` — a browser rule that mostly stops the cookie from being sent on requests that originate from *other* websites (a defense against a class of attack called CSRF). `"lax"` is a reasonable middle ground: it still allows the cookie on normal top-level navigation (clicking a link to your site) but blocks it on sneaky background requests from other sites.
  - `maxAge: config.jwtAccessExpirySeconds * 1000` — how long the cookie itself lives, in **milliseconds** (that's why it's multiplied by 1000 — `jwtAccessExpirySeconds` is in seconds). This is set to match the JWT's own expiry, so the cookie disappears from the browser at roughly the same time the token inside it would stop being valid anyway.
  - The refresh token cookie does the same thing, but with a much longer `maxAge` (`jwtRefreshExpiryDays * 24 * 60 * 60 * 1000` — days converted to milliseconds).
- **`clearAuthCookies(response)`** — calls `response.clearCookie(name)` for both cookies. Under the hood, this tells the browser to overwrite the cookie with an already-expired one, which makes the browser delete it immediately. Used on logout.

### Used in this project

**`setAuthCookies`** is called every time the server hands out a fresh pair of tokens:

- `controllers/auth/register.controller.js` — right after a new account is created.
- `controllers/auth/login.controller.js` — right after a successful login.
- `controllers/auth/refreshToken.controller.js` — after rotating to a new access/refresh token pair.

Example from `login.controller.js`:
```js
setAuthCookies(response, {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
});
```
This is what actually puts the `Set-Cookie: accessToken=eyJhbGc...; HttpOnly; SameSite=Lax` header on the HTTP response the browser receives.

**`clearAuthCookies`** is called anywhere a session needs to end:

- `controllers/auth/logout.controller.js` — logging out one device.
- `controllers/auth/logoutAllDevices.controller.js` — logging out everywhere.
- `controllers/auth/changePassword.controller.js` — after a password change, all sessions (including the current one) are revoked, so the cookies are cleared too, forcing a fresh login.

---

## `fetchOrNotFound.js`

```js
const fetchOrNotFound = async(Model, id, {
    idMessage = "Id is required",
    idCode = "ID_REQUIRED",
    notFoundMessage = "Resource not found",
    notFoundCode = "NOT_FOUND",
    filter = {},
    projection = null
} = {}) => {
    if(!id){
        throw new BadRequestError({
            message: idMessage,
            code: idCode
        })
    }

    const document = await Model.findOne(
        {
            _id: id,
            ...filter
        },
        projection
    );

    if(!document){
        throw new NotFoundError({
            message: notFoundMessage,
            code: notFoundCode
        })
    }

    return document;
}

export { fetchOrNotFound };
```

### What problem this solves

An enormous number of admin actions in this app follow the exact same three steps: *"check an id was actually provided, look the document up by that id, and if nothing was found, fail with a clean 404."* Without this helper, that three-step pattern would be retyped by hand in every single delete/restore/ban/get-one service — and the reference project's real history shows that hand-typing it repeatedly is exactly how bugs like "used the wrong error class" or "forgot to check for `null`" creep in. `fetchOrNotFound` writes that logic once.

### Line by line

- `fetchOrNotFound(Model, id, { ...options } = {})` — three things come in: `Model` (a Mongoose model, e.g. `User` or `Ping`), `id` (the document's `_id` as a string), and an options object with several fields that all have defaults.
- `idMessage`, `idCode` — the error message/code to use if `id` is missing. Letting the *caller* customize these means a missing id on a "delete a user" call can say `"UserId is required"` while a missing id on a "delete a ping" call says `"PingId is required"` — same helper, different wording.
- `notFoundMessage`, `notFoundCode` — same idea, but for "the id was provided, but nothing in the database matches it."
- `filter = {}` — extra conditions to merge into the query alongside `_id`. This is what lets `revokeSession.service.js` (in `services/auth/`) make sure a user can only revoke **their own** session: it calls `fetchOrNotFound(RefreshToken, sessionId, { filter: { userId } })`, so the lookup is really "find this session **and** confirm it belongs to this user" in one step.
- `projection = null` — optionally restrict which fields come back (Mongoose's normal projection argument), passed straight through.
- `if(!id){ throw new BadRequestError(...) }` — the first check: was an id even given? An empty string, `undefined`, or `null` all fail this check. This is a **400 Bad Request** — the caller's fault, not a "we searched and found nothing" situation.
- `Model.findOne({ _id: id, ...filter }, projection)` — the actual database lookup. Spreading `...filter` into the same object means any extra conditions (like `userId`) get merged in right alongside `_id`.
- `if(!document){ throw new NotFoundError(...) }` — the second check: did the query find anything? If not, that's a **404 Not Found**.
- `return document;` — if both checks pass, hand back the real Mongoose document (not just a plain object) — so the caller can still call instance methods on it, like `.softDelete()` or `.revoke()`.

### Used in this project

This function is used by nearly every admin "act on one specific document" service. A few concrete examples:

**`services/admin/users/deleteUser.service.js`:**
```js
const user = await fetchOrNotFound(User, userId, {
    idMessage: "UserId is required",
    idCode: "USER_ID_REQUIRED",
    notFoundMessage: "No user exists to delete",
    notFoundCode: "NO_USER_EXISTS_TO_DELETE",
});
await user.softDelete({ deletedByUserId, reason });
```
Example: if an admin calls `DELETE /api/admin/users/000000000000000000000000` with an id that doesn't exist in the database, this throws a clean `404 { "message": "No user exists to delete", "code": "NO_USER_EXISTS_TO_DELETE" }` instead of the code crashing trying to call `.softDelete()` on `null`.

**`services/auth/revokeSession.service.js`** — the ownership-check example mentioned above:
```js
const session = await fetchOrNotFound(RefreshToken, sessionId, {
    notFoundMessage: "Session not found",
    notFoundCode: "SESSION_NOT_FOUND",
    filter: { userId },
});
```
Here, even if `sessionId` is a real, valid session in the database, this still throws "Session not found" if it belongs to a *different* user than the one making the request — because `filter: { userId }` means the database query itself won't match it.

Also used by: `restoreUser.service.js`, `banUser.service.js`, `unbanUser.service.js`, `suspendUser.service.js`, `unsuspendUser.service.js`, `getUserSecurity.service.js`, `clearUserLockout.service.js`, `revokeUserSessions.service.js`, `getUser.service.js`, and the equivalent `Ping` services (`getPing`, `deletePing`, `restorePing`) and `admin/sessions` (`revokeSession.service.js`, the admin version).

---

## `gracefulShutdown.js`

```js
import mongoose from "mongoose";
import { systemLogger } from "../logger/pino.logger.js";

const gracefulShutdown = (server, options = {}) => {
    const {
        forceExitTimeoutMs = 30_000,
        connectionDrainTimeoutMs = 5_000,
    } = options;

    let isShuttingDown = false;
    let handlersRegistered = false;
    const connections = new Set();

    if (server?.on) {
        server.on("connection", (socket) => {
            connections.add(socket);
            socket.on("close", () => {
                connections.delete(socket);
            });
        });
    }
    // ... (see the real file for the full implementation)
};

export { gracefulShutdown };
```

### What problem this solves

When you stop a running Node process (`Ctrl+C`, a deploy restarting the server, or the process crashing), naively just letting Node exit immediately can cut off requests that are mid-flight, and leaves the MongoDB connection hanging open uncleanly. `gracefulShutdown` makes the shutdown *orderly*: stop accepting new connections, give existing ones a short window to finish, cleanly close the database connection, and only then actually exit.

### Line by line (the important parts)

- `gracefulShutdown(server, options = {})` — takes the actual running HTTP server (the object returned by `app.listen(...)`) and an optional settings object.
- `forceExitTimeoutMs = 30_000` — if graceful shutdown itself somehow takes longer than 30 seconds (something's stuck), the process force-exits anyway rather than hanging forever. `30_000` is just `30000` — the underscore is a JavaScript numeric separator, purely for human readability, it has no effect on the value.
- `connectionDrainTimeoutMs = 5_000` — after the server stops accepting *new* connections, existing ones get 5 seconds to finish naturally before they're forcibly destroyed.
- `const connections = new Set();` — tracks every currently-open socket. A `Set` is used (rather than an array) because sockets need to be added and removed individually and cheaply, and a `Set` guarantees no duplicates.
- `server.on("connection", (socket) => {...})` — every time a new client connects, this adds the socket to the tracking set, and removes it again once that socket closes on its own. This is how the shutdown logic later knows exactly how many connections are still open.
- Inside the file, `shutdown(signal, error)` is the function that actually does the work: closes the HTTP server (stops accepting new requests), waits for the drain timeout, closes MongoDB, destroys any sockets still open, then calls `process.exit(...)`.
- `registerHandlers()` wires `shutdown` up to fire automatically on `SIGINT` (Ctrl+C), `SIGTERM` (how most deploy tools ask a process to stop), `uncaughtException`, and `unhandledRejection` — so *any* of those four situations trigger the same clean shutdown sequence instead of Node's raw default behavior.

### Used in this project

Called exactly once, in `src/server.js`, right after the server starts listening:

```js
const server = app.listen(config.port, () => {
    systemLogger.info(`Listening on port: ${config.port}`);
})

gracefulShutdown(server);
```

**Important detail worth knowing:** `gracefulShutdown(server)` is only reached *after* `connectDatabase()` has already succeeded. This means if the database connection itself fails during startup (before this line even runs), the crash-handling registered by `gracefulShutdown` isn't active yet — that's why a MongoDB connection failure during the very first startup shows up as a raw, unformatted Node.js crash dump in the terminal, rather than a clean `systemLogger.fatal(...)` line. Once the server is actually running, though, this same class of error (say, MongoDB dropping the connection mid-flight) *is* caught cleanly, because by then `registerHandlers()` has already wired up the `unhandledRejection`/`uncaughtException` listeners.

---

## `jwt.js`

```js
import jwt from "jsonwebtoken";
import { BadRequestError } from "../errors/index.js";
import { normalizeString } from "./normalizer.js"
import { config } from "../config/index.js";

const generateAccessToken = async (userId) => {
    const normalizedUserId = normalizeString(userId);

    if(!normalizedUserId){
        throw new BadRequestError({
            message: "User id is required",
            code: "USER_ID_REQUIRED",
        })
    }
    return jwt.sign(
        {userId: normalizedUserId},
        config.jwtAccessSecret,
        {expiresIn: config.jwtAccessExpirySeconds},
    )
}

const verifyAccessToken = async (token) => {
    if (
            typeof token !== "string" ||
            token.trim() === ""
    ) {
        throw new BadRequestError({
            message: "Access token is required to verify",
            code: "ACCESS_TOKEN_REQUIRED",
        });
    }

    const normalizedToken = token.trim();

    return jwt.verify(normalizedToken, config.jwtAccessSecret);
}

export {
    generateAccessToken,
    verifyAccessToken
}
```

### What problem this solves

This is the whole "who is making this request?" mechanism. A **JWT** (JSON Web Token) is a signed piece of text that says "this is user X" — signed with a secret key only the server knows, so nobody can forge one, but anyone can read what's inside (JWTs are signed, not encrypted — never put a password or anything truly secret inside one). This file creates and checks those tokens for **access tokens**, the short-lived token sent on every request.

### Line by line

- **`generateAccessToken(userId)`**
  - `normalizeString(userId)` — trims the id and guarantees a plain string (see `normalizer.js` below). This matters because `userId` is very often a Mongoose `ObjectId` object, not a plain string, and `jwt.sign` needs a real string in the payload.
  - `if(!normalizedUserId){ throw ... }` — if after normalizing there's nothing there (e.g. someone passed `undefined`), refuse to sign a token for "nobody."
  - `jwt.sign(payload, secret, options)` — the actual token creation. `{ userId: normalizedUserId }` is the **payload** (the data embedded in the token — deliberately just the id, nothing else, so the token itself carries no sensitive info like role or email). `config.jwtAccessSecret` is the private key used to sign it. `{ expiresIn: config.jwtAccessExpirySeconds }` bakes an expiry time directly into the token (900 seconds / 15 minutes by default) — after that, `jwt.verify` will refuse it automatically.
- **`verifyAccessToken(token)`**
  - The `typeof`/empty-string check guards against being called with `undefined` or `""` (e.g. no cookie was sent at all) — fails fast with a clear error instead of letting `jwt.verify` throw its own less-specific error.
  - `jwt.verify(token, secret)` — checks the token's signature is genuine (nobody tampered with it) *and* that it hasn't expired. If either check fails, this line itself throws (a `TokenExpiredError` or `JsonWebTokenError` from the `jsonwebtoken` library) — this function doesn't catch those; the caller (`authenticate` middleware) is responsible for catching and translating them into a clean 401 response.
  - If it succeeds, it returns the decoded payload — the same `{ userId, iat, exp }` object that was signed (`iat`/`exp` = issued-at / expires-at timestamps, added automatically by `jwt.sign`).

### Used in this project

**`generateAccessToken`** is called every time the server needs to hand out a fresh access token — at registration, login, and token refresh:

```js
// services/auth/login.service.js
const accessToken = await generateAccessToken(userId.toString());
```
Notice the explicit `.toString()` — `userId` here is a real Mongoose `ObjectId`, and `generateAccessToken` needs a plain string (see the line-by-line notes above: `normalizeString` returns `""` for a non-string input, which would make this throw `USER_ID_REQUIRED` if `.toString()` were forgotten).

**`verifyAccessToken`** is called in exactly one place — `middleware/authenticate.middleware.js`, on every request to a protected route:
```js
const decoded = await verifyAccessToken(token);
const user = await User.findById(decoded.userId).select("role isSeller isDeleted");
```
This is the line that turns the cookie sitting in an incoming request into "here's the real, currently-valid user making this request."

---

## `normalizer.js`

```js
const normalizeString = (value) => {
    return typeof value === "string" ?
            value.trim() :
            ""
}

const normalizeEmail = (value) => {
    return typeof value === "string" ?
            value.trim().toLowerCase() :
            "";
}

const normalizeCountry = (value) => {
    return typeof value === "string" ?
            value.trim().toUpperCase() :
            ""
}

const normalizeText = (value) => {
    return typeof value === "string" ?
    value.trim().replace(/\s+/g, " ") :
    "";
}

export {
    normalizeString,
    normalizeEmail,
    normalizeCountry,
    normalizeText
}
```

These four functions all follow the exact same shape: *"if this is genuinely a string, clean it up a specific way; if it isn't a string at all (someone passed `null`, `undefined`, a number, an object...), just return an empty string instead of crashing."* That `typeof value === "string" ? ... : ""` pattern is a **ternary expression** — shorthand for an if/else that returns a value: `condition ? valueIfTrue : valueIfFalse`.

### `normalizeString(value)`

- `typeof value === "string"` — checks the *type* of the input first. This matters because calling `.trim()` on something that isn't a string (like `undefined`) would throw a `TypeError` and crash the request.
- `value.trim()` — removes whitespace from the start and end only (not the middle). `.trim()` is a built-in JavaScript string method.
- **Example:** `normalizeString("  Kwame  ")` → `"Kwame"`. `normalizeString(null)` → `""`.

**Used in:**
- `models/auth/user.model.js`, inside the `pre("save")` hook, on `firstName`, `lastName`, and (nested inside `normalizePhoneNumber`) on `phoneNumber`:
  ```js
  this.firstName = normalizeString(this.firstName);
  ```
  So if someone registers with `firstName: " Kwame "` (extra spaces, maybe from a sloppy copy-paste on a form), the value actually saved to the database is `"Kwame"` — no leading/trailing spaces. This matters because two "different" accounts named `"Kwame"` and `" Kwame "` would otherwise be treated as different strings by MongoDB, breaking searches and lookups.
- `utils/jwt.js`, on the user id before signing a token (explained above).

### `normalizeEmail(value)`

- Same shape as `normalizeString`, but also calls `.toLowerCase()`.
- **Example:** `normalizeEmail("  Kwame@GMAIL.com ")` → `"kwame@gmail.com"`.

**Why lowercase matters:** email addresses are conventionally case-insensitive for the part before typical providers, and if the database stored `"Kwame@gmail.com"` from registration but a login attempt sent `"kwame@gmail.com"`, a plain string comparison (`===`) would treat them as two different emails and the login would fail even with the exact right password. Normalizing both sides the same way — always on write (registration) *and* always on read (login lookup) — guarantees they match.

**Used in:**
- `models/auth/user.model.js` — on save, normalizes `email` before it's stored.
- `services/auth/register.service.js` — `normalizeEmail(email)` before checking whether that email already exists in the database.
- `services/auth/login.service.js` — `normalizeEmail(identifier)` when the user typed an email to log in with, so `"Kwame@GMAIL.com"` at login time still matches the `"kwame@gmail.com"` stored from registration.

### `normalizeCountry(value)`

- Same shape again, but `.toUpperCase()`.
- **Example:** `normalizeCountry("gh")` → `"GH"`.

**Why:** country codes in this app follow the two-letter ISO format (`"GH"` for Ghana), always uppercase, because that's the format `libphonenumber-js` (used in `phone.js`) expects.

**Used in:**
- `models/auth/user.model.js` — normalizes `country` on save, and also when validating `phoneNumber` (the validator calls `normalizePhoneNumber(value, normalizeCountry(this.country) || "GH")`).
- `services/auth/register.service.js` — `const normalizedCountry = normalizeCountry(country) || "GH";` — normalizes whatever country the client sent, falling back to `"GH"` if none was given at all.

### `normalizeText(value)`

- Does `.trim()` **and** collapses any run of multiple spaces down to exactly one, using the regular expression `/\s+/g`.
- `\s` means "any whitespace character" (space, tab, newline). `+` means "one or more of the previous thing." `g` (the "global" flag) means "replace *every* match in the string, not just the first one."
- **Example:** `normalizeText("cooked    food")` → `"cooked food"` (four spaces collapsed to one).

**Why this one is different from `normalizeString`:** `normalizeString` only trims the *edges*. `normalizeText` also fixes accidental extra spaces *inside* the text — useful for things like a category or product name where `"Fresh   Produce"` and `"Fresh Produce"` should really be treated as the same value.

**Used in:** currently imported into `services/auth/register.service.js` (via the barrel) but not yet called there directly — it's available for any future text field (like a product or category name) that needs this stricter cleanup, the same way the wider reference project uses it for category names.

---

## `paginateQuery.js`

```js
const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_MAX_LIMIT = 100;

const paginateQuery = async ({
    model,
    filter = {},
    page = 1,
    limit = DEFAULT_PAGE_SIZE,
    sort = { createdAt: -1 },
} = {}) => {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(Math.max(1, Number(limit) || DEFAULT_PAGE_SIZE), DEFAULT_MAX_LIMIT);
    const skip = (safePage - 1) * safeLimit;

    const [data, total] = await Promise.all([
        model.find(filter).sort(sort).skip(skip).limit(safeLimit),
        model.countDocuments(filter),
    ]);

    return {
        data,
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.max(1, Math.ceil(total / safeLimit)),
        hasNextPage: safePage * safeLimit < total,
        hasPreviousPage: safePage > 1,
    };
};

export { paginateQuery };
```

### What problem this solves

Most models in this app (`User`, `Ping`, ...) are built with `createSchema()`, which gives them a `.paginate()` static method for free (see `models/base/`). But `LoginLog` deliberately does **not** go through `createSchema()` — it has no `isDeleted` field on purpose, because a security audit trail should never be soft-deletable (see the comment in `loginLogs.model.js`). That means `LoginLog` has no `.paginate()` method, and using the shared one would be actively wrong anyway (its default filter assumes every model has `isDeleted`). `paginateQuery` is a simpler, standalone version of the same page/limit math, usable with *any* model.

### Line by line

- `DEFAULT_PAGE_SIZE = 50`, `DEFAULT_MAX_LIMIT = 100` — if the caller doesn't specify how many results per page, default to 50; and no matter what a caller asks for, never return more than 100 at once (protects against someone requesting `limit=999999` and the server trying to load an enormous number of documents into memory).
- `Math.max(1, Number(page) || 1)` — read carefully, right to left: `Number(page)` converts whatever was passed (could be a string from a URL query like `?page=2`) into an actual number. If that conversion fails (e.g. `page` was `"abc"`), `Number("abc")` is `NaN`, and `NaN || 1` falls back to `1`. Then `Math.max(1, ...)` guarantees the final result is never less than 1 — so someone requesting `page=-5` or `page=0` still gets page 1, not a broken negative skip.
- `safeLimit` does the same kind of defensive math, but clamped on *both* ends: at least 1, at most `DEFAULT_MAX_LIMIT` (100).
- `skip = (safePage - 1) * safeLimit` — the actual pagination math. Page 1 skips 0 documents. Page 2 (with a limit of 50) skips the first 50. Page 3 skips the first 100. This is standard "offset pagination."
- `Promise.all([...])` — runs the two database operations (fetching the actual page of documents, and counting the *total* number of matching documents) **at the same time** rather than one after another, since neither depends on the other's result. This roughly halves the wait time compared to awaiting them sequentially.
- The returned object gives the caller everything a paginated list UI needs: the actual `data`, plus enough metadata (`total`, `totalPages`, `hasNextPage`, `hasPreviousPage`) to render "Next"/"Previous" buttons without doing any of this math itself.

### Used in this project

Both `LoginLog` admin services use it:

**`services/admin/loginLogs/getUsersLoginLogs.service.js`:**
```js
const result = await paginateQuery({
    model: LoginLog,
    filter,
    page,
    limit,
})
```
Example: `GET /api/admin/login-logs?page=2&limit=3` results in `page=2, limit=3`, so this skips the first 3 log entries and returns the next 3, sorted newest-first by default.

**`services/admin/loginLogs/getUserLoginLogs.service.js`** — same function, with the filter narrowed to one specific user: `filter: { userId }`.

---

## `password.argon2.js`

```js
import argon2 from "argon2";
import { ARGON_CONFIG } from "../constants/index.js";
import { BadRequestError, AppError } from "../errors/index.js";
import { systemLogger } from "../logger/pino.logger.js";

const hashPassword = async(password) => {
    if(typeof password !== "string"){
        throw new BadRequestError({
            message: "Invalid password input",
            code: "INVALID_PASSWORD_TYPE"
        })
    }

    if(password.trim().length === 0){
        throw new BadRequestError({
            message: "Invalid password input",
            code: "EMPTY_PASSWORD",
        })
    }

    try{
        return await argon2.hash(password, ARGON_CONFIG);
    }catch(error){
        systemLogger.error({ err: error }, "Password hashing failed");
        throw new AppError({
            message: "Internal security error.",
            code: "PASSWORD_HASH_FAILURE",
        });
    }
}

const verifyPassword = async (plainPassword, hashedPassword) => {
    if (
        typeof plainPassword !== "string" ||
        typeof hashedPassword !== "string"
    ) {
        return false;
    }

    try {
        return await argon2.verify(hashedPassword, plainPassword);
    } catch (error) {
        systemLogger.error({ err: error }, "Password verification failed");
        return false;
    }
};

export {
    hashPassword,
    verifyPassword,
};
```

### What problem this solves

Passwords must never be stored as plain text — if the database were ever leaked, every user's real password would be exposed. Instead, the password is run through a **hashing algorithm** (Argon2id here) that turns it into a long, irreversible string. `hashPassword` creates that string at registration/password-change time; `verifyPassword` checks a login attempt against it without ever needing to "un-hash" anything (hashing is one-way by design).

### Line by line

- **`hashPassword(password)`**
  - `typeof password !== "string"` — refuses anything that isn't a real string outright (e.g. `undefined`, a number).
  - `password.trim().length === 0` — separately rejects a string that's empty or *only* whitespace (like `"   "`) — `typeof` alone wouldn't catch this, since an empty string is still a string.
  - `argon2.hash(password, ARGON_CONFIG)` — the actual hashing call. `ARGON_CONFIG` (from `constants/argonConfig.js`) sets how *expensive* (slow) the hash is to compute — deliberately slow, since that's what makes brute-forcing a stolen hash impractical. Notice: no salt is generated or passed manually — `argon2.hash` generates a fresh random salt internally on every call and embeds it inside the returned string, which is exactly why hashing the same password twice produces two different-looking results.
  - The `try/catch` around the actual hashing call handles the rare case where Argon2 itself fails (e.g. a native module problem) — this is a genuine unexpected server error, so it's logged via `systemLogger.error` and re-thrown as a generic `AppError` (not a `BadRequestError`, since it's not the caller's fault).
- **`verifyPassword(plainPassword, hashedPassword)`**
  - The type check here returns `false` rather than throwing — a wrong-type input during a *login attempt* should just mean "not a match," not crash the request.
  - `argon2.verify(hashedPassword, plainPassword)` — argon2's own comparison function; it re-derives the hash internally (using the same salt embedded in `hashedPassword`) and checks it matches. Returns `true`/`false`.
  - Any error during verification also just resolves to `false`, logged first — so a malformed stored hash, for instance, fails safe (as "wrong password") instead of crashing the login attempt.

### Used in this project

**`hashPassword`** — called automatically inside `models/auth/user.model.js`'s `pre("save")` hook, never called directly by services:
```js
userSchema.pre("save", async function(){
    if(!this.isModified("password")){
        return;
    }
    this.password = await hashPassword(this.password);
})
```
Example: a service does `User.create({ ..., password: "Passw0rd!" })`. Before that document is actually written to MongoDB, this hook runs and replaces `"Passw0rd!"` with something like `$argon2id$v=19$m=19456,t=2,p=1$...` — the *hash*, not the original text. `if(!this.isModified("password"))` is what stops this from re-hashing an already-hashed password every time an unrelated field (like `firstName`) is updated later.

**`verifyPassword`** — called from `User.prototype.comparePassword`, an instance method also defined in `user.model.js`:
```js
userSchema.methods.comparePassword = async function(plainPassword){
    // ...
    return await verifyPassword(plainPassword, this.password);
}
```
This method is what `services/auth/login.service.js` and `services/auth/changePassword.service.js` actually call — e.g. `await user.comparePassword(password)` — rather than calling `verifyPassword` directly, so the "is the password field even loaded?" safety check (`user.model.js` throws a clear error if `this.password` is missing, which happens if a query forgot `.select("+password")`) lives in one place.

---

## `phone.js`

```js
import { parsePhoneNumberFromString } from "libphonenumber-js";

const normalizePhoneNumber = (value, defaultCountry = "GH") => {
    if(typeof value !== "string"){
        return null
    }

    let raw = value.trim();
    if(!raw){
        return null;
    }
    if(raw.length > 50){
        raw = raw.slice(0, 50);
    }

    raw = raw.replace(/[()\s-]/g, "");

    let phoneNumber;
    try {
        phoneNumber = parsePhoneNumberFromString(raw, defaultCountry);
    } catch {
        phoneNumber = undefined;
    }

    if (
        (!phoneNumber || !phoneNumber.isValid()) &&
        /^\+2330\d+$/.test(raw)
    ) {
        const retry = raw.replace(/^\+2330/, "+233");
        try {
            phoneNumber = parsePhoneNumberFromString(retry);
        } catch {
            phoneNumber = undefined;
        }
    }

    if (!phoneNumber || !phoneNumber.isValid()) {
        return null;
    }

    return {
        input: raw,
        country: phoneNumber.country || defaultCountry,
        countryCallingCode: `+${phoneNumber.countryCallingCode}`,
        national: phoneNumber.nationalNumber,
        e164: phoneNumber.number,
        international: phoneNumber.formatInternational(),
        nationalFormatted: phoneNumber.formatNational(),
        type: phoneNumber.getType?.() || null,
        isValid: true,
    };
}

export {
    normalizePhoneNumber
}
```

### What problem this solves

People type phone numbers in wildly inconsistent formats: `"0552343560"`, `"055 234 3560"`, `"+233552343560"`, `"(055) 234-3560"` — all the *same* real phone number. This function turns any of those into one guaranteed, consistent format (**E.164**, the international standard — e.g. `+233552343560`) for storage, so two different-looking inputs for the same real number are recognized as the same account/contact, and so the number can always be displayed nicely later.

### Line by line

- `typeof value !== "string"` / `if(!raw)` — the usual guards: not a string, or empty after trimming, both return `null` immediately (this function's whole contract is "return the details object, or `null` if it just isn't a valid phone number").
- `raw.length > 50` → `raw.slice(0, 50)` — a defensive cap. No real phone number is anywhere near 50 characters; this just protects against someone pasting a huge block of text into a phone field.
- `raw.replace(/[()\s-]/g, "")` — strips out parentheses, whitespace, and hyphens. `[()\s-]` is a **character class** in the regex — it matches any *one* of: `(`, `)`, any whitespace (`\s`), or `-`. So `"(055) 234-3560"` becomes `"0552343560"` before parsing even starts.
- `parsePhoneNumberFromString(raw, defaultCountry)` — the actual parsing, handled by the `libphonenumber-js` library (the same phone-number-parsing engine Android uses internally). `defaultCountry` tells it which country's dialing rules to assume *if* the number doesn't already start with a `+` and a country code.
- The `try { ... } catch { phoneNumber = undefined; }` blocks exist because `libphonenumber-js` can throw on truly malformed input rather than just returning an invalid result — this converts a thrown error into the same "not valid" state the rest of the function already knows how to handle.
- **The retry block** — this is a specific, deliberate fix for one common real-world typo: someone types `+233` (Ghana's country code) *and then also* the leading `0` from the national format, producing `+2330244...` instead of the correct `+233244...`. `/^\+2330\d+$/` is a regex meaning "starts with exactly `+2330`, followed by one or more digits." If the first parse attempt failed *and* the input matches that specific broken shape, it retries once with the extra `0` stripped (`raw.replace(/^\+2330/, "+233")`).
- `phoneNumber.isValid()` — `libphonenumber-js`'s own validity check (correct number of digits for that country, valid area/prefix, etc.) — not just "did it parse," but "is this a real, dialable number."
- The final returned object includes several different representations of the same number: `e164` (the canonical form to actually store), `international`/`nationalFormatted` (human-readable, for displaying back to a user), and `type` (mobile vs. fixed-line, when detectable).

### Used in this project

**`models/auth/user.model.js`** uses it in two places:
1. As the actual field validator for `phoneNumber`:
   ```js
   validate: {
       validator(value){
           return normalizePhoneNumber(value, normalizeCountry(this.country) || "GH") !== null;
       },
       message: "Enter a valid phone number",
   }
   ```
   This is what makes `User.create({ phoneNumber: "not a phone number", ... })` fail with a clean Mongoose validation error instead of saving garbage.
2. Inside the `pre("save")` hook, to actually convert the stored value to E.164 format:
   ```js
   const normalizedPhoneNumber = normalizePhoneNumber(normalizeString(this.phoneNumber), this.country || "GH");
   this.phoneNumber = normalizedPhoneNumber.e164;
   ```
   Example: a user registers with `phoneNumber: "0552343560"` and `country: "GH"`. What actually ends up stored in MongoDB is `"+233552343560"` — the `.e164` value.

**`services/auth/register.service.js`** — calls it *before* creating the user, specifically to get a clean value to check for duplicates with:
```js
const phoneDetails = normalizePhoneNumber(normalizeString(phoneNumber), normalizedCountry);
const normalizedPhoneNumber = phoneDetails?.e164 ?? null;
// ...
User.exists({ phoneNumber: normalizedPhoneNumber })
```
This has to use `.e164` specifically — passing the whole `phoneDetails` *object* into a MongoDB query for a `String` field causes a `CastError` (this was a real bug caught and fixed during this project's build).

**`services/auth/login.service.js`** — when the identifier the user typed in doesn't contain an `@` (so it's probably a phone number, not an email), it's normalized the same way before searching for a matching account:
```js
const normalizedIdentifier = identifier.includes("@")
    ? normalizeEmail(identifier)
    : normalizePhoneNumber(identifier, "GH")?.e164;
```
Example: someone logs in typing `"055 234 3560"` — this line converts it to `"+233552343560"` before searching, so it matches the E.164 value that was actually stored at registration.

---

## `refreshTokenUtils.js`

```js
import crypto from "node:crypto";
import { RefreshToken } from "../models/auth/refreshToken.model.js";
import { config } from "../config/index.js";

const hashToken = (rawToken) => {
    return crypto.createHash("sha256").update(rawToken).digest("hex");
};

const generateRefreshToken = async ({
    userId,
    userAgent = null,
    ipAddress = null,
    deviceName = null,
    deviceId = null,
    session = null,
} = {}) => {
    const rawToken = crypto.randomBytes(64).toString("hex");
    const tokenHash = hashToken(rawToken);

    const expiresAt = new Date(
        Date.now() + config.jwtRefreshExpiryDays * 24 * 60 * 60 * 1000,
    );

    await RefreshToken.create(
        [{ userId, tokenHash, expiresAt, userAgent, ipAddress, deviceName, deviceId }],
        session ? { session } : null,
    );

    return rawToken;
};

const verifyRefreshToken = async (rawToken, { session = null } = {}) => {
    const tokenHash = hashToken(rawToken);
    const query = RefreshToken.findOne({ tokenHash });

    if (session) {
        query.session(session);
    }

    const record = await query;

    if (!record || !record.isActive()) {
        return null;
    }

    return record;
};

export { generateRefreshToken, verifyRefreshToken, hashToken };
```

### What problem this solves

The access token (from `jwt.js`) is short-lived (15 minutes) on purpose — if it's ever stolen, the damage window is small. But that means the app needs a *second*, longer-lived token that can be used to quietly get a new access token without forcing the user to log in again every 15 minutes. That's the refresh token. Unlike the access token, it isn't a signed JWT — it's just random bytes, and the server keeps a record of every one it's issued (in the `RefreshToken` collection), which is what makes it possible to revoke one early (logout) — something you fundamentally cannot do to a stateless JWT before it naturally expires.

### Line by line

- **`hashToken(rawToken)`** — `crypto.createHash("sha256")` starts a SHA-256 hash (a one-way, fixed-output hashing algorithm, built into Node — no external library needed here), `.update(rawToken)` feeds the token into it, `.digest("hex")` finishes the hash and returns it as a hex string. Only this **hash** is ever stored in the database — never the real, raw token. That way, even if the database were leaked, the leaked hashes couldn't be used to log in as anyone (you'd need the original raw token, and a hash can't be reversed back into it).
- **`generateRefreshToken({...})`**
  - `crypto.randomBytes(64).toString("hex")` — generates 64 random bytes (bytes from Node's cryptographically-secure random number generator, not `Math.random()`, which is not safe for this) and converts them to a 128-character hex string. This is the actual raw refresh token.
  - `hashToken(rawToken)` — hashes it, for storage.
  - `expiresAt` — computed once, at creation time: "now" plus `config.jwtRefreshExpiryDays` (30, by default), converted into milliseconds (`days * 24 hours * 60 minutes * 60 seconds * 1000 ms`).
  - `RefreshToken.create([{...}], session ? { session } : null)` — note the array around the object (`[{...}]`, not just `{...}`) — this is deliberate. Mongoose's `.create()` only reliably applies a `session` (for a database transaction) when the documents are passed as an array; passing a single bare object and a session as the second argument doesn't work the same way. This exact detail was a real bug caught during this project's build.
  - `return rawToken;` — the function hands back the **raw**, unhashed token — this is the only moment it ever exists outside the user's own cookie.
- **`verifyRefreshToken(rawToken, { session })`**
  - Hashes the incoming raw token the same way, then looks it up by that hash (never by the raw value — the raw value was never stored).
  - `record.isActive()` — a method defined on the `RefreshToken` model itself, checking it hasn't been revoked *and* hasn't passed its `expiresAt`.
  - Returns `null` (not an error) if nothing matches or it's inactive — leaves the decision of what that *means* (e.g. "please log in again") to the caller.

### Used in this project

**`generateRefreshToken`** is called every time a session is created or refreshed:
```js
// services/auth/login.service.js
const refreshToken = await generateRefreshToken({
    userId, deviceName, deviceId, userAgent, ipAddress, session,
});
```
Also called in `register.service.js` and `refreshToken.service.js`.

**`verifyRefreshToken`** is called in exactly one place, `services/auth/refreshToken.service.js` (the "please give me a new access token" endpoint):
```js
const record = await verifyRefreshToken(refreshToken);
if (!record) {
    throw sessionExpired();
}
// ... record.revoke() — the old token is retired ...
// ... generateRefreshToken({...}) — a brand new one takes its place ...
```
This whole sequence (verify old → revoke old → generate new) is called **refresh token rotation**. It means a stolen refresh token is only useful once — the moment either the real user or an attacker uses it, the old one is dead, and whoever uses the *next* one to appear "wins."

**`hashToken`** is also called directly (not just internally) in `services/auth/logout.service.js`, to look up which specific session to revoke on logout:
```js
const tokenHash = hashToken(refreshToken);
const record = await RefreshToken.findOne({ tokenHash, userId });
```

---

## `request.js`

```js
import crypto from "node:crypto";

const DEVICE_ID_CACHE = new WeakMap();

const getHeader = (request, name) => {
    const value = request.headers?.[name];
    return Array.isArray(value) ? value[0] : value;
};

const normalize = (value) => String(value ?? "").trim();

const getClientIP = (request) => {
    const raw =
        request.ip ||
        getHeader(request, "x-forwarded-for")?.split(",")[0] ||
        getHeader(request, "x-real-ip") ||
        request.socket?.remoteAddress ||
        "unknown";
    return normalize(raw);
};

const getUserAgent = (request) => {
    return normalize(getHeader(request, "user-agent")) || null;
};

const getDeviceName = (request) => {
    const raw =
        request.body?.device_name ||
        getHeader(request, "x-device-name") ||
        getHeader(request, "device-name");
    return normalize(raw) || null;
};

const getDeviceId = (request) => {
    if (DEVICE_ID_CACHE.has(request)) {
        return DEVICE_ID_CACHE.get(request);
    }

    const raw =
        request.body?.device_id ||
        getHeader(request, "x-device-id") ||
        getHeader(request, "device-id");
    const deviceId = normalize(raw) || crypto.randomUUID();

    DEVICE_ID_CACHE.set(request, deviceId);
    return deviceId;
};

export {
    getClientIP,
    getUserAgent,
    getDeviceName,
    getDeviceId,
};
```

### What problem this solves

Every `RefreshToken` and `LoginLog` in this app records *where* and *how* a login/session happened — IP address, browser/app (user agent), and an optional device name/id. This file is where all that "read some metadata off the incoming HTTP request" logic lives, so every controller that needs it calls the same four small functions instead of poking at `request.headers` directly (and getting it slightly wrong in a different way each time).

### Line by line

- `const DEVICE_ID_CACHE = new WeakMap();` — a `WeakMap` is like a regular `Map` (key → value storage), except its keys must be objects, and it doesn't prevent those objects from being garbage-collected once nothing else references them. Using the `request` object itself as the key means "remember this device id, but only for as long as this specific request object exists" — once the request finishes and Node cleans it up, this cache entry disappears automatically, with no memory leak and no manual cleanup needed.
- **`getHeader(request, name)`** — a small private helper (not exported) used internally. HTTP headers are usually a single string, but if a header is sent more than once in the same request, Node can give it back as an *array* of values. `Array.isArray(value) ? value[0] : value` just always returns a single, plain value either way.
- **`normalize(value)`** — `String(value ?? "")` first: the `??` (nullish coalescing operator) means "use the right-hand side only if the left is `null` or `undefined`" (unlike `||`, it wouldn't be fooled by a legitimately falsy-but-real value like `0` or `""`, though that distinction doesn't matter much here). Wrapping in `String(...)` guarantees a real string even if something unexpected was passed. `.trim()` cleans up whitespace.
- **`getClientIP(request)`** — tries several sources, in order, using `||` (which moves to the next option only if the current one is falsy/empty): Express's own `request.ip` first (Express already does some of this work itself), then the `x-forwarded-for` header (set by reverse proxies/load balancers — can contain a comma-separated list, so `.split(",")[0]` takes just the first, original client IP), then `x-real-ip` (another common proxy header), then the raw socket's address, and finally the literal string `"unknown"` if absolutely nothing was found — so this function *always* returns a string, never `null`/`undefined`.
- **`getUserAgent(request)`** — just reads and normalizes the `user-agent` header, returning `null` (not an empty string) if there wasn't one — matching the `default: null` on the corresponding database fields.
- **`getDeviceName(request)`** — checks the request body first (a client could send `{ "device_name": "Kwame's iPhone" }` explicitly), then two possible custom header spellings, as a fallback.
- **`getDeviceId(request)`** — the most involved one. It first checks the cache (explained above) — if this exact request already asked for a device id once, hand back the *same* answer instead of possibly generating a new random one. If not cached yet, it checks the body/headers for a client-supplied id; if none exists, `crypto.randomUUID()` generates a fresh random one (a UUID — a near-guaranteed-unique 36-character id, built into Node, no library needed). Either way, the result is cached before returning, keyed to this request.

### Used in this project

All four functions are called together, in every auth controller that needs to record session/log metadata — `register.controller.js`, `login.controller.js`, `refreshToken.controller.js`, `logout.controller.js`, `logoutAllDevices.controller.js`:

```js
// controllers/auth/login.controller.js
const {user, accessToken, refreshToken} = await loginUserService({
    ...request.body,
    userAgent: getUserAgent(request),
    ipAddress: getClientIP(request),
    deviceName: getDeviceName(request),
    deviceId: getDeviceId(request)
});
```

Concretely: if this request came from `curl` with no special headers, `getUserAgent` returns something like `"curl/8.16.0"`, `getClientIP` returns `"::1"` (the IPv6 form of localhost, since we're testing from the same machine), `getDeviceName` returns `null` (curl doesn't send one), and `getDeviceId` generates a fresh random UUID like `"af80e660-2dd2-4cf8-9c01-0f464971c6bc"` since none was supplied. Those four values are exactly what end up stored on the `RefreshToken` document and the `LoginLog` entry created for that login.

---

## `withTransaction.js`

```js
import mongoose from "mongoose";

const MAX_TRANSACTION_ATTEMPTS = 3;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isTransientTransactionError = (error) => {
    if (typeof error?.hasErrorLabel === "function") {
        return error.hasErrorLabel("TransientTransactionError");
    }
    return Boolean(error?.errorLabels?.includes?.("TransientTransactionError"));
};

const withTransaction = async (callback, { maxAttempts = MAX_TRANSACTION_ATTEMPTS } = {}) => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const session = await mongoose.startSession();

        try {
            session.startTransaction();
            const result = await callback(session);
            await session.commitTransaction();
            return result;
        } catch (error) {
            await session.abortTransaction();

            if (isTransientTransactionError(error) && attempt < maxAttempts) {
                await wait(50 * attempt);
                continue;
            }

            throw error;
        } finally {
            session.endSession();
        }
    }
};

export { withTransaction, isTransientTransactionError };
```

### What problem this solves

Some operations in this app need to make **multiple** database writes that must all succeed together, or none of them should happen at all. For example, registering a user creates a `User` **and** a `RefreshToken` **and** a `LoginLog` entry — if the server crashed after creating the `User` but before the others, you'd end up with a half-registered account. A **MongoDB transaction** groups multiple writes into one all-or-nothing unit. `withTransaction` is a reusable wrapper around the (slightly fiddly) MongoDB transaction API, with automatic retrying built in.

### Line by line

- `MAX_TRANSACTION_ATTEMPTS = 3` — how many times to retry before giving up.
- `wait(ms)` — a tiny helper that turns `setTimeout` into something you can `await`. `new Promise((resolve) => setTimeout(resolve, ms))` creates a Promise that resolves itself after `ms` milliseconds — a common one-line "sleep" pattern in JavaScript, since there's no built-in `sleep()` function.
- **`isTransientTransactionError(error)`** — MongoDB tags certain errors with special labels. `"TransientTransactionError"` specifically means "this transaction failed because it collided with another one happening at almost the same moment — this is expected and safe to just retry." `error.hasErrorLabel(...)` is the real, documented MongoDB driver method for checking this; the `error?.errorLabels?.includes?.(...)` fallback exists for older/different error shapes that might not have that method. The `?.` (optional chaining) throughout means "only call/access the next part if everything before it actually exists" — so this never itself throws just from checking.
- **`withTransaction(callback, { maxAttempts })`**
  - `for (let attempt = 1; attempt <= maxAttempts; attempt++)` — tries up to `maxAttempts` times.
  - `mongoose.startSession()` — a **session** is MongoDB's handle for a transaction; every read/write that should be part of the same all-or-nothing unit needs to go through this same session object.
  - `session.startTransaction()` — actually begins the transaction.
  - `await callback(session)` — runs the caller's actual logic, handing it the session so it can pass it into its own database calls (e.g. `User.create([{...}], { session })`).
  - `session.commitTransaction()` — if the callback succeeded with no errors, make everything it did permanent, all at once.
  - `catch (error)` — if *anything* inside the callback threw (a validation error, a duplicate key, or a transient MongoDB collision), `session.abortTransaction()` undoes any writes the callback made so far — nothing partial is left behind.
  - `if (isTransientTransactionError(error) && attempt < maxAttempts) { await wait(50 * attempt); continue; }` — specifically for the "collided with another transaction" case, and only if there are attempts left: wait a little (50ms, then 100ms, then 150ms — a short **linear backoff**, giving the other transaction time to finish first) and `continue` to the next loop iteration to try again from scratch.
  - Any *other* kind of error (not transient, or retries exhausted) is re-thrown immediately — `withTransaction` doesn't swallow real failures.
  - `finally { session.endSession(); }` — always releases the session's resources, whether the transaction succeeded, failed, or is about to be retried.

### Used in this project

Every service that needs to write to more than one collection atomically wraps that logic in `withTransaction`:

**`services/auth/register.service.js`:**
```js
return withTransaction(async (session) => {
    [user] = await User.create([{...}], { session });
    // ...
    const security = await UserSecurity.findOrCreateForUser(userId, { session });
    // ...
    await LoginLog.create([{...}], { session });
    return { user, security, accessToken, refreshToken, message: "..." };
});
```
If, say, the `LoginLog.create` call at the end somehow failed, the `User` and `UserSecurity` documents created earlier in the *same* callback would be rolled back too — you'd never end up with a `User` in the database but no matching security record.

Also used in: `services/auth/login.service.js` (recording a successful login + issuing tokens together), `services/auth/refreshToken.service.js` (revoking the old token + creating the new one together — this is the exact case the file's own code comment describes, where getting the retry check wrong once already caused a real bug), `services/auth/changePassword.service.js` (changing the password + revoking every other session together), and the admin `banUser.service.js`/`suspendUser.service.js` (updating the user's security record + revoking all their sessions together).

---

## `index.js`

```js
export { asyncHandler } from "./asyncHandler.js";
export { fetchOrNotFound } from "./fetchOrNotFound.js";
export { hashPassword, verifyPassword } from "./password.argon2.js";
export { normalizeString, normalizeEmail, normalizeCountry, normalizeText } from "./normalizer.js";
export { normalizePhoneNumber } from "./phone.js";
export { generateAccessToken, verifyAccessToken } from "./jwt.js";
export { gracefulShutdown } from "./gracefulShutdown.js";
export { withTransaction, isTransientTransactionError } from "./withTransaction.js";
export { generateRefreshToken, verifyRefreshToken, hashToken } from "./refreshTokenUtils.js"
export { setAuthCookies, clearAuthCookies, ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "./authCookies.js"
export { getClientIP, getUserAgent, getDeviceName, getDeviceId } from "./request.js"
export { paginateQuery } from "./paginateQuery.js"
```

### What this file is

This is called a **barrel file** — a file whose only job is to re-export things from other files in the same folder, so the rest of the app can write one shorter import instead of many. `export { X } from "./file.js"` is different from `import { X } from "./file.js"; export { X };` — it re-exports directly without creating a local variable in this file at all; it's purely a pass-through.

### Why it exists

Without this file, importing both `hashPassword` and `getClientIP` from two different controllers would look like:
```js
import { hashPassword } from "../../utils/password.argon2.js";
import { getClientIP } from "../../utils/request.js";
```
Two lines, and you'd need to remember which specific file each function lives in. With the barrel, every file in the whole project just does:
```js
import { hashPassword, getClientIP } from "../../utils/index.js";
```
One line, and the caller never needs to know (or care) which specific file inside `utils/` actually defines each function — genuinely, this is *why* nearly every service and controller in this project imports from `"../../utils/index.js"` (or `"../../../utils/index.js"`, depending on folder depth) rather than reaching into individual files directly. When Node sees `import ... from "some/folder/index.js"`, and you import the folder path without naming a file, it automatically looks for `index.js` — that's a Node/JavaScript convention, not something specific to this project.

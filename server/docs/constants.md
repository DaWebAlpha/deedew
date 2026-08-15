# `src/constants/` — Shared Constant Values

This document explains every constant defined in the app, and where each one is actually used. The theme across this whole folder: any value that's used in more than one place, or that represents a real decision (a security parameter, a permission name), lives here once — instead of being retyped, and potentially retyped *slightly differently*, wherever it's needed.

## Index

- [`httpStatus.js`](#httpstatusjs) — `HTTP_STATUS`
- [`sensitiveFields.js`](#sensitivefieldsjs) — `SENSITIVE_FIELDS`
- [`argonConfig.js`](#argonconfigjs) — `ARGON_CONFIG`
- [`security.js`](#securityjs) — `SECURITY_CONFIG`
- [`mongoose.options.js`](#mongooseoptionsjs) — `OPTIONS`
- [`permissions.js`](#permissionsjs) — `PERMISSIONS`, `ROLE_PERMISSIONS`
- [`index.js`](#indexjs) — the barrel

---

## `httpStatus.js`

```js
const HTTP_STATUS = Object.freeze({
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHENTICATED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500
})

export {
    HTTP_STATUS
};
```

### Line by line

- `Object.freeze({...})` — `Object.freeze` makes an object **immutable**: after this line runs, nothing anywhere in the app can accidentally do `HTTP_STATUS.OK = 201` and silently break every "success" response in the app. Attempting to modify a frozen object either fails silently (outside strict mode) or throws (inside strict mode, which ES modules — the `import`/`export` style this whole project uses — always are). This `Object.freeze()` pattern is used on every constants file in this folder.
- Each key is a human-readable name (`OK`, `NOT_FOUND`) mapped to the real numeric HTTP status code it represents. Writing `HTTP_STATUS.NOT_FOUND` everywhere instead of the bare number `404` means a reader never has to remember what `404` means, and a typo like `4004` becomes `HTTP_STATUS.NOT_FOUND` — misspelled property accesses on a real object are much easier to catch (some editors/linters flag them) than a wrong number sitting silently in the code.

### Used in this project

Everywhere a controller or middleware needs to set a status code — dozens of call sites. A few representative ones: `middleware/errorHandler.middleware.js` (`error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR`), `middleware/notFound.middleware.js` (`HTTP_STATUS.NOT_FOUND`), `middleware/role.middleware.js` (`HTTP_STATUS.UNAUTHENTICATED`/`HTTP_STATUS.FORBIDDEN`), `middleware/rateLimit.middleware.js` (`HTTP_STATUS.TOO_MANY_REQUESTS`), and every single controller's `response.status(HTTP_STATUS.OK)` / `.status(HTTP_STATUS.CREATED)`.

---

## `sensitiveFields.js`

```js
const SENSITIVE_FIELDS = Object.freeze([
    "password",
    "accessToken",
    "refreshToken",
    "token",
    "otp",
    "pin",
    "secret",
    "apiKey",
    "clientSecret",
    "cardNumber",
    "cvv",
    "bankAccountNumber",
    "tokenHash",
    "rawToken",
])

export {
    SENSITIVE_FIELDS,
}
```

### What this is

A flat list of field *names* that should never leave the server, no matter which model they show up on. This isn't tied to any one schema — it's a blanket, app-wide rule.

### Used in this project

Read by exactly one function: `transformDocument` in `models/base/mongoose.schema.options.js`, which loops over this list and deletes any matching field from every document right before it's turned into JSON for a client — `for(const field of SENSITIVE_FIELDS){ delete returnedObject[field]; }`. Because this runs on *every* model that goes through `createSchema()`, adding a new sensitive field name here (say, a future `"ssn"` field on some new model) protects it everywhere in the app immediately, without touching that model's own file at all. `"tokenHash"` and `"rawToken"` were added specifically because `RefreshToken.tokenHash` exists in this codebase — good hygiene even though a hash is already one-way and can't be reversed into the real token.

---

## `argonConfig.js`

```js
import argon2 from "argon2";

const ARGON_CONFIG = Object.freeze({
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1
})

export {
    ARGON_CONFIG
}
```

### Line by line

- `type: argon2.argon2id` — selects the specific Argon2 *variant*. There are three (`argon2i`, `argon2d`, `argon2id`); `argon2id` is a hybrid of the other two and is what OWASP (a well-known web-security standards body) currently recommends as the safest general-purpose default.
- `memoryCost: 19456` (≈19 MB) and `timeCost: 2` — these two together control how *expensive* — meaning slow and memory-hungry — each password hash is to compute. This is deliberate: unlike a fast hash (like plain SHA-256), a password hash is *supposed* to be slow, because that's exactly what makes it impractical for an attacker to brute-force millions of guesses per second against a stolen hash database. These specific numbers are OWASP's current documented minimum recommendation.
- `parallelism: 1` — how many CPU threads Argon2 is allowed to use per hash operation.

### Used in this project

Passed directly into `argon2.hash(password, ARGON_CONFIG)` inside `utils/password.argon2.js` — see `docs/utils.md` for the full explanation of that function. Never read anywhere else.

---

## `security.js`

```js
const SECURITY_CONFIG = Object.freeze({
    MAX_FAILED_LOGIN_ATTEMPTS: 5,
    LOCKOUT_DURATION_MINUTES: 15,
});

export { SECURITY_CONFIG };
```

Two tunable numbers for the account-lockout system: how many wrong passwords in a row trigger a lockout, and how long that lockout lasts.

### Used in this project

Both values are read inside `models/auth/userSecurity.model.js`'s `registerFailedAttempt` method:
```js
if(this.failedLoginAttempts >= SECURITY_CONFIG.MAX_FAILED_LOGIN_ATTEMPTS){
    this.lockedUntil = new Date(Date.now() + SECURITY_CONFIG.LOCKOUT_DURATION_MINUTES * 60 * 1000);
}
```
Concretely: on a user's 5th wrong password in a row (with the current defaults), `lockedUntil` gets set to 15 minutes from that exact moment — see `docs/models.md` for the full walkthrough of that method, and `docs/services.md` (once written) for how `login.service.js` checks it.

---

## `mongoose.options.js`

```js
const OPTIONS = Object.freeze({
    socketTimeoutMS: 45000,
    serverSelectionTimeoutMS: 5000,
    maxPoolSize: 50,
    minPoolSize: 5,
})

export {
    OPTIONS
}
```

### Line by line

These are all settings for the *network connection* to MongoDB (not, despite the similar-sounding name, anything to do with an individual schema's behavior — see the naming note below).

- `socketTimeoutMS: 45000` — if an individual database operation (a query, a write) takes longer than 45 seconds to get a response, the connection gives up on it rather than waiting forever.
- `serverSelectionTimeoutMS: 5000` — how long Mongoose will keep trying to find a usable MongoDB server before giving up and throwing a connection error. This is the setting directly responsible for how quickly (or slowly) this project's occasional MongoDB Atlas connectivity blips during development turned into a visible error — 5 seconds of retrying before it surfaces as a failure.
- `maxPoolSize: 50` / `minPoolSize: 5` — MongoDB connections are expensive to open, so the driver keeps a **pool** (a reusable set) of open connections rather than opening a fresh one per query. This caps that pool between 5 and 50 simultaneous connections.

### Used in this project

Passed as the second argument to `mongoose.connect(...)` in `config/database.js`: `await mongoose.connect(config.mongoUri, OPTIONS);`.

**Naming note:** this file's name, `mongoose.options.js`, is easy to confuse with `models/base/mongoose.schema.options.js` — they sound similar but configure two completely unrelated things: this file tunes the *network connection itself*; the other tunes how *individual documents* behave and serialize. Worth remembering the distinction, since only the name is similar — the content isn't.

---

## `permissions.js`

```js
const PERMISSIONS = Object.freeze({
    USER_VIEW: "user:view",
    USER_VIEW_DELETED: "user:viewDeleted",
    USER_DELETE: "user:delete",
    USER_RESTORE: "user:restore",
    USER_BAN: "user:ban",
    USER_UNBAN: "user:unban",
    USER_SUSPEND: "user:suspend",
    USER_UNSUSPEND: "user:unsuspend",
    USER_VIEW_MODERATION_STATS: "user:viewModerationStats",
    USER_VIEW_LOGIN_LOGS: "user:viewLoginLogs",
    USER_CLEAR_LOCKOUT: "user:clearLockout",
    USER_UPDATE_ROLE: "user:updateRole",

    SESSION_VIEW: "session:view",
    SESSION_REVOKE: "session:revoke",

    PING_VIEW: "ping:view",
    PING_VIEW_DELETED: "ping:viewDeleted",
    PING_DELETE: "ping:delete",
    PING_RESTORE: "ping:restore",
});

const ROLE_PERMISSIONS = Object.freeze({
    customer: [],
    admin: [
        PERMISSIONS.USER_VIEW, PERMISSIONS.USER_DELETE, PERMISSIONS.USER_BAN,
        PERMISSIONS.USER_UNBAN, PERMISSIONS.USER_SUSPEND, PERMISSIONS.USER_UNSUSPEND,
        PERMISSIONS.USER_VIEW_MODERATION_STATS, PERMISSIONS.USER_VIEW_LOGIN_LOGS,
        PERMISSIONS.USER_CLEAR_LOCKOUT, PERMISSIONS.SESSION_VIEW, PERMISSIONS.SESSION_REVOKE,
        PERMISSIONS.PING_VIEW, PERMISSIONS.PING_DELETE,
    ],
    superadmin: [
        PERMISSIONS.USER_VIEW, PERMISSIONS.USER_VIEW_DELETED, PERMISSIONS.USER_DELETE,
        PERMISSIONS.USER_RESTORE, PERMISSIONS.USER_BAN, PERMISSIONS.USER_UNBAN,
        PERMISSIONS.USER_SUSPEND, PERMISSIONS.USER_UNSUSPEND, PERMISSIONS.USER_VIEW_MODERATION_STATS,
        PERMISSIONS.USER_VIEW_LOGIN_LOGS, PERMISSIONS.USER_CLEAR_LOCKOUT, PERMISSIONS.USER_UPDATE_ROLE,
        PERMISSIONS.SESSION_VIEW, PERMISSIONS.SESSION_REVOKE, PERMISSIONS.PING_VIEW,
        PERMISSIONS.PING_VIEW_DELETED, PERMISSIONS.PING_DELETE, PERMISSIONS.PING_RESTORE,
    ],
});

export { PERMISSIONS, ROLE_PERMISSIONS };
```

### What problem this solves

This is the whole **RBAC** (Role-Based Access Control) system in one file: a list of specific *actions* (`PERMISSIONS`), and a mapping of which *roles* (`customer`/`admin`/`superadmin` — the same three values allowed by `User.role`'s enum) are allowed to perform each one (`ROLE_PERMISSIONS`).

### Line by line

- **`PERMISSIONS`** — each value is a namespaced string like `"user:ban"` (`resource:action` — a plain naming convention, not a special JS feature; it just makes permission names self-explanatory and avoids collisions between, say, a `PING_DELETE` and some future `PRODUCT_DELETE`). These strings are what actually gets checked — the `PERMISSIONS.X` constant names on the left are just a way to avoid typo-prone raw strings scattered through the codebase (a typo in `PERMISSIONS.USER_BAN` at the call site would be an instant `undefined` and a very visible bug; a typo in a raw string `"usre:ban"` would silently just never match anything).
- **`ROLE_PERMISSIONS`** — maps each of the three roles to the *array* of permission strings that role is allowed to use.
  - `customer: []` — a plain customer has **none** of these admin-only permissions.
  - `admin` — has most of the list, but notice what's deliberately **excluded**: `USER_VIEW_DELETED`, `USER_RESTORE`, `USER_UPDATE_ROLE`, and `PING_VIEW_DELETED`/`PING_RESTORE`. These are the most sensitive actions — viewing/restoring soft-deleted (and therefore normally hidden) data, and changing someone's role (a privilege-escalation risk) — reserved for `superadmin` only.
  - `superadmin` — has everything `admin` has, plus those four extra permissions.

### Used in this project

Checked in exactly one place, `middleware/role.middleware.js` (see below), which reads `ROLE_PERMISSIONS[request.user.role]` to decide whether a given request is allowed through. Every admin route in `routes/admin/*.routes.js` names a specific `PERMISSIONS.X` value when it sets up that check, e.g.:
```js
adminUsersRouter.post(
    "/:userId/ban",
    authenticate,
    roleMiddleware(PERMISSIONS.USER_BAN),
    banUserController,
);
```

---

## `index.js`

```js
export { HTTP_STATUS } from "./httpStatus.js";
export { OPTIONS } from "./mongoose.options.js";
export { SENSITIVE_FIELDS } from "./sensitiveFields.js";
export { ARGON_CONFIG } from "./argonConfig.js";
export { SECURITY_CONFIG } from "./security.js"
export { PERMISSIONS, ROLE_PERMISSIONS } from "./permissions.js";
```

The barrel — every file in the project that needs any of these constants imports from `"../constants/index.js"` (or the equivalent relative path from wherever it lives), rather than each individual constants file directly.

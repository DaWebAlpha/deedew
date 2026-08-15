# `src/services/` — Business Logic

**Where services fit, if you're new to this architecture:** this app follows a **route → controller → service → model** chain (see `docs/controllers.md` and `docs/routes.md`). Routes just decide *which* controller runs for a given URL/method. Controllers only translate HTTP ⇄ plain JavaScript — read `request.body`/`request.params`, call a service, shape the response. **Services are where the actual thinking happens**: validation, duplicate checks, calling the database, deciding what counts as an error. A controller never touches a Mongoose model directly — only a service does. This split means the exact same business logic could be reused by, say, a future admin CLI tool or a background job, without duplicating it.

## Index

**`auth/`** — registration, login, sessions, account self-service:
- [`register.service.js`](#registerservicejs)
- [`login.service.js`](#loginservicejs)
- [`refreshToken.service.js`](#refreshtokenservicejs)
- [`logout.service.js`](#logoutservicejs) / [`logoutAllDevices.service.js`](#logoutalldevicesservicejs)
- [`getCurrentUser.service.js`](#getcurrentuserservicejs) / [`changePassword.service.js`](#changepasswordservicejs)
- [`listSessions.service.js`](#listsessionsservicejs) / [`revokeSession.service.js`](#revokesessionservicejs-auth)
- [`auth/index.js`](#authindexjs)

**`admin/users/`** — admin user management:
- [`buildUserSearchFilter.js`](#builduserssearchfilterjs)
- [`getUser.service.js`](#getuserservicejs) and the three list services
- [`deleteUser.service.js`](#deleteuserservicejs) / [`restoreUser.service.js`](#restoreuserservicejs)
- [`banUser.service.js`](#banuserservicejs) and its three siblings (unban/suspend/unsuspend)
- [`getUserModerationStats.service.js`](#getusermoderationstatsservicejs)
- [`updateUserRole.service.js`](#updateuserroleservicejs)
- [`admin/users/index.js`](#adminusersindexjs)

**`admin/loginLogs/`, `admin/sessions/`, `admin/security/`, `admin/pings/`:**
- [`admin/loginLogs/`](#adminloginlogs)
- [`admin/sessions/`](#adminsessions)
- [`admin/security/`](#adminsecurity)
- [`admin/pings/`](#adminpings)

**Barrels:**
- [`admin/index.js`, `services/index.js`](#top-level-barrels)

---

## `register.service.js`

```js
import { BadRequestError, ConflictError } from "../../errors/index.js";
import {
    withTransaction, normalizeEmail, normalizeString, normalizeCountry,
    normalizePhoneNumber, generateAccessToken, generateRefreshToken,
} from "../../utils/index.js";
import { User, UserSecurity, LoginLog } from "../../models/index.js";
import { auditLogger } from "../../logger/pino.logger.js";

const resolveId = (doc) => doc?._id ?? doc?.id ?? null;

const registerUserService = async ({
    firstName, lastName, email, phoneNumber, country, password,
    deviceName = null, deviceId = null, userAgent = null, ipAddress = null,
} = {}) => {
    if (!firstName || !lastName || !email || !phoneNumber || !password) {
        throw new BadRequestError({ message: "None of the fields must be empty", code: "EMPTY_FIELDS" })
    }

    const normalizedCountry = normalizeCountry(country) || "GH";
    const phoneDetails = normalizePhoneNumber(normalizeString(phoneNumber), normalizedCountry);
    const normalizedPhoneNumber = phoneDetails?.e164 ?? null;
    const normalizedEmail = normalizeEmail(email);

    const [emailExists, phoneNumberExists] = await Promise.all([
        User.exists({email: normalizedEmail}),
        User.exists({phoneNumber: normalizedPhoneNumber}),
    ])

    if (emailExists) { throw new ConflictError({ message: "Email already exists", code: "EMAIL_EXISTS" }) }
    if (phoneNumberExists) { throw new ConflictError({ message: "Phone number already exists", code: "PHONE_NUMBER_EXISTS" }) }

    return withTransaction(async (session) => {
        let user;

        try{
            [user] = await User.create(
                [{ firstName, lastName, email, country, phoneNumber, password }],
                {session}
            )
        }catch(error){
            if (error.code === 11000) {
                const field = Object.keys(error.keyPattern ?? {})[0] ?? "field";
                throw new ConflictError({ message: `${field} already exists` });
            }
            if (error.name === "ValidationError") {
                const messages = Object.values(error.errors).map((e) => e.message);
                throw new BadRequestError({ message: messages.join("<br />") });
            }
            throw error;
        }

        const userId = resolveId(user);
        if (!userId) { throw new BadRequestError({ message: "User creation failed: missing user id" }); }

        const security = await UserSecurity.findOrCreateForUser(userId, {session});
        const accessToken = await generateAccessToken(userId.toString());
        const refreshToken = await generateRefreshToken({ userId, deviceName, deviceId, userAgent, ipAddress, session });

        auditLogger.info({ userId, deviceId }, "User registered");

        await LoginLog.create(
            [{ userId, identifier: email, success: true, deviceName, deviceId, userAgent, ipAddress }],
            { session }
        );

        return { user, security, accessToken, refreshToken, message: "User registered successfully" };
    })
}

export { registerUserService }
```

### What this does, top to bottom

This is the single most involved service in the app — it's worth reading in full, since nearly every pattern used elsewhere in `services/` shows up here first.

- **`resolveId(doc)`** — a tiny helper defined right in this file: `doc?._id ?? doc?.id ?? null`. Mongoose documents normally have `_id`, but this project's `toJSON` transform renames that to `id` — this helper works either way, whichever shape happens to be in hand, using `??` (nullish coalescing: "use the next option only if the current one is `null`/`undefined`").
- **Step 1 — presence check.** All five required fields must be truthy, or a single `BadRequestError` covers all of them (`EMPTY_FIELDS`) — the message doesn't say *which* field, since any is equally a client mistake at this stage.
- **Step 2 — normalize before checking for duplicates.** `normalizeCountry(country) || "GH"` defaults to Ghana if no country was given. `normalizePhoneNumber(...)` returns an object or `null` — `phoneDetails?.e164 ?? null` safely extracts just the canonical phone string (or `null` if the number was invalid, deferring the actual rejection to the model's own validator later). This exact line — using `.e164`, not the whole object — was a real bug fixed during this project's build: passing the whole object into a MongoDB string-field query throws a `CastError`.
- **Step 3 — duplicate check, run concurrently.** `Promise.all([...])` checks both the email and phone at the same time rather than one after another (see `docs/utils.md`'s `withTransaction.js` section for the same "run independent things concurrently" idea). Two separate `ConflictError`s give a precise reason for each case.
- **Step 4 — the transaction.** Everything from here on happens inside `withTransaction` (see `docs/utils.md`): create the `User`, the `UserSecurity` record, and a `LoginLog` entry all succeed together or all roll back together — never a `User` left behind with no matching security record.
  - `[user] = await User.create([{...}], {session})` — the array-wrapped form, required for `session` to actually apply (see `docs/models.md`).
  - The `try/catch` around creation translates two specific Mongoose failure modes into clean app errors: `error.code === 11000` is MongoDB's own raw duplicate-key error code (a backstop, in case two simultaneous registrations both passed the earlier `Promise.all` check before either had actually written — a real race condition the pre-check alone can't fully close, which is exactly why the *database's* `unique: true` index is the real guarantee, not the pre-check). `error.name === "ValidationError"` catches any schema validation failure (like an invalid phone number reaching the model's own validator) and joins every individual field error into one readable message.
  - `resolveId(user)` then a defensive `if (!userId)` — this should be unreachable in practice (a successful `User.create` always has an id), but guards against ever calling `.toString()` on `undefined` further down.
  - `UserSecurity.findOrCreateForUser(userId, {session})` — creates the paired security record inside the same transaction (see `docs/models.md`).
  - Token generation and the `LoginLog` entry happen last — registering is treated as an implicit first login, so the caller gets back a real, usable session immediately, without a separate login call.

### Used in this project

Called from exactly one place, `controllers/auth/register.controller.js`, which is wired to `POST /api/register` in `routes/auth/auth.routes.js`. See `docs/controllers.md` for the controller side.

---

## `login.service.js`

```js
import { User, UserSecurity, LoginLog } from "../../models/index.js";
import {
    generateAccessToken, generateRefreshToken, withTransaction,
    normalizeEmail, normalizePhoneNumber,
} from "../../utils/index.js";
import { UnauthenticatedError, BadRequestError, ForbiddenError } from "../../errors/index.js";
import { auditLogger } from "../../logger/pino.logger.js";

const resolveId = (doc) => doc?._id ?? doc?.id ?? null;

const loginUserService = async ({
    identifier, password, userAgent = null, ipAddress = null, deviceName = null, deviceId = null,
} = {}) => {
    if (!identifier || !password) {
        throw new BadRequestError({ message: "Enter either email or phone number and password", code: "EMAIL_OR_PHONE_AND_PASSWORD_REQUIRED" });
    }

    const normalizedIdentifier = identifier.includes("@")
        ? normalizeEmail(identifier)
        : normalizePhoneNumber(identifier, "GH")?.e164;

    const invalidCredentials = () => new UnauthenticatedError({ message: "Invalid credentials", code: "INVALID_CREDENTIALS" });

    const recordFailedAttempt = (userId, reason = "INVALID_CREDENTIALS") => LoginLog.create({
        userId: userId ?? null, identifier, success: false, reason, deviceName, deviceId, userAgent, ipAddress,
    });

    if (!normalizedIdentifier) { await recordFailedAttempt(null); throw invalidCredentials(); }

    const user = await User.findOne({
        $or: [{ email: normalizedIdentifier }, { phoneNumber: normalizedIdentifier }],
    }).select("+password");

    if (!user) { await recordFailedAttempt(null); throw invalidCredentials(); }

    const userId = resolveId(user);
    if (!userId) { await recordFailedAttempt(null); throw invalidCredentials(); }

    const security = await UserSecurity.findOrCreateForUser(userId);

    if (security.isBanned) {
        auditLogger.warn({ userId, deviceId }, "Login attempted on banned account");
        await recordFailedAttempt(userId, "ACCOUNT_BANNED");
        throw new ForbiddenError({ message: "This account has been banned.", code: "ACCOUNT_BANNED" });
    }

    if (security.isSuspended()) {
        auditLogger.warn({ userId, deviceId }, "Login attempted on suspended account");
        await recordFailedAttempt(userId, "ACCOUNT_SUSPENDED");
        throw new ForbiddenError({ message: `This account is suspended until ${security.suspendedUntil.toISOString()}.`, code: "ACCOUNT_SUSPENDED" });
    }

    if (security.isLocked()) {
        auditLogger.warn({ userId, deviceId }, "Login attempted on locked account");
        await recordFailedAttempt(userId, "ACCOUNT_TEMPORARILY_LOCKED");
        throw new ForbiddenError({ message: "Account is temporarily suspended. Please try again later", code: "ACCOUNT_TEMPORARILY_LOCKED" });
    }

    const isValidPassword = await user.comparePassword(password);

    if (!isValidPassword) {
        await security.registerFailedAttempt();
        await recordFailedAttempt(userId);
        throw invalidCredentials();
    }

    return withTransaction(async (session) => {
        await security.registerSuccessfulLogin({ ipAddress, session });

        const accessToken = await generateAccessToken(userId.toString());
        const refreshToken = await generateRefreshToken({ userId, deviceName, deviceId, userAgent, ipAddress, session });

        auditLogger.info({ userId, deviceId }, "User logged in");

        await LoginLog.create(
            [{ userId, identifier, success: true, deviceName, deviceId, userAgent, ipAddress }],
            { session },
        );

        return { user, security, accessToken, refreshToken, message: "Login successful" };
    });
};

export { loginUserService };
```

### What this does, top to bottom

The most defensive file in the app — worth understanding step by step, since it's the one place several distinct security mechanisms all meet.

- **`identifier.includes("@")`** — a simple heuristic to decide whether the user typed an email or a phone number, so the right normalizer runs on it: `normalizeEmail` for one, `normalizePhoneNumber(...)?.e164` for the other. If it's a phone number and turns out invalid, `normalizePhoneNumber` returns `null`, and `?.e164` short-circuits to `undefined` rather than throwing.
- **`recordFailedAttempt(userId, reason)`** — a small closure defined inline (it captures `identifier`/`deviceName`/etc. from the surrounding function automatically, so it doesn't need them passed in every time it's called). It's called from **five different failure points** below, each with a different `reason` string — this is what makes the `LoginLog` collection a genuinely complete audit trail, not just a record of successes.
- **The four early-exit checks, all before ever comparing a password:** unrecognized identifier format, no matching user, a user with no resolvable id (defensive, same reasoning as `register.service.js`) — all three throw the *same* generic `invalidCredentials()`. This is a deliberate security choice: telling an attacker "no account exists with that email" versus "wrong password" would let them enumerate which emails are registered at all, just by trying logins. Both cases look identical from the outside.
- **Account-standing checks — banned, then suspended, then locked, in that specific order, all before checking the password at all.** This means a banned/suspended/locked account is rejected even if the *correct* password was typed — being blocked isn't about credentials being wrong. Each branch is a `ForbiddenError` (403 — "I know who you are, but you're not allowed"), distinct from `UnauthenticatedError` (401 — "invalid credentials entirely"). Notice `security.isSuspended()` and `security.isLocked()` are called **as functions** — see `docs/models.md`'s `UserSecurity` section for why that distinction is critical (calling them as bare properties without `()` was a real, severe bug caught during this build: it would have locked out every login, for every account, permanently).
- **The actual password check**, only reached once every other guard has passed: `user.comparePassword(password)` (see `docs/models.md`'s `user.model.js` section). On failure: `security.registerFailedAttempt()` (which may itself trigger a lockout — see `docs/models.md`), a `LoginLog` entry, then the same generic `invalidCredentials()`.
- **The success path**, wrapped in `withTransaction`: reset the failed-attempt counter, issue fresh tokens, log the success — all atomically, the same reasoning as `register.service.js`.

### Used in this project

Called from `controllers/auth/login.controller.js`, wired to `POST /api/login` (behind `authRateLimiter` — see `docs/middleware.md`).

---

## `refreshToken.service.js`

```js
import { User } from "../../models/index.js";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken, withTransaction } from "../../utils/index.js";
import { UnauthenticatedError } from "../../errors/index.js";
import { auditLogger } from "../../logger/pino.logger.js";

const sessionExpired = () => new UnauthenticatedError({ message: "Session expired. Please log in again.", code: "REFRESH_TOKEN_INVALID" });

const refreshTokenService = async ({
    refreshToken, userAgent = null, ipAddress = null, deviceName = null, deviceId = null,
} = {}) => {
    if (!refreshToken) {
        throw new UnauthenticatedError({ message: "Authentication required", code: "AUTH_REQUIRED" });
    }

    return withTransaction(async (session) => {
        const record = await verifyRefreshToken(refreshToken);
        if (!record) { throw sessionExpired(); }

        const user = await User.findById(record.userId);
        if (!user || user.isDeleted) {
            await record.revoke();
            throw sessionExpired();
        }

        await record.revoke({ session });

        const newRefreshToken = await generateRefreshToken({ userId: user._id, userAgent, ipAddress, deviceName, deviceId, session });
        const accessToken = await generateAccessToken(user._id.toString());

        auditLogger.info({ userId: user._id }, "Access token refreshed");

        return { user, accessToken, refreshToken: newRefreshToken };
    });
};

export { refreshTokenService };
```

### What this does

Implements **refresh token rotation** — see `docs/models.md`'s `refreshToken.model.js` section for the security reasoning. The whole point of this file is the order of operations: **verify the old token → revoke the old token → issue a brand-new one**, all inside one transaction. This matters specifically because it's checking-and-acting on shared state: if two requests both tried to refresh using the same token at nearly the same instant (two browser tabs, say), the transaction ensures only one of them can win — the other's `record.revoke()` either doesn't find an already-revoked record active, or the transaction retry logic (see `docs/utils.md`'s `withTransaction.js`) handles the collision safely, rather than both requests successfully generating two different "new" tokens from the same now-dead old one.

`sessionExpired()` is a small factory function (not a value) so every place that needs this specific error creates a *fresh* instance — reusing one single error object across multiple throw sites is technically possible in JS but considered bad practice, since stack traces and other per-instance state would be misleadingly shared.

### Used in this project

Called from `controllers/auth/refreshToken.controller.js`, wired to `POST /api/refresh` — deliberately **not** behind `authenticate` middleware (a request with an *expired* access token still needs to be able to hit this endpoint to get a new one) and not behind `authRateLimiter` either.

---

## `logout.service.js`

```js
import { auditLogger } from "../../logger/pino.logger.js";
import { UnauthenticatedError } from "../../errors/index.js";
import { hashToken } from "../../utils/index.js";
import { RefreshToken } from "../../models/index.js";

const logoutService = async ({
    userId, refreshToken, ipAddress = null, userAgent = null, deviceName = null, deviceId = null,
} = {}) => {
    if (!userId) {
        throw new UnauthenticatedError({ message: "Authentication required", code: "AUTH_REQUIRED" });
    }

    if (refreshToken) {
        const tokenHash = hashToken(refreshToken);
        const record = await RefreshToken.findOne({ tokenHash, userId });

        if (record && record.isActive()) {
            await record.revoke();
        }
    }

    auditLogger.info({ userId, ipAddress, userAgent, deviceName, deviceId }, "User successfully logged out");

    return { message: "User logged out successfully" };
};

export { logoutService };
```

Revokes just the one session tied to the refresh-token cookie sent with this specific logout request (not every session the user has). `RefreshToken.findOne({ tokenHash, userId })` — matching on *both* fields is a deliberate ownership check, same idea as `revokeSession.service.js` below, just written inline rather than via `fetchOrNotFound`. `if (record && record.isActive())` treats "no cookie sent," "cookie doesn't match any record," and "already revoked" all the same way — silently succeed rather than error, since the end state the caller wants (no longer logged in) is already true either way.

### Used in this project

`controllers/auth/logout.controller.js`, behind `authenticate` — `request.user.userId` supplies `userId` here, which is why this can't be reached without a valid session in the first place.

---

## `logoutAllDevices.service.js`

```js
import { auditLogger } from "../../logger/pino.logger.js";
import { UnauthenticatedError } from "../../errors/index.js";
import { RefreshToken } from "../../models/index.js";

const logoutAllDevicesService = async ({ userId, ipAddress = null, userAgent = null } = {}) => {
    if (!userId) {
        throw new UnauthenticatedError({ message: "Authentication required", code: "AUTH_REQUIRED" });
    }

    const result = await RefreshToken.updateMany(
        { userId, revokedAt: null },
        { $set: { revokedAt: new Date() } },
    );

    auditLogger.info({ userId, ipAddress, userAgent, revokedCount: result.modifiedCount }, "User logged out of all devices");

    return { message: "Logged out of all devices successfully", revokedCount: result.modifiedCount };
};

export { logoutAllDevicesService };
```

The batch version — `updateMany` flips `revokedAt` on **every** currently-active session for the user in one database round trip, rather than loading and calling `.revoke()` on each individually. `result.modifiedCount` (a real field Mongoose's `updateMany` returns) tells the caller exactly how many sessions were actually killed. This exact `RefreshToken.updateMany({userId, revokedAt: null}, {$set: {revokedAt: new Date()}})` shape is reused, unchanged, by `changePassword.service.js` and the admin `banUser.service.js`/`suspendUser.service.js`.

### Used in this project

`controllers/auth/logoutAllDevices.controller.js`, behind `authenticate`.

---

## `getCurrentUser.service.js`

```js
import { User } from "../../models/index.js";
import { UnauthenticatedError } from "../../errors/index.js";

const getCurrentUserService = async ({ userId } = {}) => {
    const user = await User.findById(userId);

    if (!user || user.isDeleted) {
        throw new UnauthenticatedError({ message: "Account no longer exists", code: "USER_NOT_FOUND" });
    }

    return { user };
};

export { getCurrentUserService };
```

The simplest service in the app: given a `userId` (always supplied from `request.user.userId`, meaning `authenticate` already ran and verified this exact same thing once already), fetch the full profile. The `!user || user.isDeleted` re-check might look redundant right after `authenticate` just did the same check — but it isn't: it's an independent safety net in case this service is ever called from somewhere that *doesn't* go through `authenticate` first.

### Used in this project

`controllers/auth/getCurrentUser.controller.js`, wired to `GET /api/me`.

---

## `changePassword.service.js`

```js
import { User, RefreshToken } from "../../models/index.js";
import { BadRequestError, UnauthenticatedError } from "../../errors/index.js";
import { withTransaction } from "../../utils/index.js";
import { auditLogger } from "../../logger/pino.logger.js";

const changePasswordService = async ({ userId, currentPassword, newPassword } = {}) => {
    if (!currentPassword || !newPassword) {
        throw new BadRequestError({ message: "Current password and new password are required", code: "MISSING_PASSWORD_FIELDS" });
    }

    const user = await User.findById(userId).select("+password");

    if (!user || user.isDeleted) {
        throw new UnauthenticatedError({ message: "Account no longer exists", code: "USER_NOT_FOUND" });
    }

    const isValidPassword = await user.comparePassword(currentPassword);

    if (!isValidPassword) {
        throw new BadRequestError({ message: "Current password is incorrect", code: "INVALID_CURRENT_PASSWORD" });
    }

    return withTransaction(async (session) => {
        user.password = newPassword;
        await user.save({ session });

        await RefreshToken.updateMany(
            { userId, revokedAt: null },
            { $set: { revokedAt: new Date() } },
        ).session(session);

        auditLogger.info({ userId }, "Password changed, all sessions revoked");

        return { message: "Password changed successfully. Please log in again." };
    });
};

export { changePasswordService };
```

### Line by line, the parts worth noting

- `.select("+password")` — required here, same reasoning as in `login.service.js`: `comparePassword` needs the actual hash loaded to check the current password.
- `user.password = newPassword; await user.save({ session });` — this alone is enough to hash the new password: assigning to `.password` and calling `.save()` triggers the model's own `pre("save")` hook (see `docs/models.md`), which detects `isModified("password")` and re-hashes it automatically. `changePasswordService` never calls `hashPassword` itself.
- `RefreshToken.updateMany(...).session(session)` — revokes every one of this user's active sessions, *including the one making this very request* — this is a deliberate security choice: changing your password should force every device to log in again with the new password, no exceptions. `controllers/auth/changePassword.controller.js` also clears the current request's own cookies right after this, to match.

### Used in this project

`controllers/auth/changePassword.controller.js`, wired to `PATCH /api/change-password`, behind `authenticate`.

---

## `listSessions.service.js`

```js
import { RefreshToken } from "../../models/index.js";

const listSessionsService = async ({ userId } = {}) => {
    const sessions = await RefreshToken.find({
        userId, revokedAt: null, expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    return { sessions };
};

export { listSessionsService };
```

A plain, unpaginated list — deliberately simple, since one user is never expected to have more than a handful of active sessions at once (unlike the admin "all sessions system-wide" equivalent in `admin/sessions/`, which genuinely needs pagination). `revokedAt: null, expiresAt: { $gt: new Date() }` is the same "still genuinely active" condition used throughout the app.

### Used in this project

`controllers/auth/listSessions.controller.js`, wired to `GET /api/sessions` — lets a logged-in user see their own active devices/sessions.

---

## `revokeSession.service.js` (auth)

```js
import { RefreshToken } from "../../models/index.js";
import { fetchOrNotFound } from "../../utils/index.js";

const revokeSessionService = async ({ userId, sessionId } = {}) => {
    const session = await fetchOrNotFound(RefreshToken, sessionId, {
        idMessage: "Session id is required", idCode: "SESSION_ID_REQUIRED",
        notFoundMessage: "Session not found", notFoundCode: "SESSION_NOT_FOUND",
        filter: { userId },
    });

    if (session.isActive()) {
        await session.revoke();
    }

    return { message: "Session revoked successfully" };
};

export { revokeSessionService };
```

Lets a user revoke one *specific* session of their own (from the list `listSessionsService` returns) — e.g. "log out that old phone I lost." The critical line is `filter: { userId }` passed into `fetchOrNotFound` (see `docs/utils.md`): this makes the database lookup itself require the session to belong to the *calling* user — someone can't revoke another user's session just by guessing/trying a different session id, because the query genuinely wouldn't match it at all, and this would correctly respond `404 Session not found` rather than leaking whether that id exists for someone else.

**Naming note:** there's a *second*, differently-scoped version of this exact idea in `services/admin/sessions/revokeSession.service.js` — the admin one (renamed `adminRevokeSessionService` to avoid a real naming collision this project hit — see that file's own section below), which can revoke *any* user's session, not just your own.

### Used in this project

`controllers/auth/revokeSession.controller.js`, wired to `DELETE /api/sessions/:sessionId`.

---

## `auth/index.js`

```js
export { registerUserService } from "./register.service.js";
export { loginUserService } from "./login.service.js";
export { refreshTokenService } from "./refreshToken.service.js";
export { logoutService } from "./logout.service.js";
export { logoutAllDevicesService } from "./logoutAllDevices.service.js";
export { getCurrentUserService } from "./getCurrentUser.service.js";
export { changePasswordService } from "./changePassword.service.js";
export { listSessionsService } from "./listSessions.service.js";
export { revokeSessionService } from "./revokeSession.service.js";
```

The barrel for everything above — every auth controller imports from `"../../services/index.js"` (the top-level barrel, which re-exports this one — see the very end of this document), never from an individual service file directly.

---

## `buildUserSearchFilter.js`

```js
const buildUserSearchFilter = ({ role, search } = {}) => {
    const filter = {};

    if (role) {
        filter.role = role;
    }

    if (search) {
        const pattern = new RegExp(search.trim(), "i");
        filter.$or = [
            { firstName: pattern },
            { lastName: pattern },
            { email: pattern },
        ];
    }

    return filter;
};

export { buildUserSearchFilter };
```

### What this does

Not a full service itself — a small shared helper used by all three `admin/users` list services (below), so admin list endpoints can be filtered/searched instead of just paginated.

- `if (role) { filter.role = role; }` — an exact match: `?role=admin` only returns admins.
- `new RegExp(search.trim(), "i")` — builds a real JavaScript regular expression *at runtime*, from the search text an admin typed. The `"i"` flag makes it case-insensitive. Passing a `RegExp` object as a MongoDB filter value (rather than a plain string) tells MongoDB to do a **partial, pattern match** rather than requiring an exact match — so searching `"kwa"` matches `"Kwame"`.
- `filter.$or = [{firstName: pattern}, {lastName: pattern}, {email: pattern}]` — MongoDB's `$or` operator: match if *any* of these three fields matches the pattern. One search box, three fields checked.

### Used in this project

Called (never as a route/controller target itself, only as a helper) inside `getAllActiveUsers.service.js`, `getAllDeletedUsers.service.js`, and `getAllUsersIncludingDeleted.service.js` — see those three below.

---

## `getUser.service.js`, and the three `getAll*Users.service.js` files

```js
// getUser.service.js
import { User } from "../../../models/index.js";
import { fetchOrNotFound } from "../../../utils/index.js";

const getUserService = async ({ userId } = {}) => {
    const user = await fetchOrNotFound(User, userId, {
        idMessage: "UserId is required", idCode: "USER_ID_REQUIRED",
        notFoundMessage: "No user exists", notFoundCode: "NO_USER_EXISTS",
    });
    return { user };
};

export { getUserService };
```

Fetch one specific user by id — regardless of deleted/active status, since an admin needs to be able to look up a user's details even if they're currently soft-deleted (e.g., before deciding whether to restore them).

The three list services all share one shape — `getAllActiveUsers.service.js` shown as the representative:
```js
import { User } from "../../../models/index.js";
import { NotFoundError } from "../../../errors/index.js";
import { buildUserSearchFilter } from "./buildUserSearchFilter.js";

const getAllActiveUsersService = async ({ role, search, page = 1, limit = 50 } = {}) => {
    const result = await User.paginate({
        filter: { ...buildUserSearchFilter({ role, search }), isDeleted: false },
        page, limit
    })

    if(!result.data.length){
        throw new NotFoundError({ message: "No active users exist yet", code: "NO_ACTIVE_USERS_EXIST" })
    }

    return { result, message: "Active users successfully retrieved" }
}
```
`getAllDeletedUsersService` is identical except `isDeleted: true` and its own message/code. `getAllUsersIncludingDeletedService` is identical except `isDeleted: { $in: [true, false] }` (explicitly matching both, which is the correct way to bypass `.paginate()`'s own default-to-`isDeleted: false` behavior — see `docs/models.md`'s `pagination.helper.js` section for why `$in: [true, false]` is needed here rather than just omitting `isDeleted` — omitting it entirely would fall right back into that same default). All three merge in `buildUserSearchFilter({ role, search })` first, so an admin can combine "only admins" + "matching this search text" + "only active/only deleted/all" in one request.

### Used in this project

`getUserService` → `controllers/admin/users/getUser.controller.js` → `GET /api/admin/users/:userId`.
The three list services → their matching controllers → `GET /api/admin/users` (active), `GET /api/admin/users/deleted` (superadmin-only), `GET /api/admin/users/all` (superadmin-only). Each controller passes `role`/`search`/`page`/`limit` straight from `request.query`.

---

## `deleteUser.service.js` / `restoreUser.service.js`

```js
// deleteUser.service.js
import { User } from "../../../models/index.js";
import { fetchOrNotFound }  from "../../../utils/index.js"
import { auditLogger } from "../../../logger/pino.logger.js";

const deleteUserService = async ({ userId, deletedByUserId = null, reason = null } = {}) => {
    const user = await fetchOrNotFound(User, userId);
    await user.softDelete({ deletedByUserId, reason })
    auditLogger.info({ deletedBy: deletedByUserId, userDeleted: userId, reason }, "User successfully deleted")
    return { message: "User successfully deleted" }
}
```
```js
// restoreUser.service.js
import { User } from "../../../models/index.js";
import { fetchOrNotFound } from "../../../utils/index.js";
import { auditLogger } from "../../../logger/pino.logger.js";

const restoreUserService = async ({ userId, restoreUserId = null, reason = null } = {}) => {
    const user = await fetchOrNotFound(User, userId, {
        idMessage: "UserId is required", idCode: "USER_ID_REQUIRED",
        notFoundMessage: "No user exists to restore", notFoundCode: "NO_USER_EXISTS_TO_RESTORE",
    });
    await user.restore({ restoreUserId, reason });
    auditLogger.info({ restoredBy: restoreUserId, userRestored: userId, reason }, "User successfully restored");
    return { message: "User successfully restored" };
};
```

The exact "fetch, then call the instance method `createSchema()` gave every model, then log it" shape (see `docs/models.md`'s `softDelete.helper.js`/`restore.helper.js` sections for what `.softDelete()`/`.restore()` actually do). This same three-step shape — `fetchOrNotFound` → call the model method → `auditLogger.info` — repeats across nearly every admin action in this app; once it clicks here, every sibling file below is just this same shape with a different method/message.

### Used in this project

`DELETE /api/admin/users/:userId` and `POST /api/admin/users/:userId/restore` (the latter superadmin-only — see `docs/constants.md`'s permissions table).

---

## `banUser.service.js` and its three siblings

```js
// banUser.service.js
import { User, UserSecurity, RefreshToken } from "../../../models/index.js";
import { fetchOrNotFound, withTransaction } from "../../../utils/index.js";
import { auditLogger } from "../../../logger/pino.logger.js";

const banUserService = async ({ userId, bannedByUserId = null, reason = null } = {}) => {
    await fetchOrNotFound(User, userId, {
        idMessage: "UserId is required", idCode: "USER_ID_REQUIRED",
        notFoundMessage: "No user exists to ban", notFoundCode: "NO_USER_EXISTS_TO_BAN",
    });

    return withTransaction(async (session) => {
        const security = await UserSecurity.findOrCreateForUser(userId, { session });
        await security.ban({ bannedByUserId, reason, session });

        await RefreshToken.updateMany(
            { userId, revokedAt: null },
            { $set: { revokedAt: new Date() } },
        ).session(session);

        auditLogger.info({ userId, bannedBy: bannedByUserId, reason }, "User banned");
        return { message: "User banned successfully" };
    });
};

export { banUserService };
```

### What's happening, and why it needs a transaction

This is a two-part action wrapped atomically: **(1)** mark the user as banned on their `UserSecurity` record, and **(2)** immediately kill every one of their active sessions — the same `RefreshToken.updateMany` shape seen in `logoutAllDevices.service.js`. Both are wrapped in `withTransaction` so a ban can never "half-apply" — either the account is banned *and* logged out everywhere, or (on any failure) neither happened at all. Without this, a crash between step 1 and step 2 could leave someone banned but still holding a perfectly valid, still-active session.

`suspendUser.service.js` follows the identical shape, with two additions:
```js
// suspendUser.service.js — the parts that differ from banUser
const until = new Date(suspendedUntil);

if (!suspendedUntil || Number.isNaN(until.getTime()) || until.getTime() <= Date.now()) {
    throw new BadRequestError({ message: "suspendedUntil must be a valid future date", code: "INVALID_SUSPENSION_DATE" });
}
// ...then the same fetchOrNotFound + withTransaction + security.suspend({...}) + RefreshToken.updateMany shape
```
`new Date(suspendedUntil)` parses whatever string the admin sent; `Number.isNaN(until.getTime())` catches a genuinely unparseable date (`new Date("garbage")` produces an "Invalid Date," whose `.getTime()` is `NaN`); `until.getTime() <= Date.now()` rejects a date that's already in the past — a "suspension" that already expired makes no sense to create.

`unbanUser.service.js` and `unsuspendUser.service.js` are simpler than their opposites — no transaction, no session revocation (lifting a restriction doesn't need to force a logout):
```js
// unbanUser.service.js
const unbanUserService = async ({ userId, unbannedByUserId = null, reason = null } = {}) => {
    await fetchOrNotFound(User, userId, {...});
    const security = await UserSecurity.findOrCreateForUser(userId);
    await security.unban({ unbannedByUserId, reason });
    auditLogger.info({ userId, unbannedBy: unbannedByUserId, reason }, "User unbanned");
    return { message: "User unbanned successfully" };
};
```
`unsuspendUser.service.js` is the same shape, calling `security.unsuspend({...})` instead.

### Used in this project

`POST /api/admin/users/:userId/ban`, `/unban`, `/suspend` (body: `{ reason, suspendedUntil }`), `/unsuspend`.

---

## `getUserModerationStats.service.js`

```js
import { UserSecurity } from "../../../models/index.js";

const getUserModerationStatsService = async () => {
    const [bannedCount, suspendedCount] = await Promise.all([
        UserSecurity.countDocuments({ isBanned: true }),
        UserSecurity.countDocuments({ suspendedUntil: { $gt: new Date() } }),
    ]);

    return { bannedCount, suspendedCount };
};

export { getUserModerationStatsService };
```

A small dashboard-style summary. `countDocuments` is Mongoose's efficient count-only query — it never actually loads the matching documents into memory, just counts them server-side. `suspendedUntil: { $gt: new Date() }` specifically counts only *currently* suspended users — someone whose suspension already expired doesn't count, even though their `UserSecurity` record still technically has an (old, past) `suspendedUntil` value sitting in it.

### Used in this project

`GET /api/admin/users/stats`.

---

## `updateUserRole.service.js`

```js
import { User } from "../../../models/index.js";
import { fetchOrNotFound } from "../../../utils/index.js";
import { BadRequestError, ForbiddenError } from "../../../errors/index.js";
import { auditLogger } from "../../../logger/pino.logger.js";

const ALLOWED_ROLES = ["customer", "admin", "superadmin"];

const updateUserRoleService = async ({ userId, role, updatedByUserId = null } = {}) => {
    if (!ALLOWED_ROLES.includes(role)) {
        throw new BadRequestError({ message: `Role must be one of: ${ALLOWED_ROLES.join(", ")}`, code: "INVALID_ROLE" });
    }

    if (updatedByUserId && userId === updatedByUserId) {
        throw new ForbiddenError({ message: "You cannot change your own role", code: "CANNOT_CHANGE_OWN_ROLE" });
    }

    const user = await fetchOrNotFound(User, userId, {
        idMessage: "UserId is required", idCode: "USER_ID_REQUIRED",
        notFoundMessage: "No user exists", notFoundCode: "NO_USER_EXISTS",
    });

    const previousRole = user.role;
    user.role = role;
    user.updatedBy = updatedByUserId;
    await user.save();

    auditLogger.info({ userId, previousRole, newRole: role, updatedBy: updatedByUserId }, "User role changed");

    return { message: "User role updated successfully", user };
};

export { updateUserRoleService };
```

### Why this one needs its own careful design

Role changes are a **privilege-escalation** risk — this is the single most sensitive action in the whole admin surface, which is exactly why it's gated to `superadmin` only (see `docs/constants.md`'s permissions table, `PERMISSIONS.USER_UPDATE_ROLE`).

- `ALLOWED_ROLES.includes(role)` — a clean, explicit check *before* touching the database at all. (Mongoose's own `enum` validator on `User.role` would eventually catch an invalid role too, but failing here gives an immediate, specific `INVALID_ROLE` error rather than surfacing as a generic validation error later.)
- **`if (updatedByUserId && userId === updatedByUserId)` — the self-lockout guard.** A superadmin is blocked from changing their *own* role, full stop — even to another valid role. This exists specifically to prevent a superadmin from accidentally demoting themselves (or, in a shared-account scenario, someone abusing access to quietly self-promote further) and losing the ability to fix it, since there'd be no other superadmin action available to undo it from that same account. If a role genuinely needs to change, a *different* superadmin has to do it.
- **No token/session revocation needed here** — unlike ban/suspend. This is explained in `docs/utils.md`'s `jwt.js` section: the access token JWT only ever encodes `userId`, never `role`. `authenticate` middleware re-fetches the user's *current* role from the database on every single request — so a role change takes effect on the user's very next request, automatically, with nothing extra to invalidate.

### Used in this project

`PATCH /api/admin/users/:userId/role`, body `{ "role": "admin" }`.

---

## `admin/users/index.js`

```js
export { getUserService } from "./getUser.service.js";
export { getAllActiveUsersService } from "./getAllActiveUsers.service.js";
export { getAllDeletedUsersService } from "./getAllDeletedUsers.service.js";
export { getAllUsersIncludingDeletedService } from "./getAllUsersIncludingDeleted.service.js";
export { deleteUserService } from "./deleteUser.service.js";
export { restoreUserService } from "./restoreUser.service.js";
export { banUserService } from "./banUser.service.js";
export { unbanUserService } from "./unbanUser.service.js";
export { suspendUserService } from "./suspendUser.service.js";
export { unsuspendUserService } from "./unsuspendUser.service.js";
export { getUserModerationStatsService } from "./getUserModerationStats.service.js";
export { updateUserRoleService } from "./updateUserRole.service.js";
```

The barrel for this whole folder (`buildUserSearchFilter` isn't exported here — it's a private helper, only ever imported directly by its three sibling files, never used outside this folder).

---

## `admin/loginLogs/`

Two services, both thin wrappers around `paginateQuery` (see `docs/utils.md` for why `LoginLog` uses this instead of `.paginate()`):

```js
// getUsersLoginLogs.service.js — every user's logs, admin-wide
const result = await paginateQuery({ model: LoginLog, filter, page, limit })
```
```js
// getUserLoginLogs.service.js — one specific user's logs
const result = await paginateQuery({ model: LoginLog, filter: { userId }, page, limit })
```
The single-user version additionally validates `userId` is present first (`BadRequestError` if not) — the "all users" version has no such id to validate.

### Used in this project

`GET /api/admin/login-logs` and `GET /api/admin/login-logs/:userId`.

---

## `admin/sessions/`

Four services, mirroring the pattern already explained in `services/auth/listSessions.service.js`/`revokeSession.service.js`, but admin-scoped (any user, not just the caller):

- **`getAllActiveSessions.service.js`** — `RefreshToken.paginate({ filter: { revokedAt: null, expiresAt: { $gt: new Date() } }, ... })` — every currently-active session, system-wide.
- **`getUserSessions.service.js`** — the same filter, narrowed with `userId`.
- **`revokeSession.service.js`** — exports `adminRevokeSessionService` (not `revokeSessionService` — deliberately renamed). This is the exact same `fetchOrNotFound(RefreshToken, sessionId, {...})` + `.revoke()` shape as the auth version, but **without** `filter: { userId }` — an admin can revoke *any* session, not just their own. **A real naming collision hit during this project's build:** both this file and `services/auth/revokeSession.service.js` originally exported a function called `revokeSessionService`. Since both flow into the same flat `services/index.js` barrel via `export *`, Node's module loader treated that as two conflicting exports of the same name and crashed the whole app on startup with a `SyntaxError`. Renaming this one to `adminRevokeSessionService` (and its controller to match) fixed it — worth remembering as a reason to name admin-scoped and self-scoped versions of the same action distinctly from the start.
- **`revokeUserSessions.service.js`** — the batch version, identical in shape to `logoutAllDevices.service.js`, just callable against any user by an admin rather than only against yourself.

### Used in this project

`GET /api/admin/sessions`, `GET /api/admin/sessions/user/:userId`, `DELETE /api/admin/sessions/user/:userId` (revoke all), `DELETE /api/admin/sessions/:sessionId` (revoke one).

---

## `admin/security/`

Two services, giving an admin direct visibility into (and one specific manual override of) a user's raw `UserSecurity` record:

```js
// getUserSecurity.service.js
const security = await UserSecurity.findOrCreateForUser(userId);
return { security };
```
A direct read of everything tracked on that model (see `docs/models.md`) — failed-attempt count, lockout status, full ban/suspend history — in one response, rather than admins having to piece it together from separate ban/suspend/stats endpoints.

```js
// clearUserLockout.service.js — the part that differs from a plain read
security.failedLoginAttempts = 0;
security.lockedUntil = null;
await security.save({ validateBeforeSave: false });
```
A manual override for the *automatic* lockout system specifically (not bans/suspensions, which have their own dedicated unban/unsuspend actions) — lets an admin immediately clear a lockout an automated failed-login streak triggered, rather than the affected user having to simply wait out the 15-minute window.

### Used in this project

`GET /api/admin/security/:userId` and `POST /api/admin/security/:userId/clear-lockout`.

---

## `admin/pings/`

Six services — the exact same six-function shape as `admin/users/` (`getPing`, `getAllActivePings`, `getAllDeletedPings`, `getAllPingsIncludingDeleted`, `deletePing`, `restorePing`), applied to the simpler `Ping` model instead of `User`. The only structural difference: no `buildUserSearchFilter`-equivalent (a `Ping` only has one field, `message`, so there's nothing meaningful to build a multi-field search filter out of yet), and no ban/suspend/role-equivalent actions, since none of those concepts apply to a `Ping`.

### Used in this project

`GET /api/admin/pings`, `/deleted`, `/all`, `GET /api/admin/pings/:pingId`, `DELETE /api/admin/pings/:pingId`, `POST /api/admin/pings/:pingId/restore`.

---

## Top-level barrels

```js
// services/admin/index.js
export * from "./users/index.js";
export * from "./loginLogs/index.js";
export * from "./sessions/index.js";
export * from "./security/index.js";
export * from "./pings/index.js";
```
```js
// services/index.js
export * from "./auth/index.js";
export * from "./admin/index.js";
```

Two more `export *` barrels, chained the same way `models/index.js` is (see `docs/models.md`). This is the single file (`services/index.js`) nearly every controller in the entire app actually imports from — `import { loginUserService } from "../../services/index.js";` — regardless of how deep the real implementation file is nested.

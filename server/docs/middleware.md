# `src/middleware/` — Express Middleware

**What "middleware" means, if you're new to Express:** a middleware is just a function that runs *in between* an incoming request and your actual route handler (the controller). Every middleware gets three things — `request`, `response`, and `next` — and it must eventually call `next()` (to let the request continue on to whatever's registered after it) or send a response itself (ending the request there). Express runs every registered middleware **in the order it was added** with `app.use(...)`, which is why the order things are wired up in `app.js` matters so much throughout this project.

## Index

- [`authenticate.middleware.js`](#authenticatemiddlewarejs) — `authenticate`, `optionalAuthenticate`
- [`role.middleware.js`](#rolemiddlewarejs) — `roleMiddleware`
- [`rateLimit.middleware.js`](#ratelimitmiddlewarejs) — `authRateLimiter`
- [`errorHandler.middleware.js`](#errorhandlermiddlewarejs) — `errorHandler`
- [`notFound.middleware.js`](#notfoundmiddlewarejs) — `notFound`
- [`index.js`](#indexjs) — the barrel

---

## `authenticate.middleware.js`

```js
import { verifyAccessToken } from "../utils/index.js";
import { config } from "../config/index.js";
import { UnauthenticatedError } from "../errors/index.js";
import { User } from "../models/index.js";

const resolveAuthenticatedUser = async (token) => {
    const decoded = await verifyAccessToken(token);

    const user = await User.findById(decoded.userId).select("role isSeller isDeleted");

    if (!user || user.isDeleted) {
        throw new UnauthenticatedError({
            message: "Account no longer exists",
            code: "USER_NOT_FOUND",
        });
    }

    return {
        userId: decoded.userId,
        role: user.role,
    };
};

const authenticate = async (request, response, next) => {
    try {
        const token = request.cookies?.[config.accessTokenCookie];

        if (!token) {
            throw new UnauthenticatedError({
                message: "Authentication required",
                code: "AUTH_REQUIRED",
            });
        }

        request.user = await resolveAuthenticatedUser(token);

        next();
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return next(new UnauthenticatedError({
                message: "Access token expired",
                code: "ACCESS_TOKEN_EXPIRED",
            }));
        }

        if (error.name === "JsonWebTokenError") {
            return next(new UnauthenticatedError({
                message: "Invalid access token",
                code: "INVALID_ACCESS_TOKEN",
            }));
        }

        next(error);
    }
};

const optionalAuthenticate = async (request, response, next) => {
    try {
        const token = request.cookies?.[config.accessTokenCookie];

        if (!token) {
            return next();
        }

        request.user = await resolveAuthenticatedUser(token);

        next();
    } catch (error) {
        next();
    }
};

export { authenticate, optionalAuthenticate };
```

### What problem this solves

This is the gatekeeper for every protected route in the app — the piece that turns "a cookie sitting on an incoming request" into "here's a real, currently-valid, non-deleted user, attached to `request.user` for every later piece of code in this request to use."

### Line by line

- **`resolveAuthenticatedUser(token)`** — the shared logic both `authenticate` and `optionalAuthenticate` rely on.
  - `verifyAccessToken(token)` — checks the JWT's signature and expiry (see `docs/utils.md`'s `jwt.js` section). If the token is invalid or expired, this line itself throws — caught further down.
  - `User.findById(decoded.userId).select("role isSeller isDeleted")` — this is a deliberate, real database read on **every single authenticated request**, not just a check of what's inside the JWT. `.select(...)` here restricts which fields come back — only what's actually needed for this check, not the entire user document (an efficiency detail, and it also means this query never even touches the `password` field).
  - `if (!user || user.isDeleted)` — this is *why* the extra database read is worth the cost: a JWT alone only proves "this token was validly signed for this user id at some point in the last 15 minutes" — it says nothing about whether that account has since been deleted (or, once role changes were added, whether their role has changed). Re-checking the database on every request means a deleted account loses access **immediately**, rather than only once its already-issued access token naturally expires.
  - The returned object — `{ userId, role }` — deliberately does *not* include the full user document, or anything sensitive; it's just enough for downstream code (especially `roleMiddleware`) to make decisions.
- **`authenticate(request, response, next)`** — the strict version, used on every route that should flatly reject an unauthenticated request.
  - `request.cookies?.[config.accessTokenCookie]` — reads the access token out of the request's cookies (this is why `cookie-parser` middleware has to run *before* this one in `app.js` — without it, `request.cookies` wouldn't exist at all). The `?.` guards against `request.cookies` itself being `undefined`.
  - `if (!token) { throw ... }` — no cookie at all is treated the same as "not logged in."
  - `request.user = await resolveAuthenticatedUser(token);` — this is the line that actually attaches identity to the request — every controller downstream reads `request.user.userId` / `request.user.role` from here.
  - `next();` — only reached if nothing above threw; lets the request continue on to the actual route.
  - **The `catch` block translates specific error types into specific responses:** `error.name === "TokenExpiredError"` and `error.name === "JsonWebTokenError"` are the exact error class names Node's `jsonwebtoken` library throws (from inside `verifyAccessToken`) for an expired vs. a tampered/malformed token respectively — this `catch` gives each one its own distinct, clean error code (`ACCESS_TOKEN_EXPIRED` vs `INVALID_ACCESS_TOKEN`) rather than lumping every failure into one generic message. Any *other* kind of error (like the `USER_NOT_FOUND` thrown inside `resolveAuthenticatedUser`) falls through to the final `next(error)`, which is exactly what forwards it to the app's central `errorHandler`.
- **`optionalAuthenticate(request, response, next)`** — a deliberately looser sibling, for routes that behave differently for a logged-in user versus a guest, but must never outright reject a guest. The structure is almost identical, with two key differences: `if (!token) { return next(); }` (no token just means "continue as a guest," not an error), and the `catch` block calls plain `next()` with no argument at all — swallowing *any* failure (expired token, invalid token, deleted account) and just letting the request continue with `request.user` left unset, rather than blocking it. Not currently wired to any route in this project yet, but available the moment a guest-vs-owner route is built.

### Used in this project

`authenticate` is applied to every route that requires a logged-in user — nearly all of `routes/auth/auth.routes.js` (everything except `/register`, `/login`, `/refresh`) and every single route in `routes/admin/*.routes.js`:
```js
// routes/auth/auth.routes.js
authRouter.post("/logout", authenticate, logoutController);
authRouter.get("/me", authenticate, getCurrentUserController);
```
```js
// routes/admin/users.routes.js
adminUsersRouter.post("/:userId/ban", authenticate, roleMiddleware(PERMISSIONS.USER_BAN), banUserController);
```
Notice the second example stacks **two** middleware before the controller — `authenticate` runs first (confirming *who* is making the request), and only if that succeeds does `roleMiddleware(...)` run next (confirming *that specific user* is allowed to do *this specific thing*). That ordering — identity first, permission second — is the same in every protected route in this project.

---

## `role.middleware.js`

```js
import { HTTP_STATUS, ROLE_PERMISSIONS } from "../constants/index.js";

const roleMiddleware = (...requiredPermission) => {
    return (request, response, next) => {
        if(!request.user){
            return response.status(HTTP_STATUS.UNAUTHENTICATED).json({
                success: false,
                message: "Authentication required"
            })
        }

        const userPermissions = ROLE_PERMISSIONS[request.user.role] || [];

        const hasPermission = requiredPermission.some(
            (permission) => userPermissions.includes(permission)
        );

        if(!hasPermission){
            return response.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                message: "You do not have permission to perform this action"
            })
        }

        next();
    }
}

export { roleMiddleware };
```

### What problem this solves

`authenticate` answers *"who is this?"* — `roleMiddleware` answers *"is this specific person allowed to do this specific thing?"*. Both are needed; they're deliberately kept as two separate middleware rather than combined, so a route can require *identity* without necessarily requiring any specific *permission* (like `GET /api/auth/me`, which just needs `authenticate`).

### Line by line

- **`roleMiddleware(...requiredPermission)`** — this outer function isn't itself a middleware; it's a **middleware factory** — a function that *returns* a middleware, customized by whatever arguments it was called with. `...requiredPermission` is **rest syntax**: it collects every argument passed into an array. So `roleMiddleware(PERMISSIONS.USER_BAN)` produces `requiredPermission = ["user:ban"]`, and `roleMiddleware(PERMISSIONS.A, PERMISSIONS.B)` would produce `["A's value", "B's value"]` — a route could require *any one of several* permissions, though every current route in this project only ever passes exactly one.
- `return (request, response, next) => {...}` — this inner function is the *actual* middleware Express calls on every matching request. This two-layer function shape (`roleMiddleware(...)` returns the *real* middleware) is exactly why route definitions call it as `roleMiddleware(PERMISSIONS.USER_BAN)` — with parentheses, invoking the factory right there in the route definition — rather than passing `roleMiddleware` itself.
- `if(!request.user){ ... }` — a defensive backstop. In practice this branch should never actually run in this project, because every route that uses `roleMiddleware` also has `authenticate` listed *before* it — but if that ordering were ever accidentally reversed or forgotten, this stops the check from crashing (`request.user.role` on an `undefined` `request.user` would otherwise throw a raw `TypeError`) and instead fails safely with a clear 401.
- `ROLE_PERMISSIONS[request.user.role] || []` — looks up the current user's role (`"customer"`, `"admin"`, or `"superadmin"`) in the `ROLE_PERMISSIONS` map from `constants/permissions.js`, getting back that role's array of allowed permission strings. The `|| []` is a safety fallback in case `request.user.role` were ever some unexpected value not present in the map at all.
- `requiredPermission.some((permission) => userPermissions.includes(permission))` — `.some(...)` returns `true` if *at least one* element of the array satisfies the given check. So this reads as: "does the user's permission list include at least one of the permissions this route requires?"
- If not: a clean 403 Forbidden. If so: `next()`, letting the request continue to the actual controller.

### Used in this project

Every single route under `routes/admin/`. One complete, worked example — the "ban a user" route:
```js
adminUsersRouter.post(
    "/:userId/ban",
    authenticate,
    roleMiddleware(PERMISSIONS.USER_BAN),
    banUserController,
);
```
Trace what happens for three different real users hitting `POST /api/admin/users/<id>/ban`:
- **No cookie at all** — `authenticate` itself throws `UnauthenticatedError` before `roleMiddleware` is ever reached → `401`.
- **A logged-in `customer`** — `authenticate` succeeds, sets `request.user = { role: "customer", ... }`. `roleMiddleware` looks up `ROLE_PERMISSIONS.customer`, which is `[]` — `requiredPermission.some(...)` is `false` against an empty array → `403`.
- **A logged-in `admin`** — `ROLE_PERMISSIONS.admin` includes `PERMISSIONS.USER_BAN` → `hasPermission` is `true` → `next()` → `banUserController` actually runs.

---

## `rateLimit.middleware.js`

```js
import rateLimit from "express-rate-limit";
import { HTTP_STATUS } from "../constants/index.js";

const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
    message: {
        success: false,
        message: "Too many attempts. Please try again later.",
        code: "RATE_LIMITED",
    },
});

export { authRateLimiter };
```

### What problem this solves

`UserSecurity`'s lockout system (see `docs/models.md`) stops brute-forcing *one specific account*. It does nothing to stop someone hammering the `/register` or `/login` endpoint rapidly from a single source, trying many *different* accounts (or creating many fake ones). `authRateLimiter` is a second, independent layer of defense, based on *where* requests are coming from rather than *which account* they're targeting.

### Line by line

- `rateLimit({...})` — `express-rate-limit` is a small, widely-used library that returns a ready-to-use Express middleware from a plain settings object; this file's only job is configuring it once for this app's specific needs.
- `windowMs: 15 * 60 * 1000` — the size of the time window being tracked, in milliseconds: 15 minutes.
- `limit: 20` — how many requests a single source is allowed to make within that 15-minute window before being blocked.
- `standardHeaders: true` / `legacyHeaders: false` — controls which style of rate-limit informational headers (`RateLimit-*` vs. the older `X-RateLimit-*`) get added to responses, so a well-behaved client can see how close it is to the limit. This just picks the modern standard over the legacy one.
- `statusCode: HTTP_STATUS.TOO_MANY_REQUESTS` — the actual status code (429) sent once the limit is exceeded.
- `message: {...}` — the JSON body sent back on a blocked request, matching this app's normal `{ success, message, code }` response shape rather than the library's own default plain-text message.

### Used in this project

Applied to exactly the two routes that most need it — `routes/auth/auth.routes.js`:
```js
authRouter.post("/register", authRateLimiter, registerUserController);
authRouter.post("/login", authRateLimiter, loginUserController);
```
Deliberately *not* applied to `/refresh`, `/logout`, or any admin route — those either require an already-valid session (so there's a different, natural limit on how fast they can be abused) or aren't realistic brute-force targets the same way a login form is.

---

## `errorHandler.middleware.js`

```js
import { HTTP_STATUS } from "../constants/index.js";
import { systemLogger } from "../logger/pino.logger.js";

const errorHandler = (error, request, response, next) => {
    const statusCode = error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
    const code = error.code;
    const isOperational = error.isOperational || false;

    systemLogger.error({ err: error }, "Request failed");

    return response.status(statusCode).json({
        success: false,
        message: isOperational ? error.message : "Something went wrong",
        code: isOperational ? code : "INTERNAL_SERVER_ERROR",
    })
}

export { errorHandler };
```

### What problem this solves

The single, central place every error in the entire app eventually flows through — see `docs/errors.md`'s final section ("How a thrown error actually becomes an HTTP response") for the full end-to-end trace. This file's job is narrow but critical: decide what a *client* is allowed to see about a given failure.

### Line by line

- **`(error, request, response, next)` — four parameters, not three.** This exact shape is a signal Express looks for specifically: Express inspects how many parameters a middleware function declares, and a four-parameter middleware is automatically treated as an **error handler** — Express only calls it when something threw, or something called `next(error)` with an argument. Get this parameter count wrong (e.g. accidentally write `(request, response, next)`) and Express would silently never call it as an error handler at all.
- `error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR` — if this error is one of the app's own typed errors (see `docs/errors.md`), it already carries a real HTTP status; otherwise (a raw, unexpected `Error` or `TypeError`) this falls back to 500.
- `const isOperational = error.isOperational || false;` — this is the flag `AppError` sets to `true` on every one of its subclasses — see `docs/errors.md` for the full rationale.
- `systemLogger.error({ err: error }, "Request failed");` — logs the **real** error, always, with its full stack trace, regardless of what the client ends up seeing. This is what makes it possible to actually debug an unexpected 500 later — the details aren't lost, just not exposed over the network.
- The response body: `message: isOperational ? error.message : "Something went wrong"` — an operational error (like `ConflictError("Email already exists")`) shows its real, deliberately-written message, since it was written specifically to be safe to show a client. A non-operational error (a genuine bug) always shows the same generic message, no matter what its real `.message` actually said — this is the exact mechanism that prevents an accidental `TypeError` from leaking a stack trace, a file path, or any other internal detail to a stranger over the internet. `code` follows the identical pattern.

### Used in this project

Registered exactly once, in `app.js`, and it must be **last** — after every route and every other middleware:
```js
app.use(notFound);
app.use(errorHandler);
```
Being last is what lets it catch errors from *anything* registered above it in the chain.

---

## `notFound.middleware.js`

```js
import { HTTP_STATUS } from "../constants/index.js"

const notFound = (request, response, next) => {
    return response.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: `The requested resource ${request.originalUrl} could not be found`
    })
}

export { notFound };
```

### What problem this solves

Without this, a request to a URL that matches no registered route at all (a typo, an old/removed endpoint) would just hang or fall through to Express's own generic, un-styled default 404 page — inconsistent with the rest of this API's `{success, message, ...}` JSON shape.

### Line by line

- This is a normal (three-parameter) middleware, registered *after every real route* — since Express tries routes top-to-bottom and only reaches this one if absolutely nothing above it matched, it functions as a catch-all.
- `request.originalUrl` — the full original path that was requested, echoed back in the message, so `GET /api/this-route-does-not-exist` produces a message that names exactly that path — genuinely useful for a developer (or a frontend's error logging) debugging a typo'd URL.

### Used in this project

Registered in `app.js`, immediately before `errorHandler` and after every real route:
```js
app.use(notFound);
app.use(errorHandler);
```
The order between these two specifically doesn't matter for how they individually function (`notFound` only ever sends a response directly, it never calls `next(error)`), but both have to come after every real route, for the reason described above.

---

## `index.js`

```js
export { notFound } from "./notFound.middleware.js";
export { errorHandler } from "./errorHandler.middleware.js";
export { authenticate, optionalAuthenticate } from "./authenticate.middleware.js";
export { authRateLimiter } from "./rateLimit.middleware.js";
export { roleMiddleware } from "./role.middleware.js";
```

The barrel — `app.js` and every `routes/**/*.routes.js` file imports whatever middleware it needs from `"./middleware/index.js"` (or the equivalent relative path), e.g. `import { authenticate, roleMiddleware } from "../../middleware/index.js";`.

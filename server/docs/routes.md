# `src/routes/` — URL → Middleware → Controller Wiring

**What a route file actually does:** nothing more than deciding, for a given HTTP method + URL path, *which* middleware run first and *which* controller finally handles it. No business logic, no HTTP response shaping — both of those live one and two layers down (`controllers/`, `services/` — see their own docs). If `docs/controllers.md` and `docs/middleware.md` are the *parts*, this document is the *wiring diagram* connecting them to real URLs.

## Index

- [`auth/auth.routes.js`](#authauthroutesjs) — the full walkthrough
- [`admin/users.routes.js`](#adminusersroutesjs) — the route-ordering rule, explained once
- [`admin/loginLogs.routes.js`, `admin/sessions.routes.js`, `admin/security.routes.js`, `admin/pings.routes.js`](#the-other-four-admin-route-files)
- [Barrels: `auth/index.js`, `admin/index.js`, `routes/index.js`](#barrels)
- [The full URL map](#the-full-url-map)

---

## `auth/auth.routes.js`

```js
import express from "express";
import {
    registerUserController, loginUserController, refreshTokenController,
    logoutController, logoutAllDevicesController, getCurrentUserController,
    changePasswordController, listSessionsController, revokeSessionController,
} from "../../controllers/index.js";
import { authenticate, authRateLimiter } from "../../middleware/index.js";

const authRouter = express.Router();

authRouter.post("/register", authRateLimiter, registerUserController);
authRouter.post("/login", authRateLimiter, loginUserController);
authRouter.post("/refresh", refreshTokenController);
authRouter.post("/logout", authenticate, logoutController);
authRouter.post("/logout-all", authenticate, logoutAllDevicesController);
authRouter.get("/me", authenticate, getCurrentUserController);
authRouter.patch("/change-password", authenticate, changePasswordController);
authRouter.get("/sessions", authenticate, listSessionsController);
authRouter.delete("/sessions/:sessionId", authenticate, revokeSessionController);

export { authRouter };
```

### Line by line

- **`express.Router()`** — creates a self-contained, mountable mini-application. It supports the exact same `.get()`/`.post()`/`.patch()`/`.delete()` methods as the main `app` object (see `docs/app-and-server.md`), but doesn't listen on a port itself — it only becomes reachable once mounted into the real app with `app.use(prefix, someRouter)`.
- **`authRouter.post("/register", authRateLimiter, registerUserController)`** — this is the general shape every single route line in this project follows: **method**, **path**, then **one or more middleware, in order, ending with the controller.** Express runs each argument after the path in the exact order given, and each one has to call `next()` (or send a response itself) for the chain to continue. So this line reads as: *"on a POST to `/register`, first run the rate limiter; if that lets the request through, run the actual controller."*
- **Which routes have `authenticate`, and which don't, is itself meaningful information:** `/register`, `/login`, and `/refresh` are the three routes reachable by someone with **no** existing session — which makes sense, since their entire purpose is to *create* one (or, for `/refresh`, to renew one using a *different* token than the expired access token). Every other route requires `authenticate` first.
- **`authRateLimiter` only on `/register` and `/login`** — see `docs/middleware.md` for why: these are the two endpoints most worth protecting against a burst of automated attempts from one source.
- **`authRouter.delete("/sessions/:sessionId", ...)`** — `:sessionId` is an Express **route parameter**: any URL segment in that position gets captured into `request.params.sessionId` inside the controller (see `docs/controllers.md`'s `revokeSession.controller.js`). A real request to `DELETE /api/sessions/665f1a2b...` sets `request.params.sessionId` to `"665f1a2b..."`.

### Used in this project

Mounted in `app.js` as `app.use("/api", authRouter)` — meaning every path defined here gets the `/api` prefix in the real, live URL: `/register` here becomes `POST /api/register`, `/sessions/:sessionId` becomes `DELETE /api/sessions/:sessionId`, and so on.

---

## `admin/users.routes.js`

```js
import express from "express";
import {
    getUserController, getAllActiveUsersController, getAllDeletedUsersController,
    getAllUsersIncludingDeletedController, deleteUserController, restoreUserController,
    banUserController, unbanUserController, suspendUserController, unsuspendUserController,
    getUserModerationStatsController, updateUserRoleController,
} from "../../controllers/index.js";
import { authenticate, roleMiddleware } from "../../middleware/index.js";
import { PERMISSIONS } from "../../constants/index.js";

const adminUsersRouter = express.Router();

// Specific paths must come before "/:userId", or Express would match them as a userId instead.
adminUsersRouter.get("/stats", authenticate, roleMiddleware(PERMISSIONS.USER_VIEW_MODERATION_STATS), getUserModerationStatsController);
adminUsersRouter.get("/deleted", authenticate, roleMiddleware(PERMISSIONS.USER_VIEW_DELETED), getAllDeletedUsersController);
adminUsersRouter.get("/all", authenticate, roleMiddleware(PERMISSIONS.USER_VIEW_DELETED), getAllUsersIncludingDeletedController);
adminUsersRouter.get("/", authenticate, roleMiddleware(PERMISSIONS.USER_VIEW), getAllActiveUsersController);
adminUsersRouter.get("/:userId", authenticate, roleMiddleware(PERMISSIONS.USER_VIEW), getUserController);
adminUsersRouter.delete("/:userId", authenticate, roleMiddleware(PERMISSIONS.USER_DELETE), deleteUserController);
adminUsersRouter.post("/:userId/restore", authenticate, roleMiddleware(PERMISSIONS.USER_RESTORE), restoreUserController);
adminUsersRouter.post("/:userId/ban", authenticate, roleMiddleware(PERMISSIONS.USER_BAN), banUserController);
adminUsersRouter.post("/:userId/unban", authenticate, roleMiddleware(PERMISSIONS.USER_UNBAN), unbanUserController);
adminUsersRouter.post("/:userId/suspend", authenticate, roleMiddleware(PERMISSIONS.USER_SUSPEND), suspendUserController);
adminUsersRouter.post("/:userId/unsuspend", authenticate, roleMiddleware(PERMISSIONS.USER_UNSUSPEND), unsuspendUserController);
adminUsersRouter.patch("/:userId/role", authenticate, roleMiddleware(PERMISSIONS.USER_UPDATE_ROLE), updateUserRoleController);

export { adminUsersRouter };
```

### Two things worth understanding, once, that apply to every admin route file

**1. The three-middleware stack: `authenticate`, then `roleMiddleware(PERMISSIONS.X)`, then the controller.** This is the actual, physical implementation of this app's whole permission system — every admin route names one specific permission from `constants/permissions.js` right here in its own definition, making it possible to read *exactly* what's required to hit any given endpoint just by looking at this one line, without digging through the controller or service at all. See `docs/middleware.md` for how `authenticate`/`roleMiddleware` each work, and `docs/constants.md` for what each `PERMISSIONS.X` value actually is and which roles have it.

**2. Route registration order matters — the comment in the file explains why.** Express tries routes **top to bottom** and uses the first one that matches. `/:userId` is a *pattern* that matches any single URL segment — including the literal text `stats`, `deleted`, or `all`. If `adminUsersRouter.get("/:userId", ...)` had been registered *before* `adminUsersRouter.get("/stats", ...)`, then a request to `GET /api/admin/users/stats` would incorrectly match `/:userId` first (treating `"stats"` as if it were a user id), and `getUserController` would run instead of `getUserModerationStatsController` — silently doing the wrong thing rather than erroring. This is why every specific, literal path (`/stats`, `/deleted`, `/all`) is registered *before* the catch-all `/:userId` pattern in this file.

### Used in this project

Mounted as `app.use("/api/admin/users", adminUsersRouter)` — `/stats` here becomes `GET /api/admin/users/stats`, `/:userId/ban` becomes `POST /api/admin/users/:userId/ban`, and so on.

---

## The other four admin route files

Each of these follows the exact same two rules just explained — middleware stack per route, specific paths before `/:param` patterns — just with fewer routes and different permissions. Rather than repeat the full code for each, here's the complete route table:

| File | Method + path | Permission required |
|---|---|---|
| `admin/loginLogs.routes.js` | `GET /` | `USER_VIEW_LOGIN_LOGS` |
| | `GET /:userId` | `USER_VIEW_LOGIN_LOGS` |
| `admin/sessions.routes.js` | `GET /` | `SESSION_VIEW` |
| | `GET /user/:userId` | `SESSION_VIEW` |
| | `DELETE /user/:userId` | `SESSION_REVOKE` |
| | `DELETE /:sessionId` | `SESSION_REVOKE` |
| `admin/security.routes.js` | `GET /:userId` | `USER_VIEW` |
| | `POST /:userId/clear-lockout` | `USER_CLEAR_LOCKOUT` |
| `admin/pings.routes.js` | `GET /deleted` | `PING_VIEW_DELETED` |
| | `GET /all` | `PING_VIEW_DELETED` |
| | `GET /` | `PING_VIEW` |
| | `GET /:pingId` | `PING_VIEW` |
| | `DELETE /:pingId` | `PING_DELETE` |
| | `POST /:pingId/restore` | `PING_RESTORE` |

One worth calling out specifically — `admin/sessions.routes.js` has **both** `GET /user/:userId` and `DELETE /:sessionId` — two *different* route parameters (`:userId` vs `:sessionId`) at two different URL depths (`/user/:userId` vs just `/:sessionId`), which is why they don't collide with each other the way `/:userId` and `/stats` would have — they're genuinely different URL shapes, not the same pattern registered twice.

### Used in this project

Mounted in `app.js` as `/api/admin/login-logs`, `/api/admin/sessions`, `/api/admin/security`, `/api/admin/pings` respectively.

---

## Barrels

```js
// routes/auth/index.js
export { authRouter } from "./auth.routes.js";
```
```js
// routes/admin/index.js
export { adminUsersRouter } from "./users.routes.js";
export { adminLoginLogsRouter } from "./loginLogs.routes.js";
export { adminSessionsRouter } from "./sessions.routes.js";
export { adminSecurityRouter } from "./security.routes.js";
export { adminPingsRouter } from "./pings.routes.js";
```
```js
// routes/index.js
export * from "./auth/index.js";
export * from "./admin/index.js";
```

The same chained-barrel structure used throughout `models/`, `services/`, and `controllers/` — `app.js` imports every router it needs (`authRouter`, `adminUsersRouter`, ...) from this single top-level `routes/index.js`.

---

## The full URL map

Putting every route file together, this is the complete, real API surface this project currently exposes:

```
POST   /api/register
POST   /api/login
POST   /api/refresh
POST   /api/logout                          (auth required)
POST   /api/logout-all                      (auth required)
GET    /api/me                              (auth required)
PATCH  /api/change-password                 (auth required)
GET    /api/sessions                        (auth required)
DELETE /api/sessions/:sessionId             (auth required)

GET    /api/admin/users/stats               (USER_VIEW_MODERATION_STATS)
GET    /api/admin/users/deleted             (USER_VIEW_DELETED — superadmin)
GET    /api/admin/users/all                 (USER_VIEW_DELETED — superadmin)
GET    /api/admin/users                     (USER_VIEW)
GET    /api/admin/users/:userId             (USER_VIEW)
DELETE /api/admin/users/:userId             (USER_DELETE)
POST   /api/admin/users/:userId/restore     (USER_RESTORE — superadmin)
POST   /api/admin/users/:userId/ban         (USER_BAN)
POST   /api/admin/users/:userId/unban       (USER_UNBAN)
POST   /api/admin/users/:userId/suspend     (USER_SUSPEND)
POST   /api/admin/users/:userId/unsuspend   (USER_UNSUSPEND)
PATCH  /api/admin/users/:userId/role        (USER_UPDATE_ROLE — superadmin)

GET    /api/admin/login-logs                (USER_VIEW_LOGIN_LOGS)
GET    /api/admin/login-logs/:userId        (USER_VIEW_LOGIN_LOGS)

GET    /api/admin/sessions                  (SESSION_VIEW)
GET    /api/admin/sessions/user/:userId     (SESSION_VIEW)
DELETE /api/admin/sessions/user/:userId     (SESSION_REVOKE)
DELETE /api/admin/sessions/:sessionId       (SESSION_REVOKE)

GET    /api/admin/security/:userId          (USER_VIEW)
POST   /api/admin/security/:userId/clear-lockout  (USER_CLEAR_LOCKOUT)

GET    /api/admin/pings/deleted             (PING_VIEW_DELETED — superadmin)
GET    /api/admin/pings/all                 (PING_VIEW_DELETED — superadmin)
GET    /api/admin/pings                     (PING_VIEW)
GET    /api/admin/pings/:pingId             (PING_VIEW)
DELETE /api/admin/pings/:pingId             (PING_DELETE)
POST   /api/admin/pings/:pingId/restore     (PING_RESTORE — superadmin)
```

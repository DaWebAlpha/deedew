# `src/controllers/` — HTTP-Shaped Glue Code

**What a controller's job is, and isn't:** a controller's only responsibility is translating HTTP into plain JavaScript and back — read whatever the client sent (`request.body`, `request.params`, `request.query`, cookies), call the one service that actually knows what to do with it, and shape the response (status code, JSON body, cookies). **A controller never touches a Mongoose model directly, never contains a business rule, and is never where a duplicate-check or a password comparison happens** — all of that lives in `services/` (see `docs/services.md`, which this document assumes you've read or will read alongside this one — every service referenced here is explained in full over there). Because of this narrow job, nearly every controller in this app is 5–15 lines, and most of the actual *learning* here is in recognizing the handful of small, repeated shapes rather than in deep unique logic.

## Index

**`auth/`:**
- [`register.controller.js`](#registercontrollerjs) / [`login.controller.js`](#logincontrollerjs) — the two that set cookies from a full result
- [`refreshToken.controller.js`](#refreshtokencontrollerjs) — reads a cookie *and* sets new ones
- [`logout.controller.js`](#logoutcontrollerjs) / [`logoutAllDevices.controller.js`](#logoutalldevicescontrollerjs) — clear cookies
- [`getCurrentUser.controller.js`](#getcurrentusercontrollerjs) — the simplest shape in the app
- [`changePassword.controller.js`](#changepasswordcontrollerjs)
- [`listSessions.controller.js`](#listsessionscontrollerjs) / [`revokeSession.controller.js`](#revokesessioncontrollerjs-auth)
- [`auth/index.js`](#authindexjs)

**`admin/users/`** and the repeated admin CRUD shape:
- [`getUser.controller.js`](#getusercontrollerjs) — param-based single fetch
- [`getAllActiveUsers.controller.js`](#getallactiveuserscontrollerjs) and its two siblings — query-based lists
- [`deleteUser.controller.js`](#deleteusercontrollerjs) / `restoreUser.controller.js` — params + body + acting-admin id
- [`banUser.controller.js`](#banusercontrollerjs) and its three siblings
- [`suspendUser.controller.js`](#suspendusercontrollerjs) — one extra body field
- [`updateUserRole.controller.js`](#updateuserrolecontrollerjs)
- [`getUserModerationStats.controller.js`](#getusermoderationstatscontrollerjs) — no input at all
- [`admin/users/index.js`](#adminusersindexjs)

**The other four admin domains** (each is the exact same shapes as `admin/users`, applied elsewhere):
- [`admin/loginLogs/`, `admin/sessions/`, `admin/security/`, `admin/pings/`](#the-other-four-admin-domains)

**Barrels:**
- [`controllers/index.js`, `controllers/admin/index.js`](#top-level-barrels)

---

## `register.controller.js`

```js
import { registerUserService } from "../../services/index.js";
import {
    setAuthCookies, asyncHandler, getClientIP, getUserAgent, getDeviceName, getDeviceId,
} from "../../utils/index.js";
import { HTTP_STATUS } from "../../constants/index.js";

const registerUserController = asyncHandler(async(request, response) => {
    const { user, security, accessToken, refreshToken } = await registerUserService({
        ...request.body,
        userAgent: getUserAgent(request),
        ipAddress: getClientIP(request),
        deviceName: getDeviceName(request),
        deviceId: getDeviceId(request)
    });

    setAuthCookies(response, {
        accessToken: accessToken,
        refreshToken: refreshToken,
    });

    return response.status(HTTP_STATUS.CREATED).json({
        title: "Register",
        success: true,
        message: "User registered successfully",
        user,
    })
})

export { registerUserController }
```

This is the fullest example of the "auth controller" shape, worth reading closely once — every other auth controller is a variation on it.

- `asyncHandler(async (request, response) => {...})` — every controller in this app is wrapped this way; see `docs/utils.md`.
- **`{ ...request.body, userAgent: getUserAgent(request), ... }`** — this is the recurring pattern for building a service's input: spread everything the client sent in the request body (`firstName`, `email`, `password`, ...) and merge in a handful of values the *server itself* derives from the raw request object rather than trusting the client to send (IP address, user agent, a device id) — see `docs/utils.md`'s `request.js` section for what each of those four helper functions actually does.
- The service call's return value is destructured — `{ user, security, accessToken, refreshToken }` — and the controller decides what to actually *do* with each piece: `accessToken`/`refreshToken` go into cookies (never into the JSON body — they're httpOnly, so client-side JS was never meant to read them directly anyway); `user` goes into the response body; `security` is silently discarded here (the service returns it because `login.controller.js` shares the same destructuring shape and also doesn't use it — it's just not currently needed by either controller, though it's available if a future frontend wanted to show it).
- `setAuthCookies(response, { accessToken, refreshToken })` — see `docs/utils.md`.
- `response.status(HTTP_STATUS.CREATED).json({...})` — `201 Created` specifically, since this is the endpoint that brings a brand-new resource (the user account) into existence — correct REST convention, distinct from a plain `200 OK`.

### Used in this project

Wired to `POST /api/register` in `routes/auth/auth.routes.js`, behind `authRateLimiter` (see `docs/middleware.md`).

---

## `login.controller.js`

```js
import { loginUserService } from "../../services/index.js";
import {
    setAuthCookies, asyncHandler, getClientIP, getUserAgent, getDeviceName, getDeviceId,
} from "../../utils/index.js";
import { HTTP_STATUS } from "../../constants/index.js";

const loginUserController = asyncHandler(async(request, response) => {
    const { user, security, accessToken, refreshToken } = await loginUserService({
        ...request.body,
        userAgent: getUserAgent(request),
        ipAddress: getClientIP(request),
        deviceName: getDeviceName(request),
        deviceId: getDeviceId(request)
    });

    setAuthCookies(response, { accessToken: accessToken, refreshToken: refreshToken });

    return response.status(HTTP_STATUS.OK).json({
        title: "Login",
        success: true,
        message: "Login successful",
        user,
    })
})

export { loginUserController }
```

Structurally identical to `registerUserController` — the only differences are which service it calls, and `HTTP_STATUS.OK` (200) instead of `CREATED` (201), since logging in doesn't create a new resource. `{ ...request.body }` here spreads `{ identifier, password }` into `loginUserService`.

### Used in this project

`POST /api/login`, also behind `authRateLimiter`.

---

## `refreshToken.controller.js`

```js
import { refreshTokenService } from "../../services/index.js";
import { asyncHandler } from "../../utils/index.js";
import { HTTP_STATUS } from "../../constants/index.js";
import { setAuthCookies, getClientIP, getUserAgent, getDeviceName, getDeviceId } from "../../utils/index.js";
import { config } from "../../config/index.js";

const refreshTokenController = asyncHandler(async (request, response) => {
    const refreshToken = request.cookies?.[config.refreshTokenCookie];

    const result = await refreshTokenService({
        refreshToken,
        userAgent: getUserAgent(request),
        ipAddress: getClientIP(request),
        deviceName: getDeviceName(request),
        deviceId: getDeviceId(request),
    });

    setAuthCookies(response, { accessToken: result.accessToken, refreshToken: result.refreshToken });

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        message: "Session refreshed",
        user: result.user,
    });
});

export { refreshTokenController };
```

The one auth controller that's *reading* a cookie rather than only writing new ones — `request.cookies?.[config.refreshTokenCookie]` pulls the refresh token straight off the incoming request (there's no `request.body` involved here at all; a browser's own automatic cookie-sending is the entire input to this endpoint). Everything else mirrors `login.controller.js`: call the service, set fresh cookies with whatever it returns (the *new*, rotated tokens — see `docs/services.md`'s `refreshToken.service.js` section), respond.

### Used in this project

`POST /api/refresh` — deliberately not behind `authenticate` (an expired access token is exactly the normal case this endpoint exists to handle) or `authRateLimiter`.

---

## `logout.controller.js` / `logoutAllDevices.controller.js`

```js
// logout.controller.js
import { logoutService } from "../../services/index.js";
import { asyncHandler } from "../../utils/index.js";
import { HTTP_STATUS } from "../../constants/index.js";
import { clearAuthCookies, getClientIP, getUserAgent, getDeviceName, getDeviceId } from "../../utils/index.js";
import { config } from "../../config/index.js";

const logoutController = asyncHandler(async (request, response) => {
    const refreshToken = request.cookies?.[config.refreshTokenCookie];

    const result = await logoutService({
        userId: request.user.userId,
        refreshToken,
        ipAddress: getClientIP(request),
        userAgent: getUserAgent(request),
        deviceName: getDeviceName(request),
        deviceId: getDeviceId(request),
    });

    clearAuthCookies(response);

    return response.status(HTTP_STATUS.OK).json({ success: true, message: result.message });
});
```

**`request.user.userId`** — the first controller in this document to read this. It only exists because `authenticate` middleware ran first on this route (see `docs/middleware.md`) and attached it. This is the concrete mechanism behind "logout requires being logged in" — there's no `userId` in the request body at all; it comes entirely from the verified session.

`clearAuthCookies(response)` runs *after* the service call succeeds — deleting the cookies is the controller's job (it's about the HTTP response), while revoking the underlying database record is the service's job (see `docs/services.md`).

`logoutAllDevices.controller.js` is the same shape, minus reading a specific `refreshToken` cookie (the service revokes *every* session, so it doesn't need to know which one the current request came from) and with one extra field echoed back: `revokedCount: result.revokedCount`, telling the client how many sessions were actually killed.

### Used in this project

`POST /api/logout` and `POST /api/logout-all`, both behind `authenticate`.

---

## `getCurrentUser.controller.js`

```js
import { getCurrentUserService } from "../../services/index.js";
import { asyncHandler } from "../../utils/index.js";
import { HTTP_STATUS } from "../../constants/index.js";

const getCurrentUserController = asyncHandler(async (request, response) => {
    const { user } = await getCurrentUserService({ userId: request.user.userId });

    return response.status(HTTP_STATUS.OK).json({ success: true, user });
});

export { getCurrentUserController };
```

The simplest controller in the entire app — no cookies, no body, just `request.user.userId` (from `authenticate`) straight into the service and the result straight into the response. Worth using as the mental baseline for "what a controller looks like with none of the extra concerns" before reading any other one.

### Used in this project

`GET /api/me`, behind `authenticate`.

---

## `changePassword.controller.js`

```js
import { changePasswordService } from "../../services/index.js";
import { asyncHandler, clearAuthCookies } from "../../utils/index.js";
import { HTTP_STATUS } from "../../constants/index.js";

const changePasswordController = asyncHandler(async (request, response) => {
    const result = await changePasswordService({
        userId: request.user.userId,
        currentPassword: request.body.currentPassword,
        newPassword: request.body.newPassword,
    });

    clearAuthCookies(response);

    return response.status(HTTP_STATUS.OK).json({ success: true, message: result.message });
});

export { changePasswordController };
```

Unlike `register`/`login` (which spread the *entire* `request.body`), this one names its two expected fields explicitly (`request.body.currentPassword`, `request.body.newPassword`) — a small but deliberate difference: it means any *other* field the client might send in the body is simply ignored rather than silently passed through to the service. `clearAuthCookies(response)` here matches what the service already did server-side (revoking every session — see `docs/services.md`) — the cookies for *this* request's session need to be cleared too, since that session no longer has a valid token behind it either.

### Used in this project

`PATCH /api/change-password`, behind `authenticate`.

---

## `listSessions.controller.js` / `revokeSession.controller.js` (auth)

```js
// listSessions.controller.js
const listSessionsController = asyncHandler(async (request, response) => {
    const { sessions } = await listSessionsService({ userId: request.user.userId });
    return response.status(HTTP_STATUS.OK).json({ success: true, sessions });
});
```
```js
// revokeSession.controller.js
const revokeSessionController = asyncHandler(async (request, response) => {
    const result = await revokeSessionService({
        userId: request.user.userId,
        sessionId: request.params.sessionId,
    });
    return response.status(HTTP_STATUS.OK).json({ success: true, message: result.message });
});
```

**`request.params.sessionId`** — the first controller in this document reading a **route parameter**. `routes/auth/auth.routes.js` registers this as `DELETE /sessions/:sessionId` — the `:sessionId` segment is what Express captures into `request.params.sessionId`. Combined with `request.user.userId` (from `authenticate`), the service gets both "which session" and "revoke it only if it's genuinely this user's own" — see `docs/services.md` for how that ownership check actually works.

### Used in this project

`GET /api/sessions` and `DELETE /api/sessions/:sessionId`.

---

## `auth/index.js`

```js
export { registerUserController } from "./register.controller.js";
export { loginUserController } from "./login.controller.js";
export { refreshTokenController } from "./refreshToken.controller.js";
export { logoutController } from "./logout.controller.js";
export { logoutAllDevicesController } from "./logoutAllDevices.controller.js";
export { getCurrentUserController } from "./getCurrentUser.controller.js";
export { changePasswordController } from "./changePassword.controller.js";
export { listSessionsController } from "./listSessions.controller.js";
export { revokeSessionController } from "./revokeSession.controller.js";
```

---

## `getUser.controller.js`

```js
import { getUserService } from "../../../services/index.js";
import { asyncHandler } from "../../../utils/index.js";
import { HTTP_STATUS } from "../../../constants/index.js";

const getUserController = asyncHandler(async (request, response) => {
    const { user } = await getUserService({ userId: request.params.userId });
    return response.status(HTTP_STATUS.OK).json({ success: true, user });
});

export { getUserController };
```

The admin-side equivalent of the "param-based single fetch" shape — `request.params.userId` here comes from the route `GET /:userId` in `routes/admin/users.routes.js`. **This controller has no `authenticate`/`roleMiddleware` check written in it anywhere** — and that's correct, not an oversight: those checks are applied as separate middleware *in the route definition* (see `docs/routes.md`), not inside the controller function itself. By the time this function body runs at all, Express has already confirmed the caller is authenticated *and* holds `PERMISSIONS.USER_VIEW`.

### Used in this project

`GET /api/admin/users/:userId`.

---

## `getAllActiveUsers.controller.js` and its two siblings

```js
import { getAllActiveUsersService } from "../../../services/index.js";
import { asyncHandler } from "../../../utils/index.js";
import { HTTP_STATUS } from "../../../constants/index.js";

const getAllActiveUsersController = asyncHandler(async (request, response) => {
    const { result, message } = await getAllActiveUsersService({
        role: request.query.role,
        search: request.query.search,
        page: request.query.page,
        limit: request.query.limit,
    });

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        message,
        ...result,
    });
});

export { getAllActiveUsersController };
```

The "query-based list" shape: `request.query.X` reads from the URL's `?key=value` query string (e.g. `GET /api/admin/users?role=admin&search=kwa&page=2` sets all four). **`...result`** spreads the entire paginated result object (`data`, `page`, `limit`, `total`, `totalPages`, `hasNextPage`, `hasPreviousPage` — see `docs/models.md`'s `pagination.helper.js`) directly into the top level of the JSON response, alongside `success` and `message`, rather than nesting it under its own key — so a client can read `response.data`, `response.totalPages`, etc. directly.

`getAllDeletedUsers.controller.js` and `getAllUsersIncludingDeleted.controller.js` are identical in shape, calling their matching services instead.

### Used in this project

`GET /api/admin/users`, `/deleted`, `/all`.

---

## `deleteUser.controller.js` and the ban/unban/suspend/unsuspend/restore family

```js
import { deleteUserService } from "../../../services/index.js";
import { asyncHandler } from "../../../utils/index.js";
import { HTTP_STATUS } from "../../../constants/index.js";

const deleteUserController = asyncHandler(async (request, response) => {
    const result = await deleteUserService({
        userId: request.params.userId,
        deletedByUserId: request.user.userId,
        reason: request.body.reason,
    });

    return response.status(HTTP_STATUS.OK).json({ success: true, message: result.message });
});

export { deleteUserController };
```

This exact three-input shape — **`request.params.userId`** (which user), **`request.user.userId`** (who's performing the action, renamed to a service-specific field like `deletedByUserId`), **`request.body.reason`** (an optional justification typed by the admin) — repeats across `banUser.controller.js`, `unbanUser.controller.js`, `unsuspendUser.controller.js`, and `restoreUser.controller.js`, changing only which service is called and what the acting-user field is named (`bannedByUserId`, `unbannedByUserId`, `unsuspendedByUserId`, `restoreUserId`):

```js
// banUser.controller.js
const banUserController = asyncHandler(async (request, response) => {
    const result = await banUserService({
        userId: request.params.userId,
        bannedByUserId: request.user.userId,
        reason: request.body.reason,
    });
    return response.status(HTTP_STATUS.OK).json({ success: true, message: result.message });
});
```

### Used in this project

`DELETE /api/admin/users/:userId`, `POST /:userId/restore`, `/ban`, `/unban`, `/unsuspend`.

---

## `suspendUser.controller.js`

```js
import { suspendUserService } from "../../../services/index.js";
import { asyncHandler } from "../../../utils/index.js";
import { HTTP_STATUS } from "../../../constants/index.js";

const suspendUserController = asyncHandler(async (request, response) => {
    const result = await suspendUserService({
        userId: request.params.userId,
        suspendedByUserId: request.user.userId,
        reason: request.body.reason,
        suspendedUntil: request.body.suspendedUntil,
    });

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        message: result.message,
        suspendedUntil: result.suspendedUntil,
    });
});

export { suspendUserController };
```

The same shape as `banUserController`, with one extra field each way: `request.body.suspendedUntil` going in (the admin has to specify *when* the suspension ends — see `docs/services.md`'s date-validation logic), and `suspendedUntil: result.suspendedUntil` echoed back in the response, so the client immediately knows the exact suspension end time without a separate lookup.

### Used in this project

`POST /api/admin/users/:userId/suspend`, body: `{ "reason": "...", "suspendedUntil": "2026-09-01T00:00:00.000Z" }`.

---

## `updateUserRole.controller.js`

```js
import { updateUserRoleService } from "../../../services/index.js";
import { asyncHandler } from "../../../utils/index.js";
import { HTTP_STATUS } from "../../../constants/index.js";

const updateUserRoleController = asyncHandler(async (request, response) => {
    const result = await updateUserRoleService({
        userId: request.params.userId,
        role: request.body.role,
        updatedByUserId: request.user.userId,
    });

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        message: result.message,
        user: result.user,
    });
});

export { updateUserRoleController };
```

Notice this controller itself contains **no** special logic for the self-lockout guard (a superadmin can't change their own role) — that check lives entirely in `updateUserRoleService` (see `docs/services.md`). The controller doesn't need to know that rule exists at all; it just passes `request.user.userId` through as `updatedByUserId`, and lets the service decide what to do with the fact that it might equal `request.params.userId`.

### Used in this project

`PATCH /api/admin/users/:userId/role`, gated to `superadmin` only via `roleMiddleware(PERMISSIONS.USER_UPDATE_ROLE)` in the route definition (see `docs/routes.md`).

---

## `getUserModerationStats.controller.js`

```js
import { getUserModerationStatsService } from "../../../services/index.js";
import { asyncHandler } from "../../../utils/index.js";
import { HTTP_STATUS } from "../../../constants/index.js";

const getUserModerationStatsController = asyncHandler(async (request, response) => {
    const stats = await getUserModerationStatsService();

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        ...stats,
    });
});

export { getUserModerationStatsController };
```

The only controller in this project that calls its service with **no arguments at all** — `getUserModerationStatsService()` needs nothing from the request; it's a pure "count everything" query. `...stats` spreads `{ bannedCount, suspendedCount }` directly into the response.

### Used in this project

`GET /api/admin/users/stats`.

---

## `admin/users/index.js`

```js
export { getUserController } from "./getUser.controller.js";
export { getAllActiveUsersController } from "./getAllActiveUsers.controller.js";
export { getAllDeletedUsersController } from "./getAllDeletedUsers.controller.js";
export { getAllUsersIncludingDeletedController } from "./getAllUsersIncludingDeleted.controller.js";
export { deleteUserController } from "./deleteUser.controller.js";
export { restoreUserController } from "./restoreUser.controller.js";
export { banUserController } from "./banUser.controller.js";
export { unbanUserController } from "./unbanUser.controller.js";
export { suspendUserController } from "./suspendUser.controller.js";
export { unsuspendUserController } from "./unsuspendUser.controller.js";
export { getUserModerationStatsController } from "./getUserModerationStats.controller.js";
export { updateUserRoleController } from "./updateUserRole.controller.js";
```

---

## The other four admin domains

Every controller in `admin/loginLogs/`, `admin/sessions/`, `admin/security/`, and `admin/pings/` is one of the exact shapes already covered above, applied to a different service/model. Rather than repeat near-identical code blocks, here's what each one actually is:

| File | Shape | Reads from request |
|---|---|---|
| `admin/loginLogs/getUsersLoginLogs.controller.js` | query-based list | `request.query.{page,limit}` |
| `admin/loginLogs/getUserLoginLogs.controller.js` | param + query list | `request.params.userId`, `request.query.{page,limit}` |
| `admin/sessions/getAllActiveSessions.controller.js` | query-based list | `request.query.{page,limit}` |
| `admin/sessions/getUserSessions.controller.js` | param + query list | `request.params.userId`, `request.query.{page,limit}` |
| `admin/sessions/revokeSession.controller.js` (exports `adminRevokeSessionController`) | param + acting-admin id | `request.params.sessionId`, `request.user.userId` |
| `admin/sessions/revokeUserSessions.controller.js` | param + acting-admin id | `request.params.userId`, `request.user.userId` — response also echoes `revokedCount` |
| `admin/security/getUserSecurity.controller.js` | param-based single fetch | `request.params.userId` |
| `admin/security/clearUserLockout.controller.js` | param + acting-admin id | `request.params.userId`, `request.user.userId` |
| `admin/pings/getPing.controller.js` | param-based single fetch | `request.params.pingId` |
| `admin/pings/getAllActivePings.controller.js` (+ `Deleted`/`IncludingDeleted`) | query-based list | `request.query.{page,limit}` |
| `admin/pings/deletePing.controller.js` / `restorePing.controller.js` | param + body + acting-admin id | `request.params.pingId`, `request.body.reason`, `request.user.userId` |

As one concrete, complete example rather than just a table row — `admin/sessions/revokeSession.controller.js`:
```js
import { adminRevokeSessionService } from "../../../services/index.js";
import { asyncHandler } from "../../../utils/index.js";
import { HTTP_STATUS } from "../../../constants/index.js";

const adminRevokeSessionController = asyncHandler(async (request, response) => {
    const result = await adminRevokeSessionService({
        sessionId: request.params.sessionId,
        revokedByUserId: request.user.userId,
    });

    return response.status(HTTP_STATUS.OK).json({ success: true, message: result.message });
});

export { adminRevokeSessionController };
```
Note the function/export name — `adminRevokeSessionController`, not `revokeSessionController` — matching the service it calls (`adminRevokeSessionService`, not `revokeSessionService`). See `docs/services.md`'s note on this file for the real naming-collision bug this renaming fixed.

---

## Top-level barrels

```js
// controllers/admin/index.js
export * from "./users/index.js";
export * from "./loginLogs/index.js";
export * from "./sessions/index.js";
export * from "./security/index.js";
export * from "./pings/index.js";
```
```js
// controllers/index.js
export * from "./auth/index.js";
export * from "./admin/index.js";
```

The same chained-barrel structure as `models/index.js` and `services/index.js` — this is the file every `routes/**/*.routes.js` file actually imports controllers from.

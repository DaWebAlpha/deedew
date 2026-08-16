# Deedew

A production-style REST API for a multi-vendor marketplace, built with Node.js, Express 5, and MongoDB/Mongoose. It covers authentication with rotating refresh tokens, role-based admin access, self-service seller onboarding, and a soft-delete/restore/pagination pattern shared consistently across every resource in the app.

This project was built end-to-end as a hands-on learning exercise — every layer (models, services, controllers, routes) was written, reviewed, and iterated on deliberately, with an emphasis on getting the underlying patterns right rather than just making endpoints work.

## Tech stack

| Layer | Choice |
|---|---|
| Runtime | Node.js (ESM, `"type": "module"`) |
| Framework | Express 5 |
| Database | MongoDB via Mongoose 9 |
| Auth | JWT access tokens + opaque, hashed, rotating refresh tokens |
| Password hashing | Argon2id (`argon2`), OWASP-recommended parameters |
| Logging | Pino — three separate loggers (system/audit/access), daily-rolled log files, field redaction |
| Security middleware | Helmet, CORS, express-rate-limit |
| Phone parsing | libphonenumber-js |

## Architecture

Every resource follows the same layered flow:

```
routes  →  controllers  →  services  →  models
```

- **Routes** wire an HTTP method + path to a controller, with `authenticate`/`roleMiddleware` guards where needed. No business logic lives here.
- **Controllers** are thin — they pull data off `request`, call exactly one service, and shape the HTTP response. They never touch a model directly.
- **Services** hold all business logic: validation, database operations, transactions, audit logging. This is where the real work happens, and where almost every function is fully JSDoc'd with `@param`/`@returns`/`@throws`.
- **Models** are built through a shared schema factory (`createSchema`) rather than calling `new mongoose.Schema()` directly, so every model gets the same audit fields, soft-delete/restore instance methods, a `paginate()` static, and consistent JSON serialization for free.

Every layer has a barrel `index.js` re-exporting everything in that folder, so `services/index.js`, `controllers/index.js`, and `routes/index.js` each give one flat import surface for the whole app.

## Project structure

```
server/src/
├── app.js, server.js       # Express app assembly + startup
├── config/                 # Env var loading + validation (the only file that reads process.env)
├── constants/               # HTTP status codes, permissions, security config, sensitive-field list
├── errors/                  # Typed AppError subclasses (BadRequestError, NotFoundError, ...)
├── logger/                  # Three pino loggers: system, audit, access
├── middleware/               # authenticate, roleMiddleware, rate limiting, error handling
├── models/
│   ├── base/                # createSchema factory, audit fields, soft-delete/restore/pagination helpers
│   ├── auth/                 # User, RefreshToken, UserSecurity, LoginLog
│   ├── category/, product/, seller/   # Core marketplace resources
│   └── ...                   # Address, Cart, Order, Payment, Checkout, Review, Coupon,
│                              # Wishlist, Dispute, Shipment, Messaging, Notification, and more
├── utils/                    # Password hashing, JWT, tokens, normalization, pagination, etc.
├── services/                 # Business logic, grouped by domain (auth, admin, category, product, seller)
├── controllers/              # HTTP request/response glue, mirrors services/
├── routes/                   # Express routers, mirrors services/
└── docs/                     # Line-by-line documentation of every folder, written for a newcomer
```

## Getting started

**Prerequisites:** Node.js 20+, a MongoDB connection string (Atlas or local).

```bash
cd server
npm install
```

Create `server/.env`:

```bash
# Required — the app refuses to start without these three
MONGO_URI=mongodb://localhost:27017/deedew
FRONTEND_URL=http://localhost:5173
JWT_ACCESS_SECRET=replace-with-a-long-random-secret

# Optional — all have sensible defaults
PORT=5700
NODE_ENV=development
LOG_DIRECTORY=logs
JWT_ACCESS_EXPIRY_SECONDS=900
JWT_REFRESH_EXPIRY_DAYS=30
ACCESS_TOKEN_COOKIE=accessToken
REFRESH_TOKEN_COOKIE=refreshToken
```

```bash
npm run dev    # nodemon
npm start      # plain node
```

## API reference

All routes are prefixed with `/api`. 🔒 = requires a valid session (`authenticate`). 🔑 = requires a specific admin permission on top of authentication (`roleMiddleware`).

### Auth — `/api`

| Method | Path | Access |
|---|---|---|
| POST | `/register` | Public (rate-limited) |
| POST | `/login` | Public (rate-limited) |
| POST | `/refresh` | Public (reads refresh-token cookie) |
| POST | `/logout` | 🔒 |
| POST | `/logout-all` | 🔒 |
| GET | `/me` | 🔒 |
| PATCH | `/change-password` | 🔒 |
| GET | `/sessions` | 🔒 |
| DELETE | `/sessions/:sessionId` | 🔒 (own sessions only) |

### Categories — `/api/categories`

| Method | Path | Access |
|---|---|---|
| GET | `/` | Public — list active, searchable, paginated |
| GET | `/slug/:slug` | Public |
| GET | `/:categoryId` | Public |
| GET | `/deleted` | 🔑 `CATEGORY_VIEW_DELETED` |
| GET | `/all` | 🔑 `CATEGORY_VIEW_DELETED` |
| POST | `/` | 🔑 `CATEGORY_CREATE` |
| PATCH | `/:categoryId` | 🔑 `CATEGORY_UPDATE` |
| DELETE | `/:categoryId` | 🔑 `CATEGORY_DELETE` |
| POST | `/:categoryId/restore` | 🔑 `CATEGORY_RESTORE` |

### Products — `/api/products`

| Method | Path | Access |
|---|---|---|
| GET | `/` | Public — filterable by category/seller, searchable, paginated |
| GET | `/slug/:slug` | Public |
| GET | `/:productId` | Public |
| GET | `/deleted` | 🔑 `PRODUCT_VIEW_DELETED` |
| GET | `/all` | 🔑 `PRODUCT_VIEW_DELETED` |
| POST | `/mine` | 🔒 self-service — creates a product under the caller's own `SellerProfile` |
| POST | `/` | 🔑 `PRODUCT_CREATE` — admin creates on behalf of any seller |
| PATCH | `/:productId` | 🔑 `PRODUCT_UPDATE` |
| DELETE | `/:productId` | 🔑 `PRODUCT_DELETE` |
| POST | `/:productId/restore` | 🔑 `PRODUCT_RESTORE` |

### Sellers — `/api/sellers`

| Method | Path | Access |
|---|---|---|
| GET | `/` | Public — list active sellers, searchable, paginated |
| GET | `/slug/:slug` | Public |
| GET | `/:sellerId` | Public |
| GET | `/deleted` | 🔑 `SELLER_VIEW_DELETED` |
| GET | `/all` | 🔑 `SELLER_VIEW_DELETED` |
| POST | `/` | 🔒 self-service — any authenticated user can become a seller |
| PATCH | `/:sellerId` | 🔑 `SELLER_UPDATE` |
| DELETE | `/:sellerId` | 🔑 `SELLER_DELETE` |
| POST | `/:sellerId/restore` | 🔑 `SELLER_RESTORE` |

### Admin — Users — `/api/admin/users`

| Method | Path | Access |
|---|---|---|
| GET | `/stats` | 🔑 `USER_VIEW_MODERATION_STATS` |
| GET | `/deleted` | 🔑 `USER_VIEW_DELETED` |
| GET | `/all` | 🔑 `USER_VIEW_DELETED` |
| GET | `/` | 🔑 `USER_VIEW` |
| GET | `/:userId` | 🔑 `USER_VIEW` |
| DELETE | `/:userId` | 🔑 `USER_DELETE` |
| POST | `/:userId/restore` | 🔑 `USER_RESTORE` |
| POST | `/:userId/ban` | 🔑 `USER_BAN` |
| POST | `/:userId/unban` | 🔑 `USER_UNBAN` |
| POST | `/:userId/suspend` | 🔑 `USER_SUSPEND` |
| POST | `/:userId/unsuspend` | 🔑 `USER_UNSUSPEND` |
| PATCH | `/:userId/role` | 🔑 `USER_UPDATE_ROLE` |

### Admin — Sessions, Security, Login Logs, Pings

| Method | Path | Access |
|---|---|---|
| GET | `/api/admin/sessions` | 🔑 `SESSION_VIEW` |
| GET | `/api/admin/sessions/user/:userId` | 🔑 `SESSION_VIEW` |
| DELETE | `/api/admin/sessions/user/:userId` | 🔑 `SESSION_REVOKE` |
| DELETE | `/api/admin/sessions/:sessionId` | 🔑 `SESSION_REVOKE` |
| GET | `/api/admin/security/:userId` | 🔑 `USER_VIEW` |
| POST | `/api/admin/security/:userId/clear-lockout` | 🔑 `USER_CLEAR_LOCKOUT` |
| GET | `/api/admin/login-logs` | 🔑 `USER_VIEW_LOGIN_LOGS` |
| GET | `/api/admin/login-logs/:userId` | 🔑 `USER_VIEW_LOGIN_LOGS` |
| GET | `/api/admin/pings`, `/deleted`, `/all`, `/:pingId` | 🔑 `PING_VIEW` / `PING_VIEW_DELETED` |
| DELETE / POST restore | `/api/admin/pings/:pingId` | 🔑 `PING_DELETE` / `PING_RESTORE` |

## Data models

Core marketplace flow: `User` → `SellerProfile` → `Category`/`Product` → `Cart` → `Checkout` → `Order` → `Payment`.

Supporting models: `RefreshToken`, `UserSecurity` (bans/suspensions/lockouts), `LoginLog` (audit trail), `Review`, `Coupon`, `Refund`, `SellerPayout`, `Wishlist`, `Dispute`, `Shipment`, `Conversation`/`Message`, `Notification`/`DeviceToken`, `InventoryLog`, `AdminActionLog`, `PlatformSetting`.

Every model shares nine audit fields (`createdBy`, `updatedBy`, `deletedBy`, `restoredBy`, `deletedAt`, `restoredAt`, `isDeleted`, `deleteReason`, `restoreReason`) via `createSchema()`, plus Mongoose's own `createdAt`/`updatedAt` timestamps. Two intentional exceptions — `LoginLog` and `InventoryLog`-style audit trails skip the soft-delete lifecycle entirely, since an audit record must stay immutable to be trustworthy.

## Notable design decisions

- **Refresh tokens are opaque and hashed, not JWTs.** The raw token is only ever sent to the client; the server stores a SHA-256 hash of it and rotates it (revoke old, issue new) on every use, so a leaked database dump alone can't be replayed as a valid session.
- **`fetchOrNotFound`'s `filter` option enforces ownership scoping.** A wrong-owner lookup (e.g. revoking someone else's session) returns the same `NotFoundError` as a genuinely nonexistent id — the two are deliberately indistinguishable from the outside, so probing valid IDs can't leak information about what exists.
- **Public vs. admin-gated resources are split by whether a public use case exists.** `Category`/`Product`/`SellerProfile` get top-level routers mixing public GETs with permission-gated mutations; purely administrative concepts (`User`, `Session`, `Security`) live under `/api/admin/` only.
- **Self-service creation never trusts a client-supplied owner id.** Becoming a seller (`POST /api/sellers`) and listing a product as a seller (`POST /api/products/mine`) both derive the owner from the authenticated session (`request.user.userId`), never from the request body — the same id is always looked up server-side, so no one can create a resource on someone else's behalf by editing a JSON payload.
- **Case-insensitive uniqueness uses MongoDB collation, not a shadow field.** `Category`/`SellerProfile` names use a `collation: { strength: 2 }` unique index rather than maintaining a separate lowercase copy of the field to compare against.
- **`.lean()` in pagination is opt-in, not opt-out.** `paginateCollection` only skips Mongoose's document wrapping (and therefore its `toJSON` field-stripping) when a caller explicitly asks for it — defaulting to lean would silently bypass sensitive-field redaction the first time someone paginated a model that has something to hide.

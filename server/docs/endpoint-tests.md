# API Endpoint Testing Log

A hands-on, curl-by-curl record of testing every endpoint in this API — one endpoint at a time, in the order they were tested. Unlike `docs/routes.md`/`docs/controllers.md`/`docs/services.md` (which explain the *code*), this file records real requests actually run against the live dev server, what came back, and — just as importantly — the mistakes made along the way and why they produced the output they did. Curl mistakes are kept in here on purpose: seeing *why* a malformed command fails is as useful as seeing the happy path.

**Server:** `http://localhost:5700` (from `config.port` — see `docs/config.md`)

---

## 1. `POST /api/register`

**What it does:** creates a new `User` + paired `UserSecurity` + a `LoginLog` entry, all in one transaction, and logs the caller straight in (returns `accessToken`/`refreshToken` cookies immediately — no separate login call needed after registering). See `docs/services.md`'s `register.service.js` section for the full internal walkthrough.

**Auth required:** none — this is one of the few routes reachable while logged out.
**Rate limited:** yes, `authRateLimiter` (20 requests / 15 min per IP — see `docs/middleware.md`).

### Test 1 — successful registration

```bash
curl -s -i -X POST http://localhost:5700/api/register \
  -H "Content-Type: application/json" \
  -d '{"firstName": "Akofa", "lastName": "Akosa", "email": "ghsou1@gmail.com", "phoneNumber": "0553242450", "password":"ghana123"}'
```

**Result:** `201 Created`

```json
{"title":"Register","success":true,"message":"User registered successfully","user":{"firstName":"Akofa","lastName":"Akosa","email":"ghsou1@gmail.com","phoneNumber":"+233553242450","country":"GH","isSeller":false,"role":"customer","isDeleted":false,"createdAt":"2026-08-15T16:14:13.802Z","updatedAt":"2026-08-15T16:14:13.802Z","id":"6a8090551f06ad84f2b85e15"}}
```

Plus two `Set-Cookie` headers (`accessToken`, `refreshToken`, both `HttpOnly`).

**What this confirms:**
- `phoneNumber` sent as `"0553242450"` came back as `"+233553242450"` — the model's `pre("save")` hook normalized it to E.164 (`docs/models.md` → `user.model.js`).
- No `password` anywhere in the response — `select: false` + the `SENSITIVE_FIELDS` transform both did their job.
- `201`, not `200` — the controller explicitly uses `HTTP_STATUS.CREATED` since a new resource was made.

### Test 2 — a broken `-H` flag, and why it failed the way it did

```bash
curl -X POST http://localhost:5700/api/register \
  -H "Content-Type": "application/json" \
  -d '{"firstName":"shaba","lastName":"cama","email": "sala@gmail.com", "phoneNumber": "0552343578", "password": "ghana123"}'
```

**Result:**
```
{"success":false,"message":"None of the fields must be empty","code":"EMPTY_FIELDS"}
curl: (6) Could not resolve host: application
```

**What actually happened here — this is a shell quoting bug, not a server bug:**

The header was written as `-H "Content-Type": "application/json"` — note the stray colon+space *outside* the quotes. Bash doesn't see one header string; it sees **two separate, unrelated words**:
1. `-H` takes the next word as its argument: `Content-Type:` (with the colon, but nothing after it — an essentially empty/malformed header).
2. `"application/json"` is now just sitting there with *no flag in front of it*. curl treats any bare word like this as **another URL** to fetch. It tried to interpret `application/json` as a hostname (`application`) with a path (`/json`) — hence `curl: (6) Could not resolve host: application`. That error has nothing to do with the real server at all; curl never even reached `localhost:5700` for that part.

So this one command line actually fired off **two attempts**: a POST to `/api/register` with a broken `Content-Type` header, and a second, bogus request to a made-up host that failed instantly on curl's side.

**Why the server responded `EMPTY_FIELDS` instead of crashing:** without a correctly-formed `Content-Type: application/json` header, Express's `express.json()` middleware doesn't parse the body at all — it has no way of knowing the raw bytes sent are JSON. That leaves `request.body` unset. Normally that would've meant `request.body.firstName` etc. all read as `undefined` — but there's a small defensive middleware in `app.js` (added specifically because of an earlier bug caught during testing — see `docs/app-and-server.md`) that guarantees `request.body` defaults to `{}` instead of `undefined` when nothing was parsed. So the service correctly saw *no fields at all* and rejected it cleanly with `400 EMPTY_FIELDS`, instead of crashing with a raw `TypeError`. **Correct syntax** is either `-H "Content-Type: application/json"` (colon *inside* the quotes, one string) — as in Test 1 — or no quotes around the colon at all: `-H Content-Type:application/json`.

### Test 3 — duplicate email correctly rejected

```bash
curl -X POST http://localhost:5700/api/register \
  -H "Content-Type: application/json" \
  -d '{"firstName": "shege", "lastName": "sheg", "email":"ghsou1@gmail.com", "phoneNumber": "0552234568", "password":"ghana123"}'
```

**Result:**
```json
{"success":false,"message":"Email already exists","code":"EMAIL_EXISTS"}
```

`ghsou1@gmail.com` was already used in Test 1 — this proves the `User.exists({ email: normalizedEmail })` pre-check in `register.service.js` actually works, and returns a clean `409`-shaped error rather than a raw MongoDB duplicate-key error.

### Test 4 — a second, independent successful registration

```bash
curl -X POST http://localhost:5700/api/register \
  -H "Content-Type:application/json" \
  -d '{"firstName":"carl", "lastName":"papa", "email":"pyay@gmail.com", "phoneNumber": "0554343576", "password": "ghana123"}'
```

**Result:** `201 Created`
```json
{"title":"Register","success":true,"message":"User registered successfully","user":{"firstName":"carl","lastName":"papa","email":"pyay@gmail.com","phoneNumber":"+233554343576","country":"GH","isSeller":false,"role":"customer","isDeleted":false,"createdAt":"2026-08-15T16:31:51.950Z","updatedAt":"2026-08-15T16:31:51.950Z","id":"6a8094771f06ad84f2b85e19"}}
```
(Also proves `-H "Content-Type:application/json"` — no space after the colon, still one clean quoted string — works fine; curl doesn't care about the missing space, only about the header staying inside one argument.)

### ✅ Verified for this endpoint
- [x] Successful registration → `201`, cookies set, phone normalized, password never exposed
- [x] Malformed `Content-Type` header → body arrives empty → clean `400 EMPTY_FIELDS` (not a crash)
- [x] Duplicate email → clean `409 EMAIL_EXISTS`
- [x] A second, independent user can register right after

---

*Next up: `POST /api/login`.*

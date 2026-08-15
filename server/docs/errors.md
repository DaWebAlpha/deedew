# `src/errors/` — Typed Application Errors

This document explains the error class hierarchy used throughout the app, and exactly how a thrown error turns into the JSON response a client actually receives.

## Index

- [`app.error.js`](#apperrorjs) — `AppError` (the base class)
- [`badRequest.error.js`](#badrequesterrorjs) — `BadRequestError` (400)
- [`unauthenticated.error.js`](#unauthenticatederrorjs) — `UnauthenticatedError` (401)
- [`forbidden.error.js`](#forbiddenerrorjs) — `ForbiddenError` (403)
- [`notFound.error.js`](#notfounderrorjs) — `NotFoundError` (404)
- [`conflict.error.js`](#conflicterrorjs) — `ConflictError` (409)
- [`internalServer.error.js`](#internalservererrorjs) — `InternalServerError` (500)
- [`index.js`](#indexjs) — the barrel

## The big idea, before the code

JavaScript's built-in `Error` class has no idea about HTTP. Throwing `new Error("Email already exists")` somewhere deep in a service gives the code that catches it no clean way to know "this should become a 409 response," versus "this should become a 400," versus "this is a genuine bug and should be hidden from the client entirely." Every file in this folder exists to fix that: each one is a small class that *is* an `Error` (so `throw`/`try`/`catch` all still work completely normally), but also carries an HTTP status code and a machine-readable code string along with it.

---

## `app.error.js`

```js
import { HTTP_STATUS } from "../constants/index.js";

class AppError extends Error{
    constructor({
        message,
        statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR,
        code,
    } = {}){
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;

        if(Error.captureStackTrace){
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

export {
    AppError
}
```

### Line by line

- `class AppError extends Error` — this is JavaScript **class inheritance**: `AppError` *is a* `Error`, with everything a normal `Error` already has (a `.message`, a `.stack`), plus whatever extra is added here. Anything anywhere in the codebase (or in a library) that already knows how to handle a plain `Error` still works correctly on an `AppError`.
- `constructor({ message, statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR, code } = {})` — takes one options object instead of separate positional arguments (`new AppError({ message: "...", statusCode: 404 })` rather than `new AppError("...", 404, "...")`). This is deliberately self-documenting at the call site, and means the order of the properties never matters, and new properties can be added later without breaking any existing call.
- `super(message);` — calls `Error`'s own constructor, passing just the message along. This is *required* in JavaScript — any class that `extends` another class must call `super(...)` before it can use `this`.
- `this.statusCode = statusCode;` — attaches the HTTP status code as a real property on the error object. A plain `Error` has no concept of this; this line is what teaches it one.
- `this.code = code;` — a short, machine-readable string (like `"EMAIL_EXISTS"`), meant for a *frontend* to branch on programmatically (`if (error.code === "EMAIL_EXISTS") highlightTheEmailField()`), as opposed to `message`, which is meant for a human to read.
- **`this.isOperational = true;`** — the single most important line in this file. "Operational" here means *"an error I threw on purpose, because I understood exactly what went wrong."* This flag is what lets the central error handler (`middleware/errorHandler.middleware.js`) tell the difference between a `ConflictError("Email already exists")` — safe to show the real message to the client — and a genuine bug, like a typo causing `undefined.someProperty` to throw a raw `TypeError` — which should *never* have its real message shown to a stranger over the network, since it might leak internal details.
- `if(Error.captureStackTrace){ Error.captureStackTrace(this, this.constructor); }` — a V8 (the JavaScript engine Node runs on)-specific feature that produces a cleaner stack trace, starting from wherever the error was actually thrown, rather than including the internal frames of this constructor itself. The `if` guard exists because this method isn't guaranteed to exist on every JS engine, only V8 — checking first avoids a crash on an engine that doesn't have it.

### Used in this project

Never thrown directly anywhere in application code (every real throw site uses one of the six subclasses below) — with one specific exception: `utils/password.argon2.js` throws a bare `new AppError({ message: "Internal security error.", code: "PASSWORD_HASH_FAILURE" })` when Argon2 hashing itself fails unexpectedly. That's deliberate — none of the six named subclasses (400/401/403/404/409) really fit "the hashing library itself broke," so it falls back to `AppError`'s own default `statusCode` (500, from `HTTP_STATUS.INTERNAL_SERVER_ERROR`).

---

## `badRequest.error.js`, `conflict.error.js`, `forbidden.error.js`, `internalServer.error.js`, `notFound.error.js`, `unauthenticated.error.js`

These six files all follow the *exact* same three-line pattern, so they're grouped together here instead of repeated six times. Using `badRequest.error.js` as the representative example:

```js
import { AppError } from "./app.error.js";
import { HTTP_STATUS } from "../constants/index.js";

class BadRequestError extends AppError{
    constructor({
        message= "Bad request error",
        code
    } = {}){
        super({
            message,
            statusCode: HTTP_STATUS.BAD_REQUEST,
            code
        })
    }
}

export {
    BadRequestError
}
```

### Line by line

- `class BadRequestError extends AppError` — each of these six classes extends `AppError` (not `Error` directly), inheriting the `isOperational = true` flag and the stack-trace cleanup for free.
- `message = "Bad request error"` — a **default** message, used only if the code that throws this error doesn't provide its own (in practice, every real throw site in this project *does* provide a specific message, so this default rarely shows up — it exists mainly so `new BadRequestError()` with no arguments at all is still valid and produces something sensible).
- `super({ message, statusCode: HTTP_STATUS.BAD_REQUEST, code })` — calls `AppError`'s constructor, hardcoding the one thing that makes this class distinct: its status code. This is the entire reason these six classes exist separately — so that throwing a `NotFoundError` *always* means a 404, without whoever's throwing it having to remember or type that number.

The other five files are identical in shape, each hardcoding a different status:

| Class | Status | Meaning |
|---|---|---|
| `BadRequestError` | 400 | The request itself is malformed or fails validation — the caller's fault. |
| `UnauthenticatedError` | 401 | No valid credentials were provided at all. |
| `ForbiddenError` | 403 | Credentials are valid, but this specific action isn't allowed. |
| `NotFoundError` | 404 | Whatever was asked for doesn't exist. |
| `ConflictError` | 409 | The request conflicts with the current state (e.g. a duplicate). |
| `InternalServerError` | 500 | An unexpected server-side failure. |

### Used in this project

These are thrown constantly, all across `services/` and `middleware/`. A representative example of each, so the distinction is concrete:

- **`BadRequestError`** — `services/auth/register.service.js`: `throw new BadRequestError({ message: "None of the fields must be empty", code: "EMPTY_FIELDS" })` when required registration fields are missing.
- **`UnauthenticatedError`** — `middleware/authenticate.middleware.js`: thrown when no access-token cookie is present at all, or the token is expired/invalid.
- **`ForbiddenError`** — `services/auth/login.service.js`: thrown when the account is banned or suspended — the credentials might be entirely correct, but the action still isn't allowed.
- **`NotFoundError`** — `utils/fetchOrNotFound.js`: thrown whenever a lookup by id finds nothing.
- **`ConflictError`** — `services/auth/register.service.js`: thrown when the email or phone number is already registered.
- **`InternalServerError`** — `models/auth/user.model.js`'s `comparePassword`: thrown if the password field wasn't loaded from the database (a programmer mistake, not a user-facing problem), or if password verification itself fails unexpectedly.

---

## `index.js`

```js
export { AppError } from "./app.error.js";
export { BadRequestError } from "./badRequest.error.js";
export { ConflictError } from "./conflict.error.js";
export { ForbiddenError } from "./forbidden.error.js";
export { InternalServerError } from "./internalServer.error.js";
export { NotFoundError } from "./notFound.error.js";
export { UnauthenticatedError } from "./unauthenticated.error.js";
```

The barrel — every file in the project that needs to throw one of these errors imports from `"../errors/index.js"` (or `"../../errors/index.js"`, etc.), e.g. `import { BadRequestError, ConflictError } from "../../errors/index.js";`, rather than importing each class from its own individual file.

## How a thrown error actually becomes an HTTP response

This is worth tracing end to end, since none of the classes above do anything *by themselves* except carry information — something else has to actually read that information and act on it.

1. A service throws, e.g. `throw new ConflictError({ message: "Email already exists", code: "EMAIL_EXISTS" })`.
2. That service was called from inside a controller wrapped in `asyncHandler` (see `docs/utils.md`), which catches the rejected promise and calls Express's `next(error)`.
3. Express routes that error to `middleware/errorHandler.middleware.js`, the last piece of middleware registered in `app.js`.
4. `errorHandler` reads `error.statusCode` (409), `error.isOperational` (`true`, since this came from an `AppError` subclass), and `error.code`/`error.message`, and sends back exactly `{"success": false, "message": "Email already exists", "code": "EMAIL_EXISTS"}` with HTTP status 409.

If step 1 had instead been a genuine bug — say, a typo causing `undefined.trim()` to throw a raw `TypeError` — that error has no `statusCode` and no `isOperational` flag at all. `errorHandler` falls back to `HTTP_STATUS.INTERNAL_SERVER_ERROR` (500) and replaces the real message with the generic `"Something went wrong"`, while still logging the *real* error (with its full stack trace) via `systemLogger.error` so it's visible on the server side, just never exposed to the client.

# `src/models/` — Database Schemas

This document explains every file in `models/`: what each schema represents, how the code works line by line, and every place in the project that actually uses it. Written for someone new to Mongoose — jargon is explained the first time it appears.

**A quick mental model before diving in:** MongoDB itself is "schemaless" — it will happily store any shape of document you give it. **Mongoose** is the library this project uses to put a strict shape on top of that (required fields, types, validation, default values) and to give you a JavaScript class (a "Model") to actually query and save documents with. Every file in this folder either builds one of those shapes (a "schema") or provides shared building blocks that every schema in the app is assembled from.

## Index

**Shared foundation** (`base/`) — every other model in this folder is built on top of this:
- [`base/auditFields.js`](#baseauditfieldsjs) — `auditFields`
- [`base/mongoose.schema.options.js`](#basemongooseschemaoptionsjs) — `mongooseSchemaOptions`, `transformDocument`
- [`base/mongoose.schema.js`](#basemongooseschemajs) — `createSchema`
- [`base/helper/softDelete.helper.js`](#basehelpersoftdeletehelperjs) — `softDeleteDocument`
- [`base/helper/restore.helper.js`](#basehelperrestorehelperjs) — `restoreDocument`
- [`base/helper/pagination.helper.js`](#basehelperpaginationhelperjs) — `paginateCollection`
- [`base/helper/index.js`](#basehelperindexjs) — barrel for the three helpers above
- [`base/index.js`](#baseindexjs) — barrel for everything in `base/`

**Real models** — the actual collections this app stores data in:
- [`auth/user.model.js`](#authusermodeljs) — `User`
- [`auth/refreshToken.model.js`](#authrefreshtokenmodeljs) — `RefreshToken`
- [`auth/userSecurity.model.js`](#authusersecuritymodeljs) — `UserSecurity`
- [`auth/loginLogs.model.js`](#authloginlogsmodeljs) — `LoginLog`
- [`ping.model.js`](#pingmodeljs) — `Ping`

**Barrels:**
- [`auth/index.js`](#authindexjs)
- [`index.js`](#indexjs-top-level)

---

## `base/auditFields.js`

```js
import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

const fieldOptions = {
    type: ObjectId,
    ref: "User",
    default: null
}

const fieldDate = {
    type: Date,
    default: null,
}

const fieldBoolean = {
    type: Boolean,
    default: false,
}

const fieldReason = {
    type: String,
    default: null
}

const auditFields = {
    createdBy: fieldOptions,
    updatedBy: fieldOptions,
    deletedBy: fieldOptions,
    restoredBy: fieldOptions,

    deletedAt: fieldDate,
    restoredAt: fieldDate,

    isDeleted: fieldBoolean,

    deleteReason: fieldReason,
    restoreReason: fieldReason
}

export { auditFields }
```

### What problem this solves

Almost every model in this app needs the same nine "bookkeeping" fields — not because *this specific model* needs them, but because the whole app has a consistent policy: **nothing gets hard-deleted.** Deleting a `User` or a `Ping` doesn't remove it from the database; it flips a flag (`isDeleted`) and records who did it, when, and why — so it can be undone (`restore`), and so there's always an audit trail. `auditFields` is that shared set of fields, defined once.

### Line by line

- `const { ObjectId } = mongoose.Schema.Types;` — pulls Mongoose's `ObjectId` type out. This is the type used for any field that stores *another document's id* (a reference), like "which user deleted this."
- `fieldOptions`, `fieldDate`, `fieldBoolean`, `fieldReason` — four small, reusable field-definition objects. Rather than writing out `{ type: ObjectId, ref: "User", default: null }` four separate times (once each for `createdBy`, `updatedBy`, `deletedBy`, `restoredBy`), it's written once and reused. This is safe here specifically because every field that reuses `fieldOptions` shares the exact same *default* value (`null`, a primitive) — reusing an object like this would be dangerous if the default were something mutable like an array, because every field would then share the *same* array in memory. That's not a risk here.
- `fieldOptions: { type: ObjectId, ref: "User", default: null }` — `ref: "User"` is what makes this a **reference field**: Mongoose doesn't store a copy of the User document here, just their `_id`. Later, code can call `.populate("createdBy")` on a query to swap that raw id for the real User document, on demand.
- `auditFields` — the actual object every schema spreads into itself. `createdBy`/`updatedBy` track normal edits; `deletedBy`/`deletedAt`/`deleteReason` track a soft-delete; `restoredBy`/`restoredAt`/`restoreReason` track undoing one; `isDeleted` is the actual flag everything else checks.

### Used in this project

Never imported directly by application code — it's used by exactly one file, `base/mongoose.schema.js`, which spreads it into *every* schema built through `createSchema()` (explained next). That indirect usage is what gives `User`, `Ping`, `RefreshToken`, and `UserSecurity` all nine of these fields automatically, without any of those files mentioning `auditFields` themselves.

---

## `base/mongoose.schema.options.js`

```js
import { SENSITIVE_FIELDS } from "../../constants/index.js";

const transformDocument = (_document, returnedObject) => {
    if(returnedObject._id){
        returnedObject.id = returnedObject._id.toString();
        delete returnedObject._id;
    }

    delete returnedObject.__v;

    for(const field of SENSITIVE_FIELDS){
        delete returnedObject[field];
    }

    for (const key in returnedObject){
        if(
            returnedObject[key] === null ||
            returnedObject[key] === undefined ||
            returnedObject[key] === ""
        ){
            delete returnedObject[key]
        }
    }

    return returnedObject;
}

const serializationOptions = Object.freeze({
    virtuals: true,
    transform: transformDocument,
})

const mongooseSchemaOptions = Object.freeze({
    timestamps: true,
    strict: true,
    strictQuery: true,
    minimize: false,
    id: false,
    optimisticConcurrency: true,
    toJSON: serializationOptions,
    toObject: serializationOptions,
})

export { mongooseSchemaOptions };
```

### What problem this solves

Two separate concerns live in this file: **(1)** what a document looks like when it's turned into JSON to send back to a client, and **(2)** a handful of Mongoose behavior settings every schema in the app should share. Neither of these should be repeated by hand in every model file — get one detail wrong in one model (forget to strip `__v`, forget to rename `_id`) and that one model's API responses look inconsistent with every other model's.

### Line by line

- **`transformDocument(_document, returnedObject)`** — Mongoose calls this function automatically, on every document, every time it's converted to JSON (which happens implicitly whenever you do `response.json(someDocument)`). `_document` is the original live Mongoose document (the underscore prefix is a convention meaning "this parameter exists because the function signature requires it, but this function doesn't use it"). `returnedObject` is a *plain* JavaScript object (not a Mongoose document anymore) that's about to be sent — whatever this function returns is the final JSON shape.
  - `returnedObject.id = returnedObject._id.toString();` then `delete returnedObject._id;` — MongoDB's real primary key field is `_id`, and it's not a plain string (it's an `ObjectId` object internally). This renames it to a friendlier `id` and converts it to an actual string, so API responses look like `{"id": "664f..."}` rather than something like `{"_id": {"$oid": "664f..."}}`.
  - `delete returnedObject.__v;` — `__v` is Mongoose's internal version counter (explained more under `optimisticConcurrency` below). It's meaningless to a client, so it's stripped.
  - `for(const field of SENSITIVE_FIELDS){ delete returnedObject[field]; }` — loops over the list of sensitive field names (from `constants/sensitiveFields.js` — things like `"password"`, `"tokenHash"`) and removes any of them that happen to exist on this object. This is a **second, independent safety net**: even if a query somewhere forgot to explicitly exclude a password field, it still can't leak through this transform.
  - The final `for...in` loop deletes any field whose value is `null`, `undefined`, or an empty string — this is just tidiness, so a healthy `User` document doesn't show up in an API response cluttered with a dozen `"deletedBy": null, "deleteReason": null, ...` fields that don't apply to it.
- **`serializationOptions`** — bundles `virtuals: true` (include computed/virtual fields in the output, not only real stored fields — none of this project's models currently define virtuals, but the option is on so any added later work automatically) with the `transform` function above.
- **`mongooseSchemaOptions`** — the actual settings object every model spreads into its own schema:
  - `timestamps: true` — Mongoose automatically adds and maintains `createdAt`/`updatedAt` fields, with zero extra code per model.
  - `strict: true` — if you try to save a field that isn't in the schema, Mongoose silently drops it rather than saving it. (This is Mongoose's own default already, but it's spelled out here explicitly so it's never accidentally overridden.)
  - `strictQuery: true` — the same idea, applied to *query filters* — querying on a field name that doesn't exist in the schema won't accidentally match everything.
  - `minimize: false` — by default Mongoose strips out empty nested objects (`{}`) before saving; turning this off keeps them, which matters once a model has a genuinely optional nested object field.
  - `id: false` — Mongoose can auto-generate its *own* separate virtual `id` getter; this turns that off, because `transformDocument` above is already handling the `_id` → `id` rename itself, and having both would be redundant.
  - `optimisticConcurrency: true` — turns on **optimistic locking**, using that `__v` field. Every time a document is loaded and then saved, Mongoose checks the `__v` it started with still matches what's in the database; if two requests loaded the same document and both try to save changes, the *second* one to save fails loudly (instead of silently overwriting the first request's changes) — because its `__v` no longer matches.
  - `toJSON`/`toObject: serializationOptions` — wires the transform function into both of the two ways a Mongoose document can be converted to a plain object.

### Used in this project

Not used directly by any real model — like `auditFields`, this is consumed by `createSchema()` (next section), which every real model calls. The **one exception** is `models/auth/loginLogs.model.js`, which imports `mongooseSchemaOptions` *directly* (not through `createSchema`) — explained in that model's own section below, since `LoginLog` deliberately opts out of the audit-fields/soft-delete behavior but still wants the same JSON-cleanup behavior.

---

## `base/mongoose.schema.js`

```js
import mongoose from "mongoose";
import { auditFields } from "./auditFields.js";
import { mongooseSchemaOptions } from "./mongoose.schema.options.js";
import {
    softDeleteDocument,
    restoreDocument,
    paginateCollection
} from "./helper/index.js";

const createSchema = (schemaDefinition, options = {}) => {
    const schema = new mongoose.Schema(
        {
            ...schemaDefinition,
            ...auditFields
        },
        {
            ...mongooseSchemaOptions,
            ...options
        }
    )

    schema.methods.softDelete = function({
        deletedByUserId,
        reason,
        session
    } = {}){
        return softDeleteDocument({document: this, deletedByUserId, reason, session});
    }

    schema.methods.restore = function ({ restoreUserId, reason, session = null } = {}) {
        return restoreDocument({ document: this, restoreUserId, reason, session });
    };

    schema.statics.paginate = function (params = {}) {
        return paginateCollection({ model: this, ...params });
    };

    return schema;
}

export { createSchema }
```

### What problem this solves

This is the single most important file in the whole `models/` folder — it's the **factory function** every real model calls instead of building its schema by hand with `new mongoose.Schema(...)`. It's what actually glues `auditFields`, `mongooseSchemaOptions`, and the three helper functions together into one consistent package, so `User`, `Ping`, `RefreshToken`, and `UserSecurity` all automatically get soft-delete, restore, and pagination support without repeating any of that logic.

### Line by line

- `createSchema(schemaDefinition, options = {})` — takes the *model-specific* fields (e.g. `User`'s `firstName`, `email`, `password`...) as `schemaDefinition`, plus an optional `options` object for anything that specific model needs to override.
- `{ ...schemaDefinition, ...auditFields }` — **object spread**: builds one combined object containing every field from both. If `schemaDefinition` has `firstName` and `auditFields` has `isDeleted`, the final schema has both `firstName` *and* `isDeleted`. If the two happened to define the same key, the later one (`auditFields`, since it's spread second) would win — but in practice no model field ever collides with an audit field name.
- `{ ...mongooseSchemaOptions, ...options }` — same spreading idea, for schema *options* rather than *fields*. The shared defaults come first, and a model's own `options` argument can override any specific one if it genuinely needs to.
- `new mongoose.Schema({...}, {...})` — this is the actual, real call to Mongoose's own `Schema` constructor. Everything above this line was just *preparing* the two arguments it needs.
- **`schema.methods.softDelete = function ({...} = {}) {...}`** — this is how you attach an **instance method** in Mongoose: anything assigned onto `schema.methods.X` becomes callable as `.X()` on any document created from this schema (e.g. `someUser.softDelete()`). It's written as a plain `function`, not an arrow function `() => {}` — deliberately. Inside a normal `function`, Mongoose sets `this` to be the actual document instance when you call it as `someUser.softDelete()`. An arrow function doesn't get its own `this` at all — it would inherit whatever `this` happens to be in the surrounding scope, which is not the document, and the method would break.
  - `return softDeleteDocument({ document: this, deletedByUserId, reason, session });` — the method itself is just one line: hand off to the real logic in `softDelete.helper.js`, passing `this` (the specific document) along with whatever arguments were given.
- **`schema.methods.restore`** — the same pattern, delegating to `restore.helper.js`.
- **`schema.statics.paginate = function (params = {}) {...}`** — this is a **static method**, attached to `schema.statics` instead of `schema.methods`. The difference matters: a static is called on the *model itself* — `User.paginate({...})`, not on one document. Inside a static function, `this` refers to the model/collection as a whole, which is exactly why it's passed to the helper as `model: this`.
- `return schema;` — hands back the fully assembled schema, ready for `mongoose.model("Name", schema)` to turn into an actual usable Model class (that final step happens in each individual model file, not here).

### Used in this project

Called by every real model in this project except `LoginLog`:

```js
// models/ping.model.js
const pingSchema = createSchema(pingSchemaDefinition);
```
```js
// models/auth/user.model.js
const userSchema = createSchema(userSchemaDefinition);
```

The direct, visible payoff: because `User` and `Ping` are both built through `createSchema`, both automatically support things like:
```js
await somePing.softDelete({ deletedByUserId: adminId, reason: "spam" });
await User.paginate({ filter: { role: "admin" }, page: 1, limit: 20 });
```
— without `ping.model.js` or `user.model.js` ever writing that logic themselves.

---

## `base/helper/softDelete.helper.js`

```js
const softDeleteDocument = async({
    document,
    deletedByUserId = null,
    reason = null,
    session = null,
} = {}) => {

    if(document.isDeleted){
        return document
    }

    document.isDeleted = true;
    document.deletedBy = deletedByUserId;
    document.deletedAt = new Date();
    document.deleteReason = reason;

    return document.save({
        session,
        validateBeforeSave: false
    })
}

export {
    softDeleteDocument
};
```

### Line by line

- Takes the actual document instance (`document`) plus who's deleting it and why.
- `if(document.isDeleted){ return document }` — makes the whole operation **idempotent**: calling soft-delete twice on an already-deleted document just returns it unchanged, rather than overwriting `deletedAt` with a new timestamp or throwing an error.
- The four field assignments record the delete: flip the flag, record who, record when (`new Date()` — right now), record why.
- `document.save({ session, validateBeforeSave: false })` — writes the change to MongoDB. `validateBeforeSave: false` skips re-running the schema's normal validation rules (required fields, string formats, etc.) — this save isn't touching any of the document's *real* content fields, only internal bookkeeping ones, so re-validating everything else would be pointless extra work, and could even wrongly fail on an old document that doesn't satisfy some validation rule that was added after it was originally created.

### Used in this project

Not called directly anywhere in application code — it's only ever called from inside `base/mongoose.schema.js`'s `softDelete` instance method (shown above), which is what every service actually calls: e.g. `services/admin/users/deleteUser.service.js` does `await user.softDelete({ deletedByUserId, reason });`.

---

## `base/helper/restore.helper.js`

```js
const restoreDocument = async ({
    document,
    restoreUserId = null,
    reason = null,
    session = null

} = {} ) => {
    if(!document.isDeleted){
        return document;
    }

    document.isDeleted = false;
    document.deletedBy = null;
    document.deletedAt = null;
    document.deleteReason = null

    document.restoredAt = new Date();
    document.restoredBy = restoreUserId;
    document.restoreReason = reason

    return document.save({session, validateBeforeSave: false})
}

export { restoreDocument };
```

### Line by line

The exact mirror image of `softDeleteDocument`: `if(!document.isDeleted){ return document; }` guards against restoring something that was never deleted (idempotent the other way). It clears all three delete-related fields back to their defaults, then stamps who restored it, when, and why — same `validateBeforeSave: false` reasoning as above.

### Used in this project

Same pattern as `softDeleteDocument` — only ever reached through `document.restore({...})`, which is what services actually call, e.g. `services/admin/users/restoreUser.service.js`: `await user.restore({ restoreUserId, reason });`.

---

## `base/helper/pagination.helper.js`

```js
const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_MAX_LIMIT = 100;

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

const paginateCollection = async ({
    model,
    filter = {},
    projection = null,
    page = 1,
    limit = DEFAULT_PAGE_SIZE,
    options = {},
    session = null,
} = {}) => {
    const safePage = Math.max(1, Number(page) || 1);
    const requestedLimit = Math.max(1, Number(limit) || DEFAULT_PAGE_SIZE);
    const safeLimit = Math.min(requestedLimit, DEFAULT_MAX_LIMIT);
    const skip = (safePage - 1) * safeLimit;

    const finalFilter = hasOwn(filter, "isDeleted")
        ? filter
        : { ...filter, isDeleted: false };

    const { sort, populate, lean, ...queryOptions } = options;

    let query = model.find(finalFilter, projection).setOptions(queryOptions);

    if (session) { query = query.session(session); }
    if (sort) { query = query.sort(sort); }

    query = query.skip(skip).limit(safeLimit);

    if (populate) { query = query.populate(populate); }
    if (lean === true) { query = query.lean(); }

    let countQuery = model.countDocuments(finalFilter);
    if (session) { countQuery = countQuery.session(session); }

    const [data, total] = await Promise.all([
        query.exec(),
        countQuery.exec(),
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

export { paginateCollection, DEFAULT_PAGE_SIZE, DEFAULT_MAX_LIMIT };
```

### What problem this solves

"Give me page 2, 20 results at a time, and tell me how many pages there are total" is needed by nearly every admin list endpoint. This is the shared implementation, attached to every `createSchema()`-built model as `.paginate()`.

### Line by line (the parts that matter most)

- `hasOwn(object, key)` — a careful way to check "does this object genuinely have this key," immune to an edge case where a plain `object[key]` check could be fooled if `key` happened to be falsy-but-present (like `isDeleted: false`, which is exactly the situation this function is used for one line later).
- **`finalFilter = hasOwn(filter, "isDeleted") ? filter : { ...filter, isDeleted: false }`** — this is the single most important line in the file. Every list query defaults to hiding soft-deleted documents automatically, *unless* the caller's own filter already explicitly mentions `isDeleted` (which is exactly what an admin "view deleted users" endpoint does — it passes `filter: { isDeleted: true }`, and this line steps aside and uses that instead). This means "don't show deleted stuff" is enforced in one place, instead of every single list service having to remember to add that filter by hand.
- `const { sort, populate, lean, ...queryOptions } = options;` — **destructuring with rest**: pulls `sort`, `populate`, and `lean` out into their own named variables, and collects *everything else* passed in `options` into a new object, `queryOptions`. This lets the function accept arbitrary extra low-level Mongoose query settings without having to list every possible one by name.
- `query.skip(skip).limit(safeLimit)` — the actual pagination: skip past the earlier pages' worth of documents, then take only `safeLimit` of what's left.
- `if (lean === true) { query = query.lean(); }` — `.lean()` makes MongoDB return plain JavaScript objects instead of full Mongoose documents, which is meaningfully faster for read-heavy list endpoints — **but** it also means the results skip `transformDocument` entirely (no `_id`→`id` rename, no `SENSITIVE_FIELDS` stripping). That's why this is opt-*in* (`lean === true` must be explicitly passed) rather than a default — a caller has to consciously decide a given model has nothing sensitive to hide before asking for the faster path.
- `Promise.all([query.exec(), countQuery.exec()])` — fetches the actual page of results and counts the total matching documents **at the same time**, since neither depends on the other, cutting the wait roughly in half versus doing them one after another.
- The returned object's `hasNextPage`/`hasPreviousPage`/`totalPages` are computed here so that a frontend list view never has to do this arithmetic itself.

### Used in this project

Reached through `Model.paginate({...})` — every `getAllActiveX`/`getAllDeletedX` admin service uses it, e.g. `services/admin/users/getAllActiveUsers.service.js`:
```js
const result = await User.paginate({
    filter: { ...buildUserSearchFilter({ role, search }), isDeleted: false },
    page,
    limit
})
```
Since this filter object already explicitly includes `isDeleted: false`, `hasOwn(filter, "isDeleted")` is `true`, so `paginateCollection` uses that filter exactly as given (which, in this case, happens to say the same thing the default would have anyway).

**Note:** `LoginLog` deliberately does **not** use this — see `paginateQuery` in `docs/utils.md`, which exists specifically because `LoginLog` has no `isDeleted` field at all, and this function's `isDeleted`-aware default would silently match zero documents on that model.

---

## `base/helper/index.js`

```js
export { restoreDocument } from "./restore.helper.js";
export { softDeleteDocument } from "./softDelete.helper.js";
export { paginateCollection } from "./pagination.helper.js";
```

A small **barrel file** — re-exports the three helper functions above so `mongoose.schema.js` can import all three from one path (`./helper/index.js`) instead of three separate file paths.

---

## `base/index.js`

```js
export { createSchema } from "./mongoose.schema.js";
export { auditFields } from "./auditFields.js";
export { mongooseSchemaOptions } from "./mongoose.schema.options.js";
export {
    restoreDocument,
    softDeleteDocument,
    paginateCollection
} from "./helper/index.js";
```

The top-level barrel for the entire `base/` folder. This is the file every real model actually imports from — e.g. `models/auth/user.model.js` does `import { createSchema } from "../base/index.js";` — rather than reaching into `base/mongoose.schema.js` directly.

---

## `auth/user.model.js`

```js
import mongoose from "mongoose";
import { createSchema } from "../base/index.js";

import {
    normalizeString, normalizeEmail, normalizeCountry, normalizePhoneNumber,
    hashPassword, verifyPassword
} from "../../utils/index.js";

import { AppError, BadRequestError, InternalServerError } from "../../errors/index.js";
import { systemLogger } from "../../logger/pino.logger.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164_REGEX = /^\+[1-9]\d{1,14}$/;

const userSchemaDefinition = {
    firstName: { type: String, trim: true, required: [true, "First name is required"], maxlength: [50, "First name is too long"] },
    lastName: { type: String, trim: true, required: [true, "Last name is required"], maxlength: [50, "Last name is too long"] },
    email: {
        type: String, required: [true, "Email is required"], unique: true, lowercase: true, trim: true,
        validate: { validator: (value) => EMAIL_REGEX.test(value), message: "Enter a valid email address" }
    },
    phoneNumber: {
        type: String, trim: true, required: [true, "Phone number is required"],
        validate: {
            validator(value){ return normalizePhoneNumber(value, normalizeCountry(this.country) || "GH") !== null; },
            message: "Enter a valid phone number",
        }
    },
    country: { type: String, default: "GH" },
    password: { type: String, required: [true, "Password is required"], minlength: [8, "Password must be atleast 8 characters"], select: false },
    isSeller: { type: Boolean, default: false },
    role: { type: String, enum: ["customer", "admin", "superadmin"], default: "customer" },
}

const userSchema = createSchema(userSchemaDefinition);

userSchema.index({email: 1, role: 1});
userSchema.index({phoneNumber: 1, role: 1});
userSchema.index({isSeller: -1});

userSchema.pre("save", async function(){
    if(!this.isModified("password")){ return; }
    this.password = await hashPassword(this.password);
})

userSchema.methods.comparePassword = async function(plainPassword){
    if(typeof plainPassword !== "string"){ return false; }

    if(!this.password){
        systemLogger.error({ userId: this._id }, "Password field not selected in query.");
        throw new InternalServerError({ message: "Internal authentication error.", code: "PASSWORD_NOT_SELECTED" });
    }

    try{
        return await verifyPassword(plainPassword, this.password)
    }catch(error){
        if (error instanceof AppError) { throw error; }
        systemLogger.error({ err: error }, "Password comparison failed.");
        throw new InternalServerError({ message: "Internal authentication error.", code: "PASSWORD_VERIFICATION_FAILED" });
    }
}

userSchema.pre("save", async function(){
    if(this.isModified("firstName") && this.firstName){ this.firstName = normalizeString(this.firstName); }
    if(this.isModified("lastName") && this.lastName){ this.lastName = normalizeString(this.lastName); }
    if(this.isModified("email") && this.email){ this.email = normalizeEmail(this.email); }
    if(this.isModified("country") && this.country){ this.country = normalizeCountry(this.country); }

    if ((this.isModified("phoneNumber") || this.isModified("country")) && this.phoneNumber) {
        if (!E164_REGEX.test(this.phoneNumber)) {
            const normalizedPhoneNumber = normalizePhoneNumber(normalizeString(this.phoneNumber), this.country || "GH");
            if (!normalizedPhoneNumber) {
                throw new BadRequestError({ message: "Enter a valid phone number", code: "INVALID_PHONE_NUMBER" });
            }
            this.phoneNumber = normalizedPhoneNumber.e164;
        }
    }
})

const User = mongoose.model("User", userSchema);

export { User }
```

### What this represents

Every registered account — customers, admins, and superadmins are all the *same* model, distinguished only by the `role` field. This is the most complex model in the project, so it's worth reading slowly.

### Line by line

**Field definitions:**
- `firstName`/`lastName` — plain required strings, `trim: true` (Mongoose's own built-in trimming, separate from the `normalizeString` call later — belt and suspenders), capped at 50 characters.
- `email` — `unique: true` creates a real MongoDB index that *rejects* a second document with the same email at the database level (this is the actual hard guarantee; app-level duplicate checks elsewhere are just a nicer error message layered on top). `lowercase: true` is Mongoose's own built-in lowercasing on save. `validate: { validator: (value) => EMAIL_REGEX.test(value), ... }` — a custom validation rule: `EMAIL_REGEX` is a regular expression checking for a very basic "something@something.something" shape; `.test(value)` returns `true`/`false`; Mongoose calls this automatically before every save and rejects the save with the given `message` if it returns `false`.
- `phoneNumber` — its `validator(value)` is a **named regular function**, not an arrow function, and that's deliberate: inside it, `this` refers to the document being validated, which is *why* `this.country` is readable here — it lets the validator check the phone number against whichever country was submitted alongside it, rather than always assuming Ghana.
- `password` — `select: false` means a normal `User.findOne(...)` **never** returns this field at all, by default; a query has to explicitly opt in with `.select("+password")` (used only in `login.service.js` and `changePassword.service.js`, where the actual hash needs to be compared).
- `role` — `enum: [...]` restricts the value to exactly one of the three listed strings; anything else fails validation. `default: "customer"` — every new registration is a plain customer unless something (like the admin-only "update role" endpoint) explicitly changes it later.

**Indexes:**
- `userSchema.index({email: 1, role: 1})` / `{phoneNumber: 1, role: 1})` — **compound indexes**, speeding up queries that filter by both fields together (e.g. "find an admin by email"). The `1` means ascending order.
- `{isSeller: -1}` — indexes sellers, descending, to make "list all sellers" queries fast (not currently used by any built endpoint, but ready for when a seller-facing feature exists).

**First `pre("save")` hook — password hashing:**
- `userSchema.pre("save", async function(){...})` — registers a function to run automatically, every time, right before a `User` document is saved (whether via `.create()` or `.save()`).
- `if(!this.isModified("password")){ return; }` — `isModified` is Mongoose's own tracking of which fields actually changed since the document was loaded (or, for a brand-new document, which fields were set at all). This guard is critical: without it, updating a user's `firstName` five years from now would re-hash the *already-hashed* password string as if it were a fresh plaintext password, permanently breaking that account's ability to log in.
- `this.password = await hashPassword(this.password);` — see `docs/utils.md`'s `password.argon2.js` section for what `hashPassword` actually does.

**`comparePassword` — an instance method:**
- `userSchema.methods.comparePassword = async function(plainPassword){...}` — attached the same way `softDelete`/`restore` are, callable as `someUser.comparePassword("typedPassword")`.
- `if(!this.password){ ...throw... }` — this specifically catches the case where whoever fetched this document forgot `.select("+password")` — `this.password` would be `undefined` in that case, and blindly calling `verifyPassword(plainPassword, undefined)` would just silently return `false` (a "wrong password" that's actually a programmer mistake). This throws a distinct, loud `PASSWORD_NOT_SELECTED` error instead, so that class of bug can never be mistaken for a genuinely wrong password during development.
- `if (error instanceof AppError) { throw error; }` — re-throws the app's own typed errors as-is (like the `PASSWORD_NOT_SELECTED` one just described, if it somehow got here via a nested call) rather than wrapping them in a second, more generic error.

**Second `pre("save")` hook — normalization:**
- This is a separate hook from the hashing one — Mongoose allows (and this project deliberately uses) multiple `pre("save")` hooks on the same schema; they run in the order they were registered. Splitting "hash the password" from "clean up the other fields" keeps each hook focused on one job.
- Each `if(this.isModified(field) && this.field)` block re-normalizes exactly the fields that actually changed, using the functions documented in `docs/utils.md`. **Concrete example:** registering with `firstName: " Kwame "` results in `this.firstName = normalizeString(" Kwame ")`, which is `"Kwame"` — that's the value that actually gets written to MongoDB.
- The phone number block is the most involved: `E164_REGEX.test(this.phoneNumber)` first checks whether the value already looks like a proper E.164 number (e.g. it wasn't changed, or was already normalized on a previous save) — if so, it skips re-normalizing it entirely. If it's *not* already in that shape, it runs it through `normalizePhoneNumber`, and **throws `BadRequestError` if that returns `null`** — meaning an invalid phone number is rejected right here, inside the save hook itself, with a specific `INVALID_PHONE_NUMBER` code, rather than silently saving a broken value.

### Used in this project

`User` is imported everywhere authentication or user data is involved — `services/auth/register.service.js`, `login.service.js`, `getCurrentUser.service.js`, `changePassword.service.js`, every `services/admin/users/*.service.js` file, `middleware/authenticate.middleware.js`, and more. One concrete, complete example — `services/auth/register.service.js`:
```js
[user] = await User.create(
    [{ firstName, lastName, email, country, phoneNumber, password }],
    { session },
);
```
This one call triggers both `pre("save")` hooks (hashing the password, normalizing every text field), runs every field's validators (including the phone number check), and — because of the schema's `unique: true` on `email` — would throw a MongoDB duplicate-key error (`code: 11000`) if that email were already registered, which `register.service.js`'s own `try/catch` translates into a clean `ConflictError`.

---

## `auth/refreshToken.model.js`

```js
import mongoose from "mongoose";
import { createSchema } from "../base/index.js";

const { ObjectId } = mongoose.Schema.Types;

const refreshTokenDefinition = {
    userId : { type: ObjectId, ref: "User", required: [true, "User id is required"] },
    tokenHash: { type: String, required: [true, "Token hash is required"], unique: true },
    expiresAt: { type: Date, required: [true, "Expiry is required"] },
    revokedAt: { type: Date, default: null },
    userAgent: { type: String, default: null },
    ipAddress: { type: String, default: null },
    deviceName: { type: String, default: null },
    deviceId: { type: String, default: null }
}

const refreshTokenSchema = createSchema(refreshTokenDefinition);

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

refreshTokenSchema.methods.isActive = function () {
    return !this.revokedAt && this.expiresAt.getTime() > Date.now();
};

refreshTokenSchema.methods.revoke = function ({ session = null } = {}) {
    this.revokedAt = new Date();
    return this.save({ session, validateBeforeSave: false });
};

const RefreshToken = mongoose.model("RefreshToken", refreshTokenSchema);

export { RefreshToken }
```

### What this represents

One document per active (or recently active) login session. See `docs/utils.md`'s `refreshTokenUtils.js` section for how the raw token itself is generated and hashed — this file is just the shape it's stored in.

### Line by line

- `userId` — `required: true`, not optional: a refresh token that belongs to nobody doesn't make sense (this was a real bug caught and fixed during the project's build — it originally defaulted to `null`).
- `tokenHash` — `unique: true` — the database itself guarantees no two `RefreshToken` documents can ever have the same hash, as a backstop against a token-generation bug ever producing a collision.
- `expiresAt` — required; computed by `generateRefreshToken` in `utils/refreshTokenUtils.js` as "now plus `config.jwtRefreshExpiryDays` days."
- `revokedAt` — `null` while active; set to a real timestamp the moment the session is logged out, rotated away, or force-revoked by an admin.
- `refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })` — a **TTL (time-to-live) index**. This is MongoDB itself doing background cleanup, not application code: MongoDB periodically scans this index and physically deletes any document whose `expiresAt` has passed. `expireAfterSeconds: 0` means "delete exactly at the timestamp stored in the field" (rather than, say, some number of seconds *after* it). This is why expired refresh tokens are never manually cleaned up anywhere in this codebase — the database does it on its own.
- `isActive()` — an instance method combining the two independent conditions that make a session usable: hasn't been explicitly revoked (`!this.revokedAt`), *and* hasn't naturally expired yet.
- `revoke({ session })` — flips `revokedAt` to now and saves. Skips full validation, same reasoning as `softDelete`/`restore`.

### Used in this project

Created by `generateRefreshToken` at login/register/refresh time. Checked via `.isActive()` and ended via `.revoke()` in: `services/auth/logout.service.js`, `services/auth/refreshToken.service.js` (revokes the old one as part of rotation), `services/auth/revokeSession.service.js`, and the batch version `RefreshToken.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } })` used by `logoutAllDevices.service.js` and the admin ban/suspend services (revoking every session at once, without loading each document individually).

---

## `auth/userSecurity.model.js`

```js
import mongoose from "mongoose";
import { createSchema } from "../base/index.js";
import { SECURITY_CONFIG } from "../../constants/index.js";

const { ObjectId } = mongoose.Schema.Types;

const userSecuritySchemaDefinition = {
    userId: { type: ObjectId, ref: "User", required: [true, "User id is required"], unique: true },
    failedLoginAttempts: { type: Number, default: 0 },
    lastFailedLoginAt: { type: Date, default: null },
    lockedUntil: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    lastLoginIp: { type: String, default: null },
    isBanned: { type: Boolean, default: false },
    bannedAt: { type: Date, default: null },
    bannedBy: { type: ObjectId, ref: "User", default: null },
    banReason: { type: String, default: null },
    unbannedAt: { type: Date, default: null },
    unbannedBy: { type: ObjectId, ref: "User", default: null },
    suspendedUntil: { type: Date, default: null },
    suspendedBy: { type: ObjectId, ref: "User", default: null },
    suspendReason: { type: String, default: null },
    unsuspendedAt: { type: Date, default: null },
    unsuspendedBy: { type: ObjectId, ref: "User", default: null },
}

const userSecuritySchema = createSchema(userSecuritySchemaDefinition);

userSecuritySchema.methods.isLocked = function () {
    return Boolean(this.lockedUntil) && this.lockedUntil.getTime() > Date.now();
};

userSecuritySchema.methods.isSuspended = function () {
    return Boolean(this.suspendedUntil) && this.suspendedUntil.getTime() > Date.now();
};

userSecuritySchema.methods.registerFailedAttempt = function({session = null} = {}){
    this.failedLoginAttempts = (this.failedLoginAttempts || 0) + 1;
    this.lastFailedLoginAt = new Date();

    if(this.failedLoginAttempts >= SECURITY_CONFIG.MAX_FAILED_LOGIN_ATTEMPTS){
        this.lockedUntil = new Date(Date.now() + SECURITY_CONFIG.LOCKOUT_DURATION_MINUTES * 60 * 1000);
    }

    return this.save({session, validateBeforeSave: false});
}

userSecuritySchema.methods.registerSuccessfulLogin = function({ipAddress = null, session = null} = {}){
    this.failedLoginAttempts = 0;
    this.lastLoginAt = new Date();
    this.lockedUntil = null;
    this.lastLoginIp = ipAddress;
    return this.save({session, validateBeforeSave: false});
}

userSecuritySchema.methods.ban = function ({ bannedByUserId = null, reason = null, session = null } = {}) {
    this.isBanned = true;
    this.bannedAt = new Date();
    this.bannedBy = bannedByUserId;
    this.banReason = reason;
    this.unbannedAt = null;
    this.unbannedBy = null;
    return this.save({ session, validateBeforeSave: false });
};

userSecuritySchema.methods.unban = function ({ unbannedByUserId = null, reason = null, session = null } = {}) {
    this.isBanned = false;
    this.bannedAt = null;
    this.bannedBy = null;
    this.banReason = null;
    this.unbannedAt = new Date();
    this.unbannedBy = unbannedByUserId;
    return this.save({ session, validateBeforeSave: false });
};

userSecuritySchema.methods.suspend = function ({ suspendedByUserId = null, reason = null, until, session = null } = {}) {
    this.suspendedUntil = until;
    this.suspendedBy = suspendedByUserId;
    this.suspendReason = reason;
    this.unsuspendedAt = null;
    this.unsuspendedBy = null;
    return this.save({ session, validateBeforeSave: false });
};

userSecuritySchema.methods.unsuspend = function ({ unsuspendedByUserId = null, reason = null, session = null } = {}) {
    this.suspendedUntil = null;
    this.suspendedBy = null;
    this.suspendReason = null;
    this.unsuspendedAt = new Date();
    this.unsuspendedBy = unsuspendedByUserId;
    return this.save({ session, validateBeforeSave: false });
};

userSecuritySchema.statics.findOrCreateForUser = async function (userId, { session = null } = {}) {
    let query = this.findOne({ userId });
    if (session) { query = query.session(session); }

    const existing = await query;
    if (existing) { return existing; }

    const [created] = await this.create([{ userId }], session ? { session } : undefined);
    return created;
};

const UserSecurity = mongoose.model("UserSecurity", userSecuritySchema);

export { UserSecurity };
```

### What this represents

**Not part of the original reference project this app is modeled on** — this model and everything built on it were designed specifically for this project, extending beyond the reference. It exists to hold everything about a user's *account standing* — failed logins, temporary lockout, bans, suspensions — in its **own** document, separate from `User` itself. That separation is deliberate: this data changes constantly (every failed login attempt is a write), and keeping it off the main `User` document means those writes never compete with `optimisticConcurrency`'s version check against genuine profile edits happening around the same time.

### Line by line

- `userId` — `unique: true` — exactly one `UserSecurity` document per user, ever.
- `failedLoginAttempts` / `lastFailedLoginAt` / `lockedUntil` — the automatic lockout system: how many wrong passwords in a row, when the last one happened, and (if locked) when the lockout ends.
- `isBanned` / `bannedAt` / `bannedBy` / `banReason` — an **indefinite** block, only ever lifted by an explicit admin `unban` action.
- `suspendedUntil` / `suspendedBy` / `suspendReason` — a **temporary** block with a specific end time, chosen by whichever admin issued it.
- `unbannedAt`/`unbannedBy`/`unsuspendedAt`/`unsuspendedBy` — the other half of the audit trail: not just *that* something was banned/suspended, but *that it was later lifted*, by whom, when.
- **`isLocked()` / `isSuspended()` — both methods, not properties.** This is worth calling out explicitly because getting it wrong once caused a real, severe bug during this project's build: `if (security.isLocked)` (referencing the *function itself*, without calling it) is always `true`, because a function value is truthy — that would have locked out every single login attempt, permanently, for every account. The fix is calling it: `if (security.isLocked())`.
- **`registerFailedAttempt`** — increments the counter, stamps the time, and — only once the count reaches `SECURITY_CONFIG.MAX_FAILED_LOGIN_ATTEMPTS` (5, by default) — sets `lockedUntil` to `SECURITY_CONFIG.LOCKOUT_DURATION_MINUTES` (15) minutes from now.
- **`registerSuccessfulLogin`** — the "all clear": resets the failed-attempt counter to zero, clears any lockout, records when/where the successful login happened.
- **`ban`/`unban`/`suspend`/`unsuspend`** — four mirror-image state-transition methods, each following the exact same shape as `softDelete`/`restore`: set the "on" fields, clear the opposite state's fields, save without full validation.
- **`findOrCreateForUser` — a static, not an instance method.** Since a brand-new user might never have logged in (and so might not have a `UserSecurity` document yet), this either finds the existing record or lazily creates a fresh one on the spot — every other function in this model assumes a record already exists, and this static is what guarantees that.

### Used in this project

Central to `services/auth/login.service.js`, which checks `security.isBanned`, `security.isSuspended()`, and `security.isLocked()` — in that order, most-severe-first — before ever comparing the password, and calls `registerFailedAttempt()`/`registerSuccessfulLogin()` afterward depending on the outcome. Also used by every service in `services/admin/security/` and the ban/suspend/unban/unsuspend services in `services/admin/users/`.

---

## `auth/loginLogs.model.js`

```js
import mongoose from "mongoose";
import { mongooseSchemaOptions } from "../base/index.js";

const { ObjectId } = mongoose.Schema.Types;

const loginLogSchemaDefinition = {
    userId: { type: ObjectId, ref: "User", default: null },
    identifier: { type: String, required: [true, "Identifier is required"] },
    success: { type: Boolean, required: true },
    reason: { type: String, default: null },
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
    deviceName: { type: String, default: null },
    deviceId: { type: String, default: null },
};

const loginLogSchema = new mongoose.Schema(loginLogSchemaDefinition, {
    ...mongooseSchemaOptions,
    timestamps: { createdAt: true, updatedAt: false },
});

loginLogSchema.index({ userId: 1, createdAt: -1 });
loginLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 });

const LoginLog = mongoose.model("LoginLog", loginLogSchema);

export { LoginLog };
```

### What this represents

Also not from the original reference project. One document per login *attempt* — successful or not — forming a security audit trail. This is the one model in the whole app that deliberately does **not** use `createSchema()`.

### Line by line

- `userId` — **not required.** A failed login attempt against an email that doesn't even exist can't point to a real user id, but it's still worth recording — for spotting patterns like someone trying many different (nonexistent) emails against the same account, i.e. brute-forcing.
- `identifier` — whatever the person actually typed to try to log in (an email or phone number), kept even when `userId` is `null`.
- `success` — required, no default: every log entry must explicitly say whether the attempt worked.
- `reason` — only meaningful on a failure (e.g. `"INVALID_CREDENTIALS"`, `"ACCOUNT_BANNED"`, `"ACCOUNT_SUSPENDED"`, `"ACCOUNT_TEMPORARILY_LOCKED"`); `null` on a success.
- **`new mongoose.Schema(loginLogSchemaDefinition, { ...mongooseSchemaOptions, timestamps: {...} })`** — this is the deliberate exception mentioned above. Rather than calling `createSchema()` (which would merge in all nine `auditFields` — including `isDeleted`, `deletedBy`, `restoredBy`...), this builds the schema directly with plain `new mongoose.Schema(...)`, spreading in `mongooseSchemaOptions` for the parts that *do* still make sense generically (the `_id`→`id` rename, `__v` stripping, sensitive-field stripping) — but skipping the audit fields and the `.softDelete()`/`.restore()` methods entirely.
- **Why this matters, not just as a style choice:** a security audit log needs to be *immutable* to actually be trustworthy as evidence. If `LoginLog` had a `.softDelete()` method, someone could quietly "delete" (hide) evidence of a suspicious login attempt. By never giving it that capability in the first place, there's no code path anywhere in the app that could do that, even by accident.
- `timestamps: { createdAt: true, updatedAt: false }` — this object form (instead of just `timestamps: true`) picks only `createdAt`. A log entry is never edited after creation, so `updatedAt` would always just equal `createdAt` — dead weight.
- `loginLogSchema.index({ userId: 1, createdAt: -1 })` — a compound index supporting the actual query this app runs: "this user's most recent login attempts first."
- `loginLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 })` — another TTL index (same mechanism as `RefreshToken`'s), auto-deleting log entries after 180 days — matching the same retention window used for the `auditLogger`'s own log files (see `logger/pino.logger.js`).

### Used in this project

Written to at the end of every login attempt in `services/auth/login.service.js` (both success and every distinct failure reason) and at the end of a successful registration in `register.service.js`. Read back via `services/admin/loginLogs/getUserLoginLogs.service.js` and `getUsersLoginLogs.service.js`, both of which use `paginateQuery` (see `docs/utils.md`) rather than `.paginate()`, specifically because this model has no `isDeleted` field for `.paginate()`'s default filter to work with.

---

## `ping.model.js`

```js
import mongoose from "mongoose";
import { createSchema } from "./base/index.js";

const pingSchemaDefinition = {
    message: {
        type: String,
        trim: true,
        required: [true, "Message is required"],
        maxlength: [5000, "Message is too long"]
    }
};

const pingSchema = createSchema(pingSchemaDefinition);

const Ping = mongoose.model("Ping", pingSchema);

export { Ping }
```

### What this represents

The very first model built in this project — originally just to prove the MongoDB connection worked end-to-end, kept around since as a simple, low-stakes example for practicing the `createSchema()` pattern (soft-delete, restore, pagination) without any of the complexity of the auth models. One field: `message`.

### Used in this project

Exercised through the full `services/admin/pings/` + `controllers/admin/pings/` + `routes/admin/pings.routes.js` set — the exact same list/get/delete/restore shape as `User`, just simpler.

---

## `auth/index.js`

```js
export { User } from "./user.model.js";
export { RefreshToken } from "./refreshToken.model.js";
export { UserSecurity } from "./userSecurity.model.js";
export { LoginLog } from "./loginLogs.model.js";
```

A barrel re-exporting all four auth-related models from one path.

## `index.js` (top-level)

```js
export * from "./auth/index.js";
export { Ping } from "./ping.model.js";
```

The top-level barrel for the entire `models/` folder — `export * from "./auth/index.js"` re-exports everything that file exports (all four auth models) without having to list them by name again, and `Ping` is added directly since it isn't grouped into its own subfolder. This is the file nearly every service in the project actually imports from — e.g. `import { User, RefreshToken } from "../../models/index.js";` — rather than reaching into individual model files.

**A real bug this file was involved in, worth knowing about:** at one point during this project's build, this file was trimmed down to just `export * from "./auth/index.js";`, dropping the `Ping` export — and separately, `ping.model.js` itself was deleted from disk entirely. Neither problem was noticed until new code tried to import `Ping` from here and the server crashed on startup with `SyntaxError: The requested module does not provide an export named 'Ping'`, followed by a second crash (`ERR_MODULE_NOT_FOUND`) once that export was added back but the file it pointed to still didn't exist. Both were fixed by recreating `ping.model.js` and re-adding its export here — a good illustration of why a barrel file needs to stay in sync with what's actually in the folder it's re-exporting.

/**
 * Barrel for general-purpose utilities: async route wrapping, fetch-or-404,
 * password hashing/verification, input normalization, JWT access tokens,
 * refresh-token generation/verification, auth cookies, request metadata
 * (IP/user-agent/device), transaction retry handling, plain pagination,
 * and graceful process shutdown. See docs/utils.md for a full explanation
 * of every function in this folder, with real usage examples.
 */
export { asyncHandler } from "./asyncHandler.js";

export { fetchOrNotFound } from "./fetchOrNotFound.js";

export {
    hashPassword,
    verifyPassword
} from "./password.argon2.js";

export {
    normalizeString,
    normalizeEmail,
    normalizeCountry,
    normalizeText
} from "./normalizer.js";

export {
    normalizePhoneNumber
} from "./phone.js";

export {
    generateAccessToken,
    verifyAccessToken
} from "./jwt.js";

export {
    gracefulShutdown
} from "./gracefulShutdown.js";

export { withTransaction, isTransientTransactionError } from "./withTransaction.js";

export { generateRefreshToken, verifyRefreshToken, hashToken} from "./refreshTokenUtils.js"

export {
    setAuthCookies,
    clearAuthCookies,
    ACCESS_TOKEN_COOKIE,
    REFRESH_TOKEN_COOKIE
} from "./authCookies.js"

export {
    getClientIP,
    getUserAgent,
    getDeviceName,
    getDeviceId,
} from "./request.js"

export {
    paginateQuery,
} from "./paginateQuery.js"

export {
    generateSlug,
    SLUG_SUFFIX_LENGTH,
} from "./generateSlug.js"

export {
    buildSearchFilter,
} from "./buildSearchFilter.js"

export {
    throwErrorOnEmptyInput
} from "./throwErrorOnEmptyInput.js";
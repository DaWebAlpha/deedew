import crypto from "node:crypto";

const DEVICE_ID_CACHE = new WeakMap();

/**
 * Reads a single header value, unwrapping it if Node gives it back as an
 * array (happens when a header was sent more than once on the same request).
 * @param {import("express").Request} request
 * @param {string} name - Lowercase header name.
 * @returns {string|undefined}
 */
const getHeader = (request, name) => {
    const value = request.headers?.[name];
    return Array.isArray(value)
        ? value[0]
        : value;
};

/**
 * Coerces a possibly-missing value into a trimmed string, never
 * null/undefined — so callers always get back a real (maybe empty) string.
 * @param {*} value
 * @returns {string}
 */
const normalize = (value) => String(value ?? "").trim();

/**
 * Best-effort resolution of the client's IP address: Express's own
 * `request.ip` first, then the common reverse-proxy headers, then the raw
 * socket address, finally falling back to the literal string "unknown"
 * rather than returning nothing. Used to record where a login/session/
 * audit event came from (e.g. LoginLog.ipAddress).
 * @param {import("express").Request} request
 * @returns {string} The resolved IP, or "unknown" if nothing was found.
 */
const getClientIP = (request) => {
    const raw =
        request.ip ||
        getHeader(request, "x-forwarded-for")?.split(",")[0] ||
        getHeader(request, "x-real-ip") ||
        request.socket?.remoteAddress ||
        "unknown";
    return normalize(raw);
};

/**
 * Reads the User-Agent header — e.g. for tagging a RefreshToken/LoginLog
 * with what browser or app the request came from.
 * @param {import("express").Request} request
 * @returns {string|null} The trimmed User-Agent string, or null if absent.
 */
const getUserAgent = (request) => {
    return normalize(getHeader(request, "user-agent")) || null;
};

/**
 * Reads a client-supplied device name (from the request body or a custom
 * header), letting a user recognize their own sessions later — e.g.
 * "Kwame's iPhone" in a "your active sessions" list.
 * @param {import("express").Request} request
 * @returns {string|null}
 */
const getDeviceName = (request) => {
    const raw =
        request.body?.device_name ||
        getHeader(request, "x-device-name") ||
        getHeader(request, "device-name");
    return normalize(raw) || null;
};

/**
 * Reads a client-supplied device id, or generates a fresh random one if
 * none was sent. The result is cached on the request object (via WeakMap,
 * keyed by the request itself) so calling this twice within the same
 * request returns the same id instead of generating a new random one
 * each time.
 * @param {import("express").Request} request
 * @returns {string} A client-supplied device id, or a freshly generated UUID.
 */
const getDeviceId = (request) => {
    if (DEVICE_ID_CACHE.has(request)) {
        return DEVICE_ID_CACHE.get(request);
    }

    const raw =
        request.body?.device_id ||
        getHeader(request, "x-device-id") ||
        getHeader(request, "device-id");
    const deviceId = normalize(raw) || crypto.randomUUID();

    DEVICE_ID_CACHE.set(request, deviceId);
    return deviceId;
};

export {
    getClientIP,
    getUserAgent,
    getDeviceName,
    getDeviceId,
};

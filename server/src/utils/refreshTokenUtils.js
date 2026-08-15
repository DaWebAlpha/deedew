import crypto from "node:crypto";

import { RefreshToken } from "../models/auth/refreshToken.model.js";
import { config } from "../config/index.js";

/**
 * SHA-256 hashes a raw refresh token for storage/lookup. Only the hash is
 * ever persisted in MongoDB — the raw token exists only in the client's
 * cookie, so a database leak alone can't be replayed to log in as anyone.
 * @param {string} rawToken
 * @returns {string} Hex-encoded SHA-256 hash.
 */
const hashToken = (rawToken) => {
    return crypto.createHash("sha256").update(rawToken).digest("hex");
};

/**
 * Creates and persists a new refresh token for a user, returning the raw
 * (unhashed) token — this return value is the only time the raw token
 * ever exists outside the client's cookie; only its hash is stored.
 * @param {object} options
 * @param {string|import("mongoose").Types.ObjectId} options.userId - The token's owner.
 * @param {string|null} [options.userAgent=null]
 * @param {string|null} [options.ipAddress=null]
 * @param {string|null} [options.deviceName=null]
 * @param {string|null} [options.deviceId=null]
 * @param {import("mongoose").ClientSession|null} [options.session=null] - Transaction session, if any.
 * @returns {Promise<string>} The raw refresh token.
 */
const generateRefreshToken = async ({
    userId,
    userAgent = null,
    ipAddress = null,
    deviceName = null,
    deviceId = null,
    session = null,
} = {}) => {
    const rawToken = crypto.randomBytes(64).toString("hex");
    const tokenHash = hashToken(rawToken);

    const expiresAt = new Date(
        Date.now() + config.jwtRefreshExpiryDays * 24 * 60 * 60 * 1000,
    );

    await RefreshToken.create(
        [{ userId, tokenHash, expiresAt, userAgent, ipAddress, deviceName, deviceId }],
        session ? { session } : null,
    );

    return rawToken;
};

/**
 * Looks up a refresh token by its hash and confirms it's still active
 * (not revoked, not expired). Returns null instead of throwing when the
 * token is missing/inactive — the caller decides what that means
 * (e.g. refreshTokenService turns a null here into "session expired").
 * @param {string} rawToken - The raw token from the client's cookie.
 * @param {object} [options]
 * @param {import("mongoose").ClientSession|null} [options.session=null]
 * @returns {Promise<import("mongoose").Document|null>} The RefreshToken document, or null.
 */
const verifyRefreshToken = async (rawToken, { session = null } = {}) => {
    const tokenHash = hashToken(rawToken);

    const query = RefreshToken.findOne({ tokenHash });

    if (session) {
        query.session(session);
    }

    const record = await query;

    if (!record || !record.isActive()) {
        return null;
    }

    return record;
};

export { generateRefreshToken, verifyRefreshToken, hashToken };

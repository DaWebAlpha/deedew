import {
    auditLogger,
} from "../../logger/pino.logger.js";

import {
    UnauthenticatedError,
} from "../../errors/index.js";

import {
    hashToken,
} from "../../utils/index.js";

import { RefreshToken } from "../../models/index.js";

/**
 * Revokes the refresh token for one device/session.
 * @param {object} params
 * @param {string} params.userId
 * @param {string} [params.refreshToken] - The raw refresh token to revoke, if present.
 * @param {string} [params.ipAddress]
 * @param {string} [params.userAgent]
 * @param {string} [params.deviceName]
 * @param {string} [params.deviceId]
 * @returns {Promise<{message: string}>}
 * @throws {UnauthenticatedError} If userId is missing.
 */
const logoutService = async ({
    userId,
    refreshToken,
    ipAddress = null,
    userAgent = null,
    deviceName = null,
    deviceId = null,
} = {}) => {
    if (!userId) {
        throw new UnauthenticatedError({
            message: "Authentication required",
            code: "AUTH_REQUIRED",
        });
    }

    if (refreshToken) {
        const tokenHash = hashToken(refreshToken);

        const record = await RefreshToken.findOne({ tokenHash, userId });

        if (record && record.isActive()) {
            await record.revoke();
        }
    }

    auditLogger.info(
        { userId, ipAddress, userAgent, deviceName, deviceId },
        "User successfully logged out",
    );

    return {
        message: "User logged out successfully",
    };
};

export { logoutService };

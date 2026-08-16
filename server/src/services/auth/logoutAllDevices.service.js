import {
    auditLogger,
} from "../../logger/pino.logger.js";

import {
    UnauthenticatedError,
} from "../../errors/index.js";

import { RefreshToken } from "../../models/index.js";

/**
 * Revokes every active refresh token belonging to the current user.
 * @param {object} params
 * @param {string} params.userId
 * @param {string} [params.ipAddress]
 * @param {string} [params.userAgent]
 * @returns {Promise<{message: string, revokedCount: number}>}
 * @throws {UnauthenticatedError} If userId is missing.
 */
const logoutAllDevicesService = async ({
    userId,
    ipAddress = null,
    userAgent = null,
} = {}) => {
    if (!userId) {
        throw new UnauthenticatedError({
            message: "Authentication required",
            code: "AUTH_REQUIRED",
        });
    }

    const result = await RefreshToken.updateMany(
        { userId, revokedAt: null },
        { $set: { revokedAt: new Date() } },
    );

    auditLogger.info(
        { userId, ipAddress, userAgent, revokedCount: result.modifiedCount },
        "User logged out of all devices",
    );

    return {
        message: "Logged out of all devices successfully",
        revokedCount: result.modifiedCount,
    };
};

export { logoutAllDevicesService };

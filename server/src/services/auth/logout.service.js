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

/** Revokes the refresh token for one device/session. */
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

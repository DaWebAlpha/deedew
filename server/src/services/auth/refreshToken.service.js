import { User } from "../../models/index.js";

import {
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken,
    withTransaction,
} from "../../utils/index.js";

import { UnauthenticatedError } from "../../errors/index.js";

import { auditLogger } from "../../logger/pino.logger.js";

const sessionExpired = () => new UnauthenticatedError({
    message: "Session expired. Please log in again.",
    code: "REFRESH_TOKEN_INVALID",
});

/** Rotates a refresh token: verifies it, revokes it, and issues a new access/refresh pair. */
const refreshTokenService = async ({
    refreshToken,
    userAgent = null,
    ipAddress = null,
    deviceName = null,
    deviceId = null,
} = {}) => {
    if (!refreshToken) {
        throw new UnauthenticatedError({
            message: "Authentication required",
            code: "AUTH_REQUIRED",
        });
    }

    return withTransaction(async (session) => {
        const record = await verifyRefreshToken(refreshToken);

        if (!record) {
            throw sessionExpired();
        }

        const user = await User.findById(record.userId);

        if (!user || user.isDeleted) {
            await record.revoke();
            throw sessionExpired();
        }

        await record.revoke({ session });

        const newRefreshToken = await generateRefreshToken({
            userId: user._id,
            userAgent,
            ipAddress,
            deviceName,
            deviceId,
            session,
        });

        const accessToken = await generateAccessToken(user._id.toString());

        auditLogger.info(
            { userId: user._id },
            "Access token refreshed",
        );

        return { user, accessToken, refreshToken: newRefreshToken };
    });
};

export { refreshTokenService };

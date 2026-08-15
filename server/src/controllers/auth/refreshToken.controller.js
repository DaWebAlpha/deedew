import { refreshTokenService } from "../../services/index.js";
import { asyncHandler } from "../../utils/index.js";
import { HTTP_STATUS } from "../../constants/index.js";
import {
    setAuthCookies,
    getClientIP,
    getUserAgent,
    getDeviceName,
    getDeviceId,
} from "../../utils/index.js";
import { config } from "../../config/index.js";

/** Exchanges a valid refresh-token cookie for a new access/refresh token pair. */
const refreshTokenController = asyncHandler(async (request, response) => {
    const refreshToken = request.cookies?.[config.refreshTokenCookie];

    const result = await refreshTokenService({
        refreshToken,
        userAgent: getUserAgent(request),
        ipAddress: getClientIP(request),
        deviceName: getDeviceName(request),
        deviceId: getDeviceId(request),
    });

    setAuthCookies(response, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
    });

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        message: "Session refreshed",
        user: result.user,
    });
});

export { refreshTokenController };

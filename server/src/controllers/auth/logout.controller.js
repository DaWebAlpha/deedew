import { logoutService } from "../../services/index.js";
import { asyncHandler } from "../../utils/index.js";
import { HTTP_STATUS } from "../../constants/index.js";
import {
    clearAuthCookies,
    getClientIP,
    getUserAgent,
    getDeviceName,
    getDeviceId,
} from "../../utils/index.js";
import { config } from "../../config/index.js";

/** Revokes the current device's refresh token and clears auth cookies. */
const logoutController = asyncHandler(async (request, response) => {
    const refreshToken = request.cookies?.[config.refreshTokenCookie];

    const result = await logoutService({
        userId: request.user.userId,
        refreshToken,
        ipAddress: getClientIP(request),
        userAgent: getUserAgent(request),
        deviceName: getDeviceName(request),
        deviceId: getDeviceId(request),
    });

    clearAuthCookies(response);

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        message: result.message,
    });
});

export { logoutController };

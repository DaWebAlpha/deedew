import { logoutAllDevicesService } from "../../services/index.js";
import { asyncHandler } from "../../utils/index.js";
import { HTTP_STATUS } from "../../constants/index.js";
import {
    clearAuthCookies,
    getClientIP,
    getUserAgent,
} from "../../utils/index.js";

/** Revokes every refresh token for the current user and clears auth cookies. */
const logoutAllDevicesController = asyncHandler(async (request, response) => {
    const result = await logoutAllDevicesService({
        userId: request.user.userId,
        ipAddress: getClientIP(request),
        userAgent: getUserAgent(request),
    });

    clearAuthCookies(response);

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        message: result.message,
        revokedCount: result.revokedCount,
    });
});

export { logoutAllDevicesController };

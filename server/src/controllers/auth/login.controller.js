import { loginUserService } from "../../services/index.js";
import {
    setAuthCookies,
    asyncHandler,
    getClientIP,
    getUserAgent,
    getDeviceName,
    getDeviceId,
} from "../../utils/index.js";
import { HTTP_STATUS } from "../../constants/index.js";


/** Logs a user in and sets access/refresh token cookies on success. */
const loginUserController = asyncHandler(async(request, response) => {
    const { user,
            security,
            accessToken,
            refreshToken } = await loginUserService({
                ...request.body,
                userAgent: getUserAgent(request),
                ipAddress: getClientIP(request), 
                deviceName: getDeviceName(request),
                deviceId: getDeviceId(request)
            });

    setAuthCookies(response, {
        accessToken: accessToken,
        refreshToken: refreshToken,
    });

    return response.status(HTTP_STATUS.OK).json({
        title: "Login",
        success: true,
        message: "Login successful",
        user,
    })
})

export {
    loginUserController,
}
import { registerUserService } from "../../services/index.js";
import {
    setAuthCookies,
    asyncHandler,
    getClientIP,
    getUserAgent,
    getDeviceName,
    getDeviceId,
} from "../../utils/index.js";
import { HTTP_STATUS } from "../../constants/index.js";


/** Registers a new user and sets access/refresh token cookies on success. */
const registerUserController = asyncHandler(async(request, response) => {
    const { user,
            security,
            accessToken,
            refreshToken } = await registerUserService({
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

    return response.status(HTTP_STATUS.CREATED).json({
        title: "Register",
        success: true,
        message: "User registered successfully",
        user,
    })
})

export {
    registerUserController,
}
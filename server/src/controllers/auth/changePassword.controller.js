import { changePasswordService } from "../../services/index.js";
import { asyncHandler, clearAuthCookies } from "../../utils/index.js";
import { HTTP_STATUS } from "../../constants/index.js";

/** Changes the current user's password and clears their auth cookies (forces re-login). */
const changePasswordController = asyncHandler(async (request, response) => {
    const result = await changePasswordService({
        userId: request.user.userId,
        currentPassword: request.body.currentPassword,
        newPassword: request.body.newPassword,
    });

    clearAuthCookies(response);

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        message: result.message,
    });
});

export { changePasswordController };

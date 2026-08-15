import { clearUserLockoutService } from "../../../services/index.js";
import { asyncHandler } from "../../../utils/index.js";
import { HTTP_STATUS } from "../../../constants/index.js";

/** Admin: clears a user's failed-login lockout. */
const clearUserLockoutController = asyncHandler(async (request, response) => {
    const result = await clearUserLockoutService({
        userId: request.params.userId,
        clearedByUserId: request.user.userId,
    });

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        message: result.message,
    });
});

export { clearUserLockoutController };

import { banUserService } from "../../../services/index.js";
import { asyncHandler } from "../../../utils/index.js";
import { HTTP_STATUS } from "../../../constants/index.js";

/** Admin: bans a user, blocking future logins. */
const banUserController = asyncHandler(async (request, response) => {
    const result = await banUserService({
        userId: request.params.userId,
        bannedByUserId: request.user.userId,
        reason: request.body.reason,
    });

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        message: result.message,
    });
});

export { banUserController };

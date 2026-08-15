import { unbanUserService } from "../../../services/index.js";
import { asyncHandler } from "../../../utils/index.js";
import { HTTP_STATUS } from "../../../constants/index.js";

/** Admin: lifts a ban on a user. */
const unbanUserController = asyncHandler(async (request, response) => {
    const result = await unbanUserService({
        userId: request.params.userId,
        unbannedByUserId: request.user.userId,
        reason: request.body.reason,
    });

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        message: result.message,
    });
});

export { unbanUserController };

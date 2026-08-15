import { unsuspendUserService } from "../../../services/index.js";
import { asyncHandler } from "../../../utils/index.js";
import { HTTP_STATUS } from "../../../constants/index.js";

/** Admin: lifts a suspension on a user. */
const unsuspendUserController = asyncHandler(async (request, response) => {
    const result = await unsuspendUserService({
        userId: request.params.userId,
        unsuspendedByUserId: request.user.userId,
        reason: request.body.reason,
    });

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        message: result.message,
    });
});

export { unsuspendUserController };

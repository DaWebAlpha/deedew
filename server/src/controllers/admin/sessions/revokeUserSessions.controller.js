import { revokeUserSessionsService } from "../../../services/index.js";
import { asyncHandler } from "../../../utils/index.js";
import { HTTP_STATUS } from "../../../constants/index.js";

/** Admin: revokes every active session for one user. */
const revokeUserSessionsController = asyncHandler(async (request, response) => {
    const result = await revokeUserSessionsService({
        userId: request.params.userId,
        revokedByUserId: request.user.userId,
    });

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        message: result.message,
        revokedCount: result.revokedCount,
    });
});

export { revokeUserSessionsController };

import { adminRevokeSessionService } from "../../../services/index.js";
import { asyncHandler } from "../../../utils/index.js";
import { HTTP_STATUS } from "../../../constants/index.js";

/** Admin: revokes a single session by id. */
const adminRevokeSessionController = asyncHandler(async (request, response) => {
    const result = await adminRevokeSessionService({
        sessionId: request.params.sessionId,
        revokedByUserId: request.user.userId,
    });

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        message: result.message,
    });
});

export { adminRevokeSessionController };

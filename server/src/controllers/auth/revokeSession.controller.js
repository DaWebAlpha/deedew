import { revokeSessionService } from "../../services/index.js";
import { asyncHandler } from "../../utils/index.js";
import { HTTP_STATUS } from "../../constants/index.js";

/** Lets the current user revoke one of their own sessions by id. */
const revokeSessionController = asyncHandler(async (request, response) => {
    const result = await revokeSessionService({
        userId: request.user.userId,
        sessionId: request.params.sessionId,
    });

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        message: result.message,
    });
});

export { revokeSessionController };

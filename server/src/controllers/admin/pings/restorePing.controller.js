import { restorePingService } from "../../../services/index.js";
import { asyncHandler } from "../../../utils/index.js";
import { HTTP_STATUS } from "../../../constants/index.js";

/** Admin: restores a soft-deleted ping. */
const restorePingController = asyncHandler(async (request, response) => {
    const result = await restorePingService({
        pingId: request.params.pingId,
        restoreUserId: request.user.userId,
        reason: request.body.reason,
    });

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        message: result.message,
    });
});

export { restorePingController };

import { deletePingService } from "../../../services/index.js";
import { asyncHandler } from "../../../utils/index.js";
import { HTTP_STATUS } from "../../../constants/index.js";

/** Admin: soft-deletes a ping by id. */
const deletePingController = asyncHandler(async (request, response) => {
    const result = await deletePingService({
        pingId: request.params.pingId,
        deletedByUserId: request.user.userId,
        reason: request.body.reason,
    });

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        message: result.message,
    });
});

export { deletePingController };

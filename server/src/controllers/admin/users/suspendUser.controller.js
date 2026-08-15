import { suspendUserService } from "../../../services/index.js";
import { asyncHandler } from "../../../utils/index.js";
import { HTTP_STATUS } from "../../../constants/index.js";

/** Admin: temporarily suspends a user until a given date. */
const suspendUserController = asyncHandler(async (request, response) => {
    const result = await suspendUserService({
        userId: request.params.userId,
        suspendedByUserId: request.user.userId,
        reason: request.body.reason,
        suspendedUntil: request.body.suspendedUntil,
    });

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        message: result.message,
        suspendedUntil: result.suspendedUntil,
    });
});

export { suspendUserController };

import { deleteUserService } from "../../../services/index.js";
import { asyncHandler } from "../../../utils/index.js";
import { HTTP_STATUS } from "../../../constants/index.js";

/** Admin: soft-deletes a user account. */
const deleteUserController = asyncHandler(async (request, response) => {
    const result = await deleteUserService({
        userId: request.params.userId,
        deletedByUserId: request.user.userId,
        reason: request.body.reason,
    });

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        message: result.message,
    });
});

export { deleteUserController };

import { deleteSellerProfileService } from "../../services/index.js";
import { asyncHandler } from "../../utils/index.js";
import { HTTP_STATUS } from "../../constants/index.js";

/** Admin: soft-deletes a seller profile. */
const deleteSellerProfileController = asyncHandler(async (request, response) => {
    const result = await deleteSellerProfileService({
        sellerId: request.params.sellerId,
        deletedByUserId: request.user.userId,
        reason: request.body.reason,
    });

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        message: result.message,
    });
});

export { deleteSellerProfileController };

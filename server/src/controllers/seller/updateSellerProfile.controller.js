import { updateSellerProfileService } from "../../services/index.js";
import { asyncHandler } from "../../utils/index.js";
import { HTTP_STATUS } from "../../constants/index.js";

/** Admin: updates a seller's editable fields. */
const updateSellerProfileController = asyncHandler(async (request, response) => {
    const result = await updateSellerProfileService({
        sellerId: request.params.sellerId,
        updatedByUserId: request.user.userId,
        ...request.body,
    });

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        message: result.message,
        seller: result.seller,
    });
});

export { updateSellerProfileController };

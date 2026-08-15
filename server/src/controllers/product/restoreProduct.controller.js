import { restoreProductService } from "../../services/index.js";
import { asyncHandler } from "../../utils/index.js";
import { HTTP_STATUS } from "../../constants/index.js";

/** Admin: restores a soft-deleted product. */
const restoreProductController = asyncHandler(async (request, response) => {
    const result = await restoreProductService({
        productId: request.params.productId,
        restoreUserId: request.user.userId,
        reason: request.body.reason,
    });

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        message: result.message,
    });
});

export { restoreProductController };

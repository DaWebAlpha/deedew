import { deleteProductService } from "../../services/index.js";
import { asyncHandler } from "../../utils/index.js";
import { HTTP_STATUS } from "../../constants/index.js";

/** Admin: soft-deletes a product. */
const deleteProductController = asyncHandler(async (request, response) => {
    const result = await deleteProductService({
        productId: request.params.productId,
        deletedByUserId: request.user.userId,
        reason: request.body.reason,
    });

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        message: result.message,
    });
});

export { deleteProductController };

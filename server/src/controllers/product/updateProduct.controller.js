import { updateProductService } from "../../services/index.js";
import { asyncHandler } from "../../utils/index.js";
import { HTTP_STATUS } from "../../constants/index.js";

/** Admin: updates a product's editable fields. */
const updateProductController = asyncHandler(async (request, response) => {
    const result = await updateProductService({
        productId: request.params.productId,
        updatedByUserId: request.user.userId,
        ...request.body,
    });

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        message: result.message,
        product: result.product,
    });
});

export { updateProductController };

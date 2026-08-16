import { createMyProductService } from "../../services/index.js";
import { asyncHandler } from "../../utils/index.js";
import { HTTP_STATUS } from "../../constants/index.js";

/** Self-service: the authenticated seller creates a product under their own profile. */
const createMyProductController = asyncHandler(async (request, response) => {
    const result = await createMyProductService({
        ...request.body,
        userId: request.user.userId,
    });

    return response.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: result.message,
        product: result.product,
    });
});

export { createMyProductController };

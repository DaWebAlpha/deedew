import { createProductService } from "../../services/index.js";
import { asyncHandler } from "../../utils/index.js";
import { HTTP_STATUS } from "../../constants/index.js";

/** Admin: creates a new product. */
const createProductController = asyncHandler(async (request, response) => {
    const result = await createProductService({
        ...request.body,
    });

    return response.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: result.message,
        product: result.product,
    });
});

export { createProductController };

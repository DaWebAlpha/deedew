import { createCategoryService } from "../../services/index.js";
import { asyncHandler } from "../../utils/index.js";
import { HTTP_STATUS } from "../../constants/index.js";

/** Admin: creates a new category. */
const createCategoryController = asyncHandler(async (request, response) => {
    const result = await createCategoryService({
        ...request.body,
    });

    return response.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: result.message,
        category: result.category,
    });
});

export { createCategoryController };

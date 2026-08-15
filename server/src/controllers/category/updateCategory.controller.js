import { updateCategoryService } from "../../services/index.js";
import { asyncHandler } from "../../utils/index.js";
import { HTTP_STATUS } from "../../constants/index.js";

/** Admin: updates a category's editable fields. */
const updateCategoryController = asyncHandler(async (request, response) => {
    const result = await updateCategoryService({
        categoryId: request.params.categoryId,
        updatedByUserId: request.user.userId,
        ...request.body,
    });

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        message: result.message,
        category: result.category,
    });
});

export { updateCategoryController };

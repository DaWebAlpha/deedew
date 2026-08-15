import { deleteCategoryService } from "../../services/index.js";
import { asyncHandler } from "../../utils/index.js";
import { HTTP_STATUS } from "../../constants/index.js";

/** Admin: soft-deletes a category. */
const deleteCategoryController = asyncHandler(async (request, response) => {
    const result = await deleteCategoryService({
        categoryId: request.params.categoryId,
        deletedByUserId: request.user.userId,
        reason: request.body.reason,
    });

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        message: result.message,
    });
});

export { deleteCategoryController };

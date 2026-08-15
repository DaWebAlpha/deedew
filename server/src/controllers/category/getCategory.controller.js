import { getCategoryService } from "../../services/index.js";
import { asyncHandler } from "../../utils/index.js";
import { HTTP_STATUS } from "../../constants/index.js";

/** Public: fetches a single category by id. */
const getCategoryController = asyncHandler(async (request, response) => {
    const { category } = await getCategoryService({ categoryId: request.params.categoryId });

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        category,
    });
});

export { getCategoryController };

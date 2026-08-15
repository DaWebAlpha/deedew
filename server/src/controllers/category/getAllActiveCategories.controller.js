import { getAllActiveCategoriesService } from "../../services/index.js";
import { asyncHandler } from "../../utils/index.js";
import { HTTP_STATUS } from "../../constants/index.js";

/** Public: lists non-deleted categories, searchable, paginated. */
const getAllActiveCategoriesController = asyncHandler(async (request, response) => {
    const { result, message } = await getAllActiveCategoriesService({
        search: request.query.search,
        page: request.query.page,
        limit: request.query.limit,
    });

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        message,
        ...result,
    });
});

export { getAllActiveCategoriesController };

import { getAllActiveProductsService } from "../../services/index.js";
import { asyncHandler } from "../../utils/index.js";
import { HTTP_STATUS } from "../../constants/index.js";

/** Public: lists non-deleted products, filterable by category, searchable, paginated. */
const getAllActiveProductsController = asyncHandler(async (request, response) => {
    const { result, message } = await getAllActiveProductsService({
        categoryId: request.query.categoryId,
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

export { getAllActiveProductsController };

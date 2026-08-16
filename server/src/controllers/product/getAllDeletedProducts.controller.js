import { getAllDeletedProductsService } from "../../services/index.js";
import { asyncHandler } from "../../utils/index.js";
import { HTTP_STATUS } from "../../constants/index.js";

/** Admin: lists soft-deleted products, filterable by category, searchable, paginated. */
const getAllDeletedProductsController = asyncHandler(async (request, response) => {
    const { result, message } = await getAllDeletedProductsService({
        categoryId: request.query.categoryId,
        sellerId: request.query.sellerId,
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

export { getAllDeletedProductsController };

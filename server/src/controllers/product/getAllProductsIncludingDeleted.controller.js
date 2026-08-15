import { getAllProductsIncludingDeletedService } from "../../services/index.js";
import { asyncHandler } from "../../utils/index.js";
import { HTTP_STATUS } from "../../constants/index.js";

/** Admin: lists all products, active and deleted, filterable, paginated. */
const getAllProductsIncludingDeletedController = asyncHandler(async (request, response) => {
    const { result, message } = await getAllProductsIncludingDeletedService({
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

export { getAllProductsIncludingDeletedController };

import { getAllCategoriesIncludingDeletedService } from "../../services/index.js";
import { asyncHandler } from "../../utils/index.js";
import { HTTP_STATUS } from "../../constants/index.js";

/** Admin: lists all categories, active and deleted, searchable, paginated. */
const getAllCategoriesIncludingDeletedController = asyncHandler(async (request, response) => {
    const { result, message } = await getAllCategoriesIncludingDeletedService({
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

export { getAllCategoriesIncludingDeletedController };

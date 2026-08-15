import { getAllDeletedUsersService } from "../../../services/index.js";
import { asyncHandler } from "../../../utils/index.js";
import { HTTP_STATUS } from "../../../constants/index.js";

/** Admin: lists soft-deleted users, filterable by role/search, paginated. */
const getAllDeletedUsersController = asyncHandler(async (request, response) => {
    const { result, message } = await getAllDeletedUsersService({
        role: request.query.role,
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

export { getAllDeletedUsersController };

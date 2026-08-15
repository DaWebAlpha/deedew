import { getAllActiveSessionsService } from "../../../services/index.js";
import { asyncHandler } from "../../../utils/index.js";
import { HTTP_STATUS } from "../../../constants/index.js";

/** Admin: lists all active sessions across users, paginated. */
const getAllActiveSessionsController = asyncHandler(async (request, response) => {
    const { result, message } = await getAllActiveSessionsService({
        page: request.query.page,
        limit: request.query.limit,
    });

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        message,
        ...result,
    });
});

export { getAllActiveSessionsController };

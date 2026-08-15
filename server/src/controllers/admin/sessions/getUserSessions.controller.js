import { getUserSessionsService } from "../../../services/index.js";
import { asyncHandler } from "../../../utils/index.js";
import { HTTP_STATUS } from "../../../constants/index.js";

/** Admin: lists a single user's active sessions, paginated. */
const getUserSessionsController = asyncHandler(async (request, response) => {
    const { result, message } = await getUserSessionsService({
        userId: request.params.userId,
        page: request.query.page,
        limit: request.query.limit,
    });

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        message,
        ...result,
    });
});

export { getUserSessionsController };

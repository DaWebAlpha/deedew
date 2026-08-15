import { getUserLoginLogsService } from "../../../services/index.js";
import { asyncHandler } from "../../../utils/index.js";
import { HTTP_STATUS } from "../../../constants/index.js";

/** Admin: lists login logs for one user, paginated. */
const getUserLoginLogsController = asyncHandler(async (request, response) => {
    const { result, message } = await getUserLoginLogsService({
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

export { getUserLoginLogsController };

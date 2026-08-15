import { getUsersLoginLogsService } from "../../../services/index.js";
import { asyncHandler } from "../../../utils/index.js";
import { HTTP_STATUS } from "../../../constants/index.js";

/** Admin: lists login logs across all users, paginated. */
const getUsersLoginLogsController = asyncHandler(async (request, response) => {
    const { result, message } = await getUsersLoginLogsService({
        page: request.query.page,
        limit: request.query.limit,
    });

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        message,
        ...result,
    });
});

export { getUsersLoginLogsController };

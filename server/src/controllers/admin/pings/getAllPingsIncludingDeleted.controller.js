import { getAllPingsIncludingDeletedService } from "../../../services/index.js";
import { asyncHandler } from "../../../utils/index.js";
import { HTTP_STATUS } from "../../../constants/index.js";

/** Admin: lists all pings, active and deleted, paginated. */
const getAllPingsIncludingDeletedController = asyncHandler(async (request, response) => {
    const { result, message } = await getAllPingsIncludingDeletedService({
        page: request.query.page,
        limit: request.query.limit,
    });

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        message,
        ...result,
    });
});

export { getAllPingsIncludingDeletedController };

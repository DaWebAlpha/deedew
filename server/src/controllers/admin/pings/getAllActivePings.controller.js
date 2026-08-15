import { getAllActivePingsService } from "../../../services/index.js";
import { asyncHandler } from "../../../utils/index.js";
import { HTTP_STATUS } from "../../../constants/index.js";

/** Admin: lists non-deleted pings, paginated. */
const getAllActivePingsController = asyncHandler(async (request, response) => {
    const { result, message } = await getAllActivePingsService({
        page: request.query.page,
        limit: request.query.limit,
    });

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        message,
        ...result,
    });
});

export { getAllActivePingsController };

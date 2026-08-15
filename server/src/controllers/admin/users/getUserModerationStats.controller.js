import { getUserModerationStatsService } from "../../../services/index.js";
import { asyncHandler } from "../../../utils/index.js";
import { HTTP_STATUS } from "../../../constants/index.js";

/** Admin: returns aggregate counts of banned/suspended/locked users. */
const getUserModerationStatsController = asyncHandler(async (request, response) => {
    const stats = await getUserModerationStatsService();

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        ...stats,
    });
});

export { getUserModerationStatsController };

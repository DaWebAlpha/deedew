import { listSessionsService } from "../../services/index.js";
import { asyncHandler } from "../../utils/index.js";
import { HTTP_STATUS } from "../../constants/index.js";

/** Lists the current user's own active sessions. */
const listSessionsController = asyncHandler(async (request, response) => {
    const { sessions } = await listSessionsService({ userId: request.user.userId });

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        sessions,
    });
});

export { listSessionsController };

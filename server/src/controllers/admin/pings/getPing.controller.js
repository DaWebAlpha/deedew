import { getPingService } from "../../../services/index.js";
import { asyncHandler } from "../../../utils/index.js";
import { HTTP_STATUS } from "../../../constants/index.js";

/** Admin: fetches a single ping by id. */
const getPingController = asyncHandler(async (request, response) => {
    const { ping } = await getPingService({ pingId: request.params.pingId });

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        ping,
    });
});

export { getPingController };

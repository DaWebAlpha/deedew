import { getUserService } from "../../../services/index.js";
import { asyncHandler } from "../../../utils/index.js";
import { HTTP_STATUS } from "../../../constants/index.js";

/** Admin: fetches a single user by id. */
const getUserController = asyncHandler(async (request, response) => {
    const { user } = await getUserService({ userId: request.params.userId });

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        user,
    });
});

export { getUserController };

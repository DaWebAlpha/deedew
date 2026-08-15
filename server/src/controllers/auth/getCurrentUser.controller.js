import { getCurrentUserService } from "../../services/index.js";
import { asyncHandler } from "../../utils/index.js";
import { HTTP_STATUS } from "../../constants/index.js";

/** Returns the profile of the currently authenticated user. */
const getCurrentUserController = asyncHandler(async (request, response) => {
    const { user } = await getCurrentUserService({ userId: request.user.userId });

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        user,
    });
});

export { getCurrentUserController };

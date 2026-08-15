import { getUserSecurityService } from "../../../services/index.js";
import { asyncHandler } from "../../../utils/index.js";
import { HTTP_STATUS } from "../../../constants/index.js";

/** Admin: fetches a user's UserSecurity record. */
const getUserSecurityController = asyncHandler(async (request, response) => {
    const { security } = await getUserSecurityService({
        userId: request.params.userId,
    });

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        security,
    });
});

export { getUserSecurityController };

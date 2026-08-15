import { updateUserRoleService } from "../../../services/index.js";
import { asyncHandler } from "../../../utils/index.js";
import { HTTP_STATUS } from "../../../constants/index.js";

/** Admin: changes a user's role (customer/admin/superadmin). */
const updateUserRoleController = asyncHandler(async (request, response) => {
    const result = await updateUserRoleService({
        userId: request.params.userId,
        role: request.body.role,
        updatedByUserId: request.user.userId,
    });

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        message: result.message,
        user: result.user,
    });
});

export { updateUserRoleController };

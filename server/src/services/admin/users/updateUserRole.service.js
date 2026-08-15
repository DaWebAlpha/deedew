import { User } from "../../../models/index.js";
import { fetchOrNotFound } from "../../../utils/index.js";
import { BadRequestError, ForbiddenError } from "../../../errors/index.js";
import { auditLogger } from "../../../logger/pino.logger.js";

const ALLOWED_ROLES = ["customer", "admin", "superadmin"];

/** Changes a user's role; refuses to let an admin change their own role. */
const updateUserRoleService = async ({
    userId,
    role,
    updatedByUserId = null,
} = {}) => {
    if (!ALLOWED_ROLES.includes(role)) {
        throw new BadRequestError({
            message: `Role must be one of: ${ALLOWED_ROLES.join(", ")}`,
            code: "INVALID_ROLE",
        });
    }

    if (updatedByUserId && userId === updatedByUserId) {
        throw new ForbiddenError({
            message: "You cannot change your own role",
            code: "CANNOT_CHANGE_OWN_ROLE",
        });
    }

    const user = await fetchOrNotFound(User, userId, {
        idMessage: "UserId is required",
        idCode: "USER_ID_REQUIRED",
        notFoundMessage: "No user exists",
        notFoundCode: "NO_USER_EXISTS",
    });

    const previousRole = user.role;

    user.role = role;
    user.updatedBy = updatedByUserId;
    await user.save();

    auditLogger.info(
        { userId, previousRole, newRole: role, updatedBy: updatedByUserId },
        "User role changed",
    );

    return { message: "User role updated successfully", user };
};

export { updateUserRoleService };

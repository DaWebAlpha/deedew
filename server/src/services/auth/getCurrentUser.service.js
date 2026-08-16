import { User } from "../../models/index.js";
import { UnauthenticatedError } from "../../errors/index.js";

/**
 * Fetches the authenticated user's own profile, rejecting deleted accounts.
 * @param {object} params
 * @param {string} params.userId
 * @returns {Promise<{user: import("mongoose").Document}>}
 * @throws {UnauthenticatedError} If the account no longer exists or was deleted.
 */
const getCurrentUserService = async ({ userId } = {}) => {
    const user = await User.findById(userId);

    if (!user || user.isDeleted) {
        throw new UnauthenticatedError({
            message: "Account no longer exists",
            code: "USER_NOT_FOUND",
        });
    }

    return { user };
};

export { getCurrentUserService };

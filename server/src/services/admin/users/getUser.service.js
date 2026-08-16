import { User } from "../../../models/index.js";
import { fetchOrNotFound } from "../../../utils/index.js";

/**
 * Fetches a single user by id or throws NotFoundError.
 * @param {object} params
 * @param {string} params.userId
 * @returns {Promise<{user: import("mongoose").Document}>}
 * @throws {BadRequestError} If userId is missing.
 * @throws {NotFoundError} If no user matches.
 */
const getUserService = async ({ userId } = {}) => {
    const user = await fetchOrNotFound(User, userId, {
        idMessage: "UserId is required",
        idCode: "USER_ID_REQUIRED",
        notFoundMessage: "No user exists",
        notFoundCode: "NO_USER_EXISTS",
    });

    return { user };
};

export { getUserService };

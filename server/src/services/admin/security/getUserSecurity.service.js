import { User, UserSecurity } from "../../../models/index.js";
import { fetchOrNotFound } from "../../../utils/index.js";

/** Fetches (or lazily creates) a user's UserSecurity record. */
const getUserSecurityService = async ({ userId } = {}) => {
    await fetchOrNotFound(User, userId, {
        idMessage: "UserId is required",
        idCode: "USER_ID_REQUIRED",
        notFoundMessage: "No user exists",
        notFoundCode: "NO_USER_EXISTS",
    });

    const security = await UserSecurity.findOrCreateForUser(userId);

    return { security };
};

export { getUserSecurityService };

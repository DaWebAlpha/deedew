import { User, UserSecurity } from "../../../models/index.js";
import { fetchOrNotFound } from "../../../utils/index.js";
import { auditLogger } from "../../../logger/pino.logger.js";

/** Lifts a suspension on a user. */
const unsuspendUserService = async ({
    userId,
    unsuspendedByUserId = null,
    reason = null,
} = {}) => {
    await fetchOrNotFound(User, userId, {
        idMessage: "UserId is required",
        idCode: "USER_ID_REQUIRED",
        notFoundMessage: "No user exists to unsuspend",
        notFoundCode: "NO_USER_EXISTS_TO_UNSUSPEND",
    });

    const security = await UserSecurity.findOrCreateForUser(userId);

    await security.unsuspend({ unsuspendedByUserId, reason });

    auditLogger.info(
        { userId, unsuspendedBy: unsuspendedByUserId, reason },
        "User unsuspended",
    );

    return { message: "User unsuspended successfully" };
};

export { unsuspendUserService };

import { User, UserSecurity } from "../../../models/index.js";
import { fetchOrNotFound } from "../../../utils/index.js";
import { auditLogger } from "../../../logger/pino.logger.js";

/** Resets a user's failed-login count and lifts any active lockout. */
const clearUserLockoutService = async ({
    userId,
    clearedByUserId = null,
} = {}) => {
    await fetchOrNotFound(User, userId, {
        idMessage: "UserId is required",
        idCode: "USER_ID_REQUIRED",
        notFoundMessage: "No user exists",
        notFoundCode: "NO_USER_EXISTS",
    });

    const security = await UserSecurity.findOrCreateForUser(userId);

    security.failedLoginAttempts = 0;
    security.lockedUntil = null;
    await security.save({ validateBeforeSave: false });

    auditLogger.info(
        { userId, clearedBy: clearedByUserId },
        "User lockout cleared by admin",
    );

    return { message: "Lockout cleared successfully" };
};

export { clearUserLockoutService };

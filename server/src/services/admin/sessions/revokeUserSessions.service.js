import { RefreshToken, User } from "../../../models/index.js";
import { fetchOrNotFound } from "../../../utils/index.js";
import { auditLogger } from "../../../logger/pino.logger.js";

/** Revokes every active refresh-token session belonging to a user. */
const revokeUserSessionsService = async ({
    userId,
    revokedByUserId = null,
} = {}) => {
    await fetchOrNotFound(User, userId, {
        idMessage: "UserId is required",
        idCode: "USER_ID_REQUIRED",
        notFoundMessage: "No user exists",
        notFoundCode: "NO_USER_EXISTS",
    });

    const result = await RefreshToken.updateMany(
        { userId, revokedAt: null },
        { $set: { revokedAt: new Date() } },
    );

    auditLogger.info(
        { userId, revokedBy: revokedByUserId, revokedCount: result.modifiedCount },
        "All user sessions revoked by admin",
    );

    return { message: "All sessions revoked successfully", revokedCount: result.modifiedCount };
};

export { revokeUserSessionsService };

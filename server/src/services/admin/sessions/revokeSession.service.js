import { RefreshToken } from "../../../models/index.js";
import { fetchOrNotFound } from "../../../utils/index.js";
import { auditLogger } from "../../../logger/pino.logger.js";

/** Revokes one refresh-token session on an admin's behalf. */
const adminRevokeSessionService = async ({
    sessionId,
    revokedByUserId = null,
} = {}) => {
    const session = await fetchOrNotFound(RefreshToken, sessionId, {
        idMessage: "SessionId is required",
        idCode: "SESSION_ID_REQUIRED",
        notFoundMessage: "Session not found",
        notFoundCode: "SESSION_NOT_FOUND",
    });

    if (session.isActive()) {
        await session.revoke();
    }

    auditLogger.info(
        { sessionId, userId: session.userId, revokedBy: revokedByUserId },
        "Session revoked by admin",
    );

    return { message: "Session revoked successfully" };
};

export { adminRevokeSessionService };

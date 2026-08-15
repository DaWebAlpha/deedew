import { Ping } from "../../../models/index.js";
import { fetchOrNotFound } from "../../../utils/index.js";
import { auditLogger } from "../../../logger/pino.logger.js";

/** Restores a soft-deleted ping, recording who restored it and why. */
const restorePingService = async ({
    pingId,
    restoreUserId = null,
    reason = null,
} = {}) => {
    const ping = await fetchOrNotFound(Ping, pingId, {
        idMessage: "PingId is required",
        idCode: "PING_ID_REQUIRED",
        notFoundMessage: "No ping exists to restore",
        notFoundCode: "NO_PING_EXISTS_TO_RESTORE",
    });

    await ping.restore({ restoreUserId, reason });

    auditLogger.info(
        { pingId, restoredBy: restoreUserId, reason },
        "Ping restored by admin",
    );

    return { message: "Ping successfully restored" };
};

export { restorePingService };

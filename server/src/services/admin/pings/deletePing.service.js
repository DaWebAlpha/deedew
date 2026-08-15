import { Ping } from "../../../models/index.js";
import { fetchOrNotFound } from "../../../utils/index.js";
import { auditLogger } from "../../../logger/pino.logger.js";

/** Soft-deletes a ping, recording who deleted it and why. */
const deletePingService = async ({
    pingId,
    deletedByUserId = null,
    reason = null,
} = {}) => {
    const ping = await fetchOrNotFound(Ping, pingId, {
        idMessage: "PingId is required",
        idCode: "PING_ID_REQUIRED",
        notFoundMessage: "No ping exists to delete",
        notFoundCode: "NO_PING_EXISTS_TO_DELETE",
    });

    await ping.softDelete({ deletedByUserId, reason });

    auditLogger.info(
        { pingId, deletedBy: deletedByUserId, reason },
        "Ping deleted by admin",
    );

    return { message: "Ping successfully deleted" };
};

export { deletePingService };

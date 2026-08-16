import { SellerProfile, User } from "../../models/index.js";
import { fetchOrNotFound, withTransaction } from "../../utils/index.js";
import { auditLogger } from "../../logger/pino.logger.js";

/**
 * Restores a soft-deleted seller profile and flips User.isSeller back to true, in one transaction.
 * @param {object} params
 * @param {string} params.sellerId
 * @param {string} [params.restoreUserId]
 * @param {string} [params.reason]
 * @returns {Promise<{seller: import("mongoose").Document, message: string}>}
 * @throws {BadRequestError} If sellerId is missing.
 * @throws {NotFoundError} If no seller matches.
 */
const restoreSellerService = async ({
    sellerId,
    restoreUserId = null,
    reason = null,
} = {}) => {
    const seller = await fetchOrNotFound(
        SellerProfile,
        sellerId,
        {
            idMessage: "Seller ID is required",
            idCode: "SELLER_ID_REQUIRED",
            notFoundMessage: "No seller exists to restore",
            notFoundCode: "NO_SELLER_EXISTS_TO_RESTORE",
        }
    )

    return withTransaction(async (session) => {
        await seller.restore({ restoreUserId, reason, session });

        await User.updateOne(
            { _id: seller.userId },
            { $set: { isSeller: true } },
        ).session(session);

        auditLogger.info(
            {
                sellerId,
                restoredBy: restoreUserId,
                reason
            },
            "Seller successfully restored"
        )

        return {
            seller,
            message: "Seller successfully restored",
        }
    });
}

export {
    restoreSellerService,
}

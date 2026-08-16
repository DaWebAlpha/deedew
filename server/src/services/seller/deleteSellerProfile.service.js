import { SellerProfile, User } from "../../models/index.js";
import { fetchOrNotFound, withTransaction } from "../../utils/index.js";
import { auditLogger } from "../../logger/pino.logger.js";

/**
 * Soft-deletes a seller profile and flips User.isSeller back to false, in one transaction.
 * @param {object} params
 * @param {string} params.sellerId
 * @param {string} [params.deletedByUserId]
 * @param {string} [params.reason]
 * @returns {Promise<{message: string}>}
 * @throws {BadRequestError} If sellerId is missing.
 * @throws {NotFoundError} If no seller matches.
 */
const deleteSellerProfileService = async ({
    sellerId,
    deletedByUserId = null,
    reason = null,
} = {}) => {
    const seller = await fetchOrNotFound(
        SellerProfile,
        sellerId,
        {
            idMessage: "Seller ID is required",
            idCode: "SELLER_ID_REQUIRED",
            notFoundMessage: "Seller not found",
            notFoundCode: "SELLER_NOT_FOUND",
        }
    );

    return withTransaction(async (session) => {
        await seller.softDelete({ deletedByUserId, reason, session });

        await User.updateOne(
            { _id: seller.userId },
            { $set: { isSeller: false } },
        ).session(session);

        auditLogger.info(
            { sellerId, deletedBy: deletedByUserId, reason },
            "Seller profile deleted",
        );

        return {
            message: "Seller Profile deleted",
        };
    });
}

export {
    deleteSellerProfileService,
}

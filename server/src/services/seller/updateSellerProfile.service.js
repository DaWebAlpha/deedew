import { SellerProfile } from "../../models/index.js";
import { fetchOrNotFound } from "../../utils/index.js";
import { BadRequestError } from "../../errors/index.js";
import { auditLogger } from "../../logger/pino.logger.js";

const UPDATABLE_FIELDS = [
    "shopName",
    "description",
    "region",
    "city",
    "location",
    "payoutMethod",
    "payoutDetails",
    "workingHours",
    "isActive",
];

/**
 * Applies a partial update to a seller profile. userId and slug are
 * intentionally not updatable (owner and slug are permanent); rating
 * fields are aggregated from Review, not directly settable; and
 * verificationStatus/verifiedBy/rejectionReason are only changed by
 * the dedicated verify/reject services, not a generic update.
 * @param {object} params
 * @param {string} params.sellerId
 * @param {string} [params.updatedByUserId]
 * @param {string} [params.shopName]
 * @param {string} [params.description]
 * @param {string} [params.region]
 * @param {string} [params.city]
 * @param {object} [params.location]
 * @param {"mobile_money"|"bank_transfer"} [params.payoutMethod]
 * @param {object} [params.payoutDetails]
 * @param {object[]} [params.workingHours]
 * @param {boolean} [params.isActive]
 * @returns {Promise<{seller: import("mongoose").Document, message: string}>}
 * @throws {BadRequestError} If sellerId is missing or the update fails validation.
 * @throws {NotFoundError} If no seller matches sellerId.
 */
const updateSellerProfileService = async ({
    sellerId,
    updatedByUserId = null,
    ...updates
} = {}) => {
    const seller = await fetchOrNotFound(SellerProfile, sellerId, {
        idMessage: "Seller ID is required",
        idCode: "SELLER_ID_REQUIRED",
        notFoundMessage: "Seller not found",
        notFoundCode: "SELLER_NOT_FOUND",
    });

    for (const field of UPDATABLE_FIELDS) {
        if (updates[field] !== undefined) {
            seller[field] = updates[field];
        }
    }

    seller.updatedBy = updatedByUserId;

    try {
        await seller.save();
    } catch (error) {
        if (error.name === "ValidationError") {
            const messages = Object.values(error.errors).map((e) => e.message);
            throw new BadRequestError({ message: messages.join(", ") });
        }

        throw error;
    }

    auditLogger.info(
        { sellerId, updatedBy: updatedByUserId },
        "Seller profile successfully updated",
    );

    return {
        seller,
        message: "Seller profile successfully updated",
    };
};

export {
    updateSellerProfileService,
};

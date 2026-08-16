import { SellerProfile, User } from "../../models/index.js";
import { BadRequestError, ConflictError } from "../../errors/index.js";
import { throwErrorOnEmptyInput, withTransaction } from "../../utils/index.js";
import { auditLogger } from "../../logger/pino.logger.js";

/**
 * Self-service: turns the calling User into a seller by creating their
 * SellerProfile and flipping User.isSeller — a user is never made a
 * seller by an admin, only by creating this themselves.
 * @param {object} params
 * @param {string} params.userId - The authenticated caller's own user id.
 * @param {string} params.shopName
 * @param {string} [params.description]
 * @param {string} [params.region]
 * @param {string} [params.city]
 * @param {{type: string, coordinates: number[]}} params.location - GeoJSON Point.
 * @param {"mobile_money"|"bank_transfer"} [params.payoutMethod]
 * @param {object} [params.payoutDetails]
 * @param {object[]} [params.workingHours]
 * @returns {Promise<{sellerProfile: import("mongoose").Document, message: string}>}
 * @throws {BadRequestError} If userId/shopName/location.coordinates are missing or creation fails validation.
 * @throws {ConflictError} If the caller already has a seller profile.
 */
const createSellerProfileService = async ({
    userId,
    shopName,
    description = null,
    region = null,
    city = null,
    location,
    payoutMethod = null,
    payoutDetails = null,
    workingHours = [],
} = {}) => {
    throwErrorOnEmptyInput(userId, "User id");
    throwErrorOnEmptyInput(shopName, "Shop name");

    if (!location?.coordinates) {
        throw new BadRequestError({
            message: "Location coordinates are required",
            code: "LOCATION_COORDINATES_REQUIRED",
        });
    }

    const alreadySeller = await SellerProfile.exists({ userId, isDeleted: false });

    if (alreadySeller) {
        throw new ConflictError({
            message: "You already have a seller profile",
            code: "SELLER_PROFILE_EXISTS",
        });
    }

    return withTransaction(async (session) => {
        let sellerProfile;

        try {
            [sellerProfile] = await SellerProfile.create(
                [{
                    userId,
                    shopName,
                    description,
                    region,
                    city,
                    location,
                    payoutMethod,
                    payoutDetails,
                    workingHours,
                }],
                { session },
            );
        } catch (error) {
            if (error.code === 11000) {
                throw new ConflictError({ message: "You already have a seller profile" });
            }

            if (error.name === "ValidationError") {
                const messages = Object.values(error.errors).map((e) => e.message);
                throw new BadRequestError({ message: messages.join(", ") });
            }

            throw error;
        }

        await User.updateOne(
            { _id: userId },
            { $set: { isSeller: true } },
        ).session(session);

        auditLogger.info(
            { userId, sellerProfileId: sellerProfile._id },
            "Seller profile created",
        );

        return {
            sellerProfile,
            message: "Seller profile created successfully",
        };
    });
};

export { createSellerProfileService };

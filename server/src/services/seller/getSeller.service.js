import { SellerProfile } from "../../models/index.js";
import {
    fetchOrNotFound
} from "../../utils/index.js";


/**
 * Fetches a single seller by id or throws NotFoundError.
 * @param {object} params
 * @param {string} params.sellerId
 * @returns {Promise<{seller: import("mongoose").Document}>}
 * @throws {BadRequestError} If sellerId is missing.
 * @throws {NotFoundError} If no seller matches.
 */
const getSellerService = async({
    sellerId,

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

    return { seller };
}

export { getSellerService };
import { SellerProfile } from "../../models/index.js";
import { NotFoundError } from "../../errors/index.js";
import { buildSearchFilter } from "../../utils/index.js";


/**
 * Returns a paginated page of every seller, active and deleted.
 * @param {object} [params]
 * @param {string} [params.search]
 * @param {number} [params.page=1]
 * @param {number} [params.limit=50]
 * @returns {Promise<{result: object, message: string}>}
 * @throws {NotFoundError} If no sellers exist at all.
 */
const getAllSellersIncludingDeletedService = async ({
    search,
    page = 1,
    limit = 50,
} = {}) => {
     const result = await SellerProfile.paginate({
        filter: {
            ...buildSearchFilter({ search, fields: ["shopName", "description"] }),
            isDeleted: { $in: [true, false] }
        },
        page,
        limit
    })

    if(!result.data.length){
        throw new NotFoundError({
            message: "No sellers exist yet",
            code: "NO_SELLERS_EXIST"
        })
    }

    return{
        result,
        message: "Seller Profile successfully retrieved",
    }
}

export {
    getAllSellersIncludingDeletedService
}
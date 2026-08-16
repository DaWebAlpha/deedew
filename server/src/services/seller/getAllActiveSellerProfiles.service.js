import { SellerProfile } from "../../models/index.js";
import { NotFoundError } from "../../errors/index.js";
import { buildSearchFilter } from "../../utils/index.js";



/**
 * Returns a paginated page of non-deleted sellers, searchable by shop name/description.
 * @param {object} [params]
 * @param {string} [params.search]
 * @param {number} [params.page=1]
 * @param {number} [params.limit=50]
 * @returns {Promise<{result: object, message: string}>}
 * @throws {NotFoundError} If no active sellers exist.
 */
const getAllActiveSellerProfilesService = async({

    search,
    page = 1,
    limit = 50
} = {}) => {
    const result = await SellerProfile.paginate({
        filter: {
            ...buildSearchFilter({ search, fields: ["shopName", "description"]}),
            isDeleted: false
        },
        page,
        limit
    })

    if(!result.data.length){
        throw new NotFoundError({
            message: "No active sellers exist yet",
            code: "NO_ACTIVE_SELLERS_EXIST"
        })
    }

    return {
        result,
        message: "Active sellers successfully retrieved"
    }
}

export {
    getAllActiveSellerProfilesService,
}
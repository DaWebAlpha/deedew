import { SellerProfile } from "../../models/index.js";
import { NotFoundError } from "../../errors/index.js";
import { buildSearchFilter } from "../../utils/index.js";

/**
 * Returns a paginated page of soft-deleted sellers, searchable by shop name/description.
 * @param {object} [params]
 * @param {string} [params.search]
 * @param {number} [params.page=1]
 * @param {number} [params.limit=50]
 * @returns {Promise<{result: object, message: string}>}
 * @throws {NotFoundError} If no deleted sellers exist.
 */
const getAllDeletedSellerProfilesService = async ({
    search,
    page = 1,
    limit = 50,
} = {}) => {
    const result = await SellerProfile.paginate({
        filter: {
            ...buildSearchFilter({ search, fields: ["shopName", "description"] }),
            isDeleted: true,
        },
        page,
        limit,
    });

    if (!result.data.length) {
        throw new NotFoundError({
            message: "No deleted sellers exist yet",
            code: "NO_DELETED_SELLERS_EXIST",
        });
    }

    return {
        result,
        message: "Deleted sellers successfully retrieved",
    };
};

export {
    getAllDeletedSellerProfilesService,
};

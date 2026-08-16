import { getSellerBySlugService } from "../../services/index.js";
import { asyncHandler } from "../../utils/index.js";
import { HTTP_STATUS } from "../../constants/index.js";

/** Public: fetches a single seller by its slug. */
const getSellerBySlugController = asyncHandler(async (request, response) => {
    const { seller } = await getSellerBySlugService({ slug: request.params.slug });

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        seller,
    });
});

export { getSellerBySlugController };

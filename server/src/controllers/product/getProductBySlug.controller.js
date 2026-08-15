import { getProductBySlugService } from "../../services/index.js";
import { asyncHandler } from "../../utils/index.js";
import { HTTP_STATUS } from "../../constants/index.js";

/** Public: fetches a single product by its slug. */
const getProductBySlugController = asyncHandler(async (request, response) => {
    const { product } = await getProductBySlugService({ slug: request.params.slug });

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        product,
    });
});

export { getProductBySlugController };

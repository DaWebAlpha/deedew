import { getProductService } from "../../services/index.js";
import { asyncHandler } from "../../utils/index.js";
import { HTTP_STATUS } from "../../constants/index.js";

/** Public: fetches a single product by id. */
const getProductController = asyncHandler(async (request, response) => {
    const { product } = await getProductService({ productId: request.params.productId });

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        product,
    });
});

export { getProductController };

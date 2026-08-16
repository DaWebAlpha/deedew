import { getSellerService } from "../../services/index.js";
import { asyncHandler } from "../../utils/index.js";
import { HTTP_STATUS } from "../../constants/index.js";

/** Public: fetches a single seller by id. */
const getSellerController = asyncHandler(async (request, response) => {
    const { seller } = await getSellerService({ sellerId: request.params.sellerId });

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        seller,
    });
});

export { getSellerController };

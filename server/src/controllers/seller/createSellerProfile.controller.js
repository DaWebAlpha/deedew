import { createSellerProfileService } from "../../services/index.js";
import { asyncHandler } from "../../utils/index.js";
import { HTTP_STATUS } from "../../constants/index.js";


/** Self-service: the authenticated user creates their own seller profile. */
const createSellerProfileController = asyncHandler(async (request, response) => {
    const result = await createSellerProfileService({
        ...request.body,
        userId: request.user.userId,
    });

    return response.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: result.message,
        sellerProfile: result.sellerProfile,
    });
});

export { createSellerProfileController };

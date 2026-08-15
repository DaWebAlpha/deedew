import { getCategoryBySlugService } from "../../services/index.js";
import { asyncHandler } from "../../utils/index.js";
import { HTTP_STATUS } from "../../constants/index.js";

/** Public: fetches a single category by its slug. */
const getCategoryBySlugController = asyncHandler(async (request, response) => {
    const { category } = await getCategoryBySlugService({ slug: request.params.slug });

    return response.status(HTTP_STATUS.OK).json({
        success: true,
        category,
    });
});

export { getCategoryBySlugController };

import { Product, Category } from "../../models/index.js";
import { BadRequestError } from "../../errors/index.js";
import { auditLogger } from "../../logger/pino.logger.js";

/** Creates a product after confirming its categoryId points to a live category. */
const createProductService = async ({
    productName,
    description = null,
    categoryId,
    price,
    stockQuantity = 0,
    images = [],
} = {}) => {
    if (!productName) {
        throw new BadRequestError({
            message: "Product name is required",
            code: "PRODUCT_NAME_IS_REQUIRED",
        });
    }

    if (!categoryId) {
        throw new BadRequestError({
            message: "Category is required",
            code: "CATEGORY_ID_REQUIRED",
        });
    }

    if (price === undefined || price === null) {
        throw new BadRequestError({
            message: "Price is required",
            code: "PRICE_IS_REQUIRED",
        });
    }

    const categoryExists = await Category.exists({ _id: categoryId, isDeleted: false });

    if (!categoryExists) {
        throw new BadRequestError({
            message: "No category exists for the given categoryId",
            code: "CATEGORY_DOES_NOT_EXIST",
        });
    }

    let product;

    try {
        product = await Product.create({
            productName,
            description,
            categoryId,
            price,
            stockQuantity,
            images,
        });
    } catch (error) {
        if (error.name === "ValidationError") {
            const messages = Object.values(error.errors).map((e) => e.message);
            throw new BadRequestError({ message: messages.join(", ") });
        }

        throw error;
    }

    auditLogger.info(
        {
            productId: product._id,
            productName: product.productName,
        },
        "Product has been created",
    );

    return {
        product,
        message: "Product has been created",
    };
};

export {
    createProductService,
};

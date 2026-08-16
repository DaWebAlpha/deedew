import { Product, Category, SellerProfile } from "../../models/index.js";
import { BadRequestError } from "../../errors/index.js";
import { auditLogger } from "../../logger/pino.logger.js";

/**
 * Creates a product after confirming its categoryId and sellerId point to live documents.
 * @param {object} params
 * @param {string} params.productName
 * @param {string} [params.description]
 * @param {string} params.categoryId
 * @param {string} params.sellerId
 * @param {number} params.price
 * @param {number} [params.stockQuantity=0]
 * @param {string[]} [params.images]
 * @returns {Promise<{product: import("mongoose").Document, message: string}>}
 * @throws {BadRequestError} If a required field is missing, or categoryId/sellerId don't point to live documents.
 */
const createProductService = async ({
    productName,
    description = null,
    categoryId,
    sellerId,
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

    if (!sellerId) {
        throw new BadRequestError({
            message: "Seller is required",
            code: "SELLER_ID_REQUIRED",
        });
    }

    if (price === undefined || price === null) {
        throw new BadRequestError({
            message: "Price is required",
            code: "PRICE_IS_REQUIRED",
        });
    }

    const [categoryExists, sellerExists] = await Promise.all([
        Category.exists({ _id: categoryId, isDeleted: false }),
        SellerProfile.exists({ _id: sellerId, isDeleted: false }),
    ]);

    if (!categoryExists) {
        throw new BadRequestError({
            message: "No category exists for the given categoryId",
            code: "CATEGORY_DOES_NOT_EXIST",
        });
    }

    if (!sellerExists) {
        throw new BadRequestError({
            message: "No seller exists for the given sellerId",
            code: "SELLER_DOES_NOT_EXIST",
        });
    }

    let product;

    try {
        product = await Product.create({
            productName,
            description,
            categoryId,
            sellerId,
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

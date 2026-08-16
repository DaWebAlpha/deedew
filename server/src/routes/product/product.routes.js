import express from "express";
import {
    createProductController,
    createMyProductController,
    getProductController,
    getProductBySlugController,
    getAllActiveProductsController,
    getAllDeletedProductsController,
    getAllProductsIncludingDeletedController,
    updateProductController,
    deleteProductController,
    restoreProductController,
} from "../../controllers/index.js";
import { authenticate, roleMiddleware } from "../../middleware/index.js";
import { PERMISSIONS } from "../../constants/index.js";

const productRouter = express.Router();

// Public routes — no authentication required, anyone can browse products.
// Specific paths must come before "/:productId", or Express would match them as a productId instead.
productRouter.get(
    "/deleted",
    authenticate,
    roleMiddleware(PERMISSIONS.PRODUCT_VIEW_DELETED),
    getAllDeletedProductsController,
);

productRouter.get(
    "/all",
    authenticate,
    roleMiddleware(PERMISSIONS.PRODUCT_VIEW_DELETED),
    getAllProductsIncludingDeletedController,
);

productRouter.get("/slug/:slug", getProductBySlugController);

productRouter.get("/", getAllActiveProductsController);

productRouter.get("/:productId", getProductController);

// Self-service — any authenticated user with their own SellerProfile can
// list a product under it. No admin role required; sellerId is derived
// from the caller's own profile, never trusted from the request body.
productRouter.post(
    "/mine",
    authenticate,
    createMyProductController,
);

// Admin-gated routes — create/update/delete require "admin"; restore/view-deleted require "superadmin".
productRouter.post(
    "/",
    authenticate,
    roleMiddleware(PERMISSIONS.PRODUCT_CREATE),
    createProductController,
);

productRouter.patch(
    "/:productId",
    authenticate,
    roleMiddleware(PERMISSIONS.PRODUCT_UPDATE),
    updateProductController,
);

productRouter.delete(
    "/:productId",
    authenticate,
    roleMiddleware(PERMISSIONS.PRODUCT_DELETE),
    deleteProductController,
);

productRouter.post(
    "/:productId/restore",
    authenticate,
    roleMiddleware(PERMISSIONS.PRODUCT_RESTORE),
    restoreProductController,
);

export { productRouter };

import express from "express";
import {
    createSellerProfileController,
    getSellerController,
    getSellerBySlugController,
    getAllActiveSellerProfilesController,
    getAllDeletedSellerProfilesController,
    getAllSellersIncludingDeletedController,
    updateSellerProfileController,
    deleteSellerProfileController,
    restoreSellerController,
} from "../../controllers/index.js";
import { authenticate, roleMiddleware } from "../../middleware/index.js";
import { PERMISSIONS } from "../../constants/index.js";

const sellerRouter = express.Router();

// Public routes — no authentication required, anyone can browse sellers.
// Specific paths must come before "/:sellerId", or Express would match them as a sellerId instead.
sellerRouter.get(
    "/deleted",
    authenticate,
    roleMiddleware(PERMISSIONS.SELLER_VIEW_DELETED),
    getAllDeletedSellerProfilesController,
);

sellerRouter.get(
    "/all",
    authenticate,
    roleMiddleware(PERMISSIONS.SELLER_VIEW_DELETED),
    getAllSellersIncludingDeletedController,
);

sellerRouter.get("/slug/:slug", getSellerBySlugController);

sellerRouter.get("/", getAllActiveSellerProfilesController);

sellerRouter.get("/:sellerId", getSellerController);

// Self-service — any authenticated user can become a seller. No admin
// role required; a seller is never created on someone else's behalf.
sellerRouter.post("/", authenticate, createSellerProfileController);

// Admin-gated routes — update/delete require "admin"; restore/view-deleted require "superadmin".
sellerRouter.patch(
    "/:sellerId",
    authenticate,
    roleMiddleware(PERMISSIONS.SELLER_UPDATE),
    updateSellerProfileController,
);

sellerRouter.delete(
    "/:sellerId",
    authenticate,
    roleMiddleware(PERMISSIONS.SELLER_DELETE),
    deleteSellerProfileController,
);

sellerRouter.post(
    "/:sellerId/restore",
    authenticate,
    roleMiddleware(PERMISSIONS.SELLER_RESTORE),
    restoreSellerController,
);

export { sellerRouter };

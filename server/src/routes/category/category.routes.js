import express from "express";
import {
    createCategoryController,
    getCategoryController,
    getCategoryBySlugController,
    getAllActiveCategoriesController,
    getAllDeletedCategoriesController,
    getAllCategoriesIncludingDeletedController,
    updateCategoryController,
    deleteCategoryController,
    restoreCategoryController,
} from "../../controllers/index.js";
import { authenticate, roleMiddleware } from "../../middleware/index.js";
import { PERMISSIONS } from "../../constants/index.js";

const categoryRouter = express.Router();

// Public routes — no authentication required, anyone can browse categories.
// Specific paths must come before "/:categoryId", or Express would match them as a categoryId instead.
categoryRouter.get(
    "/deleted",
    authenticate,
    roleMiddleware(PERMISSIONS.CATEGORY_VIEW_DELETED),
    getAllDeletedCategoriesController,
);

categoryRouter.get(
    "/all",
    authenticate,
    roleMiddleware(PERMISSIONS.CATEGORY_VIEW_DELETED),
    getAllCategoriesIncludingDeletedController,
);

categoryRouter.get("/slug/:slug", getCategoryBySlugController);

categoryRouter.get("/", getAllActiveCategoriesController);

categoryRouter.get("/:categoryId", getCategoryController);

// Admin-gated routes — create/update/delete require "admin"; restore/view-deleted require "superadmin".
categoryRouter.post(
    "/",
    authenticate,
    roleMiddleware(PERMISSIONS.CATEGORY_CREATE),
    createCategoryController,
);

categoryRouter.patch(
    "/:categoryId",
    authenticate,
    roleMiddleware(PERMISSIONS.CATEGORY_UPDATE),
    updateCategoryController,
);

categoryRouter.delete(
    "/:categoryId",
    authenticate,
    roleMiddleware(PERMISSIONS.CATEGORY_DELETE),
    deleteCategoryController,
);

categoryRouter.post(
    "/:categoryId/restore",
    authenticate,
    roleMiddleware(PERMISSIONS.CATEGORY_RESTORE),
    restoreCategoryController,
);

export { categoryRouter };

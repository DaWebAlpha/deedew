import express from "express";
import {
    getPingController,
    getAllActivePingsController,
    getAllDeletedPingsController,
    getAllPingsIncludingDeletedController,
    deletePingController,
    restorePingController,
} from "../../controllers/index.js";
import { authenticate, roleMiddleware } from "../../middleware/index.js";
import { PERMISSIONS } from "../../constants/index.js";

const adminPingsRouter = express.Router();

// Specific paths must come before "/:pingId", or Express would match them as a pingId instead.
adminPingsRouter.get(
    "/deleted",
    authenticate,
    roleMiddleware(PERMISSIONS.PING_VIEW_DELETED),
    getAllDeletedPingsController,
);

adminPingsRouter.get(
    "/all",
    authenticate,
    roleMiddleware(PERMISSIONS.PING_VIEW_DELETED),
    getAllPingsIncludingDeletedController,
);

adminPingsRouter.get(
    "/",
    authenticate,
    roleMiddleware(PERMISSIONS.PING_VIEW),
    getAllActivePingsController,
);

adminPingsRouter.get(
    "/:pingId",
    authenticate,
    roleMiddleware(PERMISSIONS.PING_VIEW),
    getPingController,
);

adminPingsRouter.delete(
    "/:pingId",
    authenticate,
    roleMiddleware(PERMISSIONS.PING_DELETE),
    deletePingController,
);

adminPingsRouter.post(
    "/:pingId/restore",
    authenticate,
    roleMiddleware(PERMISSIONS.PING_RESTORE),
    restorePingController,
);

export { adminPingsRouter };

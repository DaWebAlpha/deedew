import express from "express";
import {
    getAllActiveSessionsController,
    getUserSessionsController,
    adminRevokeSessionController,
    revokeUserSessionsController,
} from "../../controllers/index.js";
import { authenticate, roleMiddleware } from "../../middleware/index.js";
import { PERMISSIONS } from "../../constants/index.js";

/** Admin routes for viewing and revoking user sessions. */
const adminSessionsRouter = express.Router();

adminSessionsRouter.get(
    "/",
    authenticate,
    roleMiddleware(PERMISSIONS.SESSION_VIEW),
    getAllActiveSessionsController,
);

adminSessionsRouter.get(
    "/user/:userId",
    authenticate,
    roleMiddleware(PERMISSIONS.SESSION_VIEW),
    getUserSessionsController,
);

adminSessionsRouter.delete(
    "/user/:userId",
    authenticate,
    roleMiddleware(PERMISSIONS.SESSION_REVOKE),
    revokeUserSessionsController,
);

adminSessionsRouter.delete(
    "/:sessionId",
    authenticate,
    roleMiddleware(PERMISSIONS.SESSION_REVOKE),
    adminRevokeSessionController,
);

export { adminSessionsRouter };

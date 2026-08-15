import express from "express";
import {
    getUserSecurityController,
    clearUserLockoutController,
} from "../../controllers/index.js";
import { authenticate, roleMiddleware } from "../../middleware/index.js";
import { PERMISSIONS } from "../../constants/index.js";

/** Admin routes for viewing and clearing a user's lockout state. */
const adminSecurityRouter = express.Router();

adminSecurityRouter.get(
    "/:userId",
    authenticate,
    roleMiddleware(PERMISSIONS.USER_VIEW),
    getUserSecurityController,
);

adminSecurityRouter.post(
    "/:userId/clear-lockout",
    authenticate,
    roleMiddleware(PERMISSIONS.USER_CLEAR_LOCKOUT),
    clearUserLockoutController,
);

export { adminSecurityRouter };

import express from "express";
import {
    getUserLoginLogsController,
    getUsersLoginLogsController,
} from "../../controllers/index.js";
import { authenticate, roleMiddleware } from "../../middleware/index.js";
import { PERMISSIONS } from "../../constants/index.js";

/** Admin routes for viewing login-log audit history. */
const adminLoginLogsRouter = express.Router();

adminLoginLogsRouter.get(
    "/",
    authenticate,
    roleMiddleware(PERMISSIONS.USER_VIEW_LOGIN_LOGS),
    getUsersLoginLogsController,
);

adminLoginLogsRouter.get(
    "/:userId",
    authenticate,
    roleMiddleware(PERMISSIONS.USER_VIEW_LOGIN_LOGS),
    getUserLoginLogsController,
);

export { adminLoginLogsRouter };

import express from "express";
import {
    getUserController,
    getAllActiveUsersController,
    getAllDeletedUsersController,
    getAllUsersIncludingDeletedController,
    deleteUserController,
    restoreUserController,
    banUserController,
    unbanUserController,
    suspendUserController,
    unsuspendUserController,
    getUserModerationStatsController,
    updateUserRoleController,
} from "../../controllers/index.js";
import { authenticate, roleMiddleware } from "../../middleware/index.js";
import { PERMISSIONS } from "../../constants/index.js";

const adminUsersRouter = express.Router();

// Specific paths must come before "/:userId", or Express would match them as a userId instead.
adminUsersRouter.get(
    "/stats",
    authenticate,
    roleMiddleware(PERMISSIONS.USER_VIEW_MODERATION_STATS),
    getUserModerationStatsController,
);

adminUsersRouter.get(
    "/deleted",
    authenticate,
    roleMiddleware(PERMISSIONS.USER_VIEW_DELETED),
    getAllDeletedUsersController,
);

adminUsersRouter.get(
    "/all",
    authenticate,
    roleMiddleware(PERMISSIONS.USER_VIEW_DELETED),
    getAllUsersIncludingDeletedController,
);

adminUsersRouter.get(
    "/",
    authenticate,
    roleMiddleware(PERMISSIONS.USER_VIEW),
    getAllActiveUsersController,
);

adminUsersRouter.get(
    "/:userId",
    authenticate,
    roleMiddleware(PERMISSIONS.USER_VIEW),
    getUserController,
);

adminUsersRouter.delete(
    "/:userId",
    authenticate,
    roleMiddleware(PERMISSIONS.USER_DELETE),
    deleteUserController,
);

adminUsersRouter.post(
    "/:userId/restore",
    authenticate,
    roleMiddleware(PERMISSIONS.USER_RESTORE),
    restoreUserController,
);

adminUsersRouter.post(
    "/:userId/ban",
    authenticate,
    roleMiddleware(PERMISSIONS.USER_BAN),
    banUserController,
);

adminUsersRouter.post(
    "/:userId/unban",
    authenticate,
    roleMiddleware(PERMISSIONS.USER_UNBAN),
    unbanUserController,
);

adminUsersRouter.post(
    "/:userId/suspend",
    authenticate,
    roleMiddleware(PERMISSIONS.USER_SUSPEND),
    suspendUserController,
);

adminUsersRouter.post(
    "/:userId/unsuspend",
    authenticate,
    roleMiddleware(PERMISSIONS.USER_UNSUSPEND),
    unsuspendUserController,
);

adminUsersRouter.patch(
    "/:userId/role",
    authenticate,
    roleMiddleware(PERMISSIONS.USER_UPDATE_ROLE),
    updateUserRoleController,
);

export { adminUsersRouter };

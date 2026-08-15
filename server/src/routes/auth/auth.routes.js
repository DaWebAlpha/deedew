import express from "express";
import {
    registerUserController,
    loginUserController,
    refreshTokenController,
    logoutController,
    logoutAllDevicesController,
    getCurrentUserController,
    changePasswordController,
    listSessionsController,
    revokeSessionController,
} from "../../controllers/index.js";
import { authenticate, authRateLimiter } from "../../middleware/index.js";

/** Public and self-service auth routes: register, login, refresh, logout, sessions. */
const authRouter = express.Router();

authRouter.post("/register", authRateLimiter, registerUserController);
authRouter.post("/login", authRateLimiter, loginUserController);
authRouter.post("/refresh", refreshTokenController);
authRouter.post("/logout", authenticate, logoutController);
authRouter.post("/logout-all", authenticate, logoutAllDevicesController);
authRouter.get("/me", authenticate, getCurrentUserController);
authRouter.patch("/change-password", authenticate, changePasswordController);
authRouter.get("/sessions", authenticate, listSessionsController);
authRouter.delete("/sessions/:sessionId", authenticate, revokeSessionController);

export { authRouter };

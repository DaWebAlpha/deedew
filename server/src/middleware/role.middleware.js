import { HTTP_STATUS, ROLE_PERMISSIONS } from "../constants/index.js";

/**
 * Middleware factory: roleMiddleware(PERMISSIONS.X) returns a middleware
 * that 403s unless request.user's role has at least one of the given
 * permissions. Must run after `authenticate`, which sets request.user.
 */
const roleMiddleware = (...requiredPermission) => {
    return (request, response, next) => {
        if(!request.user){
            return response.status(HTTP_STATUS.UNAUTHENTICATED).json({
                success: false,
                message: "Authentication required"
            })
        }

        const userPermissions = ROLE_PERMISSIONS[request.user.role] || [];

        const hasPermission = requiredPermission.some(
            (permission) => userPermissions.includes(permission)
        );

        if(!hasPermission){
            return response.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                message: "You do not have permission to perform this action"
            })
        }

        next();
    }
}

export { roleMiddleware };

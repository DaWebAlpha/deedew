import { UserSecurity } from "../../../models/index.js";

/** Returns counts of currently banned and currently suspended users. */
const getUserModerationStatsService = async () => {
    const [bannedCount, suspendedCount] = await Promise.all([
        UserSecurity.countDocuments({ isBanned: true }),
        UserSecurity.countDocuments({ suspendedUntil: { $gt: new Date() } }),
    ]);

    return { bannedCount, suspendedCount };
};

export { getUserModerationStatsService };

import { app } from "./app.js";
import { config } from "./config/index.js";
import { connectDatabase } from "./config/database.js";
import { systemLogger } from "./logger/pino.logger.js";
import { gracefulShutdown } from "./utils/index.js";

/**
 * Connects to the database, then starts the HTTP server on the configured port.
 * @returns {Promise<void>}
 */
const startServer = async () => {
    await connectDatabase();

    const server = app.listen(config.port, () => {
        systemLogger.info(`Listening on port: ${config.port}`);
    })

    gracefulShutdown(server);
}

startServer();
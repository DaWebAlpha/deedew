import mongoose from "mongoose";
import { systemLogger } from "../logger/pino.logger.js";

/**
 * Wires up graceful-shutdown handling for an HTTP server + MongoDB
 * connection. On SIGINT/SIGTERM/uncaughtException/unhandledRejection, it
 * stops accepting new connections, gives in-flight requests a short
 * window to finish, closes the MongoDB connection, then exits — instead
 * of the process dying mid-request or leaving the database connection
 * dangling open.
 * @param {import("http").Server} server - The listening HTTP server to shut down.
 * @param {object} [options]
 * @param {number} [options.forceExitTimeoutMs=30000] - Hard-kill timeout if graceful shutdown itself hangs.
 * @param {number} [options.connectionDrainTimeoutMs=5000] - Grace period for in-flight requests after the server stops accepting new ones.
 * @returns {{shutdown: (signal: string, error?: Error|null) => Promise<void>}} An object exposing the shutdown function directly (mainly useful for tests).
 */
const gracefulShutdown = (server, options = {}) => {
    const {
        forceExitTimeoutMs = 30_000,
        connectionDrainTimeoutMs = 5_000,
    } = options;

    let isShuttingDown = false;
    let handlersRegistered = false;
    const connections = new Set();

    if (server?.on) {
        server.on("connection", (socket) => {
            connections.add(socket);

            socket.on("close", () => {
                connections.delete(socket);
            });
        });
    }

    const destroyOpenSockets = () => {
        for (const socket of connections) {
            try {
                socket.destroy();
            } catch (error) {
                systemLogger.error(
                    { err: error },
                    "Failed to destroy socket during shutdown."
                );
            }
        }
    };

    const closeHttpServer = async () => {
        if (!server) return;

        if (!server.listening) {
            systemLogger.info("HTTP server is not listening. Skipping close.");
            return;
        }

        await new Promise((resolve, reject) => {
            server.close((err) => {
                if (err) {
                    return reject(err);
                }

                systemLogger.info("HTTP server closed.");
                resolve();
            });
        });
    };

    const closeMongoConnection = async () => {
        if (mongoose.connection.readyState === 0) {
            systemLogger.info("MongoDB already disconnected. Skipping close.");
            return;
        }

        await mongoose.disconnect();
        systemLogger.info("MongoDB connection closed.");
    };

    const wait = (ms) =>
        new Promise((resolve) => {
            const timer = setTimeout(resolve, ms);
            timer.unref?.();
        });

    const shutdown = async (signal, error = null) => {
        if (isShuttingDown) {
            systemLogger.warn(
                { signal },
                "Shutdown already in progress. Ignoring additional trigger."
            );
            return;
        }

        isShuttingDown = true;

        systemLogger.warn(
            {
                signal,
                err: error instanceof Error ? error : undefined,
            },
            "Shutdown signal received. Starting graceful cleanup."
        );

        const forceExitTimer = setTimeout(() => {
            systemLogger.error(
                {
                    signal,
                    open_connections: connections.size,
                },
                `Shutdown timed out after ${forceExitTimeoutMs}ms. Forcing immediate exit.`
            );

            destroyOpenSockets();
            process.exit(1);
        }, forceExitTimeoutMs);

        forceExitTimer.unref?.();

        try {
            await closeHttpServer();

            if (connections.size > 0) {
                systemLogger.info(
                    {
                        open_connections: connections.size,
                        drain_timeout_ms: connectionDrainTimeoutMs,
                    },
                    "Allowing existing connections to drain before forceful socket cleanup."
                );

                await wait(connectionDrainTimeoutMs);
            }

            await closeMongoConnection();

            if (connections.size > 0) {
                systemLogger.warn(
                    { open_connections: connections.size },
                    "Destroying lingering open sockets."
                );
            }

            destroyOpenSockets();

            clearTimeout(forceExitTimer);

            systemLogger.info(
                { signal },
                "Graceful shutdown completed successfully. Process exiting."
            );

            const isErrorShutdown =
                signal === "uncaughtException" ||
                signal === "unhandledRejection";

            process.exit(isErrorShutdown ? 1 : 0);
        } catch (err) {
            clearTimeout(forceExitTimer);

            systemLogger.fatal(
                {
                    signal,
                    err,
                    open_connections: connections.size,
                },
                "Graceful shutdown failed. Forcing process exit."
            );

            destroyOpenSockets();
            process.exit(1);
        }
    };

    const registerHandlers = () => {
        if (handlersRegistered) return;
        handlersRegistered = true;

        process.once("SIGINT", () => {
            void shutdown("SIGINT");
        });

        process.once("SIGTERM", () => {
            void shutdown("SIGTERM");
        });

        process.once("uncaughtException", (error) => {
            systemLogger.fatal(
                { err: error },
                "Uncaught exception detected."
            );

            void shutdown("uncaughtException", error);
        });

        process.once("unhandledRejection", (reason) => {
            systemLogger.fatal(
                {
                    err: reason instanceof Error ? reason : undefined,
                    reason: reason instanceof Error ? reason.message : reason,
                },
                "Unhandled promise rejection detected."
            );

            void shutdown(
                "unhandledRejection",
                reason instanceof Error ? reason : null
            );
        });
    };

    registerHandlers();

    return {
        shutdown,
    };
}

export { gracefulShutdown };
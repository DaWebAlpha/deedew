import { app } from "./app.js";
import { config } from "./config/index.js";
import { connectDatabase } from "./config/database.js";


/** Connects to the database, then starts the HTTP server on the configured port. */
const startServer = async () => {
    await connectDatabase();

    app.listen(config.port, () => {
        console.log(`Listening on port: ${config.port}`);
    })
}

startServer();
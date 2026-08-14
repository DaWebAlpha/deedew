import express from "express";
import {
    notFound,
    errorHandler
} from "./middleware/index.js";

import { Ping } from "./models/ping.model.js";

const app = express();

/** Health-check route confirming the API is reachable. */
app.get("/", (request, response) => {
    console.log("Someone hit the new route");
    response.status(200).json({

        success: true,
        message: "Someone hit the home route"
    })
})

/** Creates a Ping document in MongoDB, used to verify the DB connection end-to-end. */
app.get("/ping-test", async (request, response) => {
    const ping = await Ping.create({message: "Welcome home"})

    console.log("Saved document: ", ping);

    return response.status(200).json({
        ping
    })
})

/** Deliberately throws to verify the global error handler (dev/testing only). */
app.get("/broken", (request, response) => {
    throw new Error("Something exploded");
})

// Must be registered last: catches unmatched routes, then any error passed via next()/thrown.
app.use(notFound);
app.use(errorHandler);

export { app };
import express from "express";

const app = express();

app.get("/", (request, response) => {
    console.log("Someone hit the new route");
    response.status(200).json({
        
        success: true,
        message: "Someone hit the home route"
    })
})

export { app };
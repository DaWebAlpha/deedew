import { app } from "./app.js";

const PORT = 5700;

app.listen(PORT, () => {
    console.log(`Listening on port: ${PORT}`);
})
import dotenv from "dotenv";

dotenv.config();

const { 
    PORT 
} = process.env;


const toNumber = (value, fallback) => {
    if(!value){
        return fallback
    }

    const parsed = Number(value);
    return !Number.isNaN(parsed) && Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const config = Object.freeze({
    port: toNumber(PORT, 5700),
})

export {
    config
}
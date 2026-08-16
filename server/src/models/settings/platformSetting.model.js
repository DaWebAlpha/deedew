import mongoose from "mongoose";
import { createSchema } from "../base/index.js";

/**
 * A single tunable platform setting (commission rate, feature flag,
 * maintenance mode, etc.) stored as a key/value pair so operators can
 * change behavior without a redeploy. Not from the reference project
 * — an original addition.
 */
const platformSettingSchemaDefinition = {
    key: {
        type: String,
        trim: true,
        required: [true, "Key is required"],
        unique: true,
    },
    value: {
        type: mongoose.Schema.Types.Mixed,
        required: [true, "Value is required"],
    },
    description: {
        type: String,
        trim: true,
        default: null,
    },
};

const platformSettingSchema = createSchema(platformSettingSchemaDefinition);

platformSettingSchema.index({ key: 1 });

const PlatformSetting = mongoose.model("PlatformSetting", platformSettingSchema);
export { PlatformSetting };

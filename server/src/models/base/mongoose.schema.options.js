import { SENSITIVE_FIELDS } from "../../constants/index.js";

/**
 * toJSON/toObject transform for mongoose schemas: replaces _id with a
 * string id, strips the version key and SENSITIVE_FIELDS, and drops
 * null/undefined/empty-string values so serialized documents stay clean
 * for clients.
 * @param {import("mongoose").Document} _document - The original Mongoose document (unused).
 * @param {object} returnedObject - The plain object being serialized; mutated and returned.
 * @returns {object} The cleaned plain object.
 */
const transformDocument = (_document, returnedObject) => {
    if(returnedObject._id){
        returnedObject.id = returnedObject._id.toString();
        delete returnedObject._id;
    }

    delete returnedObject.__v;

    for(const field of SENSITIVE_FIELDS){
        delete returnedObject[field];
    }

    for (const key in returnedObject){
        if(
            returnedObject[key] === null ||
            returnedObject[key] === undefined ||
            returnedObject[key] === ""
        ){
            delete returnedObject[key]
        }
    }

    return returnedObject;
}


/**
 * Shared toJSON/toObject config: include virtuals, apply transformDocument.
 */
const serializationOptions = Object.freeze({
    virtuals: true,
    transform: transformDocument,
})

/**
 * Common mongoose schema options to spread into every model, e.g.
 * `new mongoose.Schema({ ... }, mongooseSchemaOptions)`. Adds timestamps,
 * strict field/query enforcement, optimistic concurrency control, and
 * consistent client-facing serialization via serializationOptions.
 */
const mongooseSchemaOptions = Object.freeze({
    timestamps: true,
    strict: true,
    strictQuery: true,
    minimize: false,
    id: false,
    optimisticConcurrency: true,
    toJSON: serializationOptions,
    toObject: serializationOptions,
})

export { mongooseSchemaOptions, transformDocument };
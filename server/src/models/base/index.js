/**
 * Barrel for shared model-building blocks: the schema factory, audit
 * fields, shared serialization/consistency options, and the soft-delete/
 * restore/pagination helpers it wires onto every schema.
 */
export { createSchema } from "./mongoose.schema.js";
export { auditFields } from "./auditFields.js";
export { mongooseSchemaOptions, transformDocument } from "./mongoose.schema.options.js";
export {
    restoreDocument,
    softDeleteDocument,
    paginateCollection
} from "./helper/index.js";

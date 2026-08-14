import mongoose from "mongoose";
import { auditFields } from "./auditFields.js";

import { mongooseSchemaOptions } from "./mongoose.schema.options.js";
import {
    softDeleteDocument,
    restoreDocument,
    paginateCollection
} from "./helper/index.js";

/**
 * Builds a mongoose Schema pre-wired with audit fields, the shared
 * serialization/consistency options, and soft-delete/restore/pagination
 * instance and static methods, so individual models don't have to
 * assemble that boilerplate themselves.
 * @param {object} schemaDefinition - The model's own field definitions.
 * @param {object} [options] - Extra schema options, merged over mongooseSchemaOptions.
 * @returns {import("mongoose").Schema}
 */
const createSchema = (schemaDefinition, options = {}) => {
    const schema = new mongoose.Schema(
        {
            ...schemaDefinition,
            ...auditFields
        },
        {
            ...mongooseSchemaOptions,
            ...options
        }
    )

    /**
     * Instance method: soft-deletes this document.
     * @see softDeleteDocument
     * @param {object} [options]
     * @param {string|import("mongoose").Types.ObjectId} [options.deletedByUserId] - User performing the deletion.
     * @param {string} [options.reason] - Optional justification for the deletion.
     * @param {import("mongoose").ClientSession} [options.session] - Transaction session, if any.
     * @returns {Promise<import("mongoose").Document>}
     */
    schema.methods.softDelete = function({
        deletedByUserId,
        reason,
        session
    } = {}){
        return softDeleteDocument({document: this, deletedByUserId, reason, session});
    }

    /**
     * Instance method: restores this soft-deleted document.
     * @see restoreDocument
     * @param {object} [options]
     * @param {string|import("mongoose").Types.ObjectId} [options.restoreUserId] - User performing the restore.
     * @param {string} [options.reason] - Optional justification for the restore.
     * @param {import("mongoose").ClientSession} [options.session] - Transaction session, if any.
     * @returns {Promise<import("mongoose").Document>}
     */
    schema.methods.restore = function ({ restoreUserId, reason, session = null } = {}) {
        return restoreDocument({ document: this, restoreUserId, reason, session });
    };

    /**
     * Static method: paginates this model's collection.
     * @see paginateCollection
     * @param {object} [params] - Same options as paginateCollection, minus `model`.
     * @returns {Promise<object>}
     */
    schema.statics.paginate = function (params = {}) {
        return paginateCollection({ model: this, ...params });
    };
    
    return schema;
}

export { createSchema }
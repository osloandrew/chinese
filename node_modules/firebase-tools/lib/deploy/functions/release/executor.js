"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InlineExecutor = exports.QueueExecutor = exports.isCloudRunResourceExhausted = exports.isServiceAccount404 = exports.isTransientError = exports.isServiceUnavailable = exports.isConflict = exports.isQuotaExhaustion = void 0;
exports.parseErrorCode = parseErrorCode;
exports.hasErrorCode = hasErrorCode;
const queue_1 = require("../../../throttler/queue");
function parseErrorCode(err) {
    return (err.status ||
        err.code ||
        err.context?.response?.statusCode ||
        err.original?.code ||
        err.original?.context?.response?.statusCode);
}
function hasErrorCode(...codes) {
    return (err) => codes.includes(parseErrorCode(err));
}
const isQuotaExhaustion = (err) => parseErrorCode(err) === 429;
exports.isQuotaExhaustion = isQuotaExhaustion;
const isConflict = (err) => parseErrorCode(err) === 409;
exports.isConflict = isConflict;
const isServiceUnavailable = (err) => parseErrorCode(err) === 503;
exports.isServiceUnavailable = isServiceUnavailable;
const isTransientError = (err) => (0, exports.isQuotaExhaustion)(err) || (0, exports.isConflict)(err) || (0, exports.isServiceUnavailable)(err);
exports.isTransientError = isTransientError;
const isServiceAccount404 = (err) => {
    if (parseErrorCode(err) !== 404) {
        return false;
    }
    let message = "";
    try {
        message = [
            err?.message,
            err?.original?.message,
            err?.context?.body?.error?.message,
            String(err),
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
    }
    catch {
        message = String(err).toLowerCase();
    }
    return (message.includes("serviceaccount") ||
        message.includes("service account") ||
        /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.gserviceaccount\.com\b/i.test(message) ||
        /\bgserviceaccount\.com\b/i.test(message));
};
exports.isServiceAccount404 = isServiceAccount404;
const isCloudRunResourceExhausted = (err) => parseErrorCode(err) === 8;
exports.isCloudRunResourceExhausted = isCloudRunResourceExhausted;
async function handler(op) {
    try {
        op.result = await op.func();
    }
    catch (err) {
        const shouldRetry = op.retryPredicates.some((predicate) => predicate(err));
        if (shouldRetry) {
            throw err;
        }
        err.code = parseErrorCode(err);
        op.error = err;
    }
    return;
}
class QueueExecutor {
    constructor(options) {
        const { defaultRetryPredicates, ...throttlerOptions } = options;
        this.defaultRetryPredicates = defaultRetryPredicates || [exports.isTransientError];
        this.queue = new queue_1.Queue({ ...throttlerOptions, handler });
    }
    async run(func, opts) {
        const retryPredicates = opts?.retryPredicates
            ? [...opts.retryPredicates]
            : [...this.defaultRetryPredicates];
        const op = {
            func,
            retryPredicates,
        };
        await this.queue.run(op);
        if (op.error) {
            throw op.error;
        }
        return op.result;
    }
}
exports.QueueExecutor = QueueExecutor;
class InlineExecutor {
    run(func) {
        return func();
    }
}
exports.InlineExecutor = InlineExecutor;

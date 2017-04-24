"use strict";
/**
 * ベンチマークミドルウェア
 *
 * @module benchmarksMiddleware
 */
Object.defineProperty(exports, "__esModule", { value: true });
const log4js = require("log4js");
// tslint:disable-next-line:variable-name
exports.default = (req, _, next) => {
    if (process.env.NODE_ENV === 'development') {
        const startMemory = process.memoryUsage();
        const startTime = process.hrtime();
        const logger = log4js.getLogger('system');
        req.on('end', () => {
            const endMemory = process.memoryUsage();
            const memoryUsage = endMemory.rss - startMemory.rss;
            const diff = process.hrtime(startTime);
            logger.debug('process.pid: %s benchmark: took %s seconds and %s nanoseconds. memoryUsage:%s (%s - %s)', process.pid, diff[0], diff[1], memoryUsage, startMemory.rss, endMemory.rss);
        });
    }
    next();
};

/**
 * ベンチマークミドルウェア
 *
 * @module middleware/benchmarks
 */

import * as createDebug from 'debug';
import { NextFunction, Request, Response } from 'express';

const debug = createDebug('ttts-authentication:middlewares:benchmarks');

export default (req: Request, __: Response, next: NextFunction) => {
    if (process.env.NODE_ENV === 'development') {
        const startMemory = process.memoryUsage();
        const startTime = process.hrtime();

        req.on('end', () => {
            const endMemory = process.memoryUsage();
            const memoryUsage = endMemory.rss - startMemory.rss;
            const diff = process.hrtime(startTime);
            debug(
                'process.pid: %s benchmark: took %s seconds and %s nanoseconds. memoryUsage:%s (%s - %s)',
                process.pid, diff[0], diff[1], memoryUsage, startMemory.rss, endMemory.rss
            );
        });
    }

    next();
};

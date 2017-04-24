/**
 * @namespace error
 */
import { Request, Response } from 'express';
import { INTERNAL_SERVER_ERROR, NOT_FOUND } from 'http-status';

/**
 * Not Found
 * @memberof error
 * @function notFound
 * @param {Request} req
 * @param {Response} res
 * @returns {void}
 */
export function notFound(req: Request, res: Response): void {
    if (req.xhr) {
        res.status(NOT_FOUND).send({ error: 'Not Found.' });
        return;
    } else {
        res.status(NOT_FOUND);
        res.render('error/notFound');
        return;
    }
}

/**
 * エラーページ
 * @memberof error
 * @function index
 * @param {Request} req
 * @param {Response} res
 * @returns {void}
 */
export function index(err: Error, req: Request, res: Response): void {
    req.route.path = '/error/error';
    if (req.xhr) {
        res.status(INTERNAL_SERVER_ERROR).json({
            success: false,
            message: err.message
        });
        return;
    } else {
        res.status(INTERNAL_SERVER_ERROR);
        res.render('error/error', {
            message: err.message,
            error: err
        });
        return;
    }
}

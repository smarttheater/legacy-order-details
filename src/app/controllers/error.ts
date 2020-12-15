/**
 * エラーモジュール
 */
import { Request, Response } from 'express';
import { INTERNAL_SERVER_ERROR, NOT_FOUND } from 'http-status';

/**
 * 404エラー
 */
export function notFound(req: Request, res: Response): void {
    if (req.xhr) {
        res.status(NOT_FOUND).send({ error: 'Not Found.' });
    } else {
        res.status(NOT_FOUND);
        res.render('error/notFound', { layout: 'layouts/inquiry/layout' });
    }
}

/**
 * エラーページ
 */
export function index(err: Error, req: Request, res: Response): void {
    req.route.path = '/error/error';
    if (req.xhr) {
        res.status(INTERNAL_SERVER_ERROR).json({
            success: false,
            message: err.message
        });
    } else {
        res.status(INTERNAL_SERVER_ERROR);
        res.render('error/error', {
            layout: 'layouts/inquiry/layout',
            message: err.message,
            error: err
        });
    }
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.index = exports.notFound = void 0;
const http_status_1 = require("http-status");
/**
 * 404エラー
 */
function notFound(req, res) {
    if (req.xhr) {
        res.status(http_status_1.NOT_FOUND).send({ error: 'Not Found.' });
    }
    else {
        res.status(http_status_1.NOT_FOUND);
        res.render('error/notFound', { layout: 'layouts/inquiry/layout' });
    }
}
exports.notFound = notFound;
/**
 * エラーページ
 */
function index(err, req, res) {
    req.route.path = '/error/error';
    if (req.xhr) {
        res.status(http_status_1.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: err.message
        });
    }
    else {
        res.status(http_status_1.INTERNAL_SERVER_ERROR);
        res.render('error/error', {
            layout: 'layouts/inquiry/layout',
            message: err.message,
            error: err
        });
    }
}
exports.index = index;

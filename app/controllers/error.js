"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const http_status_1 = require("http-status");
/**
 * Not Found
 * @memberof error
 * @function notFound
 * @param {Request} req
 * @param {Response} res
 * @returns {void}
 */
function notFound(req, res) {
    if (req.xhr) {
        res.status(http_status_1.NOT_FOUND).send({ error: 'Not Found.' });
    }
    else {
        res.status(http_status_1.NOT_FOUND);
        res.render('error/notFound');
    }
}
exports.notFound = notFound;
/**
 * エラーページ
 * @memberof error
 * @function index
 * @param {Request} req
 * @param {Response} res
 * @returns {void}
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
            message: err.message,
            error: err
        });
    }
}
exports.index = index;

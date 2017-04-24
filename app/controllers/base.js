"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const moment = require("moment");
/**
 * @memberof BaseController
 * @function setLocals
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 * @returns {void}
 */
function setLocals(req, res, next) {
    res.locals.req = req;
    res.locals.moment = moment;
    res.locals.validation = null;
    res.locals.officialWebsiteUrl = 'https://motionpicture.jp';
    res.locals.title = 'CHEVRE checkin';
    res.locals.description = 'CHEVRE checkin';
    res.locals.keywords = 'CHEVRE checkin';
    next();
}
exports.setLocals = setLocals;

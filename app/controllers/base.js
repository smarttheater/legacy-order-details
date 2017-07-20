"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const conf = require("config");
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
    res.locals.conf = conf;
    res.locals.moment = moment;
    res.locals.validation = null;
    res.locals.officialWebsiteUrl = 'https://motionpicture.jp';
    res.locals.title = 'TTTS checkin';
    res.locals.description = 'TTTS checkin';
    res.locals.keywords = 'TTTS checkin';
    next();
}
exports.setLocals = setLocals;

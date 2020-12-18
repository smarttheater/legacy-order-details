"use strict";
/**
 * テンプレート変数をセットする
 *
 * @module middleware/setLocal
 */
Object.defineProperty(exports, "__esModule", { value: true });
const conf = require("config");
const moment = require("moment-timezone");
exports.default = (req, res, next) => {
    var _a, _b, _c;
    // セッションで言語管理
    if (typeof ((_a = req.session) === null || _a === void 0 ? void 0 : _a.locale) === 'string' && req.session.locale.length > 0) {
        req.setLocale(req.session.locale);
    }
    if (typeof ((_b = req.query) === null || _b === void 0 ? void 0 : _b.locale) === 'string' && req.query.locale.length > 0) {
        req.setLocale(req.query.locale);
        req.session.locale = req.query.locale;
    }
    // add 2017/06/20 set default locale
    if (typeof ((_c = req.session) === null || _c === void 0 ? void 0 : _c.locale) !== 'string' || req.session.locale.length === 0) {
        req.session.locale = 'ja';
    }
    let momentLocale = (typeof req.getLocale() === 'string') ? req.getLocale() : '';
    if (momentLocale === 'zh-hans') {
        momentLocale = 'zh-cn';
    }
    else if (momentLocale === 'zh-hant') {
        momentLocale = 'zh-tw';
    }
    if (momentLocale !== '') {
        moment.locale(momentLocale);
    }
    res.locals.req = req;
    res.locals.conf = conf;
    res.locals.moment = moment;
    res.locals.validation = null;
    res.locals.officialWebsiteUrl = '';
    res.locals.title = 'Order Details';
    res.locals.pageId = '';
    res.locals.pageClassName = '';
    next();
};

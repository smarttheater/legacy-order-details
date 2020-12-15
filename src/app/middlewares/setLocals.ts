/**
 * テンプレート変数をセットする
 *
 * @module middleware/setLocal
 */

import * as conf from 'config';
import { NextFunction, Request, Response } from 'express';
import * as moment from 'moment-timezone';

export default (req: Request, res: Response, next: NextFunction) => {
    // セッションで言語管理
    if (typeof req.session?.locale === 'string' && req.session.locale.length > 0) {
        req.setLocale(req.session.locale);
    }

    if (typeof req.query?.locale === 'string' && req.query.locale.length > 0) {
        req.setLocale(req.query.locale);
        (<any>req.session).locale = req.query.locale;
    }

    // add 2017/06/20 set default locale
    if (typeof req.session?.locale !== 'string' || req.session.locale.length === 0) {
        (<any>req.session).locale = 'ja';
    }

    let momentLocale = (typeof req.getLocale() === 'string') ? req.getLocale() : '';
    if (momentLocale === 'zh-hans') {
        momentLocale = 'zh-cn';
    } else if (momentLocale === 'zh-hant') {
        momentLocale = 'zh-tw';
    }
    if (momentLocale !== '') {
        moment.locale(momentLocale);
    }

    res.locals.req = req;
    res.locals.conf = conf;
    res.locals.moment = moment;
    res.locals.validation = null;
    res.locals.officialWebsiteUrl = 'https://motionpicture.jp';
    res.locals.title = 'TTTS checkin';
    res.locals.pageId = '';
    res.locals.pageClassName = '';

    next();
};

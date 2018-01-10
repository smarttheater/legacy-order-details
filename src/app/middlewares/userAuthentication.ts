/**
 * ユーザー認証ミドルウェア
 * @namespace middlewares.userAuthentication
 */

import * as createDebug from 'debug';
import { NextFunction, Request, Response } from 'express';

import CheckinAdminUser from '../models/user/checkinAdmin';

const debug = createDebug('ttts-authentication:middlewares:userAuthentication');

export default async (req: Request, res: Response, next: NextFunction) => {
    res.locals.req = req;
    req.checkinAdminUser = CheckinAdminUser.PARSE(req.session);
    debug('req.checkinAdminUser:', req.checkinAdminUser);

    // 既ログインの場合
    if (req.checkinAdminUser.isAuthenticated()) {
        next();

        return;
    }

    // 自動ログインチェック
    // いったん保留

    if (req.xhr) {
        res.json({
            success: false,
            message: 'login required'
        });
    } else {
        res.redirect(`/checkin/login?cb=${req.originalUrl}`);
    }
};

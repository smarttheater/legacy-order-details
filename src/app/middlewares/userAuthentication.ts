/**
 * ユーザー認証ミドルウェア
 * @namespace middlewares.userAuthentication
 */

import * as ttts from '@motionpicture/ttts-domain';
import * as createDebug from 'debug';
import { NextFunction, Request, Response } from 'express';

import CheckinAdminUser from '../models/user/checkinAdmin';

const debug = createDebug('ttts-backend:middlewares:userAuthentication');
// const cookieName = 'remember_checkin_admin';

export default async (req: Request, res: Response, next: NextFunction) => {
    res.locals.req = req;
    req.checkinAdminUser = CheckinAdminUser.PARSE(req.session);
    debug('req.checkinAdminUser:', req.checkinAdminUser);

    // 既ログインの場合
    if (req.checkinAdminUser.isAuthenticated()) {
        // ユーザーグループ名を取得
        const groups = await ttts.service.admin.getGroupsByUsername(
            <string>process.env.AWS_ACCESS_KEY_ID,
            <string>process.env.AWS_SECRET_ACCESS_KEY,
            <string>process.env.COGNITO_USER_POOL_ID,
            req.checkinAdminUser.username
        )();

        req.checkinAdminUser.group = groups[0];

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

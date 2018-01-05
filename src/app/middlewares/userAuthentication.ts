/**
 * ユーザー認証ミドルウェア
 * @namespace middlewares.userAuthentication
 */

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
        next();

        return;
    }

    // 自動ログインチェック
    // いったん保留
    // if (req.cookies[cookieName] !== undefined) {
    //     try {
    //         const authenticationDoc = await ttts.Models.Authentication.findOne(
    //             {
    //                 token: req.cookies[cookieName],
    //                 owner: { $ne: null }
    //             }
    //         ).exec();

    //         if (authenticationDoc === null) {
    //             res.clearCookie(cookieName);
    //         } else {
    //             // トークン再生成
    //             const token = ttts.CommonUtil.createToken();
    //             await authenticationDoc.update({ token: token }).exec();

    //             // tslint:disable-next-line:no-cookies
    //             res.cookie(cookieName, token, { path: '/', httpOnly: true, maxAge: 604800000 });
    //             const ownerRepo = new ttts.repository.Owner(ttts.mongoose.connection);
    //             const owner = await ownerRepo.ownerModel.findOne({ _id: authenticationDoc.get('owner') }).exec();

    //             // ログインしてリダイレクト
    //             if (owner !== null) {
    //                 (<Express.Session>req.session)[CheckInAdminUser.AUTH_SESSION_NAME] = owner.toObject();
    //             }
    //             res.redirect(req.originalUrl);

    //             return;
    //         }
    //     } catch (error) {
    //         console.error(error);
    //     }
    // }

    if (req.xhr) {
        res.json({
            success: false,
            message: 'login required'
        });
    } else {
        res.redirect(`/checkin/login?cb=${req.originalUrl}`);
    }
};

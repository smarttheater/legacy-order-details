/**
 * ユーザー認証ミドルウェア
 *
 * @module middlewares/userAuthentication
 */

import { CommonUtil, Models } from '@motionpicture/ttts-domain';
import * as createDebug from 'debug';
import { NextFunction, Request, Response } from 'express';

import * as Message from '../../common/Const/Message';
import CheckInAdminUser from '../models/user/checkinAdmin';

const debug = createDebug('ttts-backend:middlewares:userAuthentication');
const cookieName = 'remember_checkin_admin';

export default async (req: Request, res: Response, next: NextFunction) => {
    res.locals.req = req;
    req.staffUser = CheckInAdminUser.PARSE(req.session);
    debug('req.staffUser:', req.staffUser);

    if (req.staffUser === undefined) {
        next(new Error(Message.Common.unexpectedError));

        return;
    }

    // 既ログインの場合
    if (req.staffUser.isAuthenticated()) {
        next();

        return;
    }

    // 自動ログインチェック
    if (req.cookies[cookieName] !== undefined) {
        try {
            const authenticationDoc = await Models.Authentication.findOne(
                {
                    token: req.cookies[cookieName],
                    owner: { $ne: null }
                }
            ).exec();

            if (authenticationDoc === null) {
                res.clearCookie(cookieName);
            } else {
                // トークン再生成
                const token = CommonUtil.createToken();
                await authenticationDoc.update({ token: token }).exec();

                // tslint:disable-next-line:no-cookies
                res.cookie(cookieName, token, { path: '/', httpOnly: true, maxAge: 604800000 });
                const owner = await Models.Owner.findOne({ _id: authenticationDoc.get('owner') }).exec();

                // ログインしてリダイレクト
                if (owner !== null) {
                    (<Express.Session>req.session)[CheckInAdminUser.AUTH_SESSION_NAME] = owner.toObject();
                }
                res.redirect(req.originalUrl);

                return;
            }
        } catch (error) {
            console.error(error);
        }
    }

    if (req.xhr) {
        res.json({
            success: false,
            message: 'login required'
        });
    } else {
        res.redirect(`/checkin/login?cb=${req.originalUrl}`);
    }
};

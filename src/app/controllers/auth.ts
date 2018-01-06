/**
 * 入場認証コントローラー
 * @namespace controllers.auth
 */

import * as ttts from '@motionpicture/ttts-domain';
import * as createDebug from 'debug';
import { NextFunction, Request, Response } from 'express';
import * as _ from 'underscore';

import * as Message from '../../common/Const/Message';

const debug = createDebug('ttts-authentication:controllers:auth');
const checkInHome: string = '/checkin/confirm';
const cookieName = 'remember_checkin_admin';

/**
 * 入場管理ログイン
 */
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (req.checkinAdminUser !== undefined && req.checkinAdminUser.isAuthenticated()) {
        res.redirect(checkInHome);

        return;
    }

    // cognitoから入場ユーザーを検索
    const cognitoUsers: ttts.service.admin.IAdmin[] = [];
    try {
        cognitoUsers.push(...(await ttts.service.admin.findAllByGroup(
            <string>process.env.AWS_ACCESS_KEY_ID,
            <string>process.env.AWS_SECRET_ACCESS_KEY,
            <string>process.env.COGNITO_USER_POOL_ID,
            'DAITEN_AUTH'
        )()));
        cognitoUsers.push(...(await ttts.service.admin.findAllByGroup(
            <string>process.env.AWS_ACCESS_KEY_ID,
            <string>process.env.AWS_SECRET_ACCESS_KEY,
            <string>process.env.COGNITO_USER_POOL_ID,
            'TOPDECK_AUTH'
        )()));
    } catch (error) {
        console.error(error);
    }
    if (cognitoUsers.length <= 0) {
        next(new Error(Message.Common.unexpectedError));

        return;
    }

    let errors: any = {};
    if (req.method === 'POST') {
        // 検証
        validate(req);
        const validatorResult = await req.getValidationResult();
        errors = req.validationErrors(true);
        if (validatorResult.isEmpty()) {
            try {
                // ログイン情報が有効であれば、Cognitoでもログイン
                (<Express.Session>req.session).cognitoCredentials =
                    await ttts.service.admin.login(
                        <string>process.env.AWS_ACCESS_KEY_ID,
                        <string>process.env.AWS_SECRET_ACCESS_KEY,
                        <string>process.env.API_OAUTH2_CLIENT_ID,
                        <string>process.env.API_OAUTH2_CLIENT_SECRET,
                        <string>process.env.COGNITO_USER_POOL_ID,
                        req.body.username,
                        req.body.password
                    )();
                debug('cognito credentials published.', (<Express.Session>req.session).cognitoCredentials);
            } catch (error) {
                errors = { username: { msg: 'IDもしくはパスワードの入力に誤りがあります' } };
            }

            const cognitoCredentials = (<Express.Session>req.session).cognitoCredentials;
            if (cognitoCredentials !== undefined) {
                const cognitoUser = await ttts.service.admin.getUserByAccessToken(cognitoCredentials.accessToken)();

                // ログイン記憶
                // いったん保留
                // if (req.body.remember === 'on') {
                //     res.cookie(
                //         'remember_staff',
                //         authentication.get('token'),
                //         { path: '/', httpOnly: true, maxAge: 604800000 }
                //     );
                // }

                // ログイン
                (<Express.Session>req.session).checkinAdminUser = cognitoUser;

                // 入場確認へ
                const cb = (!_.isEmpty(req.query.cb)) ? req.query.cb : checkInHome;
                res.redirect(cb);

                return;
            }
        }
    }

    // ログイン画面遷移
    res.render('checkin/login', {
        displayId: 'Aa-1',
        title: '入場管理ログイン',
        errors: errors,
        cognitoUsers: cognitoUsers,
        layout: 'layouts/checkIn/layout'
    });
}

function validate(req: Request): void {
    req.checkBody('username', Message.Common.required.replace('$fieldName$', 'ID')).notEmpty();
    req.checkBody('password', Message.Common.required.replace('$fieldName$', 'パスワード')).notEmpty();
}

/**
 * マスタ管理ログアウト
 */
export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (req.session === undefined) {
        next(new Error(Message.Common.unexpectedError));

        return;
    }

    delete req.session.checkinAdminUser;
    // await ttts.Models.Authentication.remove({ token: req.cookies[cookieName] }).exec();

    res.clearCookie(cookieName);
    res.redirect('/checkin/login');
}

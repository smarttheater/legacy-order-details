/**
 * 入場認証コントローラー
 * @namespace controllers.auth
 */

import * as tttsapi from '@motionpicture/ttts-api-nodejs-client';
import * as createDebug from 'debug';
import { NextFunction, Request, Response } from 'express';
import * as request from 'request-promise-native';
import * as _ from 'underscore';

import * as Message from '../../common/Const/Message';

const debug = createDebug('ttts-authentication:controllers:auth');
const checkInHome: string = '/checkin/confirm';
const cookieName = 'remember_checkin_admin';

/**
 * 入場管理ログイン
 */
// tslint:disable-next-line:max-func-body-length
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        if (req.checkinAdminUser !== undefined && req.checkinAdminUser.isAuthenticated()) {
            res.redirect(checkInHome);

            return;
        }

        // cognitoから入場ユーザーを検索
        const cognitoUsers = [
            { username: '1F-ELEVATOR', name: 'フットタウン 1F' },
            { username: 'TOPDECK-ELEVATOR', name: 'TOP DECK エレベータ' }
        ];
        if (cognitoUsers.length <= 0) {
            next(new Error(Message.Common.unexpectedError));

            return;
        }

        let errors: any = {};
        if (req.method === 'POST') {
            // 検証
            validate(req);
            const validatorResult = await req.getValidationResult();
            errors = validatorResult.mapped();
            if (validatorResult.isEmpty()) {
                try {
                    // ログイン情報が有効であれば、Cognitoでもログイン
                    (<Express.Session>req.session).cognitoCredentials = await request.post(
                        `${process.env.API_ENDPOINT}/oauth/token`,
                        {
                            auth: {
                                user: <string>process.env.ADMIN_API_CLIENT_ID,
                                pass: <string>process.env.ADMIN_API_CLIENT_SECRET
                            },
                            json: true,
                            body: {
                                username: req.body.username,
                                password: req.body.password
                            }
                        }
                    ).then((body) => body);
                    debug('cognito credentials published.', (<Express.Session>req.session).cognitoCredentials);
                } catch (error) {
                    errors = { username: { msg: 'IDもしくはパスワードの入力に誤りがあります' } };
                }

                const cognitoCredentials = (<Express.Session>req.session).cognitoCredentials;
                if (cognitoCredentials !== undefined) {
                    try {
                        const authClient = new tttsapi.auth.OAuth2({
                            domain: <string>process.env.ADMIN_API_AUTHORIZE_SERVER_DOMAIN,
                            clientId: <string>process.env.ADMIN_API_CLIENT_ID,
                            clientSecret: <string>process.env.ADMIN_API_CLIENT_SECRET
                        });
                        authClient.setCredentials({
                            refresh_token: cognitoCredentials.refreshToken,
                            // expiry_date: number;
                            access_token: cognitoCredentials.accessToken,
                            token_type: cognitoCredentials.tokenType
                        });
                        const adminService = new tttsapi.service.Admin({
                            endpoint: <string>process.env.API_ENDPOINT,
                            auth: authClient
                        });
                        const cognitoUser = await adminService.getProfile();
                        const groups = await adminService.getGroups();
                        debug('groups:', groups);

                        // ログイン
                        (<Express.Session>req.session).checkinAdminUser = {
                            ...cognitoUser,
                            group: groups[0]
                        };

                        // 入場確認へ
                        const cb = (!_.isEmpty(req.query.cb)) ? req.query.cb : checkInHome;
                        res.redirect(cb);

                        return;
                    } catch (error) {
                        errors = { username: { msg: error.message } };
                    }
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
    } catch (error) {
        next(error);
    }
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
    delete req.session.cognitoCredentials;

    res.clearCookie(cookieName);
    res.redirect('/checkin/login');
}

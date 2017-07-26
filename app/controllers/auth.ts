/**
 * マスタ管理者認証コントローラー
 *
 * @namespace controller/auth
 */

import * as TTTS from '@motionpicture/ttts-domain';
import { NextFunction, Request, Response } from 'express';
import * as _ from 'underscore';

import * as Message from '../../common/Const/Message';
import CheckInAdminUser from '../models/user/checkinAdmin';

const checkInHome: string = '/checkin/confirm';
const cookieName = 'remember_checkin_admin';

/**
 * マスタ管理ログイン
 */
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (req.staffUser !== undefined && req.staffUser.isAuthenticated()) {
        res.redirect(checkInHome);
        return;
    }

    const owners: any[] = await TTTS.Models.Owner.find().exec();
    if (!owners) {
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
            // ユーザー認証
            // const owner = await TTTS.Models.Owner.findOne(
            //     {
            //         username: req.body.username
            //     }
            // ).exec();
            const owner: any = owners.filter((owner: any) => {
                return (owner.name.ja === req.body.username);
            })[0];

            if (owner === null) {
                errors = { username: { msg: 'IDもしくはパスワードの入力に誤りがあります' } };
            } else {
                // パスワードチェック
                if (owner.get('password_hash') !== TTTS.CommonUtil.createHash(req.body.password, owner.get('password_salt'))) {
                    errors = { username: { msg: 'IDもしくはパスワードの入力に誤りがあります' } };
                } else {
                    // ログイン記憶
                    if (req.body.remember === 'on') {
                        // トークン生成
                        const authentication = await TTTS.Models.Authentication.create(
                            {
                                token: TTTS.CommonUtil.createToken(),
                                owner: owner.get('_id'),
                                signature: req.body.signature
                            }
                        );

                        // tslint:disable-next-line:no-cookies
                        res.cookie(
                            cookieName,
                            authentication.get('token'),
                            { path: '/', httpOnly: true, maxAge: 604800000 }
                        );
                    }

                    (<Express.Session>req.session)[CheckInAdminUser.AUTH_SESSION_NAME] = owner.toObject();
                    (<Express.Session>req.session)[CheckInAdminUser.AUTH_SESSION_NAME].signature = req.body.signature;
                    // 入場確認へ
                    const cb = (!_.isEmpty(req.query.cb)) ? req.query.cb : checkInHome;
                    res.redirect(cb);

                    return;
                }
            }
        }
    }

    // ログイン画面遷移
    res.render('checkin/login', {
        displayId: 'Aa-1',
        title: '入場管理ログイン',
        errors: errors,
        usernames: owners.map((owner) => { return owner.name.ja; }),
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

    delete req.session[CheckInAdminUser.AUTH_SESSION_NAME];
    await TTTS.Models.Authentication.remove({ token: req.cookies[cookieName] }).exec();

    res.clearCookie(cookieName);
    res.redirect('/checkin/login');
}

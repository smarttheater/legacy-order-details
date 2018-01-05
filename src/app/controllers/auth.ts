/**
 * マスタ管理者認証コントローラー
 *
 * @namespace controller/auth
 */

import * as ttts from '@motionpicture/ttts-domain';
import * as AWS from 'aws-sdk';
import * as createDebug from 'debug';
import { NextFunction, Request, Response } from 'express';
import * as _ from 'underscore';

import * as Message from '../../common/Const/Message';
import CheckInAdminUser from '../models/user/checkinAdmin';

const debug = createDebug('ttts-authentication:controllers:auth');
const checkInHome: string = '/checkin/confirm';
const cookieName = 'remember_checkin_admin';

/**
 * 入場管理ログイン
 */
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (req.staffUser !== undefined && req.staffUser.isAuthenticated()) {
        res.redirect(checkInHome);

        return;
    }

    // cognitoから入場ユーザーを検索
    let cognitoUsers: AWS.CognitoIdentityServiceProvider.UsersListType = [];
    try {
        cognitoUsers.push(...(await getCognitoUsers('DAITEN_AUTH')));
        cognitoUsers.push(...(await getCognitoUsers('TOPDECK_AUTH')));
    } catch (error) {
        console.error(error);
    }
    cognitoUsers = cognitoUsers.filter((u) => u.UserStatus === 'CONFIRMED');
    debug('cognitoUsers:', cognitoUsers);

    // ユーザー認証(notesフィールドが、入場認証に使えるユーザーのフラグ)
    const ownerRepo = new ttts.repository.Owner(ttts.mongoose.connection);
    const owners = await ownerRepo.ownerModel.find({ notes: '1' }).exec();
    debug('number of owners:', owners.length);
    if (owners.length === undefined || owners.length <= 0) {
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
            const signedOwner = owners.find((owner) => (owner.get('username') === req.body.username));

            if (signedOwner === undefined) {
                errors = { username: { msg: 'IDもしくはパスワードの入力に誤りがあります' } };
            } else {
                // パスワードチェック
                if (signedOwner.get('password_hash') !== ttts.CommonUtil.createHash(req.body.password, signedOwner.get('password_salt'))) {
                    errors = { username: { msg: 'IDもしくはパスワードの入力に誤りがあります' } };
                } else {
                    // ログイン記憶
                    if (req.body.remember === 'on') {
                        // トークン生成
                        const authentication = await ttts.Models.Authentication.create(
                            {
                                token: ttts.CommonUtil.createToken(),
                                owner: signedOwner.get('id'),
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

                    (<Express.Session>req.session)[CheckInAdminUser.AUTH_SESSION_NAME] = signedOwner.toObject();
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
        cognitoUsers: cognitoUsers,
        usernames: owners.map((owner) => {
            return { id: owner.get('username'), name: owner.get('name') };
        }),
        layout: 'layouts/checkIn/layout'
    });
}

function validate(req: Request): void {
    req.checkBody('username', Message.Common.required.replace('$fieldName$', 'ID')).notEmpty();
    req.checkBody('password', Message.Common.required.replace('$fieldName$', 'パスワード')).notEmpty();
}

async function getCognitoUsers(groupName: string) {
    return new Promise<AWS.CognitoIdentityServiceProvider.UsersListType>((resolve, reject) => {
        const cognitoIdentityServiceProvider = new AWS.CognitoIdentityServiceProvider({
            apiVersion: 'latest',
            region: 'ap-northeast-1',
            accessKeyId: <string>process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: <string>process.env.AWS_SECRET_ACCESS_KEY
        });

        cognitoIdentityServiceProvider.listUsersInGroup(
            {
                GroupName: groupName,
                UserPoolId: <string>process.env.COGNITO_USER_POOL_ID
            },
            (err, data) => {
                debug('listUsersInGroup result:', err, data);
                if (err instanceof Error) {
                    reject(err);
                } else {
                    if (data.Users === undefined) {
                        reject(new Error('Unexpected.'));
                    } else {
                        resolve(data.Users);
                    }
                }
            });
    });
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
    await ttts.Models.Authentication.remove({ token: req.cookies[cookieName] }).exec();

    res.clearCookie(cookieName);
    res.redirect('/checkin/login');
}

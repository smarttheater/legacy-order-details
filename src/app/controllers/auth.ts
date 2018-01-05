/**
 * 入場認証コントローラー
 * @namespace controllers.auth
 */

import * as ttts from '@motionpicture/ttts-domain';
import * as AWS from 'aws-sdk';
import * as crypto from 'crypto';
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
    let cognitoUsers: AWS.CognitoIdentityServiceProvider.UsersListType = [];
    try {
        cognitoUsers.push(...(await getCognitoUsers('DAITEN_AUTH')));
        cognitoUsers.push(...(await getCognitoUsers('TOPDECK_AUTH')));
    } catch (error) {
        console.error(error);
    }
    cognitoUsers = cognitoUsers.filter((u) => u.UserStatus === 'CONFIRMED');
    debug('cognitoUsers:', cognitoUsers);
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
                    await getCognitoCredentials(req.body.username, req.body.password);
                debug('cognito credentials published.', (<Express.Session>req.session).cognitoCredentials);
            } catch (error) {
                errors = { username: { msg: 'IDもしくはパスワードの入力に誤りがあります' } };
            }

            const cognitoCredentials = (<Express.Session>req.session).cognitoCredentials;
            if (cognitoCredentials !== undefined) {
                const cognitoUser = await getCognitoUser(<string>cognitoCredentials.AccessToken);

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

async function getCognitoUser(accesssToken: string) {
    return new Promise<Express.ICheckinAdminUser>((resolve, reject) => {
        const cognitoIdentityServiceProvider = new AWS.CognitoIdentityServiceProvider({
            apiVersion: 'latest',
            region: 'ap-northeast-1'
        });

        type CognitoUserAttributeType = AWS.CognitoIdentityServiceProvider.AttributeType;

        cognitoIdentityServiceProvider.getUser(
            {
                AccessToken: accesssToken
            },
            (err, data) => {
                if (err instanceof Error) {
                    reject(err);
                } else {
                    cognitoIdentityServiceProvider.adminListGroupsForUser(
                        {
                            Username: data.Username,
                            UserPoolId: <string>process.env.COGNITO_USER_POOL_ID
                        },
                        (err2, data2) => {
                            if (err2 instanceof Error) {
                                reject(err);
                            } else {
                                if (!Array.isArray(data2.Groups)) {
                                    reject(new Error('Unexpected.'));
                                } else {
                                    resolve({
                                        group: <string>data2.Groups[0].GroupName,
                                        username: data.Username,
                                        // tslint:disable-next-line:max-line-length
                                        familyName: <string>(<CognitoUserAttributeType>data.UserAttributes.find((a) => a.Name === 'family_name')).Value,
                                        // tslint:disable-next-line:max-line-length
                                        givenName: <string>(<CognitoUserAttributeType>data.UserAttributes.find((a) => a.Name === 'given_name')).Value,
                                        // tslint:disable-next-line:max-line-length
                                        email: <string>(<CognitoUserAttributeType>data.UserAttributes.find((a) => a.Name === 'email')).Value,
                                        // tslint:disable-next-line:max-line-length
                                        telephone: <string>(<CognitoUserAttributeType>data.UserAttributes.find((a) => a.Name === 'phone_number')).Value
                                    });

                                }
                            }
                        }
                    );
                }
            });
    });
}

/**
 * Cognito認証情報を取得する
 * @param {string} username ユーザーネーム
 * @param {string} password パスワード
 */
async function getCognitoCredentials(username: string, password: string) {
    return new Promise<AWS.CognitoIdentityServiceProvider.AuthenticationResultType>((resolve, reject) => {
        const cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider({
            region: 'ap-northeast-1',
            accessKeyId: <string>process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: <string>process.env.AWS_SECRET_ACCESS_KEY
        });
        const hash = crypto.createHmac('sha256', <string>process.env.API_OAUTH2_CLIENT_SECRET)
            .update(`${username}${<string>process.env.API_OAUTH2_CLIENT_ID}`)
            .digest('base64');
        const params = {
            UserPoolId: <string>process.env.COGNITO_USER_POOL_ID,
            ClientId: <string>process.env.API_OAUTH2_CLIENT_ID,
            AuthFlow: 'ADMIN_NO_SRP_AUTH',
            AuthParameters: {
                USERNAME: username,
                SECRET_HASH: hash,
                PASSWORD: password
            }
            // ClientMetadata?: ClientMetadataType;
            // AnalyticsMetadata?: AnalyticsMetadataType;
            // ContextData?: ContextDataType;
        };

        cognitoidentityserviceprovider.adminInitiateAuth(params, (err, data) => {
            debug('adminInitiateAuth result:', err, data);
            if (err instanceof Error) {
                reject(err);
            } else {
                if (data.AuthenticationResult === undefined) {
                    reject(new Error('Unexpected.'));
                } else {
                    resolve(data.AuthenticationResult);
                }
            }
        });
    });
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

    delete req.session.checkinAdminUser;
    await ttts.Models.Authentication.remove({ token: req.cookies[cookieName] }).exec();

    res.clearCookie(cookieName);
    res.redirect('/checkin/login');
}

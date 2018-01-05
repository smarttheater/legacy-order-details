"use strict";
/**
 * 入場認証コントローラー
 * @namespace controllers.auth
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const ttts = require("@motionpicture/ttts-domain");
const AWS = require("aws-sdk");
const crypto = require("crypto");
const createDebug = require("debug");
const _ = require("underscore");
const Message = require("../../common/Const/Message");
const debug = createDebug('ttts-authentication:controllers:auth');
const checkInHome = '/checkin/confirm';
const cookieName = 'remember_checkin_admin';
/**
 * 入場管理ログイン
 */
function login(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (req.checkinAdminUser !== undefined && req.checkinAdminUser.isAuthenticated()) {
            res.redirect(checkInHome);
            return;
        }
        // cognitoから入場ユーザーを検索
        let cognitoUsers = [];
        try {
            cognitoUsers.push(...(yield getCognitoUsers('DAITEN_AUTH')));
            cognitoUsers.push(...(yield getCognitoUsers('TOPDECK_AUTH')));
        }
        catch (error) {
            console.error(error);
        }
        cognitoUsers = cognitoUsers.filter((u) => u.UserStatus === 'CONFIRMED');
        debug('cognitoUsers:', cognitoUsers);
        if (cognitoUsers.length <= 0) {
            next(new Error(Message.Common.unexpectedError));
            return;
        }
        let errors = {};
        if (req.method === 'POST') {
            // 検証
            validate(req);
            const validatorResult = yield req.getValidationResult();
            errors = req.validationErrors(true);
            if (validatorResult.isEmpty()) {
                try {
                    // ログイン情報が有効であれば、Cognitoでもログイン
                    req.session.cognitoCredentials =
                        yield getCognitoCredentials(req.body.username, req.body.password);
                    debug('cognito credentials published.', req.session.cognitoCredentials);
                }
                catch (error) {
                    errors = { username: { msg: 'IDもしくはパスワードの入力に誤りがあります' } };
                }
                const cognitoCredentials = req.session.cognitoCredentials;
                if (cognitoCredentials !== undefined) {
                    const cognitoUser = yield getCognitoUser(cognitoCredentials.AccessToken);
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
                    req.session.checkinAdminUser = cognitoUser;
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
    });
}
exports.login = login;
function validate(req) {
    req.checkBody('username', Message.Common.required.replace('$fieldName$', 'ID')).notEmpty();
    req.checkBody('password', Message.Common.required.replace('$fieldName$', 'パスワード')).notEmpty();
}
function getCognitoUser(accesssToken) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            const cognitoIdentityServiceProvider = new AWS.CognitoIdentityServiceProvider({
                apiVersion: 'latest',
                region: 'ap-northeast-1'
            });
            cognitoIdentityServiceProvider.getUser({
                AccessToken: accesssToken
            }, (err, data) => {
                if (err instanceof Error) {
                    reject(err);
                }
                else {
                    cognitoIdentityServiceProvider.adminListGroupsForUser({
                        Username: data.Username,
                        UserPoolId: process.env.COGNITO_USER_POOL_ID
                    }, (err2, data2) => {
                        if (err2 instanceof Error) {
                            reject(err);
                        }
                        else {
                            if (!Array.isArray(data2.Groups)) {
                                reject(new Error('Unexpected.'));
                            }
                            else {
                                resolve({
                                    group: data2.Groups[0].GroupName,
                                    username: data.Username,
                                    // tslint:disable-next-line:max-line-length
                                    familyName: data.UserAttributes.find((a) => a.Name === 'family_name').Value,
                                    // tslint:disable-next-line:max-line-length
                                    givenName: data.UserAttributes.find((a) => a.Name === 'given_name').Value,
                                    // tslint:disable-next-line:max-line-length
                                    email: data.UserAttributes.find((a) => a.Name === 'email').Value,
                                    // tslint:disable-next-line:max-line-length
                                    telephone: data.UserAttributes.find((a) => a.Name === 'phone_number').Value
                                });
                            }
                        }
                    });
                }
            });
        });
    });
}
/**
 * Cognito認証情報を取得する
 * @param {string} username ユーザーネーム
 * @param {string} password パスワード
 */
function getCognitoCredentials(username, password) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            const cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider({
                region: 'ap-northeast-1',
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            });
            const hash = crypto.createHmac('sha256', process.env.API_OAUTH2_CLIENT_SECRET)
                .update(`${username}${process.env.API_OAUTH2_CLIENT_ID}`)
                .digest('base64');
            const params = {
                UserPoolId: process.env.COGNITO_USER_POOL_ID,
                ClientId: process.env.API_OAUTH2_CLIENT_ID,
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
                }
                else {
                    if (data.AuthenticationResult === undefined) {
                        reject(new Error('Unexpected.'));
                    }
                    else {
                        resolve(data.AuthenticationResult);
                    }
                }
            });
        });
    });
}
function getCognitoUsers(groupName) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            const cognitoIdentityServiceProvider = new AWS.CognitoIdentityServiceProvider({
                apiVersion: 'latest',
                region: 'ap-northeast-1',
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            });
            cognitoIdentityServiceProvider.listUsersInGroup({
                GroupName: groupName,
                UserPoolId: process.env.COGNITO_USER_POOL_ID
            }, (err, data) => {
                debug('listUsersInGroup result:', err, data);
                if (err instanceof Error) {
                    reject(err);
                }
                else {
                    if (data.Users === undefined) {
                        reject(new Error('Unexpected.'));
                    }
                    else {
                        resolve(data.Users);
                    }
                }
            });
        });
    });
}
/**
 * マスタ管理ログアウト
 */
function logout(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (req.session === undefined) {
            next(new Error(Message.Common.unexpectedError));
            return;
        }
        delete req.session.checkinAdminUser;
        yield ttts.Models.Authentication.remove({ token: req.cookies[cookieName] }).exec();
        res.clearCookie(cookieName);
        res.redirect('/checkin/login');
    });
}
exports.logout = logout;

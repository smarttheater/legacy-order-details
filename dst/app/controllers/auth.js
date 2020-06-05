"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 認証コントローラー
 */
const tttsapi = require("@motionpicture/ttts-api-nodejs-client");
const createDebug = require("debug");
const jwt = require("jsonwebtoken");
const request = require("request-promise-native");
const _ = require("underscore");
const Message = require("../../common/Const/Message");
const debug = createDebug('ttts-authentication:controllers:auth');
const checkInHome = '/checkin/confirm';
const cookieName = 'remember_checkin_admin';
/**
 * 入場管理ログイン
 */
// tslint:disable-next-line:max-func-body-length
function login(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (req.checkinAdminUser !== undefined && req.checkinAdminUser.isAuthenticated()) {
                res.redirect(checkInHome);
                return;
            }
            // cognitoから入場ユーザーを検索
            const cognitoUsers = [
                { username: 'LANE', name: 'トップデッキ レーン' },
                { username: 'GATE', name: 'トップデッキ ゲート' }
            ];
            if (cognitoUsers.length <= 0) {
                next(new Error(Message.Common.unexpectedError));
                return;
            }
            let errors = {};
            if (req.method === 'POST') {
                // 検証
                validate(req);
                const validatorResult = yield req.getValidationResult();
                errors = validatorResult.mapped();
                if (validatorResult.isEmpty()) {
                    try {
                        // ログイン情報が有効であれば、Cognitoでもログイン
                        req.session.cognitoCredentials = yield request.post(`${process.env.TTTS_AUTHORIZE_SERVER}/oauth/token`, {
                            auth: {
                                user: process.env.ADMIN_API_CLIENT_ID,
                                pass: process.env.ADMIN_API_CLIENT_SECRET
                            },
                            json: true,
                            body: {
                                username: req.body.username,
                                password: req.body.password
                            }
                        }).then((body) => body);
                        debug('cognito credentials published.', req.session.cognitoCredentials);
                    }
                    catch (error) {
                        errors = { username: { msg: 'IDもしくはパスワードの入力に誤りがあります' } };
                    }
                    const cognitoCredentials = req.session.cognitoCredentials;
                    if (cognitoCredentials !== undefined) {
                        try {
                            const authClient = new tttsapi.auth.OAuth2({
                                domain: process.env.ADMIN_API_AUTHORIZE_SERVER_DOMAIN,
                                clientId: process.env.ADMIN_API_CLIENT_ID,
                                clientSecret: process.env.ADMIN_API_CLIENT_SECRET
                            });
                            authClient.setCredentials({
                                refresh_token: cognitoCredentials.refreshToken,
                                // expiry_date: number;
                                access_token: cognitoCredentials.accessToken,
                                token_type: cognitoCredentials.tokenType
                            });
                            yield authClient.refreshAccessToken();
                            const profile = jwt.decode(authClient.credentials.id_token);
                            const group = (Array.isArray(profile['cognito:groups']) && profile['cognito:groups'].length > 0)
                                ? { name: profile['cognito:groups'][0], description: '' }
                                : { name: '', description: '' };
                            // ログイン
                            req.session.checkinAdminUser = {
                                username: profile['cognito:username'],
                                familyName: profile.family_name,
                                givenName: profile.given_name,
                                email: profile.email,
                                telephone: profile.phone_number,
                                group: group
                            };
                            // 入場確認へ
                            const cb = (!_.isEmpty(req.query.cb)) ? req.query.cb : checkInHome;
                            res.redirect(cb);
                            return;
                        }
                        catch (error) {
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
        }
        catch (error) {
            next(error);
        }
    });
}
exports.login = login;
function validate(req) {
    req.checkBody('username', Message.Common.required.replace('$fieldName$', 'ID')).notEmpty();
    req.checkBody('password', Message.Common.required.replace('$fieldName$', 'パスワード')).notEmpty();
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
        delete req.session.cognitoCredentials;
        res.clearCookie(cookieName);
        res.redirect('/checkin/login');
    });
}
exports.logout = logout;

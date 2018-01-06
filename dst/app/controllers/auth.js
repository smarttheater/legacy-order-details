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
        const cognitoUsers = [];
        try {
            cognitoUsers.push(...(yield ttts.service.admin.findAllByGroup(process.env.AWS_ACCESS_KEY_ID, process.env.AWS_SECRET_ACCESS_KEY, process.env.COGNITO_USER_POOL_ID, 'DAITEN_AUTH')()));
            cognitoUsers.push(...(yield ttts.service.admin.findAllByGroup(process.env.AWS_ACCESS_KEY_ID, process.env.AWS_SECRET_ACCESS_KEY, process.env.COGNITO_USER_POOL_ID, 'TOPDECK_AUTH')()));
        }
        catch (error) {
            console.error(error);
        }
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
                        yield ttts.service.admin.login(process.env.AWS_ACCESS_KEY_ID, process.env.AWS_SECRET_ACCESS_KEY, process.env.API_OAUTH2_CLIENT_ID, process.env.API_OAUTH2_CLIENT_SECRET, process.env.COGNITO_USER_POOL_ID, req.body.username, req.body.password)();
                    debug('cognito credentials published.', req.session.cognitoCredentials);
                }
                catch (error) {
                    errors = { username: { msg: 'IDもしくはパスワードの入力に誤りがあります' } };
                }
                const cognitoCredentials = req.session.cognitoCredentials;
                if (cognitoCredentials !== undefined) {
                    const cognitoUser = yield ttts.service.admin.getUserByAccessToken(cognitoCredentials.accessToken)();
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
        // await ttts.Models.Authentication.remove({ token: req.cookies[cookieName] }).exec();
        res.clearCookie(cookieName);
        res.redirect('/checkin/login');
    });
}
exports.logout = logout;

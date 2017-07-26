"use strict";
/**
 * マスタ管理者認証コントローラー
 *
 * @namespace controller/auth
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
const TTTS = require("@motionpicture/ttts-domain");
const _ = require("underscore");
const Message = require("../../common/Const/Message");
const checkinAdmin_1 = require("../models/user/checkinAdmin");
const checkInHome = '/checkin/confirm';
const cookieName = 'remember_checkin_admin';
/**
 * マスタ管理ログイン
 */
function login(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (req.staffUser !== undefined && req.staffUser.isAuthenticated()) {
            res.redirect(checkInHome);
            return;
        }
        const owners = yield TTTS.Models.Owner.find().exec();
        if (!owners) {
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
                // ユーザー認証
                // const owner = await TTTS.Models.Owner.findOne(
                //     {
                //         username: req.body.username
                //     }
                // ).exec();
                const owner = owners.filter((owner) => {
                    return (owner.name.ja === req.body.username);
                })[0];
                if (owner === null) {
                    errors = { username: { msg: 'IDもしくはパスワードの入力に誤りがあります' } };
                }
                else {
                    // パスワードチェック
                    if (owner.get('password_hash') !== TTTS.CommonUtil.createHash(req.body.password, owner.get('password_salt'))) {
                        errors = { username: { msg: 'IDもしくはパスワードの入力に誤りがあります' } };
                    }
                    else {
                        // ログイン記憶
                        if (req.body.remember === 'on') {
                            // トークン生成
                            const authentication = yield TTTS.Models.Authentication.create({
                                token: TTTS.CommonUtil.createToken(),
                                owner: owner.get('_id'),
                                signature: req.body.signature
                            });
                            // tslint:disable-next-line:no-cookies
                            res.cookie(cookieName, authentication.get('token'), { path: '/', httpOnly: true, maxAge: 604800000 });
                        }
                        req.session[checkinAdmin_1.default.AUTH_SESSION_NAME] = owner.toObject();
                        req.session[checkinAdmin_1.default.AUTH_SESSION_NAME].signature = req.body.signature;
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
        delete req.session[checkinAdmin_1.default.AUTH_SESSION_NAME];
        yield TTTS.Models.Authentication.remove({ token: req.cookies[cookieName] }).exec();
        res.clearCookie(cookieName);
        res.redirect('/checkin/login');
    });
}
exports.logout = logout;

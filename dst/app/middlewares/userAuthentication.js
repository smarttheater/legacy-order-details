"use strict";
/**
 * ユーザー認証ミドルウェア
 * @namespace middlewares.userAuthentication
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
const createDebug = require("debug");
const checkinAdmin_1 = require("../models/user/checkinAdmin");
const debug = createDebug('ttts-authentication:middlewares:userAuthentication');
exports.default = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    res.locals.req = req;
    req.checkinAdminUser = checkinAdmin_1.default.PARSE(req.session);
    debug('req.checkinAdminUser:', req.checkinAdminUser);
    // 既ログインの場合
    if (req.checkinAdminUser.isAuthenticated()) {
        next();
        return;
    }
    // 自動ログインチェック
    // いったん保留
    if (req.xhr) {
        res.json({
            success: false,
            message: 'login required'
        });
    }
    else {
        res.redirect(`/checkin/login?cb=${req.originalUrl}`);
    }
});

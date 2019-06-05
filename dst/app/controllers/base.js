"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * ベースコントローラー
 *
 * 基本的にコントローラークラスはルーティングクラスより呼ばれる
 * あらゆるルーティングで実行されるメソッドは、このクラスがベースとなるので、メソッド共通の処理はここで実装するとよい
 */
const conf = require("config");
const moment = require("moment");
/**
 * 言語設定
 */
function setLocals(req, res, next) {
    res.locals.req = req;
    res.locals.conf = conf;
    res.locals.moment = moment;
    res.locals.validation = null;
    res.locals.officialWebsiteUrl = 'https://motionpicture.jp';
    res.locals.title = 'TTTS checkin';
    res.locals.description = 'TTTS checkin';
    res.locals.keywords = 'TTTS checkin';
    next();
}
exports.setLocals = setLocals;

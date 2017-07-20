"use strict";
/**
 * expressアプリケーション
 *
 * @module app
 * @global
 */
const bodyParser = require("body-parser");
const conf = require("config");
const cookieParser = require("cookie-parser");
const express = require("express");
const i18n = require("i18n");
const log4js = require("log4js");
const mongoose = require("mongoose");
const _ = require("underscore");
// tslint:disable-next-line:no-var-requires no-require-imports
const expressValidator = require("express-validator");
//import * as checkInAuthController from './controllers/auth';
// ミドルウェア
const basicAuth_1 = require("./middlewares/basicAuth");
const benchmarks_1 = require("./middlewares/benchmarks");
const session_1 = require("./middlewares/session");
const userAuthentication_1 = require("./middlewares/userAuthentication");
// ルーター
//import authCheckinRouter from './routes/auth';
const router_1 = require("./routes/router");
// tslint:disable-next-line:no-var-requires no-require-imports
const expressLayouts = require('express-ejs-layouts');
const app = express();
app.use(benchmarks_1.default); // ベンチマーク的な
app.use(session_1.default); // セッション
app.use(basicAuth_1.default); // ベーシック認証
if (process.env.NODE_ENV !== 'production') {
    // サーバーエラーテスト
    app.get('/500', (req) => {
        req.on('end', () => {
            throw new Error('500 manually.');
        });
    });
}
// view engine setup
app.set('views', `${__dirname}/views`);
app.set('view engine', 'ejs');
app.use(expressLayouts);
// tslint:disable-next-line:no-backbone-get-set-outside-model
app.set('layout', 'layouts/layout');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(`${__dirname}/../public`));
// log4jsセット
log4js.configure(conf.get('log4js'));
// i18n を利用する設定
i18n.configure({
    locales: Object.keys(conf.get('locales')),
    defaultLocale: 'ja',
    directory: `${__dirname}/../locales`,
    objectNotation: true,
    updateFiles: false // ページのビューで自動的に言語ファイルを更新しない
});
// i18n の設定を有効化
app.use(i18n.init);
// セッションで言語管理
// tslint:disable-next-line:variable-name
app.use((req, _res, next) => {
    if (!_.isEmpty(req.session.locale)) {
        req.setLocale(req.session.locale);
    }
    if (!_.isEmpty(req.query.locale)) {
        req.setLocale(req.query.locale);
        req.session.locale = req.query.locale;
    }
    // add 2017/06/20 set default locale
    if (!req.session.locale) {
        req.session.locale = 'ja';
    }
    next();
});
// バリデーション
app.use(expressValidator());
// // ログイン
// app.all('/login', checkInAuthController.login);
// // ログアウト
// app.all('/logout', checkInAuthController.logout);
// router登録
router_1.default(app);
// ユーザー認証(ログインの登録の後で実行すること)
app.use(userAuthentication_1.default);
/*
 * Mongoose by default sets the auto_reconnect option to true.
 * We recommend setting socket options at both the server and replica set level.
 * We recommend a 30 second connection timeout because it allows for
 * plenty of time in most operating environments.
 */
const MONGOLAB_URI = process.env.MONGOLAB_URI;
// Use native promises
mongoose.Promise = global.Promise;
mongoose.connect(MONGOLAB_URI, {
    server: { socketOptions: { keepAlive: 300000, connectTimeoutMS: 30000 } },
    replset: { socketOptions: { keepAlive: 300000, connectTimeoutMS: 30000 } }
});
module.exports = app;

"use strict";
/**
 * expressアプリケーション
 */
const middlewares = require("@motionpicture/express-middleware");
const bodyParser = require("body-parser");
const conf = require("config");
const cookieParser = require("cookie-parser");
const express = require("express");
const expressValidator = require("express-validator");
const i18n = require("i18n");
const _ = require("underscore");
// tslint:disable-next-line:no-var-requires no-require-imports
const expressLayouts = require('express-ejs-layouts');
// ミドルウェア
const session_1 = require("./middlewares/session");
// ルーター
const router_1 = require("./routes/router");
const app = express();
app.use(middlewares.basicAuth({
    name: process.env.BASIC_AUTH_NAME,
    pass: process.env.BASIC_AUTH_PASS
}));
app.use(session_1.default); // セッション
// view engine setup
app.set('views', `${__dirname}/../../views`);
app.set('view engine', 'ejs');
app.use(expressLayouts);
app.set('layout', 'layouts/layout');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(`${__dirname}/../../public`));
// i18n を利用する設定
i18n.configure({
    locales: Object.keys(conf.get('locales')),
    defaultLocale: 'ja',
    directory: `${__dirname}/../../locales`,
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
// router登録
router_1.default(app);
module.exports = app;

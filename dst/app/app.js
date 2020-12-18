"use strict";
/**
 * expressアプリケーション
 */
const middlewares = require("@motionpicture/express-middleware");
const bodyParser = require("body-parser");
const conf = require("config");
const cookieParser = require("cookie-parser");
const express = require("express");
// tslint:disable-next-line:no-require-imports
const partials = require("express-partials");
const expressValidator = require("express-validator");
const i18n = require("i18n");
// ミドルウェア
const session_1 = require("./middlewares/session");
const setLocals_1 = require("./middlewares/setLocals");
// ルーター
const router_1 = require("./routes/router");
const app = express();
app.use(middlewares.basicAuth({
    name: process.env.BASIC_AUTH_NAME,
    pass: process.env.BASIC_AUTH_PASS
}));
app.use(partials()); // レイアウト&パーシャルサポート
app.use(session_1.default); // セッション
// view engine setup
app.set('views', `${__dirname}/../../views`);
app.set('view engine', 'ejs');
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
// バリデーション
app.use(expressValidator());
app.use(setLocals_1.default); // ローカル変数セット
// router登録
app.use('/', router_1.default);
module.exports = app;

/**
 * expressアプリケーション
 * @module app
 */

import * as bodyParser from 'body-parser';
import * as conf from 'config';
import * as cookieParser from 'cookie-parser';
import * as express from 'express';
import * as expressValidator from 'express-validator';
import * as i18n from 'i18n';
import * as _ from 'underscore';
// tslint:disable-next-line:no-var-requires no-require-imports
const expressLayouts = require('express-ejs-layouts');

// ミドルウェア
import session from './middlewares/session';
import userAuthentication from './middlewares/userAuthentication';

// ルーター
import router from './routes/router';

const app = express();

app.use(session); // セッション

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
    locales: Object.keys(conf.get<any>('locales')),
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
    if (!_.isEmpty((<any>req.session).locale)) {
        req.setLocale((<any>req.session).locale);
    }

    if (!_.isEmpty(req.query.locale)) {
        req.setLocale(req.query.locale);
        (<any>req.session).locale = req.query.locale;
    }
    // add 2017/06/20 set default locale
    if (!(<any>req.session).locale) {
        (<any>req.session).locale = 'ja';
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
router(app);
// ユーザー認証(ログインの登録の後で実行すること)
app.use(userAuthentication);

export = app;

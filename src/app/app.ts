/**
 * expressアプリケーション
 */
import * as middlewares from '@motionpicture/express-middleware';
import * as bodyParser from 'body-parser';
import * as conf from 'config';
import * as cookieParser from 'cookie-parser';
import * as express from 'express';
// tslint:disable-next-line:no-require-imports
import partials = require('express-partials');
import * as expressValidator from 'express-validator';
import * as i18n from 'i18n';

// ミドルウェア
import session from './middlewares/session';
import setLocals from './middlewares/setLocals';

// ルーター
import router from './routes/router';

const app = express();

app.use(middlewares.basicAuth({ // ベーシック認証
    name: process.env.BASIC_AUTH_NAME,
    pass: process.env.BASIC_AUTH_PASS
}));

app.use(partials()); // レイアウト&パーシャルサポート

app.use(session); // セッション

// view engine setup
app.set('views', `${__dirname}/../../views`);
app.set('view engine', 'ejs');

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

// バリデーション
app.use(expressValidator());

app.use(setLocals); // ローカル変数セット

// router登録
router(app);

export = app;

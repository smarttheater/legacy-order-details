/**
 * expressアプリケーション
 *
 * @module app
 * @global
 */
import * as bodyParser from 'body-parser';
import * as cookieParser from 'cookie-parser';
import * as express from 'express';
import * as i18n from 'i18n';
import * as mongoose from 'mongoose';
import * as _ from 'underscore';
// tslint:disable-next-line:no-var-requires no-require-imports
import expressValidator = require('express-validator');
import basicAuth from './middlewares/basicAuth';
import benchmarks from './middlewares/benchmarks';
import session from './middlewares/session';
import router from './routes/router';
// tslint:disable-next-line:no-var-requires no-require-imports
const expressLayouts = require('express-ejs-layouts');

const app = express();

app.use(benchmarks); // ベンチマーク的な
app.use(session); // セッション
app.use(basicAuth); // ベーシック認証

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

// i18n を利用する設定
i18n.configure({
    locales: ['en', 'ja'],
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
    if (!_.isEmpty((<any>req.session).locale)) {
        req.setLocale((<any>req.session).locale);
    }

    if (!_.isEmpty(req.query.locale)) {
        req.setLocale(req.query.locale);
        (<any>req.session).locale = req.query.locale;
    }

    next();
});

app.use(expressValidator()); // バリデーション

router(app);

/*
 * Mongoose by default sets the auto_reconnect option to true.
 * We recommend setting socket options at both the server and replica set level.
 * We recommend a 30 second connection timeout because it allows for
 * plenty of time in most operating environments.
 */
const MONGOLAB_URI = process.env.MONGOLAB_URI;
// Use native promises
(<any>mongoose).Promise = global.Promise;
mongoose.connect(
    MONGOLAB_URI,
    {
        server: { socketOptions: { keepAlive: 300000, connectTimeoutMS: 30000 } },
        replset: { socketOptions: { keepAlive: 300000, connectTimeoutMS: 30000 } }
    }
);

export = app;

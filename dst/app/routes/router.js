"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * デフォルトルーター
 *
 * @function router
 * @ignore
 */
const conf = require("config");
const baseController = require("../controllers/base");
const errorController = require("../controllers/error");
const languageController = require("../controllers/language");
//import authRouter from './auth';
const checkin_1 = require("./checkin");
const inquiry_1 = require("./inquiry");
const reservations_1 = require("./reservations");
const util_1 = require("./util");
// 本体サイトのトップページの言語別URL
const topUrlByLocale = conf.get('official_url_top_by_locale');
// 本体サイトのプライバシーポリシーページの言語別URL
const privacyPolicyUrlByLocale = conf.get('official_url_privacypolicy_by_locale');
// 本体サイトのお問い合わせページの言語別URL
const contactUrlByLocale = conf.get('official_url_contact_by_locale');
// 本体サイトの入場案内ページの言語別URL
const aboutEnteringUrlByLocale = conf.get('official_url_aboutentering_by_locale');
/**
 * URLルーティング
 *
 * app.get(パス, ルーティング名称, メソッド);
 * といった形でルーティングを登録する
 * ルーティング名称は、ejs側やコントローラーでURLを生成する際に用いたりするので、意識的にページ一意な値を定めること
 *
 * リクエスト毎に、req,res,nextでコントローラーインスタンスを生成して、URLに応じたメソッドを実行する、という考え方
 */
exports.default = (app) => {
    const base = baseController.setLocals;
    // 言語切替
    app.get('/language/update/:locale', languageController.update);
    // 入場
    //app.use('/checkin', base, authRouter);
    // 入場
    app.use('/checkin', base, checkin_1.default);
    // チケット照会
    app.use('/inquiry', base, inquiry_1.default);
    app.use('/reservations', base, reservations_1.default);
    // Util
    app.use('/util', base, util_1.default);
    // 利用規約ページ
    app.get('/terms/', (req, res) => {
        res.locals.req = req;
        res.locals.conf = conf;
        res.locals.validation = null;
        res.locals.title = 'Tokyo Tower';
        res.locals.description = 'TTTS Terms';
        res.locals.keywords = 'TTTS Terms';
        res.render('common/terms/', { layout: 'layouts/inquiry/layout' });
    });
    // 本体サイトの入場案内ページの対応言語版(無ければ英語版)に転送
    app.get('/aboutenter', (req, res) => {
        const locale = (typeof req.getLocale() === 'string' && req.getLocale() !== '') ? req.getLocale() : 'en';
        const url = aboutEnteringUrlByLocale[locale];
        res.redirect(url);
    });
    // 本体サイトのプライバシーポリシーページの対応言語版(無ければ英語版)に転送
    app.get('/privacypolicy', (req, res) => {
        const locale = (typeof req.getLocale() === 'string' && req.getLocale() !== '') ? req.getLocale() : 'en';
        const url = (privacyPolicyUrlByLocale[locale] !== undefined) ?
            privacyPolicyUrlByLocale[locale] : privacyPolicyUrlByLocale.en;
        res.redirect(url);
    });
    // 本体サイトのお問い合わせページの対応言語版(無ければ英語版)に転送
    app.get('/contact', (req, res) => {
        const locale = (typeof req.getLocale() === 'string' && req.getLocale() !== '') ? req.getLocale() : 'en';
        const url = (contactUrlByLocale[locale] !== undefined) ?
            contactUrlByLocale[locale] : contactUrlByLocale.en;
        res.redirect(url);
    });
    // 本体サイトトップページの対応言語版(無ければ英語版)に転送
    app.get('/returntop', (req, res) => {
        const locale = (typeof req.getLocale() === 'string' && req.getLocale() !== '') ? req.getLocale() : 'en';
        const url = (topUrlByLocale[locale] !== undefined) ?
            topUrlByLocale[locale] : topUrlByLocale.en;
        res.redirect(url);
    });
    // 404
    app.get('/error/notFound', base, errorController.notFound);
    app.use((_, res) => { res.redirect('/error/notFound'); });
    // error handlers
    app.use(errorController.index);
};

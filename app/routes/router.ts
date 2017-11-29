/**
 * デフォルトルーター
 *
 * @function router
 * @ignore
 */
import * as conf from 'config';
import { Application, Request, Response } from 'express';
import * as baseController from '../controllers/base';
import * as errorController from '../controllers/error';
import * as languageController from '../controllers/language';
//import authRouter from './auth';
import checkinRouter from './checkin';
import inquiryRouter from './inquiry';
import utilRouter from './util';

// 本体サイトのトップページの言語別URL
const topUrlByLocale = conf.get<any>('official_url_top_by_locale');
// 本体サイトのプライバシーポリシーページの言語別URL
const privacyPolicyUrlByLocale = conf.get<any>('official_url_privacypolicy_by_locale');
// 本体サイトのお問い合わせページの言語別URL
const contactUrlByLocale = conf.get<any>('official_url_contact_by_locale');

/**
 * URLルーティング
 *
 * app.get(パス, ルーティング名称, メソッド);
 * といった形でルーティングを登録する
 * ルーティング名称は、ejs側やコントローラーでURLを生成する際に用いたりするので、意識的にページ一意な値を定めること
 *
 * リクエスト毎に、req,res,nextでコントローラーインスタンスを生成して、URLに応じたメソッドを実行する、という考え方
 */
export default (app: Application) => {
    const base = baseController.setLocals;

    // 言語切替
    app.get('/language/update/:locale', languageController.update);

    // 入場
    //app.use('/checkin', base, authRouter);
    // 入場
    app.use('/checkin', base, checkinRouter);
    // チケット照会
    app.use('/inquiry', base, inquiryRouter);
    // Util
    app.use('/util', base, utilRouter);

    // 利用規約ページ
    app.get('/terms/', (req: Request, res: Response) => {
        res.locals.req = req;
        res.locals.conf = conf;
        res.locals.validation = null;
        res.locals.title = 'Tokyo Tower';
        res.locals.description = 'TTTS Terms';
        res.locals.keywords = 'TTTS Terms';

        return res.render('common/terms/', {
            layout: 'layouts/inquiry/layout'
        });
    });

    // 本体サイトのプライバシーポリシーページの対応言語版(無ければ英語版)に転送
    app.get('/privacypolicy', (req: Request, res: Response) => {
        const locale: string = (req.getLocale()) || 'en';
        const url: string = (privacyPolicyUrlByLocale[locale] || privacyPolicyUrlByLocale.en);

        return res.redirect(url);
    });

    // 本体サイトのお問い合わせページの対応言語版(無ければ英語版)に転送
    app.get('/contact', (req: Request, res: Response) => {
        const locale: string = (req.getLocale()) || 'en';
        const url: string = (contactUrlByLocale[locale] || contactUrlByLocale.en);

        return res.redirect(url);
    });

    // 本体サイトトップページの対応言語版(無ければ英語版)に転送
    app.get('/returntop', (req: Request, res: Response) => {
        const locale: string = (req.getLocale()) || 'en';
        const url: string = (topUrlByLocale[locale] || topUrlByLocale.en);

        return res.redirect(url);
    });

    // 404
    app.get('/error/notFound', base, errorController.notFound);
    app.use((_: Request, res: Response) => { res.redirect('/error/notFound'); });

    // error handlers
    app.use(errorController.index);
};

/**
 * デフォルトルーター
 */
import * as conf from 'config';
import { Request, Response, Router } from 'express';
import * as errorController from '../controllers/error';
import * as languageController from '../controllers/language';
import checkinRouter from './checkin';
import inquiryRouter from './inquiry';
import reservationsRouter from './reservations';

// 本体サイトのトップページの言語別URL
const topUrlByLocale = conf.get<any>('official_url_top_by_locale');
// 本体サイトのプライバシーポリシーページの言語別URL
const privacyPolicyUrlByLocale = conf.get<any>('official_url_privacypolicy_by_locale');
// 本体サイトのお問い合わせページの言語別URL
const contactUrlByLocale = conf.get<any>('official_url_contact_by_locale');
// 本体サイトの入場案内ページの言語別URL
const aboutEnteringUrlByLocale = conf.get<any>('official_url_aboutentering_by_locale');

// 言語ごとの対象ページリダイレクト用URLを得る (その言語のURLが無かった場合は英語版を返す)
const getRedirectOfficialUrl = (req: Request, urlByLocale: any): string => {
    const locale: string = (typeof req.getLocale() === 'string' && req.getLocale() !== '') ? req.getLocale() : 'en';

    return (urlByLocale[locale] !== undefined) ? urlByLocale[locale] : urlByLocale.en;
};

const router = Router();

// 言語切替
router.get('/language/update/:locale', languageController.update);

// 入場
router.use('/checkin', checkinRouter);
// チケット照会
router.use('/inquiry', inquiryRouter);
router.use('/reservations', reservationsRouter);

// 利用規約ページ
router.get('/terms/', (req: Request, res: Response) => {
    res.locals.req = req;
    res.locals.conf = conf;
    res.locals.validation = null;
    res.locals.title = 'Tokyo Tower';

    res.render('common/terms/', { layout: 'layouts/inquiry/layout' });
});

// 特定商取引法に基づく表示ページ
router.get('/asct/', (req: Request, res: Response) => {
    res.locals.req = req;
    res.locals.conf = conf;
    res.locals.validation = null;
    res.locals.title = 'Tokyo Tower';

    res.render('common/asct/', { layout: 'layouts/inquiry/layout' });
});

// 本体サイトの入場案内ページの対応言語版に転送
router.get('/aboutenter', (req: Request, res: Response) => {
    res.redirect(getRedirectOfficialUrl(req, aboutEnteringUrlByLocale));
});

// 本体サイトのプライバシーポリシーページの対応言語版に転送
router.get('/privacypolicy', (req: Request, res: Response) => {
    res.redirect(getRedirectOfficialUrl(req, privacyPolicyUrlByLocale));
});

// 本体サイトのお問い合わせページの対応言語版に転送
router.get('/contact', (req: Request, res: Response) => {
    res.redirect(getRedirectOfficialUrl(req, contactUrlByLocale));
});

// 本体サイトトップページの対応言語版に転送
router.get('/returntop', (req: Request, res: Response) => {
    res.redirect(getRedirectOfficialUrl(req, topUrlByLocale));
});

// 404
router.get('/error/notFound', errorController.notFound);
router.use((_: Request, res: Response) => { res.redirect('/error/notFound'); });

// error handlers
router.use(errorController.index);

export default router;

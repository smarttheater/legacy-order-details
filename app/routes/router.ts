/**
 * デフォルトルーター
 *
 * @function router
 * @ignore
 */
import { Application, Request, Response } from 'express';
import * as baseController from '../controllers/base';
import * as errorController from '../controllers/error';
import checkinRouter from './checkin';
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

    // 入場
    app.use('/checkin', base, checkinRouter);

    // 404
    app.get('/error/notFound', base, errorController.notFound);
    app.use((_: Request, res: Response) => { res.redirect('/error/notFound'); });

    // error handlers
    app.use(errorController.index);
};

/**
 * ベースコントローラー
 *
 * 基本的にコントローラークラスはルーティングクラスより呼ばれる
 * あらゆるルーティングで実行されるメソッドは、このクラスがベースとなるので、メソッド共通の処理はここで実装するとよい
 *
 * @namespace BaseController
 */
import { NextFunction, Request, Response } from 'express';
import * as moment from 'moment';

/**
 * @memberof BaseController
 * @function setLocals
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 * @returns {void}
 */
export function setLocals(req: Request, res: Response, next: NextFunction): void {
    res.locals.req = req;
    res.locals.moment = moment;
    res.locals.validation = null;
    res.locals.officialWebsiteUrl = 'https://motionpicture.jp';
    res.locals.title = 'TTTS checkin';
    res.locals.description = 'TTTS checkin';
    res.locals.keywords = 'TTTS checkin';
    next();
}

/**
 * ベースコントローラー
 *
 * 基本的にコントローラークラスはルーティングクラスより呼ばれる
 * あらゆるルーティングで実行されるメソッドは、このクラスがベースとなるので、メソッド共通の処理はここで実装するとよい
 */
import * as conf from 'config';
import { NextFunction, Request, Response } from 'express';
import * as moment from 'moment-timezone';

/**
 * 言語設定
 */
export function setLocals(req: Request, res: Response, next: NextFunction): void {
    res.locals.req = req;
    res.locals.conf = conf;
    res.locals.moment = moment;
    res.locals.validation = null;
    res.locals.officialWebsiteUrl = 'https://motionpicture.jp';
    res.locals.title = 'TTTS checkin';
    res.locals.description = 'TTTS checkin';
    res.locals.keywords = 'TTTS checkin';
    next();
}

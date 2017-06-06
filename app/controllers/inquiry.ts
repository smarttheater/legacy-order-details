/**
 * 予約照会コントローラー
 *
 * 上映当日入場画面から使う機能はここにあります。
 *
 * @namespace inquiry
 */
import { Models, ScreenUtil} from '@motionpicture/ttts-domain';
import { NextFunction, Request, Response } from 'express';
//import * as mongoose from 'mongoose';
//import * as _ from 'underscore';
//import * as Message from '../../common/const/message';
import * as moment from 'moment';

// 購入番号 半角9
const NAME_MAX_LENGTH_PAYMENTNO: number = 9;
// Tel 半角20
const NAME_MAX_LENGTH_TEL: number = 20;
// セッションキー
const SESSION_KEY_INQUIRY_RESERVATIONS: string = 'ttts-ticket-inquiry-reservations';

/**
 * 予約照会検索
 * @memberof inquiry
 * @function search
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 * @returns {Promise<void>}
 */
export async function search(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (req.method === 'POST') {
        // formバリデーション
        validate(req);
        const validatorResult = await req.getValidationResult();
        const errors = req.validationErrors(true);
        if (!validatorResult.isEmpty()) {
            renderSearch(res, '', errors);

            return;
        }
        //存在チェック
        const conditions = {
            performance_day: req.body.day,
            payment_no: req.body.paymentNo,
            purchaser_tel: req.body.purchaserTel
        };
        try {
            // 総数検索
            const count = await Models.Reservation.count(
                conditions
            ).exec();
            // データ有りの時
            if ( count > 0) {
                // データ検索
                const reservations = await Models.Reservation.find(
                    conditions
                ).exec();
                // 座席コードでソート(必要？)
                reservations.sort((a, b) => {
                    return ScreenUtil.sortBySeatCode(a.get('seat_code'), b.get('seat_code'));
                });
                // 予約照会・検索結果画面へ遷移
                (<any>req.session)[SESSION_KEY_INQUIRY_RESERVATIONS] = reservations;
                res.redirect('/inquiry/search/result');
            } else {
                const message: string = 'ご指定の予約データは見つかりませんでした';
                renderSearch(res, message, {});

                return;
            }
        }catch (error) {
            next(error);

            return;
        }
    } else {
        // 予約照会画面描画
        renderSearch(res, '', {});
    }
}
/**
 * 予約照会画面描画
 * @memberof inquiry
 * @function renderSearch
 * @param {Response} res
 * @param {string} message
 * @param {any} errors
 */
function renderSearch(res: Response, message: string, errors: any): void {
    res.render('inquiry/search', {
        message: message,
        errors: errors,
        event: {
            start: '2016-10-25T00:00:00+09:00',
            end: '2017-12-31T23:59:59+09:00'
        },
        layout: 'layouts/inquiry/layout'
    });
}
/**
 * 予約照会結果
 * @memberof inquiry
 * @function result
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 * @returns {Promise<void>}
 */
export async function result(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        if ( req === null) {
            // next(new Error(req.__('Message.NotFound')));
            next(new Error('Message.NotFound'));
        }
        const reservations = (<any>req.session)[SESSION_KEY_INQUIRY_RESERVATIONS];
        //(<any>req.session)[SESSION_KEY_INQUIRY_RESERVATIONS] = null;
        if (!reservations || reservations.length === 0) {
            // next(new Error(req.__('Message.NotFound')));
            next(new Error('NotFound'));

            return;
        }

        res.render('inquiry/result', {
            moment: moment,
            reservationDocuments: reservations,
            layout: 'layouts/inquiry/layout'
        });
    } catch (error) {
        next(error);
    }
}
/**
 * 予約照会画面form値検証
 *
 * @param {any} req
 * @param {string} type
 */
function validate(req: Request): void {
    let colName: string = '';
    const required = '$fieldName$が未入力です';

    // 購入番号
    colName = '購入番号';
    req.checkBody('paymentNo', required.replace('$fieldName$', colName)).notEmpty();
    req.checkBody('paymentNo', getMaxLength(colName, NAME_MAX_LENGTH_PAYMENTNO)).len({ max: NAME_MAX_LENGTH_PAYMENTNO });

    // 電話番号
    colName = '電話番号';
    req.checkBody('purchaserTel', required.replace('$fieldName$', colName)).notEmpty();
    req.checkBody('purchaserTel', getMaxLength(colName, NAME_MAX_LENGTH_TEL)).len({ max: NAME_MAX_LENGTH_TEL });
}
function getMaxLength(fieldName: string, max: number): string {
    const maxLength: string = '$fieldName$は$maxLength$文字以内で入力してください';

    return maxLength.replace('$fieldName$', fieldName).replace('$maxLength$', max.toString());
}

/**
 * 予約照会コントローラー
 *
 * 上映当日入場画面から使う機能はここにあります。
 *
 * @namespace inquiry
 */
import * as GMO from '@motionpicture/gmo-service';
//import { Models, ReservationUtil, ScreenUtil} from '@motionpicture/ttts-domain';
import { Models, ScreenUtil} from '@motionpicture/ttts-domain';
import { NextFunction, Request, Response } from 'express';
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
 * 予約照会結果画面(getのみ)
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
 * 予約キャンセル処理
 * @memberof inquiry
 * @function cancel
 * @param {Request} req
 * @param {Response} res
 * @returns {Promise<void>}
 */
export async function cancel(req: Request, res: Response): Promise<void> {
    try {
        const errorMessage: string = '予期せぬエラーが発生しました。チケット照会からやり直してください。';
        validateForCancel(req);
        const validatorResult = await req.getValidationResult();
        const validations = req.validationErrors(true);
        if (!validatorResult.isEmpty()) {
            res.json({
                validation: validations,
                error: errorMessage
            });

            return;
        }
        // 予約取得
        const reservations = (<any>req.session)[SESSION_KEY_INQUIRY_RESERVATIONS];
        const cancelCharge: number = 400;
        // キャンセル処理
        const promises = ((<any>reservations).map(async(reservation: any) => {
            // 金額変更
            const result: GMO.CreditService.IChangeTranResult = await GMO.CreditService.changeTran({
                shopId: process.env.GMO_SHOP_ID,
                shopPass: process.env.GMO_SHOP_PASS,
                accessId: reservation.gmo_access_id,
                accessPass: reservation.gmo_access_pass,
                //jobCd: GMO.Util.JOB_CD_CAPTURE,
                jobCd: reservation.gmo_status,
                amount: cancelCharge
            });
            if (result.approve !== '') {
                // キャンセル作成
                // 予約削除(AVAILABLEに変更)
                // await Models.Reservation.findByIdAndUpdate(
                //     reservation._id,
                //     {
                //          status: ReservationUtil.STATUS_AVAILABLE
                //     }
                //     ).exec();
            }
        }));
        await Promise.all(promises);
        res.json({
            validation: null,
            error: null
        });
    } catch (err) {
        res.json({
            validation: null,
            error: err.message
        });
    }
}
/**
 * 予約照会画面検証
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
/**
 * キャンセル検証
 * @function updateValidation
 * @param {Request} req
 * @returns {void}
 */
function validateForCancel(req: Request): void {
    const required = '$fieldName$が未入力です';
    // 購入番号
    const colName: string = '購入番号';
    req.checkBody('payment_no', required.replace('$fieldName$', colName)).notEmpty();
}

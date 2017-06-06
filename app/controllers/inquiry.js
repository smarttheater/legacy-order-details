"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 予約照会コントローラー
 *
 * 上映当日入場画面から使う機能はここにあります。
 *
 * @namespace inquiry
 */
//import { Models, ScreenUtil} from '@motionpicture/ttts-domain';
const ttts_domain_1 = require("@motionpicture/ttts-domain");
//import * as mongoose from 'mongoose';
//import * as _ from 'underscore';
//import * as Message from '../../common/const/message';
const moment = require("moment");
// // 購入番号 半角9
// const NAME_MAX_LENGTH_PAYMENTNO: number = 9;
// // Tel 半角20
// const NAME_MAX_LENGTH_TEL: number = 20;
const SESSION_KEY_INQUIRY_RESERVATIONS = 'ttts-ticket-inquiry-reservations';
/**
 * 予約照会検索
 * @memberof inquiry
 * @function search
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 * @returns {Promise<void>}
 */
//export async function search(req: Request, res: Response, next: NextFunction): Promise<void> {
function search(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const message = '';
        const errors = {};
        if (req.method === 'POST') {
            // formバリデーション
            //validate(req);
            //const validatorResult = await req.getValidationResult();
            //errors = req.validationErrors(true);
            // if (!validatorResult.isEmpty()) {
            //     res.render('inquiry/search', {
            //         message: message,
            //         errors: errors,
            //         event: {
            //             start: '2016-10-25T00:00:00+09:00',
            //             end: '2017-12-31T23:59:59+09:00'
            //         },
            //         layout: 'layouts/inquiry/layout'
            //     });
            //     return;
            // }
            //存在チェック
            // const day = req.body.day;
            // const paymentNo = req.body.paymentNo;
            // const purchaserTel = req.body.purchaserTel;
            // // const conditions = {
            // //     performance_day: day,
            // //     payment_no: paymentNo,
            // //     purchaser_tel: purchaserTel
            // // };
            try {
                //     const reservations = await Models.Reservation.find(
                //         {
                //             performance_day: day,
                //             payment_no: paymentNo,
                //             purchaser_tel: purchaserTel
                //         }
                //     ).exec();
                //     if (reservations.length === 0) {
                //         message = 'Not found';
                //         res.render('inquiry/search', {
                //             message: message,
                //             errors: errors,
                //             event: {
                //                 start: '2016-10-25T00:00:00+09:00',
                //                 end: '2017-12-31T23:59:59+09:00'
                //             },
                //             layout: 'layouts/inquiry/layout'
                //         });
                //         return;
                //     }
                // reservations.sort((a, b) => {
                //     return ScreenUtil.sortBySeatCode(a.get('seat_code'), b.get('seat_code'));
                // });
                // 予約照会・検索結果画面へ遷移
                //(<Express.Session>req.session).reservations = reservations;
                res.redirect('/inquiry/search/result');
                // res.render('inquiry/result', {
                //     //reservationDocuments: reservations,
                //     layout: 'layouts/inquiry/layout'
                // });
                return;
            }
            catch (error) {
                next(error);
                return;
            }
        }
        else {
            // 予約照会画面描画
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
    });
}
exports.search = search;
/**
 * 予約照会データチェック
 * @memberof inquiry
 * @function count
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 * @returns {Promise<void>}
 */
function count(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        // formバリデーション
        //validate(req);
        //const validatorResult = await req.getValidationResult();
        //const errors = (!validatorResult.isEmpty()) ? req.validationErrors(true) : {};
        const errors = {};
        //errors = req.validationErrors(true);
        // if (!validatorResult.isEmpty()) {
        //     res.render('inquiry/search', {
        //         message: message,
        //         errors: errors,
        //         event: {
        //             start: '2016-10-25T00:00:00+09:00',
        //             end: '2017-12-31T23:59:59+09:00'
        //         },
        //         layout: 'layouts/inquiry/layout'
        //     });
        //     return;
        // }
        // 条件セット
        const day = req.query.day;
        const paymentNo = req.query.paymentNo;
        const purchaserTel = req.query.purchaserTel;
        const conditions = {
            performance_day: day,
            payment_no: paymentNo,
            purchaser_tel: purchaserTel
        };
        try {
            // 総数検索
            const count = yield ttts_domain_1.Models.Reservation.count(conditions).exec();
            let reservations;
            if (count > 0) {
                //const reservations = [{seat_code: 'A01', payment_no: 'p12345'}];
                reservations = yield ttts_domain_1.Models.Reservation.find(conditions).exec();
                // reservations.sort((a, b) => {
                //     return ScreenUtil.sortBySeatCode(a.get('seat_code'), b.get('seat_code'));
                // });
                // 予約照会・検索結果画面へ遷移
                req.session[SESSION_KEY_INQUIRY_RESERVATIONS] = reservations;
            }
            else {
                errors.head = { msg: 'ご指定の予約データは見つかりませんでした' };
            }
            res.json({
                success: true,
                count: count,
                reservations: reservations,
                errors: errors
            });
            return;
        }
        catch (error) {
            console.error(error);
            res.json({
                success: false,
                count: 0,
                errors: error
            });
        }
    });
}
exports.count = count;
/**
 * 予約照会結果
 * @memberof inquiry
 * @function result
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 * @returns {Promise<void>}
 */
function result(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (req === null) {
                // next(new Error(req.__('Message.NotFound')));
                next(new Error('Message.NotFound'));
            }
            const reservations = req.session[SESSION_KEY_INQUIRY_RESERVATIONS];
            if (!reservations || reservations.length === 0) {
                // next(new Error(req.__('Message.NotFound')));
                next(new Error('Message.NotFound'));
                return;
            }
            res.render('inquiry/result', {
                moment: moment,
                reservationDocuments: reservations,
                layout: 'layouts/inquiry/layout'
            });
        }
        catch (error) {
            next(error);
        }
    });
}
exports.result = result;

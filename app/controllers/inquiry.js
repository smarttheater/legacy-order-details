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
const ttts = require("@motionpicture/ttts-domain");
const conf = require("config");
const log4js = require("log4js");
const moment = require("moment");
const numeral = require("numeral");
const sendgrid = require("sendgrid");
const util = require("util");
const Text = require("../../common/Const/Text");
const ticket = require("../../common/Util/ticket");
// セッションキー
const SESSION_KEY_INQUIRY_RESERVATIONS = 'ttts-ticket-inquiry-reservations';
const SESSION_KEY_INQUIRY_CANCELLATIONFEE = 'ttts-ticket-inquiry-cancellationfee';
// ログ出力
const logger = log4js.getLogger('system');
// キャンセル料(1予約あたり1000円固定)
const CANCEL_CHARGE = Number(conf.get('cancelCharge'));
// キャンセル可能な日数(3日前まで)
const CANCELLABLE_DAYS = Number(conf.get('cancellableDays'));
/**
 * 予約照会検索
 * @memberof inquiry
 * @function search
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 * @returns {Promise<void>}
 */
function search(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (req.method === 'POST') {
            // formバリデーション
            validate(req);
            const validatorResult = yield req.getValidationResult();
            const errors = req.validationErrors(true);
            if (!validatorResult.isEmpty()) {
                renderSearch(res, '', errors);
                return;
            }
            //存在チェック(電話番号は下4桁)
            const conditions = {
                performance_day: req.body.day,
                payment_no: req.body.paymentNo,
                purchaser_tel: { $regex: `${req.body.purchaserTel}$` }
            };
            try {
                // 予約検索
                const reservationRepo = new ttts.repository.Reservation(ttts.mongoose.connection);
                const reservations = yield reservationRepo.reservationModel.find(conditions).exec();
                // データ有りの時
                if (reservations !== undefined && reservations.length > 0) {
                    // 予約照会・検索結果画面へ遷移
                    req.session[SESSION_KEY_INQUIRY_RESERVATIONS] = reservations;
                    res.redirect('/inquiry/search/result');
                }
                else {
                    const message = req.__('Message.ReservationNotFound');
                    renderSearch(res, message, {});
                    return;
                }
            }
            catch (error) {
                next(error);
                return;
            }
        }
        else {
            // 予約照会画面描画
            renderSearch(res, '', {});
        }
    });
}
exports.search = search;
/**
 * 予約照会画面描画
 * @memberof inquiry
 * @function renderSearch
 * @param {Response} res
 * @param {string} message
 * @param {any} errors
 */
function renderSearch(res, message, errors) {
    res.render('inquiry/search', {
        message: message,
        errors: errors,
        event: {
            start: moment(),
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
function result(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const messageNotFound = req.__('Message.NotFound');
        try {
            if (req === null) {
                next(new Error(messageNotFound));
            }
            const reservations = req.session[SESSION_KEY_INQUIRY_RESERVATIONS];
            if (!reservations || reservations.length === 0) {
                next(new Error(messageNotFound));
                return;
            }
            // "予約"のデータのみセット(Extra分を削除)
            const reservationDocuments = [];
            reservations.forEach((reservation) => {
                if (reservation.status === ttts.factory.reservationStatusType.ReservationConfirmed) {
                    reservationDocuments.push(reservation);
                }
            });
            // 券種ごとに合計枚数算出
            const ticketInfos = ticket.editTicketInfos(req, ticket.getTicketInfos(reservationDocuments));
            // キャンセル料取得
            // 2017/11/15 キャンセル料は1予約あたり1000円固定
            //const today = moment().format('YYYYMMDD');
            //const fee: number = getCancellationFee(reservations, today);
            const fee = CANCEL_CHARGE;
            //---
            req.session[SESSION_KEY_INQUIRY_CANCELLATIONFEE] = fee;
            const cancellationFee = numeral(fee).format('0,0');
            // 画面描画
            res.render('inquiry/result', {
                moment: moment,
                reservationDocuments: reservationDocuments,
                ticketInfos: ticketInfos,
                enableCancel: true,
                cancellationFee: cancellationFee,
                layout: 'layouts/inquiry/layout'
            });
        }
        catch (error) {
            next(error);
        }
    });
}
exports.result = result;
/**
 * 印刷
 */
function print(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const ids = JSON.parse(req.query.ids);
            const reservationRepo = new ttts.repository.Reservation(ttts.mongoose.connection);
            const reservations = yield reservationRepo.reservationModel.find({
                _id: { $in: ids },
                status: ttts.factory.reservationStatusType.ReservationConfirmed
            })
                .sort({
                seat_code: 1
            })
                .exec();
            if (reservations.length === 0) {
                next(new Error(req.__('Message.NotFound')));
                return;
            }
            res.render('print/print', {
                layout: false,
                reservations: reservations
            });
        }
        catch (error) {
            console.error(error);
            next(new Error(req.__('Message.UnexpectedError')));
        }
    });
}
exports.print = print;
/**
 * PCサーマル印刷 (WindowsでStarPRNTドライバを使用)
 */
function pcthermalprint(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const ids = JSON.parse(req.query.ids);
            const reservationRepo = new ttts.repository.Reservation(ttts.mongoose.connection);
            const reservations = yield reservationRepo.reservationModel.find({
                _id: { $in: ids },
                status: ttts.factory.reservationStatusType.ReservationConfirmed
            })
                .sort({
                seat_code: 1
            })
                .exec();
            if (reservations.length === 0) {
                next(new Error(req.__('Message.NotFound')));
                return;
            }
            res.render('print/print_pcthermal', {
                layout: false,
                reservations: reservations
            });
        }
        catch (error) {
            console.error(error);
            next(new Error(req.__('Message.UnexpectedError')));
        }
    });
}
exports.pcthermalprint = pcthermalprint;
/**
 * 予約キャンセル処理
 * @memberof inquiry
 * @function cancel
 * @param {Request} req
 * @param {Response} res
 * @returns {Promise<void>}
 */
// tslint:disable-next-line:max-func-body-length
function cancel(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        let errorMessage = req.__('Message.UnexpectedError');
        let cancellationFee = 0;
        // 予約取得
        let reservations;
        try {
            reservations = req.session[SESSION_KEY_INQUIRY_RESERVATIONS];
            // キャンセル料セット
            cancellationFee = req.session[SESSION_KEY_INQUIRY_CANCELLATIONFEE];
        }
        catch (err) {
            res.json({
                success: false,
                validation: null,
                error: errorMessage
            });
            return;
        }
        // 検証
        const validations = yield validateForCancel(req, reservations[0].performance_day);
        if (Object.keys(validations).length > 0) {
            if (validations.hasOwnProperty('cancelDays')) {
                errorMessage = validations.cancelDays.msg;
            }
            res.json({
                success: false,
                validation: validations,
                error: errorMessage
            });
            return;
        }
        // キャンセル
        try {
            // 金額変更(エラー時はchangeTran内部で例外発生)
            yield ttts.GMO.services.credit.changeTran({
                shopId: process.env.GMO_SHOP_ID,
                shopPass: process.env.GMO_SHOP_PASS,
                accessId: reservations[0].gmo_access_id,
                accessPass: reservations[0].gmo_access_pass,
                jobCd: ttts.GMO.utils.util.JobCd.Capture,
                amount: cancellationFee
            });
        }
        catch (err) {
            // GMO金額変更apiエラーはキャンセルできなかたことをユーザーに知らせる
            res.json({
                success: false,
                validation: null,
                error: errorMessage
            });
            return;
        }
        try {
            // キャンセルメール送信
            yield sendEmail(reservations[0].purchaser_email, getCancelMail(req, reservations, cancellationFee));
            logger.info('-----update db start-----');
            const reservationRepo = new ttts.repository.Reservation(ttts.mongoose.connection);
            const stockRepo = new ttts.repository.Stock(ttts.mongoose.connection);
            const promises = (reservations.map((reservation) => __awaiter(this, void 0, void 0, function* () {
                // 2017/11 本体チケットかつ特殊チケットの時、時間ごとの予約データ解放(AVAILABLEに変更)
                if (reservation.ticket_ttts_extension.category !== ttts.TicketTypeGroupUtil.TICKET_TYPE_CATEGORY_NORMAL &&
                    reservation.seat_code === reservation.reservation_ttts_extension.seat_code_base) {
                    yield ttts.Models.ReservationPerHour.findOneAndUpdate({ reservation_id: reservation._id.toString() }, {
                        $set: { status: ttts.factory.itemAvailability.InStock },
                        $unset: { expired_at: 1, reservation_id: 1 }
                    }, { new: true }).exec();
                    logger.info('ReservationPerHour clear reservation_id=', reservation._id.toString());
                }
                // 予約データ解放(AVAILABLEに変更)
                yield reservationRepo.reservationModel.findByIdAndUpdate(reservation._id, {
                    $set: { status: ttts.factory.reservationStatusType.ReservationCancelled },
                    $unset: getUnsetFields(reservation)
                }).exec();
                logger.info('Reservation clear =', JSON.stringify(reservation));
                // 在庫を空きに(在庫IDに対して、元の状態に戻す)
                yield stockRepo.stockModel.findByIdAndUpdate(reservation.get('stock'), { availability: reservation.get('stock_availability_before') }).exec();
            })));
            yield Promise.all(promises);
            // キャンセルリクエスト保管
            yield ttts.Models.CustomerCancelRequest.create({
                reservation: reservations[0],
                tickets: ttts.Models.CustomerCancelRequest.getTickets(reservations),
                cancel_name: `${reservations[0].purchaser_last_name} ${reservations[0].purchaser_first_name}`,
                cancellation_fee: cancellationFee
            });
            logger.info('CustomerCancelRequest create =', JSON.stringify(reservations[0]));
            logger.info('-----update db end-----');
        }
        catch (err) {
            // エラーログ出力(後は手作業で復旧してもらう)
            // tslint:disable-next-line:max-line-length
            logger.error(`payment_no=[${reservations[0].payment_no}] performance_day=[${reservations[0].performance_day}] message=[${err.message}]`);
        }
        finally {
            // GMO金額変更apiがOKならばユーザーにとってはキャンセル成功
            res.json({
                success: true,
                validation: null,
                error: null
            });
        }
    });
}
exports.cancel = cancel;
/**
 * キャンセル料合計取得
 *
 * @param {any} reservations
 * @param {string} today
 * @return {number}
 */
// function getCancellationFee(reservations: any[], today: string): number {
//     let cancellationFee: number = 0;
//     for (const reservation of reservations){
//         if (reservation.status !== ReservationUtil.STATUS_RESERVED) {
//             continue;
//         }
//         // キャンセル料合計
//         cancellationFee += getCancelCharge(reservation, today);
//     }
//     return cancellationFee;
// }
/**
 * キャンセル料取得
 *
 * @param {any} reservation
 * @param {string} today
 * @param {number} index
 */
// function getCancelCharge( reservation: any, today: string): number {
//     const cancelInfo: any[] = reservation.ticket_cancel_charge;
//     let cancelCharge: number = cancelInfo[cancelInfo.length - 1].charge;
//     const performanceDay = reservation.performance_day;
//     let dayTo = performanceDay;
//     let index: number = 0;
//     // 本日が入塔予約日の3日前以内
//     for (index = 0; index < cancelInfo.length; index += 1) {
//         const limitDays: number = cancelInfo[index].days;
//         const dayFrom = moment(performanceDay, 'YYYYMMDD').add(limitDays * -1, 'days').format('YYYYMMDD');
//         // 本日が一番大きい設定日を過ぎていたら-1(キャンセル料は全額)
//         if ( index === 0 && today > dayFrom) {
//             cancelCharge = reservation.charge;
//             break;
//         }
//         // 日付終了日 >= 本日 >= 日付開始日
//         if (dayTo >= today && today > dayFrom) {
//             cancelCharge =  cancelInfo[index - 1].charge;
//             break;
//         }
//         dayTo = dayFrom;
//     }
//     return cancelCharge;
// }
/**
 * 更新時削除フィールド取得
 *
 * @param {any} reservation
 * @return {any} unset
 */
function getUnsetFields(reservation) {
    const setFields = [
        '_id',
        'performance',
        'seat_code',
        'updated_at',
        'checkins',
        'performance_canceled',
        'status',
        '__v',
        'created_at'
    ];
    const unset = {};
    // セットフィールド以外は削除フィールドにセット
    Object.getOwnPropertyNames(reservation).forEach((propertyName) => {
        if (setFields.indexOf(propertyName) < 0) {
            unset[propertyName] = 1;
        }
    });
    return unset;
}
/**
 * 予約照会画面検証
 *
 * @param {any} req
 * @param {string} type
 */
function validate(req) {
    // 購入番号
    req.checkBody('paymentNo', req.__('Message.required{{fieldName}}', { fieldName: req.__('Label.PaymentNo') })).notEmpty();
    // 電話番号
    req.checkBody('purchaserTel', req.__('Message.minLength{{fieldName}}{{min}}', { fieldName: req.__('Label.Tel'), min: '4' })).len({ min: 4 });
}
/**
 * キャンセル検証
 * @function updateValidation
 * @param {Request} req
 * @param {string} day
 * @returns {any}
 */
function validateForCancel(req, day) {
    return __awaiter(this, void 0, void 0, function* () {
        // 購入番号
        req.checkBody('payment_no', req.__('Message.required{{fieldName}}', { fieldName: req.__('Label.PaymentNo') })).notEmpty();
        // 検証
        const validatorResult = yield req.getValidationResult();
        const errors = (!validatorResult.isEmpty()) ? req.validationErrors(true) : {};
        // 入塔予定日+キャンセル可能日が本日日付を過ぎていたらエラー
        // if (cancellationFee < 0) {
        //     (<any>errors).cancelDays = {msg: 'キャンセルできる期限を過ぎています。'};
        // }
        // 入塔予定日の3日前までキャンセル可能(3日前を過ぎていたらエラー)
        const today = moment().format('YYYY/MM/DD');
        const maxCancellableDay = moment(day, 'YYYY/MM/DD').add('days', CANCELLABLE_DAYS * -1).format('YYYY/MM/DD');
        if (maxCancellableDay < today) {
            errors.cancelDays = { msg: 'キャンセルできる期限を過ぎています。' };
        }
        return errors;
    });
}
/**
 * メールを送信する
 * @function sendEmail
 * @param {string} to
 * @param {string} text
 * @returns {void}
 */
function sendEmail(to, text) {
    return __awaiter(this, void 0, void 0, function* () {
        const subject = util.format('%s%s %s', (process.env.NODE_ENV !== 'production') ? `[${process.env.NODE_ENV}]` : '', 'TTTS_EVENT_NAMEチケット キャンセル完了のお知らせ', 'Notice of Completion of Cancel for TTTS Tickets');
        const mail = new sendgrid.mail.Mail(new sendgrid.mail.Email(conf.get('email.from'), conf.get('email.fromname')), subject, new sendgrid.mail.Email(to), new sendgrid.mail.Content('text/plain', text));
        const sg = sendgrid(process.env.SENDGRID_API_KEY);
        const request = sg.emptyRequest({
            host: 'api.sendgrid.com',
            method: 'POST',
            path: '/v3/mail/send',
            headers: {},
            body: mail.toJSON(),
            queryParams: {},
            test: false,
            port: ''
        });
        yield sg.API(request);
    });
}
/**
 * キャンセルメール本文取得
 * @function getCancelMail
 * @param {Request} req
 * @param {any[]}reservations
 * @returns {string}
 */
function getCancelMail(req, reservations, fee) {
    const mail = [];
    const locale = req.session.locale;
    const cancellationFee = numeral(fee).format('0,0');
    // 東京タワー TOP DECK チケットキャンセル完了のお知らせ
    mail.push(req.__('Email.TitleCan'));
    mail.push('');
    // XXXX XXXX 様
    mail.push(req.__('Mr{{name}}', { name: reservations[0].purchaser_name[locale] }));
    mail.push('');
    // この度は、「東京タワー TOP DECK」のオンライン先売りチケットサービスにてご購入頂き、誠にありがとうございます。
    mail.push(req.__('Email.Head1').replace('$theater_name$', reservations[0].theater_name[locale]));
    // お客様がキャンセルされましたチケットの情報は下記の通りです。
    mail.push(req.__('Email.Head2Can'));
    mail.push('');
    // 購入番号
    mail.push(`${req.__('Label.PaymentNo')} : ${reservations[0].payment_no}`);
    // ご来塔日時
    const day = moment(reservations[0].performance_day, 'YYYYMMDD').format('YYYY/MM/DD');
    // tslint:disable-next-line:no-magic-numbers
    const time = `${reservations[0].performance_start_time.substr(0, 2)}:${reservations[0].performance_start_time.substr(2, 2)}`;
    mail.push(`${req.__('Label.Day')} : ${day} ${time}`);
    // 券種、枚数
    mail.push(`${req.__('Label.TicketType')} ${req.__('Label.TicketCount')}`);
    // 券種ごとに合計枚数算出
    const ticketInfos = ticket.editTicketInfos(req, ticket.getTicketInfos(reservations));
    Object.keys(ticketInfos).forEach((key) => {
        mail.push(ticketInfos[key].info);
    });
    mail.push('-------------------------------------');
    // 合計枚数
    mail.push(req.__('Email.TotalTicketCount').replace('$reservations_length$', reservations.length.toString()));
    // キャンセル料
    mail.push(req.__('Email.CancellationFee').replace('$cancellationFee$', cancellationFee));
    mail.push('-------------------------------------');
    mail.push('');
    // なお、このメールは、「$theater_name$」の予約システムでチケットをキャンセル…
    mail.push(req.__('Email.Foot1Can').replace('$theater_name$', reservations[0].theater_name[locale]));
    // ※尚、このメールアドレスは送信専用となっておりますでので、ご返信頂けません。
    mail.push(req.__('Email.Foot2'));
    // ご不明※な点がございましたら、下記番号までお問合わせ下さい。
    mail.push(req.__('Email.Foot3'));
    mail.push('');
    // お問い合わせはこちら
    mail.push(req.__('Email.Access1'));
    mail.push(reservations[0].theater_name[locale]);
    // TEL
    mail.push(`${req.__('Email.Access2')} : ${conf.get('official_tel_number')}`);
    return (mail.join(Text.Common.newline));
}

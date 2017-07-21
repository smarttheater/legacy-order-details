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
const gmo_service_1 = require("@motionpicture/gmo-service");
const GMO = require("@motionpicture/gmo-service");
const ttts_domain_1 = require("@motionpicture/ttts-domain");
//import { Models, ScreenUtil} from '@motionpicture/ttts-domain';
const conf = require("config");
const log4js = require("log4js");
const moment = require("moment");
const numeral = require("numeral");
const sendgrid = require("sendgrid");
const util = require("util");
// // 購入番号 半角9
// const NAME_MAX_LENGTH_PAYMENTNO: number = 9;
// // Tel 半角20
// const NAME_MAX_LENGTH_TEL: number = 20;
// セッションキー
const SESSION_KEY_INQUIRY_RESERVATIONS = 'ttts-ticket-inquiry-reservations';
// ログ出力
const logger = log4js.getLogger('system');
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
            //存在チェック
            const conditions = {
                performance_day: req.body.day,
                payment_no: req.body.paymentNo,
                purchaser_tel: req.body.purchaserTel
            };
            try {
                // 総数検索
                const count = yield ttts_domain_1.Models.Reservation.count(conditions).exec();
                // データ有りの時
                if (count > 0) {
                    // データ検索
                    const reservations = yield ttts_domain_1.Models.Reservation.find(conditions).exec();
                    // 座席コードでソート(必要？)
                    reservations.sort((a, b) => {
                        return ttts_domain_1.ScreenUtil.sortBySeatCode(a.get('seat_code'), b.get('seat_code'));
                    });
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
            // 券種ごとに合計枚数算出
            const keyName = 'ticket_type';
            const ticketInfos = {};
            for (const reservation of reservations) {
                // チケットタイプセット
                const dataValue = reservation[keyName];
                // チケットタイプごとにチケット情報セット
                if (!ticketInfos.hasOwnProperty(dataValue)) {
                    ticketInfos[dataValue] = {
                        ticket_type_name: reservation.ticket_type_name,
                        charge: `\\${numeral(reservation.charge).format('0,0')}`,
                        count: 1
                    };
                }
                else {
                    ticketInfos[dataValue].count += 1;
                }
            }
            const locale = req.session.locale;
            const leaf = req.__('Label.Leaf');
            // 券種ごとの表示情報編集
            Object.keys(ticketInfos).forEach((key) => {
                const ticketInfo = ticketInfos[key];
                // ＠＠＠＠＠
                ticketInfos[key].info = `${ticketInfo.ticket_type_name[locale]} ${ticketInfo.charge} × ${ticketInfo.count}${leaf}`;
            });
            res.render('inquiry/result', {
                moment: moment,
                reservationDocuments: reservations,
                ticketInfos: ticketInfos,
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
            const reservations = yield ttts_domain_1.Models.Reservation.find({
                _id: { $in: ids },
                status: ttts_domain_1.ReservationUtil.STATUS_RESERVED
            }).exec();
            if (reservations.length === 0) {
                next(new Error(req.__('Message.NotFound')));
                return;
            }
            reservations.sort((a, b) => {
                return ttts_domain_1.ScreenUtil.sortBySeatCode(a.get('seat_code'), b.get('seat_code'));
            });
            res.render('reserve/print', {
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
 * 予約キャンセル処理
 * @memberof inquiry
 * @function cancel
 * @param {Request} req
 * @param {Response} res
 * @returns {Promise<void>}
 */
function cancel(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const errorMessage = req.__('Message.UnexpectedError');
        // 検証(プログラムでセットした値なので""の時はシステムエラー扱い)
        validateForCancel(req);
        const validatorResult = yield req.getValidationResult();
        const validations = req.validationErrors(true);
        if (!validatorResult.isEmpty()) {
            res.json({
                success: false,
                validation: validations,
                error: errorMessage
            });
            return;
        }
        // 予約取得
        let reservations;
        let cancellationFee = 0;
        try {
            reservations = req.session[SESSION_KEY_INQUIRY_RESERVATIONS];
            if (reservations[0].payment_method !== gmo_service_1.Util.PAY_TYPE_CREDIT) {
                res.json({
                    success: false,
                    validation: null,
                    error: `${errorMessage}(not credit data)`
                });
                return;
            }
            // キャンセル料セット
            const cancelCharge = Number(conf.get('cancelCharge'));
            cancellationFee = cancelCharge * reservations.length;
            // 金額変更(エラー時はchangeTran内部で例外発生)
            yield GMO.CreditService.changeTran({
                shopId: process.env.GMO_SHOP_ID,
                shopPass: process.env.GMO_SHOP_PASS,
                accessId: reservations[0].gmo_access_id,
                accessPass: reservations[0].gmo_access_pass,
                //jobCd: GMO.Util.JOB_CD_CAPTURE,
                jobCd: reservations[0].gmo_status,
                amount: cancellationFee
            });
        }
        catch (err) {
            // GMO金額変更apiエラーはキャンセルできなかたことをユーザーに知らせる
            res.json({
                success: false,
                validation: null,
                //error: err.message
                error: errorMessage
            });
            return;
        }
        try {
            // キャンセルメール送信
            yield sendEmail(reservations[0].purchaser_email, getCancelMail(reservations));
            logger.info('-----update db start-----');
            // 予約データ解放(AVAILABLEに変更)
            const promises = (reservations.map((reservation) => __awaiter(this, void 0, void 0, function* () {
                yield ttts_domain_1.Models.Reservation.findByIdAndUpdate(reservation._id, {
                    $set: { status: ttts_domain_1.ReservationUtil.STATUS_AVAILABLE },
                    $unset: getUnsetFields(reservation)
                }).exec();
                logger.info('Reservation clear =', JSON.stringify(reservation));
            })));
            yield Promise.all(promises);
            // キャンセルリクエスト保管
            yield ttts_domain_1.Models.CustomerCancelRequest.create({
                reservation: reservations[0],
                tickets: ttts_domain_1.Models.CustomerCancelRequest.getTickets(reservations),
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
    req.checkBody('purchaserTel', req.__('Message.required{{fieldName}}', { fieldName: req.__('Label.Tel') })).notEmpty();
}
/**
 * キャンセル検証
 * @function updateValidation
 * @param {Request} req
 * @returns {void}
 */
function validateForCancel(req) {
    // 購入番号
    req.checkBody('payment_no', req.__('Message.required{{fieldName}}', { fieldName: req.__('Label.PaymentNo') })).notEmpty();
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
 * @param {any[]}reservationsto
 * @returns {string}
 */
function getCancelMail(reservations) {
    const reservation = reservations[0];
    const ticketTypeJa = reservations.map((r) => r.ticket_type_detail_str.ja.replace(/\\/g, '￥')).join('\n');
    const ticketTypeEn = reservations.map((r) => r.ticket_type_detail_str.en.replace(/\\/g, '￥')).join('\n');
    const mail = [];
    mail.push('TTTS_EVENT_NAMEチケット キャンセル完了のお知らせ');
    mail.push('Notice of Completion of Cancel for TTTS Tickets');
    mail.push(`${reservation.purchaser_name.ja} 様`);
    mail.push(`Dear ${reservation.purchaser_name.en},`);
    mail.push('TTTS_EVENT_NAMEの鑑賞キャンセルを受け付けました');
    mail.push('キャンセルした内容は以下の通りとなりますのでご確認ください。');
    mail.push('皆さまに大変ご迷惑をおかけしております事、深くお詫び申し上げます。');
    mail.push('We have received your request for TTTS tickets cancellation.');
    mail.push('Please check your cancellation details as follows. ');
    mail.push('We sincerely apologize for the inconvenience we caused you.');
    mail.push('--------------------');
    mail.push('作品名 (Title) ');
    mail.push(reservation.film_name.ja);
    mail.push(reservation.film_name.en);
    mail.push('購入番号 (Transaction number) :');
    mail.push(reservation.payment_no);
    // 劇場 (Location) :
    // <%- reservations[0].get('location_str').ja %>
    // <%- reservations[0].get('theater_address').ja %>
    // <%- reservations[0].get('theater_name').en %> <%- reservations[0].get('screen_name').en %>
    // <%- reservations[0].get('theater_address').en %>
    mail.push('時間 (Date and time) ');
    mail.push(reservation.performance_start_str.ja);
    mail.push(reservation.performance_start_str.en);
    mail.push('券種 (Type of ticket) :');
    mail.push(ticketTypeJa);
    mail.push(ticketTypeEn);
    if (reservation.payment_method === gmo_service_1.Util.PAY_TYPE_CVS) {
        mail.push('コンビニ決済手数料 (Handling charge) :');
        mail.push(`${ttts_domain_1.ReservationUtil.CHARGE_CVS}x${reservations.length}`);
    }
    mail.push('購入枚数 (Number of tickets purchased) :');
    mail.push(reservations.length.toString());
    mail.push(`${reservations.length} ticket(s)`);
    const totalCharge = reservations.reduce((a, b) => Number(a) + Number(b.charge), 0);
    if (totalCharge > 0) {
        mail.push('合計金額 (Total) :');
        mail.push(`${numeral(totalCharge).format('0,0')}(税込)`);
        mail.push(`${numeral(totalCharge).format('0,0')} yen (including tax)`);
    }
    const seatCode = reservations.map((r) => r.seat_code);
    mail.push('座席番号 (Seat number) :');
    mail.push(seatCode.join('、'));
    mail.push('お客様ならびに関係する皆様に多大なるご迷惑、ご心配をお掛けしたことを重ねてお詫び申し上げます。');
    mail.push('Again, we are deeply sorry for the anxiety and inconvenience we caused you and all parties concerned. ');
    mail.push('TTTS_EVENT_NAME  TTTS 2016');
    mail.push('本メールアドレスは送信専用です。返信はできませんのであらかじめご了承ください。');
    mail.push('本メールに心当たりのない方やチケットに関してご不明な点は、下記電話番号までお問い合わせください。');
    mail.push('チケットのお問合せ：050-3786-0368　/12:00～18:00（休業：土/日/祝日　TTTS_EVENT_NAME開催期間中は無休）');
    mail.push(`オフィシャルサイト： ${conf.get('official_website_url')}`);
    mail.push('This email was sent from a send-only address. Please do not reply to this message.');
    // tslint:disable-next-line:max-line-length
    mail.push('If you are not the intended recipient of this email or have any questions about tickets, contact us at the telephone number below.');
    // tslint:disable-next-line:max-line-length
    mail.push('For inquiries about tickets: 050-3786-0368/12:00 p.m. to 6:00 p.m. (Closed on Saturdays, Sundays, and national holidays, except during TTTS)');
    mail.push(`Official website: ${conf.get('official_website_url')}`);
    return (mail.join('\n'));
}

/**
 * 予約照会コントローラー
 *
 * 上映当日入場画面から使う機能はここにあります。
 *
 * @namespace inquiry
 */
import { Util as GMOUtil } from '@motionpicture/gmo-service';
import * as GMO from '@motionpicture/gmo-service';
import { Models, ReservationUtil, ScreenUtil} from '@motionpicture/ttts-domain';
//import { Models, ScreenUtil} from '@motionpicture/ttts-domain';
import * as conf from 'config';
import { NextFunction, Request, Response } from 'express';
import * as moment from 'moment';
import * as numeral from 'numeral';
import * as sendgrid from 'sendgrid';
import * as util from 'util';

// // 購入番号 半角9
// const NAME_MAX_LENGTH_PAYMENTNO: number = 9;
// // Tel 半角20
// const NAME_MAX_LENGTH_TEL: number = 20;
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
                const message: string = req.__('Message.ReservationNotFound');
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
    const messageNotFound: string = req.__('Message.NotFound');
    try {
        if ( req === null) {
            next(new Error(messageNotFound));
        }
        const reservations = (<any>req.session)[SESSION_KEY_INQUIRY_RESERVATIONS];
        if (!reservations || reservations.length === 0) {
            next(new Error(messageNotFound));

            return;
        }
        // 券種ごとに合計枚数算出
        const keyName: string = 'ticket_type';
        const ticketInfos: {} = {};
        for ( const reservation of reservations) {
            // チケットタイプセット
            const dataValue = reservation[keyName];
            // チケットタイプごとにチケット情報セット
            if (!ticketInfos.hasOwnProperty(dataValue)) {
                (<any>ticketInfos)[dataValue] = {
                    ticket_type_name: reservation.ticket_type_name,
                    charge: `\\${numeral(reservation.charge).format('0,0')}`,
                    count: 1
                };
            } else {
                (<any>ticketInfos)[dataValue].count += 1;
            }
        }
        const locale = (<any>req.session).locale;
        const leaf: string = req.__('Label.Leaf');
        // 券種ごとの表示情報編集
        Object.keys(ticketInfos).forEach((key) => {
            const ticketInfo = (<any>ticketInfos)[key];
            // ＠＠＠＠＠
            (<any>ticketInfos)[key].info = `${ticketInfo.ticket_type_name[locale]} ${ticketInfo.charge} × ${ticketInfo.count}${leaf}`;
        });

        res.render('inquiry/result', {
            moment: moment,
            reservationDocuments: reservations,
            ticketInfos: ticketInfos,
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
    const errorMessage: string = req.__('Message.UnexpectedError');

    // 検証(プログラムでセットした値なので""の時はシステムエラー扱い)
    validateForCancel(req);
    const validatorResult = await req.getValidationResult();
    const validations = req.validationErrors(true);
    if (!validatorResult.isEmpty()) {
        res.json({
            success: false,
            validation: validations,
            error: errorMessage
        });

        return;
    }
    try {
        // 予約取得
        const reservations = (<any>req.session)[SESSION_KEY_INQUIRY_RESERVATIONS];
        if (reservations[0].payment_method !== GMOUtil.PAY_TYPE_CREDIT) {
            res.json({
                success: false,
                validation: null,
                error: `${errorMessage}(not credit data)`
            });

            return;
        }
        // キャンセル料セット
        const cancelCharge: number = 400;
        // 金額変更(エラー時はchangeTran内部で例外発生)
        await GMO.CreditService.changeTran({
            shopId: process.env.GMO_SHOP_ID,
            shopPass: process.env.GMO_SHOP_PASS,
            accessId: reservations[0].gmo_access_id,
            accessPass: reservations[0].gmo_access_pass,
            //jobCd: GMO.Util.JOB_CD_CAPTURE,
            jobCd: reservations[0].gmo_status,
            amount: cancelCharge * reservations.length
        });
        // キャンセルメール送信
        await sendEmail(reservations[0].purchaser_email, getCancelMail(reservations));

        // 予約データ解放(AVAILABLEに変更)
        const promises = ((<any>reservations).map(async(reservation: any) => {
            await Models.Reservation.findByIdAndUpdate(
                reservation._id,
                {
                     status: ReservationUtil.STATUS_AVAILABLE
                }
            ).exec();
        }));
        await Promise.all(promises);

        // キャンセルリクエスト保管
        await Models.CustomerCancelRequest.create({
            reservation: reservations[0],
            tickets: (<any>Models.CustomerCancelRequest).getTickets(reservations),
            cancel_name: `${reservations[0].purchaser_last_name} ${reservations[0].purchaser_first_name}`
        });
        res.json({
            success: true,
            validation: null,
            error: null
        });
    } catch (err) {
        res.json({
            success: false,
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
function validateForCancel(req: Request): void {
    // 購入番号
    const colName: string = req.__('Form.FieldName.PaymentNo');
    req.checkBody('paymentNo', req.__('Message.required{{fieldName}}', { fieldName: colName })).notEmpty();
}
/**
 * メールを送信する
 * @function sendEmail
 * @param {string} to
 * @param {string} text
 * @returns {void}
 */
async function sendEmail(to: string, text: string): Promise<void> {
    const subject = util.format(
        '%s%s %s',
        (process.env.NODE_ENV !== 'production') ? `[${process.env.NODE_ENV}]` : '',
        'TTTS_EVENT_NAMEチケット キャンセル完了のお知らせ',
        'Notice of Completion of Cancel for TTTS Tickets'
    );
    const mail = new sendgrid.mail.Mail(
        new sendgrid.mail.Email(conf.get<string>('email.from'), conf.get<string>('email.fromname')),
        subject,
        new sendgrid.mail.Email(to),
        new sendgrid.mail.Content('text/plain', text)
    );

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
    await sg.API(request);
}
/**
 * キャンセルメール本文取得
 * @function getCancelMail
 * @param {any[]}reservationsto
 * @returns {string}
 */
function getCancelMail(reservations: any[]) : string {
    const reservation = reservations[0];
    const ticketTypeJa: string = reservations.map((r) => r.ticket_type_detail_str.ja.replace(/\\/g, '￥')).join('\n');
    const ticketTypeEn: string = reservations.map((r) => r.ticket_type_detail_str.en.replace(/\\/g, '￥')).join('\n');

    const mail : string[] = [];
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

    if (reservation.payment_method === GMOUtil.PAY_TYPE_CVS) {
        mail.push('コンビニ決済手数料 (Handling charge) :');
        mail.push(`${ReservationUtil.CHARGE_CVS}x${reservations.length}`);
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

    const seatCode: any[] = reservations.map((r) => r.seat_code);
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

    return(mail.join('\n'));
}

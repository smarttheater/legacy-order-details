/**
 * 予約照会コントローラー
 *
 * 上映当日入場画面から使う機能はここにあります。
 *
 * @namespace inquiry
 */
import { Util as GMOUtil } from '@motionpicture/gmo-service';
import * as GMO from '@motionpicture/gmo-service';
import { Models, ReservationUtil, ScreenUtil, TicketTypeGroupUtil } from '@motionpicture/ttts-domain';
import * as conf from 'config';
import { NextFunction, Request, Response } from 'express';
import * as log4js from 'log4js';
import * as moment from 'moment';
import * as numeral from 'numeral';
import * as sendgrid from 'sendgrid';
import * as util from 'util';
import * as Text from '../../common/Const/Text';
import * as ticket from '../../common/Util/ticket';

// セッションキー
const SESSION_KEY_INQUIRY_RESERVATIONS: string = 'ttts-ticket-inquiry-reservations';
const SESSION_KEY_INQUIRY_CANCELLATIONFEE: string = 'ttts-ticket-inquiry-cancellationfee';
// ログ出力
const logger = log4js.getLogger('system');
// キャンセル料(1予約あたり1000円固定)
const CANCEL_CHARGE : number = Number(conf.get<string>('cancelCharge'));
// キャンセル可能な日数(3日前まで)
const CANCELLABLE_DAYS : number = Number(conf.get<string>('cancellableDays'));

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

        // "予約"のデータのみセット(Extra分を削除)
        const reservationDocuments: any[] = [];
        (<any[]>reservations).forEach((reservation) => {
            if ( reservation.status === ReservationUtil.STATUS_RESERVED) {
                reservationDocuments.push(reservation);
            }
        });

        // 券種ごとに合計枚数算出
        const ticketInfos = ticket.editTicketInfos(req, ticket.getTicketInfos(reservationDocuments));
        // キャンセル料取得
        // 2017/11/15 キャンセル料は1予約あたり1000円固定
        //const today = moment().format('YYYYMMDD');
        //const fee: number = getCancellationFee(reservations, today);
        const fee: number = CANCEL_CHARGE;
        //---
        (<any>req.session)[SESSION_KEY_INQUIRY_CANCELLATIONFEE] = fee;
        const cancellationFee: string = numeral(fee).format('0,0');

        // 画面描画
        res.render('inquiry/result', {
            moment: moment,
            reservationDocuments: reservationDocuments,
            ticketInfos: ticketInfos,
            enableCancel: true,
            cancellationFee: cancellationFee,
            layout: 'layouts/inquiry/layout'
        });
    } catch (error) {
        next(error);
    }
}

/**
 * 印刷
 */
export async function print(req: Request, res: Response, next: NextFunction) {
    try {
        const ids: string[] = JSON.parse(req.query.ids);
        const reservations = await Models.Reservation.find(
            {
                _id: { $in: ids },
                status: ReservationUtil.STATUS_RESERVED
            }
        ).exec();

        if (reservations.length === 0) {
            next(new Error(req.__('Message.NotFound')));

            return;
        }

        reservations.sort((a, b) => {
            return ScreenUtil.sortBySeatCode(a.get('seat_code'), b.get('seat_code'));
        });

        res.render('reserve/print', {
            layout: false,
            reservations: reservations
        });
    } catch (error) {
        console.error(error);
        next(new Error(req.__('Message.UnexpectedError')));
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
// tslint:disable-next-line:max-func-body-length
export async function cancel(req: Request, res: Response): Promise<void> {
    let errorMessage: string = req.__('Message.UnexpectedError');
    let cancellationFee: number = 0;
    // 予約取得
    let reservations;
    try {
        reservations = (<any>req.session)[SESSION_KEY_INQUIRY_RESERVATIONS];
        if (reservations[0].payment_method !== GMOUtil.PAY_TYPE_CREDIT) {
            res.json({
                success: false,
                validation: null,
                error: `${errorMessage}(not credit data)`
            });

            return;
        }
        // キャンセル料セット
        cancellationFee = (<any>req.session)[SESSION_KEY_INQUIRY_CANCELLATIONFEE];
    } catch (err) {
        res.json({
            success: false,
            validation: null,
            error: errorMessage
        });

        return;
    }
    // 検証
    //const validations: any = await validateForCancel(req, cancellationFee);
    const validations: any = await validateForCancel(req, reservations[0].performance_day);
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
        await GMO.CreditService.changeTran({
            shopId: <string>process.env.GMO_SHOP_ID,
            shopPass: <string>process.env.GMO_SHOP_PASS,
            accessId: <string>reservations[0].gmo_access_id,
            accessPass: <string>reservations[0].gmo_access_pass,
            jobCd: GMO.Util.JOB_CD_CAPTURE,
            //jobCd: <string>reservations[0].gmo_status,
            amount: cancellationFee
        });
    } catch (err) {
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
        await sendEmail(reservations[0].purchaser_email, getCancelMail(req, reservations, cancellationFee));

        logger.info('-----update db start-----');
        const promises = ((<any>reservations).map(async(reservation: any) => {
            // 2017/11 本体チケットかつ特殊チケットの時、時間ごとの予約データ解放(AVAILABLEに変更)
            if (reservation.ticket_ttts_extension.category !== TicketTypeGroupUtil.TICKET_TYPE_CATEGORY_NORMAL &&
                reservation.seat_code === reservation.reservation_ttts_extension.seat_code_base) {
                await Models.ReservationPerHour.findOneAndUpdate(
                    { reservation_id: reservation._id.toString() },
                    {
                        $set: {status: ReservationUtil.STATUS_AVAILABLE},
                        $unset: {expired_at: 1, reservation_id: 1}
                    },
                    { new: true }
                ).exec();
                logger.info('ReservationPerHour clear reservation_id=', reservation._id.toString());
            }
            // 予約データ解放(AVAILABLEに変更)
            await Models.Reservation.findByIdAndUpdate(
                reservation._id,
                {
                    $set: { status: ReservationUtil.STATUS_AVAILABLE },
                    $unset: getUnsetFields(reservation)
                }
            ).exec();
            logger.info('Reservation clear =', JSON.stringify(reservation));
        }));
        await Promise.all(promises);

        // キャンセルリクエスト保管
        await Models.CustomerCancelRequest.create({
            reservation: reservations[0],
            tickets: (<any>Models.CustomerCancelRequest).getTickets(reservations),
            cancel_name: `${reservations[0].purchaser_last_name} ${reservations[0].purchaser_first_name}`,
            cancellation_fee: cancellationFee
        });
        logger.info('CustomerCancelRequest create =', JSON.stringify(reservations[0]));
        logger.info('-----update db end-----');
    } catch (err) {
        // エラーログ出力(後は手作業で復旧してもらう)
        // tslint:disable-next-line:max-line-length
        logger.error(`payment_no=[${reservations[0].payment_no}] performance_day=[${reservations[0].performance_day}] message=[${err.message}]`);
    } finally {
        // GMO金額変更apiがOKならばユーザーにとってはキャンセル成功
        res.json({
            success: true,
            validation: null,
            error: null
        });
    }
}
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
function getUnsetFields(reservation: any): any {
    const setFields: string[] = [
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
            (<any>unset)[propertyName] = 1;
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
 * @param {string} day
 * @returns {any}
 */
async function validateForCancel(req: Request, day: string): Promise<any> {
    // 購入番号
    req.checkBody('payment_no', req.__('Message.required{{fieldName}}', { fieldName: req.__('Label.PaymentNo') })).notEmpty();

    // 検証
    const validatorResult = await req.getValidationResult();
    const errors = (!validatorResult.isEmpty()) ? req.validationErrors(true) : {};

    // 入塔予定日+キャンセル可能日が本日日付を過ぎていたらエラー
    // if (cancellationFee < 0) {
    //     (<any>errors).cancelDays = {msg: 'キャンセルできる期限を過ぎています。'};
    // }

    // 入塔予定日の3日前までキャンセル可能(3日前を過ぎていたらエラー)
    const today = moment().format('YYYY/MM/DD');
    const maxCancellableDay = moment(day, 'YYYY/MM/DD').add('days', CANCELLABLE_DAYS * -1).format('YYYY/MM/DD');
    if (maxCancellableDay < today) {
        (<any>errors).cancelDays = {msg: 'キャンセルできる期限を過ぎています。'};
    }

    return errors;
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

    const sg = sendgrid(<string>process.env.SENDGRID_API_KEY);
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
 * @param {Request} req
 * @param {any[]}reservations
 * @returns {string}
 */
function getCancelMail(req: Request, reservations: any[], fee: number) : string {
    const mail : string[] = [];
    const locale: string = (<any>req.session).locale;
    const cancellationFee: string = numeral(fee).format('0,0');

    // 東京タワー TOP DECK チケットキャンセル完了のお知らせ
    mail.push(req.__('Email.TitleCan'));
    mail.push('');

    // XXXX XXXX 様
    mail.push(req.__('Mr{{name}}', {name: reservations[0].purchaser_name[locale]}));
    mail.push('');

    // この度は、「東京タワー TOP DECK」のオンライン先売りチケットサービスにてご購入頂き、誠にありがとうございます。
    mail.push(req.__('Email.Head1').replace('$theater_name$', reservations[0].theater_name[locale]));
    // お客様がキャンセルされましたチケットの情報は下記の通りです。
    mail.push(req.__('Email.Head2Can'));
    mail.push('');

    // 購入番号
    mail.push(`${req.__('Label.PaymentNo')} : ${reservations[0].payment_no}`);
    // ご来塔日時
    const day: string = moment(reservations[0].performance_day, 'YYYYMMDD').format('YYYY/MM/DD');
    // tslint:disable-next-line:no-magic-numbers
    const time: string = `${reservations[0].performance_start_time.substr(0, 2)}:${reservations[0].performance_start_time.substr(2, 2)}`;
    mail.push(`${req.__('Label.Day')} : ${day} ${time}`);
    // 券種、枚数
    mail.push(`${req.__('Label.TicketType')} ${req.__('Label.TicketCount')}`);
    // 券種ごとに合計枚数算出
    const ticketInfos = ticket.editTicketInfos(req, ticket.getTicketInfos(reservations));
    Object.keys(ticketInfos).forEach((key: string) => {
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

    return(mail.join(Text.Common.newline));
}

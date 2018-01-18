/**
 * 予約照会コントローラー
 * @namespace controllers.inquiry
 */

import * as tttsapi from '@motionpicture/ttts-api-nodejs-client';
import * as conf from 'config';
import * as createDebug from 'debug';
import { NextFunction, Request, Response } from 'express';
import { BAD_REQUEST, CREATED, INTERNAL_SERVER_ERROR } from 'http-status';
import * as moment from 'moment';
import * as numeral from 'numeral';

import * as Text from '../../common/Const/Text';
import * as ticket from '../../common/Util/ticket';

const debug = createDebug('ttts-authentication:controllers.inquiry');

const authClient = new tttsapi.auth.ClientCredentials({
    domain: <string>process.env.API_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.API_CLIENT_ID,
    clientSecret: <string>process.env.API_CLIENT_SECRET,
    scopes: [
        `${<string>process.env.API_RESOURECE_SERVER_IDENTIFIER}/orders.read-only`,
        `${<string>process.env.API_RESOURECE_SERVER_IDENTIFIER}/performances.read-only`,
        `${<string>process.env.API_RESOURECE_SERVER_IDENTIFIER}/transactions`
    ],
    state: ''
});

const returnOrderTransactionService = new tttsapi.service.transaction.ReturnOrder({
    endpoint: <string>process.env.API_ENDPOINT,
    auth: authClient
});

const orderService = new tttsapi.service.Order({
    endpoint: <string>process.env.API_ENDPOINT,
    auth: authClient
});

// キャンセル料(1予約あたり1000円固定)
const CANCEL_CHARGE: number = 1000;

// 予約可能日数定義
const reserveMaxDateInfo = conf.get<{ [period: string]: number }>('reserve_max_date');

if (process.env.API_CLIENT_ID === undefined) {
    throw new Error('Please set an environment variable \'API_CLIENT_ID\'');
}

/**
 * 予約照会検索
 * @memberof inquiry
 * @function search
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 * @returns {Promise<void>}
 */
export async function search(req: Request, res: Response): Promise<void> {
    let message = '';
    let errors: ExpressValidator.Dictionary<ExpressValidator.MappedError> | null = null;

    // 照会結果セッション初期化
    delete (<Express.Session>req.session).inquiryResult;

    if (req.method === 'POST') {
        // formバリデーション
        validate(req);
        const validatorResult = await req.getValidationResult();
        errors = validatorResult.mapped();
        debug('validatorResult:', validatorResult);
        // 日付編集
        let performanceDay = req.body.day;
        performanceDay = performanceDay.replace(/\-/g, '').replace(/\//g, '');

        if (validatorResult.isEmpty()) {
            try {
                // 注文照会
                debug('inquiring...', req.body.paymentNo);
                const order = await orderService.findByOrderInquiryKey({
                    performanceDay: performanceDay,
                    paymentNo: req.body.paymentNo,
                    telephone: req.body.purchaserTel
                });
                debug('order found.', order.orderNumber);

                let reservations = order.acceptedOffers.map((o) => o.itemOffered);

                // "予約"のデータのみセット(Extra分を削除)
                reservations = reservations.filter((r) => r.status === tttsapi.factory.reservationStatusType.ReservationConfirmed);

                // 返品済であれば入力ミス
                if (order.orderStatus === tttsapi.factory.orderStatus.OrderReturned) {
                    throw new Error(req.__('MistakeInput'));
                }

                // 結果をセッションに保管して結果画面へ遷移
                (<Express.Session>req.session).inquiryResult = {
                    printToken: order.printToken,
                    reservations: reservations
                };
                res.redirect('/inquiry/search/result');

                return;
            } catch (error) {
                // tslint:disable-next-line:prefer-conditional-expression
                if (!(error instanceof tttsapi.factory.errors.NotFound)) {
                    message = req.__('MistakeInput');
                } else {
                    message = error.message;
                }
            }
        }
    }

    const maxDate = moment();
    Object.keys(reserveMaxDateInfo).forEach((key) => {
        maxDate.add(reserveMaxDateInfo[key], <moment.unitOfTime.DurationConstructor>key);
    });
    const reserveMaxDate: string = maxDate.format('YYYY/MM/DD');

    // 予約照会画面描画
    res.render('inquiry/search', {
        message: message,
        errors: errors,
        event: {
            start: moment(),
            end: reserveMaxDate
        },
        reserveMaxDate: reserveMaxDate,
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
    const messageNotFound: string = req.__('NotFound');

    try {
        if (req === null) {
            next(new Error(messageNotFound));
        }

        const inquiryResult = (<Express.Session>req.session).inquiryResult;
        if (inquiryResult === undefined) {
            throw new Error(messageNotFound);
        }

        // 予約ソート
        const reservations = inquiryResult.reservations.sort((a, b) => (a.ticket_type < b.ticket_type) ? 0 : 1);
        if (!Array.isArray(reservations) || reservations.length === 0) {
            next(new Error(messageNotFound));

            return;
        }

        // 券種ごとに合計枚数算出
        const ticketInfos = ticket.editTicketInfos(req, ticket.getTicketInfos(reservations));
        // キャンセル料は1予約あたり1000円固定
        const cancellationFee: string = numeral(CANCEL_CHARGE).format('0,0');

        // 画面描画
        res.render('inquiry/result', {
            printToken: inquiryResult.printToken,
            moment: moment,
            reservations: reservations,
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
 * 予約キャンセル処理
 * @memberof inquiry
 * @function cancel
 * @param {Request} req
 * @param {Response} res
 * @returns {Promise<void>}
 */
// tslint:disable-next-line:max-func-body-length
export async function cancel(req: Request, res: Response): Promise<void> {
    // 予約取得
    let reservations: tttsapi.factory.reservation.event.IReservation[];
    try {
        const inquiryResult = (<Express.Session>req.session).inquiryResult;
        if (inquiryResult === undefined) {
            throw new Error(req.__('NotFound'));
        }

        reservations = inquiryResult.reservations;
    } catch (err) {
        res.status(INTERNAL_SERVER_ERROR).json({
            errors: [{
                message: err.message
            }]
        });

        return;
    }

    const cancellationFee = CANCEL_CHARGE;
    let returnOrderTransaction: { id: string };
    try {
        // キャンセルリクエスト
        returnOrderTransaction = await returnOrderTransactionService.confirm({
            performanceDay: reservations[0].performance_day,
            paymentNo: reservations[0].payment_no,
            cancellationFee: cancellationFee,
            forcibly: false,
            reason: tttsapi.factory.transaction.returnOrder.Reason.Customer
        });
    } catch (err) {
        if (err instanceof tttsapi.factory.errors.Argument) {
            res.status(BAD_REQUEST).json({
                errors: [{
                    message: err.message
                }]
            });
        } else {
            res.status(INTERNAL_SERVER_ERROR).json({
                errors: [{
                    message: err.message
                }]
            });
        }

        return;
    }

    try {
        const emailAttributes: tttsapi.factory.creativeWork.message.email.IAttributes = {
            sender: {
                name: conf.get<string>('email.fromname'),
                email: conf.get<string>('email.from')
            },
            toRecipient: {
                name: reservations[0].purchaser_name,
                email: reservations[0].purchaser_email
            },
            about: req.__('EmailTitleCan'),
            text: getCancelMail(req, reservations, cancellationFee)
        };

        await returnOrderTransactionService.sendEmailNotification({
            transactionId: returnOrderTransaction.id,
            emailMessageAttributes: emailAttributes
        });
        debug('email sent.');
    } catch (err) {
        // no op
        // メール送信に失敗しても、返品処理は走るので、成功
    }

    // セッションから照会結果を削除
    delete (<Express.Session>req.session).inquiryResult;

    res.status(CREATED).json(returnOrderTransaction);
}

/**
 * 予約照会画面検証
 *
 * @param {Request} req
 * @param {string} type
 */
function validate(req: Request): void {
    // 購入番号
    req.checkBody('paymentNo', req.__('NoInput{{fieldName}}', { fieldName: req.__('PaymentNo') })).notEmpty();
    req.checkBody('paymentNo', req.__('NoInput{{fieldName}}', { fieldName: req.__('PaymentNo') })).notEmpty();
    // 電話番号
    //req.checkBody('purchaserTel', req.__('NoInput{{fieldName}}', { fieldName: req.__('Label.Tel') })).notEmpty();
    //req.checkBody('purchaserTel', req.__('NoInput{{fieldName}}', { fieldName: req.__('Label.Tel') })).notEmpty();
    req.checkBody(
        'purchaserTel',
        req.__('Message.minLength{{fieldName}}{{min}}', { fieldName: req.__('Label.Tel'), min: '4' })
    ).len({ min: 4 });
}

/**
 * キャンセルメール本文取得
 * @function getCancelMail
 * @param {Request} req
 * @param {tttsapi.factory.reservation.event.IReservation[]}reservations
 * @returns {string}
 */
function getCancelMail(req: Request, reservations: tttsapi.factory.reservation.event.IReservation[], fee: number): string {
    const mail: string[] = [];
    const locale: string = (<Express.Session>req.session).locale;

    // 東京タワー TOP DECK チケットキャンセル完了のお知らせ
    mail.push(req.__('EmailTitleCan'));
    mail.push('');

    // 姓名編集: 日本語の時は"姓名"他は"名姓"
    const purchaserName = (locale === 'ja') ?
        `${reservations[0].purchaser_last_name} ${reservations[0].purchaser_first_name}` :
        `${reservations[0].purchaser_first_name} ${reservations[0].purchaser_last_name}`;
    // XXXX XXXX 様
    mail.push(req.__('EmailDestinationName{{name}}', { name: purchaserName }));
    mail.push('');

    // この度は、「東京タワー TOP DECK」のオンライン先売りチケットサービスにてご購入頂き、誠にありがとうございます。
    mail.push(req.__('EmailHead1').replace(
        '$theater_name$',
        (locale === 'ja') ? reservations[0].theater_name.ja : reservations[0].theater_name.en
    ));

    // お客様がキャンセルされましたチケットの情報は下記の通りです。
    mail.push(req.__('EmailHead2Can'));
    mail.push('');

    // 購入番号
    mail.push(`${req.__('PaymentNo')} : ${reservations[0].payment_no}`);

    // ご来塔日時
    const day: string = moment(reservations[0].performance_day, 'YYYYMMDD').format('YYYY/MM/DD');
    // tslint:disable-next-line:no-magic-numbers
    const time: string = `${reservations[0].performance_start_time.substr(0, 2)}:${reservations[0].performance_start_time.substr(2, 2)}`;
    mail.push(`${req.__('EmailReserveDate')} : ${day} ${time}`);
    // 券種、枚数
    mail.push(`${req.__('TicketType')} ${req.__('TicketCount')}`);

    // 券種ごとに合計枚数算出
    const ticketInfos = ticket.editTicketInfos(req, ticket.getTicketInfos(reservations));
    Object.keys(ticketInfos).forEach((key: string) => {
        mail.push(ticketInfos[key].info);
    });

    // 合計金額算出
    const price = reservations.reduce((a, b) => a + b.charge, 0);

    mail.push('-------------------------------------');
    // 合計枚数
    mail.push(req.__('EmailTotalTicketCount{{n}}', { n: reservations.length.toString() }));
    // 合計金額
    mail.push(`${req.__('TotalPrice')} ${req.__('{{price}} yen', { price: numeral(price).format('0,0') })}`);
    // キャンセル料
    mail.push(`${req.__('CancellationFee')} ${req.__('{{price}} yen', { price: numeral(fee).format('0,0') })}`);
    mail.push('-------------------------------------');
    mail.push('');

    // ご注意事項
    mail.push(req.__('EmailNotice2Can'));
    // ・チケット購入金額全額をチケット購入時のクレジットカードに返金した後、チケットキャンセル料【1000円】を引き落としさせていただきます。
    mail.push(req.__('EmailNotice3Can'));
    // ・チケットの再購入をされる場合は、最初のお手続きよりご購入ください。
    mail.push(req.__('EmailNotice4Can'));
    // ・チケットを再度購入されてもキャンセル料は返金いたしません。
    mail.push(req.__('EmailNotice5Can'));
    mail.push('');

    // ※よくあるご質問（ＦＡＱ）はこちら
    mail.push(req.__('EmailFAQURL'));
    mail.push((<any>conf.get('official_url_faq_by_locale'))[locale]);
    mail.push('');

    // なお、このメールは、「東京タワー トップデッキツアー」の予約システムでチケットをキャンセル…
    mail.push(req.__('EmailFoot1Can'));
    // ※尚、このメールアドレスは送信専用となっておりますでので、ご返信頂けません。
    mail.push(req.__('EmailFoot2'));
    // ご不明※な点がございましたら、下記番号までお問合わせください。
    mail.push(req.__('EmailFoot3'));
    mail.push('');

    // お問い合わせはこちら
    mail.push(req.__('EmailAccess1'));
    // TEL
    mail.push(req.__('EmailAccess2'));

    return (mail.join(Text.Common.newline));
}

/**
 * 予約照会コントローラー
 * @namespace inquiry
 */

import * as ttts from '@motionpicture/ttts-domain';
import * as conf from 'config';
import * as createDebug from 'debug';
import { NextFunction, Request, Response } from 'express';
import { PhoneNumberFormat, PhoneNumberUtil } from 'google-libphonenumber';
// import * as log4js from 'log4js';
import { INTERNAL_SERVER_ERROR } from 'http-status';
import * as moment from 'moment';
import * as numeral from 'numeral';
import * as sendgrid from 'sendgrid';
import * as util from 'util';

import * as Text from '../../common/Const/Text';
import * as ticket from '../../common/Util/ticket';

const debug = createDebug('ttts-authentication:controllers.inquiry');

// セッションキー
const SESSION_KEY_INQUIRY_RESERVATIONS: string = 'ttts-ticket-inquiry-reservations';
const SESSION_KEY_INQUIRY_CANCELLATIONFEE: string = 'ttts-ticket-inquiry-cancellationfee';
// ログ出力
// const logger = log4js.getLogger('system');
// キャンセル料(1予約あたり1000円固定)
const CANCEL_CHARGE: number = Number(conf.get<string>('cancelCharge'));
// キャンセル可能な日数(3日前まで)
// const CANCELLABLE_DAYS: number = Number(conf.get<string>('cancellableDays'));

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

    if (req.method === 'POST') {
        // formバリデーション
        validate(req);
        const validatorResult = await req.getValidationResult();
        errors = validatorResult.mapped();
        debug('validatorResult:', validatorResult);

        if (validatorResult.isEmpty()) {
            const phoneUtil = PhoneNumberUtil.getInstance();
            const phoneNumber = phoneUtil.parse(req.body.purchaserTel, 'JP');

            // 存在チェック(電話番号は下4桁)
            const conditions = {
                performance_day: req.body.day,
                payment_no: req.body.paymentNo,
                purchaser_tel: phoneUtil.format(phoneNumber, PhoneNumberFormat.E164)
            };
            debug('seaching reservations...', conditions);
            try {
                // 予約検索
                const reservationRepo = new ttts.repository.Reservation(ttts.mongoose.connection);
                const transactionRepo = new ttts.repository.Transaction(ttts.mongoose.connection);

                const reservations = await reservationRepo.reservationModel.find(conditions).exec();
                debug('reservations found.', reservations);

                // データ有りの時
                if (reservations.length > 0) {
                    // 取引に対する返品リクエストがすでにあるかどうか
                    const returnOrderTransaction = await transactionRepo.transactionModel.findOne(
                        {
                            typeOf: ttts.factory.transactionType.ReturnOrder,
                            'object.transaction.id': reservations[0].get('transaction')
                        }
                    ).exec();
                    debug('returnOrderTransaction:', returnOrderTransaction);
                    if (returnOrderTransaction !== null) {
                        throw new Error('Already canceled.');
                    }

                    // 予約照会・検索結果画面へ遷移
                    (<any>req.session)[SESSION_KEY_INQUIRY_RESERVATIONS] = reservations;
                    res.redirect('/inquiry/search/result');

                    return;
                }

                message = req.__('Message.ReservationNotFound');
            } catch (error) {
                message = error.message;
            }
        }
    }

    // 予約照会画面描画
    res.render('inquiry/search', {
        message: message,
        errors: errors,
        event: {
            start: moment(),
            // tslint:disable-next-line:no-magic-numbers
            end: moment().add(2, 'months')
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
        if (req === null) {
            next(new Error(messageNotFound));
        }

        let reservations: ttts.factory.reservation.event.IReservation[] = (<any>req.session)[SESSION_KEY_INQUIRY_RESERVATIONS];
        if (!Array.isArray(reservations) || reservations.length === 0) {
            next(new Error(messageNotFound));

            return;
        }

        // "予約"のデータのみセット(Extra分を削除)
        reservations = reservations.filter((reservation) => reservation.status === ttts.factory.reservationStatusType.ReservationConfirmed);

        // 券種ごとに合計枚数算出
        const ticketInfos = ticket.editTicketInfos(req, ticket.getTicketInfos(reservations));
        // キャンセル料は1予約あたり1000円固定
        const fee: number = CANCEL_CHARGE;

        (<any>req.session)[SESSION_KEY_INQUIRY_CANCELLATIONFEE] = fee;
        const cancellationFee: string = numeral(fee).format('0,0');

        // 画面描画
        res.render('inquiry/result', {
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
 * 印刷
 */
export async function print(req: Request, res: Response, next: NextFunction) {
    try {
        const ids: string[] = JSON.parse(req.query.ids);
        const reservationRepo = new ttts.repository.Reservation(ttts.mongoose.connection);
        const reservations = await reservationRepo.reservationModel.find({
            _id: { $in: ids },
            status: ttts.factory.reservationStatusType.ReservationConfirmed
        }).sort({ seat_code: 1 }).exec();

        if (reservations.length === 0) {
            next(new Error(req.__('Message.NotFound')));

            return;
        }

        res.render('print/print', {
            layout: false,
            reservations: reservations
        });
    } catch (error) {
        next(new Error(req.__('Message.UnexpectedError')));
    }
}

/**
 * PCサーマル印刷 (WindowsでStarPRNTドライバを使用)
 */
export async function pcthermalprint(req: Request, res: Response, next: NextFunction) {
    try {
        const ids: string[] = JSON.parse(req.query.ids);
        const reservationRepo = new ttts.repository.Reservation(ttts.mongoose.connection);
        const reservations = await reservationRepo.reservationModel.find({
            _id: { $in: ids },
            status: ttts.factory.reservationStatusType.ReservationConfirmed
        }).sort({ seat_code: 1 }).exec();

        if (reservations.length === 0) {
            next(new Error(req.__('Message.NotFound')));

            return;
        }

        res.render('print/print_pcthermal', {
            layout: false,
            reservations: reservations
        });
    } catch (error) {
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
    let cancellationFee: number = 0;

    // 予約取得
    let reservations: ttts.factory.reservation.event.IReservation[];
    try {
        reservations = (<any>req.session)[SESSION_KEY_INQUIRY_RESERVATIONS];

        // キャンセル料セット
        cancellationFee = (<any>req.session)[SESSION_KEY_INQUIRY_CANCELLATIONFEE];
    } catch (err) {
        res.status(INTERNAL_SERVER_ERROR).json({
            validation: null,
            error: err.message
        });

        return;
    }

    try {
        // キャンセルリクエスト
        await ttts.service.transaction.returnOrder.confirm({
            performanceDay: reservations[0].performance_day,
            paymentNo: reservations[0].payment_no,
            cancellationFee: cancellationFee
        })(new ttts.repository.Transaction(ttts.mongoose.connection));

        await sendEmail(reservations[0].purchaser_email, getCancelMail(req, reservations, cancellationFee));

        res.json({
            validation: null,
            error: null
        });
    } catch (err) {
        res.status(INTERNAL_SERVER_ERROR).json({
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
    req.checkBody(
        'purchaserTel',
        req.__('Message.minLength{{fieldName}}{{min}}', { fieldName: req.__('Label.Tel'), min: '4' })
    ).len({ min: 4 });
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
function getCancelMail(req: Request, reservations: any[], fee: number): string {
    const mail: string[] = [];
    const locale: string = (<any>req.session).locale;
    const cancellationFee: string = numeral(fee).format('0,0');

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

    return (mail.join(Text.Common.newline));
}

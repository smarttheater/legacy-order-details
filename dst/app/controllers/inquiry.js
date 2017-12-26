"use strict";
/**
 * 予約照会コントローラー
 * @namespace inquiry
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const ttts = require("@motionpicture/ttts-domain");
const conf = require("config");
const createDebug = require("debug");
const http_status_1 = require("http-status");
const moment = require("moment");
const numeral = require("numeral");
const util = require("util");
const Text = require("../../common/Const/Text");
const ticket = require("../../common/Util/ticket");
const debug = createDebug('ttts-authentication:controllers.inquiry');
const redisClient = ttts.redis.createClient({
    host: process.env.REDIS_HOST,
    // tslint:disable-next-line:no-magic-numbers
    port: parseInt(process.env.REDIS_PORT, 10),
    password: process.env.REDIS_KEY,
    tls: { servername: process.env.REDIS_HOST }
});
// セッションキー
const SESSION_KEY_INQUIRY_RESERVATIONS = 'ttts-ticket-inquiry-reservations';
const SESSION_KEY_INQUIRY_CANCELLATIONFEE = 'ttts-ticket-inquiry-cancellationfee';
// キャンセル料(1予約あたり1000円固定)
// const CANCEL_CHARGE: number = Number(conf.get<string>('cancelCharge'));
const CANCEL_CHARGE = 1000;
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
function search(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        let message = '';
        let errors = null;
        if (req.method === 'POST') {
            // formバリデーション
            validate(req);
            const validatorResult = yield req.getValidationResult();
            errors = validatorResult.mapped();
            debug('validatorResult:', validatorResult);
            if (validatorResult.isEmpty()) {
                // 存在チェック(電話番号は下4桁)
                const conditions = {
                    performance_day: req.body.day,
                    payment_no: req.body.paymentNo,
                    purchaser_tel: { $regex: new RegExp(`${req.body.purchaserTel}$`) }
                };
                debug('seaching reservations...', conditions);
                try {
                    // 予約検索
                    const reservationRepo = new ttts.repository.Reservation(ttts.mongoose.connection);
                    const transactionRepo = new ttts.repository.Transaction(ttts.mongoose.connection);
                    const reservations = yield reservationRepo.reservationModel.find(conditions).exec();
                    debug('reservations found.', reservations);
                    // データ有りの時
                    if (reservations.length > 0) {
                        // 取引に対する返品リクエストがすでにあるかどうか
                        const returnOrderTransaction = yield transactionRepo.transactionModel.findOne({
                            typeOf: ttts.factory.transactionType.ReturnOrder,
                            'object.transaction.id': reservations[0].get('transaction')
                        }).exec();
                        debug('returnOrderTransaction:', returnOrderTransaction);
                        if (returnOrderTransaction !== null) {
                            throw new Error(req.__('MistakeInput'));
                        }
                        // 予約照会・検索結果画面へ遷移
                        req.session[SESSION_KEY_INQUIRY_RESERVATIONS] = reservations;
                        res.redirect('/inquiry/search/result');
                        return;
                    }
                    message = req.__('MistakeInput');
                }
                catch (error) {
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
    });
}
exports.search = search;
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
        const messageNotFound = req.__('NotFound');
        try {
            if (req === null) {
                next(new Error(messageNotFound));
            }
            let reservations = req.session[SESSION_KEY_INQUIRY_RESERVATIONS];
            if (!Array.isArray(reservations) || reservations.length === 0) {
                next(new Error(messageNotFound));
                return;
            }
            // "予約"のデータのみセット(Extra分を削除)
            reservations = reservations.filter((reservation) => reservation.status === ttts.factory.reservationStatusType.ReservationConfirmed);
            const tokenRepo = new ttts.repository.Token(redisClient);
            const printToken = yield tokenRepo.createPrintToken(reservations.map((r) => r.id));
            debug('token created.', printToken);
            // 券種ごとに合計枚数算出
            const ticketInfos = ticket.editTicketInfos(req, ticket.getTicketInfos(reservations));
            // キャンセル料は1予約あたり1000円固定
            const fee = CANCEL_CHARGE;
            req.session[SESSION_KEY_INQUIRY_CANCELLATIONFEE] = fee;
            const cancellationFee = numeral(fee).format('0,0');
            // 画面描画
            res.render('inquiry/result', {
                printToken: printToken,
                moment: moment,
                reservations: reservations,
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
        let cancellationFee = 0;
        // 予約取得
        let reservations;
        try {
            reservations = req.session[SESSION_KEY_INQUIRY_RESERVATIONS];
            // キャンセル料セット
            cancellationFee = req.session[SESSION_KEY_INQUIRY_CANCELLATIONFEE];
        }
        catch (err) {
            res.status(http_status_1.INTERNAL_SERVER_ERROR).json({
                errors: [{
                        message: err.message
                    }]
            });
            return;
        }
        let returnOrderTransaction;
        try {
            // キャンセルリクエスト
            returnOrderTransaction = yield ttts.service.transaction.returnOrder.confirm({
                agentId: process.env.API_CLIENT_ID,
                transactionId: reservations[0].transaction,
                cancellationFee: cancellationFee,
                forcibly: false,
                reason: ttts.factory.transaction.returnOrder.Reason.Customer
            })(new ttts.repository.Transaction(ttts.mongoose.connection));
        }
        catch (err) {
            if (err instanceof ttts.factory.errors.Argument) {
                res.status(http_status_1.BAD_REQUEST).json({
                    errors: [{
                            message: err.message
                        }]
                });
            }
            else {
                res.status(http_status_1.INTERNAL_SERVER_ERROR).json({
                    errors: [{
                            message: err.message
                        }]
                });
            }
            return;
        }
        try {
            yield sendEmail(returnOrderTransaction.id, reservations[0].purchaser_name, reservations[0].purchaser_email, getCancelMail(req, reservations, cancellationFee));
        }
        catch (err) {
            // no op
            // メール送信に失敗しても、返品処理は走るので、成功
        }
        // セッションから削除
        delete req.session[SESSION_KEY_INQUIRY_RESERVATIONS];
        res.status(http_status_1.CREATED).json({
            id: returnOrderTransaction.id,
            status: returnOrderTransaction.status
        });
    });
}
exports.cancel = cancel;
/**
 * 予約照会画面検証
 *
 * @param {any} req
 * @param {string} type
 */
function validate(req) {
    // 購入番号
    req.checkBody('paymentNo', req.__('NoInput{{fieldName}}', { fieldName: req.__('PaymentNo') })).notEmpty();
    req.checkBody('paymentNo', req.__('NoInput{{fieldName}}', { fieldName: req.__('PaymentNo') })).notEmpty();
    // 電話番号
    //req.checkBody('purchaserTel', req.__('NoInput{{fieldName}}', { fieldName: req.__('Label.Tel') })).notEmpty();
    //req.checkBody('purchaserTel', req.__('NoInput{{fieldName}}', { fieldName: req.__('Label.Tel') })).notEmpty();
    req.checkBody('purchaserTel', req.__('Message.minLength{{fieldName}}{{min}}', { fieldName: req.__('Label.Tel'), min: '4' })).len({ min: 4 });
}
/**
 * メールを送信する
 * @function sendEmail
 * @param {string} to
 * @param {string} text
 * @returns {void}
 */
function sendEmail(transactionId, name, to, text) {
    return __awaiter(this, void 0, void 0, function* () {
        const subject = util.format('%s%s %s', (process.env.NODE_ENV !== 'production') ? `[${process.env.NODE_ENV}]` : '', 'TTTS_EVENT_NAMEチケット キャンセル完了のお知らせ', 'Notice of Completion of Cancel for TTTS Tickets');
        const emailAttributes = {
            sender: {
                name: conf.get('email.fromname'),
                email: conf.get('email.from')
            },
            toRecipient: {
                name: name,
                email: to
            },
            about: subject,
            text: text
        };
        // メール作成
        const taskRepo = new ttts.repository.Task(ttts.mongoose.connection);
        const emailMessage = ttts.factory.creativeWork.message.email.create({
            identifier: `returnOrderTransaction-${transactionId}`,
            sender: {
                typeOf: 'Corporation',
                name: emailAttributes.sender.name,
                email: emailAttributes.sender.email
            },
            toRecipient: {
                typeOf: ttts.factory.personType.Person,
                name: emailAttributes.toRecipient.name,
                email: emailAttributes.toRecipient.email
            },
            about: emailAttributes.about,
            text: emailAttributes.text
        });
        const taskAttributes = ttts.factory.task.sendEmailNotification.createAttributes({
            status: ttts.factory.taskStatus.Ready,
            runsAt: new Date(),
            remainingNumberOfTries: 10,
            lastTriedAt: null,
            numberOfTried: 0,
            executionResults: [],
            data: {
                transactionId: transactionId,
                emailMessage: emailMessage
            }
        });
        yield taskRepo.save(taskAttributes);
        debug('sendEmail task created.');
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
    // 東京タワー TOP DECK チケットキャンセル完了のお知らせ
    mail.push(req.__('EmailTitleCan'));
    mail.push('');
    // XXXX XXXX 様
    mail.push(req.__('EmailDestinationName{{name}}', { name: reservations[0].purchaser_name }));
    mail.push('');
    // この度は、「東京タワー TOP DECK」のオンライン先売りチケットサービスにてご購入頂き、誠にありがとうございます。
    mail.push(req.__('EmailHead1').replace('$theater_name$', (locale === 'ja') ? reservations[0].theater_name.ja : reservations[0].theater_name.en));
    // お客様がキャンセルされましたチケットの情報は下記の通りです。
    mail.push(req.__('EmailHead2Can'));
    mail.push('');
    // 購入番号
    mail.push(`${req.__('PaymentNo')} : ${reservations[0].payment_no}`);
    // ご来塔日時
    const day = moment(reservations[0].performance_day, 'YYYYMMDD').format('YYYY/MM/DD');
    // tslint:disable-next-line:no-magic-numbers
    const time = `${reservations[0].performance_start_time.substr(0, 2)}:${reservations[0].performance_start_time.substr(2, 2)}`;
    mail.push(`${req.__('EmailReserveDate')} : ${day} ${time}`);
    // 券種、枚数
    mail.push(`${req.__('TicketType')} ${req.__('TicketCount')}`);
    // 券種ごとに合計枚数算出
    const ticketInfos = ticket.editTicketInfos(req, ticket.getTicketInfos(reservations));
    Object.keys(ticketInfos).forEach((key) => {
        mail.push(ticketInfos[key].info);
    });
    mail.push('-------------------------------------');
    // 合計枚数
    mail.push(req.__('EmailTotalTicketCount{{n}}', { n: reservations.length.toString() }));
    // キャンセル料
    mail.push(`${req.__('CancellationFee')} ${req.__('{{price}} yen', { price: fee.toString() })}`);
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
    mail.push(conf.get('official_url_top_by_locale')[locale]);
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

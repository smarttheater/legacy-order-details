/**
 * 予約照会コントローラー
 */
import * as cinerinoapi from '@cinerino/sdk';
import * as conf from 'config';
import { NextFunction, Request, Response } from 'express';
import { BAD_REQUEST, CREATED, INTERNAL_SERVER_ERROR } from 'http-status';
import * as moment from 'moment-timezone';
import * as numeral from 'numeral';

import * as ticket from '../util/ticket';

export const CODE_EXPIRES_IN_SECONDS = 8035200; // 93日

const authClient = new cinerinoapi.auth.ClientCredentials({
    domain: <string>process.env.API_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.API_CLIENT_ID,
    clientSecret: <string>process.env.API_CLIENT_SECRET,
    scopes: [],
    state: ''
});

const returnOrderTransactionService = new cinerinoapi.service.transaction.ReturnOrder({
    endpoint: <string>process.env.CINERINO_API_ENDPOINT,
    auth: authClient
});

const orderService = new cinerinoapi.service.Order({
    endpoint: <string>process.env.CINERINO_API_ENDPOINT,
    auth: authClient
});

// キャンセル料(1予約あたり1000円固定)
const CANCEL_CHARGE: number = 1000;

// 予約可能日数定義
const reserveMaxDateInfo = { days: 60 };

if (process.env.API_CLIENT_ID === undefined) {
    throw new Error('Please set an environment variable \'API_CLIENT_ID\'');
}

/**
 * 注文照会
 */
// tslint:disable-next-line:max-func-body-length
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

        // 日付編集
        let performanceDay = req.body.day;
        performanceDay = performanceDay.replace(/\-/g, '').replace(/\//g, '');

        if (validatorResult.isEmpty()) {
            try {
                const confirmationNumber = `${performanceDay}${req.body.paymentNo}`;
                const confirmationPass = String(req.body.purchaserTel);
                // 注文照会
                // const order = await orderService.findByConfirmationNumber({
                //     confirmationNumber: Number(`${performanceDay}${req.body.paymentNo}`),
                //     customer: { telephone: req.body.purchaserTel }
                // });

                // 識別子で注文検索
                const searchOrdersResult = await orderService.findByIdentifier({
                    limit: 1,
                    identifier: {
                        $all: [
                            { name: 'confirmationNumber', value: confirmationNumber },
                            { name: 'confirmationPass', value: confirmationPass }
                        ]
                    }
                });

                const order = searchOrdersResult.data.shift();
                if (order === undefined) {
                    throw new Error(req.__('MistakeInput'));
                }

                // 返品済であれば入力ミス
                if (order.orderStatus === cinerinoapi.factory.orderStatus.OrderReturned) {
                    throw new Error(req.__('MistakeInput'));
                }

                // 注文承認
                let code: string | undefined;
                try {
                    const authorizeOrderResult = await orderService.authorize({
                        object: {
                            orderNumber: order.orderNumber,
                            customer: { telephone: order.customer.telephone }
                        },
                        result: {
                            expiresInSeconds: CODE_EXPIRES_IN_SECONDS
                        }
                    });
                    code = authorizeOrderResult.code;
                } catch (error) {
                    // tslint:disable-next-line:no-console
                    console.error(error);
                }

                // 結果をセッションに保管して結果画面へ遷移
                (<Express.Session>req.session).inquiryResult = {
                    code: code,
                    order: order
                };
                res.redirect('/inquiry/search/result');

                return;
            } catch (error) {
                // tslint:disable-next-line:prefer-conditional-expression
                if (!(error instanceof cinerinoapi.factory.errors.NotFound)) {
                    message = req.__('MistakeInput');
                } else {
                    message = error.message;
                }
            }
        }
    }

    const maxDate = moment();
    Object.keys(reserveMaxDateInfo).forEach((key) => {
        maxDate.add((<any>reserveMaxDateInfo)[key], <moment.unitOfTime.DurationConstructor>key);
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
        layout: 'layouts/inquiry/layout',
        pageId: 'page_inquiry_search',
        pageClassName: `page-inquiry page-search page-${req.locale}`
    });
}

/**
 * 予約照会結果画面(getのみ)
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

        const reservations = inquiryResult.order.acceptedOffers.map((o) => {
            const unitPrice = ticket.getUnitPriceByAcceptedOffer(o);

            return {
                ...<cinerinoapi.factory.order.IReservation>o.itemOffered,
                unitPrice: unitPrice
            };
        })
            .sort(
                (a, b) => (a.reservedTicket.ticketType.identifier < b.reservedTicket.ticketType.identifier) ? 0 : 1
            );

        // 券種ごとに合計枚数算出
        const ticketInfos = ticket.editTicketInfos(req, ticket.getTicketInfos(inquiryResult.order));
        // キャンセル料は1予約あたり1000円固定
        const cancellationFee: string = numeral(CANCEL_CHARGE).format('0,0');

        // 画面描画
        res.render('inquiry/result', {
            code: inquiryResult.code,
            order: inquiryResult.order,
            moment: moment,
            reservations: reservations,
            ticketInfos: ticketInfos,
            enableCancel: true,
            cancellationFee: cancellationFee,
            layout: 'layouts/inquiry/layout',
            pageId: 'page_inquiry_result',
            pageClassName: `page-inquiry page-result page-complete page-${req.locale}`
        });
    } catch (error) {
        next(error);
    }
}

/**
 * 予約キャンセル処理
 */
// tslint:disable-next-line:max-func-body-length
export async function cancel(req: Request, res: Response): Promise<void> {
    let order: cinerinoapi.factory.order.IOrder;

    try {
        const inquiryResult = (<Express.Session>req.session).inquiryResult;
        if (inquiryResult === undefined) {
            throw new Error(req.__('NotFound'));
        }

        order = inquiryResult.order;
    } catch (err) {
        res.status(INTERNAL_SERVER_ERROR).json({
            errors: [{
                message: err.message
            }]
        });

        return;
    }

    // 返品メール作成
    const emailAttributes: cinerinoapi.factory.creativeWork.message.email.IAttributes = {
        typeOf: cinerinoapi.factory.chevre.creativeWorkType.EmailMessage,
        sender: {
            name: conf.get<string>('email.fromname'),
            email: conf.get<string>('email.from')
        },
        toRecipient: {
            name: <string>order.customer.name,
            email: <string>order.customer.email
        },
        about: req.__('EmailTitleCan'),
        text: getCancelMail(req, order, CANCEL_CHARGE)
    };

    const informOrderUrl = `${process.env.INFORM_ORDER_ENDPOINT}/webhooks/onReturnOrder`;

    // クレジットカード返金アクション
    const refundCreditCardActionsParams: cinerinoapi.factory.transaction.returnOrder.IRefundCreditCardParams[] =
        await Promise.all(order.paymentMethods
            .filter((p) => p.typeOf === cinerinoapi.factory.paymentMethodType.CreditCard)
            .map(async (p) => {
                return {
                    object: {
                        object: [{
                            paymentMethod: {
                                paymentMethodId: p.paymentMethodId
                            }
                        }]
                    },
                    potentialActions: {
                        sendEmailMessage: {
                            object: {
                                toRecipient: {
                                    // 返金メールは管理者へ
                                    email: <string>process.env.DEVELOPER_EMAIL
                                }
                            }
                        },
                        // クレジットカード返金後に注文通知
                        informOrder: [
                            {
                                recipient: {
                                    typeOf: 'WebAPI',
                                    name: '東京タワー返金イベント受信エンドポイント',
                                    url: informOrderUrl
                                }
                            }
                        ]
                    }
                };
            })
        );

    let returnOrderTransaction: { id: string };

    try {
        // 注文返品取引開始
        returnOrderTransaction = await returnOrderTransactionService.start({
            agent: {
                identifier: [
                    // レポート側で使用
                    { name: 'cancellationFee', value: CANCEL_CHARGE.toString() }
                ]
            },
            expires: moment()
                .add(1, 'minute')
                .toDate(),
            object: {
                order: {
                    orderNumber: order.orderNumber,
                    customer: {
                        telephone: order.customer.telephone
                    }
                }
            }
        });

        await returnOrderTransactionService.confirm({
            id: returnOrderTransaction.id,
            potentialActions: {
                returnOrder: {
                    potentialActions: {
                        /**
                         * クレジットカード返金アクションについてカスタマイズする場合に指定
                         */
                        refundCreditCard: refundCreditCardActionsParams,
                        ...{
                            sendEmailMessage: [{
                                object: emailAttributes
                            }]
                        }
                    }
                }
            }
        });
    } catch (err) {
        if (err instanceof cinerinoapi.factory.errors.Argument) {
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

    // セッションから照会結果を削除
    delete (<Express.Session>req.session).inquiryResult;

    res.status(CREATED)
        .json(returnOrderTransaction);
}

/**
 * 予約照会画面検証
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
 */
// tslint:disable-next-line:max-func-body-length
function getCancelMail(
    req: Request,
    order: cinerinoapi.factory.order.IOrder,
    fee: number
): string {
    const reservations = order.acceptedOffers.map((o) => <cinerinoapi.factory.order.IReservation>o.itemOffered);
    const mail: string[] = [];
    const locale: string = (<Express.Session>req.session).locale;

    const paymentNo = order.confirmationNumber;

    // 東京タワー TOP DECK チケットキャンセル完了のお知らせ
    mail.push(req.__('EmailTitleCan'));
    mail.push('');

    // 姓名編集: 日本語の時は"姓名"他は"名姓"
    const purchaserName = (locale === 'ja') ?
        `${order.customer.familyName} ${order.customer.givenName}` :
        `${order.customer.givenName} ${order.customer.familyName}`;
    // XXXX XXXX 様
    mail.push(req.__('EmailDestinationName{{name}}', { name: purchaserName }));
    mail.push('');

    // この度は、「東京タワー TOP DECK」のオンライン先売りチケットサービスにてご購入頂き、誠にありがとうございます。
    mail.push(req.__('EmailHead1').replace(
        '$theater_name$',
        (locale === 'ja')
            ? String((<cinerinoapi.factory.chevre.multilingualString>reservations[0].reservationFor.superEvent.location.name).ja)
            : String((<cinerinoapi.factory.chevre.multilingualString>reservations[0].reservationFor.superEvent.location.name).en)
    ));

    // お客様がキャンセルされましたチケットの情報は下記の通りです。
    mail.push(req.__('EmailHead2Can'));
    mail.push('');

    // 購入番号
    // tslint:disable-next-line:no-magic-numbers
    mail.push(`${req.__('PaymentNo')} : ${paymentNo}`);

    // ご来塔日時
    const day: string = moment(reservations[0].reservationFor.startDate)
        .tz('Asia/Tokyo')
        .format('YYYY/MM/DD');
    const time: string = moment(reservations[0].reservationFor.startDate)
        .tz('Asia/Tokyo')
        .format('HH:mm');
    mail.push(`${req.__('EmailReserveDate')} : ${day} ${time}`);
    // 券種、枚数
    mail.push(`${req.__('TicketType')} ${req.__('TicketCount')}`);

    // 券種ごとに合計枚数算出
    const ticketInfos = ticket.editTicketInfos(req, ticket.getTicketInfos(order));
    Object.keys(ticketInfos).forEach((key: string) => {
        mail.push(ticketInfos[key].info);
    });

    // 合計金額算出
    const price = order.price;

    mail.push('-------------------------------------');
    // 合計枚数
    mail.push(req.__('EmailTotalTicketCount{{n}}', { n: order.acceptedOffers.length.toString() }));
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
    mail.push((conf.get<any>('official_url_faq_by_locale'))[locale]);
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

    return (mail.join('\n'));
}

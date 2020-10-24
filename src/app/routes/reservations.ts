/**
 * 予約ルーター
 */
import * as cinerinoapi from '@cinerino/sdk';
import * as tttsapi from '@motionpicture/ttts-api-nodejs-client';
import { Request, Response, Router } from 'express';
import * as jwt from 'jsonwebtoken';

import { CODE_EXPIRES_IN_SECONDS } from '../controllers/inquiry';
import { chevreReservation2ttts } from '../util/reservation';

const reservationsRouter = Router();

const authClient = new tttsapi.auth.ClientCredentials({
    domain: <string>process.env.API_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.API_CLIENT_ID,
    clientSecret: <string>process.env.API_CLIENT_SECRET,
    scopes: [],
    state: ''
});

const reservationService = new tttsapi.service.Reservation({
    endpoint: <string>process.env.API_ENDPOINT,
    auth: authClient
});

const orderService = new cinerinoapi.service.Order({
    endpoint: <string>process.env.CINERINO_API_ENDPOINT,
    auth: authClient
});

/**
 * チケット印刷(A4)
 * output:thermal→PCサーマル印刷 (WindowsでStarPRNTドライバを使用)
 */
reservationsRouter.get(
    '/print',
    // tslint:disable-next-line:max-func-body-length
    async (req, res, next) => {
        try {
            // tslint:disable-next-line:no-suspicious-comment
            // TODO トークン期限チェック

            // 他所からリンクされてくる時のためURLで言語を指定できるようにしておく (TTTS-230)
            (<any>req.session).locale = req.params.locale;

            let orders: cinerinoapi.factory.order.IOrder[];
            let reservations: tttsapi.factory.reservation.event.IReservation[];

            jwt.verify(<string>req.query.token, <string>process.env.TTTS_TOKEN_SECRET, async (jwtErr, decoded: any) => {
                if (jwtErr instanceof Error) {
                    next(jwtErr);
                } else {
                    // 指定された予約ID
                    const ids = <string[]>decoded.object;

                    // decoded.reservationsが存在する場合に対応する
                    if (Array.isArray(decoded.orders)) {
                        // 注文番号と確認番号で注文照会
                        const printingOrders: { orderNumber: string; confirmationNumber: string }[] = decoded.orders;
                        orders = await Promise.all(printingOrders.map(async (printingOrder) => {
                            const findOrderResult = await orderService.findByConfirmationNumber({
                                confirmationNumber: String(printingOrder.confirmationNumber),
                                orderNumber: String(printingOrder.orderNumber)
                            });

                            if (Array.isArray(findOrderResult)) {
                                return findOrderResult[0];
                            } else {
                                return findOrderResult;
                            }
                        }));

                        // 注文承認
                        await Promise.all(orders.map(async (order) => {
                            await orderService.authorize({
                                object: {
                                    orderNumber: order.orderNumber,
                                    customer: { telephone: order.customer.telephone }
                                },
                                result: {
                                    expiresInSeconds: CODE_EXPIRES_IN_SECONDS
                                }
                            });
                        }));

                        // 予約リストを抽出
                        reservations = orders.reduce<tttsapi.factory.reservation.event.IReservation[]>(
                            (a, b) => {
                                const reservationsByOrder = b.acceptedOffers
                                    // 指定された予約IDに絞る
                                    .filter((offer) => {
                                        return ids.includes((<cinerinoapi.factory.order.IReservation>offer.itemOffered).id);
                                    })
                                    .map((offer) => {
                                        const unitPriceSpec = (<ICompoundPriceSpecification>offer.priceSpecification).priceComponent[0];

                                        const itemOffered = <cinerinoapi.factory.order.IReservation>offer.itemOffered;

                                        // 注文データのticketTypeに単価仕様が存在しないので、補完する
                                        return <any>{
                                            ...itemOffered,
                                            paymentNo: b.confirmationNumber,
                                            paymentMethod: b.paymentMethods[0]?.name,
                                            reservedTicket: {
                                                ...itemOffered.reservedTicket,
                                                ticketType: {
                                                    ...itemOffered.reservedTicket.ticketType,
                                                    priceSpecification: unitPriceSpec
                                                }
                                            }
                                        };
                                    });

                                return [...a, ...reservationsByOrder];

                            },
                            []
                        );
                    } else {
                        reservations = await Promise.all(ids.map(async (id) => reservationService.findById({ id })));
                        reservations = reservations.filter(
                            (r) => r.reservationStatus === tttsapi.factory.chevre.reservationStatusType.ReservationConfirmed
                        );

                        if (reservations.length === 0) {
                            next(new Error(req.__('NotFound')));

                            return;
                        }
                    }

                    renderPrintFormat(req, res)({ reservations });
                }
            });
        } catch (error) {
            next(new Error(req.__('UnexpectedError')));
        }
    }
);

export type ICompoundPriceSpecification
    // tslint:disable-next-line:max-line-length
    = cinerinoapi.factory.chevre.compoundPriceSpecification.IPriceSpecification<cinerinoapi.factory.chevre.priceSpecificationType.UnitPriceSpecification>;

/**
 * 注文番号からチケット印刷(A4)
 * output:thermal→PCサーマル印刷 (WindowsでStarPRNTドライバを使用)
 */
reservationsRouter.get(
    '/printByOrderNumber',
    async (req, res, next) => {
        try {
            // 他所からリンクされてくる時のためURLで言語を指定できるようにしておく
            (<any>req.session).locale = req.params.locale;

            const orderNumber = req.query.orderNumber;
            const confirmationNumber = req.query.confirmationNumber;
            if (typeof orderNumber !== 'string' || orderNumber.length === 0) {
                throw new Error('Order Number required');
            }
            if (typeof confirmationNumber !== 'string' || confirmationNumber.length === 0) {
                throw new Error('Confirmation Number required');
            }

            let order: cinerinoapi.factory.order.IOrder;
            let reservations: tttsapi.factory.reservation.event.IReservation[];

            // Cinerinoで注文照会&注文承認
            const findOrderResult = await orderService.findByConfirmationNumber({
                confirmationNumber: String(confirmationNumber),
                orderNumber: orderNumber
            });

            if (Array.isArray(findOrderResult)) {
                order = findOrderResult[0];
            } else {
                order = findOrderResult;
            }

            if (order === undefined) {
                throw new Error(`${req.__('NotFound')}: Order`);
            }

            // 注文承認
            await orderService.authorize({
                object: {
                    orderNumber: order.orderNumber,
                    customer: { telephone: order.customer.telephone }
                },
                result: {
                    expiresInSeconds: CODE_EXPIRES_IN_SECONDS
                }
            });

            reservations = order.acceptedOffers.map((offer) => {
                const unitPriceSpec = (<ICompoundPriceSpecification>offer.priceSpecification).priceComponent[0];

                const itemOffered = <cinerinoapi.factory.order.IReservation>offer.itemOffered;

                // 注文データのticketTypeに単価仕様が存在しないので、補完する
                return <any>{
                    ...itemOffered,
                    paymentNo: order.confirmationNumber,
                    paymentMethod: order.paymentMethods[0]?.name,
                    reservedTicket: {
                        ...itemOffered.reservedTicket,
                        ticketType: {
                            ...itemOffered.reservedTicket.ticketType,
                            priceSpecification: unitPriceSpec
                        }
                    }
                };
            });

            // ↓動作確認がとれたら削除
            // if (!Array.isArray(reservations)) {
            //     // tttsで予約検索する場合はこちら↓
            //     const searchResult = await reservationService.findByOrderNumber({
            //         orderNumber: orderNumber
            //     });
            //     reservations = searchResult.data;

            //     reservations = reservations.filter(
            //         (r) => r.reservationStatus === tttsapi.factory.chevre.reservationStatusType.ReservationConfirmed
            //     );

            //     if (reservations.length === 0) {
            //         next(new Error(req.__('NotFound')));

            //         return;
            //     }
            // }

            renderPrintFormat(req, res)({ reservations, order });
        } catch (error) {
            next(new Error(error.message));
        }
    }
);

function renderPrintFormat(req: Request, res: Response) {
    return (params: {
        order?: cinerinoapi.factory.order.IOrder;
        reservations: tttsapi.factory.reservation.event.IReservation[];
    }) => {
        // チケットコード順にソート
        const reservations = params.reservations.sort((a, b) => {
            if (a.reservedTicket.ticketType.identifier < b.reservedTicket.ticketType.identifier) {
                return -1;
            }
            if (a.reservedTicket.ticketType.identifier > b.reservedTicket.ticketType.identifier) {
                return 1;
            }

            return 0;
        })
            .map(chevreReservation2ttts);

        const output = req.query.output;
        switch (output) {
            // サーマル印刷 (72mm幅プレプリント厚紙)
            case 'thermal':
                res.render('print/thermal', {
                    layout: false,
                    order: params.order,
                    reservations: reservations
                });

                break;

            // サーマル印刷 (58mm幅普通紙)
            case 'thermal_normal':
                res.render('print/print_pcthermal', {
                    layout: false,
                    order: params.order,
                    reservations: reservations
                });

                break;

            // デフォルトはA4印刷
            default:
                res.render('print/print', {
                    layout: false,
                    order: params.order,
                    reservations: reservations
                });
        }
    };
}

export default reservationsRouter;

"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 予約ルーター
 */
const cinerinoapi = require("@cinerino/sdk");
const tttsapi = require("@motionpicture/ttts-api-nodejs-client");
const express_1 = require("express");
const jwt = require("jsonwebtoken");
const inquiry_1 = require("../controllers/inquiry");
const reservation_1 = require("../util/reservation");
const reservationsRouter = express_1.Router();
const authClient = new tttsapi.auth.ClientCredentials({
    domain: process.env.API_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.API_CLIENT_ID,
    clientSecret: process.env.API_CLIENT_SECRET,
    scopes: [],
    state: ''
});
const reservationService = new tttsapi.service.Reservation({
    endpoint: process.env.API_ENDPOINT,
    auth: authClient
});
const orderService = new cinerinoapi.service.Order({
    endpoint: process.env.CINERINO_API_ENDPOINT,
    auth: authClient
});
/**
 * チケット印刷(A4)
 * output:thermal→PCサーマル印刷 (WindowsでStarPRNTドライバを使用)
 */
reservationsRouter.get('/print', 
// tslint:disable-next-line:max-func-body-length
(req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // 他所からリンクされてくる時のためURLで言語を指定できるようにしておく (TTTS-230)
        req.session.locale = req.params.locale;
        let orders;
        let reservations;
        jwt.verify(req.query.token, process.env.TTTS_TOKEN_SECRET, (jwtErr, decoded) => __awaiter(void 0, void 0, void 0, function* () {
            if (jwtErr instanceof Error) {
                next(jwtErr);
            }
            else {
                // 指定された予約ID
                const ids = decoded.object;
                // decoded.reservationsが存在する場合に対応する
                if (Array.isArray(decoded.orders)) {
                    // 注文番号と確認番号で注文照会
                    const printingOrders = decoded.orders;
                    orders = yield Promise.all(printingOrders.map((printingOrder) => __awaiter(void 0, void 0, void 0, function* () {
                        const findOrderResult = yield orderService.findByConfirmationNumber({
                            confirmationNumber: String(printingOrder.confirmationNumber),
                            orderNumber: String(printingOrder.orderNumber)
                        });
                        if (Array.isArray(findOrderResult)) {
                            return findOrderResult[0];
                        }
                        else {
                            return findOrderResult;
                        }
                    })));
                    // 注文承認
                    yield Promise.all(orders.map((order) => __awaiter(void 0, void 0, void 0, function* () {
                        yield orderService.authorize({
                            object: {
                                orderNumber: order.orderNumber,
                                customer: { telephone: order.customer.telephone }
                            },
                            result: {
                                expiresInSeconds: inquiry_1.CODE_EXPIRES_IN_SECONDS
                            }
                        });
                    })));
                    // 予約リストを抽出
                    reservations = orders.reduce((a, b) => {
                        const reservationsByOrder = b.acceptedOffers
                            // 指定された予約IDに絞る
                            .filter((offer) => {
                            return ids.includes(offer.itemOffered.id);
                        })
                            .map((offer) => {
                            var _a;
                            const unitPriceSpec = offer.priceSpecification.priceComponent[0];
                            const itemOffered = offer.itemOffered;
                            // 注文データのticketTypeに単価仕様が存在しないので、補完する
                            return Object.assign(Object.assign({}, itemOffered), { paymentNo: b.confirmationNumber, paymentMethod: (_a = b.paymentMethods[0]) === null || _a === void 0 ? void 0 : _a.name, reservedTicket: Object.assign(Object.assign({}, itemOffered.reservedTicket), { ticketType: Object.assign(Object.assign({}, itemOffered.reservedTicket.ticketType), { priceSpecification: unitPriceSpec }) }) });
                        });
                        return [...a, ...reservationsByOrder];
                    }, []);
                }
                else {
                    // next(new Error('パラメータを確認できませんでした:orders'));
                    // ↓動作確認がとれたら削除
                    reservations = yield Promise.all(ids.map((id) => __awaiter(void 0, void 0, void 0, function* () { return reservationService.findById({ id }); })));
                    reservations = reservations.filter((r) => r.reservationStatus === tttsapi.factory.chevre.reservationStatusType.ReservationConfirmed);
                    if (reservations.length === 0) {
                        next(new Error(req.__('NotFound')));
                        return;
                    }
                }
                renderPrintFormat(req, res)({ reservations });
            }
        }));
    }
    catch (error) {
        next(new Error(req.__('UnexpectedError')));
    }
}));
/**
 * 注文番号からチケット印刷(A4)
 * output:thermal→PCサーマル印刷 (WindowsでStarPRNTドライバを使用)
 */
reservationsRouter.get('/printByOrderNumber', (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // 他所からリンクされてくる時のためURLで言語を指定できるようにしておく
        req.session.locale = req.params.locale;
        const orderNumber = req.query.orderNumber;
        const confirmationNumber = req.query.confirmationNumber;
        if (typeof orderNumber !== 'string' || orderNumber.length === 0) {
            throw new Error('Order Number required');
        }
        if (typeof confirmationNumber !== 'string' || confirmationNumber.length === 0) {
            throw new Error('Confirmation Number required');
        }
        let order;
        let reservations;
        // Cinerinoで注文照会&注文承認
        const findOrderResult = yield orderService.findByConfirmationNumber({
            confirmationNumber: String(confirmationNumber),
            orderNumber: orderNumber
        });
        if (Array.isArray(findOrderResult)) {
            order = findOrderResult[0];
        }
        else {
            order = findOrderResult;
        }
        if (order === undefined) {
            throw new Error(`${req.__('NotFound')}: Order`);
        }
        // 注文承認
        yield orderService.authorize({
            object: {
                orderNumber: order.orderNumber,
                customer: { telephone: order.customer.telephone }
            },
            result: {
                expiresInSeconds: inquiry_1.CODE_EXPIRES_IN_SECONDS
            }
        });
        reservations = order.acceptedOffers.map((offer) => {
            var _a;
            const unitPriceSpec = offer.priceSpecification.priceComponent[0];
            const itemOffered = offer.itemOffered;
            // 注文データのticketTypeに単価仕様が存在しないので、補完する
            return Object.assign(Object.assign({}, itemOffered), { paymentNo: order.confirmationNumber, paymentMethod: (_a = order.paymentMethods[0]) === null || _a === void 0 ? void 0 : _a.name, reservedTicket: Object.assign(Object.assign({}, itemOffered.reservedTicket), { ticketType: Object.assign(Object.assign({}, itemOffered.reservedTicket.ticketType), { priceSpecification: unitPriceSpec }) }) });
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
    }
    catch (error) {
        next(new Error(error.message));
    }
}));
function renderPrintFormat(req, res) {
    return (params) => {
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
            .map(reservation_1.chevreReservation2ttts);
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
exports.default = reservationsRouter;

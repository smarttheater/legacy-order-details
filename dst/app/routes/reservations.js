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
reservationsRouter.get('/print', (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // tslint:disable-next-line:no-suspicious-comment
        // TODO トークン期限チェック
        // 他所からリンクされてくる時のためURLで言語を指定できるようにしておく (TTTS-230)
        req.session.locale = req.params.locale;
        jwt.verify(req.query.token, process.env.TTTS_TOKEN_SECRET, (jwtErr, decoded) => __awaiter(void 0, void 0, void 0, function* () {
            if (jwtErr instanceof Error) {
                next(jwtErr);
            }
            else {
                const ids = decoded.object;
                let reservations = yield Promise.all(ids.map((id) => __awaiter(void 0, void 0, void 0, function* () { return reservationService.findById({ id }); })));
                reservations = reservations.filter((r) => r.reservationStatus === tttsapi.factory.chevre.reservationStatusType.ReservationConfirmed);
                if (reservations.length === 0) {
                    next(new Error(req.__('NotFound')));
                    return;
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
        // 他所からリンクされてくる時のためURLで言語を指定できるようにしておく (TTTS-230)
        req.session.locale = req.params.locale;
        const orderNumber = req.query.orderNumber;
        if (typeof orderNumber !== 'string' || orderNumber.length === 0) {
            throw new Error('Order Number required');
        }
        const confirmationNumber = req.query.confirmationNumber;
        // confirmationNumberの指定があれば、Cinerinoで注文照会&注文承認
        if (typeof confirmationNumber === 'string' && confirmationNumber.length > 0) {
            try {
                // 注文照会
                const findOrderResult = yield orderService.findByConfirmationNumber({
                    confirmationNumber: String(confirmationNumber),
                    orderNumber: orderNumber
                });
                let order;
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
            }
            catch (error) {
                // tslint:disable-next-line:no-console
                console.error(error);
            }
        }
        const searchResult = yield reservationService.findByOrderNumber({
            orderNumber: orderNumber
        });
        let reservations = searchResult.data;
        reservations = reservations.filter((r) => r.reservationStatus === tttsapi.factory.chevre.reservationStatusType.ReservationConfirmed);
        if (reservations.length === 0) {
            next(new Error(req.__('NotFound')));
            return;
        }
        renderPrintFormat(req, res)({ reservations });
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
                    reservations: reservations
                });
                break;
            // サーマル印刷 (58mm幅普通紙)
            case 'thermal_normal':
                res.render('print/print_pcthermal', {
                    layout: false,
                    reservations: reservations
                });
                break;
            // デフォルトはA4印刷
            default:
                res.render('print/print', {
                    layout: false,
                    reservations: reservations
                });
        }
    };
}
exports.default = reservationsRouter;

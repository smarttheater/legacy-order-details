"use strict";
/**
 * 予約ルーター
 * @ignore
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
const tttsapi = require("@motionpicture/ttts-api-nodejs-client");
const createDebug = require("debug");
const express_1 = require("express");
const jwt = require("jsonwebtoken");
const reservationsRouter = express_1.Router();
const debug = createDebug('ttts-authentication:routes:reservations');
const authClient = new tttsapi.auth.ClientCredentials({
    domain: process.env.API_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.API_CLIENT_ID,
    clientSecret: process.env.API_CLIENT_SECRET,
    scopes: [
        `${process.env.API_RESOURECE_SERVER_IDENTIFIER}/reservations.read-only`
    ],
    state: ''
});
const reservationService = new tttsapi.service.Reservation({
    endpoint: process.env.API_ENDPOINT,
    auth: authClient
});
/**
 * チケット印刷(A4)
 * output:thermal→PCサーマル印刷 (WindowsでStarPRNTドライバを使用)
 */
reservationsRouter.get('/print', (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        // tslint:disable-next-line:no-suspicious-comment
        // TODO トークン期限チェック
        // 他所からリンクされてくる時のためURLで言語を指定できるようにしておく (TTTS-230)
        req.session.locale = req.params.locale;
        jwt.verify(req.query.token, process.env.TTTS_TOKEN_SECRET, (jwtErr, decoded) => __awaiter(this, void 0, void 0, function* () {
            if (jwtErr instanceof Error) {
                next(jwtErr);
            }
            else {
                debug('token verified.', decoded.object);
                const ids = decoded.object;
                let reservations = yield Promise.all(ids.map((id) => __awaiter(this, void 0, void 0, function* () { return reservationService.findById({ id: id }); })));
                reservations = reservations.filter((r) => r.status === tttsapi.factory.reservationStatusType.ReservationConfirmed);
                if (reservations.length === 0) {
                    next(new Error(req.__('NotFound')));
                    return;
                }
                // チケットコード順にソート
                reservations.sort((a, b) => {
                    if (a.ticket_type < b.ticket_type) {
                        return -1;
                    }
                    if (a.ticket_type > b.ticket_type) {
                        return 1;
                    }
                    return 0;
                });
                const output = req.query.output;
                switch (output) {
                    // サーマル印刷
                    case 'thermal':
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
                        break;
                }
            }
        }));
    }
    catch (error) {
        next(new Error(req.__('UnexpectedError')));
    }
}));
exports.default = reservationsRouter;

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
const ttts = require("@motionpicture/ttts-domain");
const createDebug = require("debug");
const express_1 = require("express");
const reservationsRouter = express_1.Router();
const debug = createDebug('ttts-authentication:routes:reservations');
const redisClient = ttts.redis.createClient({
    host: process.env.REDIS_HOST,
    // tslint:disable-next-line:no-magic-numbers
    port: parseInt(process.env.REDIS_PORT, 10),
    password: process.env.REDIS_KEY,
    tls: { servername: process.env.REDIS_HOST }
});
/**
 * チケット印刷(A4)
 */
reservationsRouter.get('/print', (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const tokenRepo = new ttts.repository.Token(redisClient);
        const ids = yield tokenRepo.verifyPrintToken(req.query.token);
        debug('token verified.', ids);
        const reservationRepo = new ttts.repository.Reservation(ttts.mongoose.connection);
        const reservations = yield reservationRepo.reservationModel.find({
            _id: { $in: ids },
            status: ttts.factory.reservationStatusType.ReservationConfirmed
        }).sort({ seat_code: 1 }).exec();
        if (reservations.length === 0) {
            next(new Error(req.__('NotFound')));
            return;
        }
        res.render('print/print', {
            layout: false,
            reservations: reservations
        });
    }
    catch (error) {
        next(new Error(req.__('UnexpectedError')));
    }
}));
/**
 * PCサーマル印刷 (WindowsでStarPRNTドライバを使用)
 */
reservationsRouter.get('/print_pcthermal', (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const tokenRepo = new ttts.repository.Token(redisClient);
        const ids = yield tokenRepo.verifyPrintToken(req.query.token);
        debug('token verified.', ids);
        const reservationRepo = new ttts.repository.Reservation(ttts.mongoose.connection);
        const reservations = yield reservationRepo.reservationModel.find({
            _id: { $in: ids },
            status: ttts.factory.reservationStatusType.ReservationConfirmed
        }).sort({ seat_code: 1 }).exec();
        if (reservations.length === 0) {
            next(new Error(req.__('NotFound')));
            return;
        }
        res.render('print/print_pcthermal', {
            layout: false,
            reservations: reservations
        });
    }
    catch (error) {
        next(new Error(req.__('UnexpectedError')));
    }
}));
exports.default = reservationsRouter;

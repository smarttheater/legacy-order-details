"use strict";
/**
 * 入場コントローラー
 * 上映当日入場画面から使う機能はここにあります。
 * @namespace controllers.checkIn
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
const http_status_1 = require("http-status");
const moment = require("moment-timezone");
const _ = require("underscore");
const debug = createDebug('ttts-authentication:controllers:checkIn');
const authClient = new tttsapi.auth.ClientCredentials({
    domain: process.env.API_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.API_CLIENT_ID,
    clientSecret: process.env.API_CLIENT_SECRET,
    scopes: [
        `${process.env.API_RESOURECE_SERVER_IDENTIFIER}/reservations.read-only`,
        `${process.env.API_RESOURECE_SERVER_IDENTIFIER}/reservations.checkins`
    ],
    state: ''
});
const reservationService = new tttsapi.service.Reservation({
    endpoint: process.env.API_ENDPOINT,
    auth: authClient
});
/**
 * QRコード認証画面
 * @desc Rコードを読み取って結果を表示するための画面
 */
function confirm(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (req === null) {
            next(new Error('unexepected error'));
        }
        try {
            res.render('checkIn/confirm', {
                checkinAdminUser: req.checkinAdminUser,
                layout: 'layouts/checkIn/layout'
            });
        }
        catch (error) {
            next(new Error('unexepected error'));
        }
    });
}
exports.confirm = confirm;
// for kusunose test
function confirmTest(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (req === null) {
                next(new Error('unexepected error'));
            }
            res.render('checkIn/confirmTest', {
                checkinAdminUser: req.checkinAdminUser,
                layout: 'layouts/checkIn/layout'
            });
        }
        catch (error) {
            next(new Error('unexepected error'));
        }
    });
}
exports.confirmTest = confirmTest;
/**
 * 予約情報取得
 */
function getReservations(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const now = moment();
            // 予約を検索
            const searchReservationsResult = yield reservationService.search({
                limit: 1,
                typeOf: tttsapi.factory.chevre.reservationType.EventReservation,
                status: tttsapi.factory.reservationStatusType.ReservationConfirmed,
                performance: (!_.isEmpty(req.body.performanceId)) ? req.body.performanceId : undefined,
                performanceStartThrough: now.toDate(),
                performanceEndFrom: now.toDate()
            });
            const reservations = searchReservationsResult.data;
            debug(reservations.length, 'reservations found.');
            const reservationsById = {};
            const reservationIdsByQrStr = {};
            reservations.forEach((reservation) => {
                reservationsById[reservation.id] = reservation;
                reservationIdsByQrStr[reservation.id] = reservation.id;
            });
            res.json({
                error: null,
                reservationsById: reservationsById,
                reservationIdsByQrStr: reservationIdsByQrStr
            });
        }
        catch (error) {
            res.json({
                error: '予約情報取得失敗'
            });
        }
    });
}
exports.getReservations = getReservations;
/**
 * 予約情報取得
 */
function getReservation(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        if (req.checkinAdminUser === undefined) {
            throw new Error('checkinAdminUser not defined.');
        }
        if (!req.checkinAdminUser.isAuthenticated()) {
            throw new Error('checkinAdminUser not authenticated.');
        }
        try {
            const reservation = yield getReservationByQR(req.params.qr);
            if (reservation.status !== tttsapi.factory.reservationStatusType.ReservationConfirmed) {
                res.status(http_status_1.NOT_FOUND).json(null);
            }
            else {
                res.json(reservation);
            }
        }
        catch (error) {
            if (error.code === http_status_1.NOT_FOUND) {
                res.status(http_status_1.NOT_FOUND).json(null);
                return;
            }
            res.status(http_status_1.INTERNAL_SERVER_ERROR).json({
                error: '予約情報取得失敗',
                message: error
            });
        }
    });
}
exports.getReservation = getReservation;
/**
 * チェックイン作成
 */
function addCheckIn(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (req.checkinAdminUser === undefined) {
                throw new Error('checkinAdminUser not defined.');
            }
            if (!req.checkinAdminUser.isAuthenticated()) {
                throw new Error('checkinAdminUser not authenticated.');
            }
            if (!req.body.when || !req.body.where || !req.body.how) {
                res.status(http_status_1.BAD_REQUEST).json({
                    error: 'チェックイン情報作成失敗',
                    message: 'Invalid checkin.'
                });
                return;
            }
            const checkin = {
                when: moment(req.body.when).toDate(),
                where: req.body.where,
                why: '',
                how: req.body.how
            };
            yield reservationService.addCheckin({
                reservationId: req.params.qr,
                checkin: checkin
            });
            res.status(http_status_1.CREATED).json(checkin);
        }
        catch (error) {
            res.status(http_status_1.INTERNAL_SERVER_ERROR).json({
                error: 'チェックイン情報作成失敗',
                message: error.message
            });
        }
    });
}
exports.addCheckIn = addCheckIn;
/**
 * チェックイン取り消し
 */
function removeCheckIn(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (req.checkinAdminUser === undefined) {
                throw new Error('checkinAdminUser not defined.');
            }
            if (!req.checkinAdminUser.isAuthenticated()) {
                throw new Error('checkinAdminUser not authenticated.');
            }
            if (!req.body.when) {
                res.status(http_status_1.BAD_REQUEST).json({
                    error: 'チェックイン取り消し失敗',
                    message: 'Invalid request.'
                });
                return;
            }
            yield reservationService.cancelCheckin({
                reservationId: req.params.qr,
                when: moment(req.body.when).toDate()
            });
            res.status(http_status_1.NO_CONTENT).end();
        }
        catch (error) {
            res.status(http_status_1.INTERNAL_SERVER_ERROR).json({
                error: 'チェックイン取り消し失敗',
                message: error.message
            });
        }
    });
}
exports.removeCheckIn = removeCheckIn;
/**
 * 文字列から予約情報取得
 */
function getReservationByQR(qr) {
    return __awaiter(this, void 0, void 0, function* () {
        return reservationService.findById({ id: qr });
    });
}

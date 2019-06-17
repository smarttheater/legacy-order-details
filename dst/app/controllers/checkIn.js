"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 入場コントローラー
 * 上映当日入場画面から使う機能はここにあります。
 */
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
                limit: 100,
                typeOf: tttsapi.factory.chevre.reservationType.EventReservation,
                status: tttsapi.factory.reservationStatusType.ReservationConfirmed,
                performance: (!_.isEmpty(req.body.performanceId)) ? req.body.performanceId : undefined,
                performanceStartThrough: now.toDate(),
                performanceEndFrom: now.toDate()
            });
            const reservations = searchReservationsResult.data.map(chevreReservation2ttts);
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
            if (reservation.reservationStatus !== tttsapi.factory.reservationStatusType.ReservationConfirmed) {
                res.status(http_status_1.NOT_FOUND).json(null);
            }
            else {
                res.json(chevreReservation2ttts(reservation));
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
function chevreReservation2ttts(params) {
    const ticketType = params.reservedTicket.ticketType;
    const underName = params.underName;
    let paymentMethod;
    if (underName !== undefined && Array.isArray(underName.identifier)) {
        const paymentMethodProperty = underName.identifier.find((p) => p.name === 'paymentMethod');
        if (paymentMethodProperty !== undefined) {
            paymentMethod = paymentMethodProperty.value;
        }
    }
    params.qr_str = params.id;
    params.payment_no = params.reservationNumber;
    params.performance = params.reservationFor.id;
    params.performance_day = moment(params.reservationFor.startDate)
        .tz('Asia/Tokyo')
        .format('YYYYMMDD');
    params.performance_end_date = moment(params.reservationFor.endDate)
        .toDate();
    params.performance_end_time = moment(params.reservationFor.endDate)
        .tz('Asia/Tokyo')
        .format('HHmm');
    params.performance_start_date = moment(params.reservationFor.startDate)
        .toDate();
    params.performance_start_time = moment(params.reservationFor.startDate)
        .tz('Asia/Tokyo')
        .format('HHmm');
    params.charge = (ticketType.priceSpecification !== undefined) ? ticketType.priceSpecification.price : 0;
    params.payment_method = (paymentMethod !== undefined) ? paymentMethod : '';
    params.seat_code = (params.reservedTicket.ticketedSeat !== undefined) ? params.reservedTicket.ticketedSeat.seatNumber : '';
    params.ticket_type = ticketType.identifier;
    params.ticket_type_charge = (ticketType.priceSpecification !== undefined) ? ticketType.priceSpecification.price : 0;
    params.ticket_type_name = ticketType.name;
    params.purchaser_email = (underName !== undefined && underName.email !== undefined) ? underName.email : '';
    params.purchaser_first_name = (underName !== undefined && underName.givenName !== undefined) ? underName.givenName : '';
    params.purchaser_last_name = (underName !== undefined && underName.familyName !== undefined) ? underName.familyName : '';
    params.purchaser_tel = (underName !== undefined && underName.telephone !== undefined) ? underName.telephone : '';
    params.purchaser_name = (underName !== undefined && underName.name !== undefined) ? underName.name : '';
    return params;
}
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

"use strict";
/**
 * 入場コントローラー
 * 上映当日入場画面から使う機能はここにあります。
 * @namespace checkIn
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
const http_status_1 = require("http-status");
const moment = require("moment");
const _ = require("underscore");
/**
 * QRコード認証画面
 * @desc Rコードを読み取って結果を表示するための画面
 * @memberof checkIn
 * @function confirm
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 * @returns {Promise<void>}
 */
function confirm(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (req === null) {
            next(new Error('unexepected error'));
        }
        try {
            res.render('checkIn/confirm', {
                staffUser: req.staffUser,
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
                staffUser: req.staffUser,
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
 * @memberof checkIn
 * @function getReservations
 * @param {Request} req
 * @param {Response} res
 * @returns {Promise<void>}
 */
function getReservations(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // 予約検索条件(デフォルトはReservationConfirmedステータス)
            const conditions = {
                status: ttts.factory.reservationStatusType.ReservationConfirmed
            };
            if (!_.isEmpty(req.body.performanceId)) {
                conditions.performance = req.body.performanceId;
            }
            else {
                // パフォーマンスの指定がなければ、その時点での上映を指定する
                const now = moment();
                const day = now.format('YYYYMMDD');
                const time = now.format('HHmm');
                conditions.performance_day = day;
                conditions.performance_start_time = { $lte: time };
                conditions.performance_end_time = { $gte: time };
            }
            // 予約を検索
            const reservationRepo = new ttts.repository.Reservation(ttts.mongoose.connection);
            const reservations = yield reservationRepo.reservationModel.find(conditions).exec();
            const reservationsById = {};
            const reservationIdsByQrStr = {};
            reservations.forEach((reservation) => {
                reservationsById[reservation.get('_id').toString()] = reservation;
                reservationIdsByQrStr[reservation.get('qr_str')] = reservation.get('_id').toString();
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
 * @memberof checkIn
 * @function getReservation
 * @param {Request} req
 * @param {Response} res
 * @returns {Promise<void>}
 */
function getReservation(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        if (req.staffUser === undefined) {
            throw new Error('staffUser not defined.');
        }
        if (!req.staffUser.isAuthenticated()) {
            throw new Error('staffUser not authenticated.');
        }
        try {
            const reservation = yield getReservationByQR(req.params.qr);
            if (reservation === null) {
                res.status(http_status_1.NOT_FOUND).json(null);
            }
            else {
                res.json(reservation);
            }
        }
        catch (error) {
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
 * @memberof checkIn
 * @function addCheckIn
 * @param {Request} req
 * @param {Response} res
 * @returns {Promise<void>}
 */
function addCheckIn(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (req.staffUser === undefined) {
                throw new Error('staffUser not defined.');
            }
            if (!req.staffUser.isAuthenticated()) {
                throw new Error('staffUser not authenticated.');
            }
            if (!req.body.when || !req.body.where || !req.body.how) {
                res.status(http_status_1.BAD_REQUEST).json({
                    error: 'チェックイン情報作成失敗',
                    message: 'Invalid checkin.'
                });
                return;
            }
            const checkin = {
                when: req.body.when,
                where: req.body.where,
                why: '',
                how: req.body.how
            };
            const reservationRepo = new ttts.repository.Reservation(ttts.mongoose.connection);
            const newReservation = yield reservationRepo.reservationModel.findOneAndUpdate({
                qr_str: req.params.qr
            }, {
                $push: {
                    checkins: checkin
                }
            }, { new: true }).exec();
            if (newReservation === null) {
                res.status(http_status_1.NOT_FOUND).json(null);
            }
            else {
                res.status(http_status_1.CREATED).json(checkin);
            }
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
 * @memberof checkIn
 * @function addCheckIn
 * @param {Request} req
 * @param {Response} res
 * @returns {Promise<void>}
 */
function removeCheckIn(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (req.staffUser === undefined) {
                throw new Error('staffUser not defined.');
            }
            if (!req.staffUser.isAuthenticated()) {
                throw new Error('staffUser not authenticated.');
            }
            if (!req.body.when) {
                res.status(http_status_1.BAD_REQUEST).json({
                    error: 'チェックイン取り消し失敗',
                    message: 'Invalid request.'
                });
                return;
            }
            const reservationRepo = new ttts.repository.Reservation(ttts.mongoose.connection);
            const newReservation = yield reservationRepo.reservationModel.findOneAndUpdate({
                qr_str: req.params.qr
            }, {
                $pull: {
                    checkins: { when: req.body.when }
                }
            }, { new: true }).exec();
            if (newReservation === null) {
                res.status(http_status_1.NOT_FOUND).json(null);
            }
            else {
                res.status(http_status_1.NO_CONTENT).end();
            }
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
 * QR文字列から予約情報取得
 * @memberof checkIn
 * @function getReservationByQR
 * @param {string} qr
 * @returns {Promise<any>}
 */
function getReservationByQR(qr) {
    return __awaiter(this, void 0, void 0, function* () {
        const reservationRepo = new ttts.repository.Reservation(ttts.mongoose.connection);
        return reservationRepo.reservationModel.findOne({
            qr_str: qr,
            status: ttts.factory.reservationStatusType.ReservationConfirmed
        }).exec().then((doc) => (doc === null) ? null : doc.toObject());
    });
}

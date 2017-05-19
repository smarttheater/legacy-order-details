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
 *
 * 上映当日入場画面から使う機能はここにあります。
 *
 * @namespace checkIn
 */
const ttts_domain_1 = require("@motionpicture/ttts-domain");
const ttts_domain_2 = require("@motionpicture/ttts-domain");
const ttts_domain_3 = require("@motionpicture/ttts-domain");
const _ = require("underscore");
/**
 * 入場画面のパフォーマンス検索
 * @memberof checkIn
 * @function performances
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 * @returns {Promise<void>}
 */
function performances(__, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // 劇場とスクリーンを取得
            const theaters = yield ttts_domain_1.Models.Theater.find({}, 'name').exec();
            const screens = yield ttts_domain_1.Models.Screen.find({}, 'name theater').exec();
            const screensByTheater = {};
            screens.forEach((screen) => {
                if (screensByTheater[screen.get('theater')] === undefined) {
                    screensByTheater[screen.get('theater')] = [];
                }
                screensByTheater[screen.get('theater')].push(screen);
            });
            res.render('checkIn/performances', {
                FilmUtil: ttts_domain_3.FilmUtil,
                theaters: theaters,
                screensByTheater: screensByTheater,
                event: {
                    start: '2016-10-25T00:00:00+09:00',
                    end: '2017-12-31T23:59:59+09:00'
                },
                layout: 'layouts/checkIn/layout'
            });
            return;
        }
        catch (error) {
            next(error);
        }
    });
}
exports.performances = performances;
/**
 * 入場画面のパフォーマンス選択
 * @memberof checkIn
 * @function performanceSelect
 * @param {Request} req
 * @param {Response} res
 * @returns {Promise<void>}
 */
function performanceSelect(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!_.isEmpty(req.body.performanceId)) {
            res.redirect(`/checkin/performance/${req.body.performanceId}/confirm`);
        }
        else {
            res.redirect('/checkin/performances');
        }
    });
}
exports.performanceSelect = performanceSelect;
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
        try {
            const performance = yield ttts_domain_1.Models.Performance.findOne({ _id: req.params.id })
                .populate('film', 'name')
                .populate('screen', 'name')
                .populate('theater', 'name')
                .exec();
            res.render('checkIn/confirm', {
                performance: performance,
                layout: 'layouts/checkIn/layout'
            });
        }
        catch (error) {
            next(new Error('unexepected error'));
        }
    });
}
exports.confirm = confirm;
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
            const id = req.body.id;
            const reservations = yield ttts_domain_1.Models.Reservation.find({
                performance: id,
                status: ttts_domain_2.ReservationUtil.STATUS_RESERVED
            }).exec();
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
            console.error(error);
            res.json({
                error: '予約情報取得失敗'
            });
        }
    });
}
exports.getReservations = getReservations;

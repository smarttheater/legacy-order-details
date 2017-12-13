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
const ttts = require("@motionpicture/ttts-domain");
const moment = require("moment");
const _ = require("underscore");
// /**
//  * 入場画面のパフォーマンス検索
//  * @memberof checkIn
//  * @function performances
//  * @param {Request} req
//  * @param {Response} res
//  * @param {NextFunction} next
//  * @returns {Promise<void>}
//  */
// export async function performances(__: Request, res: Response, next: NextFunction): Promise<void> {
//     try {
//         // 劇場とスクリーンを取得
//         const theaters = await Models.Theater.find(
//             {},
//             'name'
//         ).exec();
//         const screens = await Models.Screen.find(
//             {},
//             'name theater'
//         ).exec();
//         const screensByTheater: any = {};
//         screens.forEach((screen) => {
//             if (screensByTheater[screen.get('theater')] === undefined) {
//                 screensByTheater[screen.get('theater')] = [];
//             }
//             screensByTheater[screen.get('theater')].push(screen);
//         });
//         res.render('checkIn/performances', {
//             FilmUtil: FilmUtil,
//             theaters: theaters,
//             screensByTheater: screensByTheater,
//             event: {
//                 start: '2016-10-25T00:00:00+09:00',
//                 end: '2017-12-31T23:59:59+09:00'
//             },
//             layout: 'layouts/checkIn/layout'
//         });
//         return;
//     } catch (error) {
//         next(error);
//     }
// }
// /**
//  * 入場画面のパフォーマンス選択
//  * @memberof checkIn
//  * @function performanceSelect
//  * @param {Request} req
//  * @param {Response} res
//  * @returns {Promise<void>}
//  */
// export async function performanceSelect(req: Request, res: Response): Promise<void> {
//     if (!_.isEmpty(req.body.performanceId)) {
//         res.redirect(`/checkin/performance/${req.body.performanceId}/confirm`);
//     } else {
//         res.redirect('/checkin/performances');
//     }
// }
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
            const performanceId = (!_.isEmpty(req.body.performanceId)) ? req.body.performanceId : '';
            const conditions = {
                status: ttts.factory.reservationStatusType.ReservationConfirmed
            };
            if (performanceId !== '') {
                conditions.performance = performanceId;
            }
            else {
                const now = moment();
                const day = now.format('YYYYMMDD');
                const time = now.format('HHmm');
                conditions.performance_day = day;
                conditions.performance_start_time = { $lte: time };
                conditions.performance_end_time = { $gte: time };
            }
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
            console.error(error);
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
            res.json({
                status: true,
                error: null,
                reservation: reservation
            });
        }
        catch (error) {
            console.error(error);
            res.json({
                status: false,
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
            if (!req.body['checkin[_id]']
                || !req.body['checkin[where]']
                || !req.body['checkin[how]']) {
                throw new Error('req.body.checkin invalid');
            }
            // QR文字列から予約取得
            const reservation = yield getReservationByQR(req.params.qr);
            const checkins = reservation.checkins;
            // tslint:disable-next-line:no-magic-numbers
            const unixTimestamp = parseInt(req.body['checkin[_id]'], 10);
            // チェックイン情報追加
            checkins.push({
                _id: unixTimestamp,
                when: unixTimestamp,
                where: req.body['checkin[where]'],
                why: '',
                how: req.body['checkin[how]']
            });
            // 予約更新
            const update = {
                checkins: checkins
            };
            const reservationRepo = new ttts.repository.Reservation(ttts.mongoose.connection);
            yield reservationRepo.reservationModel.findByIdAndUpdate(reservation._id, update).exec();
            res.json({
                status: true
            });
        }
        catch (error) {
            console.error(error);
            res.json({
                status: false,
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
            if (!req.params.qr || !req.body.when) {
                throw new Error('invalid request');
            }
            // QR文字列から予約取得
            const reservation = yield getReservationByQR(req.params.qr);
            const timeStamp = req.body.when;
            const checkins = reservation.checkins;
            let index = 0;
            let delIndex = -1;
            // 削除対象のチェックイン情報のindexを取得
            for (const checkin of checkins) {
                if (checkin && checkin._id === Number(timeStamp)) {
                    delIndex = index;
                    break;
                }
                index += 1;
            }
            // チェックイン削除
            if (delIndex >= 0) {
                checkins.splice(delIndex, 1);
            }
            // 予約更新
            const update = { checkins: checkins };
            const reservationRepo = new ttts.repository.Reservation(ttts.mongoose.connection);
            yield reservationRepo.reservationModel.findByIdAndUpdate(reservation._id, update).exec();
            res.json({
                status: true
            });
        }
        catch (error) {
            console.error(error);
            res.json({
                status: false,
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
        const conditions = parseQR(qr);
        conditions.status = ttts.factory.reservationStatusType.ReservationConfirmed;
        const reservationRepo = new ttts.repository.Reservation(ttts.mongoose.connection);
        return (reservationRepo.reservationModel.findOne(conditions).exec());
    });
}
/**
 * QR文字列からクラス作成
 * @function parseQR
 * @param {string} qrStr
 * @returns {any}
 */
function parseQR(qrStr) {
    const qr = qrStr.split('-');
    const qrInfo = {};
    if (qr.length > 0) {
        qrInfo.performance_day = qr[0];
    }
    if (qr.length > 1) {
        qrInfo.payment_no = qr[1];
    }
    // tslint:disable-next-line:no-magic-numbers
    if (qr.length > 2) {
        // tslint:disable-next-line:no-magic-numbers
        qrInfo.payment_seat_index = qr[2];
    }
    return qrInfo;
}

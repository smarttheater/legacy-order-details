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
const moment = require("moment");
const _ = require("underscore");
const checkpointNames = { 'daiten-auth': '大展望台', 'topdeck-auth': 'TOP DESK' };
const ticketsExtra = ['000098', '000099'];
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
/**
 * 予約通過確認
 * @memberof checkIn
 * @function getPassList
 * @param {Request} req
 * @param {Response} res
 * @returns {Promise<void>}
 */
// tslint:disable-next-line:max-func-body-length
function getPassList(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (!req) {
                throw new Error('UnexpectedError');
            }
            // 対象日時セット(引数化の可能性あり)
            //@@@@@@@@@@@
            const selectType = 'time';
            // 現在時刻取得
            // データがないのでテストで9時
            //const now = moment();
            const now = moment('20170619 0900', 'YYYYMMDD HHmm');
            //---
            // 取得対象の日付と開始時刻FromToを取得
            const timeInfo = yield getStartTime(selectType, now);
            // 取得対象のパフォーマンス取得
            const performanceInfo = yield getTargetPerformances(timeInfo);
            // 予約情報取得
            const reservations = yield ttts_domain_1.Models.Reservation.find({
                performance: { $in: performanceInfo.ids }
            }).exec();
            // パフォーマンス単位に予約情報をグルーピング
            // dataByPerformance = {
            //   performance_id1:{ performance: performance,
            //                     ticket_types: ticket_types,
            //                     reservations: [reservation1,2,･･･n]},
            //                     reservedNormalNum: 5
            //                     reservedExtra:{'000002': {name:"車椅子",reservedNum:1},{･･･}
            // }
            const dataByPerformance = yield groupingReservationsByPerformance(performanceInfo.dicPerformances, reservations);
            // パフォーマンス+通過地点単位にチェックイン情報をグルーピング
            // dataCheckins = {
            //   performance_id1:{ 'daiten-auth' : [res1.checkins[0],res2.checkins[0]],
            //                     'topdeck-auth': [res1.checkins[1]] },
            // }
            const dataCheckins = groupingCheckinsByPerformanceAndWhere(dataByPerformance);
            // レスポンス編集
            const data = { schedules: [] };
            Object.keys(dataByPerformance).forEach((performanceId) => {
                // パフォーマンス情報セット
                const performance = dataByPerformance[performanceId].performance;
                const totalSeatNum = dataByPerformance[performanceId].reservations.length;
                const reservedNum = getStatusCount(dataByPerformance[performanceId].reservations, ttts_domain_2.ReservationUtil.STATUS_RESERVED);
                const schedule = {
                    performanceId: performanceId,
                    start_time: performance.start_time,
                    end_time: performance.end_time,
                    totalSeatNum: totalSeatNum,
                    totalReservedNum: reservedNum,
                    concernedReservedArray: [],
                    checkpointArray: []
                };
                // 特殊チケット情報セット
                const concernedReservedArray = [];
                const reservedExtra = dataByPerformance[performanceId].reservedExtra;
                Object.keys(reservedExtra).forEach((id) => {
                    concernedReservedArray.push({
                        id: id,
                        name: reservedExtra[id].name,
                        reservedNum: reservedExtra[id].reservedNum
                    });
                });
                schedule.concernedReservedArray = concernedReservedArray;
                // パフォーマンス+通過地点単位にチェックイン情報をグルーピング
                // dataCheckins = {
                //   performance_id1:{ 'daiten-auth' : [res1.checkins[0],res2.checkins[0]],
                //                     'topdeck-auth': [res1.checkins[1]] },
                // }
                // チェックイン情報セット
                const checkins = dataCheckins[performanceId];
                if (Object.keys(checkins).length > 0) {
                    const checkpoint = {};
                    // {'daiten-auth' : [res1.checkins[0],res2.checkins[0]],･･･}
                    Object.keys(checkins).forEach((where) => {
                        checkpoint.id = where;
                        checkpoint.name = (checkpointNames.hasOwnProperty(where)) ? checkpointNames[where] : where;
                        checkpoint.unarrivedNum = reservedNum - checkins[where].length;
                        // チェックポイントを通過した予約情報の中で特殊チケットの内訳セット
                        const concernedUnarrivedArray = getConcernedUnarrivedArray(concernedReservedArray, checkins[where]);
                        checkpoint.concernedUnarrivedArray = concernedUnarrivedArray;
                    });
                    schedule.checkpointArray.push(checkpoint);
                }
                data.schedules.push(schedule);
            });
            res.json({
                error: null,
                data: data
            });
        }
        catch (error) {
            console.error(error);
            res.json({
                error: '予約通過確認情報取得失敗'
            });
        }
    });
}
exports.getPassList = getPassList;
/**
 * 予約通過確認・開始時刻情報取得
 * @memberof checkIn
 * @function getStartTime
 * @param {string} selectType
 * @returns {Promise<any>}
 */
function getStartTime(selectType, now) {
    return __awaiter(this, void 0, void 0, function* () {
        const day = now.format('YYYYMMDD');
        // 1日分の時は日付のみセット
        if (selectType === 'day') {
            return {
                startTimeFrom: null,
                startTimeTo: null,
                day: day
            };
        }
        const start = now.format('HHmm');
        // 直近のパフォーマンス(開始時刻)取得
        const performances = yield ttts_domain_1.Models.Performance.find({
            day: day,
            start_time: { $lte: start }
        }).exec();
        // 開始時刻昇順ソート
        performances.sort((a, b) => {
            return (a.start_time > b.start_time) ? 0 : 1;
        });
        // 3パフォーマンス目の開始時刻セット
        const startTimeFrom = performances[0].start_time;
        const startDate = moment(performances[0].day + startTimeFrom, 'YYYYMMDDHHmm');
        // tslint:disable-next-line:no-magic-numbers
        const addTime = 15 * (3 - 1);
        const startTimeTo = moment(startDate).add('minutes', addTime).format('HHmm');
        // 現在時刻を含む開始時間を持つパフォーマンスから3パフォーマンス分の開始時刻をセット
        return {
            startTimeFrom: startTimeFrom,
            startTimeTo: startTimeTo,
            day: day
        };
    });
}
/**
 * 予約通過確認・対象パフォーマンス取得
 * @memberof checkIn
 * @function getTargetPerformances
 * @param {any} timeInfo
 * @returns {Promise<any>}
 */
function getTargetPerformances(timeInfo) {
    return __awaiter(this, void 0, void 0, function* () {
        // 来塔日
        const conditions = { day: timeInfo.day };
        // 開始時間
        const startTimeFrom = (timeInfo.startTimeFrom !== null) ? timeInfo.startTimeFrom : null;
        const startTimeTo = (timeInfo.startTimeTo !== null) ? timeInfo.startTimeTo : null;
        if (startTimeFrom !== null || startTimeTo !== null) {
            const conditionsTime = {};
            // 開始時間From
            if (startTimeFrom !== null) {
                conditionsTime.$gte = startTimeFrom;
            }
            // 開始時間To
            if (startTimeTo !== null) {
                conditionsTime.$lte = startTimeTo;
            }
            conditions.start_time = conditionsTime;
        }
        // 対象パフォーマンス取得
        const performances = yield ttts_domain_1.Models.Performance.find(conditions).exec();
        // id抽出
        const dicPerformances = [];
        const ids = performances.map((performance) => {
            dicPerformances[performance._id] = performance;
            return performance._id;
        });
        return { dicPerformances: dicPerformances, ids: ids };
    });
}
/**
 * パフォーマンス単位に予約情報をグルーピング
 * @memberof checkIn
 * @function groupingReservationsByPerformance
 * @param {any} dicPerformances
 * @param {any} reservations
 * @returns {Promise<any>[]}
 */
function groupingReservationsByPerformance(dicPerformances, reservations) {
    return __awaiter(this, void 0, void 0, function* () {
        const dataByPerformance = {};
        // 初期セット(DBアクセスがあるので最小限の処理のloopを分割)
        for (const reservation of reservations) {
            // キーはパフォーマンスID
            const keyValue = reservation.performance;
            if (!dataByPerformance.hasOwnProperty(keyValue)) {
                const ticketTypes = yield getTicketTypes(dicPerformances[keyValue].ticket_type_group);
                dataByPerformance[keyValue] = {};
                dataByPerformance[keyValue].performance = dicPerformances[keyValue];
                dataByPerformance[keyValue].ticketTypes = ticketTypes;
                dataByPerformance[keyValue].reservations = [];
                dataByPerformance[keyValue].reservedNormalNum = 0;
                dataByPerformance[keyValue].reservedExtra = {};
            }
        }
        // 予約情報セット
        reservations.map((reservation) => __awaiter(this, void 0, void 0, function* () {
            // 予約情報
            const keyValue = reservation.performance;
            dataByPerformance[keyValue].reservations.push(reservation);
            // 通常の時は通常予約数をプラス,特殊チケットは特殊チケット情報セット
            const isExtra = ticketsExtra.indexOf(reservation.ticket_type) >= 0;
            if (isExtra) {
                const reservedExtra = dataByPerformance[keyValue].reservedExtra;
                // reservedExtra:{ '000002' : {name:"車椅子", reservedNum:1},}
                if (!reservedExtra.hasOwnProperty(reservation.ticket_type)) {
                    reservedExtra[reservation.ticket_type] = {
                        name: reservation.ticket_type_name.ja,
                        reservedNum: 1
                    };
                }
                else {
                    reservedExtra.reservedNum += 1;
                }
            }
            else {
                dataByPerformance[keyValue].reservedNormalNum += 1;
            }
        }));
        return dataByPerformance;
    });
}
/**
 * 予約通過確認・チケットタイプ取得
 * @memberof checkIn
 * @function getTicketTypes
 * @param {string} group
 * @returns {Promise<any>}
 */
function getTicketTypes(group) {
    return __awaiter(this, void 0, void 0, function* () {
        // 券種取得(ticket_typesをjoinして名称etcも取得)
        const ticketTypeGroup = yield ttts_domain_1.Models.TicketTypeGroup.findOne({ _id: group }).populate('ticket_types').exec();
        return (ticketTypeGroup) ? ticketTypeGroup.get('ticket_types') : null;
    });
}
/**
 * 予約通過確認・パフォーマンス+通過地点単位にチェックイン情報をグルーピング
 * @memberof checkIn
 * @function groupingCheckinsByPerformanceAndWhere
 * @param {any} dataByPerformance
 * @returns {Promise<any>}
 */
function groupingCheckinsByPerformanceAndWhere(dataByPerformance) {
    const dataCheckins = {};
    Object.keys(dataByPerformance).forEach((performanceId) => {
        const dataCheckin = {};
        dataByPerformance[performanceId].reservations.forEach((reservation) => {
            reservation.checkins.forEach((checkin) => {
                if (!dataCheckin.hasOwnProperty(checkin.where)) {
                    dataCheckin[checkin.where] = [];
                }
                checkin.id = reservation._id;
                checkin.ticket_type = reservation.ticket_type;
                checkin.ticket_type_name = reservation.ticket_type_name;
                dataCheckin[checkin.where].push(checkin);
            });
        });
        dataCheckins[performanceId] = dataCheckin;
    });
    return dataCheckins;
}
/**
 * 予約通過確認・指定ステータスを持つデータ数取得
 * @memberof checkIn
 * @function getStatusCount
 * @param {any[]} reservations
 * @param {string} status
 * @returns {number}
 */
function getStatusCount(reservations, status) {
    let statusNum = 0;
    reservations.forEach((reservation) => {
        if (reservation.status === status) {
            statusNum += 1;
        }
    });
    return statusNum;
}
function getConcernedUnarrivedArray(concernedReservedArray, checkins) {
    const concernedUnarrivedArray = [];
    // 特殊チケットごとの来場予定者をセット
    concernedReservedArray.forEach((reserve) => {
        concernedUnarrivedArray.push({
            id: reserve.id,
            name: reserve.name,
            unarrivedNum: reserve.reservedNum //初期値は来場予定者数
        });
    });
    // 未入場者=来場予定者数-チェックポイント通過者数
    concernedUnarrivedArray.forEach((unarrive) => {
        unarrive.unarrivedNum = unarrive.unarrivedNum - checkins.length;
    });
    return concernedUnarrivedArray;
}

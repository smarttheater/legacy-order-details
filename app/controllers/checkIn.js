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
//import { FilmUtil } from '@motionpicture/ttts-domain';
const conf = require("config");
const moment = require("moment");
const _ = require("underscore");
// チケット情報(descriptionは予約データに持つべき(ticket_description))
const ticketInfos = conf.get('ticketInfos');
// const ticketInfos: any = {
//     '000004': { description: '1'},
//     '000005': { description: '1'},
//     '000006': { description: '1'}
// };
// 出力対象区分
const descriptionInfos = conf.get('descriptionInfos');
//const descriptionInfos: any = {1: 'wheelchair'};
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
                status: ttts_domain_2.ReservationUtil.STATUS_RESERVED
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
            const reservations = yield ttts_domain_1.Models.Reservation.find(conditions).exec();
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
            // const unixTimestamp = (new Date()).getTime();
            // チェックイン情報追加
            checkins.push({
                _id: unixTimestamp,
                when: unixTimestamp,
                where: req.body['checkin[where]'],
                why: '',
                how: req.body['checkin[how]']
            }
            // {
            //     _id: unixTimestamp,
            //     when: unixTimestamp,
            //     where: req.staffUser.get('group'),
            //     why: '',
            //     how: req.staffUser.get('name').ja !== undefined ? req.staffUser.get('name').ja : null
            // }
            );
            // 予約更新
            const update = {
                checkins: checkins
            };
            yield ttts_domain_1.Models.Reservation.findByIdAndUpdate(reservation._id, update).exec();
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
            yield ttts_domain_1.Models.Reservation.findByIdAndUpdate(reservation._id, update).exec();
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
        conditions.status = ttts_domain_2.ReservationUtil.STATUS_RESERVED;
        return (yield ttts_domain_1.Models.Reservation.findOne(conditions).exec());
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
/**
 * 予約通過確認(api)
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
            if (req.staffUser === undefined) {
                throw new Error('staffUser not defined.');
            }
            if (!req.staffUser.isAuthenticated()) {
                throw new Error('staffUser not authenticated.');
            }
            // 対象日時セット(引数化の可能性あり)
            const selectType = 'day';
            //const selectType: string = 'time';
            // 現在時刻取得
            // データがないのでテストで9時
            let now = moment();
            //let now = moment('20170619 0900', 'YYYYMMDD HHmm');
            if (req.query.day !== undefined) {
                now = moment(req.query.day, 'YYYYMMDD');
            }
            // 取得対象の日付と開始時刻FromToを取得
            const timeInfo = yield getStartTime(selectType, now);
            // 取得対象のパフォーマンス取得
            const performanceInfo = yield getTargetPerformances(timeInfo);
            // 予約情報取得
            const reservations = yield ttts_domain_1.Models.Reservation.find({
                performance: { $in: performanceInfo.ids },
                status: ttts_domain_2.ReservationUtil.STATUS_RESERVED
            }).exec();
            // パフォーマンス単位に予約情報をグルーピング
            //  パフォーマンスID: performance: performance,
            //                    reservations: [reservation1,2,･･･n]},
            //                    reservedNormalNum: 5
            //                    reservedExtra:{'1': {name:"wheelchair",reservedNum:1},{･･･}
            const dataByPerformance = yield groupingReservationsByPerformance(performanceInfo.dicPerformances, performanceInfo.ids, reservations);
            // パフォーマンス+通過地点単位にチェックイン情報をグルーピング
            //   パフォーマンスID:{'daiten-auth' : {
            //                        checkins: [res1.checkins[0],res2.checkins[0]],
            //                        arrived: { '00099': 1, '00098': 2, },
            //                     'topdeck-auth': {
            //                        checkins: [res1.checkins[1],
            //                        arrived: { '00099': 0, '00098': 1, },
            const dataCheckins = groupingCheckinsByWhere(dataByPerformance);
            // チェックポイント名称取得
            const owners = yield ttts_domain_1.Models.Owner.find({ notes: '1' }).exec();
            const checkpointNames = {};
            owners.map((owner) => {
                checkpointNames[owner.group] = owner.get('description');
            });
            // レスポンス編集
            const data = {
                checkpoints: checkpointNames,
                schedules: []
            };
            Object.keys(dataByPerformance).forEach((performanceId) => {
                // パフォーマンス情報セット
                const performance = dataByPerformance[performanceId].performance;
                const reservedNum = getStatusCount(dataByPerformance[performanceId].reservations, ttts_domain_2.ReservationUtil.STATUS_RESERVED);
                const schedule = {
                    performanceId: performanceId,
                    start_time: performance.start_time,
                    end_time: performance.end_time,
                    totalReservedNum: reservedNum,
                    concernedReservedArray: [],
                    checkpointArray: []
                };
                // 特殊チケット(車椅子)予約情報セット
                const concernedReservedArray = [];
                const reservedExtra = dataByPerformance[performanceId].reservedExtra;
                // ticketTypesExtra.forEach((extraId) => {
                //     // reservedExtraに予約情報があれば予約数セット
                //     const concernedReservedNum: number = (reservedExtra.hasOwnProperty(extraId)) ? reservedExtra[extraId].reservedNum : 0;
                //     concernedReservedArray.push({
                //         id: extraId,
                //         name: ticketNames[extraId].ja,
                //         reservedNum: concernedReservedNum
                //     });
                // });
                Object.keys(descriptionInfos).forEach((description) => {
                    // reservedExtraに予約情報があれば予約数セット
                    const concernedReservedNum = (reservedExtra.hasOwnProperty(description)) ?
                        reservedExtra[description].reservedNum : 0;
                    concernedReservedArray.push({
                        id: description,
                        name: descriptionInfos[description],
                        reservedNum: concernedReservedNum
                    });
                });
                schedule.concernedReservedArray = concernedReservedArray;
                // チェックイン情報セット
                const checkins = dataCheckins[performanceId];
                if (Object.keys(checkins).length > 0) {
                    Object.keys(checkins).forEach((where) => {
                        const checkpoint = {
                            id: where,
                            name: (checkpointNames.hasOwnProperty(where)) ? checkpointNames[where] : where,
                            unarrivedNum: reservedNum - checkins[where].checkins.length
                        };
                        // チェックポイントを通過した予約情報の中で特殊チケットの内訳セット
                        const concernedUnarrivedArray = getConcernedUnarrivedArray(concernedReservedArray, checkins[where]);
                        checkpoint.concernedUnarrivedArray = concernedUnarrivedArray;
                        schedule.checkpointArray.push(checkpoint);
                    });
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
 * @param {string[]} performancesIds
 * @param {any} reservations
 * @returns {Promise<any>[]}
 */
// async function groupingReservationsByPerformance(dicPerformances: any[], reservations: any[]): Promise<any> {
//     const dataByPerformance: any = {};
//     // 初期セット(DBアクセスがあるので最小限の処理のloopを分割)
//     for (const reservation of reservations)  {
//         // キーはパフォーマンスID
//         const keyValue = reservation.performance;
//         if (!dataByPerformance.hasOwnProperty(keyValue)) {
//             const ticketTypes = await getTicketTypes(dicPerformances[keyValue].ticket_type_group);
//             const ticketNames: any = {};
//             const ticketTypesExtra: string[] = [];
//             for (const ticketType of ticketTypes)  {
//                 ticketNames[ticketType._id] = ticketType.name;
//                 if (ticketType.get('description') === '1') {
//                     ticketTypesExtra.push(ticketType._id);
//                 }
//             }
//             (<any>dataByPerformance)[keyValue] = {};
//             (<any>dataByPerformance)[keyValue].performance = dicPerformances[keyValue];
//             (<any>dataByPerformance)[keyValue].ticketNames = ticketNames;
//             (<any>dataByPerformance)[keyValue].ticketTypesExtra = ticketTypesExtra;
//             (<any>dataByPerformance)[keyValue].reservations = [];
//             (<any>dataByPerformance)[keyValue].reservedNormalNum = 0;
//             (<any>dataByPerformance)[keyValue].reservedExtra = {};
//         }
//     }
//     // 予約情報セット
//     reservations.map(async(reservation: any) => {
//         // 予約情報
//         const keyValue = reservation.performance;
//         (<any>dataByPerformance)[keyValue].reservations.push(reservation);
//         // 通常の時は通常予約数をプラス,特殊チケットは特殊チケット情報セット
//         //const isExtra: boolean = ticketsExtra.indexOf(reservation.ticket_type) >= 0;
//         const isExtra: boolean = (<any>dataByPerformance)[keyValue].ticketTypesExtra.indexOf(reservation.ticket_type) >= 0;
//         if (isExtra) {
//             const reservedExtra: any = (<any>dataByPerformance)[keyValue].reservedExtra;
//             // reservedExtra:{ '000002' : {name:"車椅子", reservedNum:1},}
//             if (!reservedExtra.hasOwnProperty(reservation.ticket_type)) {
//                 reservedExtra[reservation.ticket_type] = {
//                     name: (<any>reservation.ticket_type_name).ja,
//                     reservedNum: 1
//                 };
//             } else {
//                 reservedExtra[reservation.ticket_type].reservedNum += 1;
//             }
//         } else {
//             (<any>dataByPerformance)[keyValue].reservedNormalNum += 1;
//         }
//     });
//     return dataByPerformance;
// }
function groupingReservationsByPerformance(dicPerformances, performanceIds, reservations) {
    return __awaiter(this, void 0, void 0, function* () {
        const dataByPerformance = {};
        // 初期セット(DBアクセスがあるので最小限の処理のloopを分割)
        for (const performanceId of performanceIds) {
            // キーはパフォーマンスID
            if (!dataByPerformance.hasOwnProperty(performanceId)) {
                const ticketTypes = yield getTicketTypes(dicPerformances[performanceId].ticket_type_group);
                const ticketTypesExtra = [];
                for (const ticketType of ticketTypes) {
                    if (isSpecialTicket(ticketType.get('description'))) {
                        ticketTypesExtra.push(ticketType._id);
                    }
                }
                dataByPerformance[performanceId] = {};
                dataByPerformance[performanceId].performance = dicPerformances[performanceId];
                dataByPerformance[performanceId].ticketTypesExtra = ticketTypesExtra;
                dataByPerformance[performanceId].reservations = [];
                dataByPerformance[performanceId].reservedNormalNum = 0;
                dataByPerformance[performanceId].reservedExtra = {};
            }
        }
        // 初期セット(DBアクセスがあるので最小限の処理のloopを分割)
        for (const reservation of reservations) {
            // キーはパフォーマンスID
            const keyValue = reservation.performance;
            if (!dataByPerformance.hasOwnProperty(keyValue)) {
                const ticketTypes = yield getTicketTypes(dicPerformances[keyValue].ticket_type_group);
                //const ticketNames: any = {};
                const ticketTypesExtra = [];
                for (const ticketType of ticketTypes) {
                    if (isSpecialTicket(ticketType.get('description'))) {
                        ticketTypesExtra.push(ticketType._id);
                    }
                }
                dataByPerformance[keyValue] = {};
                dataByPerformance[keyValue].performance = dicPerformances[keyValue];
                //(<any>dataByPerformance)[keyValue].ticketNames = ticketNames;
                dataByPerformance[keyValue].ticketTypesExtra = ticketTypesExtra;
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
            const isExtra = dataByPerformance[keyValue].ticketTypesExtra.indexOf(reservation.ticket_type) >= 0;
            if (isExtra) {
                const reservedExtra = dataByPerformance[keyValue].reservedExtra;
                const description = ticketInfos[reservation.ticket_type].description;
                if (!reservedExtra.hasOwnProperty(description)) {
                    reservedExtra[description] = {
                        reservedNum: 1
                    };
                }
                else {
                    reservedExtra[description].reservedNum += 1;
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
        return (ticketTypeGroup !== null) ? ticketTypeGroup.get('ticket_types') : null;
    });
}
/**
 * 予約通過確認・パフォーマンス+通過地点単位にチェックイン情報をグルーピング
 * @memberof checkIn
 * @function groupingCheckinsByWhere
 * @param {any} dataByPerformance
 * @returns {Promise<any>}
 */
function groupingCheckinsByWhere(dataByPerformance) {
    // dataCheckins = {
    //   performance_id1:{ 'daiten-auth' : {
    //                        checkins: [res1.checkins[0],res2.checkins[0]],
    //                        arrived: { '00099': 1, '00098': 2, },
    //                     'topdeck-auth': {
    //                        checkins: [res1.checkins[1],
    //                        arrived: { '00099': 0, '00098': 1, },
    const dataCheckins = {};
    Object.keys(dataByPerformance).forEach((performanceId) => {
        const dataCheckin = {};
        dataByPerformance[performanceId].reservations.forEach((reservation) => {
            reservation.checkins.forEach((checkin) => {
                if (!dataCheckin.hasOwnProperty(checkin.where)) {
                    //dataCheckin[checkin.where] = [];
                    dataCheckin[checkin.where] = { checkins: [], arrived: {} };
                }
                // チェックイン数セット
                if (!dataCheckin[checkin.where].arrived.hasOwnProperty(reservation.ticket_type)) {
                    dataCheckin[checkin.where].arrived[reservation.ticket_type] = 1;
                }
                else {
                    dataCheckin[checkin.where].arrived[reservation.ticket_type] += 1;
                }
                // // チェックイン数セット
                // const description: string = ticketInfos[reservation.ticket_type].description;
                // if (!dataCheckin[checkin.where].arrived.hasOwnProperty(description)) {
                //     dataCheckin[checkin.where].arrived[description] = 1;
                // } else {
                //     dataCheckin[checkin.where].arrived[description] += 1;
                // }
                checkin.id = reservation._id; // 予約id
                checkin.ticket_type = reservation.ticket_type; // ticket_type(00099)
                //checkin.ticket_type_name = reservation.ticket_type_name;
                dataCheckin[checkin.where].checkins.push(checkin);
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
/**
 * 予約通過確認・特殊チケットごとの未入場者数取得
 * @memberof checkIn
 * @function getConcernedUnarrivedArray
 * @param {any[]} concernedReservedArray
 * @param {any[]} checkins
 * @returns {any[]}
 */
function getConcernedUnarrivedArray(concernedReservedArray, checkin) {
    //   checkin('daiten-auth') = {
    //        checkins: [res1.checkins[0],res2.checkins[0]],
    //        arrived: { '00099': 1, '00098': 2, }
    //  }
    const concernedUnarrivedArray = [];
    // 特殊チケットごとの来場予定者をセット
    concernedReservedArray.forEach((reserve) => {
        concernedUnarrivedArray.push({
            id: reserve.id,
            name: reserve.name,
            unarrivedNum: reserve.reservedNum //初期値は来場予定者数
        });
    });
    // 到着チケットをチェックし、同じdescriptionの予約数からチェックイン数を引く
    for (const tycketType of Object.keys(checkin.arrived)) {
        if (!ticketInfos.hasOwnProperty(tycketType)) {
            continue;
        }
        // チケット情報からdescriptionを取得
        const description = ticketInfos[tycketType].description;
        concernedUnarrivedArray.forEach((unarrive) => {
            if (description === unarrive.id) {
                // 未入場者数 = 来場予定者数 - チェックポイント通過者数
                const arrivedNum = checkin.arrived[tycketType];
                unarrive.unarrivedNum = unarrive.unarrivedNum - arrivedNum;
            }
        });
    }
    return concernedUnarrivedArray;
}
/**
 * 予約通過確認・特殊チケット判定
 * @memberof checkIn
 * @function isSpecialTicket
 * @param {string} description
 * @returns {boolean}
 */
function isSpecialTicket(description) {
    return description !== '0';
}

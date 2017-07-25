/**
 * 入場コントローラー
 *
 * 上映当日入場画面から使う機能はここにあります。
 *
 * @namespace checkIn
 */
import { Models } from '@motionpicture/ttts-domain';
import { ReservationUtil } from '@motionpicture/ttts-domain';
//import { FilmUtil } from '@motionpicture/ttts-domain';
import { NextFunction, Request, Response } from 'express';
import * as moment from 'moment';
import * as mongoose from 'mongoose';
import * as _ from 'underscore';

// チケット情報(descriptionは予約データに持つべき)
const ticketInfos: any = {
    '000004': { description: '1'},
    '000005': { description: '1'},
    '000006': { description: '1'}
};
// 出力対象区分
const descriptionInfos: any = {1: 'wheelchair'};

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
export async function confirm(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (req === null) {
        next(new Error('unexepected error'));
    }
    try {
        res.render('checkIn/confirm', {
            staffUser: req.staffUser,
            layout: 'layouts/checkIn/layout'
        });
    } catch (error) {
        next(new Error('unexepected error'));
    }
}
// for kusunose test
export async function confirmTest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        if (req === null) {
            next(new Error('unexepected error'));
        }
        res.render('checkIn/confirmTest', {
            layout: 'layouts/checkIn/layout'
        });
    } catch (error) {
        next(new Error('unexepected error'));
    }
}

/**
 * 予約情報取得
 * @memberof checkIn
 * @function getReservations
 * @param {Request} req
 * @param {Response} res
 * @returns {Promise<void>}
 */
export async function getReservations(req: Request, res: Response): Promise<void> {
    try {
        const performanceId: string = (!_.isEmpty(req.body.performanceId)) ? req.body.performanceId : '';
        const conditions: any = {
            status: ReservationUtil.STATUS_RESERVED
        };
        if (performanceId !== '') {
            conditions.performance = performanceId;
        } else {
            const now = moment();
            const day = now.format('YYYYMMDD');
            const time = now.format('HHmm');
            conditions.performance_day =  day;
            conditions.performance_start_time = { $lte: time };
            conditions.performance_end_time = { $gte: time };
        }
        const reservations = await Models.Reservation.find(
            conditions
        ).exec();

        const reservationsById: {
            [id: string]: mongoose.Document
        } = {};
        const reservationIdsByQrStr: {
            [qr: string]: string
        } = {};
        reservations.forEach((reservation) => {
            reservationsById[reservation.get('_id').toString()] = reservation;
            reservationIdsByQrStr[reservation.get('qr_str')] = reservation.get('_id').toString();
        });

        res.json({
            error: null,
            reservationsById: reservationsById,
            reservationIdsByQrStr: reservationIdsByQrStr
        });
    } catch (error) {
        console.error(error);
        res.json({
            error: '予約情報取得失敗'
        });
    }
}
/**
 * 予約情報取得
 * @memberof checkIn
 * @function getReservation
 * @param {Request} req
 * @param {Response} res
 * @returns {Promise<void>}
 */
export async function getReservation(req: Request, res: Response): Promise<void> {
    if (req.staffUser === undefined) {
        throw new Error('staffUser not defined.');
    }
    if (!req.staffUser.isAuthenticated()) {
        throw new Error('staffUser not authenticated.');
    }
    try {
        const reservation = await getReservationByQR(req.params.qr);
        res.json({
            status: true,
            error: null,
            reservation: reservation
        });
    } catch (error) {
        console.error(error);
        res.json({
            status: false,
            error: '予約情報取得失敗',
            message: error
        });
    }
}

/**
 * チェックイン作成
 * @memberof checkIn
 * @function addCheckIn
 * @param {Request} req
 * @param {Response} res
 * @returns {Promise<void>}
 */
export async function addCheckIn(req: Request, res: Response): Promise<void> {
    try {
        if (req.staffUser === undefined) {
            throw new Error('staffUser not defined.');
        }
        if (!req.staffUser.isAuthenticated()) {
            throw new Error('staffUser not authenticated.');
        }
        if (!req.body['checkin[_id]']
        || !req.body['checkin[where]']
        || !req.body['checkin[how]']
        ) {
            throw new Error('req.body.checkin invalid');
        }
        // QR文字列から予約取得
        const reservation: any = await getReservationByQR(req.params.qr);
        const checkins: any[] = reservation.checkins;
        const unixTimestamp: number = parseInt(req.body['checkin[_id]'], 10);
        // const unixTimestamp = (new Date()).getTime();
        // チェックイン情報追加
        checkins.push(
            {
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
        await Models.Reservation.findByIdAndUpdate(reservation._id, update).exec();
        res.json({
            status: true
        });
    } catch (error) {
        console.error(error);
        res.json({
            status: false,
            error: 'チェックイン情報作成失敗',
            message: error.message
        });
    }
}
/**
 * チェックイン取り消し
 * @memberof checkIn
 * @function addCheckIn
 * @param {Request} req
 * @param {Response} res
 * @returns {Promise<void>}
 */
export async function removeCheckIn(req: Request, res: Response): Promise<void> {
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
        const reservation: any = await getReservationByQR(req.params.qr);
        const timeStamp: string = req.body.when;
        const checkins: any[] = reservation.checkins;
        let index: number = 0;
        let delIndex: number = -1;
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
        const update = {checkins: checkins};
        await Models.Reservation.findByIdAndUpdate(reservation._id, update).exec();
        res.json({
            status: true
        });
    } catch (error) {
        console.error(error);
        res.json({
            status: false,
            error: 'チェックイン取り消し失敗',
            message: error.message
        });
    }
}

/**
 * QR文字列から予約情報取得
 * @memberof checkIn
 * @function getReservationByQR
 * @param {string} qr
 * @returns {Promise<any>}
 */
async function getReservationByQR(qr: string): Promise<any> {
    const conditions: any =  parseQR(qr);
    conditions.status =  ReservationUtil.STATUS_RESERVED;

    return (await Models.Reservation.findOne(
        conditions
    ).exec());
}
/**
 * QR文字列からクラス作成
 * @function parseQR
 * @param {string} qrStr
 * @returns {any}
 */
function parseQR(qrStr: string): any {
    const qr: string[] = qrStr.split('-');
    const qrInfo: any = {};
    if ( qr.length > 0) {
        qrInfo.performance_day = qr[0];
    }
    if ( qr.length > 1) {
        qrInfo.payment_no = qr[1];
    }
    // tslint:disable-next-line:no-magic-numbers
    if ( qr.length > 2) {
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
export async function getPassList(req: Request, res: Response): Promise<void> {
    try {
        // 対象日時セット(引数化の可能性あり)
        const selectType: string = 'day';
        //const selectType: string = 'time';
        // 現在時刻取得
        // データがないのでテストで9時
        let now = moment();
        //let now = moment('20170619 0900', 'YYYYMMDD HHmm');
        if (req.query.day !== undefined) {
            now = moment(req.query.day, 'YYYYMMDD');
        }

        // 取得対象の日付と開始時刻FromToを取得
        const timeInfo : any = await getStartTime(selectType, now);
        // 取得対象のパフォーマンス取得
        const performanceInfo: any = await getTargetPerformances(timeInfo);
        // 予約情報取得
        const reservations = <any[]>await Models.Reservation.find(
            {
                performance: { $in: performanceInfo.ids },
                status: ReservationUtil.STATUS_RESERVED
            }
        ).exec();

        // パフォーマンス単位に予約情報をグルーピング
        //  パフォーマンスID: performance: performance,
        //                    reservations: [reservation1,2,･･･n]},
        //                    reservedNormalNum: 5
        //                    reservedExtra:{'1': {name:"wheelchair",reservedNum:1},{･･･}
        const dataByPerformance: any = await groupingReservationsByPerformance(
                                                performanceInfo.dicPerformances,
                                                performanceInfo.ids,
                                                reservations);

        // パフォーマンス+通過地点単位にチェックイン情報をグルーピング
        //   パフォーマンスID:{'daiten-auth' : {
        //                        checkins: [res1.checkins[0],res2.checkins[0]],
        //                        arrived: { '00099': 1, '00098': 2, },
        //                     'topdeck-auth': {
        //                        checkins: [res1.checkins[1],
        //                        arrived: { '00099': 0, '00098': 1, },
        const dataCheckins: any = groupingCheckinsByWhere(dataByPerformance);

        // チェックポイント名称取得
        const owners: any[] = await Models.Owner.find({notes: '1'}).exec();
        const checkpointNames: any = {};
        owners.map((owner) => {
            checkpointNames[owner.group] = owner.get('description');
        });

        // レスポンス編集
        const data: any = {
            checkpoints: checkpointNames,
            schedules: []
        };
        Object.keys(dataByPerformance).forEach((performanceId) => {
            // パフォーマンス情報セット
            const performance: any = dataByPerformance[performanceId].performance;
            const reservedNum: number = getStatusCount(dataByPerformance[performanceId].reservations, ReservationUtil.STATUS_RESERVED);
            const schedule: any = {
                performanceId: performanceId,
                start_time: performance.start_time,
                end_time: performance.end_time,
                totalReservedNum: reservedNum,
                concernedReservedArray: [],
                checkpointArray: []
            };
            // 特殊チケット(車椅子)予約情報セット
            const concernedReservedArray: any[] = [];
            const reservedExtra: any = dataByPerformance[performanceId].reservedExtra;
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
                const concernedReservedNum: number = (reservedExtra.hasOwnProperty(description)) ?
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
                    const checkpoint: any = {
                        id: where,
                        name: (checkpointNames.hasOwnProperty(where)) ? (<any>checkpointNames)[where] : where,
                        unarrivedNum: reservedNum - checkins[where].checkins.length
                    };
                    // チェックポイントを通過した予約情報の中で特殊チケットの内訳セット
                    const concernedUnarrivedArray: any[] = getConcernedUnarrivedArray(concernedReservedArray, checkins[where]);
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
    } catch (error) {
        console.error(error);
        res.json({
            error: '予約通過確認情報取得失敗'
        });
    }
}
/**
 * 予約通過確認・開始時刻情報取得
 * @memberof checkIn
 * @function getStartTime
 * @param {string} selectType
 * @returns {Promise<any>}
 */
async function getStartTime(selectType: string, now: moment.Moment ) : Promise<any> {
    const day = now.format('YYYYMMDD');
    // 1日分の時は日付のみセット
    if ( selectType === 'day') {
        return {
            startTimeFrom: null,
            startTimeTo: null,
            day: day
        };
   }
    const start = now.format('HHmm');
    // 直近のパフォーマンス(開始時刻)取得
    const performances = <any[]>await Models.Performance.find(
        {
            day: day,
            start_time: { $lte: start }
        }
    ).exec();
    // 開始時刻昇順ソート
    performances.sort((a, b) => {
        return (a.start_time > b.start_time) ? 0 : 1;
    });
    // 3パフォーマンス目の開始時刻セット
    const startTimeFrom = performances[0].start_time;
    const startDate = moment(<string>performances[0].day + <string>startTimeFrom, 'YYYYMMDDHHmm');
    // tslint:disable-next-line:no-magic-numbers
    const addTime = 15 * (3 - 1);
    const startTimeTo =  moment(startDate).add('minutes', addTime).format('HHmm');

    // 現在時刻を含む開始時間を持つパフォーマンスから3パフォーマンス分の開始時刻をセット
    return {
        startTimeFrom: startTimeFrom,
        startTimeTo: startTimeTo,
        day: day
    };
}
/**
 * 予約通過確認・対象パフォーマンス取得
 * @memberof checkIn
 * @function getTargetPerformances
 * @param {any} timeInfo
 * @returns {Promise<any>}
 */
async function getTargetPerformances(timeInfo: any): Promise<any> {
    // 来塔日
    const conditions: any = {day: timeInfo.day};
    // 開始時間
    const startTimeFrom: any = (timeInfo.startTimeFrom !== null) ? timeInfo.startTimeFrom : null;
    const startTimeTo: any = (timeInfo.startTimeTo !== null) ? timeInfo.startTimeTo : null;
    if (startTimeFrom !== null || startTimeTo !== null) {
        const conditionsTime: any = {};
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
    const performances = <any[]>await Models.Performance.find(
        conditions
    ).exec();
    // id抽出
    const dicPerformances : any[] = [];
    const ids: string[] = performances.map((performance) => {
        (<any>dicPerformances)[performance._id] = performance;

        return performance._id;
    });

    return { dicPerformances: dicPerformances, ids: ids };
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
async function groupingReservationsByPerformance(dicPerformances: any, performanceIds: string[], reservations: any[]): Promise<any> {
    const dataByPerformance: any = {};

    // 初期セット(DBアクセスがあるので最小限の処理のloopを分割)
    for (const performanceId of performanceIds) {
        // キーはパフォーマンスID
        if (!dataByPerformance.hasOwnProperty(performanceId)) {
            const ticketTypes = await getTicketTypes(dicPerformances[performanceId].ticket_type_group);
            const ticketTypesExtra: string[] = [];
            for (const ticketType of ticketTypes)  {
                if (ticketInfos.hasOwnProperty(ticketType._id)) {
                    ticketTypesExtra.push(ticketType._id);
                }
            }
            (<any>dataByPerformance)[performanceId] = {};
            (<any>dataByPerformance)[performanceId].performance = dicPerformances[performanceId];
            (<any>dataByPerformance)[performanceId].ticketTypesExtra = ticketTypesExtra;
            (<any>dataByPerformance)[performanceId].reservations = [];
            (<any>dataByPerformance)[performanceId].reservedNormalNum = 0;
            (<any>dataByPerformance)[performanceId].reservedExtra = {};
        }
    }

    // 初期セット(DBアクセスがあるので最小限の処理のloopを分割)
    for (const reservation of reservations)  {
        // キーはパフォーマンスID
        const keyValue = reservation.performance;
        if (!dataByPerformance.hasOwnProperty(keyValue)) {
            const ticketTypes = await getTicketTypes(dicPerformances[keyValue].ticket_type_group);
            //const ticketNames: any = {};
            const ticketTypesExtra: string[] = [];
            for (const ticketType of ticketTypes)  {
                //ticketNames[ticketType._id] = ticketType.name;
                if (ticketInfos.hasOwnProperty(ticketType._id)) {
                    ticketTypesExtra.push(ticketType._id);
                }
            }
            (<any>dataByPerformance)[keyValue] = {};
            (<any>dataByPerformance)[keyValue].performance = dicPerformances[keyValue];
            //(<any>dataByPerformance)[keyValue].ticketNames = ticketNames;
            (<any>dataByPerformance)[keyValue].ticketTypesExtra = ticketTypesExtra;
            (<any>dataByPerformance)[keyValue].reservations = [];
            (<any>dataByPerformance)[keyValue].reservedNormalNum = 0;
            (<any>dataByPerformance)[keyValue].reservedExtra = {};
        }
    }
    // 予約情報セット
    reservations.map(async(reservation: any) => {
        // 予約情報
        const keyValue = reservation.performance;
        (<any>dataByPerformance)[keyValue].reservations.push(reservation);
        // 通常の時は通常予約数をプラス,特殊チケットは特殊チケット情報セット
        const isExtra: boolean = (<any>dataByPerformance)[keyValue].ticketTypesExtra.indexOf(reservation.ticket_type) >= 0;
        if (isExtra) {
            const reservedExtra: any = (<any>dataByPerformance)[keyValue].reservedExtra;
            const description = ticketInfos[reservation.ticket_type].description;
            // reservedExtra:{ '1' : {name:"wheelchair", reservedNum:1},}
            if (!reservedExtra.hasOwnProperty(description)) {
                reservedExtra[description] = {
                    //name: ticketInfos[reservation.ticket_type].name,
                    reservedNum: 1
                };
            } else {
                reservedExtra[description].reservedNum += 1;
            }
        } else {
            (<any>dataByPerformance)[keyValue].reservedNormalNum += 1;
        }
    });

    return dataByPerformance;
}
/**
 * 予約通過確認・チケットタイプ取得
 * @memberof checkIn
 * @function getTicketTypes
 * @param {string} group
 * @returns {Promise<any>}
 */
async function getTicketTypes(group: string): Promise<any> {
    // 券種取得(ticket_typesをjoinして名称etcも取得)
    const ticketTypeGroup = await Models.TicketTypeGroup.findOne(
        { _id: group }
    ).populate('ticket_types').exec();

    return (ticketTypeGroup !== null) ? ticketTypeGroup.get('ticket_types') : null;
}
/**
 * 予約通過確認・パフォーマンス+通過地点単位にチェックイン情報をグルーピング
 * @memberof checkIn
 * @function groupingCheckinsByWhere
 * @param {any} dataByPerformance
 * @returns {Promise<any>}
 */
function groupingCheckinsByWhere(dataByPerformance: any): any {
    // dataCheckins = {
    //   performance_id1:{ 'daiten-auth' : {
    //                        checkins: [res1.checkins[0],res2.checkins[0]],
    //                        arrived: { '00099': 1, '00098': 2, },
    //                     'topdeck-auth': {
    //                        checkins: [res1.checkins[1],
    //                        arrived: { '00099': 0, '00098': 1, },
    const dataCheckins: any = {};
    Object.keys(dataByPerformance).forEach((performanceId) => {
        const dataCheckin: any = {};
        (<any>dataByPerformance[performanceId].reservations).forEach((reservation: any) => {
            (<any>reservation.checkins).forEach((checkin: any) => {
                if (!dataCheckin.hasOwnProperty(checkin.where)) {
                    //dataCheckin[checkin.where] = [];
                    dataCheckin[checkin.where] = {checkins: [], arrived: {}};
                }
                // チェックイン数セット
                if (!dataCheckin[checkin.where].arrived.hasOwnProperty(reservation.ticket_type)) {
                    dataCheckin[checkin.where].arrived[reservation.ticket_type] = 1;
                } else {
                    dataCheckin[checkin.where].arrived[reservation.ticket_type] += 1;
                }
                // // チェックイン数セット
                // const description: string = ticketInfos[reservation.ticket_type].description;
                // if (!dataCheckin[checkin.where].arrived.hasOwnProperty(description)) {
                //     dataCheckin[checkin.where].arrived[description] = 1;
                // } else {
                //     dataCheckin[checkin.where].arrived[description] += 1;
                // }
                checkin.id = reservation._id;                   // 予約id
                checkin.ticket_type = reservation.ticket_type;  // ticket_type(00099)
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
function getStatusCount(reservations: any[], status: string): number {
    let statusNum : number = 0;
    reservations.forEach((reservation: any) => {
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
function getConcernedUnarrivedArray(concernedReservedArray: any[], checkin: any): any {
    //   checkin('daiten-auth') = {
    //        checkins: [res1.checkins[0],res2.checkins[0]],
    //        arrived: { '00099': 1, '00098': 2, }
    //  }
    const concernedUnarrivedArray: any[] = [];
    // 特殊チケットごとの来場予定者をセット
    concernedReservedArray.forEach((reserve: any) => {
        concernedUnarrivedArray.push({
            id: reserve.id,                     // ticket_type(000099)
            name: reserve.name,                 // チケット名("車椅子")
            unarrivedNum: reserve.reservedNum   //初期値は来場予定者数
        });
    });

// const ticketInfos: any = {
//     '000004': { description: '1'},
//     '000005': { description: '1'},
//     '000006': { description: '1'}
// };

// checkin.arrived
// Object {000004: 1}

// concernedUnarrivedArray(特殊チケット)
// unarrive
// Object {id: "1", name: "wheelchair", unarrivedNum: 2}

// "1"という区分に含まれるチケットID [4,5,6]
// 2重ループ？4,5,6をチェック

    // 未入場者数 = 来場予定者数 - チェックポイント通過者数
    concernedUnarrivedArray.forEach((unarrive: any) => {
        const arrivedNum : number = checkin.arrived.hasOwnProperty(unarrive.id) ? (<any>checkin.arrived)[unarrive.id] : 0;
        unarrive.unarrivedNum = unarrive.unarrivedNum - arrivedNum;
    });

    return concernedUnarrivedArray;
}

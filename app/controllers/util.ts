/**
 * 汎用utilコントローラー
 *
 * @namespace util
 */

import { Request, Response } from 'express';
import { Models, ReservationUtil, PerformanceStatusesModel } from '@motionpicture/ttts-domain';
import * as moment from 'moment';
import * as conf from 'config';

// チケット情報(descriptionは予約データに持つべき(ticket_description))
const ticketInfos: any = conf.get('ticketInfos');
// const ticketInfos: any = {
//     '000004': { description: '1'},
//     '000005': { description: '1'},
//     '000006': { description: '1'}
// };

// 出力対象区分
const descriptionInfos: any = conf.get('descriptionInfos');
//const descriptionInfos: any = {1: 'wheelchair'};

/**
 * API・指定dayのスケジュール＆残席数JSON出力
 * @desc POS横タブレットなどで利用 (日付時刻と残数のみを得る。取得文字列の整形などはしない)
 * @memberof util
 * @function performancestatus
 * @param {Request} req
 * @param {Response} res
 * @returns {Promise<void>}
 */
 export async function performancestatus(req: Request, res: Response): Promise<void> {
    let error: null | string = null;
    let data: any[] = [];

    try {
        // dayはYYYYMMDD
        if (!req.query.day || req.query.day.length !== 8) {
            throw new Error();
        }

        // パフォーマンス一覧を取得
        const query = Models.Performance.find({ day: req.query.day }, 'day start_time end_time');
        const performances = <any[]>await query.lean(true).exec().catch((err) => { error = err; })
        if (!Array.isArray(performances) || !performances.length) {
            throw new Error();
        }

        // 空席数を取得
        const performanceStatuses = await PerformanceStatusesModel.find().catch((err) => { error = err; });
        if (typeof performanceStatuses !== 'object') {
            throw new Error('typeof performanceStatuses !== "object"');
        }

        // 個々のパフォーマンスオブジェクトに追加
        data = performances.map((performance) => {
            performance.seat_status = (<any>performanceStatuses)[performance._id] || null;
            delete performance._id;
            return performance;
        })
    } catch (e) {
        error = e.message || error;
    }

    res.json({
        error,
        data
    });
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
        // if (req.staffUser === undefined) {
        //     throw new Error('staffUser not defined.');
        // }
        // if (!req.staffUser.isAuthenticated()) {
        //     throw new Error('staffUser not authenticated.');
        // }
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
            for (const ticketType of ticketTypes) {
                if (isSpecialTicket(ticketType.get('description'))) {
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
                if (isSpecialTicket(ticketType.get('description'))) {
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
            if (!reservedExtra.hasOwnProperty(description)) {
                reservedExtra[description] = {
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

    // 到着チケットをチェックし、同じdescriptionの予約数からチェックイン数を引く
    for (const tycketType of Object.keys(checkin.arrived)){
        if (!ticketInfos.hasOwnProperty(tycketType)) {
            continue;
        }
        // チケット情報からdescriptionを取得
        const description: string = ticketInfos[tycketType].description;
        concernedUnarrivedArray.forEach((unarrive: any) => {
            if (description === unarrive.id) {
                // 未入場者数 = 来場予定者数 - チェックポイント通過者数
                const arrivedNum : number = checkin.arrived[tycketType];
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
function isSpecialTicket(description: string): boolean {
    return description !== '0';
}

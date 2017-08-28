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
            staffUser: req.staffUser,
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
        // tslint:disable-next-line:no-magic-numbers
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

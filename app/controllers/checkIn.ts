/**
 * 入場コントローラー
 *
 * 上映当日入場画面から使う機能はここにあります。
 *
 * @namespace checkIn
 */
import { Models } from '@motionpicture/chevre-domain';
import { ReservationUtil } from '@motionpicture/chevre-domain';
import { FilmUtil } from '@motionpicture/chevre-domain';
import { NextFunction, Request, Response } from 'express';
import * as mongoose from 'mongoose';
import * as _ from 'underscore';

/**
 * 入場画面のパフォーマンス検索
 * @memberof checkIn
 * @function performances
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 * @returns {Promise<void>}
 */
export async function performances(_: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        // 劇場とスクリーンを取得
        const theaters = await Models.Theater.find(
            {},
            'name'
        ).exec();

        const screens = await Models.Screen.find(
            {},
            'name theater'
        ).exec();

        const screensByTheater: any = {};
        screens.forEach((screen) => {
            if (screensByTheater[screen.get('theater')] === undefined) {
                screensByTheater[screen.get('theater')] = [];
            }

            screensByTheater[screen.get('theater')].push(screen);
        });

        res.render('checkIn/performances', {
            FilmUtil: FilmUtil,
            theaters: theaters,
            screensByTheater: screensByTheater,
            event: {
                start: '2016-10-25T00:00:00+09:00',
                end: '2017-12-31T23:59:59+09:00'
            },
            layout: 'layouts/checkIn/layout'
        });
        return;
    } catch (error) {
        next(error);
        return;
    }
}

/**
 * 入場画面のパフォーマンス選択
 * @memberof checkIn
 * @function performanceSelect
 * @param {Request} req
 * @param {Response} res
 * @returns {Promise<void>}
 */
export async function performanceSelect(req: Request, res: Response): Promise<void> {
    if (!_.isEmpty(req.body.performanceId)) {
        res.redirect(`/checkin/performance/${req.body.performanceId}/confirm`);
        return;
    } else {
        res.redirect('/checkin/performances');
        return;
    }
}

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
export async function confirm(req: Request, res: Response, next: NextFunction) {
    try {
        const performance = await Models.Performance.findOne({ _id: req.params.id })
            .populate('film', 'name')
            .populate('screen', 'name')
            .populate('theater', 'name')
            .exec();

        const reservations = await Models.Reservation.find(
            {
                performance: performance.get('_id'),
                status: ReservationUtil.STATUS_RESERVED
            },
            'performance_day seat_code ticket_type_code ticket_type_name_ja ticket_type_name_en checkins payment_no payment_seat_index'
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

        res.render('checkIn/confirm', {
            performance: performance,
            reservationsById: reservationsById,
            reservationIdsByQrStr: reservationIdsByQrStr,
            layout: 'layouts/checkIn/layout'
        });
        return;
    } catch (error) {
        next(new Error('unexepected error'));
        return;
    }
}

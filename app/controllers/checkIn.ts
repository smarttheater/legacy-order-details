/**
 * 入場コントローラー
 *
 * 上映当日入場画面から使う機能はここにあります。
 *
 * @namespace checkIn
 */
import { Models } from '@motionpicture/ttts-domain';
import { ReservationUtil } from '@motionpicture/ttts-domain';
import { FilmUtil } from '@motionpicture/ttts-domain';
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
export async function confirm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const performance = await Models.Performance.findOne({ _id: req.params.id })
            .populate('film', 'name')
            .populate('screen', 'name')
            .populate('theater', 'name')
            .exec();

        res.render('checkIn/confirm', {
            performance: performance,
            layout: 'layouts/checkIn/layout'
        });
        return;
    } catch (error) {
        next(new Error('unexepected error'));
        return;
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
        const id = req.body.id;
        const reservations = await Models.Reservation.find(
            {
                performance: id,
                status: ReservationUtil.STATUS_RESERVED
            }
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

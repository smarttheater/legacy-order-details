/**
 * 入場コントローラー
 * 上映当日入場画面から使う機能はここにあります。
 * @namespace checkIn
 */

import * as ttts from '@motionpicture/ttts-domain';
import { NextFunction, Request, Response } from 'express';
import { BAD_REQUEST, CREATED, INTERNAL_SERVER_ERROR, NO_CONTENT, NOT_FOUND } from 'http-status';
import * as moment from 'moment';
import * as _ from 'underscore';

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
            checkinAdminUser: req.checkinAdminUser,
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
            checkinAdminUser: req.checkinAdminUser,
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
        // 予約検索条件(デフォルトはReservationConfirmedステータス)
        const conditions: any = {
            status: ttts.factory.reservationStatusType.ReservationConfirmed
        };
        if (!_.isEmpty(req.body.performanceId)) {
            conditions.performance = req.body.performanceId;
        } else {
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
        const reservations = await reservationRepo.reservationModel.find(conditions).exec();

        const reservationsById: {
            [id: string]: ttts.mongoose.Document
        } = {};
        const reservationIdsByQrStr: {
            [qr: string]: string
        } = {};
        reservations.forEach((reservation) => {
            reservationsById[reservation.get('id')] = reservation;
            reservationIdsByQrStr[reservation.get('qr_str')] = reservation.get('id');
        });

        res.json({
            error: null,
            reservationsById: reservationsById,
            reservationIdsByQrStr: reservationIdsByQrStr
        });
    } catch (error) {
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
    if (req.checkinAdminUser === undefined) {
        throw new Error('checkinAdminUser not defined.');
    }
    if (!req.checkinAdminUser.isAuthenticated()) {
        throw new Error('checkinAdminUser not authenticated.');
    }

    try {
        const reservation = await getReservationByQR(req.params.qr);

        if (reservation === null) {
            res.status(NOT_FOUND).json(null);
        } else {
            res.json(reservation);
        }
    } catch (error) {
        res.status(INTERNAL_SERVER_ERROR).json({
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
        if (req.checkinAdminUser === undefined) {
            throw new Error('checkinAdminUser not defined.');
        }
        if (!req.checkinAdminUser.isAuthenticated()) {
            throw new Error('checkinAdminUser not authenticated.');
        }
        if (!req.body.when || !req.body.where || !req.body.how) {
            res.status(BAD_REQUEST).json({
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
        const newReservation = await reservationRepo.reservationModel.findOneAndUpdate(
            {
                qr_str: req.params.qr
            },
            {
                $push: {
                    checkins: checkin
                }
            },
            { new: true }
        ).exec();

        if (newReservation === null) {
            res.status(NOT_FOUND).json(null);
        } else {
            res.status(CREATED).json(checkin);
        }
    } catch (error) {
        res.status(INTERNAL_SERVER_ERROR).json({
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
        if (req.checkinAdminUser === undefined) {
            throw new Error('checkinAdminUser not defined.');
        }
        if (!req.checkinAdminUser.isAuthenticated()) {
            throw new Error('checkinAdminUser not authenticated.');
        }
        if (!req.body.when) {
            res.status(BAD_REQUEST).json({
                error: 'チェックイン取り消し失敗',
                message: 'Invalid request.'
            });

            return;
        }

        const reservationRepo = new ttts.repository.Reservation(ttts.mongoose.connection);
        const newReservation = await reservationRepo.reservationModel.findOneAndUpdate(
            {
                qr_str: req.params.qr
            },
            {
                $pull: {
                    checkins: { when: req.body.when }
                }
            },
            { new: true }
        ).exec();

        if (newReservation === null) {
            res.status(NOT_FOUND).json(null);
        } else {
            res.status(NO_CONTENT).end();
        }
    } catch (error) {
        res.status(INTERNAL_SERVER_ERROR).json({
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
async function getReservationByQR(qr: string): Promise<ttts.factory.reservation.event.IReservation | null> {
    const reservationRepo = new ttts.repository.Reservation(ttts.mongoose.connection);

    return reservationRepo.reservationModel.findOne(
        {
            qr_str: qr,
            status: ttts.factory.reservationStatusType.ReservationConfirmed
        }
    ).exec().then((doc) => (doc === null) ? null : <ttts.factory.reservation.event.IReservation>doc.toObject());
}

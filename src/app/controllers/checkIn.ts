/**
 * 入場コントローラー
 * 上映当日入場画面から使う機能はここにあります。
 */
import * as tttsapi from '@motionpicture/ttts-api-nodejs-client';
import * as createDebug from 'debug';
import { NextFunction, Request, Response } from 'express';
import { BAD_REQUEST, CREATED, INTERNAL_SERVER_ERROR, NO_CONTENT, NOT_FOUND } from 'http-status';
import * as moment from 'moment-timezone';
import * as _ from 'underscore';

import { chevreReservation2ttts } from '../../common/Util/reservation';

const debug = createDebug('ttts-authentication:controllers:checkIn');

/**
 * QRコード認証画面
 * @desc Rコードを読み取って結果を表示するための画面
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
 */
export async function getReservations(req: Request, res: Response): Promise<void> {
    try {
        const now = moment();

        if (req.checkinAdminUser === undefined) {
            throw new Error('checkinAdminUser not defined.');
        }

        // 予約を検索
        const reservationService = new tttsapi.service.Reservation({
            endpoint: <string>process.env.API_ENDPOINT,
            auth: req.checkinAdminUser.authClient
        });

        const searchReservationsResult = await reservationService.search({
            limit: 100,
            typeOf: tttsapi.factory.chevre.reservationType.EventReservation,
            reservationStatuses: [tttsapi.factory.chevre.reservationStatusType.ReservationConfirmed],
            reservationFor: {
                id: (!_.isEmpty(req.body.performanceId)) ? req.body.performanceId : undefined,
                startThrough: now.add(1, 'second').toDate(),
                ...{ endFrom: now.toDate() }
            }
        });
        const reservations = searchReservationsResult.data.map(chevreReservation2ttts);
        debug(reservations.length, 'reservations found.');

        const reservationsById: {
            [id: string]: tttsapi.factory.reservation.event.IReservation;
        } = {};
        const reservationIdsByQrStr: {
            [qr: string]: string;
        } = {};
        reservations.forEach((reservation) => {
            reservationsById[reservation.id] = reservation;
            reservationIdsByQrStr[reservation.id] = reservation.id;
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
 */
export async function getReservation(req: Request, res: Response): Promise<void> {
    if (req.checkinAdminUser === undefined) {
        throw new Error('checkinAdminUser not defined.');
    }
    if (!req.checkinAdminUser.isAuthenticated()) {
        throw new Error('checkinAdminUser not authenticated.');
    }

    try {
        const reservationService = new tttsapi.service.Reservation({
            endpoint: <string>process.env.API_ENDPOINT,
            auth: req.checkinAdminUser.authClient
        });
        const reservation = await reservationService.findById({ id: req.params.qr });
        if (reservation.reservationStatus !== tttsapi.factory.chevre.reservationStatusType.ReservationConfirmed) {
            res.status(NOT_FOUND).json(null);
        } else {
            res.json(chevreReservation2ttts(reservation));
        }
    } catch (error) {
        if (error.code === NOT_FOUND) {
            res.status(NOT_FOUND).json(null);

            return;
        }

        res.status(INTERNAL_SERVER_ERROR).json({
            error: '予約情報取得失敗',
            message: error
        });
    }
}

/**
 * チェックイン作成
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
            when: moment(req.body.when).toDate(),
            where: req.body.where,
            why: '',
            how: req.body.how
        };

        const reservationService = new tttsapi.service.Reservation({
            endpoint: <string>process.env.API_ENDPOINT,
            auth: req.checkinAdminUser.authClient
        });
        await reservationService.addCheckin({
            reservationId: req.params.qr,
            checkin: checkin
        });

        res.status(CREATED).json(checkin);
    } catch (error) {
        res.status(INTERNAL_SERVER_ERROR).json({
            error: 'チェックイン情報作成失敗',
            message: error.message
        });
    }
}
/**
 * チェックイン取り消し
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

        const reservationService = new tttsapi.service.Reservation({
            endpoint: <string>process.env.API_ENDPOINT,
            auth: req.checkinAdminUser.authClient
        });
        await reservationService.cancelCheckin({
            reservationId: req.params.qr,
            when: moment(req.body.when).toDate()
        });

        res.status(NO_CONTENT).end();
    } catch (error) {
        res.status(INTERNAL_SERVER_ERROR).json({
            error: 'チェックイン取り消し失敗',
            message: error.message
        });
    }
}

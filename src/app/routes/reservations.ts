/**
 * 予約ルーター
 */
import * as tttsapi from '@motionpicture/ttts-api-nodejs-client';
import * as createDebug from 'debug';
import { Router } from 'express';
import * as jwt from 'jsonwebtoken';

import { chevreReservation2ttts } from '../../common/Util/reservation';

const reservationsRouter = Router();

const debug = createDebug('ttts-authentication:routes:reservations');

const authClient = new tttsapi.auth.ClientCredentials({
    domain: <string>process.env.API_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.API_CLIENT_ID,
    clientSecret: <string>process.env.API_CLIENT_SECRET,
    scopes: [],
    state: ''
});

const reservationService = new tttsapi.service.Reservation({
    endpoint: <string>process.env.API_ENDPOINT,
    auth: authClient
});

/**
 * チケット印刷(A4)
 * output:thermal→PCサーマル印刷 (WindowsでStarPRNTドライバを使用)
 */
reservationsRouter.get(
    '/print',
    async (req, res, next) => {
        try {
            // tslint:disable-next-line:no-suspicious-comment
            // TODO トークン期限チェック

            // 他所からリンクされてくる時のためURLで言語を指定できるようにしておく (TTTS-230)
            (<any>req.session).locale = req.params.locale;

            jwt.verify(<string>req.query.token, <string>process.env.TTTS_TOKEN_SECRET, async (jwtErr, decoded: any) => {
                if (jwtErr instanceof Error) {
                    next(jwtErr);
                } else {
                    debug('token verified.', decoded.object);
                    const ids = <string[]>decoded.object;

                    let reservations = await Promise.all(ids.map(async (id) => reservationService.findById({ id })));
                    reservations = reservations.filter(
                        (r) => r.reservationStatus === tttsapi.factory.reservationStatusType.ReservationConfirmed
                    );

                    if (reservations.length === 0) {
                        next(new Error(req.__('NotFound')));

                        return;
                    }

                    // チケットコード順にソート
                    reservations.sort((a, b) => {
                        if (a.reservedTicket.ticketType.identifier < b.reservedTicket.ticketType.identifier) {
                            return -1;
                        }
                        if (a.reservedTicket.ticketType.identifier > b.reservedTicket.ticketType.identifier) {
                            return 1;
                        }

                        return 0;
                    })
                        .map(chevreReservation2ttts);

                    const output = req.query.output;
                    switch (output) {
                        // サーマル印刷 (72mm幅プレプリント厚紙)
                        case 'thermal':
                            res.render('print/thermal', {
                                layout: false,
                                reservations: reservations
                            });

                            break;

                        // サーマル印刷 (58mm幅普通紙)
                        case 'thermal_normal':
                            res.render('print/print_pcthermal', {
                                layout: false,
                                reservations: reservations
                            });

                            break;

                        // デフォルトはA4印刷
                        default:
                            res.render('print/print', {
                                layout: false,
                                reservations: reservations
                            });
                    }
                }
            });
        } catch (error) {
            next(new Error(req.__('UnexpectedError')));
        }
    });

export default reservationsRouter;

/**
 * 予約ルーター
 * @ignore
 */

import * as ttts from '@motionpicture/ttts-domain';
import * as createDebug from 'debug';
import { Router } from 'express';
const reservationsRouter = Router();

const debug = createDebug('ttts-authentication:routes:reservations');

const redisClient = ttts.redis.createClient({
    host: <string>process.env.REDIS_HOST,
    // tslint:disable-next-line:no-magic-numbers
    port: parseInt(<string>process.env.REDIS_PORT, 10),
    password: <string>process.env.REDIS_KEY,
    tls: { servername: <string>process.env.REDIS_HOST }
});

/**
 * チケット印刷(A4)
 * output:thermal→PCサーマル印刷 (WindowsでStarPRNTドライバを使用)
 */
reservationsRouter.get(
    '/print',
    async (req, res, next) => {
        try {
            const tokenRepo = new ttts.repository.Token(redisClient);
            const ids = await tokenRepo.verifyPrintToken(req.query.token);
            debug('token verified.', ids);

            const reservationRepo = new ttts.repository.Reservation(ttts.mongoose.connection);
            const reservations = await reservationRepo.reservationModel.find({
                _id: { $in: ids },
                status: ttts.factory.reservationStatusType.ReservationConfirmed
            }).sort({ seat_code: 1 }).exec();

            if (reservations.length === 0) {
                next(new Error(req.__('NotFound')));

                return;
            }

            const output = req.query.output;
            switch (output) {
                // サーマル印刷
                case 'thermal':
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

                    break;
            }
        } catch (error) {
            next(new Error(req.__('UnexpectedError')));
        }
    });

export default reservationsRouter;

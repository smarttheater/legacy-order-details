/**
 * 入場ルーター
 */
import * as express from 'express';
import * as checkInController from '../controllers/checkIn';
import userAuthentication from '../middlewares/userAuthentication';

const checkinRouter = express.Router();

// ログイン
checkinRouter.all(
    '/login',
    (__, res) => {
        res.redirect('/checkin/confirm');
    }
);
// ログアウト
checkinRouter.all(
    '/logout',
    userAuthentication,
    (req, res) => {
        res.redirect(<string>req.staffUser?.generateLogoutUrl());
    }
);

// 入場確認
checkinRouter.get('/confirm', userAuthentication, checkInController.confirm);
checkinRouter.post('/confirm', userAuthentication, checkInController.confirm);

// テスト！(入場確認)
checkinRouter.get('/confirmTest', userAuthentication, checkInController.confirmTest);
checkinRouter.post('/confirmTest', userAuthentication, checkInController.confirmTest);

// api・チケット認証関連
checkinRouter.post('/performance/reservations', userAuthentication, checkInController.getReservations);
checkinRouter.get('/reservation/:qr', userAuthentication, checkInController.getReservation);
checkinRouter.post('/reservation/:qr', userAuthentication, checkInController.addCheckIn);
checkinRouter.delete('/reservation/:qr', userAuthentication, checkInController.removeCheckIn);

export default checkinRouter;

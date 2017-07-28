/**
 * 入場ルーター
 *
 * @ignore
 */
import * as express from 'express';
import * as checkInAuthController from '../controllers/auth';
import * as checkInController from '../controllers/checkIn';
import userAuthentication from '../middlewares/userAuthentication';
import StaffUser from '../models/user/staff';

const checkinRouter = express.Router();
const base = (req: express.Request, __: express.Response, next: express.NextFunction) => {
    req.staffUser = StaffUser.parse(req.session);
    next();
};

// ログイン
checkinRouter.all('/login', checkInAuthController.login);
// ログアウト
checkinRouter.all('/logout', checkInAuthController.logout);

// 入場確認
checkinRouter.get('/confirm', base, userAuthentication, checkInController.confirm);
checkinRouter.post('/confirm', base, userAuthentication, checkInController.confirm);

// テスト！(入場確認)
checkinRouter.get('/confirmTest', base, userAuthentication, checkInController.confirmTest);
checkinRouter.post('/confirmTest', base, userAuthentication, checkInController.confirmTest);

// api・チケット認証関連
checkinRouter.post('/performance/reservations', base, userAuthentication, checkInController.getReservations);
checkinRouter.get('/reservation/:qr', base, userAuthentication, checkInController.getReservation);
checkinRouter.post('/reservation/:qr', base, userAuthentication, checkInController.addCheckIn);
checkinRouter.delete('/reservation/:qr', base, userAuthentication, checkInController.removeCheckIn);

// api・予約通過確認
checkinRouter.get('/pass/list', base, userAuthentication, checkInController.getPassList);

export default checkinRouter;

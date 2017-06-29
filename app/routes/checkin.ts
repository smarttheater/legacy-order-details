/**
 * 入場ルーター
 *
 * @ignore
 */
import { Router } from 'express';
import * as checkInController from '../controllers/checkIn';
const checkinRouter = Router();

checkinRouter.get('/performances', checkInController.performances);
checkinRouter.post('/performances', checkInController.performanceSelect);
checkinRouter.get('/performance/:id/confirm', checkInController.confirm);
checkinRouter.post('/performance/reservations', checkInController.getReservations);

// 予約通過確認
checkinRouter.get('/pass/list', checkInController.getPassList);

export default checkinRouter;

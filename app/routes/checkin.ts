/**
 * 入場ルーター
 *
 * @ignore
 */
import { Router } from 'express';
import * as checkInController from '../controllers/checkIn';
const router = Router();

router.get('/performances', checkInController.performances);
router.post('/performances', checkInController.performanceSelect);
router.get('/performance/:id/confirm', checkInController.confirm);

export default router;

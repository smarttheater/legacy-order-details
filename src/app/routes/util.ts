/**
 * Utilルーター
 *
 * @ignore
 */
import { Router } from 'express';
import * as utilController from '../controllers/util';
const utilRouter = Router();

// API・パフォーマンス残席数取得(POS横用)
utilRouter.get('/performancestatus', utilController.performancestatus);

// api・予約通過確認
utilRouter.get('/pass/list', utilController.getPassList);

export default utilRouter;

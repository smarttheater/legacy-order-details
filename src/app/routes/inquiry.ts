/**
 * チケット照会ルーター
 */
import { Router } from 'express';
import * as inquiryController from '../controllers/inquiry';
const inquiryRouter = Router();

// チケット照会
inquiryRouter.all('/search', inquiryController.search);
// チケット照会/結果表示
inquiryRouter.get('/search/result', inquiryController.result);
// チケット照会/キャンセル処理
inquiryRouter.post('/search/cancel', inquiryController.cancel);

export default inquiryRouter;

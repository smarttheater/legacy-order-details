/**
 * チケット照会ルーター
 *
 * @ignore
 */
import { Router } from 'express';
import * as inquiryController from '../controllers/inquiry';
const inquiryRouter = Router();

// チケット照会
inquiryRouter.all('/search', inquiryController.search);
// チケット照会/結果表示
inquiryRouter.get('/search/result', inquiryController.result);
// チケット照会/チケット印刷(A4)
inquiryRouter.get('/print', inquiryController.print);
// チケット照会/チケット印刷(Windowsサーマル)
inquiryRouter.get('/print_pcthermal', inquiryController.pcthermalprint);

// チケット照会/キャンセル処理
inquiryRouter.post('/search/cancel', inquiryController.cancel);

export default inquiryRouter;

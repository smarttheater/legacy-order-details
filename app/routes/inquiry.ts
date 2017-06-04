/**
 * チケット照会ルーター
 *
 * @ignore
 */
import { Router } from 'express';
import * as inquiryController from '../controllers/inquiry';
const inquiryRouter = Router();

inquiryRouter.get('/search', inquiryController.search);
//inquiryRouter.post('/search', inquiryController.search);
inquiryRouter.get('/search/count', inquiryController.count);
inquiryRouter.get('/search/result', inquiryController.result);

export default inquiryRouter;

/**
 * チケット照会ルーター
 *
 * @ignore
 */
import { Router } from 'express';
import * as inquiryController from '../controllers/inquiry';
const inquiryRouter = Router();

inquiryRouter.all('/search', inquiryController.search);
inquiryRouter.get('/search/result', inquiryController.result);

export default inquiryRouter;

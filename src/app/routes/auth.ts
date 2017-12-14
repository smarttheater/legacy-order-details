/**
 * ユーザー認証ルーター
 *
 * @function authRouter
 * @ignore
 */

import { Router } from 'express';
import * as checkInAuthController from '../controllers/auth';

const authRouter = Router();

// ログイン
authRouter.all('/login', checkInAuthController.login);
// ログアウト
authRouter.all('/logout', checkInAuthController.logout);

export default authRouter;

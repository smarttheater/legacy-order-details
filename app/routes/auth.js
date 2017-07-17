"use strict";
/**
 * ユーザー認証ルーター
 *
 * @function authRouter
 * @ignore
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const checkInAuthController = require("../controllers/auth");
const authRouter = express_1.Router();
// ログイン
authRouter.all('/login', checkInAuthController.login);
// ログアウト
authRouter.all('/logout', checkInAuthController.logout);
exports.default = authRouter;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 入場ルーター
 *
 * @ignore
 */
const express_1 = require("express");
const checkInAuthController = require("../controllers/auth");
const checkInController = require("../controllers/checkIn");
const checkinRouter = express_1.Router();
// ログイン
checkinRouter.all('/login', checkInAuthController.login);
// ログアウト
checkinRouter.all('/logout', checkInAuthController.logout);
// 入場管理
// checkinRouter.get('/performances', checkInController.performances);
// checkinRouter.post('/performances', checkInController.performanceSelect);
// checkinRouter.get('/performance/:id/confirm', checkInController.confirm);
// 入場確認
checkinRouter.get('/confirm', checkInController.confirm);
checkinRouter.post('/confirm', checkInController.confirm);
checkinRouter.get('/confirmTest', checkInController.confirmTest);
checkinRouter.post('/confirmTest', checkInController.confirmTest);
// api・予約一覧取得
checkinRouter.post('/performance/reservations', checkInController.getReservations);
// 予約通過確認
checkinRouter.get('/pass/list', checkInController.getPassList);
exports.default = checkinRouter;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 入場ルーター
 *
 * @ignore
 */
const express = require("express");
const checkInAuthController = require("../controllers/auth");
const checkInController = require("../controllers/checkIn");
const userAuthentication_1 = require("../middlewares/userAuthentication");
const staff_1 = require("../models/user/staff");
const checkinRouter = express.Router();
const base = (req, __, next) => {
    req.staffUser = staff_1.default.parse(req.session);
    next();
};
// ログイン
checkinRouter.all('/login', checkInAuthController.login);
// ログアウト
checkinRouter.all('/logout', checkInAuthController.logout);
// 入場確認
checkinRouter.get('/confirm', base, userAuthentication_1.default, checkInController.confirm);
checkinRouter.post('/confirm', base, userAuthentication_1.default, checkInController.confirm);
// テスト！(入場確認)
checkinRouter.get('/confirmTest', base, userAuthentication_1.default, checkInController.confirmTest);
checkinRouter.post('/confirmTest', base, userAuthentication_1.default, checkInController.confirmTest);
// api・チケット認証関連
checkinRouter.post('/performance/reservations', base, userAuthentication_1.default, checkInController.getReservations);
checkinRouter.get('/reservation/:qr', base, userAuthentication_1.default, checkInController.getReservation);
checkinRouter.post('/reservation/:qr', base, userAuthentication_1.default, checkInController.addCheckIn);
checkinRouter.delete('/reservation/:qr', base, userAuthentication_1.default, checkInController.removeCheckIn);
// api・予約通過確認
checkinRouter.get('/pass/list', base, userAuthentication_1.default, checkInController.getPassList);
exports.default = checkinRouter;

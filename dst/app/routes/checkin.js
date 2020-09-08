"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 入場ルーター
 */
const express = require("express");
const checkInController = require("../controllers/checkIn");
const userAuthentication_1 = require("../middlewares/userAuthentication");
const checkinRouter = express.Router();
// ログイン
checkinRouter.all('/login', (__, res) => {
    res.redirect('/checkin/confirm');
});
// ログアウト
checkinRouter.all('/logout', userAuthentication_1.default, (req, res) => {
    var _a;
    res.redirect((_a = req.staffUser) === null || _a === void 0 ? void 0 : _a.generateLogoutUrl());
});
// 入場確認
checkinRouter.get('/confirm', userAuthentication_1.default, checkInController.confirm);
checkinRouter.post('/confirm', userAuthentication_1.default, checkInController.confirm);
// テスト！(入場確認)
checkinRouter.get('/confirmTest', userAuthentication_1.default, checkInController.confirmTest);
checkinRouter.post('/confirmTest', userAuthentication_1.default, checkInController.confirmTest);
// api・チケット認証関連
checkinRouter.post('/performance/reservations', userAuthentication_1.default, checkInController.getReservations);
checkinRouter.get('/reservation/:qr', userAuthentication_1.default, checkInController.getReservation);
checkinRouter.post('/reservation/:qr', userAuthentication_1.default, checkInController.addCheckIn);
checkinRouter.delete('/reservation/:qr', userAuthentication_1.default, checkInController.removeCheckIn);
exports.default = checkinRouter;

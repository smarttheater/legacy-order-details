"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 入場ルーター
 */
const express = require("express");
const checkinRouter = express.Router();
// ログイン
checkinRouter.all('/login', (__, res) => {
    res.redirect('/checkin/confirm');
});
// 入場確認
checkinRouter.get('/confirm', (__, res, next) => {
    if (typeof process.env.NEW_CHECKIN_URL === 'string') {
        res.redirect(process.env.NEW_CHECKIN_URL);
        return;
    }
    next(new Error('unexepected error'));
});
exports.default = checkinRouter;

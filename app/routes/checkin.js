"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 入場ルーター
 *
 * @ignore
 */
const express_1 = require("express");
const checkInController = require("../controllers/checkIn");
const checkinRouter = express_1.Router();
checkinRouter.get('/performances', checkInController.performances);
checkinRouter.post('/performances', checkInController.performanceSelect);
checkinRouter.get('/performance/:id/confirm', checkInController.confirm);
checkinRouter.post('/performance/reservations', checkInController.getReservations);
exports.default = checkinRouter;

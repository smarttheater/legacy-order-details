"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 入場ルーター
 *
 * @ignore
 */
const express_1 = require("express");
const checkInController = require("../controllers/checkIn");
const router = express_1.Router();
router.get('/performances', checkInController.performances);
router.post('/performances', checkInController.performanceSelect);
router.get('/performance/:id/confirm', checkInController.confirm);
exports.default = router;

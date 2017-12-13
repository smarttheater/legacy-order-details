"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Utilルーター
 *
 * @ignore
 */
const express_1 = require("express");
const utilController = require("../controllers/util");
const utilRouter = express_1.Router();
// API・パフォーマンス残席数取得(POS横用)
utilRouter.get('/performancestatus', utilController.performancestatus);
// api・予約通過確認
utilRouter.get('/pass/list', utilController.getPassList);
exports.default = utilRouter;

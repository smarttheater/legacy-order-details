"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * チケット照会ルーター
 *
 * @ignore
 */
const express_1 = require("express");
const inquiryController = require("../controllers/inquiry");
const inquiryRouter = express_1.Router();
// チケット照会
inquiryRouter.all('/search', inquiryController.search);
// チケット照会/結果表示
inquiryRouter.get('/search/result', inquiryController.result);
// チケット照会/チケット印刷(A4)
inquiryRouter.get('/print', inquiryController.print);
// チケット照会/チケット印刷(Windowsサーマル)
inquiryRouter.get('/print_pcthermal', inquiryController.pcthermalprint);
// チケット照会/キャンセル処理
inquiryRouter.post('/search/cancel', inquiryController.cancel);
exports.default = inquiryRouter;

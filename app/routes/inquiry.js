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
inquiryRouter.get('/search', inquiryController.search);
//inquiryRouter.post('/search', inquiryController.search);
inquiryRouter.get('/search/count', inquiryController.count);
inquiryRouter.get('/search/result', inquiryController.result);
exports.default = inquiryRouter;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const baseController = require("../controllers/base");
const errorController = require("../controllers/error");
const checkin_1 = require("./checkin");
const inquiry_1 = require("./inquiry");
/**
 * URLルーティング
 *
 * app.get(パス, ルーティング名称, メソッド);
 * といった形でルーティングを登録する
 * ルーティング名称は、ejs側やコントローラーでURLを生成する際に用いたりするので、意識的にページ一意な値を定めること
 *
 * リクエスト毎に、req,res,nextでコントローラーインスタンスを生成して、URLに応じたメソッドを実行する、という考え方
 */
exports.default = (app) => {
    const base = baseController.setLocals;
    // 入場
    app.use('/checkin', base, checkin_1.default);
    // チケット照会
    app.use('/inquiry', base, inquiry_1.default);
    // 404
    app.get('/error/notFound', base, errorController.notFound);
    app.use((_, res) => { res.redirect('/error/notFound'); });
    // error handlers
    app.use(errorController.index);
};

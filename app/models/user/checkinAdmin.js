"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const base_1 = require("./base");
/**
 * 入場管理者ユーザー
 *
 * @export
 * @class MasterAdminUser
 * @extends {BaseUser}
 */
class CheckInAdminUser extends base_1.default {
    static PARSE(session) {
        const user = new CheckInAdminUser();
        // セッション値からオブジェクトにセット
        if (session !== undefined && session.hasOwnProperty(CheckInAdminUser.AUTH_SESSION_NAME)) {
            Object.keys(session[CheckInAdminUser.AUTH_SESSION_NAME]).forEach((propertyName) => {
                user[propertyName] = session[CheckInAdminUser.AUTH_SESSION_NAME][propertyName];
            });
        }
        return user;
    }
}
CheckInAdminUser.AUTH_SESSION_NAME = 'TTTSCheckinAdminUser';
exports.default = CheckInAdminUser;

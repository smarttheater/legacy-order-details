"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 入場管理者ユーザー
 * @export
 * @class CheckinAdminUser
 * @extends {BaseUser}
 */
class CheckinAdminUser {
    static PARSE(session) {
        const user = new CheckinAdminUser();
        // セッション値からオブジェクトにセット
        if (session !== undefined && session.checkinAdminUser !== undefined) {
            user.familyName = session.checkinAdminUser.familyName;
            user.givenName = session.checkinAdminUser.givenName;
            user.email = session.checkinAdminUser.email;
            user.telephone = session.checkinAdminUser.telephone;
            user.username = session.checkinAdminUser.username;
        }
        return user;
    }
    /**
     * サインイン中かどうか
     */
    isAuthenticated() {
        return (this.username !== undefined);
    }
}
exports.default = CheckinAdminUser;

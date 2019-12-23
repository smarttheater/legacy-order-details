"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tttsapi = require("@motionpicture/ttts-api-nodejs-client");
/**
 * 入場管理者ユーザー
 */
class CheckinAdminUser {
    static PARSE(session) {
        const user = new CheckinAdminUser();
        // セッション値からオブジェクトにセット
        if (session !== undefined && session.checkinAdminUser !== undefined) {
            user.group = session.checkinAdminUser.group;
            user.familyName = session.checkinAdminUser.familyName;
            user.givenName = session.checkinAdminUser.givenName;
            user.email = session.checkinAdminUser.email;
            user.telephone = session.checkinAdminUser.telephone;
            user.username = session.checkinAdminUser.username;
            user.authClient = new tttsapi.auth.OAuth2({
                domain: process.env.ADMIN_API_AUTHORIZE_SERVER_DOMAIN,
                clientId: process.env.ADMIN_API_CLIENT_ID,
                clientSecret: process.env.ADMIN_API_CLIENT_SECRET
            });
            if (session.cognitoCredentials !== undefined && session.cognitoCredentials !== null) {
                user.authClient.setCredentials({ refresh_token: session.cognitoCredentials.refreshToken });
            }
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

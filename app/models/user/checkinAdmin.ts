import BaseUser from './base';

/**
 * 入場管理者ユーザー
 *
 * @export
 * @class MasterAdminUser
 * @extends {BaseUser}
 */
export default class CheckInAdminUser extends BaseUser {
    public static AUTH_SESSION_NAME: string = 'TTTSCheckinAdminUser';

    public static PARSE(session: Express.Session | undefined): CheckInAdminUser {
        const user = new CheckInAdminUser();
        // セッション値からオブジェクトにセット
        if (session !== undefined && session.hasOwnProperty(CheckInAdminUser.AUTH_SESSION_NAME)) {
            Object.keys(session[CheckInAdminUser.AUTH_SESSION_NAME]).forEach((propertyName) => {
                (<any>user)[propertyName] = session[CheckInAdminUser.AUTH_SESSION_NAME][propertyName];
            });
        }

        return user;
    }
}

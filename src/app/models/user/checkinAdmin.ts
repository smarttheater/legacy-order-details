interface IGroup {
    name: string;
    description: string;
}

/**
 * 入場管理者ユーザー
 */
export default class CheckinAdminUser {
    public group: IGroup;
    public familyName: string;
    public givenName: string;
    public email: string;
    public telephone: string;
    public username: string;

    public static PARSE(session: Express.Session | undefined): CheckinAdminUser {
        const user = new CheckinAdminUser();

        // セッション値からオブジェクトにセット
        if (session !== undefined && session.checkinAdminUser !== undefined) {
            user.group = session.checkinAdminUser.group;
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
    public isAuthenticated(): boolean {
        return (this.username !== undefined);
    }
}

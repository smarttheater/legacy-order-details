/**
 * ttts-authenticationアプリケーション固有の型
 * @ignore
 */
declare namespace Express {
    // tslint:disable-next-line:interface-name
    export interface Request {
        staffUser?: StaffUser;
    }

    /**
     * ログインベースユーザー
     * @class
     */
    export class BaseUser {
        public isAuthenticated(): boolean;
        // tslint:disable-next-line:no-reserved-keywords
        public get(key: string): any;
    }

    /**
     * ログインスタッフユーザー
     * @class
     */
    export class StaffUser extends BaseUser {
    }
}

/**
 * アプリケーション固有の型定義
 * セッションの中身など
 * @ignore
 */

import * as ttts from '@motionpicture/ttts-domain';

declare global {
    namespace Express {
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

        // tslint:disable-next-line:interface-name
        export interface Session {
            /**
             * チケット照会結果
             */
            inquiryResult?: {
                printToken: string;
                reservations: ttts.factory.reservation.event.IReservation[];
            };
        }
    }
}

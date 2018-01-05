/**
 * アプリケーション固有の型定義
 * セッションの中身など
 * @ignore
 */

import * as ttts from '@motionpicture/ttts-domain';
import CheckinAdminUser from '../app/models/user/checkinAdmin';

declare global {
    namespace Express {
        // tslint:disable-next-line:interface-name
        export interface Request {
            checkinAdminUser?: CheckinAdminUser;
        }

        interface ICheckinAdminUser {
            group: string;
            familyName: string;
            givenName: string;
            email: string;
            telephone: string;
            username: string;
        }

        // tslint:disable-next-line:interface-name
        export interface Session {
            checkinAdminUser?: ICheckinAdminUser;
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

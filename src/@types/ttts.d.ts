/**
 * アプリケーション固有の型定義
 * セッションの中身など
 */
import * as cinerinoapi from '@cinerino/api-nodejs-client';

import CheckinAdminUser from '../app/models/user/checkinAdmin';

declare global {
    namespace Express {
        // tslint:disable-next-line:interface-name
        export interface Request {
            checkinAdminUser?: CheckinAdminUser;
        }

        export interface IGroup {
            name: string;
            description: string;
        }

        export interface ICheckinAdminUser {
            group: IGroup;
            familyName: string;
            givenName: string;
            email: string;
            telephone: string;
            username: string;
        }

        export interface ICredentials {
            accessToken: string;
            expiresIn: number;
            idToken: string;
            refreshToken: string;
            tokenType: string;
        }

        // tslint:disable-next-line:interface-name
        export interface Session {
            checkinAdminUser?: ICheckinAdminUser;
            cognitoCredentials?: ICredentials;
            /**
             * チケット照会結果
             */
            inquiryResult?: {
                printToken: string;
                // reservations: tttsapi.factory.order.IReservation[];
                order: cinerinoapi.factory.order.IOrder;
            };
        }
    }
}

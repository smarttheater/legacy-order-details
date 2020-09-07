/**
 * アプリケーション固有の型定義
 * セッションの中身など
 */
import * as cinerinoapi from '@cinerino/sdk';
import * as tttsapi from '@motionpicture/ttts-api-nodejs-client';

// import CheckinAdminUser from '../app/models/user/checkinAdmin';

import { User } from '../app/user';

declare global {
    namespace Express {
        // tslint:disable-next-line:interface-name
        export interface Request {
            // checkinAdminUser?: CheckinAdminUser;
            staffUser?: User;
            tttsAuthClient: tttsapi.auth.OAuth2;
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

        interface IStaffUser {
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
            staffUser?: IStaffUser;
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

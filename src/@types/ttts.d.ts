/**
 * アプリケーション固有の型定義
 * セッションの中身など
 */
import * as cinerinoapi from '@cinerino/sdk';

declare global {
    namespace Express {
        // tslint:disable-next-line:interface-name
        export interface Session {
            /**
             * チケット照会結果
             */
            inquiryResult?: {
                code?: string;
                order: cinerinoapi.factory.order.IOrder;
            };
            /**
             * 印刷結果
             */
            printResult?: {
                order?: cinerinoapi.factory.order.IOrder;
                reservations: cinerinoapi.factory.order.IReservation[];
            };
        }
    }
}

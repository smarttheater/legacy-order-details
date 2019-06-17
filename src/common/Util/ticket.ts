import * as tttsapi from '@motionpicture/ttts-api-nodejs-client';
import { Request } from 'express';
import * as numeral from 'numeral';

export interface ITicketInfo {
    [key: string]: {
        ticket_type_name: tttsapi.factory.chevre.multilingualString;
        charge: string;
        count: number;
        info: string;
    };
}

/**
 * 券種ごとに合計枚数算出
 */
export function getTicketInfos(reservations: tttsapi.factory.reservation.event.IReservation[]): any {
    // 券種ごとに合計枚数算出
    const ticketInfos: ITicketInfo = {};
    for (const reservation of reservations) {
        // チケットタイプセット
        const ticketType = reservation.reservedTicket.ticketType;
        const dataValue = ticketType.identifier;
        const price = (ticketType.priceSpecification !== undefined) ? ticketType.priceSpecification.price : 0;

        // チケットタイプごとにチケット情報セット
        if (!ticketInfos.hasOwnProperty(dataValue)) {
            ticketInfos[dataValue] = {
                ticket_type_name: ticketType.name,
                charge: `\\${numeral(price).format('0,0')}`,
                count: 1,
                info: ''
            };
        } else {
            ticketInfos[dataValue].count += 1;
        }
    }

    return ticketInfos;
}

export function editTicketInfos(req: Request, ticketInfos: ITicketInfo): ITicketInfo {
    const locale: string = (<any>req.session).locale;

    // 券種ごとの表示情報編集
    Object.keys(ticketInfos).forEach((key) => {
        const ticketInfo = ticketInfos[key];
        const ticketCountEdit = req.__('{{n}}Leaf', { n: ticketInfo.count.toString() });
        ticketInfos[key].info = `${(<any>ticketInfo.ticket_type_name)[locale]} ${ticketInfo.charge} × ${ticketCountEdit}`;
    });

    return ticketInfos;
}

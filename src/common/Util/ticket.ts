import { Request } from 'express';
import * as numeral from 'numeral';
/**
 * 券種ごとに合計枚数算出
 */
export function getTicketInfos(reservations: any[]): any {
    // 券種ごとに合計枚数算出
    const keyName: string = 'ticket_type';
    const ticketInfos: {} = {};
    for (const reservation of reservations) {
        // チケットタイプセット
        const dataValue = reservation[keyName];
        // チケットタイプごとにチケット情報セット
        if (!ticketInfos.hasOwnProperty(dataValue)) {
            (<any>ticketInfos)[dataValue] = {
                ticket_type_name: reservation.ticket_type_name,
                charge: `\\${numeral(reservation.charge).format('0,0')}`,
                count: 1
            };
        } else {
            (<any>ticketInfos)[dataValue].count += 1;
        }
    }

    return ticketInfos;
}
export function editTicketInfos(req: Request, ticketInfos: any[]): any {
    const locale = (<any>req.session).locale;
    // 券種ごとの表示情報編集
    Object.keys(ticketInfos).forEach((key) => {
        const ticketInfo = (<any>ticketInfos)[key];
        const ticketCountEdit = req.__('{{n}}Leaf', { n: ticketInfo.count.toString() });
        (<any>ticketInfos)[key].info = `${ticketInfo.ticket_type_name[locale]} ${ticketInfo.charge} × ${ticketCountEdit}`;
    });

    return ticketInfos;
}

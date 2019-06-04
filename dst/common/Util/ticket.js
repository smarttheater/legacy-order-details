"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const numeral = require("numeral");
/**
 * 券種ごとに合計枚数算出
 */
function getTicketInfos(reservations) {
    // 券種ごとに合計枚数算出
    const keyName = 'ticket_type';
    const ticketInfos = {};
    for (const reservation of reservations) {
        // チケットタイプセット
        const dataValue = reservation[keyName];
        // チケットタイプごとにチケット情報セット
        if (!ticketInfos.hasOwnProperty(dataValue)) {
            ticketInfos[dataValue] = {
                ticket_type_name: reservation.ticket_type_name,
                charge: `\\${numeral(reservation.charge).format('0,0')}`,
                count: 1
            };
        }
        else {
            ticketInfos[dataValue].count += 1;
        }
    }
    return ticketInfos;
}
exports.getTicketInfos = getTicketInfos;
function editTicketInfos(req, ticketInfos) {
    const locale = req.session.locale;
    // 券種ごとの表示情報編集
    Object.keys(ticketInfos).forEach((key) => {
        const ticketInfo = ticketInfos[key];
        const ticketCountEdit = req.__('{{n}}Leaf', { n: ticketInfo.count.toString() });
        ticketInfos[key].info = `${ticketInfo.ticket_type_name[locale]} ${ticketInfo.charge} × ${ticketCountEdit}`;
    });
    return ticketInfos;
}
exports.editTicketInfos = editTicketInfos;

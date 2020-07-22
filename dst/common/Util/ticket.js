"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUnitPriceByAcceptedOffer = exports.editTicketInfos = exports.getTicketInfos = void 0;
const cinerinoapi = require("@cinerino/sdk");
const numeral = require("numeral");
/**
 * 券種ごとに合計枚数算出
 */
function getTicketInfos(order) {
    const acceptedOffers = order.acceptedOffers;
    // チケットコード順にソート
    acceptedOffers.sort((a, b) => {
        if (a.itemOffered.reservedTicket.ticketType.identifier
            < b.itemOffered.reservedTicket.ticketType.identifier) {
            return -1;
        }
        if (a.itemOffered.reservedTicket.ticketType.identifier
            > b.itemOffered.reservedTicket.ticketType.identifier) {
            return 1;
        }
        return 0;
    });
    // 券種ごとに合計枚数算出
    const ticketInfos = {};
    for (const acceptedOffer of acceptedOffers) {
        const reservation = acceptedOffer.itemOffered;
        const ticketType = reservation.reservedTicket.ticketType;
        const price = getUnitPriceByAcceptedOffer(acceptedOffer);
        // チケットタイプセット
        const dataValue = ticketType.identifier;
        // チケットタイプごとにチケット情報セット
        if (!ticketInfos.hasOwnProperty(dataValue)) {
            ticketInfos[dataValue] = {
                ticket_type_name: ticketType.name,
                charge: `\\${numeral(price).format('0,0')}`,
                count: 1,
                info: ''
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
function getUnitPriceByAcceptedOffer(offer) {
    let unitPrice = 0;
    if (offer.priceSpecification !== undefined) {
        const priceSpecification = offer.priceSpecification;
        if (Array.isArray(priceSpecification.priceComponent)) {
            const unitPriceSpec = priceSpecification.priceComponent.find((c) => c.typeOf === cinerinoapi.factory.chevre.priceSpecificationType.UnitPriceSpecification);
            if (unitPriceSpec !== undefined && unitPriceSpec.price !== undefined && Number.isInteger(unitPriceSpec.price)) {
                unitPrice = unitPriceSpec.price;
            }
        }
    }
    return unitPrice;
}
exports.getUnitPriceByAcceptedOffer = getUnitPriceByAcceptedOffer;

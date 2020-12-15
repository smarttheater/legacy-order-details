import * as cinerinoapi from '@cinerino/sdk';
import { Request } from 'express';
import * as numeral from 'numeral';

export interface ITicketInfo {
    [key: string]: {
        ticket_type_name: cinerinoapi.factory.chevre.multilingualString;
        charge: string;
        count: number;
        info: string;
    };
}

/**
 * 券種ごとに合計枚数算出
 */
export function getTicketInfos(order: cinerinoapi.factory.order.IOrder): any {
    const acceptedOffers = order.acceptedOffers;

    // チケットコード順にソート
    acceptedOffers.sort((a, b) => {
        if ((<cinerinoapi.factory.order.IReservation>a.itemOffered).reservedTicket.ticketType.identifier
            < (<cinerinoapi.factory.order.IReservation>b.itemOffered).reservedTicket.ticketType.identifier
        ) {
            return -1;
        }
        if ((<cinerinoapi.factory.order.IReservation>a.itemOffered).reservedTicket.ticketType.identifier
            > (<cinerinoapi.factory.order.IReservation>b.itemOffered).reservedTicket.ticketType.identifier
        ) {
            return 1;
        }

        return 0;
    });

    // 券種ごとに合計枚数算出
    const ticketInfos: ITicketInfo = {};

    for (const acceptedOffer of acceptedOffers) {
        const reservation = <cinerinoapi.factory.order.IReservation>acceptedOffer.itemOffered;
        const ticketType = reservation.reservedTicket.ticketType;
        const price = getUnitPriceByAcceptedOffer(acceptedOffer);

        // チケットタイプセット
        const dataValue = ticketType.identifier;

        // チケットタイプごとにチケット情報セット
        if (!ticketInfos.hasOwnProperty(dataValue)) {
            ticketInfos[dataValue] = {
                ticket_type_name: <cinerinoapi.factory.chevre.multilingualString>ticketType.name,
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

export type ICompoundPriceSpecification = cinerinoapi.factory.chevre.compoundPriceSpecification.IPriceSpecification<any>;

export function getUnitPriceByAcceptedOffer(offer: cinerinoapi.factory.order.IAcceptedOffer<any>) {
    let unitPrice: number = 0;

    if (offer.priceSpecification !== undefined) {
        const priceSpecification = <ICompoundPriceSpecification>offer.priceSpecification;
        if (Array.isArray(priceSpecification.priceComponent)) {
            const unitPriceSpec = priceSpecification.priceComponent.find(
                (c) => c.typeOf === cinerinoapi.factory.chevre.priceSpecificationType.UnitPriceSpecification
            );
            if (unitPriceSpec !== undefined && unitPriceSpec.price !== undefined && Number.isInteger(unitPriceSpec.price)) {
                unitPrice = unitPriceSpec.price;
            }
        }
    }

    return unitPrice;
}

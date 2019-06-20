import * as tttsapi from '@motionpicture/ttts-api-nodejs-client';
import * as moment from 'moment-timezone';

export function chevreReservation2ttts(
    params: tttsapi.factory.reservation.event.IReservation
): tttsapi.factory.reservation.event.IReservation {
    const ticketType = params.reservedTicket.ticketType;
    const underName = params.underName;

    let paymentMethod: tttsapi.factory.paymentMethodType | undefined;
    if (underName !== undefined && Array.isArray(underName.identifier)) {
        const paymentMethodProperty = underName.identifier.find((p) => p.name === 'paymentMethod');
        if (paymentMethodProperty !== undefined) {
            paymentMethod = <tttsapi.factory.paymentMethodType>paymentMethodProperty.value;
        }
    }

    params.qr_str = params.id;
    params.payment_no = params.reservationNumber;
    params.performance = params.reservationFor.id;
    params.performance_day = moment(params.reservationFor.startDate)
        .tz('Asia/Tokyo')
        .format('YYYYMMDD');
    params.performance_end_date = moment(params.reservationFor.endDate)
        .toDate();
    params.performance_end_time = moment(params.reservationFor.endDate)
        .tz('Asia/Tokyo')
        .format('HHmm');
    params.performance_start_date = moment(params.reservationFor.startDate)
        .toDate();
    params.performance_start_time = moment(params.reservationFor.startDate)
        .tz('Asia/Tokyo')
        .format('HHmm');
    params.charge = (ticketType.priceSpecification !== undefined) ? ticketType.priceSpecification.price : 0;
    params.payment_method = (paymentMethod !== undefined) ? paymentMethod : <any>'';
    params.seat_code = (params.reservedTicket.ticketedSeat !== undefined) ? params.reservedTicket.ticketedSeat.seatNumber : '';
    params.ticket_type = ticketType.identifier;
    params.ticket_type_charge = (ticketType.priceSpecification !== undefined) ? ticketType.priceSpecification.price : 0;
    params.ticket_type_name = <any>ticketType.name;
    params.purchaser_email = (underName !== undefined && underName.email !== undefined) ? underName.email : '';
    params.purchaser_first_name = (underName !== undefined && underName.givenName !== undefined) ? underName.givenName : '';
    params.purchaser_last_name = (underName !== undefined && underName.familyName !== undefined) ? underName.familyName : '';
    params.purchaser_tel = (underName !== undefined && underName.telephone !== undefined) ? underName.telephone : '';
    params.purchaser_name = (underName !== undefined && underName.name !== undefined) ? underName.name : '';

    return params;
}

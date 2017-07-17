(function () {
    /** 全予約リスト */
    var reservationsById;
    var reservationIdsByQrStr;
    /** 全予約IDリスト */
    var reservationIds;
    var qrStrs;

    $(function(){
        $('.btn-ok').on('click', function(){
            $('form').submit();
        });
        $('.btn-list').on('click', function(){
            getReservations();
        });

        /**
         * 予約情報取得
         * @function getReservations
         * @param {funstion} cb
         * @returns {void}
         */
        function getReservations(cb) {
            var id = $('input[name=performanceId]').val();
            $('#reservations').val('');
            $.ajax({
                dataType: 'json',
                url: '/checkin/performance/reservations',
                type: 'POST',
                data: {
                    performanceId: id
                },
                beforeSend: function () {
                }
            }).done(function (data) {
                if (!data.error) {
                    $('#reservations').val(JSON.stringify(data));
                    /** 全予約リスト */
                    reservationsById = data.reservationsById;
                    reservationIdsByQrStr = data.reservationIdsByQrStr;
                    /** 全予約IDリスト */
                    reservationIds = Object.keys(reservationsById);
                    qrStrs = Object.keys(reservationIdsByQrStr);
                }
            }).fail(function (jqxhr, textStatus, error) {
                console.error(jqxhr, textStatus, error);
            }).always(function () {
                //updateResults();
                //if (cb !== undefined) cb();
            });
        }
    });
})();

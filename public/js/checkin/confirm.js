$(function () {
    var API_ENDPOINT = $('input[name="apiEndpoint"]').val();

    /** 全予約リスト */
    var reservationsById = JSON.parse($('input[name="reservationsById"]').val());
    var reservationIdsByQrStr = JSON.parse($('input[name="reservationIdsByQrStr"]').val());
    /** 全予約IDリスト */
    var reservationIds = Object.keys(reservationsById);
    var qrStrs = Object.keys(reservationIdsByQrStr);
    /** 入場チェック済み予約IDリスト */
    var checkedReservationIds = [];
    /** 入場中予約リスト */
    var enteringReservations = [];
    /** 入場処理済み予約IDリスト */
    var enteredReservationIds = [];
    var audioYes = new Audio('/audio/yes01.mp3');
    var audioNo = new Audio('/audio/no01.mp3');
    audioYes.load();
    audioNo.load();

    /**
     * QRコードをチェックする
     * 
     * @param {strnig} qrStr
     */
    function check(qrStr) {
        if (!qrStr) {
            return false;
        }

        var message = '';

        // 予約データが存在する場合
        if (qrStrs.indexOf(qrStr) >= 0) {
            var _reservation = reservationsById[reservationIdsByQrStr[qrStr]];

            // 入場済みの場合
            if (_reservation.entered) {
                message = _reservation.seat_code + ' [' + _reservation.ticket_type_name_ja + '] 入場済み';
                // audioYes.load();
                audioYes.play();

                $('.result').html(
                    '<div class="alert confirmresult confirmresult-entered" role="alert">' +
                    '<span class="inner">' +
                    '<span class="glyphicon glyphicon glyphicon-ok-sign" aria-hidden="true"></span>' + message +
                    '</span>' +
                    '</div>'
                );
            } else {
                // add to list for checkin.
                if (checkedReservationIds.indexOf(_reservation._id) < 0) {
                    checkedReservationIds.push(_reservation._id);
                    enteringReservations.push({
                        _id: _reservation._id
                    });

                    updateResults();
                }


                message = _reservation.seat_code + ' [' + _reservation.ticket_type_name_ja + '] OK';

                // 02,03は学生
                if (_reservation.ticket_type === '02' || _reservation.ticket_type === '03') {
                    // audioYes.load();
                    audioYes.play();

                    $('.result').html(
                        '<div class="alert confirmresult confirmresult-ok-student" role="alert">' +
                        '<span class="inner">' +
                        '<span class="glyphicon glyphicon glyphicon-ok-sign" aria-hidden="true"></span>' + message +
                        '</span>' +
                        '</div>'
                    );
                } else {
                    // audioYes.load();
                    audioYes.play();

                    $('.result').html(
                        '<div class="alert confirmresult confirmresult-ok" role="alert">' +
                        '<span class="inner">' +
                        '<span class="glyphicon glyphicon glyphicon-ok-sign" aria-hidden="true"></span>' + message +
                        '</span>' +
                        '</div>'
                    );
                }
            }


            // NG
        } else {
            // audioNo.load();
            audioNo.play();

            message = 'NG';

            $('.result').html(
                '<div class="alert confirmresult confirmresult-ng" role="alert">' +
                '<span class="inner">' +
                '<span class="glyphicon glyphicon-remove-sign" aria-hidden="true"></span>' + message +
                '</span>' +
                '</div>'
            );
        }
    }

    /**
    * 入場フラグを送信する
    */
    function processEnter() {
        if (enteringReservations.length < 1) {
            setTimeout(function () {
                processEnter();
            }, 2000);

        } else {
            var enteringReservation = enteringReservations[0];
            var id = enteringReservation._id;
            $.ajax({
                dataType: 'json',
                url: API_ENDPOINT + '/reservation/' + id + '/checkin',
                type: 'POST',
                data: {
                    how: '認証ウェブアプリにて',
                    where: '入場ゲート',
                    why: '映画観覧のため'
                },
                beforeSend: function () {
                }
            }).done(function (data) {
                if (data.success) {
                    console.log('entered. reservationId', id);
                    enteringReservations.splice(0, 1);
                    enteredReservationIds.push(id);
                    reservationsById[id].entered = true;
                }
            }).fail(function (jqxhr, textStatus, error) {

            }).always(function () {
                updateResults();
                processEnter();
            });
        }
    }

    /**
     * 入場結果リストを更新する
     */
    function updateResults() {
        var html = ''

        for (var i = checkedReservationIds.length - 1; i >= 0; i--) {
            var _reservation = reservationsById[checkedReservationIds[i]];
            html +=
                '<tr>' +
                '<td>' + _reservation.seat_code + '</td>' +
                '<td>' + _reservation.ticket_type_name_ja + '</td>' +
                '<td>' + ((enteredReservationIds.indexOf(_reservation._id) >= 0) ? "入場済み" : "入場中...") + '</td>' +
                '</tr>'
                ;
        }

        $('.results tbody').html(html);
    }

    // 入場フラグ送信タイマーをまわす
    processEnter();




    // 文字入力キャッチイベント
    var qrStr = '';
    $(window).keypress(function (e) {
        // 新しい入力値の場合
        if (qrStr.length === 0) {
            $('.process').text($('input[name="messageSearching"]').val());
            $('.result').html('');
        }

        // エンターで入力終了
        if (e.keyCode === 13) {
            // 予約をチェック
            check(qrStr);
            $('.process').text($('input[name="messagePleaseReadBarcode"]').val());
            qrStr = '';
        } else {
            qrStr += String.fromCharCode(e.charCode);
        }
    });

    // for debug
    // check('30092060006-4');
});

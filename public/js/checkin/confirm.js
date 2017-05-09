(function () {
    /** API */
    var API_ENDPOINT;
    /** 全予約リスト */
    var reservationsById;
    var reservationIdsByQrStr;
    /** 全予約IDリスト */
    var reservationIds;
    var qrStrs;
    var qrStr;
    /** 入場チェック済み予約IDリスト */
    var checkedReservationIds;
    /** 入場中予約リスト */
    var enteringReservations;
    /** 入場処理済み予約IDリスト */
    var enteredReservationIds;
    var audioYes = new Audio('/audio/yes01.mp3');
    var audioNo = new Audio('/audio/no01.mp3');

    $(function () {
        init();
        // 予約情報取得
        getReservations(function () {
            processEnter();
            // 予約情報取得 30秒ごと
            loopGetReservations(30000);
        });

        // 文字入力キャッチイベント
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

    /**
     * 初期化
     * @function init
     * @returns {void}
     */
    function init() {
        /** API */
        API_ENDPOINT = $('input[name="apiEndpoint"]').val();
        qrStr = '';
        /** 入場チェック済み予約IDリスト */
        checkedReservationIds = [];
        /** 入場中予約リスト */
        enteringReservations = [];
        /** 入場処理済み予約IDリスト */
        enteredReservationIds = [];
        /** オーディオ */
        audioYes.load();
        audioNo.load();
    }

    /**
     * QRコードをチェックする
     * @function check
     * @param {strnig} qrStr
     * @returns {void}
     */
    function check(qrStr) {
        if (!qrStr) {
            return false;
        }
        if (qrStrs === undefined) {
            alert('予約情報を取得できていません');
            return;
        }
        var message = '';
        // 予約データが存在する場合
        if (qrStrs.indexOf(qrStr) >= 0) {
            var _reservation = reservationsById[reservationIdsByQrStr[qrStr]];

            // 入場済みの場合
            if (_reservation.checkins.length > 0) {
                if ($('.table-responsive tr[data-id=' + _reservation.id + ']').length === 0) {
                    checkedReservationIds.push(_reservation._id);
                }
                enteringReservations.push({
                    _id: _reservation._id
                });
                updateResults();
                message = _reservation.seat_code + ' [' + _reservation.ticket_type_name_ja + '] 入場済み';
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
                audioYes.play();
                $('.result').html(
                    '<div class="alert confirmresult confirmresult-ok" role="alert">' +
                    '<span class="inner">' +
                    '<span class="glyphicon glyphicon glyphicon-ok-sign" aria-hidden="true"></span>' + message +
                    '</span>' +
                    '</div>'
                );
            }
            // NG
        } else {
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
     * @function processEnter
     * @returns {void}
     */
    function processEnter() {
        if (enteringReservations.length < 1) {
            setTimeout(function () {
                processEnter();
            }, 2000);
        } else {
            var enteringReservation = enteringReservations[0];
            var id = enteringReservation._id;
            var checkInHistory = {
                how: '認証ウェブアプリにて',
                where: '入場ゲート',
                why: '映画観覧のため'
            };
            $.ajax({
                dataType: 'json',
                url: API_ENDPOINT + '/reservation/' + id + '/checkin',
                type: 'POST',
                data: checkInHistory,
                beforeSend: function () {
                }
            }).done(function (data) {
                console.log('entered. reservationId', id);
                // 入場中の予約から削除
                enteringReservations.splice(0, 1);
                // 入場済みの予約に追加
                enteredReservationIds.push(id);
                // 入場履歴を更新
                reservationsById[id].checkins.push(checkInHistory);
            }).fail(function (jqxhr, textStatus, error) {
                console.error(jqxhr, textStatus, error);
                // エラーメッセージ表示
                // alert(jqxhr.responseJSON.errors[0].detail);
            }).always(function () {
                updateResults();
                processEnter();
            });
        }
    }

    /**
     * 入場結果リストを更新する
     * @function updateResults
     * @returns {void}
     */
    function updateResults() {
        var html = checkedReservationIds.reduce(
            (a, b) => {
                var reservationById = reservationsById[b];
                return a +
                    '<tr data-id="' + reservationById.id + '">' +
                    '<td>座席: ' + reservationById.seat_code + '</td>' +
                    '<td>券種: ' + reservationById.ticket_type_name_ja + '</td>' +
                    '<td>ステータス: ' + ((enteredReservationIds.indexOf(reservationById._id) >= 0) ? "入場済み" : "入場中...") + '</td>' +
                    '<td>回数: ' + reservationById.checkins.length + '</td>' +
                    '</tr>'
                    ;
            },
            ''
        )
        $('.results tbody').html(html);
    }

    /**
     * 予約情報取得
     * @function getReservations
     * @param {funstion} cb
     * @returns {void}
     */
    function getReservations(cb) {
        var id = $('input[name=performanceId]').val();
        $.ajax({
            dataType: 'json',
            url: '/checkin/performance/reservations',
            type: 'POST',
            data: {
                id: id
            },
            beforeSend: function () {
            }
        }).done(function (data) {
            if (!data.error) {
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
            updateResults();
            if (cb !== undefined) cb();
        });
    }

    /**
     * 予約情報を定期的に取得
     * @function loopGetReservations
     * @param {number} time
     * @returns {void}
     */
    function loopGetReservations(time) {
        setTimeout(function () {
            getReservations(function () {
                loopGetReservations(time);
            });
        }, time);
    }
})();

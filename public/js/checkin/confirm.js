/* global moment */
$(function() {
    /* 時計 */
    document.getElementById('print_date').innerHTML = moment().format('YYYY/MM/DD');
    var dom_clock = document.getElementById('print_clock');
    dom_clock.innerHTML = moment().format('HH:mm');
    setInterval(function() {
        dom_clock.innerHTML = moment().format('HH:mm');
    }, 60000);

    /* チェックインに入れる情報 */
    var checkPointGroup = document.getElementById('input_pointgroup').value;
    var checkUserName = document.getElementById('input_username').value;

    /* 取得済み予約キャッシュ */
    var reservationsById = [];
    var reservationIdsByQrStr = [];

    /* チェックインAPI送信キュー */
    var enteringReservations = [];

    /* チェックインOK時効果音 */
    var audioYes = new Audio('/audio/yes01.mp3');
    audioYes.load();

    /* チェックインNG時効果音 */
    var audioNo = new Audio('/audio/no01.mp3');
    audioNo.load();


    /**
     * チェックイン結果を描画する
     * @function renderResult
     * @param {Object} reservation
     * @returns {void}
     */
    var $qrdetail = $('#qrdetail');
    var $checkinlogtablebody = $('#checkinlogtable').find('tbody');
    var renderResult = function(reservation) {
        // 状態初期化
        $qrdetail.removeClass('is-ng');
        audioNo.pause();
        audioNo.currentTime = 0.0;
        audioYes.pause();
        audioYes.currentTime = 0.0;
        // NGチェックインフラグ
        var is_ng = false;
        // 「本日」を表示するための比較用文字列
        var ddmm_today = moment().format('MM/DD');
        // チケットの入塔日文字列
        var ddmm_ticket = moment(reservation.performance_day, 'YYYYMMDD').format('MM/DD');
        ddmm_ticket = (ddmm_today === ddmm_ticket) ? '本日' : ddmm_ticket;
        // ユーザーグループごとのカウントを入れるオブジェクト
        var countByCheckinGroup = {};
        // チェックイン履歴HTML配列 (中身を入れてから昇順に表示するため配列)
        var chckinLogHtmlArray = [];
        reservation.checkins.forEach(function(checkin) {
            // チェックイン実行日
            var ddmm = moment(checkin._id).format('MM/DD');
            ddmm = (ddmm_today === ddmm) ? '本日' : ddmm;
            // グループごとのチェックインをカウント
            if (isNaN(countByCheckinGroup[checkin.where])) {
                countByCheckinGroup[checkin.where] = 1;
            // グループカウント済み ＝ 多重チェックイン ＝ NG
            } else {
                is_ng = true;
                countByCheckinGroup[checkin.where]++;
            }
            chckinLogHtmlArray.push(
                '<tr class="' + ((is_ng) ? 'tr-ng' : '') + '">' +
                    '<td class="td-day">' + ddmm + '</td>' +
                    '<td class="td-time">' + moment(checkin._id).format('HH:mm') + '</td>' +
                    '<td class="td-where"><span>' + checkin.how + '</span></td>' +
                    '<td class="td-count">' + countByCheckinGroup[checkin.where] + '</td>' +
                '</tr>'
            );
        });
        if (is_ng) {
            $qrdetail.addClass('is-ng');
            audioNo.play();
        } else {
            audioYes.play();
        }
        // 予約情報を表示
        $qrdetail.html(
            '<div class="qrdetail-date">' +
                '<p class="inner">' +
                    '<span class="day">' + ddmm_ticket + '</span>' +
                    '<span class="time">' + moment(reservation.performance_start_time, 'HHmm').format('HH:mm') + '～' + moment(reservation.performance_end_time, 'HHmm').format('HH:mm') + '</span>' +
                '</p>' +
            '</div>' +
            '<div class="qrdetail-ticket"><p class="inner">' + reservation.ticket_type_name.ja + '</div>'
        );
        // チェックインログを降順で表示
        $checkinlogtablebody.html(chckinLogHtmlArray.reverse().join(''));
    };


    /**
     * QRコードから予約オブジェクトを返す。キャッシュに無かったらAPIから取得を試みる。
     * @function check
     * @param {string} qrStr
     * @returns {Deferred}
     */
    var getReservationByQrStr = function(qrStr) {
        var $dfd = $.Deferred();
        if (!qrStr) {
            $dfd.reject('QRコードが読み取れません' + qrStr);
        } else if (reservationIdsByQrStr[qrStr]) {
            $dfd.resolve(reservationsById[reservationIdsByQrStr[qrStr]]);
        } else {
            $.get('/checkin/reservation/' + qrStr).done(function(data) {
                if (data.error || !data.status || !data.reservation) {
                    $dfd.reject('予約データ異常' + JSON.stringify({error: data.error, status: data.status}));
                } else {
                    $dfd.resolve(data.reservation);
                }
            }).fail(function(jqxhr, textStatus, error) {
                console.log(jqxhr, textStatus, error);
                $dfd.reject('通信エラー発生', textStatus);
            });
        }
        return $dfd.promise();
    };


    /**
     * チェックインをAPIに報告する
     * @function processEnter
     * @returns {void}
     */
    var processEnter = function() {
        var enteringReservation = enteringReservations[0];
        if (!enteringReservation) {
            setTimeout(function() {
                processEnter();
            }, 2000);
        } else {
            $.ajax({
                dataType: 'json',
                url: '/checkin/reservation/' + enteringReservation.qr_str,
                type: 'POST',
                data: enteringReservation.checkins[enteringReservation.checkins.length - 1]
            }).done(function(data) {
                console.log('checkin ok', data);
                // 入場中の予約から削除
                enteringReservations.splice(0, 1);
            }).fail(function(jqxhr, textStatus, error) {
                console.log(jqxhr, textStatus, error);
                // エラーメッセージ表示
                // alert(jqxhr.responseJSON.errors[0].detail);
            }).always(function() {
                setTimeout(function() {
                    processEnter();
                }, 2000);
            });
        }
    };


    /**
     * QRコードをチェックする
     * @function check
     * @param {strnig} qrStr
     * @returns {void}
     */
    var busy_check = false;
    var check = function(qrStr) {
        if (busy_check) { return false; }
        busy_check = true;
        getReservationByQrStr(qrStr).done(function(reservation) {
            var unixTimestamp = (new Date()).getTime();
            reservation.checkins.push({
                _id: unixTimestamp,
                when: unixTimestamp,
                where: checkPointGroup,
                why: '',
                how: checkUserName
            });
            renderResult(reservation);
            // getReservationsに予約を上書きされて↑のcheckinが消されないようにキューにはコピーを入れる
            enteringReservations.push($.extend(true, {}, reservation));
        }).fail(function(errMsg) {
            alert(errMsg);
        }).always(function() {
            busy_check = false;
            processEnter();
        });
    };


    /**
     * 予約情報取得
     * @function getReservations
     * @param {funstion} cb
     * @returns {void}
     */
    var getReservations = function(cb) {
        $.ajax({
            dataType: 'json',
            url: '/checkin/performance/reservations',
            type: 'POST'
            // ,data: { performanceId: '5965ee1ce53ebc2b4e698d3e' }
        }).done(function(data) {
            if (!data.error && data.reservationsById && data.reservationIdsByQrStr) {
                /** 現在パフォーマンスの予約リストを更新 */
                reservationsById = data.reservationsById;
                reservationIdsByQrStr = data.reservationIdsByQrStr;
            } else {
                console.log('No Data: /checkin/performance/reservations', data);
            }
        }).fail(function(jqxhr, textStatus, error) {
            console.log(jqxhr, textStatus, error);
        }).always(function() {
            if (typeof cb === 'function') { cb(); }
        });
    };


    /**
     * 予約情報を定期的に取得
     * @function loopGetReservations
     * @param {number} time
     * @returns {void}
     */
    var loopGetReservations = function(time) {
        setTimeout(function() {
            getReservations(function() {
                loopGetReservations(time);
            });
        }, time);
    };


    // 予約情報取得
    getReservations(function() {
        // 予約情報同期 30秒ごと
        loopGetReservations(30000);
    });

    // QR読み取りイベント (※1文字ずつkeypressされてくる)
    var tempQrStr = '';
    $(window).keypress(function(e) {
        if (busy_check) {
            tempQrStr = '';
            return false;
        }
        // 新しい入力値の場合
        if (tempQrStr.length === 0) {
            $('.result').html('データ照会中...');
        }
        // エンターで入力終了
        if (e.keyCode === 13) {
            // 予約をチェック
            check(tempQrStr);
            tempQrStr = '';
        } else {
            tempQrStr += String.fromCharCode(e.keyCode); // ※AsReaderのイベントにはcharCodeが無い
        }
    });
    // for debug
    $('.pointname').click(function() {
        // check('20170726-300000035-0');
    });
});

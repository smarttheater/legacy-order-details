$(function() {
    // 日付選択カレンダー (再読込時のために日付はsessionStorageにキープしておく)
    window.flatpickr.localize(window.flatpickr.l10ns[window.ttts.currentLocale]);
    var input_day = document.getElementById('day');
    var $modal_calender = $('.modal-calender');
    var calendar = new window.flatpickr(input_day, {
        allowInput: true,
        appendTo: $('#calendercontainer').on('click', function(e) { e.stopPropagation(); })[0], // モーダル内コンテナに挿入しつつカレンダークリックでモーダルが閉じるのを防止
        defaultDate: window.sessionStorage.getItem('inquiry_ymd') || 'today',
        disableMobile: true, // 端末自前の日付選択UIを使わない
        locale: window.ttts.currentLocale,
        maxDate: window.ttts.reservableMaxDate || '',
        // minDate: moment().add(-3, 'months').toDate(),
        onOpen: function() {
            $modal_calender.fadeIn(200);
        },
        onClose: function() {
            $modal_calender.hide();
        },
        onValueUpdate: function(selectedDates, dateStr) {
            window.ttts.setSessionStorage('inquiry_ymd', dateStr);
        }
    });
    // モーダルを閉じたら中のカレンダーも閉じる
    $modal_calender.click(function() { calendar.close(); });

    var validateInquiryInputs = function() {
        var bool_valid = true;
        Array.prototype.forEach.call(document.getElementsByClassName('input-required'), function(elm) {
            var error = null;
            var elm_errmsg = document.querySelector('.errmsg-' + elm.name);
            var filedname = elm.getAttribute('data-fieldname');
            var maxLength = elm.getAttribute('maxLength') || null;
            var regex = elm.getAttribute('data-pattern') || '';
            regex = (regex) ? new RegExp(regex) : '';
            if (!elm.value) {
                error = 'empty';
            } else if (maxLength && !elm.value.length > maxLength) {
                error = 'maxLength';
            } else if (regex && !regex.test(elm.value)) {
                error = 'invalid';
            }
            if (error) {
                elm_errmsg.innerText = window.ttts.errmsgLocales[error].replace('{{fieldName}}', filedname).replace('{{max}}', maxLength);
                bool_valid = false;
            } else {
                elm_errmsg.innerText = '';
            }
        });
        return bool_valid;
    };

    // 検索
    $(document).on('click', '.search', function(e) {
        if (!validateInquiryInputs()) {
            return false;
        }
        e.currentTarget.classList.add('is-processing');
        document.forms[0].submit();
    });
});

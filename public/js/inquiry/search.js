String.prototype.splice = function (idx, str) { //※日時整形用(Stringのidx文字目にstrを差し込む)
    return (this.slice(0, idx) + str + this.slice(idx));
};

$(function () {
    var API_ENDPOINT = $('input[name="apiEndpoint"]').val();

    var locale = $('html').attr('lang');
    var performances = [];
    var conditions = {
        page: '1'
    };

    function showConditions() {
        var formDatas = $('form').serializeArray();
        formDatas.forEach(function (formData, index) {
            var name = formData.name;
            if (conditions.hasOwnProperty(name)) {
                $('input[name="' + name + '"], select[name="' + name + '"]', $('form')).val(conditions[name]);
            } else {
                $('input[name="' + name + '"], select[name="' + name + '"]', $('form')).val('');
            }
        });
    }

    // function search() {
    //     $('form').submit();
    // }
    function search() {
        conditions.searched_at = Date.now(); // ブラウザキャッシュ対策
        $('.error-message').hide();
        $.ajax({
            dataType: 'json',
            url: '/inquiry/search/count',
            type: 'GET',
            data: conditions,
            beforeSend: function () {
                $('.loading').modal();
            }
        }).done(function (data) {
            // エラーメッセージ表示
            if (data.errors) {
                for (error in data.errors) {
                    $('[name="error_' + error + '"]').text(data.errors[error].msg);
                }
                $('.error-message').show();
            }
            if( data.count > 0) {
                alert(data.count + ":検索結果画面へGO!");
                location.href('/inquiry/search/result');
            }
        }).fail(function (jqxhr, textStatus, error) {
        }).always(function () {
            $('.loading').modal('hide');
        });
    }

    // 検索
    $(document).on('click', '.search', function () {
        conditions.page = '1';

        // 検索フォームの値を全て条件に追加
        var formDatas = $('form').serializeArray();
        formDatas.forEach(function (formData, index) {
            conditions[formData.name] = formData.value;
        });
        search();
    });

});
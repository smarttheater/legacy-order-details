$(function () {
    // ＱＲコード表示
    $('.qrcode').each(function(index) {
        $(this).html("");
        $(this).qrcode({
            width: 100,
            height: 100,    
            text: this.id
        });
    });

    // キャンセル(ポップアップ表示)
    $(document).on('click', '.btn-cancel', function (event) {
        event.preventDefault();
        $('#cancelModal').modal();
    });
    // キャンセル(確定)
    $(document).on('click', '.cancel-button', function (event) {
        event.preventDefault();
        cancel();
    });
});
/**
 * キャンセル(確定)
 * @function cancel
 * @returns {void}
 */
function cancel() {
    var modal = $('#cancelModal');
    var error_message = modal.find('[name=error-message]');
    var payment_no = modal.find('input[name=payment_no]');
    error_message.text('');
    $.ajax({
        dataType: 'json',
        url: '/inquiry/search/cancel',
        type: 'POST',
        data: {
            payment_no: payment_no.val()
        }
    }).done(function (data) {
        if (!data.error) {
            modal.modal('hide');
            location.href = '/inquiry/search';
            return;
        } else {
            error_message.text(data.error);
        }
    }).fail(function (jqxhr, textStatus, error) {
        console.error(jqxhr, textStatus, error);
        error_message.text(error);
    }).always(function () {
        $('.loading').modal('hide');
    });
}

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

    // キャンセル
    $(document).on('click', '.btn-cancel', function (event) {
        event.preventDefault();
        cancel();
    });
});
/**
 * キャンセル
 * @function cancel
 * @returns {void}
 */
function cancel() {
    // var theater = $('select[name=theater]').val();
    // var day = $('select[name=day]').val();
    // if (!theater || !day) {
    //     alert('劇場、上映日を選択してください');
    //     return;
    // }
    // var modal = $('#newModal');
    // modal.find('.film-name').text('未選択');
    // modal.find('.film-name').attr('data-film-id', '');
    // modal.find('input[name=film]').val('');
    // modal.find('select[name=openTimeHour]').val('00');
    // modal.find('select[name=openTimeMinutes]').val('00');
    // modal.find('select[name=startTimeHour]').val('00');
    // modal.find('select[name=startTimeMinutes]').val('00');
    // modal.find('select[name=endTimeHour]').val('00');
    // modal.find('select[name=endTimeMinutes]').val('00');
    // modal.find('select[name=screen]').val('');
    // modal.find('select[name=ticketTypeGroup]').val('');
    $('#cancelModal').modal();
}

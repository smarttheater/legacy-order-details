$(function () {
    $('.qrcode').each(function(index) {
        $(this).html("");
        $(this).qrcode({
            width:100,
            height:100,    
            text:this.id
        });
    });
});

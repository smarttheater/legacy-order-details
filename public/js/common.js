/* global Url */
'use strict';
window.ttts = {};
window.ttts.mode = (location.href.indexOf('staff') === -1) ? 'customer' : 'staff';

// プライベートブラウジング時のsessionStorage.setItemエラー回避用
window.ttts.setSessionStorage = function(key, value) {
    if (!window.sessionStorage) return;
    try {
        window.sessionStorage.setItem(key, value);
    } catch (err) {
        console.log(err);
    }
};

/**
 * QRコード表示
 * @function showQRCode
 * @returns {void}
 */
function showQRCode() {
    $('.codeimg-barcode').each(function(index, element) {
        var target = $(element);
        var url = target.attr('data-qrcode');
        var code = createQRCode(url, {
            alt: 'QRコード'
        });
        target.append(code);
    });
}

/**
 * QRコード生成
 * @function createQRCode
 * @param {string} url QRコードURL
 * @param {any} options オプション
 * @param {number} options.width 幅
 * @param {number} options.height 高さ
 * @param {string} options.alt alt
 * @param {string} options.ext 形式
 * @returns {HTMLImageElement} QR画像
 */
function createQRCode(url, options) {
    options = options || {};
    var width = (options.width !== undefined) ? options.width : 100;
    var height = (options.height !== undefined) ? options.height : 100;
    var alt = (options.alt !== undefined) ? options.alt : '';
    var ext = (options.ext !== undefined) ? options.ext : 'png';
    // QR
    var qr = new VanillaQR({
        url: url,
        width: width,
        height: height,
        colorLight: '#FFF',
        colorDark: '#000',
        noBorder: true
    });
    var image = qr.toImage(ext);
    image.width = width;
    image.height = height;
    image.alt = alt;
    return image;
}

$(function() {
    var $window = $(window);
    var CSSBREAKPOINT_MOBILE = 480;
    // var CSSBREAKPOINT_TABLET = 800;
    var fn_checkPageWidthIsMobile = function() { return (window.innerWidth <= CSSBREAKPOINT_MOBILE); };
    // var fn_checkPageWidthIsNotPc = function () { return (window.innerWidth >= CSSBREAKPOINT_TABLET); };

    /*
    汎用イベント
    */
    $(document)
        // スマホ用アコーディオン開閉
        .on('click', '.accordion_mobile_inner', function(e) {
            e.stopPropagation();
        })
        .on('click', '.accordion_mobile_toggle', function() {
            if (!~this.parentNode.className.indexOf('reservationstatus') && !fn_checkPageWidthIsMobile()) { return false; }
            if (~this.className.indexOf('performance')) {
                $(this).toggleClass('accordion_mobile_toggleIsOpen').find('.accordion_mobile_inner').stop(false, true).slideToggle(200);
            } else {
                $(this).toggleClass('accordion_mobile_toggleIsOpen').next('.accordion_mobile_inner').stop(false, true).slideToggle(200);
            }
        })
    ;

    // Window Resize
    var timer_risize = null;
    $window.on('resize', function() {
        clearTimeout(timer_risize);
        timer_risize = setTimeout(function() {
            if (!fn_checkPageWidthIsMobile()) {
                $('.accordion_mobile_toggleIsOpen').removeClass('accordion_mobile_toggleIsOpen');
                $('.accordion_mobile_inner').show();
            }
        }, 300);
    });

    showQRCode();
});

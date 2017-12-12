$(function () {
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
    $(document).on('click', '.search', function (e) {
        if (!validateInquiryInputs()) {
            return false;
        }
        e.currentTarget.classList.add('is-processing');
        document.forms[0].submit();
    });
});

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * システム共通メッセージ定義
 *
 * @memberOf Const
 */
var Common;
(function (Common) {
    const field = '$fieldName$';
    const maxLen = '$maxLength$';
    // メッセージ
    Common.add = '登録しました。';
    Common.expired = '期限切れです';
    Common.invalidUserOrPassward = 'IDもしくはパスワードの入力に誤りがあります';
    Common.required = '$fieldName$が未入力です';
    Common.unexpectedError = 'システムエラーが発生しました。ご不便をおかけして申し訳ありませんがしばらく経ってから再度お試しください。';
    Common.maxLength = '$fieldName$は$maxLength$文字以内で入力してください';
    // メッセージ編集
    function getMaxLength(fieldName, max) {
        return Common.maxLength.replace(field, fieldName).replace(maxLen, max.toString());
    }
    Common.getMaxLength = getMaxLength;
})(Common = exports.Common || (exports.Common = {}));

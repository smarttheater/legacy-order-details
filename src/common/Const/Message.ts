/**
 * システム共通メッセージ定義
 *
 * @memberOf Const
 */
export namespace Common {
    const field: string = '$fieldName$';
    const maxLen: string = '$maxLength$';
    // メッセージ
    export const add = '登録しました。';
    export const expired = '期限切れです';
    export const invalidUserOrPassward = 'IDもしくはパスワードの入力に誤りがあります';
    export const required = '$fieldName$が未入力です';
    export const unexpectedError = 'システムエラーが発生しました。ご不便をおかけして申し訳ありませんがしばらく経ってから再度お試しください。';
    export const maxLength = '$fieldName$は$maxLength$文字以内で入力してください';
    // メッセージ編集
    export function getMaxLength(fieldName: string, max: number): string {
        return Common.maxLength.replace(field, fieldName).replace(maxLen, max.toString());
    }
}

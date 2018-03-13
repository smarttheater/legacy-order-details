module.exports = {
    loginurl: 'http://localhost:8080/checkin/login',
    username: 'LANE',
    password: 'Iop@-098',
    notLeaveCheckin: false, // チェックインを取消してから次のQRに行く
    clearAllCheckin: false, // 読み取ったQRのチェックインを全て消す
    loopcount: 1, // 何周するか
    scanInterval: 0, // QRを読み込む間隔(読み取れるようになるのを待ってからの時間)(ms)
    cancelInterval: 0, // 取消ボタンを押す間隔(押せるようになるのを待ってからの時間)(ms)
    timeoutForScanResult: 30000, // QR読み取り結果待ちタイムアウト
    timeoutForSubmitCheckin: 30000, // チェックイン報告完了待ちタイムアウト
    timeoutForCancelCheckin: 30000, // チェックイン取消完了待ちタイムアウト
    qrArray: require('./qrcodes.js'),
};

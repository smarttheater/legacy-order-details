// チェックインテスト
const assert = require('assert');
const testConfig = require('./test.conf.js');

const QR_ARRAY = testConfig.qrArray;
const LOGINURL = testConfig.loginurl;
const USERNAME = testConfig.username;
const PASSWORD = testConfig.password;
const INTERVAL_SCAN = testConfig.scanInterval;
const INTERVAL_CANCEL = testConfig.scanInterval;
const TIMEOUT_SCANRESULT = testConfig.timeoutForScanResult;
const TIMEOUT_SUBMITCHECKIN = testConfig.timeoutForSubmitCheckin;
const TIMEOUT_CANCELCHECKIN = testConfig.timeoutForCancelCheckin;
const MODE_NOTLEAVE_CHECKIN = testConfig.clearAllCheckin || testConfig.notLeaveCheckin;
const MODE_CLEAR_ALLCHECKIN = (MODE_NOTLEAVE_CHECKIN && testConfig.clearAllCheckin);
const LOOPCOUNT = testConfig.loopcount || 1;
let runcount = 0;

// テスト名を分岐
let SUBJECT = '全てのQRを読み取る';
if (MODE_CLEAR_ALLCHECKIN) {
    SUBJECT += ' ＋ 読んだQRのチェックイン履歴を全て消す';
} else if (MODE_NOTLEAVE_CHECKIN) {
    SUBJECT += '(発生したチェックインを残さない)';
}

// QR読み取り可能時に表示されているテキスト
let QRREADYTEXT = '';

// 最新のチェックインを取り消す
const deleteLastCheckin = () => {
    browser.click('.btn-cancel');
    browser.pause(200); // repaint待ちが入る
    browser.alertAccept(); // 取消確認アラートをOK
    browser.pause(INTERVAL_CANCEL);
};

// 表示中の予約の全チェックインを取り消す
const deleteAllCheckin = () => {
    deleteLastCheckin();
    browser.waitUntil(() => {
        return browser.getText('.count-canceling') === '0';
    }, TIMEOUT_CANCELCHECKIN, 'キャンセル完了待ちtimeout', 500);
    browser.pause(100);
    if (browser.isExisting('.btn-cancel')) {
        deleteAllCheckin();
    }
};

// QRコードをスキャンする
const scanQr = (qrStr) => {
    browser.keys(`${qrStr}\uE007`); // Enter入力で読み取り処理が走る
    browser.waitUntil(() => {
        return browser.getText('.instruction') === QRREADYTEXT;
    }, TIMEOUT_SCANRESULT, 'スキャン結果待ちtimeout', 100);
    assert(browser.getText('.qrstr') === `(${qrStr})`);
};

const main = () => {
    browser.timeouts('script', (QR_ARRAY.length * TIMEOUT_SCANRESULT));
    QR_ARRAY.forEach((qr) => {
        scanQr(qr);
        if (MODE_CLEAR_ALLCHECKIN) {
            deleteAllCheckin();
        } else if (MODE_NOTLEAVE_CHECKIN) {
            deleteLastCheckin();
        }
        browser.pause(INTERVAL_SCAN);
    });
    browser.waitUntil(() => {
        return browser.getText('.count-unsent') === '0';
    }, (QR_ARRAY.length * TIMEOUT_SUBMITCHECKIN), 'チェックイン報告キュー消化待ちtimeout', 1000);
    browser.waitUntil(() => {
        return browser.getText('.count-canceling') === '0';
    }, (QR_ARRAY.length * TIMEOUT_CANCELCHECKIN), 'キャンセル命令キュー消化待ちtimeout', 1000);
};


describe('CheckinApp', () => {
    // チェックインのページまで行く
    before(() => {
        browser.timeouts('page load', 30000);
        browser.url(LOGINURL);
        assert(/東京タワー/.test(browser.getTitle()));
        browser.selectByValue('#username', USERNAME);
        browser.setValue('#password', PASSWORD);
        browser.click('.btn-next');
        browser.waitForExist('.pointname', 10000);
        QRREADYTEXT = browser.getText('.instruction');
    });

    it(SUBJECT, () => {
        while (LOOPCOUNT > runcount) {
            main();
            runcount++;
        }
    });

    after(() => {
        browser.pause(3000);
    });
});

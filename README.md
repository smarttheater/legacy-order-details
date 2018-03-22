# TTTSオンライン認証

# Features

# Getting Started

## インフラ
基本的にnode.jsのウェブアプリケーションです。
ウェブサーバーとしては、AzureのWebAppsあるいはGCPのAppEngineを想定しており、両方で動くように開発していくことが望ましい。

## 言語
実態としては、linuxあるいはwindows上でnode.jsは動くわけですが、プログラミング言語としては、alternative javascriptのひとつであるTypeScriptを採用しています。

* TypeScript(https://www.typescriptlang.org/)

## 開発方法
npmでパッケージをインストールします。npmはnode.jsでスタンダードなパッケージ管理ツールです。パッケージ管理にとどまらず、開発やサーバー起動においても活躍します。

```shell
npm install
```
* npm(https://www.npmjs.com/)

typescriptをjavascriptにコンパイルします。wオプションでファイル変更監視できます。

```shell
npm run build -- -w
```

npmでローカルサーバーを立ち上げることができます。

```shell
npm start
```
(http://localhost:8080)にアクセスすると、ローカルでウェブアプリを確認できます。

ビルドファイルクリーン

```shell
npm run clean
```

scssビルド

```shell
npm run css
```

### Environment variables

| Name                                | Required | Value                 | Purpose |
| ----------------------------------- | -------- | --------------------- | ------- |
| `DEBUG`                             | false    | ttts-authentication:* | Debug   |
| `NPM_TOKEN`                         | true     |                       |         |
| `NODE_ENV`                          | true     |                       |         |
| `REDIS_HOST`                        | true     |                       |         |
| `REDIS_PORT`                        | true     |                       |         |
| `REDIS_KEY`                         | true     |                       |         |
| `NODE_CONFIG_DIR`                   | true     |                       |         |
| `TTTS_TOKEN_SECRET`                 | true     |                       |         |
| `API_ENDPOINT`                      | true     |                       |         |
| `API_CLIENT_ID`                     | true     |                       |         |
| `API_CLIENT_SECRET`                 | true     |                       |         |
| `API_AUTHORIZE_SERVER_DOMAIN`       | true     |                       |         |
| `API_RESOURECE_SERVER_IDENTIFIER`   | true     |                       |         |
| `ADMIN_API_AUTHORIZE_SERVER_DOMAIN` | true     |                       |         |
| `ADMIN_API_CLIENT_ID`               | true     |                       |         |
| `ADMIN_API_CLIENT_SECRET`           | true     |                       |         |


# tslint

コード品質チェックをtslintで行っています。lintパッケージとして以下を仕様。
* [tslint](https://github.com/palantir/tslint)
* [tslint-microsoft-contrib](https://github.com/Microsoft/tslint-microsoft-contrib)
`npm run check`でチェック実行。改修の際には、必ずチェックすること。

# test
mochaフレームワークでテスト実行。
* [mocha](https://www.npmjs.com/package/mocha)
`npm test`でテスト実行。だが、現状テストコードなし。テストコードを増やしていくことが望ましい。

# チェックインアプリのテスト
WebdriverIO + mochaでe2eテストを行う (Seleniumを動かすので要Javaインストール)
* [WebdriverIO](http://webdriver.io)
`yarn run testCheckinApp`でテスト実行。
`/test/specs/checkinApp`内の`test.conf.js`(テスト設定)と`qrcodes.js`(読み取りQR配列)を適宜編集してやっていく。
※ログインの段階などで意味不明に落ちる時はChromeDriverの更新が追い付いていない可能性大なので
[webdriverio](https://github.com/webdriverio/webdriverio)と[wdio-selenium-standalone-service](https://github.com/webdriverio/wdio-selenium-standalone-service)のversionとIssuesを確認しつつ`node_modules`を一旦削除してから`yarn`したりしてください

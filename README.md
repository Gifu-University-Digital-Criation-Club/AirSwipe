# スマート・ジョブス

Webカメラで発表者の右腕を追跡し、上下左右のジェスチャをスライド画面の操作イベントとして扱うWebアプリです。

## 動作環境

- Windows 10 / 11
- 最新版のGoogle ChromeまたはMicrosoft Edge
- Node.js 24 LTS
- pnpm 11.19.0

Node.jsとpnpmをまだ導入していない場合は、以下の「初回セットアップ」から順に進めてください。

## 初回セットアップ

### 1. Node.jsをインストールする

1. [Node.js公式ダウンロードページ](https://nodejs.org/en/download)を開きます。
2. `LTS`と表示されているNode.js 24のWindows Installer（`.msi`）をダウンロードします。
3. インストーラーを起動し、特別な理由がなければ初期設定のままインストールします。
4. インストール後、VS Codeをすべて閉じてから開き直します。開いているターミナルだけでなく、VS Code本体を再起動してください。

VS Codeでこのプロジェクトを開き、新しいターミナルで次を実行します。PowerShellでもいいです。
> NOTE：満仲はPowerShellで確認済み。VSCodeはたまに上手くいかないときがあるのでだめだったらPowerShellでやり直してください。PowerShellでだめだったら連絡ください。

```powershell
node --version
npm --version
```

それぞれのコマンドで、`v24.19.0`や`11.9.0`のようなバージョン情報が表示されることを確認します。数字はNode.jsの更新状況によって多少異なります。`node`または`npm`が見つからないというエラーが出る場合は、Node.jsが正しく導入されていないか、PATHがまだ反映されていません。

### 2. pnpmをインストールする

このプロジェクトで動作確認済みのpnpmをインストールします。

```powershell
npm install --global pnpm@11.19.0
```

インストールが終わったら、次を実行します。

```powershell
pnpm --version
```

`11.19.0`というバージョン情報が表示されることを確認します。`pnpm`が見つからないというエラーが出る場合は、VS Codeをすべて閉じて開き直してから、もう一度確認してください。

### 3. プロジェクトのライブラリをインストールする

VS Codeでこのプロジェクトのフォルダを開くか、PowerShellで`AirSwipe/`に移動し次を実行します。

```powershell
pnpm install --frozen-lockfile
```

エラーで停止せず、最後にターミナルへ入力できる状態に戻れば完了です。このコマンドは`pnpm-lock.yaml`に記録されたバージョンどおりにライブラリを導入します。

## アプリを起動する

### クリックだけで起動する

Windowsでは、プロジェクト直下の`起動.bat`をダブルクリックしてください。macOSでは`起動.command`をダブルクリックしてください。

Node.jsがない場合は自動で導入を試み、必要なライブラリも自動でインストールしてからアプリを起動します。初回だけはダウンロードのため時間がかかります。起動後はブラウザが自動で開きます。

WindowsでNode.jsの自動導入後に起動できなかった場合は、Windowsを再起動してからもう一度`起動.bat`をダブルクリックしてください。macOSで`起動.command`を初めて開く際は、Finderで右クリックして「開く」を選ぶ必要がある場合があります。

### ターミナルから起動する

初回セットアップが済んでいる場合は、プロジェクトのフォルダをVS CodeかPowerShellで開き、次を実行します。

```powershell
pnpm run dev
```

ターミナルに次のようなURLが表示されることを確認します。

```text
Local: http://127.0.0.1:5173/
```

ChromeまたはEdgeで[http://127.0.0.1:5173/](http://127.0.0.1:5173/)(注：アドレスが異なる場合もあります。気を付けて！)を開きます。終了するときは、起動に使ったターミナルで`Ctrl+C`を押します。

依存ライブラリが更新されていない普段の作業では、`pnpm run dev`だけで起動できます。別の人の変更を取り込んだ後は、起動前に`pnpm install --frozen-lockfile`を実行してください。

### PowerPointを読み込む場合

「資料読込」からPDFに加えてPowerPoint（`.ppt` / `.pptx`）を指定できます。PowerPointは、このPC上でLibreOfficeを使ってPDFへ変換してから表示します。

事前に[LibreOffice](https://www.libreoffice.org/download/download-libreoffice/)をインストールし、インストール後は`pnpm run dev`を一度終了して起動し直してください。通常は自動で検出されます。検出できない環境では、`AIRSWIPE_SOFFICE_PATH`に`soffice`実行ファイルのパスを指定してから起動してください。

## カメラと資料のプライバシー

AirSwipeはローカル環境で動作します。カメラ映像はジェスチャ認識のためにブラウザ上で処理され、録画やファイル保存、外部サーバーへの送信は行いません。

読み込んだPDFもブラウザ上で表示します。PowerPointは、このPC上で動作するローカルサーバーとLibreOfficeを使って一時的にPDFへ変換し、変換に使用した一時ファイルは処理後に削除します。AirSwipeから資料を外部サービスへ送信することはありません。

## コマンドが見つからない場合

次のコマンドで、Windowsが各コマンドを見つけられるか確認します。

```powershell
where.exe node
where.exe npm
where.exe pnpm
```

導入されていれば、それぞれの実行ファイルの場所が表示されます。何も見つからない場合は、まずVS Codeをすべて閉じて開き直し、それでも直らなければWindowsを再起動してください。

## チーム開発での注意

- プロジェクトの依存ライブラリを導入・更新するときは`pnpm`だけを使います。プロジェクト内で`npm install`や`yarn install`は使わないでください。
- `package-lock.json`や`yarn.lock`を作成しないでください。
- `pnpm-lock.yaml`は手作業で編集しないでください。
- `node_modules`、`.pnpm-store`、`dist`は他のPCへコピーする必要がありません。Gitにも追加せず、各PCで再生成します。
- ライブラリを追加するときは`pnpm add パッケージ名`、開発専用ライブラリの場合は`pnpm add -D パッケージ名`を使います。

画面を編集する人は、[画面編集ガイド](doc/designer-guide.md)も参照してください。

## ドキュメント

- [利用ガイド](doc/user-guide.md)：資料の読み込み、カメラの開始、ジェスチャ操作など、アプリの基本的な使い方
- [設定ガイド](doc/configuration.md)：カメラ、認識頻度、ジェスチャ感度、デバッグ表示の設定方法
- [画面編集ガイド](doc/designer-guide.md)：表示内容やジェスチャ確定時の画面動作を編集する方法
- [初期構想](doc/initial-python-plan.md)：Web版の実装前に検討したPython版の参考資料

## ライセンス

このプロジェクトは[MIT License](LICENSE)のもとで公開されています。

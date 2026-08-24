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

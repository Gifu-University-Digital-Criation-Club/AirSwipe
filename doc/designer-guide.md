# 画面編集ガイド

このアプリの見た目を編集する人向けのメモです。

## 初回セットアップ

Node.jsやpnpmをまだ導入していないPCでは、最初に以下を行います。

### 1. Node.jsをインストールする

1. [Node.js公式ダウンロードページ](https://nodejs.org/en/download)を開きます。
2. `LTS`と表示されているNode.js 24のWindows Installer（`.msi`）をダウンロードしてインストールします。
3. NextだかOKだかを連打してインストール後、VS Codeをすべて閉じてから開き直します。

VS Codeでこのプロジェクトを開き、新しいターミナルで次を実行します。PowerShellでもいいです。
> NOTE：満仲はPowerShellで確認済み。VSCodeはたまに上手くいかないときがあるのでだめだったらPowerShellでやり直してください。PowerShellでだめだったら連絡ください。

```powershell
node --version
npm --version
```

それぞれのコマンドで、`v24.19.0`や`11.9.0`のようなバージョン情報が表示されることを確認します。数字はNode.jsの更新状況によって多少異なります。コマンドが見つからないというエラーが出る場合は、Node.jsが正しく導入されていないか、PATHがまだ反映されていません。

### 2. pnpmをインストールする

次のコマンドで、このプロジェクトで動作確認済みのpnpmをインストールします。

```powershell
npm install --global pnpm@11.19.0
pnpm --version
```

`pnpm --version`で`11.19.0`というバージョン情報が表示されることを確認します。`pnpm`が見つからないというエラーが出る場合は、VS Codeをすべて閉じて開き直してから、もう一度確認してください。

### 3. 必要なライブラリをインストールする

VS Codeでこのプロジェクトのフォルダを開くか、PowerShellで`AirSwipe/`に移動し次を実行します。

```powershell
pnpm install --frozen-lockfile
```

エラーで停止せず、最後にターミナルへ入力できる状態に戻れば完了です。

詳しいトラブル対応とチーム開発時の注意は、プロジェクト直下の[README](../README.md)を確認してください。

## アプリを起動する

初回セットアップが済んでいる場合は、プロジェクトのフォルダをVS CodeかPowerShellで開き、次を実行します。

```powershell
pnpm run dev
```

ターミナルに次のようなURLが表示されることを確認します。

```text
Local: http://127.0.0.1:5173/
```

ChromeまたはEdgeで[http://127.0.0.1:5173/](http://127.0.0.1:5173/)を開きます。終了するときは、起動に使ったターミナルで`Ctrl+C`を押します。

別の人の変更を取り込んだ後は、起動前に次を実行してください。

```powershell
pnpm install --frozen-lockfile
```

## 編集するフォルダ

画面を編集するときは、まず `editable` フォルダを開きます。通常は、この中にある3ファイルだけを編集します。

- `editable/main.html`
  - 見た目を編集します。
- `editable/style.css`
  - 同上。
- `editable/editorActions.ts`
  - ジェスチャ確定時のスクロールや画面動作を編集します。
  - ファイル内の日本語コメントに従って、必要な場所だけ編集してください。
  - 根幹に関わる部分を編集したくなったらブランチを分けて勝手に編集するか、満仲か技術担当に連絡ください。

`src/config.ts` は、表示するHTMLやカメラ・認識処理の設定を変更したいときに編集します。

## 挙動参考用テンプレート

- `src/templates/appTemplate.html`
  - 動作認識を確認するための参照テンプレートです。
  - 基本的には編集せず、見本や感度設定用として使います。
- `src/templates/appTemplate.css`
  - 参照テンプレート専用の見た目です。
  - `appTemplate.ts`から読み込まれます。
  - `appTemplate.html`と同様、基本的には編集しません。
- `src/templates/appTemplate.ts`
  - 参照テンプレート専用の認識結果表示を更新します。
  - `appTemplate.html`と同様、基本的には編集しません。

## 表示HTMLの切り替え

読み込むHTMLは `src/config.ts` の `template.path` で指定します。

```ts
template: {
  path: "/editable/main.html",
},
```

参照テンプレートを表示したい場合は、以下のように変更します。

```ts
template: {
  path: "/templates/appTemplate.html",
},
```

## ジェスチャに合わせて画面を動かす

`editable/editorActions.ts`では、ジェスチャが確定するたびに`renderGestureCommand(event)`が呼び出されます。イベントを受け取る処理はすでに用意されているため、新しく`window.addEventListener()`を書く必要はありません。

`event.direction`で受け取れる操作は次のとおりです。

| 値 | 受け取った操作 |
| --- | --- |
| `left` | 左方向 |
| `right` | 右方向 |
| `up` | 上方向 |
| `down` | 下方向 |
| `idle` | 一定時間、方向入力がない待機状態 |

キーボードの矢印キーで操作した場合も、同じ関数が呼び出されます。そのため、カメラを起動しなくても（できなくても）矢印キーで画面動作を確認できます。
現状ではマウスやタッチパッドで手動スクロールした場合も、画面中央に最も近いスライドへ`currentIndex`が追従する仕様になっています。

### `left`を受け取ったときの記入例

`editable/editorActions.ts`を開き、`renderGestureCommand()`内にある「独自動作を追加する場合は、この下へ記入します」というコメントを探します。その下に次の処理を追加すると、左方向の入力を受け取ったときに現在のスライドが少し左へ動いて戻ります。

```ts
if (event.direction === "left") {
  slides[currentIndex]?.animate(
    [
      { transform: "translateX(0)" },
      { transform: "translateX(-24px)" },
      { transform: "translateX(0)" },
    ],
    { duration: 240 },
  );
}
```

この記入例は、`editable/editorActions.ts`内にもコメントとして残してあります。試す場合は、例の各行の先頭にある`//`を削除します。`right`、`up`、`down`、`idle`も同じ形で判定できますが、必要になった操作だけ追加してください。

この例は通常のJavaScriptと同じ書き方です。`.ts`ファイルにはJavaScriptのコードをそのまま書けるため、簡単な画面処理を追加するときにTypeScript独自の書き方を使う必要はありません。ファイル上部の`import type`や、既存関数に書かれている型の部分は消さずに残してください。

### CSSも変更する場合

見た目の変化をCSSへ分けたい場合は、`left`の処理でクラスを追加できます。

```ts
if (event.direction === "left") {
  slides[currentIndex]?.classList.add("received-left");
}
```

その場合は、`editable/style.css`へ対応するクラスを追加します。

```css
.slide-container.received-left {
  transform: translateX(-24px);
}
```

これらは動作確認用の例です。独自動作を作る場合も、同じ`renderGestureCommand()`内で`event.direction`を判定します。

## 注意

`editable/main.html` の中に `<script>` を書いても、アプリがHTMLを読み込む仕組みの都合で実行されません。ジェスチャに反応する画面処理は `editable/editorActions.ts` に追加してください。

`src/templates` と `src` フォルダ内の認識処理は、画面編集の見本・アプリ本体なので通常は変更しません。

# 画面編集ガイド

このアプリの見た目を編集する人向けのメモです。

## 初回セットアップ

Node.jsやpnpmをまだ導入していない場合は、先に[README.md](README.md)に従ってセットアップをしてください。

## アプリを起動する

初回セットアップが済んでいる場合は、プロジェクトのフォルダをVS CodeかPowerShellで開き、次を実行します。

```powershell
pnpm run dev
```

ターミナルに次のようなURLが表示されることを確認します。

```text
Local: http://127.0.0.1:5173/
```

ChromeまたはEdgeで[http://127.0.0.1:5173/](http://127.0.0.1:5173/)などの表示されたURLを開きます。(注：アドレスが異なる場合もあります。気を付けて！)
終了するときは、起動に使ったターミナルで`Ctrl+C`を押します。

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
  - TypeScriptはJavaScriptの拡張言語であるため、tsファイルにはJavaScriptを記述することができます。

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

`editable/main.html` を直接クリックしても正しく表示されません！
必ず `pnpm run dev` してローカルサーバ上で確認してください。
内容を更新した際は、リロードではなく、既存のページを削除し、新しいページにローカルサーバーアドレスをコピペして開き直すのが安牌です。
> 蛇足：右上の「...」はデバッグ用ボタンです。表示非表示を切り替えることができます。デバッグパネルは `/src/debugPanel` から編集が可能です。
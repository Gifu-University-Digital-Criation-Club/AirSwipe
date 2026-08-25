# AirSwipe 設定ガイド

AirSwipeのカメラ、ジェスチャ感度、デバッグ表示などは、[`src/config.ts`](../src/config.ts)の`defaultSettings`で設定します。このガイドでは、各設定値の意味と調整方法を説明します。

通常の利用では初期値のままで構いません。調整するときは一度に複数の値を変えず、変更前の値を控えてから、デバッグ表示を見ながら1項目ずつ確認してください。

## 設定を反映する

1. `src/config.ts`を開き、必要な値を変更して保存します。
2. ブラウザを再読み込みします。確実に反映するには、起動中のAirSwipeを終了して`pnpm run dev`で起動し直します。
3. デバッグ表示で、カメラ映像、認識状態、信頼度、最終確定を確認します。

比率を表す設定は、発表者の身体サイズを基準に正規化した値です。そのため、カメラとの距離や解像度が多少変わっても同じ条件で認識しやすくなっています。`Ms`で終わる設定の単位はミリ秒、`Deg`で終わる設定の単位は度です。

## 表示する画面

```ts
template: {
  path: "/editable/main.html",
},
```

| 設定 | 初期値 | 説明 |
| --- | --- | --- |
| `template.path` | `"/editable/main.html"` | 通常の発表画面として読み込むHTML |

動作確認用の参照テンプレートへ切り替える場合は、`"/templates/appTemplate.html"`を指定します。画面の編集方法は[画面編集ガイド](designer-guide.md)を参照してください。

## カメラ

```ts
camera: {
  width: 640,
  height: 480,
  fps: 60,
},
```

| 設定 | 初期値 | 説明 |
| --- | ---: | --- |
| `camera.width` | `640` | ブラウザへ要求するカメラ映像の横幅 |
| `camera.height` | `480` | ブラウザへ要求するカメラ映像の高さ |
| `camera.fps` | `60` | ブラウザへ要求するフレームレート |

これらはカメラに対する要求値です。実際の解像度やフレームレートは、使用するカメラ、ブラウザ、照明、PC性能によって異なります。値を上げると必ず認識精度が上がるわけではなく、処理負荷が増える場合があります。

## 画像認識の頻度

```ts
vision: {
  targetProcessingFps: 30,
},
```

| 設定 | 初期値 | 説明 |
| --- | ---: | --- |
| `vision.targetProcessingFps` | `30` | 1秒あたりにジェスチャ認識へ渡す目標フレーム数 |

値を上げると短い動きを捉えやすくなる可能性がありますが、CPUやGPUの負荷も増えます。動作が重い場合は`20`程度へ下げて確認してください。カメラの実フレームレートやPCの処理能力を超える値を指定しても、そのフレーム数で処理できるとは限りません。

## ジェスチャ認識の有効化

```ts
gesture: {
  enabled: true,
  // ...
},
```

| 設定 | 初期値 | 説明 |
| --- | --- | --- |
| `gesture.enabled` | `true` | `false`にするとカメラ映像の処理は続けたまま、ジェスチャ確定を停止する |

キーボードの矢印キーによる操作は、`gesture.enabled`が`false`でも利用できます。

## 右腕スワイプ

```ts
armSwipe: {
  minDistanceRatio: 0.45,
  maxAxisAngleDeg: 20,
  maxGestureDurationMs: 500,
  minConfidence: 0.7,
  cooldownMs: 450,
},
```

| 設定 | 初期値 | 小さくした場合 | 大きくした場合 |
| --- | ---: | --- | --- |
| `minDistanceRatio` | `0.45` | 短い動きにも反応しやすい | 大きく腕を動かす必要がある |
| `maxAxisAngleDeg` | `20` | 水平・垂直に近い動きだけ認識する | 斜めの動きも認識しやすい |
| `maxGestureDurationMs` | `500` | 素早い動きだけ認識する | ゆっくりした動きも認識しやすい |
| `minConfidence` | `0.7` | 認識しやすいが誤反応が増える可能性がある | 判定が厳しくなる |
| `cooldownMs` | `450` | 連続操作しやすいが二重反応しやすい | 次の操作まで長く待つ必要がある |

`minDistanceRatio`は、肘を基準にした右手先の移動距離を身体サイズで割った値です。`cooldownMs`は右腕スワイプだけでなく、手首ひねりを含むジェスチャ確定後の共通待機時間として使われます。

### 調整例

- 腕を振っても反応しにくい場合は、まず`minDistanceRatio`を`0.40`程度へ下げます。
- 少し腕を動かしただけで反応する場合は、`minDistanceRatio`を上げます。
- 斜めの動きを誤認識する場合は、`maxAxisAngleDeg`を下げます。
- 1回の動作で2ページ進む場合は、`cooldownMs`を上げます。

## 手首ひねり（Snap Twist）

手首ひねりは、手を頭の高さへ上げて短く構え、前腕の軸を中心に手のひらを回転させたときに確定します。標準画面では、最終ページの後に黒画面を表示し、もう一度ひねると1ページ目へ戻ります。

```ts
snapTwist: {
  minVisibility: 0.35,
  maxHeadLevelDistanceRatio: 0.45,
  minFingerCurlRatio: 0.12,
  maxFingerCurlRatio: 0.48,
  minHandSpreadRatio: 0.08,
  maxWristTravelRatio: 0.18,
  minPoseHoldMs: 120,
  twistFireAngleDeg: 50,
  maxGestureDurationMs: 1000,
  maxTrackingGapMs: 120,
  minConfidence: 0.65,
},
```

| 設定 | 初期値 | 説明と調整方向 |
| --- | ---: | --- |
| `minVisibility` | `0.35` | 身体ランドマークの最低可視度。上げるほど、はっきり見えている手・腕だけを使う |
| `maxHeadLevelDistanceRatio` | `0.45` | 手と頭の縦方向の距離上限。下げるほど、頭に近い位置だけを構えとして扱う |
| `minFingerCurlRatio` | `0.12` | 構えとして扱う指先と手首の距離比率の下限 |
| `maxFingerCurlRatio` | `0.48` | 構えとして扱う指先と手首の距離比率の上限 |
| `minHandSpreadRatio` | `0.08` | 親指と小指の広がりの下限。上げるほど、手をある程度開く必要がある |
| `maxWristTravelRatio` | `0.18` | 構えた後に許容する手首位置の移動量。下げるほど、その場でひねる動きだけを認識する |
| `minPoseHoldMs` | `120` | ひねり始める前に構えを保持する時間。下げると反応が速くなる |
| `twistFireAngleDeg` | `50` | 確定に必要な手のひらの回転角度。下げると小さなひねりでも反応する |
| `maxGestureDurationMs` | `1000` | 構え始めてから確定するまでの制限時間。上げるとゆっくりひねれる |
| `maxTrackingGapMs` | `120` | 手や頭を一時的に見失っても追跡を継続する時間。上げると途切れに強くなる |
| `minConfidence` | `0.65` | 確定に必要な最低信頼度。上げるほど判定が厳しくなる |

`minFingerCurlRatio`と`maxFingerCurlRatio`は組み合わせて使用されます。まずデバッグ表示の「Snap Twist」が「頭位置」から「構え」へ進むかを確認してください。「構え」にならない場合でも、最初から複数の値を変更せず、手の高さ、指の曲げ方、手の開き方を確認してから1項目ずつ調整します。

## デバッグ表示

```ts
debug: {
  enabled: true,
  panelVisible: true,
},
```

| 設定 | 初期値 | 説明 |
| --- | --- | --- |
| `debug.enabled` | `true` | `false`にすると、認識に使った骨格などのカメラ映像への描画を停止する |
| `debug.panelVisible` | `true` | 起動時にデバッグ表示を開くかどうか。画面右上の「…」で後から開閉できる |

デバッグ表示を閉じると描画処理も抑えられるため、発表中の負荷を減らしたい場合に利用できます。`debug.enabled`を`false`にしても、デバッグパネルそのものやジェスチャ認識は無効になりません。

## LibreOfficeの場所を指定する

PowerPoint変換用のLibreOfficeが自動検出されない場合は、環境変数`AIRSWIPE_SOFFICE_PATH`へ`soffice`実行ファイルの場所を指定します。PowerShellでは、AirSwipeを起動する同じウィンドウで次のように設定します。

```powershell
$env:AIRSWIPE_SOFFICE_PATH = "C:\Program Files\LibreOffice\program\soffice.exe"
pnpm run dev
```

この指定は、そのPowerShellウィンドウを閉じるまで有効です。指定したファイルが存在しない場合やLibreOfficeを起動できない場合は、PowerPointをPDFへ変換できません。

## 値を戻す

調整後に認識できなくなった場合は、[`src/config.ts`](../src/config.ts)の値をこの文書に記載した初期値へ戻してください。設定値は起動時に読み込まれ、ブラウザやPCごとに自動保存されることはありません。

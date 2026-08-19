# 操作・品質要件

> NOTE: この文書は初期構想の要件メモです。現行アプリはブラウザ内でジェスチャイベントを発火し、`editable` 配下の画面処理へ渡すWebアプリです。この文書内のPythonライブラリ、PyAutoGUI、PyWin32、PowerPoint直接操作は、現行実装の前提ではありません。

## PowerPoint操作

| ジェスチャ | 送信キー |
| --- | --- |
| 次ページ | →キー または PageDown |
| 前ページ | ←キー または PageUp |

## 非機能要件

| 項目 | 要件 |
| --- | --- |
| 認識速度 | 0.3秒以内 |
| 操作遅延 | 0.5秒以内 |
| フレームレート | 30fps以上 |
| 誤認識率 | 5%以下を目標 |
| 対応OS | Windows 11 |
| PowerPoint | Microsoft 365 |

## 処理フロー

```text
システム起動 → カメラ初期化 → 映像取得 → 人体検出 → 手・腕検出
→ ジェスチャ分類 → 有効判定 → PowerPoint操作 → 待機 → 繰り返し
```

## 使用ライブラリ

| ライブラリ | 用途 |
| --- | --- |
| OpenCV | 映像取得 |
| MediaPipe | 骨格・手検出 |
| NumPy | 座標計算・画像差分 |
| PyAutoGUI | キーボード入力送信 |
| PyWin32（任意） | PowerPoint制御 |

## 操作画面

```text
Camera Preview
Gesture: Swipe Right
PPT Status: Next Slide
FPS: 30
```

## エラー処理

| 状況 | 処理 |
| --- | --- |
| カメラ未接続 | エラーメッセージ表示 |
| PowerPoint未起動 | 警告表示 |
| ジェスチャ未検出 | 待機状態 |
| 複数人検出 | 中央人物のみ認識 |

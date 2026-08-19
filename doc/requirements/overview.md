# システム概要

> NOTE: この文書は初期構想の要件メモです。現行アプリはTypeScript / Viteで動くWebアプリで、MediaPipe PoseLandmarkerにより右腕の上下左右ジェスチャを画面内イベントとして扱います。この文書内のPython、OpenCV、PowerPoint直接操作を前提にした構成は、現行実装の前提ではありません。

## 目的

AirSwipeは、プロジェクターで投影しているMicrosoft PowerPointのスライドを、ユーザーのジェスチャで操作するシステムです。プレゼンターがリモコンやキーボードを使わず、自然な動作だけでプレゼンテーションを進行できることを目指します。

通常のスライド操作にはリモコン、キーボード、またはマウスが必要です。そのため、操作のために演台へ戻ることや、説明のために使う手が中断されることがあります。本システムはジェスチャ認識によってこれらを解消します。

## システム構成

### ハードウェア

- PC（Windows）
- Webカメラ
- プロジェクター

### ソフトウェア

- Microsoft PowerPoint
- Python
- OpenCV
- MediaPipe
- ジェスチャ認識モジュール
- PowerPoint操作モジュール

## システム構成図

```text
Webカメラ
  ↓
ジェスチャ認識モジュール（OpenCV + MediaPipe）
  ↓
ジェスチャ判定ロジック
  ↓
PowerPoint操作モジュール
  ↓
Microsoft PowerPoint
```

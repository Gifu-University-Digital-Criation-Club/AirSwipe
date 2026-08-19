# ドキュメント

現行実装は、TypeScript / Viteで動くWebアプリです。MediaPipe PoseLandmarkerで右腕の動きを追跡し、上下左右のジェスチャを画面内イベントとして扱います。

Python、OpenCV、PowerPoint直接操作、指パッチン検出を前提にした文書は、現行実装前の初期構想として残しています。

| 文書 | 状態 | 内容 |
| --- | --- | --- |
| [画面編集ガイド](designer-guide.md) | 現行 | 画面編集担当者向けのセットアップ、編集対象、動作追加方法 |
| [システム概要](requirements/overview.md) | 初期構想 | Python / OpenCV / PowerPoint直接操作を前提とした目的、構成、システム構成図 |
| [ジェスチャ認識要件](requirements/gesture-recognition.md) | 初期構想 | 腕振り、ページめくり、指パッチン検出の検討メモ |
| [操作・品質要件](requirements/operation-and-quality.md) | 初期構想 | PowerPoint操作、非機能要件、画面、エラー処理の検討メモ |
| [ロードマップ・運用](requirements/roadmap.md) | 初期構想 | Python / PowerPoint連携を前提とした拡張計画、スケジュール、利用シナリオ |
| [初期構成案](initial-python-plan.md) | 初期構想 | Webアプリ実装前に検討していたPython版の初期構成案 |

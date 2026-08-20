import type { AppSettings } from "./types";

export const defaultSettings: AppSettings = {
  template: {
    path: "/editable/main.html",
    // 参照テンプレートへ切り替える場合は、上の行と次の行を入れ替えます。
    // path: "/templates/appTemplate.html",
  },
  camera: {
    width: 640,
    height: 480,
    fps: 60,
  },
  vision: {
    targetProcessingFps: 30,
  },
  gesture: {
    enabled: true,
    armSwipe: {
      minDistanceRatio: 0.45,
      maxAxisAngleDeg: 20,
      maxGestureDurationMs: 500,
      minConfidence: 0.7,
      cooldownMs: 450,
    },
    snapTwist: {
      minVisibility: 0.35, // ランドマーク最低可視度。高いほど厳格。
      maxHeadLevelDistanceRatio: 0.45, // 手と頭の縦距離上限。低いほど頭付近限定。
      minFingerCurlRatio: 0.12, // 構え入場用: 指曲げ下限。
      maxFingerCurlRatio: 0.48, // 構え入場用: 指曲げ上限。
      minHandSpreadRatio: 0.08, // 構え入場用: 親指-小指の広がり下限。
      maxWristTravelRatio: 0.18, // 構え後の手首移動上限。
      minPoseHoldMs: 120, // 構え保持時間。短いほど反応速い。
      twistFireAngleDeg: 50, // 手首-肘軸まわりの発火角度。
      maxGestureDurationMs: 1000, // 構えから発火までの最大時間。
      maxTrackingGapMs: 120, // 頭位置・手首追跡の欠落許容時間。
      minConfidence: 0.65, // 発火に必要な最低信頼度。
    },
  },
  debug: {
    enabled: true,
    panelVisible: true,
  },
};

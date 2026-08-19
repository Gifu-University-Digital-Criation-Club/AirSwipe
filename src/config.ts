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
  },
  debug: {
    enabled: true,
    panelVisible: true,
  },
};

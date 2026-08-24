import "../editable/style.css";
import "./debugPanel/debugPanel.css";
import { bindEditorActions } from "../editable/editorActions";
import debugPanelHtml from "./debugPanel/debugPanel.html?raw";
import { bindDebugGestureStatus } from "./debugPanel/gestureStatus";
import { defaultSettings } from "./config";
import { ArmSwipeRecognizer } from "./gesture/ArmSwipeRecognizer";
import { GestureEngine } from "./gesture/GestureEngine";
import { SnapTwistRecognizer } from "./gesture/SnapTwistRecognizer";
import { CameraService } from "./services/CameraService";
import type { AppSettings, GestureDirection, GestureEvent, SnapTwistDebugState } from "./types";
import { FrameProcessor } from "./vision/FrameProcessor";

type BundledTemplateModule = {
  mount?: () => void | Promise<void>;
};

const bundledTemplateHtml = import.meta.glob<string>("./templates/*.html", {
  query: "?raw",
  import: "default",
});
const bundledTemplateModules = import.meta.glob<BundledTemplateModule>("./templates/*.ts");

const settings: AppSettings = structuredClone(defaultSettings);
const app = document.querySelector<HTMLDivElement>("#app");
const systemUi = document.querySelector<HTMLDivElement>("#systemUi");

if (!app || !systemUi) {
  throw new Error("App root is missing.");
}

const appRoot = app;
systemUi.innerHTML = debugPanelHtml;

try {
  const template = await loadAppTemplate(settings.template.path);
  app.innerHTML = template.html;
  await template.mount?.();
} catch (error) {
  app.innerHTML = `<main class="app-shell"><p>テンプレートを読み込めませんでした。</p></main>`;
  throw error;
}
const cameraService = new CameraService();
let frameProcessor: FrameProcessor | null = null;
let snapTwistRecognizer: SnapTwistRecognizer | null = null;
let gestureEngine = createGestureEngine();
let rafId = 0;
let framesThisSecond = 0;
let lastFpsAt = performance.now();
let lastProcessedAt = 0;
let lastDirectionalInputAt = 0;
let snapTwistFiredUntil = 0;
let isIdleState = true;
const idleTimeoutMs = 1400;
const snapTwistFiredDisplayMs = 650;

// 発表画面とデバッグ表示で使う必須idです。消したり名前を変えたりしないでください。
const video = query<HTMLVideoElement>("#cameraVideo");
const cameraToggle = query<HTMLButtonElement>("#cameraToggle");
const fullscreenButton = query<HTMLButtonElement>("#fullscreenButton");
const systemExitButton = query<HTMLButtonElement>("#systemExitButton");
const cameraStatus = query<HTMLElement>("#cameraStatus");
const visionStatus = query<HTMLElement>("#visionStatus");
const engineStatus = query<HTMLElement>("#engineStatus");
const fpsText = query<HTMLElement>("#fpsText");
const candidateText = query<HTMLElement>("#candidateText");
const areaText = query<HTMLElement>("#areaText");
const confidenceText = query<HTMLElement>("#confidenceText");
const lastGestureText = query<HTMLElement>("#lastGestureText");
const snapTwistSteps = query<HTMLElement>("#snapTwistSteps");
const debugPanel = query<HTMLElement>("#debugPanel");
const debugPanelHeader = query<HTMLElement>("#debugPanelHeader");
const debugPanelButton = query<HTMLButtonElement>("#debugPanelButton");
const pdfLoad = query<HTMLButtonElement>("#pdfLoad");
const pdfFileInput = query<HTMLInputElement>("#pdfFileInput");

applySettingsToUi();
bindDebugGestureStatus({ confidenceText, lastGestureText, engineStatus, snapTwistSteps });
const pdfViewer = bindEditorActions();
bindEvents();
emitIdleState("矢印キーでも確認できます");

// 指定したidや要素をHTMLから探します。見つからない場合は、必要なidが消えた可能性があります。
function query<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing element: ${selector}`);
  }
  return element;
}

// template.pathに応じて、編集用HTMLまたはsrc/templates内のテンプレートを読み込みます。
type LoadedTemplate = {
  html: string;
  mount?: () => void | Promise<void>;
};

async function loadAppTemplate(path: string): Promise<LoadedTemplate> {
  const bundledKey = resolveBundledTemplateKey(path);
  if (bundledKey) {
    const htmlLoader = bundledTemplateHtml[bundledKey];
    if (!htmlLoader) {
      throw new Error(`テンプレートを読み込めませんでした: ${path}`);
    }

    const moduleLoader = bundledTemplateModules[bundledKey.replace(/\.html$/, ".ts")];
    const [html, templateModule] = await Promise.all([
      htmlLoader(),
      moduleLoader?.() ?? Promise.resolve(undefined),
    ]);

    return {
      html,
      mount: templateModule?.mount,
    };
  }

  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`テンプレートを読み込めませんでした: ${path}`);
  }

  return {
    html: await response.text(),
  };
}

function resolveBundledTemplateKey(path: string): string | null {
  if (!path.startsWith("/templates/")) return null;
  return `./templates/${path.slice("/templates/".length)}`;
}

// 使用するジェスチャ認識器を組み立てます。将来ジェスチャを増やす場合はここに追加します。
function createGestureEngine(): GestureEngine {
  snapTwistRecognizer = new SnapTwistRecognizer(settings.gesture.snapTwist);
  return new GestureEngine(
    [
      new ArmSwipeRecognizer(settings.gesture.armSwipe),
      snapTwistRecognizer,
    ],
    settings.gesture.armSwipe.cooldownMs,
  );
}

// カメラ、キーボード、PDF読込などアプリ本体のイベントを登録します。
// 画面独自のボタン処理は editable/editorActions.ts に追加してください。
function bindEvents(): void {
  cameraToggle.addEventListener("click", () => {
    if (cameraService.isRunning()) {
      stopCamera();
      return;
    }
    void startCamera();
  });

  debugPanelButton.addEventListener("click", () => {
    settings.debug.panelVisible = !settings.debug.panelVisible;
    applySettingsToUi();
  });
  pdfLoad.addEventListener("click", () => pdfFileInput.click());
  pdfFileInput.addEventListener("change", () => {
    const [file] = pdfFileInput.files ?? [];
    if (file) {
      void pdfViewer.loadFile(file);
    }

    // 同じファイルを続けて選択した場合もchangeイベントを発火させる。
    pdfFileInput.value = "";
  });
  fullscreenButton.addEventListener("click", () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    void document.documentElement.requestFullscreen();
  });

  systemExitButton.addEventListener("click", () => {
    void exitSystem();
  });
  document.addEventListener("keydown", (event) => {
    const keyMap: Record<string, GestureDirection> = {
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowUp: "up",
      ArrowDown: "down",
    };
    const direction = keyMap[event.key];
    if (!direction) {
      return;
    }

    event.preventDefault();
    emitGestureCommand({
      id: `SWIPE_${direction.toUpperCase()}` as GestureEvent["id"],
      direction,
      confidence: 1,
      startedAt: performance.now(),
      confirmedAt: performance.now(),
      metadata: { source: "keyboard" },
    });
  });

  bindDebugPanelDrag();
}

// カメラと開発サーバーを停止して、発表システムを終了します。
async function exitSystem(): Promise<void> {
  if (!window.confirm("システムを終了しますか？")) return;

  systemExitButton.disabled = true;
  systemExitButton.textContent = "終了中…";
  if (document.fullscreenElement) {
    await document.exitFullscreen();
  }
  if (cameraService.isRunning()) {
    stopCamera();
  }

  try {
    const response = await fetch("/api/shutdown", { method: "POST", keepalive: true });
    if (!response.ok) throw new Error("終了リクエストに失敗しました。");
    appRoot.innerHTML = '<main class="system-exit-message">システムを終了しました。このタブは閉じて構いません。</main>';
  } catch {
    systemExitButton.disabled = false;
    systemExitButton.textContent = "システム終了";
    window.alert("システムを終了できませんでした。起動に使ったターミナルでCtrl+Cを押してください。");
  }
}

// カメラを起動し、Pose Landmarkerを初期化して認識ループを開始します。
async function startCamera(): Promise<void> {
  try {
    await cameraService.start(video, settings.camera);
    frameProcessor = new FrameProcessor(video, "debugCanvas");
    visionStatus.textContent = "Vision: モデル初期化中";
    await frameProcessor.init();
    gestureEngine.reset();
    visionStatus.textContent = "Vision: Pose Landmarker lite";
    visionStatus.classList.add("ready");
    cameraToggle.textContent = "カメラ停止";
    cameraStatus.textContent = `Camera: 起動中 / ${cameraFpsLabel()}`;
    cameraStatus.classList.add("ready");
    engineStatus.textContent = "Gesture: 追跡中";
    lastProcessedAt = 0;
    emitIdleState("入力待機中");
    startLoop();
  } catch (error) {
    cameraStatus.textContent = "Camera: 起動失敗";
    engineStatus.textContent = error instanceof Error ? error.message : "カメラを起動できませんでした";
  }
}

// カメラと認識ループを止め、画面表示を待機状態に戻します。
function stopCamera(): void {
  window.cancelAnimationFrame(rafId);
  frameProcessor?.release();
  frameProcessor = null;
  cameraService.stop();
  video.srcObject = null;
  snapTwistFiredUntil = 0;
  cameraToggle.textContent = "カメラ開始";
  cameraStatus.textContent = "Camera: 停止中";
  cameraStatus.classList.remove("ready");
  engineStatus.textContent = "Gesture: 待機中";
  candidateText.textContent = "none";
  areaText.textContent = "0";
  fpsText.textContent = "処理 0 fps";
  emitSnapTwistState(performance.now(), { step: "idle", updatedAt: performance.now() });
  emitIdleState("カメラ停止中");
}

// カメラフレームを一定FPSで処理し、ジェスチャ確定時にイベントを発火します。
function startLoop(): void {
  const loop = (timestamp: number) => {
    rafId = window.requestAnimationFrame(loop);

    if (!frameProcessor) {
      return;
    }

    if (timestamp - lastProcessedAt < processingIntervalMs()) {
      maybeReturnToIdle(timestamp);
      return;
    }
    lastProcessedAt = timestamp;

    const frame = frameProcessor.process(timestamp, settings.debug.panelVisible && settings.debug.enabled);

    if (!frame) {
      maybeReturnToIdle(timestamp);
      return;
    }

    framesThisSecond += 1;
    if (timestamp - lastFpsAt >= 1000) {
      fpsText.textContent = `処理 ${framesThisSecond} fps`;
      framesThisSecond = 0;
      lastFpsAt = timestamp;
    }

    candidateText.textContent = frame.motion.activeJoint ?? "none";
    areaText.textContent = `${frame.motion.landmarks?.length ?? 0}`;

    if (!settings.gesture.enabled) {
      engineStatus.textContent = "Gesture: OFF";
      emitSnapTwistState(timestamp, { step: "idle", updatedAt: timestamp });
      return;
    }

    const event = gestureEngine.process(frame);
    if (event) {
      emitGestureCommand(event);
      if (event.id === "SNAP_TWIST") {
        snapTwistFiredUntil = timestamp + snapTwistFiredDisplayMs;
      }
    }
    emitSnapTwistState(timestamp);

    maybeReturnToIdle(timestamp);
  };

  rafId = window.requestAnimationFrame(loop);
}

// ジェスチャまたは矢印キーで方向が確定したことを画面側へ通知します。
function emitGestureCommand(event: GestureEvent): void {
  lastDirectionalInputAt = event.confirmedAt;
  isIdleState = event.direction === "idle";
  window.dispatchEvent(new CustomEvent("gesture-command", { detail: event }));
}

// 一定時間入力がなければIDLEへ戻します。
function maybeReturnToIdle(timestamp: number): void {
  if (isIdleState) {
    return;
  }

  if (lastDirectionalInputAt > 0 && timestamp - lastDirectionalInputAt >= idleTimeoutMs) {
    emitIdleState("一定時間入力なし");
  }
}

// 待機状態になったことを画面側へ通知します。
function emitIdleState(reason: string): void {
  emitGestureCommand({
    id: "IDLE",
    direction: "idle",
    confidence: 1,
    startedAt: performance.now(),
    confirmedAt: performance.now(),
    metadata: { reason },
  });
}

function emitSnapTwistState(timestamp: number, overrideState?: SnapTwistDebugState): void {
  const detail: SnapTwistDebugState =
    overrideState ??
    (timestamp < snapTwistFiredUntil
      ? { step: "fired", updatedAt: timestamp }
      : snapTwistRecognizer?.getDebugState() ?? { step: "idle", updatedAt: timestamp });

  window.dispatchEvent(new CustomEvent("snap-twist-state", { detail }));
}

// 設定値に合わせて画面の表示・非表示を切り替えます。
function applySettingsToUi(): void {
  const isVisible = settings.debug.panelVisible;
  debugPanel.classList.toggle("is-hidden", !isVisible);
  debugPanelButton.setAttribute("aria-expanded", String(isVisible));
  debugPanelButton.setAttribute("aria-label", isVisible ? "デバッグ表示を閉じる" : "デバッグ表示を開く");
}

// デバッグ表示のヘッダーをドラッグして、浮遊パネルを移動できるようにします。
function bindDebugPanelDrag(): void {
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  debugPanelHeader.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
      return;
    }

    const rect = debugPanel.getBoundingClientRect();
    dragOffsetX = event.clientX - rect.left;
    dragOffsetY = event.clientY - rect.top;
    debugPanel.classList.add("is-dragging");
    debugPanelHeader.setPointerCapture(event.pointerId);
  });

  debugPanelHeader.addEventListener("pointermove", (event) => {
    if (!debugPanelHeader.hasPointerCapture(event.pointerId)) {
      return;
    }

    moveDebugPanel(event.clientX - dragOffsetX, event.clientY - dragOffsetY);
  });

  const stopDragging = (event: PointerEvent) => {
    if (debugPanelHeader.hasPointerCapture(event.pointerId)) {
      debugPanelHeader.releasePointerCapture(event.pointerId);
    }
    debugPanel.classList.remove("is-dragging");
  };

  debugPanelHeader.addEventListener("pointerup", stopDragging);
  debugPanelHeader.addEventListener("pointercancel", stopDragging);
  window.addEventListener("resize", () => {
    if (!settings.debug.panelVisible) {
      return;
    }
    const rect = debugPanel.getBoundingClientRect();
    moveDebugPanel(rect.left, rect.top);
  });
}

// デバッグ表示が画面外へ出ないように位置を補正します。
function moveDebugPanel(left: number, top: number): void {
  const rect = debugPanel.getBoundingClientRect();
  const maxLeft = Math.max(window.innerWidth - rect.width, 0);
  const maxTop = Math.max(window.innerHeight - rect.height, 0);
  const nextLeft = Math.min(Math.max(left, 0), maxLeft);
  const nextTop = Math.min(Math.max(top, 0), maxTop);

  debugPanel.style.left = `${nextLeft}px`;
  debugPanel.style.top = `${nextTop}px`;
  debugPanel.style.right = "auto";
  debugPanel.style.bottom = "auto";
}

// 実際にブラウザが取得できたカメラFPSを表示用文字列にします。
function cameraFpsLabel(): string {
  const actualFps = cameraService.getVideoSettings()?.frameRate;
  if (actualFps) {
    return `${Math.round(actualFps)}fps`;
  }

  return `${settings.camera.fps}fps要求`;
}

// Pose Landmarkerを実行する間隔を、設定された処理FPSから計算します。
function processingIntervalMs(): number {
  return 1000 / Math.max(settings.vision.targetProcessingFps, 1);
}

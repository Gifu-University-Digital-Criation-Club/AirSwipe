import type { GestureDirection, GestureEvent } from "../types";

export type DebugGestureStatusElements = {
  confidenceText: HTMLElement;
  lastGestureText: HTMLElement;
  engineStatus: HTMLElement;
};

const directionLabels: Record<GestureDirection, string> = {
  left: "LEFT",
  right: "RIGHT",
  up: "UP",
  down: "DOWN",
  idle: "IDLE",
  none: "NONE",
};

// デバッグパネルの状態表示をジェスチャイベントへ接続します。
export function bindDebugGestureStatus(elements: DebugGestureStatusElements): void {
  window.addEventListener("gesture-command", (event) => {
    renderDebugGestureStatus((event as CustomEvent<GestureEvent>).detail, elements);
  });
}

function renderDebugGestureStatus(event: GestureEvent, elements: DebugGestureStatusElements): void {
  const label = directionLabels[event.direction] ?? "NONE";
  const isIdle = event.direction === "idle";

  elements.confidenceText.textContent = isIdle ? "-" : event.confidence.toFixed(2);
  elements.lastGestureText.textContent = event.id;
  elements.engineStatus.textContent = isIdle ? "Gesture: 待機" : `Gesture: ${label} 確定`;
}

import "./appTemplate.css";
import type { GestureDirection, GestureEvent } from "../types";

const directionLabels: Record<GestureDirection, string> = {
  left: "LEFT",
  right: "RIGHT",
  up: "UP",
  down: "DOWN",
  idle: "IDLE",
  none: "NONE",
};

// appTemplate.html専用の認識結果表示をジェスチャイベントへ接続します。
export function mount(): void {
  window.addEventListener("gesture-command", (event) => {
    renderGestureStatus((event as CustomEvent<GestureEvent>).detail);
  });
}

function renderGestureStatus(event: GestureEvent): void {
  const directionText = document.querySelector<HTMLElement>("#directionText");
  const gestureMeta = document.querySelector<HTMLElement>("#gestureMeta");
  const label = directionLabels[event.direction] ?? "NONE";
  const isIdle = event.direction === "idle";

  if (directionText) {
    directionText.textContent = label;
    directionText.dataset.direction = event.direction;
  }
  if (gestureMeta) {
    gestureMeta.textContent = isIdle
      ? String(event.metadata?.reason ?? "待機中")
      : `${event.id} / confidence ${event.confidence.toFixed(2)}`;
  }

  document.querySelectorAll(".pad-cell, .pad-center").forEach((cell) => cell.classList.remove("active"));
  document.querySelector(`#pad-${event.direction}`)?.classList.add("active");
}

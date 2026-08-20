import type { GestureDirection, GestureEvent, SnapTwistDebugState, SnapTwistStep } from "../types";

export type DebugGestureStatusElements = {
  confidenceText: HTMLElement;
  lastGestureText: HTMLElement;
  engineStatus: HTMLElement;
  snapTwistSteps: HTMLElement;
};

const directionLabels: Record<GestureDirection, string> = {
  left: "LEFT",
  right: "RIGHT",
  up: "UP",
  down: "DOWN",
  snap: "SNAP",
  idle: "IDLE",
  none: "NONE",
};

const snapTwistSteps: SnapTwistStep[] = ["idle", "headLevel", "ready", "fired"];

export function bindDebugGestureStatus(elements: DebugGestureStatusElements): void {
  window.addEventListener("gesture-command", (event) => {
    renderDebugGestureStatus((event as CustomEvent<GestureEvent>).detail, elements);
  });

  window.addEventListener("snap-twist-state", (event) => {
    renderSnapTwistStatus((event as CustomEvent<SnapTwistDebugState>).detail, elements.snapTwistSteps);
  });

  renderSnapTwistStatus({ step: "idle", updatedAt: performance.now() }, elements.snapTwistSteps);
}

function renderDebugGestureStatus(event: GestureEvent, elements: DebugGestureStatusElements): void {
  const label = directionLabels[event.direction] ?? "NONE";
  const isIdle = event.direction === "idle";

  elements.confidenceText.textContent = isIdle ? "-" : event.confidence.toFixed(2);
  elements.lastGestureText.textContent = event.id;
  elements.engineStatus.textContent = isIdle ? "Gesture: 待機" : `Gesture: ${label} 確定`;
}

function renderSnapTwistStatus(state: SnapTwistDebugState, container: HTMLElement): void {
  for (const step of snapTwistSteps) {
    const element = container.querySelector<HTMLElement>(`[data-snap-twist-step="${step}"]`);
    const isActive = step === state.step;

    element?.classList.toggle("is-active", isActive);
    element?.setAttribute("aria-current", isActive ? "step" : "false");
  }
}

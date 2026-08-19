import type { FrameContext, GestureEvent, GestureRecognizer } from "../types";

export class GestureEngine {
  private recognizers: GestureRecognizer[];
  private cooldownMs: number;
  private lastConfirmedAt = 0;

  constructor(recognizers: GestureRecognizer[], cooldownMs: number) {
    this.recognizers = recognizers;
    this.cooldownMs = cooldownMs;
  }

  process(frame: FrameContext): GestureEvent | null {
    if (frame.timestamp - this.lastConfirmedAt < this.cooldownMs) {
      return null;
    }

    for (const recognizer of this.recognizers) {
      const event = recognizer.process(frame);
      if (event) {
        this.lastConfirmedAt = frame.timestamp;
        this.recognizers.forEach((item) => item.reset());
        return event;
      }
    }

    return null;
  }

  reset(): void {
    this.lastConfirmedAt = 0;
    this.recognizers.forEach((recognizer) => recognizer.reset());
  }

  updateCooldown(cooldownMs: number): void {
    this.cooldownMs = cooldownMs;
  }

  updateRecognizers(recognizers: GestureRecognizer[]): void {
    this.recognizers = recognizers;
    this.reset();
  }
}

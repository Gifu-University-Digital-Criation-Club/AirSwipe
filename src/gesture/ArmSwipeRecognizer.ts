import type { FrameContext, GestureEvent, GestureRecognizer, GestureSettings, Point2D } from "../types";

type TrackingState = {
  start: Point2D;
  last: Point2D;
  startedAt: number;
  activeJoint?: string;
};

export class ArmSwipeRecognizer implements GestureRecognizer {
  readonly id = "arm-swipe";

  private tracking: TrackingState | null = null;
  private readonly settings: GestureSettings;

  constructor(settings: GestureSettings) {
    this.settings = settings;
  }

  reset(): void {
    this.tracking = null;
  }

  process(frame: FrameContext): GestureEvent | null {
    const { motion } = frame;

    const targetPoint = motion.relativePoint;
    const bodyScalePx = motion.bodyScalePx;

    if (!targetPoint || !bodyScalePx) {
      this.resetExpired(frame.timestamp);
      return null;
    }

    if (!this.tracking || this.tracking.activeJoint !== motion.activeJoint) {
      this.tracking = {
        start: targetPoint,
        last: targetPoint,
        startedAt: frame.timestamp,
        activeJoint: motion.activeJoint,
      };
      return null;
    }

    this.tracking.last = targetPoint;
    const dx = targetPoint.x - this.tracking.start.x;
    const dy = targetPoint.y - this.tracking.start.y;
    const elapsedMs = frame.timestamp - this.tracking.startedAt;

    if (elapsedMs > this.settings.maxGestureDurationMs) {
      this.tracking = {
        start: targetPoint,
        last: targetPoint,
        startedAt: frame.timestamp,
        activeJoint: motion.activeJoint,
      };
      return null;
    }

    const distance = Math.hypot(dx, dy);
    const distanceRatio = distance / bodyScalePx;

    if (distanceRatio < this.settings.minDistanceRatio) {
      return null;
    }

    const directionResult = this.resolveDirection(dx, dy);

    if (!directionResult || directionResult.confidence < this.settings.minConfidence) {
      return null;
    }

    const { direction, confidence, axisAngleDeg } = directionResult;
    const id = `SWIPE_${direction.toUpperCase()}` as GestureEvent["id"];
    const event: GestureEvent = {
      id,
      direction,
      confidence,
      startedAt: this.tracking.startedAt,
      confirmedAt: frame.timestamp,
      metadata: {
        distancePx: Math.round(distance),
        distanceRatio: Number(distanceRatio.toFixed(2)),
        bodyScalePx: Math.round(bodyScalePx),
        axisAngleDeg: Math.round(axisAngleDeg),
        activeJoint: motion.activeJoint ?? "unknown",
        origin: "moving-elbow-coordinate",
      },
    };

    this.reset();
    return event;
  }

  private resetExpired(timestamp: number): void {
    if (!this.tracking) {
      return;
    }

    if (timestamp - this.tracking.startedAt > this.settings.maxGestureDurationMs) {
      this.reset();
    }
  }

  private resolveDirection(
    dx: number,
    dy: number,
  ): { direction: "left" | "right" | "up" | "down"; confidence: number; axisAngleDeg: number } | null {
    const angleDeg = Math.abs((Math.atan2(dy, dx) * 180) / Math.PI);
    const horizontalOffsetDeg = Math.min(angleDeg, 180 - angleDeg);
    const verticalOffsetDeg = Math.abs(angleDeg - 90);

    if (horizontalOffsetDeg <= this.settings.maxAxisAngleDeg) {
      return {
        direction: dx < 0 ? "left" : "right",
        confidence: this.angleConfidence(horizontalOffsetDeg),
        axisAngleDeg: horizontalOffsetDeg,
      };
    }

    if (verticalOffsetDeg <= this.settings.maxAxisAngleDeg) {
      return {
        direction: dy < 0 ? "up" : "down",
        confidence: this.angleConfidence(verticalOffsetDeg),
        axisAngleDeg: verticalOffsetDeg,
      };
    }

    return null;
  }

  private angleConfidence(axisAngleDeg: number): number {
    const normalized = 1 - axisAngleDeg / Math.max(this.settings.maxAxisAngleDeg, 1);
    const confidence =
      this.settings.minConfidence + Math.max(0, normalized) * (1 - this.settings.minConfidence);
    return Math.max(0, Math.min(1, confidence));
  }
}

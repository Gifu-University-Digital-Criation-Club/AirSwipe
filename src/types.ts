export type GestureDirection = "left" | "right" | "up" | "down" | "idle" | "none";

export type GestureId = "SWIPE_LEFT" | "SWIPE_RIGHT" | "SWIPE_UP" | "SWIPE_DOWN" | "IDLE";

export type GestureEvent = {
  id: GestureId;
  direction: GestureDirection;
  confidence: number;
  startedAt: number;
  confirmedAt: number;
  metadata?: Record<string, unknown>;
};

export type Point2D = {
  x: number;
  y: number;
};

export type MotionSample = {
  centroid: Point2D | null;
  timestamp: number;
  width: number;
  height: number;
  landmarks?: PoseLandmark[];
  activeJoint?: string;
  relativePoint?: Point2D;
  relativeBase?: Point2D;
  bodyScalePx?: number;
};

export type FrameContext = {
  frame: ImageData;
  timestamp: number;
  width: number;
  height: number;
  motion: MotionSample;
};

export interface GestureRecognizer {
  id: string;
  reset(): void;
  process(frame: FrameContext): GestureEvent | null;
}

export type PoseLandmark = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

export type GestureSettings = {
  minDistanceRatio: number;
  maxAxisAngleDeg: number;
  maxGestureDurationMs: number;
  minConfidence: number;
  cooldownMs: number;
};

export type AppSettings = {
  template: {
    path: string;
  };
  camera: {
    width: number;
    height: number;
    fps: number;
  };
  vision: {
    targetProcessingFps: number;
  };
  gesture: {
    enabled: boolean;
    armSwipe: GestureSettings;
  };
  debug: {
    enabled: boolean;
    panelVisible: boolean;
  };
};

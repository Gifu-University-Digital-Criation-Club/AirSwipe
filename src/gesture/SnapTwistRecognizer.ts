import type {
  FrameContext,
  GestureEvent,
  GestureRecognizer,
  HandSample,
  HandSide,
  Point2D,
  Point3D,
  PoseLandmark,
  SnapTwistDebugState,
  SnapTwistSettings,
  SnapTwistStep,
} from "../types";

type HandSpec = {
  side: HandSide;
  elbowIndex: number;
  wristIndex: number;
};

type SnapCandidate = {
  side: HandSide;
  wrist: Point2D;
  forearmAxis: Point3D;
  palmNormal: Point3D;
  bodyScale: number;
  headDistanceRatio: number;
  fingerCurlRatio: number;
  handSpreadRatio: number;
  confidenceBase: number;
};

type TrackingState = {
  side: HandSide;
  startedAt: number;
  lastSeenAt: number;
  armedAt: number | null;
  startWrist: Point2D;
  baselinePalmNormal: Point3D | null;
  forearmAxis: Point3D | null;
  entryCandidate: SnapCandidate;
};

type FrameAnalysis = {
  hasHeadLevelHand: boolean;
  entryCandidates: SnapCandidate[];
  trackingCandidates: SnapCandidate[];
};

const HAND_SPECS: HandSpec[] = [
  { side: "left", elbowIndex: 13, wristIndex: 15 },
  { side: "right", elbowIndex: 14, wristIndex: 16 },
];

const HEAD_LANDMARK_INDEXES = [0, 1, 2, 3, 4, 7, 8];
const HAND_WRIST = 0;
const THUMB_TIP = 4;
const INDEX_MCP = 5;
const INDEX_TIP = 8;
const MIDDLE_TIP = 12;
const RING_TIP = 16;
const PINKY_MCP = 17;
const PINKY_TIP = 20;

export class SnapTwistRecognizer implements GestureRecognizer {
  readonly id = "snap-twist";

  private tracking: TrackingState | null = null;
  private debugState: SnapTwistDebugState = { step: "idle", updatedAt: 0 };
  private readonly settings: SnapTwistSettings;

  constructor(settings: SnapTwistSettings) {
    this.settings = settings;
  }

  reset(): void {
    this.tracking = null;
    this.debugState = { step: "idle", updatedAt: this.debugState.updatedAt };
  }

  getDebugState(): SnapTwistDebugState {
    return this.debugState;
  }

  process(frame: FrameContext): GestureEvent | null {
    const analysis = this.analyzeFrame(frame);

    if (!this.tracking) {
      const entryCandidate = this.selectEntryCandidate(analysis.entryCandidates);
      if (!entryCandidate) {
        this.setDebugStep(analysis.hasHeadLevelHand ? "headLevel" : "idle", frame.timestamp);
        return null;
      }

      this.startTracking(entryCandidate, frame.timestamp);
      this.setDebugStep("ready", frame.timestamp, entryCandidate.side);
      return null;
    }

    const candidate = this.selectTrackingCandidate(analysis.trackingCandidates);
    if (!candidate) {
      const wasReset = this.resetMissing(frame.timestamp);
      if (wasReset) {
        this.setDebugStep(analysis.hasHeadLevelHand ? "headLevel" : "idle", frame.timestamp);
      }
      return null;
    }

    const tracking = this.tracking;
    tracking.lastSeenAt = frame.timestamp;

    const elapsedMs = frame.timestamp - tracking.startedAt;
    if (elapsedMs > this.settings.maxGestureDurationMs) {
      this.restartFromEntryOrReset(analysis, frame.timestamp, candidate.side);
      return null;
    }

    const wristTravelRatio = this.distance2D(tracking.startWrist, candidate.wrist) / candidate.bodyScale;
    if (wristTravelRatio > this.settings.maxWristTravelRatio) {
      this.restartFromEntryOrReset(analysis, frame.timestamp, candidate.side);
      return null;
    }

    if (elapsedMs < this.settings.minPoseHoldMs) {
      tracking.startWrist = candidate.wrist;
      this.setDebugStep("ready", frame.timestamp, candidate.side);
      return null;
    }

    if (tracking.armedAt === null) {
      tracking.armedAt = frame.timestamp;
      tracking.startWrist = candidate.wrist;
      tracking.baselinePalmNormal = candidate.palmNormal;
      tracking.forearmAxis = candidate.forearmAxis;
      this.setDebugStep("ready", frame.timestamp, candidate.side);
      return null;
    }

    if (!tracking.baselinePalmNormal || !tracking.forearmAxis) {
      this.setDebugStep("ready", frame.timestamp, candidate.side);
      return null;
    }

    const twistAngleDeg = Math.abs(
      this.signedAngleAroundAxis(tracking.baselinePalmNormal, candidate.palmNormal, tracking.forearmAxis),
    );
    if (twistAngleDeg < this.settings.twistFireAngleDeg) {
      this.setDebugStep("ready", frame.timestamp, candidate.side);
      return null;
    }

    const confidence = this.resolveConfidence(tracking.entryCandidate, wristTravelRatio, twistAngleDeg);
    if (confidence < this.settings.minConfidence) {
      this.setDebugStep("ready", frame.timestamp, candidate.side);
      return null;
    }

    const event: GestureEvent = {
      id: "SNAP_TWIST",
      direction: "snap",
      confidence,
      startedAt: tracking.startedAt,
      confirmedAt: frame.timestamp,
      metadata: {
        hand: candidate.side,
        origin: "forearm-axis-palm-normal-roll",
        twistAngleDeg: Math.round(twistAngleDeg),
        headDistanceRatio: Number(candidate.headDistanceRatio.toFixed(2)),
        fingerCurlRatio: Number(tracking.entryCandidate.fingerCurlRatio.toFixed(2)),
        handSpreadRatio: Number(tracking.entryCandidate.handSpreadRatio.toFixed(2)),
        wristTravelRatio: Number(wristTravelRatio.toFixed(2)),
      },
    };

    this.setDebugStep("fired", frame.timestamp, candidate.side);
    this.reset();
    return event;
  }

  private analyzeFrame(frame: FrameContext): FrameAnalysis {
    const poseLandmarks = frame.motion.landmarks;
    const hands = frame.motion.hands ?? [];
    if (!poseLandmarks || hands.length === 0) {
      return { hasHeadLevelHand: false, entryCandidates: [], trackingCandidates: [] };
    }

    const headPoint = this.averageVisiblePoint(poseLandmarks, HEAD_LANDMARK_INDEXES);
    const bodyScale = this.estimateBodyScale(poseLandmarks);
    if (!headPoint || !bodyScale) {
      return { hasHeadLevelHand: false, entryCandidates: [], trackingCandidates: [] };
    }

    const allCandidates = hands.flatMap((hand) => {
      const candidate = this.createCandidate(hand, poseLandmarks, headPoint, bodyScale);
      return candidate ? [candidate] : [];
    });

    const entryCandidates = allCandidates.filter((candidate) => this.isSnapPose(candidate));

    return {
      hasHeadLevelHand: allCandidates.length > 0,
      entryCandidates,
      trackingCandidates: allCandidates,
    };
  }

  private createCandidate(
    hand: HandSample,
    poseLandmarks: PoseLandmark[],
    headPoint: Point2D,
    bodyScale: number,
  ): SnapCandidate | null {
    const wrist = hand.landmarks[HAND_WRIST];
    const indexMcp = hand.landmarks[INDEX_MCP];
    const pinkyMcp = hand.landmarks[PINKY_MCP];
    if (!wrist || !indexMcp || !pinkyMcp) {
      return null;
    }

    const handWrist = this.toPoint2D(wrist);
    const side = this.matchPoseSide(handWrist, poseLandmarks);
    if (!side) {
      return null;
    }

    const poseSpec = HAND_SPECS.find((spec) => spec.side === side);
    const poseElbow = poseSpec ? this.visiblePoseLandmark(poseLandmarks[poseSpec.elbowIndex]) : null;
    const poseWrist = poseSpec ? this.visiblePoseLandmark(poseLandmarks[poseSpec.wristIndex]) : null;
    if (!poseSpec || !poseElbow || !poseWrist) {
      return null;
    }

    const handCenter = this.averagePoint2D([handWrist, this.toPoint2D(indexMcp), this.toPoint2D(pinkyMcp)]);
    const headDistanceRatio = Math.abs(handCenter.y - headPoint.y) / bodyScale;
    if (headDistanceRatio > this.settings.maxHeadLevelDistanceRatio) {
      return null;
    }

    const forearmAxis = this.normalize3D(this.subtract3D(this.toPoint3D(poseWrist), this.toPoint3D(poseElbow)));
    const palmNormal = this.resolvePalmNormal(hand);
    if (!forearmAxis || !palmNormal) {
      return null;
    }

    const forearmLength = this.distance2D(this.toPoint2D(poseElbow), this.toPoint2D(poseWrist));
    if (forearmLength <= 0) {
      return null;
    }

    const fingerCurlRatio = this.resolveFingerCurlRatio(hand.landmarks, handWrist, forearmLength);
    const thumb = hand.landmarks[THUMB_TIP];
    const pinky = hand.landmarks[PINKY_TIP];
    const handSpreadRatio = thumb && pinky ? this.distance2D(this.toPoint2D(thumb), this.toPoint2D(pinky)) / forearmLength : 0;

    return {
      side,
      wrist: handWrist,
      forearmAxis,
      palmNormal,
      bodyScale,
      headDistanceRatio,
      fingerCurlRatio,
      handSpreadRatio,
      confidenceBase: this.resolvePoseConfidence(headDistanceRatio, fingerCurlRatio, handSpreadRatio),
    };
  }

  private isSnapPose(candidate: SnapCandidate): boolean {
    return (
      candidate.fingerCurlRatio >= this.settings.minFingerCurlRatio &&
      candidate.fingerCurlRatio <= this.settings.maxFingerCurlRatio &&
      candidate.handSpreadRatio >= this.settings.minHandSpreadRatio
    );
  }

  private selectEntryCandidate(candidates: SnapCandidate[]): SnapCandidate | null {
    if (candidates.length === 0) {
      return null;
    }

    return candidates.reduce((best, candidate) =>
      candidate.confidenceBase > best.confidenceBase ? candidate : best,
    );
  }

  private selectTrackingCandidate(candidates: SnapCandidate[]): SnapCandidate | null {
    if (!this.tracking) {
      return null;
    }

    return candidates.find((candidate) => candidate.side === this.tracking?.side) ?? null;
  }

  private startTracking(candidate: SnapCandidate, timestamp: number): void {
    this.tracking = {
      side: candidate.side,
      startedAt: timestamp,
      lastSeenAt: timestamp,
      armedAt: null,
      startWrist: candidate.wrist,
      baselinePalmNormal: null,
      forearmAxis: null,
      entryCandidate: candidate,
    };
  }

  private resetMissing(timestamp: number): boolean {
    if (!this.tracking) {
      return false;
    }

    if (timestamp - this.tracking.lastSeenAt > this.settings.maxTrackingGapMs) {
      this.reset();
      return true;
    }

    return false;
  }

  private restartFromEntryOrReset(
    analysis: FrameAnalysis,
    timestamp: number,
    preferredSide: HandSide,
  ): void {
    const entryCandidate =
      analysis.entryCandidates.find((candidate) => candidate.side === preferredSide) ??
      this.selectEntryCandidate(analysis.entryCandidates);

    if (entryCandidate) {
      this.startTracking(entryCandidate, timestamp);
      this.setDebugStep("ready", timestamp, entryCandidate.side);
      return;
    }

    this.reset();
    this.setDebugStep(analysis.hasHeadLevelHand ? "headLevel" : "idle", timestamp);
  }

  private resolvePalmNormal(hand: HandSample): Point3D | null {
    const wrist = hand.landmarks[HAND_WRIST];
    const indexMcp = hand.landmarks[INDEX_MCP];
    const pinkyMcp = hand.landmarks[PINKY_MCP];
    if (!wrist || !indexMcp || !pinkyMcp) {
      return null;
    }

    const fromWristToIndex = this.subtract3D(this.toPoint3D(indexMcp), this.toPoint3D(wrist));
    const fromWristToPinky = this.subtract3D(this.toPoint3D(pinkyMcp), this.toPoint3D(wrist));
    return this.normalize3D(this.cross3D(fromWristToIndex, fromWristToPinky));
  }

  private signedAngleAroundAxis(from: Point3D, to: Point3D, axis: Point3D): number {
    const projectedFrom = this.projectOntoPlane(from, axis);
    const projectedTo = this.projectOntoPlane(to, axis);
    if (!projectedFrom || !projectedTo) {
      return 0;
    }

    const cross = this.cross3D(projectedFrom, projectedTo);
    const sin = this.dot3D(axis, cross);
    const cos = this.dot3D(projectedFrom, projectedTo);
    return (Math.atan2(sin, cos) * 180) / Math.PI;
  }

  private projectOntoPlane(vector: Point3D, normal: Point3D): Point3D | null {
    const projected = this.subtract3D(vector, this.scale3D(normal, this.dot3D(vector, normal)));
    return this.normalize3D(projected);
  }

  private resolveFingerCurlRatio(landmarks: PoseLandmark[], wrist: Point2D, forearmLength: number): number {
    const tips = [THUMB_TIP, INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP]
      .map((index) => landmarks[index])
      .filter((landmark): landmark is PoseLandmark => Boolean(landmark));
    if (tips.length === 0) {
      return 0;
    }

    const averageTipDistance =
      tips.reduce((total, landmark) => total + this.distance2D(wrist, this.toPoint2D(landmark)), 0) /
      tips.length;
    return averageTipDistance / forearmLength;
  }

  private resolveConfidence(candidate: SnapCandidate, wristTravelRatio: number, twistAngleDeg: number): number {
    const twistConfidence = Math.min(twistAngleDeg / Math.max(this.settings.twistFireAngleDeg, 1), 1);
    const wristConfidence = 1 - wristTravelRatio / Math.max(this.settings.maxWristTravelRatio, 0.01);
    const raw =
      candidate.confidenceBase * 0.45 +
      Math.max(0, wristConfidence) * 0.2 +
      twistConfidence * 0.35;

    return Math.max(this.settings.minConfidence, Math.min(1, raw));
  }

  private resolvePoseConfidence(
    headDistanceRatio: number,
    fingerCurlRatio: number,
    handSpreadRatio: number,
  ): number {
    const headConfidence =
      1 - headDistanceRatio / Math.max(this.settings.maxHeadLevelDistanceRatio, 0.01);
    const curlConfidence = this.rangeConfidence(
      fingerCurlRatio,
      this.settings.minFingerCurlRatio,
      this.settings.maxFingerCurlRatio,
    );
    const spreadConfidence = Math.min(handSpreadRatio / Math.max(this.settings.minHandSpreadRatio * 2, 0.01), 1);

    return Math.max(0, Math.min(1, headConfidence * 0.4 + curlConfidence * 0.45 + spreadConfidence * 0.15));
  }

  private rangeConfidence(value: number, min: number, max: number): number {
    const center = (min + max) / 2;
    const radius = Math.max((max - min) / 2, 0.01);
    return Math.max(0, Math.min(1, 1 - Math.abs(value - center) / radius));
  }

  private matchPoseSide(handWrist: Point2D, landmarks: PoseLandmark[]): HandSide | null {
    const candidates = HAND_SPECS.flatMap((spec) => {
      const wrist = this.visiblePoseLandmark(landmarks[spec.wristIndex]);
      return wrist ? [{ side: spec.side, distance: this.distance2D(handWrist, this.toPoint2D(wrist)) }] : [];
    });
    if (candidates.length === 0) {
      return null;
    }

    return candidates.reduce((best, candidate) => (candidate.distance < best.distance ? candidate : best)).side;
  }

  private averageVisiblePoint(landmarks: PoseLandmark[], indexes: number[]): Point2D | null {
    const points = indexes
      .map((index) => this.visiblePoseLandmark(landmarks[index]))
      .filter((landmark): landmark is PoseLandmark => Boolean(landmark))
      .map((landmark) => this.toPoint2D(landmark));

    return points.length > 0 ? this.averagePoint2D(points) : null;
  }

  private visiblePoseLandmark(landmark: PoseLandmark | undefined): PoseLandmark | null {
    if (!landmark || (landmark.visibility ?? 1) < this.settings.minVisibility) {
      return null;
    }

    return landmark;
  }

  private estimateBodyScale(landmarks: PoseLandmark[]): number | undefined {
    const leftShoulder = this.visiblePoseLandmark(landmarks[11]);
    const rightShoulder = this.visiblePoseLandmark(landmarks[12]);
    const leftHip = this.visiblePoseLandmark(landmarks[23]);
    const rightHip = this.visiblePoseLandmark(landmarks[24]);
    const candidates: number[] = [];

    if (leftShoulder && rightShoulder) {
      candidates.push(this.distance2D(this.toPoint2D(leftShoulder), this.toPoint2D(rightShoulder)));
    }

    if (leftShoulder && rightShoulder && leftHip && rightHip) {
      const shoulderCenter = this.averagePoint2D([this.toPoint2D(leftShoulder), this.toPoint2D(rightShoulder)]);
      const hipCenter = this.averagePoint2D([this.toPoint2D(leftHip), this.toPoint2D(rightHip)]);
      candidates.push(this.distance2D(shoulderCenter, hipCenter));
    }

    for (const hand of HAND_SPECS) {
      const elbow = this.visiblePoseLandmark(landmarks[hand.elbowIndex]);
      const wrist = this.visiblePoseLandmark(landmarks[hand.wristIndex]);
      if (elbow && wrist) {
        candidates.push(this.distance2D(this.toPoint2D(elbow), this.toPoint2D(wrist)) * 2);
      }
    }

    return candidates.length > 0 ? Math.max(...candidates) : undefined;
  }

  private averagePoint2D(points: Point2D[]): Point2D {
    const sum = points.reduce(
      (total, point) => ({
        x: total.x + point.x,
        y: total.y + point.y,
      }),
      { x: 0, y: 0 },
    );

    return {
      x: sum.x / points.length,
      y: sum.y / points.length,
    };
  }

  private toPoint2D(landmark: PoseLandmark): Point2D {
    return {
      x: landmark.x,
      y: landmark.y,
    };
  }

  private toPoint3D(landmark: PoseLandmark): Point3D {
    return {
      x: landmark.x,
      y: landmark.y,
      z: landmark.z ?? 0,
    };
  }

  private distance2D(a: Point2D, b: Point2D): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private subtract3D(a: Point3D, b: Point3D): Point3D {
    return {
      x: a.x - b.x,
      y: a.y - b.y,
      z: a.z - b.z,
    };
  }

  private scale3D(vector: Point3D, scale: number): Point3D {
    return {
      x: vector.x * scale,
      y: vector.y * scale,
      z: vector.z * scale,
    };
  }

  private dot3D(a: Point3D, b: Point3D): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  private cross3D(a: Point3D, b: Point3D): Point3D {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    };
  }

  private normalize3D(vector: Point3D): Point3D | null {
    const length = Math.hypot(vector.x, vector.y, vector.z);
    if (length < 0.000001) {
      return null;
    }

    return {
      x: vector.x / length,
      y: vector.y / length,
      z: vector.z / length,
    };
  }

  private setDebugStep(step: SnapTwistStep, updatedAt: number, hand?: HandSide): void {
    this.debugState = { step, updatedAt, hand };
  }
}

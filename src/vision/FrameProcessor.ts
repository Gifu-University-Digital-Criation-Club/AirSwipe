import { FilesetResolver, HandLandmarker, PoseLandmarker } from "@mediapipe/tasks-vision";
import type { FrameContext, HandSample, MotionSample, Point2D, Point3D, PoseLandmark } from "../types";

const PROCESS_WIDTH = 320;
const PROCESS_HEIGHT = 240;
const MIN_VISIBILITY = 0.35;

const ARM_JOINTS = [
  { name: "right fingertip from elbow", shoulderIndex: 12, elbowIndex: 14, wristIndex: 16, tipIndex: 20 },
] as const;

const POSE_CONNECTIONS: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 7],
  [0, 4],
  [4, 5],
  [5, 6],
  [6, 8],
  [9, 10],
  [11, 12],
  [11, 13],
  [13, 15],
  [15, 17],
  [15, 19],
  [15, 21],
  [17, 19],
  [12, 14],
  [14, 16],
  [16, 18],
  [16, 20],
  [16, 22],
  [18, 20],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [27, 29],
  [29, 31],
  [27, 31],
  [24, 26],
  [26, 28],
  [28, 30],
  [30, 32],
  [28, 32],
];

type PoseLandmarkerInstance = Awaited<ReturnType<typeof PoseLandmarker.createFromOptions>>;
type HandLandmarkerInstance = Awaited<ReturnType<typeof HandLandmarker.createFromOptions>>;

export class FrameProcessor {
  private readonly video: HTMLVideoElement;
  private readonly debugCanvas: HTMLCanvasElement;
  private readonly debugContext: CanvasRenderingContext2D;
  private poseLandmarker: PoseLandmarkerInstance | null = null;
  private handLandmarker: HandLandmarkerInstance | null = null;
  private previousJointPositions = new Map<number, Point2D>();

  constructor(video: HTMLVideoElement, debugCanvasId: string) {
    this.video = video;

    const debugCanvas = document.getElementById(debugCanvasId);
    if (!(debugCanvas instanceof HTMLCanvasElement)) {
      throw new Error("デバッグCanvasが見つかりません。");
    }
    this.debugCanvas = debugCanvas;

    const debugContext = debugCanvas.getContext("2d", { willReadFrequently: true });
    if (!debugContext) {
      throw new Error("デバッグCanvas 2D contextを作成できませんでした。");
    }
    this.debugContext = debugContext;
  }

  async init(): Promise<void> {
    this.release();
    this.debugCanvas.width = PROCESS_WIDTH;
    this.debugCanvas.height = PROCESS_HEIGHT;

    const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
    [this.poseLandmarker, this.handLandmarker] = await Promise.all([
      PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "/mediapipe/models/pose_landmarker_lite.task",
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.4,
        minPosePresenceConfidence: 0.4,
        minTrackingConfidence: 0.4,
      }),
      HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "/mediapipe/models/hand_landmarker.task",
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.45,
        minHandPresenceConfidence: 0.45,
        minTrackingConfidence: 0.45,
      }),
    ]);
  }

  process(timestamp: number, drawDebug: boolean): FrameContext | null {
    if (
      !this.poseLandmarker ||
      !this.handLandmarker ||
      this.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
    ) {
      return null;
    }

    const frame = this.captureFrame();
    const poseResult = this.poseLandmarker.detectForVideo(this.video, timestamp);
    const handResult = this.handLandmarker.detectForVideo(this.video, timestamp);
    const landmarks = poseResult.landmarks[0] as PoseLandmark[] | undefined;
    const hands = this.buildHands(handResult);
    const motion = this.buildMotion(landmarks, timestamp, hands);

    if (drawDebug) {
      this.drawDebug(frame, landmarks, hands, motion.centroid, motion.relativeBase);
    }

    return {
      frame,
      timestamp,
      width: PROCESS_WIDTH,
      height: PROCESS_HEIGHT,
      motion,
    };
  }

  release(): void {
    this.poseLandmarker?.close();
    this.handLandmarker?.close();
    this.poseLandmarker = null;
    this.handLandmarker = null;
    this.previousJointPositions.clear();
    this.debugContext.clearRect(0, 0, this.debugCanvas.width, this.debugCanvas.height);
  }

  private buildMotion(
    landmarks: PoseLandmark[] | undefined,
    timestamp: number,
    hands: HandSample[],
  ): MotionSample {
    if (!landmarks) {
      return this.emptyMotion(timestamp, undefined, hands);
    }

    let selected: {
      name: string;
      point: Point2D;
      base: Point2D;
      relativePoint: Point2D;
      movement: number;
      bodyScalePx: number | undefined;
    } | null = null;

    const bodyScalePx = this.estimateBodyScalePx(landmarks);

    for (let jointIndex = 0; jointIndex < ARM_JOINTS.length; jointIndex += 1) {
      const joint = ARM_JOINTS[jointIndex];
      const tip = landmarks[joint.tipIndex];
      const wrist = landmarks[joint.wristIndex];
      const elbow = landmarks[joint.elbowIndex];
      if (!this.isVisible(elbow) || (!this.isVisible(tip) && !this.isVisible(wrist))) {
        continue;
      }

      const fingertipPoint = this.toPixelPoint(this.isVisible(tip) ? tip : wrist);
      const elbowPoint = this.toPixelPoint(elbow);
      const relativePoint = {
        x: fingertipPoint.x - elbowPoint.x,
        y: fingertipPoint.y - elbowPoint.y,
      };
      const previous = this.previousJointPositions.get(jointIndex);
      const movement = previous
        ? Math.hypot(relativePoint.x - previous.x, relativePoint.y - previous.y)
        : 0;
      this.previousJointPositions.set(jointIndex, relativePoint);

      if (!selected || movement > selected.movement) {
        selected = {
          name: joint.name,
          point: fingertipPoint,
          base: elbowPoint,
          relativePoint,
          movement,
          bodyScalePx: bodyScalePx ?? this.estimateArmScalePx(landmarks, joint),
        };
      }
    }

    if (!selected) {
      return this.emptyMotion(timestamp, landmarks, hands);
    }

    return {
      centroid: selected.point,
      timestamp,
      width: PROCESS_WIDTH,
      height: PROCESS_HEIGHT,
      landmarks,
      hands,
      activeJoint: selected.name,
      relativePoint: selected.relativePoint,
      relativeBase: selected.base,
      bodyScalePx: selected.bodyScalePx,
    };
  }

  private buildHands(result: ReturnType<HandLandmarkerInstance["detectForVideo"]>): HandSample[] {
    return result.landmarks.map((landmarks, index) => {
      const handedness = result.handedness[index]?.[0];
      return {
        landmarks: landmarks as PoseLandmark[],
        worldLandmarks: result.worldLandmarks[index] as Point3D[] | undefined,
        handedness: handedness?.categoryName,
        handednessScore: handedness?.score,
      };
    });
  }

  private emptyMotion(timestamp: number, landmarks?: PoseLandmark[], hands: HandSample[] = []): MotionSample {
    return {
      centroid: null,
      timestamp,
      width: PROCESS_WIDTH,
      height: PROCESS_HEIGHT,
      landmarks,
      hands,
    };
  }

  private captureFrame(): ImageData {
    this.debugContext.drawImage(this.video, 0, 0, PROCESS_WIDTH, PROCESS_HEIGHT);
    return this.debugContext.getImageData(0, 0, PROCESS_WIDTH, PROCESS_HEIGHT);
  }

  private drawDebug(
    imageData: ImageData,
    landmarks: PoseLandmark[] | undefined,
    hands: HandSample[],
    activePoint: Point2D | null,
    activeBase: Point2D | undefined,
  ): void {
    this.debugContext.putImageData(imageData, 0, 0);

    if (!landmarks) {
      this.drawHandsDebug(hands);
      return;
    }

    this.debugContext.lineWidth = 3;
    this.debugContext.lineCap = "round";

    for (const [from, to] of POSE_CONNECTIONS) {
      const start = landmarks[from];
      const end = landmarks[to];
      if (!this.isVisible(start) || !this.isVisible(end)) {
        continue;
      }

      this.debugContext.beginPath();
      this.debugContext.moveTo(start.x * PROCESS_WIDTH, start.y * PROCESS_HEIGHT);
      this.debugContext.lineTo(end.x * PROCESS_WIDTH, end.y * PROCESS_HEIGHT);
      this.debugContext.strokeStyle = this.isArmConnection(from, to) ? "#18a0fb" : "#22c55e";
      this.debugContext.stroke();
    }

    for (let i = 0; i < landmarks.length; i += 1) {
      const landmark = landmarks[i];
      if (!this.isVisible(landmark)) {
        continue;
      }

      const radius = ARM_JOINTS.some(
        (joint) => joint.tipIndex === i || joint.wristIndex === i || joint.elbowIndex === i,
      )
        ? 5
        : 3;
      this.debugContext.beginPath();
      this.debugContext.arc(landmark.x * PROCESS_WIDTH, landmark.y * PROCESS_HEIGHT, radius, 0, Math.PI * 2);
      this.debugContext.fillStyle = radius === 5 ? "#ff5838" : "#fef3c7";
      this.debugContext.fill();
    }

    this.drawHandsDebug(hands);

    if (activePoint) {
      if (activeBase) {
        this.debugContext.beginPath();
        this.debugContext.moveTo(activeBase.x, activeBase.y);
        this.debugContext.lineTo(activePoint.x, activePoint.y);
        this.debugContext.lineWidth = 4;
        this.debugContext.strokeStyle = "#f97316";
        this.debugContext.stroke();
      }

      this.debugContext.beginPath();
      this.debugContext.arc(activePoint.x, activePoint.y, 12, 0, Math.PI * 2);
      this.debugContext.lineWidth = 3;
      this.debugContext.strokeStyle = "#ff5838";
      this.debugContext.stroke();
    }
  }

  private drawHandsDebug(hands: HandSample[]): void {
    this.debugContext.lineWidth = 2;
    this.debugContext.lineCap = "round";

    for (const hand of hands) {
      for (const { start, end } of HandLandmarker.HAND_CONNECTIONS) {
        const from = hand.landmarks[start];
        const to = hand.landmarks[end];
        if (!from || !to) {
          continue;
        }

        this.debugContext.beginPath();
        this.debugContext.moveTo(from.x * PROCESS_WIDTH, from.y * PROCESS_HEIGHT);
        this.debugContext.lineTo(to.x * PROCESS_WIDTH, to.y * PROCESS_HEIGHT);
        this.debugContext.strokeStyle = "#a855f7";
        this.debugContext.stroke();
      }

      for (const landmark of hand.landmarks) {
        this.debugContext.beginPath();
        this.debugContext.arc(landmark.x * PROCESS_WIDTH, landmark.y * PROCESS_HEIGHT, 2.5, 0, Math.PI * 2);
        this.debugContext.fillStyle = "#f0abfc";
        this.debugContext.fill();
      }
    }
  }

  private isVisible(landmark: PoseLandmark | undefined): landmark is PoseLandmark {
    return Boolean(landmark && (landmark.visibility ?? 1) >= MIN_VISIBILITY);
  }

  private toPixelPoint(landmark: PoseLandmark): Point2D {
    return {
      x: landmark.x * PROCESS_WIDTH,
      y: landmark.y * PROCESS_HEIGHT,
    };
  }

  private estimateBodyScalePx(landmarks: PoseLandmark[]): number | undefined {
    const leftShoulder = this.visiblePoint(landmarks[11]);
    const rightShoulder = this.visiblePoint(landmarks[12]);
    const leftHip = this.visiblePoint(landmarks[23]);
    const rightHip = this.visiblePoint(landmarks[24]);
    const candidates: number[] = [];

    if (leftShoulder && rightShoulder) {
      candidates.push(this.distance(leftShoulder, rightShoulder));
    }

    if (leftShoulder && rightShoulder && leftHip && rightHip) {
      const shoulderCenter = this.midpoint(leftShoulder, rightShoulder);
      const hipCenter = this.midpoint(leftHip, rightHip);
      candidates.push(this.distance(shoulderCenter, hipCenter));
    }

    for (const joint of ARM_JOINTS) {
      const armScalePx = this.estimateArmScalePx(landmarks, joint);
      if (armScalePx) {
        candidates.push(armScalePx);
      }
    }

    if (candidates.length === 0) {
      return undefined;
    }

    return Math.max(...candidates);
  }

  private estimateArmScalePx(
    landmarks: PoseLandmark[],
    joint: (typeof ARM_JOINTS)[number],
  ): number | undefined {
    const shoulder = this.visiblePoint(landmarks[joint.shoulderIndex]);
    const elbow = this.visiblePoint(landmarks[joint.elbowIndex]);
    const wrist = this.visiblePoint(landmarks[joint.wristIndex]);
    const candidates: number[] = [];

    if (shoulder && elbow) {
      candidates.push(this.distance(shoulder, elbow) * 2);
    }
    if (elbow && wrist) {
      candidates.push(this.distance(elbow, wrist) * 2);
    }

    if (candidates.length === 0) {
      return undefined;
    }

    return Math.max(...candidates);
  }

  private visiblePoint(landmark: PoseLandmark | undefined): Point2D | null {
    return this.isVisible(landmark) ? this.toPixelPoint(landmark) : null;
  }

  private distance(a: Point2D, b: Point2D): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private midpoint(a: Point2D, b: Point2D): Point2D {
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
    };
  }

  private isArmConnection(from: number, to: number): boolean {
    const armIndexes = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
    return armIndexes.includes(from) || armIndexes.includes(to);
  }
}

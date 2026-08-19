import type { AppSettings } from "../types";

export class CameraService {
  private stream: MediaStream | null = null;

  async start(video: HTMLVideoElement, settings: AppSettings["camera"]): Promise<void> {
    this.stop();

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("このブラウザはWebカメラ取得に対応していません。");
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: settings.width },
        height: { ideal: settings.height },
        frameRate: { ideal: settings.fps },
        facingMode: "user",
      },
      audio: false,
    });

    video.srcObject = this.stream;
    await video.play();
  }

  stop(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }

  isRunning(): boolean {
    return this.stream !== null;
  }

  getVideoSettings(): MediaTrackSettings | null {
    return this.stream?.getVideoTracks()[0]?.getSettings() ?? null;
  }
}

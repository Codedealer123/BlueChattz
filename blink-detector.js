// blink-detector.js
import * as tf from "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-core";
import "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-webgl";
import * as flds from "https://cdn.jsdelivr.net/npm/@tensorflow-models/face-landmarks-detection";

export class BlinkDetector {
  constructor(opts = {}) {
    this.video = document.createElement("video");
    this.video.autoplay = true;
    this.video.playsInline = true;
    this.video.muted = true;

    this.detector = null;
    this.running = false;

    this.eyesClosed = false;
    this.closedStart = 0;

    // thresholds (can be tuned or auto-calibrated later)
    this.closeThresh = opts.closeThresh || 0.18;
    this.openThresh  = opts.openThresh  || 0.22;

    this.minBlinkMs  = opts.minBlinkMs  || 50; // ignore microblinks
  }

  async init() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" }
    });
    this.video.srcObject = stream;

    await new Promise(res => { this.video.onloadedmetadata = () => res(); });

    await tf.setBackend("webgl");
    await tf.ready();

    this.detector = await flds.createDetector(flds.SupportedModels.MediaPipeFaceMesh, {
      runtime: "tfjs",
      refineLandmarks: true,
      maxFaces: 1
    });
  }

  dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  computeEAR(lm, side) {
    let H, V1, V2;
    if (side === "left") {
      H = [lm[33], lm[133]];
      V1 = [lm[159], lm[145]];
      V2 = [lm[160], lm[144]];
    } else {
      H = [lm[362], lm[263]];
      V1 = [lm[386], lm[374]];
      V2 = [lm[385], lm[373]];
    }
    const horiz = this.dist(H[0], H[1]);
    const vert = (this.dist(V1[0], V1[1]) + this.dist(V2[0], V2[1])) / 2;
    return vert / (horiz || 1e-6);
  }

  async loop() {
    if (!this.running) return;

    const faces = await this.detector.estimateFaces(this.video, { flipHorizontal: true });

    if (faces.length > 0) {
      const lm = faces[0].keypoints;
      const leftEAR = this.computeEAR(lm, "left");
      const rightEAR = this.computeEAR(lm, "right");
      const ear = (leftEAR + rightEAR) / 2;

      const now = performance.now();

      if (!this.eyesClosed && ear < this.closeThresh) {
        this.eyesClosed = true;
        this.closedStart = now;
        window.dispatchEvent(new CustomEvent("eyeclose", { detail: { timestamp: now } }));
      }

      if (this.eyesClosed && ear > this.openThresh) {
        this.eyesClosed = false;
        const duration = now - this.closedStart;
        window.dispatchEvent(new CustomEvent("eyeopen", { detail: { timestamp: now } }));

        if (duration > this.minBlinkMs) {
          window.dispatchEvent(new CustomEvent("blink", {
            detail: {
              duration: Math.round(duration),
              timestamp: now
            }
          }));
        }
      }
    }

    requestAnimationFrame(() => this.loop());
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.loop();
  }

  stop() {
    this.running = false;
  }
}

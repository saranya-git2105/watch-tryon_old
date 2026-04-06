import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from "@mediapipe/tasks-vision";

let handLandmarker: HandLandmarker | null = null;
let currentMode: "VIDEO" | "IMAGE" = "VIDEO";

export async function getHandLandmarker(mode: "VIDEO" | "IMAGE" = "VIDEO") {
  if (handLandmarker && currentMode === mode) return handLandmarker;

  // Re-initialize if mode changed
  if (handLandmarker) {
    await handLandmarker.close();
    handLandmarker = null;
  }
  
  currentMode = mode;
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  );

  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
      delegate: "GPU",
    },
    runningMode: mode,
    numHands: 1,
  });

  return handLandmarker;
}

export async function detectHandsFromVideo(
  video: HTMLVideoElement,
  timestamp: number
): Promise<HandLandmarkerResult | null> {
  if (!handLandmarker) return null;

  return handLandmarker.detectForVideo(video, timestamp);
}
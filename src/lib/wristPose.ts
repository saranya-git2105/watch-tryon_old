export type Landmark = {
  x: number;
  y: number;
  z: number;
};

export type Vec3 = {
  x: number;
  y: number;
  z: number;
};

export type WristPose = {
  wrist: Landmark;
  indexBase: Landmark;
  middleBase: Landmark;
  pinkyBase: Landmark;
  palmMid: Landmark;
  watchCenter: Landmark;
  wristWidth: number;
  wristAxis: Vec3;
  forearmAxis: Vec3;
  surfaceNormal: Vec3;
  rotationAngleRad: number;
  rotationAngleDeg: number;
};

/** Index-base to pinky-base span treated as this physical width (mm). */
export const REFERENCE_WRIST_WIDTH_MM = 50;

/** Default case width when product metadata has no case size (mm). */
export const DEFAULT_WATCH_CASE_MM = 40;

/**
 * Nudge from the wrist joint toward the forearm (fraction of index–pinky span).
 * Higher = closer to the wrist crease / away from the knuckles.
 */
export const WRIST_FOREARM_OFFSET = 0.32;

/**
 * Depth offset along the wrist surface normal (fraction of span).
 * Positive = toward the camera (sits “on top” of the wrist).
 */
export const WRIST_DEPTH_OFFSET = 0.22;

/**
 * Scale the watch plane so the visible face matches case size on a 50 mm reference wrist.
 * @param detectedWristSpanWorld - index–pinky span in Three.js world units at the photo plane
 * @param contentWidthFraction - fraction of the product image that is the watch face
 * @param watchCaseMm - physical case width in mm (defaults to 40 mm)
 */
export function computeWatchScale(
  detectedWristSpanWorld: number,
  contentWidthFraction: number,
  watchCaseMm: number = DEFAULT_WATCH_CASE_MM,
): number {
  const faceFractionOfWrist = watchCaseMm / REFERENCE_WRIST_WIDTH_MM;
  return (detectedWristSpanWorld * faceFractionOfWrist) / contentWidthFraction;
}

function midpoint(a: Landmark, b: Landmark): Landmark {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
  };
}

function distance3D(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return {
    x: v.x / len,
    y: v.y / len,
    z: v.z / len,
  };
}

function subtract(a: Landmark | Vec3, b: Landmark | Vec3): Vec3 {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z,
  };
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function calculateWristPose(landmarks: Landmark[]): WristPose | null {
  if (!landmarks || landmarks.length < 18) return null;

  const wrist = landmarks[0];
  const indexBase = landmarks[5];
  const middleBase = landmarks[9];
  const pinkyBase = landmarks[17];

  const palmMid = midpoint(indexBase, pinkyBase);

  // Across the wrist
  const wristAxis = normalize(subtract(indexBase, pinkyBase));

  // Down the forearm
  const forearmAxis = normalize(subtract(wrist, palmMid));

  // Approximate outward wrist surface normal
  const surfaceNormal = normalize(cross(wristAxis, forearmAxis));

  const wristWidth = distance3D(indexBase, pinkyBase);

  // Anchor on the wrist joint, nudged toward the forearm (away from knuckles)
  const watchCenter: Landmark = {
    x: wrist.x + forearmAxis.x * wristWidth * WRIST_FOREARM_OFFSET,
    y: wrist.y + forearmAxis.y * wristWidth * WRIST_FOREARM_OFFSET,
    z: wrist.z + forearmAxis.z * wristWidth * WRIST_FOREARM_OFFSET,
  };

  const rotationAngleRad = Math.atan2(wristAxis.y, wristAxis.x);
  const rotationAngleDeg = (rotationAngleRad * 180) / Math.PI;

  return {
    wrist,
    indexBase,
    middleBase,
    pinkyBase,
    palmMid,
    watchCenter,
    wristWidth,
    wristAxis,
    forearmAxis,
    surfaceNormal,
    rotationAngleRad,
    rotationAngleDeg,
  };
}
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

  // Move from wrist slightly toward forearm so the watch sits on the wrist band area
  const watchOffset = wristWidth * 0.12;

  const watchCenter: Landmark = {
    x: wrist.x + forearmAxis.x * watchOffset,
    y: wrist.y + forearmAxis.y * watchOffset,
    z: wrist.z + forearmAxis.z * watchOffset,
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
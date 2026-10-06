type Point = [number, number];
type Spring = { x: number; v: number; t: number };
type Pose = { turn: number; tilt: number; roll: number; scale?: number };
export const geometry: {
  Re: number; G9e: number; VJt: number;
  eyes: Point[][][];
  shapes: { blob: { path: string; face: Record<string, number>; top: number; bottom: number } };
};
export const math: {
  spring(value: number): Spring;
  stepSpring(spring: Spring, frequency: number, damping: number, dt: number): void;
  springSteps(dt: number): number;
  clamp(value: number, min: number, max: number): number;
  rand(min: number, max: number): number;
  lerpPoly(a: Point[], b: Point[], t: number): Point[];
  relRot(pose: Pose, home: Pose): number[];
};
export const tables: {
  EYE_PLAYLIST: Record<string, number[]>;
  EYE_HOLD_MS: Record<string, [number, number]>;
  FACE_TUNE: Record<string, number>;
  POSE: Pose; POSE_HOME: Pose;
};
export const poses: {
  applyPose(state: string, time: number, elapsed: number, now: number, context: Record<string, number | boolean>, extra?: Record<string, number>): { spin: number; tx: number; ty: number; squash: number; lid: number; eyeBoost: number };
  nextGaze(state: string): { x: number; y: number; hold: [number, number] };
};
export const eyes: { paintEyes(options: Record<string, unknown>): void };

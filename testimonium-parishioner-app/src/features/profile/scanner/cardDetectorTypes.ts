export type AlignmentState =
  | "NO_CARD"
  | "MISALIGNED"
  | "ALIGNING"
  | "READY"
  | "CAPTURING";

export type MisalignmentReason =
  | "NO_CARD"
  | "TOO_SMALL"
  | "TOO_LARGE"
  | "ROTATED"
  | "OFF_CENTER"
  | "OUT_OF_BOUNDS"
  | "WRONG_ASPECT_RATIO";

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CardQuad {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

export interface CardDetection {
  detected: boolean;
  quad?: CardQuad;
  bounds?: Rect;
  confidence?: number;
}

export interface AlignmentEvaluation {
  state: AlignmentState;
  isReady: boolean;
  guidanceText: string;
  reason?: MisalignmentReason;
  aspectRatio?: number;
  areaRatio?: number;
  containmentRatio?: number;
  rotationDeg?: number;
  centerOffset?: Point;
}

export interface DetectorOptions {
  /**
   * Continuous stability hold duration required before auto-capture triggers (in ms).
   * Default: 750 ms (in canonical 500-1000ms range).
   */
  stabilityDurationMs?: number;

  /**
   * Time a transient bad detector result may persist after READY before READY is
   * cancelled. Default: 275 ms.
   */
  readyGraceDurationMs?: number;

  /** Minimum card area as a fraction of target frame area. Default: 0.55 */
  minAreaRatio?: number;

  /** Maximum card area as a fraction of target frame area. Default: 1.45 */
  maxAreaRatio?: number;

  /** Minimum acceptable aspect ratio (width/height). Default: 1.30 */
  minAspectRatio?: number;

  /** Maximum acceptable aspect ratio (width/height). Default: 1.85 */
  maxAspectRatio?: number;

  /** Maximum allowed rotation/skew angle in degrees. Default: 12 degrees */
  maxRotationDeg?: number;

  /** Minimum detected-card area contained by the guide. Default: 0.88 (88%) */
  minContainmentRatio?: number;

  /**
   * Readiness-only expansion around the visible guide, as a fraction of each
   * guide dimension. The final image crop is unaffected. Default: 0.05 (5%).
   */
  readinessToleranceRatio?: number;

  /** Maximum corner point movement between frames to be considered stable. Default: 20px */
  movementThreshold?: number;
}

import type {
  AlignmentEvaluation,
  CardDetection,
  CardQuad,
  DetectorOptions,
  Point,
  Rect,
} from "./cardDetectorTypes";

const DEFAULT_OPTIONS: Required<DetectorOptions> = {
  stabilityDurationMs: 750,
  readyGraceDurationMs: 275,
  minAreaRatio: 0.55,
  maxAreaRatio: 1.45,
  minAspectRatio: 1.3,
  maxAspectRatio: 1.85,
  maxRotationDeg: 12,
  minContainmentRatio: 0.88,
  readinessToleranceRatio: 0.05,
  movementThreshold: 20,
};

function dist(p1: Point, p2: Point): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

function polygonArea(points: Point[]): number {
  if (points.length < 3) return 0;
  return Math.abs(
    points.reduce((sum, point, index) => {
      const next = points[(index + 1) % points.length];
      return sum + point.x * next.y - next.x * point.y;
    }, 0) / 2
  );
}

function clipPolygon(
  points: Point[],
  isInside: (point: Point) => boolean,
  intersection: (start: Point, end: Point) => Point
): Point[] {
  if (points.length === 0) return [];
  const result: Point[] = [];
  let start = points[points.length - 1];

  for (const end of points) {
    const startInside = isInside(start);
    const endInside = isInside(end);
    if (endInside) {
      if (!startInside) result.push(intersection(start, end));
      result.push(end);
    } else if (startInside) {
      result.push(intersection(start, end));
    }
    start = end;
  }
  return result;
}

function containedArea(points: Point[], region: Rect): number {
  const left = region.x;
  const right = region.x + region.width;
  const top = region.y;
  const bottom = region.y + region.height;
  const atX = (start: Point, end: Point, x: number): Point => {
    const fraction = (x - start.x) / (end.x - start.x);
    return { x, y: start.y + fraction * (end.y - start.y) };
  };
  const atY = (start: Point, end: Point, y: number): Point => {
    const fraction = (y - start.y) / (end.y - start.y);
    return { x: start.x + fraction * (end.x - start.x), y };
  };

  let clipped = clipPolygon(points, (point) => point.x >= left, (start, end) =>
    atX(start, end, left)
  );
  clipped = clipPolygon(clipped, (point) => point.x <= right, (start, end) =>
    atX(start, end, right)
  );
  clipped = clipPolygon(clipped, (point) => point.y >= top, (start, end) =>
    atY(start, end, top)
  );
  clipped = clipPolygon(clipped, (point) => point.y <= bottom, (start, end) =>
    atY(start, end, bottom)
  );
  return polygonArea(clipped);
}

function calculateQuadMetrics(quad: CardQuad) {
  const topWidth = dist(quad.topLeft, quad.topRight);
  const bottomWidth = dist(quad.bottomLeft, quad.bottomRight);
  const leftHeight = dist(quad.topLeft, quad.bottomLeft);
  const rightHeight = dist(quad.topRight, quad.bottomRight);
  const width = (topWidth + bottomWidth) / 2;
  const height = (leftHeight + rightHeight) / 2;
  const corners = [quad.topLeft, quad.topRight, quad.bottomRight, quad.bottomLeft];
  const angleRad = Math.atan2(
    quad.topRight.y - quad.topLeft.y,
    quad.topRight.x - quad.topLeft.x
  );
  let rotationDeg = angleRad * (180 / Math.PI);
  if (rotationDeg > 90) rotationDeg -= 180;
  if (rotationDeg < -90) rotationDeg += 180;

  return {
    aspectRatio: height > 0 ? width / height : 0,
    rotationDeg,
    center: {
      x: corners.reduce((sum, point) => sum + point.x, 0) / corners.length,
      y: corners.reduce((sum, point) => sum + point.y, 0) / corners.length,
    },
    corners,
  };
}

function calculateBoundsMetrics(bounds: Rect) {
  const corners: Point[] = [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ];
  return {
    aspectRatio: bounds.height > 0 ? bounds.width / bounds.height : 0,
    rotationDeg: 0,
    center: {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    },
    corners,
  };
}

function expandRegion(region: Rect, toleranceRatio: number): Rect {
  const horizontalTolerance = region.width * toleranceRatio;
  const verticalTolerance = region.height * toleranceRatio;
  return {
    x: region.x - horizontalTolerance,
    y: region.y - verticalTolerance,
    width: region.width + horizontalTolerance * 2,
    height: region.height + verticalTolerance * 2,
  };
}

/**
 * Evaluates whether a plausible physical document is readable and safely framed.
 * The detector establishes document plausibility; the guide is a tolerant safe
 * capture region, not a corner-to-corner geometric template.
 */
export function evaluateCardAlignment(
  detection: CardDetection | null | undefined,
  targetRegion: Rect,
  customOptions?: DetectorOptions
): AlignmentEvaluation {
  const options = { ...DEFAULT_OPTIONS, ...customOptions };

  if (!detection?.detected) {
    return {
      state: "NO_CARD",
      isReady: false,
      guidanceText: "Place your ID inside the frame",
      reason: "NO_CARD",
    };
  }

  const metrics = detection.quad
    ? calculateQuadMetrics(detection.quad)
    : detection.bounds
      ? calculateBoundsMetrics(detection.bounds)
      : null;
  if (!metrics) {
    return {
      state: "NO_CARD",
      isReady: false,
      guidanceText: "Place your ID inside the frame",
      reason: "NO_CARD",
    };
  }

  const { aspectRatio, rotationDeg, center, corners } = metrics;
  const cardArea = polygonArea(corners);
  const targetArea = targetRegion.width * targetRegion.height;
  const areaRatio = targetArea > 0 ? cardArea / targetArea : 0;
  const readinessRegion = expandRegion(targetRegion, options.readinessToleranceRatio);
  const containmentRatio = cardArea > 0
    ? containedArea(corners, readinessRegion) / cardArea
    : 0;
  const targetCenter = {
    x: targetRegion.x + targetRegion.width / 2,
    y: targetRegion.y + targetRegion.height / 2,
  };
  const centerOffset = {
    x: center.x - targetCenter.x,
    y: center.y - targetCenter.y,
  };
  const resultMetrics = {
    aspectRatio,
    areaRatio,
    containmentRatio,
    rotationDeg,
    centerOffset,
  };

  if (aspectRatio < 1.15) {
    return {
      state: "MISALIGNED",
      isReady: false,
      guidanceText: "Align your ID in landscape",
      reason: "WRONG_ASPECT_RATIO",
      ...resultMetrics,
    };
  }

  if (aspectRatio < options.minAspectRatio || aspectRatio > options.maxAspectRatio) {
    return {
      state: "MISALIGNED",
      isReady: false,
      guidanceText: "Place your ID inside the frame",
      reason: "WRONG_ASPECT_RATIO",
      ...resultMetrics,
    };
  }

  if (areaRatio < options.minAreaRatio) {
    return {
      state: "MISALIGNED",
      isReady: false,
      guidanceText: "Move your ID closer",
      reason: "TOO_SMALL",
      ...resultMetrics,
    };
  }

  if (areaRatio > options.maxAreaRatio) {
    return {
      state: "MISALIGNED",
      isReady: false,
      guidanceText: "Move your ID farther away",
      reason: "TOO_LARGE",
      ...resultMetrics,
    };
  }

  if (Math.abs(rotationDeg) > options.maxRotationDeg) {
    return {
      state: "MISALIGNED",
      isReady: false,
      guidanceText: "Straighten your ID",
      reason: "ROTATED",
      ...resultMetrics,
    };
  }

  const centerInside =
    center.x >= readinessRegion.x &&
    center.x <= readinessRegion.x + readinessRegion.width &&
    center.y >= readinessRegion.y &&
    center.y <= readinessRegion.y + readinessRegion.height;
  if (!centerInside || containmentRatio < options.minContainmentRatio) {
    return {
      state: "MISALIGNED",
      isReady: false,
      guidanceText: "Place your ID inside the frame",
      reason: centerInside ? "OUT_OF_BOUNDS" : "OFF_CENTER",
      ...resultMetrics,
    };
  }

  return {
    state: "READY",
    isReady: true,
    guidanceText: "Perfect — hold steady",
    ...resultMetrics,
  };
}

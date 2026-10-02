import {
  ColorConversionCodes,
  ContourApproximationModes,
  Mat,
  MorphShapes,
  MorphTypes,
  OpenCV,
  PointVector,
  PointVectorOfVectors,
  RetrievalModes,
  Size,
  type Point,
} from "react-native-fast-opencv";

export interface DetectedFrameCard {
  cameraPoints: { x: number; y: number }[];
  confidence: number;
}

interface DetectorFrame {
  width: number;
  height: number;
  bytesPerRow: number;
  pixelFormat: string;
  hasPixelBuffer: boolean;
  isPlanar: boolean;
  getPixelBuffer: () => ArrayBuffer;
  convertFramePointToCameraPoint: (point: { x: number; y: number }) => {
    x: number;
    y: number;
  };
}

export type SupportedDetectorPixelFormat =
  | 'rgb-rgba-8-bit'
  | 'rgb-bgra-8-bit';

export interface PreparedDetectorFrame {
  pixels: Uint8Array;
  colorConversionCode: ColorConversionCodes;
}

export type DetectorFrameFailureStage =
  | "PIXEL_BUFFER"
  | "FRAME_PROCESSING";

export function classifyDetectorFrameFailure(error: unknown): DetectorFrameFailureStage {
  const message = error instanceof Error ? error.message : String(error);
  return /getPixelBuffer|HardwareBuffer|CPU-accessible|pixel buffer/i.test(message)
    ? "PIXEL_BUFFER"
    : "FRAME_PROCESSING";
}

const MIN_CARD_AREA_RATIO = 0.12;
const MAX_CARD_AREA_RATIO = 0.9;
const MIN_CARD_ASPECT_RATIO = 1.3;
const MAX_CARD_ASPECT_RATIO = 1.9;
const MIN_INTERIOR_EDGE_DENSITY = 0.008;

/**
 * Validates VisionCamera's exact packed RGB contract and removes only native
 * row padding. Channel count comes from the accepted format, never buffer size.
 */
export function prepareDetectorFramePixels(
  frame: Pick<
    DetectorFrame,
    | 'width'
    | 'height'
    | 'bytesPerRow'
    | 'pixelFormat'
    | 'hasPixelBuffer'
    | 'isPlanar'
    | 'getPixelBuffer'
  >
): PreparedDetectorFrame {
  'worklet';

  const isRgba = frame.pixelFormat === 'rgb-rgba-8-bit';
  const isBgra = frame.pixelFormat === 'rgb-bgra-8-bit';
  if (!isRgba && !isBgra) {
    throw new Error('Unsupported detector frame format: ' + frame.pixelFormat);
  }
  if (!frame.hasPixelBuffer || frame.isPlanar) {
    throw new Error('Detector requires a packed CPU-accessible RGB frame');
  }

  const width = frame.width;
  const height = frame.height;
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    throw new Error('Detector frame dimensions must be positive integers');
  }

  const channels = 4;
  const packedBytesPerRow = width * channels;
  const bytesPerRow = frame.bytesPerRow;
  if (!Number.isInteger(bytesPerRow) || bytesPerRow < packedBytesPerRow) {
    throw new Error('Detector frame row stride is invalid for its four-channel width');
  }

  const sourcePixels = new Uint8Array(frame.getPixelBuffer());
  const requiredBytes = bytesPerRow * height;
  if (sourcePixels.byteLength < requiredBytes) {
    throw new Error('Detector frame buffer is shorter than its declared row stride');
  }

  let pixels = sourcePixels;
  if (bytesPerRow !== packedBytesPerRow) {
    pixels = new Uint8Array(packedBytesPerRow * height);
    for (let row = 0; row < height; row += 1) {
      const sourceStart = row * bytesPerRow;
      const targetStart = row * packedBytesPerRow;
      pixels.set(
        sourcePixels.subarray(sourceStart, sourceStart + packedBytesPerRow),
        targetStart
      );
    }
  } else if (sourcePixels.byteLength !== packedBytesPerRow * height) {
    pixels = sourcePixels.subarray(0, packedBytesPerRow * height);
  }

  return {
    pixels,
    colorConversionCode: isBgra
      ? ColorConversionCodes.COLOR_BGRA2GRAY
      : ColorConversionCodes.COLOR_RGBA2GRAY,
  };
}

/**
 * Finds a physical card-shaped quadrilateral in an RGB camera frame.
 *
 * This runs entirely in the VisionCamera worklet runtime. The inset edge-density
 * guard intentionally rejects empty rectangular outlines (including a large
 * barcode/QR boundary) before geometry is sent to React Native.
 */
export function detectGovernmentIdCard(
  frame: DetectorFrame
): DetectedFrameCard | null {
  'worklet';

  const width = frame.width;
  const height = frame.height;
  const channels = 4;
  const { pixels, colorConversionCode } = prepareDetectorFramePixels(frame);

  const source = Mat.createFromVisionCameraFrameBuffer(
    height,
    width,
    channels,
    pixels
  );
  const gray = Mat.create(height, width, 0);
  const edges = Mat.create(height, width, 0);
  const kernelSize = Size.create(3, 3);
  const kernel = OpenCV.getStructuringElement(MorphShapes.MORPH_RECT, kernelSize);
  const contours = PointVectorOfVectors.create();

  try {
    OpenCV.cvtColor(source, gray, colorConversionCode);

    OpenCV.morphologyEx(gray, gray, MorphTypes.MORPH_OPEN, kernel);
    OpenCV.morphologyEx(gray, gray, MorphTypes.MORPH_CLOSE, kernel);
    OpenCV.Canny(gray, edges, 60, 140);
    OpenCV.findContours(
      edges,
      contours,
      RetrievalModes.RETR_LIST,
      ContourApproximationModes.CHAIN_APPROX_SIMPLE
    );

    const frameArea = width * height;
    let bestPoints: Point[] | null = null;
    let bestArea = 0;

    for (let index = 0; index < contours.length; index += 1) {
      const contour = contours.get(index);
      const approximation = PointVector.create();

      try {
        const { value: area } = OpenCV.contourArea(contour, false);
        const areaRatio = area / frameArea;
        if (
          areaRatio < MIN_CARD_AREA_RATIO ||
          areaRatio > MAX_CARD_AREA_RATIO ||
          area <= bestArea
        ) {
          continue;
        }

        const perimeter = OpenCV.arcLength(contour, true).value;
        OpenCV.approxPolyDP(contour, approximation, 0.025 * perimeter, true);
        const points = approximation.getAll();
        if (points.length !== 4) continue;

        const bounds = OpenCV.boundingRect(approximation);
        try {
          const shortSide = Math.min(bounds.width, bounds.height);
          const longSide = Math.max(bounds.width, bounds.height);
          const aspectRatio = longSide / Math.max(shortSide, 1);
          if (
            aspectRatio < MIN_CARD_ASPECT_RATIO ||
            aspectRatio > MAX_CARD_ASPECT_RATIO
          ) {
            continue;
          }

          const insetX = Math.max(2, Math.round(bounds.width * 0.08));
          const insetY = Math.max(2, Math.round(bounds.height * 0.1));
          const roiWidth = bounds.width - insetX * 2;
          const roiHeight = bounds.height - insetY * 2;
          if (roiWidth <= 0 || roiHeight <= 0) continue;

          const roi = OpenCV.Rect.create(
            bounds.x + insetX,
            bounds.y + insetY,
            roiWidth,
            roiHeight
          );
          const interiorEdges = Mat.create(roiHeight, roiWidth, 0);
          try {
            OpenCV.crop(edges, interiorEdges, roi);
            const edgeDensity =
              OpenCV.countNonZero(interiorEdges).value / (roiWidth * roiHeight);
            if (edgeDensity < MIN_INTERIOR_EDGE_DENSITY) continue;
          } finally {
            interiorEdges.release();
            roi.release();
          }

          bestArea = area;
          bestPoints = points;
        } finally {
          bounds.release();
        }
      } finally {
        approximation.release();
        contour.release();
      }
    }

    if (!bestPoints) return null;

    return {
      // VisionCamera applies Frame orientation/mirroring in this conversion;
      // OpenCV coordinates remain in the original unrotated frame dimensions.
      cameraPoints: bestPoints.map((point) =>
        frame.convertFramePointToCameraPoint({ x: point.x, y: point.y })
      ),
      confidence: Math.min(1, bestArea / (frameArea * 0.5)),
    };
  } finally {
    contours.release();
    kernel.release();
    kernelSize.release();
    edges.release();
    gray.release();
    source.release();
  }
}

import { File, Paths } from "expo-file-system";
import type { CameraOrientation } from "react-native-vision-camera";
import {
  DataTypes,
  InterpolationFlags,
  Mat,
  OpenCV,
  Rect as OpenCVRect,
  RotateFlags,
  Size,
} from "react-native-fast-opencv";
import type { Point, Rect } from "./cardDetectorTypes";

export interface ImageSize {
  width: number;
  height: number;
}

export const NORMALIZED_WIDTH = 1280;
export const NORMALIZED_HEIGHT = 807;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

/**
 * Maps a point from the visible `cover` camera preview into oriented image pixels.
 * This reverses the preview's aspect-fill crop instead of multiplying screen and
 * image coordinates directly.
 */
export function mapPreviewPointToImagePoint(
  point: Point,
  previewSize: ImageSize,
  imageSize: ImageSize
): Point {
  if (
    previewSize.width <= 0 ||
    previewSize.height <= 0 ||
    imageSize.width <= 0 ||
    imageSize.height <= 0
  ) {
    throw new Error("Preview and image dimensions must be positive");
  }

  const coverScale = Math.max(
    previewSize.width / imageSize.width,
    previewSize.height / imageSize.height
  );
  const renderedWidth = imageSize.width * coverScale;
  const renderedHeight = imageSize.height * coverScale;
  const croppedX = (renderedWidth - previewSize.width) / 2;
  const croppedY = (renderedHeight - previewSize.height) / 2;

  return {
    x: clamp((point.x + croppedX) / coverScale, 0, imageSize.width),
    y: clamp((point.y + croppedY) / coverScale, 0, imageSize.height),
  };
}

/** Returns the decoded pixel dimensions after applying the photo's EXIF rotation. */
export function getOrientedImageSize(
  imageSize: ImageSize,
  orientation: CameraOrientation
): ImageSize {
  return orientation === "left" || orientation === "right"
    ? { width: imageSize.height, height: imageSize.width }
    : imageSize;
}

/**
 * Maps the measured guide to a clamped integer ROI in the orientation shown by
 * the camera preview. Floor/ceil retain every pixel that was visible in the guide.
 */
export function mapPreviewGuideToImageRect(
  guideBounds: Rect,
  previewSize: ImageSize,
  imageSize: ImageSize
): Rect {
  const topLeft = mapPreviewPointToImagePoint(
    { x: guideBounds.x, y: guideBounds.y },
    previewSize,
    imageSize
  );
  const bottomRight = mapPreviewPointToImagePoint(
    {
      x: guideBounds.x + guideBounds.width,
      y: guideBounds.y + guideBounds.height,
    },
    previewSize,
    imageSize
  );
  const x = clamp(Math.floor(topLeft.x), 0, imageSize.width - 1);
  const y = clamp(Math.floor(topLeft.y), 0, imageSize.height - 1);
  const right = clamp(Math.ceil(bottomRight.x), x + 1, imageSize.width);
  const bottom = clamp(Math.ceil(bottomRight.y), y + 1, imageSize.height);

  return { x, y, width: right - x, height: bottom - y };
}

function rotateToPreviewOrientation(
  source: ReturnType<typeof Mat.createFromBase64>,
  orientation: CameraOrientation
) {
  if (orientation === "up") return { image: source, ownsImage: false };

  const swapsAxes = orientation === "left" || orientation === "right";
  const rotated = Mat.create(
    swapsAxes ? source.cols : source.rows,
    swapsAxes ? source.rows : source.cols,
    Number(source.type) as DataTypes
  );
  const rotation =
    orientation === "right"
      ? RotateFlags.ROTATE_90_CLOCKWISE
      : orientation === "left"
        ? RotateFlags.ROTATE_90_COUNTERCLOCKWISE
        : RotateFlags.ROTATE_180;
  OpenCV.rotate(source, rotated, rotation);
  return { image: rotated, ownsImage: true };
}

/** Crops exactly the visible guide rectangle and resizes it to 1280x807 JPEG. */
export async function normalizeGovernmentIdImage(input: {
  sourceUri: string;
  previewSize: ImageSize;
  guideBounds: Rect;
  photoOrientation: CameraOrientation;
}): Promise<string> {
  const sourceFile = new File(input.sourceUri);
  const source = Mat.createFromBase64(await sourceFile.base64());
  const { image: orientedSource, ownsImage } = rotateToPreviewOrientation(
    source,
    input.photoOrientation
  );
  const orientedSize = { width: orientedSource.cols, height: orientedSource.rows };
  const cropRect = mapPreviewGuideToImageRect(
    input.guideBounds,
    input.previewSize,
    orientedSize
  );
  const roi = OpenCVRect.create(
    cropRect.x,
    cropRect.y,
    cropRect.width,
    cropRect.height
  );
  const cropped = Mat.create(
    cropRect.height,
    cropRect.width,
    Number(orientedSource.type) as DataTypes
  );
  const normalized = Mat.create(
    NORMALIZED_HEIGHT,
    NORMALIZED_WIDTH,
    Number(orientedSource.type) as DataTypes
  );
  const outputSize = Size.create(NORMALIZED_WIDTH, NORMALIZED_HEIGHT);

  try {
    if (__DEV__) {
      console.debug("[GovernmentIdScanner] Guide crop started", {
        photoOrientation: input.photoOrientation,
        sourceWidth: source.cols,
        sourceHeight: source.rows,
        orientedWidth: orientedSize.width,
        orientedHeight: orientedSize.height,
        previewWidth: input.previewSize.width,
        previewHeight: input.previewSize.height,
        guideX: input.guideBounds.x,
        guideY: input.guideBounds.y,
        guideWidth: input.guideBounds.width,
        guideHeight: input.guideBounds.height,
        cropX: cropRect.x,
        cropY: cropRect.y,
        cropWidth: cropRect.width,
        cropHeight: cropRect.height,
      });
    }

    OpenCV.crop(orientedSource, cropped, roi);
    OpenCV.resize(
      cropped,
      normalized,
      outputSize,
      0,
      0,
      InterpolationFlags.INTER_LINEAR
    );

    const outputFile = new File(
      Paths.cache,
      `government-id-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
    );
    normalized.saveToFile(outputFile.uri, "jpeg", 0.9);
    if (__DEV__) {
      console.debug("[GovernmentIdScanner] Guide crop succeeded", {
        outputWidth: NORMALIZED_WIDTH,
        outputHeight: NORMALIZED_HEIGHT,
      });
    }
    return outputFile.uri;
  } finally {
    outputSize.release();
    normalized.release();
    cropped.release();
    roi.release();
    if (ownsImage) orientedSource.release();
    source.release();
  }
}

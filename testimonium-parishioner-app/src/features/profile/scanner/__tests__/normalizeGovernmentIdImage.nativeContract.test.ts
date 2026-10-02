const mockFixtureBase64 = "mock-jpeg-base64";
const mockWrittenFiles = new Set<string>();
const mockCropCalls: { x: number; y: number; width: number; height: number }[] = [];
const mockResizeCalls: { rows: number; cols: number; width: number; height: number }[] = [];
const mockRotateCalls: number[] = [];

jest.mock("expo-file-system", () => ({
  Paths: { cache: "file:///cache" },
  File: class MockFile {
    uri: string;

    constructor(base: string, name?: string) {
      this.uri = name ? base + "/" + name : base;
    }

    get exists() {
      return mockWrittenFiles.has(this.uri);
    }

    async base64() {
      return mockFixtureBase64;
    }
  },
}));

jest.mock("react-native-fast-opencv", () => {
  const createMat = (rows: number, cols: number, type = 16) => ({
    rows,
    cols,
    type,
    release: jest.fn(),
    saveToFile: (path: string) => mockWrittenFiles.add(path),
  });

  const openCV = {
    crop: jest.fn((_source, _destination, roi) => {
      mockCropCalls.push({ x: roi.x, y: roi.y, width: roi.width, height: roi.height });
    }),
    resize: jest.fn((_source, destination, size) => {
      mockResizeCalls.push({
        rows: destination.rows,
        cols: destination.cols,
        width: size.width,
        height: size.height,
      });
    }),
    rotate: jest.fn((_source, _destination, rotation) => {
      mockRotateCalls.push(rotation);
    }),
  };

  return {
    DataTypes: { CV_8UC3: 16 },
    InterpolationFlags: { INTER_LINEAR: 1 },
    RotateFlags: {
      ROTATE_90_CLOCKWISE: 0,
      ROTATE_180: 1,
      ROTATE_90_COUNTERCLOCKWISE: 2,
    },
    Rect: {
      create: (x: number, y: number, width: number, height: number) => ({
        x,
        y,
        width,
        height,
        release: jest.fn(),
      }),
    },
    Size: {
      create: (width: number, height: number) => ({
        width,
        height,
        release: jest.fn(),
      }),
    },
    Mat: {
      createFromBase64: (base64: string) => {
        if (base64 !== mockFixtureBase64) throw new Error("Unexpected fixture");
        return createMat(2976, 3968);
      },
      create: createMat,
    },
    OpenCV: openCV,
  };
});

// Jest native factories must be initialized before this module import.
// eslint-disable-next-line import/first
import {
  NORMALIZED_HEIGHT,
  NORMALIZED_WIDTH,
  normalizeGovernmentIdImage,
} from "../normalizeGovernmentIdImage";

describe("Fast OpenCV rectangular guide crop contract", () => {
  beforeEach(() => {
    mockCropCalls.length = 0;
    mockResizeCalls.length = 0;
    mockRotateCalls.length = 0;
    mockWrittenFiles.clear();
  });

  it("rotates sensor pixels, crops the guide ROI, and emits a 1280x807 JPEG", async () => {
    const outputUri = await normalizeGovernmentIdImage({
      sourceUri: "file:///fixture/card-frame.jpg",
      previewSize: { width: 400, height: 800 },
      guideBounds: { x: 24, y: 210, width: 352, height: 222 },
      photoOrientation: "right",
    });

    expect(mockRotateCalls).toEqual([0]);
    expect(mockCropCalls).toEqual([
      { x: 615, y: 1041, width: 1746, height: 1102 },
    ]);
    expect(mockResizeCalls).toEqual([
      { rows: 807, cols: 1280, width: 1280, height: 807 },
    ]);
    expect(NORMALIZED_WIDTH).toBe(1280);
    expect(NORMALIZED_HEIGHT).toBe(807);
    expect(outputUri.startsWith("file:///cache/government-id-")).toBe(true);
    expect(outputUri.endsWith(".jpg")).toBe(true);
    expect(mockWrittenFiles.has(outputUri)).toBe(true);
  });

  it("uses the same guide crop when the decoded JPEG is already upright", async () => {
    await normalizeGovernmentIdImage({
      sourceUri: "file:///fixture/card-frame.jpg",
      previewSize: { width: 800, height: 600 },
      guideBounds: { x: 80, y: 120, width: 640, height: 404 },
      photoOrientation: "up",
    });

    expect(mockRotateCalls).toHaveLength(0);
    expect(mockCropCalls).toHaveLength(1);
    expect(mockResizeCalls[0]).toEqual({
      rows: 807,
      cols: 1280,
      width: 1280,
      height: 807,
    });
  });
});

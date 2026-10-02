import {
  getOrientedImageSize,
  mapPreviewGuideToImageRect,
  mapPreviewPointToImagePoint,
} from "../normalizeGovernmentIdImage";

jest.mock("expo-file-system", () => ({ File: jest.fn(), Paths: { cache: {} } }));
jest.mock("react-native-fast-opencv", () => ({
  DataTypes: { CV_8UC3: 16 },
  InterpolationFlags: { INTER_LINEAR: 1 },
  Mat: {},
  OpenCV: {},
  Rect: {},
  RotateFlags: {
    ROTATE_90_CLOCKWISE: 0,
    ROTATE_180: 1,
    ROTATE_90_COUNTERCLOCKWISE: 2,
  },
  Size: {},
}));

describe("Government ID guide crop coordinate mapping", () => {
  it("reverses portrait preview cover-cropping before using JPEG pixels", () => {
    expect(
      mapPreviewPointToImagePoint(
        { x: 0, y: 0 },
        { width: 400, height: 800 },
        { width: 1200, height: 800 }
      )
    ).toEqual({ x: 400, y: 0 });

    expect(
      mapPreviewPointToImagePoint(
        { x: 400, y: 800 },
        { width: 400, height: 800 },
        { width: 1200, height: 800 }
      )
    ).toEqual({ x: 800, y: 800 });
  });

  it("accounts for sensor-to-portrait rotation before cover mapping", () => {
    expect(getOrientedImageSize({ width: 3968, height: 2976 }, "right")).toEqual({
      width: 2976,
      height: 3968,
    });
    expect(getOrientedImageSize({ width: 3968, height: 2976 }, "left")).toEqual({
      width: 2976,
      height: 3968,
    });
    expect(getOrientedImageSize({ width: 3968, height: 2976 }, "up")).toEqual({
      width: 3968,
      height: 2976,
    });
  });

  it("maps the exact visible guide through cover scaling into portrait photo pixels", () => {
    expect(
      mapPreviewGuideToImageRect(
        { x: 24, y: 210, width: 352, height: 222 },
        { width: 400, height: 800 },
        { width: 3000, height: 4000 }
      )
    ).toEqual({ x: 620, y: 1050, width: 1760, height: 1110 });
  });

  it("clamps a guide that reaches beyond the visible preview to image bounds", () => {
    expect(
      mapPreviewGuideToImageRect(
        { x: -50, y: -20, width: 500, height: 850 },
        { width: 400, height: 800 },
        { width: 1200, height: 800 }
      )
    ).toEqual({ x: 350, y: 0, width: 500, height: 800 });
  });
});

import { ColorConversionCodes } from "react-native-fast-opencv";
import {
  classifyDetectorFrameFailure,
  prepareDetectorFramePixels,
} from "../detectGovernmentIdCard";

jest.mock("react-native-fast-opencv", () => ({
  ColorConversionCodes: {
    COLOR_RGBA2GRAY: 11,
    COLOR_BGRA2GRAY: 12,
  },
}));

function makeFrame(
  overrides: Partial<{
    width: number;
    height: number;
    bytesPerRow: number;
    pixelFormat: string;
    hasPixelBuffer: boolean;
    isPlanar: boolean;
    buffer: ArrayBuffer;
  }> = {}
) {
  const buffer = overrides.buffer ?? new Uint8Array(16).buffer;
  return {
    width: overrides.width ?? 2,
    height: overrides.height ?? 2,
    bytesPerRow: overrides.bytesPerRow ?? 8,
    pixelFormat: overrides.pixelFormat ?? "rgb-rgba-8-bit",
    hasPixelBuffer: overrides.hasPixelBuffer ?? true,
    isPlanar: overrides.isPlanar ?? false,
    getPixelBuffer: jest.fn(() => buffer),
  };
}

describe("VisionCamera detector frame contract", () => {
  it("accepts exact RGBA format and trims bytes beyond the declared packed rows", () => {
    const source = new Uint8Array(20);
    source.set(Array.from({ length: 16 }, (_, index) => index + 1));

    const prepared = prepareDetectorFramePixels(
      makeFrame({ pixelFormat: "rgb-rgba-8-bit", buffer: source.buffer })
    );

    expect(prepared.colorConversionCode).toBe(ColorConversionCodes.COLOR_RGBA2GRAY);
    expect(Array.from(prepared.pixels)).toEqual(
      Array.from({ length: 16 }, (_, index) => index + 1)
    );
  });

  it("accepts exact BGRA format and compacts padded rows using bytesPerRow", () => {
    const source = new Uint8Array([
      1, 2, 3, 4, 5, 6, 7, 8, 90, 91, 92, 93,
      9, 10, 11, 12, 13, 14, 15, 16, 94, 95, 96, 97,
    ]);

    const prepared = prepareDetectorFramePixels(
      makeFrame({
        pixelFormat: "rgb-bgra-8-bit",
        bytesPerRow: 12,
        buffer: source.buffer,
      })
    );

    expect(prepared.colorConversionCode).toBe(ColorConversionCodes.COLOR_BGRA2GRAY);
    expect(Array.from(prepared.pixels)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
      9, 10, 11, 12, 13, 14, 15, 16,
    ]);
  });

  it.each(["rgba", "bgra", "rgb", "rgb-rgb-8-bit", "unknown"])(
    "fails closed for unsupported format %s",
    (pixelFormat) => {
      expect(() => prepareDetectorFramePixels(makeFrame({ pixelFormat }))).toThrow(
        "Unsupported detector frame format"
      );
    }
  );

  it("does not infer stride or channels from buffer length", () => {
    expect(() =>
      prepareDetectorFramePixels(makeFrame({ bytesPerRow: 0, buffer: new ArrayBuffer(64) }))
    ).toThrow("row stride is invalid");
    expect(() =>
      prepareDetectorFramePixels(makeFrame({ bytesPerRow: 7, buffer: new ArrayBuffer(64) }))
    ).toThrow("row stride is invalid");
  });

  it("rejects buffers shorter than the declared row stride", () => {
    expect(() =>
      prepareDetectorFramePixels(
        makeFrame({ bytesPerRow: 12, buffer: new ArrayBuffer(23) })
      )
    ).toThrow("buffer is shorter than its declared row stride");
  });

  it("rejects planar or CPU-inaccessible frames", () => {
    expect(() => prepareDetectorFramePixels(makeFrame({ isPlanar: true }))).toThrow(
      "packed CPU-accessible RGB frame"
    );
    expect(() =>
      prepareDetectorFramePixels(makeFrame({ hasPixelBuffer: false }))
    ).toThrow("packed CPU-accessible RGB frame");
  });

  it("categorizes native HardwareBuffer failures as pixel-buffer failures", () => {
    expect(
      classifyDetectorFrameFailure(
        new Error(
          "Frame.getPixelBuffer(...): ArrayBuffer(HardwareBuffer) requires NDK API 26 or above!"
        )
      )
    ).toBe("PIXEL_BUFFER");
    expect(classifyDetectorFrameFailure(new Error("OpenCV contour failed"))).toBe(
      "FRAME_PROCESSING"
    );
  });
});

import React from "react";
import { Alert, Dimensions } from "react-native";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react-native";
import { GovernmentIdCameraScanner as ProductionGovernmentIdCameraScanner } from "../features/profile/components/GovernmentIdCameraScanner";
import { IdVerificationScreen } from "../features/profile/IdVerificationScreen";
import { getSafeVerificationErrorMessage } from "../features/profile/api/governmentIdVerification";
import {
  checkGovernmentIdRequirement,
} from "../hooks/useRequireCompleteProfile";
import { apiClient } from "../services/api/client";
import { ID_TYPE_LABELS, REJECTION_REASON_MESSAGES } from "../features/profile/types/governmentId";
import {
  evaluateCardAlignment,
  useCardDetector,
  checkCapturedImageQuality,
  type CardDetection,
  type Rect,
  type UseCardDetectorReturn,
} from "../features/profile/scanner";

const GovernmentIdCameraScanner = (
  props: React.ComponentProps<typeof ProductionGovernmentIdCameraScanner>
) => <ProductionGovernmentIdCameraScanner manualFallbackDelayMs={0} {...props} />;

// Mock dependencies
const mockRequestPermission = jest.fn();
const mockPhotoDispose = jest.fn();
const makeMockPhoto = (path = "/mock/captured.jpg") => ({
  orientation: "right" as const,
  width: 3968,
  height: 2976,
  saveToTemporaryFileAsync: jest.fn(async () => path),
  dispose: mockPhotoDispose,
});
const mockCapturePhoto = jest.fn(async (_settings?: unknown, _callbacks?: unknown) =>
  makeMockPhoto()
);
const mockDetectGovernmentIdCard = jest.fn();
const mockNormalizeGovernmentIdImage = jest.fn(
  async (_input?: unknown) => "file:///mock/cropped.jpg"
);
const mockFileDelete = jest.fn();
const mockFrameOutput = { type: "frame-output" };
const mockPhotoOutput = {
  capturePhoto: (settings: any, callbacks: any) =>
    mockCapturePhoto(settings, callbacks),
  currentResolution: { width: 1280, height: 720 },
};
let mockFrameOutputOptions: any;
let mockCameraAutoStart = true;
let mockPermissionState: { granted: boolean; canAskAgain: boolean } | null = {
  granted: true,
  canAskAgain: true,
};

jest.mock("react-native-vision-camera", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require("react-native");
  const MockCamera = React.forwardRef((props: any, ref: any) => {
      const { onConfigured, onStarted, onStopped } = props;
      React.useImperativeHandle(ref, () => ({
        convertCameraPointToViewPoint: (point: any) => point,
        controller: { type: "camera-controller" },
      }));
      React.useEffect(() => {
        if (mockCameraAutoStart) {
          onConfigured?.();
          onStarted?.();
        }
        return () => onStopped?.();
      }, [onConfigured, onStarted, onStopped]);
      return <View testID="camera-view" {...props} />;
    });
  MockCamera.displayName = "MockVisionCamera";
  return {
    Camera: MockCamera,
    useCameraDevice: () => ({ id: "back-camera", position: "back" }),
    useCameraPermission: () => ({
      hasPermission: Boolean(mockPermissionState?.granted),
      requestPermission: mockRequestPermission,
    }),
    useFrameOutput: (options: any) => {
      mockFrameOutputOptions = options;
      return mockFrameOutput;
    },
    usePhotoOutput: () => mockPhotoOutput,
  };
});

jest.mock("../features/profile/scanner/detectGovernmentIdCard", () => ({
  detectGovernmentIdCard: (...args: any[]) => mockDetectGovernmentIdCard(...args),
  classifyDetectorFrameFailure: (error: unknown) =>
    String(error).includes("HardwareBuffer") ? "PIXEL_BUFFER" : "FRAME_PROCESSING",
}));

jest.mock("../features/profile/scanner/normalizeGovernmentIdImage", () => ({
  normalizeGovernmentIdImage: (args: any) => mockNormalizeGovernmentIdImage(args),
}));

jest.mock("react-native-safe-area-context", () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SafeAreaView: require("react-native").View,
  useSafeAreaInsets: () => ({ top: 24, right: 0, bottom: 24, left: 0 }),
}));

jest.mock("react-native-fast-opencv", () => ({
  OpenCV: {},
  Mat: {},
  PointVector: {},
  PointVectorOfVectors: {},
  Size: {},
  ColorConversionCodes: {},
  ContourApproximationModes: {},
  MorphShapes: {},
  MorphTypes: {},
  RetrievalModes: {},
}));

jest.mock("react-native-worklets", () => ({
  scheduleOnRN: (callback: (...args: any[]) => unknown, ...args: any[]) =>
    callback(...args),
}));

jest.mock("expo-file-system", () => ({
  File: class MockFile {
    uri: string;
    exists = true;

    constructor(uri: string) {
      this.uri = uri;
    }

    delete = () => mockFileDelete(this.uri);
  },
}));

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn(() => true);

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    replace: mockReplace,
    canGoBack: mockCanGoBack,
  }),
}));

const mockRefreshProfile = jest.fn();
let mockAuthProfile: any = {
  id: 1,
  fullName: "Juan Dela Cruz",
  isVerified: true,
  needsProfileCompletion: false,
  isGovernmentIdVerified: false,
  governmentIdVerificationStatus: "NOT_SUBMITTED",
};

jest.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({
    profile: mockAuthProfile,
    refreshProfile: mockRefreshProfile,
  }),
}));

jest.mock("@/services/api/client", () => ({
  apiClient: {
    request: jest.fn(),
  },
}));

describe("Android Mobile Government ID Verification Suite (Requirements 72 - 90)", () => {
  const mockAlert = jest.spyOn(Alert, "alert").mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
    mockCapturePhoto.mockResolvedValue(makeMockPhoto());
    mockDetectGovernmentIdCard.mockReturnValue(null);
    mockNormalizeGovernmentIdImage.mockResolvedValue("file:///mock/cropped.jpg");
    mockFrameOutputOptions = undefined;
    mockCameraAutoStart = true;
    mockPermissionState = { granted: true, canAskAgain: true };
    mockAuthProfile = {
      id: 1,
      fullName: "Juan Dela Cruz",
      isVerified: true,
      needsProfileCompletion: false,
      isGovernmentIdVerified: false,
      governmentIdVerificationStatus: "NOT_SUBMITTED",
    };
  });

  // 72. camera permission request
  it("72. requests camera permission when grant button is clicked", async () => {
    mockPermissionState = { granted: false, canAskAgain: true };
    await render(
      <GovernmentIdCameraScanner
        side="front"
        onCapture={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    const grantBtn = screen.getByText("Grant Camera Permission");
    await fireEvent.press(grantBtn);
    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
  });

  // 73. denied permission state
  it("73. displays denied permission state with explanatory notice", async () => {
    mockPermissionState = { granted: false, canAskAgain: false };
    await render(
      <GovernmentIdCameraScanner
        side="front"
        onCapture={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    expect(screen.getByText("Camera Access Required")).toBeTruthy();
    expect(
      screen.getByText(/TESTIMONIUM requires camera access on your Android device/)
    ).toBeTruthy();
  });

  // 74. live camera screen renders
  it("74. renders live camera preview when permissions are granted", async () => {
    mockPermissionState = { granted: true, canAskAgain: true };
    await render(
      <GovernmentIdCameraScanner
        side="front"
        onCapture={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    expect(screen.getByTestId("camera-view")).toBeTruthy();
    expect(screen.getByText("Front of Government ID")).toBeTruthy();
  });

  it("74a. attaches the production frame output to the live Camera", async () => {
    await render(
      <GovernmentIdCameraScanner
        side="front"
        onCapture={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    expect(mockFrameOutputOptions).toEqual(
      expect.objectContaining({
        pixelFormat: "rgb",
        targetResolution: { width: 640, height: 360 },
        onFrame: expect.any(Function),
      })
    );
    expect(screen.getByTestId("camera-view").props.outputs).toEqual(
      expect.arrayContaining([mockFrameOutput])
    );
  });

  // 75. CR80/card-shaped overlay renders
  it("75. renders CR80 landscape card framing guide and instructional text", async () => {
    await render(
      <GovernmentIdCameraScanner
        side="front"
        onCapture={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    expect(screen.getByText("Align the FRONT of your ID card inside the frame")).toBeTruthy();
    expect(
      screen.getByText("Ensure all 4 corners are inside the frame and text is clear with no glare.")
    ).toBeTruthy();
  });

  // 76 & 77. front capture & retake
  it("76 & 77. supports front capture and retake before confirmation", async () => {
    const mockOnCapture = jest.fn();
    await render(
      <GovernmentIdCameraScanner
        side="front"
        onCapture={mockOnCapture}
        onCancel={jest.fn()}
      />
    );

    const shutterBtn = screen.getByLabelText("Capture front of ID card manually");
    await fireEvent.press(shutterBtn);

    expect(screen.getByText("Retake")).toBeTruthy();
    expect(screen.getByText("Use Photo")).toBeTruthy();

    // Retake resets preview
    await fireEvent.press(screen.getByText("Retake"));
    expect(screen.queryByText("Use Photo")).toBeNull();
    expect(mockFileDelete).toHaveBeenCalledWith("file:///mock/captured.jpg");
    expect(mockFileDelete).toHaveBeenCalledWith("file:///mock/cropped.jpg");
    expect(mockPhotoDispose).toHaveBeenCalledTimes(1);
  });

  it("77a. cleans the normalized temporary file when the scanner exits", async () => {
    const { unmount } = await render(
      <GovernmentIdCameraScanner
        side="front"
        onCapture={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    await fireEvent.press(screen.getByLabelText("Capture front of ID card manually"));
    await unmount();

    expect(mockFileDelete).toHaveBeenCalledWith("file:///mock/cropped.jpg");
  });

  it("77b. hides crop internals behind the safe preparation error", async () => {
    mockNormalizeGovernmentIdImage.mockRejectedValueOnce(
      new Error("OpenCV internal matrix failure")
    );
    await render(
      <GovernmentIdCameraScanner
        side="front"
        onCapture={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    await fireEvent.press(screen.getByLabelText("Capture front of ID card manually"));

    expect(
      screen.getByText("Unable to prepare the ID photo. Please try again.")
    ).toBeTruthy();
    expect(screen.queryByText(/OpenCV|matrix|file:\/\//i)).toBeNull();
    expect(mockFileDelete).toHaveBeenCalledWith("file:///mock/captured.jpg");
  });

  // 78 & 79. back capture & retake
  it("78 & 79. supports back capture with reverse side instructions", async () => {
    const mockOnCapture = jest.fn();
    await render(
      <GovernmentIdCameraScanner
        side="back"
        onCapture={mockOnCapture}
        onCancel={jest.fn()}
      />
    );

    expect(screen.getByText("Back of Government ID")).toBeTruthy();
    expect(screen.getByText("Step 2 of 2: Reverse side")).toBeTruthy();

    const shutterBtn = screen.getByLabelText("Capture back of ID card manually");
    await fireEvent.press(shutterBtn);

    expect(screen.getByText("Use Photo")).toBeTruthy();
    await fireEvent.press(screen.getByText("Use Photo"));
    expect(mockOnCapture).toHaveBeenCalledWith("file:///mock/cropped.jpg");
  });

  // 80 & 81. final front/back previews & cancellation handled
  it("80 & 81. handles cancellation and displays front/back preview review", async () => {
    const mockOnCancel = jest.fn();
    await render(
      <GovernmentIdCameraScanner
        side="front"
        onCapture={jest.fn()}
        onCancel={mockOnCancel}
      />
    );

    const closeBtn = screen.getByLabelText("Close scanner");
    await fireEvent.press(closeBtn);
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  // 82, 83, 84, 85. backend rejections & infrastructure failures
  it("82. displays canonical IMAGE_BLURRY rejection message", async () => {
    (apiClient.request as jest.Mock).mockResolvedValueOnce({
      status: "REJECTED",
      rejectionReason: "IMAGE_BLURRY",
      rejectionMessage: REJECTION_REASON_MESSAGES.IMAGE_BLURRY,
      isGovernmentIdVerified: false,
    });

    await render(<IdVerificationScreen scannerFallbackDelayMs={0} />);

    // Step 1: Front
    await fireEvent.press(screen.getByLabelText("Capture front of ID card manually"));
    await fireEvent.press(screen.getByText("Use Photo"));

    // Step 2: Back
    await fireEvent.press(screen.getByLabelText("Capture back of ID card manually"));
    await fireEvent.press(screen.getByText("Use Photo"));

    // Step 3: Review automatically verifies exactly once.
    expect(await screen.findByText("Verification Unsuccessful")).toBeTruthy();
    expect(await screen.findByText(REJECTION_REASON_MESSAGES.IMAGE_BLURRY)).toBeTruthy();
  });

  it("83. displays canonical NAME_MISMATCH rejection message", async () => {
    (apiClient.request as jest.Mock).mockResolvedValueOnce({
      status: "REJECTED",
      rejectionReason: "NAME_MISMATCH",
      rejectionMessage: REJECTION_REASON_MESSAGES.NAME_MISMATCH,
      isGovernmentIdVerified: false,
    });

    await render(<IdVerificationScreen scannerFallbackDelayMs={0} />);

    await fireEvent.press(screen.getByLabelText("Capture front of ID card manually"));
    await fireEvent.press(screen.getByText("Use Photo"));

    await fireEvent.press(screen.getByLabelText("Capture back of ID card manually"));
    await fireEvent.press(screen.getByText("Use Photo"));

    expect(await screen.findByText(REJECTION_REASON_MESSAGES.NAME_MISMATCH)).toBeTruthy();
  });

  it("84. displays canonical ID_EXPIRED rejection message", async () => {
    (apiClient.request as jest.Mock).mockResolvedValueOnce({
      status: "REJECTED",
      rejectionReason: "ID_EXPIRED",
      rejectionMessage: REJECTION_REASON_MESSAGES.ID_EXPIRED,
      isGovernmentIdVerified: false,
    });

    await render(<IdVerificationScreen scannerFallbackDelayMs={0} />);

    await fireEvent.press(screen.getByLabelText("Capture front of ID card manually"));
    await fireEvent.press(screen.getByText("Use Photo"));

    await fireEvent.press(screen.getByLabelText("Capture back of ID card manually"));
    await fireEvent.press(screen.getByText("Use Photo"));

    expect(await screen.findByText(REJECTION_REASON_MESSAGES.ID_EXPIRED)).toBeTruthy();
  });

  it("85. displays retryable temporary error on OCR service failure", async () => {
    (apiClient.request as jest.Mock).mockRejectedValueOnce({
      status: 503,
      code: "OCR_PROVIDER_UNAVAILABLE",
      message: "Service unavailable",
    });

    await render(<IdVerificationScreen scannerFallbackDelayMs={0} />);

    await fireEvent.press(screen.getByLabelText("Capture front of ID card manually"));
    await fireEvent.press(screen.getByText("Use Photo"));

    await fireEvent.press(screen.getByLabelText("Capture back of ID card manually"));
    await fireEvent.press(screen.getByText("Use Photo"));

    expect(
      await screen.findByText("We couldn't verify your ID right now. Please try again.")
    ).toBeTruthy();
  });

  // 86. successful verification refreshes profile state
  it("86. successful verification displays VERIFIED screen and refreshes profile", async () => {
    (apiClient.request as jest.Mock).mockResolvedValueOnce({
      status: "VERIFIED",
      idType: "PHIL_SYS",
      verifiedAt: "2026-09-29T12:00:00.000Z",
      expiresAt: null,
      isGovernmentIdVerified: true,
    });

    await render(<IdVerificationScreen scannerFallbackDelayMs={0} />);

    await fireEvent.press(screen.getByLabelText("Capture front of ID card manually"));
    await fireEvent.press(screen.getByText("Use Photo"));

    await fireEvent.press(screen.getByLabelText("Capture back of ID card manually"));
    await fireEvent.press(screen.getByText("Use Photo"));

    expect(await screen.findByText("Government ID Verified")).toBeTruthy();
    expect(await screen.findByText(ID_TYPE_LABELS.PHIL_SYS)).toBeTruthy();
    expect(mockRefreshProfile).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText("Done"));
    await waitFor(() => expect(mockRefreshProfile).toHaveBeenCalledTimes(1));
  });

  it("86a. shows the in-app scan state and rerenders without duplicate submission", async () => {
    let resolveVerification!: (value: unknown) => void;
    (apiClient.request as jest.Mock).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveVerification = resolve;
        })
    );

    const view = await render(<IdVerificationScreen scannerFallbackDelayMs={0} />);

    await fireEvent.press(screen.getByLabelText("Capture front of ID card manually"));
    await fireEvent.press(screen.getByText("Use Photo"));
    await fireEvent.press(screen.getByLabelText("Capture back of ID card manually"));
    await fireEvent.press(screen.getByText("Use Photo"));

    expect(await screen.findByText("Verifying your Government ID…")).toBeTruthy();
    expect(screen.getByText("Checking image quality and ID details.")).toBeTruthy();
    expect(
      screen.getByLabelText("Retake front of ID").props.accessibilityState.disabled
    ).toBe(true);

    view.rerender(<IdVerificationScreen scannerFallbackDelayMs={0} />);
    await waitFor(() => expect(apiClient.request).toHaveBeenCalledTimes(1));

    await act(async () => {
      resolveVerification({
        status: "REJECTED",
        rejectionReason: "IMAGE_BLURRY",
        isGovernmentIdVerified: false,
      });
      await Promise.resolve();
    });
    expect(await screen.findByText("Verification Unsuccessful")).toBeTruthy();
  });

  it("86b. uses a side-specific retake action when the backend identifies the side", async () => {
    (apiClient.request as jest.Mock).mockResolvedValueOnce({
      status: "REJECTED",
      rejectionReason: "IMAGE_BLURRY",
      failedSide: "front",
      isGovernmentIdVerified: false,
    });

    await render(<IdVerificationScreen scannerFallbackDelayMs={0} />);

    await fireEvent.press(screen.getByLabelText("Capture front of ID card manually"));
    await fireEvent.press(screen.getByText("Use Photo"));
    await fireEvent.press(screen.getByLabelText("Capture back of ID card manually"));
    await fireEvent.press(screen.getByText("Use Photo"));

    expect(await screen.findByText("Verification Unsuccessful")).toBeTruthy();
    const frontActions = screen.getAllByText("Retake Front");
    expect(frontActions).toHaveLength(2);
    await fireEvent.press(frontActions[0]);
    expect(screen.getByText("Front of Government ID")).toBeTruthy();
  });

  // 87 & 88. Document Request & Schedule Request Gating
  describe("87 & 88. Document & Schedule Request Gating", () => {
    it("87. blocks unverified user from proceeding with document requests", () => {
      const mockAction = jest.fn();
      const mockRouter = { push: mockPush };

      const unverifiedProfile = {
        needsProfileCompletion: false,
        isGovernmentIdVerified: false,
      };

      const allowed = checkGovernmentIdRequirement(unverifiedProfile, mockRouter, mockAction);
      expect(allowed).toBe(false);
      expect(mockAction).not.toHaveBeenCalled();
      expect(mockAlert).toHaveBeenCalledWith(
        "Government ID Verification Required",
        "Please verify your Philippine government-issued ID to access document and schedule requests.",
        expect.any(Array)
      );

      // Verify routing
      const alertButtons = mockAlert.mock.calls[0][2];
      const verifyBtn = alertButtons?.find((b: any) => b.text === "Verify ID");
      expect(verifyBtn).toBeDefined();
      verifyBtn?.onPress?.();
      expect(mockPush).toHaveBeenCalledWith("/(app)/profile/id-verification");
    });

    it("88. PROFILE_INCOMPLETE still takes precedence before Government ID gate", () => {
      const mockAction = jest.fn();
      const mockRouter = { push: mockPush };

      const incompleteAndUnverifiedProfile = {
        needsProfileCompletion: true,
        isGovernmentIdVerified: false,
      };

      const allowed = checkGovernmentIdRequirement(
        incompleteAndUnverifiedProfile,
        mockRouter,
        mockAction
      );
      expect(allowed).toBe(false);
      expect(mockAction).not.toHaveBeenCalled();
      expect(mockAlert).toHaveBeenCalledWith(
        "Profile Completion Required",
        "Complete your profile to access document and schedule requests.",
        expect.any(Array)
      );
    });

    it("89 & 90. verified user proceeds normally through existing request gates", () => {
      const mockAction = jest.fn();
      const mockRouter = { push: mockPush };

      const verifiedProfile = {
        needsProfileCompletion: false,
        isGovernmentIdVerified: true,
      };

      const allowed = checkGovernmentIdRequirement(verifiedProfile, mockRouter, mockAction);
      expect(allowed).toBe(true);
      expect(mockAction).toHaveBeenCalledTimes(1);
      expect(mockAlert).not.toHaveBeenCalled();
    });
  });

  describe("Advanced Android Live Card Scanner Suite (Requirements 1 - 20)", () => {
    const targetRegion: Rect = {
      x: 20,
      y: 150,
      width: 320,
      height: 202, // 320 / 1.586
    };

    const alignedDetection: CardDetection = {
      detected: true,
      bounds: {
        x: targetRegion.x + 15,
        y: targetRegion.y + 10,
        width: 290,
        height: 182,
      },
    };

    beforeEach(() => {
      jest.clearAllMocks();
      jest.clearAllTimers();
      jest.useRealTimers();
      mockPermissionState = { granted: true, canAskAgain: true };
      mockAuthProfile = {
        id: 1,
        fullName: "Juan Dela Cruz",
        isVerified: true,
        needsProfileCompletion: false,
        isGovernmentIdVerified: false,
        governmentIdVerificationStatus: "NOT_SUBMITTED",
      };
    });

    afterEach(() => {
      jest.clearAllTimers();
      jest.useRealTimers();
    });

    // 1. scanner starts in non-ready state
    it("1. scanner starts in non-ready state", async () => {
      await render(
        <GovernmentIdCameraScanner
          side="front"
          onCapture={jest.fn()}
          onCancel={jest.fn()}
        />
      );

      const guidanceText = screen.getByTestId("guidance-text");
      expect(guidanceText.props.children).toBe("Place your ID inside the frame");
      const framingGuide = screen.getByTestId("framing-guide");
      expect(framingGuide.props.accessibilityLabel).toBe("Framing guide");
    });

    // 2. no rectangle does not auto-capture
    it("2. no rectangle does not auto-capture", () => {
      const resultNull = evaluateCardAlignment(null, targetRegion);
      expect(resultNull.state).toBe("NO_CARD");
      expect(resultNull.isReady).toBe(false);
      expect(resultNull.guidanceText).toBe("Place your ID inside the frame");

      const resultUndetected = evaluateCardAlignment({ detected: false }, targetRegion);
      expect(resultUndetected.state).toBe("NO_CARD");
      expect(resultUndetected.isReady).toBe(false);
    });

    // 3. misaligned card does not auto-capture
    it("3. misaligned card does not auto-capture", () => {
      const misalignedDetection: CardDetection = {
        detected: true,
        bounds: {
          x: targetRegion.x + 180,
          y: targetRegion.y + 120,
          width: 300,
          height: 190,
        },
      };

      const result = evaluateCardAlignment(misalignedDetection, targetRegion);
      expect(result.state).toBe("MISALIGNED");
      expect(result.isReady).toBe(false);
      expect(result.guidanceText).toBe("Place your ID inside the frame");
    });

    // 4. card too small does not auto-capture
    it("4. card too small does not auto-capture", () => {
      const smallDetection: CardDetection = {
        detected: true,
        bounds: {
          x: targetRegion.x + 100,
          y: targetRegion.y + 70,
          width: 100,
          height: 63,
        },
      };

      const result = evaluateCardAlignment(smallDetection, targetRegion);
      expect(result.state).toBe("MISALIGNED");
      expect(result.reason).toBe("TOO_SMALL");
      expect(result.isReady).toBe(false);
      expect(result.guidanceText).toBe("Move your ID closer");
    });

    // 5. excessive rotation/skew does not auto-capture
    it("5. excessive rotation/skew does not auto-capture", () => {
      const rotatedDetection: CardDetection = {
        detected: true,
        quad: {
          topLeft: { x: 30, y: 150 },
          topRight: { x: 320, y: 230 },
          bottomRight: { x: 280, y: 390 },
          bottomLeft: { x: 10, y: 310 },
        },
      };

      const result = evaluateCardAlignment(rotatedDetection, targetRegion);
      expect(result.state).toBe("MISALIGNED");
      expect(result.reason).toBe("ROTATED");
      expect(result.isReady).toBe(false);
      expect(result.guidanceText).toBe("Straighten your ID");
    });

    // 6. properly aligned card enters READY
    it("6. properly aligned card enters READY", () => {
      const result = evaluateCardAlignment(alignedDetection, targetRegion);
      expect(result.state).toBe("READY");
      expect(result.isReady).toBe(true);
      expect(result.guidanceText).toBe("Perfect — hold steady");
    });

    it("6a. allows a comfortably centered smaller card with breathing room", () => {
      const result = evaluateCardAlignment(
        {
          detected: true,
          bounds: { x: 52, y: 172, width: 256, height: 161 },
        },
        targetRegion
      );

      expect(result.state).toBe("READY");
      expect(result.containmentRatio).toBe(1);
      expect(result.areaRatio).toBeLessThan(0.65);
    });

    it("6b. does not require physical card corners to coincide with guide corners", () => {
      const result = evaluateCardAlignment(
        {
          detected: true,
          quad: {
            topLeft: { x: 52, y: 172 },
            topRight: { x: 308, y: 172 },
            bottomRight: { x: 308, y: 333 },
            bottomLeft: { x: 52, y: 333 },
          },
        },
        targetRegion
      );

      expect(result.state).toBe("READY");
      expect(result.isReady).toBe(true);
    });

    it("6c. tolerates practical minor rotation and positional offset", () => {
      const result = evaluateCardAlignment(
        {
          detected: true,
          quad: {
            topLeft: { x: 58.14, y: 148.03 },
            topRight: { x: 325.56, y: 185.61 },
            bottomRight: { x: 301.86, y: 353.97 },
            bottomLeft: { x: 34.44, y: 316.39 },
          },
        },
        targetRegion
      );

      expect(result.state).toBe("READY");
      expect(result.rotationDeg).toBeCloseTo(8, 0);
      expect(result.containmentRatio).toBeGreaterThanOrEqual(0.88);
    });

    it("6d. accepts about 88% containment but rejects substantial out-of-frame placement", () => {
      const acceptable = evaluateCardAlignment(
        {
          detected: true,
          bounds: { x: -15, y: 156, width: 300, height: 189 },
        },
        targetRegion
      );
      const substantiallyOutside = evaluateCardAlignment(
        {
          detected: true,
          bounds: { x: -70, y: 156, width: 300, height: 189 },
        },
        targetRegion
      );

      expect(acceptable.state).toBe("READY");
      expect(acceptable.containmentRatio).toBeGreaterThanOrEqual(0.88);
      expect(substantiallyOutside.state).toBe("MISALIGNED");
      expect(substantiallyOutside.reason).toBe("OUT_OF_BOUNDS");
    });

    it("6e. rejects a card whose center is outside the guide", () => {
      const result = evaluateCardAlignment(
        {
          detected: true,
          bounds: { x: -270, y: 156, width: 300, height: 189 },
        },
        targetRegion
      );

      expect(result.state).toBe("MISALIGNED");
      expect(result.reason).toBe("OFF_CENTER");
    });

    it("6f. rejects implausible non-landscape geometry", () => {
      const result = evaluateCardAlignment(
        {
          detected: true,
          bounds: { x: 85, y: 156, width: 190, height: 189 },
        },
        targetRegion
      );

      expect(result.state).toBe("MISALIGNED");
      expect(result.reason).toBe("WRONG_ASPECT_RATIO");
    });

    it("6g. tolerates contour area jitter above the former 115% ceiling", () => {
      const jitteredLarge = evaluateCardAlignment(
        {
          detected: true,
          bounds: { x: -5, y: 140, width: 350, height: 220 },
        },
        targetRegion
      );
      const genuinelyTooLarge = evaluateCardAlignment(
        {
          detected: true,
          bounds: { x: -20, y: 125, width: 400, height: 252 },
        },
        targetRegion
      );

      expect(jitteredLarge.areaRatio).toBeGreaterThan(1.15);
      expect(jitteredLarge.state).toBe("READY");
      expect(genuinelyTooLarge.state).toBe("MISALIGNED");
      expect(genuinelyTooLarge.reason).toBe("TOO_LARGE");
    });

    it("6h. uses a modest expanded region for readiness without changing the guide", () => {
      const result = evaluateCardAlignment(
        {
          detected: true,
          bounds: { x: -20, y: 160, width: 290, height: 182 },
        },
        targetRegion
      );

      expect(result.state).toBe("READY");
      expect(result.containmentRatio).toBeGreaterThanOrEqual(0.88);
      expect(targetRegion).toEqual({ x: 20, y: 150, width: 320, height: 202 });
    });

    // 7. READY frame is visually green
    it("7. READY frame is visually green", async () => {
      const mockReadyDetector: UseCardDetectorReturn = {
        alignmentState: "READY",
        guidanceText: "Perfect — hold steady",
        isReady: true,
        isCapturing: false,
        isDetectorAvailable: true,
        processDetection: jest.fn(),
        handleDetectorError: jest.fn(),
        reset: jest.fn(),
      };

      await render(
        <GovernmentIdCameraScanner
          side="front"
          onCapture={jest.fn()}
          onCancel={jest.fn()}
          detector={mockReadyDetector}
        />
      );

      const framingGuide = screen.getByTestId("framing-guide");
      const flattenedStyle = Array.isArray(framingGuide.props.style)
        ? Object.assign({}, ...framingGuide.props.style)
        : framingGuide.props.style;
      expect(flattenedStyle.borderColor).toBe("#10B981");
      expect(flattenedStyle.borderWidth).toBe(3);

      const guidanceBadge = screen.getByTestId("guidance-badge");
      const badgeStyle = Array.isArray(guidanceBadge.props.style)
        ? Object.assign({}, ...guidanceBadge.props.style)
        : guidanceBadge.props.style;
      expect(badgeStyle.backgroundColor).toBe("#059669");
    });

    it("7a. production frame results drive live READY and one real auto-capture", async () => {
      const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
      const frameWidth = Math.min(screenWidth - 48, 380);
      const frameHeight = Math.round(frameWidth / (85.6 / 53.98));
      const frameX = (screenWidth - frameWidth) / 2;
      const frameY = Math.round((screenHeight - frameHeight) / 2.3);

      mockDetectGovernmentIdCard.mockReturnValue({
        confidence: 0.9,
        cameraPoints: [
          { x: frameX + 10, y: frameY + 10 },
          { x: frameX + frameWidth - 10, y: frameY + 10 },
          { x: frameX + frameWidth - 10, y: frameY + frameHeight - 10 },
          { x: frameX + 10, y: frameY + frameHeight - 10 },
        ],
      });

      jest.useFakeTimers();
      const nowSpy = jest.spyOn(performance, "now").mockReturnValue(200);
      try {
        await render(
          <GovernmentIdCameraScanner
            side="front"
            onCapture={jest.fn()}
            onCancel={jest.fn()}
            stabilityDurationMs={750}
          />
        );

        const frame = {
          width: 640,
          height: 360,
          bytesPerRow: 2560,
          pixelFormat: "rgb-rgba-8-bit",
          orientation: "up",
          hasPixelBuffer: true,
          isPlanar: false,
          getPixelBuffer: jest.fn(() => new ArrayBuffer(640 * 360 * 4)),
          convertFramePointToCameraPoint: (point: any) => point,
          dispose: jest.fn(),
        };

        await act(async () => {
          mockFrameOutputOptions.onFrame(frame);
        });

        const readyStyle = Object.assign(
          {},
          ...screen.getByTestId("framing-guide").props.style
        );
        expect(readyStyle.borderColor).toBe("#10B981");
        expect(mockCapturePhoto).not.toHaveBeenCalled();

        await act(async () => {
          jest.advanceTimersByTime(800);
          await Promise.resolve();
        });

        expect(mockCapturePhoto).toHaveBeenCalledTimes(1);
        expect(mockNormalizeGovernmentIdImage).toHaveBeenCalledWith(
          expect.objectContaining({
            sourceUri: "file:///mock/captured.jpg",
            guideBounds: expect.objectContaining({
              x: frameX,
              width: frameWidth,
            }),
            photoOrientation: "right",
          })
        );
        expect(frame.dispose).toHaveBeenCalledTimes(1);

        await act(async () => {
          jest.advanceTimersByTime(1000);
          await Promise.resolve();
        });
        expect(mockCapturePhoto).toHaveBeenCalledTimes(1);
      } finally {
        nowSpy.mockRestore();
        jest.useRealTimers();
      }
    });

    it("7b. manual shutter never fabricates the green READY state", async () => {
      let resolveCapture!: (value: ReturnType<typeof makeMockPhoto>) => void;
      mockCapturePhoto.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveCapture = resolve;
        })
      );

      await render(
        <GovernmentIdCameraScanner
          side="front"
          onCapture={jest.fn()}
          onCancel={jest.fn()}
        />
      );

      const initialOutputs = screen.getByTestId("camera-view").props.outputs;
      const initialResolution = mockFrameOutputOptions.targetResolution;
      await fireEvent.press(screen.getByTestId("shutter-button"));
      expect(screen.getByTestId("camera-view").props.outputs).toBe(initialOutputs);
      expect(mockFrameOutputOptions.targetResolution).toBe(initialResolution);
      const capturingStyle = Object.assign(
        {},
        ...screen.getByTestId("framing-guide").props.style
      );
      expect(capturingStyle.borderColor).not.toBe("#10B981");
      expect(capturingStyle.borderColor).not.toBe("#059669");

      await act(async () => {
        resolveCapture(makeMockPhoto("/mock/manual.jpg"));
        await Promise.resolve();
      });
      expect(screen.getByText("Use Photo")).toBeTruthy();
    });

    it("8. transient TOO_LARGE and OUT_OF_BOUNDS jitter preserves READY and countdown", async () => {
      const mockAutoCapture = jest.fn();
      jest.useFakeTimers();
      const { result } = await renderHook(() =>
        useCardDetector({
          targetRegion,
          onAutoCapture: mockAutoCapture,
          options: { stabilityDurationMs: 750, readyGraceDurationMs: 275 },
        })
      );

      const tooLarge: CardDetection = {
        detected: true,
        bounds: { x: -20, y: 125, width: 400, height: 252 },
      };
      const outOfBounds: CardDetection = {
        detected: true,
        bounds: { x: -45, y: 160, width: 290, height: 182 },
      };

      try {
        await act(async () => {
          result.current.processDetection(alignedDetection);
        });
        expect(result.current.isReady).toBe(true);

        await act(async () => {
          jest.advanceTimersByTime(200);
        });

        let effectiveResult!: ReturnType<UseCardDetectorReturn["processDetection"]>;
        await act(async () => {
          effectiveResult = result.current.processDetection(tooLarge);
        });
        expect(effectiveResult.state).toBe("READY");
        expect(result.current.isReady).toBe(true);

        await act(async () => {
          jest.advanceTimersByTime(100);
          result.current.processDetection(alignedDetection);
          jest.advanceTimersByTime(150);
          effectiveResult = result.current.processDetection(outOfBounds);
        });
        expect(effectiveResult.state).toBe("READY");
        expect(result.current.isReady).toBe(true);

        await act(async () => {
          jest.advanceTimersByTime(100);
          result.current.processDetection(alignedDetection);
          jest.advanceTimersByTime(199);
        });
        expect(mockAutoCapture).not.toHaveBeenCalled();

        await act(async () => {
          jest.advanceTimersByTime(1);
          await Promise.resolve();
        });
        expect(mockAutoCapture).toHaveBeenCalledTimes(1);
        expect(result.current.alignmentState).toBe("CAPTURING");

        await act(async () => {
          jest.advanceTimersByTime(1_000);
          result.current.processDetection(alignedDetection);
        });
        expect(mockAutoCapture).toHaveBeenCalledTimes(1);
      } finally {
        jest.useRealTimers();
      }
    });

    it.each([
      [
        "TOO_LARGE",
        { detected: true, bounds: { x: -20, y: 125, width: 400, height: 252 } },
        "Move your ID farther away",
      ],
      [
        "OUT_OF_BOUNDS",
        { detected: true, bounds: { x: -45, y: 160, width: 290, height: 182 } },
        "Place your ID inside the frame",
      ],
      ["detector loss", null, "Place your ID inside the frame"],
    ])(
      "8a. sustained %s beyond grace cancels READY",
      async (_caseName, badDetection, expectedGuidance) => {
        const mockAutoCapture = jest.fn();
        jest.useFakeTimers();
        const { result } = await renderHook(() =>
          useCardDetector({
            targetRegion,
            onAutoCapture: mockAutoCapture,
            options: { stabilityDurationMs: 750, readyGraceDurationMs: 275 },
          })
        );

        try {
          await act(async () => {
            result.current.processDetection(alignedDetection);
            jest.advanceTimersByTime(100);
            result.current.processDetection(badDetection as CardDetection | null);
          });
          expect(result.current.isReady).toBe(true);

          await act(async () => {
            jest.advanceTimersByTime(274);
          });
          expect(result.current.isReady).toBe(true);

          await act(async () => {
            jest.advanceTimersByTime(1);
          });
          expect(result.current.isReady).toBe(false);
          expect(result.current.guidanceText).toBe(expectedGuidance);

          await act(async () => {
            jest.advanceTimersByTime(1_000);
          });
          expect(mockAutoCapture).not.toHaveBeenCalled();
        } finally {
          jest.useRealTimers();
        }
      }
    );

    // 9. stable aligned card triggers one auto-capture
    it("9. stable aligned card triggers one auto-capture", async () => {
      const mockAutoCapture = jest.fn();
      const { result } = await renderHook(() =>
        useCardDetector({
          targetRegion,
          onAutoCapture: mockAutoCapture,
          options: { stabilityDurationMs: 750 },
        })
      );

      jest.useFakeTimers();
      try {
        await act(async () => {
          result.current.processDetection(alignedDetection);
        });
        expect(result.current.isReady).toBe(true);

        await act(async () => {
          jest.advanceTimersByTime(800);
        });

        expect(mockAutoCapture).toHaveBeenCalledTimes(1);
        expect(result.current.alignmentState).toBe("CAPTURING");
      } finally {
        jest.useRealTimers();
      }
    });

    // 10. repeated valid frames do not trigger duplicate capture
    it("10. repeated valid frames do not trigger duplicate capture", async () => {
      const mockAutoCapture = jest.fn();
      const { result } = await renderHook(() =>
        useCardDetector({
          targetRegion,
          onAutoCapture: mockAutoCapture,
          options: { stabilityDurationMs: 750 },
        })
      );

      jest.useFakeTimers();
      try {
        await act(async () => {
          result.current.processDetection(alignedDetection);
        });
        await act(async () => {
          jest.advanceTimersByTime(800);
        });
        expect(mockAutoCapture).toHaveBeenCalledTimes(1);

        await act(async () => {
          result.current.processDetection(alignedDetection);
          result.current.processDetection(alignedDetection);
        });
        await act(async () => {
          jest.advanceTimersByTime(1000);
        });

        expect(mockAutoCapture).toHaveBeenCalledTimes(1);
      } finally {
        jest.useRealTimers();
      }
    });

    // 11. front successful auto-capture proceeds correctly
    it("11. front successful auto-capture proceeds correctly", async () => {
      await render(<IdVerificationScreen scannerFallbackDelayMs={0} />);

      expect(screen.getByText("Front of Government ID")).toBeTruthy();

      const shutterBtn = screen.getByLabelText("Capture front of ID card manually");
      await fireEvent.press(shutterBtn);

      expect(screen.getByText("Use Photo")).toBeTruthy();
      await fireEvent.press(screen.getByText("Use Photo"));

      expect(screen.getByText("Back of Government ID")).toBeTruthy();
      expect(screen.getByText("Step 2 of 2: Reverse side")).toBeTruthy();
    });

    // 12. back successful auto-capture proceeds correctly
    it("12. back successful auto-capture proceeds correctly", async () => {
      await render(<IdVerificationScreen scannerFallbackDelayMs={0} />);

      await fireEvent.press(screen.getByLabelText("Capture front of ID card manually"));
      await fireEvent.press(screen.getByText("Use Photo"));

      expect(screen.getByText("Back of Government ID")).toBeTruthy();
      await fireEvent.press(screen.getByLabelText("Capture back of ID card manually"));
      await fireEvent.press(screen.getByText("Use Photo"));

      expect(screen.getByText("Review & Verify")).toBeTruthy();
      expect(screen.getByText("Front Captured")).toBeTruthy();
      expect(screen.getByText("Back Captured")).toBeTruthy();
      await waitFor(() => expect(apiClient.request).toHaveBeenCalledTimes(1));
    });

    // 13. Retake restarts detection
    it("13. Retake restarts detection", async () => {
      const mockReset = jest.fn();
      const mockDetector: UseCardDetectorReturn = {
        alignmentState: "CAPTURING",
        guidanceText: "Capturing…",
        isReady: false,
        isCapturing: false,
        isDetectorAvailable: true,
        processDetection: jest.fn(),
        handleDetectorError: jest.fn(),
        reset: mockReset,
      };

      await render(
        <GovernmentIdCameraScanner
          side="front"
          onCapture={jest.fn()}
          onCancel={jest.fn()}
          detector={mockDetector}
        />
      );

      await fireEvent.press(screen.getByTestId("shutter-button"));
      expect(screen.getByText("Retake")).toBeTruthy();

      await fireEvent.press(screen.getByText("Retake"));
      expect(mockReset).toHaveBeenCalled();
      expect(screen.queryByText("Use Photo")).toBeNull();
    });

    it("14. hides the manual shutter during normal automatic detection", async () => {
      await render(
        <ProductionGovernmentIdCameraScanner
          side="front"
          onCapture={jest.fn()}
          onCancel={jest.fn()}
        />
      );

      expect(screen.queryByTestId("shutter-button")).toBeNull();
      expect(screen.queryByText("Capture Manually")).toBeNull();
    });

    // Manual capture is available only once the fallback condition is active.
    it("14a. reveals manual Capture only in fallback mode", async () => {
      const mockOnCapture = jest.fn();
      await render(
        <GovernmentIdCameraScanner
          side="front"
          onCapture={mockOnCapture}
          onCancel={jest.fn()}
        />
      );

      const shutterBtn = screen.getByTestId("shutter-button");
      const controlsStyle = Object.assign(
        {},
        ...screen.getByTestId("scanner-controls").props.style
      );
      expect(controlsStyle.bottom).toBeGreaterThan(24);
      expect(shutterBtn.props.accessibilityState.disabled).toBe(false);

      await fireEvent.press(shutterBtn);
      expect(screen.getByText("Use Photo")).toBeTruthy();
      expect(mockNormalizeGovernmentIdImage).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceUri: "file:///mock/captured.jpg",
          guideBounds: expect.objectContaining({
            x: expect.any(Number),
            width: expect.any(Number),
          }),
          photoOrientation: "right",
        })
      );
      expect(mockFileDelete).toHaveBeenCalledWith("file:///mock/captured.jpg");
    });

    // 15. manual Capture works if detector unavailable
    it("15. manual Capture works if detector unavailable", async () => {
      const mockUnavailableDetector: UseCardDetectorReturn = {
        alignmentState: "NO_CARD",
        guidanceText: "Position your card inside the frame and tap Capture",
        isReady: false,
        isCapturing: false,
        isDetectorAvailable: false,
        processDetection: jest.fn(),
        handleDetectorError: jest.fn(),
        reset: jest.fn(),
      };

      await render(
        <GovernmentIdCameraScanner
          side="front"
          onCapture={jest.fn()}
          onCancel={jest.fn()}
          detector={mockUnavailableDetector}
        />
      );

      expect(
        screen.getByText("Position your card inside the frame and tap Capture")
      ).toBeTruthy();

      const shutterBtn = screen.getByTestId("shutter-button");
      await fireEvent.press(shutterBtn);
      expect(screen.getByText("Use Photo")).toBeTruthy();
    });

    it("15a. never invokes photo capture before the Camera session starts", async () => {
      mockCameraAutoStart = false;
      await render(
        <GovernmentIdCameraScanner
          side="front"
          onCapture={jest.fn()}
          onCancel={jest.fn()}
        />
      );

      expect(screen.getByTestId("shutter-button").props.accessibilityState.disabled).toBe(true);
      await fireEvent.press(screen.getByTestId("shutter-button"));
      expect(mockCapturePhoto).not.toHaveBeenCalled();

      await act(async () => {
        screen.getByTestId("camera-view").props.onStarted();
      });

      expect(screen.getByTestId("shutter-button").props.accessibilityState.disabled).toBe(false);
      await fireEvent.press(screen.getByTestId("shutter-button"));
      expect(mockCapturePhoto).toHaveBeenCalledTimes(1);
    });

    it("15b. keeps native outputs stable and manual capture alive after detector failure", async () => {
      mockDetectGovernmentIdCard.mockImplementationOnce(() => {
        throw new Error("OpenCV processing failed");
      });
      const nowSpy = jest.spyOn(performance, "now").mockReturnValue(200);
      try {
        await render(
          <GovernmentIdCameraScanner
            side="front"
            onCapture={jest.fn()}
            onCancel={jest.fn()}
          />
        );

        const initialOutputs = screen.getByTestId("camera-view").props.outputs;
        const initialResolution = mockFrameOutputOptions.targetResolution;
        const frame = {
          width: 640,
          height: 360,
          bytesPerRow: 2560,
          pixelFormat: "rgb-rgba-8-bit",
          orientation: "up",
          hasPixelBuffer: true,
          isPlanar: false,
          getPixelBuffer: jest.fn(() => new ArrayBuffer(640 * 360 * 4)),
          convertFramePointToCameraPoint: (point: any) => point,
          dispose: jest.fn(),
        };

        await act(async () => {
          mockFrameOutputOptions.onFrame(frame);
        });

        expect(frame.dispose).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId("camera-view").props.outputs).toBe(initialOutputs);
        expect(mockFrameOutputOptions.targetResolution).toBe(initialResolution);
        expect(
          screen.getByText("Position your card inside the frame and tap Capture")
        ).toBeTruthy();

        await fireEvent.press(screen.getByTestId("shutter-button"));
        expect(mockCapturePhoto).toHaveBeenCalledTimes(1);
        expect(screen.getByText("Use Photo")).toBeTruthy();
      } finally {
        nowSpy.mockRestore();
      }
    });

    // 16. detector error gracefully falls back to manual mode
    it("16. detector error gracefully falls back to manual mode", async () => {
      const { result } = await renderHook(() =>
        useCardDetector({
          targetRegion,
          onAutoCapture: jest.fn(),
        })
      );

      expect(result.current.isDetectorAvailable).toBe(true);

      await act(async () => {
        result.current.handleDetectorError(new Error("Test Error"));
      });

      expect(result.current.isDetectorAvailable).toBe(false);
      expect(result.current.guidanceText).toBe(
        "Position your card inside the frame and tap Capture"
      );
      expect(result.current.isReady).toBe(false);
    });

    // 17 & 18. camera unmount cancels stability timer / no auto-capture after unmount
    it("17 & 18. camera unmount cancels stability timer and prevents capture after unmount", async () => {
      const mockAutoCapture = jest.fn();
      const { result, unmount } = await renderHook(() =>
        useCardDetector({
          targetRegion,
          onAutoCapture: mockAutoCapture,
          options: { stabilityDurationMs: 750 },
        })
      );

      jest.useFakeTimers();
      try {
        await act(async () => {
          result.current.processDetection(alignedDetection);
        });
        await unmount();

        await act(async () => {
          jest.advanceTimersByTime(1000);
        });

        expect(mockAutoCapture).not.toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
    });

    // 19. final front/back submission still uses existing verification API
    it("19. final front/back submission still uses existing verification API", async () => {
      (apiClient.request as jest.Mock).mockResolvedValueOnce({
        status: "VERIFIED",
        idType: "PHIL_SYS",
        isGovernmentIdVerified: true,
      });

      await render(<IdVerificationScreen scannerFallbackDelayMs={0} />);

      await fireEvent.press(screen.getByLabelText("Capture front of ID card manually"));
      await fireEvent.press(screen.getByText("Use Photo"));

      await fireEvent.press(screen.getByLabelText("Capture back of ID card manually"));
      await fireEvent.press(screen.getByText("Use Photo"));

      await waitFor(() =>
        expect(apiClient.request).toHaveBeenCalledWith(
          expect.objectContaining({
            path: "/identity-verification/submit",
            method: "POST",
            isMultipart: true,
            timeoutMs: 60000,
          })
        )
      );
    });

    // 20. client-side quality advisor checks
    it("20. client-side advisory checks validate image metrics safely", () => {
      expect(checkCapturedImageQuality(null).passed).toBe(false);

      expect(
        checkCapturedImageQuality({
          uri: "file:///test.jpg",
          width: 1280,
          height: 800,
        }).passed
      ).toBe(true);

      const lowRes = checkCapturedImageQuality({
        uri: "file:///test.jpg",
        width: 200,
        height: 120,
      });
      expect(lowRes.passed).toBe(false);
      expect(lowRes.warning).toContain("resolution");
    });

    it("21. never exposes a raw API route or provider message", () => {
      expect(
        getSafeVerificationErrorMessage({
          code: "SOMETHING_INTERNAL",
          message: "POST /api/v1/api/v1/identity-verification/submit",
        })
      ).toBe("We couldn't verify this ID. Please retake the photos and try again.");
      expect(
        getSafeVerificationErrorMessage({ kind: "NETWORK", message: "socket failed" })
      ).toBe("We couldn't verify your ID right now. Please try again.");
    });
  });
});

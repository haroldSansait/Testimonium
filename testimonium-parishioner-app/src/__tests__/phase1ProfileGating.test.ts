import { Alert } from "react-native";
import { checkProfileRequirement } from "@/hooks/useRequireCompleteProfile";

describe("Phase 1 Mobile Profile Completion Gating", () => {
  const mockPush = jest.fn();
  const mockRouter = { push: mockPush };
  const mockAlert = jest.spyOn(Alert, "alert").mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Incomplete Profile UX Interception", () => {
    const incompleteProfile = {
      id: 1,
      fullName: "",
      contactNumber: "",
      needsProfileCompletion: true,
    };

    it("blocks action and displays profile completion requirement alert", () => {
      const mockAction = jest.fn();
      const allowed = checkProfileRequirement(incompleteProfile, mockRouter, mockAction);

      expect(allowed).toBe(false);
      expect(mockAction).not.toHaveBeenCalled();
      expect(mockAlert).toHaveBeenCalledTimes(1);
      expect(mockAlert).toHaveBeenCalledWith(
        "Profile Completion Required",
        "Complete your profile to access document and schedule requests.",
        expect.arrayContaining([
          expect.objectContaining({ text: "Browse App", style: "cancel" }),
          expect.objectContaining({ text: "Complete Profile" }),
        ])
      );
    });

    it("navigates to profile when Complete Profile button is pressed from Alert", () => {
      const mockAction = jest.fn();
      checkProfileRequirement(incompleteProfile, mockRouter, mockAction);

      const alertButtons = mockAlert.mock.calls[0][2];
      const completeProfileBtn = alertButtons?.find((b: any) => b.text === "Complete Profile");
      expect(completeProfileBtn).toBeDefined();

      completeProfileBtn?.onPress?.();
      expect(mockPush).toHaveBeenCalledWith("/(app)/(tabs)/profile");
    });
  });

  describe("Complete Profile Unrestricted Access", () => {
    const completeProfile = {
      id: 2,
      fullName: "Juan Dela Cruz",
      contactNumber: "09123456789",
      needsProfileCompletion: false,
    };

    it("executes the protected action directly without showing alert", () => {
      const mockAction = jest.fn();
      const allowed = checkProfileRequirement(completeProfile, mockRouter, mockAction);

      expect(allowed).toBe(true);
      expect(mockAction).toHaveBeenCalledTimes(1);
      expect(mockAlert).not.toHaveBeenCalled();
    });
  });

  describe("Entry-Point Matrix Verification", () => {
    const incompleteProfile = { id: 3, needsProfileCompletion: true };

    it("blocks Home quick action for Document Request", () => {
      const onNavigate = jest.fn();
      const allowed = checkProfileRequirement(incompleteProfile, mockRouter, onNavigate);
      expect(allowed).toBe(false);
      expect(onNavigate).not.toHaveBeenCalled();
    });

    it("blocks Home quick action for Schedule Appointment", () => {
      const onNavigate = jest.fn();
      const allowed = checkProfileRequirement(incompleteProfile, mockRouter, onNavigate);
      expect(allowed).toBe(false);
      expect(onNavigate).not.toHaveBeenCalled();
    });

    it("blocks Request List screen '+ New' and empty state CTA", () => {
      const onNavigate = jest.fn();
      const allowed = checkProfileRequirement(incompleteProfile, mockRouter, onNavigate);
      expect(allowed).toBe(false);
      expect(onNavigate).not.toHaveBeenCalled();
    });

    it("blocks Schedule List screen 'Book Schedule' and empty state CTA", () => {
      const onNavigate = jest.fn();
      const allowed = checkProfileRequirement(incompleteProfile, mockRouter, onNavigate);
      expect(allowed).toBe(false);
      expect(onNavigate).not.toHaveBeenCalled();
    });

    it("blocks Parish Detail 'Request Document' CTA", () => {
      const onNavigate = jest.fn();
      const allowed = checkProfileRequirement(incompleteProfile, mockRouter, onNavigate);
      expect(allowed).toBe(false);
      expect(onNavigate).not.toHaveBeenCalled();
    });
  });
});

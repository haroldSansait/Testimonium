import React from "react";
import { Animated, Text, TouchableOpacity, View } from "react-native";
import { cleanup, fireEvent, render } from "@testing-library/react-native";
import { FeedbackProvider, useFeedback } from "@/providers/FeedbackProvider";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

beforeAll(() => {
  jest.spyOn(Animated, "timing").mockImplementation(() => ({
    start: (cb?: any) => cb && cb({ finished: true }),
    stop: jest.fn(),
    reset: jest.fn(),
  } as any));

  jest.spyOn(Animated, "spring").mockImplementation(() => ({
    start: (cb?: any) => cb && cb({ finished: true }),
    stop: jest.fn(),
    reset: jest.fn(),
  } as any));

  jest.spyOn(Animated, "parallel").mockImplementation(() => ({
    start: (cb?: any) => cb && cb({ finished: true }),
    stop: jest.fn(),
    reset: jest.fn(),
  } as any));
});

afterEach(() => {
  cleanup();
});

const FeedbackActionTester: React.FC<{
  onConfirmCallback?: () => void;
}> = ({ onConfirmCallback }) => {
  const feedback = useFeedback();

  return (
    <View testID="test-container">
      <TouchableOpacity
        testID="btn-success"
        onPress={() =>
          feedback.showSuccess("Success Dialog", "Application was saved", {
            referenceNumber: "AUTH-REF-12345",
          })
        }
      >
        <Text>Trigger Success Modal</Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="btn-error"
        onPress={() =>
          feedback.showError("Error Dialog", "Could not submit application")
        }
      >
        <Text>Trigger Error Modal</Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="btn-confirm"
        onPress={() =>
          feedback.showConfirm(
            "Confirm Cancel?",
            "Are you sure you want to cancel?",
            onConfirmCallback || jest.fn(),
            {
              confirmText: "Yes, Cancel",
              cancelText: "No, Keep",
              isDestructive: true,
            }
          )
        }
      >
        <Text>Trigger Confirm Modal</Text>
      </TouchableOpacity>
    </View>
  );
};

describe("FeedbackProvider Integration", () => {
  it("opens success modal with reference number and dismisses cleanly", async () => {
    const { findByTestId, findByText } = await render(
      <FeedbackProvider>
        <FeedbackActionTester />
      </FeedbackProvider>
    );

    const triggerBtn = await findByTestId("btn-success");
    fireEvent.press(triggerBtn);

    expect(await findByText("Success Dialog")).toBeTruthy();
    expect(await findByText("AUTH-REF-12345")).toBeTruthy();
  });

  it("isolates reference number between modal calls so next modal does not retain previous reference", async () => {
    const { findByTestId, findByText, queryByText } = await render(
      <FeedbackProvider>
        <FeedbackActionTester />
      </FeedbackProvider>
    );

    // 1. Open success modal with reference number
    fireEvent.press(await findByTestId("btn-success"));
    expect(await findByText("AUTH-REF-12345")).toBeTruthy();

    // 2. Dismiss modal
    const okBtn = await findByTestId("feedback-modal-confirm-btn");
    fireEvent.press(okBtn);

    // 3. Open error modal without reference number
    fireEvent.press(await findByTestId("btn-error"));
    expect(await findByText("Error Dialog")).toBeTruthy();

    // Verify previous reference number was cleared and is NOT retained
    expect(queryByText("AUTH-REF-12345")).toBeNull();
  });

  it("enforces single-fire confirm in FeedbackProvider", async () => {
    const onConfirmMock = jest.fn();

    const { findByTestId, findByText } = await render(
      <FeedbackProvider>
        <FeedbackActionTester onConfirmCallback={onConfirmMock} />
      </FeedbackProvider>
    );

    fireEvent.press(await findByTestId("btn-confirm"));
    expect(await findByText("Confirm Cancel?")).toBeTruthy();

    const confirmBtn = await findByTestId("feedback-modal-confirm-btn");
    fireEvent.press(confirmBtn);
    fireEvent.press(confirmBtn);

    expect(onConfirmMock).toHaveBeenCalledTimes(1);
  });
});

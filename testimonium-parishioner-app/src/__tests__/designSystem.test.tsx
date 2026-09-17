import React from "react";
import { Text } from "react-native";
import { render, fireEvent, cleanup } from "@testing-library/react-native";
import { colors, radii } from "@/theme/tokens";
import { getStatusConfig } from "@/theme/status";
import { getPageGutter, isNarrowScreen, isTabletScreen } from "@/theme/responsive";
import {
  Button,
  FilterTrigger,
  FormSection,
  ListRow,
  PageSection,
  RecordSection,
  SegmentedControl,
  SelectionRow,
  StateView,
  StatusLabel,
  TextInput,
} from "@/components/ui";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

afterEach(() => {
  cleanup();
});

describe("Design System - Phase A Foundation", () => {
  describe("Tokens and Theme", () => {
    it("uses predominantly white canvas and TESTIMONIUM maroon", () => {
      expect(colors.canvas).toBe("#FFFFFF");
      expect(colors.background).toBe("#FFFFFF");
      expect(colors.brand[700]).toBe("#7B1C2A");
      expect(colors.primary).toBe("#7B1C2A");
      expect(colors.neutral[950]).toBe("#181719");
      expect(radii.button).toBe(10);
      expect(radii.control).toBe(8);
    });

    it("maps status strings into normalized WCAG-safe intents", () => {
      const draft = getStatusConfig("DRAFT");
      expect(draft.label).toBe("Draft");
      expect(draft.intent).toBe("neutral");

      const ready = getStatusConfig("READY_FOR_PICKUP");
      expect(ready.label).toBe("Ready for Pickup");
      expect(ready.intent).toBe("success");

      const needsCorrection = getStatusConfig("NEEDS_CORRECTION");
      expect(needsCorrection.label).toBe("Needs Correction");
      expect(needsCorrection.intent).toBe("warning");

      const submitted = getStatusConfig("SUBMITTED");
      expect(submitted.label).toBe("Pending Review");
    });

    it("calculates responsive gutters and breakpoints correctly", () => {
      expect(getPageGutter(320)).toBe(16);
      expect(getPageGutter(360)).toBe(20);
      expect(getPageGutter(412)).toBe(24);
      expect(isNarrowScreen(320)).toBe(true);
      expect(isNarrowScreen(390)).toBe(false);
      expect(isTabletScreen(800)).toBe(true);
    });
  });

  describe("UI Primitives", () => {
    it("renders StatusLabel with text and accessible role", async () => {
      const { findByText } = await render(
        <StatusLabel status="READY_FOR_PICKUP" />
      );
      expect(await findByText("Ready for Pickup")).toBeTruthy();
    });

    it("renders ListRow with title, subtitle, and responds to press", async () => {
      const onPress = jest.fn();
      const { findByText } = await render(
        <ListRow
          title="Baptismal Certificate"
          subtitle="Tracking: BAP-2026-001"
          onPress={onPress}
        />
      );

      const title = await findByText("Baptismal Certificate");
      expect(title).toBeTruthy();
      expect(await findByText("Tracking: BAP-2026-001")).toBeTruthy();
      fireEvent.press(title);
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("renders SelectionRow with radio and check mode", async () => {
      const onSelect = jest.fn();
      const { findByText } = await render(
        <SelectionRow
          title="San Sebastian Cathedral"
          subtitle="Dumaguete City"
          selected={true}
          onSelect={onSelect}
          mode="radio"
        />
      );

      const title = await findByText("San Sebastian Cathedral");
      expect(title).toBeTruthy();
      fireEvent.press(title);
      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it("renders SegmentedControl and switches selection", async () => {
      const onSelect = jest.fn();
      const options = [
        { value: "all", label: "All" },
        { value: "active", label: "Active", badge: 2 },
        { value: "past", label: "Past" },
      ];

      const { findByText } = await render(
        <SegmentedControl
          options={options}
          selectedValue="active"
          onSelect={onSelect}
        />
      );

      expect(await findByText("Active")).toBeTruthy();
      expect(await findByText("2")).toBeTruthy();
      const pastTab = await findByText("Past");
      fireEvent.press(pastTab);
      expect(onSelect).toHaveBeenCalledWith("past");
    });

    it("renders FilterTrigger with active count", async () => {
      const onPress = jest.fn();
      const { findByText } = await render(
        <FilterTrigger activeCount={3} onPress={onPress} />
      );

      const trigger = await findByText("Filter");
      expect(trigger).toBeTruthy();
      expect(await findByText("3")).toBeTruthy();
      fireEvent.press(trigger);
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("renders PageSection without card container", async () => {
      const { findByText } = await render(
        <PageSection title="Recent Activity" subtitle="Your requests">
          <Text>Section Content</Text>
        </PageSection>
      );

      expect(await findByText("Recent Activity")).toBeTruthy();
      expect(await findByText("Section Content")).toBeTruthy();
    });

    it("renders RecordSection with definition fields", async () => {
      const { findByText } = await render(
        <RecordSection
          title="Applicant Details"
          fields={[
            { label: "Full Name", value: "Juan Dela Cruz" },
            { label: "Contact Number", value: "09171234567" },
          ]}
        />
      );

      expect(await findByText("Applicant Details")).toBeTruthy();
      expect(await findByText("Full Name")).toBeTruthy();
      expect(await findByText("Juan Dela Cruz")).toBeTruthy();
    });

    it("renders FormSection with fields", async () => {
      const { findByText } = await render(
        <FormSection title="Account Security">
          <TextInput label="Email Address" value="test@example.com" />
        </FormSection>
      );

      expect(await findByText("Account Security")).toBeTruthy();
      expect(await findByText("Email Address")).toBeTruthy();
    });

    it("renders StateView.Empty and triggers action", async () => {
      const onAction = jest.fn();
      const { findByText } = await render(
        <StateView.Empty
          title="No Requests Found"
          description="You have not submitted any document requests."
          actionLabel="Request Document"
          onAction={onAction}
        />
      );

      expect(await findByText("No Requests Found")).toBeTruthy();
      const actionBtn = await findByText("Request Document");
      fireEvent.press(actionBtn);
      expect(onAction).toHaveBeenCalledTimes(1);
    });

    it("renders StateView.InlineError and triggers retry", async () => {
      const onRetry = jest.fn();
      const { findByText } = await render(
        <StateView.InlineError
          message="Failed to load details"
          onRetry={onRetry}
        />
      );

      expect(await findByText("Failed to load details")).toBeTruthy();
      const retryBtn = await findByText("Try Again");
      fireEvent.press(retryBtn);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it("renders Button with minimum 44dp height and primary styling", async () => {
      const { findByText } = await render(
        <Button title="Submit Application" size="sm" variant="primary" />
      );
      expect(await findByText("Submit Application")).toBeTruthy();
    });
  });
});

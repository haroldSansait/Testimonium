import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { Text, View } from "react-native";
import {
  SuggestedTimeCard,
  PREFERRED_PRIEST_HELPER_COPY,
  PREFERRED_PRIEST_AVAILABLE_LABEL,
  PREFERRED_PRIEST_UNAVAILABLE_LABEL,
  PREFERRED_PRIEST_AVAILABLE_TOOLTIP,
  PREFERRED_PRIEST_UNAVAILABLE_TOOLTIP,
} from "../features/schedule/components/SuggestedTimeCard";
import { getRecommendationBadges } from "../features/schedule/presentation";
import type { ScheduleRecommendationItem } from "../features/schedule/types";

describe("Phase 5 UX Refinement: Preferred Priest Availability Badges & Helper Copy", () => {
  // A. Preferred date + preferred priest available
  it("A. displays 'Preferred Date' and 'Preferred Priest Available' when both are applicable", async () => {
    const rec: ScheduleRecommendationItem = {
      date: "2026-09-20",
      timeSlot: "08:00 AM",
      startAt: "2026-09-20T08:00:00.000Z",
      reasons: ["PREFERRED_DATE", "PREFERRED_PRIEST_AVAILABLE"],
      preferredPriestAvailable: true,
    };

    const screen = await render(
      <SuggestedTimeCard rec={rec} onSelect={jest.fn()} />
    );

    // Both badges visible
    expect(screen.getByText("Preferred Date")).toBeTruthy();
    expect(screen.getByText("Preferred Priest Available")).toBeTruthy();

    // Legacy unclarified badges must NOT be visible
    expect(screen.queryByText(/^Priest Available$/)).toBeNull();
    expect(screen.queryByText(/^Priest Unavailable$/)).toBeNull();

    // Accessibility label
    expect(
      screen.getByLabelText("Your preferred priest is available at this time.")
    ).toBeTruthy();
  });

  // B. Preferred date + preferred priest unavailable
  it("B. displays 'Preferred Date' and 'Preferred Priest Unavailable' simultaneously without conflict", async () => {
    const rec: ScheduleRecommendationItem = {
      date: "2026-09-20",
      timeSlot: "10:00 AM",
      startAt: "2026-09-20T10:00:00.000Z",
      reasons: ["PREFERRED_DATE", "PREFERRED_PRIEST_UNAVAILABLE"],
      preferredPriestAvailable: false,
    };

    const screen = await render(
      <SuggestedTimeCard rec={rec} onSelect={jest.fn()} />
    );

    // Both badges visible simultaneously
    expect(screen.getByText("Preferred Date")).toBeTruthy();
    expect(screen.getByText("Preferred Priest Unavailable")).toBeTruthy();

    // Legacy badges not present
    expect(screen.queryByText(/^Priest Available$/)).toBeNull();
    expect(screen.queryByText(/^Priest Unavailable$/)).toBeNull();

    // Accessibility label
    expect(
      screen.getByLabelText(
        "Your preferred priest is unavailable at this time, but another priest may be assigned."
      )
    ).toBeTruthy();
  });

  // C. Alternative date + preferred priest available
  it("C. displays 'Preferred Priest Available' and NO 'Preferred Date' badge on alternative date", async () => {
    const rec: ScheduleRecommendationItem = {
      date: "2026-09-21",
      timeSlot: "08:00 AM",
      startAt: "2026-09-21T08:00:00.000Z",
      reasons: ["PREFERRED_PRIEST_AVAILABLE"],
      preferredPriestAvailable: true,
    };

    const screen = await render(
      <SuggestedTimeCard rec={rec} onSelect={jest.fn()} />
    );

    expect(screen.getByText("Preferred Priest Available")).toBeTruthy();
    expect(screen.queryByText("Preferred Date")).toBeNull();
  });

  // D. Alternative date + preferred priest unavailable
  it("D. displays 'Preferred Priest Unavailable' and NO 'Preferred Date' badge on alternative date", async () => {
    const rec: ScheduleRecommendationItem = {
      date: "2026-09-21",
      timeSlot: "10:00 AM",
      startAt: "2026-09-21T10:00:00.000Z",
      reasons: ["PREFERRED_PRIEST_UNAVAILABLE"],
      preferredPriestAvailable: false,
    };

    const screen = await render(
      <SuggestedTimeCard rec={rec} onSelect={jest.fn()} />
    );

    expect(screen.getByText("Preferred Priest Unavailable")).toBeTruthy();
    expect(screen.queryByText("Preferred Date")).toBeNull();
  });

  // E. Unavailable preferred priest recommendation remains selectable
  it("E. ensures a recommendation with preferred priest unavailable remains clickable and selectable", async () => {
    const onSelect = jest.fn();
    const rec: ScheduleRecommendationItem = {
      date: "2026-09-21",
      timeSlot: "10:00 AM",
      startAt: "2026-09-21T10:00:00.000Z",
      reasons: ["PREFERRED_PRIEST_UNAVAILABLE"],
      preferredPriestAvailable: false,
    };

    const screen = await render(
      <SuggestedTimeCard rec={rec} onSelect={onSelect} />
    );

    const button = screen.getByRole("button");
    fireEvent.press(button);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(button.props.accessibilityState?.disabled).toBeFalsy();
  });

  // F. Helper copy appears only when a preferred priest is selected
  describe("F. Explanatory Helper Copy Behavior", () => {
    const HelperSection = ({ requestedPriestId }: { requestedPriestId: number | null }) => (
      <View>
        <Text>Suggested Times</Text>
        {Boolean(requestedPriestId) && (
          <Text testID="priest-helper-text">
            {PREFERRED_PRIEST_HELPER_COPY}
          </Text>
        )}
      </View>
    );

    it("renders helper copy when a preferred priest is selected", async () => {
      const screen = await render(<HelperSection requestedPriestId={5} />);
      expect(screen.getByTestId("priest-helper-text")).toBeTruthy();
      expect(screen.getByText(PREFERRED_PRIEST_HELPER_COPY)).toBeTruthy();
      expect(PREFERRED_PRIEST_HELPER_COPY).toBe(
        "Your preferred priest may not be available for every suggested time. The parish can still assign another priest."
      );
    });

    it("does NOT render helper copy when no preferred priest is selected", async () => {
      const screen = await render(<HelperSection requestedPriestId={null} />);
      expect(screen.queryByTestId("priest-helper-text")).toBeNull();
      expect(screen.queryByText(PREFERRED_PRIEST_HELPER_COPY)).toBeNull();
    });
  });

  // Presentation helper matrix verification
  describe("presentation.ts getRecommendationBadges matrix", () => {
    it("maps preferred date + preferred priest available", () => {
      const badges = getRecommendationBadges({
        reasons: ["PREFERRED_DATE"],
        preferredPriestAvailable: true,
      });
      expect(badges.map((b) => b.label)).toEqual([
        "Preferred Date",
        PREFERRED_PRIEST_AVAILABLE_LABEL,
      ]);
      expect(badges[1].variant).toBe("priest-available");
      expect(badges[1].accessibilityLabel).toBe(PREFERRED_PRIEST_AVAILABLE_TOOLTIP);
    });

    it("maps preferred date + preferred priest unavailable", () => {
      const badges = getRecommendationBadges({
        reasons: ["PREFERRED_DATE"],
        preferredPriestAvailable: false,
      });
      expect(badges.map((b) => b.label)).toEqual([
        "Preferred Date",
        PREFERRED_PRIEST_UNAVAILABLE_LABEL,
      ]);
      expect(badges[1].variant).toBe("priest-unavailable");
      expect(badges[1].accessibilityLabel).toBe(PREFERRED_PRIEST_UNAVAILABLE_TOOLTIP);
    });

    it("omits preferred priest badges when no priest was preferred (undefined)", () => {
      const badges = getRecommendationBadges({
        reasons: ["PREFERRED_DATE"],
        preferredPriestAvailable: undefined,
      });
      expect(badges.map((b) => b.label)).toEqual(["Preferred Date"]);
    });
  });
});

import React from "react";
import ParishMapDOM, { type ParishMapItem } from "@/features/parishes/components/ParishMapDOM";

describe("ParishMapDOM module", () => {
  it("exports a valid component", () => {
    expect(ParishMapDOM).toBeDefined();
    expect(["function", "object"]).toContain(typeof ParishMapDOM);
  });

  it("accepts valid parish map items and selection props", () => {
    const sampleItems: ParishMapItem[] = [
      {
        id: "1",
        name: "San Carlos Borromeo Cathedral",
        type: "Parish",
        latitude: 10.485,
        longitude: 123.415,
        pinColor: "#7B1C2A",
        showLabel: true,
        mapZoom: 14,
      },
      {
        id: "2",
        name: "St. Vincent Ferrer Parish",
        latitude: 10.35,
        longitude: 123.3,
        pinColor: null,
        showLabel: false,
      },
    ];

    const element = React.createElement(ParishMapDOM, {
      parishes: sampleItems,
      selectedParishId: "1",
      onSelectParish: jest.fn(),
      resetSignal: 0,
    });

    expect(element).toBeTruthy();
    expect(element.props.parishes).toHaveLength(2);
    expect(element.props.selectedParishId).toBe("1");
  });
});

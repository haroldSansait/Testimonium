import {
  BUNDLED_PARISH_IMAGES,
  getBundledParishImage,
  resolveParishImageSource,
} from "@/features/parishes/parishImages";

describe("Parish Image Resolution", () => {
  it("resolves bundled photographs for all 7 Vicariate of Canlaon parishes by ID", () => {
    // 1: Cabagtasan (Our Lady of the Mountains)
    expect(getBundledParishImage(1)).toBe(BUNDLED_PARISH_IMAGES.cabagtasan);
    expect(getBundledParishImage("1")).toBe(BUNDLED_PARISH_IMAGES.cabagtasan);

    // 2: Canlaon City (St. Joseph Parish)
    expect(getBundledParishImage(2)).toBe(BUNDLED_PARISH_IMAGES.canlaon);
    expect(getBundledParishImage("2")).toBe(BUNDLED_PARISH_IMAGES.canlaon);

    // 3: Don Salvador Benedicto (Our Lady of the Miraculous Medal)
    expect(getBundledParishImage(3)).toBe(BUNDLED_PARISH_IMAGES.dsb);
    expect(getBundledParishImage("3")).toBe(BUNDLED_PARISH_IMAGES.dsb);

    // 4: Masulog (Nuestra Señora De Las Flores)
    expect(getBundledParishImage(4)).toBe(BUNDLED_PARISH_IMAGES.masulog);
    expect(getBundledParishImage("4")).toBe(BUNDLED_PARISH_IMAGES.masulog);

    // 5: Prosperidad (Our Lady of Peace and Good Voyage)
    expect(getBundledParishImage(5)).toBe(BUNDLED_PARISH_IMAGES.prosperidad);
    expect(getBundledParishImage("5")).toBe(BUNDLED_PARISH_IMAGES.prosperidad);

    // 6: Quezon (Holy Child Parish)
    expect(getBundledParishImage(6)).toBe(BUNDLED_PARISH_IMAGES.quezon);
    expect(getBundledParishImage("6")).toBe(BUNDLED_PARISH_IMAGES.quezon);

    // 7: Tagbino (Our Lady of Guadalupe Parish)
    expect(getBundledParishImage(7)).toBe(BUNDLED_PARISH_IMAGES.tagbino);
    expect(getBundledParishImage("7")).toBe(BUNDLED_PARISH_IMAGES.tagbino);
  });

  it("resolves bundled photographs by parish name and address keywords", () => {
    expect(
      getBundledParishImage({ name: "Our Lady of the Mountains Quasi-Parish" })
    ).toBe(BUNDLED_PARISH_IMAGES.cabagtasan);

    expect(
      getBundledParishImage({ name: "St. Joseph Parish", city: "Canlaon City" })
    ).toBe(BUNDLED_PARISH_IMAGES.canlaon);

    expect(
      getBundledParishImage({ name: "Our Lady of the Miraculous Medal Parish" })
    ).toBe(BUNDLED_PARISH_IMAGES.dsb);

    expect(
      getBundledParishImage({ name: "Nuestra Señora De Las Flores Mission Station" })
    ).toBe(BUNDLED_PARISH_IMAGES.masulog);

    expect(
      getBundledParishImage({ name: "Our Lady of Peace and Good Voyage Quasi-Parish" })
    ).toBe(BUNDLED_PARISH_IMAGES.prosperidad);

    expect(
      getBundledParishImage({ name: "Holy Child Parish" })
    ).toBe(BUNDLED_PARISH_IMAGES.quezon);

    expect(
      getBundledParishImage({ name: "Our Lady of Guadalupe Parish", city: "Vallehermoso" })
    ).toBe(BUNDLED_PARISH_IMAGES.tagbino);
  });

  it("prefers valid remote coverImage URLs when present", () => {
    const remoteUrl = "https://images.unsplash.com/photo-1548625361-155de0cbb55a?w=800";
    const result = resolveParishImageSource({
      id: 2,
      name: "St. Joseph Parish",
      coverImage: remoteUrl,
    });

    expect(result).toEqual({ uri: remoteUrl });
  });

  it("falls back to bundled image if coverImage is empty or null", () => {
    const result = resolveParishImageSource({
      id: 2,
      name: "St. Joseph Parish",
      coverImage: null,
    });

    expect(result).toBe(BUNDLED_PARISH_IMAGES.canlaon);
  });

  it("returns null gracefully for unknown or undefined parishes", () => {
    expect(resolveParishImageSource(null)).toBeNull();
    expect(resolveParishImageSource(undefined)).toBeNull();
    expect(getBundledParishImage({ name: "Unknown Nonexistent Church" })).toBeNull();
  });
});

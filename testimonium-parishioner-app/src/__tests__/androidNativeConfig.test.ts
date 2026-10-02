import type { ConfigContext, ExpoConfig } from "expo/config";
import createExpoConfig from "../../app.config";

describe("Android native scanner compatibility config", () => {
  it("resolves Android minSdkVersion 26 through expo-build-properties", () => {
    const config = createExpoConfig({
      config: {} as ExpoConfig,
    } as ConfigContext);
    const buildProperties = config.plugins?.find(
      (plugin) => Array.isArray(plugin) && plugin[0] === "expo-build-properties"
    );

    expect(buildProperties).toEqual([
      "expo-build-properties",
      {
        android: {
          minSdkVersion: 26,
        },
      },
    ]);
  });
});

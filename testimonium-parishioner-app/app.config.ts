import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "TESTIMONIUM",
  slug: "testimonium-parishioner",
  scheme: "testimonium",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  experiments: { typedRoutes: true },
  android: { package: "com.testimonium.app", googleServicesFile: "./google-services.json" },
  plugins: ["expo-router", "@react-native-firebase/app", "@react-native-firebase/auth"],
});
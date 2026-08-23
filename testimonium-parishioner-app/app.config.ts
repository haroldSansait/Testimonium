import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,

  name: "TESTIMONIUM",
  slug: "testimonium",
  owner: "agos-testimonium",

  scheme: "testimonium",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "light",

  experiments: {
    typedRoutes: true,
  },

  android: {
    package: "com.testimonium.app",
    googleServicesFile: "./google-services.json",
  },

  extra: {
    ...config.extra,
    eas: {
      ...config.extra?.eas,
      projectId: "c5ceefeb-6a8a-46b4-a53f-af529ac894b1",
    },
  },

  plugins: [
    "expo-router",
    "@react-native-firebase/app",
    "@react-native-firebase/auth",
    "@react-native-google-signin/google-signin",
    [
      "expo-image-picker",
      {
        photosPermission:
          "Allow TESTIMONIUM to access your photos to attach payment receipts.",
        cameraPermission:
          "Allow TESTIMONIUM to access your camera to capture payment receipts.",
      },
    ],
  ],
});
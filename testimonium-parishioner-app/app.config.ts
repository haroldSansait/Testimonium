import type { ConfigContext, ExpoConfig } from "expo/config";

// CommonJS keeps this check executable by both Expo config and Node build hooks.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { assertReleaseEnvironment } = require("./scripts/release-policy.cjs");

export default ({ config }: ConfigContext): ExpoConfig => {
  assertReleaseEnvironment(process.env);
  return {
    ...config,

    name: "TESTIMONIUM",
    slug: "testimonium",
    owner: "agos-testimonium",

    scheme: "testimonium",
    version: "1.0.0",
    icon: "./assets/images/android/icon.png",
    orientation: "portrait",
    userInterfaceStyle: "light",

    experiments: {
      typedRoutes: true,
    },

    android: {
      package: "com.testimonium.app",
      // Bootstrap only. EAS remote versionCode is authoritative and auto-increments.
      versionCode: 1,
      googleServicesFile: "./google-services.json",
      permissions: ["CAMERA", "POST_NOTIFICATIONS"],
      blockedPermissions: process.env.EXPO_PUBLIC_ENV === "production"
        ? ["android.permission.SYSTEM_ALERT_WINDOW"]
        : [],
      adaptiveIcon: {
        foregroundImage: "./assets/images/android/adaptive-foreground.png",
        backgroundColor: "#FBF4F5",
      },
    },

    extra: {
      ...config.extra,
      eas: {
        ...config.extra?.eas,
        projectId: "c5ceefeb-6a8a-46b4-a53f-af529ac894b1",
      },
    },

    plugins: [
      ["expo-splash-screen", {
        image: "./assets/images/android/splash-logo.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#7B1C2A",
      }],
      ["expo-notifications", { defaultChannel: "testimonium-important", color: "#7B1C2A" }],
      "expo-router",
      [
        "expo-build-properties",
        {
          android: {
            minSdkVersion: 26,
            usesCleartextTraffic: false,
          },
        },
      ],
      "@react-native-firebase/app",
      "@react-native-firebase/auth",
      "@react-native-google-signin/google-signin",
      [
        "expo-image-picker",
        {
          microphonePermission: false,
          photosPermission:
            "Allow TESTIMONIUM to access your photos to attach payment receipts.",
          cameraPermission:
            "Allow TESTIMONIUM to access your camera to capture payment receipts.",
        },
      ],
    ],
  };
};

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
    // Native dependencies, plugins and bundled fonts determine OTA compatibility.
    runtimeVersion: { policy: "fingerprint" },
    updates: {
      url: "https://u.expo.dev/c5ceefeb-6a8a-46b4-a53f-af529ac894b1",
    },
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
      ["expo-font", {
        android: {
          fonts: [
            {
              fontFamily: "Inter",
              fontDefinitions: [
                { path: "./assets/fonts/Inter/Inter_400Regular.ttf", weight: 400 },
                { path: "./assets/fonts/Inter/Inter_500Medium.ttf", weight: 500 },
                { path: "./assets/fonts/Inter/Inter_600SemiBold.ttf", weight: 600 },
                { path: "./assets/fonts/Inter/Inter_700Bold.ttf", weight: 700 },
                { path: "./assets/fonts/Inter/Inter_800ExtraBold.ttf", weight: 800 },
                { path: "./assets/fonts/Inter/Inter_400Regular_Italic.ttf", weight: 400, style: "italic" },
                { path: "./assets/fonts/Inter/Inter_500Medium_Italic.ttf", weight: 500, style: "italic" },
                { path: "./assets/fonts/Inter/Inter_600SemiBold_Italic.ttf", weight: 600, style: "italic" },
                { path: "./assets/fonts/Inter/Inter_700Bold_Italic.ttf", weight: 700, style: "italic" },
                { path: "./assets/fonts/Inter/Inter_800ExtraBold_Italic.ttf", weight: 800, style: "italic" },
              ],
            },
            {
              fontFamily: "Playfair Display",
              fontDefinitions: [
                { path: "./assets/fonts/PlayfairDisplay/PlayfairDisplay_700Bold.ttf", weight: 700 },
                { path: "./assets/fonts/PlayfairDisplay/PlayfairDisplay_800ExtraBold.ttf", weight: 800 },
              ],
            },
          ],
        },
      }],
      "./plugins/with-font-licenses.cjs",
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

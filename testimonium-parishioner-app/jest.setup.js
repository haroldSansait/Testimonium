/* eslint-disable no-undef */
// Jest test setup for React Native Firebase & Google Sign In mocks

jest.mock("@react-native-firebase/app", () => ({
  getApp: jest.fn(),
  initializeApp: jest.fn(),
}));

jest.mock("@react-native-firebase/auth", () => {
  const authInstance = {
    currentUser: null,
    onAuthStateChanged: jest.fn((callback) => {
      return jest.fn(); // unsubscribe
    }),
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn(),
    signInWithCredential: jest.fn(),
    signOut: jest.fn(),
    sendEmailVerification: jest.fn(),
    reload: jest.fn(),
  };

  return {
    getAuth: jest.fn(() => authInstance),
    onAuthStateChanged: jest.fn((auth, callback) => callback(null)),
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn(),
    signInWithCredential: jest.fn(),
    signOut: jest.fn(),
    sendEmailVerification: jest.fn(),
    reload: jest.fn(),
    getIdToken: jest.fn(async (_user, _force) => "mock-token"),
    GoogleAuthProvider: {
      credential: jest.fn((token) => ({ token, providerId: "google.com" })),
    },
  };
});

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(async () => true),
    signIn: jest.fn(async () => ({ data: { idToken: "mock-google-id-token" } })),
    signOut: jest.fn(async () => undefined),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: "SIGN_IN_CANCELLED",
    IN_PROGRESS: "IN_PROGRESS",
    PLAY_SERVICES_NOT_AVAILABLE: "PLAY_SERVICES_NOT_AVAILABLE",
  },
}));

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  const FadeIn = {
    duration: jest.fn(() => FadeIn),
  };

  return {
    __esModule: true,
    default: { View },
    FadeIn,
    useSharedValue: (initialValue) => ({ value: initialValue }),
  };
});

import { getAuth } from "@react-native-firebase/auth";

// Native Firebase owns app/auth singleton initialization and encrypted platform persistence.
export const firebaseAuth = getAuth();
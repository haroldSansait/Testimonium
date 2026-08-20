import { Text } from "react-native";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/providers/AuthProvider";
export default function HomeScreen() { const { profile } = useAuth(); return <Screen><Text>Welcome, {profile?.fullName || profile?.email}.</Text><Text>Home features are scheduled for Phase 2.</Text></Screen>; }
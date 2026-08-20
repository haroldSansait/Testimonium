import { Link } from "expo-router";
import { Text } from "react-native";
import { Screen } from "@/components/Screen";
export default function NotFoundScreen() { return <Screen><Text>That screen could not be found.</Text><Link href="/(auth)/welcome">Return to welcome</Link></Screen>; }
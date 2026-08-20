import { Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/providers/AuthProvider";
export default function ProfileScreen() { const { profile, logout } = useAuth(); return <Screen><View><Text>{profile?.email}</Text><Text>{profile?.role}</Text></View><Button title="Sign out" onPress={() => { void logout(); }} /></Screen>; }
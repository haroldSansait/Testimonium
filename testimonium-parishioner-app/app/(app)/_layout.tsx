import { Tabs } from "expo-router";
import { colors } from "@/theme/tokens";
export default function AppLayout() { return <Tabs screenOptions={{ headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.primary, tabBarActiveTintColor: colors.primary }}>
  <Tabs.Screen name="(home)" options={{ title: "Home" }} />
  <Tabs.Screen name="(requests)" options={{ title: "Requests" }} />
  <Tabs.Screen name="(schedule)" options={{ title: "Schedule" }} />
  <Tabs.Screen name="(parishes)" options={{ title: "Parishes" }} />
  <Tabs.Screen name="(profile)" options={{ title: "Profile" }} />
</Tabs>; }
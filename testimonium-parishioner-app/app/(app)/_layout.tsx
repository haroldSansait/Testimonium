import { Stack } from "expo-router";

export default function AppRootStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="requests/new"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="requests/[requestId]"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="requests/[requestId]/payment"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="parishes/[parishId]"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="notifications"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
    </Stack>
  );
}
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
        name="schedule/new"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="schedule/[id]"
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
      <Stack.Screen
        name="events/index"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="events/[id]"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="profile/edit"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="profile/settings"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="profile/help"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="profile/terms"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="profile/privacy"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="caloy/index"
        options={{ headerShown: false, animation: "slide_from_bottom" }}
      />
    </Stack>
  );
}
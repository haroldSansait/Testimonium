import React, { useCallback, useMemo, useState } from "react";
import { Keyboard, StyleSheet, View } from "react-native";
import { Tabs, usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  TabBarButton,
  CenterActionButton,
  QuickActionSheet,
} from "@/components/navigation";
import { useUnreadNotificationCount } from "@/features/notifications/api";
import { colors, fontStyles, shadows } from "@/theme/tokens";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const unreadCount = useUnreadNotificationCount();
  const [isQuickActionOpen, setIsQuickActionOpen] = useState(false);

  // Safe computation: guarantee at least 12px bottom padding on Android 3-button nav, plus bottom inset
  const bottomInset = Math.max(insets.bottom, 12);
  const tabHeight = 58 + bottomInset;

  // Detect if user is currently viewing a service route (Requests, Schedule, Parishes)
  const isServiceActive = useMemo(() => {
    if (!pathname) return false;
    return (
      pathname.includes("requests") ||
      pathname.includes("schedule") ||
      pathname.includes("parishes")
    );
  }, [pathname]);

  const handleCenterActionPress = useCallback(() => {
    Keyboard.dismiss();
    setIsQuickActionOpen((prev) => !prev);
  }, []);

  const handleSelectQuickAction = useCallback(
    (destination: string) => {
      setIsQuickActionOpen(false);
      router.push(destination as any);
    },
    [router]
  );

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.brand[700],
          tabBarInactiveTintColor: colors.neutral[650],
          tabBarButton: (props) => <TabBarButton {...props} />,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.neutral[200],
            borderTopWidth: 1,
            height: tabHeight,
            paddingBottom: bottomInset + 2,
            paddingTop: 6,
            ...shadows.sheet,
          },
          tabBarLabelStyle: {
            ...fontStyles.caption,
            fontSize: 12,
            fontWeight: "600",
            marginTop: 2,
          },
          tabBarItemStyle: {
            paddingVertical: 2,
          },
          tabBarHideOnKeyboard: true,
        }}
      >
        {/* 1. Home */}
        <Tabs.Screen
          name="(home)"
          options={{
            title: "Home",
            tabBarAccessibilityLabel: "Home tab",
            tabBarIcon: ({ color, focused }) => (
              <View style={styles.iconContainer}>
                <Ionicons
                  name={focused ? "home" : "home-outline"}
                  size={22}
                  color={color}
                />
                {focused && <View style={styles.activeDot} />}
              </View>
            ),
          }}
        />

        {/* 2. Caloy Virtual Assistant */}
        <Tabs.Screen
          name="(caloy)"
          options={{
            title: "Caloy",
            tabBarAccessibilityLabel: "Caloy assistant tab",
            tabBarIcon: ({ color, focused }) => (
              <View style={styles.iconContainer}>
                <Ionicons
                  name={focused ? "sparkles" : "sparkles-outline"}
                  size={22}
                  color={color}
                />
                {focused && <View style={styles.activeDot} />}
              </View>
            ),
          }}
        />

        {/* 3. Center Action Button - Quick Actions (Action, not destination) */}
        <Tabs.Screen
          name="quick-actions"
          options={{
            title: "Quick Actions",
            tabBarLabel: () => null,
            tabBarButton: () => (
              <CenterActionButton
                isOpen={isQuickActionOpen}
                onPress={handleCenterActionPress}
                isServiceActive={isServiceActive}
              />
            ),
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              handleCenterActionPress();
            },
          }}
        />

        {/* 4. Notifications */}
        <Tabs.Screen
          name="(notifications)"
          options={{
            title: "Notifications",
            tabBarAccessibilityLabel: `Notifications tab${
              unreadCount > 0 ? `, ${unreadCount} unread` : ""
            }`,
            tabBarBadge:
              unreadCount > 0
                ? unreadCount > 99
                  ? "99+"
                  : unreadCount
                : undefined,
            tabBarBadgeStyle: {
              backgroundColor: colors.danger,
              color: "#FFFFFF",
              fontSize: 10,
              fontWeight: "700",
              minWidth: 18,
              height: 18,
              lineHeight: 18,
              borderRadius: 9,
            },
            tabBarIcon: ({ color, focused }) => (
              <View style={styles.iconContainer}>
                <Ionicons
                  name={focused ? "notifications" : "notifications-outline"}
                  size={22}
                  color={color}
                />
                {focused && <View style={styles.activeDot} />}
              </View>
            ),
          }}
        />

        {/* 5. Profile */}
        <Tabs.Screen
          name="(profile)"
          options={{
            title: "Profile",
            tabBarAccessibilityLabel: "Profile tab",
            tabBarIcon: ({ color, focused }) => (
              <View style={styles.iconContainer}>
                <Ionicons
                  name={focused ? "person" : "person-outline"}
                  size={22}
                  color={color}
                />
                {focused && <View style={styles.activeDot} />}
              </View>
            ),
          }}
        />

        {/* Hidden Service Routes - Reachable via Router & Quick Actions */}
        <Tabs.Screen
          name="(requests)"
          options={{
            href: null,
            title: "Requests",
          }}
        />
        <Tabs.Screen
          name="(schedule)"
          options={{
            href: null,
            title: "Schedule",
          }}
        />
        <Tabs.Screen
          name="(parishes)"
          options={{
            href: null,
            title: "Parishes",
          }}
        />
      </Tabs>

      {/* Quick Action Sheet Modal */}
      <QuickActionSheet
        visible={isQuickActionOpen}
        onClose={() => setIsQuickActionOpen(false)}
        onSelectAction={handleSelectQuickAction}
        currentPathname={pathname}
      />
    </>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 28,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.brand[700],
    position: "absolute",
    bottom: -3,
  },
});

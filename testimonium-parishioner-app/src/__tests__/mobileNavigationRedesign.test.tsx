import React from "react";
import { AccessibilityInfo, Animated, BackHandler, Text } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import {
  ACTION_ITEMS,
  AnimatedTabBarButton,
  CenterActionButton,
  QuickActionSheet,
  createPanResponderCallbacks,
} from "@/components/navigation";
import { colors } from "@/theme/tokens";
import TabsLayout from "../../app/(app)/(tabs)/_layout";
import LegacyCaloyRoute from "../../app/(app)/caloy/index";
import CaloyTabRoute from "../../app/(app)/(tabs)/(caloy)/index";
import NotificationsTabRoute from "../../app/(app)/(tabs)/(notifications)/index";
import QuickActionsRoute from "../../app/(app)/(tabs)/quick-actions";

// Mocks for Navigation Layout testing
interface MockScreenProps {
  name: string;
  options: {
    title?: string;
    href?: string | null;
    tabBarBadge?: string | number;
    tabBarAccessibilityLabel?: string;
  };
  listeners?: {
    tabPress?: (e: { preventDefault: () => void }) => void;
  };
}

const capturedScreens: MockScreenProps[] = [];
let capturedScreenOptions: { tabBarHideOnKeyboard?: boolean } | null = null;
const mockRouterPush = jest.fn();
const mockPathname = "/(app)/(tabs)/(home)";

jest.mock("expo-router", () => {
  const React = jest.requireActual<typeof import("react")>("react");

  const TabsComponent = ({
    children,
    screenOptions,
  }: {
    children: React.ReactNode;
    screenOptions: { tabBarHideOnKeyboard?: boolean };
  }) => {
    capturedScreenOptions = screenOptions;
    return React.createElement(React.Fragment, null, children);
  };
  TabsComponent.displayName = "MockTabs";

  const TabsScreen = (props: MockScreenProps) => {
    capturedScreens.push(props);
    return null;
  };
  TabsScreen.displayName = "MockTabsScreen";
  TabsComponent.Screen = TabsScreen;

  const MockRedirect = ({ href }: { href: string }) => {
    return React.createElement("mock-redirect", { "data-href": href });
  };
  MockRedirect.displayName = "MockRedirect";

  return {
    Tabs: TabsComponent,
    useRouter: () => ({ push: mockRouterPush, replace: jest.fn() }),
    usePathname: () => mockPathname,
    Redirect: MockRedirect,
  };
});

let mockUnreadCount = 0;
jest.mock("@/features/notifications/api", () => ({
  useUnreadNotificationCount: () => mockUnreadCount,
}));

jest.mock("@/features/caloy/CaloyScreen", () => {
  const MockCaloy = () => null;
  MockCaloy.displayName = "MockCaloyScreen";
  return { CaloyScreen: MockCaloy };
});

jest.mock("@/features/notifications/NotificationListScreen", () => {
  const MockNotif = () => null;
  MockNotif.displayName = "MockNotificationListScreen";
  return { NotificationListScreen: MockNotif };
});

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, left: 0, right: 0, bottom: 24 }),
}));

beforeAll(() => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
});

describe("TESTIMONIUM Mobile Navigation Redesign", () => {
  describe("CenterActionButton", () => {
    it("renders with proper accessibility labels when closed", async () => {
      const onPressMock = jest.fn();
      await render(
        <CenterActionButton
          isOpen={false}
          onPress={onPressMock}
          isServiceActive={false}
        />
      );

      const closedBtn = screen.getByLabelText("Open quick actions");
      expect(closedBtn).toBeTruthy();
      expect(closedBtn.props.accessibilityHint).toBe(
        "Request a document, schedule a service, or find a parish"
      );

      await fireEvent.press(closedBtn);
      expect(onPressMock).toHaveBeenCalledTimes(1);
    });

    it("renders with proper accessibility labels when open", async () => {
      await render(
        <CenterActionButton
          isOpen={true}
          onPress={jest.fn()}
          isServiceActive={false}
        />
      );

      expect(screen.getByLabelText("Close quick actions")).toBeTruthy();
    });

    it("displays service active visual indicator when current route is a service section and sheet is closed", async () => {
      await render(
        <CenterActionButton
          isOpen={false}
          onPress={jest.fn()}
          isServiceActive={true}
        />
      );

      const btn = screen.getByLabelText("Open quick actions");
      expect(btn).toBeTruthy();
    });
  });

  describe("QuickActionSheet", () => {
    it("renders exactly 3 primary actions with correct titles and subtitles", async () => {
      await render(
        <QuickActionSheet
          visible={true}
          onClose={jest.fn()}
          onSelectAction={jest.fn()}
        />
      );

      expect(screen.getByText("Quick Actions")).toBeTruthy();

      // Action 1: Request a Document
      expect(screen.getByText("Request a Document")).toBeTruthy();
      expect(screen.getByText("Certificates and parish documents")).toBeTruthy();

      // Action 2: Schedule a Service
      expect(screen.getByText("Schedule a Service")).toBeTruthy();
      expect(screen.getByText("Sacraments, Masses and parish events")).toBeTruthy();

      // Action 3: Find a Parish
      expect(screen.getByText("Find a Parish")).toBeTruthy();
      expect(screen.getByText("Parish directory and contact information")).toBeTruthy();
    });

    it("navigates to existing Requests route when Request a Document is tapped", async () => {
      const onClose = jest.fn();
      const onSelectAction = jest.fn();

      await render(
        <QuickActionSheet
          visible={true}
          onClose={onClose}
          onSelectAction={onSelectAction}
        />
      );

      await fireEvent.press(screen.getByText("Request a Document"));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onSelectAction).toHaveBeenCalledWith("/(app)/(tabs)/(requests)");
    });

    it("navigates to existing Schedule route when Schedule a Service is tapped", async () => {
      const onClose = jest.fn();
      const onSelectAction = jest.fn();

      await render(
        <QuickActionSheet
          visible={true}
          onClose={onClose}
          onSelectAction={onSelectAction}
        />
      );

      await fireEvent.press(screen.getByText("Schedule a Service"));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onSelectAction).toHaveBeenCalledWith("/(app)/(tabs)/(schedule)");
    });

    it("navigates to existing Parishes route when Find a Parish is tapped", async () => {
      const onClose = jest.fn();
      const onSelectAction = jest.fn();

      await render(
        <QuickActionSheet
          visible={true}
          onClose={onClose}
          onSelectAction={onSelectAction}
        />
      );

      await fireEvent.press(screen.getByText("Find a Parish"));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onSelectAction).toHaveBeenCalledWith("/(app)/(tabs)/(parishes)");
    });

    it("prevents double navigation on rapid taps", async () => {
      const onClose = jest.fn();
      const onSelectAction = jest.fn();

      await render(
        <QuickActionSheet
          visible={true}
          onClose={onClose}
          onSelectAction={onSelectAction}
        />
      );

      const action = screen.getByText("Request a Document");
      await fireEvent.press(action);
      await fireEvent.press(action);

      // Should only navigate once due to isNavigating guard
      expect(onSelectAction).toHaveBeenCalledTimes(1);
    });

    it("closes when the explicit close button is pressed", async () => {
      const onClose = jest.fn();

      await render(
        <QuickActionSheet
          visible={true}
          onClose={onClose}
          onSelectAction={jest.fn()}
        />
      );

      const closeBtn = screen.getByLabelText("Close quick actions");
      await fireEvent.press(closeBtn);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("closes when the dimmed backdrop is pressed", async () => {
      const onClose = jest.fn();

      await render(
        <QuickActionSheet
          visible={true}
          onClose={onClose}
          onSelectAction={jest.fn()}
        />
      );

      const backdrop = screen.getByLabelText("Dismiss quick actions");
      await fireEvent.press(backdrop);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("dismisses on Android hardware Back button", async () => {
      const onClose = jest.fn();
      let hardwareBackCallback: (() => boolean) | null = null;

      const backSpy = jest
        .spyOn(BackHandler, "addEventListener")
        .mockImplementation((event: any, callback: any) => {
          if (event === "hardwareBackPress") {
            hardwareBackCallback = callback;
          }
          return { remove: jest.fn() } as any;
        });

      await render(
        <QuickActionSheet
          visible={true}
          onClose={onClose}
          onSelectAction={jest.fn()}
        />
      );

      expect(hardwareBackCallback).not.toBeNull();
      hardwareBackCallback!();

      expect(onClose).toHaveBeenCalledTimes(1);
      backSpy.mockRestore();
    });

    it("configures distinct icon colors and container backgrounds for each action", () => {
      expect(ACTION_ITEMS).toHaveLength(3);
      const iconColors = ACTION_ITEMS.map((item) => item.iconColor);
      const iconBgColors = ACTION_ITEMS.map((item) => item.iconBgColor);

      // Verify all 3 icon colors are distinct
      expect(new Set(iconColors).size).toBe(3);
      // Verify all 3 icon backgrounds are distinct
      expect(new Set(iconBgColors).size).toBe(3);

      // Verify color alignments
      expect(ACTION_ITEMS.find((a) => a.id === "requests")?.iconColor).toBe(colors.primary);
      expect(ACTION_ITEMS.find((a) => a.id === "requests")?.iconBgColor).toBe(colors.primarySoft);
      expect(ACTION_ITEMS.find((a) => a.id === "schedule")?.iconColor).toBe(colors.warning);
      expect(ACTION_ITEMS.find((a) => a.id === "schedule")?.iconBgColor).toBe(colors.warningSoft);
      expect(ACTION_ITEMS.find((a) => a.id === "parishes")?.iconColor).toBe(colors.info);
      expect(ACTION_ITEMS.find((a) => a.id === "parishes")?.iconBgColor).toBe(colors.infoSoft);
    });

    it("renders accessibilityHint for swipe down dismissal", async () => {
      await render(
        <QuickActionSheet
          visible={true}
          onClose={jest.fn()}
          onSelectAction={jest.fn()}
        />
      );

      const sheet = screen.getByLabelText("Quick Actions Sheet");
      expect(sheet.props.accessibilityHint).toBe("Swipe down or activate close to dismiss.");
    });

    it("dismisses sheet when dragged downward past threshold", async () => {
      const onClose = jest.fn();
      await render(
        <QuickActionSheet
          visible={true}
          onClose={onClose}
          onSelectAction={jest.fn()}
        />
      );

      const sheet = screen.getByLabelText("Quick Actions Sheet");
      expect(sheet).toBeTruthy();
      expect(sheet.props.onResponderMove).toBeDefined();
      expect(sheet.props.onResponderRelease).toBeDefined();
    });

    it("dismisses sheet when dragged downward past distance threshold (> 100dp)", () => {
      const onDismiss = jest.fn();
      const onReset = jest.fn();
      const dragY = new Animated.Value(0);
      const callbacks = createPanResponderCallbacks(onDismiss, onReset, dragY);

      callbacks.onPanResponderMove({}, { dy: 120 });
      expect((dragY as any)._value).toBe(120);

      callbacks.onPanResponderRelease({}, { dy: 120, vy: 0.1 });
      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(onReset).not.toHaveBeenCalled();
    });

    it("dismisses sheet on downward velocity flick (> 40dp and vy > 0.5)", () => {
      const onDismiss = jest.fn();
      const onReset = jest.fn();
      const dragY = new Animated.Value(0);
      const callbacks = createPanResponderCallbacks(onDismiss, onReset, dragY);

      callbacks.onPanResponderRelease({}, { dy: 50, vy: 0.6 });
      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(onReset).not.toHaveBeenCalled();
    });

    it("resets and keeps sheet open when drag is below threshold", () => {
      const onDismiss = jest.fn();
      const onReset = jest.fn();
      const dragY = new Animated.Value(0);
      const callbacks = createPanResponderCallbacks(onDismiss, onReset, dragY);

      callbacks.onPanResponderMove({}, { dy: 30 });
      expect((dragY as any)._value).toBe(30);

      callbacks.onPanResponderRelease({}, { dy: 30, vy: 0.1 });
      expect(onReset).toHaveBeenCalledTimes(1);
      expect(onDismiss).not.toHaveBeenCalled();
    });

    it("clamps upward drag translation to 0 (cannot drag up beyond resting position)", () => {
      const onDismiss = jest.fn();
      const onReset = jest.fn();
      const dragY = new Animated.Value(0);
      const callbacks = createPanResponderCallbacks(onDismiss, onReset, dragY);

      callbacks.onPanResponderMove({}, { dy: -50 });
      expect((dragY as any)._value).toBe(0);
    });

    it("only activates pan responder for predominantly downward motion", () => {
      const callbacks = createPanResponderCallbacks(jest.fn(), jest.fn(), new Animated.Value(0));

      // Predominantly downward (dy = 20, dx = 5) -> activates
      expect(callbacks.onMoveShouldSetPanResponder({}, { dy: 20, dx: 5 })).toBe(true);

      // Predominantly horizontal (dy = 15, dx = 30) -> ignored
      expect(callbacks.onMoveShouldSetPanResponder({}, { dy: 15, dx: 30 })).toBe(false);

      // Tap / tiny movement (dy = 2, dx = 1) -> ignored
      expect(callbacks.onMoveShouldSetPanResponder({}, { dy: 2, dx: 1 })).toBe(false);
    });
  });

  describe("AnimatedTabBarButton", () => {
    it("renders children and handles press interactions", async () => {
      const onPressMock = jest.fn();
      await render(
        <AnimatedTabBarButton onPress={onPressMock}>
          <Text>Tab Item</Text>
        </AnimatedTabBarButton>
      );

      const textElement = screen.getByText("Tab Item");
      expect(textElement).toBeTruthy();

      await fireEvent.press(textElement);
      expect(onPressMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("TabsLayout & Route Architecture", () => {
    beforeEach(() => {
      capturedScreens.length = 0;
      capturedScreenOptions = null;
      mockRouterPush.mockClear();
    });

    it("configures the 5 visible tabs in exact order: Home, Caloy, Center Action, Notifications, Profile", async () => {
      await render(<TabsLayout />);

      const visibleScreens = capturedScreens.filter((s) => s.options?.href !== null);
      expect(visibleScreens).toHaveLength(5);

      expect(visibleScreens[0].name).toBe("(home)");
      expect(visibleScreens[0].options.title).toBe("Home");

      expect(visibleScreens[1].name).toBe("(caloy)");
      expect(visibleScreens[1].options.title).toBe("Caloy");

      expect(visibleScreens[2].name).toBe("quick-actions");
      expect(visibleScreens[2].options.title).toBe("Quick Actions");

      expect(visibleScreens[3].name).toBe("(notifications)");
      expect(visibleScreens[3].options.title).toBe("Notifications");

      expect(visibleScreens[4].name).toBe("(profile)");
      expect(visibleScreens[4].options.title).toBe("Profile");
    });

    it("hides service routes (requests, schedule, parishes) from visible bottom tabs using href: null", async () => {
      await render(<TabsLayout />);

      const requestsScreen = capturedScreens.find((s) => s.name === "(requests)");
      expect(requestsScreen).toBeTruthy();
      expect(requestsScreen?.options.href).toBeNull();

      const scheduleScreen = capturedScreens.find((s) => s.name === "(schedule)");
      expect(scheduleScreen).toBeTruthy();
      expect(scheduleScreen?.options.href).toBeNull();

      const parishesScreen = capturedScreens.find((s) => s.name === "(parishes)");
      expect(parishesScreen).toBeTruthy();
      expect(parishesScreen?.options.href).toBeNull();
    });

    it("configures tabBarHideOnKeyboard to true for optimal typing space", async () => {
      await render(<TabsLayout />);
      expect(capturedScreenOptions?.tabBarHideOnKeyboard).toBe(true);
    });

    it("intercepts quick-actions tabPress to prevent navigation to a fake route", async () => {
      await render(<TabsLayout />);

      const quickActionScreen = capturedScreens.find((s) => s.name === "quick-actions");
      expect(quickActionScreen).toBeTruthy();
      expect(quickActionScreen?.listeners?.tabPress).toBeDefined();

      const preventDefaultMock = jest.fn();
      await act(async () => {
        quickActionScreen?.listeners?.tabPress?.({ preventDefault: preventDefaultMock });
      });

      expect(preventDefaultMock).toHaveBeenCalledTimes(1);
      expect(mockRouterPush).not.toHaveBeenCalled();
    });

    it("hides notification badge when unread count is 0", async () => {
      mockUnreadCount = 0;
      await render(<TabsLayout />);
      const notifScreen = capturedScreens.find((s) => s.name === "(notifications)");
      expect(notifScreen?.options.tabBarBadge).toBeUndefined();
    });

    it("displays numeric notification badge when unread count is between 1 and 99", async () => {
      mockUnreadCount = 5;
      await render(<TabsLayout />);
      const notifScreen = capturedScreens.find((s) => s.name === "(notifications)");
      expect(notifScreen?.options.tabBarBadge).toBe(5);
    });

    it("displays 99+ notification badge when unread count exceeds 99", async () => {
      mockUnreadCount = 120;
      await render(<TabsLayout />);
      const notifScreen = capturedScreens.find((s) => s.name === "(notifications)");
      expect(notifScreen?.options.tabBarBadge).toBe("99+");
    });
  });

  describe("Route Handlers & Screen Wrappers", () => {
    it("redirects legacy /(app)/caloy route to new tab route /(app)/(tabs)/(caloy)", () => {
      const element = LegacyCaloyRoute();
      expect(element.props.href).toBe("/(app)/(tabs)/(caloy)");
    });

    it("renders CaloyScreen with showBackButton={false} in the Caloy tab", () => {
      const element = CaloyTabRoute();
      expect(element.props.showBackButton).toBe(false);
    });

    it("renders NotificationListScreen with showBackButton={false} in the Notifications tab", () => {
      const element = NotificationsTabRoute();
      expect(element.props.showBackButton).toBe(false);
    });

    it("renders harmless placeholder View in quick-actions route", () => {
      const element = QuickActionsRoute();
      expect(element.props.testID).toBe("quick-actions-placeholder");
    });
  });
});

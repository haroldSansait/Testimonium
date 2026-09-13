import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme/tokens";

export interface CenterActionButtonProps {
  isOpen: boolean;
  onPress: () => void;
  isServiceActive?: boolean;
}

export const CenterActionButton: React.FC<CenterActionButtonProps> = ({
  isOpen,
  onPress,
  isServiceActive = false,
}) => {
  const [rotateAnim] = useState(() => new Animated.Value(isOpen ? 1 : 0));
  const [scaleAnim] = useState(() => new Animated.Value(1));
  const isInitialMount = useRef(true);
  const reduceMotionRef = useRef(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled?.().then((enabled) => {
      reduceMotionRef.current = Boolean(enabled);
    });
  }, []);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (reduceMotionRef.current) {
      rotateAnim.setValue(isOpen ? 1 : 0);
      return;
    }

    Animated.spring(rotateAnim, {
      toValue: isOpen ? 1 : 0,
      friction: 7,
      tension: 60,
      useNativeDriver: true,
    }).start();
  }, [isOpen, rotateAnim]);

  const handlePressIn = () => {
    if (reduceMotionRef.current) return;
    Animated.spring(scaleAnim, {
      toValue: 0.94,
      speed: 20,
      bounciness: 0,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (reduceMotionRef.current) {
      scaleAnim.setValue(1);
      return;
    }
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 6,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "45deg"],
  });

  return (
    <View style={styles.container} pointerEvents="box-none">
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={isOpen ? "Close quick actions" : "Open quick actions"}
        accessibilityHint="Request a document, schedule a service, or find a parish"
        accessibilityState={{ expanded: isOpen }}
        style={styles.pressable}
      >
        <Animated.View
          style={[
            styles.button,
            isServiceActive && !isOpen && styles.buttonServiceActive,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Subtle active service halo ring if inside service route */}
          {isServiceActive && !isOpen && <View style={styles.activeHalo} />}

          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Ionicons name="add" size={28} color="#FFFFFF" />
          </Animated.View>
        </Animated.View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    width: 68,
    height: 60,
    top: -14,
    zIndex: 10,
  },
  pressable: {
    alignItems: "center",
    justifyContent: "center",
    width: 60,
    height: 60,
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.24,
        shadowRadius: 6,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  buttonServiceActive: {
    borderWidth: 2,
    borderColor: colors.primarySoft,
  },
  activeHalo: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: colors.primary,
    opacity: 0.35,
  },
});

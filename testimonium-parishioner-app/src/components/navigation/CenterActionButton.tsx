import React, { useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { colors } from "@/theme/tokens";

export interface CenterActionButtonProps {
  isOpen: boolean;
  onPress: () => void;
  isServiceActive?: boolean;
}

export const CenterActionButton: React.FC<CenterActionButtonProps> = ({
  isOpen,
  onPress,
  isServiceActive: _isServiceActive = false,
}) => {
  const [scaleAnim] = useState(() => new Animated.Value(1));
  const reduceMotion = useReducedMotion();

  const handlePressIn = () => {
    if (reduceMotion) return;
    Animated.timing(scaleAnim, {
      toValue: 0.96,
      duration: 120,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (reduceMotion) {
      scaleAnim.setValue(1);
      return;
    }
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 160,
      useNativeDriver: true,
    }).start();
  };

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
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Ionicons name="layers-outline" size={28} color="#FFFFFF" />
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
    backgroundColor: colors.brand[700],
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
  },
});

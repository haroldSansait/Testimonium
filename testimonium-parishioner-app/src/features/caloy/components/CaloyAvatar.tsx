import React from "react";
import {
  Image,
  ImageStyle,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { colors } from "@/theme/tokens";

export interface CaloyAvatarProps {
  size?: number;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  accessibilityLabel?: string;
}

export const CaloyAvatar: React.FC<CaloyAvatarProps> = ({
  size = 28,
  style,
  imageStyle,
  accessibilityLabel = "Caloy avatar",
}) => {
  const borderRadius = size / 2;

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius,
        },
        style,
      ]}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Image
        source={require("../../../../assets/images/Caloy_pic.jpg")}
        style={[
          styles.image,
          {
            width: size,
            height: size,
            borderRadius,
          },
          imageStyle,
        ]}
        resizeMode="cover"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    backgroundColor: colors.surfaceVariant,
    alignItems: "center",
    justifyContent: "center",
    borderColor: colors.borderLight,
    borderWidth: StyleSheet.hairlineWidth,
  },
  image: {
    width: "100%",
    height: "100%",
  },
});

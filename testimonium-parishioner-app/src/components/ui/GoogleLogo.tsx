import React from "react";
import { Image, ImageStyle, StyleProp, StyleSheet } from "react-native";

export interface GoogleLogoProps {
  size?: number;
  style?: StyleProp<ImageStyle>;
}

export const GoogleLogo: React.FC<GoogleLogoProps> = ({
  size = 20,
  style,
}) => {
  return (
    <Image
      source={require("../../../assets/images/google-logo.png")}
      style={[
        styles.logo,
        { width: size, height: size },
        style,
      ]}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="Google logo"
    />
  );
};

const styles = StyleSheet.create({
  logo: {
    marginRight: 10,
  },
});

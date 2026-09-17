import React from "react";
import {
  Image,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StatusLabel } from "@/components/ui/StatusLabel";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import type { ParishDto } from "./types";

export interface ParishCardProps {
  parish: ParishDto;
  onPress?: (parish: ParishDto) => void;
  style?: StyleProp<ViewStyle>;
}

export const ParishCard: React.FC<ParishCardProps> = ({
  parish,
  onPress,
  style,
}) => {
  const [imageError, setImageError] = React.useState(false);
  const hasCoverImage = Boolean(
    !imageError && parish.coverImage && parish.coverImage.startsWith("http")
  );
  const locationLabel = [parish.municipalityCity, parish.province]
    .filter(Boolean)
    .join(", ");

  const accessibilityLabel = `${parish.name}, ${parish.type || "Parish"}. ${
    locationLabel ? `Located in ${locationLabel}.` : ""
  } ${parish.address ? `Address: ${parish.address}.` : ""}`;

  return (
    <Pressable
      onPress={onPress ? () => onPress(parish) : undefined}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Navigates to parish details"
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
        style,
      ]}
    >
      <View style={styles.contentRow}>
        {hasCoverImage ? (
          <Image
            source={{ uri: parish.coverImage }}
            style={styles.thumbnail}
            resizeMode="cover"
            onError={() => setImageError(true)}
            accessibilityElementsHidden={true}
            importantForAccessibility="no"
          />
        ) : (
          <View style={styles.placeholderThumbnail}>
            <Ionicons
              name="business-outline"
              size={22}
              color={colors.primary}
              accessibilityElementsHidden={true}
              importantForAccessibility="no"
            />
          </View>
        )}

        <View style={styles.textColumn}>
          <View style={styles.headerRow}>
            <Text
              style={styles.title}
              numberOfLines={2}
              accessibilityRole="header"
              allowFontScaling
            >
              {parish.name}
            </Text>
          </View>

          {parish.type ? (
            <View style={styles.typeRow}>
              <StatusLabel
                label={parish.type}
                status="default"
                showDot={false}
              />
            </View>
          ) : null}

          {parish.patronSaint ? (
            <View style={styles.metaRow}>
              <Ionicons
                name="sparkles-outline"
                size={13}
                color={colors.primary}
                style={styles.metaIcon}
                accessibilityElementsHidden={true}
                importantForAccessibility="no"
              />
              <Text style={styles.patronText} numberOfLines={1} allowFontScaling>
                {parish.patronSaint}
              </Text>
            </View>
          ) : null}

          {locationLabel || parish.address ? (
            <View style={styles.metaRow}>
              <Ionicons
                name="location-outline"
                size={13}
                color={colors.textSecondary}
                style={styles.metaIcon}
                accessibilityElementsHidden={true}
                importantForAccessibility="no"
              />
              <Text
                style={styles.locationText}
                numberOfLines={2}
                allowFontScaling
              >
                {parish.address || locationLabel}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.chevronColumn}>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.textMuted}
            accessibilityElementsHidden={true}
            importantForAccessibility="no"
          />
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  pressed: {
    backgroundColor: colors.surfaceVariant,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  thumbnail: {
    width: 68,
    height: 68,
    borderRadius: radii.xs,
    backgroundColor: colors.surfaceVariant,
  },
  placeholderThumbnail: {
    width: 68,
    height: 68,
    borderRadius: radii.xs,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  textColumn: {
    flex: 1,
    marginHorizontal: spacing.sm,
    minWidth: 0,
  },
  headerRow: {
    marginBottom: 2,
  },
  title: {
    ...fontStyles.titleMedium,
    color: colors.textPrimary,
    fontWeight: "700",
    fontSize: 15,
    lineHeight: 20,
  },
  typeRow: {
    marginTop: 2,
    marginBottom: 4,
    alignSelf: "flex-start",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  metaIcon: {
    marginRight: 4,
    marginTop: 1,
  },
  patronText: {
    ...fontStyles.bodySmall,
    color: colors.primary,
    fontWeight: "600",
    fontSize: 12,
    flex: 1,
  },
  locationText: {
    ...fontStyles.bodySmall,
    color: colors.textSecondary,
    fontSize: 12,
    flex: 1,
  },
  chevronColumn: {
    justifyContent: "center",
    alignItems: "center",
    paddingLeft: spacing.xxs,
  },
});

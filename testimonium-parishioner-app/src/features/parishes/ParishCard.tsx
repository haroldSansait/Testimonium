import React from "react";
import {
  Image,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card, Badge } from "@/components/ui";
import { colors, fontStyles, spacing } from "@/theme/tokens";
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
    <Card
      onPress={onPress ? () => onPress(parish) : undefined}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Navigates to parish details"
      style={[styles.card, style]}
    >
      {hasCoverImage ? (
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: parish.coverImage }}
            style={styles.coverImage}
            resizeMode="cover"
            onError={() => setImageError(true)}
            accessibilityElementsHidden={true}
            importantForAccessibility="no"
          />
        </View>
      ) : null}

      <View style={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.titleContainer}>
            <Text
              style={styles.title}
              accessibilityRole="header"
              allowFontScaling
            >
              {parish.name}
            </Text>
          </View>
          {parish.type ? (
            <Badge
              label={parish.type}
              variant="primary"
              style={styles.typeBadge}
            />
          ) : null}
        </View>

        {parish.patronSaint ? (
          <View style={styles.metaRow}>
            <Ionicons
              name="sparkles-outline"
              size={14}
              color={colors.primary}
              style={styles.metaIcon}
              accessibilityElementsHidden={true}
              importantForAccessibility="no"
            />
            <Text style={styles.patronText} allowFontScaling>
              Patron: {parish.patronSaint}
            </Text>
          </View>
        ) : null}

        {locationLabel || parish.address ? (
          <View style={styles.metaRow}>
            <Ionicons
              name="location-outline"
              size={14}
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

        <View style={styles.footerRow}>
          <Text style={styles.viewDetailText} allowFontScaling>
            View Parish Details
          </Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={colors.primary}
            accessibilityElementsHidden={true}
            importantForAccessibility="no"
          />
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 0,
    overflow: "hidden",
    marginBottom: spacing.md,
  },
  imageContainer: {
    width: "100%",
    height: 140,
    backgroundColor: colors.surfaceVariant,
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  content: {
    padding: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.xs,
  },
  titleContainer: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  title: {
    ...fontStyles.titleMedium,
    color: colors.textPrimary,
  },
  typeBadge: {
    marginTop: spacing.xxs,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xs,
  },
  metaIcon: {
    marginRight: spacing.xs,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  patronText: {
    ...fontStyles.bodySmall,
    color: colors.primary,
    flex: 1,
  },
  locationText: {
    ...fontStyles.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  viewDetailText: {
    ...fontStyles.captionMedium,
    color: colors.primary,
    marginRight: spacing.xxs,
  },
});


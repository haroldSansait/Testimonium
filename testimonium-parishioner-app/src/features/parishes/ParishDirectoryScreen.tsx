import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { AppHeader, IconButton, InlineError } from "@/components/ui";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import { useInfiniteParishes } from "./api";
import { isValidCoordinate } from "./utils";
import type { ParishDto } from "./types";
import ParishMapDOM, { type ParishMapItem } from "./components/ParishMapDOM";
import { ParishInfoSheet } from "./components/ParishInfoSheet";

export const ParishDirectoryScreen: React.FC = () => {
  const [selectedParishId, setSelectedParishId] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);

  // Fetch parishes through existing useInfiniteParishes hook
  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError,
    refetch,
  } = useInfiniteParishes({}, 30);

  // Auto-fetch remaining pages if pagination is active to ensure all active parishes appear on the map
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Flatten pages into active parish list
  const parishes = useMemo<ParishDto[]>(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.items);
  }, [data]);

  // Filter only parishes with valid coordinates for the map
  const validParishes = useMemo<ParishDto[]>(() => {
    return parishes.filter((p) => isValidCoordinate(p.latitude, p.longitude));
  }, [parishes]);

  // Serializable items passed to the DOM Leaflet component
  const parishMapItems = useMemo<ParishMapItem[]>(() => {
    return validParishes.map((p) => ({
      id: String(p.id),
      name: p.name,
      type: p.type,
      latitude: p.latitude as number,
      longitude: p.longitude as number,
      pinColor: p.pinColor,
      showLabel: p.showLabel,
      mapZoom: p.mapZoom,
    }));
  }, [validParishes]);

  // Currently selected parish for bottom sheet
  const selectedParish = useMemo<ParishDto | null>(() => {
    if (!selectedParishId) return null;
    return parishes.find((p) => String(p.id) === String(selectedParishId)) || null;
  }, [selectedParishId, parishes]);

  const handleSelectParish = useCallback((id: string) => {
    setSelectedParishId(id);
  }, []);

  const handleCloseSheet = useCallback(() => {
    setSelectedParishId(null);
  }, []);

  const handleResetOverview = useCallback(() => {
    setResetSignal((prev) => prev + 1);
  }, []);

  const isInitialLoading = isLoading && parishes.length === 0;
  const isInitialError = isError && parishes.length === 0;
  const isBackgroundError = isError && parishes.length > 0;

  return (
    <Screen safeArea={true} edges={["top", "left", "right"]} style={styles.screen}>
      <AppHeader
        title="Parish Directory"
        subtitle="Vicariate of Canlaon"
        rightAction={
          <View style={styles.headerActions}>
            <IconButton
              size={44}
              onPress={handleResetOverview}
              accessibilityLabel="Reset map overview"
              accessibilityHint="Centers map to show all parishes in the Vicariate of Canlaon"
            >
              <Ionicons
                name="locate-outline"
                size={21}
                color={colors.primary}
              />
            </IconButton>
            <IconButton
              size={44}
              onPress={() => void refetch()}
              accessibilityLabel="Refresh parish directory"
              accessibilityHint="Reloads directory information from the server"
              disabled={isFetching && !hasNextPage}
            >
              <Ionicons
                name="refresh-outline"
                size={21}
                color={colors.primary}
              />
            </IconButton>
          </View>
        }
      />

      {/* Background refresh error banner */}
      {isBackgroundError ? (
        <View style={styles.bannerContainer}>
          <InlineError
            message="Could not update directory. Showing cached results."
            onRetry={() => {
              void refetch();
            }}
            retrying={isFetching}
          />
        </View>
      ) : null}

      {/* Main Map Viewport */}
      <View style={styles.mapViewport}>
        {isInitialLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText} allowFontScaling>
              Loading parish directory map…
            </Text>
          </View>
        ) : isInitialError ? (
          <View style={styles.centerContainer}>
            <InlineError
              message="Unable to load parishes. Please check your network connection and try again."
              onRetry={() => {
                void refetch();
              }}
              retrying={isFetching}
            />
          </View>
        ) : (
          <View style={styles.domContainer}>
            <ParishMapDOM
              parishes={parishMapItems}
              selectedParishId={selectedParishId}
              onSelectParish={handleSelectParish}
              resetSignal={resetSignal}
              dom={{
                scrollEnabled: false,
                bounces: false,
              }}
            />

            {/* Empty coordinates notice */}
            {validParishes.length === 0 ? (
              <View style={styles.emptyNotice}>
                <Ionicons
                  name="information-circle-outline"
                  size={18}
                  color={colors.textSecondary}
                />
                <Text style={styles.emptyNoticeText} allowFontScaling>
                  No active parish coordinates available for mapping.
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Native Parish Information Bottom Sheet */}
        <ParishInfoSheet
          parish={selectedParish}
          visible={Boolean(selectedParish)}
          onClose={handleCloseSheet}
        />
      </View>
    </Screen>
  );
};

export default ParishDirectoryScreen;

const styles = StyleSheet.create({
  screen: {
    padding: 0,
    backgroundColor: colors.background,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  bannerContainer: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
    zIndex: 10,
  },
  mapViewport: {
    flex: 1,
    width: "100%",
    position: "relative",
    backgroundColor: colors.surfaceVariant,
  },
  domContainer: {
    flex: 1,
    width: "100%",
    height: "100%",
    overflow: "hidden",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
    gap: spacing.sm,
  },
  loadingText: {
    ...fontStyles.bodySmall,
    color: colors.neutral[650],
  },
  emptyNotice: {
    position: "absolute",
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    zIndex: 5,
  },
  emptyNoticeText: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    flex: 1,
  },
});

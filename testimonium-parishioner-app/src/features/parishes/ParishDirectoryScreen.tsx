import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text, TextInput } from "@/components/Typography";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import {
  AppHeader,
  Divider,
  EmptyState,
  IconButton,
  InlineError,
  SegmentedControl,
  StatusLabel,
} from "@/components/ui";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import { useInfiniteParishes } from "./api";
import { isValidCoordinate } from "./utils";
import type { ParishDto } from "./types";
import ParishMapDOM, { type ParishMapItem } from "./components/ParishMapDOM";
import { ParishInfoSheet } from "./components/ParishInfoSheet";

type DirectoryViewMode = "map" | "list";

export const ParishDirectoryScreen: React.FC = () => {
  const [selectedParishId, setSelectedParishId] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<DirectoryViewMode>("map");

  // Fetch parishes through existing useInfiniteParishes hook with complete pagination
  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError,
    refetch,
  } = useInfiniteParishes({}, 100);

  // Auto-fetch remaining pages if pagination is active to ensure all active parishes appear
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Flatten and deduplicate pages into active parish list
  const parishes = useMemo<ParishDto[]>(() => {
    if (!data?.pages) return [];
    const seen = new Set<string>();
    const list: ParishDto[] = [];
    for (const page of data.pages) {
      for (const parish of page.items) {
        const key = String(parish.id);
        if (!seen.has(key)) {
          seen.add(key);
          list.push(parish);
        }
      }
    }
    return list;
  }, [data]);

  const filteredParishes = useMemo<ParishDto[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return parishes;
    return parishes.filter((p) =>
      [p.name, p.municipalityCity, p.province, p.patronSaint, p.feastDay, p.address, p.type]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q))
    );
  }, [parishes, searchQuery]);

  // Filter only parishes with valid coordinates for the map
  const validParishes = useMemo<ParishDto[]>(() => {
    return filteredParishes.filter((p) => isValidCoordinate(p.latitude, p.longitude));
  }, [filteredParishes]);

  const unmappedCount = filteredParishes.length - validParishes.length;

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

      {/* Search & View Toggle Controls */}
      <View style={styles.controlsBar}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color={colors.textMuted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search parish, city, patron saint, feast day..."
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            accessibilityLabel="Search parishes"
          />
          {searchQuery.length > 0 ? (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              accessibilityRole="button"
              accessibilityLabel="Clear parish search"
            >
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.viewToggleRow}>
          <View style={styles.toggleControlWrap}>
            <SegmentedControl<DirectoryViewMode>
              options={[
                { value: "map", label: `Map (${validParishes.length})` },
                { value: "list", label: `List (${filteredParishes.length})` },
              ]}
              selectedValue={viewMode}
              onSelect={setViewMode}
            />
          </View>
          {viewMode === "map" && unmappedCount > 0 ? (
            <TouchableOpacity
              onPress={() => setViewMode("list")}
              accessibilityRole="button"
              style={styles.unmappedChip}
            >
              <Text style={styles.unmappedChipText} allowFontScaling>
                +{unmappedCount} in list
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Main Map / List Viewport */}
      <View style={styles.mapViewport}>
        {isInitialLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText} allowFontScaling>
              Loading parish directory…
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
        ) : viewMode === "list" ? (
          <FlatList
            data={filteredParishes}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <Divider />}
            renderItem={({ item }) => {
              const hasCoords = isValidCoordinate(item.latitude, item.longitude);
              const subtitle = [item.municipalityCity, item.province].filter(Boolean).join(", ");
              return (
                <TouchableOpacity
                  style={styles.listRow}
                  onPress={() => handleSelectParish(String(item.id))}
                  accessibilityRole="button"
                  accessibilityLabel={`View details for ${item.name}`}
                >
                  <View style={styles.listRowHeader}>
                    <Text style={styles.listRowTitle} allowFontScaling>
                      {item.name}
                    </Text>
                    <StatusLabel label={item.type || "Parish"} status="neutral" showDot={false} />
                  </View>
                  {subtitle ? (
                    <Text style={styles.listRowSub} allowFontScaling>
                      {subtitle}
                    </Text>
                  ) : null}
                  {item.patronSaint ? (
                    <Text style={styles.listRowPatron} allowFontScaling>
                      Patron: {item.patronSaint}{item.feastDay ? ` • Feast: ${item.feastDay}` : ""}
                    </Text>
                  ) : null}
                  {!hasCoords ? (
                    <Text style={styles.noCoordsText} allowFontScaling>
                      Map pin unavailable • Tap for full parish info
                    </Text>
                  ) : null}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <EmptyState
                icon="search-outline"
                title="No matching parishes"
                description="Try clearing your search filter to see all parishes in the Vicariate of Canlaon."
                actionLabel={searchQuery ? "Clear Search" : undefined}
                onAction={searchQuery ? () => setSearchQuery("") : undefined}
              />
            }
          />
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
                  {searchQuery
                    ? "No mapped parishes match that search. Switch to List view to see all results."
                    : "No active parish coordinates available for mapping."}
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
  controlsBar: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
    gap: spacing.xs,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  searchInput: {
    flex: 1,
    ...fontStyles.bodySmall,
    color: colors.textPrimary,
    paddingVertical: 2,
  },
  viewToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  toggleControlWrap: {
    flex: 1,
  },
  unmappedChip: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceVariant,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  unmappedChipText: {
    ...fontStyles.caption,
    color: colors.primary,
    fontWeight: "700",
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    backgroundColor: colors.background,
    flexGrow: 1,
  },
  listRow: {
    paddingVertical: spacing.md,
    gap: 4,
  },
  listRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  listRowTitle: {
    ...fontStyles.bodySmall,
    fontWeight: "700",
    color: colors.textPrimary,
    flex: 1,
  },
  listRowSub: {
    ...fontStyles.caption,
    color: colors.textSecondary,
  },
  listRowPatron: {
    ...fontStyles.caption,
    color: colors.primary,
  },
  noCoordsText: {
    ...fontStyles.caption,
    color: colors.textMuted,
    fontStyle: "italic",
  },
});

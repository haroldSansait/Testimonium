import React, { useState } from "react";
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { AppHeader, Button, EmptyState, FilterChip, Skeleton } from "@/components/ui";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import { useRequireCompleteProfile } from "@/hooks/useRequireCompleteProfile";
import { useRequestList, useRequestTrackingLookup } from "./api";
import { RequestCard } from "./components/RequestCard";
import type { DocumentRequestDetail } from "./types";

type FilterTab = "ALL" | "ACTIVE" | "COMPLETED";

export const RequestListScreen: React.FC = () => {
  const router = useRouter();
  const { requireCompleteProfile } = useRequireCompleteProfile();
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  const [trackingNumber, setTrackingNumber] = useState("");
  const trackingLookup = useRequestTrackingLookup();

  const {
    data: response,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useRequestList();

  const requests = response?.data || [];

  const activeCount = requests.filter(
    (req) => !["COMPLETED", "CANCELLED", "REJECTED"].includes(req.status)
  ).length;

  const pastCount = requests.filter(
    (req) => ["COMPLETED", "CANCELLED", "REJECTED"].includes(req.status)
  ).length;

  const filteredRequests = requests.filter((req) => {
    if (activeTab === "ACTIVE") {
      return !["COMPLETED", "CANCELLED", "REJECTED"].includes(req.status);
    }
    if (activeTab === "COMPLETED") {
      return ["COMPLETED", "CANCELLED", "REJECTED"].includes(req.status);
    }
    return true;
  });

  const handleStartRequest = () => {
    requireCompleteProfile(() => {
      router.push("/(app)/requests/new" as any);
    });
  };

  const handleRequestPress = (request: DocumentRequestDetail) => {
    router.push(`/(app)/requests/${request.id}` as any);
  };

  const handleTrackingLookup = async () => {
    if (!trackingNumber.trim()) {
      Alert.alert("Tracking Number Required", "Enter the tracking number shown on your request.");
      return;
    }
    try {
      const request = await trackingLookup.mutateAsync(trackingNumber);
      router.push(`/(app)/requests/${request.id}` as any);
    } catch (err: any) {
      Alert.alert("Request Not Found", err?.message || "We could not find one of your requests with that tracking number.");
    }
  };

  return (
    <Screen safeArea={true} style={styles.screen}>
      <AppHeader
        title="Document Requests"
        subtitle="Certificates & Ecclesial Records"
        rightAction={
          <Button
            title="New"
            size="sm"
            variant="primary"
            icon="add"
            onPress={handleStartRequest}
            accessibilityLabel="Start a new document request"
          />
        }
      />

      {/* Tracking Search Bar */}
      <View style={styles.trackingBar}>
        <View style={styles.inputWrapper}>
          <Ionicons
            name="search-outline"
            size={18}
            color={colors.textSecondary}
            style={styles.searchIcon}
          />
          <TextInput
            value={trackingNumber}
            onChangeText={setTrackingNumber}
            placeholder="Search by tracking number..."
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            style={styles.trackingInput}
            accessibilityLabel="Request tracking number"
            returnKeyType="search"
            onSubmitEditing={() => void handleTrackingLookup()}
          />
        </View>
        <Button
          title="Track"
          size="sm"
          variant="outline"
          loading={trackingLookup.isPending}
          disabled={!trackingNumber.trim()}
          onPress={() => void handleTrackingLookup()}
          accessibilityLabel="Find document request by tracking number"
        />
      </View>

      {/* Filter Chips Bar */}
      <View style={styles.tabBar}>
        <FilterChip
          label="All Requests"
          count={requests.length}
          selected={activeTab === "ALL"}
          onPress={() => setActiveTab("ALL")}
        />
        <FilterChip
          label="Active"
          count={activeCount}
          selected={activeTab === "ACTIVE"}
          onPress={() => setActiveTab("ACTIVE")}
        />
        <FilterChip
          label="Past / Completed"
          count={pastCount}
          selected={activeTab === "COMPLETED"}
          onPress={() => setActiveTab("COMPLETED")}
        />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {isLoading ? (
          <View style={styles.skeletonContainer}>
            <Skeleton width="100%" height={120} style={styles.skeletonItem} />
            <Skeleton width="100%" height={120} style={styles.skeletonItem} />
            <Skeleton width="100%" height={120} style={styles.skeletonItem} />
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <EmptyState
              icon="alert-circle-outline"
              title="Unable to Load Requests"
              description="There was a problem loading your document requests. Please check your connection and try again."
              actionLabel="Retry"
              onAction={() => void refetch()}
            />
          </View>
        ) : filteredRequests.length === 0 ? (
          <View style={styles.centerContainer}>
            <EmptyState
              icon="document-text-outline"
              title={
                activeTab === "ACTIVE"
                  ? "No Active Requests"
                  : activeTab === "COMPLETED"
                  ? "No Past Requests"
                  : "No Requests Yet"
              }
              description={
                activeTab === "ALL"
                  ? "Request official baptismal, confirmation, or marriage certificates from any parish in the Diocese of San Carlos."
                  : "You do not have any requests matching this filter."
              }
              actionLabel={activeTab === "ALL" ? "Start New Request" : undefined}
              onAction={activeTab === "ALL" ? handleStartRequest : undefined}
            />
          </View>
        ) : (
          <FlatList
            data={filteredRequests}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <RequestCard request={item} onPress={handleRequestPress} />
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isFetching && !isLoading}
                onRefresh={() => void refetch()}
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            }
          />
        )}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    padding: 0,
    backgroundColor: colors.background,
  },
  trackingBar: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    alignItems: "center",
  },
  inputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
  },
  searchIcon: {
    marginRight: spacing.xs,
  },
  trackingInput: {
    flex: 1,
    minHeight: 40,
    ...fontStyles.bodySmall,
    color: colors.textPrimary,
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
    gap: spacing.xs,
  },
  content: {
    flex: 1,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  skeletonContainer: {
    padding: spacing.md,
  },
  skeletonItem: {
    marginBottom: spacing.sm,
    borderRadius: radii.md,
  },
  centerContainer: {
    flex: 1,
    padding: spacing.md,
    justifyContent: "center",
  },
});

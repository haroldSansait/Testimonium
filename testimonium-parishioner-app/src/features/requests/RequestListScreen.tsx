import React, { useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { AppHeader, Button, EmptyState, Skeleton } from "@/components/ui";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import { useRequestList } from "./api";
import { RequestCard } from "./components/RequestCard";
import type { DocumentRequestDetail } from "./types";

type FilterTab = "ALL" | "ACTIVE" | "COMPLETED";

export const RequestListScreen: React.FC = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");

  const {
    data: response,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useRequestList();

  const requests = response?.data || [];

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
    router.push("/(app)/requests/new" as any);
  };

  const handleRequestPress = (request: DocumentRequestDetail) => {
    router.push(`/(app)/requests/${request.id}` as any);
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

      {/* Filter Tabs */}
      <View style={styles.tabBar}>
        {(["ALL", "ACTIVE", "COMPLETED"] as FilterTab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab }}
            accessibilityLabel={`${tab.toLowerCase()} requests`}
          >
            <Text
              style={[
                styles.tabLabel,
                activeTab === tab && styles.tabLabelActive,
              ]}
              allowFontScaling
            >
              {tab === "ALL" ? "All Requests" : tab === "ACTIVE" ? "Active" : "Past"}
            </Text>
          </TouchableOpacity>
        ))}
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
                  ? "Request official baptismal, confirmation, or marriage certificates from any diocese parish."
                  : "You do not have any requests in this filter."
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
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: spacing.xs,
  },
  tabItem: {
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  tabItemActive: {
    backgroundColor: colors.primarySoft,
  },
  tabLabel: {
    ...fontStyles.bodyMedium,
    color: colors.textSecondary,
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: "700",
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

import React, { useRef, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import {
  AppHeader,
  Badge,
  Button,
  Card,
  EmptyState,
  SectionHeader,
  Skeleton,
} from "@/components/ui";
import { navigateBackOrReplace } from "@/services/navigation/back";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import {
  useCancelRequest,
  useDocumentRequirements,
  useRequestDetail,
  useResubmitCorrections,
  useSubmitRequestDraft,
  useUploadSupportingFile,
} from "./api";
import { RequestStatusTimeline } from "./components/RequestStatusTimeline";
import { SupportingFilePicker } from "./components/SupportingFilePicker";
import {
  formatDate,
  formatDocumentType,
  formatFee,
  formatStatus,
  isCancelEligible,
  isDocumentCorrectionEligible,
  isPaymentEligible,
} from "./presentation";
import type { LocalSelectedFile } from "./types";

export interface RequestDetailScreenProps {
  requestId?: string | null;
}

export const RequestDetailScreen: React.FC<RequestDetailScreenProps> = ({
  requestId,
}) => {
  const router = useRouter();
  const isValidId = Boolean(requestId && /^[1-9]\d*$/.test(String(requestId).trim()));

  const {
    data: request,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useRequestDetail(isValidId ? requestId : null);

  const { data: requirements } = useDocumentRequirements(
    request ? { documentType: request.documentType, parishId: request.parishId } : undefined
  );

  const [correctionFiles, setCorrectionFiles] = useState<Record<string, LocalSelectedFile>>({});
  const [draftFiles, setDraftFiles] = useState<Record<string, LocalSelectedFile>>({});
  const [draftUploadingReqId, setDraftUploadingReqId] = useState<string | null>(null);
  const inFlightGuard = useRef(false);

  const cancelMutation = useCancelRequest();
  const resubmitMutation = useResubmitCorrections();
  const submitDraftMutation = useSubmitRequestDraft();
  const uploadFileMutation = useUploadSupportingFile();

  const handleBack = () => {
    navigateBackOrReplace(
      () => router.canGoBack(),
      () => router.back(),
      () => router.replace("/(app)/(tabs)/(requests)" as any)
    );
  };

  const handleGoToPayment = () => {
    if (!request) return;
    router.push(`/(app)/requests/${request.id}/payment` as any);
  };

  const handleCancelPress = () => {
    if (!request || inFlightGuard.current) return;

    Alert.alert(
      "Cancel Request",
      `Are you sure you want to cancel this request (${request.trackingNumber || "Draft"})? This action cannot be undone.`,
      [
        { text: "Keep Request", style: "cancel" },
        {
          text: "Cancel Request",
          style: "destructive",
          onPress: async () => {
            if (inFlightGuard.current) return;
            inFlightGuard.current = true;
            try {
              await cancelMutation.mutateAsync({
                requestId: request.id,
                remarks: "Cancelled by parishioner from mobile app",
              });
              Alert.alert("Request Cancelled", "Your request has been cancelled.");
            } catch (err: any) {
              Alert.alert("Cancellation Failed", err.message || "Could not cancel request.");
              void refetch();
            } finally {
              inFlightGuard.current = false;
            }
          },
        },
      ]
    );
  };

  const handleDraftFileUpload = async (requirementId: string, localFile: LocalSelectedFile) => {
    if (!request || inFlightGuard.current) return;
    inFlightGuard.current = true;
    setDraftUploadingReqId(requirementId);

    try {
      await uploadFileMutation.mutateAsync({
        requestId: request.id,
        file: localFile,
        category: requirementId,
      });
      setDraftFiles((prev) => ({ ...prev, [requirementId]: localFile }));
      Alert.alert("Attachment Uploaded", `"${localFile.name}" has been attached to your draft.`);
      void refetch();
    } catch (err: any) {
      Alert.alert(
        "Upload Failed",
        err.message || "Could not attach file to draft. Please try again."
      );
      void refetch();
    } finally {
      inFlightGuard.current = false;
      setDraftUploadingReqId(null);
    }
  };

  const handleResubmitCorrections = async () => {
    if (!request || inFlightGuard.current) return;

    const missingUploads = correctionIds.filter((id) => !correctionFiles[id]);
    if (missingUploads.length > 0) {
      Alert.alert(
        "Missing Attachments",
        "Please select replacement files for all requested corrections before resubmitting."
      );
      return;
    }

    inFlightGuard.current = true;

    try {
      // 1. Upload replacement files sequentially
      for (const reqId of correctionIds) {
        const file = correctionFiles[reqId];
        await uploadFileMutation.mutateAsync({
          requestId: request.id,
          file,
          category: reqId,
        });
      }

      // 2. Resubmit request
      await resubmitMutation.mutateAsync(request.id);

      Alert.alert(
        "Corrections Submitted",
        "Your corrected documents have been submitted and are awaiting staff review."
      );
    } catch (err: any) {
      Alert.alert(
        "Resubmission Error",
        err.message || "Failed to resubmit corrected documents. Please try again."
      );
      void refetch();
    } finally {
      inFlightGuard.current = false;
    }
  };

  const handleFinalizeDraft = async () => {
    if (!request || inFlightGuard.current) return;

    const requiredDocs = (requirements?.requiredDocuments || []).filter((d) => d.required);
    const uploadedIds = new Set((request.attachments || []).map((a) => a.category));
    const missing = requiredDocs.filter((d) => !uploadedIds.has(d.id));

    if (missing.length > 0) {
      const names = missing.map((m) => m.label || m.id).join("\n• ");
      Alert.alert(
        "Required Documents Missing",
        `Please attach all required documents before submitting this request:\n\n• ${names}`
      );
      return;
    }

    inFlightGuard.current = true;
    try {
      await submitDraftMutation.mutateAsync(request.id);
      Alert.alert(
        "Request Submitted",
        "Your request has been successfully submitted and forwarded to the parish."
      );
    } catch (err: any) {
      Alert.alert(
        "Submission Failed",
        err.message || "Could not submit draft request. Please check required attachments."
      );
      void refetch();
    } finally {
      inFlightGuard.current = false;
    }
  };

  if (!isValidId || (!isLoading && (error || !request))) {
    return (
      <Screen safeArea={true} style={styles.screen}>
        <AppHeader
          title="Request Details"
          onBack={handleBack}
          backAccessibilityLabel="Back to requests list"
        />
        <View style={styles.centerContainer}>
          <EmptyState
            icon="alert-circle-outline"
            title="Request Unavailable"
            description="The requested document application could not be found or you do not have permission to view it."
            actionLabel="Return to Requests"
            onAction={handleBack}
          />
        </View>
      </Screen>
    );
  }

  const statusInfo = request
    ? formatStatus(request.status, request.isDraft)
    : null;
  const docTypeLabel = request
    ? formatDocumentType(request.documentType)
    : "Document Request";
  const feeLabel = request ? formatFee(request.fee) : "Fee unavailable";
  const isPaymentActionAvailable = isPaymentEligible(request);
  const isCorrectionActionAvailable = isDocumentCorrectionEligible(request);
  const isCancellationAvailable = isCancelEligible(request);

  const attachments = request?.attachments || [];
  const correctionIds = request?.correctionRequirementIds || [];

  const requiredDocuments = requirements?.requiredDocuments || [];
  const requiredDocs = requiredDocuments.filter((d) => d.required);
  const uploadedRequirementIds = new Set(attachments.map((a) => a.category));
  const missingRequiredDocs = requiredDocs.filter((d) => !uploadedRequirementIds.has(d.id));
  const isDraftComplete = missingRequiredDocs.length === 0;

  return (
    <Screen safeArea={true} style={styles.screen}>
      <AppHeader
        title={docTypeLabel}
        subtitle={request?.trackingNumber || "Draft Request"}
        onBack={handleBack}
        backAccessibilityLabel="Back to requests list"
      />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Skeleton width="100%" height={140} style={styles.skeletonCard} />
          <Skeleton width="100%" height={180} style={styles.skeletonCard} />
          <Skeleton width="100%" height={160} style={styles.skeletonCard} />
        </View>
      ) : request && statusInfo ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={() => void refetch()}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        >
          {/* Header Card */}
          <Card style={styles.headerCard}>
            <View style={styles.statusRow}>
              <Badge
                label={statusInfo.label}
                variant={statusInfo.variant}
                size="md"
              />
              {request.trackingNumber ? (
                <Text style={styles.trackingRef} allowFontScaling>
                  Ref: {request.trackingNumber}
                </Text>
              ) : null}
            </View>

            <Text style={styles.statusDescription} allowFontScaling>
              {statusInfo.description}
            </Text>

            {/* Attention Action Banners */}
            {request.isDraft ? (
              <View style={styles.draftBox}>
                <View style={styles.draftBoxHeader}>
                  <Ionicons name="document-text-outline" size={20} color={colors.primary} />
                  <Text style={styles.draftBoxTitle} allowFontScaling>
                    Draft Request — Attachment Checklist
                  </Text>
                </View>
                <Text style={styles.draftBoxDesc} allowFontScaling>
                  {isDraftComplete
                    ? "All required attachments have been uploaded to this draft. You can now finalize and submit."
                    : `Please attach the remaining ${missingRequiredDocs.length} required document(s) to continue this draft.`}
                </Text>

                {/* Draft Requirements Checklist & Pickers */}
                {requiredDocuments.map((reqDoc) => {
                  const uploadedAtt = attachments.find((a) => a.category === reqDoc.id);

                  if (uploadedAtt) {
                    return (
                      <View key={reqDoc.id} style={styles.draftUploadedRow}>
                        <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                        <View style={styles.draftUploadedDetails}>
                          <Text style={styles.draftUploadedLabel} allowFontScaling>
                            {reqDoc.label || reqDoc.id}
                          </Text>
                          <Text style={styles.draftUploadedFileName} numberOfLines={1} allowFontScaling>
                            {uploadedAtt.fileName} • Server Attachment
                          </Text>
                        </View>
                      </View>
                    );
                  }

                  return (
                    <View key={reqDoc.id} style={styles.draftMissingItem}>
                      <SupportingFilePicker
                        requirement={reqDoc}
                        selectedFile={draftFiles[reqDoc.id]}
                        onFileSelected={(file) => handleDraftFileUpload(reqDoc.id, file)}
                        onFileRemoved={() => {
                          setDraftFiles((prev) => {
                            const updated = { ...prev };
                            delete updated[reqDoc.id];
                            return updated;
                          });
                        }}
                        disabled={
                          uploadFileMutation.isPending ||
                          submitDraftMutation.isPending ||
                          draftUploadingReqId === reqDoc.id
                        }
                      />
                    </View>
                  );
                })}

                <Button
                  title={
                    isDraftComplete
                      ? "Finalize & Submit Request"
                      : `Submit Request (${missingRequiredDocs.length} Required Missing)`
                  }
                  variant={isDraftComplete ? "primary" : "outline"}
                  size="md"
                  icon="checkmark-circle-outline"
                  onPress={handleFinalizeDraft}
                  loading={submitDraftMutation.isPending}
                  disabled={submitDraftMutation.isPending || Boolean(draftUploadingReqId)}
                  style={styles.actionBtn}
                  accessibilityLabel="Finalize and submit draft request"
                />
              </View>
            ) : isPaymentActionAvailable ? (
              <View style={styles.paymentBox}>
                <View style={styles.paymentBoxHeader}>
                  <Ionicons name="card-outline" size={20} color={colors.primary} />
                  <Text style={styles.paymentBoxTitle} allowFontScaling>
                    Payment Required: {feeLabel}
                  </Text>
                </View>
                {request.paymentCorrectionNote ? (
                  <Text style={styles.paymentCorrectionNote} allowFontScaling>
                    Note: {request.paymentCorrectionNote}
                  </Text>
                ) : null}
                <Button
                  title="Pay & Upload Receipt"
                  variant="primary"
                  size="md"
                  icon="arrow-forward"
                  onPress={handleGoToPayment}
                  style={styles.actionBtn}
                  accessibilityLabel={`Pay ${feeLabel} and upload proof of payment`}
                />
              </View>
            ) : isCorrectionActionAvailable ? (
              <View style={styles.correctionBox}>
                <View style={styles.correctionBoxHeader}>
                  <Ionicons name="alert-circle-outline" size={20} color={colors.danger} />
                  <Text style={styles.correctionBoxTitle} allowFontScaling>
                    Document Corrections Required
                  </Text>
                </View>
                {request.correctionNote ? (
                  <Text style={styles.correctionNoteText} allowFontScaling>
                    Staff Note: {request.correctionNote}
                  </Text>
                ) : null}

                {/* Correction Upload Pickers */}
                {correctionIds.map((reqId) => {
                  const reqDoc = requirements?.requiredDocuments?.find((d) => d.id === reqId) || {
                    id: reqId,
                    label: reqId.replace(/_/g, " "),
                    category: "supporting",
                    required: true,
                  };

                  return (
                    <SupportingFilePicker
                      key={reqId}
                      requirement={reqDoc}
                      selectedFile={correctionFiles[reqId]}
                      onFileSelected={(f) =>
                        setCorrectionFiles((prev) => ({ ...prev, [reqId]: f }))
                      }
                      onFileRemoved={(id) =>
                        setCorrectionFiles((prev) => {
                          const updated = { ...prev };
                          delete updated[id];
                          return updated;
                        })
                      }
                    />
                  );
                })}

                <Button
                  title="Resubmit Corrected Documents"
                  variant="primary"
                  size="md"
                  icon="send-outline"
                  onPress={handleResubmitCorrections}
                  loading={resubmitMutation.isPending || uploadFileMutation.isPending}
                  style={styles.actionBtn}
                  accessibilityLabel="Resubmit corrected document attachments"
                />
              </View>
            ) : null}
          </Card>

          {/* Applicant & Request Information */}
          <Card style={styles.sectionCard}>
            <SectionHeader title="Application Details" />
            <View style={styles.detailsGrid}>
              <View style={styles.detailItem}>
                <Text style={styles.fieldLabel} allowFontScaling>
                  Applicant Name
                </Text>
                <Text style={styles.fieldValue} allowFontScaling>
                  {request.applicantName}
                </Text>
              </View>

              <View style={styles.detailItem}>
                <Text style={styles.fieldLabel} allowFontScaling>
                  Relationship
                </Text>
                <Text style={styles.fieldValue} allowFontScaling>
                  {request.relationship || "Self"}
                </Text>
              </View>

              <View style={styles.detailItem}>
                <Text style={styles.fieldLabel} allowFontScaling>
                  Target Parish
                </Text>
                <Text style={styles.fieldValue} allowFontScaling>
                  {request.parish?.parishName || "Parish"}
                </Text>
              </View>

              <View style={styles.detailItem}>
                <Text style={styles.fieldLabel} allowFontScaling>
                  Date Requested
                </Text>
                <Text style={styles.fieldValue} allowFontScaling>
                  {formatDate(request.dateRequested)}
                </Text>
              </View>

              {request.purpose ? (
                <View style={[styles.detailItem, { width: "100%" }]}>
                  <Text style={styles.fieldLabel} allowFontScaling>
                    Purpose / Reason
                  </Text>
                  <Text style={styles.fieldValue} allowFontScaling>
                    {request.purpose}
                  </Text>
                </View>
              ) : null}
            </View>
          </Card>

          {/* Fee & Payment Summary */}
          <Card style={styles.sectionCard}>
            <SectionHeader title="Payment & Fee Snapshot" />
            <View style={styles.feeSummaryRow}>
              <Text style={styles.feeLabel} allowFontScaling>
                Document Fee:
              </Text>
              <Text style={styles.feeValue} allowFontScaling>
                {feeLabel}
              </Text>
            </View>
            <View style={styles.feeSummaryRow}>
              <Text style={styles.feeLabel} allowFontScaling>
                Payment Status:
              </Text>
              <Badge
                label={
                  request.paymentStatus === "CONFIRMED"
                    ? "Paid / Confirmed"
                    : request.paymentStatus === "PROOF_SUBMITTED"
                    ? "Proof Submitted"
                    : "Unpaid"
                }
                variant={
                  request.paymentStatus === "CONFIRMED"
                    ? "success"
                    : request.paymentStatus === "PROOF_SUBMITTED"
                    ? "info"
                    : "neutral"
                }
                size="sm"
              />
            </View>
          </Card>

          {/* Supporting Documents List */}
          {attachments.length > 0 ? (
            <Card style={styles.sectionCard}>
              <SectionHeader title="Submitted Attachments" />
              {attachments.map((att) => (
                <View key={att.id} style={styles.attachmentRow}>
                  <Ionicons
                    name="document-attach-outline"
                    size={20}
                    color={colors.primary}
                    style={styles.attachmentIcon}
                  />
                  <View style={styles.attachmentDetails}>
                    <Text style={styles.attachmentName} numberOfLines={1} allowFontScaling>
                      {att.fileName}
                    </Text>
                    <Text style={styles.attachmentMeta} allowFontScaling>
                      {att.category} • {formatDate(att.uploadedAt)}
                    </Text>
                  </View>
                </View>
              ))}
            </Card>
          ) : null}

          {/* Real Activity & History */}
          <Card style={styles.sectionCard}>
            <SectionHeader title="Request History & Timeline" />
            <RequestStatusTimeline
              history={request.requestHistory}
              estimatedDays={requirements?.estimatedProcessingDays}
            />
          </Card>

          {/* Cancel Action */}
          {isCancellationAvailable ? (
            <View style={styles.cancelContainer}>
              <Button
                title="Cancel Request"
                variant="outline"
                size="md"
                onPress={handleCancelPress}
                loading={cancelMutation.isPending}
                style={styles.cancelBtn}
                accessibilityLabel="Cancel this document request"
              />
            </View>
          ) : null}
        </ScrollView>
      ) : null}
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    padding: 0,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  loadingContainer: {
    padding: spacing.md,
  },
  skeletonCard: {
    marginBottom: spacing.md,
    borderRadius: radii.md,
  },
  centerContainer: {
    flex: 1,
    padding: spacing.md,
    justifyContent: "center",
  },
  headerCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  trackingRef: {
    ...fontStyles.captionMedium,
    color: colors.textSecondary,
  },
  statusDescription: {
    ...fontStyles.bodySmall,
    color: colors.textSecondary,
    marginVertical: spacing.xs,
  },
  draftBox: {
    backgroundColor: colors.primarySoft,
    padding: spacing.md,
    borderRadius: radii.sm,
    marginTop: spacing.sm,
  },
  draftBoxHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  draftBoxTitle: {
    ...fontStyles.bodyMedium,
    color: colors.primary,
    fontWeight: "700",
  },
  draftBoxDesc: {
    ...fontStyles.caption,
    color: colors.textPrimary,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  draftUploadedRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: radii.xs,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: spacing.xs,
  },
  draftUploadedDetails: {
    flex: 1,
  },
  draftUploadedLabel: {
    ...fontStyles.captionMedium,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  draftUploadedFileName: {
    ...fontStyles.caption,
    color: colors.textSecondary,
  },
  draftMissingItem: {
    marginBottom: spacing.xs,
  },
  paymentBox: {
    backgroundColor: colors.primarySoft,
    padding: spacing.md,
    borderRadius: radii.sm,
    marginTop: spacing.sm,
  },
  paymentBoxHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  paymentBoxTitle: {
    ...fontStyles.bodyMedium,
    color: colors.primary,
    fontWeight: "700",
  },
  paymentCorrectionNote: {
    ...fontStyles.caption,
    color: colors.textPrimary,
    marginTop: 4,
    marginBottom: spacing.xs,
  },
  correctionBox: {
    backgroundColor: colors.dangerSoft,
    padding: spacing.md,
    borderRadius: radii.sm,
    marginTop: spacing.sm,
  },
  correctionBoxHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  correctionBoxTitle: {
    ...fontStyles.bodyMedium,
    color: colors.danger,
    fontWeight: "700",
  },
  correctionNoteText: {
    ...fontStyles.bodySmall,
    color: colors.textPrimary,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  actionBtn: {
    marginTop: spacing.sm,
  },
  sectionCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: spacing.sm,
  },
  detailItem: {
    width: "50%",
    paddingRight: spacing.xs,
  },
  fieldLabel: {
    ...fontStyles.captionMedium,
    color: colors.textSecondary,
  },
  fieldValue: {
    ...fontStyles.bodyMedium,
    color: colors.textPrimary,
    marginTop: 2,
  },
  feeSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  feeLabel: {
    ...fontStyles.bodyMedium,
    color: colors.textSecondary,
  },
  feeValue: {
    ...fontStyles.heading,
    color: colors.primary,
    fontWeight: "700",
  },
  attachmentRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  attachmentIcon: {
    marginRight: spacing.sm,
  },
  attachmentDetails: {
    flex: 1,
  },
  attachmentName: {
    ...fontStyles.bodyMedium,
    color: colors.textPrimary,
  },
  attachmentMeta: {
    ...fontStyles.caption,
    color: colors.textSecondary,
  },
  cancelContainer: {
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  cancelBtn: {
    borderColor: colors.danger,
  },
});

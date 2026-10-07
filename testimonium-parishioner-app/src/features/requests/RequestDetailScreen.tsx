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
import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusLabel } from "@/components/ui/StatusLabel";
import { RecordSection } from "@/components/ui/RecordSection";
import { Divider } from "@/components/ui/Divider";
import { ContentColumn } from "@/components/layout/ContentColumn";
import { useAppLayoutMetrics } from "@/components/layout/useAppLayoutMetrics";
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
import {
  getCorrectionEligibleIds,
  hasSystemSatisfiedCorrection,
} from "./correctionRequirements";
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
  const { contentBottomInset } = useAppLayoutMetrics();
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

  const attachments = request?.attachments || [];
  const correctionIds = request?.correctionRequirementIds || [];
  const correctionEligibleIds = getCorrectionEligibleIds(correctionIds);
  const includesSystemSatisfiedCorrection = hasSystemSatisfiedCorrection(correctionIds);

  const handleResubmitCorrections = async () => {
    if (!request || inFlightGuard.current) return;

    const missingUploads = correctionEligibleIds.filter((id) => !correctionFiles[id]);
    if (missingUploads.length > 0) {
      Alert.alert(
        "Missing Attachments",
        "Please select replacement files for all requested corrections before resubmitting."
      );
      return;
    }

    inFlightGuard.current = true;
    try {
      for (const reqId of correctionEligibleIds) {
        const file = correctionFiles[reqId];
        await uploadFileMutation.mutateAsync({
          requestId: request.id,
          file,
          category: reqId,
        });
      }

      await resubmitMutation.mutateAsync(request.id);

      setCorrectionFiles({});
      Alert.alert(
        "Corrections Submitted",
        correctionEligibleIds.length > 0
          ? "Your replacement files have been sent to the parish office for review."
          : "Your request has been returned to the parish office for review."
      );
      void refetch();
    } catch (err: any) {
      Alert.alert(
        "Submission Failed",
        err.message || "Could not resubmit corrected documents. Please try again."
      );
      void refetch();
    } finally {
      inFlightGuard.current = false;
    }
  };

  const handleFinalizeDraft = async () => {
    if (!request || inFlightGuard.current) return;
    inFlightGuard.current = true;

    try {
      await submitDraftMutation.mutateAsync(request.id);
      Alert.alert("Request Submitted", "Your draft has been submitted to the parish office.");
      void refetch();
    } catch (err: any) {
      Alert.alert(
        "Submission Failed",
        err.message || "Could not finalize draft. Please try again."
      );
      void refetch();
    } finally {
      inFlightGuard.current = false;
    }
  };

  const statusInfo = request ? formatStatus(request.status, request.isDraft) : null;
  const docTypeLabel = request?.documentType
    ? formatDocumentType(request.documentType)
    : "Document Request";
  const feeLabel = request ? formatFee(request.fee) : "Fee unavailable";
  const isPaymentActionAvailable = isPaymentEligible(request);
  const isCorrectionActionAvailable = isDocumentCorrectionEligible(request);
  const isCancellationAvailable = isCancelEligible(request);

  const requiredDocuments = requirements?.requiredDocuments || [];
  const requiredDocs = requiredDocuments.filter((d) => d.required);
  const uploadedRequirementIds = new Set(attachments.map((a) => a.category));
  const missingRequiredDocs = requiredDocs.filter((d) => !uploadedRequirementIds.has(d.id));
  const isDraftComplete = missingRequiredDocs.length === 0;

  const bottomPadding = contentBottomInset("none");

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
          <Skeleton width="100%" height={120} style={styles.skeletonCard} />
          <Skeleton width="100%" height={160} style={styles.skeletonCard} />
          <Skeleton width="100%" height={140} style={styles.skeletonCard} />
        </View>
      ) : error || !request || !statusInfo ? (
        <View style={styles.centerContainer}>
          <EmptyState
            icon="alert-circle-outline"
            title="Request Not Found"
            description="Unable to load this document request. Please check your connection or return to your list."
            actionLabel="Return to Requests"
            onAction={handleBack}
          />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding + spacing.md }]}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={() => {
                void refetch();
              }}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        >
          <ContentColumn style={styles.column}>
            {/* Record Title & Identity Block */}
            <View style={styles.recordHeader}>
              <View style={styles.recordIdentityRow}>
                <View style={styles.titleWrap}>
                  <Text style={styles.recordTitle} allowFontScaling>
                    {docTypeLabel}
                  </Text>
                  {request.trackingNumber ? (
                    <Text style={styles.trackingRef} allowFontScaling>
                      Tracking: {request.trackingNumber}
                    </Text>
                  ) : (
                    <Text style={styles.trackingDraft} allowFontScaling>
                      Draft Application
                    </Text>
                  )}
                </View>
                <StatusLabel status={request.status} />
              </View>

              <Text style={styles.statusDescription} allowFontScaling>
                {statusInfo.description}
              </Text>
            </View>

            {/* Attention Action Banners */}
            {request.isDraft ? (
              <View style={styles.alertBox}>
                <View style={styles.alertBoxHeader}>
                  <Ionicons name="document-text-outline" size={18} color={colors.primary} />
                  <Text style={styles.alertBoxTitle} allowFontScaling>
                    Draft Checklist
                  </Text>
                </View>
                <Text style={styles.alertBoxDesc} allowFontScaling>
                  {isDraftComplete
                    ? "All required attachments have been uploaded to this draft. You can now finalize and submit."
                    : `Please attach the remaining ${missingRequiredDocs.length} required document(s) to continue.`}
                </Text>

                {requiredDocuments.map((reqDoc) => {
                  const uploadedAtt = attachments.find((a) => a.category === reqDoc.id);

                  if (uploadedAtt) {
                    return (
                      <View key={reqDoc.id} style={styles.draftUploadedRow}>
                        <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                        <View style={styles.draftUploadedDetails}>
                          <Text style={styles.draftUploadedLabel} allowFontScaling>
                            {reqDoc.label || reqDoc.id}
                          </Text>
                          <Text style={styles.draftUploadedFileName} numberOfLines={1} allowFontScaling>
                            {uploadedAtt.fileName}
                          </Text>
                        </View>
                      </View>
                    );
                  }

                  return (
                    <SupportingFilePicker
                      key={reqDoc.id}
                      requirement={reqDoc}
                      selectedFile={draftFiles[reqDoc.id]}
                      onFileSelected={(file) => void handleDraftFileUpload(reqDoc.id, file)}
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
                  );
                })}

                <Button
                  title={
                    isDraftComplete
                      ? "Finalize & Submit Request"
                      : `Submit Request (${missingRequiredDocs.length} Missing)`
                  }
                  variant={isDraftComplete ? "primary" : "outline"}
                  size="md"
                  icon="checkmark-circle-outline"
                  onPress={() => {
                    void handleFinalizeDraft();
                  }}
                  loading={submitDraftMutation.isPending}
                  disabled={submitDraftMutation.isPending || Boolean(draftUploadingReqId)}
                  style={styles.fullWidthAction}
                />
              </View>
            ) : isPaymentActionAvailable ? (
              <View style={styles.alertBox}>
                <View style={styles.alertBoxHeader}>
                  <Ionicons name="card-outline" size={18} color={colors.primary} />
                  <Text style={styles.alertBoxTitle} allowFontScaling>
                    Payment Required: {feeLabel}
                  </Text>
                </View>
                {request.paymentCorrectionNote ? (
                  <Text style={styles.alertBoxDesc} allowFontScaling>
                    Staff Note: {request.paymentCorrectionNote}
                  </Text>
                ) : (
                  <Text style={styles.alertBoxDesc} allowFontScaling>
                    Please settle the required processing fee and submit your official receipt proof.
                  </Text>
                )}
                <Button
                  title="Pay & Upload Receipt"
                  variant="primary"
                  size="md"
                  icon="arrow-forward"
                  onPress={handleGoToPayment}
                  style={styles.fullWidthAction}
                />
              </View>
            ) : isCorrectionActionAvailable ? (
              <View style={[styles.alertBox, styles.alertBoxDanger]}>
                <View style={styles.alertBoxHeader}>
                  <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
                  <Text style={[styles.alertBoxTitle, { color: colors.danger }]} allowFontScaling>
                    Document Corrections Required
                  </Text>
                </View>
                {request.correctionNote ? (
                  <View style={{ gap: 2 }}>
                    <Text style={[styles.alertBoxDesc, { fontWeight: "700", color: colors.textPrimary }]} allowFontScaling>
                      Correction Details:
                    </Text>
                    <Text style={styles.alertBoxDesc} allowFontScaling>
                      {request.correctionNote}
                    </Text>
                  </View>
                ) : null}

                {includesSystemSatisfiedCorrection ? (
                  <Text style={styles.alertBoxDesc} allowFontScaling>
                    Government ID verification is handled separately and does not require a replacement file here.
                  </Text>
                ) : null}

                {correctionEligibleIds.map((reqId) => {
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
                  onPress={() => {
                    void handleResubmitCorrections();
                  }}
                  loading={resubmitMutation.isPending || uploadFileMutation.isPending}
                  style={styles.fullWidthAction}
                />
              </View>
            ) : null}

            <Divider />

            {/* Record Section 1: Application Details */}
            <RecordSection
              title="Application Details"
              fields={[
                { label: "Applicant Name", value: request.applicantName },
                { label: "Relationship", value: request.relationship || "Self" },
                { label: "Target Parish", value: request.parish?.parishName || "Parish" },
                { label: "Date Requested", value: formatDate(request.dateRequested) },
                ...(request.purpose ? [{ label: "Purpose / Reason", value: request.purpose }] : []),
              ]}
            />

            <Divider />

            {/* Record Section 2: Fee & Payment Snapshot */}
            <RecordSection
              title="Payment & Fee Snapshot"
              fields={[
                {
                  label: "Processing Fee",
                  value: (
                    <Text style={styles.fieldValueHighlight} allowFontScaling>
                      {feeLabel}
                    </Text>
                  ),
                },
                {
                  label: "Payment Status",
                  value: (
                    <StatusLabel
                      status={
                        request.paymentStatus === "CONFIRMED"
                          ? "CONFIRMED"
                          : request.paymentStatus === "PROOF_SUBMITTED"
                          ? "PAYMENT_UNDER_REVIEW"
                          : "PAYMENT_PENDING"
                      }
                    />
                  ),
                },
              ]}
            />

            <Divider />

            {/* Record Section 3: Submitted Attachments */}
            {attachments.length > 0 ? (
              <>
                <RecordSection title="Submitted Attachments">
                  {attachments.map((att, index) => (
                    <View key={att.id || index} style={styles.attachmentRow}>
                      <Ionicons
                        name="document-attach-outline"
                        size={18}
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
                </RecordSection>
                <Divider />
              </>
            ) : null}

            {/* Record Section 4: Request Timeline & History */}
            <RecordSection title="Request History & Timeline">
              <RequestStatusTimeline
                history={request.requestHistory}
                estimatedDays={requirements?.estimatedProcessingDays}
              />
            </RecordSection>

            {/* Cancel Action */}
            {isCancellationAvailable ? (
              <View style={styles.cancelContainer}>
                <Button
                  title="Cancel Request"
                  variant="ghost"
                  size="md"
                  onPress={handleCancelPress}
                  loading={cancelMutation.isPending}
                  style={styles.cancelBtn}
                  accessibilityLabel="Cancel this document request"
                />
              </View>
            ) : null}
          </ContentColumn>
        </ScrollView>
      )}
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
    paddingVertical: spacing.md,
  },
  column: {
    gap: spacing.md,
  },
  loadingContainer: {
    padding: spacing.md,
    gap: spacing.md,
  },
  skeletonCard: {
    borderRadius: radii.md,
  },
  centerContainer: {
    flex: 1,
    padding: spacing.md,
    justifyContent: "center",
  },
  recordHeader: {
    paddingHorizontal: spacing.xxs,
    gap: spacing.xs,
  },
  recordIdentityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  titleWrap: {
    flex: 1,
  },
  recordTitle: {
    ...fontStyles.titleSerif,
    color: colors.textPrimary,
    fontSize: 22,
    lineHeight: 28,
  },
  trackingRef: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    fontWeight: "600",
    marginTop: 2,
  },
  trackingDraft: {
    ...fontStyles.caption,
    color: colors.primary,
    fontWeight: "700",
    marginTop: 2,
  },
  statusDescription: {
    ...fontStyles.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  alertBox: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  alertBoxDanger: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerBorder,
  },
  alertBoxHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  alertBoxTitle: {
    ...fontStyles.captionMedium,
    color: colors.primary,
    fontWeight: "700",
  },
  alertBoxDesc: {
    ...fontStyles.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  draftUploadedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  draftUploadedDetails: {
    flex: 1,
  },
  draftUploadedLabel: {
    ...fontStyles.captionMedium,
    color: colors.textPrimary,
  },
  draftUploadedFileName: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    fontSize: 12,
  },
  fieldRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: spacing.xs,
    gap: spacing.md,
  },
  fieldLabel: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  fieldValue: {
    ...fontStyles.captionMedium,
    color: colors.textPrimary,
    textAlign: "right",
    flex: 2,
  },
  fieldValueHighlight: {
    ...fontStyles.captionBold,
    color: colors.primary,
    textAlign: "right",
  },
  attachmentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  attachmentIcon: {
    marginTop: 1,
  },
  attachmentDetails: {
    flex: 1,
  },
  attachmentName: {
    ...fontStyles.bodySmall,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  attachmentMeta: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 1,
  },
  cancelContainer: {
    paddingVertical: spacing.xs,
    alignItems: "center",
  },
  cancelBtn: {
    alignSelf: "center",
  },
  fullWidthAction: {
    width: "100%",
  },
});

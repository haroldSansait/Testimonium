import { useScreenRefresh, useManualRefresh } from "@/hooks/useAutomaticRefresh";
import React, { useRef, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "@/components/Typography";
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
import { SecureFileViewerModal } from "@/components/files/SecureFileViewerModal";
import { useAppLayoutMetrics } from "@/components/layout/useAppLayoutMetrics";
import { navigateBackOrReplace } from "@/services/navigation/back";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import { useAuth } from "@/providers/AuthProvider";
import {
  useCancelRequest,
  useDeleteRequestDraft,
  useDocumentRequirements,
  useRequestDetail,
  useResubmitCorrections,
  useSubmitRequestDraft,
  useUploadRegistrantId,
  useUploadSupportingFile,
} from "./api";
import { RequestStatusTimeline } from "./components/RequestStatusTimeline";
import {
  getCorrectionEligibleIds,
  hasSystemSatisfiedCorrection,
} from "./correctionRequirements";
import { SupportingFilePicker } from "./components/SupportingFilePicker";
import { RegistrantIdCapturePicker } from "./components/RegistrantIdCapturePicker";
import { ReturnDocumentModal } from "./components/ReturnDocumentModal";
import {
  formatDate,
  formatDateTime,
  formatDocumentType,
  formatFee,
  formatStatus,
  hasAuthoritativeFee,
  humanizeSnakeCase,
  isCancelEligible,
  isDocumentCorrectionEligible,
  isDocumentReturnEligible,
  isPaymentEligible,
} from "./presentation";
import { DOCUMENT_RETURN_REASONS, type LocalRegistrantIdImage, type LocalSelectedFile } from "./types";

export interface RequestDetailScreenProps {
  requestId?: string | null;
}

export const RequestDetailScreen: React.FC<RequestDetailScreenProps> = ({
  requestId,
}) => {
  const router = useRouter();
  const refreshOptions = useScreenRefresh();
  const { profile } = useAuth();
  const isProfileGovIdVerified = Boolean(profile?.isGovernmentIdVerified);
  const { contentBottomInset } = useAppLayoutMetrics();
  const isValidId = Boolean(requestId && /^[1-9]\d*$/.test(String(requestId).trim()));

  const {
    data: request,
    isLoading,
    refetch,
  } = useRequestDetail(isValidId ? requestId : null, { ...refreshOptions, enabled: refreshOptions.enabled && isValidId });
  const { refreshing, onRefresh } = useManualRefresh(() => refetch({ cancelRefetch: false }));

  const {
    data: requirements,
    isLoading: loadingRequirements,
    error: requirementsError,
    refetch: refetchRequirements,
  } = useDocumentRequirements(
    request
      ? { documentType: request.documentType, parishId: request.parishId, relationship: request.relationship || "Self" }
      : undefined
  );

  const [correctionFiles, setCorrectionFiles] = useState<Record<string, LocalSelectedFile>>({});
  const [correctionRegistrantIdFront, setCorrectionRegistrantIdFront] = useState<LocalRegistrantIdImage | null>(null);
  const [correctionRegistrantIdBack, setCorrectionRegistrantIdBack] = useState<LocalRegistrantIdImage | null>(null);
  const [draftFiles, setDraftFiles] = useState<Record<string, LocalSelectedFile>>({});
  const [replacingDraftReqIds, setReplacingDraftReqIds] = useState<Record<string, boolean>>({});
  const [draftUploadingReqId, setDraftUploadingReqId] = useState<string | null>(null);
  const [isReturnModalVisible, setIsReturnModalVisible] = useState(false);
  const [viewerFile, setViewerFile] = useState<{
    path: string;
    fileName: string;
    mimeType?: string | null;
    title?: string;
  } | null>(null);
  const inFlightGuard = useRef(false);

  const cancelMutation = useCancelRequest();
  const deleteDraftMutation = useDeleteRequestDraft();
  const resubmitMutation = useResubmitCorrections();
  const submitDraftMutation = useSubmitRequestDraft();
  const uploadFileMutation = useUploadSupportingFile();
  const uploadRegistrantIdMutation = useUploadRegistrantId();

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
      setReplacingDraftReqIds((prev) => ({ ...prev, [requirementId]: false }));
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

  const handleDraftRegistrantIdUpload = async (
    side: "front" | "back",
    image: LocalRegistrantIdImage
  ) => {
    if (!request || inFlightGuard.current) return;
    inFlightGuard.current = true;
    setDraftUploadingReqId(`registrant_id_${side}`);
    try {
      await uploadRegistrantIdMutation.mutateAsync({
        requestId: request.id,
        [side]: image,
      });
      if (side === "front") setCorrectionRegistrantIdFront(image);
      else setCorrectionRegistrantIdBack(image);
      setReplacingDraftReqIds((prev) => ({ ...prev, [`registrant_id_${side}`]: false }));
      Alert.alert("Image Uploaded", `The registrant ID ${side} image is attached to this draft.`);
      void refetch();
    } catch (err: any) {
      Alert.alert("Upload Failed", err.message || "Could not attach the registrant ID image.");
      void refetch();
    } finally {
      inFlightGuard.current = false;
      setDraftUploadingReqId(null);
    }
  };

  const attachments = request?.attachments || [];
  const correctionIds = request?.correctionRequirementIds || [];
  const correctionEligibleIds = getCorrectionEligibleIds(correctionIds);
  const needsRegistrantIdFront = correctionEligibleIds.includes("registrant_id_front");
  const needsRegistrantIdBack = correctionEligibleIds.includes("registrant_id_back");
  const genericCorrectionIds = correctionEligibleIds.filter(
    (id) => id !== "registrant_id_front" && id !== "registrant_id_back"
  );
  const includesSystemSatisfiedCorrection = hasSystemSatisfiedCorrection(correctionIds);

  const handleResubmitCorrections = async () => {
    if (!request || inFlightGuard.current) return;

    const missingUploads = genericCorrectionIds.filter((id) => !correctionFiles[id]);
    if (needsRegistrantIdFront && !correctionRegistrantIdFront) missingUploads.push("registrant_id_front");
    if (needsRegistrantIdBack && !correctionRegistrantIdBack) missingUploads.push("registrant_id_back");
    if (missingUploads.length > 0) {
      Alert.alert(
        "Missing Attachments",
        "Please select replacement files for all requested corrections before resubmitting."
      );
      return;
    }

    inFlightGuard.current = true;
    try {
      for (const reqId of genericCorrectionIds) {
        const file = correctionFiles[reqId];
        await uploadFileMutation.mutateAsync({
          requestId: request.id,
          file,
          category: reqId,
        });
      }

      if (correctionRegistrantIdFront || correctionRegistrantIdBack) {
        await uploadRegistrantIdMutation.mutateAsync({
          requestId: request.id,
          front: correctionRegistrantIdFront || undefined,
          back: correctionRegistrantIdBack || undefined,
        });
      }

      await resubmitMutation.mutateAsync(request.id);

      setCorrectionFiles({});
      setCorrectionRegistrantIdFront(null);
      setCorrectionRegistrantIdBack(null);
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

  const handleDiscardDraft = () => {
    if (!request || !request.isDraft || inFlightGuard.current) return;
    Alert.alert(
      "Discard Saved Draft?",
      "This will permanently delete your saved draft and its uploaded attachments. This action cannot be undone.",
      [
        { text: "Keep Draft", style: "cancel" },
        {
          text: "Discard Draft",
          style: "destructive",
          onPress: async () => {
            if (inFlightGuard.current) return;
            inFlightGuard.current = true;
            try {
              await deleteDraftMutation.mutateAsync(request.id);
              Alert.alert("Draft Discarded", "Your saved draft has been deleted.");
              handleBack();
            } catch (err: any) {
              Alert.alert("Discard Failed", err?.message || "Could not discard draft.");
            } finally {
              inFlightGuard.current = false;
            }
          },
        },
      ]
    );
  };

  const handleFinalizeDraft = async () => {
    if (!request || inFlightGuard.current) return;
    if (loadingRequirements || requirementsError || !hasAuthoritativeFee(requirements?.baseFee)) {
      Alert.alert(
        "Requirements Unavailable",
        "Wait for authoritative parish requirements and fees to load before submitting this draft."
      );
      return;
    }
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
  const isReturnActionAvailable = isDocumentReturnEligible(request);
  const isReturnedStatus = request?.status === "RETURNED";
  const latestReturn = request?.returns?.length
    ? request.returns[request.returns.length - 1]
    : null;

  const requiredDocuments = [
    ...(requirements?.requiredDocuments || []),
    ...(requirements?.relationshipEvidence || []),
  ].filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index);
  const requiredDocs = requiredDocuments.filter((d) => d.required);
  const uploadedRequirementIds = new Set(attachments.map((a) => a.category));
  const missingRequiredDocs = requiredDocs.filter((d) => {
    if (d.id === "valid_id" && isProfileGovIdVerified) {
      return false;
    }
    if (d.id === "registrant_id_front") {
      return !request?.registrantIdEvidence?.frontUploadedAt && !correctionRegistrantIdFront;
    }
    if (d.id === "registrant_id_back") {
      return !request?.registrantIdEvidence?.backUploadedAt && !correctionRegistrantIdBack;
    }
    return !uploadedRequirementIds.has(d.id);
  });
  const isDraftComplete =
    !loadingRequirements &&
    !requirementsError &&
    hasAuthoritativeFee(requirements?.baseFee) &&
    missingRequiredDocs.length === 0;

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
      ) : !request || !statusInfo ? (
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
              refreshing={refreshing}
              onRefresh={() => {
                void onRefresh();
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
                <StatusLabel status={request.isDraft ? "DRAFT" : request.status} />
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

                {loadingRequirements ? (
                  <View style={{ gap: spacing.xs }}>
                    <Skeleton width="100%" height={44} style={styles.skeletonCard} />
                    <Skeleton width="100%" height={44} style={styles.skeletonCard} />
                  </View>
                ) : requirementsError || !hasAuthoritativeFee(requirements?.baseFee) ? (
                  <View style={{ gap: spacing.xs }}>
                    <Text style={[styles.alertBoxDesc, { color: colors.danger }]} allowFontScaling>
                      Unable to load authoritative parish requirements and fee for this draft. Retry before submitting.
                    </Text>
                    <Button
                      title="Retry Requirements"
                      variant="outline"
                      size="sm"
                      icon="refresh-outline"
                      onPress={() => {
                        void refetchRequirements();
                      }}
                    />
                  </View>
                ) : (
                  <>
                    <Text style={styles.alertBoxDesc} allowFontScaling>
                      {isDraftComplete
                        ? "All required attachments have been uploaded to this draft. You can now finalize and submit."
                        : `Please attach the remaining ${missingRequiredDocs.length} required document(s) to continue.`}
                    </Text>

                    {requiredDocuments.map((reqDoc) => {
                      const uploadedAtt = attachments.find((a) => a.category === reqDoc.id);
                      const isReplacing = Boolean(replacingDraftReqIds[reqDoc.id]);
                      const registrantSide =
                        reqDoc.id === "registrant_id_front"
                          ? "front"
                          : reqDoc.id === "registrant_id_back"
                            ? "back"
                            : null;
                      const registrantUploaded = registrantSide
                        ? Boolean(
                            registrantSide === "front"
                              ? request.registrantIdEvidence?.frontUploadedAt
                              : request.registrantIdEvidence?.backUploadedAt
                          )
                        : false;

                      if (reqDoc.id === "valid_id" && isProfileGovIdVerified) {
                        return (
                          <View key={reqDoc.id} style={styles.draftUploadedRow}>
                            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                            <View style={styles.draftUploadedDetails}>
                              <Text style={styles.draftUploadedLabel} allowFontScaling>
                                {reqDoc.label || "Valid Government ID"}
                              </Text>
                              <Text style={styles.draftUploadedFileName} allowFontScaling>
                                Verified via Profile ({profile?.governmentIdType || "Government ID"})
                              </Text>
                            </View>
                          </View>
                        );
                      }

                      if ((uploadedAtt || registrantUploaded) && !isReplacing) {
                        return (
                          <View key={reqDoc.id} style={styles.draftUploadedRow}>
                            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                            <View style={styles.draftUploadedDetails}>
                              <Text style={styles.draftUploadedLabel} allowFontScaling>
                                {reqDoc.label || reqDoc.id}
                              </Text>
                              <Text style={styles.draftUploadedFileName} numberOfLines={1} allowFontScaling>
                                {uploadedAtt?.fileName || "Private registrant ID image uploaded"}
                              </Text>
                            </View>
                            <View style={styles.inlineActionGroup}>
                              {uploadedAtt ? (
                                <Pressable
                                  onPress={() =>
                                    setViewerFile({
                                      path: `/requests/${request.id}/attachments/${uploadedAtt.id}/download`,
                                      fileName: uploadedAtt.fileName,
                                      mimeType: uploadedAtt.fileType,
                                      title: reqDoc.label || uploadedAtt.category,
                                    })
                                  }
                                  style={styles.inlineSmallBtn}
                                  accessibilityRole="button"
                                  accessibilityLabel={`View ${uploadedAtt.fileName}`}
                                >
                                  <Ionicons name="eye-outline" size={13} color={colors.primary} />
                                  <Text style={styles.inlineSmallBtnText} allowFontScaling>
                                    View
                                  </Text>
                                </Pressable>
                              ) : null}
                              <Pressable
                                onPress={() =>
                                  setReplacingDraftReqIds((prev) => ({ ...prev, [reqDoc.id]: true }))
                                }
                                style={styles.inlineSmallBtn}
                                accessibilityRole="button"
                                accessibilityLabel={`Replace ${reqDoc.label || reqDoc.id}`}
                              >
                                <Ionicons name="swap-horizontal-outline" size={13} color={colors.primary} />
                                <Text style={styles.inlineSmallBtnText} allowFontScaling>
                                  Replace
                                </Text>
                              </Pressable>
                            </View>
                          </View>
                        );
                      }

                      if (registrantSide) {
                        return (
                          <RegistrantIdCapturePicker
                            key={reqDoc.id}
                            side={registrantSide}
                            image={
                              registrantSide === "front"
                                ? correctionRegistrantIdFront
                                : correctionRegistrantIdBack
                            }
                            onSelected={(image) => void handleDraftRegistrantIdUpload(registrantSide, image)}
                            onRemoved={() => {
                              if (registrantSide === "front") setCorrectionRegistrantIdFront(null);
                              else setCorrectionRegistrantIdBack(null);
                            }}
                            disabled={
                              uploadRegistrantIdMutation.isPending ||
                              submitDraftMutation.isPending ||
                              draftUploadingReqId === reqDoc.id
                            }
                          />
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
                  </>
                )}

                <Button
                  title={
                    loadingRequirements
                      ? "Loading Requirements..."
                      : requirementsError || !hasAuthoritativeFee(requirements?.baseFee)
                        ? "Requirements Unavailable"
                        : isDraftComplete
                          ? "Finalize & Submit Request"
                          : `Submit Request (${missingRequiredDocs.length} Missing)`
                  }
                  variant={isDraftComplete ? "primary" : "outline"}
                  size="md"
                  icon="checkmark-circle-outline"
                  onPress={() => {
                    void handleFinalizeDraft();
                  }}
                  loading={submitDraftMutation.isPending || uploadRegistrantIdMutation.isPending}
                  disabled={
                    loadingRequirements ||
                    Boolean(requirementsError) ||
                    !hasAuthoritativeFee(requirements?.baseFee) ||
                    !isDraftComplete ||
                    submitDraftMutation.isPending ||
                    uploadRegistrantIdMutation.isPending ||
                    Boolean(draftUploadingReqId)
                  }
                  style={styles.fullWidthAction}
                />

                <View style={styles.draftManageRow}>
                  <Button
                    title="Edit Draft Details"
                    variant="outline"
                    size="sm"
                    icon="create-outline"
                    onPress={() => router.push(`/(app)/requests/new?draftId=${request.id}` as any)}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Discard Draft"
                    variant="ghost"
                    size="sm"
                    icon="trash-outline"
                    loading={deleteDraftMutation.isPending}
                    onPress={handleDiscardDraft}
                  />
                </View>
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

                {genericCorrectionIds.map((reqId) => {
                  const reqDoc = requiredDocuments.find((d) => d.id === reqId) || {
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

                {needsRegistrantIdFront ? (
                  <RegistrantIdCapturePicker
                    side="front"
                    image={correctionRegistrantIdFront}
                    onSelected={setCorrectionRegistrantIdFront}
                    onRemoved={() => setCorrectionRegistrantIdFront(null)}
                    disabled={uploadRegistrantIdMutation.isPending}
                  />
                ) : null}
                {needsRegistrantIdBack ? (
                  <RegistrantIdCapturePicker
                    side="back"
                    image={correctionRegistrantIdBack}
                    onSelected={setCorrectionRegistrantIdBack}
                    onRemoved={() => setCorrectionRegistrantIdBack(null)}
                    disabled={uploadRegistrantIdMutation.isPending}
                  />
                ) : null}

                <Button
                  title="Resubmit Corrected Documents"
                  variant="primary"
                  size="md"
                  icon="send-outline"
                  onPress={() => {
                    void handleResubmitCorrections();
                  }}
                  loading={
                    resubmitMutation.isPending ||
                    uploadFileMutation.isPending ||
                    uploadRegistrantIdMutation.isPending
                  }
                  style={styles.fullWidthAction}
                />
              </View>
            ) : isReturnedStatus ? (
              <View style={[styles.alertBox, styles.alertBoxWarning]}>
                <View style={styles.alertBoxHeader}>
                  <Ionicons name="return-down-back-outline" size={18} color={colors.warning} />
                  <Text style={[styles.alertBoxTitle, { color: colors.warning }]} allowFontScaling>
                    Document Returned for Correction
                  </Text>
                </View>
                <Text style={styles.alertBoxDesc} allowFontScaling>
                  This released document has been returned to the parish office for correction. Parish staff is preparing your corrected replacement copy. The process is completely free.
                </Text>
                {latestReturn ? (
                  <View style={styles.returnedDetailCard}>
                    <Text style={styles.returnedDetailLabel} allowFontScaling>
                      Latest Return Reason:{" "}
                      <Text style={styles.returnedDetailValue}>
                        {DOCUMENT_RETURN_REASONS.find((r) => r.code === latestReturn.reasonCode)?.label || latestReturn.reasonCode}
                      </Text>
                    </Text>
                    {latestReturn.notes ? (
                      <Text style={styles.returnedDetailLabel} allowFontScaling>
                        Parishioner Note:{" "}
                        <Text style={styles.returnedDetailValue}>
                          {latestReturn.notes}
                        </Text>
                      </Text>
                    ) : null}
                    <Text style={styles.returnedDetailLabel} allowFontScaling>
                      Defective Evidence:{" "}
                      <Text style={styles.returnedDetailValue}>
                        {latestReturn.returnedFileName}
                      </Text>
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : isReturnActionAvailable ? (
              <View style={styles.returnActionCard}>
                <View style={styles.alertBoxHeader}>
                  <Ionicons name="refresh-circle-outline" size={18} color={colors.primary} />
                  <Text style={styles.alertBoxTitle} allowFontScaling>
                    Notice an Error on Your Document?
                  </Text>
                </View>
                <Text style={styles.alertBoxDesc} allowFontScaling>
                  If your issued certificate contains a typographical error, misspelling, or printing defect, you can return it for a free replacement copy.
                </Text>
                <Button
                  title="Return Document for Correction"
                  variant="outline"
                  size="md"
                  icon="return-down-back-outline"
                  onPress={() => setIsReturnModalVisible(true)}
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
            >
              {request.paymentTransactions && request.paymentTransactions.length > 0 ? (
                <View style={styles.txSectionWrap}>
                  {request.paymentTransactions.map((tx) => (
                    <View key={tx.id} style={styles.txCard}>
                      <View style={styles.txHeaderRow}>
                        <Text style={styles.txRefText} allowFontScaling>
                          {tx.referenceNumber
                            ? `Payment Ref: ${tx.referenceNumber}`
                            : `Transaction #${tx.id}`}
                        </Text>
                        <Text style={styles.txStatusText} allowFontScaling>
                          {humanizeSnakeCase(tx.status)}
                        </Text>
                      </View>
                      <Text style={styles.attachmentMeta} allowFontScaling>
                        Amount: {formatFee(tx.amount ?? request.fee)}
                        {tx.provider ? ` • ${tx.provider}` : ""}
                        {tx.verifiedAt ? ` • Verified ${formatDateTime(tx.verifiedAt)}` : ""}
                      </Text>
                      {tx.receipts?.map((receipt) => (
                        <View key={receipt.id} style={styles.txReceiptRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.attachmentName} numberOfLines={1} allowFontScaling>
                              {receipt.fileName}
                            </Text>
                            <Text style={styles.attachmentMeta} allowFontScaling>
                              Uploaded {formatDateTime(receipt.uploadedAt)}
                              {receipt.ocrResult?.status
                                ? ` • OCR: ${humanizeSnakeCase(receipt.ocrResult.status)}`
                                : ""}
                              {receipt.ocrResult?.referenceNumber
                                ? ` (${receipt.ocrResult.referenceNumber})`
                                : ""}
                            </Text>
                          </View>
                          <Pressable
                            onPress={() =>
                              setViewerFile({
                                path: `/requests/${request.id}/receipts/${receipt.id}/download`,
                                fileName: receipt.fileName,
                                mimeType: receipt.mimeType,
                                title: "Payment Receipt",
                              })
                            }
                            style={styles.inlineSmallBtn}
                            accessibilityRole="button"
                            accessibilityLabel={`View receipt ${receipt.fileName}`}
                          >
                            <Ionicons name="eye-outline" size={14} color={colors.primary} />
                            <Text style={styles.inlineSmallBtnText} allowFontScaling>
                              View
                            </Text>
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              ) : null}
            </RecordSection>

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
                      {att.id ? (
                        <Pressable
                          onPress={() =>
                            setViewerFile({
                              path: `/requests/${request.id}/attachments/${att.id}/download`,
                              fileName: att.fileName,
                              mimeType: att.fileType,
                              title: att.category,
                            })
                          }
                          style={styles.inlineSmallBtn}
                          accessibilityRole="button"
                          accessibilityLabel={`View attachment ${att.fileName}`}
                        >
                          <Ionicons name="eye-outline" size={14} color={colors.primary} />
                          <Text style={styles.inlineSmallBtnText} allowFontScaling>
                            View
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ))}
                </RecordSection>
                <Divider />
              </>
            ) : null}

            {/* Record Section: Document Return History */}
            {request.returns && request.returns.length > 0 ? (
              <>
                <RecordSection title="Document Return History">
                  {request.returns.map((ret) => {
                    const reason =
                      DOCUMENT_RETURN_REASONS.find((r) => r.code === ret.reasonCode)?.label ||
                      ret.reasonCode;
                    return (
                      <View key={ret.id} style={styles.returnHistoryItem}>
                        <View style={styles.returnHistoryHeader}>
                          <Text style={styles.returnHistoryCycle} allowFontScaling>
                            Return Cycle #{ret.cycleNumber}
                          </Text>
                          <Text style={styles.returnHistoryDate} allowFontScaling>
                            {formatDate(ret.returnedAt)}
                          </Text>
                        </View>
                        <Text style={styles.returnHistoryReason} allowFontScaling>
                          Reason: {reason}
                        </Text>
                        {ret.notes ? (
                          <Text style={styles.returnHistoryNotes} allowFontScaling>
                            Note: {ret.notes}
                          </Text>
                        ) : null}
                        <View style={styles.returnHistoryFilesRow}>
                          <Text style={styles.returnHistoryFileMeta} allowFontScaling>
                            Defective: {ret.returnedFileName}
                          </Text>
                          {ret.correctedFileName ? (
                            <Text style={styles.returnHistoryFileSuccess} allowFontScaling>
                              ✓ Replacement Ready
                            </Text>
                          ) : (
                            <Text style={styles.returnHistoryFilePending} allowFontScaling>
                              ⏳ In Preparation
                            </Text>
                          )}
                        </View>
                        <View style={styles.inlineActionGroup}>
                          <Pressable
                            onPress={() =>
                              setViewerFile({
                                path: `/requests/${request.id}/returns/${ret.id}/file/returned`,
                                fileName: ret.returnedFileName,
                                mimeType: ret.returnedFileType,
                                title: `Defective Document (Cycle #${ret.cycleNumber})`,
                              })
                            }
                            style={styles.inlineSmallBtn}
                            accessibilityRole="button"
                            accessibilityLabel={`View defective document ${ret.returnedFileName}`}
                          >
                            <Ionicons name="eye-outline" size={14} color={colors.primary} />
                            <Text style={styles.inlineSmallBtnText} allowFontScaling>
                              View Defective
                            </Text>
                          </Pressable>
                          {ret.correctedFileName ? (
                            <Pressable
                              onPress={() =>
                                setViewerFile({
                                  path: `/requests/${request.id}/returns/${ret.id}/file/corrected`,
                                  fileName: ret.correctedFileName!,
                                  mimeType: ret.correctedFileType,
                                  title: `Corrected Replacement (Cycle #${ret.cycleNumber})`,
                                })
                              }
                              style={styles.inlineSmallBtn}
                              accessibilityRole="button"
                              accessibilityLabel={`View corrected document ${ret.correctedFileName}`}
                            >
                              <Ionicons name="document-text-outline" size={14} color={colors.primary} />
                              <Text style={styles.inlineSmallBtnText} allowFontScaling>
                                View Corrected
                              </Text>
                            </Pressable>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
                </RecordSection>
                <Divider />
              </>
            ) : null}

            {/* Record Section 4: Request Timeline & History */}
            <RecordSection title="Request History & Timeline">
              <RequestStatusTimeline
                request={request}
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

      {request ? (
        <ReturnDocumentModal
          visible={isReturnModalVisible}
          requestId={request.id}
          trackingNumber={request.trackingNumber}
          onClose={() => setIsReturnModalVisible(false)}
          onSuccess={() => {
            void refetch();
          }}
        />
      ) : null}

      <SecureFileViewerModal
        visible={Boolean(viewerFile)}
        endpointPath={viewerFile?.path || null}
        fileName={viewerFile?.fileName || "document"}
        mimeType={viewerFile?.mimeType}
        title={viewerFile?.title}
        onClose={() => setViewerFile(null)}
      />
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
  alertBoxWarning: {
    borderColor: colors.warningBorder || "#FFE082",
    backgroundColor: colors.warningSoft || "#FFF8E1",
  },
  returnedDetailCard: {
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 4,
    marginTop: spacing.xs,
  },
  returnedDetailLabel: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  returnedDetailValue: {
    color: colors.textPrimary,
    fontWeight: "400",
  },
  returnActionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  returnHistoryItem: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: 2,
  },
  returnHistoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  returnHistoryCycle: {
    ...fontStyles.captionBold,
    color: colors.textPrimary,
  },
  returnHistoryDate: {
    ...fontStyles.caption,
    color: colors.textMuted,
  },
  returnHistoryReason: {
    ...fontStyles.bodySmall,
    color: colors.textPrimary,
    fontWeight: "500",
  },
  returnHistoryNotes: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    fontStyle: "italic",
  },
  returnHistoryFilesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 2,
  },
  returnHistoryFileMeta: {
    ...fontStyles.caption,
    color: colors.textSecondary,
  },
  returnHistoryFileSuccess: {
    ...fontStyles.captionBold,
    color: colors.success,
  },
  returnHistoryFilePending: {
    ...fontStyles.captionBold,
    color: colors.warning,
  },
  inlineActionGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flexWrap: "wrap",
    marginTop: 4,
  },
  inlineSmallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 5,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  inlineSmallBtnText: {
    ...fontStyles.caption,
    color: colors.primary,
    fontWeight: "600",
    fontSize: 12,
  },
  draftManageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.xxs,
  },
  txSectionWrap: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  txCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.sm,
    gap: 4,
  },
  txHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.xs,
  },
  txRefText: {
    ...fontStyles.captionMedium,
    color: colors.textPrimary,
    fontWeight: "700",
    flex: 1,
  },
  txStatusText: {
    ...fontStyles.caption,
    color: colors.primary,
    fontWeight: "600",
  },
  txReceiptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingTop: spacing.xxs,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    marginTop: 4,
  },
});

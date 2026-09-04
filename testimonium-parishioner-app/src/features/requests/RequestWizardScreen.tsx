import React, { useRef, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import {
  AppHeader,
  BottomActionBar,
  Button,
  Card,
  EmptyState,
  SectionHeader,
  Skeleton,
} from "@/components/ui";
import { useParishes } from "@/features/parishes/api";
import type { ParishDto } from "@/features/parishes/types";
import { navigateBackOrReplace } from "@/services/navigation/back";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import {
  useCreateRequestDraft,
  useDocumentRequirements,
  useSubmitRequestDraft,
  useUploadSupportingFile,
} from "./api";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";
import { requestKeys } from "./queryKeys";
import { SupportingFilePicker } from "./components/SupportingFilePicker";
import {
  formatDocumentType,
  formatFee,
  getEffectiveOfferedDocuments,
  hasAuthoritativeFee,
} from "./presentation";
import {
  CanonicalDocumentType,
  LocalSelectedFile,
} from "./types";

export interface RequestWizardScreenProps {
  initialParishId?: string | null;
}

type WizardStep = 1 | 2 | 3 | 4 | 5;

const RELATIONSHIP_OPTIONS = [
  "Self",
  "Spouse",
  "Child",
  "Parent",
  "Sibling",
  "Authorized Representative",
];

export const RequestWizardScreen: React.FC<RequestWizardScreenProps> = ({
  initialParishId,
}) => {
  const router = useRouter();
  const { user, profile } = useAuth();

  const [step, setStep] = useState<WizardStep>(1);
  const [selectedParishOverride, setSelectedParishOverride] = useState<ParishDto | null>(null);
  const [selectedDocType, setSelectedDocType] = useState<CanonicalDocumentType | null>(null);

  // Form Fields
  const [applicantFirstName, setApplicantFirstName] = useState("");
  const [applicantMiddleName, setApplicantMiddleName] = useState("");
  const [applicantLastName, setApplicantLastName] = useState("");
  const applicantName = [applicantFirstName.trim(), applicantMiddleName.trim(), applicantLastName.trim()].filter(Boolean).join(" ");
  const [relationship, setRelationship] = useState("Self");
  const [purpose, setPurpose] = useState("");

  // Files
  const [selectedFiles, setSelectedFiles] = useState<Record<string, LocalSelectedFile>>({});

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStage, setSubmissionStage] = useState("");
  const idempotencyKeyRef = useRef<string | null>(null);
  const inFlightGuard = useRef(false);

  // Queries
  const { data: parishesResponse, isLoading: loadingParishes } = useParishes({
    limit: 50,
  });
  const parishes = parishesResponse?.items || [];

  const selectedParish =
    selectedParishOverride ??
    (initialParishId ? parishes.find((p) => String(p.id) === String(initialParishId)) ?? null : null);

  const setSelectedParish = (parish: ParishDto | null) => {
    setSelectedParishOverride(parish);
  };

  // Requirements query for selected parish and document type
  const {
    data: requirements,
    isLoading: loadingRequirements,
    error: requirementsError,
  } = useDocumentRequirements(
    selectedDocType && selectedParish
      ? { documentType: selectedDocType, parishId: selectedParish.id }
      : undefined
  );

  // Mutations
  const createDraftMutation = useCreateRequestDraft();
  const uploadFileMutation = useUploadSupportingFile();
  const submitDraftMutation = useSubmitRequestDraft();
  const hasValidRequirementsFee = hasAuthoritativeFee(requirements?.baseFee);

  const handleBack = () => {
    if (step > 1 && !isSubmitting) {
      setStep((prev) => (prev - 1) as WizardStep);
      return;
    }

    if (applicantName.trim() || Object.keys(selectedFiles).length > 0) {
      Alert.alert(
        "Discard Request?",
        "You have unsaved information. Are you sure you want to leave this wizard?",
        [
          { text: "Keep Editing", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => {
              navigateBackOrReplace(
                () => router.canGoBack(),
                () => router.back(),
                () => router.replace("/(app)/(tabs)/(requests)" as any)
              );
            },
          },
        ]
      );
      return;
    }

    navigateBackOrReplace(
      () => router.canGoBack(),
      () => router.back(),
      () => router.replace("/(app)/(tabs)/(requests)" as any)
    );
  };

  if (profile?.needsProfileCompletion) {
    return (
      <Screen testID="request-wizard-blocked">
        <AppHeader
          title="Request Document"
          onBack={() => {
            navigateBackOrReplace(
              () => router.canGoBack(),
              () => router.back(),
              () => router.replace("/(app)/(tabs)/(requests)" as any)
            );
          }}
        />
        <View style={{ flex: 1, padding: spacing.lg, justifyContent: "center" }}>
          <EmptyState
            title="Profile Completion Required"
            description="Complete your profile to access document and schedule requests. Parish offices require your official contact details."
            icon="person-circle-outline"
            actionLabel="Complete Profile"
            onAction={() => router.push("/(app)/(tabs)/profile" as any)}
          />
        </View>
      </Screen>
    );
  }

  // Resolve offered documents for selected parish with explicit empty array semantics
  const offeredDocTypes: CanonicalDocumentType[] = React.useMemo(() => {
    return getEffectiveOfferedDocuments(selectedParish?.availableDocuments);
  }, [selectedParish]);

  // Step 1 -> Step 2
  const handleSelectParish = (parish: ParishDto) => {
    if (selectedParish?.id !== parish.id) {
      setSelectedParish(parish);
      setSelectedDocType(null);
      setSelectedFiles({});
    }
    setStep(2);
  };

  // Step 2 -> Step 3
  const handleSelectDocType = (docType: CanonicalDocumentType) => {
    if (selectedDocType !== docType) {
      setSelectedDocType(docType);
      setSelectedFiles({});
    }
    setStep(3);
  };

  // Step 3 -> Step 4
  const handleValidateFormAndNext = () => {
    if (profile?.needsProfileCompletion) {
      Alert.alert(
        "Profile Details Required",
        "Please complete your profile (full name and contact number) before requesting documents.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Complete Profile",
            onPress: () => router.push("/(app)/(tabs)/profile" as any),
          },
        ]
      );
      return;
    }
    if (!applicantFirstName.trim() || !applicantLastName.trim()) {
      Alert.alert("Applicant Name Required", "Please enter both First Name and Last Name for the applicant.");
      return;
    }
    if (!purpose.trim()) {
      Alert.alert("Purpose Required", "Please state the reason/purpose for this document request.");
      return;
    }
    setStep(4);
  };

  // Step 4 -> Step 5
  const handleValidateFilesAndNext = () => {
    if (!hasValidRequirementsFee) {
      Alert.alert(
        "Fee Configuration Unavailable",
        "This parish has not supplied a valid fee for this document request. Please contact the parish office."
      );
      return;
    }
    const requiredDocs = (requirements?.requiredDocuments || []).filter((d) => d.required);
    const missing = requiredDocs.filter((d) => !selectedFiles[d.id]);

    if (missing.length > 0) {
      const names = missing.map((m) => m.label).join(", ");
      Alert.alert(
        "Required Documents Missing",
        `Please attach all required documents before proceeding:\n\n• ${names}`
      );
      return;
    }
    setStep(5);
  };

  // Generate or retrieve persistent UUID for this submission session
  const getOrCreateIdempotencyKey = () => {
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }
    return idempotencyKeyRef.current;
  };

  // Final Review -> Server Draft -> File Uploads -> Submit
  const queryClient = useQueryClient();
  const createdDraftIdRef = useRef<number | null>(null);

  const handleConfirmAndSubmit = async () => {
    if (!selectedParish || !selectedDocType || inFlightGuard.current) return;
    if (!hasValidRequirementsFee) {
      Alert.alert("Fee Configuration Unavailable", "A valid parish fee is required before this request can be submitted.");
      return;
    }

    inFlightGuard.current = true;
    setIsSubmitting(true);
    let createdDraftId: number | null = createdDraftIdRef.current;

    try {
      // Stage 1: Create once. A retry after an upload failure reuses this exact draft ID.
      if (!createdDraftId) {
        setSubmissionStage("Initializing server draft...");
        const draft = await createDraftMutation.mutateAsync({
          payload: {
            parishId: Number(selectedParish.id),
            documentType: selectedDocType,
            applicantFirstName: applicantFirstName.trim(),
            applicantMiddleName: applicantMiddleName.trim() || undefined,
            applicantLastName: applicantLastName.trim(),
            relationship: relationship.trim(),
            purpose: purpose.trim(),
          },
          idempotencyKey: getOrCreateIdempotencyKey(),
        });

        createdDraftId = draft.id;
        createdDraftIdRef.current = draft.id;
      }

      const draftId = createdDraftId;

      // Stage 2: Upload all selected supporting files
      const fileEntries = Object.entries(selectedFiles);
      if (fileEntries.length > 0) {
        setSubmissionStage(`Attaching supporting files (0 of ${fileEntries.length})...`);
        let count = 0;
        for (const [category, file] of fileEntries) {
          count++;
          setSubmissionStage(`Attaching supporting files (${count} of ${fileEntries.length})...`);
          await uploadFileMutation.mutateAsync({
            requestId: draftId,
            file,
            category,
          });
        }
      }

      // Stage 3: Submit draft
      setSubmissionStage("Finalizing and submitting request...");
      const submitted = await submitDraftMutation.mutateAsync(draftId);

      // Clean local wizard state
      idempotencyKeyRef.current = null;
      createdDraftIdRef.current = null;
      inFlightGuard.current = false;
      setIsSubmitting(false);

      Alert.alert(
        "Request Submitted Successfully",
        `Your document request (${submitted.trackingNumber || "Reference Confirmed"}) has been submitted to ${selectedParish.name}.`
      );

      // Deterministically navigate to detail screen
      router.replace(`/(app)/requests/${submitted.id}` as any);
    } catch (err: any) {
      inFlightGuard.current = false;
      setIsSubmitting(false);
      setSubmissionStage("");

      if (err?.code === "PROFILE_INCOMPLETE") {
        Alert.alert(
          "Profile Details Required",
          "Please complete your profile (full name and contact number) before requesting documents.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Complete Profile",
              onPress: () => router.push("/(app)/(tabs)/profile" as any),
            },
          ]
        );
        return;
      }

      if (createdDraftId) {
        void queryClient.invalidateQueries({
          queryKey: requestKeys.lists(user?.uid),
        });
        void queryClient.invalidateQueries({
          queryKey: requestKeys.detail(user?.uid, createdDraftId),
        });

        Alert.alert(
          "Draft Saved",
          `Your application draft has been saved to your account, but an issue occurred while finalizing: ${err.message || "Network request failed"}.\n\nYou can complete uploading your documents and submit it from the Requests tab.`,
          [
            { text: "Stay Here", style: "cancel" },
            {
              text: "View Saved Draft",
              onPress: () => {
                router.replace(`/(app)/requests/${createdDraftId}` as any);
              },
            },
          ]
        );
      } else {
        Alert.alert(
          "Submission Error",
          err.message ||
            "An error occurred while submitting your request. Please check your connection and try again."
        );
      }
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 1:
        return "Select Target Parish";
      case 2:
        return "Choose Document Type";
      case 3:
        return "Applicant Information";
      case 4:
        return "Supporting Documents";
      case 5:
        return "Review & Confirm";
    }
  };

  return (
    <Screen safeArea={true} style={styles.screen}>
      <AppHeader
        title="New Document Request"
        subtitle={`Step ${step} of 5 — ${getStepTitle()}`}
        onBack={handleBack}
        backAccessibilityLabel="Back to previous step or requests"
      />

      {/* Step Indicator Bar */}
      <View style={styles.stepBar}>
        {([1, 2, 3, 4, 5] as WizardStep[]).map((s) => (
          <View
            key={s}
            style={[
              styles.stepSegment,
              s <= step ? styles.stepSegmentActive : styles.stepSegmentInactive,
            ]}
          />
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          step >= 3 && styles.scrollContentWithBottomAction,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* ================= STEP 1: PARISH SELECTION ================= */}
        {step === 1 ? (
          <View style={styles.stepContainer}>
            <Text style={styles.stepHeading} allowFontScaling>
              Select the Parish where your sacramental record is kept:
            </Text>
            <Text style={styles.stepSubtext} allowFontScaling>
              Choose from all active parishes across the Diocese of San Carlos.
            </Text>

            {loadingParishes ? (
              <View style={styles.skeletonList}>
                <Skeleton width="100%" height={70} style={styles.skeletonItem} />
                <Skeleton width="100%" height={70} style={styles.skeletonItem} />
                <Skeleton width="100%" height={70} style={styles.skeletonItem} />
              </View>
            ) : parishes.length === 0 ? (
              <EmptyState
                icon="business-outline"
                title="No Parishes Found"
                description="Unable to load parishes. Please check your network connection."
              />
            ) : (
              parishes.map((parish) => (
                <TouchableOpacity
                  key={parish.id}
                  onPress={() => handleSelectParish(parish)}
                  style={[
                    styles.parishCard,
                    selectedParish?.id === parish.id && styles.parishCardActive,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${parish.name}, ${parish.municipalityCity || ""}`}
                >
                  <View style={styles.parishIconBox}>
                    <Ionicons name="business" size={22} color={colors.primary} />
                  </View>
                  <View style={styles.parishDetails}>
                    <Text style={styles.parishName} numberOfLines={1} allowFontScaling>
                      {parish.name}
                    </Text>
                    <Text style={styles.parishLocation} allowFontScaling>
                      {[parish.municipalityCity, parish.province].filter(Boolean).join(", ")}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              ))
            )}
          </View>
        ) : null}

        {/* ================= STEP 2: DOCUMENT TYPE SELECTION ================= */}
        {step === 2 ? (
          <View style={styles.stepContainer}>
            <Text style={styles.stepHeading} allowFontScaling>
              Select Document Type:
            </Text>
            <Text style={styles.stepSubtext} allowFontScaling>
              Available document types for {selectedParish?.name}:
            </Text>

            {offeredDocTypes.length === 0 ? (
              <EmptyState
                icon="document-text-outline"
                title="No Online Documents Available"
                description="This parish is not currently accepting certificate requests online."
                actionLabel="Choose Another Parish"
                onAction={() => setStep(1)}
              />
            ) : (
              offeredDocTypes.map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => handleSelectDocType(type)}
                  style={[
                    styles.docTypeCard,
                    selectedDocType === type && styles.docTypeCardActive,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${formatDocumentType(type)}`}
                >
                  <View style={styles.docTypeIconBox}>
                    <Ionicons name="document-text" size={22} color={colors.primary} />
                  </View>
                  <View style={styles.docTypeDetails}>
                    <Text style={styles.docTypeName} allowFontScaling>
                      {formatDocumentType(type)}
                    </Text>
                    <Text style={styles.docTypeDesc} allowFontScaling>
                      Official authenticated sacramental certificate
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              ))
            )}
          </View>
        ) : null}

        {/* ================= STEP 3: APPLICANT INFORMATION ================= */}
        {step === 3 ? (
          <View style={styles.stepContainer}>
            <Card style={styles.formCard}>
              <SectionHeader
                title="Applicant & Request Details"
                subtitle={`For ${formatDocumentType(selectedDocType)} at ${selectedParish?.name}`}
              />

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel} allowFontScaling>
                  First Name *
                </Text>
                <TextInput
                  value={applicantFirstName}
                  onChangeText={setApplicantFirstName}
                  placeholder="e.g. Juan"
                  placeholderTextColor={colors.textMuted}
                  style={styles.textInput}
                  maxLength={50}
                  autoCapitalize="words"
                  accessibilityLabel="First name of the applicant"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel} allowFontScaling>
                  Middle Name (Optional)
                </Text>
                <TextInput
                  value={applicantMiddleName}
                  onChangeText={setApplicantMiddleName}
                  placeholder="e.g. Santos"
                  placeholderTextColor={colors.textMuted}
                  style={styles.textInput}
                  maxLength={50}
                  autoCapitalize="words"
                  accessibilityLabel="Middle name of the applicant"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel} allowFontScaling>
                  Last Name *
                </Text>
                <TextInput
                  value={applicantLastName}
                  onChangeText={setApplicantLastName}
                  placeholder="e.g. Dela Cruz"
                  placeholderTextColor={colors.textMuted}
                  style={styles.textInput}
                  maxLength={50}
                  autoCapitalize="words"
                  accessibilityLabel="Last name of the applicant"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel} allowFontScaling>
                  Relationship to Record Holder *
                </Text>
                <View style={styles.chipRow}>
                  {RELATIONSHIP_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => setRelationship(opt)}
                      style={[
                        styles.chip,
                        relationship === opt && styles.chipActive,
                      ]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: relationship === opt }}
                      accessibilityLabel={`Relationship: ${opt}`}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          relationship === opt && styles.chipTextActive,
                        ]}
                        allowFontScaling
                      >
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel} allowFontScaling>
                  Purpose / Reason for Request *
                </Text>
                <TextInput
                  value={purpose}
                  onChangeText={setPurpose}
                  placeholder="e.g. Marriage requirement, School admission, Personal record"
                  placeholderTextColor={colors.textMuted}
                  multiline={true}
                  numberOfLines={3}
                  style={[styles.textInput, styles.textArea]}
                  accessibilityLabel="Purpose or reason for requesting this certificate"
                />
              </View>
            </Card>
          </View>
        ) : null}

        {/* ================= STEP 4: SUPPORTING DOCUMENTS ================= */}
        {step === 4 ? (
          <View style={styles.stepContainer}>
            <Text style={styles.stepHeading} allowFontScaling>
              Required Attachments
            </Text>
            <Text style={styles.stepSubtext} allowFontScaling>
              Attach the required identity and sacramental requirements before review.
            </Text>

            {loadingRequirements ? (
              <View style={styles.skeletonList}>
                <Skeleton width="100%" height={100} style={styles.skeletonItem} />
                <Skeleton width="100%" height={100} style={styles.skeletonItem} />
              </View>
            ) : requirementsError ? (
              <EmptyState
                icon="alert-circle-outline"
                title="Requirements Unavailable"
                description="Unable to load authoritative document requirements for this parish."
              />
            ) : requirements?.requiredDocuments && requirements.requiredDocuments.length > 0 ? (
              requirements.requiredDocuments.map((reqDoc) => (
                <SupportingFilePicker
                  key={reqDoc.id}
                  requirement={reqDoc}
                  selectedFile={selectedFiles[reqDoc.id]}
                  onFileSelected={(file) =>
                    setSelectedFiles((prev) => ({ ...prev, [reqDoc.id]: file }))
                  }
                  onFileRemoved={(id) =>
                    setSelectedFiles((prev) => {
                      const updated = { ...prev };
                      delete updated[id];
                      return updated;
                    })
                  }
                />
              ))
            ) : (
              <Card style={styles.formCard}>
                <Text style={styles.noReqText} allowFontScaling>
                  No specific supporting attachments are required for this certificate.
                </Text>
              </Card>
            )}
          </View>
        ) : null}

        {/* ================= STEP 5: REVIEW & SUBMIT ================= */}
        {step === 5 ? (
          <View style={styles.stepContainer}>
            <Card style={styles.formCard}>
              <SectionHeader
                title="Review Your Application"
                subtitle="Please verify all information before finalizing submission."
              />

              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel} allowFontScaling>
                  Document Type:
                </Text>
                <Text style={styles.reviewValue} allowFontScaling>
                  {formatDocumentType(selectedDocType)}
                </Text>
              </View>

              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel} allowFontScaling>
                  Target Parish:
                </Text>
                <Text style={styles.reviewValue} allowFontScaling>
                  {selectedParish?.name}
                </Text>
              </View>

              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel} allowFontScaling>
                  Record Holder Name:
                </Text>
                <Text style={styles.reviewValue} allowFontScaling>
                  {applicantName}
                </Text>
              </View>

              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel} allowFontScaling>
                  Relationship:
                </Text>
                <Text style={styles.reviewValue} allowFontScaling>
                  {relationship}
                </Text>
              </View>

              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel} allowFontScaling>
                  Purpose:
                </Text>
                <Text style={styles.reviewValue} allowFontScaling>
                  {purpose}
                </Text>
              </View>

              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel} allowFontScaling>
                  Attached Files:
                </Text>
                <Text style={styles.reviewValue} allowFontScaling>
                  {Object.keys(selectedFiles).length} file(s) attached
                </Text>
              </View>

              <View style={[styles.reviewRow, styles.reviewFeeRow]}>
                <Text style={styles.reviewLabel} allowFontScaling>
                  Authoritative Fee:
                </Text>
                <Text style={styles.reviewFeeValue} allowFontScaling>
                  {formatFee(requirements?.baseFee)}
                </Text>
              </View>
            </Card>

            <View style={styles.legalNotice}>
              <Ionicons
                name="shield-checkmark-outline"
                size={18}
                color={colors.textSecondary}
              />
              <Text style={styles.legalNoticeText} allowFontScaling>
                By submitting this request, you attest that the information provided is true, accurate, and for lawful ecclesiastical purposes.
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Sticky Bottom Actions for Steps 3, 4, 5 */}
      {step === 3 ? (
        <BottomActionBar>
          <Button
            title="Next: Supporting Documents"
            variant="primary"
            size="lg"
            icon="arrow-forward"
            onPress={handleValidateFormAndNext}
          />
        </BottomActionBar>
      ) : step === 4 ? (
        <BottomActionBar>
          <Button
            title="Next: Review Request"
            variant="primary"
            size="lg"
            icon="arrow-forward"
            onPress={handleValidateFilesAndNext}
          />
        </BottomActionBar>
      ) : step === 5 ? (
        <BottomActionBar>
          <Button
            title={isSubmitting ? submissionStage || "Submitting..." : "Confirm & Submit Request"}
            variant="primary"
            size="lg"
            icon="checkmark-circle-outline"
            onPress={handleConfirmAndSubmit}
            loading={isSubmitting}
            disabled={isSubmitting || !hasValidRequirementsFee}
            accessibilityLabel="Confirm and submit your document request"
          />
        </BottomActionBar>
      ) : null}
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    padding: 0,
    backgroundColor: colors.background,
  },
  stepBar: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
    gap: 4,
  },
  stepSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  stepSegmentActive: {
    backgroundColor: colors.primary,
  },
  stepSegmentInactive: {
    backgroundColor: colors.borderLight,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  scrollContentWithBottomAction: {
    paddingBottom: spacing.xxl + 80,
  },
  stepContainer: {
    flex: 1,
  },
  stepHeading: {
    ...fontStyles.subheading,
    color: colors.textPrimary,
    marginBottom: 2,
    fontWeight: "700",
  },
  stepSubtext: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  skeletonList: {
    gap: spacing.sm,
  },
  skeletonItem: {
    borderRadius: radii.md,
  },
  parishCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    minHeight: 56,
  },
  parishCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  parishIconBox: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  parishDetails: {
    flex: 1,
  },
  parishName: {
    ...fontStyles.bodyMedium,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  parishLocation: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  docTypeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    minHeight: 56,
  },
  docTypeCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  docTypeIconBox: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  docTypeDetails: {
    flex: 1,
  },
  docTypeName: {
    ...fontStyles.bodyMedium,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  docTypeDesc: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  formCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  formGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    ...fontStyles.captionMedium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  textInput: {
    backgroundColor: colors.surfaceVariant,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...fontStyles.body,
    color: colors.textPrimary,
    minHeight: 44,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surfaceVariant,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  chipText: {
    ...fontStyles.captionMedium,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.primary,
    fontWeight: "700",
  },
  noReqText: {
    ...fontStyles.bodySmall,
    color: colors.textSecondary,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: spacing.md,
  },
  reviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: spacing.sm,
  },
  reviewLabel: {
    ...fontStyles.captionMedium,
    color: colors.textSecondary,
  },
  reviewValue: {
    ...fontStyles.bodyMedium,
    color: colors.textPrimary,
    flex: 1,
    textAlign: "right",
  },
  reviewFeeRow: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  reviewFeeValue: {
    ...fontStyles.subheading,
    color: colors.primary,
    fontWeight: "700",
  },
  legalNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceVariant,
    padding: spacing.sm,
    borderRadius: radii.sm,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  legalNoticeText: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    flex: 1,
  },
});

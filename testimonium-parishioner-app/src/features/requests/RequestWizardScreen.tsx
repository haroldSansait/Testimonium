import React, { useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
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
  TextInput,
} from "@/components/ui";
import { useParishes } from "@/features/parishes/api";
import type { ParishDto } from "@/features/parishes/types";
import { useFeedback } from "@/providers/FeedbackProvider";
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
import { normalizeAuthorizationLetterFile } from "./supportingUpload";
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
  const feedback = useFeedback();

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
  const [fieldErrors, setFieldErrors] = useState<{
    firstName?: string;
    lastName?: string;
    purpose?: string;
  }>({});

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
  const queryClient = useQueryClient();
  const createdDraftIdRef = useRef<number | null>(null);

  // Resolve offered documents for selected parish with explicit empty array semantics
  const offeredDocTypes: CanonicalDocumentType[] = React.useMemo(() => {
    return getEffectiveOfferedDocuments(selectedParish?.availableDocuments);
  }, [selectedParish]);

  const handleBack = () => {
    if (step > 1 && !isSubmitting) {
      setStep((prev) => (prev - 1) as WizardStep);
      return;
    }

    if (applicantName.trim() || Object.keys(selectedFiles).length > 0) {
      feedback.showConfirm(
        "Discard Request?",
        "You have unsaved information. Are you sure you want to leave this wizard?",
        () => {
          navigateBackOrReplace(
            () => router.canGoBack(),
            () => router.back(),
            () => router.replace("/(app)/(tabs)/(requests)" as any)
          );
        },
        {
          confirmText: "Discard",
          cancelText: "Keep Editing",
          isDestructive: true,
        }
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
      feedback.showWarning(
        "Profile Details Required",
        "Please complete your profile (full name and contact number) before requesting documents.",
        {
          confirmText: "Complete Profile",
          onConfirm: () => router.push("/(app)/(tabs)/profile" as any),
        }
      );
      return;
    }

    const errs: { firstName?: string; lastName?: string; purpose?: string } = {};
    if (!applicantFirstName.trim()) {
      errs.firstName = "First name is required";
    }
    if (!applicantLastName.trim()) {
      errs.lastName = "Last name is required";
    }
    if (!purpose.trim()) {
      errs.purpose = "Please state the reason or purpose for this request";
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setFieldErrors({});
    setStep(4);
  };

  // Step 4 -> Step 5
  const handleValidateFilesAndNext = () => {
    if (!hasValidRequirementsFee) {
      feedback.showError(
        "Fee Configuration Unavailable",
        "This parish has not supplied a valid fee for this document request. Please contact the parish office."
      );
      return;
    }
    const requiredDocs = (requirements?.requiredDocuments || []).filter((d) => d.required);
    const missing = requiredDocs.filter((d) => !selectedFiles[d.id]);

    if (missing.length > 0) {
      const names = missing.map((m) => m.label).join(", ");
      feedback.showWarning(
        "Required Documents Missing",
        `Please attach all required documents before proceeding:\n\n• ${names}`
      );
      return;
    }

    if (relationship === "Authorized Representative" && !selectedFiles["authorization_letter"]) {
      feedback.showWarning(
        "Authorization Letter Required",
        "An authorization letter is required when requesting documents as an Authorized Representative."
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


  const handleConfirmAndSubmit = async () => {
    if (!selectedParish || !selectedDocType || inFlightGuard.current) return;
    if (!hasValidRequirementsFee) {
      feedback.showError("Fee Configuration Unavailable", "A valid parish fee is required before this request can be submitted.");
      return;
    }

    if (relationship === "Authorized Representative" && !selectedFiles["authorization_letter"]) {
      feedback.showWarning("Authorization Letter Required", "An authorization letter is required when requesting documents as an Authorized Representative.");
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

      feedback.showSuccess(
        "Request Submitted Successfully",
        `Your document request has been submitted to ${selectedParish.name}. You can track its progress and review uploaded documents at any time.`,
        {
          referenceNumber: submitted.trackingNumber || undefined,
          confirmText: "View Request",
          onConfirm: () => {
            router.replace(`/(app)/requests/${submitted.id}` as any);
          },
        }
      );
    } catch (err: any) {
      inFlightGuard.current = false;
      setIsSubmitting(false);
      setSubmissionStage("");

      if (err?.code === "PROFILE_INCOMPLETE") {
        feedback.showWarning(
          "Profile Details Required",
          "Please complete your profile (full name and contact number) before requesting documents.",
          {
            confirmText: "Complete Profile",
            onConfirm: () => router.push("/(app)/(tabs)/profile" as any),
          }
        );
        return;
      }

      if (err?.code === "AUTHORIZATION_LETTER_REQUIRED") {
        feedback.showWarning(
          "Authorization Letter Required",
          "An authorization letter is required when requesting documents as an Authorized Representative."
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

        feedback.showConfirm(
          "Draft Saved",
          `Your application draft has been saved to your account, but an issue occurred while finalizing: ${err.message || "Network request failed"}.\n\nYou can complete uploading your documents and submit it from the Requests tab.`,
          () => {
            router.replace(`/(app)/requests/${createdDraftId}` as any);
          },
          {
            confirmText: "View Saved Draft",
            cancelText: "Stay Here",
          }
        );
      } else {
        feedback.showError(
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
                  activeOpacity={0.7}
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
                  activeOpacity={0.7}
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

              <View style={styles.inputsWrapper}>
                <TextInput
                  label="First Name *"
                  value={applicantFirstName}
                  onChangeText={(val) => {
                    setApplicantFirstName(val);
                    if (fieldErrors.firstName) {
                      setFieldErrors((prev) => ({ ...prev, firstName: undefined }));
                    }
                  }}
                  placeholder="e.g. Juan"
                  maxLength={50}
                  autoCapitalize="words"
                  error={fieldErrors.firstName}
                  accessibilityLabel="First name of the applicant"
                  containerStyle={styles.formInputGroup}
                />

                <TextInput
                  label="Middle Name (Optional)"
                  value={applicantMiddleName}
                  onChangeText={setApplicantMiddleName}
                  placeholder="e.g. Santos"
                  maxLength={50}
                  autoCapitalize="words"
                  accessibilityLabel="Middle name of the applicant"
                  containerStyle={styles.formInputGroup}
                />

                <TextInput
                  label="Last Name *"
                  value={applicantLastName}
                  onChangeText={(val) => {
                    setApplicantLastName(val);
                    if (fieldErrors.lastName) {
                      setFieldErrors((prev) => ({ ...prev, lastName: undefined }));
                    }
                  }}
                  placeholder="e.g. Dela Cruz"
                  maxLength={50}
                  autoCapitalize="words"
                  error={fieldErrors.lastName}
                  accessibilityLabel="Last name of the applicant"
                  containerStyle={styles.formInputGroup}
                />

                {/* Relationship Pills */}
                <View style={styles.formInputGroup}>
                  <Text style={styles.sectionLabel} allowFontScaling>
                    Relationship to Record Holder *
                  </Text>
                  <View style={styles.chipRow}>
                    {RELATIONSHIP_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={opt}
                        onPress={() => {
                          setRelationship(opt);
                          if (opt !== "Authorized Representative") {
                            setSelectedFiles((prev) => {
                              if (!prev["authorization_letter"]) return prev;
                              const copy = { ...prev };
                              delete copy["authorization_letter"];
                              return copy;
                            });
                          }
                        }}
                        style={[
                          styles.chip,
                          opt === "Authorized Representative" && styles.chipWide,
                          relationship === opt && styles.chipActive,
                        ]}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: relationship === opt }}
                        accessibilityLabel={`Relationship: ${opt}`}
                        activeOpacity={0.7}
                      >
                        {relationship === opt && (
                          <Ionicons
                            name="checkmark-circle"
                            size={16}
                            color={colors.primary}
                            style={styles.chipIcon}
                          />
                        )}
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

                <TextInput
                  label="Purpose / Reason for Request *"
                  value={purpose}
                  onChangeText={(val) => {
                    setPurpose(val);
                    if (fieldErrors.purpose) {
                      setFieldErrors((prev) => ({ ...prev, purpose: undefined }));
                    }
                  }}
                  placeholder="e.g. Marriage requirement, School admission, Personal record"
                  multiline={true}
                  numberOfLines={3}
                  style={styles.textArea}
                  error={fieldErrors.purpose}
                  accessibilityLabel="Purpose or reason for requesting this certificate"
                  containerStyle={styles.formInputGroup}
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
              Attach the required identity and sacramental documents before proceeding to review.
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

            {/* Conditional Authorization Letter for Authorized Representative */}
            {relationship === "Authorized Representative" ? (
              <SupportingFilePicker
                key="authorization_letter"
                requirement={{
                  id: "authorization_letter",
                  category: "authorization_letter",
                  label: "Authorization Letter *",
                  description: "Upload the signed authorization letter from the person you are representing. Accepted: PDF, JPEG, PNG (Max 5 MB).",
                  required: true,
                }}
                selectedFile={selectedFiles["authorization_letter"]}
                onFileSelected={(file) => {
                  try {
                    const normalized = normalizeAuthorizationLetterFile(file);
                    setSelectedFiles((prev) => ({ ...prev, authorization_letter: normalized }));
                  } catch (err: any) {
                    feedback.showError("Invalid File", err.message);
                  }
                }}
                onFileRemoved={() => {
                  setSelectedFiles((prev) => {
                    const updated = { ...prev };
                    delete updated["authorization_letter"];
                    return updated;
                  });
                }}
              />
            ) : null}
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

              {/* Group 1: Document & Parish */}
              <View style={styles.reviewGroup}>
                <Text style={styles.reviewGroupHeader} allowFontScaling>
                  Document & Parish
                </Text>
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
              </View>

              {/* Group 2: Applicant Information */}
              <View style={styles.reviewGroup}>
                <Text style={styles.reviewGroupHeader} allowFontScaling>
                  Applicant Details
                </Text>
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
              </View>

              {/* Group 3: Supporting Attachments */}
              <View style={styles.reviewGroup}>
                <Text style={styles.reviewGroupHeader} allowFontScaling>
                  Supporting Attachments
                </Text>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel} allowFontScaling>
                    Attached Files:
                  </Text>
                  <Text style={styles.reviewValue} allowFontScaling>
                    {Object.keys(selectedFiles).length} file(s) attached
                  </Text>
                </View>

                {relationship === "Authorized Representative" ? (
                  <View style={styles.reviewRow}>
                    <Text style={styles.reviewLabel} allowFontScaling>
                      Authorization Letter:
                    </Text>
                    <Text
                      style={[
                        styles.reviewValue,
                        {
                          color: selectedFiles["authorization_letter"]
                            ? colors.success
                            : colors.danger,
                          fontWeight: "600",
                        },
                      ]}
                      allowFontScaling
                    >
                      {selectedFiles["authorization_letter"] ? "Attached (Ready to upload)" : "Missing"}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Authoritative Dynamic Fee Banner */}
              <View style={styles.feeBanner}>
                <View style={styles.feeBannerHeader}>
                  <Ionicons name="pricetag" size={18} color={colors.primary} />
                  <Text style={styles.feeBannerTitle} allowFontScaling>
                    Authoritative Parish Fee
                  </Text>
                </View>
                <Text style={styles.feeBannerAmount} allowFontScaling>
                  {formatFee(requirements?.baseFee)}
                </Text>
                <Text style={styles.feeBannerNote} allowFontScaling>
                  Official processing fee set by {selectedParish?.name || "the parish"}.
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
            style={styles.fullWidthAction}
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
            style={styles.fullWidthAction}
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
            style={styles.fullWidthAction}
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
  inputsWrapper: {
    gap: spacing.sm,
  },
  formInputGroup: {
    marginBottom: spacing.xs,
  },
  sectionLabel: {
    ...fontStyles.captionMedium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 3,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    backgroundColor: colors.surfaceVariant,
    minHeight: 38,
  },
  chipWide: {
    flexBasis: "100%",
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  chipIcon: {
    marginRight: 4,
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
  reviewGroup: {
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  reviewGroupHeader: {
    ...fontStyles.captionMedium,
    color: colors.primary,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  reviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 4,
    gap: spacing.sm,
  },
  reviewLabel: {
    ...fontStyles.caption,
    color: colors.textSecondary,
  },
  reviewValue: {
    ...fontStyles.bodySmall,
    color: colors.textPrimary,
    fontWeight: "500",
    flex: 1,
    textAlign: "right",
  },
  feeBanner: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.xs,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  feeBannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: 4,
  },
  feeBannerTitle: {
    ...fontStyles.captionMedium,
    color: colors.primary,
    fontWeight: "600",
  },
  feeBannerAmount: {
    ...fontStyles.heading,
    color: colors.primary,
    fontWeight: "800",
    fontSize: 26,
    marginVertical: 2,
  },
  feeBannerNote: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    textAlign: "center",
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
  fullWidthAction: {
    flex: 1,
  },
});

import React, { useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn } from "react-native-reanimated";
import { Screen } from "@/components/Screen";
import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { TextInput } from "@/components/ui/TextInput";
import { SelectionRow } from "@/components/ui/SelectionRow";
import { FormSection } from "@/components/ui/FormSection";
import { RecordSection } from "@/components/ui/RecordSection";
import { Divider } from "@/components/ui/Divider";
import { SafeBottomActionBar } from "@/components/ui/SafeBottomActionBar";
import { useAppLayoutMetrics } from "@/components/layout/useAppLayoutMetrics";
import { useParishes } from "@/features/parishes/api";
import type { ParishDto } from "@/features/parishes/types";
import { useFeedback } from "@/providers/FeedbackProvider";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { navigateBackOrReplace } from "@/services/navigation/back";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import {
  useCreateRequestDraft,
  useDocumentRequirements,
  useSubmitRequestDraft,
  useUploadSupportingFile,
  useUploadRegistrantId,
} from "./api";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";
import { requestKeys } from "./queryKeys";
import { SupportingFilePicker } from "./components/SupportingFilePicker";
import { RegistrantIdCapturePicker } from "./components/RegistrantIdCapturePicker";
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
  LocalRegistrantIdImage,
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
  const { profile, user } = useAuth();
  const feedback = useFeedback();
  const reduceMotion = useReducedMotion();
  const { contentBottomInset, onBottomActionLayout } = useAppLayoutMetrics();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<WizardStep>(1);
  const [selectedParishOverride, setSelectedParishOverride] = useState<ParishDto | null>(null);
  const [selectedDocType, setSelectedDocType] = useState<CanonicalDocumentType | null>(null);

  // Form Fields
  const [applicantFirstName, setApplicantFirstName] = useState("");
  const [applicantMiddleName, setApplicantMiddleName] = useState("");
  const [applicantLastName, setApplicantLastName] = useState("");
  const applicantName = [applicantFirstName.trim(), applicantMiddleName.trim(), applicantLastName.trim()].filter(Boolean).join(" ");
  const [relationship, setRelationship] = useState("Self");
  const [isRelationshipModalOpen, setIsRelationshipModalOpen] = useState(false);
  const [purpose, setPurpose] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    firstName?: string;
    lastName?: string;
    purpose?: string;
  }>({});

  // Files
  const [selectedFiles, setSelectedFiles] = useState<Record<string, LocalSelectedFile>>({});
  const [registrantIdFront, setRegistrantIdFront] = useState<LocalRegistrantIdImage | null>(null);
  const [registrantIdBack, setRegistrantIdBack] = useState<LocalRegistrantIdImage | null>(null);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStage, setSubmissionStage] = useState("");
  const idempotencyKeyRef = useRef<string | null>(null);
  const inFlightGuard = useRef(false);
  const draftFingerprintRef = useRef<string | null>(null);

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
      ? { documentType: selectedDocType, parishId: selectedParish.id, relationship }
      : undefined
  );

  // Mutations
  const createDraftMutation = useCreateRequestDraft();
  const uploadFileMutation = useUploadSupportingFile();
  const uploadRegistrantIdMutation = useUploadRegistrantId();
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

  if (!profile?.isGovernmentIdVerified) {
    return (
      <Screen testID="request-wizard-id-blocked">
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
            title="Government ID Verification Required"
            description="Please verify your Philippine government-issued ID to request official sacramental documents."
            icon="shield-checkmark-outline"
            actionLabel="Verify Government ID"
            onAction={() => router.push("/(app)/profile/id-verification" as any)}
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
  };

  // Step 2 -> Step 3
  const handleSelectDocType = (docType: CanonicalDocumentType) => {
    if (selectedDocType !== docType) {
      setSelectedDocType(docType);
      setSelectedFiles({});
    }
  };

  const handleSelectRelationship = (opt: string) => {
    if (relationship !== opt) {
      createdDraftIdRef.current = null;
      draftFingerprintRef.current = null;
      idempotencyKeyRef.current = null;
    }
    setRelationship(opt);
    setIsRelationshipModalOpen(false);
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

    if (!profile?.isGovernmentIdVerified) {
      feedback.showWarning(
        "Government ID Required",
        "Please verify your Philippine government-issued ID before requesting documents.",
        {
          confirmText: "Verify ID",
          onConfirm: () => router.push("/(app)/profile/id-verification" as any),
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
    const missing = requiredDocs.filter((d) => {
      if (d.id === "valid_id" && profile?.isGovernmentIdVerified) {
        return false;
      }
      return !selectedFiles[d.id];
    });

    if (missing.length > 0) {
      const names = missing.map((m) => m.label).join(", ");
      feedback.showWarning(
        "Required Documents Missing",
        `Please attach all required documents before proceeding:\n\n• ${names}`
      );
      return;
    }

    if (relationship !== "Self" && !selectedFiles["authorization_letter"]) {
      feedback.showWarning(
        "Authorization Letter Required",
        "An authorization letter is required when requesting a document for another person."
      );
      return;
    }
    if (relationship !== "Self" && (!registrantIdFront || !registrantIdBack)) {
      feedback.showWarning("Registrant ID Required", "Select clear front and back images of the registrant's Government ID.");
      return;
    }

    setStep(5);
  };

  // Generate or retrieve persistent UUID for this submission session
  const getOrCreateIdempotencyKey = () => {
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = `req_${globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`}`;
    }
    return idempotencyKeyRef.current;
  };

  const handleConfirmAndSubmit = async () => {
    if (!selectedParish || !selectedDocType || inFlightGuard.current) return;
    if (!hasValidRequirementsFee) {
      feedback.showError("Fee Configuration Unavailable", "A valid parish fee is required before this request can be submitted.");
      return;
    }

    if (relationship !== "Self" && !selectedFiles["authorization_letter"]) {
      feedback.showWarning("Authorization Letter Required", "An authorization letter is required when requesting a document for another person.");
      return;
    }
    if (relationship !== "Self" && (!registrantIdFront || !registrantIdBack)) {
      feedback.showWarning("Registrant ID Required", "Select clear front and back images of the registrant's Government ID.");
      return;
    }

    inFlightGuard.current = true;
    setIsSubmitting(true);
    let createdDraftId: number | null = createdDraftIdRef.current;

    try {
      const draftFingerprint = JSON.stringify({ parishId: selectedParish.id, documentType: selectedDocType, applicantFirstName: applicantFirstName.trim(), applicantMiddleName: applicantMiddleName.trim(), applicantLastName: applicantLastName.trim(), relationship: relationship.trim(), purpose: purpose.trim() });
      if (draftFingerprintRef.current && draftFingerprintRef.current !== draftFingerprint) {
        createdDraftIdRef.current = null;
        idempotencyKeyRef.current = null;
        createdDraftId = null;
      }
      // Stage 1: Reuse only a draft whose authoritative payload still matches.
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
        draftFingerprintRef.current = draftFingerprint;
      }

      const draftId = createdDraftId;

      // Stage 2: Upload all selected supporting files
      const activeIds = new Set((requirements?.requiredDocuments || []).filter((item) => item.required && item.id !== "valid_id").map((item) => item.id));
      if (relationship !== "Self") activeIds.add("authorization_letter");
      const fileEntries = Object.entries(selectedFiles).filter(([category]) => activeIds.has(category));
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

      if (relationship !== "Self" && registrantIdFront && registrantIdBack) {
        setSubmissionStage("Uploading registrant Government ID evidence...");
        await uploadRegistrantIdMutation.mutateAsync({ requestId: draftId, front: registrantIdFront, back: registrantIdBack });
      }

      // Stage 3: Submit draft
      setSubmissionStage("Finalizing and submitting request...");
      const submitted = await submitDraftMutation.mutateAsync(draftId);

      // Clean local wizard state
      idempotencyKeyRef.current = null;
      createdDraftIdRef.current = null;
      draftFingerprintRef.current = null;

      // Invalidate relevant queries
      void queryClient.invalidateQueries({ queryKey: requestKeys.lists(user?.uid) });
      void queryClient.invalidateQueries({ queryKey: requestKeys.detail(user?.uid, String(draftId)) });

      // Navigate to detail page
      feedback.showSuccess(
        "Request Submitted",
        "Your document request has been submitted successfully."
      );
      router.replace(`/(app)/requests/${submitted.id}` as any);
    } catch (err: any) {
      inFlightGuard.current = false;
      setIsSubmitting(false);

      if (err?.code === "IDENTITY_NOT_VERIFIED") {
        feedback.showWarning(
          "Government ID Required",
          "Please verify your Philippine government-issued ID before submitting a document request.",
          {
            confirmText: "Verify ID",
            onConfirm: () => router.push("/(app)/profile/id-verification" as any),
          }
        );
        return;
      }

      if (err?.code === "SELF_REGISTRANT_NAME_MISMATCH" || err?.code === "SELF_REGISTRANT_NAME_UNAVAILABLE") {
        feedback.showWarning(
          "Check Registrant Name",
          err.message || "The registrant name must match your verified profile name for a Self request."
        );
        return;
      }

      if (createdDraftId) {
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

  const bottomInset = contentBottomInset("action");

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
          { paddingBottom: bottomInset + spacing.md },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          key={step}
          entering={reduceMotion ? undefined : FadeIn.duration(180)}
        >
        {/* ================= STEP 1: PARISH SELECTION ================= */}
        {step === 1 ? (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepHeading} allowFontScaling>
                Select Target Parish
              </Text>
              <Text style={styles.stepSubtext} allowFontScaling>
                Choose the parish where your sacramental record is registered.
              </Text>
            </View>

            {loadingParishes ? (
              <View style={styles.skeletonList}>
                <Skeleton width="100%" height={60} style={styles.skeletonItem} />
                <Skeleton width="100%" height={60} style={styles.skeletonItem} />
                <Skeleton width="100%" height={60} style={styles.skeletonItem} />
              </View>
            ) : parishes.length === 0 ? (
              <EmptyState
                icon="business-outline"
                title="No Parishes Found"
                description="Unable to load parishes. Please check your network connection."
              />
            ) : (
              <View style={styles.selectionList}>
                {parishes.map((parish) => (
                  <SelectionRow
                    key={parish.id}
                    title={parish.name}
                    subtitle={[parish.municipalityCity, parish.province].filter(Boolean).join(", ")}
                    selected={selectedParish?.id === parish.id}
                    onSelect={() => handleSelectParish(parish)}
                    mode="radio"
                    accessibilityLabel={`Parish: ${parish.name}`}
                  />
                ))}
              </View>
            )}
          </View>
        ) : null}

        {/* ================= STEP 2: DOCUMENT TYPE SELECTION ================= */}
        {step === 2 ? (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepHeading} allowFontScaling>
                Select Document Type
              </Text>
              <Text style={styles.stepSubtext} allowFontScaling>
                Available certificate types offered by {selectedParish?.name}:
              </Text>
            </View>

            {offeredDocTypes.length === 0 ? (
              <EmptyState
                icon="document-text-outline"
                title="No Online Documents Available"
                description="This parish is not currently accepting certificate requests online."
                actionLabel="Choose Another Parish"
                onAction={() => setStep(1)}
              />
            ) : (
              <View style={styles.selectionList}>
                {offeredDocTypes.map((type) => (
                  <SelectionRow
                    key={type}
                    title={formatDocumentType(type)}
                    subtitle="Official authenticated sacramental certificate"
                    selected={selectedDocType === type}
                    onSelect={() => handleSelectDocType(type)}
                    mode="radio"
                    accessibilityLabel={`Document type: ${formatDocumentType(type)}`}
                  />
                ))}
              </View>
            )}
          </View>
        ) : null}

        {/* ================= STEP 3: APPLICANT INFORMATION ================= */}
        {step === 3 ? (
          <View style={styles.stepContainer}>
            {/* Requester vs Registrant Distinction Card */}
            <View style={styles.verifiedIdBanner}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <Text style={styles.verifiedIdTitle}>Requester Identity</Text>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Ionicons name="checkmark-circle" size={14} color="#059669" style={{ marginRight: 4 }} />
                  <Text style={{ fontSize: 11, fontWeight: "600", color: "#059669" }}>ID Verified</Text>
                </View>
              </View>
              <Text style={styles.verifiedIdSubtext}>
                Logged in as: {profile?.firstName} {profile?.lastName}
              </Text>
              {relationship === "Self" ? (
                <Text style={[styles.verifiedIdSubtext, { marginTop: 4 }]}>
                  Requesting for yourself (Self). Enter your legal name as recorded in parish books.
                </Text>
              ) : (
                <Text style={[styles.verifiedIdSubtext, { marginTop: 4, color: "#92400e" }]}>
                  {`Third-party request (${relationship}). Enter the registrant's name below. A signed Authorization Letter and the registrant's Government ID will be required in Step 4.`}
                </Text>
              )}
            </View>

            <FormSection
              title="Registrant Information"
              description={`For ${formatDocumentType(selectedDocType)} at ${selectedParish?.name}`}
            >
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
              />

              <TextInput
                label="Middle Name (Optional)"
                value={applicantMiddleName}
                onChangeText={setApplicantMiddleName}
                placeholder="e.g. Santos"
                maxLength={50}
                autoCapitalize="words"
                accessibilityLabel="Middle name of the applicant"
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
              />
            </FormSection>

            <Divider />

            {/* Relationship Section */}
            <FormSection
              title="Relationship to Record Holder *"
              description="Select your relationship to the person named on the sacramental record."
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Relationship to Record Holder, current selection: ${relationship}`}
                accessibilityHint="Opens a selection menu to choose your relationship to the record holder"
                onPress={() => setIsRelationshipModalOpen(true)}
                style={styles.dropdownTrigger}
              >
                <Text style={styles.dropdownValueText} allowFontScaling>
                  {relationship}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={20}
                  color={colors.neutral[650]}
                  style={styles.dropdownChevron}
                />
              </Pressable>
            </FormSection>

            <Divider />

            <FormSection title="Purpose of Request">
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
              />
            </FormSection>
          </View>
        ) : null}

        {/* ================= STEP 4: SUPPORTING DOCUMENTS ================= */}
        {step === 4 ? (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepHeading} allowFontScaling>
                Required Attachments
              </Text>
              <Text style={styles.stepSubtext} allowFontScaling>
                Attach required identity and sacramental documents before proceeding to review.
              </Text>
            </View>

            {loadingRequirements ? (
              <View style={styles.skeletonList}>
                <Skeleton width="100%" height={80} style={styles.skeletonItem} />
                <Skeleton width="100%" height={80} style={styles.skeletonItem} />
              </View>
            ) : requirementsError ? (
              <EmptyState
                icon="alert-circle-outline"
                title="Requirements Unavailable"
                description="Unable to load authoritative document requirements for this parish."
              />
            ) : requirements?.requiredDocuments && requirements.requiredDocuments.length > 0 ? (
              requirements.requiredDocuments.map((reqDoc) =>
                reqDoc.id === "valid_id" && profile?.isGovernmentIdVerified ? (
                  <View key={reqDoc.id} style={styles.verifiedIdBanner}>
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                      <Ionicons name="checkmark-circle" size={18} color="#059669" style={{ marginRight: 6 }} />
                      <Text style={styles.verifiedIdTitle}>Valid Government ID</Text>
                    </View>
                    <Text style={styles.verifiedIdSubtext}>
                      Verified through your TESTIMONIUM profile ({profile?.governmentIdType || "Government ID"}). No additional upload required.
                    </Text>
                  </View>
                ) : (
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
                )
              )
            ) : (
              <View style={styles.noReqContainer}>
                <Text style={styles.noReqText} allowFontScaling>
                  No specific supporting attachments are required for this certificate.
                </Text>
              </View>
            )}

            {relationship !== "Self" ? (
              <View style={styles.infoBanner}>
                <Text style={styles.infoTitle}>Requesting a document for someone else</Text>
                <Text style={styles.infoText}>Your Government ID is verified through your profile. Also provide a signed Authorization Letter and clear front and back images of the Government ID belonging to the registrant. The registrant is the person named on the sacramental record.</Text>
                <Text style={styles.infoText}>If the registrant has no available ID or cannot provide the required evidence, contact the parish office; this online request cannot proceed under the current rule.</Text>
              </View>
            ) : null}

            {/* Conditional relationship evidence for every non-Self request */}
            {relationship !== "Self" ? (
              <SupportingFilePicker
                key="authorization_letter"
                requirement={{
                  id: "authorization_letter",
                  category: "authorization_letter",
                  label: "Authorization Letter *",
                  description: "Upload the signed Authorization Letter required for this non-Self request. Accepted: PDF, JPEG, PNG (Max 5 MB).",
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

            {relationship !== "Self" ? (
              <>
                <RegistrantIdCapturePicker side="front" image={registrantIdFront} onSelected={setRegistrantIdFront} onRemoved={() => setRegistrantIdFront(null)} disabled={isSubmitting} />
                <RegistrantIdCapturePicker side="back" image={registrantIdBack} onSelected={setRegistrantIdBack} onRemoved={() => setRegistrantIdBack(null)} disabled={isSubmitting} />
              </>
            ) : null}

            {relationship === "Self" && (selectedFiles["authorization_letter"] || registrantIdFront || registrantIdBack) ? (
              <Text style={styles.hiddenEvidenceNote}>Previously selected non-Self evidence is kept only in this local wizard session and will not be uploaded for a Self request.</Text>
            ) : null}
          </View>
        ) : null}

        {/* ================= STEP 5: REVIEW & SUBMIT ================= */}
        {step === 5 ? (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepHeading} allowFontScaling>
                Review Your Application
              </Text>
              <Text style={styles.stepSubtext} allowFontScaling>
                Please verify all information before finalizing submission.
              </Text>
            </View>

            {/* Group 1: Document & Parish */}
            <RecordSection
              title="Document & Parish"
              fields={[
                { label: "Document Type", value: formatDocumentType(selectedDocType) },
                { label: "Target Parish", value: selectedParish?.name || "None selected" },
              ]}
            />

            <Divider />

            {/* Group 2: Applicant Information */}
            <RecordSection
              title="Applicant Details"
              fields={[
                { label: "Requester (Account)", value: `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim() || "You" },
                { label: "Record Holder Name", value: applicantName },
                { label: "Relationship", value: relationship },
                { label: "Purpose", value: purpose },
              ]}
            />

            <Divider />

            {/* Group 3: Supporting Attachments */}
            <RecordSection
              title="Supporting Attachments"
              fields={[
                { label: "Attached Files", value: `${Object.keys(selectedFiles).length} file(s) attached` },
                ...(profile?.isGovernmentIdVerified
                  ? [{ label: "Government ID", value: "Verified on Profile (Auto-satisfied)" }]
                  : []),
                ...(relationship !== "Self"
                  ? [
                      {
                        label: "Authorization Letter",
                        value: selectedFiles["authorization_letter"] ? "Attached (Ready)" : "Missing",
                      },
                      { label: "Registrant ID - Front", value: registrantIdFront ? "Selected (Ready)" : "Missing" },
                      { label: "Registrant ID - Back", value: registrantIdBack ? "Selected (Ready)" : "Missing" },
                    ]
                  : []),
              ]}
            />

            <Divider />

            {/* Dynamic Authoritative Fee */}
            <RecordSection
              title="Parish Fee"
              fields={[
                {
                  label: "Authoritative Processing Fee",
                  value: formatFee(requirements?.baseFee),
                  hint: `Official fee set by ${selectedParish?.name || "the parish"}`,
                },
              ]}
            />

            <View style={styles.legalNotice}>
              <Ionicons
                name="shield-checkmark-outline"
                size={16}
                color={colors.textSecondary}
              />
              <Text style={styles.legalNoticeText} allowFontScaling>
                By submitting this request, you attest that the information provided is true, accurate, and for lawful ecclesiastical purposes.
              </Text>
            </View>
          </View>
        ) : null}
        </Animated.View>
      </ScrollView>

      {/* Safe Bottom Action Bar on All Steps */}
      <SafeBottomActionBar onLayout={onBottomActionLayout}>
        {step === 1 ? (
          <Button
            title="Continue to Document Type"
            variant="primary"
            size="lg"
            disabled={!selectedParish}
            onPress={() => setStep(2)}
            style={styles.fullWidthAction}
          />
        ) : step === 2 ? (
          <Button
            title="Continue to Details"
            variant="primary"
            size="lg"
            disabled={!selectedDocType}
            onPress={() => setStep(3)}
            style={styles.fullWidthAction}
          />
        ) : step === 3 ? (
          <Button
            title="Continue to Attachments"
            variant="primary"
            size="lg"
            disabled={!applicantFirstName.trim() || !applicantLastName.trim() || !purpose.trim()}
            onPress={handleValidateFormAndNext}
            style={styles.fullWidthAction}
          />
        ) : step === 4 ? (
          <Button
            title="Continue to Review"
            variant="primary"
            size="lg"
            onPress={handleValidateFilesAndNext}
            style={styles.fullWidthAction}
          />
        ) : step === 5 ? (
          <Button
            title={isSubmitting ? submissionStage || "Submitting..." : "Confirm & Submit Request"}
            variant="primary"
            size="lg"
            onPress={() => {
              void handleConfirmAndSubmit();
            }}
            loading={isSubmitting}
            disabled={isSubmitting || !hasValidRequirementsFee}
            accessibilityLabel="Confirm and submit your document request"
            style={styles.fullWidthAction}
          />
        ) : null}
      </SafeBottomActionBar>

      {/* Relationship Selection Modal */}
      <Modal
        visible={isRelationshipModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsRelationshipModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setIsRelationshipModalOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close relationship selection menu"
          />
          <View
            style={[
              styles.modalSheet,
              { paddingBottom: Math.max(insets.bottom, spacing.md) + 10 },
            ]}
            accessibilityViewIsModal={true}
            accessibilityLabel="Relationship to Record Holder"
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} accessibilityRole="header" allowFontScaling>
                Relationship to Record Holder
              </Text>
              <Pressable
                onPress={() => setIsRelationshipModalOpen(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={22} color={colors.neutral[650]} />
              </Pressable>
            </View>
            <Divider />
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalOptionsList}
              bounces={false}
            >
              {RELATIONSHIP_OPTIONS.map((opt) => (
                <SelectionRow
                  key={opt}
                  title={opt}
                  selected={relationship === opt}
                  onSelect={() => handleSelectRelationship(opt)}
                  mode="radio"
                  accessibilityLabel={`Relationship: ${opt}`}
                />
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
};

const styles = StyleSheet.create({
  infoBanner: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warningBorder,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  infoTitle: {
    ...fontStyles.bodyMedium,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  infoText: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  hiddenEvidenceNote: {
    ...fontStyles.caption,
    color: colors.warning,
    marginBottom: spacing.sm,
  },
  screen: {
    padding: 0,
    backgroundColor: colors.background,
  },
  stepBar: {
    flexDirection: "row",
    height: 3,
    backgroundColor: colors.borderLight,
  },
  stepSegment: {
    flex: 1,
    height: "100%",
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
  },
  stepContainer: {
    gap: spacing.md,
  },
  stepHeader: {
    marginBottom: spacing.xs,
  },
  stepHeading: {
    ...fontStyles.titleSerif,
    color: colors.textPrimary,
    fontSize: 20,
    lineHeight: 26,
  },
  stepSubtext: {
    ...fontStyles.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  selectionList: {
    gap: spacing.xs,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  skeletonList: {
    gap: spacing.sm,
  },
  skeletonItem: {
    borderRadius: radii.md,
  },
  noReqContainer: {
    padding: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
  },
  noReqText: {
    ...fontStyles.bodySmall,
    color: colors.textSecondary,
    textAlign: "center",
  },
  reviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  reviewLabel: {
    ...fontStyles.caption,
    color: colors.textSecondary,
  },
  reviewValue: {
    ...fontStyles.captionMedium,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  feeBanner: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xxs,
  },
  feeBannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  feeBannerTitle: {
    ...fontStyles.meta,
    color: colors.textSecondary,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  feeBannerAmount: {
    ...fontStyles.titleSerif,
    color: colors.primary,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "700",
  },
  feeBannerNote: {
    ...fontStyles.caption,
    color: colors.textSecondary,
  },
  legalNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
    padding: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
  },
  legalNoticeText: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 16,
  },
  fullWidthAction: {
    width: "100%",
  },
  verifiedIdBanner: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  verifiedIdTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#065F46",
  },
  verifiedIdSubtext: {
    fontSize: 12,
    color: "#047857",
    lineHeight: 17,
  },
  dropdownTrigger: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: radii.control,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
  },
  dropdownValueText: {
    ...fontStyles.body,
    color: colors.neutral[950],
  },
  dropdownChevron: {
    marginLeft: spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    maxHeight: "80%",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  modalTitle: {
    ...fontStyles.subheading,
    fontWeight: "700",
    color: colors.neutral[950],
  },
  modalCloseBtn: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  modalScroll: {
    maxHeight: 360,
  },
  modalOptionsList: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
});

import React, { useRef, useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { Button } from "@/components/ui/Button";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import { DOCUMENT_RETURN_REASONS } from "../types";
import { useReturnDocument, type ReturnDocumentFile } from "../api";

export interface ReturnDocumentModalProps {
  visible: boolean;
  requestId: number;
  trackingNumber?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const ReturnDocumentModal: React.FC<ReturnDocumentModalProps> = ({
  visible,
  requestId,
  trackingNumber,
  onClose,
  onSuccess,
}) => {
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<ReturnDocumentFile | null>(null);
  const [showReasonPicker, setShowReasonPicker] = useState<boolean>(false);
  const submitInFlightRef = useRef(false);

  const returnMutation = useReturnDocument();

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      if (asset.size && asset.size > 5 * 1024 * 1024) {
        Alert.alert("File Too Large", "The defective document file must not exceed 5MB.");
        return;
      }

      setSelectedFile({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType,
        size: asset.size,
      });
    } catch {
      Alert.alert("File Error", "Could not select document. Please try again.");
    }
  };

  const handleSubmit = async () => {
    if (submitInFlightRef.current) return;
    if (!selectedReason) {
      Alert.alert("Missing Reason", "Please select a reason for returning the document.");
      return;
    }

    if (!selectedFile) {
      Alert.alert("Missing Upload", "Please upload a photo or scan of the defective issued document.");
      return;
    }

    submitInFlightRef.current = true;
    try {
      await returnMutation.mutateAsync({
        requestId,
        reasonCode: selectedReason,
        notes: notes.trim() || undefined,
        file: selectedFile,
      });

      Alert.alert(
        "Document Returned for Correction",
        "Your return request has been submitted. The parish office will review the defective document and prepare a free corrected copy for you."
      );

      // Reset state and notify parent
      setSelectedReason("");
      setNotes("");
      setSelectedFile(null);
      onSuccess();
      onClose();
    } catch (err: any) {
      Alert.alert("Return Failed", err?.message || "Could not submit document return. Please try again.");
    } finally {
      submitInFlightRef.current = false;
    }
  };

  const currentReasonObj = DOCUMENT_RETURN_REASONS.find((r) => r.code === selectedReason);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIconContainer}>
                <Ionicons name="return-down-back" size={20} color={colors.warning} />
              </View>
              <View style={styles.headerTextGroup}>
                <Text style={styles.headerTitle} allowFontScaling>
                  Return Document for Correction
                </Text>
                <Text style={styles.headerSubtitle} allowFontScaling>
                  {trackingNumber ? `Request: ${trackingNumber}` : "Completed Request"} • 100% Free
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              disabled={returnMutation.isPending}
              style={styles.closeBtn}
              accessibilityLabel="Close modal"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Free Policy Banner */}
            <View style={styles.infoBanner}>
              <Ionicons name="information-circle-outline" size={18} color={colors.information} style={{ marginTop: 1 }} />
              <Text style={styles.infoBannerText} allowFontScaling>
                Post-release corrections are completely free of charge. Your original request tracking number and payment records remain intact.
              </Text>
            </View>

            {/* Reason Selection */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel} allowFontScaling>
                Reason for Return <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <TouchableOpacity
                onPress={() => setShowReasonPicker(!showReasonPicker)}
                style={styles.pickerSelector}
                accessibilityRole="button"
                accessibilityLabel="Select reason for document return"
              >
                <Text
                  style={[
                    styles.pickerSelectorText,
                    !currentReasonObj && styles.pickerSelectorPlaceholder,
                  ]}
                  allowFontScaling
                >
                  {currentReasonObj ? currentReasonObj.label : "Select defect reason..."}
                </Text>
                <Ionicons
                  name={showReasonPicker ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>

              {showReasonPicker ? (
                <View style={styles.reasonsList}>
                  {DOCUMENT_RETURN_REASONS.map((reason) => {
                    const isSelected = selectedReason === reason.code;
                    return (
                      <TouchableOpacity
                        key={reason.code}
                        onPress={() => {
                          setSelectedReason(reason.code);
                          setShowReasonPicker(false);
                        }}
                        style={[
                          styles.reasonItem,
                          isSelected && styles.reasonItemSelected,
                        ]}
                        accessibilityRole="button"
                      >
                        <Text
                          style={[
                            styles.reasonItemText,
                            isSelected && styles.reasonItemTextSelected,
                          ]}
                          allowFontScaling
                        >
                          {reason.label}
                        </Text>
                        {isSelected && (
                          <Ionicons name="checkmark" size={16} color={colors.primary} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}
            </View>

            {/* Defective Document Upload */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel} allowFontScaling>
                Photo / Scan of Defective Document <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <Text style={styles.fieldHint} allowFontScaling>
                Please attach an image or PDF showing the physical error on the issued document.
              </Text>

              {selectedFile ? (
                <View style={styles.fileSelectedCard}>
                  <Ionicons
                    name={selectedFile.name.endsWith(".pdf") ? "document-text" : "image"}
                    size={22}
                    color={colors.primary}
                  />
                  <View style={styles.fileSelectedInfo}>
                    <Text style={styles.fileSelectedName} numberOfLines={1} allowFontScaling>
                      {selectedFile.name}
                    </Text>
                    <Text style={styles.fileSelectedMeta} allowFontScaling>
                      {formatFileSize(selectedFile.size)} • Ready to upload
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={handlePickDocument}
                    style={styles.fileActionBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Replace file"
                  >
                    <Ionicons name="swap-horizontal" size={18} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setSelectedFile(null)}
                    style={[styles.fileActionBtn, { borderColor: colors.dangerBorder }]}
                    accessibilityRole="button"
                    accessibilityLabel="Remove file"
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={handlePickDocument}
                  style={styles.uploadBox}
                  accessibilityRole="button"
                  accessibilityLabel="Choose photo or scan of defective document"
                >
                  <Ionicons name="cloud-upload-outline" size={24} color={colors.primary} />
                  <Text style={styles.uploadBoxTitle} allowFontScaling>
                    Choose Document File
                  </Text>
                  <Text style={styles.uploadBoxSubtitle} allowFontScaling>
                    PDF, PNG, JPG, or WebP (max 5MB)
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Optional Notes */}
            <View style={styles.fieldGroup}>
              <View style={styles.notesLabelRow}>
                <Text style={styles.fieldLabel} allowFontScaling>
                  Additional Details / Correction Note
                </Text>
                <Text style={styles.charCount} allowFontScaling>
                  {notes.length}/1000
                </Text>
              </View>
              <TextInput
                value={notes}
                onChangeText={(text) => {
                  if (text.length <= 1000) setNotes(text);
                }}
                placeholder="Explain what needs correction (e.g., spelling of surname, date of baptism, etc.)..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                style={styles.notesInput}
                maxLength={1000}
                accessibilityLabel="Additional correction notes"
              />
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <Button
              title="Cancel"
              variant="outline"
              size="md"
              onPress={onClose}
              disabled={returnMutation.isPending}
              style={{ flex: 1 }}
            />
            <Button
              title="Submit Return"
              variant="primary"
              size="md"
              icon="send-outline"
              onPress={handleSubmit}
              loading={returnMutation.isPending}
              disabled={!selectedReason || !selectedFile || returnMutation.isPending}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    maxHeight: "90%",
    minHeight: "60%",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  headerIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.warningSoft || "#FFF8E1",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextGroup: {
    flex: 1,
  },
  headerTitle: {
    ...fontStyles.titleMedium,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  infoBanner: {
    flexDirection: "row",
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    borderRadius: radii.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  infoBannerText: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  fieldGroup: {
    gap: spacing.xs,
  },
  fieldLabel: {
    ...fontStyles.bodyMedium,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  requiredAsterisk: {
    color: colors.danger,
  },
  fieldHint: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  pickerSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    minHeight: 48,
  },
  pickerSelectorText: {
    ...fontStyles.bodySmall,
    color: colors.textPrimary,
  },
  pickerSelectorPlaceholder: {
    color: colors.textMuted,
  },
  reasonsList: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.md,
    overflow: "hidden",
    marginTop: spacing.xs,
  },
  reasonItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  reasonItemSelected: {
    backgroundColor: colors.primarySoft,
  },
  reasonItemText: {
    ...fontStyles.bodySmall,
    color: colors.textPrimary,
  },
  reasonItemTextSelected: {
    color: colors.primary,
    fontWeight: "600",
  },
  uploadBox: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderStyle: "dashed",
    borderRadius: radii.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  uploadBoxTitle: {
    ...fontStyles.bodySmall,
    fontWeight: "600",
    color: colors.primary,
  },
  uploadBoxSubtitle: {
    ...fontStyles.caption,
    color: colors.textSecondary,
  },
  fileSelectedCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  fileSelectedInfo: {
    flex: 1,
  },
  fileSelectedName: {
    ...fontStyles.bodySmall,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  fileSelectedMeta: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  fileActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: "center",
    justifyContent: "center",
  },
  notesLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  charCount: {
    ...fontStyles.caption,
    color: colors.textMuted,
  },
  notesInput: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.md,
    padding: spacing.md,
    minHeight: 90,
    ...fontStyles.bodySmall,
    color: colors.textPrimary,
  },
  footer: {
    flexDirection: "row",
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    gap: spacing.sm,
  },
});

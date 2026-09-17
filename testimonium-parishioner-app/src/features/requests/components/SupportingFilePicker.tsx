import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useFeedback } from "@/providers/FeedbackProvider";
import { isAppError } from "@/services/api/errors";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import { normalizeSupportingFile } from "../supportingUpload";
import type { LocalSelectedFile, RequiredDocument } from "../types";

export interface SupportingFilePickerProps {
  requirement: RequiredDocument;
  selectedFile?: LocalSelectedFile | null;
  onFileSelected: (file: LocalSelectedFile) => void;
  onFileRemoved: (requirementId: string) => void;
  disabled?: boolean;
}

export const SupportingFilePicker: React.FC<SupportingFilePickerProps> = ({
  requirement,
  selectedFile,
  onFileSelected,
  onFileRemoved,
  disabled = false,
}) => {
  const feedback = useFeedback();

  const handlePickDocument = async () => {
    if (disabled) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      onFileSelected(
        normalizeSupportingFile({
          requirementId: requirement.id,
          requirementLabel: requirement.label,
          name: asset.name,
          uri: asset.uri,
          size: asset.size,
          mimeType: asset.mimeType,
        })
      );
    } catch (error) {
      if (isAppError(error)) {
        feedback.showError("Invalid File", error.message);
        return;
      }
      feedback.showError(
        "File Selection Error",
        "Could not access the document picker. Please try again."
      );
    }
  };

  const formatBytes = (bytes?: number): string => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getFileIcon = (mimeOrName?: string) => {
    if (mimeOrName?.includes("pdf")) return "document-text";
    return "image";
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.labelGroup}>
          <Text style={styles.requirementTitle} allowFontScaling>
            {requirement.label}
          </Text>
          {requirement.description ? (
            <Text style={styles.requirementDesc} allowFontScaling>
              {requirement.description}
            </Text>
          ) : null}
        </View>

        <View
          style={[
            styles.badge,
            requirement.required ? styles.badgeRequired : styles.badgeOptional,
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              requirement.required ? styles.badgeTextRequired : styles.badgeTextOptional,
            ]}
            allowFontScaling
          >
            {requirement.required ? "Required" : "Optional"}
          </Text>
        </View>
      </View>

      {selectedFile ? (
        <View style={styles.selectedCard}>
          <Ionicons
            name={getFileIcon(selectedFile.mimeType || selectedFile.name)}
            size={22}
            color={colors.primary}
            style={styles.fileIcon}
          />

          <View style={styles.fileInfo}>
            <Text style={styles.fileName} numberOfLines={1} allowFontScaling>
              {selectedFile.name}
            </Text>
            <View style={styles.fileMetaRow}>
              {Boolean(selectedFile.size) && (
                <Text style={styles.fileMeta} allowFontScaling>
                  {formatBytes(selectedFile.size)} •{" "}
                </Text>
              )}
              <Text style={styles.readyBadge} allowFontScaling>
                Ready to attach
              </Text>
            </View>
          </View>

          {!disabled ? (
            <View style={styles.actions}>
              <TouchableOpacity
                onPress={handlePickDocument}
                style={styles.actionBtn}
                accessibilityRole="button"
                accessibilityLabel={`Replace ${requirement.label} document`}
                hitSlop={8}
              >
                <Ionicons name="swap-horizontal" size={18} color={colors.primary} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => onFileRemoved(requirement.id)}
                style={[styles.actionBtn, styles.removeBtn]}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${selectedFile.name} for ${requirement.label}`}
                hitSlop={8}
              >
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      ) : (
        <TouchableOpacity
          onPress={handlePickDocument}
          disabled={disabled}
          style={[styles.uploadCard, disabled && styles.uploadCardDisabled]}
          accessibilityRole="button"
          accessibilityLabel={`Attach document for ${requirement.label}. Accepts PDF, PNG, JPEG, WebP up to 5 megabytes.`}
          activeOpacity={0.7}
        >
          <Ionicons
            name="cloud-upload-outline"
            size={20}
            color={disabled ? colors.textMuted : colors.primary}
          />
          <View style={styles.uploadTextGroup}>
            <Text
              style={[styles.uploadTitle, disabled && styles.uploadTitleDisabled]}
              allowFontScaling
            >
              Choose Document
            </Text>
            <Text style={styles.uploadHint} allowFontScaling>
              PDF, PNG, JPG, or WebP (max 5MB)
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={disabled ? colors.borderLight : colors.textSecondary}
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  labelGroup: {
    flex: 1,
  },
  requirementTitle: {
    ...fontStyles.bodyMedium,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  requirementDesc: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  badge: {
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: radii.xs,
  },
  badgeRequired: {
    backgroundColor: colors.primarySoft,
  },
  badgeOptional: {
    backgroundColor: colors.surfaceMuted,
  },
  badgeText: {
    ...fontStyles.meta,
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 0.5,
  },
  badgeTextRequired: {
    color: colors.primary,
  },
  badgeTextOptional: {
    color: colors.textSecondary,
  },
  uploadCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    minHeight: 52,
    gap: spacing.sm,
  },
  uploadCardDisabled: {
    opacity: 0.6,
  },
  uploadTextGroup: {
    flex: 1,
  },
  uploadTitle: {
    ...fontStyles.captionMedium,
    color: colors.primary,
    fontWeight: "600",
  },
  uploadTitleDisabled: {
    color: colors.textMuted,
  },
  uploadHint: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 1,
  },
  selectedCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    minHeight: 52,
    gap: spacing.sm,
  },
  fileIcon: {
    marginTop: 1,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    ...fontStyles.bodySmall,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  fileMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  fileMeta: {
    ...fontStyles.caption,
    color: colors.textSecondary,
  },
  readyBadge: {
    ...fontStyles.captionMedium,
    color: colors.success,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  removeBtn: {
    borderColor: colors.dangerBorder,
  },
});

import React from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { Badge } from "@/components/ui/Badge";
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
        Alert.alert("Invalid File", error.message);
        return;
      }
      Alert.alert(
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

        <Badge
          label={requirement.required ? "Required" : "Optional"}
          variant={requirement.required ? "primary" : "neutral"}
          size="sm"
        />
      </View>

      {selectedFile ? (
        <View style={styles.selectedFileCard}>
          <View style={styles.fileIconBox}>
            <Ionicons
              name={getFileIcon(selectedFile.mimeType || selectedFile.name)}
              size={24}
              color={colors.primary}
            />
          </View>

          <View style={styles.fileDetails}>
            <Text style={styles.fileName} numberOfLines={1} allowFontScaling>
              {selectedFile.name}
            </Text>
            <Text style={styles.fileMeta} allowFontScaling>
              {formatBytes(selectedFile.size)} • Ready to attach
            </Text>
          </View>

          {!disabled ? (
            <View style={styles.fileActions}>
              <TouchableOpacity
                onPress={handlePickDocument}
                style={styles.replaceBtn}
                accessibilityRole="button"
                accessibilityLabel={`Replace ${requirement.label} document`}
              >
                <Ionicons name="swap-horizontal" size={18} color={colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => onFileRemoved(requirement.id)}
                style={styles.removeBtn}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${selectedFile.name} for ${requirement.label}`}
              >
                <Ionicons name="close-circle" size={20} color={colors.danger} />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      ) : (
        <TouchableOpacity
          onPress={handlePickDocument}
          disabled={disabled}
          style={[styles.pickerButton, disabled && styles.pickerDisabled]}
          accessibilityRole="button"
          accessibilityLabel={`Attach document for ${requirement.label}. Accepts PDF, PNG, JPEG, WebP up to 5 megabytes.`}
        >
          <Ionicons
            name="cloud-upload-outline"
            size={20}
            color={disabled ? colors.textMuted : colors.primary}
            style={styles.uploadIcon}
          />
          <Text
            style={[styles.pickerText, disabled && styles.pickerTextDisabled]}
            allowFontScaling
          >
            Choose Document (PDF, PNG, JPG, max 5MB)
          </Text>
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
    borderColor: colors.cardBorder,
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
  },
  pickerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.primary,
    borderRadius: radii.sm,
    backgroundColor: colors.primarySoft,
    minHeight: 44,
  },
  pickerDisabled: {
    borderColor: colors.borderLight,
    backgroundColor: colors.surfaceVariant,
  },
  uploadIcon: {
    marginRight: spacing.xs,
  },
  pickerText: {
    ...fontStyles.button,
    color: colors.primary,
  },
  pickerTextDisabled: {
    color: colors.textMuted,
  },
  selectedFileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceVariant,
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    minHeight: 44,
  },
  fileIconBox: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    ...fontStyles.bodySmall,
    color: colors.textPrimary,
    fontWeight: "500",
  },
  fileMeta: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  fileActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  replaceBtn: {
    padding: spacing.xs,
    minWidth: 32,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  removeBtn: {
    padding: spacing.xs,
    minWidth: 32,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
  },
});

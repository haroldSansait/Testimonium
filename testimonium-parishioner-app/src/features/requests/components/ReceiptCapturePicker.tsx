import React from "react";
import {
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import type { LocalSelectedReceipt } from "../types";

export interface ReceiptCapturePickerProps {
  receipt?: LocalSelectedReceipt | null;
  onReceiptSelected: (receipt: LocalSelectedReceipt) => void;
  onReceiptRemoved: () => void;
  disabled?: boolean;
}

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024; // 5 MB

export const ReceiptCapturePicker: React.FC<ReceiptCapturePickerProps> = ({
  receipt,
  onReceiptSelected,
  onReceiptRemoved,
  disabled = false,
}) => {
  const validateAndProcessAsset = (asset: ImagePicker.ImagePickerAsset) => {
    const size = asset.fileSize ?? 0;
    const uri = asset.uri;
    const fileName = asset.fileName || "receipt.jpg";
    const mimeType = (asset.mimeType || "").toLowerCase();
    const ext = fileName.split(".").pop()?.toLowerCase() || "";

    // Reject HEIC/HEIF
    if (
      mimeType.includes("heic") ||
      mimeType.includes("heif") ||
      ext === "heic" ||
      ext === "heif"
    ) {
      Alert.alert(
        "Unsupported Image Format",
        "HEIC/HEIF images (iPhone format) are not supported for OCR payment verification. Please convert or take a photo in JPEG or PNG format."
      );
      return;
    }

    // Reject PDF or other non-image
    if (ext === "pdf" || mimeType.includes("pdf")) {
      Alert.alert(
        "PDF Not Supported for Receipts",
        "Payment receipts must be JPEG or PNG image files. PDF receipts are not accepted."
      );
      return;
    }

    // Reject WebP or unknown formats
    if (ext === "webp" || mimeType.includes("webp")) {
      Alert.alert(
        "Unsupported Image Format",
        "Please select a standard JPEG or PNG receipt image."
      );
      return;
    }

    // Size limit 5 MB
    if (size > MAX_RECEIPT_BYTES) {
      Alert.alert(
        "Receipt Too Large",
        `Receipt image exceeds the 5 MB limit (${(size / (1024 * 1024)).toFixed(1)} MB). Please choose a smaller image.`
      );
      return;
    }

    const determinedMime: "image/jpeg" | "image/png" =
      mimeType.includes("png") || ext === "png" ? "image/png" : "image/jpeg";

    onReceiptSelected({
      uri,
      name: fileName,
      size,
      mimeType: determinedMime,
    });
  };

  const handlePickFromGallery = async () => {
    if (disabled) return;

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permission Required",
          "Photo library access is needed to select your payment receipt."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 1, // Preserve full legibility for OCR
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      validateAndProcessAsset(result.assets[0]);
    } catch {
      Alert.alert("Gallery Error", "Could not open photo gallery. Please try again.");
    }
  };

  const handleTakePhoto = async () => {
    if (disabled) return;

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permission Required",
          "Camera access is needed to take a photo of your receipt."
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 1, // Preserve legibility
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      validateAndProcessAsset(result.assets[0]);
    } catch {
      Alert.alert("Camera Error", "Could not open camera. Please try again.");
    }
  };

  const formatBytes = (bytes?: number): string => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title} allowFontScaling>
        Proof of Payment (Official Receipt)
      </Text>
      <Text style={styles.subtitle} allowFontScaling>
        Attach your GCash, Maya, or bank transfer confirmation screenshot (JPEG or PNG, max 5 MB).
      </Text>

      {receipt ? (
        <View style={styles.previewContainer}>
          <Image
            source={{ uri: receipt.uri }}
            style={styles.previewImage}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel="Selected receipt preview image"
          />

          <View style={styles.previewMeta}>
            <View style={styles.metaTextGroup}>
              <Text style={styles.receiptName} numberOfLines={1} allowFontScaling>
                {receipt.name}
              </Text>
              <Text style={styles.receiptSize} allowFontScaling>
                {formatBytes(receipt.size)} • {receipt.mimeType.toUpperCase()}
              </Text>
            </View>

            {!disabled ? (
              <View style={styles.previewButtons}>
                <TouchableOpacity
                  onPress={handlePickFromGallery}
                  style={styles.actionBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Replace receipt image from gallery"
                >
                  <Ionicons name="images-outline" size={18} color={colors.primary} />
                  <Text style={styles.actionBtnText} allowFontScaling>
                    Replace
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={onReceiptRemoved}
                  style={[styles.actionBtn, styles.removeBtn]}
                  accessibilityRole="button"
                  accessibilityLabel="Remove selected receipt"
                >
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  <Text style={[styles.actionBtnText, { color: colors.danger }]} allowFontScaling>
                    Remove
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>
      ) : (
        <View style={styles.buttonRow}>
          <TouchableOpacity
            onPress={handlePickFromGallery}
            disabled={disabled}
            style={[styles.inputButton, disabled && styles.inputButtonDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Choose receipt from photo gallery"
          >
            <Ionicons
              name="images-outline"
              size={22}
              color={disabled ? colors.textMuted : colors.primary}
            />
            <Text
              style={[styles.inputButtonText, disabled && styles.inputButtonTextDisabled]}
              allowFontScaling
            >
              Choose from Gallery
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleTakePhoto}
            disabled={disabled}
            style={[styles.inputButton, disabled && styles.inputButtonDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Take a photo of receipt using camera"
          >
            <Ionicons
              name="camera-outline"
              size={22}
              color={disabled ? colors.textMuted : colors.primary}
            />
            <Text
              style={[styles.inputButtonText, disabled && styles.inputButtonTextDisabled]}
              allowFontScaling
            >
              Take Photo
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: spacing.md,
  },
  title: {
    ...fontStyles.subheading,
    color: colors.textPrimary,
  },
  subtitle: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  buttonRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  inputButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.sm,
    backgroundColor: colors.primarySoft,
    minHeight: 48,
    gap: 6,
  },
  inputButtonDisabled: {
    borderColor: colors.borderLight,
    backgroundColor: colors.surfaceVariant,
  },
  inputButtonText: {
    ...fontStyles.button,
    color: colors.primary,
    fontSize: 13,
  },
  inputButtonTextDisabled: {
    color: colors.textMuted,
  },
  previewContainer: {
    borderRadius: radii.sm,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surfaceVariant,
  },
  previewImage: {
    width: "100%",
    height: 200,
    backgroundColor: colors.overlay,
  },
  previewMeta: {
    padding: spacing.sm,
    backgroundColor: colors.surface,
  },
  metaTextGroup: {
    marginBottom: spacing.xs,
  },
  receiptName: {
    ...fontStyles.bodyMedium,
    color: colors.textPrimary,
  },
  receiptSize: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  previewButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: 4,
    minHeight: 36,
  },
  removeBtn: {
    borderColor: colors.danger,
  },
  actionBtnText: {
    ...fontStyles.captionMedium,
    color: colors.primary,
  },
});

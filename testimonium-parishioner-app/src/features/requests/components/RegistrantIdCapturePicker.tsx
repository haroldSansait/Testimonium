import React from "react";
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import type { LocalRegistrantIdImage } from "../types";

const MAX_BYTES = 5 * 1024 * 1024;

interface Props {
  side: "front" | "back";
  image?: LocalRegistrantIdImage | null;
  onSelected: (image: LocalRegistrantIdImage) => void;
  onRemoved: () => void;
  disabled?: boolean;
}

export const RegistrantIdCapturePicker: React.FC<Props> = ({ side, image, onSelected, onRemoved, disabled = false }) => {
  const validate = (asset: ImagePicker.ImagePickerAsset) => {
    const name = asset.fileName || `registrant-id-${side}.jpg`;
    const mime = String(asset.mimeType || "").toLowerCase();
    const ext = name.split(".").pop()?.toLowerCase();
    const isPng = mime === "image/png" || ext === "png";
    const isJpeg = ["image/jpeg", "image/jpg"].includes(mime) || ["jpg", "jpeg"].includes(ext || "");
    if (!isPng && !isJpeg) {
      Alert.alert("Unsupported Image", "Registrant ID images must be JPEG or PNG.");
      return;
    }
    if (asset.fileSize !== undefined && (asset.fileSize <= 0 || asset.fileSize > MAX_BYTES)) {
      Alert.alert("Image Size", "Registrant ID images must be non-empty and no larger than 5 MB.");
      return;
    }
    onSelected({ uri: asset.uri, name, size: asset.fileSize, mimeType: isPng ? "image/png" : "image/jpeg" });
  };

  const pick = async (camera: boolean) => {
    if (disabled) return;
    const permission = camera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission Required", `${camera ? "Camera" : "Photo library"} access is required to select this image.`);
      return;
    }
    const result = camera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.85, allowsEditing: false })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9, allowsEditing: false });
    if (!result.canceled && result.assets?.[0]) validate(result.assets[0]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Registrant Government ID - {side === "front" ? "Front" : "Back"} *</Text>
      <Text style={styles.hint}>Clear JPEG or PNG, maximum 5 MB. This is selected evidence, not verified identity.</Text>
      {image ? (
        <View style={styles.previewCard}>
          <Image source={{ uri: image.uri }} style={styles.preview} resizeMode="contain" accessibilityLabel={`Selected registrant ID ${side}`} />
          <Text style={styles.fileName} numberOfLines={1}>{image.name}</Text>
          <View style={styles.row}>
            <TouchableOpacity style={styles.button} onPress={() => void pick(false)} disabled={disabled}><Ionicons name="images-outline" size={17} color={colors.primary} /><Text style={styles.buttonText}>Replace</Text></TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={onRemoved} disabled={disabled}><Ionicons name="trash-outline" size={17} color={colors.danger} /><Text style={[styles.buttonText, { color: colors.danger }]}>Remove</Text></TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.row}>
          <TouchableOpacity style={styles.button} onPress={() => void pick(false)} disabled={disabled}><Ionicons name="images-outline" size={18} color={colors.primary} /><Text style={styles.buttonText}>Gallery</Text></TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={() => void pick(true)} disabled={disabled}><Ionicons name="camera-outline" size={18} color={colors.primary} /><Text style={styles.buttonText}>Camera</Text></TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.borderLight },
  title: { ...fontStyles.bodyMedium, color: colors.textPrimary, fontWeight: "700" },
  hint: { ...fontStyles.caption, color: colors.textSecondary, marginTop: 3, marginBottom: spacing.sm },
  previewCard: { gap: spacing.sm },
  preview: { width: "100%", height: 170, backgroundColor: colors.surfaceVariant, borderRadius: radii.sm },
  fileName: { ...fontStyles.captionMedium, color: colors.textPrimary },
  row: { flexDirection: "row", gap: spacing.sm },
  button: { flex: 1, minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: colors.borderLight, borderRadius: radii.sm, backgroundColor: colors.surfaceMuted },
  buttonText: { ...fontStyles.captionMedium, color: colors.textPrimary, fontWeight: "600" },
});

import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "@/components/Typography";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import {
  downloadSecureFileToCache,
  openLocalFileExternally,
  saveCachedFileToDevice,
  type DownloadedSecureFile,
} from "@/services/files/secureFiles";

export interface SecureFileViewerModalProps {
  visible: boolean;
  file?: DownloadedSecureFile | null;
  endpointPath?: string | null;
  fileName?: string;
  mimeType?: string | null;
  title?: string;
  loading?: boolean;
  saving?: boolean;
  error?: string | null;
  onClose: () => void;
  onSaveToDevice?: () => void;
  onOpenExternal?: () => void;
}

export const SecureFileViewerModal: React.FC<SecureFileViewerModalProps> = ({
  visible,
  file,
  endpointPath = null,
  fileName = "",
  mimeType = null,
  title,
  loading = false,
  saving = false,
  error = null,
  onClose,
  onSaveToDevice,
  onOpenExternal,
}) => {
  const insets = useSafeAreaInsets();
  const [downloadState, setDownloadState] = useState<{
    key: string;
    file?: DownloadedSecureFile;
    error?: string;
  } | null>(null);
  const [internalSaving, setInternalSaving] = useState(false);

  const requestKey =
    visible && endpointPath && !file ? `${endpointPath}||${fileName || "document"}` : null;

  useEffect(() => {
    if (!visible || !endpointPath || file || !requestKey) {
      return;
    }

    let cancelled = false;

    void downloadSecureFileToCache({
      path: endpointPath,
      fileName: fileName || "document",
      mimeType,
    })
      .then((result) => {
        if (!cancelled) {
          setDownloadState({ key: requestKey, file: result });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setDownloadState({
            key: requestKey,
            error:
              err instanceof Error
                ? err.message
                : "Unable to load this private document. Please try again.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [visible, endpointPath, fileName, mimeType, file, requestKey]);

  const activeDownload = requestKey && downloadState?.key === requestKey ? downloadState : null;
  const effectiveFile = file ?? (visible ? activeDownload?.file ?? null : null);
  const effectiveLoading = loading || Boolean(requestKey && !activeDownload);
  const effectiveSaving = saving || internalSaving;
  const effectiveError = error ?? activeDownload?.error ?? null;
  const headerTitle = effectiveFile?.fileName || title || fileName || "Document Preview";

  const handleOpenExternal =
    onOpenExternal ??
    (effectiveFile
      ? () => {
          void openLocalFileExternally(effectiveFile.uri).then((opened) => {
            if (!opened) {
              Alert.alert(
                "No Viewer Available",
                "Could not find an installed app to open this file directly. Use Save to Device instead."
              );
            }
          });
        }
      : undefined);

  const handleSaveToDevice =
    onSaveToDevice ??
    (effectiveFile
      ? () => {
          setInternalSaving(true);
          void saveCachedFileToDevice(effectiveFile)
            .then((res) => {
              if (res.saved) {
                Alert.alert(
                  "Saved",
                  `${res.savedFileName || effectiveFile.fileName} was saved to your selected folder.`
                );
              }
            })
            .catch((err: unknown) => {
              Alert.alert(
                "Save Failed",
                err instanceof Error ? err.message : "Unable to save this document."
              );
            })
            .finally(() => {
              setInternalSaving(false);
            });
        }
      : undefined);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.container,
          { paddingTop: Math.max(insets.top, spacing.md), paddingBottom: Math.max(insets.bottom, spacing.md) },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.titleWrap}>
            <Text style={styles.title} numberOfLines={1} allowFontScaling>
              {headerTitle}
            </Text>
            <Text style={styles.subtitle} allowFontScaling>
              {title && title !== headerTitle ? title : "Private Authenticated File"}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Close file preview"
          >
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          {effectiveLoading ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.stateText} allowFontScaling>
                Downloading private file securely…
              </Text>
            </View>
          ) : effectiveError ? (
            <View style={styles.centerState}>
              <Ionicons name="alert-circle-outline" size={44} color={colors.danger} />
              <Text style={styles.errorText} allowFontScaling>
                {effectiveError}
              </Text>
            </View>
          ) : effectiveFile?.isImage ? (
            <Image
              source={{ uri: effectiveFile.uri }}
              style={styles.previewImage}
              resizeMode="contain"
              accessibilityLabel={`Preview of ${effectiveFile.fileName}`}
            />
          ) : effectiveFile ? (
            <View style={styles.centerState}>
              <Ionicons name="document-text-outline" size={56} color={colors.primary} />
              <Text style={styles.docTitle} allowFontScaling>
                {effectiveFile.fileName}
              </Text>
              <Text style={styles.stateText} allowFontScaling>
                This file has been downloaded securely to your temporary app cache. Use Open With or Save to Device to view it in your PDF or document app.
              </Text>
            </View>
          ) : null}
        </View>

        {effectiveFile && !effectiveLoading && !effectiveError ? (
          <View style={styles.footer}>
            {handleOpenExternal ? (
              <Button
                title="Open With App"
                variant="outline"
                size="md"
                icon="open-outline"
                onPress={handleOpenExternal}
                style={styles.footerBtn}
              />
            ) : null}
            {handleSaveToDevice ? (
              <Button
                title="Save to Device"
                variant="primary"
                size="md"
                icon="download-outline"
                loading={effectiveSaving}
                disabled={effectiveSaving}
                onPress={handleSaveToDevice}
                style={styles.footerBtn}
              />
            ) : null}
          </View>
        ) : null}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  titleWrap: {
    flex: 1,
    marginRight: spacing.sm,
  },
  title: {
    ...fontStyles.bodyMedium,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  subtitle: {
    ...fontStyles.caption,
    color: colors.textSecondary,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
  },
  body: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.md,
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  centerState: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  docTitle: {
    ...fontStyles.heading,
    color: colors.textPrimary,
    textAlign: "center",
  },
  stateText: {
    ...fontStyles.bodySmall,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  errorText: {
    ...fontStyles.bodySmall,
    color: colors.danger,
    textAlign: "center",
    lineHeight: 20,
  },
  footer: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  footerBtn: {
    flex: 1,
  },
});

import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "@/components/Typography";
import { Ionicons } from "@expo/vector-icons";
import { Button, TextInput } from "@/components/ui";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import type { UpdateProfilePayload } from "@/types/auth";

export function normalizeLegalNameForComparison(text?: string | null): string {
  if (!text || typeof text !== "string") return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function constructCanonicalFullName(parts: {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  suffix?: string | null;
}): string {
  const clean = (val?: string | null) =>
    val ? String(val).trim().replace(/\s+/g, " ") : "";
  return [
    clean(parts.firstName),
    clean(parts.middleName),
    clean(parts.lastName),
    clean(parts.suffix),
  ]
    .filter(Boolean)
    .join(" ");
}

export function doesConfirmedNameMatchDisplayed(
  displayedFullName: string | null | undefined,
  parts: {
    firstName?: string | null;
    middleName?: string | null;
    lastName?: string | null;
    suffix?: string | null;
  }
): boolean {
  const normalizedDisplayed = normalizeLegalNameForComparison(displayedFullName);
  const normalizedReconstructed = normalizeLegalNameForComparison(
    constructCanonicalFullName(parts)
  );
  return Boolean(normalizedDisplayed && normalizedDisplayed === normalizedReconstructed);
}

interface StructuredLegalNameEditorProps {
  initialFirstName?: string | null;
  initialMiddleName?: string | null;
  initialLastName?: string | null;
  initialSuffix?: string | null;
  isUpdating: boolean;
  onSave: (payload: UpdateProfilePayload) => Promise<void>;
  onCancel: () => void;
}

export const StructuredLegalNameEditor: React.FC<
  StructuredLegalNameEditorProps
> = ({
  initialFirstName,
  initialMiddleName,
  initialLastName,
  initialSuffix,
  isUpdating,
  onSave,
  onCancel,
}) => {
  const [firstName, setFirstName] = useState(initialFirstName || "");
  const [middleName, setMiddleName] = useState(initialMiddleName || "");
  const [lastName, setLastName] = useState(initialLastName || "");
  const [suffix, setSuffix] = useState(initialSuffix || "");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSave = async () => {
    if (isUpdating) return;

    const cleanFirst = firstName.trim().replace(/\s+/g, " ");
    const cleanMiddle = middleName.trim().replace(/\s+/g, " ");
    const cleanLast = lastName.trim().replace(/\s+/g, " ");
    const cleanSuffix = suffix.trim().replace(/\s+/g, " ");

    if (!cleanFirst || !cleanLast) {
      setErrorMessage("First Name and Last Name are required.");
      return;
    }

    setErrorMessage(null);
    try {
      await onSave({
        firstName: cleanFirst,
        middleName: cleanMiddle || "",
        lastName: cleanLast,
        suffix: cleanSuffix || "",
      });
    } catch (err: any) {
      setErrorMessage(
        err?.message || "Failed to update your legal name. Please try again."
      );
    }
  };

  return (
    <View style={styles.editorCard}>
      <Text style={styles.editorTitle} allowFontScaling>
        Change Full Name
      </Text>
      <Text style={styles.inputsHint} allowFontScaling>
        Enter your legal name components as shown on your Government ID.
      </Text>

      <TextInput
        label="First Name *"
        value={firstName}
        onChangeText={(text) => {
          setFirstName(text);
          setErrorMessage(null);
        }}
        placeholder="e.g. Juan"
        autoCapitalize="words"
        editable={!isUpdating}
      />
      <TextInput
        label="Middle Name (Optional)"
        value={middleName}
        onChangeText={(text) => {
          setMiddleName(text);
          setErrorMessage(null);
        }}
        placeholder="e.g. Santos"
        autoCapitalize="words"
        editable={!isUpdating}
      />
      <TextInput
        label="Last Name *"
        value={lastName}
        onChangeText={(text) => {
          setLastName(text);
          setErrorMessage(null);
        }}
        placeholder="e.g. Dela Cruz"
        autoCapitalize="words"
        editable={!isUpdating}
      />
      <TextInput
        label="Suffix (Optional)"
        value={suffix}
        onChangeText={(text) => {
          setSuffix(text);
          setErrorMessage(null);
        }}
        placeholder="e.g. Jr., III"
        autoCapitalize="words"
        editable={!isUpdating}
      />

      {errorMessage && (
        <Text style={styles.errorText} accessibilityRole="alert" allowFontScaling>
          {errorMessage}
        </Text>
      )}

      <View style={styles.editorActionRow}>
        <Button
          title="Cancel"
          variant="outline"
          size="sm"
          disabled={isUpdating}
          onPress={onCancel}
          style={styles.editorActionBtn}
        />
        <Button
          title="Save Full Name"
          variant="primary"
          size="sm"
          loading={isUpdating}
          disabled={isUpdating}
          onPress={() => void handleSave()}
          style={styles.editorActionBtn}
        />
      </View>
    </View>
  );
};

interface GoogleLegalNameConfirmationCardProps {
  displayedFullName?: string | null;
  isUpdating: boolean;
  onSaveLegalName: (payload: UpdateProfilePayload) => Promise<void>;
}

export const GoogleLegalNameConfirmationCard: React.FC<
  GoogleLegalNameConfirmationCardProps
> = ({ displayedFullName, isUpdating, onSaveLegalName }) => {
  const [choice, setChoice] = useState<"confirm" | "correct" | null>(null);
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [suffix, setSuffix] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSave = async () => {
    if (isUpdating || !choice) return;

    const cleanFirst = firstName.trim().replace(/\s+/g, " ");
    const cleanMiddle = middleName.trim().replace(/\s+/g, " ");
    const cleanLast = lastName.trim().replace(/\s+/g, " ");
    const cleanSuffix = suffix.trim().replace(/\s+/g, " ");

    if (!cleanFirst || !cleanLast) {
      setErrorMessage("First Name and Last Name are required.");
      return;
    }

    if (
      choice === "confirm" &&
      !doesConfirmedNameMatchDisplayed(displayedFullName, {
        firstName: cleanFirst,
        middleName: cleanMiddle,
        lastName: cleanLast,
        suffix: cleanSuffix,
      })
    ) {
      setErrorMessage(
        'The entered name components do not match your displayed full name. Please verify your entries or choose "No, I need to correct my name".'
      );
      return;
    }

    setErrorMessage(null);
    try {
      await onSaveLegalName({
        firstName: cleanFirst,
        middleName: cleanMiddle || "",
        lastName: cleanLast,
        suffix: cleanSuffix || "",
        legalNameConfirmationAction: choice,
      });
    } catch (err: any) {
      setErrorMessage(
        err?.message || "Failed to save your legal name. Please try again."
      );
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons name="information-circle" size={20} color="#B45309" />
        <Text style={styles.headerTitle} allowFontScaling>
          Confirm Your Legal Name
        </Text>
      </View>

      <View style={styles.namePreviewBox}>
        <Text style={styles.namePreviewLabel} allowFontScaling>
          Current Google Profile Name
        </Text>
        <Text style={styles.namePreviewValue} allowFontScaling>
          {displayedFullName?.trim() || "No name provided by Google"}
        </Text>
      </View>

      <Text style={styles.questionText} allowFontScaling>
        Is this your actual full legal name as shown on your Government ID?
      </Text>

      <View style={styles.choiceRow}>
        <Button
          title="Yes, this is my legal name"
          variant={choice === "confirm" ? "primary" : "outline"}
          size="sm"
          disabled={isUpdating}
          onPress={() => {
            setChoice("confirm");
            setErrorMessage(null);
          }}
        />
        <Button
          title="No, I need to correct my name"
          variant={choice === "correct" ? "primary" : "outline"}
          size="sm"
          disabled={isUpdating}
          onPress={() => {
            setChoice("correct");
            setErrorMessage(null);
          }}
        />
      </View>

      {choice && (
        <View style={styles.inputsWrap}>
          <Text style={styles.inputsHint} allowFontScaling>
            {choice === "confirm"
              ? "Enter your exact First, Middle (if any), Last Name, and Suffix (if any) matching your displayed full name."
              : "Enter your actual legal name exactly as it appears on your Government ID."}
          </Text>

          <TextInput
            label="First Name *"
            value={firstName}
            onChangeText={(text) => {
              setFirstName(text);
              setErrorMessage(null);
            }}
            placeholder="e.g. Juan"
            autoCapitalize="words"
            editable={!isUpdating}
          />
          <TextInput
            label="Middle Name (Optional)"
            value={middleName}
            onChangeText={(text) => {
              setMiddleName(text);
              setErrorMessage(null);
            }}
            placeholder="e.g. Santos"
            autoCapitalize="words"
            editable={!isUpdating}
          />
          <TextInput
            label="Last Name *"
            value={lastName}
            onChangeText={(text) => {
              setLastName(text);
              setErrorMessage(null);
            }}
            placeholder="e.g. Dela Cruz"
            autoCapitalize="words"
            editable={!isUpdating}
          />
          <TextInput
            label="Suffix (Optional)"
            value={suffix}
            onChangeText={(text) => {
              setSuffix(text);
              setErrorMessage(null);
            }}
            placeholder="e.g. Jr., III"
            autoCapitalize="words"
            editable={!isUpdating}
          />

          {errorMessage && (
            <Text style={styles.errorText} accessibilityRole="alert" allowFontScaling>
              {errorMessage}
            </Text>
          )}

          <Button
            title={
              choice === "confirm"
                ? "Confirm Legal Name"
                : "Save Corrected Legal Name"
            }
            variant="primary"
            size="md"
            loading={isUpdating}
            disabled={isUpdating}
            onPress={() => void handleSave()}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFBEB",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "#FCD34D",
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  headerTitle: {
    ...fontStyles.subheading,
    fontWeight: "700",
    color: "#78350F",
  },
  namePreviewBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: "#FDE68A",
    padding: spacing.sm,
  },
  namePreviewLabel: {
    ...fontStyles.caption,
    fontSize: 11,
    fontWeight: "600",
    color: colors.textMuted,
    textTransform: "uppercase",
  },
  namePreviewValue: {
    ...fontStyles.body,
    fontWeight: "700",
    color: colors.textPrimary,
    marginTop: 2,
  },
  questionText: {
    ...fontStyles.bodySmall,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  choiceRow: {
    gap: spacing.xs,
  },
  inputsWrap: {
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "#FDE68A",
    gap: spacing.sm,
  },
  inputsHint: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  errorText: {
    ...fontStyles.caption,
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    padding: spacing.sm,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  editorCard: {
    backgroundColor: colors.background,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  editorTitle: {
    ...fontStyles.subheading,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  editorActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  editorActionBtn: {
    flex: 1,
  },
});

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import type { CaloyClarificationOption, CaloyMessage } from "../types";
import { CaloyClarification } from "./CaloyClarification";
import { CaloyLiveBadge } from "./CaloyLiveBadge";
import { CaloyMarkdown } from "./CaloyMarkdown";
import { CaloyVerifiedSources } from "./CaloyVerifiedSources";

interface CaloyMessageBubbleProps {
  message: CaloyMessage;
  onSelectClarificationOption?: (option: CaloyClarificationOption) => void;
  onRevealComplete?: (messageId: string) => void;
  isInputDisabled?: boolean;
}

export const CaloyMessageBubble: React.FC<CaloyMessageBubbleProps> = ({
  message,
  onSelectClarificationOption,
  onRevealComplete,
  isInputDisabled = false,
}) => {
  const isUser = message.sender === "user";
  const [reduceMotion, setReduceMotion] = useState(false);
  const [revealedCharCount, setRevealedCharCount] = useState<number>(
    message.isRevealing ? 0 : message.text.length
  );
  const [isDoneRevealing, setIsDoneRevealing] = useState<boolean>(!message.isRevealing);

  // Check reduced motion accessibility setting
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (enabled) {
          setReduceMotion(true);
          onRevealComplete?.(message.id);
        }
      })
      .catch(() => {});

    const sub = AccessibilityInfo.addEventListener?.("reduceMotionChanged", (enabled) => {
      setReduceMotion(enabled);
    });

    return () => {
      sub?.remove?.();
    };
  }, [message.id, onRevealComplete]);

  // Progressive reveal animation
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!message.isRevealing || reduceMotion || isDoneRevealing) {
      return;
    }

    const fullLength = message.text.length;
    // Reveal in increments of 3 characters every 18ms (~60fps)
    const step = Math.max(2, Math.floor(fullLength / 40));
    intervalRef.current = setInterval(() => {
      setRevealedCharCount((prev) => {
        const next = prev + step;
        if (next >= fullLength) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setIsDoneRevealing(true);
          onRevealComplete?.(message.id);
          return fullLength;
        }
        return next;
      });
    }, 18);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [message.id, message.isRevealing, message.text.length, onRevealComplete, reduceMotion, isDoneRevealing]);

  const isFinished = !message.isRevealing || reduceMotion || isDoneRevealing;

  const displayedText = useMemo(() => {
    if (isUser || isFinished) {
      return message.text;
    }
    return message.text.slice(0, revealedCharCount);
  }, [isUser, isFinished, message.text, revealedCharCount]);

  const formattedTime = useMemo(() => {
    try {
      const d = new Date(message.timestamp);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  }, [message.timestamp]);

  if (isUser) {
    return (
      <View
        style={styles.userContainer}
        accessibilityRole="text"
        accessibilityLabel={`You said: ${message.text}`}
      >
        <View style={styles.userBubble}>
          <Text style={styles.userText} allowFontScaling>
            {message.text}
          </Text>
          <Text style={styles.userTimestamp} allowFontScaling>
            {formattedTime}
          </Text>
        </View>
      </View>
    );
  }

  // Assistant bubble
  return (
    <View
      style={styles.caloyContainer}
      accessibilityRole="text"
      accessibilityLabel={`Caloy responded: ${message.text}`}
    >
      <View
        style={[
          styles.caloyBubble,
          message.isError && styles.errorBubble,
        ]}
      >
        <View style={styles.caloyHeader}>
          <View style={styles.caloyAvatar}>
            <Ionicons name="sparkles" size={12} color={colors.primary} />
          </View>
          <Text style={styles.caloyName} allowFontScaling>
            Caloy
          </Text>
          {formattedTime ? (
            <Text style={styles.caloyTimestamp} allowFontScaling>
              • {formattedTime}
            </Text>
          ) : null}
        </View>

        <CaloyMarkdown content={displayedText} />

        {/* Once reveal is done (or if static), show accessories */}
        {isFinished && (
          <>
            {/* Live Data Badge */}
            {message.responseType === "LIVE_DATA" && (
              <CaloyLiveBadge label={message.liveData?.label || "Current TESTIMONIUM Data"} />
            )}

            {/* Verified Sources Accordion */}
            {message.responseType === "RAG" &&
              message.sources &&
              message.sources.length > 0 && (
                <CaloyVerifiedSources sources={message.sources} />
              )}

            {/* Structured Clarification Chips */}
            {message.structuredClarification && onSelectClarificationOption && (
              <CaloyClarification
                clarification={message.structuredClarification}
                onSelectOption={onSelectClarificationOption}
                disabled={isInputDisabled}
              />
            )}
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  userContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    alignItems: "flex-end",
  },
  userBubble: {
    maxWidth: "82%",
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    borderBottomRightRadius: radii.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: spacing.xxs,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  userText: {
    ...fontStyles.body,
    color: colors.textInverse,
    fontSize: 14,
    lineHeight: 20,
  },
  userTimestamp: {
    ...fontStyles.meta,
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 10,
    alignSelf: "flex-end",
    marginTop: 2,
  },
  caloyContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    alignItems: "flex-start",
  },
  caloyBubble: {
    maxWidth: "88%",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderBottomLeftRadius: radii.xs,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: spacing.xs,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  errorBubble: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerBorder,
  },
  caloyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.xxs,
  },
  caloyAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  caloyName: {
    ...fontStyles.captionBold,
    color: colors.primary,
    fontSize: 12,
  },
  caloyTimestamp: {
    ...fontStyles.meta,
    color: colors.textMuted,
    fontSize: 10,
  },
});

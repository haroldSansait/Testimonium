import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import type { CaloyClarificationOption, CaloyMessage } from "../types";
import { CaloyAvatar } from "./CaloyAvatar";
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
  const reduceMotion = useReducedMotion();
  const [revealedCharCount, setRevealedCharCount] = useState<number>(
    message.isRevealing ? 0 : message.text.length
  );
  const notifiedMessageIdsRef = useRef<Set<string>>(new Set());

  // Progressive reveal animation - keep state updater pure
  useEffect(() => {
    if (isUser || !message.isRevealing || reduceMotion) {
      return;
    }

    const fullLength = message.text.length;
    // Reveal in increments of 3 characters every 18ms (~60fps)
    const step = Math.max(2, Math.floor(fullLength / 40));
    const interval = setInterval(() => {
      setRevealedCharCount((prev) => {
        if (prev >= fullLength) return prev;
        return Math.min(fullLength, prev + step);
      });
    }, 18);

    return () => {
      clearInterval(interval);
    };
  }, [isUser, message.id, message.isRevealing, message.text.length, reduceMotion]);

  // Guarded post-commit completion notification: fires exactly once per assistant message
  useEffect(() => {
    if (isUser || !message.isRevealing) {
      return;
    }

    const fullLength = message.text.length;
    const isRevealComplete = reduceMotion || revealedCharCount >= fullLength;

    if (isRevealComplete && !notifiedMessageIdsRef.current.has(message.id)) {
      notifiedMessageIdsRef.current.add(message.id);
      onRevealComplete?.(message.id);
    }
  }, [isUser, message.id, message.isRevealing, message.text.length, reduceMotion, revealedCharCount, onRevealComplete]);

  const isFinished = isUser || !message.isRevealing || reduceMotion || revealedCharCount >= message.text.length;

  const displayedText = useMemo(() => {
    if (isFinished) {
      return message.text;
    }
    return message.text.slice(0, revealedCharCount);
  }, [isFinished, message.text, revealedCharCount]);

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
      <Animated.View
        entering={reduceMotion ? undefined : FadeIn.duration(180)}
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
      </Animated.View>
    );
  }

  // Assistant bubble
  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(180)}
      style={styles.caloyContainer}
      accessibilityRole="text"
      accessibilityLabel={`Caloy responded: ${message.text}`}
    >
      <View style={styles.caloyRow}>
        <CaloyAvatar size={28} />
        <View
          style={[
            styles.caloyBubble,
            message.isError && styles.errorBubble,
          ]}
        >
          <View style={styles.caloyHeader}>
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
    </Animated.View>
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
    fontSize: 12,
    alignSelf: "flex-end",
    marginTop: 2,
  },
  caloyContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    alignItems: "flex-start",
  },
  caloyRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.xs,
    maxWidth: "100%",
  },
  caloyBubble: {
    flexShrink: 1,
    maxWidth: "86%",
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
  caloyName: {
    ...fontStyles.captionBold,
    color: colors.primary,
    fontSize: 12,
  },
  caloyTimestamp: {
    ...fontStyles.meta,
    color: colors.textMuted,
    fontSize: 12,
  },
});

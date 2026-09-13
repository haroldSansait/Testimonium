import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { AppHeader, IconButton } from "@/components/ui";
import { useParishes } from "@/features/parishes/api";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import { CaloyMessageBubble } from "./components/CaloyMessageBubble";
import { CaloyTypingIndicator } from "./components/CaloyTypingIndicator";
import { useChatSession } from "./hooks/useChatSession";
import type { CaloyClarificationOption, CaloyMessage } from "./types";

export interface CaloyScreenProps {
  showBackButton?: boolean;
}

export const CaloyScreen: React.FC<CaloyScreenProps> = ({
  showBackButton = true,
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [inputText, setInputText] = useState("");
  const [isParishModalVisible, setIsParishModalVisible] = useState(false);
  const flatListRef = useRef<FlatList<CaloyMessage>>(null);
  const isNearBottomRef = useRef(true);

  const {
    messages,
    selectedParishId,
    selectedParishName,
    isTyping,
    sendMessage,
    selectClarificationOption,
    clearChat,
    setParishContext,
    handleRevealComplete,
  } = useChatSession();

  const { data: parishesData } = useParishes({ limit: 100 });
  const parishes = useMemo(() => parishesData?.items || [], [parishesData?.items]);

  // Track near-bottom distance to prevent force-scrolling if user is reading older messages
  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
      const distanceFromEnd =
        contentSize.height - layoutMeasurement.height - contentOffset.y;
      isNearBottomRef.current = distanceFromEnd < 120;
    },
    []
  );

  // Auto-scroll on keyboard open if already near bottom
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => {
        if (isNearBottomRef.current) {
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 80);
        }
      }
    );
    return () => {
      showSub.remove();
    };
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = inputText.trim();
    if (!trimmed || isTyping) return;
    setInputText("");
    void sendMessage(trimmed);
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 50);
  }, [inputText, isTyping, sendMessage]);

  const handleSelectClarification = useCallback(
    (option: CaloyClarificationOption) => {
      selectClarificationOption(option);
    },
    [selectClarificationOption]
  );

  const handleConfirmClear = useCallback(() => {
    Alert.alert(
      "Clear Conversation",
      "Are you sure you want to clear your current conversation with Caloy?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            void clearChat();
          },
        },
      ]
    );
  }, [clearChat]);

  const parishDisplayLabel = useMemo(() => {
    if (selectedParishName) return selectedParishName;
    if (selectedParishId !== null && selectedParishId !== undefined) {
      const found = parishes.find((p) => String(p.id) === String(selectedParishId));
      if (found) return found.name;
    }
    return "All Parishes (Diocese-wide)";
  }, [selectedParishName, selectedParishId, parishes]);

  const renderMessageItem = useCallback(
    ({ item }: { item: CaloyMessage }) => (
      <CaloyMessageBubble
        message={item}
        onSelectClarificationOption={handleSelectClarification}
        onRevealComplete={handleRevealComplete}
        isInputDisabled={isTyping}
      />
    ),
    [handleSelectClarification, handleRevealComplete, isTyping]
  );

  // When rendered standalone without bottom tabs, provide bottom safe area to clear 3-button system nav.
  // When rendered inside bottom tabs, bottom tab bar handles system nav clearance.
  const bottomPadding = showBackButton
    ? Math.max(insets.bottom, 12) + spacing.xs
    : spacing.sm;

  return (
    <Screen safeArea={true} keyboardAvoiding={false} style={styles.screen}>
      {/* Header */}
      <AppHeader
        title="Caloy"
        subtitle="TESTIMONIUM Virtual Assistant"
        onBack={showBackButton ? () => router.back() : undefined}
        backAccessibilityLabel="Close Caloy"
        rightAction={
          <IconButton
            onPress={handleConfirmClear}
            accessibilityLabel="Clear chat conversation"
            accessibilityHint="Resets the current conversation with Caloy"
            size={40}
          >
            <Ionicons name="trash-outline" size={20} color={colors.textSecondary} />
          </IconButton>
        }
      />

      {/* Parish Context Bar */}
      <View style={styles.contextBar}>
        <View style={styles.contextInfo}>
          <Ionicons name="location-outline" size={14} color={colors.primary} />
          <Text style={styles.contextLabel} numberOfLines={1} allowFontScaling>
            Context:{" "}
            <Text style={styles.contextValue}>{parishDisplayLabel}</Text>
          </Text>
        </View>
        <Pressable
          onPress={() => setIsParishModalVisible(true)}
          style={({ pressed }) => [styles.changeContextBtn, pressed && styles.changeContextBtnPressed]}
          accessibilityRole="button"
          accessibilityLabel="Change Parish Context"
        >
          <Text style={styles.changeContextText} allowFontScaling>
            Change
          </Text>
        </Pressable>
      </View>

      {/* Main Chat Area - Unified single KeyboardAvoidingView layout authority */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessageItem}
          contentContainerStyle={styles.messagesList}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onContentSizeChange={() => {
            if (isNearBottomRef.current) {
              flatListRef.current?.scrollToEnd({ animated: true });
            }
          }}
          onLayout={() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          }}
          ListFooterComponent={isTyping ? <CaloyTypingIndicator /> : null}
          keyboardShouldPersistTaps="handled"
        />

        {/* Input Bar */}
        <View style={[styles.inputContainer, { paddingBottom: bottomPadding }]}>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ask Caloy anything..."
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={500}
              editable={!isTyping}
              returnKeyType="default"
              accessibilityLabel="Type your message to Caloy"
            />
            <Pressable
              onPress={handleSend}
              disabled={!inputText.trim() || isTyping}
              style={({ pressed }) => [
                styles.sendButton,
                (!inputText.trim() || isTyping) && styles.sendButtonDisabled,
                pressed && styles.sendButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Send message"
              accessibilityState={{ disabled: !inputText.trim() || isTyping }}
              hitSlop={4}
            >
              <Ionicons
                name="arrow-up"
                size={20}
                color={!inputText.trim() || isTyping ? colors.disabled : colors.textInverse}
              />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Parish Context Selection Modal */}
      <Modal
        visible={isParishModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsParishModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} allowFontScaling>
                Select Parish Context
              </Text>
              <IconButton
                onPress={() => setIsParishModalVisible(false)}
                accessibilityLabel="Close parish selection"
                size={36}
              >
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </IconButton>
            </View>

            <FlatList
              data={[
                { id: "0", name: "All Parishes (Diocese-wide)" },
                ...parishes.map((p) => ({ id: String(p.id), name: p.name })),
              ]}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.parishListContent}
              renderItem={({ item }) => {
                const isSelected =
                  item.id === "0"
                    ? selectedParishId === null
                    : String(selectedParishId) === item.id;
                return (
                  <Pressable
                    style={({ pressed }) => [
                      styles.parishOptionItem,
                      isSelected && styles.parishOptionSelected,
                      pressed && styles.parishOptionPressed,
                    ]}
                    onPress={() => {
                      if (item.id === "0") {
                        setParishContext(null, null);
                      } else {
                        setParishContext(Number(item.id) || null, item.name);
                      }
                      setIsParishModalVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.parishOptionText,
                        isSelected && styles.parishOptionTextSelected,
                      ]}
                      allowFontScaling
                    >
                      {item.name}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark" size={18} color={colors.primary} />
                    )}
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  screen: {
    backgroundColor: colors.background,
  },
  contextBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceVariant,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  contextInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flex: 1,
    marginRight: spacing.sm,
  },
  contextLabel: {
    ...fontStyles.meta,
    color: colors.textSecondary,
  },
  contextValue: {
    color: colors.textPrimary,
    fontWeight: "700",
  },
  changeContextBtn: {
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: spacing.xxs,
    borderRadius: radii.sm,
    backgroundColor: colors.primarySoft,
  },
  changeContextBtnPressed: {
    opacity: 0.7,
  },
  changeContextText: {
    ...fontStyles.meta,
    color: colors.primary,
    fontWeight: "700",
  },
  messagesList: {
    paddingVertical: spacing.md,
    flexGrow: 1,
    justifyContent: "flex-end",
  },
  inputContainer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: Platform.OS === "ios" ? spacing.xs : 2,
    gap: spacing.xs,
  },
  textInput: {
    ...fontStyles.body,
    flex: 1,
    maxHeight: 100,
    minHeight: 36,
    color: colors.textPrimary,
    paddingVertical: 4,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-end",
    marginBottom: 2,
  },
  sendButtonPressed: {
    backgroundColor: colors.primaryPressed,
    transform: [{ scale: 0.95 }],
  },
  sendButtonDisabled: {
    backgroundColor: colors.disabledBg,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    maxHeight: "75%",
    paddingBottom: spacing.xl,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  modalTitle: {
    ...fontStyles.heading,
    color: colors.textPrimary,
  },
  parishListContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  parishOptionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
  },
  parishOptionSelected: {
    backgroundColor: colors.primarySoft,
  },
  parishOptionPressed: {
    opacity: 0.8,
  },
  parishOptionText: {
    ...fontStyles.body,
    color: colors.textPrimary,
    flex: 1,
  },
  parishOptionTextSelected: {
    color: colors.primary,
    fontWeight: "700",
  },
});

import React from "react";
import { StyleSheet, Text, View, type TextStyle } from "react-native";
import { colors } from "@/theme/tokens";

interface CaloyMarkdownProps {
  content: string;
  textColor?: string;
  style?: TextStyle;
}

/**
 * Parses inline formatting tokens:
 * - Bold: **text**
 * - Italic: *text* or _text_
 * - Code: `code`
 */
function parseInline(text: string, baseStyle: TextStyle, textColor: string) {
  const elements: React.ReactNode[] = [];
  // Tokenizer regex matching **bold**, *italic*, `code`
  const regex = /(\*\*.*?\*\*|\*[^*]+?\*|`[^`]+?`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(
        <Text key={`txt_${lastIndex}`} style={baseStyle}>
          {text.slice(lastIndex, match.index)}
        </Text>
      );
    }

    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**") && token.length >= 4) {
      const inner = token.slice(2, -2);
      elements.push(
        <Text key={`b_${match.index}`} style={[baseStyle, styles.bold, { color: textColor }]}>
          {inner}
        </Text>
      );
    } else if (token.startsWith("`") && token.endsWith("`") && token.length >= 2) {
      const inner = token.slice(1, -1);
      elements.push(
        <Text key={`c_${match.index}`} style={[baseStyle, styles.code]}>
          {inner}
        </Text>
      );
    } else if (token.startsWith("*") && token.endsWith("*") && token.length >= 2) {
      const inner = token.slice(1, -1);
      elements.push(
        <Text key={`i_${match.index}`} style={[baseStyle, styles.italic]}>
          {inner}
        </Text>
      );
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    elements.push(
      <Text key={`txt_${lastIndex}`} style={baseStyle}>
        {text.slice(lastIndex)}
      </Text>
    );
  }

  return elements.length > 0 ? elements : text;
}

/**
 * Native, safe Markdown renderer for Caloy chat bubbles.
 * Supports paragraphs, bold, italic, inline code, and lists with zero WebViews or raw HTML.
 */
export const CaloyMarkdown: React.FC<CaloyMarkdownProps> = ({
  content,
  textColor = colors.textPrimary,
  style,
}) => {
  if (!content || typeof content !== "string") {
    return null;
  }

  const baseTextStyle: TextStyle = {
    fontSize: 15,
    lineHeight: 22,
    color: textColor,
    ...style,
  };

  // Split into structural blocks by double newlines
  const rawBlocks = content.split(/\n{2,}/);

  return (
    <View style={styles.container}>
      {rawBlocks.map((block, blockIndex) => {
        const lines = block.split("\n");

        // Check if block is a list
        const isBulletBlock = lines.some((l) => /^(\s*[-*•]\s+)/.test(l));
        const isNumberBlock = lines.some((l) => /^(\s*\d+\.\s+)/.test(l));

        if (isBulletBlock || isNumberBlock) {
          return (
            <View key={`list_block_${blockIndex}`} style={styles.listContainer}>
              {lines.map((line, lineIndex) => {
                const bulletMatch = line.match(/^(\s*[-*•]\s+)(.*)/);
                const numberMatch = line.match(/^(\s*\d+\.\s+)(.*)/);

                if (bulletMatch) {
                  return (
                    <View key={`item_${lineIndex}`} style={styles.listItemRow}>
                      <Text style={[styles.bulletPoint, { color: textColor }]}>•</Text>
                      <Text style={[baseTextStyle, styles.listItemContent]}>
                        {parseInline(bulletMatch[2], baseTextStyle, textColor)}
                      </Text>
                    </View>
                  );
                }

                if (numberMatch) {
                  const numStr = numberMatch[1].trim();
                  return (
                    <View key={`item_${lineIndex}`} style={styles.listItemRow}>
                      <Text style={[styles.numberPoint, { color: textColor }]}>{numStr}</Text>
                      <Text style={[baseTextStyle, styles.listItemContent]}>
                        {parseInline(numberMatch[2], baseTextStyle, textColor)}
                      </Text>
                    </View>
                  );
                }

                if (line.trim()) {
                  return (
                    <Text key={`line_${lineIndex}`} style={[baseTextStyle, styles.paragraph]}>
                      {parseInline(line, baseTextStyle, textColor)}
                    </Text>
                  );
                }

                return null;
              })}
            </View>
          );
        }

        // Standard paragraph
        return (
          <Text key={`para_${blockIndex}`} style={[baseTextStyle, styles.paragraph]}>
            {parseInline(block, baseTextStyle, textColor)}
          </Text>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  paragraph: {
    marginBottom: 8,
  },
  bold: {
    fontWeight: "700",
  },
  italic: {
    fontStyle: "italic",
  },
  code: {
    fontFamily: "monospace",
    backgroundColor: "rgba(0, 0, 0, 0.06)",
    paddingHorizontal: 4,
    borderRadius: 4,
    fontSize: 13,
  },
  listContainer: {
    marginBottom: 8,
  },
  listItemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  bulletPoint: {
    fontSize: 16,
    lineHeight: 22,
    marginRight: 6,
    marginLeft: 2,
  },
  numberPoint: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
    marginRight: 6,
  },
  listItemContent: {
    flex: 1,
  },
});

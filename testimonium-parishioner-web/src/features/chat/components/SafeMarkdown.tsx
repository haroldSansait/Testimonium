import React from 'react';

interface SafeMarkdownProps {
  text: string;
  className?: string;
}

// Inline token patterns
// We parse inline tokens safely into standard React elements without raw markup.
function parseInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Tokenizer pattern: code, bold, link, italic
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|\*[^*]+\*|_[^_]+_)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.substring(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith('`') && token.endsWith('`')) {
      const code = token.slice(1, -1);
      nodes.push(
        <code
          key={`code_${match.index}`}
          className="bg-gray-100 text-crimson px-1 py-0.5 rounded text-[11px] font-mono border border-border/50"
        >
          {code}
        </code>
      );
    } else if (token.startsWith('**') && token.endsWith('**')) {
      const inner = token.slice(2, -2);
      nodes.push(
        <strong key={`b_${match.index}`} className="font-semibold text-text-primary">
          {parseInline(inner)}
        </strong>
      );
    } else if (
      (token.startsWith('*') && token.endsWith('*')) ||
      (token.startsWith('_') && token.endsWith('_'))
    ) {
      const inner = token.slice(1, -1);
      nodes.push(
        <em key={`i_${match.index}`} className="italic">
          {parseInline(inner)}
        </em>
      );
    } else if (token.startsWith('[') && token.includes('](') && token.endsWith(')')) {
      const closeBracket = token.indexOf('](');
      const label = token.slice(1, closeBracket);
      const url = token.slice(closeBracket + 2, -1).trim();

      // Only allow safe http, https, or mailto protocols
      const isSafeUrl = /^(https?:\/\/|mailto:)/i.test(url);
      if (isSafeUrl) {
        nodes.push(
          <a
            key={`a_${match.index}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-crimson underline hover:text-crimson/80"
          >
            {label}
          </a>
        );
      } else {
        // Render literally if protocol is unsafe (e.g. javascript:, data:)
        nodes.push(token);
      }
    } else {
      nodes.push(token);
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.substring(lastIndex));
  }

  return nodes;
}

// Render lines within a block (with line breaks)
function renderLines(lines: string[]): React.ReactNode {
  return lines.map((line, idx) => (
    <React.Fragment key={idx}>
      {idx > 0 && <br />}
      {parseInline(line)}
    </React.Fragment>
  ));
}

export const SafeMarkdown: React.FC<SafeMarkdownProps> = ({ text, className = '' }) => {
  if (!text || typeof text !== 'string') {
    return null;
  }

  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rawLines = normalized.split('\n');

  interface Block {
    type: 'p' | 'ul' | 'ol';
    items: string[];
  }

  const blocks: Block[] = [];
  let currentBlock: Block | null = null;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      if (currentBlock) {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      continue;
    }

    const bulletMatch = /^[*-]\s+(.+)$/.exec(trimmed);
    const numberedMatch = /^\d+\.\s+(.+)$/.exec(trimmed);

    if (bulletMatch) {
      if (currentBlock && currentBlock.type !== 'ul') {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      if (!currentBlock) {
        currentBlock = { type: 'ul', items: [] };
      }
      currentBlock.items.push(bulletMatch[1]);
    } else if (numberedMatch) {
      if (currentBlock && currentBlock.type !== 'ol') {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      if (!currentBlock) {
        currentBlock = { type: 'ol', items: [] };
      }
      currentBlock.items.push(numberedMatch[1]);
    } else {
      if (currentBlock && currentBlock.type !== 'p') {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      if (!currentBlock) {
        currentBlock = { type: 'p', items: [] };
      }
      currentBlock.items.push(line);
    }
  }

  if (currentBlock) {
    blocks.push(currentBlock);
  }

  return (
    <div className={`space-y-2 text-xs sm:text-sm leading-relaxed ${className}`}>
      {blocks.map((block, bIdx) => {
        if (block.type === 'ul') {
          return (
            <ul key={bIdx} className="list-disc pl-5 space-y-1 my-1.5">
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx} className="pl-0.5">
                  {parseInline(item)}
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === 'ol') {
          return (
            <ol key={bIdx} className="list-decimal pl-5 space-y-1 my-1.5">
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx} className="pl-0.5">
                  {parseInline(item)}
                </li>
              ))}
            </ol>
          );
        }

        return (
          <p key={bIdx} className="my-1">
            {renderLines(block.items)}
          </p>
        );
      })}
    </div>
  );
};

export default SafeMarkdown;

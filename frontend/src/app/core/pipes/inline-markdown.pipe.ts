import { Pipe, PipeTransform } from '@angular/core';

export interface InlineSegment {
  text: string;
  bold: boolean;
  italic: boolean;
  code: boolean;
}

// `code`, **, * – code spans are matched first so markers inside them stay literal.
const TOKEN = /`([^`]+)`|\*\*|\*/g;
// [label](url) – replaced by its label before tokenizing, so the label may contain markup itself.
const LINK = /\[([^\]]+)\]\([^)]*\)/g;

/**
 * Splits inline Markdown (`**bold**`, `*italic*`, `` `code` ``, `[label](url)`) into
 * text segments that the template renders as elements. Output is never interpreted
 * as HTML, so the source text cannot inject markup. Links are reduced to their label.
 */
@Pipe({
  name: 'inlineMarkdown',
  standalone: true,
})
export class InlineMarkdownPipe implements PipeTransform {
  transform(value: string | null | undefined): InlineSegment[] {
    if (!value) return [];
    const text = value.replace(LINK, '$1');

    const segments: InlineSegment[] = [];
    let bold = false;
    let italic = false;
    let buffer = '';

    const flush = () => {
      if (buffer) {
        segments.push({ text: buffer, bold, italic, code: false });
        buffer = '';
      }
    };

    let lastIndex = 0;
    for (const match of text.matchAll(TOKEN)) {
      buffer += text.slice(lastIndex, match.index);
      lastIndex = match.index + match[0].length;
      const [token, code] = match;

      if (code !== undefined) {
        flush();
        segments.push({ text: code, bold, italic, code: true });
      } else if (token === '**' && (bold || hasCloser(text, lastIndex, '**'))) {
        flush();
        bold = !bold;
      } else if (token === '*' && (italic || hasCloser(text, lastIndex, '*'))) {
        flush();
        italic = !italic;
      } else {
        buffer += token;
      }
    }
    buffer += text.slice(lastIndex);
    flush();
    return segments;
  }
}

/** True if `marker` occurs again after `from`, ignoring code spans. */
function hasCloser(value: string, from: number, marker: '**' | '*'): boolean {
  for (const match of value.slice(from).matchAll(TOKEN)) {
    if (match[0] === marker) return true;
  }
  return false;
}

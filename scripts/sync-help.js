#!/usr/bin/env node

// Converts docs/Help.md (de) and docs/Help.en.md (en) into the JSON the in-app help page loads
// (frontend/public/assets/help.<lang>.json). Sections start with `## Title {#anchor}`; both
// languages must use the same anchors, because the context help links to them.
// Supported Markdown: `###` subheadings, paragraphs, `-` and `1.` lists, **bold**, *italic*,
// `code` and [links](https://…). The text is our own, HTML in it is escaped.

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const SOURCES = {
  de: path.join(ROOT_DIR, 'docs', 'Help.md'),
  en: path.join(ROOT_DIR, 'docs', 'Help.en.md'),
};
const TARGET_DIR = path.join(ROOT_DIR, 'frontend', 'public', 'assets');

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Code spans are cut out first, so `*` or `[` inside them stay literal. */
function inline(text) {
  return text
    .split(/(`[^`]+`)/)
    .map((part) =>
      part.startsWith('`') && part.endsWith('`') && part.length > 1
        ? `<code>${escapeHtml(part.slice(1, -1))}</code>`
        : escapeHtml(part)
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>')
            .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    )
    .join('');
}

function plain(text) {
  return text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

/** Renders the body of one section; consecutive list items form one list. */
function renderBody(lines) {
  const html = [];
  let paragraph = [];
  let list = null; // { tag, items }

  const flushParagraph = () => {
    if (paragraph.length) html.push(`<p>${inline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list) html.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`);
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    const bullet = line.match(/^-\s+(.*)$/);
    const numbered = line.match(/^\d+\.\s+(.*)$/);
    if (!line) {
      flushParagraph();
      flushList();
    } else if (line.startsWith('### ')) {
      flushParagraph();
      flushList();
      html.push(`<h3>${inline(line.slice(4))}</h3>`);
    } else if (bullet || numbered) {
      flushParagraph();
      const tag = bullet ? 'ul' : 'ol';
      if (list && list.tag !== tag) flushList();
      if (!list) list = { tag, items: [] };
      list.items.push((bullet || numbered)[1]);
    } else if (list) {
      // Continuation line of the last list item
      list.items[list.items.length - 1] += ` ${line}`;
    } else {
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return html.join('\n');
}

function parse(file) {
  const content = fs.readFileSync(file, 'utf8');
  const sections = [];
  // Everything before the first `## ` section is an introduction for maintainers
  const blocks = content.split(/\n(?=## )/).filter((block) => block.startsWith('## '));
  for (const block of blocks) {
    const [header, ...body] = block.split('\n');
    const match = header.match(/^##\s+(.+?)\s*\{#([a-z0-9-]+)\}\s*$/);
    if (!match) throw new Error(`${path.basename(file)}: section without anchor: "${header}"`);
    const [, title, id] = match;
    if (sections.some((s) => s.id === id)) throw new Error(`${path.basename(file)}: duplicate anchor #${id}`);
    sections.push({
      id,
      title,
      html: renderBody(body),
      // Markdown markers (### headings, list bullets) are stripped per line before joining
      text: plain(body.map((line) => line.replace(/^\s*(#+|-|\d+\.)\s+/, '')).join(' '))
        .replace(/\s+/g, ' ')
        .trim(),
    });
  }
  if (!sections.length) throw new Error(`${path.basename(file)}: no sections found`);
  return sections;
}

const help = Object.fromEntries(Object.entries(SOURCES).map(([lang, file]) => [lang, parse(file)]));

const ids = (lang) => help[lang].map((s) => s.id).join(',');
if (ids('de') !== ids('en')) {
  console.error(`Help sections differ between languages:\n  de: ${ids('de')}\n  en: ${ids('en')}`);
  process.exit(1);
}

for (const [lang, sections] of Object.entries(help)) {
  const target = path.join(TARGET_DIR, `help.${lang}.json`);
  fs.writeFileSync(target, JSON.stringify({ sections }, null, 2) + '\n');
  console.log(`Wrote ${sections.length} help sections to ${path.relative(ROOT_DIR, target)}`);
}

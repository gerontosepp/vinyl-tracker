import { InlineMarkdownPipe, InlineSegment } from './inline-markdown.pipe';

const seg = (text: string, flags: Partial<Omit<InlineSegment, 'text'>> = {}): InlineSegment => ({
  text,
  bold: false,
  italic: false,
  code: false,
  ...flags,
});

describe('InlineMarkdownPipe', () => {
  const pipe = new InlineMarkdownPipe();

  it('should return no segments for empty input', () => {
    expect(pipe.transform('')).toEqual([]);
    expect(pipe.transform(null)).toEqual([]);
    expect(pipe.transform(undefined)).toEqual([]);
  });

  it('should keep plain text as a single segment', () => {
    expect(pipe.transform('Nur Text')).toEqual([seg('Nur Text')]);
  });

  it('should parse bold, italic and code', () => {
    expect(pipe.transform('**Fett**: mit `code` und *kursiv*.')).toEqual([
      seg('Fett', { bold: true }),
      seg(': mit '),
      seg('code', { code: true }),
      seg(' und '),
      seg('kursiv', { italic: true }),
      seg('.'),
    ]);
  });

  it('should support code inside bold', () => {
    expect(pipe.transform('**Neue Crate `vinyl-api-types`**: Text')).toEqual([
      seg('Neue Crate ', { bold: true }),
      seg('vinyl-api-types', { bold: true, code: true }),
      seg(': Text'),
    ]);
  });

  it('should keep markers inside code literal', () => {
    expect(pipe.transform('Glob `src/**/*.ts` bleibt')).toEqual([
      seg('Glob '),
      seg('src/**/*.ts', { code: true }),
      seg(' bleibt'),
    ]);
  });

  it('should reduce links to their label', () => {
    expect(pipe.transform('Siehe ([ADR-0018](adr/0018-vitest.md)).')).toEqual([seg('Siehe (ADR-0018).')]);
  });

  it('should parse markup inside link labels', () => {
    expect(pipe.transform('im [`frontend/Dockerfile`](file:///x/Dockerfile) von')).toEqual([
      seg('im '),
      seg('frontend/Dockerfile', { code: true }),
      seg(' von'),
    ]);
  });

  it('should keep unmatched markers as text', () => {
    expect(pipe.transform('5 * 3 und **offen')).toEqual([seg('5 * 3 und **offen')]);
  });

  it('should never produce HTML markup from the source text', () => {
    expect(pipe.transform('**<img src=x onerror=alert(1)>**')).toEqual([
      seg('<img src=x onerror=alert(1)>', { bold: true }),
    ]);
  });
});

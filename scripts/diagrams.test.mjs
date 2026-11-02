import { describe, expect, it } from 'vitest';
import { diagramsIn, slug, stale } from './diagrams.mjs';

describe('diagrams collector', () => {
  it('finds Mermaid blocks under their headings', () => {
    const md = '# Doc\n\n## 1. Flow `x`\n\n```mermaid\nflowchart LR\n  a --> b\n```\n\n```mermaid\nclassDiagram\n  A\n```\n';
    const found = diagramsIn(md, 'docs/x.md');
    expect(found.map((d) => [d.title, d.kind])).toEqual([
      ['1. Flow `x`', 'Flow'],
      ['1. Flow `x` (2)', 'Class (UML)'],
    ]);
    expect(found[0].source).toBe('flowchart LR\n  a --> b');
  });

  it('makes GitHub-style anchors', () => {
    expect(slug('3. Runtime flow: one answer (sequence diagram)')).toBe('3-runtime-flow-one-answer-sequence-diagram');
    expect(slug('Module: Math Monster (math-monster)')).toBe('module-math-monster-math-monster');
  });

  it('docs/DIAGRAMS.md, its images and the README section are up to date (run npm run diagrams)', () => {
    expect(stale()).toEqual([]);
  });
});

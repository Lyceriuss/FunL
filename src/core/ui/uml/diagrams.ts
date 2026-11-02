/**
 * Pull Mermaid diagrams out of Markdown docs, each with the heading it sits
 * under, so the app can show the same diagrams as docs/ (one source of truth).
 */
export interface Diagram {
  id: string;
  /** Heading the diagram sits under, e.g. "1. Component overview". */
  title: string;
  /** Which doc it came from, e.g. "Architecture". */
  doc: string;
  /** Diagram type from its first line: flowchart, classDiagram, stateDiagram-v2… */
  kind: string;
  source: string;
}

export function diagramsIn(markdown: string, doc: string): Diagram[] {
  const out: Diagram[] = [];
  let heading = doc;
  let inBlock = false;
  let lines: string[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    if (inBlock) {
      if (line.trim() === '```') {
        const source = lines.join('\n').trim();
        const kind = source.split(/\s/)[0] ?? 'diagram';
        const n = out.filter((d) => d.title === heading).length;
        out.push({ id: `${doc}:${heading}:${n}`, title: n ? `${heading} (${n + 1})` : heading, doc, kind, source });
        inBlock = false;
      } else lines.push(line);
      continue;
    }
    const h = line.match(/^#{2,3}\s+(.+?)\s*$/);
    if (h) heading = h[1].replace(/[`*]/g, '');
    else if (line.trim() === '```mermaid') {
      inBlock = true;
      lines = [];
    }
  }
  return out;
}

/** Friendly name for a Mermaid diagram type. */
export function kindLabel(kind: string): string {
  if (kind.startsWith('flowchart') || kind.startsWith('graph')) return 'Flow';
  if (kind.startsWith('classDiagram')) return 'Class (UML)';
  if (kind.startsWith('stateDiagram')) return 'State (UML)';
  if (kind.startsWith('sequenceDiagram')) return 'Sequence (UML)';
  if (kind.startsWith('erDiagram')) return 'Data (ER)';
  return kind;
}

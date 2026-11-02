import { useEffect, useId, useRef, useState } from 'react';
import { getLogger } from '../../log/logger';
import './uml.css';

const log = getLogger('uml');

type MermaidApi = typeof import('mermaid').default;
let mermaidPromise: Promise<MermaidApi> | null = null;

/** Mermaid is big, so it is loaded only when a diagram is first shown. */
function loadMermaid(): Promise<MermaidApi> {
  mermaidPromise ??= import('mermaid').then(({ default: m }) => {
    m.initialize({
      startOnLoad: false,
      // Only our own diagrams are rendered, but keep Mermaid's safe mode anyway.
      securityLevel: 'strict',
      theme: 'dark',
      fontFamily: 'Chakra Petch, system-ui, sans-serif',
      themeVariables: {
        background: '#0b0820',
        primaryColor: '#1e1b4b',
        primaryBorderColor: '#22d3ee',
        primaryTextColor: '#f8fafc',
        lineColor: '#a78bfa',
        secondaryColor: '#312e81',
        tertiaryColor: '#160c3a',
        clusterBkg: '#140f33',
        clusterBorder: '#6d28d9',
      },
      flowchart: { curve: 'basis' },
    });
    return m;
  });
  return mermaidPromise;
}

/**
 * Draws one Mermaid (UML / flow / ER) diagram. Zoom is controlled by the
 * parent (`zoom`, 1 = fit the width); the view scrolls when zoomed in.
 */
export function UmlGraph({ source, title, zoom = 1 }: { source: string; title: string; zoom?: number }) {
  const rawId = useId();
  /** The drawn diagram (or error), for the source it was drawn from. */
  const [result, setResult] = useState<{ source: string; svg?: string; error?: string } | null>(null);
  const svg = result?.source === source ? (result.svg ?? null) : null;
  const error = result?.source === source ? (result.error ?? null) : null;
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const id = `uml-${rawId.replace(/[^a-zA-Z0-9]/g, '')}-${Math.floor(Math.random() * 1e6)}`;
    loadMermaid()
      .then((m) => m.render(id, source))
      .then(({ svg: out }) => !cancelled && setResult({ source, svg: out }))
      .catch((err: unknown) => {
        log.error('diagram failed to render', { title, err: String(err) });
        if (!cancelled) setResult({ source, error: String(err instanceof Error ? err.message : err) });
      });
    return () => {
      cancelled = true;
    };
  }, [source, title, rawId]);

  useEffect(() => {
    if (holder.current && svg !== null) holder.current.innerHTML = svg;
  }, [svg]);

  if (error) {
    return (
      <div className="uml uml--error" role="alert">
        <p>This diagram couldn't be drawn: {error}</p>
        <pre>{source}</pre>
      </div>
    );
  }
  return (
    <div className="uml" aria-label={title} role="img">
      {svg === null && <p className="uml__loading">Drawing…</p>}
      <div className="uml__canvas" ref={holder} style={{ width: `${zoom * 100}%` }} />
    </div>
  );
}

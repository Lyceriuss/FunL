import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { useControlScheme, useMenuNavigation } from '../input/hooks';
import { baseScheme } from '../input/types';

/**
 * Wrapper for every non-game screen: applies menu controls and makes all
 * `data-focusable` elements reachable by controller / arrow keys.
 */
export function Screen({
  title,
  onBack,
  children,
  actions,
}: {
  title: string;
  onBack?: () => void;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useControlScheme(baseScheme);
  useMenuNavigation(ref, { onBack });

  // Before paint, so the very first controller press already has a target.
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    let fallback = root.contains(document.activeElement) ? (document.activeElement as HTMLElement) : null;
    if (!fallback) {
      fallback =
        root.querySelector<HTMLElement>('[data-autofocus]') ??
        root.querySelector<HTMLElement>('.screen__body [data-focusable]') ??
        root.querySelector<HTMLElement>('[data-focusable]');
      fallback?.focus({ preventScroll: true });
    }
    if (fallback?.hasAttribute('data-autofocus')) return;

    // Content that loads a moment later (e.g. a map from saved progress) may
    // bring its own autofocus target: move there, unless the player has
    // already moved focus themselves.
    const observer = new MutationObserver(() => {
      if (document.activeElement !== fallback && root.contains(document.activeElement)) return observer.disconnect();
      const late = root.querySelector<HTMLElement>('[data-autofocus]');
      if (late) {
        late.focus({ preventScroll: true });
        observer.disconnect();
      }
    });
    observer.observe(root, { childList: true, subtree: true });
    const stop = setTimeout(() => observer.disconnect(), 3000);
    return () => {
      observer.disconnect();
      clearTimeout(stop);
    };
  }, []);

  return (
    <div className="screen" ref={ref}>
      <header className="screen__header">
        {onBack ? (
          <button type="button" className="btn btn--ghost" data-focusable onClick={onBack} aria-label="Back">
            ← Back
          </button>
        ) : (
          <span />
        )}
        <h1>{title}</h1>
        <div className="screen__actions">{actions}</div>
      </header>
      <main className="screen__body">{children}</main>
    </div>
  );
}

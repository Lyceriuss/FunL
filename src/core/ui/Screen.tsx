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
    if (!root || root.contains(document.activeElement)) return;
    const first =
      root.querySelector<HTMLElement>('[data-autofocus]') ??
      root.querySelector<HTMLElement>('.screen__body [data-focusable]') ??
      root.querySelector<HTMLElement>('[data-focusable]');
    first?.focus({ preventScroll: true });
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

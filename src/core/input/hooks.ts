import { useLayoutEffect, useRef, type RefObject } from 'react';
import { audio } from '../audio';
import { input } from './InputManager';
import type { ActionEvent, ControlScheme, NavDirection } from './types';

/** Subscribe to the action stream while the component is mounted. */
export function useActions(handler: (e: ActionEvent) => void, enabled = true): void {
  const ref = useRef(handler);
  useLayoutEffect(() => {
    ref.current = handler;
  });
  // Layout effect: subscribe before the first paint, so a press that lands
  // right after a screen appears is never dropped.
  useLayoutEffect(() => {
    if (!enabled) return;
    return input.onAction((e) => ref.current(e));
  }, [enabled]);
}

/** Activate a control scheme while mounted, restoring the previous one after. */
export function useControlScheme(scheme: ControlScheme): void {
  useLayoutEffect(() => {
    const prev = input.getScheme();
    input.setScheme(scheme);
    return () => input.setScheme(prev);
  }, [scheme]);
}

/**
 * Spatial focus navigation for menus, so every screen is usable with a
 * controller or arrow keys. Elements marked `data-focusable` inside the
 * container take part.
 */
export function useMenuNavigation(
  container: RefObject<HTMLElement | null>,
  opts: { onBack?: () => void; onPause?: () => void; enabled?: boolean } = {},
): void {
  useActions((e) => {
    const root = container.current;
    if (!root) return;
    const a = e.action;
    if (a.type === 'nav') {
      if (moveFocus(root, (a as { dir: NavDirection }).dir)) audio.sfx('menuMove');
    } else if (a.type === 'confirm') {
      const el = document.activeElement as HTMLElement | null;
      if (el && root.contains(el)) {
        audio.sfx('menuSelect');
        el.click();
      } else firstFocusable(root)?.focus();
    } else if (a.type === 'back') {
      opts.onBack?.();
    } else if (a.type === 'pause') {
      opts.onPause?.();
    }
  }, opts.enabled ?? true);
}

function firstFocusable(root: HTMLElement): HTMLElement | null {
  return root.querySelector<HTMLElement>('[data-focusable]:not(:disabled)');
}

/** Move focus spatially; returns true if it moved. */
function moveFocus(root: HTMLElement, dir: NavDirection): boolean {
  const items = Array.from(root.querySelectorAll<HTMLElement>('[data-focusable]')).filter(
    (el) => !(el as HTMLButtonElement).disabled && el.offsetParent !== null,
  );
  if (items.length === 0) return false;
  const current = document.activeElement as HTMLElement | null;
  if (!current || !items.includes(current)) {
    items[0].focus();
    return true;
  }
  const from = center(current);
  const fromRect = current.getBoundingClientRect();
  const horizontal = dir === 'left' || dir === 'right';
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of items) {
    if (el === current) continue;
    const c = center(el);
    const dx = c.x - from.x;
    const dy = c.y - from.y;
    // Only items whose centre lies in that direction.
    const ahead = dir === 'left' ? -dx : dir === 'right' ? dx : dir === 'up' ? -dy : dy;
    if (ahead <= 1) continue;
    // Rank by the gap between the edges, not the centres, so a wide card
    // right below isn't skipped for a small one further down.
    const r = el.getBoundingClientRect();
    const primary = Math.max(
      0,
      dir === 'left' ? fromRect.left - r.right : dir === 'right' ? r.left - fromRect.right : dir === 'up' ? fromRect.top - r.bottom : r.top - fromRect.bottom,
    );
    const sideGap = horizontal
      ? Math.max(0, fromRect.top - r.bottom, r.top - fromRect.bottom)
      : Math.max(0, fromRect.left - r.right, r.left - fromRect.right);
    // "Beam": items in the same row (left/right) or column (up/down) always win
    // over items off to the side, so e.g. right along a header reaches its end.
    const inBeam = sideGap === 0;
    const centreOffset = horizontal ? Math.abs(dy) : Math.abs(dx);
    const score = primary + sideGap * 2 + centreOffset * 0.01 + (inBeam ? 0 : 100_000);
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  if (!best) return false;
  best.focus();
  return true;
}

function center(el: HTMLElement): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

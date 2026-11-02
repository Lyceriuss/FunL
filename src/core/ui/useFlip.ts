import { useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * Smooth "make room" motion: elements marked `data-flip="<key>"` inside the
 * container glide from where they were to where they are now (FLIP). Works
 * across parents (tray → row) because positions are tracked by key.
 *
 * Positions are layout offsets (not bounding boxes), so a running animation's
 * transform never retriggers itself; it's safe to call on every frame. The
 * container must be positioned (e.g. `position: relative`).
 */
export function useFlip(container: RefObject<HTMLElement | null>, opts: { duration?: number } = {}): void {
  const last = useRef(new Map<string, { x: number; y: number }>());
  const duration = opts.duration ?? 180;
  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    const next = new Map<string, { x: number; y: number }>();
    root.querySelectorAll<HTMLElement>('[data-flip]').forEach((el) => {
      const key = el.dataset.flip!;
      let x = 0;
      let y = 0;
      let e: HTMLElement | null = el;
      while (e && e !== root) {
        x += e.offsetLeft;
        y += e.offsetTop;
        e = e.offsetParent as HTMLElement | null;
      }
      next.set(key, { x, y });
      const prev = last.current.get(key);
      if (prev && (Math.abs(prev.x - x) > 1 || Math.abs(prev.y - y) > 1) && typeof el.animate === 'function') {
        el.animate([{ translate: `${prev.x - x}px ${prev.y - y}px` }, { translate: '0 0' }], {
          duration,
          easing: 'cubic-bezier(.2, .9, .3, 1.12)',
        });
      }
    });
    last.current = next;
  });
}

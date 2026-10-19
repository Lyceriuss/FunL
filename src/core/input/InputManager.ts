import {
  baseScheme,
  type Action,
  type ActionEvent,
  type ControlScheme,
  type InputDevice,
  type NavDirection,
} from './types';
import { getLogger } from '../log/logger';

const log = getLogger('input');

/** Every physical input, mapped or not. Used for telemetry (misclicks etc). */
export interface RawInputEvent {
  device: InputDevice;
  t: number;
  /** e.g. "Key:7", "Pad:0", "Stick:left", "Pointer" */
  source: string;
  /** Whether the input resolved to an action / hit an interactive element. */
  mapped: boolean;
  /** Pointer only: viewport coordinates and what was hit. */
  x?: number;
  y?: number;
  target?: string;
}

type ActionListener = (e: ActionEvent) => void;
type RawListener = (e: RawInputEvent) => void;

const NAV_REPEAT_DELAY = 380;
const NAV_REPEAT_INTERVAL = 130;
const STICK_THRESHOLD = 0.55;

/**
 * Central input hub. Owns the keyboard, gamepad and pointer listeners and
 * translates physical input to actions using the active ControlScheme.
 *
 * Touch/mouse UI elements (on-screen keypads, buttons) call `dispatch()`
 * directly so all devices end up in the same action stream.
 */
export class InputManager {
  private scheme: ControlScheme = baseScheme;
  private actionListeners: ActionListener[] = [];
  private rawListeners = new Set<RawListener>();
  private padPrev: boolean[] = [];
  private navHold: { dir: NavDirection; source: string; next: number } | null = null;
  private rafId = 0;
  private attached = false;
  lastDevice: InputDevice = 'keyboard';
  gamepadId: string | null = null;

  attach(win: Window = window): void {
    if (this.attached) return;
    this.attached = true;
    win.addEventListener('keydown', this.onKeyDown);
    win.addEventListener('pointerdown', this.onPointerDown, { capture: true });
    win.addEventListener('gamepadconnected', this.onPadConnected);
    win.addEventListener('gamepaddisconnected', this.onPadDisconnected);
    const loop = () => {
      // Schedule first: an exception from an action handler must never kill
      // gamepad polling (it would silently freeze the controller).
      this.rafId = win.requestAnimationFrame(loop);
      try {
        this.pollGamepads();
      } catch (err) {
        log.error('gamepad poll failed', err);
      }
    };
    this.rafId = win.requestAnimationFrame(loop);
  }

  detach(win: Window = window): void {
    if (!this.attached) return;
    this.attached = false;
    win.removeEventListener('keydown', this.onKeyDown);
    win.removeEventListener('pointerdown', this.onPointerDown, { capture: true });
    win.removeEventListener('gamepadconnected', this.onPadConnected);
    win.removeEventListener('gamepaddisconnected', this.onPadDisconnected);
    win.cancelAnimationFrame(this.rafId);
  }

  setScheme(scheme: ControlScheme): void {
    if (scheme.id !== this.scheme.id) log.debug('control scheme changed', { from: this.scheme.id, to: scheme.id });
    this.scheme = scheme;
  }

  getScheme(): ControlScheme {
    return this.scheme;
  }

  /**
   * Subscribe to actions. Listeners form a stack: only the most recently
   * added listener receives actions, so an overlay (e.g. a pause menu)
   * naturally captures input from the screen beneath it.
   */
  onAction(listener: ActionListener): () => void {
    this.actionListeners.push(listener);
    return () => {
      this.actionListeners = this.actionListeners.filter((l) => l !== listener);
    };
  }

  onRaw(listener: RawListener): () => void {
    this.rawListeners.add(listener);
    return () => this.rawListeners.delete(listener);
  }

  /** Emit an action from UI code (touch keypad etc). */
  dispatch(action: Action, device: InputDevice, source: string): void {
    this.lastDevice = device;
    const e: ActionEvent = { action, device, t: performance.now(), source };
    this.actionListeners[this.actionListeners.length - 1]?.(e);
  }

  private emitRaw(e: RawInputEvent): void {
    this.lastDevice = e.device;
    for (const l of this.rawListeners) l(e);
  }

  private onKeyDown = (ev: KeyboardEvent): void => {
    const target = ev.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

    const action = this.scheme.keyboard[ev.key];
    const source = `Key:${ev.key}`;
    if (ev.repeat && (!action || action.type !== 'nav')) return;
    this.emitRaw({ device: 'keyboard', t: performance.now(), source, mapped: !!action });
    if (!action) return;
    ev.preventDefault();
    this.dispatch(action, 'keyboard', source);
  };

  private onPointerDown = (ev: PointerEvent): void => {
    const el = ev.target as HTMLElement | null;
    const hitEl = el?.closest?.('[data-hit], button, a, input, select, textarea') as HTMLElement | null;
    const device: InputDevice =
      ev.pointerType === 'touch' ? 'touch' : ev.pointerType === 'pen' ? 'pen' : 'mouse';
    this.emitRaw({
      device,
      t: performance.now(),
      source: 'Pointer',
      mapped: !!hitEl,
      x: Math.round(ev.clientX),
      y: Math.round(ev.clientY),
      target: hitEl?.dataset.hit ?? hitEl?.tagName.toLowerCase() ?? el?.className?.toString().slice(0, 40),
    });
  };

  private onPadConnected = (ev: GamepadEvent): void => {
    this.gamepadId = ev.gamepad.id;
    log.info('gamepad connected', { id: ev.gamepad.id, mapping: ev.gamepad.mapping, buttons: ev.gamepad.buttons.length });
    if (ev.gamepad.mapping !== 'standard') {
      log.warn('gamepad has non-standard mapping; buttons may be mislabelled', { id: ev.gamepad.id });
    }
  };

  private onPadDisconnected = (ev: GamepadEvent): void => {
    log.info('gamepad disconnected', { id: ev.gamepad.id });
    this.gamepadId = null;
    this.padPrev = [];
    this.navHold = null;
  };

  private pollGamepads(): void {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = Array.from(pads).find((p): p is Gamepad => !!p && p.connected);
    if (!pad) return;
    const now = performance.now();

    let heldNav: { dir: NavDirection; source: string } | null = null;

    pad.buttons.forEach((b, i) => {
      const pressed = b.pressed || b.value > 0.5;
      const was = this.padPrev[i] ?? false;
      this.padPrev[i] = pressed;
      const action = this.scheme.gamepadButtons[i];
      if (pressed && action?.type === 'nav') heldNav = { dir: (action as { dir: NavDirection }).dir, source: `Pad:${i}` };
      if (pressed && !was) {
        const source = `Pad:${i}`;
        this.emitRaw({ device: 'gamepad', t: now, source, mapped: !!action });
        if (action) {
          this.dispatch(action, 'gamepad', source);
          if (action.type === 'nav') {
            this.navHold = { dir: (action as { dir: NavDirection }).dir, source, next: now + NAV_REPEAT_DELAY };
          }
        }
      }
    });

    if (this.scheme.stickAsNav && !heldNav) {
      const [x = 0, y = 0] = pad.axes;
      let dir: NavDirection | null = null;
      if (Math.abs(x) > Math.abs(y) && Math.abs(x) > STICK_THRESHOLD) dir = x > 0 ? 'right' : 'left';
      else if (Math.abs(y) > STICK_THRESHOLD) dir = y > 0 ? 'down' : 'up';
      if (dir) {
        heldNav = { dir, source: `Stick:${dir}` };
        if (!this.navHold || this.navHold.source !== heldNav.source) {
          this.emitRaw({ device: 'gamepad', t: now, source: heldNav.source, mapped: true });
          this.dispatch({ type: 'nav', dir }, 'gamepad', heldNav.source);
          this.navHold = { ...heldNav, next: now + NAV_REPEAT_DELAY };
        }
      }
    }

    // Auto-repeat for held directions.
    const held = heldNav as { dir: NavDirection; source: string } | null;
    if (!held) {
      this.navHold = null;
    } else if (this.navHold && this.navHold.source === held.source && now >= this.navHold.next) {
      this.dispatch({ type: 'nav', dir: held.dir }, 'gamepad', held.source);
      this.navHold.next = now + NAV_REPEAT_INTERVAL;
    }
  }
}

/** App-wide instance. */
export const input = new InputManager();

import type { Action } from '../../input/types';

/** Actions for entering a number answer; shared by all math games. */
export const NumberAction = {
  digit: (value: number): Action => ({ type: 'math.digit', value }),
  backspace: { type: 'math.backspace' } as Action,
  submit: { type: 'math.submit' } as Action,
  /** Controller: type the digit selected on the radial dial. */
  press: { type: 'math.press' } as Action,
};

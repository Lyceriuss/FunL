/**
 * Mental-math model: how people actually work out a sum in their head.
 *
 * A problem is an Expr (a chain of one operation, e.g. 3 + 6 + 4). A
 * Strategy turns it into a list of reasoning Steps, the way a child (or an
 * adult) would think it through: "6 + 4 = 10", "10 + 3 = 13". Strategies
 * also know their typical *slips*, which produce a wrong answer through
 * visibly wrong reasoning.
 */

export type Op = '+' | '-' | '×' | '÷';

/** A chain of one operation, evaluated left to right: terms[0] op terms[1] op … */
export interface Expr {
  op: Op;
  terms: number[];
}

/** A calculation shown in a step: terms op … = result. */
export interface Calc {
  terms: number[];
  op: Op;
  result: number;
}

export type StepKind =
  /** A plan or observation: "8 needs 2 to make 10". */
  | 'plan'
  /** A worked calculation: "6 + 4 = 10". */
  | 'calc'
  /** A known fact pulled from memory: "I know 7 × 8 = 56". */
  | 'recall'
  /** The conclusion: "So it's 5". */
  | 'answer';

export interface Step {
  kind: StepKind;
  /** What the thinker says/thinks, ready to show in a thought bubble. */
  say: string;
  calc?: Calc;
  /** The value of this step (for calc/recall/answer). */
  value?: number;
  /**
   * A value worth writing down to come back to later (the "note" in the
   * thought-bubble + note system), e.g. the 70 in 70 + 15.
   */
  note?: number;
  /** This step is where the reasoning went wrong. */
  slip?: boolean;
}

/** A typical way a strategy goes wrong. */
export interface Slip {
  id: string;
  /** First-person, child-friendly: "I counted one too many" (or built from the problem). */
  label: string | ((e: Expr) => string);
}

export type Tier = 1 | 2 | 3;

export interface Strategy {
  id: string;
  /** Name for grown-ups/teachers: "Bridge through ten". */
  name: string;
  /** Short child-facing name: "Make 10". */
  label: string;
  op: Op;
  /**
   * 1 = first strategies children use (counting), 2 = known-fact based
   * (make ten, doubles, jumps), 3 = fluent/efficient (grouping, column
   * methods, derived facts, instant recall).
   */
  tier: Tier;
  description: string;
  applies(e: Expr): boolean;
  /**
   * The reasoning steps: correct when `slip` is omitted, otherwise the
   * reasoning with that slip (null if the slip can't happen for this problem).
   */
  run(e: Expr, slip?: string, rng?: () => number): Step[] | null;
  slips: Slip[];
}

/** The outcome of thinking a problem through. */
export interface Reasoning {
  expr: Expr;
  strategy: string;
  strategyLabel: string;
  steps: Step[];
  answer: number;
  correct: boolean;
  slip?: { id: string; label: string };
}

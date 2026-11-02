import { z } from 'zod';

/**
 * Data contracts for the math module. These are the shapes an MCP server
 * (or a teacher tool) produces to populate the game, e.g. from a scanned
 * pen-and-paper worksheet. Everything is validated before use.
 */

export const OpSchema = z.enum(['+', '-', '×', '÷']);
export type Op = z.infer<typeof OpSchema>;

const int = z.number().int();

/** How to randomly generate problems for one operation. */
export const OpRuleSchema = z.object({
  op: OpSchema,
  a: z.object({ min: int.min(0), max: int.min(0) }),
  b: z.object({ min: int.min(0), max: int.min(0) }),
  /** Restrict b to these values (e.g. [2, 5, 10] for selected times tables). */
  bValues: z.array(int.min(0)).optional(),
  maxAnswer: int.optional(),
  weight: z.number().positive().optional(),
  /** Number of terms (default 2). Only for '+': e.g. 3 gives "3 + 6 + 4". */
  terms: int.min(2).max(4).optional(),
  /** For 3+ terms: make sure two of the numbers add up to 10 (practise "find a 10"). */
  makeTen: z.boolean().optional(),
});
export type OpRule = z.infer<typeof OpRuleSchema>;

export const LevelConfigSchema = z.object({
  name: z.string(),
  rules: z.array(OpRuleSchema).min(1),
  /** Time for an equation to travel from monster to player. */
  travelMs: int.min(1500),
  /** Correct answers needed to defeat this level's monster. */
  hitsToDefeat: int.min(1),
  /** How many equations can fly at once (1–4). */
  lanes: int.min(1).max(4).optional(),
});
export type LevelConfig = z.infer<typeof LevelConfigSchema>;

/** A single fixed problem, e.g. transcribed from a worksheet. */
export const PackProblemSchema = z.object({
  a: int,
  op: OpSchema,
  b: int,
  /** Optional; computed if omitted. Validated against a/op/b if given. */
  answer: int.optional(),
});

/** A fixed set of problems, e.g. "Emma's homework, week 42". */
export const MathPackSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  problems: z.array(PackProblemSchema).min(1),
  order: z.enum(['sequence', 'shuffle']).default('shuffle'),
  travelMs: int.min(1500).default(12000),
  /** Speed-up factor applied after each correct answer (0.95 = 5% faster). */
  speedUp: z.number().min(0.5).max(1).default(0.95),
  /** How many equations can fly at once (1–4). */
  lanes: int.min(1).max(4).default(1),
});
export type MathPack = z.infer<typeof MathPackSchema>;
export type MathPackInput = z.input<typeof MathPackSchema>;

export interface MathProblem {
  /** Stable key, e.g. "7×8" or "3+6+4", useful for per-fact analysis. */
  key: string;
  /** First two terms (kept for convenience); see `terms` for all of them. */
  a: number;
  op: Op;
  b: number;
  /** All terms, left to right: a op b op … */
  terms: number[];
  answer: number;
  text: string;
}

export function solve(a: number, op: Op, b: number): number {
  switch (op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '×':
      return a * b;
    case '÷':
      if (b === 0) throw new Error('Division by zero');
      return a / b;
  }
}

export function makeProblem(a: number, op: Op, b: number, ...more: number[]): MathProblem {
  const terms = [a, b, ...more];
  const answer = terms.slice(1).reduce((acc, t) => solve(acc, op, t), a);
  return { key: terms.join(op), a, op, b, terms, answer, text: terms.join(` ${op} `) };
}

/** Parse and validate a pack; throws a readable error if invalid. */
export function parseMathPack(input: unknown): MathPack {
  const pack = MathPackSchema.parse(input);
  pack.problems.forEach((p, i) => {
    if (p.op === '÷' && (p.b === 0 || p.a % p.b !== 0)) {
      throw new Error(`Problem ${i + 1} (${p.a} ÷ ${p.b}) must divide evenly`);
    }
    const real = solve(p.a, p.op, p.b);
    if (real < 0) throw new Error(`Problem ${i + 1} has a negative answer`);
    if (p.answer !== undefined && p.answer !== real) {
      throw new Error(`Problem ${i + 1}: ${p.a} ${p.op} ${p.b} is ${real}, not ${p.answer}`);
    }
  });
  return pack;
}

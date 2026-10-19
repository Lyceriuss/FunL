/**
 * The spirits of Lumora: the creatures the player fights, purifies and can
 * befriend. This file is the source of truth for creature lore; see
 * docs/lore/WORLD.md for the setting.
 *
 * Each creature has 5 forms, shown one per round of an encounter:
 *   0 Corrupted → 1 Cracking → 2 Wavering → 3 Softened → 4 True form.
 * Round 5 is the boss round: the true form, still wearing the last shard of
 * Static. Breaking it purifies the spirit.
 */

export type CreatureShape = 'fox' | 'sprout' | 'dragon' | 'axolotl' | 'storm';

/** [hue 0-360, saturation %, lightness %] */
export type Hsl = readonly [number, number, number];

export interface CreatureForm {
  /** Name shown on the HP bar for this form. */
  title: string;
  /** Line shown on the banner when this form appears. */
  line: string;
}

export interface Creature {
  id: string;
  /** True name, learned when purified. */
  name: string;
  /** Short title once purified, e.g. "Moon Fox". */
  epithet: string;
  element: 'Moon' | 'Forest' | 'Fire' | 'Water' | 'Storm';
  shape: CreatureShape;
  colors: {
    /** Glow of the Static while corrupted. */
    corruptGlow: Hsl;
    /** Body colour in true form. */
    body: Hsl;
    /** Ears/frills/accents in true form. */
    accent: Hsl;
    /** Iris colour in true form. */
    eye: Hsl;
  };
  forms: readonly [CreatureForm, CreatureForm, CreatureForm, CreatureForm, CreatureForm];
  /** Shown when the last shard breaks. */
  purifiedLine: string;
  /** What they say when asked to come along. */
  befriendLine: string;
  personality: string[];
  /** Backstory paragraphs, unlocked in the Spirit Journal once purified. */
  story: string[];
  /** Body build: 'elder' is taller and slimmer, with calmer eyes. */
  build?: 'young' | 'elder';
  /** Lines in practice mode (classroom). */
  practice: {
    /** Said at the start of a lesson. */
    hello: string;
    /** Said when the lesson ends and it improved. */
    improved: string;
    /** Said once it has mastered maths at normal speed. */
    mastered: string;
  };
}

export const CREATURES: readonly Creature[] = [
  {
    id: 'nyx',
    name: 'Nyx',
    epithet: 'Moon Fox',
    element: 'Moon',
    shape: 'fox',
    build: 'young',
    colors: { corruptGlow: [275, 100, 62], body: [255, 60, 86], accent: [285, 70, 74], eye: [265, 80, 55] },
    forms: [
      { title: 'Eclipse Fang', line: 'Something howls where the moon should be…' },
      { title: 'Cracking Fang', line: 'The Static is cracking! A silver light leaks through.' },
      { title: 'Flickering Fox', line: 'His growl sounds almost like a yawn now.' },
      { title: 'Moonlit Fox', line: "He tilts his head. He's listening to the song." },
      { title: 'Nyx, Shard-Bound', line: 'One last shard of Static clings on. Break it!' },
    ],
    purifiedLine: 'Nyx remembers his name!',
    befriendLine: '"You found the right answers in the dark. Can I count the stars with you?"',
    personality: ['Shy at first', 'Loves riddles', "Myx's little brother", 'His tails glow when you get it right'],
    story: [
      'Every night, Nyx counted the stars of Lumora so that none of them would wander off and get lost. He knew each one by number, and the stars loved him for it. His big brother Myx taught him how.',
      'When the Static rolled in, it scrambled his counting. Stars blinked out one after another, and Nyx grew afraid of the very dark he used to watch over. Fear turned into fangs, and the gentle little fox became the Eclipse Fang.',
      'Now that his mind is clear again, Nyx is relearning the sky, one star at a time. He is quiet, curious and very good at puzzles, but he still gets the hard sums wrong sometimes. Practising with you helps. If you are stuck, he will sit next to you and wait. He never rushes anyone.',
    ],
    practice: {
      hello: 'Nyx sharpens his pencil. "I\'ll try my best!"',
      improved: '"I think I\'m getting faster! Can we practise again soon?"',
      mastered: '"I can count every star again. Thank you for teaching me!"',
    },
  },
  {
    id: 'myx',
    name: 'Myx',
    epithet: 'Crescent Fox',
    element: 'Moon',
    shape: 'fox',
    build: 'elder',
    colors: { corruptGlow: [218, 100, 60], body: [222, 38, 70], accent: [196, 55, 78], eye: [42, 90, 52] },
    forms: [
      { title: 'Umbra Howler', line: 'A howl splits the night. Something big is hunting…' },
      { title: 'Cracking Howler', line: 'He keeps looking past you. Is he searching for someone?' },
      { title: 'Restless Fox', line: 'His ears twitch at every sound, like a worried big brother.' },
      { title: 'Silver Fox', line: 'A crescent mark is glowing on his forehead.' },
      { title: 'Myx, Shard-Bound', line: 'The last shard holds on tight. Set him free!' },
    ],
    purifiedLine: 'Myx remembers his name, and his little brother!',
    befriendLine: '"You freed Nyx before me? Then I owe you twice. Let me walk with you, and I\'ll keep you both safe."',
    personality: ['Calm and protective', "Nyx's big brother", 'Knows the moon phases by heart', 'A little proud'],
    story: [
      'Myx is the older of the two moon foxes. While Nyx counted the stars, Myx kept track of the moon: thirty nights from one full moon to the next, every phase in order. He taught his little brother everything he knew.',
      'When the Static swallowed Nyx, Myx went into the dark to bring him home. He searched for so long, and shouted his brother\'s name so loudly, that the Static found him too. All that was left was a hunting howl: the Umbra Howler.',
      'Free again, Myx is calm, careful and a bit proud. He likes to get things exactly right, even if that takes a moment longer. He will never say it out loud, but he is very happy to be back with his little brother.',
    ],
    practice: {
      hello: 'Myx straightens his scarf. "Let\'s do this properly."',
      improved: '"Better. Much better. Again tomorrow?"',
      mastered: '"Every answer, right on time. Just like the moon."',
    },
  },
];

/**
 * Spirits written for later chapters, not in the game right now (the focus is
 * on Nyx and Myx). Their art shapes still exist in Creature.tsx.
 */
export const SHELVED_CREATURES: readonly Omit<Creature, 'practice'>[] = [
  {
    id: 'moss',
    name: 'Moss',
    epithet: 'Grove Sprite',
    element: 'Forest',
    shape: 'sprout',
    colors: { corruptGlow: [95, 100, 50], body: [120, 45, 78], accent: [140, 55, 55], eye: [30, 60, 40] },
    forms: [
      { title: 'Thornmaw', line: 'The roots twist. Thorns burst from the ground!' },
      { title: 'Splintered Thornmaw', line: "The thorns are snapping off. There's green underneath!" },
      { title: 'Tangled Sprite', line: 'A tiny leaf uncurls on its head.' },
      { title: 'Budding Sprite', line: 'It hums a sleepy little tune between swipes.' },
      { title: 'Moss, Shard-Bound', line: 'The last shard is choking the roots. Free them!' },
    ],
    purifiedLine: 'Moss blooms. A flower for you!',
    befriendLine: '"Mmm… you make things grow. Can I nap in your backpack? I\'ll help, I promise."',
    personality: ['Sleepy and gentle', 'Hums when happy', 'Grows a flower when proud of you'],
    story: [
      'Moss planted every forest in Lumora by counting: three petals here, five there, eight leaves on a branch, thirteen seeds in a cone. The patterns made the woods strong.',
      'The Static tangled the patterns. Petals came out wrong, branches grew backwards, and the roots knotted into thorns. The more Moss tried to fix things, the more it hurt, until all that was left was the snapping Thornmaw.',
      'Free again, Moss is slow, kind and always a little bit sleepy. It is the best listener in the Vale, and somehow, wherever you go with it, small green things start to sprout.',
    ],
  },
  {
    id: 'pip',
    name: 'Pip',
    epithet: 'Hearth Dragon',
    element: 'Fire',
    shape: 'dragon',
    colors: { corruptGlow: [14, 100, 55], body: [24, 90, 72], accent: [45, 95, 60], eye: [15, 80, 45] },
    forms: [
      { title: 'Cinder Wyrm', line: 'The air burns. A Wyrm of cinders rises!' },
      { title: 'Smouldering Wyrm', line: 'Its flames are flickering. Keep it up!' },
      { title: 'Sputtering Drake', line: 'It tried to roar and hiccuped a spark.' },
      { title: 'Warm Little Drake', line: 'Its wings are getting… stubby? And kind of cute?' },
      { title: 'Pip, Shard-Bound', line: 'The final shard is fuelling the fire. Put it out!' },
    ],
    purifiedLine: 'Pip is back, and so excited!',
    befriendLine: '"WOW you were SO fast! Can I come?? I can keep you warm! I can toast things!"',
    personality: ['Bouncy and brave', 'Talks very fast', 'Hiccups sparks when excited'],
    story: [
      'Pip kept the hearth-fires of the mountain villages burning at exactly the right heat: enough to bake bread, never enough to burn the bakery. It took careful measuring, and Pip was proud of it.',
      'The Static made the fires forget their measure. Flames leapt too high, and Pip, trying to hold them all back at once, swallowed so much fire that it became the roaring Cinder Wyrm.',
      'Now Pip is small, warm and endlessly enthusiastic. It wants to race, to try, to try again, and it is never sad about a wrong answer for long. "Okay, again!" is its favourite phrase.',
    ],
  },
  {
    id: 'tide',
    name: 'Tide',
    epithet: 'Lagoon Axolotl',
    element: 'Water',
    shape: 'axolotl',
    colors: { corruptGlow: [190, 100, 50], body: [340, 70, 85], accent: [330, 80, 70], eye: [200, 70, 35] },
    forms: [
      { title: 'Abyss Lurker', line: 'Something rises from the black water…' },
      { title: 'Rippling Lurker', line: 'The water is clearing. Pink shows through the dark!' },
      { title: 'Drifting Axolotl', line: 'It blew a bubble. By accident, probably.' },
      { title: 'Smiling Axolotl', line: "It's… smiling? It's definitely smiling." },
      { title: 'Tide, Shard-Bound', line: 'The last shard drags it toward the deep. Pull it back!' },
    ],
    purifiedLine: 'Tide floats up into the light!',
    befriendLine: '"Breathe in… breathe out. You did well. Shall we go on together, at your pace?"',
    personality: ['Calm and wise', 'Blows bubbles when thinking', 'Gives good advice'],
    story: [
      'Tide counted the tides of the Lagoon: in and out, high and low, so that the sea always knew when to come and when to go. Fishers and turtles alike set their days by Tide.',
      'The Static pulled the tides out of rhythm and dragged Tide down into the deep, where it is cold and dark and nobody counts anything at all. Down there it became the Abyss Lurker.',
      'Back in the shallows, Tide is the calmest spirit in Lumora. It reminds you to breathe, it never minds waiting, and it believes that slow and steady usually beats fast and wobbly.',
    ],
  },
  {
    id: 'zib',
    name: 'Zib',
    epithet: 'Storm Sprite',
    element: 'Storm',
    shape: 'storm',
    colors: { corruptGlow: [55, 100, 55], body: [50, 95, 78], accent: [200, 90, 65], eye: [220, 70, 45] },
    forms: [
      { title: 'Storm Ravager', line: 'Thunder cracks! The Ravager screams across the sky!' },
      { title: 'Crackling Ravager', line: 'Its lightning is stuttering!' },
      { title: 'Static Sprite', line: "It's talking really fast. Is that… a joke?" },
      { title: 'Spark Sprite', line: 'Its antennae are curling into little stars.' },
      { title: 'Zib, Shard-Bound', line: 'The last shard is jamming its signal. Clear it!' },
    ],
    purifiedLine: 'Zib zips free!',
    befriendLine: '"Fastest-answers-I-ever-saw! Partners? Partners! Let\'s GO!"',
    personality: ['Hyper and funny', 'Loves speed rounds', 'Never stops talking'],
    story: [
      "Zib carried messages between the clouds of Lumora faster than anyone. A raindrop here, a gust there: Zib knew where every message went and exactly how long it would take.",
      'When the Static arrived, every message turned to noise. Zib tried to shout over it, louder and louder, until the shouting was all that was left: the screaming Storm Ravager.',
      "Clear-headed again, Zib is a blur of jokes and sparks. It loves a challenge, especially a fast one, and will cheer for you so loudly that the clouds rumble.",
    ],
  },
];

export function getCreature(id: string): Creature | undefined {
  return CREATURES.find((c) => c.id === id);
}

/** Colour of a creature at a given form (0–4): from Static glow to true colours. */
export function glowColor(c: Creature, form: number): string {
  const t = Math.max(0, Math.min(1, form / 4));
  return hsl(lerpHsl(c.colors.corruptGlow, c.colors.accent, t));
}

export function lerpHsl(a: Hsl, b: Hsl, t: number): Hsl {
  // Shortest way round the hue circle.
  let dh = b[0] - a[0];
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  return [(a[0] + dh * t + 360) % 360, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function hsl([h, s, l]: Hsl, alpha = 1): string {
  return alpha < 1 ? `hsl(${h.toFixed(0)} ${s.toFixed(0)}% ${l.toFixed(0)}% / ${alpha})` : `hsl(${h.toFixed(0)} ${s.toFixed(0)}% ${l.toFixed(0)}%)`;
}

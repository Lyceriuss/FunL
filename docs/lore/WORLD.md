# Lore: the world of Lumora

> The creature data (names, forms, lines, stories) lives in code at `src/modules/math-monster/creatures.ts`, which is the source of truth. This page covers the setting and the rules writers should follow. Update both together.

## The setting

Long ago, everything in **Lumora** moved to the **Numbersong**. Rivers counted their stones, forests grew their petals in patterns, stars kept their places, and tides came and went on time. Spirits tended each part of the song.

Then came **the Static**: a grey, buzzing noise that scrambles the song. Spirits caught in it forget their names and their purpose. Their confusion turns into fear, and their fear turns into fangs, thorns and storms. These are the "monsters".

The player is a **Tuner**: someone who can find the true answer fast. Every correct answer strikes a clear note of the Numbersong. Enough clear notes and the Static cracks. Each crack lets more of the real spirit show through, which is why the creatures get cuter round by round. The last piece of Static clings on as a **shard**, and breaking it (the boss round) **purifies** the spirit. A purified spirit remembers its name and may choose to travel with the Tuner.

## The spirits

The game currently focuses on **two brothers**, the moon foxes:

| Spirit | Element | Corrupted as | Purpose in the Numbersong | Personality when freed |
|---|---|---|---|---|
| **Nyx** (he), Moon Fox, *little brother* | Moon | Eclipse Fang | counted the stars so none got lost | shy, curious, loves riddles, patient. Still gets hard sums wrong |
| **Myx** (he), Crescent Fox, *big brother* | Moon | Umbra Howler | kept track of the moon's phases (30 nights, every phase in order) | calm, protective, a bit proud, likes things exactly right |

**The brothers' story:** Myx taught Nyx to count. When the Static swallowed Nyx, Myx went into the dark to bring him home, searched and shouted his name for so long that the Static caught him too. The player frees Nyx first and Myx second, so Myx's befriend line thanks the player for saving his brother.

**Shelved for later chapters** (data kept in `SHELVED_CREATURES`; art shapes still in the renderer): Moss (Grove Sprite, patterns), Pip (Hearth Dragon, measuring), Tide (Lagoon Axolotl, adding/taking away), Zib (Storm Sprite, speed).

## The classroom (practice mode)

Freed spirits remember who they are, but not everything they knew. The Static scrambled their maths. In the **classroom**, the Tuner and their companion practise together: each finished lesson gives the companion back a little of its Numbersong (a mastery star). At five stars it counts as well as it did before the Static. They sit side by side, each working on their own column of the chalkboard. Lessons climb in stages, and passing one opens the next.

- Companions **think out loud**: their thought bubbles show how they work a sum out (counting on, making ten…). As they regain their Numbersong they move from counting to clever shortcuts.
- Companions are learners, not teachers: they **must** make believable mistakes before mastery, and they react with feelings (😢 when wrong, 😅 when out of time, ✨ when right).
- Practice lines (`creature.practice`: `hello`, `improved`, `mastered`) are in the companion's voice and stay encouraging.

## The five forms

| Form | Round | Name pattern | Look |
|---|---|---|---|
| 0 Corrupted | 1 | *Eclipse Fang* | dark body, glowing slit eyes, jagged maw, claws, spiky Static aura, veins |
| 1 Cracking | 2 | *Cracking Fang* | same, less extreme, Static starting to break |
| 2 Wavering | 3 | *Flickering Fox* | colour returning, almond eyes, a single fang, stubby paws |
| 3 Softened | 4 | *Moonlit Fox* | true colours, big anime eyes, blush, tiny smile |
| 4 True form | 5 (boss) | *Nyx, Shard-Bound* → **Nyx** | cutest form; during the boss round it still wears the shard crown |

## Writing rules

- **Kind, never cruel.** Spirits are scared or confused, never evil. The player is *freeing* them, not hurting them.
- **Short lines.** Banner lines are one sentence that a 7-year-old can read in about 2 seconds.
- **Every spirit has a maths purpose** in the Numbersong. Its story explains how the Static broke that purpose.
- **Befriend lines** are in the spirit's own voice, and say something about how the child played (fast, careful, brave…).
- **Stories** are 3 paragraphs: who they were, what the Static did, who they are now.

## Adding a spirit

(While the focus is on the two brothers, new spirits go into `SHELVED_CREATURES` until a chapter introduces them.)


1. Add an entry to `CREATURES` in `creatures.ts`: 5 forms, lines, story, colours, `practice` lines and optionally `build: 'elder'`. The spirit test checks the shape of the data.
2. Pick an existing `shape`, or add one to `CreatureShape` and draw its parts in `Creature.tsx` (`backParts` / `headParts`).
3. Check it in the dev gallery (`npm run dev`, then open `/?gallery`).
4. Add it to the table above and add a patch note.

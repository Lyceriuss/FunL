@AGENTS.md

## Claude-specific notes

- Start each task by reading the docs linked from AGENTS.md for the area you touch. Don't re-derive architecture from the code.
- Verify UI changes in a real browser before reporting them done. Headless Edge works here via `playwright-core` with `channel: 'msedge'` (install it in a scratch directory, not in this project). The Gamepad API can be faked by overriding `navigator.getGamepads` in an init script.
- Keep the docs-in-the-same-change rule from AGENTS.md. Stale docs are worse than none for the next agent.

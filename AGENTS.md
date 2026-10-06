# AGENTS.md

## Project

Pirate Battle is a technical challenge for a Junior React position.

It is a browser-based 2D top-down naval shooter built with:

- React
- TypeScript (strict)
- PixiJS
- TanStack Query
- Axios
- MSW
- Playwright

The project must remain understandable and explainable by a Junior React developer.

## Development principles

- Prefer simple, explicit solutions over clever abstractions.
- Do not overengineer.
- Do not introduce new libraries unless clearly necessary.
- Do not introduce Redux, Zustand, ECS frameworks, physics engines, or dependency injection frameworks.
- Preserve the existing architecture unless there is a clear reason to change it.
- Make small, focused changes.
- Do not refactor unrelated code while implementing a feature.

## React and PixiJS responsibilities

React is responsible for:

- screens
- menus
- forms
- dialogs
- remote-data UI

PixiJS/game code is responsible for:

- arena rendering
- ships
- projectiles
- effects
- gameplay indicators
- continuous gameplay simulation

Continuous gameplay state must NOT live in React state.

React must NOT rerender every frame.

## Game architecture

Keep clear separation between:

- game simulation/rules
- rendering
- input
- React UI
- remote API state

Gameplay simulation must be time-based and independent of rendering frame rate.

Gameplay tuning values must come from the typed GameConfig snapshot created when a match starts.

Avoid hardcoded gameplay constants inside systems when they belong in GameConfig.

## Assets

Use the official assets provided under:

`public/assets`

Prefer the supplied ships, tiles, projectiles, effects, HUD, controls, menus and sounds.

Keep asset paths centralized instead of scattering string paths throughout the code.

Do not replace provided artwork with external assets unless necessary.

## Code quality

- TypeScript strict mode must remain enabled.
- Avoid `any` unless absolutely necessary.
- Clean up event listeners, animation loops, Pixi resources and timers.
- Code must work correctly with React Strict Mode.
- Keep names and code documentation in English.
- Keep the browser console free of unhandled errors.

## Validation

After meaningful implementation changes, run:

- `npm run typecheck`
- `npm run build`
- `npm run lint`

Fix errors introduced by the change before considering the task complete.

## Working with Codex

Before modifying code:

1. Inspect the relevant existing files.
2. Understand how the current implementation works.
3. Make the smallest coherent change needed.

Do not implement features outside the requested task.

After modifying code, report:

- files changed
- what was implemented
- important architectural decisions
- tests/checks performed
- known limitations or remaining issues

## Priority

Because this is a time-limited technical challenge, prioritize:

1. Correct playable gameplay
2. PixiJS architecture and lifecycle
3. Clear and maintainable code
4. UI and responsiveness
5. API integration
6. Automated tests
7. Polish

A smaller working implementation is preferable to a large broken or unnecessarily complex implementation.

## Development journal

After every meaningful implementation task, update `DEV_NOTES_PTBR.md`.

The journal must:

- be written in Brazilian Portuguese;
- document only functionality that actually exists;
- explain important decisions in simple terms;
- include relevant concepts and interview questions;
- identify whether work was Manual, Codex, Trae, or Collaborative;
- highlight concepts the developer should review before the interview.

Do not turn it into a verbose line-by-line changelog.

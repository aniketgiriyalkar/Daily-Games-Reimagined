# Daily Games Reimagined

An offline-first collection of short, polished logic games for Aniket Giriyalkar's portfolio. Queens-Reimagined and Mini Sudoku-Reimagined are live; Tango, Zip, Patches, Wend, Crossclimb, and Pinpoint follow as independent static apps in the same workspace.

## Queens-Reimagined

- Daily deterministic puzzle rotating through 6×6, 7×7, and 8×8 boards at midnight Eastern.
- Unlimited practice boards at Easy, Medium, and Hard.
- Seeded connected-region generator with an exact unique-solution validator.
- Touch, mouse, and keyboard play with undo, clear, hints, auto-check, and optional automatic X marks.
- Device-local progress, streaks, settings, and best practice times; no account or network required.
- Static export configured for `/games/queens-reimagined/` on GitHub Pages.

## Development

```bash
npm install
npm run dev
npm run check
```

The production artifact is generated in `out/`. The portfolio repository vendors that artifact into `public/games/queens-reimagined/` before its own static build.

## Mini Sudoku-Reimagined

- 6×6 daily Sudoku with deterministic Eastern-time rollover.
- Relaxed, Focused, and Expert practice modes with uniquely solvable boards.
- Notes, hints, duplicate checking, undo, keyboard controls, local progress, and streaks.
- Static export in `apps/mini-sudoku/out/`, configured for `/games/mini-sudoku-reimagined/`.

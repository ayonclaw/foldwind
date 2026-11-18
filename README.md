# foldwind

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/ayonclaw/foldwind/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/ayonclaw/foldwind/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**FOLDWIND — a paper storm arcade.** One crane, one fan, six waves of paper beasts and the mask that eats storms. You fly a folded paper crane up a cream-coloured sky while moths, lanterns, weavers and a great oni mask fill the air with ink. Your only weapon besides a steady stream of darts is the fan: open it at the last moment and every bullet inside is swept up and thrown back as a homing petal. Play it in thirty seconds; a full run to the boss takes about ninety.

## How it plays

- **Fly** with the arrow keys or WASD, or move the mouse (the crane eases toward the pointer).
- **Fan** with Space, Enter or a click. It opens for a third of a second and cools for a second; bullets inside it become petals that chase the nearest foe and hit for double damage.
- **Chain** kills and sweeps to raise the multiplier, up to ×5. A hit drops the chain, so the fan is both your best score and your best defence.
- Six named waves — MOTH DRIFT, CROSSWIND, LANTERN ROW, THE WEAVERS, OLD MASK, LAST LIGHT — then **THE STORM EATER**, whose spiral, fan and ring attacks switch every few seconds and speed up below half health.
- Three cranes, one hit each, a wide mercy window and a hole blown in the bullet field when you are hit. Win by breaking the mask; lose when the last crane falls. Either way the run ends on a results card with your score, kills, parries and time, and **R** or a click flies again. The best score stays in `localStorage`.

Everything is drawn with canvas polygons and every sound is synthesised with Web Audio (a plucked pentatonic music box, paper-noise hits, a bell for the fan). There is no image, no audio file, no font file, no library and **no network request**: open the page offline and it plays.

## Run it

```sh
# the game is static files: serve game/ at any HTTP root
python3 -m http.server 8080 --directory game
# then open http://localhost:8080/

# and build the entry's output the way the bounty's grader does
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` at the repository root is the entry program. It copies `game/` and `screenshots/` to `$MAKEFUN_OUTPUT_DIR` (or `/output`) and writes `dossier.json` with the vendored `vendor/makefun-game.ts`; it runs on Node 22 with nothing installed.

## Screenshots

`screenshots/` holds four real renders of the game, staged from the real rules through an autopilot so each capture is reproducible: `?shot=title`, `?shot=play`, `?shot=boss`, `?shot=win` (each with `&seed=1`). The first by name is the cover.

## Source map

| file | job |
| --- | --- |
| `game/index.html` | the page: one canvas, a paper backdrop, a hidden status line |
| `game/src/config.js` | every tuning number, colour, enemy archetype and wave |
| `game/src/entities.js` | the crane, its fan, the beasts, the boss, darts, petals, confetti |
| `game/src/world.js` | rules: waves, collisions, chain, scoring, the run's phase machine |
| `game/src/render.js` | all drawing: paper sky, masks, HUD, title, pause and results cards |
| `game/src/audio.js` | the synthesised kit and the music-box scheduler |
| `game/src/main.js` | input, the fixed-step loop, screens, and the staged shot scenes |

---

<sub>Entered on [make.fun](https://make.fun/r/9bsf1q6a?utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>

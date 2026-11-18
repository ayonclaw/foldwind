// FOLDWIND — the entry program, at the repository root where the grader runs it:
// `node /bot/main.ts`, with the repository read-only and $MAKEFUN_OUTPUT_DIR (or
// /output) writable.
//
// The game is ./game: plain static files (index.html and its ES modules) that a
// desktop browser opens offline, with no library, no build step and no request. This
// program hands the entry in: it copies game/ and screenshots/ to the output directory
// and writes dossier.json with the vendored make.fun library, under the scorer's caps.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The repository root is this file's own directory: /bot in the grader, the clone here.
const root = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(root, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(root, 'screenshots'))) {
  cpSync(join(root, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's caps (reference/gate.json). text_max_bytes shapes the dossier's text; the
// others refuse an entry the scorer would refuse: more than 4 screenshots or one over
// 256 KiB, more than 993 entries or 48 MiB under game/, or a path under game/ over 1000
// bytes, beside /output's own 1000-entry cap shared with screenshots/ and dossier.json.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

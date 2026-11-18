// Boot, input and the one loop.
//
// The page is a single canvas. Four screens share it — title, play, game over and
// victory — and a pause folds over play. Input is read every frame, the world advances
// in fixed 1/60 s slices, and the renderer paints the result.
//
// ?shot=title|play|boss|win (with &seed=N) stages that exact scene from the real rules
// through an autopilot, paints it twice and sets window.__shotReady, so a screenshot is
// reproducible. ?seed=N fixes the run's randomness for ordinary play too.
import { BEST_KEY, FIELD, MUTE_KEY, STEP } from './config.js';
import { createAudio } from './audio.js';
import { createWorld } from './world.js';
import { createRenderer, SCREEN as VIEW } from './render.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : (Math.random() * 4294967296) >>> 0;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(seed);
const renderer = createRenderer(canvas);
const audio = createAudio();

const keys = new Set();
const pointer = { x: FIELD.width / 2, y: FIELD.height / 2, active: -Infinity };
let screen = VIEW.TITLE;
let staged = null;
let best = readBest();
let muted = readMuted();
let elapsed = 0;
let accumulator = 0;
let last = performance.now();
let lastTick = last;
let endHold = 0;
let started = false;
let parryQueued = false;

audio.setMuted(muted);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Private windows: the best then lasts this visit.
  }
}

function readMuted() {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function saveMuted(value) {
  try {
    window.localStorage.setItem(MUTE_KEY, value ? '1' : '0');
  } catch {
    // Nothing to do: the choice simply does not survive the visit.
  }
}

function announce(message) {
  if (status) status.textContent = message;
}

function startRun() {
  world.reset();
  world.state.god = false;
  world.state.seed = seed;
  screen = VIEW.PLAY;
  endHold = 0;
  accumulator = 0;
  audio.unlock();
  audio.startMusic();
  audio.play('select');
  announce(`Wave one. ${world.state.lives} cranes.`);
}

function toTitle() {
  screen = VIEW.TITLE;
  world.reset();
  audio.stopMusic();
  announce('Title screen. Press Enter to fly.');
}

/** Best score is written the moment a run ends, win or loss. */
function recordRun() {
  if (world.state.score > best) {
    best = world.state.score;
    world.state.newBest = true;
    saveBest(best);
  }
  audio.stopMusic();
}

/** The fan's edge: keyboard first, then a mouse the player has moved recently. */
function readInput() {
  const dx = (keys.has('arrowright') || keys.has('d') ? 1 : 0) - (keys.has('arrowleft') || keys.has('a') ? 1 : 0);
  const dy = (keys.has('arrowdown') || keys.has('s') ? 1 : 0) - (keys.has('arrowup') || keys.has('w') ? 1 : 0);
  const player = world.state.player;
  let steerX = dx;
  let steerY = dy;
  const fresh = performance.now() - pointer.active < 1400;
  if (dx === 0 && dy === 0 && fresh) {
    const gapX = pointer.x - player.x;
    const gapY = pointer.y - player.y;
    if (Math.hypot(gapX, gapY) > 6) {
      const scale = 1 / (Math.hypot(gapX, gapY) || 1);
      steerX = gapX * scale;
      steerY = gapY * scale;
    }
  }
  return { dx: steerX, dy: steerY, parry: parryQueued || keys.has('parry') };
}

function togglePause() {
  if (screen === VIEW.PLAY) {
    screen = VIEW.PAUSED;
    announce('Paused. Press P to resume.');
  } else if (screen === VIEW.PAUSED) {
    screen = VIEW.PLAY;
    accumulator = 0;
    last = performance.now();
    announce('Playing.');
  }
}

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  saveMuted(muted);
  if (!muted) audio.play('select');
}

/** One fixed step of the real game, and whatever it asks the shell to do. */
function stepWorld(dt) {
  const before = world.state.phase;
  const events = world.step(dt, readInput());
  parryQueued = false;
  for (let i = 0; i < events.length; i += 1) {
    const event = events[i];
    if (event.type === 'sound') audio.play(event.name);
    else if (event.type === 'wave') {
      audio.play('wave');
      announce(`Wave ${world.state.waveIndex + 1}. ${world.state.banner === null ? '' : world.state.banner.title}.`);
    } else if (event.type === 'warning') announce('The Storm Eater arrives.');
    else if (event.type === 'boss') {
      audio.play('boss');
      announce('Boss. Sweep its bullets with the fan.');
    } else if (event.type === 'parry') world.state.parries += 1;
    else if (event.type === 'hurt') announce(`${world.state.lives} cranes left.`);
    else if (event.type === 'over') announce(`Game over. Score ${world.state.score}.`);
    else if (event.type === 'win') announce(`Victory. Score ${world.state.score}.`);
  }
  if (before !== world.state.phase && (world.state.phase === 'lost' || world.state.phase === 'won')) {
    endHold = world.state.phase === 'won' ? 1.6 : 1.1;
  }
  audio.update(dt);
}

function tick(now) {
  lastTick = now;
  const delta = Math.min((now - last) / 1000, MAX_FRAME);
  last = now;
  elapsed += delta;
  if (screen === VIEW.PLAY) {
    accumulator += delta;
    let guard = 0;
    while (accumulator >= STEP && guard < 8) {
      stepWorld(STEP);
      accumulator -= STEP;
      guard += 1;
      if (endHold > 0) {
        endHold -= STEP;
        if (endHold <= 0) {
          recordRun();
          screen = world.state.phase === 'won' ? VIEW.WIN : VIEW.OVER;
          announce(`Run over. Score ${world.state.score}. Best ${best}. Press R to fly again.`);
          break;
        }
      }
    }
  } else {
    accumulator = 0;
  }
  renderer.draw(world.state, screen, { best, muted, time: elapsed });
}

function frame(now) {
  requestAnimationFrame(frame);
  tick(now);
}

// --- staged scenes -----------------------------------------------------------

/** A simple pilot: aim at the nearest foe, slide out of a bullet's way, fan when it is close. */
function autopilot(state) {
  const player = state.player;
  let threat = null;
  let closest = 1e9;
  let near = false;
  for (let i = 0; i < state.bullets.length; i += 1) {
    const shotBullet = state.bullets[i];
    if (shotBullet.vy <= 0) continue;
    const dx = shotBullet.x - player.x;
    const dy = player.y - shotBullet.y;
    if (dy < -10 || dy > 240) continue;
    if (Math.abs(dx) > 150) continue;
    const distance = Math.hypot(dx, dy);
    if (distance < closest) {
      closest = distance;
      threat = shotBullet;
    }
    if (distance < 70) near = true;
  }
  let targetX = FIELD.width / 2;
  let bestDistance = 1e9;
  for (let i = 0; i < state.enemies.length; i += 1) {
    const enemy = state.enemies[i];
    const distance = Math.abs(enemy.x - player.x) + Math.max(0, player.y - enemy.y) * 0.2;
    if (distance < bestDistance) {
      bestDistance = distance;
      targetX = enemy.x;
    }
  }
  if (state.boss !== null && !state.boss.entering) targetX = state.boss.x;
  if (threat !== null && closest < 96 && !state.god) targetX = player.x + Math.sign(player.x - threat.x || 1) * 150;
  const dx = targetX - player.x;
  const wantY = 470 + Math.sin(state.time * 0.9) * 34;
  return {
    dx: Math.abs(dx) < 8 ? 0 : Math.sign(dx),
    dy: Math.abs(wantY - player.y) < 8 ? 0 : Math.sign(wantY - player.y),
    parry: near,
  };
}

function simulate(seconds, until) {
  const state = world.state;
  const budget = Math.round(seconds / STEP);
  for (let i = 0; i < budget; i += 1) {
    world.step(STEP, autopilot(state));
    if (until && until(state)) return true;
  }
  return false;
}

function runShot(name) {
  const state = world.state;
  world.reset();
  state.god = true;
  let scene = VIEW.TITLE;
  if (name === 'play') {
    simulate(0.1);
    for (let i = 0; i < 70 * 60; i += 1) {
      world.step(STEP, autopilot(state));
      if (state.time > 18 && state.bullets.length >= 18 && state.enemies.length >= 3) break;
    }
    scene = VIEW.PLAY;
  } else if (name === 'boss') {
    simulate(200, (s) => s.boss !== null && !s.boss.entering && s.boss.hp < s.boss.maxHp * 0.62);
    for (let i = 0; i < 4 * 60; i += 1) {
      world.step(STEP, autopilot(state));
      if (state.bullets.length >= 30) break;
    }
    scene = state.phase === 'lost' ? VIEW.OVER : VIEW.PLAY;
  } else if (name === 'win') {
    simulate(260, (s) => s.phase === 'won');
    simulate(0.9);
    scene = VIEW.WIN;
    state.newBest = true;
  } else if (name === 'over') {
    simulate(44);
    state.god = false;
    for (let i = 0; i < 40 * 60 && state.phase !== 'lost'; i += 1) {
      world.step(STEP, { dx: 0, dy: i % 120 < 60 ? 1 : 0, parry: false });
    }
    scene = VIEW.OVER;
    best = Math.max(best, state.score);
  }
  staged = scene;
  const shownBest = Math.max(best, state.score);
  // Painted twice from the same state, then flagged: the frame is the frame.
  renderer.draw(state, scene, { best: shownBest, muted: true, time: 6 });
  renderer.draw(state, scene, { best: shownBest, muted: true, time: 6.016 });
  window.__shotReady = true;
}

// --- input and lifecycle -----------------------------------------------------

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'enter'].includes(key)) event.preventDefault();
  audio.unlock();
  if (keys.has(key)) return;
  keys.add(key);
  if (key === ' ') keys.add('parry');
  if (key === ' ' || key === 'enter') parryQueued = true;
  if (key === 'm') toggleMute();
  if (key === 'p' || key === 'escape') togglePause();
  if (key === 'enter' && (screen === VIEW.TITLE || screen === VIEW.OVER || screen === VIEW.WIN)) {
    if (screen === VIEW.TITLE) startRun();
    else toTitle();
  }
  if (key === 'r' && (screen === VIEW.OVER || screen === VIEW.WIN)) startRun();
  if (key === 'enter' && screen === VIEW.PLAY) keys.add('parry');
});

window.addEventListener('keyup', (event) => {
  const key = event.key.toLowerCase();
  keys.delete(key);
  if (key === ' ') keys.delete('parry');
});

function pointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * FIELD.width,
    y: ((event.clientY - rect.top) / rect.height) * FIELD.height,
  };
}

canvas.addEventListener('pointermove', (event) => {
  const spot = pointerPosition(event);
  pointer.x = spot.x;
  pointer.y = spot.y;
  pointer.active = performance.now();
});

canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  audio.unlock();
  const spot = pointerPosition(event);
  pointer.x = spot.x;
  pointer.y = spot.y;
  pointer.active = performance.now();
  if (screen === VIEW.TITLE) startRun();
  else if (screen === VIEW.OVER || screen === VIEW.WIN) startRun();
  else if (screen === VIEW.PAUSED) togglePause();
  else keys.add('parry');
  parryQueued = true;
});

canvas.addEventListener('pointerup', () => keys.delete('parry'));
window.addEventListener('blur', () => {
  keys.clear();
  if (screen === VIEW.PLAY) togglePause();
});
window.addEventListener('resize', () => renderer.resize());
document.addEventListener('visibilitychange', () => {
  if (document.hidden && screen === VIEW.PLAY) togglePause();
});

// For the curious and for the gate's own browser check: the live state, read-only.
window.__foldwind = {
  get screen() {
    return staged ?? screen;
  },
  get score() {
    return world.state.score;
  },
  get frames() {
    return Math.round(world.state.time * 60);
  },
  get phase() {
    return world.state.phase;
  },
  world,
  start: startRun,
  stage: runShot,
};

if (shot !== null) {
  runShot(shot);
} else {
  world.reset();
  world.state.seed = seed;
  announce('Title screen. Press Enter to fly.');
  requestAnimationFrame(frame);
  // A hidden or backgrounded tab gets no animation frames at all; this keeps the run
  // honest (a few steps a second) instead of freezing it. Never two ticks at once.
  window.setInterval(() => {
    if (performance.now() - lastTick > 220) tick(performance.now());
  }, 125);
}

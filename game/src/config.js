// FOLDWIND — every tuning number and every colour in one place.
//
// The playfield is a fixed 960x640 logical rectangle; the renderer fits it to the
// window, so no rule here depends on the screen. Lengths are pixels, times are
// seconds, and speeds are pixels per second.

export const FIELD = { width: 960, height: 640 };

/** The simulation's fixed step: the world always advances in 1/60 s slices. */
export const STEP = 1 / 60;

export const PALETTE = {
  paper: '#f3e5c8',
  paperWarm: '#ecd6ae',
  paperShade: '#dcc094',
  ink: '#232840',
  inkSoft: '#46506f',
  inkFaint: '#8d93a8',
  vermilion: '#ce4a37',
  vermilionDeep: '#9e3327',
  gold: '#dfa23e',
  goldLight: '#f2cf85',
  jade: '#4d8b76',
  white: '#fffaf0',
  night: '#1a1e2f',
};

export const FONT = {
  title: 'Georgia, "Times New Roman", serif',
  body: 'system-ui, -apple-system, "Segoe UI", sans-serif',
};

export const PLAYER = {
  x: 480,
  y: 512,
  speed: 338,
  radius: 5,
  lives: 3,
  fireInterval: 0.1,
  dartSpeed: 840,
  dartDamage: 1,
  /** Seconds of blinking mercy after a hit. */
  mercy: 1.9,
  /** How far a hit pushes the ship and shakes the paper. */
  knockback: 26,
};

export const PARRY = {
  duration: 0.3,
  cooldown: 0.92,
  radius: 56,
  damage: 2,
  score: 25,
  /** Petals are fast enough to catch what the fan just swept. */
  petalSpeed: 520,
  petalTurn: 7.5,
  petalLife: 2.6,
};

export const COMBO = {
  window: 2.8,
  max: 40,
  step: 0.1,
};

export const BOSS = {
  hp: 300,
  radius: 46,
  entryY: 148,
  score: 5000,
  /** Seconds a single attack pattern holds before the next. */
  patternTime: 6.5,
  warning: 2.6,
};

/** Enemy archetypes: shape, speed, hit points, score and the rhythm of their fire. */
export const ENEMIES = {
  moth: { hp: 4, radius: 15, score: 100, speed: 108, fire: 1.25, sway: 1.9 },
  lantern: { hp: 10, radius: 20, score: 220, speed: 70, fire: 1.5, sway: 0.9 },
  darter: { hp: 2, radius: 13, score: 90, speed: 265, fire: 0, sway: 0 },
  weaver: { hp: 13, radius: 22, score: 320, speed: 130, fire: 1.05, sway: 0.4 },
  mask: { hp: 26, radius: 30, score: 620, speed: 70, fire: 1.8, sway: 0.7 },
};

/**
 * The run's six waves, in order. A group is [kind, count, gap, delay]; x pins the
 * spawn column, and a group without one spreads itself evenly across the sky.
 */
export const WAVES = [
  {
    name: 'MOTH DRIFT',
    note: 'they come with the warm wind',
    groups: [['moth', 6, 0.34, 0.3], ['moth', 4, 0.42, 2.4]],
  },
  {
    name: 'CROSSWIND',
    note: 'watch the fast ones',
    groups: [['moth', 6, 0.32, 0.2], ['darter', 3, 0.62, 1.1], ['darter', 2, 0.5, 3.4]],
  },
  {
    name: 'LANTERN ROW',
    note: 'their light is loaded',
    groups: [['lantern', 2, 1.1, 0.3, 300], ['lantern', 2, 1.0, 1.4, 660], ['moth', 5, 0.34, 2.2]],
  },
  {
    name: 'THE WEAVERS',
    note: 'cut the threads early',
    groups: [['weaver', 2, 1.3, 0.2, 230], ['weaver', 1, 1, 2.0, 730], ['darter', 4, 0.45, 1.2], ['moth', 5, 0.3, 3.2]],
  },
  {
    name: 'OLD MASK',
    note: 'a bigger shadow',
    groups: [['mask', 1, 1, 0.4, 480], ['moth', 6, 0.34, 1.0], ['lantern', 2, 1.2, 2.4, 330]],
  },
  {
    name: 'LAST LIGHT',
    note: 'everything at once',
    groups: [['weaver', 2, 1.0, 0.2, 210], ['lantern', 2, 0.9, 1.4, 700], ['darter', 4, 0.4, 2.2], ['moth', 6, 0.28, 3.4]],
  },
];

export const BEST_KEY = 'foldwind.best.v1';
export const MUTE_KEY = 'foldwind.muted.v1';

/** The boss's three attacks, cycled; the second half of the fight runs them faster. */
export const BOSS_PATTERNS = ['spiral', 'fans', 'walls'];

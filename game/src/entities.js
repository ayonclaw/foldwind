// Everything that moves and shoots: the crane, the paper beasts, the storm mask,
// the darts, the petals a parry turns bullets into, and the little drifting confetti.
// Each update takes the world so it can spawn bullets, score kills and raise events;
// nothing here draws.
import { BOSS, BOSS_PATTERNS, COMBO, ENEMIES, FIELD, PARRY, PLAYER } from './config.js';

const TAU = Math.PI * 2;

/** Aim from a point at the ship, in the standard canvas angle (0 right, PI/2 down). */
export function aimAt(world, x, y) {
  const player = world.player;
  return Math.atan2(player.y - y, player.x - x);
}

export function createPlayer() {
  return {
    x: PLAYER.x,
    y: PLAYER.y,
    radius: PLAYER.radius,
    vx: 0,
    vy: 0,
    fireT: 0.2,
    parryT: 0,
    parryCd: 0,
    mercy: 1.2,
    wing: 0,
    bank: 0,
    alive: true,
  };
}

/** Lay one enemy bullet into the world. `kind` only changes how it is drawn and how big it is. */
export function bullet(world, x, y, angle, speed, kind) {
  const radius = kind === 'ring' ? 7 : kind === 'ink' ? 5 : 4;
  world.bullets.push({
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    r: radius,
    kind,
    spin: world.rng() * TAU,
    age: 0,
  });
}

export function fan(world, x, y, base, count, spread, speed, kind) {
  for (let i = 0; i < count; i += 1) {
    const angle = base + (i - (count - 1) / 2) * spread;
    bullet(world, x, y, angle, speed, kind);
  }
}

/** A short spray of paper scraps and one ink ring: the shared look of a kill. */
export function burst(world, x, y, count, color, power) {
  for (let i = 0; i < count; i += 1) {
    const angle = world.prng() * TAU;
    const speed = (40 + world.prng() * 150) * power;
    world.particles.push({
      kind: 'scrap',
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.5 + world.prng() * 0.6,
      max: 1.1,
      size: 2 + world.prng() * 5,
      rot: world.prng() * TAU,
      spin: (world.prng() - 0.5) * 12,
      color,
    });
  }
  world.particles.push({ kind: 'ring', x, y, vx: 0, vy: 0, life: 0.42, max: 0.42, size: 12, rot: 0, spin: 0, color });
}

export function spawnEnemy(world, kind, column) {
  const stats = ENEMIES[kind];
  const x = column === null || column === undefined ? 110 + world.rng() * (FIELD.width - 220) : column;
  const enemy = {
    kind,
    x,
    y: -46,
    homeX: x,
    vx: 0,
    vy: stats.speed,
    r: stats.radius,
    hp: stats.hp,
    maxHp: stats.hp,
    score: stats.score,
    fireT: 0.6 + world.rng() * 0.9,
    t: 0,
    phase: world.rng() * TAU,
    hurt: 0,
    dead: false,
  };
  world.enemies.push(enemy);
  return enemy;
}

export function damageEnemy(world, enemy, amount) {
  enemy.hp -= amount;
  enemy.hurt = 0.12;
  if (enemy.hp > 0) {
    world.play('hit');
    return;
  }
  enemy.dead = true;
  world.killEnemy(enemy);
}

/** Split the fan open: every bullet inside it becomes a petal aimed at the nearest foe. */
export function openParry(world) {
  const player = world.player;
  player.parryT = PARRY.duration;
  player.parryCd = PARRY.cooldown;
  world.events.push({ type: 'parry' });
  world.parries += 1;
  let swept = 0;
  for (let i = world.bullets.length - 1; i >= 0; i -= 1) {
    const shot = world.bullets[i];
    const dx = shot.x - player.x;
    const dy = shot.y - player.y;
    if (dx * dx + dy * dy > PARRY.radius * PARRY.radius) continue;
    world.bullets.splice(i, 1);
    spawnPetal(world, shot.x, shot.y);
    swept += 1;
  }
  if (swept > 0) {
    player.parryT = PARRY.duration + Math.min(0.18, swept * 0.02);
    world.addScore(swept * PARRY.score, player.x, player.y - 40);
    world.chain(swept);
    world.play('parry');
  }
}

export function spawnPetal(world, x, y) {
  const target = world.nearestFoe(x, y);
  world.petals.push({
    x,
    y,
    vx: (world.prng() - 0.5) * 160,
    vy: -240,
    r: 5,
    life: PARRY.petalLife,
    target,
    angle: -Math.PI / 2,
    spin: world.prng() * TAU,
  });
}

export function updatePlayer(world, input, dt) {
  const player = world.player;
  if (!player.alive) return;
  const length = Math.hypot(input.dx, input.dy) || 1;
  const wantX = input.dx / length;
  const wantY = input.dy / length;
  // Heavy paper: it leans into a turn instead of snapping to it.
  player.vx += (wantX * PLAYER.speed - player.vx) * Math.min(1, dt * 18);
  player.vy += (wantY * PLAYER.speed - player.vy) * Math.min(1, dt * 18);
  if (player.parryT > 0) {
    player.vx *= 0.55;
    player.vy *= 0.55;
  }
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  player.x = Math.max(22, Math.min(FIELD.width - 22, player.x));
  player.y = Math.max(84, Math.min(FIELD.height - 26, player.y));
  player.bank += (Math.max(-1, Math.min(1, player.vx / PLAYER.speed)) - player.bank) * Math.min(1, dt * 9);
  player.wing += dt * (5 + Math.hypot(player.vx, player.vy) / 90);
  player.mercy = Math.max(0, player.mercy - dt);
  player.parryT = Math.max(0, player.parryT - dt);
  player.parryCd = Math.max(0, player.parryCd - dt);

  if (input.parry && player.parryCd <= 0) openParry(world);

  player.fireT -= dt;
  if (player.fireT <= 0 && world.phase !== 'won') {
    player.fireT = PLAYER.fireInterval;
    const offset = Math.sin(player.wing * 0.5) * 2;
    world.darts.push({ x: player.x - 7, y: player.y - 16 + offset, vx: 0, vy: -PLAYER.dartSpeed, dmg: PLAYER.dartDamage });
    world.darts.push({ x: player.x + 7, y: player.y - 16 + offset, vx: 0, vy: -PLAYER.dartSpeed, dmg: PLAYER.dartDamage });
    if (world.combo >= 12) {
      world.darts.push({ x: player.x, y: player.y - 22, vx: 0, vy: -PLAYER.dartSpeed * 1.1, dmg: PLAYER.dartDamage + 1 });
    }
    world.play('shoot');
  }
}

export function updateEnemy(world, enemy, dt) {
  enemy.t += dt;
  enemy.hurt = Math.max(0, enemy.hurt - dt);
  const stats = ENEMIES[enemy.kind];

  if (enemy.kind === 'moth') {
    enemy.y += enemy.vy * dt;
    enemy.x = enemy.homeX + Math.sin(enemy.t * stats.sway + enemy.phase) * 78;
    enemy.fireT -= dt;
    if (enemy.fireT <= 0 && enemy.y > 30 && enemy.y < FIELD.height - 120) {
      enemy.fireT = stats.fire;
      bullet(world, enemy.x, enemy.y + 10, aimAt(world, enemy.x, enemy.y), 168, 'seed');
    }
  } else if (enemy.kind === 'lantern') {
    const rest = 132 + (enemy.phase % 1) * 56;
    if (enemy.y < rest) enemy.y += enemy.vy * dt;
    else enemy.y = rest + Math.sin(enemy.t * 1.1 + enemy.phase) * 16;
    enemy.fireT -= dt;
    if (enemy.fireT <= 0 && enemy.y > 40) {
      enemy.fireT = stats.fire;
      fan(world, enemy.x, enemy.y + 12, aimAt(world, enemy.x, enemy.y), 3, 0.3, 136, 'ink');
    }
  } else if (enemy.kind === 'darter') {
    if (enemy.t < 0.9) {
      const want = aimAt(world, enemy.x, enemy.y);
      const current = Math.atan2(enemy.vy, enemy.vx);
      let delta = want - current;
      while (delta > Math.PI) delta -= TAU;
      while (delta < -Math.PI) delta += TAU;
      const angle = current + Math.max(-2.6 * dt, Math.min(2.6 * dt, delta));
      enemy.vx = Math.cos(angle) * stats.speed;
      enemy.vy = Math.sin(angle) * stats.speed;
    }
    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;
  } else if (enemy.kind === 'weaver') {
    if (enemy.y < 112 + (enemy.phase % 1) * 40) {
      enemy.y += 130 * dt;
    } else if (enemy.vx === 0) {
      enemy.vx = enemy.homeX > FIELD.width / 2 ? -stats.speed : stats.speed;
    } else {
      enemy.x += enemy.vx * dt;
      enemy.fireT -= dt;
      if (enemy.fireT <= 0) {
        enemy.fireT = stats.fire;
        const base = enemy.phase + enemy.t * 0.8;
        fan(world, enemy.x, enemy.y, base, 6, TAU / 6, 132, 'ring');
      }
    }
  } else if (enemy.kind === 'mask') {
    if (enemy.y < 128) enemy.y += enemy.vy * dt;
    else {
      enemy.x = enemy.homeX + Math.sin(enemy.t * 0.6 + enemy.phase) * 120;
      enemy.fireT -= dt;
      if (enemy.fireT <= 0) {
        enemy.fireT = stats.fire;
        fan(world, enemy.x, enemy.y + 16, aimAt(world, enemy.x, enemy.y), 5, 0.22, 150, 'ink');
        world.play('bigkill');
      }
    }
  }

  const offBottom = enemy.y > FIELD.height + 60;
  const offSide = enemy.x < -110 || enemy.x > FIELD.width + 110;
  if (offBottom || offSide) enemy.dead = true;
}

export function spawnBoss(world) {
  world.boss = {
    x: FIELD.width / 2,
    y: -110,
    r: BOSS.radius,
    hp: BOSS.hp,
    maxHp: BOSS.hp,
    t: 0,
    entering: true,
    pattern: 0,
    patternT: 0,
    fireT: 0.8,
    minionT: 4.5,
    hurt: 0,
    gap: 0,
    dead: false,
  };
  world.events.push({ type: 'boss' });
}

export function updateBoss(world, boss, dt) {
  boss.t += dt;
  boss.hurt = Math.max(0, boss.hurt - dt);
  if (boss.entering) {
    boss.y += 120 * dt;
    if (boss.y >= BOSS.entryY) {
      boss.y = BOSS.entryY;
      boss.entering = false;
      boss.patternT = 0;
    }
    return;
  }
  const rage = boss.hp < boss.maxHp * 0.45;
  boss.x = FIELD.width / 2 + Math.sin(boss.t * 0.42) * 250;
  boss.y = BOSS.entryY + Math.sin(boss.t * 0.9) * 20;
  boss.patternT += dt;
  if (boss.patternT > (rage ? BOSS.patternTime * 0.78 : BOSS.patternTime)) {
    boss.patternT = 0;
    boss.pattern = (boss.pattern + 1) % BOSS_PATTERNS.length;
    boss.fireT = 0.35;
    world.events.push({ type: 'pattern' });
  }
  const speed = rage ? 1.2 : 1;
  boss.fireT -= dt;
  if (boss.fireT > 0) return;
  const kind = BOSS_PATTERNS[boss.pattern];
  if (kind === 'spiral') {
    boss.fireT = 0.085 / speed;
    boss.gap += 0.31;
    for (let arm = 0; arm < 3; arm += 1) {
      const angle = boss.gap + (arm * TAU) / 3;
      bullet(world, boss.x, boss.y, angle, 150 * speed, arm === 0 ? 'ring' : 'ink');
    }
  } else if (kind === 'fans') {
    boss.fireT = 0.62 / speed;
    fan(world, boss.x, boss.y + 20, aimAt(world, boss.x, boss.y), 9, 0.155, 186 * speed, 'seed');
  } else {
    boss.fireT = 1.02 / speed;
    const slots = 24;
    const gapStart = Math.floor((boss.t * 4) % slots);
    for (let i = 0; i < slots; i += 1) {
      // One doorway, four bullets wide, that walks around the ring.
      const gapDistance = Math.min((i - gapStart + slots) % slots, (gapStart - i + slots) % slots);
      if (gapDistance < 3) continue;
      const angle = (i / slots) * TAU + boss.t * 0.2;
      bullet(world, boss.x, boss.y, angle, 118 * speed, 'ink');
    }
  }
  boss.minionT -= dt;
  if (boss.minionT <= 0) {
    boss.minionT = 7.2;
    spawnEnemy(world, 'moth', 120);
    spawnEnemy(world, 'moth', FIELD.width - 120);
  }
}

export function addCombo(world) {
  world.combo = Math.min(COMBO.max, world.combo + 1);
  world.comboT = COMBO.window;
}

export function multiplier(world) {
  return 1 + Math.min(COMBO.max, world.combo) * COMBO.step;
}

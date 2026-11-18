// The rules of the storm: waves, collisions, scoring, the chain, and the run's
// phase machine (wave, breather, boss warning, boss, won, lost). The renderer reads
// this state; the loop writes only the player's input into it.
import { BOSS, COMBO, ENEMIES, FIELD, PALETTE, PLAYER, PARRY, WAVES } from './config.js';
import {
  addCombo,
  burst,
  createPlayer,
  damageEnemy,
  multiplier,
  spawnBoss,
  spawnEnemy,
  updateBoss,
  updateEnemy,
  updatePlayer,
} from './entities.js';

/** mulberry32: a small, fast, seedable generator so a seed always gives the same run. */
export function createRandom(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KILL_COLOUR = {
  moth: PALETTE.inkSoft,
  lantern: PALETTE.vermilion,
  darter: PALETTE.jade,
  weaver: PALETTE.jade,
  mask: PALETTE.vermilionDeep,
};

export function createWorld(seed) {
  const world = {
    rng: createRandom(seed),
    prng: createRandom(seed ^ 0x9e3779b9),
    player: createPlayer(),
    enemies: [],
    bullets: [],
    darts: [],
    petals: [],
    particles: [],
    boss: null,
    phase: 'between',
    waveIndex: -1,
    betweenT: 1.1,
    waveT: 0,
    warnT: 0,
    schedule: [],
    spawned: 0,
    score: 0,
    combo: 0,
    comboT: 0,
    lives: PLAYER.lives,
    banner: null,
    shake: 0,
    time: 0,
    kills: 0,
    parries: 0,
    events: [],
    god: false,
    newBest: false,
  };

  const api = {
    /** Back to a fresh run: used at boot, on restart and before every staged screenshot. */
    reset() {
      world.player = createPlayer();
      world.enemies.length = 0;
      world.bullets.length = 0;
      world.darts.length = 0;
      world.petals.length = 0;
      world.particles.length = 0;
      world.boss = null;
      world.phase = 'between';
      world.waveIndex = -1;
      world.betweenT = 1.15;
      world.waveT = 0;
      world.schedule.length = 0;
      world.spawned = 0;
      world.score = 0;
      world.combo = 0;
      world.comboT = 0;
      world.lives = PLAYER.lives;
      world.banner = null;
      world.shake = 0;
      world.time = 0;
      world.kills = 0;
      world.parries = 0;
      world.events.length = 0;
      world.newBest = false;
      world.rng = createRandom(world.seed);
      world.prng = createRandom(world.seed ^ 0x9e3779b9);
      return world;
    },
    get state() {
      return world;
    },
    play(name) {
      world.events.push({ type: 'sound', name });
    },
    addScore(points, x, y) {
      world.score += points;
      if (x !== undefined) {
        world.particles.push({
          kind: 'text',
          x,
          y,
          vx: 0,
          vy: -34,
          life: 0.8,
          max: 0.8,
          size: 13,
          rot: 0,
          spin: 0,
          color: PALETTE.ink,
          text: `+${points}`,
        });
      }
    },
    chain(count) {
      for (let i = 0; i < count; i += 1) addCombo(world);
    },
    nearestFoe(x, y) {
      let best = null;
      let bestDistance = Infinity;
      for (let i = 0; i < world.enemies.length; i += 1) {
        const enemy = world.enemies[i];
        if (enemy.dead) continue;
        const distance = (enemy.x - x) ** 2 + (enemy.y - y) ** 2;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = enemy;
        }
      }
      if (world.boss !== null && !world.boss.entering && !world.boss.dead) {
        const distance = (world.boss.x - x) ** 2 + (world.boss.y - y) ** 2;
        if (distance < bestDistance) best = world.boss;
      }
      return best;
    },
    killEnemy(enemy) {
      const points = Math.round(enemy.score * multiplier(world));
      api.addScore(points, enemy.x, enemy.y - 14);
      addCombo(world);
      world.kills += 1;
      burst(world, enemy.x, enemy.y, enemy.kind === 'mask' ? 22 : 11, KILL_COLOUR[enemy.kind] ?? PALETTE.ink, enemy.kind === 'mask' ? 1.5 : 1);
      api.play(enemy.kind === 'mask' || enemy.kind === 'lantern' ? 'bigkill' : 'kill');
    },
    damageBoss(boss, amount) {
      if (boss.dead) return;
      boss.hp -= amount;
      boss.hurt = 0.1;
      if (boss.hp > 0) {
        world.score += 5;
        return;
      }
      boss.dead = true;
      api.addScore(Math.round(BOSS.score * multiplier(world)), boss.x, boss.y);
      world.bullets.length = 0;
      for (let i = 0; i < 9; i += 1) {
        burst(world, boss.x + (world.prng() - 0.5) * 130, boss.y + (world.prng() - 0.5) * 90, 16, i % 2 ? PALETTE.vermilion : PALETTE.gold, 1.6);
      }
      world.shake = 1.4;
      api.play('bigkill');
      world.phase = 'won';
      world.events.push({ type: 'win' });
      world.particles.push({ kind: 'text', x: boss.x, y: boss.y - 30, vx: 0, vy: -20, life: 1.6, max: 1.6, size: 26, rot: 0, spin: 0, color: PALETTE.vermilion, text: 'THE STORM BREAKS' });
    },
    spawnAt(kind, column) {
      return spawnEnemy(world, kind, column);
    },
  };

  world.seed = seed;
  world.play = api.play;
  world.addScore = api.addScore;
  world.chain = api.chain;
  world.nearestFoe = api.nearestFoe;
  world.killEnemy = api.killEnemy;
  world.damageBoss = api.damageBoss;

  function startWave(index) {
    const wave = WAVES[index];
    world.waveIndex = index;
    world.schedule.length = 0;
    world.spawned = 0;
    world.waveT = 0;
    world.phase = 'wave';
    for (let g = 0; g < wave.groups.length; g += 1) {
      const [kind, count, gap, delay, column] = wave.groups[g];
      for (let i = 0; i < count; i += 1) {
        let x = column;
        if (x !== undefined && count > 1) x = column + (i - (count - 1) / 2) * 190;
        world.schedule.push({ t: (delay ?? 0.3) + i * gap, kind, x: x ?? null });
      }
    }
    world.schedule.sort((a, b) => a.t - b.t);
    world.banner = { title: wave.name, note: wave.note, life: 2.5, max: 2.5 };
    world.events.push({ type: 'wave' });
  }

  function endWave() {
    if (world.waveIndex >= WAVES.length - 1) {
      world.phase = 'warning';
      world.warnT = BOSS.warning;
      world.banner = { title: 'THE STORM EATER', note: 'hold the centre', life: BOSS.warning, max: BOSS.warning };
      world.events.push({ type: 'warning' });
    } else {
      world.phase = 'between';
      world.betweenT = 1.5;
    }
  }

  function hurtPlayer() {
    if (world.god) return;
    const player = world.player;
    if (player.mercy > 0) return;
    world.lives -= 1;
    world.combo = 0;
    world.comboT = 0;
    world.shake = 1;
    world.events.push({ type: 'hurt' });
    world.play('hurt');
    // The fan's echo clears a hole and the crane re-enters from the bottom.
    for (let i = world.bullets.length - 1; i >= 0; i -= 1) {
      const shot = world.bullets[i];
      if (Math.hypot(shot.x - player.x, shot.y - player.y) < 210) {
        world.bullets.splice(i, 1);
        burst(world, shot.x, shot.y, 2, PALETTE.inkFaint, 0.5);
      }
    }
    if (world.lives <= 0) {
      player.alive = false;
      burst(world, player.x, player.y, 26, PALETTE.vermilion, 1.6);
      world.phase = 'lost';
      world.events.push({ type: 'over' });
      return;
    }
    player.x = FIELD.width / 2;
    player.y = FIELD.height - 96;
    player.vx = 0;
    player.vy = 0;
    player.mercy = PLAYER.mercy;
  }

  function collideDarts() {
    for (let d = world.darts.length - 1; d >= 0; d -= 1) {
      const dart = world.darts[d];
      let hit = false;
      for (let e = 0; e < world.enemies.length; e += 1) {
        const enemy = world.enemies[e];
        if (enemy.dead) continue;
        if (Math.hypot(enemy.x - dart.x, enemy.y - dart.y) < enemy.r + 4) {
          damageEnemy(world, enemy, dart.dmg);
          hit = true;
          break;
        }
      }
      const boss = world.boss;
      if (!hit && boss !== null && !boss.dead && !boss.entering && Math.hypot(boss.x - dart.x, boss.y - dart.y) < boss.r + 4) {
        api.damageBoss(boss, dart.dmg);
        world.particles.push({ kind: 'scrap', x: dart.x, y: dart.y, vx: (world.prng() - 0.5) * 90, vy: -60, life: 0.22, max: 0.22, size: 3, rot: 0, spin: 8, color: PALETTE.gold });
        hit = true;
      }
      if (hit || dart.y < -24) world.darts.splice(d, 1);
    }
  }

  function collidePetals(dt) {
    for (let p = world.petals.length - 1; p >= 0; p -= 1) {
      const petal = world.petals[p];
      petal.life -= dt;
      const target = petal.target;
      if (target !== null && (target.dead === true)) petal.target = null;
      if (petal.target !== null) {
        const angle = Math.atan2(petal.target.y - petal.y, petal.target.x - petal.x);
        let delta = angle - petal.angle;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        petal.angle += Math.max(-PARRY.petalTurn * dt, Math.min(PARRY.petalTurn * dt, delta));
        petal.vx = Math.cos(petal.angle) * PARRY.petalSpeed;
        petal.vy = Math.sin(petal.angle) * PARRY.petalSpeed;
      }
      petal.x += petal.vx * dt;
      petal.y += petal.vy * dt;
      petal.spin += dt * 9;
      const foe = petal.target;
      if (foe !== null && Math.hypot(foe.x - petal.x, foe.y - petal.y) < foe.r + 8) {
        if (foe === world.boss) api.damageBoss(foe, PARRY.damage);
        else damageEnemy(world, foe, PARRY.damage);
        api.addScore(PARRY.score, petal.x, petal.y - 8);
        burst(world, petal.x, petal.y, 4, PALETTE.gold, 0.6);
        world.petals.splice(p, 1);
        continue;
      }
      if (petal.life <= 0 || petal.y < -30 || petal.x < -30 || petal.x > FIELD.width + 30 || petal.y > FIELD.height + 30) {
        world.petals.splice(p, 1);
      }
    }
  }

  function collideHits() {
    const player = world.player;
    if (!player.alive || world.god) return;
    for (let i = world.bullets.length - 1; i >= 0; i -= 1) {
      const shot = world.bullets[i];
      if (Math.hypot(shot.x - player.x, shot.y - player.y) < shot.r + player.radius) {
        world.bullets.splice(i, 1);
        hurtPlayer();
        return;
      }
    }
    for (let e = world.enemies.length - 1; e >= 0; e -= 1) {
      const enemy = world.enemies[e];
      if (enemy.dead) continue;
      if (Math.hypot(enemy.x - player.x, enemy.y - player.y) < enemy.r + player.radius) {
        enemy.dead = true;
        burst(world, enemy.x, enemy.y, 12, PALETTE.vermilion, 1);
        hurtPlayer();
        return;
      }
    }
    const boss = world.boss;
    if (boss !== null && !boss.dead && !boss.entering && Math.hypot(boss.x - player.x, boss.y - player.y) < boss.r + player.radius) hurtPlayer();
  }

  function updateParticles(dt) {
    for (let i = world.particles.length - 1; i >= 0; i -= 1) {
      const particle = world.particles[i];
      particle.life -= dt;
      if (particle.life <= 0) {
        world.particles.splice(i, 1);
        continue;
      }
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.rot += particle.spin * dt;
      const drag = particle.kind === 'ring' ? 1 : 0.94;
      particle.vx *= drag;
      particle.vy *= drag;
      if (particle.kind === 'scrap') particle.vy += 210 * dt;
      if (particle.kind === 'ring') particle.size += 260 * dt;
    }
  }

  /** One fixed slice of the run. `input` is {dx, dy, parry}; the returned events feed sound and screens. */
  world.step = function step(dt, input) {
    world.events = [];
    world.time += dt;
    world.shake = Math.max(0, world.shake - dt * 2.4);
    if (world.banner !== null) {
      world.banner.life -= dt;
      if (world.banner.life <= 0) world.banner = null;
    }
    updateParticles(dt);
    if (world.phase === 'won' || world.phase === 'lost') return world.events;

    updatePlayer(world, input, dt);

    if (world.phase === 'between') {
      world.betweenT -= dt;
      if (world.betweenT <= 0) startWave(world.waveIndex + 1);
    } else if (world.phase === 'wave') {
      world.waveT += dt;
      while (world.schedule.length > 0 && world.schedule[0].t <= world.waveT) {
        const entry = world.schedule.shift();
        api.spawnAt(entry.kind, entry.x);
        world.spawned += 1;
      }
      if (world.schedule.length === 0 && world.enemies.length === 0 && world.waveT > 0.6) endWave();
    } else if (world.phase === 'warning') {
      world.warnT -= dt;
      if (world.warnT <= 0) {
        world.phase = 'boss';
        spawnBoss(world);
      }
    } else if (world.phase === 'boss' && world.boss !== null) {
      updateBoss(world, world.boss, dt);
    }

    for (let i = world.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = world.enemies[i];
      updateEnemy(world, enemy, dt);
      if (enemy.dead) world.enemies.splice(i, 1);
    }

    for (let i = world.bullets.length - 1; i >= 0; i -= 1) {
      const shot = world.bullets[i];
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.age += dt;
      shot.spin += dt * 3;
      if (shot.x < -40 || shot.x > FIELD.width + 40 || shot.y < -60 || shot.y > FIELD.height + 40) world.bullets.splice(i, 1);
    }
    if (world.bullets.length > 900) world.bullets.splice(0, world.bullets.length - 900);

    for (let i = world.darts.length - 1; i >= 0; i -= 1) {
      const dart = world.darts[i];
      dart.x += dart.vx * dt;
      dart.y += dart.vy * dt;
    }

    collideDarts();
    collidePetals(dt);
    collideHits();

    if (world.comboT > 0) {
      world.comboT -= dt;
      if (world.comboT <= 0) world.combo = 0;
    }
    return world.events;
  };

  api.step = world.step;
  api.reset();
  return api;
}

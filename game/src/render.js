// Drawing only: the world and the current screen in, paper and ink out.
//
// One fixed 960x640 canvas, scaled to the window by CSS. The sky, the mountains, the
// sun and the drifting scraps are cut from flat shapes; every beast is a handful of
// polygons, so the whole look is the game's own geometry. Panels are washi paper with
// an ink border, titles are a serif face the browser already has: no image, no font
// file, no request.
import { BOSS, COMBO, FIELD, FONT, PALETTE, PARRY, PLAYER, WAVES } from './config.js';
import { createRandom } from './world.js';

export const SCREEN = { TITLE: 'title', PLAY: 'play', PAUSED: 'paused', OVER: 'over', WIN: 'win' };

const TAU = Math.PI * 2;

function rounded(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function polygon(context, points, fill, stroke) {
  context.beginPath();
  context.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) context.lineTo(points[i][0], points[i][1]);
  context.closePath();
  if (fill) {
    context.fillStyle = fill;
    context.fill();
  }
  if (stroke) {
    context.strokeStyle = stroke;
    context.lineWidth = 2;
    context.stroke();
  }
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const fonts = new Map();
  const sky = createRandom(0x51f0);
  const ridgeFar = [];
  const ridgeNear = [];
  const scraps = [];
  const clouds = [];

  // The landscape is rolled once, from a fixed seed, so it never flickers.
  for (let i = 0; i < 9; i += 1) ridgeFar.push({ x: -60 + i * 130, h: 46 + sky() * 66, w: 130 + sky() * 70 });
  for (let i = 0; i < 7; i += 1) ridgeNear.push({ x: -80 + i * 170, h: 24 + sky() * 44, w: 190 + sky() * 90 });
  for (let i = 0; i < 26; i += 1) scraps.push({ x: sky() * FIELD.width, y: sky() * FIELD.height, s: 1.5 + sky() * 3, v: 12 + sky() * 30, r: sky() * TAU, c: sky() > 0.5 ? PALETTE.gold : PALETTE.vermilion });
  for (let i = 0; i < 5; i += 1) clouds.push({ x: sky() * FIELD.width, y: 70 + sky() * 380, w: 130 + sky() * 190, v: 5 + sky() * 9, a: 0.16 + sky() * 0.12 });

  function resize() {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(FIELD.width * ratio);
    canvas.height = Math.round(FIELD.height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.textBaseline = 'middle';
  }

  function font(size, family, weight) {
    const key = `${weight}|${size}|${family}`;
    if (!fonts.has(key)) fonts.set(key, `${weight} ${size}px ${family}`);
    return fonts.get(key);
  }

  function text(value, x, y, size, colour, align, family, weight, spacing) {
    context.font = font(size, family ?? FONT.body, weight ?? '600');
    context.fillStyle = colour;
    context.textAlign = align ?? 'left';
    if ('letterSpacing' in context) context.letterSpacing = spacing ?? '0px';
    context.fillText(value, x, y);
    if ('letterSpacing' in context) context.letterSpacing = '0px';
  }

  /** Letterpressed type: a paper-coloured shadow under an ink face. */
  function pressed(value, x, y, size, face, shadow, align, family, weight, spacing) {
    text(value, x + 2, y + 3, size, shadow, align, family, weight, spacing);
    text(value, x, y, size, face, align, family, weight, spacing);
  }

  function drawSky(time, mood) {
    const gradient = context.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, mood === 'night' ? '#2a2f47' : PALETTE.paperWarm);
    gradient.addColorStop(0.62, PALETTE.paper);
    gradient.addColorStop(1, mood === 'night' ? '#3c3a4a' : '#f7eedb');
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);

    // The sun: a red disc with ink rings that slowly breathe.
    const sunX = 724;
    const sunY = 196 + Math.sin(time * 0.18) * 5;
    context.save();
    context.globalAlpha = mood === 'night' ? 0.5 : 1;
    context.strokeStyle = 'rgba(35,40,64,0.14)';
    context.lineWidth = 1.5;
    for (let i = 0; i < 4; i += 1) {
      context.beginPath();
      context.arc(sunX, sunY, 96 + i * 22 + Math.sin(time * 0.5 + i) * 2, 0, TAU);
      context.stroke();
    }
    context.fillStyle = PALETTE.vermilion;
    context.beginPath();
    context.arc(sunX, sunY, 96, 0, TAU);
    context.fill();
    context.fillStyle = 'rgba(255,250,240,0.16)';
    context.beginPath();
    context.arc(sunX - 24, sunY - 26, 62, 0, TAU);
    context.fill();
    context.restore();

    // Clouds: long soft paper strips, drifting at their own pace.
    for (let i = 0; i < clouds.length; i += 1) {
      const cloud = clouds[i];
      const x = ((cloud.x + time * cloud.v) % (FIELD.width + 420)) - 210;
      context.fillStyle = `rgba(255,250,240,${cloud.a})`;
      rounded(context, x, cloud.y, cloud.w, 14, 7);
      context.fill();
      rounded(context, x + 30, cloud.y + 11, cloud.w * 0.6, 10, 5);
      context.fill();
    }

    // Two paper ridges; the near one slides faster, which is all the depth it needs.
    for (let pass = 0; pass < 2; pass += 1) {
      const ridge = pass === 0 ? ridgeFar : ridgeNear;
      const shift = (time * (pass === 0 ? 6 : 14)) % 260;
      const baseY = pass === 0 ? 372 : 424;
      context.fillStyle = pass === 0 ? 'rgba(70,80,111,0.22)' : 'rgba(35,40,64,0.32)';
      context.beginPath();
      context.moveTo(-80, baseY + 120);
      for (let i = 0; i < ridge.length; i += 1) {
        const peak = ridge[i];
        const x = peak.x - shift;
        context.lineTo(x, baseY - peak.h);
        context.lineTo(x + peak.w * 0.5, baseY - peak.h * 0.42);
      }
      context.lineTo(FIELD.width + 120, baseY + 120);
      context.closePath();
      context.fill();
    }
    context.fillStyle = 'rgba(120,90,50,0.06)';
    for (let i = 0; i < 260; i += 1) {
      const x = (i * 137.3) % FIELD.width;
      const y = (i * 311.7) % FIELD.height;
      context.fillRect(x, y, 1.6, 1.6);
    }
    for (let i = 0; i < scraps.length; i += 1) {
      const scrap = scraps[i];
      const y = (scrap.y + time * scrap.v) % (FIELD.height + 40);
      context.save();
      context.translate(scrap.x + Math.sin(time * 0.6 + scrap.r) * 16, y - 20);
      context.rotate(scrap.r + time * 0.6);
      context.fillStyle = scrap.c;
      context.globalAlpha = 0.55;
      context.fillRect(-scrap.s / 2, -scrap.s / 2, scrap.s, scrap.s * 0.7);
      context.restore();
    }
    context.globalAlpha = 1;
  }

  /** The player's crane, wings caught mid-beat, banking into its velocity. */
  function drawCrane(x, y, bank, wing, scale, tint) {
    context.save();
    context.translate(x, y);
    context.rotate(bank * 0.16);
    context.scale(scale, scale);
    const flap = Math.sin(wing) * 0.5;
    context.fillStyle = 'rgba(35,40,64,0.18)';
    context.beginPath();
    context.ellipse(0, 8, 16, 6, 0, 0, TAU);
    context.fill();
    // Wings: the far one darker, so the fold reads even at a glance.
    polygon(context, [[-2, -2], [-30, -10 - flap * 10], [-24, 4], [-6, 9]], tint ?? '#e6d3b3', PALETTE.ink);
    polygon(context, [[2, -2], [30, -10 - flap * 10], [24, 4], [6, 9]], PALETTE.white, PALETTE.ink);
    // Body, neck and beak.
    polygon(context, [[0, -16], [10, 0], [0, 14], [-10, 0]], PALETTE.white, PALETTE.ink);
    context.strokeStyle = PALETTE.ink;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(2, -12);
    context.lineTo(9, -24);
    context.stroke();
    polygon(context, [[9, -24], [21, -22], [10, -17]], PALETTE.vermilion, PALETTE.ink);
    polygon(context, [[-2, 8], [-15, 20], [-4, 16]], PALETTE.ink, null);
    context.restore();
  }

  function drawMoth(x, y, t, hurt) {
    const open = 0.55 + Math.sin(t * 9) * 0.3;
    context.save();
    context.translate(x, y);
    const fill = hurt > 0 ? PALETTE.white : PALETTE.inkSoft;
    polygon(context, [[-4, 0], [-24, -14 * open], [-20, 10], [-4, 8]], fill, PALETTE.ink);
    polygon(context, [[4, 0], [24, -14 * open], [20, 10], [4, 8]], fill, PALETTE.ink);
    context.fillStyle = PALETTE.gold;
    context.beginPath();
    context.arc(-13, -2, 2.6, 0, TAU);
    context.arc(13, -2, 2.6, 0, TAU);
    context.fill();
    context.fillStyle = PALETTE.ink;
    context.beginPath();
    context.ellipse(0, 2, 5, 11, 0, 0, TAU);
    context.fill();
    context.strokeStyle = PALETTE.ink;
    context.lineWidth = 1.4;
    context.beginPath();
    context.moveTo(-2, -8);
    context.quadraticCurveTo(-9, -16, -14, -15);
    context.moveTo(2, -8);
    context.quadraticCurveTo(9, -16, 14, -15);
    context.stroke();
    context.restore();
  }

  function drawLantern(x, y, t, hurt) {
    context.save();
    context.translate(x, y);
    const glow = context.createRadialGradient(0, 0, 4, 0, 0, 40);
    glow.addColorStop(0, 'rgba(223,162,62,0.55)');
    glow.addColorStop(1, 'rgba(223,162,62,0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(0, 0, 40, 0, TAU);
    context.fill();
    context.fillStyle = hurt > 0 ? PALETTE.white : PALETTE.vermilion;
    rounded(context, -17, -20, 34, 40, 12);
    context.fill();
    context.strokeStyle = PALETTE.ink;
    context.lineWidth = 2;
    context.stroke();
    context.strokeStyle = PALETTE.gold;
    context.lineWidth = 1.5;
    for (let i = -1; i <= 1; i += 1) {
      context.beginPath();
      context.moveTo(-17, i * 9);
      context.lineTo(17, i * 9);
      context.stroke();
    }
    context.fillStyle = PALETTE.ink;
    context.fillRect(-12, -24, 24, 5);
    context.fillRect(-9, 20, 18, 4);
    context.strokeStyle = PALETTE.ink;
    context.beginPath();
    context.moveTo(0, 24);
    context.lineTo(Math.sin(t * 3) * 6, 36);
    context.stroke();
    context.restore();
  }

  function drawDarter(x, y, hurt) {
    context.save();
    context.translate(x, y);
    polygon(context, [[0, 18], [-13, -8], [0, -3], [13, -8]], hurt > 0 ? PALETTE.white : PALETTE.jade, PALETTE.ink);
    context.fillStyle = PALETTE.ink;
    context.beginPath();
    context.arc(0, 4, 3, 0, TAU);
    context.fill();
    context.restore();
  }

  function drawWeaver(x, y, t, hurt) {
    context.save();
    context.translate(x, y);
    context.rotate(t * 0.8);
    const blades = 7;
    for (let i = 0; i < blades; i += 1) {
      const from = (i / blades) * TAU;
      const to = ((i + 1) / blades) * TAU;
      context.beginPath();
      context.moveTo(0, 0);
      context.arc(0, 0, 26, from, to);
      context.closePath();
      context.fillStyle = hurt > 0 ? PALETTE.white : i % 2 === 0 ? PALETTE.jade : '#3d6f5d';
      context.fill();
      context.strokeStyle = PALETTE.ink;
      context.lineWidth = 1.2;
      context.stroke();
    }
    context.fillStyle = PALETTE.paper;
    context.beginPath();
    context.arc(0, 0, 7, 0, TAU);
    context.fill();
    context.strokeStyle = PALETTE.ink;
    context.stroke();
    context.restore();
  }

  function drawMask(x, y, hurt, scale) {
    context.save();
    context.translate(x, y);
    context.scale(scale, scale);
    context.fillStyle = hurt > 0 ? PALETTE.white : PALETTE.vermilionDeep;
    polygon(context, [[-26, 2], [-20, -18], [0, -28], [20, -18], [26, 2], [12, 26], [0, 32], [-12, 26]], hurt > 0 ? PALETTE.white : PALETTE.vermilion, PALETTE.ink);
    polygon(context, [[-20, -18], [-30, -30], [-12, -26]], PALETTE.ink, null);
    polygon(context, [[20, -18], [30, -30], [12, -26]], PALETTE.ink, null);
    context.fillStyle = PALETTE.gold;
    polygon(context, [[-16, -6], [-4, -10], [-6, 2]], PALETTE.gold, PALETTE.ink);
    polygon(context, [[16, -6], [4, -10], [6, 2]], PALETTE.gold, PALETTE.ink);
    context.strokeStyle = PALETTE.ink;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(-9, 16);
    context.quadraticCurveTo(0, 22, 9, 16);
    context.stroke();
    context.beginPath();
    context.moveTo(0, -2);
    context.lineTo(0, 8);
    context.stroke();
    context.restore();
  }

  function drawBoss(boss) {
    const rage = boss.hp < boss.maxHp * 0.45;
    context.save();
    context.translate(boss.x, boss.y);
    // A ring of fan blades, turning the other way from the mask's sway.
    context.save();
    context.rotate(boss.t * (rage ? 1.1 : 0.55));
    for (let i = 0; i < 16; i += 1) {
      const angle = (i / 16) * TAU;
      context.save();
      context.rotate(angle);
      context.fillStyle = i % 2 === 0 ? 'rgba(206,74,55,0.5)' : 'rgba(35,40,64,0.35)';
      polygon(context, [[boss.r + 6, -9], [boss.r + 52, 0], [boss.r + 6, 9]], context.fillStyle, null);
      context.restore();
    }
    context.restore();
    context.strokeStyle = 'rgba(35,40,64,0.35)';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(0, 0, boss.r + 30, 0, TAU);
    context.stroke();
    // The mask itself, huge and calm until it is not.
    context.fillStyle = boss.hurt > 0 ? PALETTE.white : PALETTE.vermilionDeep;
    polygon(context, [[-52, 6], [-42, -34], [0, -56], [42, -34], [52, 6], [24, 50], [0, 62], [-24, 50]], PALETTE.vermilionDeep, PALETTE.ink);
    polygon(context, [[-40, -32], [-64, -54], [-24, -46]], PALETTE.ink, null);
    polygon(context, [[40, -32], [64, -54], [24, -46]], PALETTE.ink, null);
    context.fillStyle = rage ? PALETTE.vermilion : PALETTE.gold;
    polygon(context, [[-32, -12], [-8, -20], [-12, 6]], context.fillStyle, PALETTE.ink);
    polygon(context, [[32, -12], [8, -20], [12, 6]], context.fillStyle, PALETTE.ink);
    context.strokeStyle = PALETTE.ink;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(-20, 30);
    context.quadraticCurveTo(0, 42, 20, 30);
    context.stroke();
    for (let i = -1; i <= 1; i += 1) {
      context.beginPath();
      context.moveTo(i * 12, 26);
      context.lineTo(i * 12, 36);
      context.stroke();
    }
    context.restore();
  }

  function drawBullets(bullets) {
    for (let i = 0; i < bullets.length; i += 1) {
      const shot = bullets[i];
      if (shot.kind === 'ring') {
        context.strokeStyle = PALETTE.gold;
        context.lineWidth = 2.4;
        context.beginPath();
        context.arc(shot.x, shot.y, shot.r, 0, TAU);
        context.stroke();
        context.fillStyle = 'rgba(223,162,62,0.35)';
        context.beginPath();
        context.arc(shot.x, shot.y, shot.r - 2, 0, TAU);
        context.fill();
      } else if (shot.kind === 'ink') {
        // A paper halo keeps the ink readable when it crosses the dark ridges.
        context.fillStyle = 'rgba(255,250,240,0.55)';
        context.beginPath();
        context.arc(shot.x, shot.y, shot.r + 2.2, 0, TAU);
        context.fill();
        context.fillStyle = PALETTE.ink;
        context.beginPath();
        context.ellipse(shot.x - shot.vx * 0.012, shot.y - shot.vy * 0.012, shot.r * 1.5, shot.r * 1.12, Math.atan2(shot.vy, shot.vx), 0, TAU);
        context.fill();
        context.beginPath();
        context.arc(shot.x, shot.y, shot.r, 0, TAU);
        context.fill();
      } else {
        context.fillStyle = PALETTE.vermilion;
        context.beginPath();
        context.arc(shot.x, shot.y, shot.r, 0, TAU);
        context.fill();
        context.strokeStyle = PALETTE.vermilionDeep;
        context.lineWidth = 1.4;
        context.stroke();
        context.fillStyle = 'rgba(255,250,240,0.75)';
        context.beginPath();
        context.arc(shot.x - 1.4, shot.y - 1.4, 1.4, 0, TAU);
        context.fill();
      }
    }
  }

  function drawDarts(darts) {
    context.strokeStyle = 'rgba(35,40,64,0.85)';
    context.lineWidth = 3.2;
    context.lineCap = 'round';
    context.beginPath();
    for (let i = 0; i < darts.length; i += 1) {
      const dart = darts[i];
      context.moveTo(dart.x, dart.y + 6);
      context.lineTo(dart.x, dart.y + 26);
    }
    context.stroke();
    context.strokeStyle = PALETTE.goldLight;
    context.lineWidth = 1.2;
    context.stroke();
    context.fillStyle = PALETTE.vermilion;
    for (let i = 0; i < darts.length; i += 1) {
      polygon(context, [[darts[i].x, darts[i].y - 3], [darts[i].x + 3, darts[i].y + 4], [darts[i].x - 3, darts[i].y + 4]], PALETTE.vermilion, null);
    }
    context.lineCap = 'butt';
  }

  function drawPetals(petals) {
    for (let i = 0; i < petals.length; i += 1) {
      const petal = petals[i];
      context.save();
      context.translate(petal.x, petal.y);
      context.rotate(petal.spin);
      polygon(context, [[0, -9], [5, 0], [0, 9], [-5, 0]], PALETTE.goldLight, PALETTE.vermilionDeep);
      context.restore();
      context.strokeStyle = 'rgba(223,162,62,0.35)';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(petal.x, petal.y);
      context.lineTo(petal.x - petal.vx * 0.03, petal.y - petal.vy * 0.03);
      context.stroke();
    }
  }

  function drawParticles(particles) {
    for (let i = 0; i < particles.length; i += 1) {
      const particle = particles[i];
      const fade = Math.max(0, particle.life / particle.max);
      if (particle.kind === 'ring') {
        context.globalAlpha = fade * 0.55;
        context.strokeStyle = particle.color;
        context.lineWidth = 2;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.size, 0, TAU);
        context.stroke();
      } else if (particle.kind === 'text') {
        context.globalAlpha = Math.min(1, fade * 1.6);
        text(particle.text, particle.x, particle.y, particle.size, particle.color, 'center', FONT.title, 'bold');
      } else {
        context.globalAlpha = fade;
        context.save();
        context.translate(particle.x, particle.y);
        context.rotate(particle.rot);
        context.fillStyle = particle.color;
        context.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size * 0.65);
        context.restore();
      }
    }
    context.globalAlpha = 1;
  }

  function drawParryFan(player) {
    if (player.parryT <= 0) return;
    const life = player.parryT / PARRY.duration;
    const radius = PARRY.radius * (1.18 - life * 0.18);
    context.save();
    context.translate(player.x, player.y);
    context.globalAlpha = Math.min(1, life * 1.5);
    for (let i = 0; i < 9; i += 1) {
      const from = -Math.PI + (i / 9) * Math.PI * 2;
      const to = from + Math.PI / 9;
      context.beginPath();
      context.moveTo(0, 0);
      context.arc(0, 0, radius, from, to);
      context.closePath();
      context.fillStyle = i % 2 === 0 ? 'rgba(242,207,133,0.5)' : 'rgba(223,162,62,0.32)';
      context.fill();
      context.strokeStyle = 'rgba(158,51,39,0.55)';
      context.lineWidth = 1;
      context.stroke();
    }
    context.globalAlpha = 0.9;
    context.strokeStyle = PALETTE.vermilionDeep;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(0, 0, radius, 0, TAU);
    context.stroke();
    context.restore();
  }

  function drawPlayer(player) {
    if (!player.alive) return;
    if (player.mercy > 0 && Math.floor(player.mercy * 14) % 2 === 0) {
      context.globalAlpha = 0.4;
    }
    drawCrane(player.x, player.y, player.bank, player.wing, 1, PALETTE.paperShade);
    context.globalAlpha = 1;
    drawParryFan(player);
    // Readiness ring: an empty arc means the fan is folded and waiting.
    const ready = 1 - player.parryCd / PARRY.cooldown;
    context.strokeStyle = 'rgba(35,40,64,0.25)';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(player.x, player.y, 22, 0, TAU);
    context.stroke();
    context.strokeStyle = ready >= 1 ? PALETTE.gold : 'rgba(206,74,55,0.85)';
    context.lineWidth = 2.6;
    context.beginPath();
    context.arc(player.x, player.y, 22, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, ready));
    context.stroke();
  }

  function drawEnemies(enemies) {
    for (let i = 0; i < enemies.length; i += 1) {
      const enemy = enemies[i];
      if (enemy.kind === 'moth') drawMoth(enemy.x, enemy.y, enemy.t, enemy.hurt);
      else if (enemy.kind === 'lantern') drawLantern(enemy.x, enemy.y, enemy.t, enemy.hurt);
      else if (enemy.kind === 'darter') drawDarter(enemy.x, enemy.y, enemy.hurt);
      else if (enemy.kind === 'weaver') drawWeaver(enemy.x, enemy.y, enemy.t, enemy.hurt);
      else drawMask(enemy.x, enemy.y, enemy.hurt, 1);
      if (enemy.hp < enemy.maxHp) {
        const width = enemy.r * 2;
        context.fillStyle = 'rgba(35,40,64,0.18)';
        context.fillRect(enemy.x - width / 2, enemy.y - enemy.r - 12, width, 3);
        context.fillStyle = PALETTE.vermilion;
        context.fillRect(enemy.x - width / 2, enemy.y - enemy.r - 12, width * (enemy.hp / enemy.maxHp), 3);
      }
    }
  }

  function drawHud(state, best, muted) {
    text('SCORE', 30, 30, 11, PALETTE.inkSoft, 'left', FONT.body, '700', '3px');
    pressed(String(state.score).padStart(7, '0'), 28, 56, 30, PALETTE.ink, 'rgba(255,250,240,0.7)', 'left', FONT.title, 'bold');
    const level = 1 + Math.min(COMBO.max, state.combo) * COMBO.step;
    if (state.combo > 1) {
      pressed(`x${level.toFixed(1)}`, 30, 92, 24, PALETTE.vermilion, 'rgba(255,250,240,0.6)', 'left', FONT.title, 'bold');
      text(`CHAIN ${state.combo}`, 96, 92, 12, PALETTE.inkSoft, 'left', FONT.body, '700', '2px');
      context.fillStyle = 'rgba(35,40,64,0.2)';
      context.fillRect(96, 102, 118, 4);
      context.fillStyle = PALETTE.gold;
      context.fillRect(96, 102, 118 * Math.max(0, state.comboT / COMBO.window), 4);
    }
    text('BEST', FIELD.width - 30, 30, 11, PALETTE.inkSoft, 'right', FONT.body, '700', '3px');
    pressed(String(best).padStart(7, '0'), FIELD.width - 28, 56, 20, PALETTE.ink, 'rgba(255,250,240,0.6)', 'right', FONT.title, 'bold');
    for (let i = 0; i < state.lives; i += 1) drawCrane(FIELD.width - 42 - i * 30, 86, 0, 0, 0.44, PALETTE.paperShade);
    text(muted ? 'M · SOUND OFF' : 'M · SOUND ON', FIELD.width - 30, FIELD.height - 22, 10, 'rgba(35,40,64,0.5)', 'right', FONT.body, '700', '2px');
    if (state.waveIndex >= 0 && state.phase !== 'warning' && state.phase !== 'boss') {
      text(`WAVE ${Math.min(WAVES.length, state.waveIndex + 1)} / ${WAVES.length}`, FIELD.width / 2, FIELD.height - 22, 11, 'rgba(35,40,64,0.5)', 'center', FONT.body, '700', '3px');
    }

    const boss = state.boss;
    if (boss !== null && !boss.dead && !boss.entering) {
      const width = 420;
      const x = (FIELD.width - width) / 2;
      text('THE STORM EATER', FIELD.width / 2, 24, 11, PALETTE.inkSoft, 'center', FONT.body, '700', '4px');
      context.fillStyle = 'rgba(35,40,64,0.18)';
      context.fillRect(x, 34, width, 7);
      context.fillStyle = PALETTE.vermilionDeep;
      context.fillRect(x, 34, width * Math.max(0, boss.hp / boss.maxHp), 7);
      context.strokeStyle = 'rgba(35,40,64,0.35)';
      context.lineWidth = 1;
      context.strokeRect(x, 34, width, 7);
    }
  }

  function drawBanner(state) {
    const banner = state.banner;
    if (banner === null) return;
    const fade = Math.min(1, banner.life / 0.5);
    context.globalAlpha = fade;
    const y = 236;
    context.fillStyle = 'rgba(243,229,200,0.82)';
    context.fillRect(0, y - 42, FIELD.width, 96);
    context.fillStyle = PALETTE.ink;
    context.fillRect(0, y - 42, FIELD.width, 1.5);
    context.fillRect(0, y + 54, FIELD.width, 1.5);
    pressed(banner.title, FIELD.width / 2, y, 34, PALETTE.ink, 'rgba(255,250,240,0.7)', 'center', FONT.title, 'bold', '6px');
    text(banner.note, FIELD.width / 2, y + 32, 13, PALETTE.inkSoft, 'center', FONT.title, 'italic', '1px');
    context.globalAlpha = 1;
  }

  function panel(x, y, width, height) {
    context.fillStyle = 'rgba(35,40,64,0.35)';
    rounded(context, x + 8, y + 10, width, height, 6);
    context.fill();
    context.fillStyle = PALETTE.paper;
    rounded(context, x, y, width, height, 6);
    context.fill();
    context.strokeStyle = PALETTE.ink;
    context.lineWidth = 2.5;
    context.stroke();
    context.strokeStyle = 'rgba(35,40,64,0.3)';
    context.lineWidth = 1;
    rounded(context, x + 9, y + 9, width - 18, height - 18, 3);
    context.stroke();
    // Corner ticks, like the registration marks on a print.
    context.strokeStyle = PALETTE.vermilion;
    context.lineWidth = 2;
    const corners = [[x + 16, y + 16, 1, 1], [x + width - 16, y + 16, -1, 1], [x + 16, y + height - 16, 1, -1], [x + width - 16, y + height - 16, -1, -1]];
    for (let i = 0; i < corners.length; i += 1) {
      const [cx, cy, sx, sy] = corners[i];
      context.beginPath();
      context.moveTo(cx + sx * 14, cy);
      context.lineTo(cx, cy);
      context.lineTo(cx, cy + sy * 14);
      context.stroke();
    }
  }

  function drawTitle(state, best, time) {
    drawSky(time, 'day');
    // A second crane, larger, gliding across the paper behind the panel.
    drawCrane(196 + Math.sin(time * 0.4) * 22, 470 + Math.cos(time * 0.55) * 12, 0.28, time * 4, 2.1, PALETTE.paperShade);
    context.save();
    context.globalAlpha = 0.16;
    for (let i = 0; i < 6; i += 1) {
      context.strokeStyle = PALETTE.ink;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(806, 496, 40 + i * 22 + Math.sin(time + i) * 3, Math.PI * 1.02, Math.PI * 1.98);
      context.stroke();
    }
    context.restore();
    panel(190, 84, 580, 372);
    text('A PAPER STORM ARCADE', FIELD.width / 2, 132, 11, PALETTE.vermilion, 'center', FONT.body, '700', '6px');
    pressed('FOLDWIND', FIELD.width / 2, 196, 76, PALETTE.ink, 'rgba(206,74,55,0.35)', 'center', FONT.title, 'bold', '4px');
    text('one crane, one fan, six waves of paper beasts', FIELD.width / 2, 244, 15, PALETTE.inkSoft, 'center', FONT.title, 'italic');
    context.fillStyle = 'rgba(35,40,64,0.25)';
    context.fillRect(268, 266, 424, 1);
    const lines = [
      ['ARROWS / WASD', 'fly — or move the mouse'],
      ['SPACE / CLICK', 'open the fan: sweep bullets into petals'],
      ['P', 'pause'],
    ];
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i][0], 300, 300 + i * 30, 13, PALETTE.vermilionDeep, 'right', FONT.body, '800', '1px');
      text(lines[i][1], 322, 300 + i * 30, 13, PALETTE.inkSoft, 'left', FONT.body, '500');
    }
    const blink = 0.82 + Math.sin(time * 3) * 0.18;
    context.globalAlpha = blink;
    pressed('PRESS ENTER TO FLY', FIELD.width / 2, 406, 20, PALETTE.ink, 'rgba(255,250,240,0.6)', 'center', FONT.title, 'bold', '5px');
    context.globalAlpha = 1;
    text(`BEST ${String(best).padStart(7, '0')}`, FIELD.width / 2, 484, 13, PALETTE.inkSoft, 'center', FONT.body, '700', '3px');
    text('a fan swept at the last moment turns a wall of ink into a flight of arrows', FIELD.width / 2, 572, 12, 'rgba(35,40,64,0.55)', 'center', FONT.title, 'italic');
    drawHudCraneRow(state);
  }

  function drawHudCraneRow(state) {
    for (let i = 0; i < PLAYER.lives; i += 1) drawCrane(438 + i * 42, 530, 0, 0, 0.6, PALETTE.paperShade);
  }

  function drawEnd(state, best, win, time) {
    drawSky(time, win ? 'day' : 'night');
    panel(214, 118, 532, 404);
    text(win ? 'THE STORM BREAKS' : 'THE WIND TAKES YOU', FIELD.width / 2, 168, win ? 34 : 32, win ? PALETTE.vermilionDeep : PALETTE.ink, 'center', FONT.title, 'bold', '4px');
    text(win ? 'the mask comes apart into a thousand cranes' : `stopped on wave ${Math.min(WAVES.length, state.waveIndex + 1)} of ${WAVES.length}`, FIELD.width / 2, 202, 13, PALETTE.inkSoft, 'center', FONT.title, 'italic');
    pressed(String(state.score).padStart(7, '0'), FIELD.width / 2, 262, 52, PALETTE.ink, 'rgba(255,250,240,0.65)', 'center', FONT.title, 'bold', '2px');
    text(state.newBest ? 'NEW BEST' : `BEST ${String(best).padStart(7, '0')}`, FIELD.width / 2, 300, 12, state.newBest ? PALETTE.vermilion : PALETTE.inkSoft, 'center', FONT.body, '800', '4px');
    const stats = [
      ['BEASTS', String(state.kills)],
      ['PARRY', String(state.parries)],
      ['TIME', `${Math.floor(state.time / 60)}:${String(Math.floor(state.time % 60)).padStart(2, '0')}`],
    ];
    for (let i = 0; i < stats.length; i += 1) {
      const x = 338 + i * 112;
      text(stats[i][1], x, 348, 22, PALETTE.ink, 'center', FONT.title, 'bold');
      text(stats[i][0], x, 372, 10, PALETTE.inkSoft, 'center', FONT.body, '700', '2px');
    }
    context.fillStyle = 'rgba(35,40,64,0.2)';
    context.fillRect(300, 396, 360, 1);
    const blink = 0.82 + Math.sin(time * 3) * 0.18;
    context.globalAlpha = blink;
    pressed('PRESS R OR CLICK — FLY AGAIN', FIELD.width / 2, 440, 17, PALETTE.ink, 'rgba(255,250,240,0.6)', 'center', FONT.title, 'bold', '3px');
    context.globalAlpha = 1;
    text('then press ENTER for the title', FIELD.width / 2, 472, 11, PALETTE.inkFaint, 'center', FONT.body, '600', '2px');
  }

  function drawPaused(state) {
    context.fillStyle = 'rgba(26,30,47,0.45)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(300, 214, 360, 208);
    pressed('FOLDED', FIELD.width / 2, 270, 40, PALETTE.ink, 'rgba(255,250,240,0.6)', 'center', FONT.title, 'bold', '6px');
    text('the storm waits', FIELD.width / 2, 304, 13, PALETTE.inkSoft, 'center', FONT.title, 'italic');
    text('P — RESUME', FIELD.width / 2, 348, 14, PALETTE.vermilionDeep, 'center', FONT.body, '800', '3px');
    text('M — SOUND · ENTER — TITLE', FIELD.width / 2, 378, 11, PALETTE.inkFaint, 'center', FONT.body, '600', '2px');
  }

  function draw(world, screen, info) {
    context.save();
    const shake = world.shake;
    if (shake > 0) context.translate((Math.random() - 0.5) * shake * 10, (Math.random() - 0.5) * shake * 10);
    if (screen === SCREEN.TITLE) {
      drawTitle(world, info.best, info.time);
    } else {
      drawSky(world.time, screen === SCREEN.OVER ? 'night' : 'day');
      drawBullets(world.bullets);
      drawPetals(world.petals);
      drawEnemies(world.enemies);
      if (world.boss !== null && !world.boss.dead) drawBoss(world.boss);
      drawDarts(world.darts);
      drawPlayer(world.player);
      drawParticles(world.particles);
      drawHud(world, info.best, info.muted);
      drawBanner(world);
      if (screen === SCREEN.PAUSED) drawPaused(world);
      if (screen === SCREEN.OVER || screen === SCREEN.WIN) drawEnd(world, info.best, screen === SCREEN.WIN, info.time);
    }
    context.restore();
    // A soft ink vignette so the paper sits in the page.
    const vignette = context.createRadialGradient(FIELD.width / 2, FIELD.height / 2, 280, FIELD.width / 2, FIELD.height / 2, 660);
    vignette.addColorStop(0, 'rgba(35,40,64,0)');
    vignette.addColorStop(1, 'rgba(35,40,64,0.28)');
    context.fillStyle = vignette;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  resize();
  return { draw, resize };
}

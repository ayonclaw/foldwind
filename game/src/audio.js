// Sound, synthesised on the spot: there is not one audio file in this game.
//
// A small Web Audio kit — an oscillator blown through a filter and an envelope per
// voice, a noise buffer for paper and drums — plus a pentatonic music box that the
// update loop schedules a few notes ahead. The context is only created on the
// player's first key or click, so nothing is blocked by autoplay policy, and every
// method is a no-op when Web Audio is missing (the screenshot scenes never play).

const SCALE = [0, 2, 4, 7, 9, 12, 9, 7, 4, 2];
const ROOT = 196;
const BEAT = 0.46;

export function createAudio() {
  let context = null;
  let master = null;
  let noise = null;
  let muted = false;
  let musicOn = false;
  let step = 0;
  let nextNote = 0;
  let intensity = 0;

  function ensure() {
    if (context !== null) return context;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    context = new Ctor();
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.5;
    const shelf = context.createBiquadFilter();
    shelf.type = 'highshelf';
    shelf.frequency.value = 5200;
    shelf.gain.value = -6;
    master.connect(shelf).connect(context.destination);
    noise = context.createBuffer(1, context.sampleRate * 0.5, context.sampleRate);
    const data = noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i += 1) {
      // Brownish noise reads as paper and skin, not as static hiss.
      last = (last + (Math.random() * 2 - 1) * 0.16) * 0.985;
      data[i] = last * 3.2;
    }
    return context;
  }

  function tone(freq, when, length, type, gain, slideTo) {
    if (context === null) return;
    const osc = context.createOscillator();
    const env = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), when + length);
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(gain, when + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, when + length);
    osc.connect(env).connect(master);
    osc.start(when);
    osc.stop(when + length + 0.02);
  }

  function hiss(when, length, gain, cutoff, q) {
    if (context === null) return;
    const source = context.createBufferSource();
    source.buffer = noise;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(cutoff, when);
    filter.frequency.exponentialRampToValueAtTime(Math.max(120, cutoff * 0.35), when + length);
    filter.Q.value = q;
    const env = context.createGain();
    env.gain.setValueAtTime(gain, when);
    env.gain.exponentialRampToValueAtTime(0.0001, when + length);
    source.connect(filter).connect(env).connect(master);
    source.start(when);
    source.stop(when + length + 0.02);
  }

  const now = () => (context === null ? 0 : context.currentTime);

  const voices = {
    shoot() {
      tone(1180, now(), 0.05, 'triangle', 0.035, 720);
    },
    hit() {
      tone(420, now(), 0.05, 'square', 0.05, 260);
    },
    kill() {
      hiss(now(), 0.26, 0.32, 1400, 0.9);
      tone(150, now(), 0.22, 'sine', 0.11, 58);
    },
    bigkill() {
      hiss(now(), 0.55, 0.42, 900, 0.7);
      tone(96, now(), 0.5, 'sine', 0.2, 32);
    },
    parry() {
      tone(1480, now(), 0.34, 'sine', 0.12, 2960);
      tone(740, now() + 0.02, 0.26, 'triangle', 0.07, 1180);
    },
    petal() {
      tone(1860, now(), 0.09, 'sine', 0.05, 1240);
    },
    hurt() {
      hiss(now(), 0.34, 0.34, 520, 0.6);
      tone(300, now(), 0.3, 'sawtooth', 0.13, 70);
    },
    wave() {
      const t = now();
      [0, 7, 12].forEach((semi, index) => tone(ROOT * 2 * Math.pow(2, semi / 12), t + index * 0.07, 0.5, 'triangle', 0.1));
    },
    boss() {
      const t = now();
      tone(58, t, 1.6, 'sawtooth', 0.12, 44);
      tone(87, t + 0.12, 1.4, 'sawtooth', 0.08, 62);
      hiss(t, 1.2, 0.2, 300, 0.4);
    },
    over() {
      const t = now();
      [0, -3, -7, -12].forEach((semi, index) => tone(ROOT * Math.pow(2, semi / 12), t + index * 0.17, 0.6, 'triangle', 0.11));
    },
    win() {
      const t = now();
      [0, 4, 7, 12, 16, 19].forEach((semi, index) => tone(ROOT * 2 * Math.pow(2, semi / 12), t + index * 0.11, 1.1, 'sine', 0.12));
    },
    select() {
      tone(660, now(), 0.09, 'triangle', 0.08, 990);
    },
  };

  /** Schedule one bar of the music box; called with the seconds until the next call. */
  function schedule() {
    if (!musicOn || context === null) return;
    const ahead = context.currentTime + 0.25;
    while (nextNote < ahead) {
      const loud = 0.05 + intensity * 0.03;
      const semi = SCALE[step % SCALE.length];
      if (step % 2 === 0) tone(ROOT * 2 * Math.pow(2, semi / 12), nextNote, 0.65, 'triangle', loud);
      if (step % 8 === 0) tone(ROOT / 2, nextNote, 0.9, 'sine', 0.09);
      if (step % 8 === 4) hiss(nextNote, 0.12, 0.05, 2400, 1.4);
      if (step % 16 === 10) tone(ROOT * 1.5, nextNote, 0.4, 'sine', 0.04);
      nextNote += BEAT / 2;
      step += 1;
    }
  }

  return {
    unlock() {
      const ctx = ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume();
      if (musicOn) schedule();
    },
    play(name, level) {
      if (muted || context === null || context.state !== 'running') return;
      const voice = voices[name];
      if (voice) voice();
      if (name === 'kill') intensity = Math.min(1, intensity + 0.02 * (level || 1));
    },
    setMuted(value) {
      muted = value;
      if (master !== null) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    startMusic() {
      ensure();
      musicOn = true;
      step = 0;
      if (context !== null) nextNote = context.currentTime + 0.1;
    },
    stopMusic() {
      musicOn = false;
      intensity = 0;
    },
    /** Called every frame: schedules the music box and lets the storm settle. */
    update() {
      if (!musicOn) return;
      schedule();
      intensity = Math.max(0, intensity - 0.0025);
    },
  };
}

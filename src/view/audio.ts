import {
  hz,
  secondsPerStep,
  type Sfx,
  STEPS,
  swingDelay,
  type Track,
  TRACKS,
  type TrackId,
} from './music';

/** How often the scheduler wakes, and how far ahead of the clock it books notes. */
const SCHEDULER_MS = 25;
const LOOKAHEAD_S = 0.12;
/** A just-started track waits this long so its first note is not booked in the past. */
const START_DELAY_S = 0.05;

const MASTER_GAIN = 0.6;
const MUSIC_GAIN = 0.45;
const SFX_GAIN = 0.8;

export const MUTE_KEY = 'otw-muted';
const MUTE_CODE = 'KeyM';

/** Whether the player muted the game last time; storage can be missing or refuse access. */
export function loadMuted(storage: () => Storage | undefined): boolean {
  try {
    return storage()?.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Remember the mute choice; returns false when the browser would not store it. */
export function saveMuted(storage: () => Storage | undefined, muted: boolean): boolean {
  try {
    const store = storage();
    if (!store) return false;
    store.setItem(MUTE_KEY, muted ? '1' : '0');
    return true;
  } catch {
    return false;
  }
}

function browserStorage(): Storage | undefined {
  return window.localStorage;
}

/**
 * The game's sound: a four-voice chip-style synth playing the stage music
 * from `music.ts`, plus one-shot effects. Everything is synthesised, so there
 * are no audio files to ship.
 *
 * Browsers only start audio after a user gesture, so the context is created
 * on the first key or tap. Until then `play` just remembers the track and
 * effects are dropped.
 */
export class GameAudio {
  private ctx?: AudioContext;
  private music?: GainNode;
  private effects?: GainNode;
  private noise?: AudioBuffer;
  private muted: boolean;
  private track?: Track;
  private trackId?: TrackId;
  private tempo = 1;
  private step = 0;
  private nextStepTime = 0;
  private readonly pill: HTMLButtonElement;

  constructor() {
    this.muted = loadMuted(browserStorage);
    const unlock = (): void => {
      this.unlock();
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('pointerdown', unlock);
    };
    window.addEventListener('keydown', unlock);
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', (e) => {
      if (e.code === MUTE_CODE && !e.repeat) this.toggleMute();
    });
    document.addEventListener('visibilitychange', () => this.syncRunning());
    this.pill = document.createElement('button');
    this.pill.className = 'sound-pill';
    this.pill.type = 'button';
    this.pill.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.unlock();
      this.toggleMute();
    });
    document.body.appendChild(this.pill);
    this.renderPill();
    window.setInterval(() => this.schedule(), SCHEDULER_MS);
  }

  /** Loop a stage's music from its first step; the same track again keeps playing. */
  play(id: TrackId): void {
    this.tempo = 1;
    if (this.trackId === id) return;
    this.trackId = id;
    this.track = TRACKS[id];
    this.step = 0;
    this.nextStepTime = (this.ctx?.currentTime ?? 0) + START_DELAY_S;
  }

  /** Scale the current track's bpm; the tunnel speeds up with the scroll. */
  setTempo(scale: number): void {
    this.tempo = scale;
  }

  sfx(name: Sfx | null): void {
    const ctx = this.ctx;
    if (!name || !ctx || ctx.state !== 'running') return;
    SFX[name](this, ctx.currentTime);
  }

  toggleMute(): void {
    this.muted = !this.muted;
    saveMuted(browserStorage, this.muted);
    this.renderPill();
    this.syncRunning();
  }

  private unlock(): void {
    if (!this.ctx) {
      const ctx = new AudioContext();
      const master = ctx.createGain();
      master.gain.value = MASTER_GAIN;
      master.connect(ctx.destination);
      this.music = ctx.createGain();
      this.music.gain.value = MUSIC_GAIN;
      this.music.connect(master);
      this.effects = ctx.createGain();
      this.effects.gain.value = SFX_GAIN;
      this.effects.connect(master);
      this.noise = whiteNoise(ctx);
      this.ctx = ctx;
      this.nextStepTime = ctx.currentTime + START_DELAY_S;
    }
    this.syncRunning();
  }

  /** Run the clock only while sound is wanted: unmuted and the page in view. */
  private syncRunning(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const wanted = !this.muted && document.visibilityState === 'visible';
    if (wanted && ctx.state === 'suspended') void ctx.resume();
    if (!wanted && ctx.state === 'running') void ctx.suspend();
  }

  private renderPill(): void {
    this.pill.textContent = this.muted ? 'SOUND OFF' : 'SOUND ON';
    this.pill.classList.toggle('off', this.muted);
  }

  /** Book every step that falls inside the lookahead window. */
  private schedule(): void {
    const ctx = this.ctx;
    const track = this.track;
    if (!ctx || !track || ctx.state !== 'running') return;
    // After a stall (a suspended context, a throttled tab) pick up from now, not the backlog.
    if (this.nextStepTime < ctx.currentTime) this.nextStepTime = ctx.currentTime + START_DELAY_S;
    const stepSeconds = secondsPerStep(track.bpm * this.tempo);
    while (this.nextStepTime < ctx.currentTime + LOOKAHEAD_S) {
      const at = this.nextStepTime + swingDelay(this.step, stepSeconds, track.swing);
      this.playStep(track, this.step, at, stepSeconds);
      this.step = (this.step + 1) % STEPS;
      this.nextStepTime += stepSeconds;
    }
  }

  private playStep(track: Track, step: number, at: number, stepSeconds: number): void {
    const bass = track.bass[step];
    const lead = track.lead[step];
    if (bass != null) this.bass(hz(bass), at, stepSeconds * 1.8);
    if (lead != null) this.tone('square', hz(lead), hz(lead), at, stepSeconds * 3, 0.07, 'music');
    if (track.kick[step]) this.tone('sine', 150, 40, at, 0.14, 0.7, 'music');
    if (track.snare[step]) {
      this.hiss(at, 0.12, 0.3, 1800, 'music');
      this.tone('triangle', 190, 150, at, 0.06, 0.2, 'music');
    }
    if (track.hat[step]) this.hiss(at, 0.035, 0.1, 7000, 'music');
  }

  /** The bass: a square through a closing low-pass, the nearest thing to an FM pluck. */
  private bass(frequency: number, at: number, length: number): void {
    const { ctx, music } = this;
    if (!ctx || !music) return;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = frequency;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, at);
    filter.frequency.exponentialRampToValueAtTime(300, at + length);
    const gain = envelope(ctx, at, length, 0.22);
    osc.connect(filter).connect(gain).connect(music);
    osc.start(at);
    osc.stop(at + length);
  }

  /** A pitched blip that slides from one frequency to another as it decays. */
  tone(
    type: OscillatorType,
    from: number,
    to: number,
    at: number,
    length: number,
    level: number,
    bus: 'music' | 'effects' = 'effects',
  ): void {
    const ctx = this.ctx;
    const out = bus === 'music' ? this.music : this.effects;
    if (!ctx || !out) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, at);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, at + length);
    osc.connect(envelope(ctx, at, length, level)).connect(out);
    osc.start(at);
    osc.stop(at + length);
  }

  /** A burst of filtered noise: drums, impacts and whooshes. */
  hiss(
    at: number,
    length: number,
    level: number,
    cutoff: number,
    bus: 'music' | 'effects' = 'effects',
    filterType: BiquadFilterType = 'highpass',
  ): void {
    const ctx = this.ctx;
    const out = bus === 'music' ? this.music : this.effects;
    if (!ctx || !out || !this.noise) return;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = cutoff;
    source
      .connect(filter)
      .connect(envelope(ctx, at, length, level))
      .connect(out);
    source.start(at, Math.random() * NOISE_SECONDS * 0.5);
    source.stop(at + length);
  }

  /** Notes one after another: jingles and alarms. */
  arpeggio(
    type: OscillatorType,
    frequencies: number[],
    at: number,
    gap: number,
    level: number,
  ): void {
    frequencies.forEach((f, i) => this.tone(type, f, f, at + i * gap, gap * 1.6, level));
  }
}

const NOISE_SECONDS = 1;

function whiteNoise(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * NOISE_SECONDS, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** A gain that clicks on at `level` and decays to silence over `length`. */
function envelope(ctx: AudioContext, at: number, length: number, level: number): GainNode {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(level, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  return gain;
}

const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;

const SFX: Readonly<Record<Sfx, (audio: GameAudio, at: number) => void>> = {
  hit: (a, t) => {
    a.hiss(t, 0.06, 0.35, 1200);
    a.tone('square', 220, 110, t, 0.06, 0.12);
  },
  heavy: (a, t) => {
    a.hiss(t, 0.14, 0.5, 600);
    a.tone('sine', 140, 40, t, 0.18, 0.6);
  },
  ko: (a, t) => a.tone('square', 440, 55, t, 0.35, 0.14),
  whiff: (a, t) => a.hiss(t, 0.12, 0.12, 2500, 'effects', 'bandpass'),
  order: (a, t) => a.arpeggio('square', [E5, C6], t, 0.05, 0.08),
  pickup: (a, t) => a.arpeggio('square', [C5, E5, G5, C6], t, 0.05, 0.08),
  reboot: (a, t) => a.tone('sawtooth', 880, 110, t, 0.5, 0.1),
  rebooted: (a, t) => a.arpeggio('square', [261.63, 392, C5], t, 0.06, 0.08),
  intercept: (a, t) => {
    a.tone('square', 330, 660, t, 0.1, 0.12);
    a.hiss(t, 0.08, 0.25, 1500);
  },
  alarm: (a, t) => a.arpeggio('square', [880, 660, 880, 660], t, 0.1, 0.08),
  poof: (a, t) => a.hiss(t, 0.35, 0.2, 900, 'effects', 'lowpass'),
  sting: (a, t) => a.arpeggio('square', [293.66, 349.23, 440], t, 0.08, 0.09),
  fanfare: (a, t) => a.arpeggio('square', [C5, E5, G5, C6, G5, C6], t, 0.1, 0.1),
  crash: (a, t) => {
    a.hiss(t, 0.3, 0.5, 700);
    a.tone('sine', 90, 30, t, 0.25, 0.6);
  },
  shield: (a, t) => a.tone('triangle', 440, 880, t, 0.2, 0.2),
  checkpoint: (a, t) => a.arpeggio('square', [G5, C6], t, 0.08, 0.09),
  retry: (a, t) => a.arpeggio('square', [C5, 392, 261.63], t, 0.08, 0.08),
  call: (a, t) => a.arpeggio('square', [C6, C6], t, 0.07, 0.06),
};

let shared: GameAudio | undefined;

/** One synth for the whole game, like the input devices: scenes come and go, the music carries on. */
export function sharedAudio(): GameAudio {
  shared ??= new GameAudio();
  return shared;
}

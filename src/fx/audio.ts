import type { CritType } from '../crit/index.js';

let audioCtx: AudioContext | null = null;
let enabled = false;
let volume = 0.3;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

export function setAudioEnabled(val: boolean): void { enabled = val; }
export function setAudioVolume(val: number): void { volume = Math.max(0, Math.min(1, val)); }
export function isAudioEnabled(): boolean { return enabled; }

/** Play a synthesized sound for a crit event */
export function playCritSound(type: CritType): void {
  if (!enabled) return;

  const ctx = getCtx();
  if (ctx.state === 'suspended') ctx.resume();

  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.value = volume;

  switch (type) {
    case 'first-blood':
      playPing(ctx, gain, 880, 0.15); // short high ping
      break;
    case 'combo-5':
      playChime(ctx, gain, [523, 659, 784], 0.1); // C-E-G ascending
      break;
    case 'combo-10':
      playChime(ctx, gain, [523, 659, 784, 1047], 0.08); // C-E-G-C ascending fast
      break;
    case 'combo-20':
      playPowerUp(ctx, gain); // rising sweep
      break;
    case 'combo-30':
      playPowerUp(ctx, gain); // same but could be extended
      playChime(ctx, gain, [1047, 1319, 1568], 0.06); // high triad after
      break;
    case 'cleared':
      playPing(ctx, gain, 1047, 0.2); // satisfying high note
      break;
    case 'daily-complete':
      playFanfare(ctx, gain); // celebratory
      break;
  }
}

function playPing(ctx: AudioContext, gain: GainNode, freq: number, duration: number): void {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = freq;
  osc.connect(gain);

  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

function playChime(ctx: AudioContext, gain: GainNode, freqs: number[], interval: number): void {
  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const noteGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(noteGain);
    noteGain.connect(gain);

    const start = ctx.currentTime + i * interval;
    noteGain.gain.setValueAtTime(volume, start);
    noteGain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);

    osc.start(start);
    osc.stop(start + 0.15);
  });
}

function playPowerUp(ctx: AudioContext, gain: GainNode): void {
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.4);
  osc.connect(gain);

  gain.gain.setValueAtTime(volume * 0.5, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.5);
}

function playFanfare(ctx: AudioContext, gain: GainNode): void {
  // C major fanfare: C-E-G-C
  const notes = [523, 659, 784, 1047, 1319];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const noteGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    osc.connect(noteGain);
    noteGain.connect(gain);

    const start = ctx.currentTime + i * 0.12;
    noteGain.gain.setValueAtTime(volume, start);
    noteGain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);

    osc.start(start);
    osc.stop(start + 0.3);
  });
}

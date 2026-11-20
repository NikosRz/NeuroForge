'use client';

// Pure Web Audio API 8-bit Arcade Synthesizer (zero external audio assets)

interface WindowWithWebkitAudio extends Window {
  webkitAudioContext?: typeof AudioContext;
}

interface ActiveChargeNodes {
  oscMain: OscillatorNode;
  oscHarm: OscillatorNode;
  lfo: OscillatorNode;
  lfoDepth: GainNode;
  gain: GainNode;
}

class ArcadeAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private chargeNodes: ActiveChargeNodes | null = null;
  private muted = false;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtor =
        window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext;
      if (!AudioCtor) return null;

      this.ctx = new AudioCtor();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.28;
      this.masterGain.connect(this.ctx.destination);
      this.noiseBuffer = this.createNoiseBuffer(this.ctx);
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    return this.ctx;
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = ctx.sampleRate * 1.0;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  public unlock(): void {
    this.ensureContext();
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) {
      this.stopGunCharge();
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : 0.28, this.ctx.currentTime);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private playTone(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    delay = 0,
  ): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freqStart), now);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + duration);
    }

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  private playNoise(
    duration: number,
    filterFreq: number,
    filterType: BiquadFilterType,
    volume: number,
    delay = 0,
  ): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || !this.noiseBuffer) return;

    const now = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    src.start(now);
    src.stop(now + duration + 0.01);
  }

  public playLaser(): void {
    this.playTone(980, 210, 0.11, 'square', 0.34);
    this.playTone(1480, 420, 0.06, 'sawtooth', 0.16);
  }

  /** Starts a rising 16-bit plasma-blaster charge sound; stops cleanly via stopGunCharge(). */
  public startGunCharge(durationSec = 2.75): void {
    if (this.muted || this.chargeNodes) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const dur = Math.max(0.2, durationSec);

    const oscMain = ctx.createOscillator();
    oscMain.type = 'sawtooth';
    oscMain.frequency.setValueAtTime(140, now);
    oscMain.frequency.exponentialRampToValueAtTime(920, now + dur);

    const oscHarm = ctx.createOscillator();
    oscHarm.type = 'square';
    oscHarm.frequency.setValueAtTime(280, now);
    oscHarm.frequency.exponentialRampToValueAtTime(1380, now + dur);

    const lfo = ctx.createOscillator();
    lfo.type = 'triangle';
    lfo.frequency.setValueAtTime(12, now);
    lfo.frequency.exponentialRampToValueAtTime(28, now + dur);

    const lfoDepth = ctx.createGain();
    lfoDepth.gain.setValueAtTime(0.05, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.linearRampToValueAtTime(0.22, now + dur);

    const harmGain = ctx.createGain();
    harmGain.gain.setValueAtTime(0.45, now);

    lfo.connect(lfoDepth);
    lfoDepth.connect(gain.gain);

    oscMain.connect(gain);
    oscHarm.connect(harmGain);
    harmGain.connect(gain);
    gain.connect(this.masterGain);

    oscMain.start(now);
    oscHarm.start(now);
    lfo.start(now);

    this.chargeNodes = { oscMain, oscHarm, lfo, lfoDepth, gain };
  }

  /** Stops the active gun charge sound with a short click-free fade-out. */
  public stopGunCharge(): void {
    const active = this.chargeNodes;
    if (!active) return;
    this.chargeNodes = null;

    const ctx = this.ctx;
    if (!ctx) return;

    const now = ctx.currentTime;
    try {
      active.gain.gain.cancelScheduledValues(now);
      active.gain.gain.setValueAtTime(Math.max(0.001, active.gain.gain.value), now);
      active.gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      active.oscMain.stop(now + 0.05);
      active.oscHarm.stop(now + 0.05);
      active.lfo.stop(now + 0.05);
    } catch {
      // Oscillators may already be stopped.
    }
  }

  public playEnemyHit(): void {
    this.playNoise(0.11, 1100, 'bandpass', 0.55);
    this.playTone(190, 58, 0.13, 'square', 0.42);
  }

  public playJump(): void {
    this.playTone(230, 620, 0.14, 'square', 0.28);
  }

  public playLand(): void {
    this.playTone(120, 65, 0.05, 'triangle', 0.18);
  }

  public playStationActivate(): void {
    this.playTone(660, 660, 0.06, 'square', 0.25, 0);
    this.playTone(990, 990, 0.1, 'square', 0.25, 0.06);
  }

  public playEnergyBoost(): void {
    const notes = [440, 554.37, 659.25, 880, 1108.73];
    notes.forEach((freq, idx) => {
      this.playTone(freq, freq, 0.08, 'square', 0.28, idx * 0.055);
    });
  }

  public playCoinChime(): void {
    this.playTone(987.77, 987.77, 0.065, 'square', 0.24, 0);
    this.playTone(1318.51, 1318.51, 0.18, 'square', 0.24, 0.065);
  }

  public playAcidZap(): void {
    // Bubbly squelch + electric zap
    this.playTone(260, 520, 0.08, 'sawtooth', 0.28, 0);
    this.playTone(520, 140, 0.12, 'square', 0.32, 0.05);
    this.playTone(340, 740, 0.09, 'triangle', 0.26, 0.12);
    this.playNoise(0.16, 1800, 'highpass', 0.25, 0.02);
  }

  public playBossDefeat(): void {
    // Multi-burst retro explosion
    this.playNoise(0.28, 650, 'lowpass', 0.75, 0);
    this.playTone(150, 38, 0.28, 'sawtooth', 0.48, 0);
    this.playNoise(0.32, 500, 'lowpass', 0.7, 0.16);
    this.playTone(120, 32, 0.35, 'square', 0.45, 0.16);
    this.playNoise(0.42, 420, 'lowpass', 0.65, 0.34);

    // Victory fanfare after explosion
    const fanfare: ReadonlyArray<{ freq: number; dur: number; delay: number }> = [
      { freq: 523.25, dur: 0.11, delay: 0.58 },
      { freq: 659.25, dur: 0.11, delay: 0.7 },
      { freq: 783.99, dur: 0.11, delay: 0.82 },
      { freq: 1046.5, dur: 0.34, delay: 0.94 },
    ];
    fanfare.forEach((n) => {
      this.playTone(n.freq, n.freq, n.dur, 'square', 0.28, n.delay);
    });
  }

  public playLevelUp(): void {
    const notes: ReadonlyArray<{ freq: number; dur: number; delay: number }> = [
      { freq: 440, dur: 0.09, delay: 0 },
      { freq: 554.37, dur: 0.09, delay: 0.09 },
      { freq: 659.25, dur: 0.09, delay: 0.18 },
      { freq: 880, dur: 0.12, delay: 0.27 },
      { freq: 783.99, dur: 0.09, delay: 0.4 },
      { freq: 1046.5, dur: 0.38, delay: 0.5 },
    ];
    notes.forEach((n) => {
      this.playTone(n.freq, n.freq, n.dur, 'square', 0.28, n.delay);
      this.playTone(n.freq * 0.5, n.freq * 0.5, n.dur, 'triangle', 0.2, n.delay);
    });
  }

  public playUiClick(): void {
    this.playTone(760, 540, 0.045, 'square', 0.18);
  }
}

export const arcadeAudio = new ArcadeAudioEngine();

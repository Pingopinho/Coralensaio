/**
 * Human Voice / Choir Formant Synthesizer using Web Audio API
 * Accurately simulates human singing vocal tract resonances (formants F1, F2, F3)
 * with natural glottal vibrato for Soprano, Contralto, Tenor, and Baixo.
 */

export type VocalPart = 'soprano' | 'contralto' | 'tenor' | 'baixo';

export class VoiceAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeVoices: { osc: OscillatorNode; lfo: OscillatorNode; gains: GainNode[] }[] = [];
  private volume: number = 0.9;
  private isMuted: boolean = false;

  private initContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public midiToFreq(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  /**
   * Returns formant center frequencies based on voice category
   */
  private getFormants(part: VocalPart) {
    switch (part) {
      case 'soprano':
        return { f1: 850, f2: 1300, f3: 2850, q1: 5.0, q2: 7.0, q3: 9.0 };
      case 'contralto':
        return { f1: 650, f2: 1100, f3: 2500, q1: 5.5, q2: 7.5, q3: 9.0 };
      case 'tenor':
        return { f1: 580, f2: 1050, f3: 2400, q1: 6.0, q2: 8.0, q3: 9.5 };
      case 'baixo':
      default:
        return { f1: 450, f2: 880, f3: 2200, q1: 6.5, q2: 8.5, q3: 10.0 };
    }
  }

  /**
   * Sings a note with human vocal tract resonances and natural vibrato
   */
  public singNote(
    midiPitch: number,
    part: VocalPart = 'soprano',
    startTime?: number,
    duration: number = 0.8,
    velocity: number = 0.85
  ) {
    try {
      const ctx = this.initContext();
      if (!ctx || !this.masterGain || this.isMuted) return;

      const now = startTime !== undefined && startTime >= ctx.currentTime ? startTime : ctx.currentTime;
      const freq = this.midiToFreq(midiPitch);
      const formants = this.getFormants(part);

      // Glottal source: sawtooth with rich harmonics
      const glottalOsc = ctx.createOscillator();
      glottalOsc.type = 'sawtooth';
      glottalOsc.frequency.setValueAtTime(freq, now);

      // Natural human vocal vibrato (LFO ~5.2 Hz)
      const vibratoLfo = ctx.createOscillator();
      const vibratoGain = ctx.createGain();
      vibratoLfo.frequency.setValueAtTime(5.2, now);
      // Delayed vibrato onset (singers add vibrato after hitting pitch)
      vibratoGain.gain.setValueAtTime(0, now);
      vibratoGain.gain.linearRampToValueAtTime(freq * 0.015, now + 0.12); // ~1.5% pitch variation
      vibratoLfo.connect(vibratoGain);
      vibratoGain.connect(glottalOsc.frequency);

      // Main vocal envelope (smooth attack, sustained singing, gentle breath release)
      const vocalGain = ctx.createGain();
      const peakVolume = Math.min(0.95, velocity * 0.9);

      // Soft human breath onset (30ms)
      vocalGain.gain.setValueAtTime(0.0001, now);
      vocalGain.gain.linearRampToValueAtTime(peakVolume, now + 0.035);

      // Sustain
      const sustainEnd = now + Math.max(0.1, duration - 0.05);
      vocalGain.gain.setValueAtTime(peakVolume, sustainEnd);

      // Vocal release
      const noteEnd = now + duration;
      vocalGain.gain.exponentialRampToValueAtTime(0.0001, noteEnd + 0.08);

      // Three parallel formant bandpass filters (F1, F2, F3)
      const bp1 = ctx.createBiquadFilter();
      bp1.type = 'bandpass';
      bp1.frequency.setValueAtTime(formants.f1, now);
      bp1.Q.setValueAtTime(formants.q1, now);

      const bp2 = ctx.createBiquadFilter();
      bp2.type = 'bandpass';
      bp2.frequency.setValueAtTime(formants.f2, now);
      bp2.Q.setValueAtTime(formants.q2, now);

      const bp3 = ctx.createBiquadFilter();
      bp3.type = 'bandpass';
      bp3.frequency.setValueAtTime(formants.f3, now);
      bp3.Q.setValueAtTime(formants.q3, now);

      const g1 = ctx.createGain();
      g1.gain.value = 1.0;
      const g2 = ctx.createGain();
      g2.gain.value = 0.6;
      const g3 = ctx.createGain();
      g3.gain.value = 0.35;

      glottalOsc.connect(bp1);
      glottalOsc.connect(bp2);
      glottalOsc.connect(bp3);

      bp1.connect(g1);
      bp2.connect(g2);
      bp3.connect(g3);

      g1.connect(vocalGain);
      g2.connect(vocalGain);
      g3.connect(vocalGain);

      vocalGain.connect(this.masterGain);

      glottalOsc.start(now);
      vibratoLfo.start(now);

      const stopTime = noteEnd + 0.1;
      glottalOsc.stop(stopTime);
      vibratoLfo.stop(stopTime);

      const voice = { osc: glottalOsc, lfo: vibratoLfo, gains: [vocalGain, g1, g2, g3] };
      this.activeVoices.push(voice);

      setTimeout(() => {
        const idx = this.activeVoices.indexOf(voice);
        if (idx !== -1) this.activeVoices.splice(idx, 1);
      }, duration * 1000 + 200);
    } catch (err) {
      console.warn('Voice sing error:', err);
    }
  }

  public stopAll() {
    try {
      const now = this.ctx ? this.ctx.currentTime : 0;
      this.activeVoices.forEach((v) => {
        try {
          v.gains.forEach((g) => {
            g.gain.cancelScheduledValues(now);
            g.gain.setValueAtTime(0.0001, now);
          });
          v.osc.stop(now + 0.02);
          v.lfo.stop(now + 0.02);
        } catch {}
      });
      this.activeVoices = [];
    } catch (e) {
      console.warn('stopAll error', e);
    }
  }

  public setMasterVolume(val: number) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
  }

  public resume() {
    this.initContext();
  }
}

export const voiceEngine = new VoiceAudioEngine();

/**
 * Human Voice / Choir Formant Synthesizer using Web Audio API
 * Accurately simulates human singing vocal tract resonances (formants F1, F2, F3)
 * with natural glottal vibrato for Soprano, Contralto, Tenor, and Baixo.
 */

export type VocalPart = 'soprano' | 'contralto' | 'tenor' | 'baixo';

export class VoiceAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeVoices: {
    oscillators: (OscillatorNode | AudioNode)[];
    gains: GainNode[];
    timers: number[];
  }[] = [];
  private volume: number = 0.95;
  private isMuted: boolean = false;

  public initContext(): AudioContext {
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
   * Returns formant frequencies and vocal resonance parameters for each choral voice
   */
  private getVocalProfile(part: VocalPart) {
    switch (part) {
      case 'soprano':
        return {
          f1: 820,
          f2: 1350,
          f3: 2950,
          q1: 4.8,
          q2: 6.5,
          q3: 8.5,
          vibratoRate: 5.4,
          vibratoDepth: 0.014,
          sawGain: 0.65,
          triangleGain: 0.45,
        };
      case 'contralto':
        return {
          f1: 620,
          f2: 1100,
          f3: 2550,
          q1: 5.2,
          q2: 7.0,
          q3: 8.8,
          vibratoRate: 5.0,
          vibratoDepth: 0.013,
          sawGain: 0.7,
          triangleGain: 0.4,
        };
      case 'tenor':
        return {
          f1: 540,
          f2: 1040,
          f3: 2420,
          q1: 5.5,
          q2: 7.5,
          q3: 9.0,
          vibratoRate: 5.2,
          vibratoDepth: 0.012,
          sawGain: 0.72,
          triangleGain: 0.38,
        };
      case 'baixo':
      default:
        return {
          f1: 380,
          f2: 820,
          f3: 2200,
          q1: 6.0,
          q2: 8.0,
          q3: 9.5,
          vibratoRate: 4.8,
          vibratoDepth: 0.011,
          sawGain: 0.75,
          triangleGain: 0.45,
        };
    }
  }

  /**
   * Sings a note simulating human vocal tract resonances, vowel shaping and choir vibrato
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
      const profile = this.getVocalProfile(part);

      // Glottal cords primary oscillator (sawtooth for rich harmonic spectrum)
      const glottalSaw = ctx.createOscillator();
      glottalSaw.type = 'sawtooth';
      glottalSaw.frequency.setValueAtTime(freq, now);

      // Glottal cords body oscillator (triangle for vocal warmth and chest weight)
      const glottalTri = ctx.createOscillator();
      glottalTri.type = 'triangle';
      glottalTri.frequency.setValueAtTime(freq, now);

      // Natural vocal vibrato (singer lfo with progressive onset)
      const vibratoLfo = ctx.createOscillator();
      const vibratoGain = ctx.createGain();
      vibratoLfo.frequency.setValueAtTime(profile.vibratoRate, now);
      // Delayed vibrato onset (human singers initiate straight tone then bloom vibrato)
      vibratoGain.gain.setValueAtTime(0, now);
      vibratoGain.gain.linearRampToValueAtTime(freq * profile.vibratoDepth, now + 0.12);
      vibratoLfo.connect(vibratoGain);
      vibratoGain.connect(glottalSaw.frequency);
      vibratoGain.connect(glottalTri.frequency);

      // Mix oscillators
      const sawMix = ctx.createGain();
      sawMix.gain.value = profile.sawGain;
      glottalSaw.connect(sawMix);

      const triMix = ctx.createGain();
      triMix.gain.value = profile.triangleGain;
      glottalTri.connect(triMix);

      const sourceMix = ctx.createGain();
      sawMix.connect(sourceMix);
      triMix.connect(sourceMix);

      // Formant filters simulating open choral vowel ('A' / 'Ah' / 'Ó')
      const bp1 = ctx.createBiquadFilter();
      bp1.type = 'bandpass';
      bp1.frequency.setValueAtTime(profile.f1, now);
      bp1.Q.setValueAtTime(profile.q1, now);

      const bp2 = ctx.createBiquadFilter();
      bp2.type = 'bandpass';
      bp2.frequency.setValueAtTime(profile.f2, now);
      bp2.Q.setValueAtTime(profile.q2, now);

      const bp3 = ctx.createBiquadFilter();
      bp3.type = 'bandpass';
      bp3.frequency.setValueAtTime(profile.f3, now);
      bp3.Q.setValueAtTime(profile.q3, now);

      const g1 = ctx.createGain();
      g1.gain.value = 1.0;
      const g2 = ctx.createGain();
      g2.gain.value = 0.65;
      const g3 = ctx.createGain();
      g3.gain.value = 0.4;

      sourceMix.connect(bp1);
      sourceMix.connect(bp2);
      sourceMix.connect(bp3);

      bp1.connect(g1);
      bp2.connect(g2);
      bp3.connect(g3);

      // Formant combiner
      const formantSum = ctx.createGain();
      g1.connect(formantSum);
      g2.connect(formantSum);
      g3.connect(formantSum);

      // Articulation envelope (human vocal onset, sustain, and release)
      const vocalGain = ctx.createGain();
      const peakVolume = Math.min(1.0, velocity * 1.15);

      // Soft natural vocal breath onset (35ms attack)
      vocalGain.gain.setValueAtTime(0.0001, now);
      vocalGain.gain.linearRampToValueAtTime(peakVolume, now + 0.04);

      // Sustain body
      const sustainEnd = now + Math.max(0.08, duration - 0.06);
      vocalGain.gain.setValueAtTime(peakVolume, sustainEnd);

      // Natural vocal decay
      const noteEnd = now + duration;
      vocalGain.gain.exponentialRampToValueAtTime(0.0001, noteEnd + 0.07);

      formantSum.connect(vocalGain);
      vocalGain.connect(this.masterGain);

      // Start all sound sources
      glottalSaw.start(now);
      glottalTri.start(now);
      vibratoLfo.start(now);

      const stopTime = noteEnd + 0.09;
      glottalSaw.stop(stopTime);
      glottalTri.stop(stopTime);
      vibratoLfo.stop(stopTime);

      const voiceEntry = {
        oscillators: [glottalSaw, glottalTri, vibratoLfo],
        gains: [vocalGain, formantSum, g1, g2, g3, sourceMix, sawMix, triMix, vibratoGain],
        timers: [] as number[],
      };

      this.activeVoices.push(voiceEntry);

      const cleanupTimer = window.setTimeout(() => {
        const idx = this.activeVoices.indexOf(voiceEntry);
        if (idx !== -1) {
          this.activeVoices.splice(idx, 1);
        }
      }, (stopTime - ctx.currentTime) * 1000 + 100);

      voiceEntry.timers.push(cleanupTimer);
    } catch (err) {
      console.warn('Voice sing error:', err);
    }
  }

  public stopAll() {
    try {
      const now = this.ctx ? this.ctx.currentTime : 0;
      this.activeVoices.forEach((v) => {
        try {
          v.timers.forEach(t => clearTimeout(t));
          v.gains.forEach((g) => {
            g.gain.cancelScheduledValues(now);
            g.gain.setValueAtTime(0.0001, now);
            g.disconnect();
          });
          v.oscillators.forEach((osc) => {
            try {
              (osc as OscillatorNode).stop(now + 0.005);
              osc.disconnect();
            } catch {}
          });
        } catch {}
      });
      this.activeVoices = [];
    } catch (e) {
      console.warn('stopAll error in VoiceAudioEngine:', e);
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

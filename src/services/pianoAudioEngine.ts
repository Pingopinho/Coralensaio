/**
 * Acoustic Piano Synthesizer and Audio Engine using Web Audio API
 * Self-contained, zero-dependency, works 100% reliably in any browser/mobile.
 */

class PianoAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private activeVoices: { oscs: OscillatorNode[]; gain: GainNode }[] = [];
  private volume: number = 0.9;
  private isMuted: boolean = false;

  public initContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);

      // Warm church hall acoustic filter
      this.filterNode = this.ctx.createBiquadFilter();
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.setValueAtTime(4500, this.ctx.currentTime);
      this.filterNode.Q.setValueAtTime(1.0, this.ctx.currentTime);

      this.filterNode.connect(this.masterGain);
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
   * Plays an acoustic piano note
   */
  public playNote(
    midiPitch: number,
    startTime?: number,
    duration: number = 0.8,
    velocity: number = 0.85
  ) {
    try {
      const ctx = this.initContext();
      if (!ctx || !this.filterNode || this.isMuted) return;

      const now = startTime !== undefined && startTime >= ctx.currentTime ? startTime : ctx.currentTime;
      const freq = this.midiToFreq(midiPitch);

      // Acoustic piano string model:
      // Oscillator 1: Fundamental frequency (triangle for warm string body)
      const osc1 = ctx.createOscillator();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(freq, now);

      // Oscillator 2: First overtone (sine at 2x freq for clarity and brightness)
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq * 2, now);

      // Oscillator 3: Soft sub-harmonic or fifth harmonic for richness
      const osc3 = ctx.createOscillator();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(freq * 3, now);

      // Note envelope gain
      const noteGain = ctx.createGain();
      const peakGain = Math.min(1.0, Math.max(0.1, velocity * 0.9));

      // Attack: felt hammer strike (quick ramp 0.005s)
      noteGain.gain.setValueAtTime(0.0001, now);
      noteGain.gain.linearRampToValueAtTime(peakGain, now + 0.005);

      // Initial decay: sharp drop from hammer transient
      noteGain.gain.exponentialRampToValueAtTime(peakGain * 0.45, now + 0.06);

      // Sustain and string ring-down
      const ringDuration = Math.max(duration * 1.5, 0.5);
      const noteEndTime = now + ringDuration;
      noteGain.gain.exponentialRampToValueAtTime(0.0001, noteEndTime);

      // Connect sub-oscillators
      osc1.connect(noteGain);

      const gain2 = ctx.createGain();
      gain2.gain.value = 0.3;
      osc2.connect(gain2);
      gain2.connect(noteGain);

      const gain3 = ctx.createGain();
      gain3.gain.value = 0.12;
      osc3.connect(gain3);
      gain3.connect(noteGain);

      noteGain.connect(this.filterNode);

      osc1.start(now);
      osc2.start(now);
      osc3.start(now);

      osc1.stop(noteEndTime + 0.05);
      osc2.stop(noteEndTime + 0.05);
      osc3.stop(noteEndTime + 0.05);

      const voice = { oscs: [osc1, osc2, osc3], gain: noteGain };
      this.activeVoices.push(voice);

      // Garbage collect ended voices
      setTimeout(() => {
        const idx = this.activeVoices.indexOf(voice);
        if (idx !== -1) this.activeVoices.splice(idx, 1);
      }, ringDuration * 1000 + 100);
    } catch (err) {
      console.warn('Error playing piano note:', err);
    }
  }

  /**
   * Metronome click sound
   */
  public playClick(isAccent: boolean = false, time?: number) {
    try {
      const ctx = this.initContext();
      if (!ctx || !this.masterGain) return;

      const now = time !== undefined && time >= ctx.currentTime ? time : ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(isAccent ? 1400 : 900, now);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.035);
    } catch (e) {
      console.warn('Click error', e);
    }
  }

  public stopAllNotes() {
    try {
      const now = this.ctx ? this.ctx.currentTime : 0;
      this.activeVoices.forEach((v) => {
        try {
          v.gain.gain.cancelScheduledValues(now);
          v.gain.gain.setValueAtTime(0.0001, now);
          v.oscs.forEach((osc) => {
            try {
              osc.stop(now + 0.02);
            } catch {}
          });
        } catch {}
      });
      this.activeVoices = [];
    } catch (e) {
      console.warn('stopAllNotes error', e);
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

  public getCurrentTime(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }
}

export const pianoEngine = new PianoAudioEngine();

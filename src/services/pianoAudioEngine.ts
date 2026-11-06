/**
 * Acoustic Piano Synthesizer and Audio Engine using Web Audio API
 * Self-contained, zero-dependency, works 100% reliably in any browser/mobile.
 */

export interface PitchInfo {
  name: string;
  ptName: string;
  octave: number;
  color: string;
}

// Chromesthesia musical pitch colors (Dó = Vermelho, Ré = Laranja, Mi = Amarelo, etc.)
export const PITCH_COLORS: { [key: number]: { name: string; ptName: string; color: string } } = {
  0: { name: 'C', ptName: 'Dó', color: '#ef4444' },      // Red
  1: { name: 'C#', ptName: 'Dó#', color: '#f43f5e' },    // Rose
  2: { name: 'D', ptName: 'Ré', color: '#f97316' },      // Orange
  3: { name: 'D#', ptName: 'Ré#', color: '#fb923c' },    // Light Orange
  4: { name: 'E', ptName: 'Mi', color: '#eab308' },      // Amber / Gold
  5: { name: 'F', ptName: 'Fá', color: '#10b981' },      // Green
  6: { name: 'F#', ptName: 'Fá#', color: '#14b8a6' },    // Teal
  7: { name: 'G', ptName: 'Sol', color: '#06b6d4' },     // Cyan
  8: { name: 'G#', ptName: 'Sol#', color: '#0284c7' },   // Sky Blue
  9: { name: 'A', ptName: 'Lá', color: '#3b82f6' },      // Indigo Blue
  10: { name: 'A#', ptName: 'Lá#', color: '#6366f1' },   // Violet
  11: { name: 'B', ptName: 'Si', color: '#a855f7' },     // Purple
};

export function getPitchInfo(midiPitch: number): PitchInfo {
  const normalized = ((midiPitch % 12) + 12) % 12;
  const octave = Math.floor(midiPitch / 12) - 1;
  const info = PITCH_COLORS[normalized] || { name: 'C', ptName: 'Dó', color: '#10b981' };
  return {
    name: info.name,
    ptName: info.ptName,
    octave,
    color: info.color,
  };
}

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

      // Acoustic piano string harmonics
      const osc1 = ctx.createOscillator();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(freq, now);

      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq * 2, now);

      const osc3 = ctx.createOscillator();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(freq * 3, now);

      const noteGain = ctx.createGain();
      const peakGain = Math.min(1.0, Math.max(0.05, velocity * 0.9));

      // Attack: felt hammer strike (0.005s)
      noteGain.gain.setValueAtTime(0.0001, now);
      noteGain.gain.linearRampToValueAtTime(peakGain, now + 0.005);

      // Initial decay
      noteGain.gain.exponentialRampToValueAtTime(peakGain * 0.45, now + 0.06);

      // Sustain and string ring-down
      const ringDuration = Math.max(duration * 1.5, 0.45);
      const noteEndTime = now + ringDuration;
      noteGain.gain.exponentialRampToValueAtTime(0.0001, noteEndTime);

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

  /**
   * Immediately cuts and disconnects any currently sounding notes (used on Pause)
   */
  public stopAllNotes() {
    try {
      const now = this.ctx ? this.ctx.currentTime : 0;
      this.activeVoices.forEach((v) => {
        try {
          v.gain.gain.cancelScheduledValues(now);
          v.gain.gain.setValueAtTime(0.0001, now);
          v.gain.disconnect();
          v.oscs.forEach((osc) => {
            try {
              osc.stop(now + 0.01);
              osc.disconnect();
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

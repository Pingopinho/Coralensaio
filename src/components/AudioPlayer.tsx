import React, { useEffect, useRef, useState, useMemo } from 'react';
import abcjs from 'abcjs';
import { pianoEngine, getPitchInfo, PitchInfo } from '../services/pianoAudioEngine';
import { voiceEngine, VocalPart } from '../services/voiceAudioEngine';
import {
  Play,
  Pause,
  RotateCcw,
  Sliders,
  Volume2,
  VolumeX,
  Clock,
  Sparkles,
  Music2,
  Layers,
  Mic,
  Piano,
  Music,
  User,
  Activity
} from 'lucide-react';

interface AudioPlayerProps {
  visualObj: any;
  abc: string;
  transposition: number;
  onTranspositionChange: (semitones: number) => void;
}

interface ParsedNote {
  pitch: number;
  startTime: number;    // in seconds relative to score start
  duration: number;     // in seconds
  volume: number;       // 0-1
  trackIndex: number;   // 0: Soprano, 1: Contralto, 2: Tenor, 3: Baixo
  part: VocalPart;      // 'soprano' | 'contralto' | 'tenor' | 'baixo'
  startChar?: number;
  endChar?: number;
}

export type SoundMode = 'piano' | 'voice' | 'both';
export type VoiceFocusMode = 'solo' | 'highlight' | 'full';

export interface ActiveNoteDisplay {
  part: VocalPart;
  pitch: number;
  pitchInfo: PitchInfo;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  visualObj,
  abc,
  transposition,
  onTranspositionChange
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [totalDuration, setTotalDuration] = useState<number>(0);

  // Metronome and dynamic BPM tempo controls
  const [currentBpm, setCurrentBpm] = useState<number>(100);
  const [metronomeOn, setMetronomeOn] = useState<boolean>(false);
  const [activeBeat, setActiveBeat] = useState<number>(1);
  const [volume, setVolume] = useState<number>(90);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Sound timbre: Piano, Human Singing Voice, or Combined (default: both)
  const [soundMode, setSoundMode] = useState<SoundMode>('both');

  // Selected voice for solo or focus
  const [selectedVoice, setSelectedVoice] = useState<'all' | VocalPart>('all');
  const [voiceFocusMode, setVoiceFocusMode] = useState<VoiceFocusMode>('solo');

  // Active notes currently sounding (with pitch colors & minute)
  const [activeNotesDisplay, setActiveNotesDisplay] = useState<ActiveNoteDisplay[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>('Piano e Voz Humana prontos para ensaio');

  // State refs for low-latency lookahead scheduling
  const isPlayingRef = useRef<boolean>(false);
  const currentTimeRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);
  const lastSchedulePosRef = useRef<number>(0);
  const lastBeatClickedRef = useRef<number>(-1);
  const selectedVoiceRef = useRef<'all' | VocalPart>('all');
  const voiceFocusModeRef = useRef<VoiceFocusMode>('solo');
  const soundModeRef = useRef<SoundMode>('both');
  const transpositionRef = useRef<number>(0);
  const currentBpmRef = useRef<number>(100);
  const metronomeOnRef = useRef<boolean>(false);

  // Sync refs with state
  useEffect(() => {
    selectedVoiceRef.current = selectedVoice;
  }, [selectedVoice]);

  useEffect(() => {
    voiceFocusModeRef.current = voiceFocusMode;
  }, [voiceFocusMode]);

  useEffect(() => {
    soundModeRef.current = soundMode;
  }, [soundMode]);

  useEffect(() => {
    transpositionRef.current = transposition;
  }, [transposition]);

  useEffect(() => {
    currentBpmRef.current = currentBpm;
  }, [currentBpm]);

  useEffect(() => {
    metronomeOnRef.current = metronomeOn;
  }, [metronomeOn]);

  // Parse notes and SATB voice separation
  const scoreData = useMemo(() => {
    try {
      let tune = visualObj;
      if (!tune && abc) {
        const parsed = abcjs.parseOnly(abc);
        tune = parsed && parsed.length > 0 ? parsed[0] : null;
      }
      if (!tune) return { notes: [], totalSec: 0, bpm: 100, beatLength: 0.25 };

      const audioInfo = tune.setUpAudio ? tune.setUpAudio() : null;
      if (!audioInfo || !audioInfo.tracks) {
        return { notes: [], totalSec: 0, bpm: 100, beatLength: 0.25 };
      }

      const bpm = tune.getBpm ? tune.getBpm() : audioInfo.tempo || 100;
      const beatLength = tune.getBeatLength ? tune.getBeatLength() : 0.25;

      const rawNotes: {
        pitch: number;
        startBeats: number;
        durBeats: number;
        volume: number;
        trackIndex: number;
        startChar?: number;
        endChar?: number;
      }[] = [];

      const trackCount = audioInfo.tracks.length;
      const hasMultipleTracks = trackCount > 1;

      audioInfo.tracks.forEach((track: any[], trackIdx: number) => {
        track.forEach((event: any) => {
          if (event.cmd === 'note' && typeof event.pitch === 'number') {
            const startBeats = event.start / beatLength;
            const durBeats = event.duration / beatLength;
            rawNotes.push({
              pitch: event.pitch,
              startBeats,
              durBeats,
              volume: (event.volume || 100) / 127,
              trackIndex: trackIdx,
              startChar: event.startChar,
              endChar: event.endChar,
            });
          }
        });
      });

      rawNotes.sort((a, b) => a.startBeats - b.startBeats);
      const parsedNotes: ParsedNote[] = [];

      if (hasMultipleTracks) {
        rawNotes.forEach((n) => {
          let part: VocalPart = 'soprano';
          if (n.trackIndex === 1) part = 'contralto';
          else if (n.trackIndex === 2) part = 'tenor';
          else if (n.trackIndex >= 3) part = 'baixo';

          parsedNotes.push({
            pitch: n.pitch,
            startTime: (n.startBeats * 60) / bpm,
            duration: Math.max(0.2, (n.durBeats * 60) / bpm),
            volume: n.volume,
            trackIndex: n.trackIndex,
            part,
            startChar: n.startChar,
            endChar: n.endChar,
          });
        });
      } else {
        // Polyphony / chord note splitting
        const groups: (typeof rawNotes)[] = [];
        rawNotes.forEach((n) => {
          const matchGroup = groups.find((g) => Math.abs(g[0].startBeats - n.startBeats) < 0.05);
          if (matchGroup) {
            matchGroup.push(n);
          } else {
            groups.push([n]);
          }
        });

        groups.forEach((group) => {
          group.sort((a, b) => b.pitch - a.pitch);
          group.forEach((n, idx) => {
            let part: VocalPart = 'soprano';
            let trackIdx = 0;

            if (group.length === 1) {
              if (n.pitch >= 65) {
                part = 'soprano';
                trackIdx = 0;
              } else if (n.pitch >= 60) {
                part = 'contralto';
                trackIdx = 1;
              } else if (n.pitch >= 53) {
                part = 'tenor';
                trackIdx = 2;
              } else {
                part = 'baixo';
                trackIdx = 3;
              }
            } else if (group.length === 2) {
              if (idx === 0) {
                part = 'soprano';
                trackIdx = 0;
              } else {
                part = 'baixo';
                trackIdx = 3;
              }
            } else if (group.length === 3) {
              if (idx === 0) {
                part = 'soprano';
                trackIdx = 0;
              } else if (idx === 1) {
                part = 'contralto';
                trackIdx = 1;
              } else {
                part = 'baixo';
                trackIdx = 3;
              }
            } else {
              if (idx === 0) {
                part = 'soprano';
                trackIdx = 0;
              } else if (idx === 1) {
                part = 'contralto';
                trackIdx = 1;
              } else if (idx === 2) {
                part = 'tenor';
                trackIdx = 2;
              } else {
                part = 'baixo';
                trackIdx = 3;
              }
            }

            parsedNotes.push({
              pitch: n.pitch,
              startTime: (n.startBeats * 60) / bpm,
              duration: Math.max(0.2, (n.durBeats * 60) / bpm),
              volume: n.volume,
              trackIndex: trackIdx,
              part,
              startChar: n.startChar,
              endChar: n.endChar,
            });
          });
        });
      }

      parsedNotes.sort((a, b) => a.startTime - b.startTime);

      const totalBeats = (audioInfo.totalDuration || 4) / beatLength;
      const totalSec = Math.max(2, (totalBeats * 60) / bpm);

      return {
        notes: parsedNotes,
        totalSec,
        bpm,
        beatLength,
      };
    } catch (e) {
      console.warn('Error parsing score audio notes:', e);
      return { notes: [], totalSec: 0, bpm: 100, beatLength: 0.25 };
    }
  }, [visualObj, abc]);

  // Sync base BPM from score when loaded
  useEffect(() => {
    if (scoreData.bpm && scoreData.bpm > 0) {
      setCurrentBpm(scoreData.bpm);
    }
    setTotalDuration(scoreData.totalSec);
  }, [scoreData.bpm, scoreData.totalSec]);

  // Reset when a completely new song is opened
  useEffect(() => {
    handleStopFull();
  }, [abc]);

  // Clean note highlights from DOM
  const clearHighlights = () => {
    document.querySelectorAll('.abcjs-highlight, .abcjs-colored-note').forEach((el) => {
      el.classList.remove('abcjs-highlight', 'abcjs-colored-note');
      (el as HTMLElement).style.removeProperty('fill');
      (el as HTMLElement).style.removeProperty('stroke');
      (el as HTMLElement).style.removeProperty('filter');
    });
  };

  // Color notes according to pitch and minute played
  const updateNoteColoringAndDisplay = (posSec: number) => {
    const currentActive: ActiveNoteDisplay[] = [];

    // Find notes sounding at posSec in score time
    scoreData.notes.forEach((n) => {
      const noteStart = n.startTime;
      const noteEnd = noteStart + n.duration;

      if (posSec >= noteStart - 0.05 && posSec <= noteEnd + 0.05) {
        const curSelected = selectedVoiceRef.current;
        const curFocus = voiceFocusModeRef.current;

        // Check if note is active under current voice filter
        if (curSelected !== 'all' && curFocus === 'solo' && n.part !== curSelected) {
          return;
        }

        const effPitch = n.pitch + transpositionRef.current;
        const pitchInfo = getPitchInfo(effPitch);

        if (!currentActive.some((a) => a.part === n.part && a.pitch === effPitch)) {
          currentActive.push({
            part: n.part,
            pitch: effPitch,
            pitchInfo,
          });
        }
      }
    });

    setActiveNotesDisplay(currentActive);

    // Apply color styling to SVG note elements in the staff
    clearHighlights();

    if (currentActive.length > 0) {
      const svgNotes = document.querySelectorAll('.abcjs-note');
      svgNotes.forEach((el) => {
        const classStr = el.getAttribute('class') || '';
        if (classStr.includes('abcjs-n')) {
          el.classList.add('abcjs-colored-note');
          const primary = currentActive[0]?.pitchInfo?.color || '#059669';
          (el as HTMLElement).style.setProperty('fill', primary, 'important');
          (el as HTMLElement).style.setProperty('stroke', primary, 'important');
          (el as HTMLElement).style.setProperty('filter', `drop-shadow(0 0 6px ${primary})`, 'important');
        }
      });
    }
  };

  // Stop everything immediately on pause
  const pausePlayback = () => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    // Immediately silence all active and scheduled sounds
    pianoEngine.stopAllNotes();
    voiceEngine.stopAll();
    clearHighlights();
    setActiveNotesDisplay([]);
    setStatusMessage('Pausado');
  };

  // Completely resets playback to measure 0
  const handleStopFull = () => {
    pausePlayback();
    currentTimeRef.current = 0;
    lastSchedulePosRef.current = 0;
    lastBeatClickedRef.current = -1;
    setActiveBeat(1);
    setCurrentTime(0);
    setStatusMessage('Pronto para tocar');
  };

  // Start or resume playback using lookahead scheduling in score time
  const startPlayback = (startPosSec: number) => {
    pianoEngine.resume();
    voiceEngine.resume();

    // Silence any previous ringing sounds
    pianoEngine.stopAllNotes();
    voiceEngine.stopAll();

    const ctx = pianoEngine.initContext();

    isPlayingRef.current = true;
    setIsPlaying(true);

    currentTimeRef.current = startPosSec;
    lastSchedulePosRef.current = startPosSec;
    lastBeatClickedRef.current = -1;

    const voiceName =
      selectedVoiceRef.current === 'all'
        ? 'Todas as vozes'
        : selectedVoiceRef.current.charAt(0).toUpperCase() +
          selectedVoiceRef.current.slice(1) +
          (voiceFocusModeRef.current === 'solo' ? ' (Solo)' : ' (Destaque)');

    const timbreName =
      soundModeRef.current === 'both'
        ? 'Piano + Voz Cantada'
        : soundModeRef.current === 'voice'
        ? 'Voz Humana Cantada'
        : 'Piano';

    setStatusMessage(`Tocando ${voiceName} com ${timbreName}...`);

    let lastClockTime = ctx.currentTime;

    const schedulerLoop = () => {
      if (!isPlayingRef.current) return;

      const nowClock = ctx.currentTime;
      const deltaClock = nowClock - lastClockTime;
      lastClockTime = nowClock;

      const baseBpm = scoreData.bpm || 100;
      const speedMultiplier = currentBpmRef.current / baseBpm;

      // Advance song playhead position in score seconds
      currentTimeRef.current += deltaClock * speedMultiplier;
      const currentPos = currentTimeRef.current;

      setCurrentTime(currentPos);
      updateNoteColoringAndDisplay(currentPos);

      // Metronome accompaniment
      if (metronomeOnRef.current) {
        const beatIntervalScore = 60 / baseBpm;
        const currentBeat = Math.floor(currentPos / beatIntervalScore);
        if (currentBeat > lastBeatClickedRef.current && currentBeat >= 0) {
          lastBeatClickedRef.current = currentBeat;
          const isDownbeat = currentBeat % 4 === 0;
          pianoEngine.playClick(isDownbeat);
          setActiveBeat((currentBeat % 4) + 1);
        }
      }

      // Check if song finished
      if (currentPos >= scoreData.totalSec && scoreData.totalSec > 0) {
        handleStopFull();
        setStatusMessage('Música finalizada');
        return;
      }

      // LOOKAHEAD WINDOW in score time (0.12s of real clock = 0.12 * speedMultiplier score seconds)
      const lookaheadScoreSec = Math.max(0.08, 0.12 * speedMultiplier);
      const scheduleWindowEnd = currentPos + lookaheadScoreSec;
      const windowStart = lastSchedulePosRef.current;

      scoreData.notes.forEach((note) => {
        if (note.startTime >= windowStart && note.startTime < scheduleWindowEnd) {
          // Check voice filter
          const curSelected = selectedVoiceRef.current;
          const curFocus = voiceFocusModeRef.current;

          let shouldPlay = true;
          let volumeMultiplier = 0.95;

          if (curSelected !== 'all') {
            const isMatch = note.part === curSelected;
            if (curFocus === 'solo') {
              shouldPlay = isMatch;
              volumeMultiplier = 1.0;
            } else if (curFocus === 'highlight') {
              shouldPlay = true;
              volumeMultiplier = isMatch ? 1.0 : 0.12;
            }
          }

          if (shouldPlay) {
            const delayRealSec = Math.max(0, (note.startTime - currentPos) / speedMultiplier);
            const playCtxTime = nowClock + delayRealSec;
            const noteDurationScaled = Math.max(0.12, note.duration / speedMultiplier);
            const effectivePitch = note.pitch + transpositionRef.current;
            const finalVel = note.volume * volumeMultiplier;

            // Route audio according to sound timbre
            const curSound = soundModeRef.current;
            if (curSound === 'piano' || curSound === 'both') {
              pianoEngine.playNote(effectivePitch, playCtxTime, noteDurationScaled, finalVel);
            }
            if (curSound === 'voice' || curSound === 'both') {
              voiceEngine.singNote(effectivePitch, note.part, playCtxTime, noteDurationScaled, finalVel * 1.1);
            }
          }
        }
      });

      lastSchedulePosRef.current = scheduleWindowEnd;
      animFrameRef.current = requestAnimationFrame(schedulerLoop);
    };

    animFrameRef.current = requestAnimationFrame(schedulerLoop);
  };

  // Play / Pause toggle
  const handlePlayPause = () => {
    pianoEngine.resume();
    voiceEngine.resume();

    if (isPlaying) {
      pausePlayback();
    } else {
      let startFrom = currentTimeRef.current;
      if (startFrom >= scoreData.totalSec - 0.5) {
        startFrom = 0;
      }
      startPlayback(startFrom);
    }
  };

  // Restart from beginning
  const handleRestart = () => {
    pianoEngine.resume();
    voiceEngine.resume();
    handleStopFull();
    startPlayback(0);
  };

  // User interactive scrub on progress bar
  const handleSeek = (newSec: number) => {
    const clamped = Math.max(0, Math.min(newSec, scoreData.totalSec));
    currentTimeRef.current = clamped;
    lastSchedulePosRef.current = clamped;
    setCurrentTime(clamped);

    if (isPlaying) {
      pianoEngine.stopAllNotes();
      voiceEngine.stopAll();
      startPlayback(clamped);
    } else {
      updateNoteColoringAndDisplay(clamped);
    }
  };

  // Switch voice WITHOUT resetting the song to zero
  const handleSelectVoiceSeamless = (voice: 'all' | VocalPart) => {
    setSelectedVoice(voice);
    selectedVoiceRef.current = voice;

    // Immediately cut currently sounding voices and continue from current second
    if (isPlayingRef.current) {
      pianoEngine.stopAllNotes();
      voiceEngine.stopAll();
      lastSchedulePosRef.current = currentTimeRef.current;
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    setIsMuted(newVol === 0);
    pianoEngine.setMasterVolume(newVol / 100);
    pianoEngine.setMuted(newVol === 0);
    voiceEngine.setMasterVolume(newVol / 100);
    voiceEngine.setMuted(newVol === 0);
  };

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      pianoEngine.setMuted(false);
      voiceEngine.setMuted(false);
      pianoEngine.setMasterVolume(volume / 100);
      voiceEngine.setMasterVolume(volume / 100);
    } else {
      setIsMuted(true);
      pianoEngine.setMuted(true);
      voiceEngine.setMuted(true);
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-slate-900 border-t border-slate-800 text-slate-200 px-3 py-3 sm:px-6 shadow-2xl">
      <div className="max-w-6xl mx-auto flex flex-col gap-3">
        {/* ROW 1: Voice Solo Buttons, Timbre, Transposition & Speed */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs">
          {/* SATB Voice Solo Selector (Seamless: keeps current position!) */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-700/80">
            <span className="text-slate-400 font-bold px-2 flex items-center gap-1 text-[11px]">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span>Vozes do Coral:</span>
            </span>

            {/* Todas as Vozes */}
            <button
              onClick={() => handleSelectVoiceSeamless('all')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all ${
                selectedVoice === 'all'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              Todas (Coral)
            </button>

            {/* Individual Voice Solo Buttons */}
            {(
              [
                { id: 'soprano', label: 'Soprano', color: '#38bdf8' },
                { id: 'contralto', label: 'Contralto', color: '#fbbf24' },
                { id: 'tenor', label: 'Tenor', color: '#c084fc' },
                { id: 'baixo', label: 'Baixo', color: '#34d399' },
              ] as const
            ).map((v) => {
              const isSelected = selectedVoice === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => handleSelectVoiceSeamless(v.id)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-400 scale-102'
                      : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
                  title={`Clique para ouvir SOMENTE o ${v.label} (continua do mesmo segundo!)`}
                >
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ backgroundColor: v.color }}
                  />
                  <span>{v.label}</span>
                  {isSelected && (
                    <span className="text-[10px] font-black uppercase tracking-wider bg-slate-950/20 px-1 rounded">
                      SOLO
                    </span>
                  )}
                </button>
              );
            })}

            {/* Focus Mode: Solo vs Highlight */}
            {selectedVoice !== 'all' && (
              <div className="flex items-center gap-1 pl-2 border-l border-slate-700 text-[11px]">
                <button
                  onClick={() => {
                    setVoiceFocusMode('solo');
                    voiceFocusModeRef.current = 'solo';
                    if (isPlayingRef.current) {
                      pianoEngine.stopAllNotes();
                      voiceEngine.stopAll();
                      lastSchedulePosRef.current = currentTimeRef.current;
                    }
                  }}
                  className={`px-2 py-0.5 rounded font-semibold ${
                    voiceFocusMode === 'solo'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Somente Ela
                </button>
                <button
                  onClick={() => {
                    setVoiceFocusMode('highlight');
                    voiceFocusModeRef.current = 'highlight';
                    if (isPlayingRef.current) {
                      pianoEngine.stopAllNotes();
                      voiceEngine.stopAll();
                      lastSchedulePosRef.current = currentTimeRef.current;
                    }
                  }}
                  className={`px-2 py-0.5 rounded font-semibold ${
                    voiceFocusMode === 'highlight'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="A voz selecionada toca alto e as outras tocam como acompanhamento suave ao fundo"
                >
                  Destacar com Fundo
                </button>
              </div>
            )}
          </div>

          {/* Sound Timbre: Piano, Voz Humana, or Piano + Voz */}
          <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-700/80">
            <span className="text-slate-400 font-bold px-2 text-[11px]">
              Timbre:
            </span>
            <button
              onClick={() => {
                setSoundMode('piano');
                soundModeRef.current = 'piano';
                if (isPlayingRef.current) {
                  voiceEngine.stopAll();
                }
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold text-xs transition-all ${
                soundMode === 'piano'
                  ? 'bg-blue-600 text-white shadow-sm font-bold'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <Piano className="w-3.5 h-3.5" />
              <span>Piano</span>
            </button>

            <button
              onClick={() => {
                setSoundMode('voice');
                soundModeRef.current = 'voice';
                if (isPlayingRef.current) {
                  pianoEngine.stopAllNotes();
                }
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold text-xs transition-all ${
                soundMode === 'voice'
                  ? 'bg-rose-600 text-white shadow-sm font-bold ring-1 ring-rose-400'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
              title="Voz humana cantando as notas em harmonia coral"
            >
              <Mic className="w-3.5 h-3.5 text-rose-300" />
              <span>Voz Cantada</span>
            </button>

            <button
              onClick={() => {
                setSoundMode('both');
                soundModeRef.current = 'both';
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold text-xs transition-all ${
                soundMode === 'both'
                  ? 'bg-purple-600 text-white shadow-sm font-bold ring-1 ring-purple-400'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
              title="Piano acompanhando a voz humana cantando as linhas do coral"
            >
              <Music className="w-3.5 h-3.5 text-purple-300" />
              <span>Piano + Voz (Recomendado)</span>
            </button>
          </div>

          {/* Transposition */}
          <div className="flex items-center gap-1 bg-slate-950/80 px-2 py-1 rounded-xl border border-slate-700/80">
            <span className="text-slate-400 font-medium text-[11px] flex items-center gap-0.5">
              <Music2 className="w-3 h-3 text-blue-400" />
              <span>Tom:</span>
            </span>
            <button
              onClick={() => onTranspositionChange(transposition - 1)}
              className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 font-bold text-slate-200"
              title="Diminuir tom em 1 semitom"
            >
              -1
            </button>
            <span className="min-w-6 text-center font-mono font-bold text-blue-400 text-xs">
              {transposition === 0 ? 'Orig.' : transposition > 0 ? `+${transposition}` : transposition}
            </span>
            <button
              onClick={() => onTranspositionChange(transposition + 1)}
              className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 font-bold text-slate-200"
              title="Aumentar tom em 1 semitom"
            >
              +1
            </button>
          </div>
        </div>

        {/* ROW 1.5: DEDICATED METRONOME & SPEED / TEMPO CONTROLS */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-3 py-2 rounded-xl bg-slate-950/90 border border-slate-800 shadow-sm text-xs">
          {/* Metronome toggle and visual beat indicator */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                pianoEngine.resume();
                setMetronomeOn(!metronomeOn);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                metronomeOn
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md ring-2 ring-amber-400/50'
                  : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
              title="Ligar ou desligar som do metrônomo"
            >
              <Clock className="w-4 h-4" />
              <span>{metronomeOn ? 'Metrônomo Ligado' : 'Ligar Metrônomo'}</span>
            </button>

            {/* Visual Beat Pulsers (1 2 3 4) */}
            <div className="flex items-center gap-1 pl-1">
              {[1, 2, 3, 4].map((beatNum) => {
                const isActive = metronomeOn && isPlaying && activeBeat === beatNum;
                const isDownbeat = beatNum === 1;
                return (
                  <span
                    key={beatNum}
                    className={`w-5 h-5 rounded-md flex items-center justify-center font-mono text-[10px] font-bold transition-all ${
                      isActive
                        ? isDownbeat
                          ? 'bg-amber-400 text-slate-950 scale-110 shadow-lg shadow-amber-400/50 ring-2 ring-amber-300'
                          : 'bg-emerald-400 text-slate-950 scale-105 shadow-md shadow-emerald-400/50'
                        : 'bg-slate-800 text-slate-400 border border-slate-700/60'
                    }`}
                  >
                    {beatNum}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Current BPM Display & Tempo Term */}
          <div className="flex items-center gap-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-slate-400 font-bold text-[11px]">Velocidade:</span>
              <span className="font-mono text-base font-extrabold text-emerald-400">
                {currentBpm} <span className="text-xs font-semibold text-slate-400">BPM</span>
              </span>
            </div>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700/60 text-[10px] text-slate-300 font-medium">
              {currentBpm < 60
                ? 'Largo (Muito lento)'
                : currentBpm <= 75
                ? 'Adagio (Aprendizado)'
                : currentBpm <= 95
                ? 'Andante (Ensaio)'
                : currentBpm <= 115
                ? 'Moderato (Padrão)'
                : currentBpm <= 135
                ? 'Allegro (Animado)'
                : 'Presto (Rápido)'}
            </span>
          </div>

          {/* Steppers & Speed Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* -5 BPM button */}
            <button
              onClick={() => setCurrentBpm((prev) => Math.max(40, prev - 5))}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 active:scale-95 transition-all"
              title="Diminuir velocidade em 5 BPM"
            >
              -5
            </button>

            {/* Presets: 60, 80, 100, 120 BPM */}
            {[
              { bpm: 60, label: '60 (Lento)' },
              { bpm: 80, label: '80 (Ensaio)' },
              { bpm: 100, label: '100 (Padrão)' },
              { bpm: 120, label: '120 (Alegro)' },
            ].map((preset) => (
              <button
                key={preset.bpm}
                onClick={() => setCurrentBpm(preset.bpm)}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  currentBpm === preset.bpm
                    ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {preset.label}
              </button>
            ))}

            {/* +5 BPM button */}
            <button
              onClick={() => setCurrentBpm((prev) => Math.min(180, prev + 5))}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 active:scale-95 transition-all"
              title="Aumentar velocidade em 5 BPM"
            >
              +5
            </button>

            {/* Reset to Score Original BPM */}
            {scoreData.bpm && currentBpm !== scoreData.bpm && (
              <button
                onClick={() => setCurrentBpm(scoreData.bpm)}
                className="px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-blue-400 text-[11px] font-semibold border border-blue-500/30 transition-all"
                title={`Restaurar velocidade original do hino (${scoreData.bpm} BPM)`}
              >
                Orig. ({scoreData.bpm})
              </button>
            )}

            {/* Continuous BPM Slider */}
            <div className="flex items-center gap-1.5 pl-1.5 border-l border-slate-800">
              <input
                type="range"
                min="40"
                max="180"
                step="1"
                value={currentBpm}
                onChange={(e) => setCurrentBpm(Number(e.target.value))}
                className="w-20 accent-emerald-500 cursor-pointer"
                title={`Ajuste contínuo de velocidade: ${currentBpm} BPM`}
              />
            </div>
          </div>
        </div>

        {/* ROW 2: Live Note Color & Minute Indicator */}
        {activeNotesDisplay.length > 0 && (
          <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-950/90 border border-slate-700/80 text-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span className="font-mono font-bold text-emerald-400">
                Minuto {formatTime(currentTime)}
              </span>
              <span className="text-slate-400">• Tocando agora:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {activeNotesDisplay.map((note, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[11px] text-white shadow-xs"
                    style={{ backgroundColor: note.pitchInfo.color }}
                  >
                    <span>{note.pitchInfo.ptName}{note.pitchInfo.octave}</span>
                    <span className="text-[9px] opacity-90 uppercase">({note.part})</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Chromesthesia Pitch Color Palette Guide */}
            <div className="hidden lg:flex items-center gap-1 text-[10px] text-slate-400">
              <span>Cores das Notas:</span>
              <span className="text-red-400 font-bold">Dó</span>
              <span className="text-orange-400 font-bold">Ré</span>
              <span className="text-amber-300 font-bold">Mi</span>
              <span className="text-emerald-400 font-bold">Fá</span>
              <span className="text-cyan-400 font-bold">Sol</span>
              <span className="text-blue-400 font-bold">Lá</span>
              <span className="text-purple-400 font-bold">Si</span>
            </div>
          </div>
        )}

        {/* ROW 3: Play/Pause, Interactive Progress Bar & Volume */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950/90 p-3 rounded-2xl border border-slate-800 shadow-inner">
          {/* Main Action Buttons */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={handlePlayPause}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold shadow-lg transition-all hover:scale-103 active:scale-97 cursor-pointer text-sm ${
                isPlaying
                  ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-950/50'
                  : soundMode === 'voice'
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/50'
                  : soundMode === 'both'
                  ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-950/50'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50'
              }`}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4 fill-white" />
                  <span>Pausar</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>
                    {soundMode === 'voice'
                      ? 'Cantar com Voz'
                      : soundMode === 'both'
                      ? 'Tocar & Cantar'
                      : 'Tocar Piano'}
                  </span>
                </>
              )}
            </button>

            <button
              onClick={handleRestart}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Voltar ao início da partitura (Recomeçar)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <div className="text-xs text-slate-400 flex items-center gap-1.5 hidden md:flex pl-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-medium text-slate-300">{statusMessage}</span>
            </div>
          </div>

          {/* Interactive Progress Bar & Time Display */}
          <div className="flex-1 w-full flex items-center gap-3">
            <span className="font-mono text-xs text-emerald-400 font-bold min-w-11 text-right">
              {formatTime(currentTime)}
            </span>

            <div className="flex-1 relative flex items-center group">
              <input
                type="range"
                min="0"
                max={totalDuration || 100}
                step="0.1"
                value={currentTime}
                onChange={(e) => handleSeek(Number(e.target.value))}
                className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 focus:outline-none"
              />
            </div>

            <span className="font-mono text-xs text-slate-400 min-w-11">
              {formatTime(totalDuration)}
            </span>
          </div>

          {/* Volume Slider */}
          <div className="flex items-center gap-2 min-w-32 shrink-0">
            <button
              onClick={toggleMute}
              className="text-slate-400 hover:text-white transition-colors"
              title={isMuted ? 'Desmutar' : 'Mutar'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={isMuted ? 0 : volume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              className="w-20 accent-emerald-500 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useRef, useState, useMemo } from 'react';
import abcjs from 'abcjs';
import { pianoEngine } from '../services/pianoAudioEngine';
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
  Check,
  User,
  Users
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

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  visualObj,
  abc,
  transposition,
  onTranspositionChange
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [totalDuration, setTotalDuration] = useState<number>(0);
  const [bpmPercent, setBpmPercent] = useState<number>(100);
  const [metronomeOn, setMetronomeOn] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(90);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Sound timbre: Piano, Human Singing Voice, or Combined
  const [soundMode, setSoundMode] = useState<SoundMode>('piano');

  // Selected voice for solo or focus
  const [selectedVoice, setSelectedVoice] = useState<'all' | VocalPart>('all');
  const [voiceFocusMode, setVoiceFocusMode] = useState<VoiceFocusMode>('solo');

  // Individual voice on/off toggles
  const [voiceToggles, setVoiceToggles] = useState<{
    soprano: boolean;
    contralto: boolean;
    tenor: boolean;
    baixo: boolean;
  }>({
    soprano: true,
    contralto: true,
    tenor: true,
    baixo: true,
  });

  const [statusMessage, setStatusMessage] = useState<string>('Piano pronto para tocar');

  // Animation & scheduling refs
  const animFrameRef = useRef<number | null>(null);
  const playbackStartCtxTimeRef = useRef<number>(0);
  const seekOffsetRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);
  const scheduledTimeoutsRef = useRef<number[]>([]);
  const lastBeatClickedRef = useRef<number>(-1);

  // Parse notes, tracks, and intelligent SATB voice separation from visualObj or ABC
  const scoreData = useMemo(() => {
    try {
      let tune = visualObj;
      if (!tune && abc) {
        const parsed = abcjs.parseOnly(abc);
        tune = parsed && parsed.length > 0 ? parsed[0] : null;
      }
      if (!tune) return { notes: [], totalSec: 0, bpm: 100, beatLength: 0.25, hasMultipleTracks: false };

      const audioInfo = tune.setUpAudio ? tune.setUpAudio() : null;
      if (!audioInfo || !audioInfo.tracks) {
        return { notes: [], totalSec: 0, bpm: 100, beatLength: 0.25, hasMultipleTracks: false };
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

      // Sort notes chronologically
      rawNotes.sort((a, b) => a.startBeats - b.startBeats);

      const parsedNotes: ParsedNote[] = [];

      if (hasMultipleTracks) {
        // Multi-track score: track 0 = Soprano, 1 = Contralto, 2 = Tenor, 3 = Baixo
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
        // Single track with polyphony / chords: split notes by chord pitch levels
        // Group notes occurring at same timestamp (within 0.05 beats)
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
          // Sort by pitch descending (highest to lowest)
          group.sort((a, b) => b.pitch - a.pitch);

          group.forEach((n, idx) => {
            let part: VocalPart = 'soprano';
            let trackIdx = 0;

            if (group.length === 1) {
              // Single note: classify by pitch range
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
              // 4 or more notes in chord
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
        hasMultipleTracks,
      };
    } catch (e) {
      console.warn('Error parsing score audio notes:', e);
      return { notes: [], totalSec: 0, bpm: 100, beatLength: 0.25, hasMultipleTracks: false };
    }
  }, [visualObj, abc]);

  // Update total duration when score or speed changes
  const effectiveTotalDuration = useMemo(() => {
    if (scoreData.totalSec === 0) return 0;
    return scoreData.totalSec * (100 / bpmPercent);
  }, [scoreData.totalSec, bpmPercent]);

  useEffect(() => {
    setTotalDuration(effectiveTotalDuration);
  }, [effectiveTotalDuration]);

  // Stop playback when song changes
  useEffect(() => {
    handleStop();
  }, [abc]);

  const clearScheduledNotes = () => {
    scheduledTimeoutsRef.current.forEach((t) => clearTimeout(t));
    scheduledTimeoutsRef.current = [];
    pianoEngine.stopAllNotes();
    voiceEngine.stopAll();
  };

  const highlightNotesAtTime = (time: number) => {
    document.querySelectorAll('.abcjs-highlight').forEach((el) => {
      el.classList.remove('abcjs-highlight');
    });

    const speedRatio = 100 / bpmPercent;
    const active = scoreData.notes.filter((n) => {
      const start = n.startTime * speedRatio;
      const end = start + n.duration * speedRatio;
      return time >= start && time <= end;
    });

    if (active.length > 0) {
      const svgNotes = document.querySelectorAll('.abcjs-note');
      svgNotes.forEach((el) => {
        el.classList.add('abcjs-highlight');
      });
    }
  };

  // Determine note playback volume and whether it should play based on voice settings
  const getNotePlaybackConfig = (note: ParsedNote) => {
    // 1. Check individual voice toggles
    if (!voiceToggles[note.part]) {
      return { play: false, volumeMultiplier: 0 };
    }

    // 2. Check selectedVoice & focusMode
    if (selectedVoice !== 'all') {
      const isSelected = note.part === selectedVoice;

      if (voiceFocusMode === 'solo') {
        // Pure Solo: only selected voice sounds!
        if (!isSelected) {
          return { play: false, volumeMultiplier: 0 };
        }
        return { play: true, volumeMultiplier: 1.0 };
      } else if (voiceFocusMode === 'highlight') {
        // Highlight mode: selected voice loud (100%), other voices soft background (12%)
        return {
          play: true,
          volumeMultiplier: isSelected ? 1.0 : 0.12,
        };
      }
    }

    // Full choir balance
    return { play: true, volumeMultiplier: 0.9 };
  };

  // Main playback scheduling and animation loop
  const startPlaybackAt = (offsetSec: number) => {
    pianoEngine.resume();
    voiceEngine.resume();

    clearScheduledNotes();
    isPlayingRef.current = true;
    setIsPlaying(true);

    const voiceDescription =
      selectedVoice === 'all'
        ? 'Todas as vozes'
        : selectedVoice.charAt(0).toUpperCase() + selectedVoice.slice(1) + (voiceFocusMode === 'solo' ? ' (Solo)' : ' (Destaque)');

    setStatusMessage(`Tocando ${voiceDescription}...`);

    const ctx = pianoEngine.initContext();
    const startCtx = ctx.currentTime;
    playbackStartCtxTimeRef.current = startCtx;
    seekOffsetRef.current = offsetSec;
    lastBeatClickedRef.current = -1;

    const speedRatio = 100 / bpmPercent;
    const effectiveBpm = scoreData.bpm * (bpmPercent / 100);
    const beatIntervalSec = 60 / effectiveBpm;

    // Schedule notes
    scoreData.notes.forEach((note) => {
      const config = getNotePlaybackConfig(note);
      if (!config.play) return;

      const noteScheduledTime = note.startTime * speedRatio;
      if (noteScheduledTime >= offsetSec - 0.05) {
        const delayFromNow = noteScheduledTime - offsetSec;
        const noteDurationScaled = note.duration * speedRatio;
        const effectivePitch = note.pitch + transposition;

        if (delayFromNow >= 0) {
          const playTimestamp = startCtx + delayFromNow;
          const noteVel = note.volume * config.volumeMultiplier;

          // Sound output routing
          if (soundMode === 'piano' || soundMode === 'both') {
            pianoEngine.playNote(
              effectivePitch,
              playTimestamp,
              noteDurationScaled,
              noteVel
            );
          }

          if (soundMode === 'voice' || soundMode === 'both') {
            voiceEngine.singNote(
              effectivePitch,
              note.part,
              playTimestamp,
              noteDurationScaled,
              noteVel * 1.05
            );
          }
        }
      }
    });

    // Metronome & Progress Loop
    const tick = () => {
      if (!isPlayingRef.current) return;

      const elapsed = ctx.currentTime - startCtx;
      const currentPos = offsetSec + elapsed;

      // Metronome accompaniment
      if (metronomeOn) {
        const currentBeat = Math.floor(currentPos / beatIntervalSec);
        if (currentBeat > lastBeatClickedRef.current && currentBeat >= 0) {
          lastBeatClickedRef.current = currentBeat;
          pianoEngine.playClick(currentBeat % 4 === 0);
        }
      }

      if (currentPos >= effectiveTotalDuration && effectiveTotalDuration > 0) {
        handleStop();
        setStatusMessage('Música finalizada');
        return;
      }

      setCurrentTime(currentPos);
      highlightNotesAtTime(currentPos);

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
  };

  const handlePlayPause = () => {
    pianoEngine.resume();
    voiceEngine.resume();

    if (isPlaying) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      clearScheduledNotes();
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      setStatusMessage('Pausado');
    } else {
      let startFrom = currentTime;
      if (startFrom >= effectiveTotalDuration - 0.5) {
        startFrom = 0;
      }
      startPlaybackAt(startFrom);
    }
  };

  const handleStop = () => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    clearScheduledNotes();
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    setCurrentTime(0);
    seekOffsetRef.current = 0;
    setStatusMessage('Pronto para ensaio');
    document.querySelectorAll('.abcjs-highlight').forEach((el) => {
      el.classList.remove('abcjs-highlight');
    });
  };

  const handleRestart = () => {
    pianoEngine.resume();
    handleStop();
    startPlaybackAt(0);
  };

  const handleSeek = (newSec: number) => {
    const clamped = Math.max(0, Math.min(newSec, effectiveTotalDuration));
    setCurrentTime(clamped);
    if (isPlaying) {
      clearScheduledNotes();
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      startPlaybackAt(clamped);
    }
  };

  const handleSelectVoiceQuick = (voice: 'all' | VocalPart) => {
    setSelectedVoice(voice);

    // If a specific voice is clicked in solo mode, ensure that voice toggle is on
    if (voice !== 'all') {
      setVoiceToggles((prev) => ({
        ...prev,
        [voice]: true,
      }));
    }

    if (isPlaying) {
      const cur = currentTime;
      handleStop();
      startPlaybackAt(cur);
    }
  };

  const toggleSingleVoice = (voice: VocalPart) => {
    setVoiceToggles((prev) => {
      const updated = { ...prev, [voice]: !prev[voice] };
      return updated;
    });

    if (isPlaying) {
      const cur = currentTime;
      handleStop();
      startPlaybackAt(cur);
    }
  };

  const handleSoloOnlyThisVoice = (voice: VocalPart) => {
    setSelectedVoice(voice);
    setVoiceFocusMode('solo');
    setVoiceToggles({
      soprano: voice === 'soprano',
      contralto: voice === 'contralto',
      tenor: voice === 'tenor',
      baixo: voice === 'baixo',
    });

    if (isPlaying) {
      const cur = currentTime;
      handleStop();
      startPlaybackAt(cur);
    }
  };

  const handleRestoreAllVoices = () => {
    setSelectedVoice('all');
    setVoiceFocusMode('full');
    setVoiceToggles({
      soprano: true,
      contralto: true,
      tenor: true,
      baixo: true,
    });

    if (isPlaying) {
      const cur = currentTime;
      handleStop();
      startPlaybackAt(cur);
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
        {/* ROW 1: Voice Isolation (SATB), Instrument Timbre, Transposition & Speed */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs">
          {/* SATB Voice Solo & Separation Bar */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-700/80">
            <span className="text-slate-400 font-bold px-2 flex items-center gap-1 text-[11px]">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span>Vozes do Coral:</span>
            </span>

            {/* Quick All Button */}
            <button
              onClick={handleRestoreAllVoices}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all ${
                selectedVoice === 'all' && voiceToggles.soprano && voiceToggles.contralto && voiceToggles.tenor && voiceToggles.baixo
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              Todas (Coral)
            </button>

            {/* Individual Voice Solo Buttons */}
            {(
              [
                { id: 'soprano', label: 'Soprano', sub: 'Agudo' },
                { id: 'contralto', label: 'Contralto', sub: 'Médio' },
                { id: 'tenor', label: 'Tenor', sub: 'Agudo M.' },
                { id: 'baixo', label: 'Baixo', sub: 'Grave' },
              ] as const
            ).map((v) => {
              const isOnlyThisVoice =
                selectedVoice === v.id &&
                voiceToggles[v.id] &&
                !Object.entries(voiceToggles).some(([k, val]) => k !== v.id && val);

              return (
                <button
                  key={v.id}
                  onClick={() => handleSoloOnlyThisVoice(v.id)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    isOnlyThisVoice
                      ? 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-400 scale-102'
                      : voiceToggles[v.id]
                      ? 'bg-slate-800 text-slate-100 hover:bg-slate-700'
                      : 'bg-slate-900/60 text-slate-500 line-through'
                  }`}
                  title={`Clique para ouvir SOMENTE o ${v.label}`}
                >
                  <User className="w-3 h-3" />
                  <span>{v.label}</span>
                  {isOnlyThisVoice && (
                    <span className="text-[10px] font-black uppercase tracking-wider bg-slate-950/20 px-1 rounded">
                      SOLO
                    </span>
                  )}
                </button>
              );
            })}

            {/* Voice Focus Mode: Solo (only) vs Highlight (background piano) */}
            {selectedVoice !== 'all' && (
              <div className="flex items-center gap-1 pl-2 border-l border-slate-700 text-[11px]">
                <button
                  onClick={() => {
                    setVoiceFocusMode('solo');
                    if (isPlaying) {
                      const cur = currentTime;
                      handleStop();
                      startPlaybackAt(cur);
                    }
                  }}
                  className={`px-2 py-0.5 rounded font-semibold ${
                    voiceFocusMode === 'solo' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Somente Ela
                </button>
                <button
                  onClick={() => {
                    setVoiceFocusMode('highlight');
                    if (isPlaying) {
                      const cur = currentTime;
                      handleStop();
                      startPlaybackAt(cur);
                    }
                  }}
                  className={`px-2 py-0.5 rounded font-semibold ${
                    voiceFocusMode === 'highlight' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' : 'text-slate-400 hover:text-white'
                  }`}
                  title="A voz selecionada toca alto e as outras tocam bem baixinhas ao fundo"
                >
                  Destacar com Fundo
                </button>
              </div>
            )}
          </div>

          {/* Sound Timbre Selector: Piano vs Voz Humana Cantada */}
          <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-700/80">
            <span className="text-slate-400 font-bold px-2 text-[11px] flex items-center gap-1">
              <span>Timbre:</span>
            </span>
            <button
              onClick={() => {
                setSoundMode('piano');
                if (isPlaying) {
                  const cur = currentTime;
                  handleStop();
                  startPlaybackAt(cur);
                }
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold text-xs transition-all ${
                soundMode === 'piano'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <Piano className="w-3.5 h-3.5" />
              <span>Piano</span>
            </button>

            <button
              onClick={() => {
                setSoundMode('voice');
                if (isPlaying) {
                  const cur = currentTime;
                  handleStop();
                  startPlaybackAt(cur);
                }
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold text-xs transition-all ${
                soundMode === 'voice'
                  ? 'bg-rose-600 text-white shadow-sm animate-pulse'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
              title="Voz humana cantando os tons com vibrato vocal (formantes de coral)"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Voz Cantada</span>
            </button>

            <button
              onClick={() => {
                setSoundMode('both');
                if (isPlaying) {
                  const cur = currentTime;
                  handleStop();
                  startPlaybackAt(cur);
                }
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold text-xs transition-all ${
                soundMode === 'both'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
              title="Piano tocando o ritmo junto com a voz humana cantando"
            >
              <Music className="w-3.5 h-3.5" />
              <span>Piano + Voz</span>
            </button>
          </div>

          {/* Transposition & Speed Controls */}
          <div className="flex items-center gap-2">
            {/* Transposition */}
            <div className="flex items-center gap-1 bg-slate-950/80 px-2 py-1 rounded-xl border border-slate-700/80">
              <span className="text-slate-400 font-medium text-[11px] flex items-center gap-0.5">
                <Music2 className="w-3 h-3 text-blue-400" />
                <span>Tom:</span>
              </span>
              <button
                onClick={() => {
                  onTranspositionChange(transposition - 1);
                  if (isPlaying) {
                    const cur = currentTime;
                    handleStop();
                    startPlaybackAt(cur);
                  }
                }}
                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 font-bold text-slate-200"
              >
                -1
              </button>
              <span className="min-w-6 text-center font-mono font-bold text-blue-400 text-xs">
                {transposition === 0 ? 'Orig.' : transposition > 0 ? `+${transposition}` : transposition}
              </span>
              <button
                onClick={() => {
                  onTranspositionChange(transposition + 1);
                  if (isPlaying) {
                    const cur = currentTime;
                    handleStop();
                    startPlaybackAt(cur);
                  }
                }}
                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 font-bold text-slate-200"
              >
                +1
              </button>
            </div>

            {/* Metronome */}
            <button
              onClick={() => {
                pianoEngine.resume();
                setMetronomeOn(!metronomeOn);
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border text-xs font-semibold transition-all ${
                metronomeOn
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold animate-pulse'
                  : 'bg-slate-950/80 text-slate-300 border-slate-700/80 hover:bg-slate-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Metrônomo</span>
            </button>

            {/* Speed slider */}
            <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1 rounded-xl border border-slate-700/80">
              <Sliders className="w-3 h-3 text-slate-400" />
              <input
                type="range"
                min="50"
                max="150"
                step="5"
                value={bpmPercent}
                onChange={(e) => {
                  const newPercent = Number(e.target.value);
                  setBpmPercent(newPercent);
                  if (isPlaying) {
                    const cur = currentTime;
                    handleStop();
                    startPlaybackAt(cur);
                  }
                }}
                className="w-16 accent-emerald-500 cursor-pointer"
              />
              <span className="font-mono text-emerald-400 text-[11px] min-w-8">{bpmPercent}%</span>
            </div>
          </div>
        </div>

        {/* ROW 2: Play/Pause, Progress Bar, Volume */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950/90 p-3 rounded-2xl border border-slate-800 shadow-inner">
          {/* Main Action Buttons */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={handlePlayPause}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold shadow-lg transition-all hover:scale-103 active:scale-97 cursor-pointer text-sm ${
                soundMode === 'voice'
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
              title="Voltar ao início da partitura"
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
                max={effectiveTotalDuration || 100}
                step="0.1"
                value={currentTime}
                onChange={(e) => handleSeek(Number(e.target.value))}
                className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 focus:outline-none"
              />
            </div>

            <span className="font-mono text-xs text-slate-400 min-w-11">
              {formatTime(effectiveTotalDuration)}
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

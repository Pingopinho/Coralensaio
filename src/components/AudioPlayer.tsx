import React, { useEffect, useRef, useState } from 'react';
import abcjs from 'abcjs';
import { pianoEngine } from '../services/pianoAudioEngine';
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
  Layers
} from 'lucide-react';

interface AudioPlayerProps {
  visualObj: any;
  abc: string;
  transposition: number;
  onTranspositionChange: (semitones: number) => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  visualObj,
  abc,
  transposition,
  onTranspositionChange
}) => {
  const audioContainerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [bpmPercent, setBpmPercent] = useState<number>(100);
  const [metronomeOn, setMetronomeOn] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [activeVoice, setActiveVoice] = useState<'all' | 'soprano' | 'contralto' | 'tenor' | 'baixo'>('all');
  const [statusMessage, setStatusMessage] = useState<string>('Pronto para tocar');

  const synthControlRef = useRef<any>(null);
  const createSynthRef = useRef<any>(null);
  const metronomeIntervalRef = useRef<any>(null);

  // Initialize ABCJS Native Audio Synth Controller
  useEffect(() => {
    if (!visualObj || !abcjs || !abcjs.synth) return;

    let isMounted = true;

    try {
      if (!abcjs.synth.supportsAudio()) {
        setStatusMessage('Áudio Web não suportado neste navegador.');
        return;
      }

      // Cursor controller to highlight notes in real time during playback
      const cursorControl = {
        onStart: () => {
          if (!isMounted) return;
          setIsPlaying(true);
          setStatusMessage('Tocando...');
        },
        onEvent: (event: any) => {
          if (!isMounted) return;

          // Clear previous note highlights
          document.querySelectorAll('.abcjs-highlight').forEach((el) => {
            el.classList.remove('abcjs-highlight');
          });

          // Highlight current notes
          if (event && event.elements) {
            event.elements.forEach((group: any) => {
              if (Array.isArray(group)) {
                group.forEach((elem: any) => elem?.classList?.add('abcjs-highlight'));
              } else if (group?.classList) {
                group.classList.add('abcjs-highlight');
              }
            });
          }
        },
        onFinished: () => {
          if (!isMounted) return;
          setIsPlaying(false);
          setStatusMessage('Música finalizada');
          document.querySelectorAll('.abcjs-highlight').forEach((el) => {
            el.classList.remove('abcjs-highlight');
          });
        }
      };

      // Create or reuse SynthController
      const synthControl = new abcjs.synth.SynthController();
      synthControlRef.current = synthControl;

      // Load native player into DOM
      const targetDiv = audioContainerRef.current;
      if (targetDiv) {
        targetDiv.innerHTML = '';
        synthControl.load(targetDiv, cursorControl, {
          displayLoop: true,
          displayRestart: true,
          displayPlay: true,
          displayProgress: true,
          displayWarp: true,
        });

        // Initialize audio buffer for Acoustic Grand Piano (MIDI Program 0)
        const createSynth = new abcjs.synth.CreateSynth();
        createSynthRef.current = createSynth;

        setStatusMessage('Carregando sintetizador de piano...');

        createSynth.init({
          visualObj: visualObj,
          options: {
            soundFontUrl: 'https://paulrosen.github.io/midi-js-soundfonts/FluidR3_GM/',
            program: 0, // Acoustic Grand Piano
            chordsOff: false,
          }
        }).then(() => {
          if (!isMounted) return;
          synthControl.setTune(visualObj, false, {
            program: 0,
            midiTranspose: transposition
          }).then(() => {
            if (!isMounted) return;
            setStatusMessage('Piano pronto');
          }).catch((err: any) => {
            console.warn('Synth tune error', err);
            setStatusMessage('Pronto com sintetizador interno');
          });
        }).catch((err: any) => {
          console.warn('CreateSynth init error, fallback active', err);
          setStatusMessage('Pronto (Modo Piano Direto)');
        });
      }
    } catch (err: any) {
      console.warn('ABCjs synth load error', err);
      setStatusMessage('Pronto (Piano Web Audio)');
    }

    return () => {
      isMounted = false;
      try {
        if (synthControlRef.current?.pause) {
          synthControlRef.current.pause();
        }
      } catch {}
      document.querySelectorAll('.abcjs-highlight').forEach((el) => {
        el.classList.remove('abcjs-highlight');
      });
    };
  }, [visualObj, transposition]);

  // Metronome click effect
  useEffect(() => {
    if (metronomeOn) {
      pianoEngine.resume();
      let beat = 0;
      const bpm = Math.round(100 * (bpmPercent / 100));
      const intervalMs = (60 / bpm) * 1000;

      metronomeIntervalRef.current = setInterval(() => {
        pianoEngine.playClick(beat % 4 === 0);
        beat++;
      }, intervalMs);
    } else {
      if (metronomeIntervalRef.current) {
        clearInterval(metronomeIntervalRef.current);
      }
    }

    return () => {
      if (metronomeIntervalRef.current) {
        clearInterval(metronomeIntervalRef.current);
      }
    };
  }, [metronomeOn, bpmPercent]);

  // Volume control
  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    setIsMuted(newVol === 0);
    pianoEngine.setMasterVolume(newVol / 100);
  };

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      pianoEngine.setMasterVolume(volume / 100);
    } else {
      setIsMuted(true);
      pianoEngine.setMasterVolume(0);
    }
  };

  // Trigger Play / Pause on the native ABCJS synth controller
  const handleNativePlayPause = () => {
    pianoEngine.resume();
    const playBtn = audioContainerRef.current?.querySelector('.abcjs-play') as HTMLElement;
    if (playBtn) {
      playBtn.click();
    } else if (synthControlRef.current) {
      if (isPlaying) {
        synthControlRef.current.pause?.();
        setIsPlaying(false);
      } else {
        synthControlRef.current.play?.();
        setIsPlaying(true);
      }
    }
  };

  const handleNativeRestart = () => {
    const restartBtn = audioContainerRef.current?.querySelector('.abcjs-restart') as HTMLElement;
    if (restartBtn) {
      restartBtn.click();
    }
  };

  return (
    <div className="bg-slate-900 border-t border-slate-800 text-slate-200 px-4 py-3 sm:px-6 shadow-2xl">
      <div className="max-w-6xl mx-auto flex flex-col gap-3">
        {/* Top bar of player: Rehearsal Voices, Tempo & Metronome */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Voices / SATB Selector */}
          <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
            <span className="text-slate-400 font-medium px-2 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span>Vozes:</span>
            </span>
            {(['all', 'soprano', 'contralto', 'tenor', 'baixo'] as const).map((voice) => (
              <button
                key={voice}
                onClick={() => setActiveVoice(voice)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  activeVoice === voice
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-700/60'
                }`}
              >
                {voice === 'all' ? 'Todas' : voice.charAt(0).toUpperCase() + voice.slice(1)}
              </button>
            ))}
          </div>

          {/* Transposition Controls */}
          <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
            <span className="text-slate-400 font-medium px-2 flex items-center gap-1">
              <Music2 className="w-3.5 h-3.5 text-blue-400" />
              <span>Tom:</span>
            </span>
            <button
              onClick={() => onTranspositionChange(transposition - 1)}
              className="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 font-bold text-slate-200"
              title="Abaixar 1 semitom"
            >
              -1
            </button>
            <span className="min-w-8 text-center font-mono font-bold text-blue-400">
              {transposition === 0 ? 'Original' : transposition > 0 ? `+${transposition}` : transposition}
            </span>
            <button
              onClick={() => onTranspositionChange(transposition + 1)}
              className="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 font-bold text-slate-200"
              title="Aumentar 1 semitom"
            >
              +1
            </button>
            {transposition !== 0 && (
              <button
                onClick={() => onTranspositionChange(0)}
                className="px-1.5 text-xs text-slate-400 hover:text-white"
                title="Voltar ao tom original"
              >
                Reset
              </button>
            )}
          </div>

          {/* Metronome & Rehearsal Speed Slider */}
          <div className="flex items-center gap-3 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
            <button
              onClick={() => setMetronomeOn(!metronomeOn)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all ${
                metronomeOn
                  ? 'bg-amber-500 text-slate-950 font-bold animate-pulse'
                  : 'bg-slate-700/80 text-slate-300 hover:bg-slate-700'
              }`}
              title="Metrônomo sonoro para manter o compasso durante o ensaio"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Metrônomo {metronomeOn ? 'Ligado' : ''}</span>
            </button>

            <div className="flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">Velocidade:</span>
              <input
                type="range"
                min="50"
                max="150"
                step="5"
                value={bpmPercent}
                onChange={(e) => setBpmPercent(Number(e.target.value))}
                className="w-20 accent-emerald-500 cursor-pointer"
              />
              <span className="font-mono text-emerald-400 min-w-10">{bpmPercent}%</span>
            </div>
          </div>
        </div>

        {/* Main Audio Controls Area with Native ABCjs Container */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
          {/* Quick Play/Restart Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleNativePlayPause}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-950/50 transition-all hover:scale-105 active:scale-95"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4 fill-white" />
                  <span>Pausar</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>Tocar Piano</span>
                </>
              )}
            </button>

            <button
              onClick={handleNativeRestart}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Voltar ao início da música"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <div className="text-xs text-slate-400 flex items-center gap-1.5 hidden md:flex">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>{statusMessage}</span>
            </div>
          </div>

          {/* Native ABCJS Synth Controller Target Container */}
          <div className="flex-1 w-full max-w-xl">
            <div
              ref={audioContainerRef}
              id="abcjs-native-audio"
              className="w-full"
            />
          </div>

          {/* Volume Slider */}
          <div className="flex items-center gap-2 min-w-36">
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
              className="w-24 accent-emerald-500 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { pianoEngine } from '../services/pianoAudioEngine';
import { Volume2, Music } from 'lucide-react';

export const PitchPipe: React.FC = () => {
  const [activeNote, setActiveNote] = useState<string | null>(null);

  // Common choir reference pitches
  const pitches = [
    { label: 'C3 (Dó)', midi: 48, voice: 'Baixo' },
    { label: 'E3 (Mi)', midi: 52, voice: 'Baixo/Tenor' },
    { label: 'G3 (Sol)', midi: 55, voice: 'Tenor' },
    { label: 'C4 (Dó Central)', midi: 60, voice: 'Tenor/Contralto' },
    { label: 'E4 (Mi)', midi: 64, voice: 'Contralto' },
    { label: 'G4 (Sol)', midi: 67, voice: 'Contralto/Soprano' },
    { label: 'A4 (Lá 440)', midi: 69, voice: 'Afinação Geral' },
    { label: 'C5 (Dó)', midi: 72, voice: 'Soprano' },
  ];

  const handlePlayPitch = (pitch: typeof pitches[0]) => {
    pianoEngine.resume();
    pianoEngine.playNote(pitch.midi, undefined, 2.0, 0.9);
    setActiveNote(pitch.label);
    setTimeout(() => {
      setActiveNote((curr) => (curr === pitch.label ? null : curr));
    }, 1500);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-2 overflow-x-auto">
      <div className="flex items-center gap-1.5 text-xs text-slate-400 shrink-0 font-medium px-2">
        <Music className="w-3.5 h-3.5 text-emerald-400" />
        <span className="hidden sm:inline">Diapasão / Notas de Início:</span>
        <span className="sm:hidden">Notas:</span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {pitches.map((p) => {
          const isActive = activeNote === p.label;
          return (
            <button
              key={p.label}
              onClick={() => handlePlayPitch(p)}
              className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-emerald-500 text-white shadow-md scale-105'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
              title={`${p.label} - Referência para ${p.voice}`}
            >
              {p.label.split(' ')[0]}
            </button>
          );
        })}
      </div>
    </div>
  );
};

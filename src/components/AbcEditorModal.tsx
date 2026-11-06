import React, { useState } from 'react';
import {
  Code,
  X,
  Check,
  RotateCcw,
  BookOpen,
  Copy,
  Info
} from 'lucide-react';
import { Song } from '../types';

interface AbcEditorModalProps {
  song: Song;
  onSaveAbc: (updatedAbc: string, title: string, notes?: string) => void;
  onClose: () => void;
}

export const AbcEditorModal: React.FC<AbcEditorModalProps> = ({
  song,
  onSaveAbc,
  onClose
}) => {
  const [abcContent, setAbcContent] = useState(song.abc);
  const [title, setTitle] = useState(song.title);
  const [notes, setNotes] = useState(song.notes || '');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(abcContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    onSaveAbc(abcContent, title, notes);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl p-5 sm:p-6 shadow-2xl text-slate-100 relative animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Code className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Editar Partitura (Notação ABC)</h2>
              <p className="text-xs text-slate-400">
                Ajuste notas, compassos, armaduras e anotações para o coral
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Título da Música
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Rehearsal notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Anotações de Ensaio (Regência e Dinâmica)
            </label>
            <input
              type="text"
              placeholder="Ex: Cuidado com a respiração no compasso 8, diminuendo no final."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800/90 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* ABC Code area */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <span>Código ABC</span>
                <span className="text-[11px] font-normal text-slate-500">
                  (Padrão internacional de partituras de texto)
                </span>
              </label>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copiado!' : 'Copiar Código'}</span>
              </button>
            </div>

            <textarea
              rows={12}
              value={abcContent}
              onChange={(e) => setAbcContent(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-emerald-400 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Mini cheat sheet */}
          <div className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-slate-300">
              <Info className="w-3.5 h-3.5 text-blue-400" />
              <span>Dicas de Sintaxe ABC:</span>
            </div>
            <p>
              • <strong>T:</strong> Título | <strong>M:</strong> Compasso (ex: 4/4) | <strong>K:</strong> Tom (ex: G, C, F)
            </p>
            <p>
              • Notas graves: <code className="text-emerald-300">C, D, E,</code> | Notas médias: <code className="text-emerald-300">C D E F G A B</code> | Agudas: <code className="text-emerald-300">c d e f g</code>
            </p>
            <p>
              • Acordes: <code className="text-emerald-300">[CEG]</code> | Duração: <code className="text-emerald-300">C2</code> (mínima), <code className="text-emerald-300">C4</code> (semibreve)
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-3 mt-4 shrink-0">
          <button
            type="button"
            onClick={() => setAbcContent(song.abc)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restaurar Original</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-950/40"
            >
              <Check className="w-4 h-4" />
              <span>Salvar Alterações</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

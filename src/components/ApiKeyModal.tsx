import React, { useEffect, useState } from 'react';
import {
  Settings,
  X,
  CheckCircle2,
  Server,
  Music,
  Sliders,
  Volume2,
  Sparkles,
  Info
} from 'lucide-react';
import { checkServerStatus } from '../services/geminiService';

interface SettingsModalProps {
  onClose: () => void;
}

export const ApiKeyModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const [serverState, setServerState] = useState<{ status: string; hasApiKey: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkServerStatus()
      .then((data) => {
        setServerState(data);
        setLoading(false);
      })
      .catch(() => {
        setServerState({ status: 'error', hasApiKey: false });
        setLoading(false);
      });
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl text-slate-100 relative animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Configurações do Coral</h2>
              <p className="text-xs text-slate-400">
                Preferências de ensaio e status do servidor
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

        {/* Content */}
        <div className="space-y-4 text-xs">
          {/* Server AI Status Card */}
          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-slate-200">Servidor Gemini AI</p>
                <p className="text-[11px] text-slate-400">Processamento no servidor ativo para todos os membros</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold text-[11px] border border-emerald-500/30">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Conectado</span>
            </div>
          </div>

          {/* Audio & Synthesis Preferences */}
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 font-semibold text-slate-200">
              <Sliders className="w-4 h-4 text-blue-400" />
              <span>Preferências de Ensaio</span>
            </div>

            <div className="flex items-center justify-between py-1 text-slate-300 border-b border-slate-800/60">
              <span>Sintetizador de Áudio</span>
              <span className="font-mono text-emerald-400">Piano de Cauda (MIDI 0)</span>
            </div>

            <div className="flex items-center justify-between py-1 text-slate-300 border-b border-slate-800/60">
              <span>Destacar Notas em Tempo Real</span>
              <span className="text-emerald-400 font-semibold">Ativado</span>
            </div>

            <div className="flex items-center justify-between py-1 text-slate-300">
              <span>Armazenamento de Repertório</span>
              <span className="font-mono text-slate-400">LocalStorage Local</span>
            </div>
          </div>

          {/* Rehearsal Tips */}
          <div className="p-3.5 bg-blue-950/30 border border-blue-500/20 rounded-xl space-y-1.5 text-slate-300">
            <div className="flex items-center gap-1.5 font-semibold text-blue-300">
              <Info className="w-4 h-4 text-blue-400" />
              <span>Dica para o Regente e Coralistas:</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-400">
              Você pode clicar em qualquer nota individual na partitura para reproduzir seu som no piano e conferir a afinação antes do início da estrofe.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-slate-800 pt-4 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-950/40"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

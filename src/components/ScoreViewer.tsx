import React, { useEffect, useRef, useState } from 'react';
import abcjs from 'abcjs';
import { pianoEngine } from '../services/pianoAudioEngine';
import { ZoomIn, ZoomOut, RotateCcw, Volume2, Sparkles, Music } from 'lucide-react';

interface ScoreViewerProps {
  abc: string;
  title: string;
  transposition: number;
  onSelectNote?: (pitch: number) => void;
  onVisualObjReady?: (visualObj: any) => void;
}

export const ScoreViewer: React.FC<ScoreViewerProps> = ({
  abc,
  title,
  transposition,
  onSelectNote,
  onVisualObjReady
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number>(1.0);
  const [renderError, setRenderError] = useState<string | null>(null);
  const visualObjRef = useRef<any>(null);

  // Render sheet music whenever ABC, scale, or transposition changes
  useEffect(() => {
    if (!containerRef.current) return;

    try {
      setRenderError(null);
      containerRef.current.innerHTML = '';

      // Get responsive width
      const containerWidth = containerRef.current.clientWidth || 800;
      const targetWidth = Math.max(320, containerWidth - 32);

      const renderOptions = {
        responsive: 'resize',
        add_classes: true,
        staffwidth: targetWidth,
        scale: scale,
        visualTranspose: transposition,
        clickListener: (abcElem: any) => {
          // Play clicked note on piano for choir singer pitch checking
          if (abcElem && abcElem.midiPitches && abcElem.midiPitches.length > 0) {
            abcElem.midiPitches.forEach((pitchObj: any) => {
              const pitch = (pitchObj.pitch ?? pitchObj) + transposition;
              pianoEngine.playNote(pitch, undefined, 1.0, 0.85);
              if (onSelectNote) onSelectNote(pitch);
            });
          }
        }
      };

      const tunes = abcjs.renderAbc(containerRef.current, abc, renderOptions);

      if (tunes && tunes.length > 0) {
        visualObjRef.current = tunes[0];
        if (onVisualObjReady) {
          onVisualObjReady(tunes[0]);
        }
      }
    } catch (err: any) {
      console.error('Error rendering ABC score', err);
      setRenderError('Erro ao processar a notação ABC. Verifique o código no botão "Editar ABC".');
    }
  }, [abc, scale, transposition]);

  // Adjust scale on window resize for responsiveness
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 640 && scale > 0.85) {
        setScale(0.8);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex flex-col h-full bg-white text-slate-900 rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
      {/* Score Header & Zoom Tools */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs sm:text-sm">
        <div className="flex items-center gap-2 font-medium text-slate-700 truncate">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600">
            <Music className="w-4 h-4" />
          </div>
          <span className="truncate max-w-[200px] sm:max-w-md font-semibold text-slate-900">{title}</span>
          {transposition !== 0 && (
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-700 border border-blue-200">
              {transposition > 0 ? `+${transposition}` : transposition} semitons
            </span>
          )}
        </div>

        {/* Zoom & View Controls */}
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => setScale((s) => Math.max(0.6, Number((s - 0.1).toFixed(1))))}
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
            title="Diminuir Zoom"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono font-medium text-slate-500 min-w-10 text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.min(1.8, Number((s + 0.1).toFixed(1))))}
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
            title="Aumentar Zoom"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setScale(1.0)}
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors hidden sm:block"
            title="Redefinir Zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Sheet Music Visual Container */}
      <div className="flex-1 overflow-auto p-4 sm:p-8 bg-[#ffffff] relative flex flex-col items-center min-h-[360px]">
        {renderError ? (
          <div className="my-auto p-6 max-w-md text-center bg-rose-50 border border-rose-200 rounded-xl text-rose-700">
            <p className="font-semibold mb-2">Aviso de Renderização</p>
            <p className="text-xs text-rose-600">{renderError}</p>
          </div>
        ) : (
          <div
            ref={containerRef}
            className="sheet-container w-full max-w-4xl cursor-pointer"
            title="Dica: Clique em qualquer nota para ouvi-la no piano!"
          />
        )}
      </div>

      {/* Helpful Hint Footer */}
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span className="hidden sm:inline">Toque interativo:</span>
          <span>Clique em qualquer nota da partitura para soar no piano.</span>
        </div>
        <div className="flex items-center gap-1 text-slate-400">
          <Volume2 className="w-3.5 h-3.5" />
          <span>Partituras para Coral</span>
        </div>
      </div>
    </div>
  );
};

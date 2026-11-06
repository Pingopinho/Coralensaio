import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  Camera,
  X,
  Sparkles,
  Loader2,
  FileMusic,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { convertSheetMusicToAbc } from '../services/geminiService';
import { Song } from '../types';

interface UploadModalProps {
  onSongCreated: (newSong: Song) => void;
  onClose: () => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  onSongCreated,
  onClose
}) => {
  const [songTitle, setSongTitle] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualAbcMode, setManualAbcMode] = useState(false);
  const [manualAbcText, setManualAbcText] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Por favor, selecione um arquivo de imagem (PNG, JPG, JPEG ou WebP).');
      return;
    }

    setErrorMessage(null);
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
      if (!songTitle) {
        // Suggest a title based on filename
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setSongTitle(cleanName);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleStartConversion = async () => {
    if (!songTitle.trim()) {
      setErrorMessage('Por favor, informe o nome ou número da música (ex: Hino 15).');
      return;
    }

    if (manualAbcMode) {
      if (!manualAbcText.trim()) {
        setErrorMessage('Por favor, digite ou cole a notação ABC da partitura.');
        return;
      }

      const newSong: Song = {
        id: `song-${Date.now()}`,
        title: songTitle.trim(),
        abc: manualAbcText.trim(),
        createdAt: Date.now(),
        category: 'coral'
      };

      onSongCreated(newSong);
      onClose();
      return;
    }

    if (!imagePreview) {
      setErrorMessage('Por favor, carregue ou tire uma foto da partitura.');
      return;
    }

    try {
      setIsConverting(true);
      setErrorMessage(null);

      const result = await convertSheetMusicToAbc(
        imagePreview,
        songTitle.trim()
      );

      const newSong: Song = {
        id: `song-${Date.now()}`,
        title: songTitle.trim(),
        abc: result.abc,
        imageBase64: imagePreview,
        createdAt: Date.now(),
        category: 'coral'
      };

      onSongCreated(newSong);
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Falha ao processar partitura via Gemini.');
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-xl p-5 sm:p-6 shadow-2xl text-slate-100 relative animate-in fade-in zoom-in-95 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
              <FileMusic className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Adicionar Nova Partitura</h2>
              <p className="text-xs text-slate-400">
                Tire uma foto ou carregue uma partitura para converter com IA
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isConverting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Fields */}
        <div className="space-y-4">
          {/* Title Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Nome da Música ou Hino <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              placeholder="Ex: Hino 15 - Glória a Deus / Coro Sacro"
              value={songTitle}
              onChange={(e) => setSongTitle(e.target.value)}
              disabled={isConverting}
              className="w-full px-3.5 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Toggle between Image upload & direct ABC input */}
          <div className="flex border-b border-slate-800 pb-2 text-xs gap-4">
            <button
              type="button"
              onClick={() => setManualAbcMode(false)}
              className={`pb-1 font-semibold transition-colors border-b-2 ${
                !manualAbcMode
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Foto / Imagem da Partitura (Gemini AI)
            </button>
            <button
              type="button"
              onClick={() => setManualAbcMode(true)}
              className={`pb-1 font-semibold transition-colors border-b-2 ${
                manualAbcMode
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Inserir Código ABC Manualmente
            </button>
          </div>

          {!manualAbcMode ? (
            /* Image Upload Area */
            <div className="space-y-3">
              {imagePreview ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950 max-h-56 flex items-center justify-center">
                  <img
                    src={imagePreview}
                    alt="Preview da partitura"
                    className="max-h-56 object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => setImagePreview(null)}
                    disabled={isConverting}
                    className="absolute top-2 right-2 p-1.5 bg-slate-900/80 text-rose-400 hover:text-rose-300 rounded-lg backdrop-blur-xs border border-slate-700"
                    title="Remover imagem"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-700 hover:border-emerald-500/60 rounded-2xl p-6 text-center bg-slate-800/40 transition-colors">
                  <UploadCloud className="w-10 h-10 mx-auto text-slate-400 mb-2" />
                  <p className="text-xs font-semibold text-slate-200 mb-1">
                    Arraste a foto da partitura aqui ou escolha uma opção:
                  </p>
                  <p className="text-[11px] text-slate-400 mb-4">
                    Suporta imagens claras e bem focadas de hinários ou partituras corais
                  </p>

                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl border border-slate-600 transition-colors"
                    >
                      <UploadCloud className="w-4 h-4 text-emerald-400" />
                      <span>Carregar Arquivo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-medium rounded-xl transition-colors shadow-sm"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Tirar Foto (Câmera)</span>
                    </button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              )}
            </div>
          ) : (
            /* Manual ABC Input Area */
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Código ABC da Música
              </label>
              <textarea
                rows={6}
                value={manualAbcText}
                onChange={(e) => setManualAbcText(e.target.value)}
                placeholder="X:1&#10;T:Hino do Coral&#10;M:4/4&#10;L:1/4&#10;K:G&#10;G G A B | c2 B2 | ..."
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono text-xs text-emerald-300 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Progress Indicator */}
          {isConverting && (
            <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-xs space-y-2 text-emerald-200 animate-pulse">
              <div className="flex items-center gap-2 font-semibold text-emerald-300">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Analisando partitura com o servidor Gemini...</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Identificando claves, compassos, armaduras e notas musicais para formato ABC Notation.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4 mt-5">
          <button
            type="button"
            onClick={onClose}
            disabled={isConverting}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleStartConversion}
            disabled={isConverting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-emerald-950/40 transition-all hover:scale-102 active:scale-98"
          >
            {isConverting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Convertendo...</span>
              </>
            ) : manualAbcMode ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Salvar Partitura</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Processar com Gemini</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

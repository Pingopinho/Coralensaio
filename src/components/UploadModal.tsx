import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  Camera,
  X,
  Sparkles,
  Loader2,
  FileMusic,
  AlertCircle,
  CheckCircle2,
  FileText,
  FileCheck
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
  const [fileDataUrl, setFileDataUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'pdf' | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<string>('');
  const [isConverting, setIsConverting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualAbcMode, setManualAbcMode] = useState(false);
  const [manualAbcText, setManualAbcText] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = file.type.startsWith('image/');

    if (!isPdf && !isImage) {
      setErrorMessage('Formato não suportado. Por favor, envie uma foto (JPG, PNG, WebP) ou arquivo PDF.');
      return;
    }

    setErrorMessage(null);
    setFileName(file.name);
    setFileSize((file.size / (1024 * 1024)).toFixed(2) + ' MB');
    setFileType(isPdf ? 'pdf' : 'image');

    const reader = new FileReader();
    reader.onload = () => {
      setFileDataUrl(reader.result as string);
      if (!songTitle) {
        // Suggest a title based on clean filename
        const cleanName = file.name
          .replace(/\.[^/.]+$/, '')
          .replace(/[-_]/g, ' ')
          .replace(/partitura|hino|coral|sheet|music/gi, '')
          .trim();
        setSongTitle(cleanName || file.name.replace(/\.[^/.]+$/, ''));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleStartConversion = async () => {
    if (!songTitle.trim()) {
      setErrorMessage('Por favor, informe o nome ou número da música (ex: Hino 15 ou Surgem Anjos).');
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

    if (!fileDataUrl) {
      setErrorMessage('Por favor, carregue um arquivo PDF ou foto da partitura.');
      return;
    }

    try {
      setIsConverting(true);
      setErrorMessage(null);

      const result = await convertSheetMusicToAbc(
        fileDataUrl,
        songTitle.trim()
      );

      const newSong: Song = {
        id: `song-${Date.now()}`,
        title: songTitle.trim(),
        abc: result.abc,
        imageBase64: fileType === 'image' ? fileDataUrl : undefined,
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
              <h2 className="text-base font-bold text-white">Adicionar Partitura (PDF ou Foto)</h2>
              <p className="text-xs text-slate-400">
                Suporta fotos do hinário e arquivos PDF com separação de vozes (SATB)
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
              placeholder="Ex: Surgem Anjos Proclamando ou Hino 15"
              value={songTitle}
              onChange={(e) => setSongTitle(e.target.value)}
              disabled={isConverting}
              className="w-full px-3.5 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Mode Switch: File/Photo vs Manual ABC */}
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
              PDF ou Foto da Partitura (Leitura com IA)
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
            /* PDF & Image Upload Area */
            <div className="space-y-3">
              {fileDataUrl ? (
                /* Selected File Preview */
                <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950 p-4">
                  {fileType === 'pdf' ? (
                    <div className="flex items-center gap-4 py-3 px-2">
                      <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                        <FileText className="w-8 h-8" />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500 text-white uppercase tracking-wider">
                            PDF
                          </span>
                          <span className="text-xs text-slate-400">{fileSize}</span>
                        </div>
                        <h4 className="text-sm font-semibold text-white truncate mt-1">
                          {fileName}
                        </h4>
                        <p className="text-[11px] text-emerald-400 flex items-center gap-1 mt-0.5">
                          <FileCheck className="w-3.5 h-3.5" />
                          <span>Documento pronto para transcrição musical com Gemini</span>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <img
                        src={fileDataUrl}
                        alt="Preview da partitura"
                        className="max-h-56 object-contain rounded-lg"
                      />
                      <span className="text-[11px] text-slate-400 mt-2 truncate max-w-sm">
                        {fileName}
                      </span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setFileDataUrl(null);
                      setFileType(null);
                      setFileName('');
                    }}
                    disabled={isConverting}
                    className="absolute top-2 right-2 p-1.5 bg-slate-900/80 text-rose-400 hover:text-rose-300 rounded-lg backdrop-blur-xs border border-slate-700"
                    title="Remover arquivo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                /* Drag & Drop Box supporting PDF and Images */
                <div className="border-2 border-dashed border-slate-700 hover:border-emerald-500/60 rounded-2xl p-6 text-center bg-slate-800/40 transition-colors">
                  <UploadCloud className="w-10 h-10 mx-auto text-emerald-400 mb-2" />
                  <p className="text-xs font-semibold text-slate-200 mb-1">
                    Arraste seu arquivo PDF ou foto da partitura aqui
                  </p>
                  <p className="text-[11px] text-slate-400 mb-4">
                    Suporta arquivos <strong>PDF</strong> de partituras e imagens <strong>JPG, PNG, WebP</strong>
                  </p>

                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl border border-slate-600 transition-colors shadow-sm"
                    >
                      <FileText className="w-4 h-4 text-rose-400" />
                      <span>Selecionar PDF ou Imagem</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-medium rounded-xl transition-colors shadow-sm"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Tirar Foto com Câmera</span>
                    </button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf,.pdf"
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
                placeholder="X:1&#10;T:Hino do Coral&#10;M:4/4&#10;L:1/4&#10;K:G&#10;V:S clef=treble name=&quot;Soprano&quot;&#10;B B c B | A2 B2 |]&#10;V:B clef=bass name=&quot;Baixo&quot;&#10;G, G, C, G, | D,2 G,2 |]"
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
                <span>
                  {fileType === 'pdf' ? 'Analisando arquivo PDF com Gemini...' : 'Lendo partitura e separando vozes com Gemini...'}
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Identificando claves de sol e fá, armaduras, divisão coral (Soprano, Contralto, Tenor, Baixo) e letras.
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
                <span>Processando...</span>
              </>
            ) : manualAbcMode ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Salvar Partitura</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Ler com IA Gemini</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

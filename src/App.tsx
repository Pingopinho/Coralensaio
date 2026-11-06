import React, { useState, useEffect } from 'react';
import {
  loadSavedSongs,
  saveSongs,
  getSelectedSongId,
  setSelectedSongId,
  getStoredApiKey,
  setStoredApiKey,
  DEFAULT_SONGS
} from './services/storageService';
import { Song } from './types';
import { ScoreViewer } from './components/ScoreViewer';
import { AudioPlayer } from './components/AudioPlayer';
import { SongList } from './components/SongList';
import { UploadModal } from './components/UploadModal';
import { ApiKeyModal } from './components/ApiKeyModal';
import { AbcEditorModal } from './components/AbcEditorModal';
import { PitchPipe } from './components/PitchPipe';
import {
  Music,
  Plus,
  Settings,
  Menu,
  X,
  Code,
  Printer,
  Sparkles,
  Layers,
  Image as ImageIcon,
  KeyRound,
  Download,
  Share2,
  Check
} from 'lucide-react';

export default function App() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [transposition, setTransposition] = useState<number>(0);
  const [visualObj, setVisualObj] = useState<any>(null);

  // Modals & Drawers
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showEditorModal, setShowEditorModal] = useState<boolean>(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState<boolean>(false);
  const [showImageComparison, setShowImageComparison] = useState<boolean>(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Initialize data on mount
  useEffect(() => {
    const loadedSongs = loadSavedSongs();
    setSongs(loadedSongs);

    const savedId = getSelectedSongId();
    const initialSong = loadedSongs.find((s) => s.id === savedId) || loadedSongs[0] || null;
    setCurrentSong(initialSong);
  }, []);

  // Sync songs changes to LocalStorage
  const handleUpdateSongs = (newSongsList: Song[]) => {
    setSongs(newSongsList);
    saveSongs(newSongsList);
  };

  const handleSelectSong = (song: Song) => {
    setCurrentSong(song);
    setSelectedSongId(song.id);
    setTransposition(0);
    setShowImageComparison(false);
  };

  const handleDeleteSong = (id: string) => {
    const remaining = songs.filter((s) => s.id !== id);
    handleUpdateSongs(remaining);

    if (currentSong?.id === id) {
      const nextSong = remaining[0] || null;
      setCurrentSong(nextSong);
      if (nextSong) {
        setSelectedSongId(nextSong.id);
      }
    }
  };

  const handleSongCreated = (newSong: Song) => {
    const updated = [newSong, ...songs];
    handleUpdateSongs(updated);
    setCurrentSong(newSong);
    setSelectedSongId(newSong.id);
    setTransposition(0);
  };

  const handleSaveAbcEdit = (updatedAbc: string, title: string, notes?: string) => {
    if (!currentSong) return;
    const updated: Song = {
      ...currentSong,
      abc: updatedAbc,
      title: title,
      notes: notes
    };

    const newSongList = songs.map((s) => (s.id === currentSong.id ? updated : s));
    handleUpdateSongs(newSongList);
    setCurrentSong(updated);
  };

  const handleExportBackup = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(songs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `coral-partituras-backup-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported) && imported.length > 0) {
          handleUpdateSongs(imported);
          setCurrentSong(imported[0]);
          setSelectedSongId(imported[0].id);
          alert(`Sucesso! ${imported.length} músicas importadas.`);
        }
      } catch (err) {
        alert('Erro ao importar arquivo JSON. Formato inválido.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handlePrintScore = () => {
    window.print();
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Desktop Sidebar: Minhas Músicas */}
      <div className="hidden md:flex shrink-0">
        <SongList
          songs={songs}
          selectedSongId={currentSong?.id || null}
          onSelectSong={handleSelectSong}
          onDeleteSong={handleDeleteSong}
          onNewSongClick={() => setShowUploadModal(true)}
          onExportSongs={handleExportBackup}
          onImportSongs={handleImportBackup}
        />
      </div>

      {/* Mobile Drawer */}
      {showMobileSidebar && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setShowMobileSidebar(false)}
          />
          <div className="relative w-4/5 max-w-xs h-full bg-slate-900 z-10 shadow-2xl flex flex-col">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between">
              <span className="font-bold text-sm text-white">Repertório do Coral</span>
              <button
                onClick={() => setShowMobileSidebar(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <SongList
                songs={songs}
                selectedSongId={currentSong?.id || null}
                onSelectSong={handleSelectSong}
                onDeleteSong={handleDeleteSong}
                onNewSongClick={() => {
                  setShowMobileSidebar(false);
                  setShowUploadModal(true);
                }}
                onExportSongs={handleExportBackup}
                onImportSongs={handleImportBackup}
                onCloseMobileDrawer={() => setShowMobileSidebar(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main App Workspace */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-900">
        {/* Top Header Bar */}
        <header className="h-16 px-4 sm:px-6 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shrink-0 z-10 backdrop-blur">
          {/* Left: Mobile Menu Toggle & Brand */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowMobileSidebar(true)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 md:hidden transition-colors"
              title="Abrir Minhas Músicas"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-400 flex items-center justify-center text-white shadow-md shadow-emerald-950/40">
                <Music className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                  <span>CoralEnsaio</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30 hidden sm:inline-block">
                    IA Gemini + Piano
                  </span>
                </h1>
                <p className="text-[11px] text-slate-400 hidden sm:block">
                  Partituras e Ensaio Coral Interativo
                </p>
              </div>
            </div>
          </div>

          {/* Center: Current Song Quick Title or Badge */}
          {currentSong && (
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/80 max-w-sm truncate text-xs">
              <span className="text-slate-400">Em ensaio:</span>
              <span className="font-semibold text-emerald-400 truncate">{currentSong.title}</span>
            </div>
          )}

          {/* Right: Quick Actions (Upload Score, Edit ABC, Settings) */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-950/40 transition-all hover:scale-102 active:scale-98"
              title="Escanear ou Carregar Partitura com Gemini"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nova Partitura</span>
              <span className="sm:hidden">Nova</span>
            </button>

            {currentSong && (
              <button
                onClick={() => setShowEditorModal(true)}
                className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1.5"
                title="Editar notação ABC e anotações do coral"
              >
                <Code className="w-4 h-4 text-blue-400" />
                <span className="hidden lg:inline">Editar ABC</span>
              </button>
            )}

            {currentSong?.imageBase64 && (
              <button
                onClick={() => setShowImageComparison(!showImageComparison)}
                className={`p-2 rounded-xl border text-xs font-medium transition-colors ${
                  showImageComparison
                    ? 'bg-blue-600 text-white border-blue-500'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
                title="Ver foto original da partitura"
              >
                <ImageIcon className="w-4 h-4 text-emerald-400" />
              </button>
            )}

            <button
              onClick={handlePrintScore}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition-colors hidden sm:block"
              title="Imprimir Partitura"
            >
              <Printer className="w-4 h-4" />
            </button>

            {/* Gear Settings Button (Coral & Audio Preferences) */}
            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-2 rounded-xl border bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 transition-all"
              title="Configurações e preferências do coral"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Central Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden p-3 sm:p-5 gap-3">
          {/* Quick Pitch Reference Bar (Diapasão de Ensaio) */}
          <PitchPipe />

          {/* Sheet Music Workspace */}
          <div className="flex-1 flex flex-col lg:flex-row gap-4 overflow-hidden min-h-0">
            {currentSong ? (
              <>
                {/* Main Interactive Score Viewer */}
                <div className={`flex-1 flex flex-col min-h-0 ${showImageComparison ? 'lg:w-3/5' : 'w-full'}`}>
                  <ScoreViewer
                    abc={currentSong.abc}
                    title={currentSong.title}
                    transposition={transposition}
                    onVisualObjReady={(obj) => setVisualObj(obj)}
                  />
                </div>

                {/* Optional Side-by-Side Original Photo Viewer */}
                {showImageComparison && currentSong.imageBase64 && (
                  <div className="lg:w-2/5 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl min-h-[300px]">
                    <div className="p-3 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between text-xs font-semibold text-slate-200">
                      <div className="flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4 text-emerald-400" />
                        <span>Foto Original da Partitura</span>
                      </div>
                      <button
                        onClick={() => setShowImageComparison(false)}
                        className="text-slate-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex-1 p-3 bg-slate-950 overflow-auto flex items-center justify-center">
                      <img
                        src={currentSong.imageBase64}
                        alt="Original"
                        className="max-h-full object-contain rounded-lg border border-slate-800"
                      />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl text-center">
                <div className="p-4 rounded-2xl bg-slate-800 text-slate-400 mb-4">
                  <Music className="w-10 h-10 text-emerald-400" />
                </div>
                <h2 className="text-lg font-bold text-white mb-2">Nenhuma Partitura Selecionada</h2>
                <p className="text-xs text-slate-400 max-w-md mb-6">
                  Selecione uma das músicas do coral no menu lateral ou clique em "Nova Partitura" para fotografar e converter uma música com o Gemini.
                </p>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Adicionar Primeira Partitura</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Audio Synthesizer Bar */}
        {currentSong && (
          <AudioPlayer
            visualObj={visualObj}
            abc={currentSong.abc}
            transposition={transposition}
            onTranspositionChange={(semi) => setTransposition(semi)}
          />
        )}
      </div>

      {/* Modals */}
      {showUploadModal && (
        <UploadModal
          onSongCreated={handleSongCreated}
          onClose={() => setShowUploadModal(false)}
        />
      )}

      {showSettingsModal && (
        <ApiKeyModal
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {showEditorModal && currentSong && (
        <AbcEditorModal
          song={currentSong}
          onSaveAbc={handleSaveAbcEdit}
          onClose={() => setShowEditorModal(false)}
        />
      )}
    </div>
  );
}

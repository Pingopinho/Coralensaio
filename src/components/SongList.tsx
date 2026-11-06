import React, { useState } from 'react';
import { Song } from '../types';
import {
  Music,
  Trash2,
  Plus,
  Search,
  BookOpen,
  Calendar,
  Sparkles,
  Download,
  Upload,
  Check,
  AlertCircle
} from 'lucide-react';

interface SongListProps {
  songs: Song[];
  selectedSongId: string | null;
  onSelectSong: (song: Song) => void;
  onDeleteSong: (id: string) => void;
  onNewSongClick: () => void;
  onExportSongs: () => void;
  onImportSongs: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCloseMobileDrawer?: () => void;
}

export const SongList: React.FC<SongListProps> = ({
  songs,
  selectedSongId,
  onSelectSong,
  onDeleteSong,
  onNewSongClick,
  onExportSongs,
  onImportSongs,
  onCloseMobileDrawer
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [songToDelete, setSongToDelete] = useState<Song | null>(null);

  const filteredSongs = songs.filter((s) =>
    s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.notes && s.notes.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSelect = (song: Song) => {
    onSelectSong(song);
    if (onCloseMobileDrawer) {
      onCloseMobileDrawer();
    }
  };

  return (
    <aside className="w-full md:w-80 lg:w-96 flex flex-col h-full bg-slate-900 border-r border-slate-800 text-slate-100 select-none">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-950/40">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-white">Minhas Músicas</h2>
              <p className="text-xs text-slate-400">{songs.length} partituras no repertório</p>
            </div>
          </div>

          <button
            onClick={onNewSongClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-950/40 transition-all hover:scale-102 active:scale-98"
            title="Escanear ou adicionar nova partitura"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome ou número..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-800/90 border border-slate-700/80 rounded-xl text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
          />
        </div>
      </div>

      {/* Song List Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {filteredSongs.length === 0 ? (
          <div className="text-center py-10 px-4 text-slate-400">
            <Music className="w-8 h-8 mx-auto mb-2 opacity-30 text-emerald-400" />
            <p className="text-sm font-medium">Nenhuma música encontrada</p>
            <p className="text-xs text-slate-500 mt-1">
              {searchTerm ? 'Tente outro termo de busca' : 'Clique em "Nova" para carregar uma partitura!'}
            </p>
          </div>
        ) : (
          filteredSongs.map((song) => {
            const isSelected = song.id === selectedSongId;
            return (
              <div
                key={song.id}
                onClick={() => handleSelect(song)}
                className={`group relative flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-emerald-950/40 border border-emerald-500/50 text-white shadow-sm'
                    : 'hover:bg-slate-800/60 border border-transparent text-slate-300'
                }`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700 group-hover:text-emerald-400'
                    }`}
                  >
                    <Music className="w-4 h-4" />
                  </div>
                  <div className="overflow-hidden">
                    <h3 className="text-xs font-semibold truncate leading-tight">
                      {song.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                      {song.key && (
                        <span className="font-mono text-emerald-400/90 font-medium">
                          Tom: {song.key}
                        </span>
                      )}
                      {song.meter && (
                        <span className="font-mono text-slate-400">
                          {song.meter}
                        </span>
                      )}
                      <span className="flex items-center gap-0.5 text-slate-500">
                        <Calendar className="w-3 h-3" />
                        {new Date(song.createdAt).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'short'
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Delete button (with confirmation) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSongToDelete(song);
                  }}
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-all shrink-0"
                  title="Excluir música do repertório"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Sidebar Footer with Backup and Storage Info */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/50 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <label
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer transition-colors"
            title="Importar repertório em arquivo JSON"
          >
            <Upload className="w-3 h-3" />
            <span>Importar</span>
            <input
              type="file"
              accept=".json"
              onChange={onImportSongs}
              className="hidden"
            />
          </label>

          <button
            onClick={onExportSongs}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Salvar cópia de backup das músicas"
          >
            <Download className="w-3 h-3" />
            <span>Exportar</span>
          </button>
        </div>

        <span className="text-[11px] text-slate-500 font-mono">
          LocalStorage
        </span>
      </div>

      {/* Delete Confirmation Modal */}
      {songToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <div className="p-2 bg-rose-500/10 rounded-xl">
                <AlertCircle className="w-5 h-5 text-rose-400" />
              </div>
              <h3 className="font-bold text-base text-white">Excluir Música?</h3>
            </div>
            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Tem certeza de que deseja remover <strong className="text-white">"{songToDelete.title}"</strong> da sua lista de partituras salvas?
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setSongToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onDeleteSong(songToDelete.id);
                  setSongToDelete(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

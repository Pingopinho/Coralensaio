export interface Song {
  id: string;
  title: string;
  abc: string;
  imageBase64?: string;
  createdAt: number;
  category?: 'hino' | 'coral' | 'ensaio' | 'especial';
  key?: string;
  meter?: string;
  tempo?: number;
  notes?: string;
}

export interface PlayerState {
  isPlaying: boolean;
  isPaused: boolean;
  progress: number; // 0 to 1
  currentTime: number;
  totalTime: number;
  bpm: number;
  transposition: number; // semitones
}

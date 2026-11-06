import { Song } from '../types';

const STORAGE_SONGS_KEY = 'coral_songs_history_v1';
const STORAGE_API_KEY = 'coral_gemini_api_key';
const STORAGE_SELECTED_ID = 'coral_selected_song_id';

export const DEFAULT_SONGS: Song[] = [
  {
    id: 'hino-15',
    title: 'Hino 15 - Glória a Deus nas Alturas',
    category: 'hino',
    createdAt: Date.now() - 86400000 * 3,
    tempo: 96,
    key: 'G',
    meter: '4/4',
    notes: 'Ensaio com todas as vozes (Soprano, Contralto, Tenor e Baixo). Atenção para a respiração no 4º compasso.',
    abc: `X:15
T:Hino 15 - Glória a Deus nas Alturas
C:Hinos de Louvores e Súplicas
M:4/4
L:1/4
Q:1/4=96
K:G
%%score (S A) | (T B)
V:S clef=treble name="Soprano"
[GB] [GB] [Ac] [GB] | [FA]2 [GB]2 | [Ac] [GB] [FA] [EA] | [D2F2] [GB]2 |
[GB] [Ac] [Bd] [GB] | [ce]2 [Bd]2 | [Ac] [GB] [FA] [EA] | [D4G4] |]
V:A clef=treble name="Contralto"
D D E D | C2 D2 | E D C C | A,2 B,2 |
D E G D | G2 G2 | E D C C | B,4 |]
V:T clef=bass name="Tenor"
B, B, C B, | A,2 B,2 | C B, A, G, | F,2 G,2 |
B, C d B, | c2 d2 | c B A G | [G,4D4] |]
V:B clef=bass name="Baixo"
G, G, G, G, | D,2 G,2 | C, G, D, C, | D,2 G,,2 |
G, F, G, G, | C,2 G,2 | C, G, D, D, | G,,4 |]`,
  },
  {
    id: 'castelo-forte',
    title: 'Castelo Forte É Nosso Deus',
    category: 'coral',
    createdAt: Date.now() - 86400000 * 2,
    tempo: 104,
    key: 'C',
    meter: '4/4',
    notes: 'Grande hino solene da Reforma. Marcar bem o primeiro tempo de cada compasso.',
    abc: `X:2
T:Castelo Forte É Nosso Deus
C:Martinho Lutero (1529)
M:4/4
L:1/4
Q:1/4=104
K:C
%%score (S A) | (T B)
V:S clef=treble name="Soprano"
c c c g | e f g2 | c c c g | e f g2 |
a g f e | d2 c2 | c e g a | g f e2 |
d2 c2 |]
V:A clef=treble name="Contralto"
E E E G | G A G2 | E E E G | G A G2 |
F G D E | (F E) E2 | E G C F | E D C2 |
(C B,) C2 |]
V:T clef=bass name="Tenor"
G, G, G, D | C C B,2 | G, G, G, D | C C B,2 |
C B, A, G, | A,2 G,2 | G, C E C | C A, G,2 |
G,2 E,2 |]
V:B clef=bass name="Baixo"
C, C, C, B,, | C, F, G,2 | C, C, C, B,, | C, F, G,2 |
F, E, D, C, | (D, G,,) C,2 | C, C, C, F, | C, D, E,2 |
G,,2 C,2 |]`,
  },
  {
    id: 'quao-grande',
    title: 'Quão Grande És Tu (Grandioso És Tu)',
    category: 'especial',
    createdAt: Date.now() - 86400000 * 1,
    tempo: 88,
    key: 'F',
    meter: '4/4',
    notes: 'Entrada suave das sopranos e contraltos, tenores e baixos entram em crescendo.',
    abc: `X:3
T:Quão Grande És Tu
C:Melodia Tradicional Sueca
M:4/4
L:1/4
Q:1/4=88
K:F
%%score (S A) | (T B)
V:S clef=treble name="Soprano"
C | [FA]3/2 [GB]/ [FA] [DF] | [DF] [CE] [D2F2] | [GB]3/2 [Ac]/ [GB] [EG] | [FA]4 |
[FA]3/2 [GB]/ [FA] [DF] | [DF] [CE] [D2F2] | [CE]3/2 [DF]/ [EG] [CE] | [D4F4] |]
V:A clef=treble name="Contralto"
A, | C3/2 D/ C A, | A, G, A,2 | D3/2 E/ D C | C4 |
C3/2 D/ C A, | A, G, A,2 | G,3/2 A,/ B, G, | A,4 |]
V:T clef=bass name="Tenor"
F, | F,3/2 F,/ F, F, | F, E, F,2 | B,3/2 B,/ B, B, | A,4 |
A,3/2 A,/ A, F, | F, E, F,2 | B,3/2 B,/ B, B, | A,4 |]
V:B clef=bass name="Baixo"
F,, | F,,3/2 F,,/ F,, F,, | C, C, F,,2 | G,,3/2 G,,/ G,, C, | F,,4 |
F,,3/2 F,,/ F,, F,, | C, C, F,,2 | C,3/2 C,/ C, C, | F,,4 |]`,
  }
];

export function loadSavedSongs(): Song[] {
  try {
    const raw = localStorage.getItem(STORAGE_SONGS_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_SONGS_KEY, JSON.stringify(DEFAULT_SONGS));
      return DEFAULT_SONGS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return DEFAULT_SONGS;
  } catch (e) {
    console.error('Error loading songs from localStorage', e);
    return DEFAULT_SONGS;
  }
}

export function saveSongs(songs: Song[]): void {
  try {
    localStorage.setItem(STORAGE_SONGS_KEY, JSON.stringify(songs));
  } catch (e) {
    console.error('Error saving songs to localStorage', e);
  }
}

export function getSelectedSongId(): string | null {
  try {
    return localStorage.getItem(STORAGE_SELECTED_ID);
  } catch {
    return null;
  }
}

export function setSelectedSongId(id: string): void {
  try {
    localStorage.setItem(STORAGE_SELECTED_ID, id);
  } catch (e) {
    console.error(e);
  }
}

export function getStoredApiKey(): string {
  try {
    return localStorage.getItem(STORAGE_API_KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredApiKey(key: string): void {
  try {
    localStorage.setItem(STORAGE_API_KEY, key.trim());
  } catch (e) {
    console.error('Error saving API Key', e);
  }
}

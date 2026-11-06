import { Song } from '../types';

const STORAGE_SONGS_KEY = 'coral_songs_history_v2';
const STORAGE_SELECTED_ID = 'coral_selected_song_id';

export const SURGEM_ANJOS_SONG: Song = {
  id: 'surgem-anjos',
  title: 'Surgem Anjos Proclamando (Gloria in Excelsis Deo)',
  category: 'coral',
  createdAt: Date.now() - 86400000 * 4,
  tempo: 104,
  key: 'F',
  meter: '4/4',
  notes: 'Hino natalino com 4 vozes separadas (Soprano, Contralto, Tenor e Baixo) e letra completa. Destaque o melisma no refrão "Glória".',
  abc: `X:1
T:Surgem Anjos Proclamando
C:Melodia Tradicional Francesa
M:4/4
L:1/4
Q:1/4=104
K:F
%%score (S A) | (T B)
V:S clef=treble name="Soprano"
A A A c | c3/2 B/ A2 | A G A c | A3/2 G/ F2 |
w: Sur-gem an-jos pro-cla-man-do paz na ter-ra_e a Deus lou-vor;
A A A c | c3/2 B/ A2 | A G A c | A3/2 G/ F2 |
w: V\~ao seus hi-nos e-co-an-do nas mon-ta-nhas_ao re-dor.
c2 (d/c/B/A/ | B2 c/B/A/G/ | A2 B/A/G/F/ | G3/2) C/ C2 |
w: Gl\'o--------------ri-a
F G A B | (A2 G2) | F4 |]
w: a Deus nas al-tu--ras!
V:A clef=treble name="Contralto"
F F F F | E3/2 E/ F2 | F E F F | F3/2 E/ C2 |
w: Sur-gem an-jos pro-cla-man-do paz na ter-ra_e a Deus lou-vor;
F F F F | E3/2 E/ F2 | F E F F | F3/2 E/ C2 |
w: V\~ao seus hi-nos e-co-an-do nas mon-ta-nhas_ao re-dor.
F2 F2 | E2 E2 | F2 D2 | E3/2 C/ C2 |
w: Gl\'o-ri-a in ex-cel-sis De-o,
C E F F | (F2 E2) | F4 |]
w: a Deus nas al-tu--ras!
V:T clef=bass name="Tenor"
c c c A | G3/2 C/ C2 | c c c A | c3/2 B/ A2 |
w: Sur-gem an-jos pro-cla-man-do paz na ter-ra_e a Deus lou-vor;
c c c A | G3/2 C/ C2 | c c c A | c3/2 B/ A2 |
w: V\~ao seus hi-nos e-co-an-do nas mon-ta-nhas_ao re-dor.
A2 d2 | G2 c2 | F2 B2 | C3/2 E/ G2 |
w: Gl\'o-ri-a in ex-cel-sis De-o,
A c c d | (c2 B2) | A4 |]
w: a Deus nas al-tu--ras!
V:B clef=bass name="Baixo"
F, F, F, F, | C,3/2 C,/ F,2 | F, C, F, F, | C,3/2 C,/ F,,2 |
w: Sur-gem an-jos pro-cla-man-do paz na ter-ra_e a Deus lou-vor;
F, F, F, F, | C,3/2 C,/ F,2 | F, C, F, F, | C,3/2 C,/ F,,2 |
w: V\~ao seus hi-nos e-co-an-do nas mon-ta-nhas_ao re-dor.
F,2 D,2 | G,2 E,2 | D,2 B,,2 | C,3/2 C,/ C,2 |
w: Gl\'o-ri-a in ex-cel-sis De-o,
F, C, F, B,, | (C,2 C,2) | F,,4 |]
w: a Deus nas al-tu--ras!`
};

export const DEFAULT_SONGS: Song[] = [
  SURGEM_ANJOS_SONG,
  {
    id: 'hino-15',
    title: 'Hino 15 - Glória a Deus nas Alturas',
    category: 'hino',
    createdAt: Date.now() - 86400000 * 3,
    tempo: 96,
    key: 'G',
    meter: '4/4',
    notes: 'Ensaio com todas as vozes (Soprano, Contralto, Tenor e Baixo) separadas.',
    abc: `X:15
T:Hino 15 - Glória a Deus nas Alturas
C:Hinos de Louvores e Súplicas
M:4/4
L:1/4
Q:1/4=96
K:G
%%score (S A) | (T B)
V:S clef=treble name="Soprano"
B B c B | A2 B2 | c B A G | F2 G2 |
B c d B | e2 d2 | c B A G | G4 |]
V:A clef=treble name="Contralto"
G G G G | F2 G2 | E D C C | D2 D2 |
G G G G | G2 G2 | E D C C | D4 |]
V:T clef=bass name="Tenor"
d d e d | d2 d2 | c B A G | A2 B2 |
d e d d | c2 B2 | c B A G | B4 |]
V:B clef=bass name="Baixo"
G, G, C, G, | D,2 G,2 | C, G, D, C, | D,2 G,,2 |
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
C | A3/2 B/ A F | F E F2 | B3/2 c/ B G | A4 |
A3/2 B/ A F | F E F2 | E3/2 F/ G E | F4 |]
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
    const parsed: Song[] = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Ensure Surgem Anjos is present
      if (!parsed.some(s => s.id === 'surgem-anjos')) {
        parsed.unshift(SURGEM_ANJOS_SONG);
        localStorage.setItem(STORAGE_SONGS_KEY, JSON.stringify(parsed));
      }
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
    return localStorage.getItem(STORAGE_SELECTED_ID) || 'surgem-anjos';
  } catch {
    return 'surgem-anjos';
  }
}

export function setSelectedSongId(id: string): void {
  try {
    localStorage.setItem(STORAGE_SELECTED_ID, id);
  } catch (e) {
    console.error(e);
  }
}

/**
 * Service communicating with server-side Gemini API endpoints
 * Converts sheet music images to ABC Notation.
 */

export interface GeminiConvertResponse {
  abc: string;
  rawText: string;
}

export async function convertSheetMusicToAbc(
  base64DataUrl: string,
  songTitle?: string
): Promise<GeminiConvertResponse> {
  if (!base64DataUrl) {
    throw new Error('Por favor, carregue uma imagem de partitura.');
  }

  const response = await fetch('/api/convert-sheet', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imageBase64: base64DataUrl,
      title: songTitle,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const errorMsg = errorData?.error || `Erro HTTP ${response.status} (${response.statusText})`;
    throw new Error(errorMsg);
  }

  const data = await response.json();
  return {
    abc: data.abc,
    rawText: data.raw || data.abc,
  };
}

export async function checkServerStatus(): Promise<{ status: string; hasApiKey: boolean }> {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) throw new Error('Servidor indisponível');
    return await res.json();
  } catch (err) {
    return { status: 'error', hasApiKey: false };
  }
}

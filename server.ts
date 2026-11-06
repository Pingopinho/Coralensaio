import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Middleware for JSON and URL-encoded bodies with large payload capacity for PDFs and photos
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Server-side initialization of Gemini client with User-Agent telemetry
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

export const GEMINI_PROMPT =
  "Você é um especialista em transcrição musical de coral. Analise cuidadosamente este documento ou imagem de partitura (foto ou arquivo PDF). " +
  "Converta estritamente todas as notas, compassos, armaduras de clave, acidentes e divisões de vozes para o formato 'ABC Notation' limpo e perfeitamente executável. " +
  "Se a partitura tiver divisão para coral (Soprano, Contralto, Tenor, Baixo), organize em vozes separadas usando '%%score (S A) | (T B)' com 'V:S clef=treble name=\"Soprano\"', 'V:A clef=treble name=\"Contralto\"', 'V:T clef=bass name=\"Tenor\"' e 'V:B clef=bass name=\"Baixo\"'. " +
  "Se houver letra sob as notas, transcreva a letra com 'w:'. " +
  "Retorne APENAS o código ABC puro, sem formatações de markdown ou explicações.";

/**
 * Sanitizes ABC code from model response
 */
function sanitizeAbc(rawText: string, fallbackTitle?: string): string {
  let cleaned = (rawText || '').trim();

  // Strip markdown code fences like ```abc ... ``` or ``` ... ```
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z0-9_-]*\n?/, '');
    cleaned = cleaned.replace(/```$/, '');
    cleaned = cleaned.trim();
  }

  // Ensure minimum valid ABC headers
  const hasX = /(^|\n)X:\s*\d+/m.test(cleaned);
  const hasT = /(^|\n)T:/m.test(cleaned);
  const hasK = /(^|\n)K:/m.test(cleaned);

  if (!hasX || !hasK) {
    const title = fallbackTitle || 'Partitura do Coral';
    const header = [
      hasX ? '' : 'X:1',
      hasT ? '' : `T:${title}`,
      'M:4/4',
      'L:1/4',
      'Q:1/4=100',
      hasK ? '' : 'K:C',
    ].filter(Boolean).join('\n');

    cleaned = `${header}\n${cleaned}`;
  }

  return cleaned.trim();
}

// Health check and server status endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: !!process.env.GEMINI_API_KEY,
    timestamp: Date.now(),
  });
});

// Sheet music conversion endpoint (Supports Photos & Multi-page PDFs)
app.post('/api/convert-sheet', async (req, res) => {
  try {
    const { imageBase64, title } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Nenhum arquivo ou imagem de partitura foi fornecido.' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: 'Chave GEMINI_API_KEY não configurada no servidor. Configure a chave no painel Secrets.',
      });
    }

    // Extract mime type and clean base64 data
    let mimeType = 'image/jpeg';
    let base64Data = imageBase64;

    if (imageBase64.includes(';base64,')) {
      const parts = imageBase64.split(';base64,');
      mimeType = parts[0].replace('data:', '').trim() || 'image/jpeg';
      base64Data = parts[1];
    } else if (imageBase64.trim().startsWith('JVBERi0')) {
      // PDF magic bytes in base64
      mimeType = 'application/pdf';
    }

    // Strip all whitespaces and newlines that can break base64 decoding
    base64Data = base64Data.trim().replace(/\s+/g, '');

    const documentPart = {
      inlineData: {
        mimeType: mimeType,
        data: base64Data,
      },
    };

    const promptText = title
      ? `${GEMINI_PROMPT}\nO título deste hino ou partitura é "${title}".`
      : GEMINI_PROMPT;

    const textPart = {
      text: promptText,
    };

    // Active Gemini models for vision and PDF document transcription
    const modelsToTry = [
      'gemini-3.8-flash',
      'gemini-flash-latest',
    ];

    let lastError: any = null;
    let generatedText = '';

    for (const model of modelsToTry) {
      try {
        console.log(`Tentando transcrever partitura (${mimeType}) com modelo: ${model}...`);
        const response = await ai.models.generateContent({
          model: model,
          contents: {
            parts: [documentPart, textPart],
          },
        });

        generatedText = response.text || '';
        if (generatedText.trim()) {
          console.log(`Transcrição musical com ${model} concluída com sucesso!`);
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Modelo ${model} falhou, tentando fallback se disponível:`, err?.message || err);
      }
    }

    if (!generatedText.trim()) {
      let friendlyMsg = 'Não foi possível ler as notas musicais deste arquivo PDF ou imagem.';
      if (lastError?.message) {
        try {
          const parsed = JSON.parse(lastError.message);
          if (parsed?.error?.message) {
            friendlyMsg = `Erro na API do Gemini: ${parsed.error.message}`;
          }
        } catch {
          friendlyMsg = `Erro na leitura: ${lastError.message}`;
        }
      }
      return res.status(500).json({ error: friendlyMsg });
    }

    const cleanAbc = sanitizeAbc(generatedText, title);

    return res.json({
      abc: cleanAbc,
      raw: generatedText,
      title: title || 'Partitura do Coral',
      mimeType: mimeType,
    });
  } catch (error: any) {
    console.error('Sheet conversion error on server:', error);
    return res.status(500).json({
      error: error?.message || 'Erro interno ao processar a partitura no servidor.',
    });
  }
});

// Mount Vite middleware for dev or serve static files in production
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CoralEnsaio server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

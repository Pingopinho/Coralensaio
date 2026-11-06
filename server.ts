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

// Middleware for JSON and URL-encoded bodies with large payload capacity for images
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

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
  "Analise a imagem desta partitura musical. Converta estritamente todas as notas, compassos e acidentes para o formato 'ABC Notation' limpo. Ignore letras e retorne APENAS o código ABC bruto, sem formatações de markdown ou explicações.";

/**
 * Sanitizes ABC code from model response
 */
function sanitizeAbc(rawText: string, fallbackTitle?: string): string {
  let cleaned = (rawText || '').trim();

  // Strip markdown code fences
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

// Sheet music conversion endpoint
app.post('/api/convert-sheet', async (req, res) => {
  try {
    const { imageBase64, title } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Nenhuma imagem foi fornecida.' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: 'Chave GEMINI_API_KEY não configurada no servidor. Verifique o painel Settings > Secrets.',
      });
    }

    // Extract mime type and raw base64
    let mimeType = 'image/jpeg';
    let base64Data = imageBase64;

    if (imageBase64.includes(';base64,')) {
      const parts = imageBase64.split(';base64,');
      mimeType = parts[0].replace('data:', '') || 'image/jpeg';
      base64Data = parts[1];
    }

    const imagePart = {
      inlineData: {
        mimeType: mimeType,
        data: base64Data,
      },
    };

    const textPart = {
      text: GEMINI_PROMPT,
    };

    // Candidates in order of speed and sheet music vision proficiency
    const modelsToTry = [
      'gemini-2.5-flash',
      'gemini-3.8-flash',
      'gemini-flash-latest',
    ];

    let lastError: any = null;
    let generatedText = '';

    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: model,
          contents: {
            parts: [imagePart, textPart],
          },
        });

        generatedText = response.text || '';
        if (generatedText.trim()) {
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${model} failed, trying next fallback if available:`, err?.message || err);
        // Continue to fallback
      }
    }

    if (!generatedText.trim()) {
      const msg = lastError?.message || 'O modelo não retornou notação para esta partitura.';
      return res.status(502).json({ error: msg });
    }

    const cleanAbc = sanitizeAbc(generatedText, title);

    return res.json({
      abc: cleanAbc,
      raw: generatedText,
      title: title || 'Partitura do Coral',
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

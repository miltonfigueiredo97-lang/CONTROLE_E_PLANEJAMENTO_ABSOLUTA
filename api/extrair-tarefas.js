// ============================================
// Vercel Function: extrair-tarefas
// Recebe um PDF (nota digitada ou manuscrita, exportada do Samsung
// Notes) e devolve uma lista de tarefas objetivas para o To Do List
// (módulo "Tarefas do Sistema"), em vez de um relatório de obra.
//
// Mesma estratégia de fallback de gerar-relatorio.js:
// 1º Gemini (gratuito) — GEMINI_API_KEY
// 2º Anthropic (fallback, pago) — ANTHROPIC_API_KEY
// ============================================

const GEMINI_MODEL = 'gemini-2.5-flash';
const ANTHROPIC_MODEL = 'claude-sonnet-5';

const SYSTEM_PROMPT = `Você é um assistente que lê notas rápidas (digitadas ou manuscritas,
às vezes com desenhos/croquis simples) e extrai delas uma lista de tarefas objetivas para
um To Do List pessoal de gestão de obras. Leia todo o conteúdo do PDF com atenção e devolva
SOMENTE um objeto JSON válido, sem markdown, sem crases, sem texto antes ou depois, seguindo
exatamente este schema:

{
  "tarefas": [
    { "texto": "descrição curta, objetiva e reescrita da tarefa (comece com verbo no infinitivo quando fizer sentido)",
      "projeto": "nome do projeto/obra/assunto se ficar claro na nota, ou null" }
  ]
}

Regras importantes:
- Cada item da nota que descreva algo a fazer/resolver/verificar/lançar deve virar UMA tarefa separada.
- Não invente tarefas que não estão na nota. Se a nota inteira for só UMA tarefa, devolva um array com um item só.
- Reescreva de forma limpa e curta (corrija erros óbvios de digitação/leitura), preservando o sentido original.
- Se algum trecho manuscrito for ilegível, ignore só aquele trecho (não crie uma tarefa vaga tipo "[ilegível]").
- Se não houver nenhuma tarefa identificável, devolva { "tarefas": [] }.`;

function _limparJson(txt) {
  return txt.trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
}

function _fetchComTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

// ---- Gemini ----
async function _chamarGemini(pdfBase64, mediaType) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada.');

  const userText = 'Extraia desta nota a lista de tarefas para o To Do List, seguindo estritamente o schema JSON pedido nas instruções.';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const resp = await _fetchComTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{
        role: 'user',
        parts: [
          { inline_data: { mime_type: mediaType || 'application/pdf', data: pdfBase64 } },
          { text: userText },
        ],
      }],
      generationConfig: { responseMimeType: 'application/json' },
    }),
  }, 25000);

  const data = await resp.json();
  if (!resp.ok) {
    const msg = (data && data.error && data.error.message) || `Erro Gemini (HTTP ${resp.status})`;
    throw new Error(msg);
  }

  const candidato = data.candidates && data.candidates[0];
  const parte = candidato && candidato.content && candidato.content.parts && candidato.content.parts[0];
  const texto = parte && parte.text;
  if (!texto) throw new Error('Gemini não retornou texto.');

  return JSON.parse(texto);
}

// ---- Anthropic ----
async function _chamarAnthropic(pdfBase64, mediaType) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY não configurada.');

  const userText = 'Extraia desta nota a lista de tarefas para o To Do List, seguindo estritamente o schema JSON pedido no sistema.';

  const resp = await _fetchComTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: mediaType || 'application/pdf', data: pdfBase64 } },
          { type: 'text', text: userText },
        ],
      }],
    }),
  }, 30000);

  const data = await resp.json();
  if (!resp.ok) {
    const msg = (data && data.error && data.error.message) || `Erro Anthropic (HTTP ${resp.status})`;
    throw new Error(msg);
  }

  const textBlock = (data.content || []).find((b) => b.type === 'text');
  if (!textBlock) throw new Error('Claude não retornou texto.');

  return JSON.parse(_limparJson(textBlock.text));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' });
    return;
  }

  try {
    const { pdfBase64, mediaType } = req.body || {};
    if (!pdfBase64) {
      res.status(400).json({ ok: false, error: 'Nenhum PDF foi enviado.' });
      return;
    }

    let conteudo = null;
    let provedor = null;
    let erroGemini = null;

    try {
      conteudo = await _chamarGemini(pdfBase64, mediaType);
      provedor = 'gemini';
    } catch (e) {
      erroGemini = e.message || String(e);
      console.warn('Gemini falhou, tentando fallback para Anthropic:', erroGemini);
    }

    if (!conteudo) {
      try {
        conteudo = await _chamarAnthropic(pdfBase64, mediaType);
        provedor = 'anthropic';
      } catch (e2) {
        console.error('Anthropic (fallback) também falhou:', e2.message || e2);
        res.status(502).json({
          ok: false,
          error: `IA indisponível no momento. Gemini: ${erroGemini || 'falhou'}. Fallback Claude: ${e2.message || e2}.`,
        });
        return;
      }
    }

    if (!conteudo || !Array.isArray(conteudo.tarefas)) {
      res.status(502).json({ ok: false, error: 'A IA não devolveu uma lista de tarefas válida.' });
      return;
    }

    res.status(200).json({ ok: true, data: conteudo, provedor });
  } catch (e) {
    console.error('Erro em extrair-tarefas:', e);
    res.status(500).json({ ok: false, error: e.message || 'Erro interno no servidor.' });
  }
};

module.exports.config = { maxDuration: 60 };

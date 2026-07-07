// ============================================
// Vercel Function: gerar-relatorio
// Recebe um PDF (nota digitada ou manuscrita, exportada
// do Samsung Notes) e devolve um relatório estruturado em JSON.
//
// ESTRATÉGIA DE FALLBACK:
// 1º tenta o Google Gemini (gratuito) — GEMINI_API_KEY
// 2º se falhar por qualquer motivo (erro, timeout, resposta inválida,
//    bug de sincronização de billing do Google, etc), cai automaticamente
//    para a Anthropic (paga, estável) — ANTHROPIC_API_KEY
//
// As duas chaves precisam estar configuradas no Vercel (Settings >
// Environment Variables) pro fallback funcionar. Se só GEMINI_API_KEY
// existir e o Gemini falhar, o erro final será retornado normalmente
// (sem fallback silencioso "inventado").
// ============================================

const GEMINI_MODEL = 'gemini-2.5-flash';
const ANTHROPIC_MODEL = 'claude-sonnet-5';

const SYSTEM_PROMPT = `Você é um assistente que organiza notas de campo de obras de
construção civil em relatórios formais. Você vai receber um PDF que pode conter texto
digitado ou escrita manuscrita (às vezes com desenhos/croquis simples).

Leia todo o conteúdo do PDF com atenção e devolva SOMENTE um objeto JSON válido,
sem markdown, sem crases, sem texto antes ou depois, seguindo exatamente este schema:

{
  "titulo": "título curto e objetivo do relatório, baseado no conteúdo",
  "dataRelatorio": "data encontrada na nota no formato DD/MM/AAAA, ou null se não houver",
  "autor": "nome do responsável/autor se mencionado na nota, ou null",
  "resumo": "resumo objetivo de 2 a 4 frases do que foi observado/relatado",
  "secoes": [
    { "titulo": "nome da seção (ex: Serviços Executados, Observações, Materiais, Segurança)",
      "itens": ["item 1 organizado e reescrito de forma clara", "item 2", "..."] }
  ],
  "pendencias": ["pendências, problemas ou itens que precisam de acompanhamento, se houver"]
}

Regras importantes:
- Nunca invente informação que não está na nota. Se um campo não existir, use null ou array vazio.
- Reorganize e limpe o texto (corrija erros óbvios de digitação/leitura), mas preserve o sentido original.
- Agrupe itens relacionados em seções com nomes claros; crie quantas seções fizerem sentido para o conteúdo.
- Se a nota for manuscrita e algum trecho for ilegível, descreva isso como "[trecho ilegível]" dentro do item, não pule o conteúdo.`;

function _limparJson(txt) {
  return txt.trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
}

function _fetchComTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

// ---- Gemini ----
async function _chamarGemini(pdfBase64, mediaType, obraNome) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada.');

  const userText = `Obra: ${obraNome || 'não informado'}. Extraia e organize o conteúdo desta nota em um relatório estruturado, seguindo estritamente o schema JSON pedido nas instruções.`;
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
async function _chamarAnthropic(pdfBase64, mediaType, obraNome) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY não configurada.');

  const userText = `Obra: ${obraNome || 'não informado'}. Extraia e organize o conteúdo desta nota em um relatório estruturado, seguindo estritamente o schema JSON pedido no sistema.`;

  const resp = await _fetchComTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 4000,
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
    const { pdfBase64, mediaType, obraNome } = req.body || {};
    if (!pdfBase64) {
      res.status(400).json({ ok: false, error: 'Nenhum PDF foi enviado.' });
      return;
    }

    let conteudo = null;
    let provedor = null;
    let erroGemini = null;

    // 1ª tentativa: Gemini (gratuito)
    try {
      conteudo = await _chamarGemini(pdfBase64, mediaType, obraNome);
      provedor = 'gemini';
    } catch (e) {
      erroGemini = e.message || String(e);
      console.warn('Gemini falhou, tentando fallback para Anthropic:', erroGemini);
    }

    // 2ª tentativa: Anthropic (fallback, pago)
    if (!conteudo) {
      try {
        conteudo = await _chamarAnthropic(pdfBase64, mediaType, obraNome);
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

    res.status(200).json({ ok: true, data: conteudo, provedor });
  } catch (e) {
    console.error('Erro em gerar-relatorio:', e);
    res.status(500).json({ ok: false, error: e.message || 'Erro interno no servidor.' });
  }
};

// Timeout maior pra dar tempo de tentar os dois provedores em sequência
// se necessário. Ajuste no painel do Vercel (Settings > Functions) se o
// seu plano permitir/exigir configuração diferente.
module.exports.config = { maxDuration: 60 };

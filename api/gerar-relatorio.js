// ============================================
// Vercel Function: gerar-relatorio
// Recebe um PDF (nota digitada ou manuscrita, exportada
// do Samsung Notes) e devolve um relatório estruturado em JSON,
// gerado pela IA do Google Gemini (lê o PDF diretamente,
// sem precisar de OCR separado). Usa a camada gratuita da API.
//
// A chave da API NUNCA fica no client — só aqui, como variável
// de ambiente (GEMINI_API_KEY) configurada no painel do Vercel.
// Gere a chave grátis (sem cartão) em https://aistudio.google.com/apikey
// ============================================

const MODEL = 'gemini-2.5-flash';

const SYSTEM_PROMPT = `Você é um assistente que organiza notas de campo de obras de
construção civil em relatórios formais. Você vai receber um PDF que pode conter texto
digitado ou escrita manuscrita (às vezes com desenhos/croquis simples).

Leia todo o conteúdo do PDF com atenção e devolva um objeto JSON válido seguindo
exatamente este schema:

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

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ ok: false, error: 'GEMINI_API_KEY não configurada no servidor (Vercel > Settings > Environment Variables).' });
      return;
    }

    const userText = `Obra: ${obraNome || 'não informado'}. Extraia e organize o conteúdo desta nota em um relatório estruturado, seguindo estritamente o schema JSON pedido nas instruções.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          {
            role: 'user',
            parts: [
              { inline_data: { mime_type: mediaType || 'application/pdf', data: pdfBase64 } },
              { text: userText },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      }),
    });

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      console.error('Erro Gemini:', data);
      res.status(geminiRes.status).json({
        ok: false,
        error: (data && data.error && data.error.message) || 'Erro ao consultar a IA.',
      });
      return;
    }

    const candidato = data.candidates && data.candidates[0];
    const parte = candidato && candidato.content && candidato.content.parts && candidato.content.parts[0];
    const texto = parte && parte.text;

    if (!texto) {
      console.error('Resposta inesperada do Gemini:', JSON.stringify(data));
      res.status(500).json({ ok: false, error: 'A IA não retornou nenhum texto.' });
      return;
    }

    let conteudo;
    try {
      conteudo = JSON.parse(texto);
    } catch (e) {
      console.error('JSON inválido retornado pela IA:', texto);
      res.status(500).json({ ok: false, error: 'A IA retornou um formato inválido. Tente novamente.' });
      return;
    }

    res.status(200).json({ ok: true, data: conteudo });
  } catch (e) {
    console.error('Erro em gerar-relatorio:', e);
    res.status(500).json({ ok: false, error: e.message || 'Erro interno no servidor.' });
  }
};

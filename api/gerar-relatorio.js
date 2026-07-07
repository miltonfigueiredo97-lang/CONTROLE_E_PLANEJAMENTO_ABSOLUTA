// ============================================
// Vercel Function: gerar-relatorio
// Recebe um PDF (nota digitada ou manuscrita, exportada
// do Samsung Notes) e devolve um relatório estruturado em JSON,
// gerado pela IA da Anthropic (Claude lê o PDF diretamente,
// sem precisar de OCR separado).
//
// A chave da API NUNCA fica no client — só aqui, como variável
// de ambiente (ANTHROPIC_API_KEY) configurada no painel do Vercel.
// ============================================

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

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      res.status(500).json({ ok: false, error: 'ANTHROPIC_API_KEY não configurada no servidor (Vercel > Settings > Environment Variables).' });
      return;
    }

    const userText = `Obra: ${obraNome || 'não informado'}. Extraia e organize o conteúdo desta nota em um relatório estruturado, seguindo estritamente o schema JSON pedido no sistema.`;

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: mediaType || 'application/pdf',
                  data: pdfBase64,
                },
              },
              { type: 'text', text: userText },
            ],
          },
        ],
      }),
    });

    const data = await anthropicRes.json();

    if (!anthropicRes.ok) {
      console.error('Erro Anthropic:', data);
      res.status(anthropicRes.status).json({
        ok: false,
        error: (data && data.error && data.error.message) || 'Erro ao consultar a IA.',
      });
      return;
    }

    const textBlock = (data.content || []).find((b) => b.type === 'text');
    if (!textBlock) {
      res.status(500).json({ ok: false, error: 'A IA não retornou nenhum texto.' });
      return;
    }

    let jsonLimpo = textBlock.text.trim();
    jsonLimpo = jsonLimpo.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();

    let conteudo;
    try {
      conteudo = JSON.parse(jsonLimpo);
    } catch (e) {
      console.error('JSON inválido retornado pela IA:', jsonLimpo);
      res.status(500).json({ ok: false, error: 'A IA retornou um formato inválido. Tente novamente.' });
      return;
    }

    res.status(200).json({ ok: true, data: conteudo });
  } catch (e) {
    console.error('Erro em gerar-relatorio:', e);
    res.status(500).json({ ok: false, error: e.message || 'Erro interno no servidor.' });
  }
};

// ============================================
// Vercel Function: pdf-proxy
// O Firebase Storage não libera CORS para fetch()/XHR por padrão
// (só funciona sem CORS em <img>/<embed>). Para o Levantamento de
// Piso ler os bytes do PDF com pdf.js no navegador, este proxy busca
// o arquivo no servidor (sem restrição de CORS) e devolve pro
// front-end, que está no mesmo domínio (sem problema de CORS).
//
// Só aceita URLs do bucket do Storage deste projeto (evita virar um
// proxy aberto para qualquer URL da internet).
// ============================================

const HOST_PERMITIDO = 'firebasestorage.googleapis.com';
const BUCKET_PERMITIDO = 'controle-absoluta.firebasestorage.app';

module.exports = async function handler(req, res) {
  const { url } = req.query || {};
  if (!url) {
    res.status(400).json({ error: 'Parâmetro url é obrigatório.' });
    return;
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch (e) {
    res.status(400).json({ error: 'URL inválida.' });
    return;
  }

  if (parsed.hostname !== HOST_PERMITIDO || !parsed.pathname.includes(`/b/${BUCKET_PERMITIDO}/`)) {
    res.status(403).json({ error: 'Origem do arquivo não permitida.' });
    return;
  }

  try {
    const upstream = await fetch(parsed.toString());
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: 'Erro ao buscar o arquivo (HTTP ' + upstream.status + ')' });
      return;
    }
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).send(buf);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Erro interno no servidor.' });
  }
};

module.exports.config = { maxDuration: 30 };

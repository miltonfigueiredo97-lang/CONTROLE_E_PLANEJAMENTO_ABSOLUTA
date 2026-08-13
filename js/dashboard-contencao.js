// ============================================
// Dashboard — Contenção / Solo Grampeado (DashContencao)
// Minimapas por vista (proporção real da imagem), somente leitura, com %
// executado — dados do Levantamento de Solo Grampeado.
// ============================================
const DashContencao = (() => {

  async function render(ctx) {
    const wrap = document.getElementById('db-solo-grampeado-wrap');
    if (!wrap) return;
    wrap.innerHTML = `
      <div class="card db-row">
        <div class="card-body">
          <div class="db-secao-header"><h3>⛰️ Contenção (Solo Grampeado)</h3></div>
          <div id="db-solo-grampeado">Carregando...</div>
        </div>
      </div>`;
    const host = document.getElementById('db-solo-grampeado');

    // Retry defensivo: espera até 2s e tenta reinjetar o script se o motor
    // não carregou (erro de rede pontual) — sem travar o resto da página.
    let SG = window.SoloGrampeadoCalculos;
    for (let tentativa = 0; !SG && tentativa < 10; tentativa++) {
      await new Promise(r => setTimeout(r, 200));
      SG = window.SoloGrampeadoCalculos;
    }
    if (!SG) {
      try {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'js/solo-grampeado-calculos.js?retry=' + Date.now();
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        });
        SG = window.SoloGrampeadoCalculos;
      } catch (eScript) {
        console.error('Falha ao reinjetar solo-grampeado-calculos.js:', eScript);
      }
    }
    if (!SG) {
      host.innerHTML = '<div class="db-vazio-inline">Motor de cálculo de Solo Grampeado não carregou (js/solo-grampeado-calculos.js), mesmo após nova tentativa. Verifique sua conexão e recarregue.</div>';
      return;
    }
    try {
      const obraId = ctx.obraId;
      const [vistas, chumbadores, execucoes, areas] = await Promise.all([
        Database.listar(obraId, 'sgVistas', null).catch(() => []),
        Database.listar(obraId, 'sgChumbadores', null).catch(() => []),
        Database.listar(obraId, 'sgExecucoes', null).catch(() => []),
        Database.listar(obraId, 'sgAreaExecutada', null).catch(() => []),
      ]);
      const vistasComImagem = vistas.filter(v => Number(v.imgWidthPx) > 0 && Number(v.imgHeightPx) > 0)
        .sort((a, b) => (a.numero || 0) - (b.numero || 0));
      if (!vistasComImagem.length) {
        // Obra sem contenção: seção some inteira em vez de ficar um card
        // vazio ocupando espaço.
        wrap.innerHTML = '';
        return;
      }
      const LARGURA_CARD = 340;
      const cardsHtml = await Promise.all(vistasComImagem.map(async v => {
        let imagem = null;
        try {
          const doc = await db.collection('obras').doc(obraId).collection('config').doc('sgImagem_' + v.id).get();
          imagem = doc.exists ? (doc.data().img || null) : null;
        } catch (e) {}
        const lista = chumbadores.filter(c => c.vista === v.id);
        const execMap = {};
        lista.forEach(c => { const e = execucoes.find(x => x.chumbadorId === c.id); if (e) execMap[c.id] = e; });
        const areasDaVista = areas.filter(a => a.vistaId === v.id);
        const resumo = SG.calcPctVista(v, lista, execMap, areasDaVista);
        const label = v.nome ? `${v.numero} — ${v.nome}` : `Vista ${v.numero}`;
        const zoom = LARGURA_CARD / Number(v.imgWidthPx);
        const alturaCard = Math.round(Number(v.imgHeightPx) * zoom);
        const svg = SG.mapaHTML(v, imagem, lista, execMap, areasDaVista, { interativo: false, mini: true, zoom, maxHeight: Math.min(280, Math.max(60, alturaCard)) });
        return `<div class="db-minimapa" style="width:${LARGURA_CARD}px;">
          <div class="db-minimapa-titulo">${DashCore.esc(label)}</div>
          ${svg}
          <div class="db-minimapa-rodape">
            <b>${SG.fmt1(resumo.pct)}%</b> · ${SG.fmt1(resumo.m2Executado)} / ${SG.fmt1(v.m2Total)} m²
          </div>
        </div>`;
      }));
      host.innerHTML = `<div class="db-minimapas">${cardsHtml.join('')}</div>`;
    } catch (e) {
      console.error(e);
      host.innerHTML = '<div class="db-vazio-inline">Erro ao carregar dados de Solo Grampeado.</div>';
    }
  }

  return { render };
})();
window.DashContencao = DashContencao;

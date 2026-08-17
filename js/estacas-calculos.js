// ============================================
// Módulo: EstacasCalculos
// Motor compartilhado do Controle de Estacas e Fundações
// (Controle + Dashboard). Marcadores ficam sobre uma imagem de
// fundo (PDF do projeto renderizado ou foto/planta), em pontos
// relativos (0..1) — mesmo princípio do Solo Grampeado, mas aqui
// os marcadores representam a FORMA da peça:
//   - Estaca: círculo (centro cx,cy + raio, todos relativos à
//     largura da imagem, pra continuar círculo em imagens não-quadradas)
//   - Fundação: polígono livre (pontos[] relativos), pra cobrir
//     blocos/sapatas/tubulões de formato irregular
// O % de execução de cada marcador vem do vínculo com uma peça do
// Levantamento de Concreto (concretoPecas + concretoLancamentos),
// via ConcretoCalculos.pctConcretado — não há cálculo próprio de
// volume aqui, só a pintura do status.
// Dados: Firestore obras/{obraId}/estacas*
// ============================================

const EstacasCalculos = (() => {
  const fmt1 = v => (v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const num = v => parseFloat(String(v ?? '').replace(',', '.')) || 0;
  const genId = p => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // ══════════════════════════════════════════
  // STATUS / CORES
  // ══════════════════════════════════════════
  // pct: 0..100 (ou null se marcador ainda sem peça vinculada)
  function corStatus(pct) {
    if (pct === null || pct === undefined) return '#cbd5e1'; // sem vínculo — cinza claro
    if (pct >= 100) return '#22c55e';   // concluído
    if (pct > 0) return '#f59e0b';      // parcial
    return '#94a3b8';                    // vinculado, pendente
  }
  function statusLabel(pct) {
    if (pct === null || pct === undefined) return 'Sem peça vinculada';
    if (pct >= 100) return 'Concretado';
    if (pct > 0) return `Parcial (${fmt1(pct)}%)`;
    return 'Pendente';
  }

  // ══════════════════════════════════════════
  // POSIÇÃO / GEOMETRIA
  // ══════════════════════════════════════════
  // Posição relativa (0..1) de um evento de mouse dentro do "stage"
  function posRelativa(evt, stageEl) {
    const r = stageEl.getBoundingClientRect();
    if (!r.width || !r.height) return { x: 0, y: 0 };
    return {
      x: Math.min(1, Math.max(0, (evt.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (evt.clientY - r.top) / r.height)),
    };
  }
  // Distância (fração da largura da imagem) entre um centro e um ponto —
  // usada tanto pra criar o círculo (arrastar define o raio) quanto pra
  // redimensionar depois. Sempre em px reais do stage (que já reflete o
  // zoom atual), dividido pela largura do stage — assim o raio salvo é
  // invariante ao zoom.
  function raioFracao(centroFrac, pontoFrac, stageEl) {
    const r = stageEl.getBoundingClientRect();
    if (!r.width) return 0;
    const dx = (pontoFrac.x - centroFrac.x) * r.width;
    const dy = (pontoFrac.y - centroFrac.y) * r.height;
    return Math.hypot(dx, dy) / r.width;
  }

  // ══════════════════════════════════════════
  // RENDER DO PALCO (imagem + marcadores) — HTML absoluto + SVG p/ polígonos.
  // Reaproveitado no Controle (interativo) e no Dashboard (miniatura, só leitura).
  // marcadores: array já filtrado pro tipo da view atual (circulo|poligono)
  // statusFn(marcador) => {pct, vinculada, label} — quem sabe da peça é o
  // módulo chamador (cruza com concretoPecas/concretoLancamentos)
  // ══════════════════════════════════════════
  function stageHTML(prancha, imagemBase64, marcadores, statusFn, opts) {
    opts = opts || {};
    const W = num(prancha.imgWidthPx) || 800, H = num(prancha.imgHeightPx) || 500;
    const zoom = opts.zoom || 1;
    const w = W * zoom, h = H * zoom;
    const cursor = (opts.interativo && !opts.mini) ? 'cursor:pointer;' : '';

    const circulos = (marcadores || []).filter(m => m.tipo === 'circulo').map(m => {
      const st = statusFn(m);
      const cor = corStatus(st.pct);
      const concluido = st.pct !== null && st.pct !== undefined && st.pct >= 100;
      const diam = Math.max(6, num(m.raio) * 2 * w);
      const tracejado = (st.pct === null || st.pct === undefined) ? 'border-style:dashed;' : 'border-style:solid;';
      const titulo = opts.mini ? '' : ` title="${esc(st.label || '')}${st.grupoLabel ? ' — ' + esc(st.grupoLabel) : ''}"`;
      // Anel externo colorido por grupo (diâmetro+comprimento) — some ao redor do
      // status, não substitui: o preenchimento/borda continuam mostrando o %.
      const anel = st.corGrupo ? `box-shadow:0 0 0 3px ${st.corGrupo};` : '';
      // Concluído (100%) fica sólido/opaco de verdade — antes ficava sempre
      // translúcido (60%), mesmo terminado, e ficava "fraco" visualmente.
      return `<div class="est-marcador est-circulo" data-id="${m.id}" style="position:absolute;left:${(m.cx * 100).toFixed(3)}%;top:${(m.cy * 100).toFixed(3)}%;width:${diam.toFixed(1)}px;height:${diam.toFixed(1)}px;transform:translate(-50%,-50%);border-radius:50%;background:${cor}${concluido ? '' : '99'};border:2px ${cor};${tracejado}${anel}${cursor}z-index:2;box-sizing:border-box;"${titulo}></div>`;
    }).join('');

    const poligonos = (marcadores || []).filter(m => m.tipo === 'poligono' && m.pontos && m.pontos.length >= 3).map(m => {
      const st = statusFn(m);
      const cor = corStatus(st.pct);
      const tracejado = (st.pct === null || st.pct === undefined) ? 'stroke-dasharray:1.5,1;' : '';
      const titulo = opts.mini ? '' : `<title>${esc(st.label || '')}</title>`;
      const pts = m.pontos.map(p => `${(p.x * 100).toFixed(3)},${(p.y * 100).toFixed(3)}`).join(' ');
      return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2;">
        <polygon class="est-poligono-hit" data-id="${m.id}" points="${pts}" fill="${cor}66" stroke="${cor}" stroke-width="0.4" vector-effect="non-scaling-stroke" ${tracejado} style="${cursor}pointer-events:auto;"${cursor ? '' : ''}>${titulo}</polygon>
      </svg>`;
    }).join('');

    const bg = imagemBase64
      ? `<img src="${imagemBase64}" style="width:100%;height:100%;display:block;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;pointer-events:none;" draggable="false">`
      : `<div style="width:100%;height:100%;background:repeating-linear-gradient(45deg,#f1f5f9,#f1f5f9 10px,#e2e8f0 10px,#e2e8f0 20px);"></div>`;
    const maxH = opts.mini ? (opts.maxHeight || 240) : (opts.maxHeight || 600);
    return `<div class="est-map-scroll" style="overflow:${opts.mini ? 'hidden' : 'auto'};max-height:${maxH}px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;">
      <div id="${opts.stageId || 'est-stage'}" class="est-map-stage" style="position:relative;width:${w}px;height:${h}px;touch-action:none;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;">
        ${bg}${poligonos}${circulos}
      </div>
    </div>`;
  }

  // ══════════════════════════════════════════
  // CORES POR GRUPO (diâmetro+comprimento das estacas)
  // Anel adicional no desenho, só pra diferenciar visualmente "qual tipo"
  // de estaca é qual — não é status (isso continua sendo corStatus).
  // Mapa é construído com TODAS as peças de uma vez (ordenado por diâmetro
  // depois comprimento) pra cor ficar estável e nunca colidir entre grupos —
  // usado tanto pelo Controle de Estacas quanto pelo Dashboard.
  // ══════════════════════════════════════════
  const PALETA_GRUPOS_ESTACA = ['#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#0ea5e9', '#d946ef', '#14b8a6', '#f43f5e', '#a3e635', '#6366f1', '#facc15'];
  function chaveGrupoEstaca(diametro, comprimento) { return `${num(diametro)}_${num(comprimento)}`; }
  function mapaCoresGrupoEstaca(pecas) {
    const chaves = [...new Set(
      (pecas || []).filter(p => p.tipo === 'Fundação' && p.subTipo === 'Estacas' && (p.diametro || p.comprimento))
        .map(p => chaveGrupoEstaca(p.diametro, p.comprimento))
    )].sort((a, b) => {
      const [da, ca] = a.split('_').map(Number), [db, cb] = b.split('_').map(Number);
      return da - db || ca - cb;
    });
    const mapa = new Map();
    chaves.forEach((k, i) => mapa.set(k, PALETA_GRUPOS_ESTACA[i % PALETA_GRUPOS_ESTACA.length]));
    return mapa;
  }

  // ══════════════════════════════════════════
  // ROTAÇÃO DA PRANCHA (90° sentido horário, fixo — não é toggle de exibição)
  // Transforma um ponto fracionário (x,y em 0..1, relativo à largura/altura
  // da imagem ANTIGA) pra onde ele deve ficar na imagem NOVA (já rotacionada,
  // com largura/altura trocadas). Usado tanto pra círculos (cx,cy) quanto
  // pra vértices de polígono — o raio do círculo precisa de ajuste à parte
  // (é fração da LARGURA, que muda de valor quando W e H trocam de lugar).
  // ══════════════════════════════════════════
  function rotacionarPontoCW(p) { return { x: 1 - p.y, y: p.x }; }

  // ══════════════════════════════════════════
  // Compactar imagem (canvas) — usado ao processar PDF/foto no upload,
  // pra não estourar o limite de ~950KB do doc Firestore.
  // ══════════════════════════════════════════
  function canvasParaDataURLLimitado(canvas, limiteBytes) {
    limiteBytes = limiteBytes || 950000;
    let quality = 0.85;
    let url = canvas.toDataURL('image/jpeg', quality);
    let tentativas = 0;
    while (url.length > limiteBytes && tentativas < 5) {
      quality -= 0.15;
      if (quality < 0.35) {
        const c2 = document.createElement('canvas');
        c2.width = Math.round(canvas.width * 0.75);
        c2.height = Math.round(canvas.height * 0.75);
        c2.getContext('2d').drawImage(canvas, 0, 0, c2.width, c2.height);
        canvas = c2;
        quality = 0.7;
      }
      url = canvas.toDataURL('image/jpeg', quality);
      tentativas++;
    }
    return { url, width: canvas.width, height: canvas.height, ok: url.length <= limiteBytes };
  }

  // ══════════════════════════════════════════
  // SINCRONIZAÇÃO COM O PLANEJAMENTO (Gantt)
  // Uma tarefa do Planejamento pode se vincular ao % de execução de
  // UMA PEÇA específica (t.estacasVinculoTipo='peca', t.estacasVinculoId=
  // concretoPecas.id) ou de uma CONCRETAGEM inteira de Fundação/Estacas
  // (t.estacasVinculoTipo='concretagem', t.estacasVinculoId=
  // concretoConcretagens.id — % = média ponderada por volume das peças
  // tipo Fundação daquela concretagem). Isso SUBSTITUI o % manual da
  // tarefa (que vira read-only no Planejamento quando há vínculo).
  // Chamada tanto pelo Planejamento (ao carregar a obra) quanto pelo
  // Controle de Estacas (logo após marcar um real no Acompanhamento) —
  // é sempre esta MESMA função, pra nunca existir dois cálculos que
  // divergem (já rolou antes com %, ver notas de versão V2.58.21).
  // ══════════════════════════════════════════
  async function sincronizarVinculosPlanejamento(obraId) {
    const [tarefas, pecas, pecaConc, lancamentos] = await Promise.all([
      Database.listar(obraId, 'tarefas', null),
      Database.listar(obraId, 'concretoPecas', null),
      Database.listar(obraId, 'concretoPecaConc', null),
      Database.listar(obraId, 'concretoLancamentos', null),
    ]);
    const comVinculo = tarefas.filter(t => t.estacasVinculoTipo && t.estacasVinculoId);
    if (!comVinculo.length) return;

    function pctDaPeca(pecaId) {
      const p = pecas.find(x => x.id === pecaId);
      return p ? ConcretoCalculos.pctConcretado(p, lancamentos) : null;
    }
    function pctDaConcretagem(concretagemId) {
      const ids = pecaConc.filter(pc => pc.concretagemId === concretagemId).map(pc => pc.pecaId);
      const pcs = pecas.filter(p => ids.includes(p.id) && p.tipo === 'Fundação');
      if (!pcs.length) return null;
      let sp = 0, sw = 0;
      pcs.forEach(p => { const w = Math.max(0.001, p.volume || 0); sp += ConcretoCalculos.pctConcretado(p, lancamentos) * w; sw += w; });
      return sw ? sp / sw : 0;
    }

    const updsMap = new Map(); // id -> novo percentualConcluido
    comVinculo.forEach(t => {
      const pct = t.estacasVinculoTipo === 'peca' ? pctDaPeca(t.estacasVinculoId) : pctDaConcretagem(t.estacasVinculoId);
      if (pct === null) return;
      const arred = Math.round(pct * 10) / 10;
      if (Math.abs(arred - (parseFloat(t.percentualConcluido) || 0)) > 0.05) {
        t.percentualConcluido = arred; // muta em memória — cascata de ancestrais precisa do valor fresco
        updsMap.set(t.id, arred);
        Utils.recalcularPercAncestrais(tarefas, t.id).forEach(u => updsMap.set(u.id, u.percentualConcluido));
      }
    });
    if (!updsMap.size) return;
    const ops = [...updsMap.entries()].map(([id, percentualConcluido]) => ({
      type: 'update', ref: Database.ref(obraId, 'tarefas').doc(id), data: { percentualConcluido },
    }));
    for (let i = 0; i < ops.length; i += 400) await Database.batchWrite(ops.slice(i, i + 400));
  }

  return {
    fmt1, num, genId, esc,
    corStatus, statusLabel,
    posRelativa, raioFracao,
    stageHTML,
    canvasParaDataURLLimitado,
    sincronizarVinculosPlanejamento,
    chaveGrupoEstaca, mapaCoresGrupoEstaca,
    rotacionarPontoCW,
  };
})();

// Expõe no window: 'const' no topo de um script NÃO vira propriedade de
// window automaticamente (só 'var' faz isso). Sem esta linha, qualquer
// código que cheque window.EstacasCalculos recebe undefined mesmo com o arquivo
// carregado — foi a causa do "motor de cálculo não carregado" no Dashboard.
window.EstacasCalculos = EstacasCalculos;

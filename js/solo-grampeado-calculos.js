// ============================================
// Módulo: SoloGrampeadoCalculos
// Motor compartilhado (Levantamento/Controle/Dashboard).
// Chumbadores são pontos livres (x,y relativos 0..1) sobre uma
// imagem de fundo (PDF renderizado ou foto/planta) — não um grid
// regular, pois as vistas reais são irregulares (ver elevações
// do Solo Grampeado: espaçamento variável, terreno inclinado).
// Escala calibrada por 2 cliques + comprimento real (cm), usando
// as dimensões naturais (px) da imagem armazenadas em cada vista.
// ============================================

const SoloGrampeadoCalculos = (() => {
  const fmt2 = v => (v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmt1 = v => (v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const num = v => parseFloat(String(v ?? '').replace(',', '.')) || 0;
  const genId = p => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  const TIPOS_CHUMBADOR = ['Vertical', 'Horizontal'];

  // Pesos das etapas — somam 100% da vista.
  // Perfuração/Injeção 1/Injeção 2 são por CHUMBADOR (50% no total).
  // Projeção/Acabamento são por ÁREA MARCADA, em m² (50% no total).
  const ETAPAS_CHUMBADOR = [
    { key: 'perfuracao', label: 'Perfuração do Chumbador', peso: 20 },
    { key: 'injecao1', label: 'Injeção 1', peso: 15 },
    { key: 'injecao2', label: 'Injeção 2', peso: 15 },
  ];
  const ETAPAS_AREA = [
    { key: 'projecao', label: 'Projeção da Área', peso: 30 },
    { key: 'acabamento', label: 'Acabamento da Área', peso: 20 },
  ];
  const PESO_CHUMBADOR_TOTAL = ETAPAS_CHUMBADOR.reduce((s, e) => s + e.peso, 0); // 50
  const PESO_AREA_TOTAL = ETAPAS_AREA.reduce((s, e) => s + e.peso, 0); // 50

  // ══════════════════════════════════════════
  // ESCALA e ÁREA (a partir das dimensões naturais da imagem)
  // ══════════════════════════════════════════
  function calcEscalaCmPorPx(distanciaPx, cmReal) {
    if (!(distanciaPx > 0) || !(cmReal > 0)) return 0;
    return cmReal / distanciaPx;
  }
  function calcM2Imagem(imgWpx, imgHpx, escalaCmPorPx) {
    if (!(escalaCmPorPx > 0)) return 0;
    const largCm = num(imgWpx) * escalaCmPorPx;
    const altCm = num(imgHpx) * escalaCmPorPx;
    return (largCm / 100) * (altCm / 100);
  }
  // rect com x1,y1,x2,y2 relativos (0..1) de uma vista
  function calcM2Retangulo(rect, vista) {
    const escala = num(vista.escalaCmPorPx);
    if (!(escala > 0)) return 0;
    const wPx = Math.abs(rect.x2 - rect.x1) * num(vista.imgWidthPx);
    const hPx = Math.abs(rect.y2 - rect.y1) * num(vista.imgHeightPx);
    return ((wPx * escala) / 100) * ((hPx * escala) / 100);
  }

  // ══════════════════════════════════════════
  // % DE EXECUÇÃO DA VISTA
  // ══════════════════════════════════════════
  function pctChumbador(exec) {
    if (!exec) return 0;
    let pct = 0;
    ETAPAS_CHUMBADOR.forEach(e => { if (exec[e.key] && exec[e.key].feito) pct += e.peso; });
    return pct; // 0..50
  }
  function statusChumbador(exec) {
    if (!exec) return 'Pendente';
    if (exec.injecao2 && exec.injecao2.feito) return 'Injeção 2 concluída';
    if (exec.injecao1 && exec.injecao1.feito) return 'Injeção 1 concluída';
    if (exec.perfuracao && exec.perfuracao.feito) return 'Perfurado';
    return 'Pendente';
  }
  function corChumbador(pct) {
    if (pct >= PESO_CHUMBADOR_TOTAL) return '#22c55e';
    if (pct > 0) return '#f59e0b';
    return '#94a3b8';
  }
  // areasDaVista: array de marcações {etapa, m2}
  function calcPctVista(vista, chumbadoresDaVista, execMap, areasDaVista) {
    const qtd = chumbadoresDaVista.length;
    let contribChumb = 0;
    if (qtd > 0) {
      const somaPct = chumbadoresDaVista.reduce((s, c) => s + pctChumbador(execMap[c.id]), 0);
      contribChumb = somaPct / qtd; // já em escala 0..50
    }
    const m2Total = num(vista.m2Total);
    const areas = areasDaVista || [];
    const m2Projetado = areas.filter(a => a.etapa === 'projecao').reduce((s, a) => s + num(a.m2), 0);
    const m2Acabado = areas.filter(a => a.etapa === 'acabamento').reduce((s, a) => s + num(a.m2), 0);
    const fracProj = m2Total > 0 ? Math.min(1, m2Projetado / m2Total) : 0;
    const fracAcab = m2Total > 0 ? Math.min(1, m2Acabado / m2Total) : 0;
    const contribProj = fracProj * ETAPAS_AREA[0].peso;
    const contribAcab = fracAcab * ETAPAS_AREA[1].peso;
    const pct = contribChumb + contribProj + contribAcab;
    return {
      pct: Math.min(100, pct),
      qtdChumbadores: qtd,
      chumbadoresFeitos: chumbadoresDaVista.filter(c => pctChumbador(execMap[c.id]) >= PESO_CHUMBADOR_TOTAL).length,
      m2Projetado, m2Acabado,
      m2Executado: Math.min(m2Total, (pct / 100) * m2Total),
    };
  }

  // ══════════════════════════════════════════
  // RENDER DO MAPA (HTML absoluto — não SVG) — reaproveitado em
  // Levantamento (editor com zoom/scroll), Controle (interativo,
  // sem zoom customizado) e Dashboard (miniatura, sem interação).
  // Retorna só HTML; a interatividade (cliques) é ligada pelo
  // módulo chamador via posRelativa() sobre o elemento #stageId.
  // ══════════════════════════════════════════
  function mapaHTML(vista, imagemBase64, pontos, execMap, areas, opts) {
    opts = opts || {};
    const W = num(vista.imgWidthPx) || 800, H = num(vista.imgHeightPx) || 500;
    const zoom = opts.zoom || 1;
    const w = W * zoom, h = H * zoom;
    const raio = opts.mini ? 3 : 7;
    const marcadores = (pontos || []).map(p => {
      const pct = pctChumbador((execMap || {})[p.id]);
      const cor = opts.readonlyCor ? '#3b82f6' : corChumbador(pct);
      const cursor = (opts.interativo && !opts.mini) ? 'cursor:pointer;' : '';
      const titulo = opts.mini ? '' : ` title="${esc(p.numero)} — ${esc(statusChumbador((execMap || {})[p.id]))}"`;
      return `<div class="sg-marcador" data-id="${p.id}" style="position:absolute;left:${(p.x * 100).toFixed(3)}%;top:${(p.y * 100).toFixed(3)}%;width:${raio * 2}px;height:${raio * 2}px;margin:-${raio}px;border-radius:50%;background:${cor};border:1px solid #1e293b;${cursor}z-index:2;"${titulo}></div>`;
    }).join('');
    const areasHtml = (areas || []).map(a => {
      const fill = a.etapa === 'acabamento' ? 'rgba(22,163,74,.55)' : 'rgba(187,247,208,.65)';
      const x = Math.min(a.x1, a.x2), y = Math.min(a.y1, a.y2);
      const ww = Math.abs(a.x2 - a.x1), hh = Math.abs(a.y2 - a.y1);
      return `<div class="sg-area" data-id="${a.id || ''}" style="position:absolute;left:${(x * 100).toFixed(3)}%;top:${(y * 100).toFixed(3)}%;width:${(ww * 100).toFixed(3)}%;height:${(hh * 100).toFixed(3)}%;background:${fill};border:1px solid rgba(22,101,52,.45);z-index:1;"></div>`;
    }).join('');
    const bg = imagemBase64
      ? `<img src="${imagemBase64}" style="width:100%;height:100%;display:block;user-select:none;pointer-events:none;" draggable="false">`
      : `<div style="width:100%;height:100%;background:repeating-linear-gradient(45deg,#f1f5f9,#f1f5f9 10px,#e2e8f0 10px,#e2e8f0 20px);"></div>`;
    const maxH = opts.mini ? (opts.maxHeight || 240) : (opts.maxHeight || 560);
    return `<div class="sg-map-scroll" style="overflow:${opts.mini ? 'hidden' : 'auto'};max-height:${maxH}px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;">
      <div id="${opts.stageId || 'sg-stage'}" class="sg-map-stage" style="position:relative;width:${w}px;height:${h}px;">
        ${bg}${areasHtml}${marcadores}
      </div>
    </div>`;
  }

  // Posição relativa (0..1) de um clique dentro do elemento "stage"
  function posRelativa(evt, stageEl) {
    const r = stageEl.getBoundingClientRect();
    if (!r.width || !r.height) return { x: 0, y: 0 };
    return {
      x: Math.min(1, Math.max(0, (evt.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (evt.clientY - r.top) / r.height)),
    };
  }
  function distanciaPxEntrePontos(p1, p2, vista) {
    const dx = (p2.x - p1.x) * num(vista.imgWidthPx);
    const dy = (p2.y - p1.y) * num(vista.imgHeightPx);
    return Math.hypot(dx, dy);
  }

  // ══════════════════════════════════════════
  // Compactar imagem (canvas) — usado ao processar PDF/foto no
  // upload, pra não estourar o limite de ~950KB do doc Firestore.
  // ══════════════════════════════════════════
  function canvasParaDataURLLimitado(canvas, limiteBytes) {
    limiteBytes = limiteBytes || 950000;
    let quality = 0.85;
    let url = canvas.toDataURL('image/jpeg', quality);
    let tentativas = 0;
    while (url.length > limiteBytes && tentativas < 5) {
      quality -= 0.15;
      if (quality < 0.35) {
        // reduz dimensão em vez de piorar mais a qualidade
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

  return {
    fmt2, fmt1, num, genId, esc,
    TIPOS_CHUMBADOR, ETAPAS_CHUMBADOR, ETAPAS_AREA, PESO_CHUMBADOR_TOTAL, PESO_AREA_TOTAL,
    calcEscalaCmPorPx, calcM2Imagem, calcM2Retangulo,
    pctChumbador, statusChumbador, corChumbador, calcPctVista,
    mapaHTML, posRelativa, distanciaPxEntrePontos,
    canvasParaDataURLLimitado,
  };
})();

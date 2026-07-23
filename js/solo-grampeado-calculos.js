// ============================================
// Módulo: SoloGrampeadoCalculos
// Motor de cálculo compartilhado entre Levantamento e Controle
// de Solo Grampeado: geometria do grid, escala, % de execução
// e renderização do minimapa (SVG) reaproveitado nos dois módulos
// e no Dashboard.
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
  // Projeção/Acabamento são por CÉLULA DE ÁREA (50% no total).
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
  // GEOMETRIA DO GRID (posições dos chumbadores no SVG)
  // ══════════════════════════════════════════
  const SVG_W = 760, SVG_H = 440, SVG_PAD = 42;

  function gridColX(col, cols) {
    const usable = SVG_W - 2 * SVG_PAD;
    return SVG_PAD + (cols > 1 ? (col / (cols - 1)) * usable : usable / 2);
  }
  function gridRowY(row, rows) {
    const usable = SVG_H - 2 * SVG_PAD;
    return SVG_PAD + (rows > 1 ? (row / (rows - 1)) * usable : usable / 2);
  }
  // Células de área ficam ENTRE os chumbadores (malha rows-1 x cols-1, mínimo 1x1)
  function celulasDim(vista) {
    const cols = Math.max(1, parseInt(vista.gridCols) || 1);
    const rows = Math.max(1, parseInt(vista.gridRows) || 1);
    return { cellCols: Math.max(1, cols - 1), cellRows: Math.max(1, rows - 1), cols, rows };
  }
  function celulaKey(r, c) { return `${r}_${c}`; }
  function celulaRect(r, c, vista) {
    const { cols, rows } = celulasDim(vista);
    const x1 = cols > 1 ? gridColX(c, cols) : SVG_PAD;
    const x2 = cols > 1 ? gridColX(c + 1, cols) : SVG_W - SVG_PAD;
    const y1 = rows > 1 ? gridRowY(r, rows) : SVG_PAD;
    const y2 = rows > 1 ? gridRowY(r + 1, rows) : SVG_H - SVG_PAD;
    return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
  }

  // ══════════════════════════════════════════
  // ESCALA (linha de calibração) e m² sugerido
  // ══════════════════════════════════════════
  function distPx(l) { return Math.hypot((l.x2 - l.x1), (l.y2 - l.y1)); }
  function calcEscalaCmPorPx(linha, cmReal) {
    if (!linha || !(cmReal > 0)) return 0;
    const d = distPx(linha);
    return d > 0 ? cmReal / d : 0;
  }
  function calcM2Sugerido(vista) {
    const escala = num(vista.escalaCmPorPx);
    if (!(escala > 0)) return 0;
    const larguraCm = (SVG_W - 2 * SVG_PAD) * escala;
    const alturaCm = (SVG_H - 2 * SVG_PAD) * escala;
    return (larguraCm / 100) * (alturaCm / 100);
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
  // execMap: { [chumbadorId]: execDoc }
  function calcPctVista(vista, chumbadoresDaVista, execMap, areaDoc) {
    const qtd = chumbadoresDaVista.length;
    let contribChumb = 0;
    if (qtd > 0) {
      const somaPct = chumbadoresDaVista.reduce((s, c) => s + pctChumbador(execMap[c.id]), 0);
      contribChumb = somaPct / qtd; // já em escala 0..50
    }
    const { cellCols, cellRows } = celulasDim(vista);
    const totalCelulas = cellCols * cellRows;
    const projFeitas = areaDoc?.celulasProjecao?.length || 0;
    const acabFeitas = areaDoc?.celulasAcabamento?.length || 0;
    const contribProj = totalCelulas > 0 ? (projFeitas / totalCelulas) * ETAPAS_AREA[0].peso : 0;
    const contribAcab = totalCelulas > 0 ? (acabFeitas / totalCelulas) * ETAPAS_AREA[1].peso : 0;
    const pct = contribChumb + contribProj + contribAcab;
    const m2Total = num(vista.m2Total);
    const m2PorCelula = totalCelulas > 0 ? m2Total / totalCelulas : 0;
    return {
      pct: Math.min(100, pct),
      qtdChumbadores: qtd,
      chumbadoresFeitos: chumbadoresDaVista.filter(c => pctChumbador(execMap[c.id]) >= PESO_CHUMBADOR_TOTAL).length,
      totalCelulas, projFeitas, acabFeitas,
      m2Projetado: projFeitas * m2PorCelula,
      m2Acabado: acabFeitas * m2PorCelula,
      m2Executado: Math.min(m2Total, (pct / 100) * m2Total),
    };
  }

  // ══════════════════════════════════════════
  // RENDER DO MINIMAPA (SVG) — reaproveitado em Levantamento,
  // Controle e Dashboard. `opts.interativo` liga os onclick.
  // ══════════════════════════════════════════
  function corChumbador(pct) {
    if (pct >= PESO_CHUMBADOR_TOTAL) return '#22c55e';
    if (pct > 0) return '#f59e0b';
    return '#94a3b8';
  }
  function svgMinimapa(vista, chumbadoresDaVista, execMap, areaDoc, imagemBase64, opts) {
    opts = opts || {};
    const cols = Math.max(1, parseInt(vista.gridCols) || 1);
    const rows = Math.max(1, parseInt(vista.gridRows) || 1);
    const { cellCols, cellRows } = celulasDim(vista);
    const modoArea = opts.modoArea || null; // 'projecao' | 'acabamento' | null
    const celProj = new Set(areaDoc?.celulasProjecao || []);
    const celAcab = new Set(areaDoc?.celulasAcabamento || []);

    let bg = '';
    if (imagemBase64) {
      bg = `<image href="${imagemBase64}" x="${SVG_PAD}" y="${SVG_PAD}" width="${SVG_W - 2 * SVG_PAD}" height="${SVG_H - 2 * SVG_PAD}" preserveAspectRatio="none" opacity="0.55"/>`;
    }

    // Células de área
    let celulasSvg = '';
    for (let r = 0; r < cellRows; r++) {
      for (let c = 0; c < cellCols; c++) {
        const key = celulaKey(r, c);
        const rect = celulaRect(r, c, vista);
        const feitoAcab = celAcab.has(key);
        const feitoProj = celProj.has(key);
        const fill = feitoAcab ? '#16a34a' : feitoProj ? '#bbf7d0' : 'transparent';
        const opacity = feitoAcab ? 0.55 : feitoProj ? 0.7 : 1;
        const clickAttr = (opts.interativo && opts.celulaClickFn && modoArea)
          ? `onclick="${opts.celulaClickFn}('${key}')" style="cursor:pointer;"` : '';
        celulasSvg += `<rect x="${rect.x.toFixed(1)}" y="${rect.y.toFixed(1)}" width="${rect.w.toFixed(1)}" height="${rect.h.toFixed(1)}" fill="${fill}" fill-opacity="${opacity}" stroke="#cbd5e1" stroke-width="0.75" ${clickAttr}><title>Célula ${r + 1}.${c + 1}</title></rect>`;
      }
    }

    // Linha de calibração (se ainda estiver sendo mostrada/editada)
    let calibSvg = '';
    if (opts.mostrarCalibracao && vista.linhaCalibracao) {
      const l = vista.linhaCalibracao;
      calibSvg = `<line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}" stroke="#dc2626" stroke-width="2" stroke-dasharray="5,3"/>
        <circle cx="${l.x1}" cy="${l.y1}" r="4" fill="#dc2626"/><circle cx="${l.x2}" cy="${l.y2}" r="4" fill="#dc2626"/>`;
    }

    // Chumbadores (bolinhas)
    let bolinhasSvg = '';
    chumbadoresDaVista.forEach(ch => {
      const x = gridColX(ch.coluna || 0, cols);
      const y = gridRowY(ch.linha || 0, rows);
      const pct = pctChumbador(execMap[ch.id]);
      const cor = corChumbador(pct);
      const clickAttr = (opts.interativo && opts.chumbadorClickFn && !modoArea)
        ? `onclick="${opts.chumbadorClickFn}('${ch.id}')" style="cursor:pointer;"` : '';
      const raio = opts.mini ? 4 : 8;
      bolinhasSvg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${raio}" fill="${cor}" stroke="#1e293b" stroke-width="1" ${clickAttr}><title>Chumbador ${esc(ch.numero)} — ${statusChumbador(execMap[ch.id])}</title></circle>`;
      if (!opts.mini) {
        bolinhasSvg += `<text x="${x.toFixed(1)}" y="${(y - 12).toFixed(1)}" text-anchor="middle" font-size="9" fill="#334155" font-family="JetBrains Mono,monospace">${esc(ch.numero)}</text>`;
      }
    });

    return `<svg viewBox="0 0 ${SVG_W} ${SVG_H}" width="100%" style="max-width:${SVG_W}px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
      ${bg}${celulasSvg}${calibSvg}${bolinhasSvg}
    </svg>`;
  }

  // ══════════════════════════════════════════
  // PRODUÇÃO DIÁRIA (legado — Grampos/Extras/Estacas)
  // ══════════════════════════════════════════
  function mlDiaProducao(p) {
    return (num(p.grampos) * num(p.tamanhoGrampos)) + (num(p.extras) * num(p.tamanhoExtras)) + (num(p.estacas) * num(p.tamanhoEstacas));
  }

  return {
    fmt2, fmt1, num, genId, esc,
    TIPOS_CHUMBADOR, ETAPAS_CHUMBADOR, ETAPAS_AREA, PESO_CHUMBADOR_TOTAL, PESO_AREA_TOTAL,
    SVG_W, SVG_H, SVG_PAD,
    gridColX, gridRowY, celulasDim, celulaKey, celulaRect,
    distPx, calcEscalaCmPorPx, calcM2Sugerido,
    pctChumbador, statusChumbador, calcPctVista, corChumbador, svgMinimapa,
    mlDiaProducao,
  };
})();

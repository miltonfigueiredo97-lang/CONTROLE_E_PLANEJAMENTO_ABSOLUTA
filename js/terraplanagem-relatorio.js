// ============================================
// Relatório de Terraplanagem por Período (TerraRel) — MÓDULO COMPARTILHADO
// Fonte ÚNICA do relatório: usado pelo Controle de Terraplanagem e pelo
// Dashboard (botão em cima do gráfico). Abre num overlay próprio — não
// depende de modal no HTML da página — então gera o PDF de onde for chamado.
// Uso: TerraRel.abrir({ obraNome, entregas, caminhoes, config, volEmpolado })
//   entregas: docs de terraEntregas · caminhoes: docs de terraCaminhoes
//   config: config/terraplanagem (valorViagemTerra/Entulho)
//   volEmpolado: volume previsto empolado (0 se não houver Levantamento)
// Cálculos idênticos aos que viviam em js/controle-terraplanagem.js.
// ============================================
const TerraRel = (() => {
  let _ctx = null;       // { obraNome, entregas, caminhoes, config, volEmpolado }
  let _rel = null;

  // Fallback duplo: window (agora exposto) ou o identificador global direto.
  const TC = () => window.TerraplanagemCalculos || (typeof TerraplanagemCalculos !== 'undefined' ? TerraplanagemCalculos : null);
  function _fRS(n) { return 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function _fBR(iso) {
    if (!iso) return '—';
    const p = String(iso).split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
  }
  function _esc(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function _ls(src) { return new Promise((r, j) => { const s = document.createElement('script'); s.src = src; s.onload = r; s.onerror = j; document.head.appendChild(s); }); }

  // ── Mesmas regras do Controle ──
  function _classMat(material) {
    const m = String(material || '').trim().toUpperCase();
    if (!m) return 'SEM MATERIAL';
    if (m.includes('TERRA')) return 'TERRA';
    if (m.includes('ENTULHO')) return 'ENTULHO';
    return m;
  }
  function _valorViagem(e) {
    if (TC().num(e.valor) > 0) return TC().num(e.valor);
    const c = _classMat(e.material);
    if (c === 'TERRA') return TC().num(_ctx.config?.valorViagemTerra);
    if (c === 'ENTULHO') return TC().num(_ctx.config?.valorViagemEntulho);
    return 0;
  }
  function _volPorMaterial(lista) {
    const grupos = {};
    lista.forEach(e => {
      const g = _classMat(e.material);
      grupos[g] = grupos[g] || { material: g, viagens: 0, volume: 0 };
      grupos[g].viagens++;
      grupos[g].volume += TC().num(e.volume);
    });
    return Object.values(grupos).sort((a, b) => b.volume - a.volume);
  }

  // ── Abertura (overlay próprio, independente da página) ──
  function abrir(ctx) {
    _ctx = ctx;
    _rel = null;
    const entregas = ctx.entregas || [];
    const datas = entregas.map(e => e.data).filter(Boolean).sort();
    const hoje = new Date().toISOString().slice(0, 10);
    const min = datas[0] || hoje, max = datas[datas.length - 1] || hoje;

    let overlay = document.getElementById('terra-rel-overlay');
    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.id = 'terra-rel-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:650;background:rgba(13,13,13,0.55);display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:14px;border-top:4px solid var(--cor-primaria,#F5C800);box-shadow:0 20px 60px rgba(0,0,0,.25);width:100%;max-width:860px;max-height:88vh;overflow-y:auto;padding:18px 20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:4px;">
          <div style="font-weight:800;font-size:1rem;">📄 Relatório de Terraplanagem — Período</div>
          <button class="btn btn-secundario btn-sm" onclick="document.getElementById('terra-rel-overlay').remove()">✕</button>
        </div>
        <div style="font-size:.8rem;color:#777;margin-bottom:12px;">${_esc(ctx.obraNome || '')}</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end;margin-bottom:6px;">
          <div><label style="font-size:.75rem;font-weight:700;display:block;margin-bottom:3px;">Data Início</label><input type="date" id="terra-rel-inicio" class="form-control" value="${min}"></div>
          <div><label style="font-size:.75rem;font-weight:700;display:block;margin-bottom:3px;">Data Fim</label><input type="date" id="terra-rel-fim" class="form-control" value="${max}"></div>
          <button class="btn btn-primario btn-sm" onclick="TerraRel.gerar()">📊 Gerar Relatório</button>
        </div>
        <div id="terra-rel-preview" style="margin-top:14px;"></div>
      </div>`;
    document.body.appendChild(overlay);
    gerar(); // já gera com o período completo — 1 clique a menos
  }

  // Métricas GLOBAIS da obra (não dependem do período escolhido no relatório —
  // "quanto falta" é sempre em relação a TUDO, não só ao intervalo de datas).
  function _calcularGlobal() {
    const todasEntregas = _ctx.entregas || [];
    const volEmpolado = TC().num(_ctx.volEmpolado); // terra prevista, já empolada
    const volumeTotalEstacas = TC().num(_ctx.volumeTotalEstacas);
    const volumeFundacaoSuperficial = TC().num(_ctx.volumeFundacaoSuperficial);
    const taxa = TC().num(_ctx.config?.taxaEmpolamento ?? 0.3);
    const volEstacasEmpolado = TC().calcVolumeComEmpolamento(volumeTotalEstacas, taxa);
    const volFundacaoSuperficialEmpolado = TC().calcVolumeComEmpolamento(volumeFundacaoSuperficial, taxa);
    const volTotalRetirada = volEmpolado + volEstacasEmpolado + volFundacaoSuperficialEmpolado;
    const volExecutado = todasEntregas.filter(e => _classMat(e.material) === 'TERRA').reduce((s, e) => s + TC().num(e.volume), 0);
    const volFaltando = volTotalRetirada > 0 ? Math.max(0, volTotalRetirada - volExecutado) : null;

    const capacidadeMedia = TC().num(_ctx.capacidadeMedia);
    const viagensAtual = todasEntregas.length;
    const viagensTotalEstimado = (volTotalRetirada > 0 && capacidadeMedia > 0) ? Math.ceil(volTotalRetirada / capacidadeMedia) : null;
    const viagensFaltando = viagensTotalEstimado != null ? Math.max(0, viagensTotalEstimado - viagensAtual) : null;

    const custoTotalGlobal = todasEntregas.reduce((s, e) => s + _valorViagem(e), 0);
    const custoMedioPorViagem = viagensAtual > 0 ? custoTotalGlobal / viagensAtual : TC().num(_ctx.config?.valorViagemTerra);
    const valorFaltando = viagensFaltando != null ? viagensFaltando * custoMedioPorViagem : null;

    return {
      volEmpolado, volumeTotalEstacas, volEstacasEmpolado, volumeFundacaoSuperficial, volFundacaoSuperficialEmpolado,
      volTotalRetirada, volExecutado, volFaltando,
      capacidadeMedia, viagensAtual, viagensTotalEstimado, viagensFaltando,
      custoTotalGlobal, custoMedioPorViagem, valorFaltando,
    };
  }

  function _calcular(inicio, fim) {
    const lista = (_ctx.entregas || []).filter(e => e.data && e.data >= inicio && e.data <= fim)
      .sort((a, b) => (a.data || '').localeCompare(b.data || ''));
    const porDia = {}, porCaminhao = {};
    lista.forEach(e => {
      const custo = _valorViagem(e);
      const d = e.data || '—';
      porDia[d] = porDia[d] || { data: d, viagens: 0, volume: 0, custo: 0 };
      porDia[d].viagens++; porDia[d].volume += TC().num(e.volume); porDia[d].custo += custo;
      const chave = e.placa || '— sem placa —';
      porCaminhao[chave] = porCaminhao[chave] || { placa: chave, viagens: 0, volume: 0, custo: 0 };
      porCaminhao[chave].viagens++; porCaminhao[chave].volume += TC().num(e.volume); porCaminhao[chave].custo += custo;
    });
    const dias = Object.values(porDia).sort((a, b) => a.data.localeCompare(b.data));
    let accCusto = 0;
    dias.forEach(d => { accCusto += d.custo; d.custoAcum = accCusto; });
    const caminhoesList = Object.values(porCaminhao).sort((a, b) => b.volume - a.volume);
    const porMaterial = _volPorMaterial(lista);
    porMaterial.forEach(g => { g.custo = lista.filter(e => _classMat(e.material) === g.material).reduce((s, e) => s + _valorViagem(e), 0); });
    const totalVolume = lista.reduce((s, e) => s + TC().num(e.volume), 0);
    const totalCusto = lista.reduce((s, e) => s + _valorViagem(e), 0);
    const volTerra = (porMaterial.find(g => g.material === 'TERRA') || {}).volume || 0;
    const volEntulho = (porMaterial.find(g => g.material === 'ENTULHO') || {}).volume || 0;
    return { inicio, fim, lista, dias, caminhoesList, porMaterial, totalVolume, totalCusto, volTerra, volEntulho, totalViagens: lista.length };
  }

  function gerar() {
    try {
      const inicio = document.getElementById('terra-rel-inicio')?.value;
      const fim = document.getElementById('terra-rel-fim')?.value;
      if (!inicio || !fim || inicio > fim) { Utils.toast('Informe um período válido (início antes do fim).', 'alerta'); return; }
      if (!TC()) { Utils.toast('Motor de cálculo de Terraplanagem não carregou — recarregue a página (Ctrl+Shift+R).', 'erro'); return; }
      _rel = _calcular(inicio, fim);
      _rel.global = _calcularGlobal();
      _renderPreview();
    } catch (e) {
      console.error('TerraRel.gerar:', e);
      Utils.toast('Erro ao gerar o relatório: ' + e.message, 'erro');
    }
  }

  function _renderPreview() {
    const el = document.getElementById('terra-rel-preview');
    if (!el || !_rel) return;
    const r = _rel, g = _rel.global || {};
    const kpi = (icone, label, valor, sub) => `<div style="border:1px solid #e5e5e5;border-radius:10px;padding:8px 10px;display:flex;gap:8px;align-items:center;"><span style="font-size:1.1rem;">${icone}</span><div><div style="font-size:.62rem;color:#888;text-transform:uppercase;">${label}</div><div style="font-weight:800;font-family:var(--font-mono,monospace);">${valor}</div>${sub ? `<div style="font-size:.6rem;color:#aaa;">${sub}</div>` : ''}</div></div>`;

    const resumoGlobal = `
      <div style="font-size:.72rem;font-weight:800;color:#888;text-transform:uppercase;margin-bottom:6px;">Resumo geral da obra (todo o histórico, não só o período)</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:8px;">
        ${kpi('🚚', 'Viagens atual/total', `${g.viagensAtual ?? 0}${g.viagensTotalEstimado != null ? ` / ${g.viagensTotalEstimado}` : ''}`)}
        ${kpi('🏗️', 'Volume total a retirar', g.volTotalRetirada > 0 ? TC().fmt1(g.volTotalRetirada) + ' m³' : '—', 'terra+estacas+fundação, empolados')}
        ${kpi('🟤', 'Volume executado', TC().fmt1(g.volExecutado || 0) + ' m³')}
        ${kpi('⏳', 'Volume faltando', g.volFaltando != null ? TC().fmt1(g.volFaltando) + ' m³' : '—')}
        ${kpi('💰', 'Valor gasto', _fRS(g.custoTotalGlobal || 0))}
        ${kpi('💸', 'Valor faltando (estimado)', g.valorFaltando != null ? _fRS(g.valorFaltando) : '—')}
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:14px;">
        ${kpi('📦', 'Vol. terra (previsto)', g.volEmpolado > 0 ? TC().fmt1(g.volEmpolado) + ' m³' : '—')}
        ${kpi('🔩', 'Vol. fundação profunda', g.volEstacasEmpolado > 0 ? TC().fmt1(g.volEstacasEmpolado) + ' m³' : '—', 'Controle de Estacas')}
        ${kpi('🧊', 'Vol. fundação superficial', g.volFundacaoSuperficialEmpolado > 0 ? TC().fmt1(g.volFundacaoSuperficialEmpolado) + ' m³' : '—', 'ainda sem módulo próprio')}
      </div>`;

    if (!r.lista.length) {
      el.innerHTML = resumoGlobal + '<div style="font-size:.82rem;color:#888;padding:12px 0;border-top:1px solid #eee;">Nenhuma viagem registrada nesse período (o resumo geral acima é de toda a obra).</div>';
      return;
    }
    const maxVol = Math.max(...r.dias.map(d => d.volume), 1);
    const maxCusto = Math.max(...r.dias.map(d => d.custoAcum), 1);
    const barW = Math.max(5, Math.min(26, 620 / r.dias.length - 4));
    const chartH = 110;
    const chartW = r.dias.length * (barW + 4);
    const bars = r.dias.map((d, i) => {
      const h = (d.volume / maxVol) * chartH;
      const x = i * (barW + 4);
      return `<rect x="${x}" y="${chartH - h}" width="${barW}" height="${Math.max(1, h)}" fill="var(--cor-primaria,#f5c800)" rx="1.5"><title>${_esc(d.data)}: ${TC().fmt1(d.volume)} m³ · ${_fRS(d.custo)}</title></rect>`;
    }).join('');
    const linhaCusto = r.dias.length > 1 && r.totalCusto > 0 ? `<polyline points="${r.dias.map((d, i) => `${(i * (barW + 4) + barW / 2).toFixed(1)},${(chartH - (d.custoAcum / maxCusto) * chartH).toFixed(1)}`).join(' ')}" fill="none" stroke="#16a34a" stroke-width="2.5"/>` : '';
    el.innerHTML = resumoGlobal + `
      <div style="font-size:.72rem;font-weight:800;color:#888;text-transform:uppercase;margin-bottom:6px;border-top:1px solid #eee;padding-top:10px;">Neste período (${_fBR(r.inicio)} a ${_fBR(r.fim)})</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:12px;">
        ${kpi('📋', 'Viagens', r.totalViagens)}
        ${kpi('🟤', 'Terra', TC().fmt1(r.volTerra) + ' m³')}
        ${kpi('🧱', 'Entulho', TC().fmt1(r.volEntulho) + ' m³')}
        ${kpi('💰', 'Valor gasto', _fRS(r.totalCusto))}
        ${kpi('📅', 'Dias c/ registro', r.dias.length)}
      </div>
      <div style="overflow-x:auto;margin-bottom:6px;background:#fafafa;border-radius:8px;padding:10px;">
        <svg viewBox="0 0 ${Math.max(chartW, 100)} ${chartH + 6}" width="100%" style="max-width:${Math.max(chartW, 300)}px;height:${chartH + 6}px;display:block;">${bars}${linhaCusto}</svg>
      </div>
      <div style="font-size:.72rem;color:#888;margin-bottom:14px;">🟨 volume por dia (m³) · <span style="color:#16a34a;font-weight:700;">▬ custo acumulado</span> (${_fRS(r.totalCusto)} no total)</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-primario btn-sm" onclick="TerraRel.baixarPDF()">💾 Baixar PDF</button>
        <button class="btn btn-secundario btn-sm" onclick="TerraRel.compartilharPDF()">📤 Compartilhar</button>
      </div>`;
  }

  // ── PDF (idêntico ao que era gerado no Controle) ──
  async function _gerarPdfBlob() {
    if (typeof window.jspdf === 'undefined') {
      await _ls('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      await _ls('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const PW = doc.internal.pageSize.getWidth();
    const r = _rel;
    const g = _rel.global || {};
    const volEmpolado = TC().num(_ctx.volEmpolado);

    doc.setFillColor(13, 13, 13); doc.rect(0, 0, PW, 26, 'F');
    doc.setFillColor(245, 200, 0); doc.rect(0, 26, PW, 1.5, 'F');
    doc.setTextColor(255); doc.setFontSize(14); doc.setFont(undefined, 'bold');
    doc.text('Relatório de Terraplanagem — Controle de Período', 12, 11);
    doc.setFontSize(9); doc.setFont(undefined, 'normal'); doc.setTextColor(245, 200, 0);
    doc.text(_ctx.obraNome || '', 12, 18);
    doc.setTextColor(200);
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')} · Absoluta Engenharia`, 12, 23);
    let y = 34;

    // ── Resumo geral da obra (todo o histórico, não só o período) ──
    doc.setTextColor(13, 13, 13); doc.setFontSize(10); doc.setFont(undefined, 'bold');
    doc.text('Resumo geral da obra', 12, y);
    y += 6;
    const _linhaCards = (cards, altura) => {
      const gap = 4, cw = (PW - 24 - gap * (cards.length - 1)) / cards.length;
      cards.forEach((card, i) => {
        const x = 12 + i * (cw + gap);
        doc.setFillColor(250, 250, 250); doc.setDrawColor(229, 229, 229);
        doc.roundedRect(x, y, cw, altura, 1.8, 1.8, 'FD');
        doc.setTextColor(13, 13, 13); doc.setFontSize(card.menor ? 9 : 12.5); doc.setFont(undefined, 'bold');
        doc.text(card.v, x + cw / 2, y + 7.5, { align: 'center' });
        doc.setTextColor(120); doc.setFontSize(5.3); doc.setFont(undefined, 'normal');
        doc.text(card.l, x + cw / 2, y + 12.8, { align: 'center' });
      });
      y += altura + 4;
    };
    _linhaCards([
      { v: `${g.viagensAtual ?? 0}${g.viagensTotalEstimado != null ? ` / ${g.viagensTotalEstimado}` : ''}`, l: 'VIAGENS ATUAL / TOTAL', menor: true },
      { v: g.volTotalRetirada > 0 ? TC().fmt1(g.volTotalRetirada) : '—', l: 'VOL. TOTAL A RETIRAR (M³)' },
      { v: TC().fmt1(g.volExecutado || 0), l: 'VOL. EXECUTADO (M³)' },
      { v: g.volFaltando != null ? TC().fmt1(g.volFaltando) : '—', l: 'VOL. FALTANDO (M³)' },
      { v: _fRS(g.custoTotalGlobal || 0), l: 'VALOR GASTO', menor: true },
      { v: g.valorFaltando != null ? _fRS(g.valorFaltando) : '—', l: 'VALOR FALTANDO', menor: true },
    ], 17);
    _linhaCards([
      { v: g.volEmpolado > 0 ? TC().fmt1(g.volEmpolado) : '—', l: 'VOL. TERRA (PREVISTO, M³)' },
      { v: g.volEstacasEmpolado > 0 ? TC().fmt1(g.volEstacasEmpolado) : '—', l: 'VOL. FUNDAÇÃO PROFUNDA (M³)' },
      { v: g.volFundacaoSuperficialEmpolado > 0 ? TC().fmt1(g.volFundacaoSuperficialEmpolado) : '—', l: 'VOL. FUNDAÇÃO SUPERFICIAL (M³)' },
    ], 15);
    y += 4;

    doc.setTextColor(13, 13, 13); doc.setFontSize(10); doc.setFont(undefined, 'bold');
    doc.text(`Período: ${_fBR(r.inicio)} a ${_fBR(r.fim)}`, 12, y);
    y += 8;

    const cards = [
      { v: String(r.totalViagens), l: 'VIAGENS' },
      { v: TC().fmt1(r.volTerra), l: 'TERRA (M³)' },
      { v: TC().fmt1(r.volEntulho), l: 'ENTULHO (M³)' },
      { v: TC().fmt1(r.totalVolume), l: 'VOLUME TOTAL (M³)' },
      { v: _fRS(r.totalCusto), l: 'VALOR GASTO', menor: true },
      ...(volEmpolado > 0 ? [{ v: TC().fmt1((r.volTerra / volEmpolado) * 100) + '%', l: 'TERRA × PREVISTO' }] : [{ v: String(r.dias.length), l: 'DIAS C/ REGISTRO' }]),
    ];
    const gap = 4, cw = (PW - 24 - gap * (cards.length - 1)) / cards.length, ch = 17;
    cards.forEach((card, i) => {
      const x = 12 + i * (cw + gap);
      doc.setFillColor(250, 250, 250); doc.setDrawColor(229, 229, 229);
      doc.roundedRect(x, y, cw, ch, 1.8, 1.8, 'FD');
      doc.setTextColor(13, 13, 13); doc.setFontSize(card.menor ? 9.5 : 13); doc.setFont(undefined, 'bold');
      doc.text(card.v, x + cw / 2, y + 8, { align: 'center' });
      doc.setTextColor(120); doc.setFontSize(5.6); doc.setFont(undefined, 'normal');
      doc.text(card.l, x + cw / 2, y + 13.5, { align: 'center' });
    });
    y += ch + 8;

    if (r.dias.length) {
      doc.setTextColor(13, 13, 13); doc.setFontSize(9.5); doc.setFont(undefined, 'bold');
      doc.text('Volume por dia + custo acumulado', 12, y + 3);
      doc.setFontSize(6); doc.setFont(undefined, 'normal'); doc.setTextColor(100);
      doc.text('barras = volume (m³)', PW - 12, y, { align: 'right' });
      doc.setTextColor(22, 163, 74);
      doc.text('linha verde = R$ acumulado', PW - 12, y + 3, { align: 'right' });
      y += 7;
      const chartX = 12, chartW2 = PW - 24, chartYTop = y, chartH2 = 36;
      const maxVol = Math.max(...r.dias.map(d => d.volume), 1);
      const maxCustoAcum = Math.max(...r.dias.map(d => d.custoAcum), 1);
      doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.1);
      for (let g = 0; g <= 4; g++) {
        const gy = chartYTop + chartH2 - (g / 4) * chartH2;
        doc.line(chartX, gy, chartX + chartW2, gy);
      }
      const n = r.dias.length;
      const passoBarra = chartW2 / n;
      const barW2 = Math.max(0.8, passoBarra - 0.6);
      doc.setFillColor(245, 200, 0);
      r.dias.forEach((d, i) => {
        const h = (d.volume / maxVol) * chartH2;
        const x = chartX + i * passoBarra + 0.3;
        doc.rect(x, chartYTop + chartH2 - h, barW2, Math.max(0.3, h), 'F');
      });
      if (r.totalCusto > 0 && n > 1) {
        doc.setDrawColor(22, 163, 74); doc.setLineWidth(0.7);
        let px = null, py = null;
        r.dias.forEach((d, i) => {
          const lx = chartX + i * passoBarra + passoBarra / 2;
          const ly = chartYTop + chartH2 - (d.custoAcum / maxCustoAcum) * chartH2;
          if (px !== null) doc.line(px, py, lx, ly);
          px = lx; py = ly;
        });
        doc.setFontSize(6); doc.setTextColor(22, 163, 74); doc.setFont(undefined, 'bold');
        doc.text(_fRS(r.totalCusto), chartX + chartW2, chartYTop - 1.5, { align: 'right' });
        doc.setFont(undefined, 'normal');
      }
      doc.setDrawColor(150); doc.setLineWidth(0.2);
      doc.line(chartX, chartYTop + chartH2, chartX + chartW2, chartYTop + chartH2);
      doc.setFontSize(5.5); doc.setTextColor(100);
      const passoLabel = Math.max(1, Math.ceil(n / 8));
      r.dias.forEach((d, i) => {
        if (i % passoLabel !== 0 && i !== n - 1) return;
        const x = chartX + i * passoBarra + passoBarra / 2;
        doc.text(_fBR(d.data), x, chartYTop + chartH2 + 4, { align: 'center' });
      });
      y = chartYTop + chartH2 + 9;
    }

    if (y > 235) { doc.addPage(); y = 14; }
    doc.setTextColor(13, 13, 13); doc.setFontSize(9.5); doc.setFont(undefined, 'bold');
    doc.text('Volume por material', 12, y + 3);
    doc.autoTable({
      startY: y + 5,
      head: [['Material', 'Classificação', 'Viagens', 'Volume (m³)', '% do vol.', 'Custo (R$)', '% do custo']],
      body: r.porMaterial.map(g => [
        g.material,
        g.material === 'TERRA' ? 'Terraplanagem' : g.material === 'ENTULHO' ? 'Demolição (fora da terraplanagem)' : 'Fora da terraplanagem',
        String(g.viagens), TC().fmt1(g.volume),
        r.totalVolume > 0 ? TC().fmt1((g.volume / r.totalVolume) * 100) + '%' : '—',
        _fRS(g.custo),
        r.totalCusto > 0 ? TC().fmt1((g.custo / r.totalCusto) * 100) + '%' : '—',
      ]),
      margin: { left: 12, right: 12 },
      styles: { fontSize: 8, cellPadding: 1.8 },
      headStyles: { fillColor: [13, 13, 13], textColor: [245, 200, 0], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      columnStyles: { 2: { halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' }, 6: { halign: 'right' } },
    });
    y = doc.lastAutoTable.finalY + 8;

    if (y > 235) { doc.addPage(); y = 14; }
    doc.setTextColor(13, 13, 13); doc.setFontSize(9.5); doc.setFont(undefined, 'bold');
    doc.text('Volume por dia (detalhado)', 12, y + 3);
    let _volAccDia = 0;
    doc.autoTable({
      startY: y + 5,
      head: [['Data', 'Viagens', 'Volume (m³)', 'Vol. Acum. (m³)', '% Acum.', 'Custo (R$)', 'R$ Acumulado']],
      body: r.dias.map(d => {
        _volAccDia += d.volume;
        return [_fBR(d.data), String(d.viagens), TC().fmt1(d.volume), TC().fmt1(_volAccDia),
          r.totalVolume > 0 ? TC().fmt1((_volAccDia / r.totalVolume) * 100) + '%' : '—',
          _fRS(d.custo), _fRS(d.custoAcum)];
      }),
      margin: { left: 12, right: 12 },
      styles: { fontSize: 8, cellPadding: 1.8 },
      headStyles: { fillColor: [245, 200, 0], textColor: [13, 13, 13], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' }, 5: { halign: 'right' }, 6: { halign: 'right', fontStyle: 'bold' } },
    });
    y = doc.lastAutoTable.finalY + 8;

    if (y > 225) { doc.addPage(); y = 14; }
    doc.setTextColor(13, 13, 13); doc.setFontSize(9.5); doc.setFont(undefined, 'bold');
    doc.text(`Viagens do período (${r.lista.length})`, 12, y + 3);
    let _volAccV = 0, _custoAccV = 0;
    doc.autoTable({
      startY: y + 5,
      head: [['Canhoto', 'Data', 'Placa', 'Material', 'Volume (m³)', '% Acum.', 'Valor (R$)', 'R$ Acumulado']],
      body: r.lista.map(e => {
        _volAccV += TC().num(e.volume);
        _custoAccV += _valorViagem(e);
        return [e.nCanhoto || '—', _fBR(e.data), e.placa || '—', e.material || '—', TC().fmt1(e.volume),
          r.totalVolume > 0 ? TC().fmt1((_volAccV / r.totalVolume) * 100) + '%' : '—',
          _fRS(_valorViagem(e)), _fRS(_custoAccV)];
      }),
      foot: [[{ content: 'TOTAL', colSpan: 4, styles: { fontStyle: 'bold', halign: 'right' } }, { content: TC().fmt1(r.totalVolume), styles: { fontStyle: 'bold', halign: 'right' } }, { content: '100%', styles: { fontStyle: 'bold', halign: 'right' } }, { content: _fRS(r.totalCusto), styles: { fontStyle: 'bold', halign: 'right' } }, { content: '', styles: {} }]],
      margin: { left: 12, right: 12 },
      styles: { fontSize: 7, cellPadding: 1.3 },
      headStyles: { fillColor: [245, 200, 0], textColor: [13, 13, 13], fontStyle: 'bold' },
      footStyles: { fillColor: [255, 252, 240], textColor: [13, 13, 13] },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' }, 6: { halign: 'right' }, 7: { halign: 'right', fontStyle: 'bold' } },
    });
    y = doc.lastAutoTable.finalY + 8;

    if (y > 235) { doc.addPage(); y = 14; }
    doc.setTextColor(13, 13, 13); doc.setFontSize(9.5); doc.setFont(undefined, 'bold');
    doc.text('Volume por caminhão', 12, y + 3);
    doc.autoTable({
      startY: y + 5,
      head: [['Placa', 'Empresa', 'Viagens', 'Volume Total (m³)', '% do vol.', 'Custo (R$)', 'Média/Viagem (m³)']],
      body: r.caminhoesList.map(c => {
        const cam = (_ctx.caminhoes || []).find(x => x.placa === c.placa);
        return [c.placa, cam?.empresa || '—', String(c.viagens), TC().fmt1(c.volume),
          r.totalVolume > 0 ? TC().fmt1((c.volume / r.totalVolume) * 100) + '%' : '—',
          _fRS(c.custo), TC().fmt1(c.volume / c.viagens)];
      }),
      margin: { left: 12, right: 12 },
      styles: { fontSize: 8, cellPadding: 1.8 },
      headStyles: { fillColor: [13, 13, 13], textColor: [245, 200, 0], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      columnStyles: { 2: { halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' }, 6: { halign: 'right' } },
    });

    return doc.output('blob');
  }

  function _nomeArquivo() {
    const nomeObra = (_ctx.obraNome || 'obra').replace(/[^a-z0-9]/gi, '_');
    return `Relatorio_Terraplanagem_${nomeObra}_${_rel.inicio}_a_${_rel.fim}.pdf`;
  }

  async function baixarPDF() {
    if (!_rel) return;
    Utils.mostrarLoading('Gerando PDF...');
    try {
      const blob = await _gerarPdfBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = _nomeArquivo();
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      Utils.toast('✓ PDF gerado!', 'sucesso');
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao gerar PDF: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  async function compartilharPDF() {
    if (!_rel) return;
    Utils.mostrarLoading('Preparando PDF pra compartilhar...');
    try {
      const blob = await _gerarPdfBlob();
      const nome = _nomeArquivo();
      let compartilhado = false;
      try {
        const file = new File([blob], nome, { type: 'application/pdf' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          Utils.esconderLoading();
          await navigator.share({
            files: [file], title: 'Relatório de Terraplanagem',
            text: `📦 Relatório de Terraplanagem — ${_ctx.obraNome}\nPeríodo: ${_fBR(_rel.inicio)} a ${_fBR(_rel.fim)}\n${_rel.totalViagens} viagens · ${TC().fmt1(_rel.totalVolume)} m³ · ${_fRS(_rel.totalCusto)}`,
          });
          compartilhado = true;
        }
      } catch (eShare) {
        if (eShare.name === 'AbortError') { Utils.esconderLoading(); return; }
      }
      if (!compartilhado) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = nome;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
        Utils.toast('Esse navegador não compartilha arquivo direto — o PDF foi baixado, é só anexar no WhatsApp.', 'info');
      }
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao gerar PDF: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  return { abrir, gerar, baixarPDF, compartilharPDF };
})();
window.TerraRel = TerraRel;

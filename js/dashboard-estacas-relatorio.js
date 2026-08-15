// ============================================
// Dashboard — Relatório de Concretagem de Estacas (DashEstacasRel)
// Fluxo: escolher as DATAS de concretagem (uma, várias ou todas = total até
// agora) → relatório por dia: executado por tipo (Ø×L), tabela estaca × BT
// (NF/código quando houver) × volume calculado × volume real × índice de
// perda da estaca, totais do dia (qtde, ML, m³) → fecho com total de dias e
// resumo geral. Baixa em PDF com a prancha preenchida (só executadas).
// Dados: concretoConcretagens (data) → concretoBTs (numero/NF/código) →
// concretoLancamentos (pecaId, btConfigId, volume) → concretoPecas.
// ============================================
const DashEstacasRel = (() => {
  let _dados = null;      // { pecas, lancamentos, bts, concretagens, pranchas, marcadores }
  let _datasSel = new Set();
  let _modoTotal = false; // true = só resumo total, sem o dia a dia

  const _num = v => parseFloat(String(v ?? '').replace(',', '.')) || 0;
  const _fmt1 = v => Utils.formatarNumero(v, 1);
  const _fmt2 = v => Utils.formatarNumero(v, 2);
  const _fBR = iso => iso ? new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
  const _isEstaca = p => p.tipo === 'Fundação' && (p.subTipo === 'Estacas' || (!p.subTipo && _num(p.diametro) > 0 && _num(p.comprimento) > 0));
  const _tipoLabel = p => `Ø${_fmt1(_num(p.diametro))}cm × ${_fmt1(_num(p.comprimento))}m`;
  function _btLabel(bt) {
    if (!bt) return '—';
    let extras = [];
    if (bt.notaFiscal) extras.push('NF ' + bt.notaFiscal);
    if (bt.codigoBT) extras.push('cód. ' + bt.codigoBT);
    return `BT${bt.numero}${extras.length ? ' (' + extras.join(' · ') + ')' : ''}`;
  }

  // ---------- Abertura: carrega dados e mostra seleção de datas ----------
  async function abrir() {
    const obra = Router.getObra();
    if (!obra || !obra.id) return;
    try {
      Utils.mostrarLoading('Carregando dados de concretagem...');
      const obraId = obra.id;
      const [pecas, lancamentos, bts, concretagens, pranchas, marcadores] = await Promise.all([
        Database.listar(obraId, 'concretoPecas', null).catch(() => []),
        Database.listar(obraId, 'concretoLancamentos', null).catch(() => []),
        Database.listar(obraId, 'concretoBTs', null).catch(() => []),
        Database.listar(obraId, 'concretoConcretagens', null).catch(() => []),
        Database.listar(obraId, 'estacasPranchas', null).catch(() => []),
        Database.listar(obraId, 'estacasMarcadores', null).catch(() => []),
      ]);
      _dados = { obraId, obraNome: obra.nome || '', pecas, lancamentos, bts, concretagens, pranchas, marcadores };
      const dias = _diasComConcretagem();
      if (!dias.length) {
        Utils.esconderLoading();
        Utils.toast('Nenhuma concretagem de estacas lançada ainda.', 'alerta');
        return;
      }
      _datasSel = new Set(dias.map(d => d.data)); // padrão: total até agora
      Utils.esconderLoading();
      _renderSelecao(dias);
    } catch (e) {
      console.error(e);
      Utils.esconderLoading();
      Utils.toast('Erro ao carregar dados do relatório.', 'erro');
    }
  }

  // Dias (datas de concretagem) que têm lançamento em peça de ESTACA.
  function _diasComConcretagem() {
    const pecaPorId = new Map(_dados.pecas.map(p => [p.id, p]));
    const concPorId = new Map(_dados.concretagens.map(c => [c.id, c]));
    const porData = new Map(); // data -> { qtdLans }
    _dados.lancamentos.forEach(l => {
      const p = pecaPorId.get(l.pecaId);
      if (!p || !_isEstaca(p)) return;
      const conc = concPorId.get(l.concretagemId);
      const data = conc?.data || 'sem-data';
      porData.set(data, (porData.get(data) || 0) + 1);
    });
    return [...porData.entries()]
      .map(([data, qtd]) => ({ data, qtd }))
      .sort((a, b) => a.data.localeCompare(b.data));
  }

  function _renderSelecao(dias) {
    let overlay = document.getElementById('db-estrel-overlay');
    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.id = 'db-estrel-overlay';
    overlay.className = 'db-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
      <div class="db-overlay-card" style="max-width:460px;">
        <div class="db-overlay-titulo">📄 Relatório de Concretagem — Estacas</div>
        <div class="db-overlay-sub">Escolha as datas (uma ou mais). Todas marcadas = relatório total até agora.</div>
        <div style="display:flex;gap:6px;margin-bottom:10px;">
          <button class="btn btn-secundario btn-sm" onclick="DashEstacasRel.selTodas(true)">Marcar todas</button>
          <button class="btn btn-secundario btn-sm" onclick="DashEstacasRel.selTodas(false)">Desmarcar todas</button>
        </div>
        <div id="db-estrel-datas" style="display:flex;flex-direction:column;gap:2px;max-height:300px;overflow-y:auto;border:1px solid var(--cor-borda-light);border-radius:8px;padding:8px;">
          ${dias.map(d => `
            <label style="display:flex;align-items:center;gap:8px;font-size:.84rem;padding:5px 4px;cursor:pointer;border-radius:6px;" onmouseover="this.style.background='#f7f7f7'" onmouseout="this.style.background='transparent'">
              <input type="checkbox" value="${d.data}" checked onchange="DashEstacasRel.selData(this.value, this.checked)">
              <b>${_fBR(d.data)}</b>
              <span class="text-sm text-muted">${d.qtd} lançamento${d.qtd > 1 ? 's' : ''}</span>
            </label>`).join('')}
        </div>
        <div style="margin-top:12px;border-top:1px solid var(--cor-borda-light);padding-top:10px;">
          <div style="font-size:.78rem;font-weight:700;margin-bottom:6px;">Formato do relatório</div>
          <label style="display:flex;align-items:center;gap:8px;font-size:.82rem;padding:3px 0;cursor:pointer;">
            <input type="radio" name="db-estrel-modo" value="dias" checked onchange="DashEstacasRel.setModo(false)"> Dia a dia + resumo total
          </label>
          <label style="display:flex;align-items:center;gap:8px;font-size:.82rem;padding:3px 0;cursor:pointer;">
            <input type="radio" name="db-estrel-modo" value="total" onchange="DashEstacasRel.setModo(true)"> Só o resumo total (sem separar por dia)
          </label>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;">
          <button class="btn btn-secundario btn-sm" onclick="document.getElementById('db-estrel-overlay').remove()">Cancelar</button>
          <button class="btn btn-primario btn-sm" onclick="DashEstacasRel.gerar()">Gerar relatório</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  }
  function selData(data, marcado) { if (marcado) _datasSel.add(data); else _datasSel.delete(data); }
  function setModo(total) { _modoTotal = !!total; }
  function selTodas(marcar) {
    document.querySelectorAll('#db-estrel-datas input[type=checkbox]').forEach(ch => {
      ch.checked = marcar;
      selData(ch.value, marcar);
    });
  }

  // ---------- Montagem dos dados do relatório ----------
  function _montar() {
    const pecaPorId = new Map(_dados.pecas.map(p => [p.id, p]));
    const concPorId = new Map(_dados.concretagens.map(c => [c.id, c]));
    const btPorId = new Map(_dados.bts.map(b => [b.id, b]));

    // ---- Perda por estaca ALINHADA à fórmula do Controle de Estacas
    // (V3.5.1.3): cocho/linha se perde antes de chegar na peça (desconta do
    // que chegou), perda de solo = usado − projeto, e soma perda de obra +
    // sobra de caminhão. Como essas perdas são POR BT (e uma BT pode servir
    // várias estacas), aqui elas são RATEADAS proporcionalmente ao volume
    // que cada estaca tirou da BT — somando as estacas, bate com o índice
    // por concretagem do Controle.
    const volTotalPorBT = new Map(); // btConfigId -> Σ volume de todos os lançamentos de estaca daquela BT
    _dados.lancamentos.forEach(l => {
      const p = pecaPorId.get(l.pecaId);
      if (!p || !_isEstaca(p)) return;
      volTotalPorBT.set(l.btConfigId, (volTotalPorBT.get(l.btConfigId) || 0) + _num(l.volume));
    });
    function _perdaEstaca(lans, volCalc) {
      let usoNominal = 0, cocho = 0, obra = 0, sobra = 0;
      lans.forEach(l => {
        const v = _num(l.volume);
        usoNominal += v;
        const totBT = volTotalPorBT.get(l.btConfigId) || 0;
        const frac = totBT > 0 ? v / totBT : 0;
        cocho += _num(l.perdaCocho) * frac;
        obra += _num(l.perdaObra) * frac;
        sobra += _num(l.sobraCaminhao) * frac;
      });
      const usado = usoNominal - cocho;
      const perdaSolo = Math.max(0, usado - volCalc);
      const perdaVol = perdaSolo + obra + sobra;
      return { perdaVol, indice: volCalc > 0 ? (perdaVol / volCalc) * 100 : null };
    }

    // Lançamentos de estacas dentro das datas escolhidas, agrupados por dia.
    const porDia = new Map(); // data -> Map(pecaId -> { peca, lans: [] })
    _dados.lancamentos.forEach(l => {
      const p = pecaPorId.get(l.pecaId);
      if (!p || !_isEstaca(p)) return;
      const data = concPorId.get(l.concretagemId)?.data || 'sem-data';
      if (!_datasSel.has(data)) return;
      if (!porDia.has(data)) porDia.set(data, new Map());
      const mapa = porDia.get(data);
      if (!mapa.has(p.id)) mapa.set(p.id, { peca: p, lans: [] });
      mapa.get(p.id).lans.push(l);
    });

    const dias = [...porDia.keys()].sort().map(data => {
      const estacas = [...porDia.get(data).values()].map(({ peca, lans }) => {
        const volReal = lans.reduce((s, l) => s + _num(l.volume), 0);
        const volCalc = _num(peca.volume);
        const btsDaEstaca = [...new Set(lans.map(l => l.btConfigId))].map(id => btPorId.get(id)).filter(Boolean)
          .sort((a, b) => (a.numero || 0) - (b.numero || 0));
        const p2 = _perdaEstaca(lans, volCalc);
        const concNums = [...new Set(lans.map(l => concPorId.get(l.concretagemId)?.numero).filter(n => n != null))];
        return { peca, volCalc, volReal, perda: p2.indice, perdaVol: p2.perdaVol, lans, bts: btsDaEstaca, comprimento: _num(peca.comprimento), concNums };
      });
      // Ordem de execução = ordem das BTs (BT1,BT2,BT3 → próxima BT3,BT4,BT5),
      // não alfabética pelo nome da estaca.
      const _minBT = e => e.bts.length ? Math.min(...e.bts.map(b => b.numero || 9e9)) : 9e9;
      estacas.sort((a, b) => _minBT(a) - _minBT(b) || (a.peca.nome || '').localeCompare(b.peca.nome || '', 'pt-BR', { numeric: true }));

      // Executado por tipo no dia
      const porTipo = new Map();
      estacas.forEach(e => {
        const t = _tipoLabel(e.peca);
        if (!porTipo.has(t)) porTipo.set(t, { qtd: 0, volCalc: 0, volReal: 0, ml: 0 });
        const g = porTipo.get(t);
        g.qtd++; g.volCalc += e.volCalc; g.volReal += e.volReal; g.ml += e.comprimento;
      });

      return {
        data,
        estacas,
        porTipo: [...porTipo.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR', { numeric: true })),
        totQtd: estacas.length,
        totMl: estacas.reduce((s, e) => s + e.comprimento, 0),
        totM3: estacas.reduce((s, e) => s + e.volReal, 0),
        totCalc: estacas.reduce((s, e) => s + e.volCalc, 0),
        totPerdaVol: estacas.reduce((s, e) => s + (e.perdaVol || 0), 0),
      };
    });

    // Resumo total (estacas ÚNICAS — se uma estaca aparece em 2 dias, conta 1)
    const unicas = new Map(); // pecaId -> { peca, volCalc, volReal, comprimento, bts:Set, concNums:Set }
    dias.forEach(d => d.estacas.forEach(e => {
      if (!unicas.has(e.peca.id)) unicas.set(e.peca.id, { peca: e.peca, volCalc: e.volCalc, volReal: 0, comprimento: e.comprimento, bts: new Map(), concNums: new Set(), lans: [] });
      const u = unicas.get(e.peca.id);
      u.volReal += e.volReal;
      u.lans = u.lans.concat(e.lans || []);
      e.bts.forEach(b => u.bts.set(b.id, b));
      (e.concNums || []).forEach(n => u.concNums.add(n));
    }));
    const consolidadas = [...unicas.values()].map(u => {
      const p2 = _perdaEstaca(u.lans, u.volCalc);
      return {
        peca: u.peca, volCalc: u.volCalc, volReal: u.volReal, comprimento: u.comprimento,
        bts: [...u.bts.values()].sort((a, b) => (a.numero || 0) - (b.numero || 0)),
        concNums: [...u.concNums].sort((a, b) => a - b),
        perda: p2.indice, perdaVol: p2.perdaVol,
      };
    });
    // Consolidado: 1º pela ordem da CONCRETAGEM, depois pela ordem das BTs.
    const _minBTc = e => e.bts.length ? Math.min(...e.bts.map(b => b.numero || 9e9)) : 9e9;
    const _minConc = e => e.concNums.length ? Math.min(...e.concNums) : 9e9;
    consolidadas.sort((a, b) => _minConc(a) - _minConc(b) || _minBTc(a) - _minBTc(b) || (a.peca.nome || '').localeCompare(b.peca.nome || '', 'pt-BR', { numeric: true }));
    const totalPorTipo = new Map();
    consolidadas.forEach(e => {
      const t = _tipoLabel(e.peca);
      if (!totalPorTipo.has(t)) totalPorTipo.set(t, { qtd: 0, volCalc: 0, volReal: 0, ml: 0, perdaVol: 0 });
      const g = totalPorTipo.get(t);
      g.qtd++; g.volCalc += e.volCalc; g.volReal += e.volReal; g.ml += e.comprimento; g.perdaVol += (e.perdaVol || 0);
    });
    const totCalc = consolidadas.reduce((s, e) => s + e.volCalc, 0);
    const totReal = consolidadas.reduce((s, e) => s + e.volReal, 0);
    const totPerdaVol = consolidadas.reduce((s, e) => s + (e.perdaVol || 0), 0);

    const datasOrd = dias.map(d => d.data).sort();
    return {
      dias,
      consolidadas,
      periodo: datasOrd.length ? { de: datasOrd[0], ate: datasOrd[datasOrd.length - 1] } : null,
      total: {
        dias: dias.length,
        qtd: unicas.size,
        ml: [...unicas.values()].reduce((s, e) => s + e.comprimento, 0),
        m3: totReal,
        volCalc: totCalc,
        perdaVol: totPerdaVol,
        perdaMedia: totCalc > 0 ? (totPerdaVol / totCalc) * 100 : null,
        porTipo: [...totalPorTipo.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR', { numeric: true })),
      },
    };
  }

  function _perdaHtml(perda) {
    if (perda == null) return '<span class="text-muted">—</span>';
    const cor = perda > 10 ? '#dc2626' : perda > 0 ? '#a16207' : '#15803d';
    return `<span style="color:${cor};font-weight:700;">${_fmt1(perda)}%</span>`;
  }

  // ---------- Prévia ----------
  function gerar() {
    if (!_datasSel.size) { Utils.toast('Escolha pelo menos uma data.', 'alerta'); return; }
    const sel = document.getElementById('db-estrel-overlay');
    if (sel) sel.remove();
    const rel = _montar();
    if (!rel.dias.length) { Utils.toast('Nenhum lançamento de estaca nas datas escolhidas.', 'alerta'); return; }
    _relatorio = rel;

    const diasHtml = _modoTotal ? '' : rel.dias.map(d => `
      <div style="margin-bottom:22px;">
        <div style="background:var(--cor-dark-900);color:#fff;border-radius:8px;padding:8px 14px;font-weight:800;display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;">
          <span>📅 ${_fBR(d.data)}</span>
          <span style="font-family:var(--font-mono);font-weight:600;font-size:.82rem;">${d.totQtd} estaca${d.totQtd > 1 ? 's' : ''} · ${_fmt1(d.totMl)} ml · ${_fmt2(d.totM3)} m³</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0;">
          ${d.porTipo.map(([t, g]) => `<span class="db-chip">${t}: <b>${g.qtd}</b> un · ${_fmt1(g.ml)} ml · ${_fmt2(g.volReal)} m³</span>`).join('')}
        </div>
        <div style="overflow-x:auto;">
          <table class="db-tabela-clean">
            <thead><tr>
              <th style="text-align:left;">Estaca</th><th style="text-align:left;">Tipo</th><th style="text-align:left;">BT(s)</th>
              <th>Vol. Calculado (m³)</th><th>Vol. Real (m³)</th><th>Índice de Perda</th>
            </tr></thead>
            <tbody>
              ${d.estacas.map(e => `<tr>
                <td style="text-align:left;font-weight:700;">${DashCore.esc(e.peca.nome || '—')}</td>
                <td style="text-align:left;">${_tipoLabel(e.peca)}</td>
                <td style="text-align:left;">${e.bts.map(_btLabel).join(', ') || '—'}</td>
                <td>${_fmt2(e.volCalc)}</td>
                <td>${_fmt2(e.volReal)}</td>
                <td>${_perdaHtml(e.perda)}</td>
              </tr>`).join('')}
              <tr style="background:var(--cor-primaria-ultra-light);font-weight:800;">
                <td style="text-align:left;" colspan="3">TOTAL DO DIA — ${d.totQtd} estaca${d.totQtd > 1 ? 's' : ''} · ${_fmt1(d.totMl)} ml</td>
                <td>${_fmt2(d.totCalc)}</td>
                <td>${_fmt2(d.totM3)}</td>
                <td>${_perdaHtml(d.totCalc > 0 ? (d.totPerdaVol / d.totCalc) * 100 : null)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>`).join('');

    const consolidadoHtml = `
      <div style="overflow-x:auto;margin-bottom:14px;">
        <table class="db-tabela-clean">
          <thead><tr>
            <th style="text-align:left;">Estaca</th><th style="text-align:left;">Tipo</th><th>Concretagem Nº</th><th style="text-align:left;">BT(s)</th>
            <th>Vol. Calculado (m³)</th><th>Vol. Real (m³)</th><th>Índice de Perda</th>
          </tr></thead>
          <tbody>
            ${rel.consolidadas.map(e => `<tr>
              <td style="text-align:left;font-weight:700;">${DashCore.esc(e.peca.nome || '—')}</td>
              <td style="text-align:left;">${_tipoLabel(e.peca)}</td>
              <td>${e.concNums.join(', ') || '—'}</td>
              <td style="text-align:left;">${e.bts.map(_btLabel).join(', ') || '—'}</td>
              <td>${_fmt2(e.volCalc)}</td>
              <td>${_fmt2(e.volReal)}</td>
              <td>${_perdaHtml(e.perda)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

    const t = rel.total;
    const totalHtml = `
      <div style="border-top:3px solid var(--cor-primaria);margin-top:6px;padding-top:12px;">
        <div style="font-weight:800;font-size:.95rem;margin-bottom:2px;">RESUMO TOTAL — ${t.dias} dia${t.dias > 1 ? 's' : ''} de concretagem</div>
        <div class="text-sm text-muted" style="margin-bottom:8px;">${rel.periodo ? 'Período: ' + _fBR(rel.periodo.de) + (rel.periodo.ate !== rel.periodo.de ? ' a ' + _fBR(rel.periodo.ate) : '') : ''}</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(125px,1fr));gap:10px;margin-bottom:10px;">
          <div class="db-metrica-card"><div class="db-metrica-valor">${t.qtd}</div><div class="db-metrica-label">Estacas executadas</div></div>
          <div class="db-metrica-card"><div class="db-metrica-valor">${_fmt1(t.ml)}</div><div class="db-metrica-label">ML executado</div></div>
          <div class="db-metrica-card"><div class="db-metrica-valor">${_fmt2(t.m3)}</div><div class="db-metrica-label">m³ real utilizado</div></div>
          <div class="db-metrica-card"><div class="db-metrica-valor">${_fmt2(t.volCalc)}</div><div class="db-metrica-label">m³ calculado</div></div>
          <div class="db-metrica-card"><div class="db-metrica-valor">${_fmt2(t.perdaVol)}</div><div class="db-metrica-label">Perda (m³)</div></div>
          <div class="db-metrica-card"><div class="db-metrica-valor" style="color:${t.perdaMedia != null && t.perdaMedia > 10 ? '#dc2626' : '#15803d'};">${t.perdaMedia != null ? _fmt1(t.perdaMedia) + '%' : '—'}</div><div class="db-metrica-label">Índice de perda</div></div>
          <div class="db-metrica-card"><div class="db-metrica-valor">${t.qtd ? _fmt2(t.m3 / t.qtd) : '—'}</div><div class="db-metrica-label">Consumo médio/estaca (m³)</div></div>
          <div class="db-metrica-card"><div class="db-metrica-valor">${t.dias ? _fmt1(t.qtd / t.dias) : '—'}</div><div class="db-metrica-label">Média estacas/dia</div></div>
        </div>
        <div style="overflow-x:auto;margin-bottom:12px;">
          <table class="db-tabela-clean">
            <thead><tr>
              <th style="text-align:left;">Tipo (Ø × comprimento)</th><th>Qtd</th><th>ML</th><th>m³ real</th><th>m³ calculado</th><th>Consumo médio (m³)</th><th>Perda</th>
            </tr></thead>
            <tbody>
              ${t.porTipo.map(([tipo, g]) => `<tr>
                <td style="text-align:left;">${tipo}</td><td>${g.qtd}</td><td>${_fmt1(g.ml)}</td><td>${_fmt2(g.volReal)}</td><td>${_fmt2(g.volCalc)}</td>
                <td>${g.qtd ? _fmt2(g.volReal / g.qtd) : '—'}</td>
                <td>${_perdaHtml(g.volCalc > 0 ? (g.perdaVol / g.volCalc) * 100 : null)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div style="font-weight:700;font-size:.85rem;margin-bottom:6px;">Estacas executadas — consolidado (${t.qtd})</div>
        ${consolidadoHtml}
      </div>`;

    let overlay = document.createElement('div');
    overlay.id = 'db-estrel-view';
    overlay.className = 'db-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
      <div class="db-overlay-card" style="max-width:900px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px;">
          <div>
            <div class="db-overlay-titulo" style="margin-bottom:0;">Relatório de Concretagem — Estacas</div>
            <div class="db-overlay-sub" style="margin-bottom:0;">${DashCore.esc(_dados.obraNome)} · gerado em ${new Date().toLocaleString('pt-BR')}</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn btn-primario btn-sm" onclick="DashEstacasRel.baixarPDF()">⬇ Baixar PDF</button>
            <button class="btn btn-secundario btn-sm" onclick="DashEstacasRel.copiarWhatsApp()">📱 Copiar p/ WhatsApp</button>
            <button class="btn btn-secundario btn-sm" onclick="document.getElementById('db-estrel-view').remove()">✕ Fechar</button>
          </div>
        </div>
        ${diasHtml}
        ${totalHtml}
      </div>`;
    document.body.appendChild(overlay);
  }


  // ---------- Texto pra WhatsApp ----------
  function copiarWhatsApp() {
    if (!_relatorio) return;
    const rel = _relatorio;
    const t = rel.total;
    const L = [];
    L.push('*RELATÓRIO DE CONCRETAGEM — ESTACAS*');
    L.push('🏗 ' + (_dados.obraNome || 'Obra'));
    if (rel.periodo) L.push('📅 Período: ' + _fBR(rel.periodo.de) + (rel.periodo.ate !== rel.periodo.de ? ' a ' + _fBR(rel.periodo.ate) : '') + ` (${t.dias} dia${t.dias > 1 ? 's' : ''})`);
    L.push('');
    if (!_modoTotal) {
      rel.dias.forEach(d => {
        L.push(`*📅 ${_fBR(d.data)} — ${d.totQtd} estaca${d.totQtd > 1 ? 's' : ''} · ${_fmt1(d.totMl)} ml · ${_fmt2(d.totM3)} m³*`);
        d.porTipo.forEach(([tipo, g]) => L.push(`${tipo}: ${g.qtd} un · ${_fmt1(g.ml)} ml · ${_fmt2(g.volReal)} m³`));
        d.estacas.forEach(e => {
          L.push(`• ${e.peca.nome || '—'} — ${e.bts.map(_btLabel).join(', ') || 'sem BT'} — ${_fmt2(e.volCalc)}/${_fmt2(e.volReal)} m³ — perda ${e.perda != null ? _fmt1(e.perda) + '%' : '—'}`);
        });
        L.push('');
      });
    } else {
      rel.consolidadas.forEach(e => {
        L.push(`• ${e.peca.nome || '—'} (Conc. ${e.concNums.join('/') || '—'}) — ${e.bts.map(_btLabel).join(', ') || 'sem BT'} — ${_fmt2(e.volCalc)}/${_fmt2(e.volReal)} m³ — perda ${e.perda != null ? _fmt1(e.perda) + '%' : '—'}`);
      });
      L.push('');
    }
    L.push(`*RESUMO TOTAL (${t.dias} dia${t.dias > 1 ? 's' : ''})*`);
    L.push(`🔩 Estacas executadas: ${t.qtd}`);
    L.push(`📏 ML executado: ${_fmt1(t.ml)}`);
    L.push(`🧱 m³ real utilizado: ${_fmt2(t.m3)}`);
    L.push(`📐 m³ calculado: ${_fmt2(t.volCalc)}`);
    L.push(`⚠️ Índice de perda: ${t.perdaMedia != null ? _fmt1(t.perdaMedia) + '%' : '—'}`);
    L.push('');
    L.push('*Por tipo:*');
    t.porTipo.forEach(([tipo, g]) => L.push(`• ${tipo}: ${g.qtd} un · ${_fmt1(g.ml)} ml · ${_fmt2(g.volReal)} m³`));
    const texto = L.join('\n');
    const done = () => Utils.toast('Texto copiado — é só colar no WhatsApp.', 'sucesso');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(done).catch(() => { _copiarFallback(texto); done(); });
    } else { _copiarFallback(texto); done(); }
  }
  function _copiarFallback(texto) {
    const ta = document.createElement('textarea');
    ta.value = texto;
    ta.style.cssText = 'position:fixed;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }

  // ---------- PDF ----------
  let _relatorio = null;
  function _ls(src) { return new Promise((r, j) => { const s = document.createElement('script'); s.src = src; s.onload = r; s.onerror = j; document.head.appendChild(s); }); }

  async function baixarPDF() {
    if (!_relatorio) return;
    try {
      Utils.mostrarLoading('Gerando PDF...');
      if (!window.jspdf) {
        await _ls('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
        await _ls('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
      }
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const PW = doc.internal.pageSize.getWidth();
      const rel = _relatorio;
      const t = rel.total;
      const cinza = [107, 114, 128];

      // Capa/cabeçalho
      doc.setFillColor(13, 13, 13); doc.rect(0, 0, PW, 26, 'F');
      doc.setFillColor(245, 200, 0); doc.rect(0, 26, PW, 1.5, 'F');
      doc.setTextColor(255); doc.setFontSize(14); doc.setFont(undefined, 'bold');
      doc.text('Relatório de Concretagem — Estacas', 12, 11);
      doc.setFontSize(9); doc.setFont(undefined, 'normal'); doc.setTextColor(245, 200, 0);
      doc.text(_dados.obraNome || '', 12, 18);
      doc.setTextColor(200);
      doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')} · Absoluta Engenharia`, 12, 23);
      let y = 34;

      // Prancha(s) preenchida(s) — só executadas
      y = await _pdfPranchas(doc, y, PW);

      // Dias (pulados no modo "só resumo total")
      for (const d of (_modoTotal ? [] : rel.dias)) {
        if (y > 250) { doc.addPage(); y = 14; }
        doc.setFillColor(13, 13, 13);
        doc.roundedRect(12, y, PW - 24, 8, 1.5, 1.5, 'F');
        doc.setTextColor(255); doc.setFontSize(10); doc.setFont(undefined, 'bold');
        doc.text(`${_fBR(d.data)}`, 15, y + 5.5);
        doc.setFont(undefined, 'normal'); doc.setFontSize(8.5);
        doc.text(`${d.totQtd} estaca(s)  ·  ${_fmt1(d.totMl)} ml  ·  ${_fmt2(d.totM3)} m³`, PW - 15, y + 5.5, { align: 'right' });
        y += 11;

        doc.setTextColor(60); doc.setFontSize(8);
        const tiposTxt = d.porTipo.map(([tipo, g]) => `${tipo}: ${g.qtd} un · ${_fmt1(g.ml)} ml · ${_fmt2(g.volReal)} m³`).join('     ');
        doc.text(doc.splitTextToSize('Executado por tipo:  ' + tiposTxt, PW - 26), 13, y);
        y += 4 + 3.5 * Math.ceil(doc.getTextWidth('Executado por tipo:  ' + tiposTxt) / (PW - 26));

        doc.autoTable({
          startY: y,
          head: [['Estaca', 'Tipo', 'BT(s)', 'Vol. Calc. (m³)', 'Vol. Real (m³)', 'Perda']],
          body: [
            ...d.estacas.map(e => [
              e.peca.nome || '—', _tipoLabel(e.peca), e.bts.map(_btLabel).join(', ') || '—',
              _fmt2(e.volCalc), _fmt2(e.volReal), e.perda != null ? _fmt1(e.perda) + '%' : '—',
            ]),
            [{ content: `TOTAL DO DIA — ${d.totQtd} estaca(s) · ${_fmt1(d.totMl)} ml`, colSpan: 3, styles: { fontStyle: 'bold', fillColor: [255, 252, 240] } },
              { content: _fmt2(d.totCalc), styles: { fontStyle: 'bold', fillColor: [255, 252, 240] } },
              { content: _fmt2(d.totM3), styles: { fontStyle: 'bold', fillColor: [255, 252, 240] } },
              { content: d.totCalc > 0 ? _fmt1((d.totPerdaVol / d.totCalc) * 100) + '%' : '—', styles: { fontStyle: 'bold', fillColor: [255, 252, 240] } }],
          ],
          margin: { left: 12, right: 12 },
          styles: { fontSize: 7.5, cellPadding: 1.6 },
          headStyles: { fillColor: [245, 200, 0], textColor: [13, 13, 13], fontStyle: 'bold' },
          columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
          didParseCell: (data) => {
            const alinhaDia = { 3: 'right', 4: 'right', 5: 'right' };
            if (data.section === 'head' && alinhaDia[data.column.index]) data.cell.styles.halign = alinhaDia[data.column.index];
            if (data.section === 'body' && data.column.index === 5 && String(data.cell.raw).includes('%')) {
              const v = parseFloat(String(data.cell.raw).replace('.', '').replace(',', '.'));
              if (!isNaN(v)) data.cell.styles.textColor = v > 10 ? [220, 38, 38] : v > 0 ? [161, 98, 7] : [21, 128, 61];
            }
          },
        });
        y = doc.lastAutoTable.finalY + 8;
      }

      // ===== RESUMO TOTAL (redesenhado) =====
      if (y > 195) { doc.addPage(); y = 14; }
      // Banner
      doc.setFillColor(13, 13, 13);
      doc.roundedRect(12, y, PW - 24, 14, 2, 2, 'F');
      doc.setFillColor(245, 200, 0); doc.rect(12, y + 14, PW - 24, 1.2, 'F');
      doc.setTextColor(245, 200, 0); doc.setFontSize(12); doc.setFont(undefined, 'bold');
      doc.text('RESUMO TOTAL', 16, y + 6.5);
      doc.setTextColor(255); doc.setFontSize(8); doc.setFont(undefined, 'normal');
      const periodoTxt = rel.periodo ? `Período: ${_fBR(rel.periodo.de)}${rel.periodo.ate !== rel.periodo.de ? ' a ' + _fBR(rel.periodo.ate) : ''}  ·  ${t.dias} dia(s) de concretagem` : `${t.dias} dia(s) de concretagem`;
      doc.text(periodoTxt, 16, y + 11.5);
      y += 20;

      // Cards de métricas (desenhados, não tabela)
      const cards = [
        { v: String(t.qtd), l: 'ESTACAS' },
        { v: _fmt1(t.ml), l: 'ML EXECUTADO' },
        { v: _fmt2(t.m3), l: 'M³ REAL' },
        { v: _fmt2(t.volCalc), l: 'M³ CALCULADO' },
        { v: _fmt2(t.perdaVol), l: 'PERDA (M³)', perda: t.perdaMedia },
        { v: t.perdaMedia != null ? _fmt1(t.perdaMedia) + '%' : '—', l: 'ÍNDICE DE PERDA', perda: t.perdaMedia },
        { v: t.qtd ? _fmt2(t.m3 / t.qtd) : '—', l: 'CONSUMO MÉDIO (M³)' },
      ];
      const gap = 4, cw = (PW - 24 - gap * (cards.length - 1)) / cards.length, ch = 17;
      cards.forEach((card, i) => {
        const x = 12 + i * (cw + gap);
        doc.setFillColor(250, 250, 250);
        doc.setDrawColor(229, 229, 229);
        doc.roundedRect(x, y, cw, ch, 1.8, 1.8, 'FD');
        const corV = card.perda != null && card.perda !== undefined
          ? (card.perda > 10 ? [220, 38, 38] : card.perda > 0 ? [161, 98, 7] : [21, 128, 61])
          : [13, 13, 13];
        doc.setTextColor(corV[0], corV[1], corV[2]);
        doc.setFontSize(13); doc.setFont(undefined, 'bold');
        doc.text(card.v, x + cw / 2, y + 8, { align: 'center' });
        doc.setTextColor(120); doc.setFontSize(5.6); doc.setFont(undefined, 'normal');
        doc.text(card.l, x + cw / 2, y + 13.5, { align: 'center' });
      });
      y += ch + 6;

      // Tabela por tipo (com perda por tipo)
      doc.setTextColor(13, 13, 13); doc.setFontSize(9.5); doc.setFont(undefined, 'bold');
      doc.text('Executado por tipo', 12, y + 3);
      const alinhaTipo = { 1: 'center', 2: 'right', 3: 'right', 4: 'right', 5: 'right', 6: 'right' };
      doc.autoTable({
        startY: y + 5,
        head: [['Tipo (Ø × comprimento)', 'Qtd', 'ML', 'm³ real', 'm³ calculado', 'Consumo médio (m³)', 'Perda']],
        body: t.porTipo.map(([tipo, g]) => [tipo, String(g.qtd), _fmt1(g.ml), _fmt2(g.volReal), _fmt2(g.volCalc),
          g.qtd ? _fmt2(g.volReal / g.qtd) : '—',
          g.volCalc > 0 ? _fmt1((g.perdaVol / g.volCalc) * 100) + '%' : '—']),
        margin: { left: 12, right: 12 },
        styles: { fontSize: 8.5, cellPadding: 2.2 },
        headStyles: { fillColor: [245, 200, 0], textColor: [13, 13, 13], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right', fontStyle: 'bold' } },
        didParseCell: (data) => {
          // Cabeçalho alinhado igual à coluna — número descolado do título
          // dava impressão de "não pertencer" à coluna.
          if (data.section === 'head' && alinhaTipo[data.column.index]) data.cell.styles.halign = alinhaTipo[data.column.index];
          if (data.section === 'body' && data.column.index === 6 && String(data.cell.raw).includes('%')) {
            const v = parseFloat(String(data.cell.raw).replace('.', '').replace(',', '.'));
            if (!isNaN(v)) data.cell.styles.textColor = v > 10 ? [220, 38, 38] : v > 0 ? [161, 98, 7] : [21, 128, 61];
          }
        },
      });
      y = doc.lastAutoTable.finalY + 7;

      // Tabela consolidada de todas as estacas — SEMPRE no resumo total.
      {
        if (y > 240) { doc.addPage(); y = 14; }
        doc.setTextColor(13, 13, 13); doc.setFontSize(9.5); doc.setFont(undefined, 'bold');
        doc.text('Estacas executadas (consolidado)', 12, y + 3);
        doc.autoTable({
          startY: y + 5,
          head: [['Estaca', 'Tipo', 'Conc. Nº', 'BT(s)', 'Vol. Calc. (m³)', 'Vol. Real (m³)', 'Perda']],
          body: rel.consolidadas.map(e => [
            e.peca.nome || '—', _tipoLabel(e.peca), e.concNums.join(', ') || '—', e.bts.map(_btLabel).join(', ') || '—',
            _fmt2(e.volCalc), _fmt2(e.volReal), e.perda != null ? _fmt1(e.perda) + '%' : '—',
          ]),
          margin: { left: 12, right: 12 },
          styles: { fontSize: 7.5, cellPadding: 1.6 },
          headStyles: { fillColor: [13, 13, 13], textColor: [245, 200, 0], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [250, 250, 250] },
          columnStyles: { 2: { halign: 'center' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right', fontStyle: 'bold' } },
          didParseCell: (data) => {
            const alinhaCons = { 2: 'center', 4: 'right', 5: 'right', 6: 'right' };
            if (data.section === 'head' && alinhaCons[data.column.index]) data.cell.styles.halign = alinhaCons[data.column.index];
            if (data.section === 'body' && data.column.index === 6 && String(data.cell.raw).includes('%')) {
              const v = parseFloat(String(data.cell.raw).replace('.', '').replace(',', '.'));
              if (!isNaN(v)) data.cell.styles.textColor = v > 10 ? [220, 38, 38] : v > 0 ? [161, 98, 7] : [21, 128, 61];
            }
          },
        });
      }

      const nome = `Relatorio_Concretagem_Estacas_${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(nome);
      Utils.esconderLoading();
      Utils.toast('PDF gerado.', 'sucesso');
    } catch (e) {
      console.error(e);
      Utils.esconderLoading();
      Utils.toast('Erro ao gerar o PDF.', 'erro');
    }
  }

  // Prancha(s) com marcadores preenchidos das estacas do relatório
  // (verde = 100%, amarelo = parcial), desenhadas direto no PDF.
  async function _pdfPranchas(doc, y, PW) {
    const CC = window.ConcretoCalculos;
    const pecaPorId = new Map(_dados.pecas.map(p => [p.id, p]));
    const pecasNoRel = new Set();
    _relatorio.dias.forEach(d => d.estacas.forEach(e => pecasNoRel.add(e.peca.id)));

    const pranchas = _dados.pranchas
      .filter(p => Number(p.imgWidthPx) > 0 && Number(p.imgHeightPx) > 0)
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

    for (const prancha of pranchas) {
      const marcadoresDaPrancha = _dados.marcadores.filter(m => m.pranchaId === prancha.id && m.pecaId && pecasNoRel.has(m.pecaId) && m.tipo === 'circulo');
      if (!marcadoresDaPrancha.length) continue;
      let img = null;
      try {
        const docImg = await db.collection('obras').doc(_dados.obraId).collection('config').doc('estacasImagem_' + prancha.id).get();
        img = docImg.exists ? (docImg.data().img || null) : null;
      } catch (e) {}
      if (!img) continue;

      const W = Number(prancha.imgWidthPx), H = Number(prancha.imgHeightPx);
      const larguraMm = PW - 24;
      const alturaMm = larguraMm * (H / W);
      if (y + alturaMm > 280) { doc.addPage(); y = 14; }
      doc.setTextColor(13, 13, 13); doc.setFontSize(9); doc.setFont(undefined, 'bold');
      doc.text(prancha.nome || 'Prancha', 12, y + 3);
      y += 5;
      try { doc.addImage(img, 'PNG', 12, y, larguraMm, alturaMm, undefined, 'FAST'); }
      catch (e) { try { doc.addImage(img, 'JPEG', 12, y, larguraMm, alturaMm, undefined, 'FAST'); } catch (e2) { continue; } }

      // Nº da concretagem dentro do marcador quando o relatório tem MAIS DE
      // UM DIA — identifica visualmente qual concretagem fez cada estaca.
      const multiDias = _relatorio.dias.length > 1;
      const concNumPorPeca = new Map();
      _relatorio.consolidadas.forEach(e => concNumPorPeca.set(e.peca.id, e.concNums));

      marcadoresDaPrancha.forEach(m => {
        const p = pecaPorId.get(m.pecaId);
        const pct = (CC && p) ? CC.pctConcretado(p, _dados.lancamentos) : 0;
        const cor = pct >= 100 ? [34, 197, 94] : [250, 204, 21];
        const cx = 12 + _num(m.cx) * larguraMm;
        const cy = y + _num(m.cy) * alturaMm;
        const r = Math.max(1.1, _num(m.raio) * larguraMm);
        doc.setFillColor(cor[0], cor[1], cor[2]);
        doc.setDrawColor(cor[0], cor[1], cor[2]);
        doc.circle(cx, cy, r, 'FD');
        if (multiDias) {
          const nums = concNumPorPeca.get(m.pecaId) || [];
          if (nums.length) {
            doc.setTextColor(13, 13, 13);
            doc.setFont(undefined, 'bold');
            doc.setFontSize(Math.max(4, Math.min(8, r * 3.2)));
            doc.text(String(nums[nums.length - 1]), cx, cy + r * 0.42, { align: 'center' });
          }
        }
      });
      y += alturaMm + 7;
    }
    return y;
  }

  return { abrir, selData, selTodas, setModo, gerar, copiarWhatsApp, baixarPDF };
})();
window.DashEstacasRel = DashEstacasRel;

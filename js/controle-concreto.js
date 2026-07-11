// ============================================
// Módulo: Controle de Concreto
// Dashboard operacional: KPIs, lançamento/edição
// de BTs, progresso por tipo, status das BTs
// e relatórios (donuts, andares, índices).
// Dados: Firestore obras/{obraId}/concreto*
// ============================================

const ControleConcreto = (() => {
  const CC = ConcretoCalculos;
  const COL_PECAS = 'concretoPecas';
  const COL_CONCS = 'concretoConcretagens';
  const COL_PC = 'concretoPecaConc';
  const COL_BTS = 'concretoBTs';
  const COL_LANS = 'concretoLancamentos';

  let obraId = null;
  let pecas = [];
  let concretagens = [];
  let pecaConc = [];
  let btsConfig = [];
  let lancamentos = [];
  let config = { ordemAndares: [], andaresCustm: [] };

  // Abas e filtros
  let aba = 'operacional'; // operacional | relatorios
  let filtroAndar = 'todos';
  let filtroConc = 'todas';
  let filtroRelConc = 'todas';
  let filtroRelAndar = 'todos';

  // Estado dos gráficos
  let tipoAberto = null;      // GraficoTipos: tipo expandido
  let andarAberto = null;     // GraficoAndares: andar expandido
  let andarFiltroTipo = 'todos';

  // Estado do modal Lançar BT
  let bt = null;

  // ══════════════════════════════════════════
  // INIT / CARREGAMENTO
  // ══════════════════════════════════════════
  async function init() {
    const ok = await Utils.initPagina({ requireObra: true });
    if (!ok) return;
    obraId = Router.getObraId();
    if (!obraId) {
      document.getElementById('cc-content').innerHTML =
        `<div class="estado-vazio"><div class="icone">🪨</div><p>Selecione uma obra para acessar o controle de concreto.</p></div>`;
      return;
    }
    document.addEventListener('keydown', e => { if (e.key === 'Escape') Utils.fecharTodosModais(); });
    await carregar();
  }

  async function carregar() {
    Utils.mostrarLoading();
    try {
      const [ps, cs, pcs, bts, lans] = await Promise.all([
        Database.listar(obraId, COL_PECAS, null),
        Database.listar(obraId, COL_CONCS, null),
        Database.listar(obraId, COL_PC, null),
        Database.listar(obraId, COL_BTS, null),
        Database.listar(obraId, COL_LANS, null),
      ]);
      pecas = ps; concretagens = cs; pecaConc = pcs; btsConfig = bts; lancamentos = lans;
      try {
        const doc = await db.collection('obras').doc(obraId).collection('config').doc('concreto').get();
        config = doc.exists ? doc.data() : { ordemAndares: [], andaresCustm: [] };
        config.ordemAndares = config.ordemAndares || [];
      } catch (e) { config = { ordemAndares: [], andaresCustm: [] }; }
      renderizar();
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao carregar dados: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  async function recarregar() {
    obraId = Router.getObraId();
    if (!obraId) return;
    filtroAndar = 'todos'; filtroConc = 'todas';
    filtroRelConc = 'todas'; filtroRelAndar = 'todos';
    tipoAberto = null; andarAberto = null; andarFiltroTipo = 'todos';
    await carregar();
  }

  // ══════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════
  function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function tsMillis(l) {
    const c = l.createdAt;
    if (!c) return 0;
    if (typeof c.toMillis === 'function') return c.toMillis();
    if (c.seconds) return c.seconds * 1000;
    return 0;
  }

  function concLabel(c) {
    return `Nº ${c.numero} — ${c.data || ''}${c.descricao ? ` | ${c.descricao}` : ''}`;
  }

  function todosAndares() {
    return CC.ordenarAndares([...new Set(pecas.map(p => p.andar))], config.ordemAndares);
  }

  // ══════════════════════════════════════════
  // RENDER PRINCIPAL
  // ══════════════════════════════════════════
  function renderizar() {
    const c = document.getElementById('cc-content');
    if (!c) return;

    if (!pecas.length && !concretagens.length) {
      c.innerHTML = `
        <div class="page-header">
          <div><h2>📊 Controle de Concreto</h2><span class="subtitulo">Lançamento de BTs, previsto × realizado e índices de perda</span></div>
        </div>
        <div class="estado-vazio"><div class="icone">🪨</div>
          <p>Nenhuma peça ou concretagem cadastrada ainda.<br>Monte a base no <a href="levantamento-concreto.html" style="color:var(--cor-primaria-dark,#b8960a);font-weight:600;">Levantamento de Concreto</a>.</p>
        </div>`;
      return;
    }

    c.innerHTML = `
      <div class="page-header">
        <div>
          <h2>📊 Controle de Concreto</h2>
          <span class="subtitulo">Lançamento de BTs, previsto × realizado e índices de perda</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <div class="aba-toggle">
            <button class="aba-btn ${aba === 'operacional' ? 'ativo' : ''}" onclick="CCON.setAba('operacional')">Operacional</button>
            <button class="aba-btn ${aba === 'relatorios' ? 'ativo' : ''}" onclick="CCON.setAba('relatorios')">Relatórios</button>
          </div>
          ${aba === 'operacional' ? `
            <button class="btn btn-secundario btn-sm" onclick="CCON.exportarCSV()">⬇ CSV</button>
            <button class="btn btn-primario btn-sm" onclick="CCON.abrirLancarBT()">⊕ Lançar BT</button>
          ` : ''}
        </div>
      </div>
      <div id="cc-body"></div>
    `;
    if (aba === 'operacional') renderOperacional();
    else renderRelatorios();
  }

  function setAba(a) { aba = a; renderizar(); }

  // ══════════════════════════════════════════
  // ABA OPERACIONAL
  // ══════════════════════════════════════════
  function setFiltroAndar(v) { filtroAndar = v; if (v !== 'todos') filtroConc = 'todas'; renderOperacional(); }
  function setFiltroConc(v) { filtroConc = v; renderOperacional(); }

  function renderOperacional() {
    const el = document.getElementById('cc-body');
    if (!el) return;

    // Concretagens disponíveis no filtro: se andar filtrado, só concs com peças daquele andar
    const concsFiltro = filtroAndar === 'todos' ? concretagens : concretagens.filter(c => {
      const ids = pecaConc.filter(pc => pc.concretagemId === c.id).map(pc => pc.pecaId);
      return pecas.some(p => ids.includes(p.id) && p.andar === filtroAndar);
    });

    // Dados para os KPIs conforme filtro de concretagem
    let pecasKPI = pecas, btsKPI = btsConfig, lansKPI = lancamentos;
    if (filtroConc !== 'todas') {
      const vincs = pecaConc.filter(pc => pc.concretagemId === filtroConc);
      pecasKPI = vincs.map(pc => {
        const p = pecas.find(x => x.id === pc.pecaId);
        if (!p) return null;
        return { ...p, volume: parseFloat((p.volume * (parseFloat(pc.pctConcretagem) || 0) / 100).toFixed(6)) };
      }).filter(Boolean);
      btsKPI = btsConfig.filter(b => b.concretagemId === filtroConc);
      lansKPI = lancamentos.filter(l => l.concretagemId === filtroConc);
    }
    const kpis = CC.calcKPIs(pecasKPI, lansKPI, btsKPI, filtroAndar, pecas);
    const pInfo = kpis.perdaInfo;

    // GraficoBTs: dados filtrados
    let btsG = btsConfig, lansG = lancamentos, concsG = concretagens;
    if (filtroConc !== 'todas') {
      btsG = btsConfig.filter(b => b.concretagemId === filtroConc);
      lansG = lancamentos.filter(l => l.concretagemId === filtroConc);
      concsG = concretagens.filter(c => c.id === filtroConc);
    } else if (filtroAndar !== 'todos') {
      btsG = btsConfig.filter(b => {
        const ids = pecaConc.filter(pc => pc.concretagemId === b.concretagemId).map(pc => pc.pecaId);
        return pecas.some(p => ids.includes(p.id) && p.andar === filtroAndar);
      });
      lansG = lancamentos.filter(l => {
        const p = pecas.find(x => x.id === l.pecaId);
        return p && p.andar === filtroAndar;
      });
      concsG = concretagens.filter(c => {
        const ids = pecaConc.filter(pc => pc.concretagemId === c.id).map(pc => pc.pecaId);
        return pecas.some(p => ids.includes(p.id) && p.andar === filtroAndar);
      });
    }

    el.innerHTML = `
      <div class="card mb-3">
        <div class="card-body" style="display:flex;gap:14px;flex-wrap:wrap;align-items:end;">
          <div class="form-grupo" style="margin-bottom:0;min-width:180px;">
            <label>Andar</label>
            <select class="form-control" onchange="CCON.setFiltroAndar(this.value)">
              <option value="todos">Todos</option>
              ${todosAndares().map(a => `<option value="${esc(a)}" ${filtroAndar === a ? 'selected' : ''}>${esc(a)}</option>`).join('')}
            </select>
          </div>
          <div class="form-grupo" style="margin-bottom:0;min-width:260px;">
            <label>Concretagem</label>
            <select class="form-control" onchange="CCON.setFiltroConc(this.value)">
              <option value="todas">Todas</option>
              ${[...concsFiltro].sort((a, b) => a.numero - b.numero).map(c => `<option value="${c.id}" ${filtroConc === c.id ? 'selected' : ''}>${esc(concLabel(c))}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <div class="cards-grid mb-3" style="grid-template-columns:repeat(auto-fit,minmax(175px,1fr));">
        <div class="stat-card"><div class="stat-label">Volume Total Projeto</div><div class="stat-valor">${CC.fmt4(kpis.totalVol)} <span style="font-size:0.75rem;">m³</span></div><div class="stat-sub">${pecasKPI.length} peças</div></div>
        <div class="stat-card"><div class="stat-label">Vol. Previsto (+10%)</div><div class="stat-valor">${CC.fmt4(kpis.totalVol * 1.1)} <span style="font-size:0.75rem;">m³</span></div><div class="stat-sub">projeto + 10% perda esperada</div></div>
        <div class="stat-card" style="border-left:3px solid #16a34a;"><div class="stat-label">Volume Real Concretado</div><div class="stat-valor" style="color:#16a34a;">${CC.fmt4(kpis.concVol)} <span style="font-size:0.75rem;">m³</span></div><div class="stat-sub">soma dos previstos das BTs lançadas</div></div>
        <div class="stat-card" style="border-left:3px solid #3b82f6;"><div class="stat-label">Vol. Executado Projeto 🚛</div><div class="stat-valor" style="color:#3b82f6;">${CC.fmt4(kpis.execVol)} <span style="font-size:0.75rem;">m³</span></div><div class="stat-sub">${CC.fmt1(kpis.totalVol > 0 ? kpis.execVol / kpis.totalVol * 100 : 0)}% do projeto · saída real do caminhão</div></div>
        <div class="stat-card"><div class="stat-label">Faltando (Projeto)</div><div class="stat-valor">${CC.fmt4(kpis.projFaltando)} <span style="font-size:0.75rem;">m³</span></div><div class="stat-sub">projeto − BTs lançadas</div></div>
        <div class="stat-card" style="border-left:3px solid #f97316;"><div class="stat-label">Índice de Perda</div><div class="stat-valor" style="color:#f97316;">${CC.fmt1(pInfo.indice)}<span style="font-size:0.75rem;">%</span></div><div class="stat-sub">(prev.−exec.)/prev. s/ cocho · cocho: ${CC.fmt4(pInfo.perdaCocho)} m³</div></div>
      </div>

      ${kpis.pecasExcesso.length ? `
        <div class="card mb-3" style="border:1.5px solid #ef4444;">
          <div class="card-body">
            <div style="font-weight:700;color:#991b1b;margin-bottom:8px;">⚠️ ${kpis.pecasExcesso.length} peça${kpis.pecasExcesso.length !== 1 ? 's' : ''} com lançamento acima do projeto — excesso total: ${CC.fmt4(kpis.pecasExcesso.reduce((s, p) => s + p.excesso, 0))} m³</div>
            ${kpis.pecasExcesso.map(p => `
              <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid #fee2e2;font-size:0.82rem;flex-wrap:wrap;">
                <span style="font-weight:600;">${esc(p.nome)} <span style="color:var(--cor-texto-muted);font-weight:400;">· ${esc(p.andar)} · ${esc(p.tipo)}</span></span>
                <span style="font-family:var(--font-mono);">Projeto ${CC.fmt4(p.volume)} m³ · Lançado ${CC.fmt4(p.lanTotal)} m³ <span class="badge badge-perigo">+${CC.fmt4(p.excesso)} m³</span></span>
              </div>`).join('')}
          </div>
        </div>` : ''}

      <div class="card mb-3">
        <div class="card-header"><h3>Progresso por Tipo de Peça <span style="font-size:0.7rem;color:var(--cor-texto-muted);font-weight:400;">▼ clique para expandir</span></h3></div>
        <div class="card-body" id="cc-grafico-tipos"></div>
      </div>

      <div class="cards-grid mb-3" style="grid-template-columns:2fr 1fr;" id="cc-linha-bts">
        <div class="card">
          <div class="card-header"><h3>Status das BTs por Concretagem</h3></div>
          <div class="card-body" id="cc-grafico-bts"></div>
        </div>
        <div class="card">
          <div class="card-header"><h3>Última BT Lançada</h3></div>
          <div class="card-body" id="cc-ultima-bt"></div>
        </div>
      </div>
    `;
    renderGraficoTipos(pecasKPI, lansKPI);
    renderGraficoBTs(btsG, lansG, concsG);
    renderUltimaBT();
  }

  // ── Progresso por tipo (acordeão) ───────────
  function renderGraficoTipos(ps, lans) {
    const el = document.getElementById('cc-grafico-tipos');
    if (!el) return;
    const dados = CC.calcPorTipo(ps, lans);
    if (!dados.length) {
      el.innerHTML = `<div class="estado-vazio" style="padding:20px;"><p>Sem peças para exibir.</p></div>`;
      return;
    }
    el.innerHTML = dados.map((t, i) => {
      const open = tipoAberto === t.tipo;
      const cor = CC.CORES[i % CC.CORES.length];
      return `
        <div style="margin-bottom:8px;">
          <div onclick="CCON.toggleTipo('${esc(t.tipo).replace(/'/g, "\\'")}')"
            style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:${open ? 'var(--cor-primaria-light,#fef9e7)' : '#f8fafc'};border:1px solid ${open ? 'var(--cor-primaria)' : 'var(--cor-borda-light)'};border-radius:8px;cursor:pointer;">
            <div style="width:12px;height:12px;background:${cor};border-radius:3px;flex-shrink:0;"></div>
            <div style="flex:1;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;flex-wrap:wrap;gap:4px;">
                <span style="font-weight:700;font-size:0.92rem;text-transform:uppercase;">${esc(t.tipo)} <span style="font-family:var(--font-mono);font-size:0.72rem;color:var(--cor-texto-muted);font-weight:400;text-transform:none;">${t.count} peça${t.count !== 1 ? 's' : ''}</span></span>
                <span style="display:flex;gap:12px;align-items:center;">
                  <span style="font-family:var(--font-mono);font-size:0.82rem;color:#16a34a;font-weight:700;">${CC.fmt4(t.conc)} m³</span>
                  <span style="font-family:var(--font-mono);font-size:0.72rem;color:var(--cor-texto-muted);">/ ${CC.fmt4(t.prog)} m³</span>
                  <span style="font-family:var(--font-mono);font-size:0.9rem;color:var(--cor-primaria-dark,#b8960a);font-weight:700;">${CC.fmt1(t.pct)}%</span>
                  <span style="color:var(--cor-texto-muted);font-size:0.75rem;">${open ? '▲' : '▼'}</span>
                </span>
              </div>
              <div style="height:7px;background:#e2e8f0;border-radius:4px;overflow:hidden;">
                <div style="height:100%;width:${Math.min(100, t.pct)}%;background:${t.pct >= 100 ? '#16a34a' : cor};"></div>
              </div>
            </div>
          </div>
          ${open ? `<div style="border:1px solid var(--cor-primaria);border-top:none;border-radius:0 0 8px 8px;background:#fff;">
            ${t.pecas.map(p => {
              const vc = Math.min(p.volume, CC.volLancadoPeca(p.id, lans));
              const pct = CC.pctConcretado(p, lans);
              const falt = Math.max(0, p.volume - vc);
              return `
                <div onclick="event.stopPropagation();CCON.abrirDetalhePeca('${p.id}')" style="padding:10px 14px;border-bottom:1px solid var(--cor-borda-light);cursor:pointer;">
                  <div style="display:flex;justify-content:space-between;margin-bottom:4px;flex-wrap:wrap;gap:4px;">
                    <span style="font-size:0.85rem;font-weight:600;">${esc(p.nome)} <span style="color:var(--cor-texto-muted);font-size:0.72rem;font-weight:400;">· ${esc(p.andar)}</span></span>
                    <span style="font-family:var(--font-mono);font-size:0.82rem;color:var(--cor-primaria-dark,#b8960a);font-weight:700;">${CC.fmt1(pct)}% 🔍</span>
                  </div>
                  <div style="height:5px;background:#f1f5f9;border-radius:3px;overflow:hidden;margin-bottom:4px;">
                    <div style="height:100%;width:${Math.min(100, pct)}%;background:${pct >= 100 ? '#16a34a' : 'var(--cor-primaria)'};"></div>
                  </div>
                  <div style="font-family:var(--font-mono);font-size:0.72rem;color:var(--cor-texto-muted);">
                    feito ${CC.fmt4(vc)} m³ · faltando <span style="color:${falt < 0.005 ? '#16a34a' : '#ef4444'};">${falt < 0.005 ? '0' : CC.fmt4(falt)} m³</span> · projeto ${CC.fmt4(p.volume)} m³
                  </div>
                </div>`;
            }).join('')}
          </div>` : ''}
        </div>`;
    }).join('');
  }

  function toggleTipo(t) { tipoAberto = tipoAberto === t ? null : t; renderOperacional(); }

  // ── Detalhe da peça (modal) ─────────────────
  function abrirDetalhePeca(pecaId) {
    const p = pecas.find(x => x.id === pecaId);
    if (!p) return;
    const el = document.getElementById('cc-detalhe-body');
    const vc = Math.min(p.volume, CC.volLancadoPeca(p.id, lancamentos));
    const pct = CC.pctConcretado(p, lancamentos);
    const falt = Math.max(0, p.volume - vc);
    const lanTotal = CC.volLancadoPeca(p.id, lancamentos);
    const excesso = lanTotal > p.volume * 1.001 ? lanTotal - p.volume : 0;
    const lansP = lancamentos.filter(l => l.pecaId === p.id).sort((a, b) => tsMillis(a) - tsMillis(b));

    const byConc = {};
    lansP.forEach(l => {
      const cid = l.concretagemId || '?';
      if (!byConc[cid]) byConc[cid] = { conc: concretagens.find(c => c.id === cid), bts: [] };
      const btC = btsConfig.find(b => b.id === l.btConfigId);
      const pctBT = p.volume > 0 ? (l.volume / p.volume * 100) : 0;
      byConc[cid].bts.push({ l, bt: btC, pctBT });
    });

    document.getElementById('cc-detalhe-titulo').textContent = `⬡ ${p.nome}`;
    el.innerHTML = `
      <p class="text-sm text-muted mb-2">${esc(p.tipo)} · ${esc(p.andar)}</p>
      <div class="cards-grid mb-2" style="grid-template-columns:repeat(3,1fr);">
        <div class="stat-card"><div class="stat-label">Projeto</div><div class="stat-valor" style="font-size:1.1rem;">${CC.fmt4(p.volume)} <span style="font-size:0.7rem;">m³</span></div></div>
        <div class="stat-card"><div class="stat-label">Concretado</div><div class="stat-valor" style="font-size:1.1rem;color:${excesso > 0 ? '#ef4444' : pct >= 100 ? '#16a34a' : 'inherit'};">${CC.fmt4(lanTotal)} <span style="font-size:0.7rem;">m³</span></div>${excesso > 0 ? `<div class="stat-sub" style="color:#ef4444;">+${CC.fmt4(excesso)} m³ excesso</div>` : ''}</div>
        <div class="stat-card"><div class="stat-label">Faltando</div><div class="stat-valor" style="font-size:1.1rem;">${CC.fmt4(falt)} <span style="font-size:0.7rem;">m³</span></div></div>
      </div>
      <div style="height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden;margin-bottom:4px;">
        <div style="height:100%;width:${Math.min(100, pct)}%;background:${pct >= 100 ? '#16a34a' : 'var(--cor-primaria)'};"></div>
      </div>
      <div style="font-family:var(--font-mono);font-size:0.8rem;color:var(--cor-primaria-dark,#b8960a);font-weight:700;text-align:right;margin-bottom:14px;">${CC.fmt1(pct)}%</div>
      ${!lansP.length ? `<div class="estado-vazio" style="padding:16px;"><p>Nenhum lançamento nesta peça ainda.</p></div>` :
      Object.values(byConc).map(g => {
        const totalG = g.bts.reduce((s, x) => s + (x.l.volume || 0), 0);
        return `
          <div style="border:1px solid var(--cor-borda-light);border-radius:8px;margin-bottom:10px;overflow:hidden;">
            <div style="background:#f8fafc;padding:8px 12px;font-weight:700;font-size:0.78rem;text-transform:uppercase;letter-spacing:0.3px;">
              Concretagem Nº${g.conc?.numero || '?'} <span style="color:var(--cor-texto-muted);font-weight:400;text-transform:none;">— ${esc(g.conc?.data || '')}${g.conc?.descricao ? ` | ${esc(g.conc.descricao)}` : ''}</span>
            </div>
            ${g.bts.map(x => `
              <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-top:1px solid var(--cor-borda-light);">
                <span style="font-family:var(--font-mono);font-size:0.78rem;font-weight:700;color:var(--cor-primaria-dark,#b8960a);min-width:52px;">BT-${x.bt?.numero || '?'}</span>
                <div style="flex:1;height:5px;background:#f1f5f9;border-radius:3px;overflow:hidden;">
                  <div style="height:100%;width:${Math.min(100, x.pctBT)}%;background:${x.l.volume > p.volume ? '#ef4444' : '#16a34a'};"></div>
                </div>
                <span style="font-family:var(--font-mono);font-size:0.78rem;">${CC.fmt4(x.l.volume)} m³</span>
                <span style="font-family:var(--font-mono);font-size:0.7rem;color:var(--cor-texto-muted);">${CC.fmt1(x.pctBT)}% desta peça</span>
                ${x.l.volume > p.volume ? `<span class="badge badge-perigo">+${CC.fmt4(x.l.volume - p.volume)} m³</span>` : ''}
              </div>`).join('')}
            <div style="padding:6px 12px;border-top:1px solid var(--cor-borda-light);font-family:var(--font-mono);font-size:0.75rem;text-align:right;color:var(--cor-texto-secundario);">Total: <b>${CC.fmt4(totalG)} m³</b></div>
          </div>`;
      }).join('')}
    `;
    Utils.abrirModal('modal-cc-detalhe');
  }

  // ── Status das BTs por concretagem ──────────
  function renderGraficoBTs(btsG, lansG, concsG) {
    const el = document.getElementById('cc-grafico-bts');
    if (!el) return;
    const concs = [...concsG].sort((a, b) => a.numero - b.numero);
    if (!concs.length) {
      el.innerHTML = `<div class="estado-vazio" style="padding:20px;"><p>Nenhuma concretagem configurada.</p></div>`;
      return;
    }
    el.innerHTML = concs.map(c => {
      const bts = btsG.filter(b => b.concretagemId === c.id).sort((a, b) => a.numero - b.numero);
      if (!bts.length) return '';
      const volPrev = bts.reduce((s, b) => s + (b.volumePrevisto || 0), 0);
      const btIdsL = new Set(lansG.map(l => l.btConfigId));
      const volUsado = bts.filter(b => btIdsL.has(b.id)).reduce((s, b) =>
        s + lansG.filter(l => l.btConfigId === b.id).reduce((ss, l) => ss + (l.volume || 0), 0), 0);
      return `
        <div style="margin-bottom:18px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:4px;">
            <span style="font-weight:700;font-size:0.85rem;">CONC. Nº${c.numero} <span style="color:var(--cor-texto-muted);font-weight:400;font-size:0.72rem;">· ${esc(c.data || '')}${c.descricao ? ` · ${esc(c.descricao)}` : ''}</span></span>
            <span style="font-family:var(--font-mono);font-size:0.78rem;color:var(--cor-texto-secundario);">${CC.fmt4(volUsado)} / ${CC.fmt4(volPrev)} m³</span>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            ${bts.map(b => {
              const lans = lansG.filter(l => l.btConfigId === b.id);
              const lancada = lans.length > 0;
              const usado = lans.reduce((s, l) => s + (l.volume || 0), 0);
              const acima = usado > b.volumePrevisto;
              const perdaCam = (b.volumePrevisto || 0) - usado;
              const perdaCocho = lancada ? (parseFloat(lans[0].perdaCocho) || 0) : 0;
              const perdaReal = perdaCam - perdaCocho;
              const corBorda = lancada ? (acima ? '#3b82f6' : '#16a34a') : 'var(--cor-borda-light)';
              return `
                <div onclick="CCON.abrirLancarBT('${c.id}', '${b.id}')" style="background:#f8fafc;border:1.5px solid ${corBorda};border-radius:8px;padding:10px 14px;min-width:98px;cursor:pointer;">
                  <div style="font-family:var(--font-mono);font-size:0.68rem;color:var(--cor-texto-muted);margin-bottom:3px;">BT-${b.numero}</div>
                  <div style="font-family:var(--font-mono);font-weight:700;font-size:1.15rem;color:${lancada ? (acima ? '#3b82f6' : '#16a34a') : 'var(--cor-texto-muted)'};">${lancada ? CC.fmt4(usado) : '—'}</div>
                  <div style="font-family:var(--font-mono);font-size:0.68rem;color:var(--cor-texto-muted);margin-top:1px;">/ ${CC.fmt4(b.volumePrevisto)} m³</div>
                  ${lancada ? `
                    <div style="height:4px;background:#e2e8f0;margin-top:6px;border-radius:2px;overflow:hidden;">
                      <div style="height:100%;width:${Math.min(120, b.volumePrevisto > 0 ? (usado / b.volumePrevisto) * 100 : 0)}%;background:${acima ? '#3b82f6' : '#16a34a'};"></div>
                    </div>
                    <div style="font-family:var(--font-mono);font-size:0.68rem;margin-top:4px;display:flex;flex-direction:column;gap:1px;">
                      ${perdaCam !== 0 ? `<span style="color:${perdaCam > 0 ? '#ef4444' : '#3b82f6'};font-weight:700;">${perdaCam > 0 ? `▼ ${CC.fmt4(perdaCam)} m³` : `▲ +${CC.fmt4(Math.abs(perdaCam))} m³`}</span>` : ''}
                      ${b.volumePrevisto > 0 ? `<span style="color:${perdaCam > 0 ? '#ef4444' : perdaCam < 0 ? '#3b82f6' : '#16a34a'};font-weight:700;">${perdaCam > 0 ? `${CC.fmt1((perdaCam / b.volumePrevisto) * 100)}% perda` : perdaCam < 0 ? `${CC.fmt1((Math.abs(perdaCam) / b.volumePrevisto) * 100)}% sobra` : '0% perda'}</span>` : ''}
                      ${perdaCocho > 0 ? `<span style="color:var(--cor-primaria-dark,#b8960a);">cocho: ${CC.fmt4(perdaCocho)} m³ · real: ${CC.fmt1(perdaReal > 0 ? (perdaReal / b.volumePrevisto) * 100 : 0)}% perda</span>` : ''}
                    </div>` : `<div style="font-family:var(--font-mono);font-size:0.65rem;color:var(--cor-texto-muted);margin-top:4px;">pendente</div>`}
                </div>`;
            }).join('')}
          </div>
        </div>`;
    }).join('') || `<div class="estado-vazio" style="padding:20px;"><p>Nenhuma BT configurada.</p></div>`;
  }

  // ── Última BT lançada ───────────────────────
  function renderUltimaBT() {
    const el = document.getElementById('cc-ultima-bt');
    if (!el) return;
    if (!lancamentos.length) {
      el.innerHTML = `<div class="estado-vazio" style="padding:20px;"><p>Nenhuma BT lançada ainda.</p></div>`;
      return;
    }
    const ultimo = [...lancamentos].sort((a, b) => tsMillis(b) - tsMillis(a))[0];
    const b = btsConfig.find(x => x.id === ultimo.btConfigId);
    const c = b ? concretagens.find(x => x.id === b.concretagemId) : null;
    if (!b) { el.innerHTML = `<div class="estado-vazio" style="padding:20px;"><p>—</p></div>`; return; }
    const lansBT = lancamentos.filter(l => l.btConfigId === b.id);
    const executado = lansBT.reduce((s, l) => s + (l.volume || 0), 0);
    const dif = (b.volumePrevisto || 0) - executado;
    el.innerHTML = `
      <div style="text-align:center;padding:6px 0;">
        <div style="font-family:var(--font-mono);font-size:1.7rem;font-weight:700;color:var(--cor-primaria-dark,#b8960a);">BT-${b.numero}</div>
        <div style="font-size:0.78rem;color:var(--cor-texto-muted);margin-bottom:10px;">Concretagem Nº${c?.numero || '?'}${ultimo.hora ? ` · ${esc(ultimo.hora)}` : ''}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
          <div class="stat-card" style="padding:10px;"><div class="stat-label">Previsto</div><div class="stat-valor" style="font-size:1rem;">${CC.fmt4(b.volumePrevisto)} m³</div></div>
          <div class="stat-card" style="padding:10px;"><div class="stat-label">Executado</div><div class="stat-valor" style="font-size:1rem;color:#16a34a;">${CC.fmt4(executado)} m³</div></div>
        </div>
        <div style="font-family:var(--font-mono);font-size:0.8rem;font-weight:700;color:${dif > 0 ? '#ef4444' : dif < 0 ? '#3b82f6' : '#16a34a'};margin-bottom:10px;">
          ${dif > 0 ? `Perda caminhão: ${CC.fmt4(dif)} m³` : dif < 0 ? `Sobra inesperada: +${CC.fmt4(Math.abs(dif))} m³` : 'Sem diferença'}
        </div>
        <span class="badge badge-sucesso">✓ Lançada</span>
        <div style="margin-top:12px;">
          <button class="btn btn-secundario btn-sm" onclick="CCON.abrirLancarBT('${b.concretagemId}', '${b.id}')">Ver detalhes / editar</button>
        </div>
      </div>`;
  }

  // ══════════════════════════════════════════
  // EXPORT CSV (peças por concretagem)
  // ══════════════════════════════════════════
  function exportarCSV() {
    if (!pecaConc.length) { Utils.toast('Nenhuma peça vinculada a concretagens.', 'alerta'); return; }
    const concsMap = {};
    concretagens.forEach(c => { concsMap[c.id] = `N${c.numero} - ${c.data || ''}${c.descricao ? ` | ${c.descricao}` : ''}`; });
    const linhas = [['Nome', 'Tipo', 'Andar', 'Volume Projeto (m3)', 'Concretagem', '% Nesta Conc', 'Vol. Nesta Conc. (m3)']];
    const pcsOrd = [...pecaConc].sort((a, b) => {
      const pa = pecas.find(p => p.id === a.pecaId), pb = pecas.find(p => p.id === b.pecaId);
      if (!pa || !pb) return 0;
      if (pa.tipo !== pb.tipo) return (pa.tipo || '').localeCompare(pb.tipo || '');
      if (pa.andar !== pb.andar) return (pa.andar || '').localeCompare(pb.andar || '');
      return (pa.nome || '').localeCompare(pb.nome || '');
    });
    pcsOrd.forEach(pc => {
      const p = pecas.find(x => x.id === pc.pecaId);
      if (!p) return;
      const pct = parseFloat(pc.pctConcretagem) || 0;
      linhas.push([
        p.nome, p.tipo, p.andar,
        (p.volume || 0).toFixed(4),
        concsMap[pc.concretagemId] || '?',
        String(pct),
        ((p.volume || 0) * pct / 100).toFixed(4),
      ]);
    });
    const csv = linhas.map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'pecas-por-concretagem.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  // ══════════════════════════════════════════
  // MODAL: LANÇAR / EDITAR BT
  // ══════════════════════════════════════════
  function abrirLancarBT(concIdPre, btIdPre) {
    const now = new Date();
    bt = {
      modo: 'menu',
      concId: concIdPre || '',
      btId: btIdPre || '',
      nf: '', cod: '',
      hora: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      linhas: [{ pecaId: '', pct: '' }],
      sobra: '', perda: '', perdaCocho: '',
      busca: '', esconder100: false,
    };
    if (bt.btId) btCarregarNF();
    renderLancarBT();
    Utils.abrirModal('modal-cc-bt');
  }

  function btCarregarNF() {
    const b = btsConfig.find(x => x.id === bt.btId);
    if (b) { bt.nf = b.notaFiscal || ''; bt.cod = b.codigoBT || ''; }
  }

  function btSetConc(v) { bt.concId = v; bt.btId = ''; bt.modo = 'menu'; renderLancarBT(); }
  function btSetBT(id) {
    bt.btId = id;
    btCarregarNF();
    const jaLancada = lancamentos.some(l => l.btConfigId === id);
    bt.modo = jaLancada ? 'menu' : 'nova';
    if (bt.modo === 'nova') bt.linhas = [{ pecaId: '', pct: '' }];
    renderLancarBT();
  }

  function btIniciarEdicao() {
    if (!bt.btId) return;
    const lansBT = lancamentos.filter(l => l.btConfigId === bt.btId);
    if (!lansBT.length) { Utils.toast('Esta BT ainda não foi lançada.', 'alerta'); return; }
    bt.linhas = lansBT.map(l => {
      const peca = pecas.find(p => p.id === l.pecaId);
      if (!peca || peca.volume <= 0) return { pecaId: l.pecaId, pct: '' };
      const pc = pecaConc.find(x => x.pecaId === l.pecaId && x.concretagemId === bt.concId);
      const pctConcPeca = pc ? (parseFloat(pc.pctConcretagem) || 0) / 100 : 1;
      const volConc = peca.volume * pctConcPeca;
      const pctRaw = volConc > 0 ? (l.volume / volConc) * 100 : 0;
      const pctInt = Math.round(pctRaw);
      const pct = Math.abs(pctRaw - pctInt) < 0.1 ? String(pctInt) : pctRaw.toFixed(2);
      return { pecaId: l.pecaId, pct };
    });
    if (!bt.linhas.length) bt.linhas = [{ pecaId: '', pct: '' }];
    bt.sobra = String(lansBT[0]?.sobraCaminhao ?? '');
    bt.perda = String(lansBT[0]?.perdaObra ?? '');
    bt.perdaCocho = String(lansBT[0]?.perdaCocho ?? '');
    bt.modo = 'editar';
    renderLancarBT();
  }

  function btPecasConc() {
    if (!bt.concId) return [];
    const ids = pecaConc.filter(pc => pc.concretagemId === bt.concId).map(pc => pc.pecaId);
    return pecas.filter(p => ids.includes(p.id));
  }

  function btVolLinha(l) {
    const p = pecas.find(x => x.id === l.pecaId);
    const pct = parseFloat(l.pct);
    if (!p || isNaN(pct)) return 0;
    const pc = pecaConc.find(x => x.pecaId === p.id && x.concretagemId === bt.concId);
    const pctConc = pc ? (parseFloat(pc.pctConcretagem) || 0) / 100 : 1;
    return (pct / 100) * (p.volume * pctConc);
  }

  function btExcessoLinha(l) {
    if (!l.pecaId || !l.pct) return 0;
    const p = pecas.find(x => x.id === l.pecaId);
    if (!p) return 0;
    const pc = pecaConc.find(x => x.pecaId === p.id && x.concretagemId === bt.concId);
    const pctConc = pc ? (parseFloat(pc.pctConcretagem) || 0) / 100 : 1;
    const volConc = p.volume * pctConc;
    const lansOutras = lancamentos.filter(x => x.pecaId === l.pecaId && x.btConfigId !== bt.btId && x.concretagemId === bt.concId);
    const jaLan = lansOutras.reduce((s, x) => s + (x.volume || 0), 0);
    const volEsta = (parseFloat(l.pct) / 100) * volConc;
    return Math.max(0, jaLan + volEsta - volConc);
  }

  // % já lançada da peça nesta concretagem (excluindo a BT atual)
  function btPctJaLancada(pecaId) {
    const p = pecas.find(x => x.id === pecaId);
    if (!p) return 0;
    const pc = pecaConc.find(x => x.pecaId === pecaId && x.concretagemId === bt.concId);
    const pctConc = pc ? (parseFloat(pc.pctConcretagem) || 0) / 100 : 1;
    const volConc = p.volume * pctConc;
    if (volConc <= 0) return 0;
    const lans = lancamentos.filter(x => x.pecaId === pecaId && x.btConfigId !== bt.btId && x.concretagemId === bt.concId);
    const jaLan = lans.reduce((s, x) => s + (x.volume || 0), 0);
    return (jaLan / volConc) * 100;
  }

  function renderLancarBT() {
    const el = document.getElementById('cc-bt-body');
    if (!el || !bt) return;

    const btsConc = btsConfig.filter(b => b.concretagemId === bt.concId).sort((a, b) => a.numero - b.numero);
    const btSel = btsConc.find(b => b.id === bt.btId);
    const jaLancada = bt.btId ? lancamentos.some(l => l.btConfigId === bt.btId) : false;

    let html = `
      <div class="form-grupo">
        <label>Concretagem</label>
        <select class="form-control" onchange="CCON.btSetConc(this.value)">
          <option value="">— selecione —</option>
          ${[...concretagens].sort((a, b) => a.numero - b.numero).map(c =>
            `<option value="${c.id}" ${bt.concId === c.id ? 'selected' : ''}>${esc(concLabel(c))}</option>`).join('')}
        </select>
      </div>`;

    if (bt.concId) {
      if (!btsConc.length) {
        html += `<div class="estado-vazio" style="padding:20px;"><p>Nenhuma BT configurada. Configure no Levantamento de Concreto → Concretagens.</p></div>`;
      } else {
        html += `
          <label style="display:block;font-size:0.78rem;font-weight:600;color:var(--cor-texto-secundario);margin-bottom:8px;">Selecione a BT</label>
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;">
            ${btsConc.map(b => {
              const jafoi = lancamentos.some(l => l.btConfigId === b.id);
              const sel = b.id === bt.btId;
              return `
                <div style="display:flex;flex-direction:column;">
                  <div onclick="CCON.btSetBT('${b.id}')" style="padding:12px 16px;border:2px solid ${sel ? 'var(--cor-primaria)' : jafoi ? '#16a34a' : 'var(--cor-borda-light)'};border-radius:${jafoi && sel ? '8px 8px 0 0' : '8px'};background:${sel ? 'var(--cor-primaria-light,#fef9e7)' : jafoi ? 'rgba(22,163,74,0.05)' : '#fff'};cursor:pointer;min-width:100px;">
                    <div style="font-family:var(--font-mono);font-size:1.15rem;font-weight:700;color:${sel ? 'var(--cor-primaria-dark,#b8960a)' : jafoi ? '#16a34a' : 'var(--cor-texto-secundario)'};">BT-${b.numero}</div>
                    <div style="font-family:var(--font-mono);font-size:0.75rem;color:var(--cor-texto-muted);margin-top:2px;">${CC.fmt4(b.volumePrevisto)} m³</div>
                    ${b.notaFiscal ? `<div style="font-family:var(--font-mono);font-size:0.65rem;color:var(--cor-texto-muted);">NF:${esc(b.notaFiscal)}</div>` : ''}
                    ${jafoi ? `<div style="font-family:var(--font-mono);font-size:0.7rem;color:#16a34a;margin-top:3px;">✓ Lançada</div>` : ''}
                  </div>
                  ${jafoi && sel ? `<button onclick="CCON.btIniciarEdicao()" style="background:#fff;border:2px solid var(--cor-primaria);border-top:none;border-radius:0 0 8px 8px;color:var(--cor-primaria-dark,#b8960a);font-weight:700;font-size:0.72rem;letter-spacing:0.5px;padding:7px;cursor:pointer;text-transform:uppercase;font-family:var(--font-principal);">✎ Editar BT</button>` : ''}
                </div>`;
            }).join('')}
          </div>`;
      }
    }

    // Formulário de lançamento (nova ou edição)
    const mostrarForm = bt.btId && (bt.modo === 'nova' || bt.modo === 'editar') && btSel;
    if (bt.btId && jaLancada && bt.modo === 'menu') {
      html += `<p class="text-sm text-muted">Esta BT já foi lançada. Clique em <b>✎ Editar BT</b> para corrigir os valores.</p>`;
    }

    if (mostrarForm) {
      const pecasConc = btPecasConc();
      const busca = (bt.busca || '').toLowerCase();
      const totalUsado = bt.linhas.reduce((s, l) => s + btVolLinha(l), 0);
      const volPrevisto = btSel.volumePrevisto || 0;
      const sobEstimada = Math.max(0, volPrevisto - totalUsado);
      const temExcesso = bt.linhas.some(l => btExcessoLinha(l) > 0.001);

      const opcoesPeca = sel => {
        const lista = pecasConc.filter(p => {
          if (busca && !p.nome.toLowerCase().includes(busca)) return false;
          if (bt.esconder100 && p.id !== sel && btPctJaLancada(p.id) >= 99.995) return false;
          return true;
        });
        return `<option value="">— peça —</option>` + lista.map(p => {
          const ja = btPctJaLancada(p.id);
          return `<option value="${p.id}" ${sel === p.id ? 'selected' : ''}>${esc(p.nome)} (${esc(p.andar)})${ja > 0.01 ? ` · ${CC.fmt1(ja)}% lançada` : ''}</option>`;
        }).join('');
      };

      html += `
        <hr style="border:none;border-top:1px solid var(--cor-borda-light);margin:14px 0;">
        <div style="font-weight:700;font-size:0.88rem;margin-bottom:10px;">${bt.modo === 'editar' ? `✎ Editando BT-${btSel.numero}` : `⊕ Lançando BT-${btSel.numero}`} <span style="font-family:var(--font-mono);font-weight:400;font-size:0.75rem;color:var(--cor-texto-muted);">previsto ${CC.fmt4(volPrevisto)} m³</span></div>
        <div class="form-row" style="margin-bottom:8px;">
          <div class="form-grupo" style="margin-bottom:0;"><label>Nota Fiscal</label><input type="text" class="form-control" value="${esc(bt.nf)}" placeholder="opcional" oninput="CCON.btUpd('nf', this.value)"></div>
          <div class="form-grupo" style="margin-bottom:0;"><label>Código BT</label><input type="text" class="form-control" value="${esc(bt.cod)}" placeholder="opcional" oninput="CCON.btUpd('cod', this.value)"></div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
          <input type="text" class="form-control" style="flex:1;" placeholder="🔍 Filtrar peças por nome..." value="${esc(bt.busca)}" oninput="CCON.btBusca(this.value)">
          <label style="display:flex;align-items:center;gap:5px;font-size:0.75rem;color:var(--cor-texto-muted);cursor:pointer;white-space:nowrap;">
            <input type="checkbox" ${bt.esconder100 ? 'checked' : ''} onchange="CCON.btEsconder100(this.checked)"> Esconder 100%
          </label>
        </div>
        <div id="cc-bt-linhas">
          ${bt.linhas.map((l, i) => {
            const vol = btVolLinha(l);
            const exc = btExcessoLinha(l);
            return `
              <div style="display:grid;grid-template-columns:1fr 80px 90px auto;gap:8px;margin-bottom:6px;align-items:center;" class="cc-bt-linha">
                <select class="form-control" onchange="CCON.btUpdLinha(${i}, 'pecaId', this.value)">${opcoesPeca(l.pecaId)}</select>
                <input type="text" inputmode="decimal" class="form-control" placeholder="%" value="${esc(l.pct)}" oninput="CCON.btUpdLinha(${i}, 'pct', this.value)">
                <span id="cc-bt-vol-${i}" style="font-family:var(--font-mono);font-size:0.78rem;color:${exc > 0.001 ? '#ef4444' : 'var(--cor-texto-secundario)'};text-align:right;">${CC.fmt4(vol)} m³${exc > 0.001 ? ` ⚠` : ''}</span>
                <button class="btn btn-secundario btn-sm" style="color:#ef4444;" onclick="CCON.btRemLinha(${i})" ${bt.linhas.length <= 1 ? 'disabled' : ''}>✕</button>
              </div>`;
          }).join('')}
        </div>
        <button class="btn btn-secundario btn-sm" onclick="CCON.btAddLinha()">+ Peça</button>
        <div id="cc-bt-excesso" style="display:${temExcesso ? 'block' : 'none'};background:#fee2e2;border:1px solid #ef4444;color:#991b1b;border-radius:8px;padding:8px 12px;font-size:0.78rem;margin-top:8px;">
          ⚠️ Uma ou mais peças ultrapassam 100% do volume nesta concretagem (considerando outras BTs).
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;background:#f8fafc;border:1px solid var(--cor-borda-light);border-radius:8px;padding:10px 14px;margin-top:10px;font-family:var(--font-mono);font-size:0.82rem;flex-wrap:wrap;gap:6px;">
          <span>Total usado: <b id="cc-bt-total" style="color:var(--cor-primaria-dark,#b8960a);">${CC.fmt4(totalUsado)} m³</b></span>
          <span>Sobra estimada: <b id="cc-bt-sobest">${CC.fmt4(sobEstimada)} m³</b></span>
        </div>
        <div class="form-row" style="margin-top:10px;">
          <div class="form-grupo" style="margin-bottom:0;"><label>Sobra Caminhão [m³]</label><input type="text" inputmode="decimal" class="form-control" value="${esc(bt.sobra)}" placeholder="auto" oninput="CCON.btUpd('sobra', this.value)"></div>
          <div class="form-grupo" style="margin-bottom:0;"><label>Perda em Obra [m³]</label><input type="text" inputmode="decimal" class="form-control" value="${esc(bt.perda)}" placeholder="0" oninput="CCON.btUpd('perda', this.value)"></div>
        </div>
        <div class="form-row" style="margin-top:8px;">
          <div class="form-grupo" style="margin-bottom:0;"><label>Volume Cocho + Linha [m³]</label><input type="text" inputmode="decimal" class="form-control" value="${esc(bt.perdaCocho)}" placeholder="0" oninput="CCON.btUpd('perdaCocho', this.value)"></div>
          <div class="form-grupo" style="margin-bottom:0;"><label>Hora</label><input type="time" class="form-control" value="${esc(bt.hora)}" oninput="CCON.btUpd('hora', this.value)"></div>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:14px;">
          <button class="btn btn-primario" onclick="CCON.btSalvar()">${bt.modo === 'editar' ? '✓ Salvar Alterações' : '✓ Lançar BT'}</button>
        </div>`;
    }

    el.innerHTML = html;
  }

  function btUpd(campo, valor) { bt[campo] = valor; }
  function btBusca(v) { bt.busca = v; atualizarSelectsPecas(); }
  function btEsconder100(v) { bt.esconder100 = v; renderLancarBT(); }

  // Atualiza só as options dos selects de peça (preserva foco na busca)
  function atualizarSelectsPecas() {
    const pecasConc = btPecasConc();
    const busca = (bt.busca || '').toLowerCase();
    document.querySelectorAll('#cc-bt-linhas .cc-bt-linha select').forEach((sel, i) => {
      const atual = bt.linhas[i]?.pecaId || '';
      const lista = pecasConc.filter(p => {
        if (busca && !p.nome.toLowerCase().includes(busca)) return false;
        if (bt.esconder100 && p.id !== atual && btPctJaLancada(p.id) >= 99.995) return false;
        return true;
      });
      sel.innerHTML = `<option value="">— peça —</option>` + lista.map(p => {
        const ja = btPctJaLancada(p.id);
        return `<option value="${p.id}" ${atual === p.id ? 'selected' : ''}>${esc(p.nome)} (${esc(p.andar)})${ja > 0.01 ? ` · ${CC.fmt1(ja)}% lançada` : ''}</option>`;
      }).join('');
    });
  }

  function btAddLinha() { bt.linhas.push({ pecaId: '', pct: '' }); renderLancarBT(); }
  function btRemLinha(i) { bt.linhas.splice(i, 1); renderLancarBT(); }

  function btUpdLinha(i, f, v) {
    bt.linhas[i][f] = v;
    if (f === 'pecaId') { renderLancarBT(); return; }
    // Atualização parcial nos totais (preserva foco no input de %)
    const vol = btVolLinha(bt.linhas[i]);
    const exc = btExcessoLinha(bt.linhas[i]);
    const volEl = document.getElementById('cc-bt-vol-' + i);
    if (volEl) {
      volEl.textContent = `${CC.fmt4(vol)} m³${exc > 0.001 ? ' ⚠' : ''}`;
      volEl.style.color = exc > 0.001 ? '#ef4444' : 'var(--cor-texto-secundario)';
    }
    const btSel = btsConfig.find(b => b.id === bt.btId);
    const totalUsado = bt.linhas.reduce((s, l) => s + btVolLinha(l), 0);
    const sobEstimada = Math.max(0, (btSel?.volumePrevisto || 0) - totalUsado);
    const totEl = document.getElementById('cc-bt-total');
    const sobEl = document.getElementById('cc-bt-sobest');
    if (totEl) totEl.textContent = CC.fmt4(totalUsado) + ' m³';
    if (sobEl) sobEl.textContent = CC.fmt4(sobEstimada) + ' m³';
    const excBox = document.getElementById('cc-bt-excesso');
    if (excBox) excBox.style.display = bt.linhas.some(l => btExcessoLinha(l) > 0.001) ? 'block' : 'none';
  }

  async function btSalvar() {
    if (!bt.concId || !bt.btId) { Utils.toast('Selecione concretagem e BT.', 'alerta'); return; }
    const linhasVal = bt.linhas.filter(l => l.pecaId && parseFloat(l.pct) > 0);
    if (!linhasVal.length) { Utils.toast('Adicione ao menos uma peça com % maior que zero.', 'alerta'); return; }
    const btSel = btsConfig.find(b => b.id === bt.btId);
    if (!btSel) return;

    Utils.mostrarLoading();
    try {
      const totalUsado = bt.linhas.reduce((s, l) => s + btVolLinha(l), 0);
      const sobEstimada = Math.max(0, (btSel.volumePrevisto || 0) - totalUsado);
      const sobraCaminhao = parseFloat(String(bt.sobra).replace(',', '.'));
      const perdaObra = parseFloat(String(bt.perda).replace(',', '.')) || 0;
      const perdaCocho = parseFloat(String(bt.perdaCocho).replace(',', '.')) || 0;
      const sobraFinal = isNaN(sobraCaminhao) ? sobEstimada : sobraCaminhao;

      const ops = [];
      // Em edição: remove os lançamentos antigos desta BT e regrava
      if (bt.modo === 'editar') {
        lancamentos.filter(l => l.btConfigId === bt.btId).forEach(l =>
          ops.push({ type: 'delete', ref: Database.ref(obraId, COL_LANS).doc(l.id) }));
      }
      // Atualiza NF / código na BT
      ops.push({
        type: 'update',
        ref: Database.ref(obraId, COL_BTS).doc(bt.btId),
        data: { notaFiscal: bt.nf || '', codigoBT: bt.cod || '' },
      });
      // Lançamentos: % relativo ao volume da peça NESTA concretagem
      linhasVal.forEach(l => {
        const p = pecas.find(x => x.id === l.pecaId);
        if (!p) return;
        const pc = pecaConc.find(x => x.pecaId === l.pecaId && x.concretagemId === bt.concId);
        const pctConc = pc ? (parseFloat(pc.pctConcretagem) || 0) / 100 : 1;
        const volConc = p.volume * pctConc;
        const pct = parseFloat(l.pct);
        const vol = parseFloat(((pct / 100) * volConc).toFixed(4));
        ops.push({
          type: 'set',
          ref: Database.ref(obraId, COL_LANS).doc(CC.genId('lan')),
          data: {
            btConfigId: bt.btId,
            concretagemId: bt.concId,
            pecaId: l.pecaId,
            pct, volume: vol,
            hora: bt.hora || '',
            sobraCaminhao: sobraFinal,
            perdaObra, perdaCocho,
            obraId,
          },
        });
      });
      for (let i = 0; i < ops.length; i += 400) {
        await Database.batchWrite(ops.slice(i, i + 400));
      }
      Utils.toast(bt.modo === 'editar' ? `✓ BT-${btSel.numero} atualizada!` : `✓ BT-${btSel.numero} lançada!`, 'sucesso');
      Utils.fecharModal('modal-cc-bt');
      await carregar();
    } catch (e) {
      Utils.toast('Erro ao salvar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ══════════════════════════════════════════
  // ABA RELATÓRIOS
  // ══════════════════════════════════════════
  function setFiltroRelConc(v) { filtroRelConc = v; renderRelatorios(); }
  function setFiltroRelAndar(v) { filtroRelAndar = v; renderRelatorios(); }
  function setAndarFiltroTipo(v) { andarFiltroTipo = v; renderRelatorios(); }
  function toggleAndarAberto(a) { andarAberto = andarAberto === a ? null : a; renderRelatorios(); }

  // Donut SVG (fatias)
  function donutSVG(dados, total, size, thickness, label) {
    dados = dados.filter(d => d.val > 0);
    if (!dados.length || !total) return `<div class="estado-vazio" style="padding:16px;"><p>Sem dados.</p></div>`;
    const cx = size / 2, cy = size / 2, r = (size - thickness * 2) / 2;
    let angle = -Math.PI / 2;
    const paths = dados.map(d => {
      const sl = (d.val / total) * 2 * Math.PI;
      const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
      const x2 = cx + r * Math.cos(angle + sl), y2 = cy + r * Math.sin(angle + sl);
      const path = `M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${sl > Math.PI ? 1 : 0},1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`;
      angle += sl;
      return `<path d="${path}" fill="${d.cor}" opacity="0.92"/>`;
    }).join('');
    return `
      <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
        <circle cx="${cx}" cy="${cy}" r="${r + thickness / 2}" fill="none" stroke="#f1f5f9" stroke-width="${thickness}"/>
        ${paths}
        <circle cx="${cx}" cy="${cy}" r="${r - thickness / 2}" fill="#fff"/>
        ${label ? `
          <text x="${cx}" y="${cy - 3}" text-anchor="middle" font-weight="700" font-size="${size * 0.13}" fill="#1a1a1a" font-family="Inter,sans-serif">${label.top}</text>
          <text x="${cx}" y="${cy + size * 0.1}" text-anchor="middle" font-size="${size * 0.08}" fill="#94a3b8" font-family="JetBrains Mono,monospace">${label.bot}</text>` : ''}
      </svg>`;
  }

  function renderRelatorios() {
    const el = document.getElementById('cc-body');
    if (!el) return;

    // Filtragem
    let lans = lancamentos, pcs = pecas, bts = btsConfig;
    if (filtroRelConc !== 'todas') {
      lans = lans.filter(l => l.concretagemId === filtroRelConc);
      bts = bts.filter(b => b.concretagemId === filtroRelConc);
      const pecaIdsConc = pecaConc.filter(pc => pc.concretagemId === filtroRelConc).map(pc => pc.pecaId);
      pcs = pcs.filter(p => pecaIdsConc.includes(p.id));
    }
    if (filtroRelAndar !== 'todos') pcs = pcs.filter(p => p.andar === filtroRelAndar);
    const pids = new Set(pcs.map(p => p.id));
    lans = lans.filter(l => pids.has(l.pecaId));

    const relProg = pcs.reduce((s, p) => s + (p.volume || 0), 0);
    const relConc = pcs.reduce((s, p) => s + Math.min(p.volume || 0, CC.volLancadoPeca(p.id, lans)), 0);
    const pInfo = CC.calcIndicePerda(lans, bts);
    const prevVol = CC.calcVolumePrevisto(bts, lans);

    const donutExec = donutSVG(
      [{ val: relConc, cor: '#16a34a' }, { val: Math.max(0, relProg - relConc), cor: '#cbd5e1' }],
      relProg, 130, 20,
      { top: CC.fmt1(relProg > 0 ? relConc / relProg * 100 : 0) + '%', bot: 'executado' });
    const donutPerda = donutSVG(
      [{ val: pInfo.perdaObra, cor: '#ef4444' }, { val: Math.max(0, pInfo.perdaCaminhao), cor: '#f97316' }, { val: pInfo.totalExecutado, cor: '#16a34a' }],
      pInfo.totalPrevisto || 1, 130, 20,
      { top: CC.fmt1(pInfo.indice) + '%', bot: 'perda' });

    el.innerHTML = `
      <div class="card mb-3">
        <div class="card-body" style="display:flex;gap:14px;flex-wrap:wrap;align-items:end;">
          <div class="form-grupo" style="margin-bottom:0;min-width:260px;">
            <label>Concretagem</label>
            <select class="form-control" onchange="CCON.setFiltroRelConc(this.value)">
              <option value="todas">Todas</option>
              ${[...concretagens].sort((a, b) => a.numero - b.numero).map(c => `<option value="${c.id}" ${filtroRelConc === c.id ? 'selected' : ''}>${esc(concLabel(c))}</option>`).join('')}
            </select>
          </div>
          <div class="form-grupo" style="margin-bottom:0;min-width:180px;">
            <label>Andar</label>
            <select class="form-control" onchange="CCON.setFiltroRelAndar(this.value)">
              <option value="todos">Todos</option>
              ${todosAndares().map(a => `<option value="${esc(a)}" ${filtroRelAndar === a ? 'selected' : ''}>${esc(a)}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <div class="cards-grid mb-3" style="grid-template-columns:repeat(auto-fit,minmax(175px,1fr));">
        <div class="stat-card"><div class="stat-label">Vol. Programado</div><div class="stat-valor">${CC.fmt4(relProg)} <span style="font-size:0.75rem;">m³</span></div></div>
        <div class="stat-card" style="border-left:3px solid #16a34a;"><div class="stat-label">Vol. Concretado</div><div class="stat-valor" style="color:#16a34a;">${CC.fmt4(relConc)} <span style="font-size:0.75rem;">m³</span></div><div class="stat-sub">${CC.fmt1(relProg > 0 ? relConc / relProg * 100 : 0)}%</div></div>
        <div class="stat-card" style="border-left:3px solid #ef4444;"><div class="stat-label">Perda em Obra</div><div class="stat-valor" style="color:#ef4444;">${CC.fmt4(pInfo.perdaObra)} <span style="font-size:0.75rem;">m³</span></div><div class="stat-sub">${CC.fmt1(pInfo.totalPrevisto > 0 ? pInfo.perdaObra / pInfo.totalPrevisto * 100 : 0)}%</div></div>
        <div class="stat-card" style="border-left:3px solid #f97316;"><div class="stat-label">Índice de Perda</div><div class="stat-valor" style="color:#f97316;">${CC.fmt1(pInfo.indice)}<span style="font-size:0.75rem;">%</span></div><div class="stat-sub">média por BT</div></div>
      </div>

      <div class="cards-grid mb-3" style="grid-template-columns:1fr 1fr;" id="cc-rel-donuts">
        <div class="card">
          <div class="card-header"><h3>Execução Geral</h3></div>
          <div class="card-body" style="display:flex;align-items:center;gap:22px;flex-wrap:wrap;">
            ${donutExec}
            <div>
              ${[{ label: 'Executado', cor: '#16a34a', val: relConc }, { label: 'Faltando', cor: '#cbd5e1', val: Math.max(0, relProg - relConc) }].map(d => `
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
                  <div style="width:10px;height:10px;background:${d.cor};border-radius:2px;"></div>
                  <div><div style="font-weight:600;font-size:0.82rem;">${d.label}</div><div style="font-family:var(--font-mono);font-size:0.72rem;color:var(--cor-texto-muted);">${CC.fmt4(d.val)} m³</div></div>
                </div>`).join('')}
              <div style="font-family:var(--font-mono);font-size:0.7rem;color:var(--cor-texto-muted);padding-top:6px;border-top:1px solid var(--cor-borda-light);">BTs faltando: ${CC.fmt4(prevVol.faltando)} m³</div>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>Distribuição de Perdas</h3></div>
          <div class="card-body" style="display:flex;align-items:center;gap:22px;flex-wrap:wrap;">
            ${donutPerda}
            <div>
              ${[{ label: 'Executado', cor: '#16a34a', val: pInfo.totalExecutado }, { label: 'Perda Obra', cor: '#ef4444', val: pInfo.perdaObra }, { label: 'Perda Caminhão', cor: '#f97316', val: Math.max(0, pInfo.perdaCaminhao) }].map(d => `
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
                  <div style="width:10px;height:10px;background:${d.cor};border-radius:2px;"></div>
                  <div><div style="font-weight:600;font-size:0.82rem;">${d.label}</div><div style="font-family:var(--font-mono);font-size:0.72rem;color:var(--cor-texto-muted);">${CC.fmt4(d.val)} m³</div></div>
                </div>`).join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="card mb-3">
        <div class="card-header"><h3>Volume por Andar <span style="font-size:0.7rem;color:var(--cor-texto-muted);font-weight:400;">▼ clique na barra para expandir</span></h3></div>
        <div class="card-body">${graficoAndaresHTML(pcs, lans, pInfo.indice)}</div>
      </div>

      <div class="card mb-3">
        <div class="card-header"><h3>Resumo por Tipo de Peça</h3></div>
        <div class="card-body">
          <table class="tabela">
            <thead><tr><th>Tipo</th><th class="col-centro">Qtd</th><th class="col-num">Previsto</th><th class="col-num">Executado</th><th class="col-num">Faltando</th><th>%</th></tr></thead>
            <tbody>
              ${CC.calcPorTipo(pcs, lans).map((t, i) => `
                <tr>
                  <td><span style="display:inline-flex;align-items:center;gap:8px;"><span style="width:8px;height:8px;background:${CC.CORES[i % CC.CORES.length]};border-radius:2px;display:inline-block;"></span><b>${esc(t.tipo)}</b></span></td>
                  <td class="col-centro" style="font-family:var(--font-mono);">${t.count}</td>
                  <td class="col-num" style="font-family:var(--font-mono);">${CC.fmt4(t.prog)} m³</td>
                  <td class="col-num" style="font-family:var(--font-mono);color:#16a34a;">${CC.fmt4(t.conc)} m³</td>
                  <td class="col-num" style="font-family:var(--font-mono);color:#ef4444;">${CC.fmt4(t.falt)} m³</td>
                  <td>
                    <span style="display:inline-flex;align-items:center;gap:8px;">
                      <span style="width:60px;height:5px;background:#f1f5f9;border-radius:3px;overflow:hidden;display:inline-block;"><span style="display:block;height:100%;width:${Math.min(100, t.pct)}%;background:${t.pct >= 100 ? '#16a34a' : CC.CORES[i % CC.CORES.length]};"></span></span>
                      <span style="font-family:var(--font-mono);font-size:0.78rem;">${CC.fmt1(t.pct)}%</span>
                    </span>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3>Índice Detalhado por BT</h3></div>
        <div class="card-body">
          <table class="tabela">
            <thead><tr><th>BT</th><th class="col-centro">Conc.</th><th>NF</th><th class="col-num">Previsto</th><th class="col-num">Executado</th><th class="col-num">Perda Obra</th><th class="col-num">Dif. Caminhão</th><th class="col-centro">Status</th></tr></thead>
            <tbody>
              ${!bts.length ? `<tr><td colspan="8" style="text-align:center;color:var(--cor-texto-muted);padding:20px;">Sem BTs configuradas</td></tr>` :
              [...bts].sort((a, b) => a.numero - b.numero).map(b => {
                const conc = concretagens.find(c => c.id === b.concretagemId);
                const bLans = lans.filter(l => l.btConfigId === b.id);
                const usado = bLans.reduce((s, l) => s + (l.volume || 0), 0);
                const perdaO = bLans.reduce((s, l) => s + (l.perdaObra || 0), 0);
                const difCam = usado - (b.volumePrevisto || 0);
                const lancada = bLans.length > 0;
                return `
                  <tr>
                    <td style="font-family:var(--font-mono);font-weight:700;color:var(--cor-primaria-dark,#b8960a);">BT-${b.numero}</td>
                    <td class="col-centro" style="font-family:var(--font-mono);">${conc?.numero || '—'}</td>
                    <td style="font-family:var(--font-mono);">${esc(b.notaFiscal || '—')}</td>
                    <td class="col-num" style="font-family:var(--font-mono);">${CC.fmt4(b.volumePrevisto)}</td>
                    <td class="col-num" style="font-family:var(--font-mono);color:${lancada ? (difCam > 0 ? '#3b82f6' : '#16a34a') : 'var(--cor-texto-muted)'};">${lancada ? CC.fmt4(usado) : '—'}</td>
                    <td class="col-num" style="font-family:var(--font-mono);color:${perdaO > 0 ? '#ef4444' : 'var(--cor-texto-muted)'};">${lancada ? CC.fmt4(perdaO) : '—'}</td>
                    <td class="col-num" style="font-family:var(--font-mono);color:${lancada ? (difCam > 0 ? '#3b82f6' : difCam < 0 ? '#ef4444' : 'var(--cor-texto-muted)') : 'var(--cor-texto-muted)'};">${lancada ? (difCam > 0 ? `▲ +${CC.fmt4(difCam)}` : difCam < 0 ? `▼ ${CC.fmt4(Math.abs(difCam))}` : '—') : '—'}</td>
                    <td class="col-centro"><span class="badge ${lancada ? 'badge-sucesso' : 'badge-neutro'}">${lancada ? 'Lançada' : 'Pendente'}</span></td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ── Gráfico de barras por andar (SVG) ───────
  function graficoAndaresHTML(pcs, lans, indicePerda) {
    const dados = CC.calcAndares(pcs, lans, config.ordemAndares, indicePerda);
    if (!dados.length) return `<div class="estado-vazio" style="padding:20px;"><p>Sem dados de andares.</p></div>`;
    const tipos = ['todos', ...new Set(pcs.map(p => p.tipo))].sort();

    const chartDados = dados.map(d => {
      const pecasAndar = pcs.filter(p => p.andar === d.andar && (andarFiltroTipo === 'todos' || p.tipo === andarFiltroTipo));
      const proj = pecasAndar.reduce((s, p) => s + (p.volume || 0), 0);
      const conc = pecasAndar.reduce((s, p) => s + Math.min(p.volume || 0, CC.volLancadoPeca(p.id, lans)), 0);
      const falt = Math.max(0, proj - conc);
      const previsto = falt > 0 ? falt * (1 + Math.abs(indicePerda) / 100) : 0;
      return { andar: d.andar, proj, conc, falt, previsto };
    }).filter(d => d.proj > 0);

    if (!chartDados.length) return `<div class="estado-vazio" style="padding:20px;"><p>Sem peças para o filtro atual.</p></div>`;

    const maxVal = Math.max(...chartDados.map(d => Math.max(d.proj, d.conc, d.previsto, d.falt)), 0.01);
    const chartH = 220, barW = 18, gap = 8;
    const groupW = barW * 4 + gap * 3 + 20;
    const totalW = chartDados.length * groupW;
    const padL = 52, padB = 60, padT = 24;
    const svgH = chartH + padB + padT;
    const ticks = 5;

    const grades = Array.from({ length: ticks + 1 }, (_, i) => {
      const g = i / ticks;
      const y = padT + chartH - g * chartH;
      const val = (g * maxVal).toFixed(1);
      return `<line x1="${padL}" y1="${y}" x2="${padL + totalW + 10}" y2="${y}" stroke="#e2e8f0" stroke-width="1" ${i === 0 ? '' : 'stroke-dasharray="4,4"'}/>
        <text x="${padL - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="#94a3b8" font-family="JetBrains Mono,monospace">${val}</text>`;
    }).join('');

    const cores = {
      proj: ['rgba(59,130,246,0.6)', 'rgba(59,130,246,1)'],
      prev: ['rgba(249,115,22,0.65)', 'rgba(249,115,22,1)'],
      conc: ['rgba(34,197,94,0.7)', 'rgba(34,197,94,1)'],
      falt: ['rgba(239,68,68,0.6)', 'rgba(239,68,68,1)'],
    };

    const barras = chartDados.map((d, i) => {
      const x0 = padL + i * groupW;
      const open = andarAberto === d.andar;
      const hProj = d.proj > 0 ? (d.proj / maxVal) * chartH : 0;
      const hConc = d.conc > 0 ? (d.conc / maxVal) * chartH : 0;
      const hPrev = d.previsto > 0 ? (d.previsto / maxVal) * chartH : 0;
      const hFalt = d.falt > 0 ? (d.falt / maxVal) * chartH : 0;
      const idx = open ? 1 : 0;
      const lbl = (x, h, v) => h > 18 ? `<text x="${x}" y="${padT + chartH - h - 4}" text-anchor="middle" font-size="9" fill="#64748b" font-family="JetBrains Mono,monospace">${v.toFixed(1)}</text>` : '';
      return `
        <g onclick="CCON.toggleAndarAberto('${esc(d.andar).replace(/'/g, "\\'")}')" style="cursor:pointer;">
          <rect x="${x0}" y="${padT + chartH - hProj}" width="${barW}" height="${hProj}" fill="${cores.proj[idx]}" rx="2"/>
          ${lbl(x0 + barW / 2, hProj, d.proj)}
          ${d.previsto > 0 ? `<rect x="${x0 + barW + gap}" y="${padT + chartH - hPrev}" width="${barW}" height="${hPrev}" fill="${cores.prev[idx]}" rx="2"/>${lbl(x0 + barW + gap + barW / 2, hPrev, d.previsto)}` :
        `<rect x="${x0 + barW + gap}" y="${padT + chartH - 2}" width="${barW}" height="2" fill="#e2e8f0" rx="1"/>`}
          <rect x="${x0 + barW * 2 + gap * 2}" y="${padT + chartH - hConc}" width="${barW}" height="${hConc}" fill="${cores.conc[idx]}" rx="2"/>
          ${lbl(x0 + barW * 2 + gap * 2 + barW / 2, hConc, d.conc)}
          ${d.falt > 0 ? `<rect x="${x0 + barW * 3 + gap * 3}" y="${padT + chartH - hFalt}" width="${barW}" height="${hFalt}" fill="${cores.falt[idx]}" rx="2"/>${lbl(x0 + barW * 3 + gap * 3 + barW / 2, hFalt, d.falt)}` : ''}
          <text x="${x0 + barW * 2 + gap * 1.5}" y="${padT + chartH + 14}" text-anchor="middle" font-size="10" fill="${open ? '#b8960a' : '#94a3b8'}" font-weight="${open ? 700 : 400}" font-family="Inter,sans-serif">${esc(d.andar.length > 10 ? d.andar.slice(0, 9) + '…' : d.andar)}</text>
        </g>`;
    }).join('');

    const chips = tipos.map(t => `
      <button class="btn ${andarFiltroTipo === t ? 'btn-primario' : 'btn-secundario'} btn-sm" style="border-radius:100px;padding:4px 14px;font-size:0.75rem;" onclick="CCON.setAndarFiltroTipo('${esc(t).replace(/'/g, "\\'")}')">${t === 'todos' ? 'Todos os tipos' : esc(t)}</button>`).join('');

    const legenda = [
      ['rgba(59,130,246,0.8)', 'Vol. Total Projeto'],
      ['rgba(249,115,22,0.8)', 'Previsto c/ Perda'],
      ['rgba(34,197,94,0.8)', 'Executado'],
      ['rgba(239,68,68,0.8)', 'Faltando'],
    ].map(([cor, label]) => `
      <span style="display:inline-flex;align-items:center;gap:6px;font-size:0.75rem;color:var(--cor-texto-secundario);">
        <span style="width:12px;height:12px;border-radius:3px;background:${cor};display:inline-block;"></span>${label}
      </span>`).join('');

    let tabelaAndar = '';
    if (andarAberto) {
      const pecasAndar = pcs.filter(p => p.andar === andarAberto && (andarFiltroTipo === 'todos' || p.tipo === andarFiltroTipo));
      tabelaAndar = `
        <div style="margin-top:12px;border:1px solid var(--cor-primaria);border-radius:8px;overflow:hidden;">
          <div style="padding:10px 14px;background:var(--cor-primaria-light,#fef9e7);display:flex;justify-content:space-between;align-items:center;">
            <span style="font-weight:700;font-size:0.85rem;color:var(--cor-primaria-dark,#b8960a);">${esc(andarAberto)}</span>
            <button class="btn btn-secundario btn-sm" onclick="CCON.toggleAndarAberto('${esc(andarAberto).replace(/'/g, "\\'")}')">✕</button>
          </div>
          <table class="tabela">
            <thead><tr><th>Peça</th><th class="col-num">Previsto</th><th class="col-num">Exec.</th><th class="col-num">Falt.</th><th>%</th></tr></thead>
            <tbody>
              ${!pecasAndar.length ? `<tr><td colspan="5" style="text-align:center;color:var(--cor-texto-muted);padding:14px;">Sem peças</td></tr>` :
              pecasAndar.map(p => {
                const vc = Math.min(p.volume || 0, CC.volLancadoPeca(p.id, lans));
                const pct = CC.pctConcretado(p, lans);
                return `
                  <tr>
                    <td><b style="font-size:0.82rem;">${esc(p.nome)}</b> <span style="font-size:0.7rem;color:var(--cor-texto-muted);">${esc(p.tipo)}</span></td>
                    <td class="col-num" style="font-family:var(--font-mono);font-size:0.75rem;">${CC.fmt4(p.volume)}</td>
                    <td class="col-num" style="font-family:var(--font-mono);font-size:0.75rem;color:#16a34a;">${CC.fmt4(vc)}</td>
                    <td class="col-num" style="font-family:var(--font-mono);font-size:0.75rem;color:#ef4444;">${CC.fmt4(Math.max(0, (p.volume || 0) - vc))}</td>
                    <td>
                      <span style="display:inline-flex;align-items:center;gap:6px;">
                        <span style="width:48px;height:4px;background:#f1f5f9;border-radius:2px;overflow:hidden;display:inline-block;"><span style="display:block;height:100%;width:${Math.min(100, pct)}%;background:${pct >= 100 ? '#16a34a' : 'var(--cor-primaria)'};"></span></span>
                        <span style="font-family:var(--font-mono);font-size:0.72rem;font-weight:700;color:var(--cor-primaria-dark,#b8960a);">${CC.fmt1(pct)}%</span>
                      </span>
                    </td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`;
    }

    return `
      <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;">${chips}</div>
      <div style="display:flex;gap:16px;margin-bottom:12px;flex-wrap:wrap;align-items:center;">
        ${legenda}
        <span style="font-size:0.68rem;color:var(--cor-texto-muted);margin-left:auto;">${indicePerda !== 0 ? `* Perda média atual: ${CC.fmt1(Math.abs(indicePerda))}% — aplicada ao volume faltando` : 'Lance BTs para calcular a perda média'}</span>
      </div>
      <div style="overflow-x:auto;">
        <svg width="${Math.max(totalW + padL + 20, 400)}" height="${svgH}" style="display:block;">
          ${grades}
          <text x="10" y="${padT + chartH / 2}" text-anchor="middle" font-size="10" fill="#94a3b8" font-family="JetBrains Mono,monospace" transform="rotate(-90,10,${padT + chartH / 2})">m³</text>
          ${barras}
          <line x1="${padL}" y1="${padT + chartH}" x2="${padL + totalW + 10}" y2="${padT + chartH}" stroke="#cbd5e1" stroke-width="1.5"/>
        </svg>
      </div>
      ${tabelaAndar}`;
  }

  return {
    init, recarregar, renderizar,
    setAba, setFiltroAndar, setFiltroConc,
    toggleTipo, abrirDetalhePeca,
    exportarCSV,
    abrirLancarBT, btSetConc, btSetBT, btIniciarEdicao,
    btUpd, btBusca, btEsconder100, btAddLinha, btRemLinha, btUpdLinha, btSalvar,
    setFiltroRelConc, setFiltroRelAndar, setAndarFiltroTipo, toggleAndarAberto,
  };
})();

const CCON = ControleConcreto;

function onObraChanged() {
  ControleConcreto.recarregar();
}

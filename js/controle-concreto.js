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
  let filtroBarAberto = null; // 'andar' | 'concretagem' | null (FiltroBar original)
  let relFiltroBarAberto = null;

  // Estado dos gráficos
  let tipoAberto = null;      // GraficoTipos: tipo expandido
  let andarAberto = null;     // GraficoAndares: andar expandido
  let andarFiltroTipo = 'todos';

  // Estado do modal Lançar BT
  let bt = null;

  // Estado do wizard de concretagem (movido do Levantamento de Concreto)
  let cw = null;

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
    // Deep-link vindo do Dashboard (gráfico Fundação/Estrutura, clique na
    // barra de um andar): ?andar=NomeDoAndar já abre na aba Relatórios com
    // aquele andar expandido, em vez de cair na tela padrão da Operacional.
    const andarUrl = new URLSearchParams(window.location.search).get('andar');
    if (andarUrl) { aba = 'relatorios'; andarAberto = andarUrl; }
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
        <div class="cc-view">
        <div class="page-header">
          <div><h2>📊 Controle de Concreto</h2><span class="subtitulo">Lançamento de BTs, previsto × realizado e índices de perda</span></div>
        </div>
        <div class="cc-empty"><div style="font-size:2rem;margin-bottom:8px;">🪨</div>
          Nenhuma peça ou concretagem cadastrada ainda.<br>Monte a base no <a href="levantamento-concreto.html" style="color:var(--cor-primaria-dark);font-weight:600;">Levantamento de Concreto</a>.
        </div>
        </div>`;
      return;
    }

    c.innerHTML = `
      <div class="cc-view">
      <div class="page-header">
        <div>
          <h2>📊 Controle de Concreto</h2>
          <span class="subtitulo">Lançamento de BTs, previsto × realizado e índices de perda</span>
        </div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          <button class="btn btn-dark btn-sm" onclick="CCON.abrirConcretagens()">◈ Concretagens</button>
          <div class="aba-toggle">
            <button class="aba-btn ${aba === 'operacional' ? 'ativo' : ''}" onclick="CCON.setAba('operacional')">Operacional</button>
            <button class="aba-btn ${aba === 'relatorios' ? 'ativo' : ''}" onclick="CCON.setAba('relatorios')">Relatórios</button>
          </div>
        </div>
      </div>
      <div id="cc-body"></div>
      </div>
    `;
    if (aba === 'operacional') renderOperacional();
    else renderRelatorios();
  }

  function setAba(a) { aba = a; renderizar(); }

  // ══════════════════════════════════════════
  // ABA OPERACIONAL
  // ══════════════════════════════════════════
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

    // Labels do FiltroBar
    const labelAndar = filtroAndar === 'todos' ? 'Todos os Andares' : filtroAndar;
    const concSel = concretagens.find(c => c.id === filtroConc);
    const labelConc = filtroConc === 'todas' ? 'Todas as Concretagens' : `Nº ${concSel?.numero} — ${concSel?.data || ''}`;

    el.innerHTML = `
      <div class="cc-filtroBar">
        ${filtroBarAberto ? `<div class="cc-filtroOverlay" onclick="CCON.fbFechar()"></div>` : ''}
        <div class="cc-filtroCard ${filtroBarAberto === 'andar' ? 'cc-filtroCardActive' : ''}" onclick="CCON.fbToggle('andar')">
          <div class="cc-filtroCardLeft">
            <span class="cc-filtroCardLabel">Andar</span>
            <span class="cc-filtroCardValue ${filtroAndar !== 'todos' ? 'cc-filtroCardValueActive' : ''}">${esc(labelAndar)}</span>
          </div>
          <span class="cc-filtroChevron ${filtroBarAberto === 'andar' ? 'cc-filtroChevronOpen' : ''}">▼</span>
          ${filtroBarAberto === 'andar' ? `
            <div class="cc-filtroDropdown" onclick="event.stopPropagation()">
              <button class="cc-filtroOption ${filtroAndar === 'todos' ? 'cc-filtroOptionActive' : ''}" onclick="CCON.fbSelAndar('todos')">Todos os Andares ${filtroAndar === 'todos' ? '✓' : ''}</button>
              ${todosAndares().map(a => `<button class="cc-filtroOption ${filtroAndar === a ? 'cc-filtroOptionActive' : ''}" onclick="CCON.fbSelAndar('${esc(a).replace(/'/g, "\\'")}')">${esc(a)} ${filtroAndar === a ? '✓' : ''}</button>`).join('')}
            </div>` : ''}
        </div>
        <div class="cc-filtroCard ${filtroBarAberto === 'concretagem' ? 'cc-filtroCardActive' : ''}" onclick="CCON.fbToggle('concretagem')">
          <div class="cc-filtroCardLeft">
            <span class="cc-filtroCardLabel">Concretagem</span>
            <span class="cc-filtroCardValue ${filtroConc !== 'todas' ? 'cc-filtroCardValueActive' : ''}">${esc(labelConc)}</span>
          </div>
          <span class="cc-filtroChevron ${filtroBarAberto === 'concretagem' ? 'cc-filtroChevronOpen' : ''}">▼</span>
          ${filtroBarAberto === 'concretagem' ? `
            <div class="cc-filtroDropdown" onclick="event.stopPropagation()">
              <button class="cc-filtroOption ${filtroConc === 'todas' ? 'cc-filtroOptionActive' : ''}" onclick="CCON.fbSelConc('todas')">Todas as Concretagens ${filtroConc === 'todas' ? '✓' : ''}</button>
              ${[...concsFiltro].sort((a, b) => a.numero - b.numero).map(c => `<button class="cc-filtroOption ${filtroConc === c.id ? 'cc-filtroOptionActive' : ''}" onclick="CCON.fbSelConc('${c.id}')">${esc(concLabel(c))} ${filtroConc === c.id ? '✓' : ''}</button>`).join('')}
              ${!concsFiltro.length ? `<div style="padding:16px;color:var(--cv-text3);font-size:13px;text-align:center;">Nenhuma concretagem para este andar</div>` : ''}
            </div>` : ''}
        </div>
      </div>

      <div class="cc-kpiGrid">
        <div class="cc-kpi"><div class="cc-kpiIcon">📦</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Volume Total do Projeto</div><div class="cc-kpiValue">${CC.fmt4(kpis.totalVol)}<span class="cc-kpiUnit">m³</span></div><div class="cc-kpiSub">${pecasKPI.length} peças ${filtroConc !== 'todas' ? 'nesta concretagem' : 'cadastradas'}</div></div></div>
        <div class="cc-kpi cc-kpiBlue"><div class="cc-kpiIcon">📊</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Vol. Previsto (proj.×1.1)</div><div class="cc-kpiValue">${CC.fmt4(kpis.totalVol * 1.1)}<span class="cc-kpiUnit">m³</span></div><div class="cc-kpiSub">volume projeto + 10% perda esperada</div></div></div>
        <div class="cc-kpi cc-kpiGreen"><div class="cc-kpiIcon">✅</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Volume Real Concretado</div><div class="cc-kpiValue">${CC.fmt4(kpis.concVol)}<span class="cc-kpiUnit">m³</span></div><div class="cc-kpiSub">soma dos volumes previstos das BTs lançadas</div></div></div>
        <div class="cc-kpi cc-kpiPurple"><div class="cc-kpiIcon">🚛</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Volume Executado de Projeto</div><div class="cc-kpiValue">${CC.fmt4(kpis.execVol)}<span class="cc-kpiUnit">m³</span></div><div class="cc-kpiSub">${CC.fmt1(kpis.totalVol > 0 ? kpis.execVol / kpis.totalVol * 100 : 0)}% do projeto · saída real do caminhão</div></div></div>
        <div class="cc-kpi cc-kpiRed"><div class="cc-kpiIcon">⚠️</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Faltando (Projeto)</div><div class="cc-kpiValue">${CC.fmt4(kpis.projFaltando)}<span class="cc-kpiUnit">m³</span></div><div class="cc-kpiSub">proj. − BTs lançadas</div></div></div>
        <div class="cc-kpi cc-kpiOrange"><div class="cc-kpiIcon">📉</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Índice de Perda</div><div class="cc-kpiValue">${CC.fmt1(pInfo.indice)}<span class="cc-kpiUnit">%</span></div><div class="cc-kpiSub">(prev. − exec. + solo) / prev. s/ cocho · cocho: ${CC.fmt4(pInfo.perdaCocho)} m³${pInfo.perdaSolo > 0.001 ? ` · solo: ${CC.fmt4(pInfo.perdaSolo)} m³` : ''}</div></div></div>
      </div>

      <div style="display:flex;justify-content:flex-end;margin-bottom:8px;">
        <button style="background:var(--cv-surface2);border:1px solid var(--cv-border);color:var(--cv-text2);font-size:12px;padding:6px 14px;border-radius:var(--cv-radius-sm);cursor:pointer;display:flex;align-items:center;gap:6px;font-family:var(--cv-sans);" onclick="CCON.exportarCSV()">📥 Exportar Peças por Concretagem</button>
      </div>

      ${kpis.pecasExcesso.length ? `
        <div class="cc-alertRed">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap;">
            <span style="font-size:18px;">⚠️</span>
            <span style="font-weight:700;font-size:14px;">${kpis.pecasExcesso.length} peça${kpis.pecasExcesso.length !== 1 ? 's' : ''} lançada${kpis.pecasExcesso.length !== 1 ? 's' : ''} além de 100% do projeto</span>
            <span style="font-family:var(--cv-mono);font-size:11px;color:var(--cv-text3);margin-left:auto;">Excesso total: ${CC.fmt4(kpis.pecasExcesso.reduce((s, p) => s + p.excesso, 0))} m³</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            ${kpis.pecasExcesso.map(p => `
              <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 12px;background:rgba(239,68,68,0.06);border-radius:var(--cv-radius-sm);border-left:3px solid var(--cv-red);flex-wrap:wrap;">
                <div><span style="font-weight:600;font-size:13px;color:var(--cv-text);">${esc(p.nome)}</span><span style="font-size:12px;color:var(--cv-text3);margin-left:8px;">${esc(p.andar)} · ${esc(p.tipo)}</span></div>
                <div style="font-family:var(--cv-mono);font-size:12px;text-align:right;">
                  <span style="color:var(--cv-text2);">Projeto: ${CC.fmt4(p.volume)} m³</span>
                  <span style="color:var(--cv-red);font-weight:700;margin-left:12px;">Lançado: ${CC.fmt4(p.lanTotal)} m³</span>
                  <span style="background:var(--cv-red);color:#fff;font-weight:700;font-size:11px;padding:2px 8px;border-radius:4px;margin-left:8px;">+${CC.fmt4(p.excesso)} m³ a mais</span>
                </div>
              </div>`).join('')}
          </div>
          <div style="margin-top:10px;font-size:11px;color:var(--cv-text3);">ℹ Corrija os lançamentos dessas peças — o Volume Real Concretado foi limitado ao projeto.</div>
        </div>` : ''}

      ${kpis.pecasPerdaSolo && kpis.pecasPerdaSolo.length ? `
        <div class="cc-alertBlue">
          <details>
            <summary style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;cursor:pointer;list-style:none;">
              <span style="font-size:18px;">ℹ️</span>
              <span style="font-weight:700;font-size:14px;">${kpis.pecasPerdaSolo.length} estaca${kpis.pecasPerdaSolo.length !== 1 ? 's' : ''} consumiu mais concreto que o projeto — perda de solo esperada</span>
              <span style="font-family:var(--cv-mono);font-size:11px;color:var(--cv-text3);margin-left:auto;">Perda de solo: ${CC.fmt4(kpis.perdaSoloTotal)} m³ · já entra no índice de perda acima · clique pra ver peça por peça</span>
            </summary>
            <div style="display:flex;flex-direction:column;gap:6px;margin-top:10px;">
              ${kpis.pecasPerdaSolo.map(p => `
                <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 12px;background:rgba(59,130,246,0.06);border-radius:var(--cv-radius-sm);border-left:3px solid var(--cv-blue);flex-wrap:wrap;">
                  <div><span style="font-weight:600;font-size:13px;color:var(--cv-text);">${esc(p.nome)}</span><span style="font-size:12px;color:var(--cv-text3);margin-left:8px;">${esc(p.andar)}</span></div>
                  <div style="font-family:var(--cv-mono);font-size:12px;text-align:right;">
                    <span style="color:var(--cv-text2);">Projeto: ${CC.fmt4(p.volume)} m³</span>
                    <span style="color:var(--cv-blue);font-weight:700;margin-left:12px;">Real: ${CC.fmt4(p.lanTotal)} m³</span>
                    <span style="background:var(--cv-blue);color:#fff;font-weight:700;font-size:11px;padding:2px 8px;border-radius:4px;margin-left:8px;">+${CC.fmt4(p.excesso)} m³ de solo</span>
                  </div>
                </div>`).join('')}
            </div>
            <div style="margin-top:10px;font-size:11px;color:var(--cv-text3);">ℹ Normal em estacas — o furo real costuma sair maior que o calculado no projeto. Não precisa corrigir; o Volume Executado de Projeto continua limitado a 100% de cada peça.</div>
          </details>
        </div>` : ''}

      <div class="cc-launchBar">
        <div class="cc-launchBarContent">
          <div class="cc-launchBarLeft">
            <div class="cc-launchBarBadge">⚡ Pronto para Lançamento</div>
            <div class="cc-launchBarTitle">Lançamento de Concretagem</div>
            <div class="cc-launchBarSub">Monte as concretagens aqui mesmo e lance as BTs com agilidade.</div>
          </div>
          <div class="cc-launchBarRight">
            <div class="cc-launchBarActions">
              <a class="cc-launchBarSmallBtn" href="levantamento-concreto.html">
                <span class="cc-launchBarSmallBtnIcon">🪨</span>
                Levantamento
                <span class="cc-launchBarSmallBtnSub">Base de peças</span>
              </a>
            </div>
            <button class="cc-btnLaunch" onclick="CCON.abrirLancarBT()">⊕ LANÇAR BT →</button>
          </div>
        </div>
      </div>

      <div class="cc-grid2">
        <div class="cc-panel">
          <div class="cc-panelTitle">Progresso por Tipo <span style="font-family:var(--cv-mono);font-size:10px;color:var(--cv-text3);font-weight:400;text-transform:none;letter-spacing:0;">▼ clique para ver peças</span></div>
          <div id="cc-grafico-tipos"></div>
        </div>

        <div>
          <div id="cc-ultima-bt"></div>
          <div class="cc-panel">
            <div class="cc-panelTitle">Status das BTs por Concretagem</div>
            <div id="cc-grafico-bts"></div>
          </div>
        </div>
      </div>
    `;
    renderGraficoTipos(pecasKPI, lansKPI);
    renderGraficoBTs(btsG, lansG, concsG);
    renderUltimaBT();
  }

  // ── FiltroBar (dropdown cards, igual ao original) ──
  function fbToggle(tipo) { filtroBarAberto = filtroBarAberto === tipo ? null : tipo; renderOperacional(); }
  function fbFechar() { filtroBarAberto = null; renderOperacional(); }
  function fbSelAndar(v) { filtroAndar = v; filtroConc = 'todas'; filtroBarAberto = null; renderOperacional(); }
  function fbSelConc(v) { filtroConc = v; filtroBarAberto = null; renderOperacional(); }

  // ── Progresso por tipo (acordeão) ───────────
  function renderGraficoTipos(ps, lans) {
    const el = document.getElementById('cc-grafico-tipos');
    if (!el) return;
    const dados = CC.calcPorTipo(ps, lans);
    if (!dados.length) {
      el.innerHTML = `<div class="cc-empty">Sem peças para exibir.</div>`;
      return;
    }
    el.innerHTML = dados.map((t, i) => {
      const open = tipoAberto === t.tipo;
      const cor = CC.CORES[i % CC.CORES.length];
      return `
        <div style="margin-bottom:8px;">
          <div onclick="CCON.toggleTipo('${esc(t.tipo).replace(/'/g, "\\'")}')"
            style="display:flex;align-items:center;gap:14px;padding:14px 16px;background:${open ? 'var(--cor-primaria-ultra-light)' : 'var(--cv-surface2)'};border:1px solid ${open ? 'var(--cv-accent)' : 'var(--cv-border)'};cursor:pointer;transition:all 0.2s;">
            <div style="width:14px;height:14px;background:${cor};flex-shrink:0;border-radius:2px;"></div>
            <div style="flex:1;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:6px;">
                <span style="font-weight:700;font-size:15px;letter-spacing:0.5px;text-transform:uppercase;color:${open ? 'var(--cv-accent3)' : 'var(--cv-text)'};">${esc(t.tipo)} <span style="font-family:var(--cv-mono);font-size:11px;color:var(--cv-text3);margin-left:8px;font-weight:400;text-transform:none;">${t.count} peça${t.count !== 1 ? 's' : ''}</span></span>
                <span style="display:flex;gap:16px;align-items:center;">
                  <span style="font-family:var(--cv-mono);font-size:13px;color:var(--cv-green);font-weight:700;">${CC.fmt4(t.conc)} m³</span>
                  <span style="font-family:var(--cv-mono);font-size:11px;color:var(--cv-text3);">/ ${CC.fmt4(t.prog)} m³</span>
                  <span style="font-family:var(--cv-mono);font-size:14px;color:var(--cv-accent3);font-weight:700;min-width:52px;text-align:right;">${CC.fmt1(t.pct)}%</span>
                  <span style="color:var(--cv-text3);font-size:13px;">${open ? '▲' : '▼'}</span>
                </span>
              </div>
              <div style="height:7px;background:var(--cv-surface);border-radius:1px;overflow:hidden;">
                <div style="height:100%;width:${Math.min(100, t.pct)}%;background:${t.pct >= 100 ? 'var(--cv-green)' : cor};transition:width 0.5s;"></div>
              </div>
            </div>
          </div>
          ${open ? `<div style="border:1px solid var(--cv-accent);border-top:none;background:var(--cv-surface);">
            ${t.pecas.map(p => {
              const vc = Math.min(p.volume, CC.volLancadoPeca(p.id, lans));
              const pct = CC.pctConcretado(p, lans);
              const falt = Math.max(0, p.volume - vc);
              return `
                <div onclick="event.stopPropagation();CCON.abrirDetalhePeca('${p.id}')" style="padding:12px 16px;border-bottom:1px solid var(--cv-border);cursor:pointer;">
                  <div style="display:flex;justify-content:space-between;margin-bottom:5px;flex-wrap:wrap;gap:4px;">
                    <span style="font-size:14px;font-weight:600;color:var(--cv-text);">${esc(p.nome)} <span style="color:var(--cv-text3);font-size:12px;font-weight:400;">· ${esc(p.andar)}</span></span>
                    <span style="font-family:var(--cv-mono);font-size:14px;color:var(--cv-accent3);font-weight:700;">${CC.fmt1(pct)}% 🔍</span>
                  </div>
                  <div style="height:6px;background:var(--cv-surface2);border-radius:1px;overflow:hidden;margin-bottom:5px;">
                    <div style="height:100%;width:${Math.min(100, pct)}%;background:${pct >= 100 ? 'var(--cv-green)' : 'var(--cv-accent)'};"></div>
                  </div>
                  <div style="font-family:var(--cv-mono);font-size:12px;color:var(--cv-text3);">
                    feito ${CC.fmt4(vc)} m³ · faltando <span style="color:${falt < 0.005 ? 'var(--cv-green)' : 'var(--cv-red)'};">${falt < 0.005 ? '0' : CC.fmt4(falt)} m³</span> · projeto ${CC.fmt4(p.volume)} m³
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
      <div class="cc-lastBtGrid mb-2" style="grid-template-columns:repeat(3,1fr);">
        <div class="cc-kpi" style="flex-direction:column;"><div class="cc-kpiLabel">Projeto</div><div class="cc-kpiValue" style="font-size:1.1rem;">${CC.fmt4(p.volume)} <span style="font-size:0.7rem;">m³</span></div></div>
        <div class="cc-kpi" style="flex-direction:column;"><div class="cc-kpiLabel">Concretado</div><div class="cc-kpiValue" style="font-size:1.1rem;color:${excesso > 0 ? 'var(--cv-red)' : pct >= 100 ? 'var(--cv-green)' : 'var(--cv-text)'};">${CC.fmt4(lanTotal)} <span style="font-size:0.7rem;">m³</span></div>${excesso > 0 ? `<div class="cc-kpiSub" style="color:var(--cv-red);">+${CC.fmt4(excesso)} m³ excesso</div>` : ''}</div>
        <div class="cc-kpi" style="flex-direction:column;"><div class="cc-kpiLabel">Faltando</div><div class="cc-kpiValue" style="font-size:1.1rem;">${CC.fmt4(falt)} <span style="font-size:0.7rem;">m³</span></div></div>
      </div>
      <div style="height:8px;background:var(--cv-surface2);border-radius:2px;overflow:hidden;margin-bottom:4px;">
        <div style="height:100%;width:${Math.min(100, pct)}%;background:${pct >= 100 ? 'var(--cv-green)' : 'var(--cv-accent)'};"></div>
      </div>
      <div style="font-family:var(--cv-mono);font-size:0.8rem;color:var(--cv-accent3);font-weight:700;text-align:right;margin-bottom:14px;">${CC.fmt1(pct)}%</div>
      ${!lansP.length ? `<div class="cc-empty">Nenhum lançamento nesta peça ainda.</div>` :
      Object.values(byConc).map(g => {
        const totalG = g.bts.reduce((s, x) => s + (x.l.volume || 0), 0);
        return `
          <div style="border:1px solid var(--cv-border); margin-bottom:10px;overflow:hidden;">
            <div style="background:var(--cv-surface2);padding:8px 12px;font-weight:700;font-size:0.78rem;text-transform:uppercase;letter-spacing:0.3px;">
              Concretagem Nº${g.conc?.numero || '?'} <span style="color:var(--cv-text3);font-weight:400;text-transform:none;">— ${esc(g.conc?.data || '')}${g.conc?.descricao ? ` | ${esc(g.conc.descricao)}` : ''}</span>
            </div>
            ${g.bts.map(x => `
              <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-top:1px solid var(--cv-border);">
                <span style="font-family:var(--cv-mono);font-size:0.78rem;font-weight:700;color:var(--cv-accent3);min-width:52px;">BT-${x.bt?.numero || '?'}</span>
                <div style="flex:1;height:5px;background:var(--cv-surface2);border-radius:1px;overflow:hidden;">
                  <div style="height:100%;width:${Math.min(100, x.pctBT)}%;background:${x.l.volume > p.volume ? 'var(--cv-red)' : 'var(--cv-green)'};"></div>
                </div>
                <span style="font-family:var(--cv-mono);font-size:0.78rem;">${CC.fmt4(x.l.volume)} m³</span>
                <span style="font-family:var(--cv-mono);font-size:0.7rem;color:var(--cv-text3);">${CC.fmt1(x.pctBT)}% desta peça</span>
                ${x.l.volume > p.volume ? `<span class="cc-badge" style="background:var(--cv-red);color:#fff;">+${CC.fmt4(x.l.volume - p.volume)} m³</span>` : ''}
              </div>`).join('')}
            <div style="padding:6px 12px;border-top:1px solid var(--cv-border);font-family:var(--cv-mono);font-size:0.75rem;text-align:right;color:var(--cv-text2);">Total: <b>${CC.fmt4(totalG)} m³</b></div>
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
      el.innerHTML = `<div class="cc-empty">Nenhuma concretagem configurada.</div>`;
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
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:4px;">
            <span style="font-weight:700;font-size:14px;letter-spacing:0.5px;color:var(--cv-text);">CONC. Nº${c.numero} <span style="color:var(--cv-text3);font-weight:400;font-size:11px;">· ${esc(c.data || '')}${c.descricao ? ` · ${esc(c.descricao)}` : ''}</span></span>
            <span style="font-family:var(--cv-mono);font-size:12px;color:var(--cv-text2);">${CC.fmt4(volUsado)} / ${CC.fmt4(volPrev)} m³</span>
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
              const corBorda = lancada ? (acima ? 'var(--cv-blue)' : 'var(--cv-green)') : 'var(--cv-border)';
              return `
                <div onclick="CCON.abrirLancarBT('${c.id}', '${b.id}')" style="background:var(--cv-surface2);border:1.5px solid ${corBorda};padding:12px 16px;min-width:100px;cursor:pointer;transition:filter 0.15s;">
                  <div style="font-family:var(--cv-mono);font-size:11px;color:var(--cv-text3);margin-bottom:4px;">BT-${b.numero}</div>
                  <div style="font-weight:700;font-size:22px;color:${lancada ? (acima ? 'var(--cv-blue)' : 'var(--cv-green)') : 'var(--cv-text3)'};">${lancada ? CC.fmt4(usado) : '—'}</div>
                  <div style="font-family:var(--cv-mono);font-size:11px;color:var(--cv-text3);margin-top:2px;">/ ${CC.fmt4(b.volumePrevisto)} m³</div>
                  ${lancada ? `
                    <div style="height:4px;background:var(--cv-surface);margin-top:8px;overflow:hidden;border-radius:1px;">
                      <div style="height:100%;width:${Math.min(120, b.volumePrevisto > 0 ? (usado / b.volumePrevisto) * 100 : 0)}%;background:${acima ? 'var(--cv-blue)' : 'var(--cv-green)'};"></div>
                    </div>
                    <div style="font-family:var(--cv-mono);font-size:11px;margin-top:5px;display:flex;flex-direction:column;gap:2px;">
                      ${perdaCam !== 0 ? `<span style="color:${perdaCam > 0 ? 'var(--cv-red)' : 'var(--cv-blue)'};font-weight:700;">${perdaCam > 0 ? `▼ ${CC.fmt4(perdaCam)} m³` : `▲ +${CC.fmt4(Math.abs(perdaCam))} m³`}</span>` : ''}
                      ${b.volumePrevisto > 0 ? `<span style="color:${perdaCam > 0 ? 'var(--cv-red)' : perdaCam < 0 ? 'var(--cv-blue)' : 'var(--cv-green)'};font-weight:700;">${perdaCam > 0 ? `${CC.fmt1((perdaCam / b.volumePrevisto) * 100)}% perda` : perdaCam < 0 ? `${CC.fmt1((Math.abs(perdaCam) / b.volumePrevisto) * 100)}% sobra` : '0% perda'}</span>` : ''}
                      ${perdaCocho > 0 ? `<span style="color:var(--cv-accent3);">cocho: ${CC.fmt4(perdaCocho)} m³ · real: ${CC.fmt1(perdaReal > 0 ? (perdaReal / b.volumePrevisto) * 100 : 0)}% perda</span>` : ''}
                    </div>` : `<div style="font-family:var(--cv-mono);font-size:10px;color:var(--cv-text3);margin-top:5px;">pendente</div>`}
                </div>`;
            }).join('')}
          </div>
        </div>`;
    }).join('') || `<div class="cc-empty">Nenhuma BT configurada.</div>`;
  }

  // ── Última BT lançada ───────────────────────
  function renderUltimaBT() {
    const el = document.getElementById('cc-ultima-bt');
    if (!el) return;
    if (!lancamentos.length) { el.innerHTML = ''; return; }
    const ultimo = [...lancamentos].sort((a, b) => tsMillis(b) - tsMillis(a))[0];
    const b = btsConfig.find(x => x.id === ultimo.btConfigId);
    const c = b ? concretagens.find(x => x.id === b.concretagemId) : null;
    if (!b) { el.innerHTML = ''; return; }
    const lansBT = lancamentos.filter(l => l.btConfigId === b.id);
    const executado = lansBT.reduce((s, l) => s + (l.volume || 0), 0);
    const perdaUltima = (b.volumePrevisto || 0) - executado;
    el.innerHTML = `
      <div class="cc-lastBtPanel">
        <div class="cc-lastBtBadge">Última BT</div>
        <div class="cc-lastBtNum">BT-${b.numero}</div>
        <div class="cc-lastBtGrid">
          <div class="cc-lastBtItem"><span class="cc-lastBtItemLabel">Concretagem</span><span class="cc-lastBtItemValue" style="color:var(--cv-accent3);">Nº ${c?.numero || '—'}</span></div>
          <div class="cc-lastBtItem"><span class="cc-lastBtItemLabel">Previsto</span><span class="cc-lastBtItemValue">${CC.fmt4(b.volumePrevisto)} m³</span></div>
          <div class="cc-lastBtItem"><span class="cc-lastBtItemLabel">Executado</span><span class="cc-lastBtItemValue" style="color:var(--cv-green);">${CC.fmt4(executado)} m³</span></div>
          <div class="cc-lastBtItem"><span class="cc-lastBtItemLabel">${perdaUltima >= 0 ? 'Perda Caminhão' : 'Sobra Inesperada'}</span><span class="cc-lastBtItemValue" style="color:${perdaUltima > 0 ? 'var(--cv-red)' : 'var(--cv-blue)'};">${CC.fmt4(Math.abs(perdaUltima))} m³</span></div>
        </div>
        <div style="margin-top:12px;"><span class="cc-badge cc-badgeComplete">Concluído ✓</span></div>
        <button class="cc-lastBtBtn" onclick="CCON.abrirLancarBT('${b.concretagemId}', '${b.id}')">Ver detalhes da BT →</button>
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

  // ══════════════════════════════════════════
  // PDF POR CONCRETAGEM — guardado no Firebase Storage (PDF de verdade,
  // multi-página, aberto em nova aba). É por CONCRETAGEM (não por BT
  // individual): uma concretagem pode ter várias BTs, mas o PDF/projeto é
  // um só, do documento da concretagem inteira.
  // ══════════════════════════════════════════
  function abrirUploadPdfConc(concId) {
    document.getElementById('cc-pdfconc-id').value = concId;
    document.getElementById('cc-pdfconc-status').textContent = '';
    const c = concretagens.find(x => x.id === concId);
    const atual = document.getElementById('cc-pdfconc-atual');
    atual.innerHTML = c?.pdfUrl
      ? `<a href="${c.pdfUrl}" target="_blank" class="btn btn-secundario btn-sm">📎 Abrir PDF atual (Nº${c.numero})</a>`
      : `<p class="text-sm text-muted">Nenhum PDF anexado ainda a esta concretagem.</p>`;
    Utils.abrirModal('modal-cc-pdfconc');
  }

  async function onPdfConcArquivo(input) {
    const file = input.files[0];
    if (!file) return;
    const concId = document.getElementById('cc-pdfconc-id').value;
    const statusEl = document.getElementById('cc-pdfconc-status');
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      statusEl.textContent = 'Selecione um arquivo PDF.';
      return;
    }
    statusEl.textContent = 'Enviando...';
    try {
      const b64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const path = `obras/${obraId}/concreto-concretagens/${concId}.pdf`;
      const url = await uploadImagem(path, b64);
      await Database.atualizar(obraId, COL_CONCS, concId, { pdfUrl: url });
      const c = concretagens.find(x => x.id === concId);
      if (c) c.pdfUrl = url;
      statusEl.textContent = '✓ PDF anexado!';
      Utils.toast('✓ PDF anexado à concretagem', 'sucesso');
      renderLancarBT();
    } catch (e) {
      statusEl.textContent = 'Erro ao enviar: ' + e.message;
      Utils.toast('Erro ao enviar PDF.', 'erro');
    }
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
      const concSel = concretagens.find(c => c.id === bt.concId);
      html += `<div style="margin-bottom:14px;">
        <button class="btn btn-secundario btn-sm" onclick="CCON.abrirUploadPdfConc('${bt.concId}')">${concSel?.pdfUrl ? '📎 Ver/Trocar PDF desta concretagem' : '📎 Inserir PDF desta concretagem'}</button>
      </div>`;
      if (!btsConc.length) {
        html += `<div class="cc-empty">Nenhuma BT configurada. Configure no Levantamento de Concreto → Concretagens.</div>`;
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
          <button class="btn btn-primario" data-perm="controleConcreto:criar:bt" onclick="CCON.btSalvar()">${bt.modo === 'editar' ? '✓ Salvar Alterações' : '✓ Lançar BT'}</button>
        </div>`;
    }

    el.innerHTML = html;
    Permissions.aplicarNaTela();
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
    if(!Permissions.pode('controleConcreto','criar:bt')&&!Permissions.pode('controleConcreto','editar:bt')){Utils.toast('Sem permissão.','erro');return;}
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
  function setAndarFiltroTipo(v) { andarFiltroTipo = v; renderRelatorios(); }
  function toggleAndarAberto(a) { andarAberto = andarAberto === a ? null : a; renderRelatorios(); }

  // Donut SVG (fatias)
  function donutSVG(dados, total, size, thickness, label) {
    dados = dados.filter(d => d.val > 0);
    if (!dados.length || !total) return `<div class="cc-empty">Sem dados.</div>`;
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
    const perdaSoloRel = pcs.filter(p => p.subTipo === 'Estacas').reduce((s, p) => {
      const lanTotal = CC.volLancadoPeca(p.id, lans);
      return s + Math.max(0, lanTotal - (p.volume || 0));
    }, 0);
    const pInfo = CC.calcIndicePerda(lans, bts, perdaSoloRel);
    const prevVol = CC.calcVolumePrevisto(bts, lans);

    const donutExec = donutSVG(
      [{ val: relConc, cor: '#16a34a' }, { val: Math.max(0, relProg - relConc), cor: '#cbd5e1' }],
      relProg, 130, 20,
      { top: CC.fmt1(relProg > 0 ? relConc / relProg * 100 : 0) + '%', bot: 'executado' });
    const donutPerda = donutSVG(
      [{ val: pInfo.perdaObra, cor: '#ef4444' }, { val: Math.max(0, pInfo.perdaCaminhao), cor: '#f97316' }, { val: pInfo.totalExecutado, cor: '#16a34a' }],
      pInfo.totalPrevisto || 1, 130, 20,
      { top: CC.fmt1(pInfo.indice) + '%', bot: 'perda' });

    const labelRelConc = filtroRelConc === 'todas' ? 'Todas as Concretagens' : (() => { const c = concretagens.find(x => x.id === filtroRelConc); return `Nº ${c?.numero} — ${c?.data || ''}`; })();
    const labelRelAndar = filtroRelAndar === 'todos' ? 'Todos os Andares' : filtroRelAndar;

    el.innerHTML = `
      <div class="cc-filtroBar">
        ${relFiltroBarAberto ? `<div class="cc-filtroOverlay" onclick="CCON.rfbFechar()"></div>` : ''}
        <div class="cc-filtroCard ${relFiltroBarAberto === 'concretagem' ? 'cc-filtroCardActive' : ''}" onclick="CCON.rfbToggle('concretagem')">
          <div class="cc-filtroCardLeft">
            <span class="cc-filtroCardLabel">Concretagem</span>
            <span class="cc-filtroCardValue ${filtroRelConc !== 'todas' ? 'cc-filtroCardValueActive' : ''}">${esc(labelRelConc)}</span>
          </div>
          <span class="cc-filtroChevron ${relFiltroBarAberto === 'concretagem' ? 'cc-filtroChevronOpen' : ''}">▼</span>
          ${relFiltroBarAberto === 'concretagem' ? `
            <div class="cc-filtroDropdown" onclick="event.stopPropagation()">
              <button class="cc-filtroOption ${filtroRelConc === 'todas' ? 'cc-filtroOptionActive' : ''}" onclick="CCON.rfbSelConc('todas')">Todas as Concretagens ${filtroRelConc === 'todas' ? '✓' : ''}</button>
              ${[...concretagens].sort((a, b) => a.numero - b.numero).map(c => `<button class="cc-filtroOption ${filtroRelConc === c.id ? 'cc-filtroOptionActive' : ''}" onclick="CCON.rfbSelConc('${c.id}')">${esc(concLabel(c))} ${filtroRelConc === c.id ? '✓' : ''}</button>`).join('')}
            </div>` : ''}
        </div>
        <div class="cc-filtroCard ${relFiltroBarAberto === 'andar' ? 'cc-filtroCardActive' : ''}" onclick="CCON.rfbToggle('andar')">
          <div class="cc-filtroCardLeft">
            <span class="cc-filtroCardLabel">Andar</span>
            <span class="cc-filtroCardValue ${filtroRelAndar !== 'todos' ? 'cc-filtroCardValueActive' : ''}">${esc(labelRelAndar)}</span>
          </div>
          <span class="cc-filtroChevron ${relFiltroBarAberto === 'andar' ? 'cc-filtroChevronOpen' : ''}">▼</span>
          ${relFiltroBarAberto === 'andar' ? `
            <div class="cc-filtroDropdown" onclick="event.stopPropagation()">
              <button class="cc-filtroOption ${filtroRelAndar === 'todos' ? 'cc-filtroOptionActive' : ''}" onclick="CCON.rfbSelAndar('todos')">Todos os Andares ${filtroRelAndar === 'todos' ? '✓' : ''}</button>
              ${todosAndares().map(a => `<button class="cc-filtroOption ${filtroRelAndar === a ? 'cc-filtroOptionActive' : ''}" onclick="CCON.rfbSelAndar('${esc(a).replace(/'/g, "\\'")}')">${esc(a)} ${filtroRelAndar === a ? '✓' : ''}</button>`).join('')}
            </div>` : ''}
        </div>
      </div>

      <div class="cc-kpiGrid" style="grid-template-columns:repeat(4,1fr);">
        <div class="cc-kpi"><div class="cc-kpiIcon">📐</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Vol. Programado</div><div class="cc-kpiValue">${CC.fmt4(relProg)}<span class="cc-kpiUnit">m³</span></div></div></div>
        <div class="cc-kpi cc-kpiGreen"><div class="cc-kpiIcon">✅</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Vol. Concretado</div><div class="cc-kpiValue">${CC.fmt4(relConc)}<span class="cc-kpiUnit">m³</span></div><div class="cc-kpiSub">${CC.fmt1(relProg > 0 ? relConc / relProg * 100 : 0)}%</div></div></div>
        <div class="cc-kpi cc-kpiRed"><div class="cc-kpiIcon">⚠️</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Perda em Obra</div><div class="cc-kpiValue">${CC.fmt4(pInfo.perdaObra)}<span class="cc-kpiUnit">m³</span></div><div class="cc-kpiSub">${CC.fmt1(pInfo.totalPrevisto > 0 ? pInfo.perdaObra / pInfo.totalPrevisto * 100 : 0)}%</div></div></div>
        <div class="cc-kpi cc-kpiOrange"><div class="cc-kpiIcon">📉</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Índice de Perda</div><div class="cc-kpiValue">${CC.fmt1(pInfo.indice)}<span class="cc-kpiUnit">%</span></div><div class="cc-kpiSub">média por BT</div></div></div>
      </div>

      <div class="cc-grid2">
        <div class="cc-panel">
          <div class="cc-panelTitle">Execução Geral</div>
          <div style="display:flex;align-items:center;gap:22px;flex-wrap:wrap;">
            ${donutExec}
            <div>
              ${[{ label: 'Executado', cor: 'var(--cv-green)', val: relConc }, { label: 'Faltando', cor: '#CBD5E1', val: Math.max(0, relProg - relConc) }].map(d => `
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
                  <div style="width:10px;height:10px;background:${d.cor};border-radius:2px;"></div>
                  <div><div style="font-weight:600;font-size:0.82rem;">${d.label}</div><div style="font-family:var(--cv-mono);font-size:0.72rem;color:var(--cv-text3);">${CC.fmt4(d.val)} m³</div></div>
                </div>`).join('')}
              <div style="font-family:var(--cv-mono);font-size:0.7rem;color:var(--cv-text3);padding-top:6px;border-top:1px solid var(--cv-border);">BTs faltando: ${CC.fmt4(prevVol.faltando)} m³</div>
            </div>
          </div>
        </div>
        <div class="cc-panel">
          <div class="cc-panelTitle">Distribuição de Perdas</div>
          <div style="display:flex;align-items:center;gap:22px;flex-wrap:wrap;">
            ${donutPerda}
            <div>
              ${[{ label: 'Executado', cor: 'var(--cv-green)', val: pInfo.totalExecutado }, { label: 'Perda Obra', cor: 'var(--cv-red)', val: pInfo.perdaObra }, { label: 'Perda Caminhão', cor: 'var(--cv-orange)', val: Math.max(0, pInfo.perdaCaminhao) }].map(d => `
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
                  <div style="width:10px;height:10px;background:${d.cor};border-radius:2px;"></div>
                  <div><div style="font-weight:600;font-size:0.82rem;">${d.label}</div><div style="font-family:var(--cv-mono);font-size:0.72rem;color:var(--cv-text3);">${CC.fmt4(d.val)} m³</div></div>
                </div>`).join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="cc-panel">
        <div class="cc-panelTitle">Volume por Andar <span style="font-family:var(--cv-mono);font-size:10px;color:var(--cv-text3);font-weight:400;text-transform:none;letter-spacing:0;">▼ clique na barra para expandir</span></div>
        ${graficoAndaresHTML(pcs, lans, pInfo.indice)}
      </div>

      <div class="cc-panel">
        <div class="cc-panelTitle">Resumo por Tipo de Peça</div>
        <div class="cc-tableWrap">
          <table class="cc-table">
            <thead><tr><th>Tipo</th><th class="col-centro">Qtd</th><th class="col-num">Previsto</th><th class="col-num">Executado</th><th class="col-num">Faltando</th><th>%</th></tr></thead>
            <tbody>
              ${CC.calcPorTipo(pcs, lans).map((t, i) => `
                <tr>
                  <td><span style="display:inline-flex;align-items:center;gap:8px;"><span style="width:8px;height:8px;background:${CC.CORES[i % CC.CORES.length]};border-radius:2px;display:inline-block;"></span><b>${esc(t.tipo)}</b></span></td>
                  <td class="col-centro cc-tdMono">${t.count}</td>
                  <td class="col-num cc-tdMono">${CC.fmt4(t.prog)} m³</td>
                  <td class="col-num cc-tdGreen">${CC.fmt4(t.conc)} m³</td>
                  <td class="col-num cc-tdRed">${CC.fmt4(t.falt)} m³</td>
                  <td>
                    <span style="display:inline-flex;align-items:center;gap:8px;">
                      <span style="width:60px;height:5px;background:var(--cv-surface2);border-radius:1px;overflow:hidden;display:inline-block;"><span style="display:block;height:100%;width:${Math.min(100, t.pct)}%;background:${t.pct >= 100 ? 'var(--cv-green)' : CC.CORES[i % CC.CORES.length]};"></span></span>
                      <span class="cc-tdMono">${CC.fmt1(t.pct)}%</span>
                    </span>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="cc-panel">
        <div class="cc-panelTitle">Índice Detalhado por BT</div>
        <div class="cc-tableWrap">
          <table class="cc-table">
            <thead><tr><th>BT</th><th class="col-centro">Conc.</th><th>NF</th><th class="col-num">Previsto</th><th class="col-num">Executado</th><th class="col-num">Perda Obra</th><th class="col-num">Dif. Caminhão</th><th class="col-centro">Status</th></tr></thead>
            <tbody>
              ${!bts.length ? `<tr><td colspan="8" style="text-align:center;color:var(--cv-text3);padding:20px;">Sem BTs configuradas</td></tr>` :
              [...bts].sort((a, b) => a.numero - b.numero).map(b => {
                const conc = concretagens.find(c => c.id === b.concretagemId);
                const bLans = lans.filter(l => l.btConfigId === b.id);
                const usado = bLans.reduce((s, l) => s + (l.volume || 0), 0);
                const perdaO = bLans.reduce((s, l) => s + (l.perdaObra || 0), 0);
                const difCam = usado - (b.volumePrevisto || 0);
                const lancada = bLans.length > 0;
                return `
                  <tr>
                    <td class="cc-tdAccent" style="font-weight:700;">BT-${b.numero}</td>
                    <td class="col-centro cc-tdMono">${conc?.numero || '—'}</td>
                    <td class="cc-tdMono">${esc(b.notaFiscal || '—')}</td>
                    <td class="col-num cc-tdMono">${CC.fmt4(b.volumePrevisto)}</td>
                    <td class="col-num ${lancada ? (difCam > 0 ? 'cc-tdBlue' : 'cc-tdGreen') : 'cc-tdMuted'}">${lancada ? CC.fmt4(usado) : '—'}</td>
                    <td class="col-num ${perdaO > 0 ? 'cc-tdRed' : 'cc-tdMuted'}">${lancada ? CC.fmt4(perdaO) : '—'}</td>
                    <td class="col-num ${lancada ? (difCam > 0 ? 'cc-tdBlue' : difCam < 0 ? 'cc-tdRed' : 'cc-tdMuted') : 'cc-tdMuted'}">${lancada ? (difCam > 0 ? `▲ +${CC.fmt4(difCam)}` : difCam < 0 ? `▼ ${CC.fmt4(Math.abs(difCam))}` : '—') : '—'}</td>
                    <td class="col-centro"><span class="cc-badge ${lancada ? 'cc-badgeComplete' : 'cc-badgePending'}">${lancada ? 'Lançada' : 'Pendente'}</span></td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ── FiltroBar dos Relatórios ──
  function rfbToggle(tipo) { relFiltroBarAberto = relFiltroBarAberto === tipo ? null : tipo; renderRelatorios(); }
  function rfbFechar() { relFiltroBarAberto = null; renderRelatorios(); }
  function rfbSelConc(v) { filtroRelConc = v; relFiltroBarAberto = null; renderRelatorios(); }
  function rfbSelAndar(v) { filtroRelAndar = v; relFiltroBarAberto = null; renderRelatorios(); }

  // ── Gráfico de barras por andar (SVG) ───────
  function graficoAndaresHTML(pcs, lans, indicePerda) {
    const dados = CC.calcAndares(pcs, lans, config.ordemAndares, indicePerda);
    if (!dados.length) return `<div class="cc-empty">Sem dados de andares.</div>`;
    const tipos = ['todos', ...new Set(pcs.map(p => p.tipo))].sort();

    const chartDados = dados.map(d => {
      const pecasAndar = pcs.filter(p => p.andar === d.andar && (andarFiltroTipo === 'todos' || p.tipo === andarFiltroTipo));
      const proj = pecasAndar.reduce((s, p) => s + (p.volume || 0), 0);
      const conc = pecasAndar.reduce((s, p) => s + Math.min(p.volume || 0, CC.volLancadoPeca(p.id, lans)), 0);
      const falt = Math.max(0, proj - conc);
      const previsto = falt > 0 ? falt * (1 + Math.abs(indicePerda) / 100) : 0;
      return { andar: d.andar, proj, conc, falt, previsto };
    }).filter(d => d.proj > 0);

    if (!chartDados.length) return `<div class="cc-empty">Sem peças para o filtro atual.</div>`;

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
        <div style="margin-top:12px;border:1px solid var(--cv-accent);overflow:hidden;">
          <div style="padding:10px 14px;background:var(--cor-primaria-ultra-light);display:flex;justify-content:space-between;align-items:center;">
            <span style="font-weight:700;font-size:0.85rem;color:var(--cv-accent3);">${esc(andarAberto)}</span>
            <button class="btn btn-secundario btn-sm" onclick="CCON.toggleAndarAberto('${esc(andarAberto).replace(/'/g, "\\'")}')">✕</button>
          </div>
          <table class="cc-table">
            <thead><tr><th>Peça</th><th class="col-num">Previsto</th><th class="col-num">Exec.</th><th class="col-num">Falt.</th><th>%</th></tr></thead>
            <tbody>
              ${!pecasAndar.length ? `<tr><td colspan="5" style="text-align:center;color:var(--cv-text3);padding:14px;">Sem peças</td></tr>` :
              pecasAndar.map(p => {
                const vc = Math.min(p.volume || 0, CC.volLancadoPeca(p.id, lans));
                const pct = CC.pctConcretado(p, lans);
                return `
                  <tr>
                    <td><b style="font-size:0.82rem;">${esc(p.nome)}</b> <span style="font-size:0.7rem;color:var(--cv-text3);">${esc(p.tipo)}</span></td>
                    <td class="col-num cc-tdMono" style="font-size:0.75rem;">${CC.fmt4(p.volume)}</td>
                    <td class="col-num cc-tdGreen" style="font-size:0.75rem;">${CC.fmt4(vc)}</td>
                    <td class="col-num cc-tdRed" style="font-size:0.75rem;">${CC.fmt4(Math.max(0, (p.volume || 0) - vc))}</td>
                    <td>
                      <span style="display:inline-flex;align-items:center;gap:6px;">
                        <span style="width:48px;height:4px;background:var(--cv-surface2);border-radius:1px;overflow:hidden;display:inline-block;"><span style="display:block;height:100%;width:${Math.min(100, pct)}%;background:${pct >= 100 ? 'var(--cv-green)' : 'var(--cv-accent)'};"></span></span>
                        <span class="cc-tdMono" style="font-weight:700;color:var(--cv-accent3);">${CC.fmt1(pct)}%</span>
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
        <span style="font-size:0.68rem;color:var(--cv-text3);margin-left:auto;">${indicePerda !== 0 ? `* Perda média atual: ${CC.fmt1(Math.abs(indicePerda))}% — aplicada ao volume faltando` : 'Lance BTs para calcular a perda média'}</span>
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

  // ══════════════════════════════════════════
  // MONTAGEM DE CONCRETAGENS (vínculos de peças + BTs)
  // Movido do Levantamento de Concreto — aqui é onde a
  // concretagem é de fato controlada/lançada.
  // ══════════════════════════════════════════
  function abrirConcretagens() {
    cw = { modo: 'menu', concSel: '' };
    renderConcretagem();
    Utils.abrirModal('modal-cc-conc');
  }

  function iniciarNovaConc() {
    cw = {
      modo: 'nova', step: 1,
      concId: CC.genId('c'),
      numero: String(concretagens.length + 1),
      data: Utils.hoje(),
      desc: '',
      vinculos: [],
      bts: [],
      filtroAndar: 'todos', filtroTipo: 'todos', busca: '', esconder100: false,
    };
    renderConcretagem();
  }

  function editarConcretagem(id) {
    // Chamado da tabela/menu: abre o modal já em edição
    const c = concretagens.find(x => x.id === id);
    if (!c) return;
    cw = {
      modo: 'editar', step: 1,
      concId: c.id,
      numero: String(c.numero),
      data: c.data || '',
      desc: c.descricao || '',
      vinculos: pecaConc.filter(pc => pc.concretagemId === c.id).map(pc => ({ id: pc.id, pecaId: pc.pecaId, pctConcretagem: pc.pctConcretagem })),
      bts: btsConfig.filter(b => b.concretagemId === c.id).map(b => ({ ...b })),
      filtroAndar: 'todos', filtroTipo: 'todos', busca: '', esconder100: false,
    };
    renderConcretagem();
    Utils.abrirModal('modal-cc-conc');
  }

  function cwIniciarEditar() {
    if (!cw.concSel) { Utils.toast('Selecione uma concretagem para editar.', 'alerta'); return; }
    editarConcretagem(cw.concSel);
  }

  function cwSetConcSel(v) { cw.concSel = v; }

  async function excluirConcretagem(id) {
    if(!Permissions.pode('controleConcreto','excluir:concretagem')){Utils.toast('Sem permissão para excluir.','erro');return;}
    const c = concretagens.find(x => x.id === id);
    if (!c) return;
    const ok = await Utils.confirmar(`Excluir Concretagem Nº${c.numero}? Isso removerá peças vinculadas, BTs configuradas e lançamentos desta concretagem.`);
    if (!ok) return;
    Utils.mostrarLoading();
    try {
      const ops = [{ type: 'delete', ref: Database.ref(obraId, COL_CONCS).doc(id) }];
      pecaConc.filter(pc => pc.concretagemId === id).forEach(pc =>
        ops.push({ type: 'delete', ref: Database.ref(obraId, COL_PC).doc(pc.id) }));
      btsConfig.filter(b => b.concretagemId === id).forEach(b =>
        ops.push({ type: 'delete', ref: Database.ref(obraId, COL_BTS).doc(b.id) }));
      lancamentos.filter(l => l.concretagemId === id).forEach(l =>
        ops.push({ type: 'delete', ref: Database.ref(obraId, COL_LANS).doc(l.id) }));
      for (let i = 0; i < ops.length; i += 400) {
        await Database.batchWrite(ops.slice(i, i + 400));
      }
      Utils.toast(`Concretagem Nº${c.numero} excluída.`, 'sucesso');
      Utils.fecharModal('modal-cc-conc');
      await carregar();
    } catch (e) {
      Utils.toast('Erro ao excluir: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  async function cwExcluirSelecionada() {
    if(!Permissions.pode('controleConcreto','excluir:concretagem')){Utils.toast('Sem permissão para excluir.','erro');return;}
    if (!cw.concSel) { Utils.toast('Selecione uma concretagem para excluir.', 'alerta'); return; }
    await excluirConcretagem(cw.concSel);
  }

  function cwPctJaAlocado(pecaId) {
    return pecaConc
      .filter(pc => pc.pecaId === pecaId && pc.concretagemId !== cw.concId)
      .reduce((s, pc) => s + (parseFloat(pc.pctConcretagem) || 0), 0);
  }

  function renderConcretagem() {
    const el = document.getElementById('cc-conc-body');
    if (!el || !cw) return;

    if (cw.modo === 'menu') {
      el.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;" class="cc-menu-grid">
          <div class="cc-menuCard" style="text-align:center;" onclick="CCON.iniciarNovaConc()">
            <div class="cc-menuCardIcon">＋</div>
            <div class="cc-menuCardTitle">Nova Concretagem</div>
            <div class="cc-menuCardSub">Criar do zero com peças e BTs</div>
          </div>
          <div class="cc-menuCard" style="text-align:center;cursor:default;">
            <div class="cc-menuCardIcon">✎</div>
            <div class="cc-menuCardTitle">Editar / Excluir</div>
            <select class="form-control mt-1" onchange="CCON.cwSetConcSel(this.value)">
              <option value="">— selecione —</option>
              ${[...concretagens].sort((a, b) => a.numero - b.numero).map(c =>
                `<option value="${c.id}">Nº${c.numero} — ${esc(c.data || '')}${c.descricao ? ` | ${esc(c.descricao)}` : ''}</option>`).join('')}
            </select>
            <div style="display:flex;gap:8px;margin-top:10px;">
              <button class="btn btn-primario btn-sm" style="flex:1;" onclick="CCON.cwIniciarEditar()">Editar →</button>
              <button class="btn btn-secundario btn-sm" style="color:var(--cv-red);" onclick="CCON.cwExcluirSelecionada()">🗑</button>
            </div>
          </div>
        </div>`;
      return;
    }

    // Wizard
    const stepsHtml = `
      <div class="cc-steps">
        ${['Dados', 'Peças', 'BTs', 'Resumo'].map((label, i) => {
          const n = i + 1;
          const ativo = cw.step === n, feito = cw.step > n;
          return `<div class="cc-step ${ativo ? 'cc-stepActive' : ''} ${feito ? 'cc-stepDone' : ''}">
            <span class="cc-stepNum">${feito ? '✓' : n}</span>
            <span class="cc-stepLabel">${label}</span>
          </div>`;
        }).join('')}
      </div>`;

    if (cw.step === 1) {
      el.innerHTML = `${stepsHtml}
        <div class="form-row">
          <div class="form-grupo"><label>Número</label><input type="number" min="1" class="form-control" value="${esc(cw.numero)}" oninput="CCON.cwUpd('numero', this.value)"></div>
          <div class="form-grupo"><label>Data</label><input type="date" class="form-control" value="${esc(cw.data)}" oninput="CCON.cwUpd('data', this.value)"></div>
        </div>
        <div class="form-grupo"><label>Descrição</label><input type="text" class="form-control" placeholder="ex: Pilares Térreo eixos A-D" value="${esc(cw.desc)}" oninput="CCON.cwUpd('desc', this.value)"></div>
        <div style="display:flex;justify-content:space-between;margin-top:14px;">
          <button class="btn btn-secundario" onclick="CCON.cwVoltarMenu()">← Voltar</button>
          <button class="btn btn-primario" onclick="CCON.cwStep1Next()">Próximo →</button>
        </div>`;
      return;
    }

    if (cw.step === 2) {
      const volTotal = cwVolTotalVinculos();
      const andares = ['todos', ...todosAndares()];
      const tipos = ['todos', ...[...new Set(pecas.map(p => p.tipo))].sort()];
      el.innerHTML = `${stepsHtml}
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px;">
          <span style="font-family:var(--font-mono);font-size:0.85rem;font-weight:700;color:var(--cor-primaria-dark,#b8960a);">${cw.vinculos.length} peças · ${CC.fmt4(volTotal)} m³</span>
          ${cw.filtroAndar !== 'todos' ? `<button class="btn btn-secundario btn-sm" onclick="CCON.cwToggleAndar()">${cwAndarTodoMarcado() ? 'Desmarcar tudo do andar' : 'Marcar tudo do andar'}</button>` : ''}
        </div>
        <div class="form-row" style="margin-bottom:8px;">
          <select class="form-control" onchange="CCON.cwUpdFiltro('filtroAndar', this.value)">
            ${andares.map(a => `<option value="${esc(a)}" ${cw.filtroAndar === a ? 'selected' : ''}>${a === 'todos' ? 'Todos os andares' : esc(a)}</option>`).join('')}
          </select>
          <select class="form-control" onchange="CCON.cwUpdFiltro('filtroTipo', this.value)">
            ${tipos.map(t => `<option value="${esc(t)}" ${cw.filtroTipo === t ? 'selected' : ''}>${t === 'todos' ? 'Todos os tipos' : esc(t)}</option>`).join('')}
          </select>
        </div>
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
          <input type="text" class="form-control" style="flex:1;" placeholder="🔍 Buscar por nome..." value="${esc(cw.busca)}" oninput="CCON.cwBusca(this.value)">
          <label style="display:flex;align-items:center;gap:5px;font-size:0.78rem;color:var(--cor-texto-muted);cursor:pointer;white-space:nowrap;">
            <input type="checkbox" ${cw.esconder100 ? 'checked' : ''} onchange="CCON.cwUpdFiltro('esconder100', this.checked)"> Esconder 100%
          </label>
        </div>
        <div id="cc-cw-lista" style="max-height:300px;overflow-y:auto;border:1px solid var(--cor-borda-light);border-radius:8px;"></div>
        <div style="display:flex;justify-content:space-between;margin-top:14px;">
          <button class="btn btn-secundario" onclick="CCON.cwSetStep(1)">← Voltar</button>
          <button class="btn btn-primario" onclick="CCON.cwStep2Next()">Próximo →</button>
        </div>`;
      renderCwLista();
      return;
    }

    if (cw.step === 3) {
      const volTotal = cwVolTotalVinculos();
      const volBTs = cw.bts.reduce((s, b) => s + (parseFloat(b.volumePrevisto) || 0), 0);
      const btsOk = Math.abs(volBTs - volTotal) < 0.1;
      el.innerHTML = `${stepsHtml}
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
          <div style="font-family:var(--font-mono);font-size:0.85rem;">
            Volume concretagem: <b style="color:var(--cor-primaria-dark,#b8960a);">${CC.fmt4(volTotal)} m³</b>
            ${cw.bts.length ? ` · BTs: <b id="cc-cw-volbts" style="color:${btsOk ? '#16a34a' : '#ef4444'};">${CC.fmt4(volBTs)} m³</b>` : ''}
          </div>
          <button class="btn btn-secundario btn-sm" onclick="CCON.cwAddBT()">+ Adicionar BT</button>
        </div>
        <div id="cc-cw-bts">
          ${!cw.bts.length ? `<div class="cc-empty">Clique em "+ Adicionar BT" para configurar as betonadas.</div>` :
          cw.bts.map((b, i) => `
            <div style="display:grid;grid-template-columns:70px 110px 1fr 1fr auto;gap:8px;margin-bottom:8px;align-items:end;" class="cc-bt-row">
              <div class="form-grupo" style="margin-bottom:0;"><label style="font-size:0.68rem;">BT Nº</label><input type="number" min="1" class="form-control" value="${esc(b.numero)}" oninput="CCON.cwUpdBT(${i}, 'numero', this.value)"></div>
              <div class="form-grupo" style="margin-bottom:0;"><label style="font-size:0.68rem;">Volume (m³)</label><input type="number" step="0.5" min="0" class="form-control" value="${esc(b.volumePrevisto)}" oninput="CCON.cwUpdBT(${i}, 'volumePrevisto', this.value)"></div>
              <div class="form-grupo" style="margin-bottom:0;"><label style="font-size:0.68rem;">Nota Fiscal</label><input type="text" class="form-control" placeholder="opcional" value="${esc(b.notaFiscal || '')}" oninput="CCON.cwUpdBT(${i}, 'notaFiscal', this.value)"></div>
              <div class="form-grupo" style="margin-bottom:0;"><label style="font-size:0.68rem;">Código BT</label><input type="text" class="form-control" placeholder="opcional" value="${esc(b.codigoBT || '')}" oninput="CCON.cwUpdBT(${i}, 'codigoBT', this.value)"></div>
              <button class="btn btn-secundario btn-sm" style="color:#ef4444;" onclick="CCON.cwRemBT(${i})">✕</button>
            </div>`).join('')}
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:14px;">
          <button class="btn btn-secundario" onclick="CCON.cwSetStep(2)">← Voltar</button>
          <button class="btn btn-primario" onclick="CCON.cwSetStep(4)">Revisar →</button>
        </div>`;
      return;
    }

    // Step 4: resumo
    const volTotal = cwVolTotalVinculos();
    el.innerHTML = `${stepsHtml}
      <div class="cc-kpiGrid" style="grid-template-columns:1fr 1fr;margin-bottom:14px;">
        <div class="cc-kpi"><div class="cc-kpiIcon">◈</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Concretagem</div><div class="cc-kpiValue" style="font-size:18px;">Nº ${esc(cw.numero)}</div><div class="cc-kpiSub">${esc(cw.data)}${cw.desc ? ` · ${esc(cw.desc)}` : ''}</div></div></div>
        <div class="cc-kpi"><div class="cc-kpiIcon">📦</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Volume Total</div><div class="cc-kpiValue">${CC.fmt4(volTotal)}<span class="cc-kpiUnit">m³</span></div><div class="cc-kpiSub">${cw.vinculos.length} peças · ${cw.bts.length} BTs</div></div></div>
      </div>
      <div style="margin-bottom:12px;">
        ${cw.vinculos.slice(0, 6).map(v => {
          const p = pecas.find(x => x.id === v.pecaId);
          if (!p) return '';
          return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--cor-borda-light);font-family:var(--font-mono);font-size:0.8rem;">
            <span>${esc(p.nome)} (${esc(p.andar)})</span>
            <span style="color:var(--cor-primaria-dark,#b8960a);">${v.pctConcretagem}% → ${CC.fmt4(((parseFloat(v.pctConcretagem) || 0) / 100) * p.volume)} m³</span>
          </div>`;
        }).join('')}
        ${cw.vinculos.length > 6 ? `<div style="font-family:var(--font-mono);font-size:0.75rem;color:var(--cor-texto-muted);margin-top:4px;">... e mais ${cw.vinculos.length - 6} peças</div>` : ''}
      </div>
      ${cw.bts.length ? `<div style="margin-bottom:12px;">
        ${cw.bts.map(b => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--cor-borda-light);font-family:var(--font-mono);font-size:0.8rem;">
          <span style="color:var(--cor-primaria-dark,#b8960a);">BT-${esc(b.numero)}</span>
          <span>${CC.fmt4(parseFloat(b.volumePrevisto) || 0)} m³${b.notaFiscal ? ` · NF:${esc(b.notaFiscal)}` : ''}</span>
        </div>`).join('')}
      </div>` : ''}
      <div style="display:flex;justify-content:space-between;margin-top:14px;">
        <button class="btn btn-secundario" onclick="CCON.cwSetStep(3)">← Voltar</button>
        <button class="btn btn-primario" data-perm="controleConcreto:criar:concretagem" onclick="CCON.cwSalvar()">✓ Salvar Concretagem</button>
      </div>`;
  }

  function cwVolTotalVinculos() {
    return cw.vinculos.reduce((s, v) => {
      const p = pecas.find(x => x.id === v.pecaId);
      return s + (p ? ((parseFloat(v.pctConcretagem) || 0) / 100) * p.volume : 0);
    }, 0);
  }

  function cwAndarTodoMarcado() {
    const ids = pecas.filter(p => p.andar === cw.filtroAndar).map(p => p.id);
    return ids.length > 0 && ids.every(id => cw.vinculos.find(v => v.pecaId === id));
  }

  function renderCwLista() {
    const el = document.getElementById('cc-cw-lista');
    if (!el || !cw) return;
    const busca = (cw.busca || '').toLowerCase();
    const visiveis = pecas.filter(p => {
      if (cw.filtroAndar !== 'todos' && p.andar !== cw.filtroAndar) return false;
      if (cw.filtroTipo !== 'todos' && p.tipo !== cw.filtroTipo) return false;
      if (busca && !p.nome.toLowerCase().includes(busca)) return false;
      if (cw.esconder100 && CC.pctConcretado(p, lancamentos) >= 100) return false;
      return true;
    });
    if (!visiveis.length) {
      el.innerHTML = `<div class="cc-empty">Nenhuma peça encontrada.</div>`;
      return;
    }
    el.innerHTML = visiveis.map(p => {
      const vinc = cw.vinculos.find(v => v.pecaId === p.id);
      const sel = !!vinc;
      const jaAlocado = cwPctJaAlocado(p.id);
      const disponivel = Math.max(0, 100 - jaAlocado);
      const bloqueada = !sel && disponivel <= 0;
      const concsComPeca = pecaConc.filter(pc => pc.pecaId === p.id && pc.concretagemId !== cw.concId);
      const nomesConc = concsComPeca.map(pc => {
        const c = concretagens.find(x => x.id === pc.concretagemId);
        return `Nº${c?.numero || '?'} (${CC.fmt1(parseFloat(pc.pctConcretagem) || 0)}%)`;
      }).join(', ');
      return `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--cor-borda-light);background:${sel ? 'var(--cor-primaria-light,#fef9e7)' : '#fff'};${bloqueada ? 'opacity:0.55;' : ''}">
          <div onclick="${bloqueada ? '' : `CCON.cwTogglePeca('${p.id}')`}" style="width:20px;height:20px;border:2px solid ${sel ? 'var(--cor-primaria)' : 'var(--cor-borda-light)'};border-radius:5px;background:${sel ? 'var(--cor-primaria)' : 'transparent'};display:flex;align-items:center;justify-content:center;cursor:${bloqueada ? 'not-allowed' : 'pointer'};flex-shrink:0;font-size:0.75rem;color:#000;font-weight:700;">${sel ? '✓' : ''}</div>
          <div style="flex:1;cursor:${bloqueada ? 'not-allowed' : 'pointer'};" onclick="${bloqueada ? '' : `CCON.cwTogglePeca('${p.id}')`}">
            <div style="font-weight:600;font-size:0.88rem;">${esc(p.nome)}</div>
            <div style="font-family:var(--font-mono);font-size:0.72rem;color:var(--cor-texto-muted);">${esc(p.tipo)} · ${esc(p.andar)} · ${CC.fmt4(p.volume)} m³</div>
            ${jaAlocado > 0 ? `<div style="font-size:0.7rem;color:${disponivel <= 0 ? '#ef4444' : 'var(--cor-primaria-dark,#b8960a)'};margin-top:2px;">
              ${disponivel <= 0 ? '⛔ 100% já alocado' : `${CC.fmt1(jaAlocado)}% em ${esc(nomesConc)} · disponível: ${CC.fmt1(disponivel)}%`}
            </div>` : ''}
          </div>
          ${sel ? `<div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
            <label style="font-family:var(--font-mono);font-size:0.7rem;color:var(--cor-texto-muted);">%</label>
            <input type="text" inputmode="numeric" value="${esc(vinc.pctConcretagem)}" style="width:58px;padding:5px 7px;border:1px solid var(--cor-primaria);border-radius:6px;font-family:var(--font-mono);font-size:0.82rem;color:var(--cor-primaria-dark,#b8960a);outline:none;"
              oninput="CCON.cwSetPct('${p.id}', this.value)" onblur="CCON.cwBlurPct('${p.id}', this)">
            <span id="cc-cw-vol-${p.id}" style="font-family:var(--font-mono);font-size:0.75rem;color:var(--cor-texto-muted);">${CC.fmt4(((parseFloat(vinc.pctConcretagem) || 0) / 100) * p.volume)} m³</span>
          </div>` : ''}
        </div>`;
    }).join('');
  }

  function cwUpd(campo, valor) { cw[campo] = valor; }
  function cwUpdFiltro(campo, valor) { cw[campo] = valor; renderConcretagem(); }
  function cwBusca(v) { cw.busca = v; renderCwLista(); }
  function cwSetStep(n) { cw.step = n; renderConcretagem(); }
  function cwVoltarMenu() { cw = { modo: 'menu', concSel: '' }; renderConcretagem(); }

  function cwStep1Next() {
    if (!cw.numero || !cw.data) { Utils.toast('Preencha número e data.', 'alerta'); return; }
    cwSetStep(2);
  }
  function cwStep2Next() {
    if (!cw.vinculos.length) { Utils.toast('Vincule ao menos 1 peça.', 'alerta'); return; }
    cwSetStep(3);
  }

  function cwTogglePeca(pecaId) {
    const idx = cw.vinculos.findIndex(v => v.pecaId === pecaId);
    if (idx >= 0) cw.vinculos.splice(idx, 1);
    else {
      const disponivel = Math.max(0, 100 - cwPctJaAlocado(pecaId));
      cw.vinculos.push({ pecaId, pctConcretagem: disponivel > 0 ? Math.min(100, disponivel) : 100 });
    }
    renderConcretagem();
  }

  function cwToggleAndar() {
    const ids = pecas.filter(p => p.andar === cw.filtroAndar).map(p => p.id);
    const todos = ids.every(id => cw.vinculos.find(v => v.pecaId === id));
    if (todos) {
      cw.vinculos = cw.vinculos.filter(v => !ids.includes(v.pecaId));
    } else {
      ids.filter(id => !cw.vinculos.find(v => v.pecaId === id)).forEach(id => {
        const disponivel = Math.max(0, 100 - cwPctJaAlocado(id));
        if (disponivel > 0) cw.vinculos.push({ pecaId: id, pctConcretagem: Math.min(100, disponivel) });
      });
    }
    renderConcretagem();
  }

  function cwSetPct(pecaId, val) {
    const v = val.replace(/[^0-9]/g, '');
    const vinc = cw.vinculos.find(x => x.pecaId === pecaId);
    if (!vinc) return;
    const n = parseFloat(v);
    vinc.pctConcretagem = v === '' ? '' : Math.min(isNaN(n) ? '' : n, 100);
    // Atualização parcial: só o m³ da linha (preserva foco)
    const p = pecas.find(x => x.id === pecaId);
    const volEl = document.getElementById('cc-cw-vol-' + pecaId);
    if (p && volEl) volEl.textContent = CC.fmt4(((parseFloat(vinc.pctConcretagem) || 0) / 100) * p.volume) + ' m³';
  }

  function cwBlurPct(pecaId, input) {
    const vinc = cw.vinculos.find(x => x.pecaId === pecaId);
    if (!vinc) return;
    const ja = cwPctJaAlocado(pecaId);
    const maxVal = Math.max(1, 100 - ja);
    const raw = parseFloat(input.value);
    const v = isNaN(raw) || raw < 1 ? 1 : Math.min(raw, maxVal);
    vinc.pctConcretagem = v;
    renderConcretagem();
  }

  function cwAddBT() {
    cw.bts.push({ id: '', numero: cw.bts.length + 1, volumePrevisto: 8, notaFiscal: '', codigoBT: '' });
    renderConcretagem();
  }
  function cwRemBT(i) { cw.bts.splice(i, 1); renderConcretagem(); }
  function cwUpdBT(i, f, v) {
    cw.bts[i][f] = v;
    // Atualiza só o total das BTs (preserva foco nos inputs)
    const totEl = document.getElementById('cc-cw-volbts');
    if (totEl) {
      const volTotal = cwVolTotalVinculos();
      const volBTs = cw.bts.reduce((s, b) => s + (parseFloat(b.volumePrevisto) || 0), 0);
      totEl.textContent = CC.fmt4(volBTs) + ' m³';
      totEl.style.color = Math.abs(volBTs - volTotal) < 0.1 ? '#16a34a' : '#ef4444';
    }
  }

  async function cwSalvar() {
    if(!Permissions.pode('controleConcreto','criar:concretagem')&&!Permissions.pode('controleConcreto','editar:concretagem')){Utils.toast('Sem permissão.','erro');return;}
    if (!cw.numero || !cw.data) { Utils.toast('Preencha número e data.', 'alerta'); return; }
    if (!cw.vinculos.length) { Utils.toast('Vincule ao menos 1 peça.', 'alerta'); return; }
    Utils.mostrarLoading();
    try {
      const ops = [];
      // Documento da concretagem
      ops.push({
        type: 'set',
        ref: Database.ref(obraId, COL_CONCS).doc(cw.concId),
        data: { numero: parseInt(cw.numero) || 0, data: cw.data, descricao: cw.desc || '', obraId },
      });
      // Em edição: remove todos os vínculos e BTs antigos e regrava
      if (cw.modo === 'editar') {
        pecaConc.filter(pc => pc.concretagemId === cw.concId).forEach(pc =>
          ops.push({ type: 'delete', ref: Database.ref(obraId, COL_PC).doc(pc.id) }));
        btsConfig.filter(b => b.concretagemId === cw.concId).forEach(b =>
          ops.push({ type: 'delete', ref: Database.ref(obraId, COL_BTS).doc(b.id) }));
      }
      cw.vinculos.forEach(v => {
        ops.push({
          type: 'set',
          ref: Database.ref(obraId, COL_PC).doc(CC.genId('pc')),
          data: { pecaId: v.pecaId, concretagemId: cw.concId, pctConcretagem: parseFloat(v.pctConcretagem) || 100, obraId },
        });
      });
      cw.bts.forEach(b => {
        // Preserva o id da BT em edição para não perder lançamentos vinculados
        const btId = b.id || CC.genId('bt');
        ops.push({
          type: 'set',
          ref: Database.ref(obraId, COL_BTS).doc(btId),
          data: {
            concretagemId: cw.concId,
            numero: parseInt(b.numero) || 0,
            volumePrevisto: parseFloat(b.volumePrevisto) || 0,
            notaFiscal: b.notaFiscal || '',
            codigoBT: b.codigoBT || '',
            obraId,
          },
        });
      });
      for (let i = 0; i < ops.length; i += 400) {
        await Database.batchWrite(ops.slice(i, i + 400));
      }
      Utils.toast(`✓ Concretagem Nº${cw.numero} salva!`, 'sucesso');
      Utils.fecharModal('modal-cc-conc');
      await carregar();
    } catch (e) {
      Utils.toast('Erro ao salvar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  return {
    init, recarregar, renderizar,
    setAba, fbToggle, fbFechar, fbSelAndar, fbSelConc,
    toggleTipo, abrirDetalhePeca,
    exportarCSV,
    abrirLancarBT, btSetConc, btSetBT, btIniciarEdicao,
    btUpd, btBusca, btEsconder100, btAddLinha, btRemLinha, btUpdLinha, btSalvar,
    rfbToggle, rfbFechar, rfbSelConc, rfbSelAndar, setAndarFiltroTipo, toggleAndarAberto,
    abrirUploadPdfConc, onPdfConcArquivo,
    abrirConcretagens, iniciarNovaConc, editarConcretagem, excluirConcretagem,
    cwSetConcSel, cwIniciarEditar, cwExcluirSelecionada,
    cwUpd, cwUpdFiltro, cwBusca, cwSetStep, cwVoltarMenu, cwStep1Next, cwStep2Next,
    cwTogglePeca, cwToggleAndar, cwSetPct, cwBlurPct,
    cwAddBT, cwRemBT, cwUpdBT, cwSalvar,
  };
})();

const CCON = ControleConcreto;

function onObraChanged() {
  ControleConcreto.recarregar();
}

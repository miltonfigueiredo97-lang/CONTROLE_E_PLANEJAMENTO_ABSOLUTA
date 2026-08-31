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
  const COL_PRANCHAS = 'concretoPranchas';
  const COL_MARCADORES = 'concretoMarcadoresProjeto';

  let obraId = null;
  let pecas = [];
  let concretagens = [];
  let pecaConc = [];
  let btsConfig = [];
  let lancamentos = [];
  let config = { ordemAndares: [], andaresCustm: [] };

  // Planta do Projeto (V2.0) — pranchas (PDF/imagem) com áreas (polígonos)
  // vinculadas a peças do Levantamento. Mesmo princípio do Controle de
  // Estacas, sem reconhecimento automático de QUAL peça é — só onde ela
  // está (detecção de área é geometria pura, sem OCR).
  let pdfjsCarregado = false;
  let pranchas = [];
  let marcadoresProjeto = [];
  let pranchaAtivaId = null;
  let zoomPlanta = 1;
  let modoPlanta = null; // 'poligono' (desenho manual) | null
  let poligonoPontosPlanta = [];
  let editandoFormaPlantaId = null;
  let proximaAreaParaPeca = null; // {pecaId, tipo, nome} — se setado, a próxima área desenhada é vinculada direto a essa peça, sem passar pelo seletor
  let marcadorVincularId = null;
  let vincularTipo = '';
  let vincularAndarFiltro = '__prancha__'; // '__prancha__' = só andar da prancha ativa · 'todos'
  let vincularBusca = '';
  let vincularListaAberta = false;
  let _imagemPranchaCacheId = null;
  let _imagemPranchaCache = null;
  let plantaTelaCheiaAtiva = false;
  let plantaTelaCheiaGuardado = null;
  let _scrollOverridePlanta = null; // {top,left} — usado pelo zoom ancorado, sobrepõe a preservação padrão de scroll
  let _ultimoFoiArrastoPlanta = false; // suprime o "clique" que vem logo depois de um arrasto de pan
  let _panEstadoPlanta = null;
  let _panListenersGlobaisLigados = false;
  // Montar Concretagem desenhando livre (V2.0 parte 2)
  let desenhoLivreTracos = [];
  let desenhoLivreEmAndamento = null;
  let concLivre = null; // { numero, data, resultados: null|[{pecaId,peca,pct}] }
  // "Controlar pelo Projeto" no lançamento de BT (V2.0 parte 2)
  let btProjeto = null; // { pranchaId, pecaIds, tracos:[], emAndamento:null, resultados:null }

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
      const [ps, cs, pcs, bts, lans, prs, mks] = await Promise.all([
        Database.listar(obraId, COL_PECAS, null),
        Database.listar(obraId, COL_CONCS, null),
        Database.listar(obraId, COL_PC, null),
        Database.listar(obraId, COL_BTS, null),
        Database.listar(obraId, COL_LANS, null),
        Database.listar(obraId, COL_PRANCHAS, null),
        Database.listar(obraId, COL_MARCADORES, null),
      ]);
      pecas = ps; concretagens = cs; pecaConc = pcs; btsConfig = bts; lancamentos = lans;
      pranchas = prs; marcadoresProjeto = mks;
      if (!pranchaAtivaId || !pranchas.find(p => p.id === pranchaAtivaId)) pranchaAtivaId = pranchas[0]?.id || null;
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

    // Tela cheia da Planta: o wrapper (#cc-planta-wrap) foi realocado pra
    // fora de #cc-content, pra dentro de um overlay — recriar o shell aqui
    // destruiria essa realocação (e duplicaria o id). Só atualiza o
    // conteúdo, que renderPlanta() já sabe achar onde quer que ele esteja.
    if (aba === 'planta' && plantaTelaCheiaAtiva) { renderPlanta(); return; }

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
            <button class="aba-btn ${aba === 'planta' ? 'ativo' : ''}" onclick="CCON.setAba('planta')">🗺️ Planta</button>
          </div>
        </div>
      </div>
      <div id="cc-body"></div>
      </div>
    `;
    if (aba === 'operacional') renderOperacional();
    else if (aba === 'relatorios') renderRelatorios();
    else renderPlanta();
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
            <button class="cc-btnLaunch" style="background:#7c3aed;margin-left:8px;" data-perm="controleConcreto:criar:bt" onclick="CCON.abrirControlarProjeto()">🗺️ CONTROLAR PELO PROJETO →</button>
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
    if (bt.viaProjeto) {
      bt.viaProjeto = false;
      if (jaLancada) btIniciarEdicao(); else renderLancarBT();
      abrirBtProjeto();
      return;
    }
    renderLancarBT();
  }

  // Atalho "🗺️ Controlar pelo Projeto" (botão ao lado de "Lançar BT"): abre
  // o mesmo fluxo de sempre (escolher Concretagem → BT), e assim que a BT é
  // escolhida já pula direto pra tela de desenho, sem precisar clicar de
  // novo lá dentro.
  function abrirControlarProjeto() {
    abrirLancarBT();
    bt.viaProjeto = true;
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
        <div style="margin-bottom:10px;">
          <button class="btn btn-secundario btn-sm" data-perm="controleConcreto:criar:bt" onclick="CCON.abrirBtProjeto()">🗺️ Controlar pelo Projeto</button>
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
      pranchaId: pranchaAtivaId || '',
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
      pranchaId: c.pranchaId || '',
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
        <div class="form-grupo">
          <label>Prancha (Planta do Projeto)</label>
          <select class="form-control" onchange="CCON.cwUpd('pranchaId', this.value)">
            <option value="">— nenhuma —</option>
            ${pranchas.map(p => `<option value="${p.id}" ${cw.pranchaId === p.id ? 'selected' : ''}>${esc(p.nome)}${p.andar ? ` (${esc(p.andar)})` : ''}</option>`).join('')}
          </select>
          ${!pranchas.length ? `<p class="text-sm text-muted" style="margin-top:6px;">Nenhuma prancha importada ainda — pode deixar em branco e vincular depois, na aba Planta.</p>` : ''}
        </div>
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
        data: { numero: parseInt(cw.numero) || 0, data: cw.data, descricao: cw.desc || '', pranchaId: cw.pranchaId || '', obraId },
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

  // ══════════════════════════════════════════
  // ABA PLANTA (V2.0) — pranchas com áreas (polígonos) vinculadas a peças.
  // Detecção automática de área é geometria pura (segmentação de cor),
  // NÃO tenta reconhecer qual peça é — isso é sempre escolhido no vínculo
  // (tipo + busca por nome), com filtro por andar.
  // ══════════════════════════════════════════
  function marcadoresDaPranchaAtiva() {
    return marcadoresProjeto.filter(m => m.pranchaId === pranchaAtivaId);
  }

  async function _obterImagemPrancha(pranchaId) {
    if (_imagemPranchaCacheId === pranchaId && _imagemPranchaCache) return _imagemPranchaCache;
    const pr = pranchas.find(p => p.id === pranchaId);
    if (pr && pr.imgUrl) { _imagemPranchaCacheId = pranchaId; _imagemPranchaCache = pr.imgUrl; return pr.imgUrl; }
    // Compatibilidade com pranchas antigas (imagem embutida em dataURL no
    // Firestore, de antes da V3.26.2 — a partir daqui vai tudo pro Storage).
    try {
      const doc = await db.collection('obras').doc(obraId).collection('config').doc('concretoImagem_' + pranchaId).get();
      const img = doc.exists ? doc.data().img : null;
      _imagemPranchaCacheId = pranchaId; _imagemPranchaCache = img;
      return img;
    } catch (e) { return null; }
  }

  const CORES_TIPO_PLANTA = {
    Pilar: '#ef4444', Viga: '#3b82f6', Laje: '#f59e0b',
    'Fundação': '#10b981', Cortina: '#6366f1', Escada: '#ec4899',
    Rampa: '#14b8a6', "Caixa D'água": '#8b5cf6', Outro: '#78716c',
  };
  // Compara tipo tolerando maiúscula/minúscula e espaço (peça importada em
  // lote às vezes vem com grafia diferente da exata de CC.TIPOS) e devolve
  // a grafia CANÔNICA — usado tanto pra cor quanto pro filtro, pra uma
  // peça "LAJE" não cair no balaio "Outro" nos dois lugares por motivos
  // diferentes.
  function _tipoNormalizadoPlanta(tipo) {
    const alvo = String(tipo || '').trim().toLowerCase();
    return CC.TIPOS.find(t => t.toLowerCase() === alvo) || null;
  }
  function _corPorTipo(tipo) {
    return CORES_TIPO_PLANTA[_tipoNormalizadoPlanta(tipo)] || CORES_TIPO_PLANTA.Outro;
  }
  function _statusMarcadorPlanta(m) {
    const p = m.pecaId ? pecas.find(x => x.id === m.pecaId) : null;
    if (!p) return { vinculado: false, label: 'Sem peça vinculada', cor: '#94a3b8' };
    return { vinculado: true, label: `${p.tipo} — ${p.nome}`, cor: _corPorTipo(p.tipo) };
  }

  // ── Filtro por tipo — um checkbox por tipo de peça (mais "Não
  // vinculadas"), cada um com a cor real que aparece na planta. ──
  let filtroTipoPlanta = new Set([...CC.TIPOS, 'naoVinculada']);
  function _tipoFiltroMarcador(m) {
    const p = m.pecaId ? pecas.find(x => x.id === m.pecaId) : null;
    if (!p) return null; // não vinculada
    return _tipoNormalizadoPlanta(p.tipo) || 'Outro';
  }
  function _marcadorVisivelPlanta(m) {
    const t = _tipoFiltroMarcador(m);
    return filtroTipoPlanta.has(t === null ? 'naoVinculada' : t);
  }
  function _marcadoresVisiveisPlanta() {
    return marcadoresDaPranchaAtiva().filter(_marcadorVisivelPlanta);
  }
  function toggleFiltroTipoPlanta(chave) {
    if (filtroTipoPlanta.has(chave)) filtroTipoPlanta.delete(chave); else filtroTipoPlanta.add(chave);
    renderPlanta();
  }

  // ── Zoom (botões — o scroll/arraste do container cuida do pan) ──
  function zoomInPlanta() { zoomPlanta = Math.min(10, Math.round(((zoomPlanta || 1) + 0.25) * 100) / 100); renderPlanta(); }
  function zoomOutPlanta() { zoomPlanta = Math.max(0.25, Math.round(((zoomPlanta || 1) - 0.25) * 100) / 100); renderPlanta(); }
  function zoomResetPlanta() { zoomPlanta = 1; renderPlanta(); }

  // ── Preserva a posição de rolagem entre re-renders — sem isso, TODO
  // clique/salvamento reconstrói o innerHTML e o scroll volta pro topo
  // (era o "sobe lá pra cima" reclamado — a rolagem some porque o
  // container antigo é substituído por um novo elemento zerado). ──
  function _lerScrollPlanta() {
    const sc = document.querySelector('.cc-plan-scroll');
    return sc ? { top: sc.scrollTop, left: sc.scrollLeft } : null;
  }
  function _aplicarScrollPlanta(s) {
    if (!s) return;
    const sc = document.querySelector('.cc-plan-scroll');
    if (sc) { sc.scrollTop = s.top; sc.scrollLeft = s.left; }
  }

  // ── Zoom com a roda do mouse, ANCORADO no ponto embaixo do cursor (não
  // no canto do container) — e bloqueia o zoom da PÁGINA do navegador.
  // Funciona em qualquer modo (inclusive desenhando/ajustando) — dar zoom
  // pra mirar com precisão é exatamente quando mais se precisa dele. ──
  function _ligarZoomWheelPlanta() {
    const sc = document.querySelector('.cc-plan-scroll');
    if (!sc) return;
    sc.addEventListener('wheel', e => {
      e.preventDefault();
      const zAnt = zoomPlanta || 1;
      const delta = e.deltaY < 0 ? 0.2 : -0.2;
      const zNovo = Math.min(10, Math.max(0.25, Math.round((zAnt + delta) * 100) / 100));
      if (zNovo === zAnt) return;
      const rect = sc.getBoundingClientRect();
      const anchorX = e.clientX - rect.left, anchorY = e.clientY - rect.top;
      const k = zNovo / zAnt;
      _scrollOverridePlanta = {
        left: Math.max(0, (sc.scrollLeft + anchorX) * k - anchorX),
        top: Math.max(0, (sc.scrollTop + anchorY) * k - anchorY),
      };
      zoomPlanta = zNovo;
      renderPlanta();
    }, { passive: false });
  }

  // ── Pan por arraste do botão esquerdo (clicar e arrastar move a
  // planta) — funciona em qualquer modo. Um ARRASTO de verdade (>3px)
  // faz pan e suprime o "clique" que viria no soltar (_ultimoFoiArrastoPlanta);
  // um clique parado (sem mover) continua marcando ponto normalmente —
  // por isso dá pra deixar ligado mesmo desenhando, sem conflito. Os
  // listeners de move/up ficam no window (ligados uma única vez) pra não
  // perder o arrasto se o cursor sair da área visível no meio do gesto. ──
  function _onPanMouseDownPlanta(e) {
    if (e.button !== 0) return;
    const sc = document.querySelector('.cc-plan-scroll');
    if (!sc) return;
    _panEstadoPlanta = { sc, ultimoX: e.clientX, ultimoY: e.clientY, moveu: false };
    sc.style.cursor = 'grabbing';
  }
  function _onPanMouseMovePlanta(e) {
    if (!_panEstadoPlanta) return;
    const dx = e.clientX - _panEstadoPlanta.ultimoX, dy = e.clientY - _panEstadoPlanta.ultimoY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) _panEstadoPlanta.moveu = true;
    if (_panEstadoPlanta.moveu) { _panEstadoPlanta.sc.scrollLeft -= dx; _panEstadoPlanta.sc.scrollTop -= dy; }
    _panEstadoPlanta.ultimoX = e.clientX; _panEstadoPlanta.ultimoY = e.clientY;
  }
  function _onPanMouseUpPlanta() {
    if (!_panEstadoPlanta) return;
    _ultimoFoiArrastoPlanta = _panEstadoPlanta.moveu;
    _panEstadoPlanta.sc.style.cursor = '';
    _panEstadoPlanta = null;
  }
  function _ligarPanArrastoPlanta() {
    const sc = document.querySelector('.cc-plan-scroll');
    if (!sc) return;
    sc.addEventListener('mousedown', _onPanMouseDownPlanta);
    if (!_panListenersGlobaisLigados) {
      _panListenersGlobaisLigados = true;
      window.addEventListener('mousemove', _onPanMouseMovePlanta);
      window.addEventListener('mouseup', _onPanMouseUpPlanta);
    }
  }

  function _plantaStageHTML(prancha, imagemBase64, marcadores) {
    const W = CC.num(prancha.imgWidthPx) || 800, H = CC.num(prancha.imgHeightPx) || 500;
    const zoom = zoomPlanta || 1;
    const w = W * zoom, h = H * zoom;
    const poligonos = (marcadores || []).filter(m => m.pontos && m.pontos.length >= 3).map(m => {
      const st = _statusMarcadorPlanta(m);
      const cor = st.cor;
      const pts = m.pontos.map(p => `${(p.x * 100).toFixed(3)},${(p.y * 100).toFixed(3)}`).join(' ');
      return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2;">
        <polygon class="cc-plan-poligono" data-id="${m.id}" points="${pts}" fill="${cor}55" stroke="${cor}" stroke-width="0.4" vector-effect="non-scaling-stroke" style="cursor:pointer;pointer-events:auto;"><title>${esc(st.label)}</title></polygon>
      </svg>`;
    }).join('');
    let desenhoAtual = '';
    if (modoPlanta === 'poligono' && poligonoPontosPlanta.length) {
      const pts = poligonoPontosPlanta.map(p => `${(p.x * 100).toFixed(3)},${(p.y * 100).toFixed(3)}`).join(' ');
      // Os PONTOS são <div> com tamanho em px de tela (acompanha o zoom) —
      // um <circle r="%"> ficava atrelado à resolução da imagem: com a
      // planta em alta qualidade (V3.26.2) os pontos viraram bolões.
      // A LINHA continua em SVG (non-scaling-stroke já resolve ela sozinha).
      // Tamanho CONSTANTE em px de tela — não depende do zoom. Escalar
      // com o zoom foi um erro (V3.26.2/3): a bola crescia junto, ficando
      // gigante justo no zoom alto, que é quando se precisa de precisão.
      // Fixo, ela fica proporcionalmente menor (mais precisa) quanto mais
      // se dá zoom, que é o comportamento certo.
      const tamPonto = 9;
      desenhoAtual = `
        ${poligonoPontosPlanta.length >= 2 ? `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:3;">
          <polyline points="${pts}" fill="none" stroke="#2563eb" stroke-width="0.4" vector-effect="non-scaling-stroke"/>
        </svg>` : ''}
        ${poligonoPontosPlanta.map(p => `<div style="position:absolute;left:${(p.x * 100).toFixed(3)}%;top:${(p.y * 100).toFixed(3)}%;width:${tamPonto}px;height:${tamPonto}px;margin:-${tamPonto / 2}px;border-radius:50%;background:#2563eb;border:2px solid #fff;box-shadow:0 0 0 1px #2563eb;z-index:4;pointer-events:none;"></div>`).join('')}
      `;
    }
    let tracosLivres = '';
    if (modoPlanta === 'concretagem-livre' && desenhoLivreTracos.length) {
      tracosLivres = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:3;">
        ${desenhoLivreTracos.map(t => `<polygon points="${t.map(p => `${(p.x * 100).toFixed(3)},${(p.y * 100).toFixed(3)}`).join(' ')}" fill="#a855f755" stroke="#a855f7" stroke-width="0.5" vector-effect="non-scaling-stroke"/>`).join('')}
      </svg>`;
    }
    const bg = imagemBase64
      ? `<img src="${imagemBase64}" style="width:100%;height:100%;display:block;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;pointer-events:none;" draggable="false" onerror="this.style.display='none';this.insertAdjacentHTML('afterend','<div style=&quot;position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#fef2f2;color:#991b1b;font-size:.85rem;text-align:center;padding:20px;&quot;>⚠️ Não consegui carregar a imagem desta prancha (link quebrado ou bloqueio de CORS no Storage). Reimporte o PDF/imagem.</div>')">`
      : `<div style="width:100%;height:100%;background:repeating-linear-gradient(45deg,#f1f5f9,#f1f5f9 10px,#e2e8f0 10px,#e2e8f0 20px);"></div>`;
    const semSelecao = 'user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;';
    const cursorModo = (modoPlanta === 'poligono' || modoPlanta === 'concretagem-livre') ? 'cursor:crosshair;' : 'cursor:grab;';
    const alturaMax = plantaTelaCheiaAtiva ? 'calc(100vh - 190px)' : '600px';
    return `<div class="cc-plan-scroll" style="overflow:auto;max-height:${alturaMax};border:1px solid #e2e8f0;border-radius:8px;background:#fff;overscroll-behavior:contain;${semSelecao}">
      <div id="cc-plan-stage" style="position:relative;width:${w}px;height:${h}px;touch-action:none;${cursorModo}${semSelecao}" onclick="CCON.onCliquePlanta(event)">
        ${bg}${poligonos}${desenhoAtual}${tracosLivres}
      </div>
    </div>`;
  }

  // ── Tela cheia — mesma técnica do Controle de Estacas: realoca o
  // wrapper #cc-planta-wrap (elemento de verdade, com os mesmos
  // listeners) pra um overlay cobrindo a tela inteira, sem recriar nada.
  // ══════════════════════════════════════════
  function alternarTelaCheiaPlanta() {
    if (plantaTelaCheiaAtiva) _sairTelaCheiaPlanta(); else _entrarTelaCheiaPlanta();
  }
  function _entrarTelaCheiaPlanta() {
    const wrap = document.getElementById('cc-planta-wrap');
    if (!wrap) return;
    plantaTelaCheiaGuardado = { parent: wrap.parentNode, next: wrap.nextSibling };
    const overlay = document.createElement('div');
    overlay.id = 'cc-planta-tela-cheia-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:500;background:var(--cor-fundo,#f1f5f9);overflow:auto;padding:10px 16px 16px;';
    overlay.innerHTML = '<button class="btn btn-secundario btn-sm" style="position:absolute;top:10px;right:16px;z-index:1;" onclick="CCON.alternarTelaCheiaPlanta()">✕ Fechar tela cheia (Esc)</button>';
    document.body.appendChild(overlay);
    overlay.appendChild(wrap);
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', _teclaEscTelaCheiaPlanta);
    plantaTelaCheiaAtiva = true;
    renderPlanta();
  }
  function _sairTelaCheiaPlanta() {
    const wrap = document.getElementById('cc-planta-wrap');
    const overlay = document.getElementById('cc-planta-tela-cheia-overlay');
    if (wrap && plantaTelaCheiaGuardado) {
      if (plantaTelaCheiaGuardado.next) plantaTelaCheiaGuardado.parent.insertBefore(wrap, plantaTelaCheiaGuardado.next);
      else plantaTelaCheiaGuardado.parent.appendChild(wrap);
    }
    if (overlay) overlay.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', _teclaEscTelaCheiaPlanta);
    plantaTelaCheiaAtiva = false;
    plantaTelaCheiaGuardado = null;
    renderPlanta();
  }
  function _teclaEscTelaCheiaPlanta(e) { if (e.key === 'Escape') _sairTelaCheiaPlanta(); }

  // ── Limpar áreas (pra descartar uma detecção ruim e tentar de novo) ──
  async function limparAreasPlanta() {
    if (!Permissions.pode('controleConcreto', 'excluir:marcador')) { Utils.toast('Sem permissão para excluir.', 'erro'); return; }
    const marcs = marcadoresDaPranchaAtiva();
    if (!marcs.length) { Utils.toast('Não há áreas marcadas nesta prancha.', 'erro'); return; }
    const vinculadas = marcs.filter(m => m.pecaId).length;
    const ok = await Utils.confirmar(`Apagar TODAS as ${marcs.length} área(s) marcada(s) nesta prancha${vinculadas ? ` (${vinculadas} já vinculada${vinculadas > 1 ? 's' : ''} a peça)` : ''}? Não pode ser desfeito.`);
    if (!ok) return;
    Utils.mostrarLoading();
    try {
      const ops = marcs.map(m => ({ type: 'delete', ref: Database.ref(obraId, COL_MARCADORES).doc(m.id) }));
      for (let i = 0; i < ops.length; i += 400) await Database.batchWrite(ops.slice(i, i + 400));
      await carregar();
      Utils.toast('Áreas apagadas — pode detectar ou desenhar de novo.', 'sucesso');
    } catch (e) {
      Utils.toast('Erro ao apagar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  async function renderPlanta() {
    if (!pranchas.length) {
      const el = document.getElementById('cc-body');
      if (!el) return;
      el.innerHTML = `
        <div class="cc-empty" style="text-align:center;padding:40px 0;">
          <div style="font-size:2rem;margin-bottom:8px;">🗺️</div>
          Nenhuma prancha (PDF/planta do projeto) importada ainda.<br>
          <button class="btn btn-primario btn-sm" style="margin-top:10px;" data-perm="controleConcreto:criar:prancha" onclick="CCON.abrirPranchasPlanta()">⊞ Importar Prancha</button>
        </div>`;
      Permissions.aplicarNaTela(el);
      return;
    }
    // Wrapper persistente — se a tela cheia estiver ativa ele já foi
    // realocado pra dentro do overlay; achamos ele onde estiver em vez de
    // recriar (recriar destruiria a realocação e duplicaria o id).
    let wrap = document.getElementById('cc-planta-wrap');
    if (!wrap) {
      const el = document.getElementById('cc-body');
      if (!el) return;
      el.innerHTML = '<div id="cc-planta-wrap"></div>';
      wrap = document.getElementById('cc-planta-wrap');
    }

    if (!pranchaAtivaId) pranchaAtivaId = pranchas[0].id;
    const pr = pranchas.find(p => p.id === pranchaAtivaId);
    const imagem = pr ? await _obterImagemPrancha(pr.id) : null;
    const marcs = marcadoresDaPranchaAtiva();
    const marcsVisiveis = _marcadoresVisiveisPlanta();
    const vinculadas = marcs.filter(m => m.pecaId).length;
    const scrollAnterior = _scrollOverridePlanta || _lerScrollPlanta();
    _scrollOverridePlanta = null;

    const filtros = [...CC.TIPOS.map(t => [t, t]), ['naoVinculada', 'Não vinculadas']];

    wrap.innerHTML = `
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px;">
        <select class="form-control" style="max-width:260px;" onchange="CCON.onTrocarPranchaPlanta(this.value)">
          ${pranchas.map(p => `<option value="${p.id}" ${p.id === pranchaAtivaId ? 'selected' : ''}>${esc(p.nome)}${p.andar ? ` (${esc(p.andar)})` : ''}</option>`).join('')}
        </select>
        <button class="btn btn-secundario btn-sm" onclick="CCON.abrirPranchasPlanta()">📄 Pranchas</button>
        ${imagem ? `
          <button class="btn btn-dark btn-sm" data-perm="controleConcreto:criar:marcador" onclick="CCON.detectarAreasPlanta()">🔍 Detectar Áreas Automaticamente</button>
          <button class="btn ${modoPlanta === 'poligono' ? 'btn-primario' : 'btn-secundario'} btn-sm" data-perm="controleConcreto:criar:marcador" onclick="CCON.toggleDesenhoManualPlanta()">✏️ Desenhar Área Manual</button>
          <button class="btn ${modoPlanta === 'concretagem-livre' ? 'btn-primario' : 'btn-secundario'} btn-sm" data-perm="controleConcreto:criar:concretagem" onclick="CCON.toggleConcretagemLivre()">◈ Montar Concretagem</button>
          <button class="btn btn-secundario btn-sm" style="color:var(--cv-red,#ef4444);" data-perm="controleConcreto:excluir:marcador" onclick="CCON.limparAreasPlanta()">🗑 Limpar Áreas</button>
          <button class="btn btn-secundario btn-sm" onclick="CCON.alternarTelaCheiaPlanta()">${plantaTelaCheiaAtiva ? '✕ Sair da Tela Cheia' : '⛶ Tela Cheia'}</button>
        ` : ''}
        <span class="text-sm text-muted">${marcs.length} área(s) marcada(s) · ${vinculadas} vinculada(s)</span>
      </div>
      ${imagem ? `
      <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:4px;">
          <button class="btn btn-secundario btn-sm" onclick="CCON.zoomOutPlanta()">➖</button>
          <span class="text-sm text-muted" style="min-width:44px;text-align:center;">${Math.round((zoomPlanta || 1) * 100)}%</span>
          <button class="btn btn-secundario btn-sm" onclick="CCON.zoomInPlanta()">➕</button>
          <button class="btn btn-secundario btn-sm" onclick="CCON.zoomResetPlanta()">100%</button>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
          <span class="text-sm text-muted">Mostrar:</span>
          ${filtros.map(([k, label]) => {
            const cor = CORES_TIPO_PLANTA[k] || '#94a3b8';
            return `
            <label style="display:flex;align-items:center;gap:4px;font-size:0.78rem;cursor:pointer;">
              <input type="checkbox" ${filtroTipoPlanta.has(k) ? 'checked' : ''} onchange="CCON.toggleFiltroTipoPlanta('${k}')">
              <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${cor};"></span> ${esc(label)}
            </label>`;
          }).join('')}
        </div>
      </div>` : ''}
      ${modoPlanta === 'poligono' ? `
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;flex-wrap:wrap;">
          <button class="btn btn-secundario btn-sm" onclick="CCON.desfazerPontoPlanta()">↩ Desfazer ponto</button>
          <button class="btn btn-primario btn-sm" onclick="CCON.concluirDesenhoPlanta()" ${poligonoPontosPlanta.length < 3 ? 'disabled' : ''}>✓ Concluir Área</button>
          <button class="btn btn-secundario btn-sm" onclick="CCON.cancelarDesenhoPlanta()">✕ Cancelar</button>
          ${proximaAreaParaPeca ? `<span class="text-sm" style="font-weight:600;color:#1d4ed8;">→ esta área vai direto pra ${esc(proximaAreaParaPeca.tipo)} — ${esc(proximaAreaParaPeca.nome)}</span>` : ''}
        </div>` : ''}
      ${modoPlanta === 'concretagem-livre' ? _painelConcretagemLivreHTML() : ''}
      ${editandoFormaPlantaId ? `
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;flex-wrap:wrap;">
          <button class="btn btn-primario btn-sm" onclick="CCON.concluirAjusteFormaPlanta()">✓ Salvar ajuste</button>
          <button class="btn btn-secundario btn-sm" onclick="CCON.cancelarAjusteFormaPlanta()">✕ Cancelar</button>
          <span class="text-sm text-muted">Arraste um ponto pra mover · clique rápido (sem arrastar) nele pra excluir</span>
        </div>` : ''}
      ${!imagem ? `<div class="cc-empty">Esta prancha ainda não tem PDF/imagem. <button class="btn btn-secundario btn-sm" onclick="CCON.abrirUploadImagemPlanta('${pr.id}')">⊞ Importar PDF/Imagem</button></div>`
        : _plantaStageHTML(pr, imagem, marcsVisiveis)}
    `;
    Permissions.aplicarNaTela(wrap);
    _aplicarScrollPlanta(scrollAnterior);
    _ligarZoomWheelPlanta();
    _ligarPanArrastoPlanta();
    if (editandoFormaPlantaId) _desenharHandlesEdicaoPlanta();
    if (modoPlanta === 'concretagem-livre') _ligarEventosDesenhoLivre();
  }

  function onTrocarPranchaPlanta(id) {
    pranchaAtivaId = id; modoPlanta = null; poligonoPontosPlanta = []; editandoFormaPlantaId = null;
    renderPlanta();
  }

  function onCliquePlanta(ev) {
    if (_ultimoFoiArrastoPlanta) { _ultimoFoiArrastoPlanta = false; return; } // era pan, não clique de verdade
    const stage = document.getElementById('cc-plan-stage');
    if (!stage) return;
    const p = CC.posRelativa(ev, stage);
    if (modoPlanta === 'poligono') {
      poligonoPontosPlanta.push(p);
      renderPlanta();
      return;
    }
    if (editandoFormaPlantaId) return; // não troca de área enquanto ajusta vértices
    const rect = stage.getBoundingClientRect();
    const m = CC.marcadorMaisProximo(_marcadoresVisiveisPlanta(), p, rect);
    if (m) abrirVincularPlanta(m.id);
  }

  // ── Desenho manual (fallback pra quando a detecção automática não pega) ──
  function toggleDesenhoManualPlanta() {
    if (modoPlanta === 'poligono') { cancelarDesenhoPlanta(); return; }
    if (!Permissions.pode('controleConcreto', 'criar:marcador')) { Utils.toast('Sem permissão para criar.', 'erro'); return; }
    modoPlanta = 'poligono'; poligonoPontosPlanta = []; editandoFormaPlantaId = null; proximaAreaParaPeca = null;
    renderPlanta();
  }
  function desfazerPontoPlanta() { poligonoPontosPlanta.pop(); renderPlanta(); }
  function cancelarDesenhoPlanta() { modoPlanta = null; poligonoPontosPlanta = []; proximaAreaParaPeca = null; renderPlanta(); }

  // Chamado pelo botão "+ Adicionar outra área pra esta peça" dentro do
  // modal de vínculo — pula direto pro desenho, sem passar pelo seletor
  // de novo, pra marcar uma SEGUNDA (ou terceira...) área que é a MESMA
  // peça (ex: viga que passa por trás de outra e continua do outro lado).
  function iniciarNovaAreaParaPeca(pecaId, tipo, nome) {
    if (!Permissions.pode('controleConcreto', 'criar:marcador')) { Utils.toast('Sem permissão para criar.', 'erro'); return; }
    Utils.fecharModal('modal-cc-vincular-planta');
    proximaAreaParaPeca = { pecaId, tipo, nome };
    modoPlanta = 'poligono'; poligonoPontosPlanta = []; editandoFormaPlantaId = null;
    renderPlanta();
  }

  async function concluirDesenhoPlanta() {
    if (poligonoPontosPlanta.length < 3) return;
    if (!Permissions.pode('controleConcreto', 'criar:marcador')) { Utils.toast('Sem permissão para criar.', 'erro'); return; }
    Utils.mostrarLoading();
    try {
      const pontos = [...poligonoPontosPlanta];
      const viaPeca = proximaAreaParaPeca;
      const id = await Database.criar(obraId, COL_MARCADORES, { pranchaId: pranchaAtivaId, pontos, pecaId: viaPeca ? viaPeca.pecaId : '', obraId }, CC.genId('cm'));
      modoPlanta = null; poligonoPontosPlanta = []; proximaAreaParaPeca = null;
      await carregar();
      if (viaPeca) Utils.toast(`✓ Nova área adicionada a ${viaPeca.tipo} — ${viaPeca.nome}!`, 'sucesso');
      else abrirVincularPlanta(id);
    } catch (e) {
      Utils.toast('Erro ao criar área: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ── Detecção automática (geometria pura — ver ConcretoCalculos.detectarAreas) ──
  function _centroidePoligono(pontos) {
    let x = 0, y = 0; pontos.forEach(p => { x += p.x; y += p.y; });
    return { x: x / pontos.length, y: y / pontos.length };
  }
  function _pontoDentroPoligono(p, pontos) {
    let dentro = false;
    for (let i = 0, j = pontos.length - 1; i < pontos.length; j = i++) {
      const xi = pontos[i].x, yi = pontos[i].y, xj = pontos[j].x, yj = pontos[j].y;
      if (((yi > p.y) !== (yj > p.y)) && (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi)) dentro = !dentro;
    }
    return dentro;
  }
  function _areaJaMarcada(area, existentes) {
    const c = _centroidePoligono(area.pontos);
    return existentes.some(m => m.pontos && m.pontos.length >= 3 && _pontoDentroPoligono(c, m.pontos));
  }

  async function detectarAreasPlanta() {
    if (!Permissions.pode('controleConcreto', 'criar:marcador')) { Utils.toast('Sem permissão para criar.', 'erro'); return; }
    const pr = pranchas.find(p => p.id === pranchaAtivaId);
    if (!pr) return;
    const imagem = await _obterImagemPrancha(pr.id);
    if (!imagem) { Utils.toast('Importe o PDF/imagem da prancha primeiro.', 'erro'); return; }
    Utils.mostrarLoading();
    try {
      // crossOrigin obrigatório: a imagem agora vem do Storage (outro
      // domínio) — sem isso o canvas fica "contaminado" e getImageData()
      // abaixo (dentro de CC.detectarAreas) explode com SecurityError,
      // mesmo a imagem aparecendo normalmente na tela via <img>.
      const img = await new Promise((res, rej) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = rej; im.src = imagem; });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      let areas;
      try {
        areas = CC.detectarAreas(canvas);
      } catch (e) {
        if (String(e.message || e).toLowerCase().includes('tainted') || e.name === 'SecurityError') {
          throw new Error('O Storage do Firebase precisa liberar CORS pra essa imagem poder ser analisada (mesmo já aparecendo na tela). Peça pro Milton rodar a configuração de CORS do bucket uma única vez.');
        }
        throw e;
      }
      if (!areas.length) { Utils.toast('Nenhuma área detectada — tente desenhar manualmente.', 'erro'); return; }
      const existentes = marcadoresDaPranchaAtiva();
      const novas = areas.filter(a => !_areaJaMarcada(a, existentes));
      if (!novas.length) { Utils.toast('Nada novo — todas as áreas já foram marcadas.', 'sucesso'); return; }
      const ops = novas.map(a => ({
        type: 'set',
        ref: Database.ref(obraId, COL_MARCADORES).doc(CC.genId('cm')),
        data: { pranchaId: pranchaAtivaId, pontos: a.pontos, pecaId: '', obraId },
      }));
      for (let i = 0; i < ops.length; i += 400) await Database.batchWrite(ops.slice(i, i + 400));
      await carregar();
      Utils.toast(`✓ ${novas.length} área(s) detectada(s)! Clique em cada uma pra vincular à peça.`, 'sucesso');
    } catch (e) {
      Utils.toast('Erro ao detectar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ── Ajuste de forma (arrastar vértices) ──
  function iniciarAjusteFormaPlanta(id) {
    if (!Permissions.pode('controleConcreto', 'editar:marcador')) { Utils.toast('Sem permissão para editar.', 'erro'); return; }
    editandoFormaPlantaId = id;
    Utils.fecharTodosModais();
    renderPlanta();
  }
  function cancelarAjusteFormaPlanta() { editandoFormaPlantaId = null; renderPlanta(); }

  // onMove: chamado a cada movimento de verdade (arrastar o vértice).
  // onCliqueSemMover: chamado se soltar sem ter arrastado de fato (>3px)
  // — usado pra EXCLUIR o vértice com um clique simples, sem precisar de
  // um botão à parte pra cada ponto.
  function _arrastarHandlePlanta(el, onMove, onCliqueSemMover) {
    let x0 = 0, y0 = 0, moveu = false;
    const mover = e => {
      const ev = e.touches ? e.touches[0] : e;
      if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 3) moveu = true;
      onMove(ev);
    };
    const soltar = () => {
      document.removeEventListener('mousemove', mover); document.removeEventListener('mouseup', soltar);
      document.removeEventListener('touchmove', mover); document.removeEventListener('touchend', soltar);
      if (!moveu && onCliqueSemMover) onCliqueSemMover();
    };
    const iniciar = e0 => {
      const p0 = e0.touches ? e0.touches[0] : e0;
      x0 = p0.clientX; y0 = p0.clientY; moveu = false;
    };
    el.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); iniciar(e); document.addEventListener('mousemove', mover); document.addEventListener('mouseup', soltar); });
    el.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); iniciar(e); document.addEventListener('touchmove', mover, { passive: false }); document.addEventListener('touchend', soltar); }, { passive: false });
  }

  function _desenharHandlesEdicaoPlanta() {
    const m = marcadoresProjeto.find(x => x.id === editandoFormaPlantaId);
    const stage = document.getElementById('cc-plan-stage');
    if (!m || !stage) return;
    let cont = document.getElementById('cc-plan-edicao-overlay');
    if (!cont) { cont = document.createElement('div'); cont.id = 'cc-plan-edicao-overlay'; cont.style.cssText = 'position:absolute;inset:0;z-index:10;'; stage.appendChild(cont); }
    cont.innerHTML = '';
    // Tamanho CONSTANTE em px de tela (ver nota em tamPonto, mesma lógica:
    // não depende do zoom — assim fica proporcionalmente mais preciso
    // quanto mais zoom, em vez de virar bola gigante no zoom alto).
    const tam = 9;
    (m.pontos || []).forEach((p, i) => {
      const dot = document.createElement('div');
      dot.style.cssText = `position:absolute;left:${(p.x * 100).toFixed(3)}%;top:${(p.y * 100).toFixed(3)}%;width:${tam}px;height:${tam}px;margin:-${tam / 2}px;border-radius:50%;background:#2563eb;border:2px solid #fff;box-shadow:0 0 0 1px #2563eb;cursor:move;z-index:11;pointer-events:auto;`;
      dot.title = 'Arraste pra ajustar — clique rápido (sem arrastar) pra excluir este vértice';
      _arrastarHandlePlanta(
        dot,
        mv => { m.pontos[i] = CC.posRelativa(mv, stage); _desenharHandlesEdicaoPlanta(); },
        () => {
          if ((m.pontos || []).length <= 3) { Utils.toast('A área precisa de pelo menos 3 pontos.', 'erro'); return; }
          m.pontos.splice(i, 1);
          _desenharHandlesEdicaoPlanta();
        }
      );
      cont.appendChild(dot);
    });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:9;';
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    poly.setAttribute('points', (m.pontos || []).map(p => `${p.x * 100},${p.y * 100}`).join(' '));
    poly.setAttribute('fill', 'rgba(59,130,246,0.15)'); poly.setAttribute('stroke', '#2563eb'); poly.setAttribute('stroke-width', '0.3'); poly.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.appendChild(poly);
    cont.insertBefore(svg, cont.firstChild);
  }

  async function concluirAjusteFormaPlanta() {
    const m = marcadoresProjeto.find(x => x.id === editandoFormaPlantaId);
    if (!m) { editandoFormaPlantaId = null; renderPlanta(); return; }
    Utils.mostrarLoading();
    try {
      await Database.atualizar(obraId, COL_MARCADORES, m.id, { pontos: m.pontos });
      editandoFormaPlantaId = null;
      Utils.toast('✓ Forma ajustada!', 'sucesso');
      await carregar();
    } catch (e) {
      Utils.toast('Erro ao salvar ajuste: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ── Vínculo com peça do Levantamento (tipo + busca + filtro de andar) ──
  function abrirVincularPlanta(marcadorId) {
    const m = marcadoresProjeto.find(x => x.id === marcadorId);
    if (!m) return;
    marcadorVincularId = marcadorId;
    const pecaAtual = m.pecaId ? pecas.find(p => p.id === m.pecaId) : null;
    vincularTipo = pecaAtual ? pecaAtual.tipo : '';
    vincularAndarFiltro = '__prancha__';
    vincularBusca = ''; vincularListaAberta = true; // lista de peças sempre visível — não é mais um dropdown escondido
    _renderVincularPlantaBody();
    Utils.abrirModal('modal-cc-vincular-planta');
  }

  function _pecasElegiveisPlanta() {
    const pr = pranchas.find(p => p.id === pranchaAtivaId);
    const mAtual = marcadoresProjeto.find(x => x.id === marcadorVincularId);
    const pecaAtualId = mAtual ? mAtual.pecaId : null;
    return pecas.filter(p => {
      if (p.id === pecaAtualId) return true; // a peça já vinculada sempre aparece, mesmo fora do filtro
      if (vincularTipo && _tipoNormalizadoPlanta(p.tipo) !== vincularTipo) return false;
      // Comparação de andar TOLERANTE (CC.normalizarAndar) — comparar a
      // string crua fazia peça com "TERREO"/"terreo"/etc. sumir da busca
      // mesmo sendo visualmente o mesmo andar da prancha ("Térreo").
      if (vincularAndarFiltro === '__prancha__' && pr && pr.andar) {
        return CC.normalizarAndar(p.andar) === CC.normalizarAndar(pr.andar);
      }
      return true;
    });
  }
  function _marcadorDaPecaPlanta(pecaId, excetoId) {
    return marcadoresProjeto.find(m => m.pecaId === pecaId && m.id !== excetoId);
  }

  function onTipoVincularPlanta(v) {
    vincularTipo = v;
    const hid = document.getElementById('cc-vincular-peca'); if (hid) hid.value = '';
    const inputBusca = document.getElementById('cc-vincular-peca-busca'); if (inputBusca) inputBusca.value = '';
    vincularBusca = ''; vincularListaAberta = true;
    _renderListaPecaBuscaPlanta();
  }
  function onAndarFiltroVincularPlanta(v) { vincularAndarFiltro = v; _renderListaPecaBuscaPlanta(); }
  function onFocoBuscaPecaPlanta() { vincularListaAberta = true; _renderListaPecaBuscaPlanta(); }
  function fecharListaPecaBuscaPlanta() { /* lista fica sempre visível — nada a fazer */ }
  function onBuscaPecaPlanta(v) {
    vincularBusca = v; vincularListaAberta = true;
    const hid = document.getElementById('cc-vincular-peca'); if (hid) hid.value = '';
    _renderListaPecaBuscaPlanta();
  }
  function _pecasFiltradasBuscaPlanta() {
    const elegiveis = _pecasElegiveisPlanta();
    const termo = (vincularBusca || '').trim().toLowerCase();
    if (!termo) return elegiveis;
    return elegiveis.filter(p => `${p.nome} ${p.andar}`.toLowerCase().includes(termo));
  }
  function _renderListaPecaBuscaPlanta() {
    const el = document.getElementById('cc-vincular-peca-lista');
    if (!el) return;
    const lista = _pecasFiltradasBuscaPlanta();
    el.innerHTML = `
      <div style="padding:8px 12px;cursor:pointer;color:var(--cv-text3,#94a3b8);font-size:.85rem;" onmousedown="CCON.selecionarPecaBuscaPlanta('')">— Nenhuma —</div>
      ${lista.length ? lista.map(p => {
        const outro = _marcadorDaPecaPlanta(p.id, marcadorVincularId);
        const ativo = p.id === (document.getElementById('cc-vincular-peca') ? document.getElementById('cc-vincular-peca').value : '');
        return `<div style="padding:9px 12px;cursor:pointer;border-top:1px solid var(--cv-border,#f1f5f9);${ativo ? 'background:var(--cor-primaria-light,#fef9e7);' : ''}" onmousedown="CCON.selecionarPecaBuscaPlanta('${p.id}')">
          <div style="font-weight:600;font-size:.85rem;">${esc(p.nome)}${outro ? ' <span style="color:var(--cv-text3,#94a3b8);font-weight:400;font-size:.75rem;">— já tem outra área (ok se for a mesma peça dividida)</span>' : ''}</div>
          <div class="text-sm text-muted">${esc(p.tipo)} · ${esc(p.andar)}</div>
        </div>`;
      }).join('') : '<div style="padding:10px 12px;color:var(--cv-text3,#94a3b8);font-size:.82rem;">Nenhuma peça encontrada.</div>'}
    `;
  }
  function selecionarPecaBuscaPlanta(pecaId) {
    const hid = document.getElementById('cc-vincular-peca'); if (hid) hid.value = pecaId;
    const p = pecaId ? pecas.find(x => x.id === pecaId) : null;
    const inputBusca = document.getElementById('cc-vincular-peca-busca'); if (inputBusca) inputBusca.value = p ? p.nome : '';
    vincularBusca = '';
    _renderListaPecaBuscaPlanta();
  }

  function _renderVincularPlantaBody() {
    const el = document.getElementById('cc-vincular-planta-body');
    if (!el) return;
    const m = marcadoresProjeto.find(x => x.id === marcadorVincularId);
    if (!m) { el.innerHTML = ''; return; }
    const pecaAtual = m.pecaId ? pecas.find(p => p.id === m.pecaId) : null;
    const pr = pranchas.find(p => p.id === pranchaAtivaId);
    el.innerHTML = `
      ${pecaAtual ? `<div class="cc-empty" style="margin-bottom:10px;">Vinculada a: <b>${esc(pecaAtual.tipo)} — ${esc(pecaAtual.nome)}</b></div>` : ''}
      <div class="form-grupo">
        <label>Tipo</label>
        <select class="form-control" id="cc-vincular-tipo" onchange="CCON.onTipoVincularPlanta(this.value)">
          <option value="">Todos os tipos</option>
          ${CC.TIPOS.map(t => `<option value="${esc(t)}" ${vincularTipo === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}
        </select>
      </div>
      <div class="form-grupo">
        <label>Andar</label>
        <select class="form-control" id="cc-vincular-andar" onchange="CCON.onAndarFiltroVincularPlanta(this.value)">
          <option value="__prancha__" ${vincularAndarFiltro === '__prancha__' ? 'selected' : ''}>Só ${esc(pr && pr.andar ? pr.andar : 'o andar desta prancha')}</option>
          <option value="todos" ${vincularAndarFiltro === 'todos' ? 'selected' : ''}>Todos os andares</option>
        </select>
      </div>
      <div class="form-grupo">
        <label>Peça do Levantamento de Concreto</label>
        <input type="text" class="form-control" id="cc-vincular-peca-busca" placeholder="🔍 Filtrar por nome... (ou clique direto na lista abaixo)"
          value="" oninput="CCON.onBuscaPecaPlanta(this.value)" autocomplete="off" style="margin-bottom:6px;">
        <input type="hidden" id="cc-vincular-peca" value="${m.pecaId || ''}">
        <div id="cc-vincular-peca-lista" style="background:#fff;border:1px solid var(--cv-border,#e2e8f0);border-radius:8px;max-height:320px;overflow-y:auto;"></div>
        ${!_pecasElegiveisPlanta().length ? `<p class="text-sm text-muted" style="margin-top:6px;">Nenhuma peça encontrada com esse filtro — confira o tipo/andar, ou cadastre no <a href="levantamento-concreto.html" style="color:var(--cor-primaria-dark);font-weight:600;">Levantamento de Concreto</a>.</p>` : ''}
      </div>
      <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;">
        ${pecaAtual ? `<button class="btn btn-secundario btn-sm" data-perm="controleConcreto:criar:marcador" onclick="CCON.iniciarNovaAreaParaPeca('${pecaAtual.id}', '${esc(pecaAtual.tipo)}', '${esc(pecaAtual.nome)}')">➕ Adicionar outra área pra esta peça</button>` : ''}
        <button class="btn btn-secundario btn-sm" data-perm="controleConcreto:editar:marcador" onclick="CCON.iniciarAjusteFormaPlanta('${m.id}')">✎ Ajustar forma</button>
        <button class="btn btn-secundario btn-sm" style="color:var(--cv-red,#ef4444);" data-perm="controleConcreto:excluir:marcador" onclick="CCON.excluirMarcadorPlanta('${m.id}')">🗑 Excluir área</button>
      </div>
      ${pecaAtual ? `<p class="text-sm text-muted" style="margin-top:8px;">Use "Adicionar outra área" quando esta peça aparece dividida em pedaços no desenho (ex: uma viga que passa por trás de outra e continua do outro lado) — as duas áreas ficam vinculadas à mesma peça.</p>` : ''}
    `;
    Permissions.aplicarNaTela(document.getElementById('modal-cc-vincular-planta'));
    _renderListaPecaBuscaPlanta();
  }

  async function salvarVinculoPlanta(continuar) {
    if (!Permissions.pode('controleConcreto', 'editar:vinculo') && !Permissions.pode('controleConcreto', 'criar:marcador')) { Utils.toast('Sem permissão.', 'erro'); return; }
    const m = marcadoresProjeto.find(x => x.id === marcadorVincularId);
    if (!m) return;
    const pecaId = document.getElementById('cc-vincular-peca').value || '';
    if (pecaId) {
      const outro = _marcadorDaPecaPlanta(pecaId, m.id);
      if (outro) {
        const ok = await Utils.confirmar('Esta peça já tem outra área vinculada nesta prancha — normal quando a peça aparece dividida em pedaços no desenho (ex: uma viga que passa por trás de outra). Vincular esta área também à mesma peça?');
        if (!ok) return;
      }
    }
    Utils.mostrarLoading();
    try {
      await Database.atualizar(obraId, COL_MARCADORES, m.id, { pecaId });
      Utils.fecharModal('modal-cc-vincular-planta');
      await carregar();
      Utils.toast(continuar ? '✓ Salvo!' : '✓ Vínculo salvo!', 'sucesso');
    } catch (e) {
      Utils.toast('Erro ao salvar vínculo: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  async function excluirMarcadorPlanta(id) {
    if (!Permissions.pode('controleConcreto', 'excluir:marcador')) { Utils.toast('Sem permissão para excluir.', 'erro'); return; }
    const ok = await Utils.confirmar('Excluir esta área? O vínculo com a peça também é removido (a peça em si não é afetada).');
    if (!ok) return;
    Utils.mostrarLoading();
    try {
      await Database.deletar(obraId, COL_MARCADORES, id);
      Utils.fecharModal('modal-cc-vincular-planta');
      await carregar();
      Utils.toast('Área excluída.', 'sucesso');
    } catch (e) {
      Utils.toast('Erro ao excluir: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ── Gestão de Pranchas ──
  function abrirPranchasPlanta() {
    _renderPranchasBody();
    Utils.abrirModal('modal-cc-pranchas');
  }
  function _renderPranchasBody() {
    const selAndar = document.getElementById('cc-nova-prancha-andar');
    if (selAndar) {
      const atual = selAndar.value;
      const andares = todosAndares();
      selAndar.innerHTML = `<option value="">Sem andar definido</option>${andares.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('')}`;
      if (andares.includes(atual)) selAndar.value = atual;
    }
    const el = document.getElementById('cc-pranchas-lista');
    if (!el) return;
    el.innerHTML = pranchas.length ? pranchas.map(p => `
      <div style="display:flex;align-items:center;gap:10px;border:1px solid var(--cv-border,#e2e8f0);border-radius:8px;padding:10px 12px;margin-bottom:8px;flex-wrap:wrap;">
        <div style="flex:1;min-width:140px;">
          <div style="font-weight:700;">${esc(p.nome)}</div>
          <div class="text-sm text-muted">${esc(p.andar || '—')}${p.imgWidthPx ? ' · imagem importada' : ' · sem imagem ainda'}</div>
        </div>
        <button class="btn btn-secundario btn-sm" data-perm="controleConcreto:editar:prancha" onclick="CCON.abrirUploadImagemPlanta('${p.id}')">⊞ ${p.imgWidthPx ? 'Atualizar Projeto' : 'Importar PDF/Imagem'}</button>
        <button class="btn btn-secundario btn-sm" data-perm="controleConcreto:editar:prancha" onclick="CCON.renomearPranchaPlanta('${p.id}')">✎</button>
        <button class="btn btn-secundario btn-sm" style="color:var(--cv-red,#ef4444);" data-perm="controleConcreto:excluir:prancha" onclick="CCON.excluirPranchaPlanta('${p.id}')">🗑</button>
      </div>
    `).join('') : `<div class="cc-empty">Nenhuma prancha ainda.</div>`;
    Permissions.aplicarNaTela(document.getElementById('modal-cc-pranchas'));
  }
  async function novaPranchaPlanta() {
    if (!Permissions.pode('controleConcreto', 'criar:prancha')) { Utils.toast('Sem permissão para criar.', 'erro'); return; }
    const nome = (document.getElementById('cc-nova-prancha-nome').value || '').trim();
    const andar = document.getElementById('cc-nova-prancha-andar').value || '';
    if (!nome) { Utils.toast('Dê um nome pra prancha (ex: Térreo).', 'erro'); return; }
    Utils.mostrarLoading();
    try {
      const id = await Database.criar(obraId, COL_PRANCHAS, { nome, andar, obraId }, CC.genId('pr'));
      document.getElementById('cc-nova-prancha-nome').value = '';
      pranchaAtivaId = id;
      await carregar();
      _renderPranchasBody();
      Utils.toast('✓ Prancha criada! Agora importe o PDF/imagem.', 'sucesso');
    } catch (e) {
      Utils.toast('Erro ao criar prancha: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }
  async function renomearPranchaPlanta(id) {
    if (!Permissions.pode('controleConcreto', 'editar:prancha')) { Utils.toast('Sem permissão para editar.', 'erro'); return; }
    const pr = pranchas.find(p => p.id === id); if (!pr) return;
    const novoNome = prompt('Novo nome da prancha:', pr.nome || '');
    if (!novoNome || !novoNome.trim()) return;
    Utils.mostrarLoading();
    try {
      await Database.atualizar(obraId, COL_PRANCHAS, id, { nome: novoNome.trim() });
      await carregar();
      _renderPranchasBody();
    } catch (e) {
      Utils.toast('Erro ao renomear: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }
  async function excluirPranchaPlanta(id) {
    if (!Permissions.pode('controleConcreto', 'excluir:prancha')) { Utils.toast('Sem permissão para excluir.', 'erro'); return; }
    const ok = await Utils.confirmar('Excluir esta prancha? Todas as áreas marcadas nela também serão removidas (os vínculos com peças do Levantamento não são afetados).');
    if (!ok) return;
    Utils.mostrarLoading();
    try {
      const marcs = marcadoresProjeto.filter(m => m.pranchaId === id);
      const ops = marcs.map(m => ({ type: 'delete', ref: Database.ref(obraId, COL_MARCADORES).doc(m.id) }));
      for (let i = 0; i < ops.length; i += 400) await Database.batchWrite(ops.slice(i, i + 400));
      await Database.deletar(obraId, COL_PRANCHAS, id);
      await db.collection('obras').doc(obraId).collection('config').doc('concretoImagem_' + id).delete().catch(() => {});
      await deletarImagem(`obras/${obraId}/concreto-plantas/${id}.png`).catch(() => {});
      if (pranchaAtivaId === id) pranchaAtivaId = null;
      await carregar();
      _renderPranchasBody();
      Utils.toast('Prancha excluída.', 'sucesso');
    } catch (e) {
      Utils.toast('Erro ao excluir: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ── Import de PDF/imagem (mesmo pipeline do Controle de Estacas) ──
  async function _carregarPdfjs() {
    if (pdfjsCarregado || typeof pdfjsLib !== 'undefined') { pdfjsCarregado = true; return; }
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    pdfjsCarregado = true;
  }
  async function _processarArquivoPranchaPlanta(file, pranchaId, statusEl) {
    if (statusEl) statusEl.textContent = 'Processando...';
    let canvas;
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      await _carregarPdfjs();
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      const page = await pdf.getPage(1);
      const viewportBase = page.getViewport({ scale: 1 });
      // Antes ficava em 2200px + JPEG comprimido (limite de ~950KB do
      // Firestore) — planta técnica cheia de texto/cota miúdo ficava
      // ilegível. Agora vai pro Storage (sem esse teto), então sobe a
      // resolução de verdade e salva sem perda (PNG).
      const alvo = 4500;
      const escala = Math.min(4, alvo / Math.max(viewportBase.width, viewportBase.height));
      const viewport = page.getViewport({ scale: escala });
      canvas = document.createElement('canvas');
      canvas.width = viewport.width; canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    } else {
      const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = URL.createObjectURL(file); });
      canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
    }
    if (statusEl) statusEl.textContent = 'Enviando (planta em alta qualidade pode demorar um pouco)...';
    const dataUrl = canvas.toDataURL('image/png');
    const path = `obras/${obraId}/concreto-plantas/${pranchaId}.png`;
    const url = await uploadImagem(path, dataUrl);
    await Database.atualizar(obraId, COL_PRANCHAS, pranchaId, { imgUrl: url, imgWidthPx: canvas.width, imgHeightPx: canvas.height });
    _imagemPranchaCacheId = null;
    if (statusEl) statusEl.textContent = '✓ Imagem carregada!';
  }
  function abrirUploadImagemPlanta(pranchaId) {
    document.getElementById('cc-img-pranchaid').value = pranchaId;
    document.getElementById('cc-img-status').textContent = '';
    Utils.abrirModal('modal-cc-imagem-planta');
  }
  async function onImagemArquivoPlanta(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const pranchaId = document.getElementById('cc-img-pranchaid').value;
    const statusEl = document.getElementById('cc-img-status');
    Utils.mostrarLoading();
    try {
      await _processarArquivoPranchaPlanta(file, pranchaId, statusEl);
      Utils.toast('✓ Prancha atualizada!', 'sucesso');
      Utils.fecharModal('modal-cc-imagem-planta');
      pranchaAtivaId = pranchaId;
      await carregar();
      _renderPranchasBody();
    } catch (e) {
      console.error(e);
      statusEl.textContent = 'Erro: ' + e.message;
      Utils.toast('Erro ao processar arquivo: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
      input.value = '';
    }
  }

  // ── Montar Concretagem desenhando livre (V2.0 parte 2) ──
  // Desenha uma ou mais áreas soltas sobre a planta; o sistema soma a
  // sobreposição de cada área desenhada com cada peça já vinculada nesta
  // prancha e monta a Concretagem sozinho, com o % de cada peça.
  function _proximoNumeroConcSugerido() {
    const nums = concretagens.map(c => parseInt(c.numero) || 0);
    return nums.length ? Math.max(...nums) + 1 : 1;
  }
  function toggleConcretagemLivre() {
    if (modoPlanta === 'concretagem-livre') { cancelarConcretagemLivre(); return; }
    if (!Permissions.pode('controleConcreto', 'criar:concretagem')) { Utils.toast('Sem permissão para criar.', 'erro'); return; }
    const marcs = marcadoresDaPranchaAtiva().filter(m => m.pecaId);
    if (!marcs.length) { Utils.toast('Vincule ao menos uma área a uma peça antes de montar a concretagem por aqui.', 'erro'); return; }
    modoPlanta = 'concretagem-livre';
    editandoFormaPlantaId = null;
    desenhoLivreTracos = []; desenhoLivreEmAndamento = null;
    concLivre = { numero: String(_proximoNumeroConcSugerido()), data: new Date().toISOString().slice(0, 10), resultados: null };
    renderPlanta();
  }
  function cancelarConcretagemLivre() {
    modoPlanta = null; desenhoLivreTracos = []; desenhoLivreEmAndamento = null; concLivre = null;
    renderPlanta();
  }
  function desfazerTracoLivre() { desenhoLivreTracos.pop(); concLivre.resultados = null; renderPlanta(); }
  function concLivreUpd(campo, valor) { if (concLivre) concLivre[campo] = valor; }

  function _painelConcretagemLivreHTML() {
    if (!concLivre) return '';
    return `
      <div style="border:1px solid var(--cv-border,#e2e8f0);border-radius:8px;padding:12px;margin-bottom:10px;background:#faf5ff;">
        <p class="text-sm text-muted" style="margin:0 0 8px;">Desenhe livremente por cima das áreas que fazem parte desta Concretagem (pode ser mais de uma área solta). Depois clique em Calcular.</p>
        <div class="form-row" style="margin-bottom:8px;">
          <div class="form-grupo" style="margin-bottom:0;"><label>Número</label><input type="text" inputmode="numeric" class="form-control" value="${esc(concLivre.numero)}" oninput="CCON.concLivreUpd('numero', this.value)"></div>
          <div class="form-grupo" style="margin-bottom:0;"><label>Data</label><input type="date" class="form-control" value="${esc(concLivre.data)}" oninput="CCON.concLivreUpd('data', this.value)"></div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-secundario btn-sm" onclick="CCON.desfazerTracoLivre()" ${!desenhoLivreTracos.length ? 'disabled' : ''}>↩ Desfazer traço</button>
          <button class="btn btn-primario btn-sm" onclick="CCON.processarConcretagemLivre()" ${!desenhoLivreTracos.length ? 'disabled' : ''}>✓ Calcular Sobreposição</button>
          <button class="btn btn-secundario btn-sm" onclick="CCON.cancelarConcretagemLivre()">✕ Cancelar</button>
        </div>
        ${concLivre.resultados ? `
          <div style="margin-top:12px;border-top:1px solid var(--cv-border,#e2e8f0);padding-top:10px;">
            <div style="font-weight:700;font-size:0.85rem;margin-bottom:6px;">${concLivre.resultados.length} peça(s) encontrada(s):</div>
            ${concLivre.resultados.map(r => `<div class="text-sm" style="display:flex;justify-content:space-between;padding:3px 0;"><span>${esc(r.peca.nome)} <span class="text-muted">(${esc(r.peca.tipo)})</span></span><b>${r.pct}%</b></div>`).join('')}
            <button class="btn btn-primario btn-sm" style="margin-top:10px;" onclick="CCON.salvarConcretagemLivre()">✓ Confirmar e Salvar Concretagem</button>
          </div>` : ''}
      </div>`;
  }

  function _ligarEventosDesenhoLivre() {
    const stage = document.getElementById('cc-plan-stage');
    if (!stage || modoPlanta !== 'concretagem-livre') return;
    let desenhando = false;
    const addPonto = ev => { desenhoLivreEmAndamento.push(CC.posRelativa(ev, stage)); _redesenharTracoAoVivo(); };
    const onDown = e => { e.preventDefault(); desenhando = true; desenhoLivreEmAndamento = []; addPonto(e.touches ? e.touches[0] : e); };
    const onMove = e => { if (!desenhando) return; addPonto(e.touches ? e.touches[0] : e); };
    const onUp = () => {
      if (!desenhando) return;
      desenhando = false;
      if (desenhoLivreEmAndamento && desenhoLivreEmAndamento.length >= 3) { desenhoLivreTracos.push(desenhoLivreEmAndamento); concLivre.resultados = null; }
      desenhoLivreEmAndamento = null;
      renderPlanta();
    };
    stage.addEventListener('mousedown', onDown);
    stage.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    stage.addEventListener('touchstart', onDown, { passive: false });
    stage.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
  }
  function _redesenharTracoAoVivo() {
    const stage = document.getElementById('cc-plan-stage');
    if (!stage || !desenhoLivreEmAndamento) return;
    let poly = document.getElementById('cc-plan-live-poly');
    if (!poly) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none');
      svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:5;';
      poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      poly.id = 'cc-plan-live-poly';
      poly.setAttribute('fill', 'none'); poly.setAttribute('stroke', '#a855f7'); poly.setAttribute('stroke-width', '0.5'); poly.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.appendChild(poly);
      stage.appendChild(svg);
    }
    poly.setAttribute('points', desenhoLivreEmAndamento.map(p => `${p.x * 100},${p.y * 100}`).join(' '));
  }

  function processarConcretagemLivre() {
    if (!desenhoLivreTracos.length) { Utils.toast('Desenhe ao menos uma área.', 'erro'); return; }
    const marcs = marcadoresDaPranchaAtiva().filter(m => m.pecaId);
    const resultados = [];
    marcs.forEach(m => {
      const pct = CC.pctSobreposicao(m.pontos, desenhoLivreTracos);
      if (pct >= 2) {
        const p = pecas.find(x => x.id === m.pecaId);
        if (p) resultados.push({ pecaId: p.id, peca: p, pct: Math.min(100, Math.round(pct)) });
      }
    });
    if (!resultados.length) { Utils.toast('Nenhuma peça vinculada foi coberta pelo desenho.', 'erro'); return; }
    concLivre.resultados = resultados;
    renderPlanta();
  }

  async function salvarConcretagemLivre() {
    if (!Permissions.pode('controleConcreto', 'criar:concretagem')) { Utils.toast('Sem permissão para criar.', 'erro'); return; }
    if (!concLivre || !concLivre.resultados || !concLivre.resultados.length) return;
    const numero = parseInt(concLivre.numero) || 0;
    if (!numero) { Utils.toast('Informe o número da concretagem.', 'erro'); return; }
    Utils.mostrarLoading();
    try {
      const concExistente = concretagens.find(c => c.numero === numero);
      const ops = [];
      let concId;
      if (concExistente) {
        concId = concExistente.id;
        if (concExistente.pranchaId !== pranchaAtivaId) {
          ops.push({ type: 'update', ref: Database.ref(obraId, COL_CONCS).doc(concId), data: { pranchaId: pranchaAtivaId } });
        }
      } else {
        concId = await Database.criar(obraId, COL_CONCS, { numero, data: concLivre.data || new Date().toISOString().slice(0, 10), descricao: '', pranchaId: pranchaAtivaId, obraId }, CC.genId('conc'));
      }
      concLivre.resultados.forEach(r => {
        const existentePC = pecaConc.find(pc => pc.pecaId === r.pecaId && pc.concretagemId === concId);
        if (existentePC) ops.push({ type: 'update', ref: Database.ref(obraId, COL_PC).doc(existentePC.id), data: { pctConcretagem: r.pct } });
        else ops.push({ type: 'set', ref: Database.ref(obraId, COL_PC).doc(CC.genId('pc')), data: { pecaId: r.pecaId, concretagemId: concId, pctConcretagem: r.pct, obraId } });
      });
      for (let i = 0; i < ops.length; i += 400) await Database.batchWrite(ops.slice(i, i + 400));
      const qtd = concLivre.resultados.length;
      modoPlanta = null; desenhoLivreTracos = []; desenhoLivreEmAndamento = null; concLivre = null;
      await carregar();
      Utils.toast(`✓ Concretagem Nº${numero} montada com ${qtd} peça(s)!`, 'sucesso');
    } catch (e) {
      Utils.toast('Erro ao salvar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ── "Controlar pelo Projeto" no lançamento de BT (V2.0 parte 2) ──
  // Mesma conta de sobreposição, só que o resultado preenche o % da BT
  // (dentro da concretagem já selecionada) em vez de montar a concretagem.
  function _marcadoresBtProjeto() {
    if (!btProjeto) return [];
    return marcadoresProjeto.filter(m => m.pranchaId === btProjeto.pranchaId && m.pecaId && btProjeto.pecaIds.includes(m.pecaId));
  }

  function abrirBtProjeto() {
    if (!bt || !bt.concId) { Utils.toast('Selecione a concretagem primeiro.', 'erro'); return; }
    const concSel = concretagens.find(c => c.id === bt.concId);
    const pecaIds = pecaConc.filter(pc => pc.concretagemId === bt.concId).map(pc => pc.pecaId);
    let pranchaIds;
    if (concSel && concSel.pranchaId && pranchas.find(p => p.id === concSel.pranchaId)) {
      pranchaIds = [concSel.pranchaId];
    } else {
      const marcs = marcadoresProjeto.filter(m => m.pecaId && pecaIds.includes(m.pecaId));
      pranchaIds = [...new Set(marcs.map(m => m.pranchaId))];
    }
    if (!pranchaIds.length) { Utils.toast('Nenhuma prancha vinculada a esta concretagem — edite a concretagem e escolha a prancha, ou marque as peças na aba Planta.', 'erro'); return; }
    btProjeto = { pranchaId: pranchaIds[0], pranchaIds, pecaIds, tracos: [], emAndamento: null, resultados: null };
    Utils.abrirModal('modal-cc-bt-projeto');
    _renderBtProjetoBody();
  }
  function onTrocarPranchaBtProjeto(id) {
    btProjeto.pranchaId = id; btProjeto.tracos = []; btProjeto.emAndamento = null; btProjeto.resultados = null;
    _renderBtProjetoBody();
  }
  function desfazerTracoBtProjeto() { btProjeto.tracos.pop(); btProjeto.resultados = null; _renderBtProjetoBody(); }
  function cancelarBtProjeto() { Utils.fecharModal('modal-cc-bt-projeto'); btProjeto = null; }

  function _btProjetoStageHTML(prancha, imagemBase64, marcadores) {
    const W = CC.num(prancha.imgWidthPx) || 800, H = CC.num(prancha.imgHeightPx) || 500;
    const poligonos = (marcadores || []).map(m => {
      const pts = m.pontos.map(p => `${(p.x * 100).toFixed(3)},${(p.y * 100).toFixed(3)}`).join(' ');
      return `<polygon points="${pts}" fill="#22c55e33" stroke="#22c55e" stroke-width="0.4" vector-effect="non-scaling-stroke"/>`;
    }).join('');
    const tracos = (btProjeto.tracos || []).map(t => {
      const pts = t.map(p => `${(p.x * 100).toFixed(3)},${(p.y * 100).toFixed(3)}`).join(' ');
      return `<polygon points="${pts}" fill="#a855f755" stroke="#a855f7" stroke-width="0.5" vector-effect="non-scaling-stroke"/>`;
    }).join('');
    const semSelecao = 'user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;';
    const bg = `<img src="${imagemBase64}" style="width:100%;height:100%;display:block;user-select:none;pointer-events:none;" draggable="false">`;
    return `<div style="overflow:auto;max-height:420px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;overscroll-behavior:contain;${semSelecao}">
      <div id="cc-btproj-stage" style="position:relative;width:${W}px;height:${H}px;touch-action:none;cursor:crosshair;${semSelecao}">
        ${bg}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;">${poligonos}${tracos}</svg>
      </div>
    </div>`;
  }

  async function _renderBtProjetoBody() {
    const el = document.getElementById('cc-bt-projeto-body');
    if (!el || !btProjeto) return;
    const pranchasComPeca = (btProjeto.pranchaIds || [btProjeto.pranchaId]).map(id => pranchas.find(p => p.id === id)).filter(Boolean);
    const pr = pranchas.find(p => p.id === btProjeto.pranchaId);
    const marcs = _marcadoresBtProjeto();
    const imagem = pr ? await _obterImagemPrancha(pr.id) : null;
    if (!btProjeto) return; // pode ter sido cancelado enquanto a imagem carregava
    el.innerHTML = `
      ${pranchasComPeca.length > 1 ? `
        <div class="form-grupo">
          <label>Prancha</label>
          <select class="form-control" onchange="CCON.onTrocarPranchaBtProjeto(this.value)">
            ${pranchasComPeca.map(p => `<option value="${p.id}" ${p.id === btProjeto.pranchaId ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}
          </select>
        </div>` : ''}
      <p class="text-sm text-muted">Desenhe livremente por cima das peças que esta BT cobriu (pode ser mais de uma área).</p>
      <div style="display:flex;gap:8px;margin-bottom:8px;">
        <button class="btn btn-secundario btn-sm" onclick="CCON.desfazerTracoBtProjeto()" ${!btProjeto.tracos.length ? 'disabled' : ''}>↩ Desfazer traço</button>
        <button class="btn btn-primario btn-sm" onclick="CCON.calcularBtProjeto()" ${!btProjeto.tracos.length ? 'disabled' : ''}>✓ Calcular</button>
      </div>
      ${imagem ? _btProjetoStageHTML(pr, imagem, marcs) : '<div class="cc-empty">Esta prancha não tem imagem importada.</div>'}
      ${btProjeto.resultados ? `
        <div style="margin-top:14px;border-top:1px solid var(--cv-border,#e2e8f0);padding-top:12px;">
          <div style="font-weight:700;margin-bottom:8px;">${btProjeto.resultados.length} peça(s) encontrada(s):</div>
          ${btProjeto.resultados.map(r => `<div class="text-sm" style="display:flex;justify-content:space-between;padding:4px 0;"><span>${esc(r.peca.nome)} <span class="text-muted">(${esc(r.peca.tipo)})</span></span><b>${r.pct}%</b></div>`).join('')}
          <button class="btn btn-primario btn-sm" style="margin-top:10px;" onclick="CCON.usarResultadoBtProjeto()">✓ Usar estes valores na BT</button>
        </div>` : ''}
    `;
    _ligarEventosDesenhoBtProjeto();
  }

  function _ligarEventosDesenhoBtProjeto() {
    const stage = document.getElementById('cc-btproj-stage');
    if (!stage || !btProjeto) return;
    let desenhando = false;
    const addPonto = ev => { btProjeto.emAndamento.push(CC.posRelativa(ev, stage)); _redesenharTracoAoVivoBtProjeto(); };
    const onDown = e => { e.preventDefault(); desenhando = true; btProjeto.emAndamento = []; addPonto(e.touches ? e.touches[0] : e); };
    const onMove = e => { if (!desenhando) return; addPonto(e.touches ? e.touches[0] : e); };
    const onUp = () => {
      if (!desenhando) return;
      desenhando = false;
      if (btProjeto.emAndamento && btProjeto.emAndamento.length >= 3) { btProjeto.tracos.push(btProjeto.emAndamento); btProjeto.resultados = null; }
      btProjeto.emAndamento = null;
      _renderBtProjetoBody();
    };
    stage.addEventListener('mousedown', onDown);
    stage.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    stage.addEventListener('touchstart', onDown, { passive: false });
    stage.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
  }
  function _redesenharTracoAoVivoBtProjeto() {
    const stage = document.getElementById('cc-btproj-stage');
    if (!stage || !btProjeto || !btProjeto.emAndamento) return;
    let poly = document.getElementById('cc-btproj-live-poly');
    if (!poly) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none');
      svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:5;';
      poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      poly.id = 'cc-btproj-live-poly';
      poly.setAttribute('fill', 'none'); poly.setAttribute('stroke', '#a855f7'); poly.setAttribute('stroke-width', '0.5'); poly.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.appendChild(poly);
      stage.appendChild(svg);
    }
    poly.setAttribute('points', btProjeto.emAndamento.map(p => `${p.x * 100},${p.y * 100}`).join(' '));
  }

  function calcularBtProjeto() {
    if (!btProjeto || !btProjeto.tracos.length) { Utils.toast('Desenhe ao menos uma área.', 'erro'); return; }
    const marcs = _marcadoresBtProjeto();
    const resultados = [];
    marcs.forEach(m => {
      const pct = CC.pctSobreposicao(m.pontos, btProjeto.tracos);
      if (pct >= 2) {
        const p = pecas.find(x => x.id === m.pecaId);
        if (p) resultados.push({ pecaId: p.id, peca: p, pct: Math.min(100, Math.round(pct)) });
      }
    });
    if (!resultados.length) { Utils.toast('Nenhuma peça foi coberta pelo desenho.', 'erro'); return; }
    btProjeto.resultados = resultados;
    _renderBtProjetoBody();
  }

  function usarResultadoBtProjeto() {
    if (!btProjeto || !btProjeto.resultados) return;
    btProjeto.resultados.forEach(r => {
      const idx = bt.linhas.findIndex(l => l.pecaId === r.pecaId);
      if (idx >= 0) bt.linhas[idx].pct = String(r.pct);
      else bt.linhas.push({ pecaId: r.pecaId, pct: String(r.pct) });
    });
    bt.linhas = bt.linhas.filter(l => l.pecaId);
    if (!bt.linhas.length) bt.linhas = [{ pecaId: '', pct: '' }];
    Utils.fecharModal('modal-cc-bt-projeto');
    btProjeto = null;
    renderLancarBT();
    Utils.toast('✓ Valores preenchidos — confira e lance a BT.', 'sucesso');
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
    // Planta do Projeto (V2.0)
    renderPlanta, onTrocarPranchaPlanta, onCliquePlanta,
    toggleDesenhoManualPlanta, desfazerPontoPlanta, cancelarDesenhoPlanta, concluirDesenhoPlanta,
    iniciarNovaAreaParaPeca,
    detectarAreasPlanta,
    iniciarAjusteFormaPlanta, cancelarAjusteFormaPlanta, concluirAjusteFormaPlanta,
    abrirVincularPlanta, onTipoVincularPlanta, onAndarFiltroVincularPlanta,
    onFocoBuscaPecaPlanta, fecharListaPecaBuscaPlanta, onBuscaPecaPlanta, selecionarPecaBuscaPlanta,
    salvarVinculoPlanta, excluirMarcadorPlanta,
    abrirPranchasPlanta, novaPranchaPlanta, renomearPranchaPlanta, excluirPranchaPlanta,
    abrirUploadImagemPlanta, onImagemArquivoPlanta,
    toggleConcretagemLivre, cancelarConcretagemLivre, desfazerTracoLivre, concLivreUpd,
    processarConcretagemLivre, salvarConcretagemLivre,
    abrirBtProjeto, onTrocarPranchaBtProjeto, desfazerTracoBtProjeto, cancelarBtProjeto,
    calcularBtProjeto, usarResultadoBtProjeto, abrirControlarProjeto,
    zoomInPlanta, zoomOutPlanta, zoomResetPlanta,
    alternarTelaCheiaPlanta, toggleFiltroTipoPlanta, limparAreasPlanta,
  };
})();

const CCON = ControleConcreto;

function onObraChanged() {
  ControleConcreto.recarregar();
}

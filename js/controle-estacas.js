// ============================================
// Módulo: Controle de Estacas e Fundações
// Importa o PDF do projeto (prancha), o usuário marca a posição
// de cada estaca (círculo — clicar e arrastar define o raio) ou
// fundação (polígono — clicar ponto a ponto, vértices arrastáveis)
// e vincula cada marcador a uma peça do Levantamento de Concreto
// (tipo Fundação; subTipo 'Estacas' ou os outros 8 tipos).
//
// Três abas:
//  · Marcadores      — cria/vincula/ajusta as formas sobre a prancha.
//  · Planejamento    — escolhe/cria uma Concretagem (mesma coleção do
//                       Controle de Concreto) e marca, clicando na
//                       prancha, quais estacas/fundações entram nela
//                       (grava concretoPecaConc — igual ao "Assistente
//                       de Concretagem" do Levantamento de Concreto).
//  · Acompanhamento  — pra uma Concretagem planejada, clica na peça
//                       que foi REALMENTE concretada — isso grava um
//                       concretoLancamentos de verdade (aparece também
//                       no Controle de Concreto/relatórios de BT) e
//                       dispara a sincronização do % com o Planejamento
//                       (Gantt), via EstacasCalculos.sincronizarVinculosPlanejamento.
// O status pintado em qualquer aba vem sempre do mesmo cálculo
// (ConcretoCalculos.pctConcretado) — nunca dois caminhos divergentes.
// Dados: Firestore obras/{obraId}/estacas* + concreto* (compartilhado)
// ============================================

const ControleEstacas = (() => {
  const EC = EstacasCalculos;
  const COL_PRANCHAS = 'estacasPranchas';
  const COL_MARCADORES = 'estacasMarcadores';
  const COL_CONCS = 'concretoConcretagens';
  const COL_BTS = 'concretoBTs';
  const COL_PC = 'concretoPecaConc';
  const COL_LANS = 'concretoLancamentos';

  let obraId = null;
  let pranchas = [];
  let marcadores = [];
  let pecas = [];         // concretoPecas — cross-módulo
  let lancamentos = [];   // concretoLancamentos — idem
  let concretagens = [];  // concretoConcretagens — idem
  let btsConfig = [];     // concretoBTs — idem
  let pecaConc = [];      // concretoPecaConc — idem (peça x concretagem)

  let abaPrincipal = 'marcadores'; // 'marcadores' | 'planejamento' | 'acompanhamento'
  let pranchaAtivaId = null;
  let view = 'estacas'; // 'estacas' | 'fundacoes'
  let modo = null;      // null | 'circulo' | 'poligono' (modo de adicionar)
  let poligonoPontos = [];
  let editandoFormaId = null; // marcador em ajuste de forma (mover/redimensionar)
  let marcadorVincularId = null;
  let imagemCachePranchaId = null, imagemCacheBase64 = null;
  let zoomE = 1;
  let pdfjsCarregado = false;
  let planConcretagemId = null;   // concretagem ativa na aba Planejamento
  let acompConcretagemId = null;  // concretagem ativa na aba Acompanhamento
  let novaConcAberta = false;     // form de "+ Nova concretagem" aberto

  const esc = EC.esc;

  // ══════════════════════════════════════════
  // INIT / CARREGAMENTO
  // ══════════════════════════════════════════
  async function init() {
    const ok = await Utils.initPagina({ requireObra: true });
    if (!ok) return;
    obraId = Router.getObraId();
    if (!obraId) {
      document.getElementById('ce-content').innerHTML =
        `<div class="estado-vazio"><div class="icone">🔵</div><p>Selecione uma obra para acessar o controle de estacas e fundações.</p></div>`;
      return;
    }
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { cancelarModo(); cancelarAjusteForma(); Utils.fecharTodosModais(); } });
    await carregar();

  }

  async function carregar() {
    Utils.mostrarLoading();
    try {
      const [prs, ms, ps, lans, concs, bts, pcs] = await Promise.all([
        Database.listar(obraId, COL_PRANCHAS, null),
        Database.listar(obraId, COL_MARCADORES, null),
        Database.listar(obraId, 'concretoPecas', null),
        Database.listar(obraId, COL_LANS, null),
        Database.listar(obraId, COL_CONCS, null),
        Database.listar(obraId, COL_BTS, null),
        Database.listar(obraId, COL_PC, null),
      ]);
      pranchas = prs; marcadores = ms; pecas = ps; lancamentos = lans;
      concretagens = concs; btsConfig = bts; pecaConc = pcs;
      if (!pranchaAtivaId && pranchas.length) pranchaAtivaId = pranchasOrdenadas()[0].id;
      if (pranchaAtivaId && !pranchas.some(p => p.id === pranchaAtivaId)) pranchaAtivaId = pranchas[0]?.id || null;
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
    pranchaAtivaId = null;
    await carregar();
  }

  // ══════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════
  function pranchasOrdenadas() { return [...pranchas].sort((a, b) => (a.ordem || 0) - (b.ordem || 0)); }
  function pranchaAtiva() { return pranchas.find(p => p.id === pranchaAtivaId) || null; }
  function tipoMarcadorDaView() { return view === 'estacas' ? 'circulo' : 'poligono'; }
  function marcadoresDaPranchaView(pranchaId) {
    const tipo = tipoMarcadorDaView();
    return marcadores.filter(m => m.pranchaId === pranchaId && m.tipo === tipo);
  }
  function pecaDoMarcador(m) { return m && m.pecaId ? (pecas.find(p => p.id === m.pecaId) || null) : null; }
  function statusMarcador(m) {
    const p = pecaDoMarcador(m);
    if (!p) return { pct: null, vinculada: false, label: 'Sem peça vinculada' };
    const pct = ConcretoCalculos.pctConcretado(p, lancamentos);
    return { pct, vinculada: true, label: `${p.nome} — ${EC.statusLabel(pct)}` };
  }
  // Peças elegíveis pra vincular na view atual: tipo Fundação; subTipo
  // 'Estacas' pra view Estacas, os outros 8 subtipos pra view Fundações.
  function pecasElegiveis() {
    return pecas.filter(p => p.tipo === 'Fundação' && (view === 'estacas' ? p.subTipo === 'Estacas' : p.subTipo !== 'Estacas'));
  }
  function marcadorDaPeca(pecaId, excetoId) {
    return marcadores.find(m => m.pecaId === pecaId && m.id !== excetoId) || null;
  }

  // ══════════════════════════════════════════
  // RENDER PRINCIPAL
  // ══════════════════════════════════════════
  function renderizar() {
    const c = document.getElementById('ce-content');
    if (!c) return;

    if (!pranchas.length) {
      c.innerHTML = `
        <div class="cc-view">
        <div class="page-header">
          <div><h2>🔵 Controle de Estacas e Fundações</h2><span class="subtitulo">Marque estacas e fundações sobre o projeto e acompanhe a concretagem</span></div>
        </div>
        <div class="cc-empty">📐<br>Nenhuma prancha (PDF/planta do projeto) importada ainda.<br><button class="btn btn-primario btn-sm" style="margin-top:10px;" data-perm="controleEstacas:criar" onclick="CE.abrirPranchas()">⊞ Importar Prancha</button></div>
        </div>`;
      Permissions.aplicarNaTela();
      return;
    }

    c.innerHTML = `
      <div class="cc-view">
      <div class="page-header">
        <div>
          <h2>🔵 Controle de Estacas e Fundações</h2>
          <span class="subtitulo">Marcadores cria/vincula as formas · Planejamento organiza por concretagem · Acompanhamento lança o real</span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-secundario btn-sm" onclick="CE.abrirPranchas()">📄 Pranchas</button>
        </div>
      </div>
      <div class="aba-toggle" style="margin-bottom:14px;">
        <button class="aba-btn ${abaPrincipal === 'marcadores' ? 'ativo' : ''}" onclick="CE.setAbaPrincipal('marcadores')">📍 Marcadores</button>
        <button class="aba-btn ${abaPrincipal === 'planejamento' ? 'ativo' : ''}" onclick="CE.setAbaPrincipal('planejamento')">🗓 Planejamento</button>
        <button class="aba-btn ${abaPrincipal === 'acompanhamento' ? 'ativo' : ''}" onclick="CE.setAbaPrincipal('acompanhamento')">✅ Acompanhamento</button>
      </div>
      <div id="ce-aba-body"></div>
      </div>
    `;
    Permissions.aplicarNaTela();
    if (abaPrincipal === 'planejamento') _renderAbaPlanejamento();
    else if (abaPrincipal === 'acompanhamento') _renderAbaAcompanhamento();
    else _renderAbaMarcadores();
  }

  function setAbaPrincipal(a) {
    abaPrincipal = a; modo = null; poligonoPontos = []; editandoFormaId = null;
    renderizar();
  }

  // ══════════════════════════════════════════
  // ABA: MARCADORES (comportamento original — cria/vincula/ajusta)
  // ══════════════════════════════════════════
  function _renderAbaMarcadores() {
    const el = document.getElementById('ce-aba-body');
    if (!el) return;
    const marcadoresView = marcadores.filter(m => m.tipo === tipoMarcadorDaView());
    const total = marcadoresView.length;
    const vinculados = marcadoresView.filter(m => m.pecaId).length;
    const concluidos = marcadoresView.filter(m => {
      const st = statusMarcador(m);
      return st.pct !== null && st.pct >= 100;
    }).length;
    const pctMedio = total ? marcadoresView.reduce((s, m) => s + (statusMarcador(m).pct || 0), 0) / total : 0;

    el.innerHTML = `
      <div class="cc-kpiGrid" style="grid-template-columns:repeat(4,1fr);">
        <div class="cc-kpi"><div class="cc-kpiIcon">${view === 'estacas' ? '⚫' : '⬛'}</div><div class="cc-kpiBody"><div class="cc-kpiLabel">${view === 'estacas' ? 'Estacas' : 'Fundações'} marcadas</div><div class="cc-kpiValue">${total}</div></div></div>
        <div class="cc-kpi cc-kpiBlue"><div class="cc-kpiIcon">🔗</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Vinculadas ao levantamento</div><div class="cc-kpiValue">${vinculados}<span class="cc-kpiUnit">/ ${total}</span></div></div></div>
        <div class="cc-kpi cc-kpiGreen"><div class="cc-kpiIcon">✅</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Concretadas</div><div class="cc-kpiValue">${concluidos}<span class="cc-kpiUnit">/ ${total}</span></div></div></div>
        <div class="cc-kpi cc-kpiOrange"><div class="cc-kpiIcon">📊</div><div class="cc-kpiBody"><div class="cc-kpiLabel">% Médio Concretado</div><div class="cc-kpiValue">${EC.fmt1(pctMedio)}<span class="cc-kpiUnit">%</span></div></div></div>
      </div>

      <div class="cc-panel">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:4px;">
          <div class="aba-toggle">
            <button class="aba-btn ${view === 'estacas' ? 'ativo' : ''}" onclick="CE.onTrocarView('estacas')">⚫ Estacas</button>
            <button class="aba-btn ${view === 'fundacoes' ? 'ativo' : ''}" onclick="CE.onTrocarView('fundacoes')">⬛ Fundações</button>
          </div>
          <span class="text-sm text-muted">🟢 concretado · 🟠 parcial · ⚪ pendente · ▢ sem vínculo</span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0;align-items:center;">
          <select class="form-control" id="ce-prancha-ativa" style="max-width:240px;" onchange="CE.onTrocarPranchaAtiva()">
            ${pranchasOrdenadas().map(p => `<option value="${p.id}" ${p.id === pranchaAtivaId ? 'selected' : ''}>${esc(p.nome || 'Prancha')}</option>`).join('')}
          </select>
          <button id="ce-btn-circulo" class="btn ${modo === 'circulo' ? 'btn-primario' : 'btn-secundario'} btn-sm" data-perm="controleEstacas:criar" style="${view !== 'estacas' ? 'display:none;' : ''}" onclick="CE.iniciarAdicionarCirculo()">◯ Adicionar Estaca</button>
          <button id="ce-btn-poligono" class="btn ${modo === 'poligono' ? 'btn-primario' : 'btn-secundario'} btn-sm" data-perm="controleEstacas:criar" style="${view !== 'fundacoes' ? 'display:none;' : ''}" onclick="CE.iniciarAdicionarPoligono()">▱ Adicionar Fundação</button>
          <span style="display:flex;gap:2px;align-items:center;margin-left:auto;">
            <button class="btn btn-secundario btn-sm" onclick="CE.zoomAjustar(-0.25)">−</button>
            <span class="text-sm text-muted" id="ce-zoom-label" style="width:48px;text-align:center;">${Math.round(zoomE * 100)}%</span>
            <button class="btn btn-secundario btn-sm" onclick="CE.zoomAjustar(0.25)">+</button>
          </span>
        </div>
        <div id="ce-mapa-host"></div>
      </div>

      <div class="cc-panel">
        <div class="cc-panelTitle">◈ ${view === 'estacas' ? 'Estacas' : 'Fundações'} desta prancha</div>
        <div id="ce-tabela"></div>
      </div>
    `;
    renderMapa();
    renderTabela();
    Permissions.aplicarNaTela();
  }

  function onTrocarView(v) {
    view = v; modo = null; poligonoPontos = []; editandoFormaId = null;
    if (abaPrincipal === 'planejamento') _renderAbaPlanejamento();
    else if (abaPrincipal === 'acompanhamento') _renderAbaAcompanhamento();
    else renderizar();
  }
  function onTrocarPranchaAtiva() {
    pranchaAtivaId = document.getElementById('ce-prancha-ativa').value || null;
    modo = null; poligonoPontos = []; editandoFormaId = null;
    renderizar();
  }
  function zoomAjustar(delta) {
    zoomE = Math.min(4, Math.max(0.25, +(zoomE + delta).toFixed(2)));
    const lbl = document.getElementById('ce-zoom-label');
    if (lbl) lbl.textContent = Math.round(zoomE * 100) + '%';
    if (abaPrincipal === 'planejamento') renderMapaPlanejamento();
    else if (abaPrincipal === 'acompanhamento') renderMapaAcompanhamento();
    else renderMapa();
  }

  // ══════════════════════════════════════════
  // ABA: PLANEJAMENTO — escolhe/cria uma Concretagem e marca, clicando na
  // prancha, quais estacas/fundações (já vinculadas a uma peça) entram nela.
  // Grava concretoPecaConc (mesma coleção do Assistente de Concretagem do
  // Levantamento de Concreto) + mantém uma BT única auto-gerenciada por
  // concretagem, com volumePrevisto = soma do volume das peças planejadas.
  // ══════════════════════════════════════════
  function _concLabel(c) { return `Nº ${c.numero} — ${c.data || ''}${c.descricao ? ` | ${c.descricao}` : ''}`; }
  function _proximoNumeroConc() { return concretagens.length ? Math.max(...concretagens.map(c => c.numero || 0)) + 1 : 1; }
  function _pecaConcDaConcretagem(concretagemId) { return pecaConc.filter(pc => pc.concretagemId === concretagemId); }
  function _pecasPlanejadas(concretagemId) {
    const ids = new Set(_pecaConcDaConcretagem(concretagemId).map(pc => pc.pecaId));
    return pecas.filter(p => ids.has(p.id));
  }
  function _volumePlanejado(concretagemId) { return _pecasPlanejadas(concretagemId).reduce((s, p) => s + (p.volume || 0), 0); }
  function _btUnicaDaConcretagem(concretagemId) { return btsConfig.find(b => b.concretagemId === concretagemId) || null; }

  // Garante que exista 1 BT pra concretagem (criando se preciso) com
  // volumePrevisto sempre igual à soma do volume planejado atual.
  async function _garantirBTUnica(concretagemId) {
    const bt = _btUnicaDaConcretagem(concretagemId);
    const volume = _volumePlanejado(concretagemId);
    if (!bt) {
      const id = await Database.criar(obraId, COL_BTS, { concretagemId, numero: 1, volumePrevisto: volume, obraId }, EC.genId('bt'));
      return id;
    }
    if (Math.abs((bt.volumePrevisto || 0) - volume) > 0.0001) {
      await Database.atualizar(obraId, COL_BTS, bt.id, { volumePrevisto: volume });
    }
    return bt.id;
  }

  function toggleNovaConc() {
    novaConcAberta = !novaConcAberta;
    _renderAbaPlanejamento();
  }

  async function criarConcretagem() {
    if (!Permissions.pode('controleEstacas', 'criar')) { Utils.toast('Sem permissão para criar.', 'erro'); return; }
    const numero = parseInt(document.getElementById('ce-nova-conc-num').value) || 1;
    const data = document.getElementById('ce-nova-conc-data').value || '';
    const descricao = (document.getElementById('ce-nova-conc-desc').value || '').trim();
    Utils.mostrarLoading();
    try {
      const id = await Database.criar(obraId, COL_CONCS, { numero, data, descricao, obraId }, EC.genId('conc'));
      novaConcAberta = false;
      await carregar();
      planConcretagemId = id;
      _renderAbaPlanejamento();
      Utils.toast('✓ Concretagem criada! Agora clique nas peças na prancha pra planejar.', 'sucesso');
    } catch (e) {
      Utils.toast('Erro ao criar concretagem: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  function onTrocarPlanConcretagem() {
    planConcretagemId = document.getElementById('ce-plan-conc').value || null;
    _renderAbaPlanejamento();
  }

  function onTrocarPranchaAtivaGenerico(v) {
    pranchaAtivaId = v || null;
    modo = null; poligonoPontos = []; editandoFormaId = null;
    if (abaPrincipal === 'planejamento') _renderAbaPlanejamento();
    else if (abaPrincipal === 'acompanhamento') _renderAbaAcompanhamento();
  }

  function _renderAbaPlanejamento() {
    const el = document.getElementById('ce-aba-body');
    if (!el) return;
    const concsOrd = [...concretagens].sort((a, b) => (a.numero || 0) - (b.numero || 0));
    el.innerHTML = `
      <div class="cc-panel">
        <div class="cc-panelTitle">🗓 Planejamento de Concretagem</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px;">
          <select class="form-control" id="ce-plan-conc" style="max-width:280px;" onchange="CE.onTrocarPlanConcretagem()">
            <option value="">— Selecione uma concretagem —</option>
            ${concsOrd.map(c => `<option value="${c.id}" ${c.id === planConcretagemId ? 'selected' : ''}>${esc(_concLabel(c))}</option>`).join('')}
          </select>
          <button class="btn btn-secundario btn-sm" onclick="CE.toggleNovaConc()">${novaConcAberta ? '✕ Cancelar' : '+ Nova concretagem'}</button>
        </div>
        ${novaConcAberta ? `
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;padding:10px;border:1px dashed var(--cv-border,#e2e8f0);border-radius:8px;margin-bottom:12px;">
            <div><label class="text-sm text-muted" style="display:block;">Nº</label><input type="number" id="ce-nova-conc-num" class="form-control" style="width:80px;" value="${_proximoNumeroConc()}"></div>
            <div><label class="text-sm text-muted" style="display:block;">Data</label><input type="date" id="ce-nova-conc-data" class="form-control" value="${new Date().toISOString().slice(0, 10)}"></div>
            <div style="flex:1;min-width:160px;"><label class="text-sm text-muted" style="display:block;">Descrição (opcional)</label><input type="text" id="ce-nova-conc-desc" class="form-control"></div>
            <button class="btn btn-primario btn-sm" onclick="CE.criarConcretagem()">Criar</button>
          </div>` : ''}
        ${planConcretagemId ? `
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:4px;">
            <div class="aba-toggle">
              <button class="aba-btn ${view === 'estacas' ? 'ativo' : ''}" onclick="CE.onTrocarView('estacas')">⚫ Estacas</button>
              <button class="aba-btn ${view === 'fundacoes' ? 'ativo' : ''}" onclick="CE.onTrocarView('fundacoes')">⬛ Fundações</button>
            </div>
            <span class="text-sm text-muted">🟡 nesta concretagem · sem anel = não planejada</span>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0;align-items:center;">
            <select class="form-control" style="max-width:240px;" onchange="CE.onTrocarPranchaAtivaGenerico(this.value)">
              ${pranchasOrdenadas().map(p => `<option value="${p.id}" ${p.id === pranchaAtivaId ? 'selected' : ''}>${esc(p.nome || 'Prancha')}</option>`).join('')}
            </select>
            <span class="text-sm text-muted">Clique numa peça já vinculada pra incluir/remover desta concretagem.</span>
            <span style="display:flex;gap:2px;align-items:center;margin-left:auto;">
              <button class="btn btn-secundario btn-sm" onclick="CE.zoomAjustar(-0.25)">−</button>
              <span class="text-sm text-muted" style="width:48px;text-align:center;">${Math.round(zoomE * 100)}%</span>
              <button class="btn btn-secundario btn-sm" onclick="CE.zoomAjustar(0.25)">+</button>
            </span>
          </div>
          <div id="ce-plan-mapa-host"></div>
          <div class="cc-empty" style="margin-top:8px;"><b>${_pecasPlanejadas(planConcretagemId).length}</b> peça(s) planejada(s) nesta concretagem · volume previsto <b>${EC.fmt1(_volumePlanejado(planConcretagemId))} m³</b></div>
        ` : `<div class="cc-empty">Selecione ou crie uma concretagem pra começar a planejar quais estacas/fundações entram nela.</div>`}
      </div>
    `;
    Permissions.aplicarNaTela();
    if (planConcretagemId) renderMapaPlanejamento();
  }

  async function renderMapaPlanejamento() {
    const host = document.getElementById('ce-plan-mapa-host');
    if (!host) return;
    const pr = pranchaAtiva();
    if (!pr) { host.innerHTML = `<div class="cc-empty">Nenhuma prancha selecionada.</div>`; return; }
    const imagem = await _obterImagemPrancha(pr.id);
    if (!imagem) { host.innerHTML = `<div class="cc-empty">Esta prancha ainda não tem PDF/imagem.</div>`; return; }
    const lista = marcadoresDaPranchaView(pr.id).filter(m => m.pecaId); // só marcadores já vinculados podem ser planejados
    host.innerHTML = EC.stageHTML(pr, imagem, lista, statusMarcador, { interativo: true, zoom: zoomE, stageId: 'ce-plan-stage', maxHeight: 600 });
    _desenharDestaques('ce-plan-stage', lista, m => _pecaConcDaConcretagem(planConcretagemId).some(pc => pc.pecaId === m.pecaId));
    _ligarEventosToggle('ce-plan-stage', lista, _toggleNaConcretagem);
  }

  async function _toggleNaConcretagem(m) {
    if (!Permissions.pode('controleEstacas', 'editar') && !Permissions.pode('controleEstacas', 'criar')) { Utils.toast('Sem permissão.', 'erro'); return; }
    const existente = pecaConc.find(pc => pc.pecaId === m.pecaId && pc.concretagemId === planConcretagemId);
    let concretagemAntigaId = null;
    Utils.mostrarLoading();
    try {
      if (existente) {
        await Database.deletar(obraId, COL_PC, existente.id);
      } else {
        const outraConc = pecaConc.find(pc => pc.pecaId === m.pecaId);
        if (outraConc) {
          const ok = await Utils.confirmar('Esta peça já está planejada em outra concretagem. Mover pra esta?');
          if (!ok) { Utils.esconderLoading(); return; }
          concretagemAntigaId = outraConc.concretagemId;
          await Database.deletar(obraId, COL_PC, outraConc.id);
        }
        await Database.criar(obraId, COL_PC, { pecaId: m.pecaId, concretagemId: planConcretagemId, pctConcretagem: 100, obraId }, EC.genId('pc'));
      }
      await carregar();
      await _garantirBTUnica(planConcretagemId);
      if (concretagemAntigaId) await _garantirBTUnica(concretagemAntigaId);
      await carregar();
      _renderAbaPlanejamento();
    } catch (e) {
      Utils.toast('Erro: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ══════════════════════════════════════════
  // ABA: ACOMPANHAMENTO — pra uma concretagem já planejada, clica na peça
  // que foi REALMENTE concretada. Isso grava um concretoLancamentos de
  // verdade (aparece no Controle de Concreto/relatórios de BT também) e
  // sincroniza o % com o Planejamento (Gantt).
  // ══════════════════════════════════════════
  function onTrocarAcompConcretagem() {
    acompConcretagemId = document.getElementById('ce-acomp-conc').value || null;
    _renderAbaAcompanhamento();
  }

  function _renderAbaAcompanhamento() {
    const el = document.getElementById('ce-aba-body');
    if (!el) return;
    // Só concretagens com ao menos 1 peça planejada fazem sentido aqui
    const concsComPlano = [...concretagens].filter(c => _pecaConcDaConcretagem(c.id).length > 0).sort((a, b) => (a.numero || 0) - (b.numero || 0));
    el.innerHTML = `
      <div class="cc-panel">
        <div class="cc-panelTitle">✅ Acompanhamento — lançar o real</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px;">
          <select class="form-control" id="ce-acomp-conc" style="max-width:280px;" onchange="CE.onTrocarAcompConcretagem()">
            <option value="">— Selecione uma concretagem —</option>
            ${concsComPlano.map(c => `<option value="${c.id}" ${c.id === acompConcretagemId ? 'selected' : ''}>${esc(_concLabel(c))}</option>`).join('')}
          </select>
          ${!concsComPlano.length ? '<span class="text-sm text-muted">Nenhuma concretagem com peças planejadas ainda — vá em Planejamento primeiro.</span>' : ''}
        </div>
        ${acompConcretagemId ? `
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:4px;">
            <div class="aba-toggle">
              <button class="aba-btn ${view === 'estacas' ? 'ativo' : ''}" onclick="CE.onTrocarView('estacas')">⚫ Estacas</button>
              <button class="aba-btn ${view === 'fundacoes' ? 'ativo' : ''}" onclick="CE.onTrocarView('fundacoes')">⬛ Fundações</button>
            </div>
            <span class="text-sm text-muted">🟢 concretado · 🟠 parcial · 🟡 anel = planejada nesta concretagem, ainda pendente</span>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0;align-items:center;">
            <select class="form-control" style="max-width:240px;" onchange="CE.onTrocarPranchaAtivaGenerico(this.value)">
              ${pranchasOrdenadas().map(p => `<option value="${p.id}" ${p.id === pranchaAtivaId ? 'selected' : ''}>${esc(p.nome || 'Prancha')}</option>`).join('')}
            </select>
            <span class="text-sm text-muted">Clique numa peça com anel amarelo pra marcar/desmarcar como concretada de verdade.</span>
            <span style="display:flex;gap:2px;align-items:center;margin-left:auto;">
              <button class="btn btn-secundario btn-sm" onclick="CE.zoomAjustar(-0.25)">−</button>
              <span class="text-sm text-muted" style="width:48px;text-align:center;">${Math.round(zoomE * 100)}%</span>
              <button class="btn btn-secundario btn-sm" onclick="CE.zoomAjustar(0.25)">+</button>
            </span>
          </div>
          <div id="ce-acomp-mapa-host"></div>
        ` : `<div class="cc-empty">Selecione uma concretagem planejada pra lançar o real.</div>`}
      </div>
    `;
    Permissions.aplicarNaTela();
    if (acompConcretagemId) renderMapaAcompanhamento();
  }

  async function renderMapaAcompanhamento() {
    const host = document.getElementById('ce-acomp-mapa-host');
    if (!host) return;
    const pr = pranchaAtiva();
    if (!pr) { host.innerHTML = `<div class="cc-empty">Nenhuma prancha selecionada.</div>`; return; }
    const imagem = await _obterImagemPrancha(pr.id);
    if (!imagem) { host.innerHTML = `<div class="cc-empty">Esta prancha ainda não tem PDF/imagem.</div>`; return; }
    const idsPlanejados = new Set(_pecaConcDaConcretagem(acompConcretagemId).map(pc => pc.pecaId));
    const lista = marcadoresDaPranchaView(pr.id).filter(m => m.pecaId);
    host.innerHTML = EC.stageHTML(pr, imagem, lista, statusMarcador, { interativo: true, zoom: zoomE, stageId: 'ce-acomp-stage', maxHeight: 600 });
    _desenharDestaques('ce-acomp-stage', lista.filter(m => idsPlanejados.has(m.pecaId)), () => true);
    _ligarEventosToggle('ce-acomp-stage', lista.filter(m => idsPlanejados.has(m.pecaId)), _toggleReal);
  }

  async function _toggleReal(m) {
    if (!Permissions.pode('controleEstacas', 'editar') && !Permissions.pode('controleEstacas', 'criar')) { Utils.toast('Sem permissão.', 'erro'); return; }
    const bt = _btUnicaDaConcretagem(acompConcretagemId);
    if (!bt) { Utils.toast('Esta concretagem ainda não tem BT — volte no Planejamento.', 'erro'); return; }
    const pc = pecaConc.find(x => x.pecaId === m.pecaId && x.concretagemId === acompConcretagemId);
    const existente = lancamentos.find(l => l.pecaId === m.pecaId && l.btConfigId === bt.id);
    Utils.mostrarLoading();
    try {
      if (existente) {
        await Database.deletar(obraId, COL_LANS, existente.id);
      } else {
        const p = pecas.find(x => x.id === m.pecaId);
        const pctConc = pc ? (parseFloat(pc.pctConcretagem) || 0) / 100 : 1;
        const volume = p ? +((p.volume || 0) * pctConc).toFixed(4) : 0;
        await Database.criar(obraId, COL_LANS, {
          btConfigId: bt.id, concretagemId: acompConcretagemId, pecaId: m.pecaId,
          pct: 100, volume, hora: '', sobraCaminhao: 0, perdaObra: 0, perdaCocho: 0, obraId,
        }, EC.genId('lan'));
      }
      await carregar();
      await EstacasCalculos.sincronizarVinculosPlanejamento(obraId).catch(e => console.error('Sync Planejamento:', e));
      _renderAbaAcompanhamento();
      Utils.toast(existente ? 'Lançamento removido.' : '✓ Real lançado!', 'sucesso');
    } catch (e) {
      Utils.toast('Erro: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ── Overlay de destaque (anel colorido em cima dos marcadores que passam no filtro) ──
  function _desenharDestaques(stageId, lista, filtroFn) {
    const stage = document.getElementById(stageId);
    if (!stage) return;
    const cont = document.createElement('div');
    cont.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:5;';
    lista.forEach(m => {
      if (!filtroFn(m)) return;
      if (m.tipo === 'circulo') {
        const w = stage.getBoundingClientRect().width || 1;
        const diam = Math.max(10, m.raio * 2 * w) + 8;
        const anel = document.createElement('div');
        anel.style.cssText = `position:absolute;left:${(m.cx * 100).toFixed(3)}%;top:${(m.cy * 100).toFixed(3)}%;width:${diam.toFixed(1)}px;height:${diam.toFixed(1)}px;transform:translate(-50%,-50%);border-radius:50%;border:3px solid #eab308;box-sizing:border-box;`;
        cont.appendChild(anel);
      } else if (m.pontos && m.pontos.length >= 3) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 100 100');
        svg.setAttribute('preserveAspectRatio', 'none');
        svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
        const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        poly.setAttribute('points', m.pontos.map(p => `${p.x * 100},${p.y * 100}`).join(' '));
        poly.setAttribute('fill', 'none'); poly.setAttribute('stroke', '#eab308');
        poly.setAttribute('stroke-width', '0.8'); poly.setAttribute('vector-effect', 'non-scaling-stroke');
        svg.appendChild(poly);
        cont.appendChild(svg);
      }
    });
    stage.appendChild(cont);
  }

  // Clique num marcador dispara toggleFn(marcador) — usado no Planejamento
  // (incluir/remover da concretagem) e no Acompanhamento (marcar/desmarcar real).
  function _ligarEventosToggle(stageId, lista, toggleFn) {
    const stage = document.getElementById(stageId);
    if (!stage) return;
    stage.style.cursor = 'pointer';
    stage.addEventListener('click', ev => {
      const alvo = ev.target.closest('.est-marcador, .est-poligono-hit');
      if (!alvo) return;
      const m = lista.find(x => x.id === alvo.dataset.id);
      if (m) toggleFn(m);
    });
  }

  // ══════════════════════════════════════════
  // MAPA INTERATIVO
  // ══════════════════════════════════════════
  async function _obterImagemPrancha(pranchaId) {
    if (imagemCachePranchaId === pranchaId) return imagemCacheBase64;
    try {
      const doc = await db.collection('obras').doc(obraId).collection('config').doc('estacasImagem_' + pranchaId).get();
      const imagem = doc.exists ? (doc.data().img || null) : null;
      imagemCachePranchaId = pranchaId; imagemCacheBase64 = imagem;
      return imagem;
    } catch (e) { return null; }
  }

  async function renderMapa() {
    const host = document.getElementById('ce-mapa-host');
    if (!host) return;
    const pr = pranchaAtiva();
    if (!pr) { host.innerHTML = `<div class="cc-empty">Nenhuma prancha selecionada.</div>`; return; }
    const imagem = await _obterImagemPrancha(pr.id);
    if (!imagem) {
      host.innerHTML = `<div class="cc-empty">Esta prancha ainda não tem PDF/imagem. <button class="btn btn-secundario btn-sm" onclick="CE.abrirPranchas()">📄 Gerenciar Pranchas</button></div>`;
      return;
    }
    const lista = marcadoresDaPranchaView(pr.id);
    const scrollAnterior = document.querySelector('#ce-mapa-host .est-map-scroll');
    const scrollPos = scrollAnterior ? { left: scrollAnterior.scrollLeft, top: scrollAnterior.scrollTop } : null;
    const html = EC.stageHTML(pr, imagem, lista, statusMarcador, { interativo: true, zoom: zoomE, stageId: 'ce-stage', maxHeight: 600 });
    host.innerHTML = `
      ${html}
      ${modo === 'circulo' ? `<div class="cc-empty" style="margin-top:8px;">Clique no centro da estaca e arraste até o tamanho desejado. <button class="btn btn-secundario btn-sm" onclick="CE.cancelarModo()">Cancelar</button></div>` : ''}
      ${modo === 'poligono' ? `<div class="cc-empty" style="margin-top:8px;">Clique nos vértices da fundação (${poligonoPontos.length} ponto${poligonoPontos.length !== 1 ? 's' : ''}). <button class="btn btn-secundario btn-sm" ${poligonoPontos.length ? '' : 'disabled'} onclick="CE.desfazerPontoPoligono()">↩ Desfazer ponto</button> <button class="btn btn-primario btn-sm" ${poligonoPontos.length >= 3 ? '' : 'disabled'} onclick="CE.concluirPoligono()">✓ Concluir</button> <button class="btn btn-secundario btn-sm" onclick="CE.cancelarModo()">Cancelar</button></div>` : ''}
      ${editandoFormaId ? `<div class="cc-empty" style="margin-top:8px;">Ajustando forma — arraste os pontos. <button class="btn btn-primario btn-sm" onclick="CE.concluirAjusteForma()">✓ Concluir ajuste</button> <button class="btn btn-secundario btn-sm" onclick="CE.cancelarAjusteForma()">Cancelar</button></div>` : ''}
    `;
    const novoScroll = document.querySelector('#ce-mapa-host .est-map-scroll');
    if (novoScroll && scrollPos) { novoScroll.scrollLeft = scrollPos.left; novoScroll.scrollTop = scrollPos.top; }
    if (modo === 'poligono') _desenharPoligonoEmCriacao();
    if (editandoFormaId) _desenharHandlesEdicao();
    _ligarEventosMapa();
  }

  function _overlayContainer(id) {
    const stage = document.getElementById('ce-stage');
    if (!stage) return null;
    let cont = document.getElementById(id);
    if (!cont) { cont = document.createElement('div'); cont.id = id; cont.style.cssText = 'position:absolute;inset:0;'; stage.appendChild(cont); }
    return cont;
  }

  function _ligarEventosMapa() {
    const stage = document.getElementById('ce-stage');
    if (!stage) return;
    const scrollEl = stage.parentElement;

    // Ctrl+roda: zoom · Ctrl+arrastar: pan (sempre disponível)
    scrollEl.addEventListener('wheel', ev => {
      if (!ev.ctrlKey) return;
      ev.preventDefault();
      zoomAjustar(ev.deltaY < 0 ? 0.15 : -0.15);
    }, { passive: false });

    stage.addEventListener('mousedown', ev => {
      if (!ev.ctrlKey) return;
      ev.preventDefault();
      const ini = { x: ev.clientX, y: ev.clientY, sl: scrollEl.scrollLeft, st: scrollEl.scrollTop };
      const mover = mv => {
        scrollEl.scrollLeft = ini.sl - (mv.clientX - ini.x);
        scrollEl.scrollTop = ini.st - (mv.clientY - ini.y);
      };
      const soltar = () => {
        document.removeEventListener('mousemove', mover);
        document.removeEventListener('mouseup', soltar);
      };
      document.addEventListener('mousemove', mover);
      document.addEventListener('mouseup', soltar);
    });

    if (editandoFormaId) return; // handles de edição já têm seus próprios listeners

    if (modo === 'circulo') {
      stage.style.cursor = 'crosshair';
      stage.addEventListener('mousedown', ev => {
        if (ev.ctrlKey) return;
        const alvo = ev.target.closest('.est-marcador, .est-poligono-hit');
        if (alvo) return; // não inicia criação em cima de marcador existente
        ev.preventDefault();
        const centro = EC.posRelativa(ev, stage);
        const cont = _overlayContainer('ce-preview-overlay');
        cont.innerHTML = '';
        const preview = document.createElement('div');
        preview.style.cssText = `position:absolute;left:${(centro.x * 100).toFixed(3)}%;top:${(centro.y * 100).toFixed(3)}%;width:0;height:0;transform:translate(-50%,-50%);border-radius:50%;border:2px dashed #1e293b;background:rgba(59,130,246,.25);z-index:6;`;
        cont.appendChild(preview);
        const mover = mv => {
          const raio = EC.raioFracao(centro, EC.posRelativa(mv, stage), stage);
          const diam = raio * 2 * stage.getBoundingClientRect().width;
          preview.style.width = diam.toFixed(1) + 'px';
          preview.style.height = diam.toFixed(1) + 'px';
        };
        const soltar = async up => {
          document.removeEventListener('mousemove', mover);
          document.removeEventListener('mouseup', soltar);
          const raio = EC.raioFracao(centro, EC.posRelativa(up, stage), stage);
          cont.innerHTML = '';
          if (raio < 0.004) return; // arrasto minúsculo, ignora (evita clique acidental)
          await _criarMarcadorCirculo(centro.x, centro.y, raio);
        };
        document.addEventListener('mousemove', mover);
        document.addEventListener('mouseup', soltar);
      });
      return;
    }

    if (modo === 'poligono') {
      stage.style.cursor = 'crosshair';
      stage.addEventListener('click', ev => {
        if (ev.ctrlKey) return;
        poligonoPontos.push(EC.posRelativa(ev, stage));
        _atualizarToolbarPoligono();
        _desenharPoligonoEmCriacao();
      });
      return;
    }

    // Modo normal: clicar num marcador abre o vínculo
    stage.addEventListener('click', ev => {
      if (ev.ctrlKey) return;
      const marcador = ev.target.closest('.est-marcador, .est-poligono-hit');
      if (marcador) abrirVincular(marcador.dataset.id);
    });
  }

  function _atualizarToolbarPoligono() {
    const empties = document.querySelectorAll('#ce-mapa-host .cc-empty');
    // re-renderiza só o texto/contador — mais simples recarregar o painel inteiro
    renderMapa();
  }

  // ── Desenho do polígono em criação (pontos arrastáveis) ──
  function _desenharPoligonoEmCriacao() {
    const cont = _overlayContainer('ce-poligono-criacao-overlay');
    if (!cont) return;
    cont.innerHTML = '';
    const stage = document.getElementById('ce-stage');
    if (poligonoPontos.length >= 2) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 100 100');
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:9;';
      const poly = document.createElementNS('http://www.w3.org/2000/svg', poligonoPontos.length >= 3 ? 'polygon' : 'polyline');
      poly.setAttribute('points', poligonoPontos.map(p => `${p.x * 100},${p.y * 100}`).join(' '));
      poly.setAttribute('fill', poligonoPontos.length >= 3 ? 'rgba(59,130,246,0.15)' : 'none');
      poly.setAttribute('stroke', '#2563eb'); poly.setAttribute('stroke-width', '0.3'); poly.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.appendChild(poly);
      cont.appendChild(svg);
    }
    poligonoPontos.forEach((p, i) => {
      const dot = document.createElement('div');
      dot.style.cssText = `position:absolute;left:${(p.x * 100).toFixed(3)}%;top:${(p.y * 100).toFixed(3)}%;width:14px;height:14px;margin:-7px;border-radius:50%;background:#2563eb;border:2px solid #fff;box-shadow:0 0 0 1px #2563eb,0 1px 4px rgba(0,0,0,.4);z-index:10;cursor:move;pointer-events:auto;`;
      dot.title = 'Arraste pra ajustar este vértice';
      dot.addEventListener('mousedown', ev => {
        ev.preventDefault(); ev.stopPropagation();
        const mover = mv => {
          poligonoPontos[i] = EC.posRelativa(mv, stage);
          _desenharPoligonoEmCriacao();
        };
        const soltar = () => {
          document.removeEventListener('mousemove', mover);
          document.removeEventListener('mouseup', soltar);
        };
        document.addEventListener('mousemove', mover);
        document.addEventListener('mouseup', soltar);
      });
      cont.appendChild(dot);
    });
  }

  function iniciarAdicionarCirculo() {
    if (!Permissions.pode('controleEstacas', 'criar')) { Utils.toast('Sem permissão para criar.', 'erro'); return; }
    modo = 'circulo'; editandoFormaId = null; renderizar();
  }
  function iniciarAdicionarPoligono() {
    if (!Permissions.pode('controleEstacas', 'criar')) { Utils.toast('Sem permissão para criar.', 'erro'); return; }
    modo = 'poligono'; poligonoPontos = []; editandoFormaId = null; renderizar();
  }
  function cancelarModo() { modo = null; poligonoPontos = []; renderMapa(); _atualizarBotoesModo(); }
  function _atualizarBotoesModo() {
    const bc = document.getElementById('ce-btn-circulo'), bp = document.getElementById('ce-btn-poligono');
    if (bc) bc.className = `btn ${modo === 'circulo' ? 'btn-primario' : 'btn-secundario'} btn-sm`;
    if (bp) bp.className = `btn ${modo === 'poligono' ? 'btn-primario' : 'btn-secundario'} btn-sm`;
  }
  function desfazerPontoPoligono() {
    poligonoPontos.pop();
    renderMapa();
  }

  async function _criarMarcadorCirculo(cx, cy, raio) {
    if (!Permissions.pode('controleEstacas', 'criar')) { Utils.toast('Sem permissão para criar.', 'erro'); return; }
    Utils.mostrarLoading();
    try {
      const id = await Database.criar(obraId, COL_MARCADORES, { pranchaId: pranchaAtivaId, tipo: 'circulo', cx, cy, raio, pecaId: '' }, EC.genId('em'));
      modo = null;
      await carregar();
      abrirVincular(id);
    } catch (e) {
      Utils.toast('Erro ao criar marcador: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  async function concluirPoligono() {
    if (poligonoPontos.length < 3) return;
    if (!Permissions.pode('controleEstacas', 'criar')) { Utils.toast('Sem permissão para criar.', 'erro'); return; }
    Utils.mostrarLoading();
    try {
      const pontos = [...poligonoPontos];
      const id = await Database.criar(obraId, COL_MARCADORES, { pranchaId: pranchaAtivaId, tipo: 'poligono', pontos, pecaId: '' }, EC.genId('em'));
      modo = null; poligonoPontos = [];
      await carregar();
      abrirVincular(id);
    } catch (e) {
      Utils.toast('Erro ao criar marcador: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ══════════════════════════════════════════
  // AJUSTE DE FORMA (mover/redimensionar círculo · arrastar vértices do polígono)
  // ══════════════════════════════════════════
  function iniciarAjusteForma(id) {
    if (!Permissions.pode('controleEstacas', 'editar')) { Utils.toast('Sem permissão para editar.', 'erro'); return; }
    editandoFormaId = id;
    modo = null;
    Utils.fecharTodosModais();
    renderMapa();
  }
  function cancelarAjusteForma() { editandoFormaId = null; renderMapa(); }

  function _desenharHandlesEdicao() {
    const m = marcadores.find(x => x.id === editandoFormaId);
    const stage = document.getElementById('ce-stage');
    const cont = _overlayContainer('ce-edicao-overlay');
    if (!m || !stage || !cont) return;
    cont.innerHTML = '';

    if (m.tipo === 'circulo') {
      // Handle central (mover) + handle de borda (redimensionar)
      const centro = document.createElement('div');
      centro.style.cssText = `position:absolute;left:${(m.cx * 100).toFixed(3)}%;top:${(m.cy * 100).toFixed(3)}%;width:14px;height:14px;margin:-7px;border-radius:50%;background:#2563eb;border:2px solid #fff;box-shadow:0 0 0 1px #2563eb;cursor:move;z-index:11;pointer-events:auto;`;
      centro.title = 'Arraste pra mover';
      centro.addEventListener('mousedown', ev => {
        ev.preventDefault(); ev.stopPropagation();
        const mover = mv => { const p = EC.posRelativa(mv, stage); m.cx = p.x; m.cy = p.y; _desenharHandlesEdicaoLeve(m); };
        const soltar = () => { document.removeEventListener('mousemove', mover); document.removeEventListener('mouseup', soltar); };
        document.addEventListener('mousemove', mover);
        document.addEventListener('mouseup', soltar);
      });
      cont.appendChild(centro);

      const w = stage.getBoundingClientRect().width || 1;
      const bordaX = m.cx + m.raio;
      const borda = document.createElement('div');
      borda.style.cssText = `position:absolute;left:${(bordaX * 100).toFixed(3)}%;top:${(m.cy * 100).toFixed(3)}%;width:14px;height:14px;margin:-7px;border-radius:50%;background:#f59e0b;border:2px solid #fff;box-shadow:0 0 0 1px #f59e0b;cursor:ew-resize;z-index:11;pointer-events:auto;`;
      borda.title = 'Arraste pra redimensionar';
      borda.addEventListener('mousedown', ev => {
        ev.preventDefault(); ev.stopPropagation();
        const mover = mv => {
          const p = EC.posRelativa(mv, stage);
          m.raio = Math.max(0.004, EC.raioFracao({ x: m.cx, y: m.cy }, p, stage));
          _desenharHandlesEdicaoLeve(m);
        };
        const soltar = () => { document.removeEventListener('mousemove', mover); document.removeEventListener('mouseup', soltar); };
        document.addEventListener('mousemove', mover);
        document.addEventListener('mouseup', soltar);
      });
      cont.appendChild(borda);

      // Círculo "ao vivo" — redesenha junto com os handles pra ver o tamanho mudando
      const preview = document.createElement('div');
      preview.id = 'ce-edicao-preview-circulo';
      const diam = m.raio * 2 * w;
      preview.style.cssText = `position:absolute;left:${(m.cx * 100).toFixed(3)}%;top:${(m.cy * 100).toFixed(3)}%;width:${diam.toFixed(1)}px;height:${diam.toFixed(1)}px;transform:translate(-50%,-50%);border-radius:50%;border:2px dashed #1e293b;pointer-events:none;z-index:10;`;
      cont.insertBefore(preview, centro);
      return;
    }

    // Polígono: vértice a vértice
    (m.pontos || []).forEach((p, i) => {
      const dot = document.createElement('div');
      dot.style.cssText = `position:absolute;left:${(p.x * 100).toFixed(3)}%;top:${(p.y * 100).toFixed(3)}%;width:14px;height:14px;margin:-7px;border-radius:50%;background:#2563eb;border:2px solid #fff;box-shadow:0 0 0 1px #2563eb;cursor:move;z-index:11;pointer-events:auto;`;
      dot.title = 'Arraste pra ajustar este vértice';
      dot.addEventListener('mousedown', ev => {
        ev.preventDefault(); ev.stopPropagation();
        const mover = mv => { m.pontos[i] = EC.posRelativa(mv, stage); _desenharHandlesEdicaoLeve(m); };
        const soltar = () => { document.removeEventListener('mousemove', mover); document.removeEventListener('mouseup', soltar); };
        document.addEventListener('mousemove', mover);
        document.addEventListener('mouseup', soltar);
      });
      cont.appendChild(dot);
    });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:9;';
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    poly.setAttribute('points', (m.pontos || []).map(p => `${p.x * 100},${p.y * 100}`).join(' '));
    poly.setAttribute('fill', 'rgba(59,130,246,0.15)');
    poly.setAttribute('stroke', '#2563eb'); poly.setAttribute('stroke-width', '0.3'); poly.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.appendChild(poly);
    cont.insertBefore(svg, cont.firstChild);
  }

  // Redesenho leve durante o arrasto — evita re-renderizar o mapa inteiro
  // (e recarregar a imagem) a cada pixel movido.
  function _desenharHandlesEdicaoLeve(m) {
    _desenharHandlesEdicao();
  }

  async function concluirAjusteForma() {
    const m = marcadores.find(x => x.id === editandoFormaId);
    if (!m) { editandoFormaId = null; renderMapa(); return; }
    Utils.mostrarLoading();
    try {
      const data = m.tipo === 'circulo' ? { cx: m.cx, cy: m.cy, raio: m.raio } : { pontos: m.pontos };
      await Database.atualizar(obraId, COL_MARCADORES, m.id, data);
      editandoFormaId = null;
      Utils.toast('✓ Forma ajustada!', 'sucesso');
      await carregar();
    } catch (e) {
      Utils.toast('Erro ao salvar ajuste: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ══════════════════════════════════════════
  // VÍNCULO COM PEÇA DO LEVANTAMENTO
  // ══════════════════════════════════════════
  function abrirVincular(marcadorId) {
    const m = marcadores.find(x => x.id === marcadorId);
    if (!m) return;
    marcadorVincularId = marcadorId;
    renderVincularBody();
    Utils.abrirModal('modal-ce-vincular');
  }

  function _resumoPorDiametro(elegiveis) {
    const grupos = {};
    elegiveis.forEach(p => {
      const d = p.diametro ? `⌀${EC.num(p.diametro)}cm` : 'sem diâmetro';
      if (!grupos[d]) grupos[d] = { total: 0, disponiveis: 0 };
      grupos[d].total++;
      if (!marcadorDaPeca(p.id)) grupos[d].disponiveis++;
    });
    return Object.entries(grupos).sort((a, b) => a[0].localeCompare(b[0], 'pt-BR', { numeric: true }));
  }

  function renderVincularBody() {
    const el = document.getElementById('ce-vincular-body');
    if (!el) return;
    const m = marcadores.find(x => x.id === marcadorVincularId);
    if (!m) { el.innerHTML = ''; return; }
    const elegiveis = pecasElegiveis();
    const st = statusMarcador(m);
    document.getElementById('ce-vincular-titulo').textContent = m.tipo === 'circulo' ? '⚫ Estaca — Vincular' : '⬛ Fundação — Vincular';
    const resumoDiam = view === 'estacas' ? _resumoPorDiametro(elegiveis) : [];
    el.innerHTML = `
      ${resumoDiam.length ? `
        <div class="form-grupo">
          <label>Qtd. de estacas por diâmetro (no Levantamento)</label>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${resumoDiam.map(([d, g]) => `<span class="badge" style="background:var(--cv-surface2,#f1f5f9);border:1px solid var(--cv-border,#e2e8f0);font-weight:600;">${esc(d)}: ${g.total}<span style="color:var(--cv-text3,#94a3b8);font-weight:400;"> (${g.disponiveis} disp.)</span></span>`).join('')}
          </div>
        </div>` : ''}
      <div class="form-grupo">
        <label>Peça do Levantamento de Concreto</label>
        <select class="form-control" id="ce-vincular-peca">
          <option value="">— Nenhuma —</option>
          ${elegiveis.map(p => {
            const outro = marcadorDaPeca(p.id, m.id);
            const pct = ConcretoCalculos.pctConcretado(p, lancamentos);
            const diamTxt = p.diametro ? ` · ⌀${EC.num(p.diametro)}cm` : '';
            return `<option value="${p.id}" ${p.id === m.pecaId ? 'selected' : ''}>${esc(p.nome)} · ${esc(p.andar)}${diamTxt} · ${EC.fmt1(pct)}%${outro ? ' — já vinculada a outro marcador' : ''}</option>`;
          }).join('')}
        </select>
        ${!elegiveis.length ? `<p class="text-sm text-muted" style="margin-top:6px;">Nenhuma peça do tipo "${view === 'estacas' ? 'Fundação → Estacas' : 'Fundação (outros tipos)'}" cadastrada ainda no <a href="levantamento-concreto.html" style="color:var(--cor-primaria-dark);font-weight:600;">Levantamento de Concreto</a>.</p>` : ''}
      </div>
      <div class="cc-empty" style="margin-top:4px;">Status atual: <b>${esc(st.label)}</b></div>
      <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;">
        <button class="btn btn-secundario btn-sm" data-perm="controleEstacas:editar" onclick="CE.iniciarAjusteForma('${m.id}')">✎ Ajustar forma</button>
        <button class="btn btn-secundario btn-sm" style="color:var(--cv-red,#ef4444);" data-perm="controleEstacas:excluir" onclick="CE.excluirMarcador('${m.id}')">🗑 Excluir marcador</button>
      </div>
    `;
    Permissions.aplicarNaTela(document.getElementById('modal-ce-vincular'));
  }

  async function salvarVinculo() {
    if (!Permissions.pode('controleEstacas', 'editar') && !Permissions.pode('controleEstacas', 'criar')) { Utils.toast('Sem permissão.', 'erro'); return; }
    const m = marcadores.find(x => x.id === marcadorVincularId);
    if (!m) return;
    const pecaId = document.getElementById('ce-vincular-peca').value || '';
    if (pecaId) {
      const outro = marcadorDaPeca(pecaId, m.id);
      if (outro) {
        const ok = await Utils.confirmar('Esta peça já está vinculada a outro marcador. Vincular aqui também?');
        if (!ok) return;
      }
    }
    Utils.mostrarLoading();
    try {
      await Database.atualizar(obraId, COL_MARCADORES, m.id, { pecaId });
      Utils.toast('✓ Vínculo salvo!', 'sucesso');
      Utils.fecharModal('modal-ce-vincular');
      await carregar();
    } catch (e) {
      Utils.toast('Erro ao salvar vínculo: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  async function excluirMarcador(id) {
    if (!Permissions.pode('controleEstacas', 'excluir')) { Utils.toast('Sem permissão para excluir.', 'erro'); return; }
    const ok = await Utils.confirmar('Excluir este marcador? O vínculo com a peça do levantamento também é removido (a peça em si não é afetada).');
    if (!ok) return;
    Utils.mostrarLoading();
    try {
      await Database.deletar(obraId, COL_MARCADORES, id);
      Utils.fecharModal('modal-ce-vincular');
      Utils.toast('Marcador excluído.', 'sucesso');
      await carregar();
    } catch (e) {
      Utils.toast('Erro ao excluir: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ══════════════════════════════════════════
  // TABELA DE PROGRESSO
  // ══════════════════════════════════════════
  function renderTabela() {
    const el = document.getElementById('ce-tabela');
    if (!el) return;
    const pr = pranchaAtiva();
    const lista = pr ? marcadoresDaPranchaView(pr.id) : [];
    if (!lista.length) { el.innerHTML = '<div class="cc-empty">Nenhum marcador ainda nesta prancha. Use o botão acima pra adicionar.</div>'; return; }
    el.innerHTML = `
      <div class="cc-tableWrap">
      <table class="cc-table">
        <thead><tr><th>Peça vinculada</th><th>Andar</th><th class="col-num">% Concretado</th><th>Status</th><th class="col-acoes"></th></tr></thead>
        <tbody>
          ${lista.map(m => {
            const p = pecaDoMarcador(m);
            const st = statusMarcador(m);
            const cor = EC.corStatus(st.pct);
            return `<tr>
              <td style="font-weight:600;">${p ? esc(p.nome) : '<span class="text-muted">— não vinculada —</span>'}</td>
              <td class="cc-tdMono">${p ? esc(p.andar) : '—'}</td>
              <td class="col-num cc-tdMono">${st.pct !== null ? EC.fmt1(st.pct) + '%' : '—'}</td>
              <td><span style="display:inline-flex;align-items:center;gap:5px;"><span style="width:9px;height:9px;border-radius:50%;background:${cor};display:inline-block;"></span>${esc(EC.statusLabel(st.pct))}</span></td>
              <td class="col-acoes">
                <button class="btn btn-secundario btn-sm" onclick="CE.abrirVincular('${m.id}')">🔗</button>
                <button class="btn btn-secundario btn-sm" data-perm="controleEstacas:excluir" style="color:var(--cv-red);" onclick="CE.excluirMarcador('${m.id}')">🗑</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      </div>`;
    Permissions.aplicarNaTela(el);
  }

  // ══════════════════════════════════════════
  // GESTÃO DE PRANCHAS (CRUD + upload de PDF/imagem)
  // ══════════════════════════════════════════
  function abrirPranchas() {
    renderPranchas();
    Utils.abrirModal('modal-ce-pranchas');
  }

  function renderPranchas() {
    const el = document.getElementById('ce-pranchas-body');
    if (!el) return;
    const lista = pranchasOrdenadas();
    el.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:flex-end;">
        <div style="flex:1;min-width:180px;">
          <label class="text-sm text-muted" style="display:block;margin-bottom:4px;">Nome da prancha</label>
          <input type="text" id="ce-nova-prancha" class="form-control" placeholder="Ex: Planta de Fundação — Torre A" onkeydown="if(event.key==='Enter')CE.novaPrancha()">
        </div>
        <div style="min-width:200px;">
          <label class="text-sm text-muted" style="display:block;margin-bottom:4px;">PDF ou imagem (opcional agora)</label>
          <input type="file" id="ce-nova-prancha-arquivo" accept=".pdf,image/*" class="form-control">
        </div>
        <button class="btn btn-primario btn-sm" data-perm="controleEstacas:criar" onclick="CE.novaPrancha()">+ Adicionar</button>
      </div>
      ${!lista.length ? '<div class="cc-empty">Nenhuma prancha cadastrada ainda. Dê um nome e já escolha o PDF/imagem acima — os dois num passo só.</div>' :
      lista.map(p => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border:1px solid var(--cor-borda-light);border-radius:8px;margin-bottom:8px;">
          <div style="flex:1;">
            <div style="font-weight:600;">${esc(p.nome || 'Prancha')}</div>
            <div class="text-sm text-muted">${p.imgWidthPx ? `${p.imgWidthPx}×${p.imgHeightPx}px` : 'sem PDF/imagem ainda'}</div>
          </div>
          <button class="btn btn-secundario btn-sm" data-perm="controleEstacas:editar" onclick="CE.abrirUploadImagem('${p.id}')">⊞ ${p.imgWidthPx ? 'Trocar PDF/Imagem' : 'Importar PDF/Imagem'}</button>
          <button class="btn btn-secundario btn-sm" data-perm="controleEstacas:editar" onclick="CE.renomearPrancha('${p.id}')">✎</button>
          <button class="btn btn-secundario btn-sm" style="color:var(--cv-red,#ef4444);" data-perm="controleEstacas:excluir" onclick="CE.excluirPrancha('${p.id}')">🗑</button>
        </div>`).join('')}
    `;
    Permissions.aplicarNaTela(document.getElementById('modal-ce-pranchas'));
  }

  async function novaPrancha() {
    if (!Permissions.pode('controleEstacas', 'criar')) { Utils.toast('Sem permissão para criar.', 'erro'); return; }
    const input = document.getElementById('ce-nova-prancha');
    const fileInput = document.getElementById('ce-nova-prancha-arquivo');
    const nome = input.value.trim();
    if (!nome) return;
    const file = fileInput && fileInput.files && fileInput.files[0];
    Utils.mostrarLoading();
    try {
      const ordem = pranchas.length ? Math.max(...pranchas.map(p => p.ordem || 0)) + 1 : 1;
      const id = await Database.criar(obraId, COL_PRANCHAS, { nome, ordem }, EC.genId('prancha'));
      input.value = '';
      if (file) {
        await _processarArquivoPrancha(file, id);
        fileInput.value = '';
      }
      await carregar();
      renderPranchas();
      pranchaAtivaId = id;
      if (!file) abrirUploadImagem(id); // não escolheu arquivo ainda agora — abre o upload dedicado na hora
      else Utils.toast('✓ Prancha criada com o PDF/imagem já importado!', 'sucesso');
    } catch (e) {
      Utils.toast('Erro ao criar prancha: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  async function renomearPrancha(id) {
    if (!Permissions.pode('controleEstacas', 'editar')) { Utils.toast('Sem permissão para editar.', 'erro'); return; }
    const p = pranchas.find(x => x.id === id);
    if (!p) return;
    const novoNome = prompt('Novo nome da prancha:', p.nome || '');
    if (!novoNome || !novoNome.trim()) return;
    Utils.mostrarLoading();
    try {
      await Database.atualizar(obraId, COL_PRANCHAS, id, { nome: novoNome.trim() });
      await carregar();
      renderPranchas();
    } catch (e) {
      Utils.toast('Erro ao renomear: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  async function excluirPrancha(id) {
    if (!Permissions.pode('controleEstacas', 'excluir')) { Utils.toast('Sem permissão para excluir.', 'erro'); return; }
    const qtdMarcadores = marcadores.filter(m => m.pranchaId === id).length;
    const ok = await Utils.confirmar(`Excluir esta prancha${qtdMarcadores ? ` e seus ${qtdMarcadores} marcador(es)` : ''}? Não afeta as peças do Levantamento de Concreto.`);
    if (!ok) return;
    Utils.mostrarLoading();
    try {
      const ops = [{ type: 'delete', ref: Database.ref(obraId, COL_PRANCHAS).doc(id) }];
      marcadores.filter(m => m.pranchaId === id).forEach(m => ops.push({ type: 'delete', ref: Database.ref(obraId, COL_MARCADORES).doc(m.id) }));
      await Database.batchWrite(ops);
      await db.collection('obras').doc(obraId).collection('config').doc('estacasImagem_' + id).delete().catch(() => {});
      if (pranchaAtivaId === id) pranchaAtivaId = null;
      await carregar();
      renderPranchas();
    } catch (e) {
      Utils.toast('Erro ao excluir prancha: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  function abrirUploadImagem(pranchaId) {
    document.getElementById('ce-img-pranchaid').value = pranchaId;
    document.getElementById('ce-img-status').textContent = '';
    Utils.abrirModal('modal-ce-imagem');
  }

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

  // Processa o PDF/imagem (rasteriza 1ª página se PDF, comprime) e grava no
  // Firestore — usado tanto ao criar a prancha (arquivo já junto) quanto ao
  // trocar depois (modal dedicado). statusEl é opcional (só o modal dedicado tem).
  async function _processarArquivoPrancha(file, pranchaId, statusEl) {
    if (statusEl) statusEl.textContent = 'Processando...';
    let canvas;
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      await _carregarPdfjs();
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      const page = await pdf.getPage(1);
      const viewportBase = page.getViewport({ scale: 1 });
      const alvo = 2200;
      const escala = Math.min(4, alvo / Math.max(viewportBase.width, viewportBase.height));
      const viewport = page.getViewport({ scale: escala });
      canvas = document.createElement('canvas');
      canvas.width = viewport.width; canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    } else {
      const img = await new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im); im.onerror = rej;
        im.src = URL.createObjectURL(file);
      });
      const alvo = 2200;
      const fator = Math.min(1, alvo / Math.max(img.naturalWidth, img.naturalHeight));
      canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * fator);
      canvas.height = Math.round(img.naturalHeight * fator);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    }
    const { url, width, height, ok } = EC.canvasParaDataURLLimitado(canvas);
    if (!ok) throw new Error('Arquivo grande demais mesmo após compressão. Tente uma exportação menor.');
    await db.collection('obras').doc(obraId).collection('config').doc('estacasImagem_' + pranchaId).set({ img: url });
    await Database.atualizar(obraId, COL_PRANCHAS, pranchaId, { imgWidthPx: width, imgHeightPx: height });
    imagemCachePranchaId = null;
    if (statusEl) statusEl.textContent = '✓ Imagem carregada!';
  }

  async function onImagemArquivo(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const pranchaId = document.getElementById('ce-img-pranchaid').value;
    const statusEl = document.getElementById('ce-img-status');
    Utils.mostrarLoading();
    try {
      await _processarArquivoPrancha(file, pranchaId, statusEl);
      Utils.toast('✓ Prancha atualizada!', 'sucesso');
      Utils.fecharModal('modal-ce-imagem');
      await carregar();
      renderPranchas();
    } catch (e) {
      console.error(e);
      statusEl.textContent = 'Erro: ' + e.message;
      Utils.toast('Erro ao processar arquivo: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
      input.value = '';
    }
  }

  return {
    init, recarregar, renderizar, setAbaPrincipal,
    onTrocarView, onTrocarPranchaAtiva, onTrocarPranchaAtivaGenerico, zoomAjustar,
    iniciarAdicionarCirculo, iniciarAdicionarPoligono, cancelarModo, desfazerPontoPoligono, concluirPoligono,
    iniciarAjusteForma, concluirAjusteForma, cancelarAjusteForma,
    abrirVincular, salvarVinculo, excluirMarcador,
    abrirPranchas, novaPrancha, renomearPrancha, excluirPrancha, abrirUploadImagem, onImagemArquivo,
    toggleNovaConc, criarConcretagem, onTrocarPlanConcretagem, onTrocarAcompConcretagem,
  };
})();

const CE = ControleEstacas;

function onObraChanged() {
  ControleEstacas.recarregar();
}

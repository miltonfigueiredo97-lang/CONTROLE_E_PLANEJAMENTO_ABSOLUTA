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
  let mapaCoresGrupo = new Map(); // diâmetro+comprimento -> cor (anel no desenho)

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
  let acompConcretagemId = null;  // concretagem ativa na aba Acompanhamento
  let telaCheiaAtiva = false;
  let telaCheiaGuardado = null;   // {parent, next} — pra devolver #ce-aba-body ao saír da tela cheia

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
      mapaCoresGrupo = EC.mapaCoresGrupoEstaca(pecas);
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
    let corGrupo = null, grupoLabel = null;
    if (p.subTipo === 'Estacas' && (p.diametro || p.comprimento)) {
      corGrupo = mapaCoresGrupo.get(EC.chaveGrupoEstaca(p.diametro, p.comprimento)) || null;
      grupoLabel = `⌀${EC.num(p.diametro) || '?'}cm${p.comprimento ? ' × ' + EC.num(p.comprimento) + 'm' : ''}`;
    }
    return { pct, vinculada: true, label: `${p.nome} — ${EC.statusLabel(pct)}`, corGrupo, grupoLabel };
  }
  // Peças elegíveis pra vincular na view atual: tipo Fundação; subTipo
  // 'Estacas' pra view Estacas, os outros 8 subtipos pra view Fundações.
  function pecasElegiveis() {
    return pecas.filter(p => p.tipo === 'Fundação' && (view === 'estacas' ? p.subTipo === 'Estacas' : p.subTipo !== 'Estacas'));
  }
  function marcadorDaPeca(pecaId, excetoId) {
    return marcadores.find(m => m.pecaId === pecaId && m.id !== excetoId) || null;
  }
  // Legenda das cores por grupo (diâmetro+comprimento) — só faz sentido na
  // view de Estacas, e só se houver ao menos um grupo com dado suficiente.
  function _legendaGrupos() {
    if (view !== 'estacas' || !mapaCoresGrupo.size) return '';
    const itens = [...mapaCoresGrupo.entries()].map(([chave, cor]) => {
      const [d, c] = chave.split('_').map(Number);
      return `<span style="display:inline-flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;border-radius:50%;border:2px solid ${cor};display:inline-block;"></span>⌀${d}cm${c ? ' × ' + c + 'm' : ''}</span>`;
    }).join('');
    return `<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin:6px 0 2px;font-size:.78rem;color:var(--cv-text3,#94a3b8);">${itens}</div>`;
  }

  // ══════════════════════════════════════════
  // RENDER PRINCIPAL
  // ══════════════════════════════════════════
  function renderizar() {
    const c = document.getElementById('ce-content');
    if (!c) return;
    // Se a tela cheia está ativa, #ce-aba-body foi realocado pra fora de
    // #ce-content (pra dentro do overlay) — não recriamos o shell aqui
    // (duplicaria o id), só atualizamos o conteúdo da aba em si.
    if (telaCheiaAtiva) { _renderAbaAtual(); return; }

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
          <button class="btn btn-secundario btn-sm" onclick="CE.alternarTelaCheia()">⛶ Tela cheia</button>
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
    _renderAbaAtual();
  }

  function _renderAbaAtual() {
    if (abaPrincipal === 'planejamento') _renderAbaPlanejamento();
    else if (abaPrincipal === 'acompanhamento') _renderAbaAcompanhamento();
    else _renderAbaMarcadores();
  }

  // ══════════════════════════════════════════
  // TELA CHEIA — realoca o #ce-aba-body (com TODAS as suas features: toggle
  // estaca/fundação, seletor de prancha, adicionar, girar, zoom, legenda,
  // mapa) pra um overlay ocupando a tela inteira. É o MESMO elemento (não
  // um clone), então nada se perde — os mesmos onclick/listeners continuam
  // funcionando. Sair da tela cheia devolve o elemento pro lugar original.
  // ══════════════════════════════════════════
  function alternarTelaCheia() {
    if (telaCheiaAtiva) _saindoDaTelaCheia();
    else _entrandoNaTelaCheia();
  }

  function _entrandoNaTelaCheia() {
    const corpo = document.getElementById('ce-aba-body');
    if (!corpo) return;
    telaCheiaGuardado = { parent: corpo.parentNode, next: corpo.nextSibling };
    const overlay = document.createElement('div');
    overlay.id = 'ce-tela-cheia-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:500;background:var(--cor-fundo,#f1f5f9);overflow:auto;padding:16px;';
    overlay.innerHTML = '<div style="display:flex;justify-content:flex-end;margin-bottom:10px;"><button class="btn btn-secundario btn-sm" onclick="CE.alternarTelaCheia()">✕ Fechar tela cheia (Esc)</button></div>';
    document.body.appendChild(overlay);
    overlay.appendChild(corpo);
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', _teclaEscTelaCheia);
    telaCheiaAtiva = true;
    _rerenderMapaAtivo();
  }

  function _saindoDaTelaCheia() {
    const corpo = document.getElementById('ce-aba-body');
    const overlay = document.getElementById('ce-tela-cheia-overlay');
    if (corpo && telaCheiaGuardado) {
      if (telaCheiaGuardado.next) telaCheiaGuardado.parent.insertBefore(corpo, telaCheiaGuardado.next);
      else telaCheiaGuardado.parent.appendChild(corpo);
    }
    if (overlay) overlay.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', _teclaEscTelaCheia);
    telaCheiaAtiva = false;
    telaCheiaGuardado = null;
    _rerenderMapaAtivo();
  }

  function _teclaEscTelaCheia(e) {
    if (e.key === 'Escape') _saindoDaTelaCheia();
  }

  function _rerenderMapaAtivo() {
    if (abaPrincipal === 'planejamento') renderMapaPlanejamento();
    else if (abaPrincipal === 'acompanhamento') renderMapaAcompanhamento();
    else renderMapa();
  }

  // Altura do mapa: bem maior quando em tela cheia, pra aproveitar o espaço.
  function _alturaMapa() {
    return telaCheiaAtiva ? Math.max(420, window.innerHeight - 230) : 600;
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
        ${_legendaGrupos()}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0;align-items:center;">
          <select class="form-control" id="ce-prancha-ativa" style="max-width:240px;" onchange="CE.onTrocarPranchaAtiva()">
            ${pranchasOrdenadas().map(p => `<option value="${p.id}" ${p.id === pranchaAtivaId ? 'selected' : ''}>${esc(p.nome || 'Prancha')}</option>`).join('')}
          </select>
          <button id="ce-btn-circulo" class="btn ${modo === 'circulo' ? 'btn-primario' : 'btn-secundario'} btn-sm" data-perm="controleEstacas:criar" style="${view !== 'estacas' ? 'display:none;' : ''}" onclick="CE.iniciarAdicionarCirculo()">◯ Adicionar Estaca</button>
          <button id="ce-btn-poligono" class="btn ${modo === 'poligono' ? 'btn-primario' : 'btn-secundario'} btn-sm" data-perm="controleEstacas:criar" style="${view !== 'fundacoes' ? 'display:none;' : ''}" onclick="CE.iniciarAdicionarPoligono()">▱ Adicionar Fundação</button>
          <button class="btn btn-secundario btn-sm" data-perm="controleEstacas:editar" onclick="CE.girarPrancha()">⟳ Girar 90°</button>
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
  // ABA: PLANEJAMENTO — usa a MESMA prancha da aba Marcadores (sem seletor
  // próprio, puxa automático). Clica numa peça já vinculada e diz em qual
  // Concretagem (nº) ela entra — a concretagem (mesma coleção do
  // Levantamento/Controle de Concreto) é criada na hora se o número ainda
  // não existir, sem formulário de data/descrição. Embaixo, um card por
  // concretagem mostra quantidade/volume total e por diâmetro — a
  // "separação por dias" que depois alimenta o Acompanhamento.
  // ══════════════════════════════════════════
  function _concLabel(c) { return `Concretagem Nº ${c.numero}${c.data ? ' — ' + c.data : ''}`; }
  function _proximoNumeroConc() { return concretagens.length ? Math.max(...concretagens.map(c => c.numero || 0)) + 1 : 1; }
  function _pecaConcDaConcretagem(concretagemId) { return pecaConc.filter(pc => pc.concretagemId === concretagemId); }
  function _pecasPlanejadas(concretagemId) {
    const ids = new Set(_pecaConcDaConcretagem(concretagemId).map(pc => pc.pecaId));
    return pecas.filter(p => ids.has(p.id));
  }
  function _volumePlanejado(concretagemId) { return _pecasPlanejadas(concretagemId).reduce((s, p) => s + (p.volume || 0), 0); }
  function _btUnicaDaConcretagem(concretagemId) { return btsConfig.find(b => b.concretagemId === concretagemId) || null; }
  function _concretagemDaPeca(pecaId) { const pc = pecaConc.find(x => x.pecaId === pecaId); return pc ? (concretagens.find(c => c.id === pc.concretagemId) || null) : null; }

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

  // Resumo por diâmetro+comprimento de um conjunto de peças — usado nos
  // cards do Planejamento (tudo) e do Acompanhamento (executado x faltando).
  function _resumoDiamDeLista(listaPecas) {
    const grupos = {};
    listaPecas.forEach(p => {
      const chave = p.diametro ? `⌀${EC.num(p.diametro)}cm${p.comprimento ? ' × ' + EC.num(p.comprimento) + 'm' : ''}` : 'sem diâmetro';
      if (!grupos[chave]) grupos[chave] = { qtd: 0, volume: 0 };
      grupos[chave].qtd++;
      grupos[chave].volume += p.volume || 0;
    });
    return Object.entries(grupos).sort((a, b) => a[0].localeCompare(b[0], 'pt-BR', { numeric: true }));
  }
  function _resumoDiamHTML(resumo) {
    if (!resumo.length) return '<div class="cc-empty" style="padding:10px 0;">—</div>';
    return `<div style="display:flex;gap:6px;flex-wrap:wrap;">${resumo.map(([d, g]) => `<span class="badge" style="background:var(--cv-surface2,#f1f5f9);border:1px solid var(--cv-border,#e2e8f0);font-weight:600;">${esc(d)}: ${g.qtd} <span style="font-weight:400;color:var(--cv-text3,#94a3b8);">(${EC.fmt1(g.volume)}m³)</span></span>`).join('')}</div>`;
  }
  function _centroide(pontos) {
    if (!pontos || !pontos.length) return null;
    return { x: pontos.reduce((s, p) => s + p.x, 0) / pontos.length, y: pontos.reduce((s, p) => s + p.y, 0) / pontos.length };
  }

  function _renderAbaPlanejamento() {
    const el = document.getElementById('ce-aba-body');
    if (!el) return;
    const concsOrd = [...concretagens].sort((a, b) => (a.numero || 0) - (b.numero || 0));
    el.innerHTML = `
      <div class="cc-panel">
        <div class="cc-panelTitle">🗓 Planejamento de Concretagem</div>
        <div class="text-sm text-muted" style="margin-bottom:10px;">Mesmo projeto da aba Marcadores. Clique numa peça já vinculada e diga em qual concretagem ela entra.</div>
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:4px;">
          <div class="aba-toggle">
            <button class="aba-btn ${view === 'estacas' ? 'ativo' : ''}" onclick="CE.onTrocarView('estacas')">⚫ Estacas</button>
            <button class="aba-btn ${view === 'fundacoes' ? 'ativo' : ''}" onclick="CE.onTrocarView('fundacoes')">⬛ Fundações</button>
          </div>
          <span class="text-sm text-muted">nº no marcador = concretagem já atribuída · sem número = ainda não planejada</span>
        </div>
        ${_legendaGrupos()}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0;align-items:center;">
          <button class="btn btn-secundario btn-sm" onclick="CE.girarPrancha()">⟳ Girar 90°</button>
          <span style="display:flex;gap:2px;align-items:center;margin-left:auto;">
            <button class="btn btn-secundario btn-sm" onclick="CE.zoomAjustar(-0.25)">−</button>
            <span class="text-sm text-muted" style="width:48px;text-align:center;">${Math.round(zoomE * 100)}%</span>
            <button class="btn btn-secundario btn-sm" onclick="CE.zoomAjustar(0.25)">+</button>
          </span>
        </div>
        <div id="ce-plan-mapa-host"></div>
      </div>
      <div class="cc-panel">
        <div class="cc-panelTitle">📅 Concretagens planejadas</div>
        ${!concsOrd.length ? '<div class="cc-empty">Nenhuma concretagem ainda — clique numa peça na prancha acima pra criar a primeira.</div>' : `
          <div style="display:flex;flex-direction:column;gap:10px;">
            ${concsOrd.map(c => {
              const listaPecas = _pecasPlanejadas(c.id);
              const resumo = _resumoDiamDeLista(listaPecas);
              return `
                <div style="border:1px solid var(--cv-border,#e2e8f0);border-radius:8px;padding:10px 14px;">
                  <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                    <div style="font-weight:700;">Concretagem Nº ${c.numero}${c.data ? ` <span style="font-weight:400;color:var(--cv-text3,#94a3b8);font-size:.8rem;">${esc(c.data)}</span>` : ''}</div>
                    <div class="text-sm text-muted">${listaPecas.length} peça${listaPecas.length !== 1 ? 's' : ''} · ${EC.fmt1(_volumePlanejado(c.id))} m³</div>
                  </div>
                  ${resumo.length ? `<div style="margin-top:8px;">${_resumoDiamHTML(resumo)}</div>` : ''}
                </div>`;
            }).join('')}
          </div>`}
      </div>
    `;
    Permissions.aplicarNaTela();
    renderMapaPlanejamento();
  }

  async function renderMapaPlanejamento() {
    const host = document.getElementById('ce-plan-mapa-host');
    if (!host) return;
    const pr = pranchaAtiva();
    if (!pr) { host.innerHTML = `<div class="cc-empty">Nenhuma prancha ainda — vá na aba Marcadores e importe o projeto.</div>`; return; }
    const imagem = await _obterImagemPrancha(pr.id);
    if (!imagem) { host.innerHTML = `<div class="cc-empty">Esta prancha ainda não tem PDF/imagem — importe na aba Marcadores.</div>`; return; }
    const lista = marcadoresDaPranchaView(pr.id).filter(m => m.pecaId); // só marcadores já vinculados podem ser planejados
    host.innerHTML = EC.stageHTML(pr, imagem, lista, statusMarcador, { interativo: true, zoom: zoomE, stageId: 'ce-plan-stage', maxHeight: _alturaMapa() });
    _desenharNumerosConcretagem('ce-plan-stage', lista);
    _ligarEventosToggle('ce-plan-stage', lista, abrirAtribuirConcretagem);
  }

  // Escreve o número da concretagem (se já atribuída) em cima de cada marcador
  function _desenharNumerosConcretagem(stageId, lista) {
    const stage = document.getElementById(stageId);
    if (!stage) return;
    const cont = document.createElement('div');
    cont.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:6;';
    lista.forEach(m => {
      const c = _concretagemDaPeca(m.pecaId);
      if (!c) return;
      const centro = m.tipo === 'circulo' ? { x: m.cx, y: m.cy } : _centroide(m.pontos);
      if (!centro) return;
      const bolha = document.createElement('div');
      bolha.style.cssText = `position:absolute;left:${(centro.x * 100).toFixed(3)}%;top:${(centro.y * 100).toFixed(3)}%;transform:translate(-50%,-50%);background:#1e293b;color:#fff;font-size:10px;font-weight:700;padding:1px 5px;border-radius:100px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.4);`;
      bolha.textContent = c.numero;
      cont.appendChild(bolha);
    });
    stage.appendChild(cont);
  }

  // ── Popup de atribuir concretagem (clique numa peça na aba Planejamento) ──
  let atribuirMarcadorId = null;
  function abrirAtribuirConcretagem(m) {
    atribuirMarcadorId = m.id;
    _renderAtribuirConcBody();
    Utils.abrirModal('modal-ce-atribuir-conc');
  }
  function _renderAtribuirConcBody() {
    const el = document.getElementById('ce-atribuir-conc-body');
    if (!el) return;
    const m = marcadores.find(x => x.id === atribuirMarcadorId);
    if (!m) { el.innerHTML = ''; return; }
    const p = pecaDoMarcador(m);
    const atual = _concretagemDaPeca(m.pecaId);
    const concsOrd = [...concretagens].sort((a, b) => (a.numero || 0) - (b.numero || 0));
    el.innerHTML = `
      <div class="cc-empty" style="margin-bottom:10px;"><b>${esc(p ? p.nome : '')}</b>${atual ? ` — hoje na Concretagem Nº ${atual.numero}` : ' — ainda não planejada'}</div>
      <div class="form-grupo">
        <label>Concretagens existentes</label>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${concsOrd.length ? concsOrd.map(c => `<button class="btn ${atual && atual.id === c.id ? 'btn-primario' : 'btn-secundario'} btn-sm" onclick="CE.atribuirConcretagemNumero(${c.numero})">Nº ${c.numero}</button>`).join('') : '<span class="text-sm text-muted">Nenhuma ainda.</span>'}
        </div>
      </div>
      <div class="form-grupo">
        <label>Ou criar/atribuir um número novo</label>
        <div style="display:flex;gap:8px;">
          <input type="number" id="ce-atribuir-numero" class="form-control" style="width:100px;" value="${_proximoNumeroConc()}">
          <button class="btn btn-primario btn-sm" onclick="CE.atribuirConcretagemNumeroInput()">Atribuir</button>
        </div>
      </div>
      ${atual ? `<button class="btn btn-secundario btn-sm" style="color:var(--cv-red,#ef4444);margin-top:6px;" onclick="CE.removerDaConcretagem()">🗑 Remover desta concretagem</button>` : ''}
    `;
  }
  function atribuirConcretagemNumeroInput() {
    const numero = parseInt(document.getElementById('ce-atribuir-numero').value) || null;
    if (!numero) { Utils.toast('Digite um número válido.', 'alerta'); return; }
    atribuirConcretagemNumero(numero);
  }
  async function atribuirConcretagemNumero(numero) {
    if (!Permissions.pode('controleEstacas', 'editar') && !Permissions.pode('controleEstacas', 'criar')) { Utils.toast('Sem permissão.', 'erro'); return; }
    const m = marcadores.find(x => x.id === atribuirMarcadorId);
    if (!m) return;
    Utils.mostrarLoading();
    try {
      const concExistente = concretagens.find(c => c.numero === numero);
      const concId = concExistente ? concExistente.id : await Database.criar(obraId, COL_CONCS, { numero, data: new Date().toISOString().slice(0, 10), descricao: '', obraId }, EC.genId('conc'));
      const existente = pecaConc.find(pc => pc.pecaId === m.pecaId);
      const concretagemAntigaId = existente ? existente.concretagemId : null;
      if (existente) await Database.deletar(obraId, COL_PC, existente.id);
      await Database.criar(obraId, COL_PC, { pecaId: m.pecaId, concretagemId: concId, pctConcretagem: 100, obraId }, EC.genId('pc'));
      await carregar();
      await _garantirBTUnica(concId);
      if (concretagemAntigaId && concretagemAntigaId !== concId) await _garantirBTUnica(concretagemAntigaId);
      await carregar();
      Utils.fecharModal('modal-ce-atribuir-conc');
      _renderAbaPlanejamento();
      Utils.toast(`✓ Atribuída à Concretagem Nº ${numero}!`, 'sucesso');
    } catch (e) {
      Utils.toast('Erro: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }
  async function removerDaConcretagem() {
    const m = marcadores.find(x => x.id === atribuirMarcadorId);
    if (!m) return;
    const existente = pecaConc.find(pc => pc.pecaId === m.pecaId);
    if (!existente) return;
    Utils.mostrarLoading();
    try {
      const concretagemAntigaId = existente.concretagemId;
      await Database.deletar(obraId, COL_PC, existente.id);
      await carregar();
      await _garantirBTUnica(concretagemAntigaId);
      await carregar();
      Utils.fecharModal('modal-ce-atribuir-conc');
      _renderAbaPlanejamento();
      Utils.toast('Removida da concretagem.', 'sucesso');
    } catch (e) {
      Utils.toast('Erro: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ══════════════════════════════════════════
  // ABA: ACOMPANHAMENTO — usa a MESMA prancha (sem seletor próprio). Escolhe
  // uma concretagem já planejada e vai clicando peça a peça pra marcar
  // feito/pendente — cada clique grava um concretoLancamentos de verdade
  // (aparece no Controle de Concreto/relatórios de BT) e sincroniza o %
  // do Planejamento (Gantt). Resumo mostra volume e quantidade por
  // diâmetro, executado x faltando.
  // ══════════════════════════════════════════
  function onTrocarAcompConcretagem() {
    acompConcretagemId = document.getElementById('ce-acomp-conc').value || null;
    _renderAbaAcompanhamento();
  }
  function _pecaExecutada(p) { return ConcretoCalculos.pctConcretado(p, lancamentos) >= 100; }

  function _renderAbaAcompanhamento() {
    const el = document.getElementById('ce-aba-body');
    if (!el) return;
    // Só concretagens com ao menos 1 peça planejada fazem sentido aqui
    const concsComPlano = [...concretagens].filter(c => _pecaConcDaConcretagem(c.id).length > 0).sort((a, b) => (a.numero || 0) - (b.numero || 0));
    const listaPecas = acompConcretagemId ? _pecasPlanejadas(acompConcretagemId) : [];
    const executadas = listaPecas.filter(_pecaExecutada);
    const pendentes = listaPecas.filter(p => !_pecaExecutada(p));
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
            <span class="text-sm text-muted">🟢 concretado · 🟠 parcial · 🟡 anel = planejada nesta concretagem</span>
          </div>
          ${_legendaGrupos()}
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0;align-items:center;">
            <span class="text-sm text-muted">Clique numa peça com anel amarelo pra marcar/desmarcar como concretada de verdade.</span>
            <span style="display:flex;gap:2px;align-items:center;margin-left:auto;">
              <button class="btn btn-secundario btn-sm" onclick="CE.zoomAjustar(-0.25)">−</button>
              <span class="text-sm text-muted" style="width:48px;text-align:center;">${Math.round(zoomE * 100)}%</span>
              <button class="btn btn-secundario btn-sm" onclick="CE.zoomAjustar(0.25)">+</button>
            </span>
          </div>
          <div id="ce-acomp-mapa-host"></div>
          <div class="cc-kpiGrid" style="grid-template-columns:repeat(2,1fr);margin-top:14px;">
            <div class="cc-kpi cc-kpiGreen"><div class="cc-kpiIcon">✅</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Executado</div><div class="cc-kpiValue">${executadas.length}<span class="cc-kpiUnit">/ ${listaPecas.length}</span></div></div></div>
            <div class="cc-kpi cc-kpiOrange"><div class="cc-kpiIcon">⏳</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Faltando</div><div class="cc-kpiValue">${pendentes.length}<span class="cc-kpiUnit">/ ${listaPecas.length}</span></div></div></div>
          </div>
          <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:10px;">
            <div style="flex:1;min-width:220px;">
              <div class="text-sm" style="font-weight:700;margin-bottom:6px;">✅ Executado por diâmetro</div>
              ${_resumoDiamHTML(_resumoDiamDeLista(executadas))}
            </div>
            <div style="flex:1;min-width:220px;">
              <div class="text-sm" style="font-weight:700;margin-bottom:6px;">⏳ Faltando por diâmetro</div>
              ${_resumoDiamHTML(_resumoDiamDeLista(pendentes))}
            </div>
          </div>
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
    host.innerHTML = EC.stageHTML(pr, imagem, lista, statusMarcador, { interativo: true, zoom: zoomE, stageId: 'ce-acomp-stage', maxHeight: _alturaMapa() });
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

  // Gira a prancha 90° no sentido horário — de vez, não é só visual: a
  // imagem em si é re-renderizada rotacionada (dimensões trocadas) e TODOS
  // os marcadores existentes dessa prancha são recalculados pra continuar
  // na posição certa. Assim fica "fixo no sentido escolhido" (não é um
  // toggle de exibição, é uma correção permanente da prancha).
  async function girarPrancha() {
    if (!Permissions.pode('controleEstacas', 'editar')) { Utils.toast('Sem permissão para editar.', 'erro'); return; }
    const pr = pranchaAtiva();
    if (!pr) { Utils.toast('Nenhuma prancha selecionada.', 'erro'); return; }
    const imagem = await _obterImagemPrancha(pr.id);
    if (!imagem) { Utils.toast('Esta prancha ainda não tem PDF/imagem.', 'erro'); return; }
    Utils.mostrarLoading();
    try {
      const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = imagem; });
      const Wold = pr.imgWidthPx || img.naturalWidth, Hold = pr.imgHeightPx || img.naturalHeight;
      const canvas = document.createElement('canvas');
      canvas.width = Hold; canvas.height = Wold; // 90° troca largura/altura
      const ctx = canvas.getContext('2d');
      ctx.translate(canvas.width, 0);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, 0, 0, Wold, Hold);
      const { url, width, height, ok } = EC.canvasParaDataURLLimitado(canvas);
      if (!ok) { Utils.toast('Erro ao girar (arquivo grande demais após rotação).', 'erro'); return; }

      // Recalcula a posição de todos os marcadores desta prancha pro novo sentido
      const marcadoresDaPrancha = marcadores.filter(m => m.pranchaId === pr.id);
      const ops = [];
      marcadoresDaPrancha.forEach(m => {
        if (m.tipo === 'circulo') {
          const novo = EC.rotacionarPontoCW({ x: m.cx, y: m.cy });
          const novoRaio = m.raio * (Wold / Hold);
          ops.push({ type: 'update', ref: Database.ref(obraId, COL_MARCADORES).doc(m.id), data: { cx: novo.x, cy: novo.y, raio: novoRaio } });
        } else if (m.pontos && m.pontos.length) {
          ops.push({ type: 'update', ref: Database.ref(obraId, COL_MARCADORES).doc(m.id), data: { pontos: m.pontos.map(EC.rotacionarPontoCW) } });
        }
      });
      for (let i = 0; i < ops.length; i += 400) await Database.batchWrite(ops.slice(i, i + 400));

      await db.collection('obras').doc(obraId).collection('config').doc('estacasImagem_' + pr.id).set({ img: url });
      await Database.atualizar(obraId, COL_PRANCHAS, pr.id, { imgWidthPx: width, imgHeightPx: height });
      imagemCachePranchaId = null;
      await carregar();
      Utils.toast('✓ Projeto girado!', 'sucesso');
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao girar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
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
    const html = EC.stageHTML(pr, imagem, lista, statusMarcador, { interativo: true, zoom: zoomE, stageId: 'ce-stage', maxHeight: _alturaMapa() });
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
    const pecaAtual = m.pecaId ? pecas.find(p => p.id === m.pecaId) : null;
    vincularBusca = '';
    vincularListaAberta = false;
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
        <div style="position:relative;">
          <input type="text" class="form-control" id="ce-vincular-peca-busca" placeholder="Digite pra buscar por nome, andar ou diâmetro..."
            value="${esc(pecaAtual ? pecaAtual.nome : '')}" oninput="CE.onBuscaPeca(this.value)" onfocus="CE.onFocoBuscaPeca()"
            onblur="setTimeout(()=>CE.fecharListaPecaBusca(),150)" autocomplete="off">
          <input type="hidden" id="ce-vincular-peca" value="${m.pecaId || ''}">
          <div id="ce-vincular-peca-lista" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:30;background:#fff;border:1px solid var(--cv-border,#e2e8f0);border-radius:8px;max-height:220px;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,.15);margin-top:4px;"></div>
        </div>
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

  // ── Combobox pesquisável de peça (digita e filtra, clica e seleciona) ──
  let vincularBusca = '';
  let vincularListaAberta = false;

  function onFocoBuscaPeca() { vincularListaAberta = true; _renderListaPecaBusca(); }
  function fecharListaPecaBusca() { vincularListaAberta = false; _renderListaPecaBusca(); }
  function onBuscaPeca(v) {
    vincularBusca = v;
    vincularListaAberta = true;
    const hid = document.getElementById('ce-vincular-peca');
    if (hid) hid.value = ''; // só confirma o vínculo quando a pessoa CLICA numa opção da lista
    _renderListaPecaBusca();
  }
  function _pecasFiltradasBusca() {
    const elegiveis = pecasElegiveis();
    const termo = (vincularBusca || '').trim().toLowerCase();
    if (!termo) return elegiveis;
    return elegiveis.filter(p => `${p.nome} ${p.andar} ${p.subTipo || ''} ${p.diametro || ''}`.toLowerCase().includes(termo));
  }
  function _renderListaPecaBusca() {
    const el = document.getElementById('ce-vincular-peca-lista');
    if (!el) return;
    if (!vincularListaAberta) { el.style.display = 'none'; return; }
    const m = marcadores.find(x => x.id === marcadorVincularId);
    const lista = _pecasFiltradasBusca();
    el.style.display = 'block';
    el.innerHTML = `
      <div style="padding:8px 12px;cursor:pointer;color:var(--cv-text3,#94a3b8);font-size:.85rem;" onmousedown="CE.selecionarPecaBusca('')">— Nenhuma —</div>
      ${lista.length ? lista.map(p => {
        const outro = marcadorDaPeca(p.id, m ? m.id : null);
        const pct = ConcretoCalculos.pctConcretado(p, lancamentos);
        const diamTxt = p.diametro ? ` · ⌀${EC.num(p.diametro)}cm` : '';
        return `<div style="padding:8px 12px;cursor:pointer;border-top:1px solid var(--cv-border,#f1f5f9);" onmousedown="CE.selecionarPecaBusca('${p.id}')">
          <div style="font-weight:600;font-size:.85rem;">${esc(p.nome)}${outro ? ' <span style="color:var(--cv-red,#ef4444);font-weight:400;font-size:.75rem;">— já vinculada</span>' : ''}</div>
          <div class="text-sm text-muted">${esc(p.andar)}${diamTxt} · ${EC.fmt1(pct)}%</div>
        </div>`;
      }).join('') : '<div style="padding:10px 12px;color:var(--cv-text3,#94a3b8);font-size:.82rem;">Nenhuma peça encontrada.</div>'}
    `;
  }
  function selecionarPecaBusca(pecaId) {
    const hid = document.getElementById('ce-vincular-peca');
    if (hid) hid.value = pecaId;
    const p = pecaId ? pecas.find(x => x.id === pecaId) : null;
    const inputBusca = document.getElementById('ce-vincular-peca-busca');
    if (inputBusca) inputBusca.value = p ? p.nome : '';
    vincularBusca = '';
    vincularListaAberta = false;
    _renderListaPecaBusca();
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
    init, recarregar, renderizar, setAbaPrincipal, alternarTelaCheia,
    onTrocarView, onTrocarPranchaAtiva, zoomAjustar, girarPrancha,
    iniciarAdicionarCirculo, iniciarAdicionarPoligono, cancelarModo, desfazerPontoPoligono, concluirPoligono,
    iniciarAjusteForma, concluirAjusteForma, cancelarAjusteForma,
    abrirVincular, salvarVinculo, excluirMarcador,
    onFocoBuscaPeca, fecharListaPecaBusca, onBuscaPeca, selecionarPecaBusca,
    abrirPranchas, novaPrancha, renomearPrancha, excluirPrancha, abrirUploadImagem, onImagemArquivo,
    atribuirConcretagemNumero, atribuirConcretagemNumeroInput, removerDaConcretagem, onTrocarAcompConcretagem,
  };
})();

const CE = ControleEstacas;

function onObraChanged() {
  ControleEstacas.recarregar();
}

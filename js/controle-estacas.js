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
  let _arrastouMarcadorAgora = false; // true logo depois de arrastar uma estaca — suprime o 'click' que abriria o vínculo
  let editandoFormaId = null; // marcador em ajuste de forma (mover/redimensionar)
  let marcadorVincularId = null;
  let imagemCachePranchaId = null, imagemCacheBase64 = null;
  let zoomE = 1;
  let pdfjsCarregado = false;
  let acompConcretagemId = null;  // concretagem ativa na aba Acompanhamento
  let planFocoConcretagemId = null; // concretagem selecionada no Planejamento — clique na peça já atribui direto
  let novaConcPlanAberta = false;   // form de "+ Nova concretagem" aberto no Planejamento
  let telaCheiaAtiva = false;
  let painelMinimizado = false; // esconde toggle/legenda/seletor pra deixar só o mapa
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
    // Deep-link vindo do Dashboard (gráfico Fundação/Estrutura, clique na
    // barra de Estaca/Fundação de um andar): ?prancha=ID já abre direto
    // naquela prancha, em vez de cair na primeira por padrão.
    const pranchaUrl = new URLSearchParams(window.location.search).get('prancha');
    if (pranchaUrl) pranchaAtivaId = pranchaUrl;
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
    // Se a tela cheia está ativa, #ce-tela-cheia-wrap foi realocado pra fora
    // de #ce-content (pra dentro do overlay) — não recriamos o shell aqui
    // (duplicaria o id), só atualizamos o toggle de abas + o conteúdo da aba.
    if (telaCheiaAtiva) {
      const tg = document.getElementById('ce-aba-toggle-wrap');
      if (tg) tg.innerHTML = _abaToggleHTML();
      _renderAbaAtual();
      return;
    }

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
      <div id="ce-tela-cheia-wrap">
        <div id="ce-aba-toggle-wrap" style="margin-bottom:14px;">${_abaToggleHTML()}</div>
        <div id="ce-aba-body"></div>
      </div>
      </div>
    `;
    Permissions.aplicarNaTela();
    _renderAbaAtual();
  }

  // HTML dos 3 botões Marcadores/Planejamento/Acompanhamento — função à
  // parte porque também precisa ser reconstruído sozinho (só o toggle,
  // sem recriar todo o shell) quando a pessoa troca de aba DENTRO da tela
  // cheia, já que ali o resto do shell não existe mais nesse container.
  function _abaToggleHTML() {
    return `
      <div class="aba-toggle">
        <button class="aba-btn ${abaPrincipal === 'marcadores' ? 'ativo' : ''}" onclick="CE.setAbaPrincipal('marcadores')">📍 Marcadores</button>
        <button class="aba-btn ${abaPrincipal === 'planejamento' ? 'ativo' : ''}" onclick="CE.setAbaPrincipal('planejamento')">🗓 Planejamento</button>
        <button class="aba-btn ${abaPrincipal === 'acompanhamento' ? 'ativo' : ''}" onclick="CE.setAbaPrincipal('acompanhamento')">✅ Acompanhamento</button>
      </div>`;
  }

  function _renderAbaAtual() {
    if (abaPrincipal === 'planejamento') _renderAbaPlanejamento();
    else if (abaPrincipal === 'acompanhamento') _renderAbaAcompanhamento();
    else _renderAbaMarcadores();
  }

  // Minimiza/mostra o cabeçalho de controles (toggle estaca/fundação,
  // legenda, seletores, girar, zoom) — deixa só o mapa em foco. Zoom por
  // Ctrl+roda/pinça continua funcionando mesmo minimizado.
  function toggleMinimizarPainel() {
    painelMinimizado = !painelMinimizado;
    _renderAbaAtual();
  }

  // ══════════════════════════════════════════
  // TELA CHEIA — realoca o #ce-tela-cheia-wrap (toggle de abas + #ce-aba-body,
  // com TODAS as features: toggle estaca/fundação, seletor de prancha,
  // adicionar, girar, zoom, legenda, mapa) pra um overlay ocupando a tela
  // inteira. É o MESMO elemento (não um clone), então nada se perde — os
  // mesmos onclick/listeners continuam funcionando. Sair da tela cheia
  // devolve o elemento pro lugar original.
  // ══════════════════════════════════════════
  function alternarTelaCheia() {
    if (telaCheiaAtiva) _saindoDaTelaCheia();
    else _entrandoNaTelaCheia();
  }

  function _entrandoNaTelaCheia() {
    const corpo = document.getElementById('ce-tela-cheia-wrap');
    if (!corpo) return;
    telaCheiaGuardado = { parent: corpo.parentNode, next: corpo.nextSibling };
    const overlay = document.createElement('div');
    overlay.id = 'ce-tela-cheia-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:500;background:var(--cor-fundo,#f1f5f9);overflow:auto;padding:10px 16px 16px;';
    overlay.innerHTML = '<button class="btn btn-secundario btn-sm" style="position:absolute;top:10px;right:16px;z-index:1;" onclick="CE.alternarTelaCheia()">✕ Fechar tela cheia (Esc)</button>';
    document.body.appendChild(overlay);
    overlay.appendChild(corpo);
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', _teclaEscTelaCheia);
    telaCheiaAtiva = true;
    _renderAbaAtual();
  }

  function _saindoDaTelaCheia() {
    const corpo = document.getElementById('ce-tela-cheia-wrap');
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
    _renderAbaAtual();
  }

  function _teclaEscTelaCheia(e) {
    if (e.key === 'Escape') _saindoDaTelaCheia();
  }

  // Altura do mapa: bem maior quando em tela cheia, pra aproveitar o espaço.
  function _alturaMapa() {
    if (telaCheiaAtiva) return Math.max(420, window.innerHeight - (painelMinimizado ? 90 : 230));
    return painelMinimizado ? 720 : 600;
  }

  function setAbaPrincipal(a) {
    abaPrincipal = a; modo = null; poligonoPontos = []; editandoFormaId = null;
    renderizar();
  }

  // ══════════════════════════════════════════
  // ABA: MARCADORES (comportamento original — cria/vincula/ajusta)
  // ══════════════════════════════════════════
  async function _renderAbaMarcadores() {
    const el = document.getElementById('ce-aba-body');
    if (!el) return;
    // Captura a posição do scroll do mapa ANTES de reconstruir o painel —
    // el.innerHTML abaixo recria #ce-mapa-host do zero (vazio), então a
    // preservação de scroll que já existe DENTRO de renderMapa() não
    // adianta nesse caminho (não acha nada pra preservar). Isso cobre
    // qualquer ação que recarregue tudo (excluir marcador, vincular, etc.)
    // — não só zoom/girar, que já chamavam renderMapa() direto.
    const scrollAntigo = document.querySelector('#ce-mapa-host .est-map-scroll');
    const scrollPos = scrollAntigo ? { left: scrollAntigo.scrollLeft, top: scrollAntigo.scrollTop } : null;
    const marcadoresView = marcadores.filter(m => m.tipo === tipoMarcadorDaView());
    const total = marcadoresView.length;
    const vinculados = marcadoresView.filter(m => m.pecaId).length;
    const concluidos = marcadoresView.filter(m => {
      const st = statusMarcador(m);
      return st.pct !== null && st.pct >= 100;
    }).length;
    const pctMedio = total ? marcadoresView.reduce((s, m) => s + (statusMarcador(m).pct || 0), 0) / total : 0;

    el.innerHTML = `
      ${(telaCheiaAtiva || painelMinimizado) ? '' : `
      <div class="cc-kpiGrid" style="grid-template-columns:repeat(4,1fr);">
        <div class="cc-kpi"><div class="cc-kpiIcon">${view === 'estacas' ? '⚫' : '⬛'}</div><div class="cc-kpiBody"><div class="cc-kpiLabel">${view === 'estacas' ? 'Estacas' : 'Fundações'} marcadas</div><div class="cc-kpiValue">${total}</div></div></div>
        <div class="cc-kpi cc-kpiBlue"><div class="cc-kpiIcon">🔗</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Vinculadas ao levantamento</div><div class="cc-kpiValue">${vinculados}<span class="cc-kpiUnit">/ ${total}</span></div></div></div>
        <div class="cc-kpi cc-kpiGreen"><div class="cc-kpiIcon">✅</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Concretadas</div><div class="cc-kpiValue">${concluidos}<span class="cc-kpiUnit">/ ${total}</span></div></div></div>
        <div class="cc-kpi cc-kpiOrange"><div class="cc-kpiIcon">📊</div><div class="cc-kpiBody"><div class="cc-kpiLabel">% Médio Concretado</div><div class="cc-kpiValue">${EC.fmt1(pctMedio)}<span class="cc-kpiUnit">%</span></div></div></div>
      </div>`}

      <div class="cc-panel">
        <div style="display:flex;justify-content:flex-end;margin-bottom:${painelMinimizado ? '0' : '4px'};">
          <button class="btn btn-secundario btn-sm" onclick="CE.toggleMinimizarPainel()">${painelMinimizado ? '▼ Mostrar controles' : '▲ Minimizar'}</button>
        </div>
        ${painelMinimizado ? '' : `
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
        </div>`}
        <div id="ce-mapa-host"></div>
      </div>

      ${painelMinimizado ? '' : `
      <div class="cc-panel">
        <div class="cc-panelTitle">◈ ${view === 'estacas' ? 'Estacas' : 'Fundações'} desta prancha</div>
        <div id="ce-tabela"></div>
      </div>`}
    `;
    await renderMapa();
    const scrollNovo = document.querySelector('#ce-mapa-host .est-map-scroll');
    if (scrollNovo && scrollPos) { scrollNovo.scrollLeft = scrollPos.left; scrollNovo.scrollTop = scrollPos.top; }
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
  function _btsDaConcretagem(concretagemId) { return btsConfig.filter(b => b.concretagemId === concretagemId).sort((a, b) => (a.numero || 0) - (b.numero || 0)); }
  // Cocho e linha só fazem sentido na PRIMEIRA BT do dia (perda de partida,
  // acontece uma vez). Sobra de caminhão só faz sentido na ÚLTIMA (se ela
  // não foi usada até o fim). As do meio não têm nem um nem outro.
  function _primeiraBTConcretagem(concId) { const l = _btsDaConcretagem(concId); return l[0] || null; }
  function _ultimaBTConcretagem(concId) { const l = _btsDaConcretagem(concId); return l[l.length - 1] || null; }
  function _concretagemDaPeca(pecaId) { const pc = pecaConc.find(x => x.pecaId === pecaId); return pc ? (concretagens.find(c => c.id === pc.concretagemId) || null) : null; }

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

  async function _renderAbaPlanejamento() {
    const el = document.getElementById('ce-aba-body');
    if (!el) return;
    const scrollAntigo = document.querySelector('#ce-plan-mapa-host .est-map-scroll');
    const scrollPos = scrollAntigo ? { left: scrollAntigo.scrollLeft, top: scrollAntigo.scrollTop } : null;
    el.innerHTML = `
      <div class="cc-panel">
        <div style="display:flex;justify-content:flex-end;margin-bottom:${painelMinimizado ? '0' : '4px'};">
          <button class="btn btn-secundario btn-sm" onclick="CE.toggleMinimizarPainel()">${painelMinimizado ? '▼ Mostrar controles' : '▲ Minimizar'}</button>
        </div>
        ${painelMinimizado ? '' : `
        <div class="cc-panelTitle">🗓 Planejamento de Concretagem</div>
        <div class="text-sm text-muted" style="margin-bottom:10px;">Mesmo projeto da aba Marcadores.${planFocoConcretagemId ? ' Concretagem selecionada abaixo — clique nas peças no desenho pra atribuir direto.' : ' Selecione uma concretagem abaixo (ou crie uma nova) pra atribuir direto no clique, ou clique numa peça sem selecionar nada pra escolher pelo popup.'}</div>
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
        </div>`}
        <div id="ce-plan-mapa-host"></div>
      </div>
      ${painelMinimizado ? '' : `
      <div class="cc-panel">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
          <div class="cc-panelTitle" style="margin:0;">📅 Concretagens planejadas</div>
          <button class="btn btn-secundario btn-sm" onclick="CE.toggleNovaConcPlan()">${novaConcPlanAberta ? '✕ Cancelar' : '+ Nova concretagem'}</button>
        </div>
        <div id="ce-plan-cards-body"></div>
      </div>` }
    `;
    _renderCardsConcretagem();
    Permissions.aplicarNaTela();
    await renderMapaPlanejamento();
    const scrollNovo = document.querySelector('#ce-plan-mapa-host .est-map-scroll');
    if (scrollNovo && scrollPos) { scrollNovo.scrollLeft = scrollPos.left; scrollNovo.scrollTop = scrollPos.top; }
  }

  function _renderCardsConcretagem() {
    const el = document.getElementById('ce-plan-cards-body');
    if (!el) return;
    const concsOrd = [...concretagens].sort((a, b) => (a.numero || 0) - (b.numero || 0));
    el.innerHTML = `
      ${novaConcPlanAberta ? `
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;padding:10px;border:1px dashed var(--cv-border,#e2e8f0);border-radius:8px;margin-bottom:12px;">
          <div><label class="text-sm text-muted" style="display:block;">Nº</label><input type="number" id="ce-nova-conc-plan-num" class="form-control" style="width:80px;" value="${_proximoNumeroConc()}"></div>
          <div><label class="text-sm text-muted" style="display:block;">Data</label><input type="date" id="ce-nova-conc-plan-data" class="form-control" value="${new Date().toISOString().slice(0, 10)}"></div>
          <div style="flex:1;min-width:160px;"><label class="text-sm text-muted" style="display:block;">Descrição (opcional)</label><input type="text" id="ce-nova-conc-plan-desc" class="form-control"></div>
          <button class="btn btn-primario btn-sm" onclick="CE.criarConcretagemPlan()">Criar e selecionar</button>
        </div>` : ''}
      ${!concsOrd.length ? '<div class="cc-empty">Nenhuma concretagem ainda — crie uma acima, ou clique numa peça na prancha pra criar pelo popup.</div>' : `
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${concsOrd.map(c => {
            const listaPecas = _pecasPlanejadas(c.id);
            const resumo = _resumoDiamDeLista(listaPecas);
            const focado = planFocoConcretagemId === c.id;
            return `
              <div id="ce-card-conc-${c.id}" style="border:1.5px solid ${focado ? 'var(--cor-primaria)' : 'var(--cv-border,#e2e8f0)'};background:${focado ? 'var(--cv-surface2,#eff6ff)' : 'transparent'};border-radius:8px;padding:10px 14px;cursor:pointer;" onclick="CE.focarConcretagemPlan('${c.id}')" title="Clique pra selecionar/desmarcar — com uma selecionada, clique nas peças no desenho já atribui direto">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                  <div style="font-weight:700;">${focado ? '📌 ' : ''}Concretagem Nº ${c.numero}${c.data ? ` <span style="font-weight:400;color:var(--cv-text3,#94a3b8);font-size:.8rem;">${esc(c.data)}</span>` : ''}</div>
                  <div class="text-sm text-muted">${listaPecas.length} peça${listaPecas.length !== 1 ? 's' : ''} · ${EC.fmt1(_volumePlanejado(c.id))} m³</div>
                </div>
                ${resumo.length ? `<div style="margin-top:8px;">${_resumoDiamHTML(resumo)}</div>` : ''}
              </div>`;
          }).join('')}
        </div>`}
    `;
  }

  function toggleNovaConcPlan() {
    novaConcPlanAberta = !novaConcPlanAberta;
    _renderCardsConcretagem();
  }

  async function criarConcretagemPlan() {
    if (!Permissions.pode('controleEstacas', 'criar')) { Utils.toast('Sem permissão para criar.', 'erro'); return; }
    const numero = parseInt(document.getElementById('ce-nova-conc-plan-num').value) || _proximoNumeroConc();
    const data = document.getElementById('ce-nova-conc-plan-data').value || new Date().toISOString().slice(0, 10);
    const descricao = (document.getElementById('ce-nova-conc-plan-desc').value || '').trim();
    Utils.mostrarLoading();
    try {
      const id = await Database.criar(obraId, COL_CONCS, { numero, data, descricao, obraId }, EC.genId('conc'));
      concretagens.push({ id, numero, data, descricao, obraId });
      novaConcPlanAberta = false;
      planFocoConcretagemId = id; // já foca a recém-criada
      _renderCardsConcretagem();
      Utils.toast('✓ Concretagem criada e selecionada — clique nas peças no desenho.', 'sucesso');
    } catch (e) {
      Utils.toast('Erro ao criar concretagem: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  function focarConcretagemPlan(id) {
    planFocoConcretagemId = planFocoConcretagemId === id ? null : id;
    _renderCardsComFoco();
  }

  // Atualiza só o destaque de "selecionada" dos cards, sem re-renderizar
  // números (evita perder o scroll do mapa por engano se chamado à toa).
  function _renderCardsComFoco() { _renderCardsConcretagem(); }

  // Atribuição rápida: com uma concretagem selecionada, clicar numa peça já
  // vinculada no desenho atribui/desatribui direto, sem abrir popup — feito
  // com atualização local (sem recarregar tudo) pra não perder scroll/zoom
  // no meio de uma sequência de cliques.
  async function _atribuirRapidoFoco(m) {
    if (!Permissions.pode('controleEstacas', 'editar') && !Permissions.pode('controleEstacas', 'criar')) { Utils.toast('Sem permissão.', 'erro'); return; }
    const concId = planFocoConcretagemId;
    const existente = pecaConc.find(pc => pc.pecaId === m.pecaId);
    try {
      if (existente && existente.concretagemId === concId) {
        await Database.deletar(obraId, COL_PC, existente.id);
        pecaConc = pecaConc.filter(pc => pc.id !== existente.id);
      } else {
        if (existente) { await Database.deletar(obraId, COL_PC, existente.id); pecaConc = pecaConc.filter(pc => pc.id !== existente.id); }
        const novoId = EC.genId('pc');
        const dados = { pecaId: m.pecaId, concretagemId: concId, pctConcretagem: 100, obraId };
        await Database.criar(obraId, COL_PC, dados, novoId);
        pecaConc.push({ id: novoId, ...dados });
      }
      await renderMapaPlanejamento(); // só o mapa — preserva scroll/zoom pro próximo clique
      _renderCardsConcretagem(); // números dos cards (qtd/volume/diâmetro) atualizados
    } catch (e) {
      Utils.toast('Erro: ' + e.message, 'erro');
    }
  }

  async function renderMapaPlanejamento() {
    const host = document.getElementById('ce-plan-mapa-host');
    if (!host) return;
    const pr = pranchaAtiva();
    if (!pr) { host.innerHTML = `<div class="cc-empty">Nenhuma prancha ainda — vá na aba Marcadores e importe o projeto.</div>`; return; }
    const imagem = await _obterImagemPrancha(pr.id);
    if (!imagem) { host.innerHTML = `<div class="cc-empty">Esta prancha ainda não tem PDF/imagem — importe na aba Marcadores.</div>`; return; }
    const lista = marcadoresDaPranchaView(pr.id).filter(m => m.pecaId); // só marcadores já vinculados podem ser planejados
    const scrollAntigo = document.querySelector('#ce-plan-mapa-host .est-map-scroll');
    const scrollPos = scrollAntigo ? { left: scrollAntigo.scrollLeft, top: scrollAntigo.scrollTop } : null;
    host.innerHTML = EC.stageHTML(pr, imagem, lista, statusMarcador, { interativo: true, zoom: zoomE, stageId: 'ce-plan-stage', maxHeight: _alturaMapa() });
    const scrollNovo = document.querySelector('#ce-plan-mapa-host .est-map-scroll');
    if (scrollNovo && scrollPos) { scrollNovo.scrollLeft = scrollPos.left; scrollNovo.scrollTop = scrollPos.top; }
    _desenharNumerosConcretagem('ce-plan-stage', lista);
    _ligarEventosToggle('ce-plan-stage', lista, m => planFocoConcretagemId ? _atribuirRapidoFoco(m) : abrirAtribuirConcretagem(m));
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
      if (existente) await Database.deletar(obraId, COL_PC, existente.id);
      await Database.criar(obraId, COL_PC, { pecaId: m.pecaId, concretagemId: concId, pctConcretagem: 100, obraId }, EC.genId('pc'));
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
      await Database.deletar(obraId, COL_PC, existente.id);
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

  // Resumo de toda a obra (não só a concretagem selecionada) — total de
  // estacas por diâmetro, % feita de cada tipo, e % geral da obra.
  function _resumoObraEstacas() {
    const todas = pecas.filter(p => p.tipo === 'Fundação' && p.subTipo === 'Estacas');
    const grupos = new Map();
    let volTotal = 0, volFeito = 0;
    todas.forEach(p => {
      const pct = ConcretoCalculos.pctConcretado(p, lancamentos);
      const chave = p.diametro ? `⌀${EC.num(p.diametro)}cm${p.comprimento ? ' × ' + EC.num(p.comprimento) + 'm' : ''}` : 'sem diâmetro';
      if (!grupos.has(chave)) grupos.set(chave, { qtd: 0, qtdFeita: 0, volume: 0, volumeFeito: 0 });
      const g = grupos.get(chave);
      g.qtd++; g.volume += p.volume || 0; g.volumeFeito += (p.volume || 0) * (pct / 100);
      if (pct >= 100) g.qtdFeita++;
      volTotal += p.volume || 0; volFeito += (p.volume || 0) * (pct / 100);
    });
    return { grupos: [...grupos.entries()], volTotal, volFeito, pctObra: volTotal > 0 ? (volFeito / volTotal * 100) : 0, qtdTotal: todas.length };
  }

  async function _renderAbaAcompanhamento() {
    const el = document.getElementById('ce-aba-body');
    if (!el) return;
    const scrollAntigo = document.querySelector('#ce-acomp-mapa-host .est-map-scroll');
    const scrollPos = scrollAntigo ? { left: scrollAntigo.scrollLeft, top: scrollAntigo.scrollTop } : null;
    // Só concretagens com ao menos 1 peça planejada fazem sentido aqui
    const concsComPlano = [...concretagens].filter(c => _pecaConcDaConcretagem(c.id).length > 0).sort((a, b) => (a.numero || 0) - (b.numero || 0));
    const listaPecas = acompConcretagemId ? _pecasPlanejadas(acompConcretagemId) : [];
    const executadas = listaPecas.filter(_pecaExecutada);
    const pendentes = listaPecas.filter(p => !_pecaExecutada(p));
    const resumoObra = _resumoObraEstacas();
    const resumoVol = acompConcretagemId ? _resumoVolumesConcretagem(acompConcretagemId) : null;
    const qtdBTs = acompConcretagemId ? _btsDaConcretagem(acompConcretagemId).length : 0;
    el.innerHTML = `
      <div class="cc-panel">
        <div style="display:flex;justify-content:flex-end;margin-bottom:${painelMinimizado ? '0' : '4px'};">
          <button class="btn btn-secundario btn-sm" onclick="CE.toggleMinimizarPainel()">${painelMinimizado ? '▼ Mostrar controles' : '▲ Minimizar'}</button>
        </div>
        ${painelMinimizado ? '' : `
        <div class="cc-panelTitle">✅ Acompanhamento — clique numa estaca/fundação no mapa pra lançar</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px;">
          <select class="form-control" id="ce-acomp-conc" style="max-width:280px;" onchange="CE.onTrocarAcompConcretagem()">
            <option value="">— Selecione uma concretagem —</option>
            ${concsComPlano.map(c => `<option value="${c.id}" ${c.id === acompConcretagemId ? 'selected' : ''}>${esc(_concLabel(c))}</option>`).join('')}
          </select>
          ${!concsComPlano.length ? '<span class="text-sm text-muted">Nenhuma concretagem com peças planejadas ainda — vá em Planejamento primeiro.</span>' : ''}
          ${acompConcretagemId ? `<button class="btn btn-secundario btn-sm" onclick="CE.abrirModalBTs()">🚚 ${qtdBTs} BT${qtdBTs !== 1 ? 's' : ''} nesta concretagem</button>` : ''}
        </div>
        ${acompConcretagemId ? `
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:4px;">
            <div class="aba-toggle">
              <button class="aba-btn ${view === 'estacas' ? 'ativo' : ''}" onclick="CE.onTrocarView('estacas')">⚫ Estacas</button>
              <button class="aba-btn ${view === 'fundacoes' ? 'ativo' : ''}" onclick="CE.onTrocarView('fundacoes')">⬛ Fundações</button>
            </div>
            <span class="text-sm text-muted">🟢 concretado · 🟠 parcial · 🟡 anel = planejada, ainda pendente · nº no marcador = concretagem dela</span>
          </div>
          ${_legendaGrupos()}
          <div style="display:flex;gap:2px;align-items:center;justify-content:flex-end;margin:6px 0;">
            <button class="btn btn-secundario btn-sm" onclick="CE.zoomAjustar(-0.25)">−</button>
            <span class="text-sm text-muted" style="width:48px;text-align:center;">${Math.round(zoomE * 100)}%</span>
            <button class="btn btn-secundario btn-sm" onclick="CE.zoomAjustar(0.25)">+</button>
          </div>
        ` : ''}` }
        ${!painelMinimizado && !acompConcretagemId ? '<div class="cc-empty">Selecione uma concretagem planejada.</div>' : ''}
        <div id="ce-acomp-mapa-host"></div>
        ${!painelMinimizado && acompConcretagemId ? `
          <div class="cc-kpiGrid" style="grid-template-columns:repeat(4,1fr);margin-top:14px;">
            <div class="cc-kpi"><div class="cc-kpiIcon">📦</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Volume total (projeto)</div><div class="cc-kpiValue">${EC.fmt1(resumoVol.volumeTotal)}<span class="cc-kpiUnit">m³</span></div></div></div>
            <div class="cc-kpi cc-kpiGreen"><div class="cc-kpiIcon">✅</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Executado (projeto)</div><div class="cc-kpiValue">${EC.fmt1(resumoVol.volumeExecutadoProjeto)}<span class="cc-kpiUnit">m³</span></div></div></div>
            <div class="cc-kpi cc-kpiBlue"><div class="cc-kpiIcon">🚚</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Executado real (BTs)</div><div class="cc-kpiValue">${EC.fmt1(resumoVol.volumeExecutadoReal)}<span class="cc-kpiUnit">m³</span></div></div></div>
            <div class="cc-kpi ${resumoVol.indicePerda > 5 ? 'cc-kpiOrange' : ''}"><div class="cc-kpiIcon">📉</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Índice de perda</div><div class="cc-kpiValue">${EC.fmt1(resumoVol.indicePerda)}<span class="cc-kpiUnit">%</span></div></div></div>
          </div>
          <div class="cc-kpiGrid" style="grid-template-columns:repeat(2,1fr);margin-top:10px;">
            <div class="cc-kpi cc-kpiGreen"><div class="cc-kpiIcon">✅</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Executado (concretagem)</div><div class="cc-kpiValue">${executadas.length}<span class="cc-kpiUnit">/ ${listaPecas.length}</span></div></div></div>
            <div class="cc-kpi cc-kpiOrange"><div class="cc-kpiIcon">⏳</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Faltando (concretagem)</div><div class="cc-kpiValue">${pendentes.length}<span class="cc-kpiUnit">/ ${listaPecas.length}</span></div></div></div>
          </div>
          <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:10px;">
            <div style="flex:1;min-width:220px;">
              <div class="text-sm" style="font-weight:700;margin-bottom:6px;">✅ Executado por diâmetro (concretagem)</div>
              ${_resumoDiamHTML(_resumoDiamDeLista(executadas))}
            </div>
            <div style="flex:1;min-width:220px;">
              <div class="text-sm" style="font-weight:700;margin-bottom:6px;">⏳ Faltando por diâmetro (concretagem)</div>
              ${_resumoDiamHTML(_resumoDiamDeLista(pendentes))}
            </div>
          </div>
        ` : ''}
      </div>
      ${painelMinimizado ? '' : `
      <div class="cc-panel">
        <div class="cc-panelTitle">📊 Estacas da obra — visão geral</div>
        <div class="cc-kpiGrid" style="grid-template-columns:repeat(3,1fr);margin-bottom:14px;">
          <div class="cc-kpi"><div class="cc-kpiIcon">⚫</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Total de estacas</div><div class="cc-kpiValue">${resumoObra.qtdTotal}</div></div></div>
          <div class="cc-kpi cc-kpiGreen"><div class="cc-kpiIcon">✅</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Volume executado</div><div class="cc-kpiValue">${EC.fmt1(resumoObra.volFeito)}<span class="cc-kpiUnit">/ ${EC.fmt1(resumoObra.volTotal)} m³</span></div></div></div>
          <div class="cc-kpi cc-kpiOrange"><div class="cc-kpiIcon">📈</div><div class="cc-kpiBody"><div class="cc-kpiLabel">% da obra executada</div><div class="cc-kpiValue">${EC.fmt1(resumoObra.pctObra)}<span class="cc-kpiUnit">%</span></div></div></div>
        </div>
        ${resumoObra.grupos.length ? `
          <div class="cc-tableWrap">
            <table class="cc-table">
              <thead><tr><th>Diâmetro</th><th class="col-num">Qtd. feita/total</th><th class="col-num">Volume feito/total</th><th class="col-num">% do tipo</th></tr></thead>
              <tbody>
                ${resumoObra.grupos.sort((a, b) => a[0].localeCompare(b[0], 'pt-BR', { numeric: true })).map(([d, g]) => `<tr>
                  <td style="font-weight:600;">${esc(d)}</td>
                  <td class="col-num cc-tdMono">${g.qtdFeita} / ${g.qtd}</td>
                  <td class="col-num cc-tdMono">${EC.fmt1(g.volumeFeito)} / ${EC.fmt1(g.volume)} m³</td>
                  <td class="col-num cc-tdMono">${EC.fmt1(g.volume > 0 ? g.volumeFeito / g.volume * 100 : 0)}%</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>` : '<div class="cc-empty">Nenhuma estaca cadastrada ainda.</div>'}
      </div>` }
    `;
    Permissions.aplicarNaTela();
    if (acompConcretagemId) await renderMapaAcompanhamento();
    const scrollNovo = document.querySelector('#ce-acomp-mapa-host .est-map-scroll');
    if (scrollNovo && scrollPos) { scrollNovo.scrollLeft = scrollPos.left; scrollNovo.scrollTop = scrollPos.top; }
  }

  async function renderMapaAcompanhamento() {
    const host = document.getElementById('ce-acomp-mapa-host');
    if (!host) return;
    const pr = pranchaAtiva();
    if (!pr) { host.innerHTML = `<div class="cc-empty">Nenhuma prancha selecionada.</div>`; return; }
    const imagem = await _obterImagemPrancha(pr.id);
    if (!imagem) { host.innerHTML = `<div class="cc-empty">Esta prancha ainda não tem PDF/imagem.</div>`; return; }
    const idsPlanejados = new Set(_pecaConcDaConcretagem(acompConcretagemId).map(pc => pc.pecaId));
    // Só mostra peças da concretagem selecionada + das ANTERIORES (por número) —
    // nunca as de concretagens futuras, senão todas as concretagens mostram o
    // mesmo mapa preenchido e confunde qual foi feito em qual dia. Peça sem
    // concretagem nenhuma continua aparecendo normal (não é passado nem futuro).
    const concSel = concretagens.find(c => c.id === acompConcretagemId);
    const numeroSel = concSel ? (concSel.numero || 0) : Infinity;
    const lista = marcadoresDaPranchaView(pr.id).filter(m => {
      if (!m.pecaId) return false;
      const c = _concretagemDaPeca(m.pecaId);
      return !c || (c.numero || 0) <= numeroSel;
    });
    const scrollAntigo = document.querySelector('#ce-acomp-mapa-host .est-map-scroll');
    const scrollPos = scrollAntigo ? { left: scrollAntigo.scrollLeft, top: scrollAntigo.scrollTop } : null;
    host.innerHTML = EC.stageHTML(pr, imagem, lista, statusMarcador, { interativo: true, zoom: zoomE, stageId: 'ce-acomp-stage', maxHeight: _alturaMapa() });
    const scrollNovo = document.querySelector('#ce-acomp-mapa-host .est-map-scroll');
    if (scrollNovo && scrollPos) { scrollNovo.scrollLeft = scrollPos.left; scrollNovo.scrollTop = scrollPos.top; }
    // Nº da concretagem em cima de cada marcador — pra saber de qual dia é
    // cada estaca (ex: ver que aquela verde ali é da concretagem 1, não da 2).
    _desenharNumerosConcretagem('ce-acomp-stage', lista);
    // Anel amarelo só nas peças planejadas AINDA PENDENTES — uma vez 100%
    // (verde sólido), o anel some, pra ficar visualmente claro que terminou.
    _desenharDestaques('ce-acomp-stage', lista.filter(m => idsPlanejados.has(m.pecaId)), m => {
      const p = pecas.find(x => x.id === m.pecaId);
      return !p || !_pecaExecutada(p);
    });
    // Clicar numa peça planejada nesta concretagem abre o popup de lançar
    // (por fora dela, nada acontece — não faz sentido lançar o que não tá programado aqui).
    _ligarEventosToggle('ce-acomp-stage', lista.filter(m => idsPlanejados.has(m.pecaId)), m => abrirEstacaModal(m.pecaId));
  }

  // ══════════════════════════════════════════
  // LANÇAR BT (Acompanhamento) — mesmo conceito do Controle de Concreto:
  // cada concretagem pode ter várias BTs (caminhões), cada uma com seu
  // próprio número e volume previsto. Lança-se o % de CADA estaca/fundação
  // da programação que aquela BT concretou — grava concretoLancamentos de
  // verdade, visível também no Controle de Concreto/relatórios de BT.
  // ══════════════════════════════════════════
  let bt = null; // {concId, btId, modo} — só pra criar/editar metadados da BT (nº, volume, NF, código)
  let estacaAtual = null; // {concId, pecaId, linhas:[{btId,pctBT}]} — lançamento por peça (o fluxo principal)
  let mostrarBTsCompletas = false; // por padrão esconde BTs já 100% alocadas noutras peças no seletor
  let btMetaInlineId = null; // BT com o mini-form de sobra/perda/cocho aberto, dentro do popup de lançar estaca
  let metaBTPendente = {}; // {btId: {sobra,perda,perdaCocho,hora}} — usado quando a BT ainda não tem NENHUM lançamento salvo (não tem onde persistir ainda; aplica no próximo Salvar)

  function _proximoNumeroBT(concId) {
    const bts = _btsDaConcretagem(concId);
    return bts.length ? Math.max(...bts.map(b => b.numero || 0)) + 1 : 1;
  }

  function abrirNovaBT() {
    if (!Permissions.pode('controleEstacas', 'criar')) { Utils.toast('Sem permissão para criar.', 'erro'); return; }
    bt = { concId: acompConcretagemId, btId: '', modo: 'nova-meta', numeroForm: _proximoNumeroBT(acompConcretagemId) };
    _renderModalBTs();
  }
  function fecharPainelBT() { bt = null; _renderModalBTs(); }

  async function criarBTEstacas() {
    if (!Permissions.pode('controleEstacas', 'criar')) { Utils.toast('Sem permissão para criar.', 'erro'); return; }
    const numero = parseInt(document.getElementById('ce-bt-numero-novo').value) || _proximoNumeroBT(bt.concId);
    const volumePrevisto = EC.num((document.getElementById('ce-bt-volume-novo').value || '').replace(',', '.'));
    if (!volumePrevisto) { Utils.toast('Informe o volume previsto da BT.', 'alerta'); return; }
    Utils.mostrarLoading();
    try {
      const id = await Database.criar(obraId, COL_BTS, { concretagemId: bt.concId, numero, volumePrevisto, notaFiscal: '', codigoBT: '', obraId }, EC.genId('bt'));
      btsConfig.push({ id, concretagemId: bt.concId, numero, volumePrevisto, notaFiscal: '', codigoBT: '', obraId });
      bt = null;
      _renderModalBTs();
      Utils.toast('✓ BT criada! Agora clique na estaca no mapa e lance a contribuição dela.', 'sucesso');
    } catch (e) {
      Utils.toast('Erro ao criar BT: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  function abrirEditarMetaBT(id) {
    if (!Permissions.pode('controleEstacas', 'editar')) { Utils.toast('Sem permissão para editar.', 'erro'); return; }
    const b = btsConfig.find(x => x.id === id);
    if (!b) return;
    const meta = _metaBT(id);
    bt = { concId: acompConcretagemId, btId: id, modo: 'editar-meta', numeroForm: b.numero, volumeForm: b.volumePrevisto, nf: b.notaFiscal || '', cod: b.codigoBT || '', ...meta };
    _renderModalBTs();
  }

  async function salvarMetaBT() {
    if (!Permissions.pode('controleEstacas', 'editar')) { Utils.toast('Sem permissão para editar.', 'erro'); return; }
    const numero = parseInt(document.getElementById('ce-bt-numero-edit').value) || bt.numeroForm;
    const volumePrevisto = EC.num((document.getElementById('ce-bt-volume-edit').value || '').replace(',', '.'));
    const nf = (document.getElementById('ce-bt-nf-edit')?.value || '').trim();
    const cod = (document.getElementById('ce-bt-cod-edit')?.value || '').trim();
    const hora = document.getElementById('ce-bt-hora-edit')?.value || '';
    const sobra = EC.num((document.getElementById('ce-bt-sobra-edit')?.value || '').replace(',', '.'));
    const perda = EC.num((document.getElementById('ce-bt-perda-edit')?.value || '').replace(',', '.'));
    const perdaCocho = EC.num((document.getElementById('ce-bt-perdacocho-edit')?.value || '').replace(',', '.'));
    Utils.mostrarLoading();
    try {
      await Database.atualizar(obraId, COL_BTS, bt.btId, { numero, volumePrevisto, notaFiscal: nf, codigoBT: cod });
      const bCfg = btsConfig.find(x => x.id === bt.btId);
      if (bCfg) Object.assign(bCfg, { numero, volumePrevisto, notaFiscal: nf, codigoBT: cod });
      // Propaga sobra/perda/cocho/hora pra todos os lançamentos já feitos com essa BT
      // (são atributos do caminhão inteiro, não da peça — ficam iguais em todos).
      const lansBT = lancamentos.filter(l => l.btConfigId === bt.btId);
      if (lansBT.length) {
        const ops = lansBT.map(l => ({ type: 'update', ref: Database.ref(obraId, COL_LANS).doc(l.id), data: { sobraCaminhao: sobra, perdaObra: perda, perdaCocho, hora } }));
        await Database.batchWrite(ops);
        lansBT.forEach(l => Object.assign(l, { sobraCaminhao: sobra, perdaObra: perda, perdaCocho, hora }));
      }
      bt = null;
      _renderModalBTs();
      Utils.toast('✓ BT atualizada!', 'sucesso');
    } catch (e) {
      Utils.toast('Erro ao salvar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  async function excluirBTEstacas(idPre) {
    if (!Permissions.pode('controleEstacas', 'excluir')) { Utils.toast('Sem permissão para excluir.', 'erro'); return; }
    const btId = idPre || (bt && bt.btId);
    if (!btId) return;
    const bSel = btsConfig.find(x => x.id === btId);
    const qtdLan = lancamentos.filter(l => l.btConfigId === btId).length;
    const ok = await Utils.confirmar(`Excluir a BT-${bSel?.numero}${qtdLan ? ` e os ${qtdLan} lançamento(s) dela` : ''}? Não tem volta.`);
    if (!ok) return;
    Utils.mostrarLoading();
    try {
      const ops = [{ type: 'delete', ref: Database.ref(obraId, COL_BTS).doc(btId) }];
      lancamentos.filter(l => l.btConfigId === btId).forEach(l => ops.push({ type: 'delete', ref: Database.ref(obraId, COL_LANS).doc(l.id) }));
      await Database.batchWrite(ops);
      await carregar();
      await EstacasCalculos.sincronizarVinculosPlanejamento(obraId).catch(e => console.error('Sync Planejamento:', e));
      bt = null;
      _renderAbaAcompanhamento();
      _renderModalBTs();
      Utils.toast('BT excluída.', 'sucesso');
    } catch (e) {
      Utils.toast('Erro ao excluir: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // Metadados "do caminhão inteiro" (sobra/perda/cocho/hora) — lidos de
  // qualquer lançamento já feito com essa BT (todos têm os mesmos valores).
  function _metaBT(btId) {
    if (metaBTPendente[btId]) return metaBTPendente[btId];
    const existente = lancamentos.find(l => l.btConfigId === btId);
    return {
      sobra: String(existente?.sobraCaminhao ?? ''),
      perda: String(existente?.perdaObra ?? ''),
      perdaCocho: String(existente?.perdaCocho ?? ''),
      hora: existente?.hora || '',
    };
  }

  function toggleMetaInline(btId) {
    btMetaInlineId = btMetaInlineId === btId ? null : btId;
    _renderLancarEstacaBody();
  }

  // Salva sobra/perda/cocho/hora de uma BT direto do popup de lançar por
  // estaca — sem fechar/perder o que já foi digitado nas linhas. Propaga
  // pra todos os lançamentos já feitos com essa BT (é do caminhão inteiro).
  async function salvarMetaBTInline(btId) {
    if (!Permissions.pode('controleEstacas', 'editar')) { Utils.toast('Sem permissão para editar.', 'erro'); return; }
    const sobra = (document.getElementById('ce-meta-sobra-' + btId)?.value || '').trim();
    const perda = (document.getElementById('ce-meta-perda-' + btId)?.value || '').trim();
    const perdaCocho = (document.getElementById('ce-meta-cocho-' + btId)?.value || '').trim();
    const hora = document.getElementById('ce-meta-hora-' + btId)?.value || '';
    metaBTPendente[btId] = { sobra, perda, perdaCocho, hora };
    const lansBT = lancamentos.filter(l => l.btConfigId === btId);
    if (!lansBT.length) {
      // Ainda não existe nenhum lançamento dessa BT — fica guardado aqui e
      // entra automaticamente quando o lançamento desta peça for salvo.
      btMetaInlineId = null;
      _renderLancarEstacaBody();
      Utils.toast('✓ Guardado — vai entrar quando você salvar o lançamento desta peça.', 'sucesso');
      return;
    }
    Utils.mostrarLoading();
    try {
      const dados = { sobraCaminhao: EC.num(sobra.replace(',', '.')), perdaObra: EC.num(perda.replace(',', '.')), perdaCocho: EC.num(perdaCocho.replace(',', '.')), hora };
      const ops = lansBT.map(l => ({ type: 'update', ref: Database.ref(obraId, COL_LANS).doc(l.id), data: dados }));
      await Database.batchWrite(ops);
      lansBT.forEach(l => Object.assign(l, dados));
      btMetaInlineId = null;
      _renderLancarEstacaBody();
      Utils.toast('✓ Sobra/perda salvas!', 'sucesso');
    } catch (e) {
      Utils.toast('Erro ao salvar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  function _volumeConcPeca(p, concId) {
    const pc = pecaConc.find(x => x.pecaId === p.id && x.concretagemId === concId);
    const pctConc = pc ? (parseFloat(pc.pctConcretagem) || 0) / 100 : 1;
    return (p.volume || 0) * pctConc;
  }

  // Volume total (o que o PROJETO precisa) x executado (capado em 100% por
  // peça — não conta excesso) x executado REAL pelas BTs (soma bruta do que
  // as BTs entregaram nas peças, sem capar — mostra se sobrou/faltou além
  // do previsto) x índice de perda (sobra+perda das BTs usadas / volume
  // previsto delas).
  function _resumoVolumesConcretagem(concId) {
    const listaPecas = _pecasPlanejadas(concId);
    let volumeTotal = 0, volumeExecutadoProjeto = 0;
    listaPecas.forEach(p => {
      const volNecessario = _volumeConcPeca(p, concId);
      const pct = ConcretoCalculos.pctConcretado(p, lancamentos);
      volumeTotal += volNecessario;
      volumeExecutadoProjeto += Math.min(volNecessario, (pct / 100) * volNecessario);
    });
    const lansConc = lancamentos.filter(l => l.concretagemId === concId);
    const idsBTsUsadas = new Set(lansConc.map(l => l.btConfigId));
    let volumePrevistoBTs = 0, perdaCochoTotal = 0, perdaObraTotal = 0, sobraTotal = 0;
    idsBTsUsadas.forEach(btId => {
      const b = btsConfig.find(x => x.id === btId);
      if (!b) return;
      volumePrevistoBTs += b.volumePrevisto || 0;
      const lan = lansConc.find(l => l.btConfigId === btId);
      perdaCochoTotal += (lan?.perdaCocho || 0);
      perdaObraTotal += (lan?.perdaObra || 0);
      sobraTotal += (lan?.sobraCaminhao || 0);
    });
    // "Executado real (BTs)" = volume previsto (nominal) das BTs usadas —
    // igual ao "Volume Real Concretado" do Controle de Concreto.
    const volumeExecutadoReal = volumePrevistoBTs;
    // Cocho e linha se perdem ANTES de chegar na peça (normalmente na 1ª BT)
    // — desconta isso primeiro pra achar o que de fato chegou na peça.
    // Erro antigo: essa perda entrava DUAS vezes (implícita na diferença
    // bruta real-vs-projeto, e de novo somada explicitamente) — dobrava o
    // índice. Agora desconta uma vez só, antes de comparar com o projeto.
    const volumeUsadoReal = volumeExecutadoReal - perdaCochoTotal;
    const perdaSolo = Math.max(0, volumeUsadoReal - volumeTotal);
    const perdaTotal = perdaSolo + perdaObraTotal + sobraTotal;
    const indicePerda = volumeTotal > 0 ? (perdaTotal / volumeTotal) * 100 : 0;
    return { volumeTotal, volumeExecutadoProjeto, volumeExecutadoReal, indicePerda, perdaSolo };
  }

  // ══════════════════════════════════════════
  // LANÇAR POR ESTACA — o fluxo principal: escolhe a peça (estaca/fundação)
  // e lista quais BTs concretaram ela e quanto % de CADA BT foi usado nesta
  // peça (não % da peça — % do caminhão, que é o que dá pra saber de
  // verdade em campo). O volume salvo é (%BT/100)*volumePrevisto da BT, e o
  // %-da-peça guardado no lançamento (pra bater com o Controle de Concreto
  // e todo o resto do sistema) é derivado desse volume — a conta de sempre,
  // só a ENTRADA que inverteu.
  // ══════════════════════════════════════════
  function _abrirEstaca(pecaId) {
    const lansPeca = lancamentos.filter(l => l.pecaId === pecaId && l.concretagemId === acompConcretagemId);
    // Mescla por BT (soma o volume) — proteção contra dado antigo com 2
    // lançamentos pra mesma (peça, BT), que mostraria a mesma BT 2x na lista.
    const porBT = new Map();
    lansPeca.forEach(l => {
      const acc = porBT.get(l.btConfigId) || 0;
      porBT.set(l.btConfigId, acc + (l.volume || 0));
    });
    const linhas = [...porBT.entries()].map(([btId, volume]) => {
      const b = btsConfig.find(x => x.id === btId);
      const pctBT = b && b.volumePrevisto > 0 ? (volume / b.volumePrevisto) * 100 : 0;
      return { btId, pctBT: String(Math.round(pctBT * 100) / 100) };
    }).sort((a, b) => {
      const na = btsConfig.find(x => x.id === a.btId)?.numero || 0;
      const nb = btsConfig.find(x => x.id === b.btId)?.numero || 0;
      return na - nb;
    });
    if (!linhas.length) linhas.push({ btId: '', pctBT: '' });
    estacaAtual = { concId: acompConcretagemId, pecaId, linhas };
  }

  function btAddLinhaPeca() { estacaAtual.linhas.push({ btId: '', pctBT: '' }); _renderLancarEstacaBody(); }
  function btRemLinhaPeca(i) { estacaAtual.linhas.splice(i, 1); _renderLancarEstacaBody(); }
  function btUpdLinhaPeca(i, campo, valor) {
    if (campo === 'btId' && valor) {
      const jaEmOutraLinha = estacaAtual.linhas.some((l, idx) => idx !== i && l.btId === valor);
      if (jaEmOutraLinha) {
        Utils.toast('Essa BT já está em outra linha desta peça — escolha outra.', 'alerta');
        return;
      }
    }
    estacaAtual.linhas[i][campo] = valor;
    if (campo === 'btId') { _renderLancarEstacaBody(); return; }
    // só o % mudou — atualiza volume da linha, o aviso de excesso e o total, sem re-render total
    const b = btsConfig.find(x => x.id === estacaAtual.linhas[i].btId);
    if (b) {
      const vol = (EC.num(valor.replace(',', '.')) / 100) * b.volumePrevisto;
      const volEl = document.getElementById('ce-est-vol-' + i);
      if (volEl) volEl.textContent = EC.fmt1(vol) + ' m³';
      const pctOutras = _pctBTAlocadaOutrasPecas(b.id, estacaAtual.pecaId);
      const pctEsta = EC.num(valor.replace(',', '.'));
      const avisoEl = document.getElementById('ce-est-aviso-' + i);
      if (avisoEl) {
        const excesso = (pctOutras + pctEsta) > 100.05;
        avisoEl.style.display = excesso ? '' : 'none';
        if (excesso) avisoEl.textContent = `⚠ Essa BT já tem ${EC.fmt1(pctOutras)}% usado em outra peça — com esse %, passaria de 100% da BT.`;
      }
    }
    _atualizarTotalEstaca();
  }
  function _atualizarTotalEstaca() {
    const totalEl = document.getElementById('ce-est-total-recebido');
    if (!totalEl) return;
    const total = estacaAtual.linhas.reduce((s, l) => {
      const b = btsConfig.find(x => x.id === l.btId);
      if (!b) return s;
      return s + (EC.num((l.pctBT || '').replace(',', '.')) / 100) * b.volumePrevisto;
    }, 0);
    totalEl.textContent = EC.fmt1(total) + ' m³';
  }

  // % de uma BT já alocado em OUTRAS peças (lançamentos já salvos no
  // Firestore, excluindo a peça que está sendo editada agora) — usada pra
  // avisar antes de passar de 100% de uma BT dividida entre peças.
  function _pctBTAlocadaOutrasPecas(btId, excetoPecaId) {
    const b = btsConfig.find(x => x.id === btId);
    if (!b || !b.volumePrevisto) return 0;
    const volOutras = lancamentos.filter(l => l.btConfigId === btId && l.pecaId !== excetoPecaId).reduce((s, l) => s + (l.volume || 0), 0);
    return (volOutras / b.volumePrevisto) * 100;
  }

  function toggleMostrarBTsCompletas(v) { mostrarBTsCompletas = v; _renderLancarEstacaBody(); }

  async function salvarEstacaAcomp() {
    if (!Permissions.pode('controleEstacas', 'editar') && !Permissions.pode('controleEstacas', 'criar')) { Utils.toast('Sem permissão.', 'erro'); return; }
    if (!estacaAtual || !estacaAtual.pecaId) return;
    const p = pecas.find(x => x.id === estacaAtual.pecaId);
    if (!p) return;
    Utils.mostrarLoading();
    try {
      const volConcPeca = _volumeConcPeca(p, estacaAtual.concId);
      const ops = [];
      const idsUsados = new Set();
      // Mescla linhas com a MESMA BT (soma o volume) antes de gravar — nunca
      // pode existir 2 documentos pra (peça, BT), quebraria o batch write.
      const volumePorBT = new Map();
      estacaAtual.linhas.forEach(l => {
        const b = btsConfig.find(x => x.id === l.btId);
        if (!b) return;
        const pctBT = EC.num((l.pctBT || '').replace(',', '.'));
        if (pctBT <= 0) return;
        const volumeLinha = (pctBT / 100) * b.volumePrevisto;
        volumePorBT.set(b.id, (volumePorBT.get(b.id) || 0) + volumeLinha);
      });
      volumePorBT.forEach((volume, btId) => {
        const b = btsConfig.find(x => x.id === btId);
        idsUsados.add(btId);
        const pctPeca = volConcPeca > 0 ? (volume / volConcPeca) * 100 : 0;
        const meta = _metaBT(btId);
        const existente = lancamentos.find(x => x.btConfigId === btId && x.pecaId === p.id);
        const dados = {
          btConfigId: btId, concretagemId: estacaAtual.concId, pecaId: p.id,
          pct: +pctPeca.toFixed(2), volume: +volume.toFixed(4),
          hora: meta.hora, sobraCaminhao: EC.num(meta.sobra), perdaObra: EC.num(meta.perda), perdaCocho: EC.num(meta.perdaCocho), obraId,
        };
        if (existente) ops.push({ type: 'update', ref: Database.ref(obraId, COL_LANS).doc(existente.id), data: dados });
        else ops.push({ type: 'set', ref: Database.ref(obraId, COL_LANS).doc(EC.genId('lan')), data: dados });
      });
      // BTs que tinham lançamento nesta peça antes, mas foram removidos da lista agora
      lancamentos.filter(l => l.pecaId === p.id && l.concretagemId === estacaAtual.concId && !idsUsados.has(l.btConfigId)).forEach(l => {
        ops.push({ type: 'delete', ref: Database.ref(obraId, COL_LANS).doc(l.id) });
      });
      if (ops.length) await Database.batchWrite(ops);
      await carregar();
      await EstacasCalculos.sincronizarVinculosPlanejamento(obraId).catch(e => console.error('Sync Planejamento:', e));
      estacaAtual = null;
      Utils.fecharModal('modal-ce-lancar-estaca');
      _renderAbaAcompanhamento();
      Utils.toast('✓ Lançamento salvo!', 'sucesso');
    } catch (e) {
      Utils.toast('Erro ao salvar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  function abrirModalBTs() {
    _renderModalBTs();
    Utils.abrirModal('modal-ce-bts-conc');
  }

  function _renderModalBTs() {
    const el = document.getElementById('ce-bts-conc-body');
    if (!el) return;
    if (!acompConcretagemId) { el.innerHTML = ''; return; }
    const btsConc = _btsDaConcretagem(acompConcretagemId);

    let html = `
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px;">
        ${btsConc.map(b => {
          const jafoi = lancamentos.some(l => l.btConfigId === b.id);
          return `<span style="display:inline-flex;align-items:center;gap:4px;border:1px solid ${jafoi ? '#16a34a' : 'var(--cv-border,#e2e8f0)'};border-radius:8px;padding:4px 4px 4px 10px;font-size:.82rem;">
            BT-${b.numero} · ${EC.fmt1(b.volumePrevisto)}m³${jafoi ? ' ✓' : ''}
            <button class="btn btn-secundario btn-sm" style="padding:2px 6px;" onclick="CE.abrirEditarMetaBT('${b.id}')" title="Editar BT">✎</button>
            <button class="btn btn-secundario btn-sm" style="padding:2px 6px;color:var(--cv-red,#ef4444);" onclick="CE.excluirBTEstacas('${b.id}')" title="Excluir BT">🗑</button>
          </span>`;
        }).join('')}
        <button class="btn btn-secundario btn-sm" data-perm="controleEstacas:criar" onclick="CE.abrirNovaBT()">+ Nova BT</button>
      </div>`;

    if (bt && bt.modo === 'nova-meta') {
      html += `
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;padding:10px;border:1px dashed var(--cv-border,#e2e8f0);border-radius:8px;margin-bottom:10px;">
          <div><label class="text-sm text-muted" style="display:block;">Nº BT</label><input type="number" id="ce-bt-numero-novo" class="form-control" style="width:80px;" value="${bt.numeroForm}"></div>
          <div><label class="text-sm text-muted" style="display:block;">Volume previsto [m³]</label><input type="text" inputmode="decimal" id="ce-bt-volume-novo" class="form-control" style="width:130px;" placeholder="ex: 8"></div>
          <button class="btn btn-primario btn-sm" onclick="CE.criarBTEstacas()">Criar BT</button>
          <button class="btn btn-secundario btn-sm" onclick="CE.fecharPainelBT()">Cancelar</button>
        </div>`;
    }

    if (bt && bt.modo === 'editar-meta') {
      html += `
        <div style="border:1px solid var(--cv-border,#e2e8f0);border-radius:8px;padding:12px;margin-bottom:10px;">
          <div style="font-weight:700;margin-bottom:8px;">✎ Editando BT-${bt.numeroForm}</div>
          <div class="form-row" style="margin-bottom:8px;">
            <div class="form-grupo" style="margin-bottom:0;"><label>Nº</label><input type="number" id="ce-bt-numero-edit" class="form-control" value="${bt.numeroForm}"></div>
            <div class="form-grupo" style="margin-bottom:0;"><label>Volume previsto [m³]</label><input type="text" inputmode="decimal" id="ce-bt-volume-edit" class="form-control" value="${EC.fmt1(bt.volumeForm)}"></div>
          </div>
          <div class="form-row" style="margin-bottom:8px;">
            <div class="form-grupo" style="margin-bottom:0;"><label>Nota Fiscal</label><input type="text" id="ce-bt-nf-edit" class="form-control" value="${esc(bt.nf || '')}" placeholder="opcional"></div>
            <div class="form-grupo" style="margin-bottom:0;"><label>Código BT</label><input type="text" id="ce-bt-cod-edit" class="form-control" value="${esc(bt.cod || '')}" placeholder="opcional"></div>
          </div>
          <div class="form-row" style="margin-bottom:8px;">
            <div class="form-grupo" style="margin-bottom:0;"><label>Sobra Caminhão [m³]</label><input type="text" inputmode="decimal" id="ce-bt-sobra-edit" class="form-control" value="${esc(bt.sobra || '')}" placeholder="0"></div>
            <div class="form-grupo" style="margin-bottom:0;"><label>Perda em Obra [m³]</label><input type="text" inputmode="decimal" id="ce-bt-perda-edit" class="form-control" value="${esc(bt.perda || '')}" placeholder="0"></div>
          </div>
          <div class="form-row" style="margin-bottom:8px;">
            <div class="form-grupo" style="margin-bottom:0;"><label>Cocho + Linha [m³]</label><input type="text" inputmode="decimal" id="ce-bt-perdacocho-edit" class="form-control" value="${esc(bt.perdaCocho || '')}" placeholder="0"></div>
            <div class="form-grupo" style="margin-bottom:0;"><label>Hora</label><input type="time" id="ce-bt-hora-edit" class="form-control" value="${esc(bt.hora || '')}"></div>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;">
            <button class="btn btn-secundario btn-sm" onclick="CE.fecharPainelBT()">Cancelar</button>
            <button class="btn btn-primario btn-sm" onclick="CE.salvarMetaBT()">✓ Salvar BT</button>
          </div>
        </div>`;
    }
    el.innerHTML = html;
    Permissions.aplicarNaTela();
  }

  // ── Popup de lançar por estaca — aberto ao clicar no marcador no mapa ──
  function abrirEstacaModal(pecaId) {
    _abrirEstaca(pecaId);
    btMetaInlineId = null;
    const p = pecas.find(x => x.id === pecaId);
    const titEl = document.getElementById('ce-lancar-titulo');
    if (titEl) titEl.textContent = `🚚 Lançar — ${p ? p.nome : ''}`;
    _renderLancarEstacaBody();
    Utils.abrirModal('modal-ce-lancar-estaca');
  }

  function _opcoesBTHTML(selId) {
    const btsConc = _btsDaConcretagem(estacaAtual.concId);
    const idsUsados = new Set(estacaAtual.linhas.map(l => l.btId).filter(Boolean));
    return `<option value="">— BT —</option>` + btsConc.filter(b => {
      if (b.id === selId || idsUsados.has(b.id)) return true;
      const pctOutras = _pctBTAlocadaOutrasPecas(b.id, estacaAtual.pecaId);
      return mostrarBTsCompletas || pctOutras < 99.99;
    }).map(b => {
      const pctOutras = _pctBTAlocadaOutrasPecas(b.id, estacaAtual.pecaId);
      return `<option value="${b.id}" ${selId === b.id ? 'selected' : ''}>BT-${b.numero} · ${EC.fmt1(b.volumePrevisto)}m³${pctOutras > 0.01 ? ` (${EC.fmt1(pctOutras)}% em outras peças)` : ''}</option>`;
    }).join('');
  }

  function _renderLancarEstacaBody() {
    const el = document.getElementById('ce-lancar-body');
    if (!el || !estacaAtual) return;
    const btsConc = _btsDaConcretagem(estacaAtual.concId);
    const primeiraBT = _primeiraBTConcretagem(estacaAtual.concId);
    const ultimaBT = _ultimaBTConcretagem(estacaAtual.concId);
    const p = pecas.find(x => x.id === estacaAtual.pecaId);
    const volNecessario = p ? _volumeConcPeca(p, estacaAtual.concId) : 0;
    const totalRecebido = estacaAtual.linhas.reduce((s, l) => {
      const b = btsConfig.find(x => x.id === l.btId);
      if (!b) return s;
      return s + (EC.num((l.pctBT || '').replace(',', '.')) / 100) * b.volumePrevisto;
    }, 0);
    const idsUsados = new Set(estacaAtual.linhas.map(l => l.btId).filter(Boolean));
    // % de cada BT já alocado em OUTRAS peças (lançamentos já salvos, exceto a peça atual) —
    // pra não passar de 100% da BT sem perceber, já que uma BT pode ser dividida entre várias peças.
    // Por padrão, esconde do seletor as que já estão 100% alocadas noutras peças (não sobra nada
    // pra usar aqui mesmo) — "Mostrar BTs 100% usadas" reexibe, se precisar reajustar algo.
    const qtdCompletas = btsConc.filter(b => !idsUsados.has(b.id) && _pctBTAlocadaOutrasPecas(b.id, estacaAtual.pecaId) >= 99.99).length;
    el.innerHTML = `
      <div class="text-sm text-muted" style="margin-bottom:10px;">Precisa de ${EC.fmt1(volNecessario)} m³ · recebido até agora ${EC.fmt1(totalRecebido)} m³ (${EC.fmt1(volNecessario > 0 ? totalRecebido / volNecessario * 100 : 0)}%)</div>
      ${!btsConc.length ? `<div class="cc-empty">Nenhuma BT criada ainda nesta concretagem. <button class="btn btn-secundario btn-sm" data-perm="controleEstacas:criar" onclick="Utils.fecharModal('modal-ce-lancar-estaca');CE.abrirModalBTs();CE.abrirNovaBT();">+ Criar BT</button></div>` : `
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:4px;">
          <label class="text-sm text-muted" style="margin:0;">Quais BTs concretaram esta peça, e quanto % de CADA BT foi usado aqui</label>
          ${qtdCompletas > 0 ? `<label class="text-sm" style="display:flex;align-items:center;gap:4px;cursor:pointer;white-space:nowrap;"><input type="checkbox" ${mostrarBTsCompletas ? 'checked' : ''} onchange="CE.toggleMostrarBTsCompletas(this.checked)"> Mostrar ${qtdCompletas} BT${qtdCompletas !== 1 ? 's' : ''} 100% usada${qtdCompletas !== 1 ? 's' : ''}</label>` : ''}
        </div>
        <div id="ce-est-linhas">
          ${estacaAtual.linhas.map((l, i) => {
            const b = btsConfig.find(x => x.id === l.btId);
            const vol = b ? (EC.num((l.pctBT || '').replace(',', '.')) / 100) * b.volumePrevisto : 0;
            const pctOutras = b ? _pctBTAlocadaOutrasPecas(b.id, estacaAtual.pecaId) : 0;
            const pctEsta = EC.num((l.pctBT || '').replace(',', '.'));
            const excesso = b && (pctOutras + pctEsta) > 100.05;
            const meta = b ? _metaBT(b.id) : null;
            const temPerda = meta && (EC.num(meta.sobra) > 0 || EC.num(meta.perda) > 0 || EC.num(meta.perdaCocho) > 0);
            const ehPrimeiraOuUltima = b && ((primeiraBT && b.id === primeiraBT.id) || (ultimaBT && b.id === ultimaBT.id));
            return `<div style="margin-bottom:6px;">
              <div style="display:grid;grid-template-columns:1fr 100px 90px 100px 36px;gap:8px;align-items:center;">
                <select class="form-control" onchange="CE.btUpdLinhaPeca(${i}, 'btId', this.value)">${_opcoesBTHTML(l.btId)}</select>
                <input type="text" inputmode="decimal" class="form-control" style="${excesso ? 'border-color:#ef4444;' : ''}" placeholder="% da BT" value="${esc(l.pctBT)}" oninput="CE.btUpdLinhaPeca(${i}, 'pctBT', this.value)">
                <span id="ce-est-vol-${i}" style="font-family:var(--font-mono);font-size:.78rem;color:var(--cor-texto-secundario);text-align:right;">${EC.fmt1(vol)} m³</span>
                ${ehPrimeiraOuUltima ? `<button class="btn btn-secundario btn-sm" style="${temPerda ? 'border-color:#f59e0b;color:#f59e0b;' : ''}" title="${b.id === primeiraBT?.id ? 'Cocho/linha desta BT (é a primeira)' : 'Sobra de caminhão desta BT (é a última)'}" onclick="CE.toggleMetaInline('${b.id}')">✎ ${b.id === primeiraBT?.id ? 'cocho' : 'sobra'}</button>` : ''}
                <button class="btn btn-secundario btn-sm" style="color:var(--cv-red,#ef4444);" onclick="CE.btRemLinhaPeca(${i})" ${estacaAtual.linhas.length <= 1 ? 'disabled' : ''}>✕</button>
              </div>
              <div id="ce-est-aviso-${i}" class="text-sm" style="color:#ef4444;margin-top:2px;${excesso ? '' : 'display:none;'}">⚠ Essa BT já tem ${EC.fmt1(pctOutras)}% usado em outra peça — com esse %, passaria de 100% da BT.</div>
              ${b && btMetaInlineId === b.id ? (() => {
                const ehPrimeira = primeiraBT && b.id === primeiraBT.id;
                const ehUltima = ultimaBT && b.id === ultimaBT.id;
                return `
                <div style="border:1px dashed var(--cv-border,#e2e8f0);border-radius:8px;padding:10px;margin-top:6px;background:var(--cv-surface2,#f8fafc);">
                  <div class="text-sm text-muted" style="margin-bottom:10px;">Sobra/perda de BT-${b.numero} — vale pra todas as peças que essa BT concretou, não só esta.${ehPrimeira ? ' É a <b>primeira</b> BT: tem cocho/linha.' : ''}${ehUltima ? ' É a <b>última</b> BT: tem sobra de caminhão.' : ''}</div>
                  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
                    ${ehUltima ? `<div class="form-grupo" style="margin-bottom:0;"><label>Sobra Caminhão [m³]</label><input type="text" inputmode="decimal" id="ce-meta-sobra-${b.id}" class="form-control" value="${esc(meta.sobra)}" placeholder="0"></div>` : ''}
                    ${ehPrimeira ? `<div class="form-grupo" style="margin-bottom:0;"><label>Cocho + Linha [m³]</label><input type="text" inputmode="decimal" id="ce-meta-cocho-${b.id}" class="form-control" value="${esc(meta.perdaCocho)}" placeholder="0"></div>` : ''}
                    <div class="form-grupo" style="margin-bottom:0;"><label>Perda em Obra [m³]</label><input type="text" inputmode="decimal" id="ce-meta-perda-${b.id}" class="form-control" value="${esc(meta.perda)}" placeholder="0"></div>
                    <div class="form-grupo" style="margin-bottom:0;"><label>Hora</label><input type="time" id="ce-meta-hora-${b.id}" class="form-control" value="${esc(meta.hora)}"></div>
                  </div>
                  <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px;">
                    <button class="btn btn-secundario btn-sm" onclick="CE.toggleMetaInline('${b.id}')">Fechar</button>
                    <button class="btn btn-primario btn-sm" onclick="CE.salvarMetaBTInline('${b.id}')">✓ Salvar</button>
                  </div>
                </div>`;
              })() : ''}
            </div>`;
          }).join('')}
        </div>
        <button class="btn btn-secundario btn-sm" onclick="CE.btAddLinhaPeca()">+ BT</button>
        <div style="display:flex;justify-content:space-between;align-items:center;background:var(--cv-surface2,#f8fafc);border:1px solid var(--cv-border,#e2e8f0);border-radius:8px;padding:8px 12px;margin-top:10px;font-family:var(--font-mono);font-size:.82rem;">
          <span>Total recebido: <b id="ce-est-total-recebido">${EC.fmt1(totalRecebido)} m³</b></span>
        </div>`}
    `;
    Permissions.aplicarNaTela();
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
  // Ctrl+roda: zoom · Ctrl+arrastar: pan — igual em Marcadores, Planejamento
  // e Acompanhamento (mesmo stage, "stageId" muda só o id do elemento).
  function _ligarPanZoom(stageId) {
    const stage = document.getElementById(stageId);
    if (!stage) return;
    const scrollEl = stage.parentElement;
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

    // Toque (tablet/celular): 2 dedos sempre faz pinch-zoom (nunca conflita
    // com nada de 1 toque). 1 dedo arrasta o mapa (pan) só quando NÃO está
    // criando/editando nada — nesses modos o toque continua se comportando
    // como o mouse normal (arrastar pra definir tamanho/mover marcador).
    let toque1 = null, pinchDist0 = null, zoomIni = null;
    const emModoLivre = () => !modo && !editandoFormaId;
    stage.addEventListener('touchstart', ev => {
      if (ev.touches.length === 2) {
        ev.preventDefault();
        toque1 = null;
        const [t1, t2] = ev.touches;
        pinchDist0 = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        zoomIni = zoomE;
      } else if (ev.touches.length === 1 && emModoLivre() && !ev.target.closest('.est-marcador, .est-poligono-hit')) {
        const t = ev.touches[0];
        toque1 = { x: t.clientX, y: t.clientY, sl: scrollEl.scrollLeft, st: scrollEl.scrollTop, moveu: false };
      }
    }, { passive: false });
    stage.addEventListener('touchmove', ev => {
      if (ev.touches.length === 2 && pinchDist0) {
        ev.preventDefault();
        const [t1, t2] = ev.touches;
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        zoomE = Math.min(4, Math.max(0.25, +(zoomIni * (dist / pinchDist0)).toFixed(2)));
        const lbl = document.getElementById('ce-zoom-label');
        if (lbl) lbl.textContent = Math.round(zoomE * 100) + '%';
        if (!_pinchRaf) _pinchRaf = requestAnimationFrame(() => { _pinchRaf = null; _rerenderMapaDaAba(); });
      } else if (ev.touches.length === 1 && toque1) {
        const t = ev.touches[0];
        const dx = t.clientX - toque1.x, dy = t.clientY - toque1.y;
        if (!toque1.moveu && Math.hypot(dx, dy) < 8) return; // ainda pode ser um toque/tap — não rouba o clique
        toque1.moveu = true;
        ev.preventDefault();
        scrollEl.scrollLeft = toque1.sl - dx;
        scrollEl.scrollTop = toque1.st - dy;
      }
    }, { passive: false });
    stage.addEventListener('touchend', ev => {
      if (ev.touches.length < 2) pinchDist0 = null;
      if (ev.touches.length < 1) toque1 = null;
    });
  }

  let _pinchRaf = null;
  function _rerenderMapaDaAba() {
    if (abaPrincipal === 'planejamento') renderMapaPlanejamento();
    else if (abaPrincipal === 'acompanhamento') renderMapaAcompanhamento();
    else renderMapa();
  }

  function _ligarEventosToggle(stageId, lista, toggleFn) {
    const stage = document.getElementById(stageId);
    if (!stage) return;
    _ligarPanZoom(stageId);
    stage.style.cursor = 'pointer';
    stage.addEventListener('click', ev => {
      if (ev.ctrlKey) return;
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
    // Se a imagem não está em cache (ex: logo depois de girar a prancha),
    // buscar no Firestore leva um instante — nesse meio tempo o stage AINDA
    // é o antigo (com os listeners do modo anterior). Se a pessoa clicar
    // pra criar uma estaca durante essa janela, o clique cai no listener
    // errado (modo normal, que só reage a marcador existente) e não
    // acontece nada — nem erro, nem popup. Loading trava isso.
    const precisaBuscarImagem = imagemCachePranchaId !== pr.id;
    if (precisaBuscarImagem) Utils.mostrarLoading();
    const imagem = await _obterImagemPrancha(pr.id);
    if (precisaBuscarImagem) Utils.esconderLoading();
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
    if (!cont) { cont = document.createElement('div'); cont.id = id; cont.style.cssText = 'position:absolute;inset:0;pointer-events:none;'; stage.appendChild(cont); }
    return cont;
  }

  function _ligarEventosMapa() {
    const stage = document.getElementById('ce-stage');
    if (!stage) return;
    _ligarPanZoom('ce-stage');

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
          const diam = raio * 2 * (stage.offsetWidth || 1);
          preview.style.width = diam.toFixed(1) + 'px';
          preview.style.height = diam.toFixed(1) + 'px';
        };
        const soltar = async up => {
          document.removeEventListener('mousemove', mover);
          document.removeEventListener('mouseup', soltar);
          cont.innerHTML = '';
          const raio = EC.raioFracao(centro, EC.posRelativa(up, stage), stage);
          const raioPx = raio * (stage.offsetWidth || 1);
          // Limiar em PIXELS DE TELA (não fração da imagem) — com zoom alto,
          // um arrasto normal na tela virava uma fração ínfima da imagem
          // (que ficou enorme) e era descartado em silêncio (o antigo
          // raio<0.004 fixo não escalava com o zoom).
          if (raioPx < 3) return; // arrasto minúsculo, ignora (evita clique acidental)
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

    // Modo normal: segurar e arrastar uma estaca já move ela direto (sem
    // precisar abrir o popup e clicar em "Ajustar forma" antes) — clique
    // rápido, sem arrastar, continua abrindo o vínculo como sempre.
    stage.addEventListener('mousedown', ev => {
      if (ev.ctrlKey) return;
      const marcador = ev.target.closest('.est-marcador');
      if (!marcador) return; // arraste direto só pra círculo (estaca) por ora
      const m = marcadores.find(x => x.id === marcador.dataset.id);
      if (!m || m.tipo !== 'circulo') return;
      const inicioX = ev.clientX, inicioY = ev.clientY;
      const orig = { cx: m.cx, cy: m.cy };
      let arrastou = false;
      const mover = mv => {
        if (!arrastou && Math.hypot(mv.clientX - inicioX, mv.clientY - inicioY) < 4) return;
        arrastou = true;
        const p = EC.posRelativa(mv, stage);
        m.cx = p.x; m.cy = p.y;
        marcador.style.left = (p.x * 100).toFixed(3) + '%';
        marcador.style.top = (p.y * 100).toFixed(3) + '%';
      };
      const soltar = async () => {
        document.removeEventListener('mousemove', mover);
        document.removeEventListener('mouseup', soltar);
        if (!arrastou) return; // foi um clique normal — deixa o listener de 'click' abaixo abrir o vínculo
        _arrastouMarcadorAgora = true;
        try {
          await Database.atualizar(obraId, COL_MARCADORES, m.id, { cx: m.cx, cy: m.cy });
        } catch (e) {
          m.cx = orig.cx; m.cy = orig.cy;
          marcador.style.left = (orig.cx * 100).toFixed(3) + '%';
          marcador.style.top = (orig.cy * 100).toFixed(3) + '%';
          Utils.toast('Erro ao salvar posição: ' + e.message, 'erro');
        }
      };
      document.addEventListener('mousemove', mover);
      document.addEventListener('mouseup', soltar);
    });

    // Modo normal: clicar num marcador abre o vínculo
    stage.addEventListener('click', ev => {
      if (ev.ctrlKey) return;
      if (_arrastouMarcadorAgora) { _arrastouMarcadorAgora = false; return; } // acabou de arrastar — não abre popup
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

  async function iniciarAdicionarCirculo() {
    if (!Permissions.pode('controleEstacas', 'criar')) { Utils.toast('Sem permissão para criar.', 'erro'); return; }
    modo = 'circulo'; editandoFormaId = null;
    await renderMapa();
    _atualizarBotoesModo();
  }
  async function iniciarAdicionarPoligono() {
    if (!Permissions.pode('controleEstacas', 'criar')) { Utils.toast('Sem permissão para criar.', 'erro'); return; }
    modo = 'poligono'; poligonoPontos = []; editandoFormaId = null;
    await renderMapa();
    _atualizarBotoesModo();
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

  async function salvarVinculo(continuar) {
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
      Utils.fecharModal('modal-ce-vincular');
      await carregar();
      if (continuar) {
        if (m.tipo === 'poligono') await iniciarAdicionarPoligono();
        else await iniciarAdicionarCirculo();
        Utils.toast('✓ Salvo! Já pode marcar a próxima.', 'sucesso');
      } else {
        Utils.toast('✓ Vínculo salvo!', 'sucesso');
      }
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
    init, recarregar, renderizar, setAbaPrincipal, alternarTelaCheia, toggleMinimizarPainel,
    onTrocarView, onTrocarPranchaAtiva, zoomAjustar, girarPrancha,
    iniciarAdicionarCirculo, iniciarAdicionarPoligono, cancelarModo, desfazerPontoPoligono, concluirPoligono,
    iniciarAjusteForma, concluirAjusteForma, cancelarAjusteForma,
    abrirVincular, salvarVinculo, excluirMarcador,
    onFocoBuscaPeca, fecharListaPecaBusca, onBuscaPeca, selecionarPecaBusca,
    abrirPranchas, novaPrancha, renomearPrancha, excluirPrancha, abrirUploadImagem, onImagemArquivo,
    atribuirConcretagemNumero, atribuirConcretagemNumeroInput, removerDaConcretagem, onTrocarAcompConcretagem,
    toggleNovaConcPlan, criarConcretagemPlan, focarConcretagemPlan,
    abrirNovaBT, fecharPainelBT, criarBTEstacas, abrirEditarMetaBT, salvarMetaBT, excluirBTEstacas,
    abrirModalBTs, abrirEstacaModal, btAddLinhaPeca, btRemLinhaPeca, btUpdLinhaPeca, salvarEstacaAcomp, toggleMostrarBTsCompletas,
    toggleMetaInline, salvarMetaBTInline,
  };
})();

const CE = ControleEstacas;

function onObraChanged() {
  ControleEstacas.recarregar();
}

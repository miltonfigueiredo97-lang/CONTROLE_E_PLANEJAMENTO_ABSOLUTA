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
  let pranchaAtivaPorView = { estacas: null, fundacoes: null }; // cada view lembra sua própria prancha ativa — Estacas e Fundações são projetos (pranchas) independentes
  let view = 'estacas'; // 'estacas' | 'fundacoes'
  let modo = null;      // null | 'circulo' | 'poligono' (modo de adicionar)
  let poligonoPontos = [];
  // Pedaços extras da MESMA área em criação, desenhados em lugares separados
  // da prancha (ex: viga que atravessa por trás de um bloco) — cada item é
  // um Point[] já fechado (>=3 pontos). Ao salvar viram m.partesExtras.
  let poligonoPartesExtras = [];
  // Se setado, o próximo marcador desenhado é vinculado direto a essa peça,
  // sem passar pelo popup de vínculo — pra quando a MESMA peça (ex: uma viga
  // que passa por trás de um bloco) aparece dividida em pedaços no desenho e
  // cada pedaço precisa virar um marcador próprio, todos apontando pra peça
  // única (o % de execução/cor é o mesmo em todos, porque vem da peça).
  let proximaAreaParaPeca = null; // {pecaId, nome}
  let _arrastouMarcadorAgora = false; // true logo depois de arrastar uma estaca — suprime o 'click' que abriria o vínculo
  let _arrastandoMarcador = false;    // arrasto de estaca EM CURSO — impede o pan de 1 dedo de arrastar o mapa junto
  let editandoFormaId = null; // marcador em ajuste de forma (mover/redimensionar)
  let marcadorVincularId = null;
  let imagemCachePranchaId = null, imagemCacheBase64 = null;
  let zoomE = 1;
  let pdfjsCarregado = false;
  let acompConcretagemId = null;  // concretagem ativa na aba Acompanhamento
  let planFocoConcretagemId = null; // concretagem selecionada no Planejamento — clique na peça já atribui direto
  let mostrarTodosNumeros = false; // por padrão, número no marcador só da concretagem atual (foco/selecionada) — botão liga/desliga
  let concEditandoId = null; // card de concretagem com o mini-form de editar número/data/descrição aberto
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
      _sincronizarPranchaAtiva();
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
    pranchaAtivaPorView = { estacas: null, fundacoes: null };
    await carregar();
  }

  // ══════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════
  // Estacas e Fundações são projetos (pranchas) INDEPENDENTES — cada prancha
  // tem um `tipo` ('estacas' | 'fundacoes'); pranchas antigas sem o campo
  // são tratadas como 'estacas' (comportamento de antes desta separação).
  function pranchasOrdenadas(v) {
    const tipo = v || view;
    return pranchas.filter(p => (p.tipo || 'estacas') === tipo).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  }
  function pranchaAtiva() { return pranchas.find(p => p.id === pranchaAtivaId) || null; }
  // Garante que pranchaAtivaId é válido pra view atual — cai na prancha
  // guardada daquela view, senão na primeira da lista, senão null. Se
  // pranchaAtivaId já veio setado de fora (deep-link ?prancha=ID), ajusta a
  // própria view pra bater com o tipo dessa prancha primeiro.
  function _sincronizarPranchaAtiva() {
    if (pranchaAtivaId) {
      const prLink = pranchas.find(p => p.id === pranchaAtivaId);
      if (prLink) view = prLink.tipo || 'estacas';
    }
    if (pranchaAtivaId) pranchaAtivaPorView[view] = pranchaAtivaId;
    let idView = pranchaAtivaPorView[view];
    const listaView = pranchasOrdenadas();
    if (!idView || !listaView.some(p => p.id === idView)) idView = listaView[0]?.id || null;
    pranchaAtivaPorView[view] = idView;
    pranchaAtivaId = idView;
  }
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
        <div class="cc-empty">📐<br>Nenhuma prancha (PDF/planta do projeto) importada ainda.<br><button class="btn btn-primario btn-sm" style="margin-top:10px;" data-perm="controleEstacas:criar:prancha" onclick="CE.abrirPranchas()">⊞ Importar Prancha</button></div>
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
    const reporScroll = _preservarScroll('#ce-mapa-host');
    const marcadoresView = marcadores.filter(m => m.tipo === tipoMarcadorDaView());
    const total = marcadoresView.length;
    const vinculados = marcadoresView.filter(m => m.pecaId).length;
    const concluidos = marcadoresView.filter(m => {
      const st = statusMarcador(m);
      return st.pct !== null && st.pct >= 100;
    }).length;

    el.innerHTML = `
      ${(telaCheiaAtiva || painelMinimizado) ? '' : `
      <div class="cc-kpiGrid" style="grid-template-columns:repeat(4,1fr);">
        <div class="cc-kpi"><div class="cc-kpiIcon">${view === 'estacas' ? '⚫' : '⬛'}</div><div class="cc-kpiBody"><div class="cc-kpiLabel">${view === 'estacas' ? 'Estacas' : 'Fundações'} marcadas</div><div class="cc-kpiValue">${total}</div></div></div>
        <div class="cc-kpi cc-kpiBlue"><div class="cc-kpiIcon">🔗</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Vinculadas ao levantamento</div><div class="cc-kpiValue">${vinculados}<span class="cc-kpiUnit">/ ${total}</span></div></div></div>
        <div class="cc-kpi cc-kpiGreen"><div class="cc-kpiIcon">✅</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Concretadas</div><div class="cc-kpiValue">${concluidos}<span class="cc-kpiUnit">/ ${total}</span></div></div></div>
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
        ${_legendaGrupos()}`}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0;align-items:center;">
          <select class="form-control" id="ce-prancha-ativa" style="max-width:240px;" onchange="CE.onTrocarPranchaAtiva()">
            ${pranchasOrdenadas().map(p => `<option value="${p.id}" ${p.id === pranchaAtivaId ? 'selected' : ''}>${esc(p.nome || 'Prancha')}</option>`).join('')}
          </select>
          <button id="ce-btn-circulo" class="btn ${modo === 'circulo' ? 'btn-primario' : 'btn-secundario'} btn-sm" data-perm="controleEstacas:criar:marcador" style="${view !== 'estacas' ? 'display:none;' : ''}" onclick="CE.iniciarAdicionarCirculo()">◯ Adicionar Estaca</button>
          <button id="ce-btn-poligono" class="btn ${modo === 'poligono' ? 'btn-primario' : 'btn-secundario'} btn-sm" data-perm="controleEstacas:criar:marcador" style="${view !== 'fundacoes' ? 'display:none;' : ''}" onclick="CE.iniciarAdicionarPoligono()">▱ Adicionar Fundação</button>
          <button class="btn btn-secundario btn-sm" data-perm="controleEstacas:editar:prancha" onclick="CE.girarPrancha()">⟳ Girar 90°</button>
          <span style="display:flex;gap:2px;align-items:center;margin-left:auto;">
            <button class="btn btn-secundario btn-sm" onclick="CE.zoomAjustar(-0.25)">−</button>
            <span class="text-sm text-muted" id="ce-zoom-label" style="width:48px;text-align:center;">${Math.round(zoomE * 100)}%</span>
            <button class="btn btn-secundario btn-sm" onclick="CE.zoomAjustar(0.25)">+</button>
          </span>
        </div>
        <div id="ce-mapa-host"></div>
      </div>

      ${painelMinimizado ? '' : `
      <div class="cc-panel">
        <div class="cc-panelTitle">◈ ${view === 'estacas' ? 'Estacas' : 'Fundações'} desta prancha</div>
        <div id="ce-tabela"></div>
      </div>`}
    `;
    await renderMapa();
    reporScroll();
    renderTabela();
    Permissions.aplicarNaTela();
  }

  function onTrocarView(v) {
    pranchaAtivaPorView[view] = pranchaAtivaId; // guarda a prancha da view que está saindo
    view = v;
    pranchaAtivaId = pranchaAtivaPorView[v] || null;
    const listaView = pranchasOrdenadas();
    if (!pranchaAtivaId || !listaView.some(p => p.id === pranchaAtivaId)) pranchaAtivaId = listaView[0]?.id || null;
    pranchaAtivaPorView[v] = pranchaAtivaId;
    modo = null; poligonoPontos = []; editandoFormaId = null;
    // A concretagem selecionada no Acompanhamento pode não pertencer mais à
    // view nova (lista agora filtrada por tipo de peça) — solta a seleção
    // pra não ficar mostrando dado de uma concretagem que nem aparece na lista.
    if (acompConcretagemId && !_concretagemTemPecaDaView(acompConcretagemId)) acompConcretagemId = null;
    planFocoConcretagemId = null; // foco de "atribuição rápida" do Planejamento — sempre solta ao trocar view
    if (abaPrincipal === 'planejamento') _renderAbaPlanejamento();
    else if (abaPrincipal === 'acompanhamento') _renderAbaAcompanhamento();
    else renderizar();
  }
  function onTrocarPranchaAtiva() {
    pranchaAtivaId = document.getElementById('ce-prancha-ativa').value || null;
    pranchaAtivaPorView[view] = pranchaAtivaId;
    modo = null; poligonoPontos = []; editandoFormaId = null;
    renderizar();
  }
  // ── Qual mapa está na tela agora (as 3 abas usam o mesmo componente) ──
  function _stageIdDaAba() {
    if (abaPrincipal === 'planejamento') return 'ce-plan-stage';
    if (abaPrincipal === 'acompanhamento') return 'ce-acomp-stage';
    return 'ce-stage';
  }
  function _hostDaAba() {
    if (abaPrincipal === 'planejamento') return '#ce-plan-mapa-host';
    if (abaPrincipal === 'acompanhamento') return '#ce-acomp-mapa-host';
    return '#ce-mapa-host';
  }

  // Ponto da tela que o próximo re-render deve manter FIXO ao mudar o zoom.
  // {x, y} em px relativos à borda visível do container de scroll.
  let _ancoraZoom = null;

  function _ancoraDe(ponto, zoomAntigo) {
    const el = document.querySelector(_hostDaAba() + ' .est-map-scroll');
    if (!el) return null;
    // Sem ponto informado (botões +/− e atalhos): ancora no CENTRO do que
    // está visível. Antes ancorava implicitamente na origem do stage, então o
    // zoom pelos botões também jogava a vista pro canto superior esquerdo.
    if (ponto) return { x: ponto.x, y: ponto.y, zoomAntigo };
    return { x: el.clientWidth / 2, y: el.clientHeight / 2, zoomAntigo };
  }

  // Captura o scroll antes de trocar o innerHTML do mapa e devolve a função
  // que o repõe depois. Quando o zoom mudou, o valor antigo NÃO serve (aponta
  // pra outro ponto da imagem, que agora tem outro tamanho) — aí recalcula com
  // EC.zoomAncorado pra manter fixo o ponto de _ancoraZoom.
  function _preservarScroll(hostSel) {
    const anc = _ancoraZoom; _ancoraZoom = null;
    const el = document.querySelector(hostSel + ' .est-map-scroll');
    if (!el) return () => {};
    const pos = { left: el.scrollLeft, top: el.scrollTop };
    return () => {
      const novo = document.querySelector(hostSel + ' .est-map-scroll');
      if (!novo) return;
      if (!anc) { novo.scrollLeft = pos.left; novo.scrollTop = pos.top; return; }
      const r = EC.zoomAncorado({
        scrollLeft: pos.left, scrollTop: pos.top,
        anchorX: anc.x, anchorY: anc.y,
        zoomAntigo: anc.zoomAntigo, zoomNovo: zoomE,
        maxLeft: novo.scrollWidth - novo.clientWidth,
        maxTop: novo.scrollHeight - novo.clientHeight,
      });
      novo.scrollLeft = r.left; novo.scrollTop = r.top;
    };
  }

  // ancora: {x,y} em px relativos à borda visível do mapa (dedo/cursor).
  // Omitido → centro da vista.
  function zoomAjustar(delta, ancora) {
    const zoomAntes = zoomE;
    zoomE = Math.min(4, Math.max(0.25, +(zoomE + delta).toFixed(2)));
    if (zoomE === zoomAntes) return; // já no limite — não re-renderiza à toa
    _ancoraZoom = _ancoraDe(ancora, zoomAntes);
    _atualizarLabelZoom();
    _rerenderMapaDaAba();
  }

  // O label do zoom existe nas 3 abas (Marcadores tem id, Planejamento e
  // Acompanhamento têm a classe). Antes só o id era atualizado, então durante
  // o pinch nas duas abas que o usuário mais usa o número ficava congelado.
  function _atualizarLabelZoomTexto(texto) {
    document.querySelectorAll('#ce-zoom-label, .ce-zoom-label').forEach(el => { el.textContent = texto; });
  }
  function _atualizarLabelZoom() { _atualizarLabelZoomTexto(Math.round(zoomE * 100) + '%'); }

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
  // Uma concretagem "pertence" à view atual se tiver pelo menos 1 peça
  // planejada do tipo certo (Estacas OU Fundações). Os números continuam
  // num sequencial ÚNICO pra obra inteira (igual ao Controle de Concreto)
  // — isso aqui é só filtro de EXIBIÇÃO, pra não misturar as listas na tela.
  function _concretagemTemPecaDaView(concId) {
    return _pecaConcDaConcretagem(concId).some(pc => {
      const p = pecas.find(x => x.id === pc.pecaId);
      return p && (view === 'estacas' ? p.subTipo === 'Estacas' : p.subTipo !== 'Estacas');
    });
  }
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
      const chave = p.diametro ? `⌀${EC.num(p.diametro)}cm${p.comprimento ? ' × ' + EC.num(p.comprimento) + 'm' : ''}` : (p.subTipo || 'sem tipo');
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
    const reporScroll = _preservarScroll('#ce-plan-mapa-host');
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
          <span class="text-sm text-muted">nº no marcador = concretagem já atribuída · sem número = ainda não planejada · com uma concretagem em foco (📌), mostra só o número dela</span>
        </div>
        ${_legendaGrupos()}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0;align-items:center;">
          <button class="btn btn-secundario btn-sm" onclick="CE.girarPrancha()">⟳ Girar 90°</button>
          <span style="display:flex;gap:2px;align-items:center;margin-left:auto;">
            <button class="btn btn-secundario btn-sm" onclick="CE.zoomAjustar(-0.25)">−</button>
            <span class="text-sm text-muted ce-zoom-label" style="width:48px;text-align:center;">${Math.round(zoomE * 100)}%</span>
            <button class="btn btn-secundario btn-sm" onclick="CE.zoomAjustar(0.25)">+</button>
          </span>
        </div>`}
        <div id="ce-plan-mapa-host"></div>
      </div>
      ${painelMinimizado ? '' : `
      <div class="cc-panel">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
          <div class="cc-panelTitle" style="margin:0;">📅 Concretagens planejadas</div>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-secundario btn-sm" title="Corrige lançamentos que ficaram presos numa concretagem diferente da atual (ex: depois de reatribuir uma peça)" onclick="CE.corrigirLancamentosDesalinhados()">🔧 Corrigir desalinhados</button>
            <button class="btn btn-secundario btn-sm" onclick="CE.toggleNovaConcPlan()">${novaConcPlanAberta ? '✕ Cancelar' : '+ Nova concretagem'}</button>
          </div>
        </div>
        <div id="ce-plan-cards-body"></div>
      </div>` }
    `;
    _renderCardsConcretagem();
    Permissions.aplicarNaTela();
    await renderMapaPlanejamento();
    reporScroll();
  }

  function _renderCardsConcretagem() {
    const el = document.getElementById('ce-plan-cards-body');
    if (!el) return;
    // Mostra concretagens com peça da view atual, MAIS as recém-criadas sem
    // nenhuma peça ainda (senão o card some assim que é criado, antes de
    // clicar na 1ª peça) — só esconde as que já são 100% da OUTRA view.
    const concsOrd = [...concretagens].filter(c => !_pecaConcDaConcretagem(c.id).length || _concretagemTemPecaDaView(c.id)).sort((a, b) => (a.numero || 0) - (b.numero || 0));
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
            const editando = concEditandoId === c.id;
            return `
              <div id="ce-card-conc-${c.id}" style="border:1.5px solid ${focado ? 'var(--cor-primaria)' : 'var(--cv-border,#e2e8f0)'};background:${focado ? 'var(--cv-surface2,#eff6ff)' : 'transparent'};border-radius:8px;padding:10px 14px;">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;cursor:pointer;" onclick="CE.focarConcretagemPlan('${c.id}')" title="Clique pra selecionar/desmarcar — com uma selecionada, clique nas peças no desenho já atribui direto">
                  <div style="font-weight:700;">${focado ? '📌 ' : ''}Concretagem Nº ${c.numero}${c.data ? ` <span style="font-weight:400;color:var(--cv-text3,#94a3b8);font-size:.8rem;">${_dataBR(c.data)}</span>` : ' <span style="font-weight:400;color:var(--cv-red,#ef4444);font-size:.8rem;">sem data</span>'}</div>
                  <div style="display:flex;align-items:center;gap:8px;">
                    <div class="text-sm text-muted">${listaPecas.length} peça${listaPecas.length !== 1 ? 's' : ''} · ${EC.fmt1(_volumePlanejado(c.id))} m³</div>
                    <button class="btn btn-secundario btn-sm" style="padding:2px 6px;" onclick="event.stopPropagation();CE.toggleEditarConc('${c.id}')" title="Editar número/data/descrição">✎</button>
                  </div>
                </div>
                ${editando ? `
                  <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-top:10px;padding-top:10px;border-top:1px dashed var(--cv-border,#e2e8f0);" onclick="event.stopPropagation();">
                    <div><label class="text-sm text-muted" style="display:block;">Nº</label><input type="number" id="ce-edit-conc-num-${c.id}" class="form-control" style="width:80px;" value="${c.numero}"></div>
                    <div><label class="text-sm text-muted" style="display:block;">Data</label><input type="date" id="ce-edit-conc-data-${c.id}" class="form-control" value="${c.data || ''}"></div>
                    <div style="flex:1;min-width:160px;"><label class="text-sm text-muted" style="display:block;">Descrição</label><input type="text" id="ce-edit-conc-desc-${c.id}" class="form-control" value="${esc(c.descricao || '')}"></div>
                    <button class="btn btn-secundario btn-sm" onclick="CE.toggleEditarConc('${c.id}')">Cancelar</button>
                    <button class="btn btn-primario btn-sm" onclick="CE.salvarEdicaoConc('${c.id}')">✓ Salvar</button>
                  </div>` : ''}
                ${resumo.length ? `<div style="margin-top:8px;">${_resumoDiamHTML(resumo)}</div>` : ''}
              </div>`;
          }).join('')}
        </div>`}
    `;
  }

  function _dataBR(iso) {
    if (!iso) return '';
    const [ano, mes, dia] = iso.split('-');
    return dia && mes && ano ? `${dia}/${mes}/${ano}` : iso;
  }

  function toggleEditarConc(id) {
    concEditandoId = concEditandoId === id ? null : id;
    _renderCardsConcretagem();
  }

  async function salvarEdicaoConc(id) {
    if (!Permissions.pode('controleEstacas', 'editar:concretagem')) { Utils.toast('Sem permissão para editar.', 'erro'); return; }
    const numero = parseInt(document.getElementById(`ce-edit-conc-num-${id}`).value) || 0;
    const data = document.getElementById(`ce-edit-conc-data-${id}`).value || '';
    const descricao = (document.getElementById(`ce-edit-conc-desc-${id}`).value || '').trim();
    if (!numero) { Utils.toast('Informe o número da concretagem.', 'alerta'); return; }
    const conflito = concretagens.find(c => c.numero === numero && c.id !== id);
    if (conflito) { Utils.toast(`Já existe a Concretagem Nº ${numero} — escolha outro número.`, 'alerta'); return; }
    Utils.mostrarLoading();
    try {
      await Database.atualizar(obraId, COL_CONCS, id, { numero, data, descricao });
      const c = concretagens.find(x => x.id === id);
      if (c) Object.assign(c, { numero, data, descricao });
      concEditandoId = null;
      _renderCardsConcretagem();
      Utils.toast('✓ Concretagem atualizada!', 'sucesso');
    } catch (e) {
      Utils.toast('Erro ao salvar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  function toggleNovaConcPlan() {
    novaConcPlanAberta = !novaConcPlanAberta;
    _renderCardsConcretagem();
  }

  async function criarConcretagemPlan() {
    if (!Permissions.pode('controleEstacas', 'criar:concretagem')) { Utils.toast('Sem permissão para criar.', 'erro'); return; }
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
  const _pecasEmProcessamento = new Set(); // trava por peça — evita clique duplo/corrida na MESMA peça

  async function _atribuirRapidoFoco(m) {
    if (!Permissions.pode('controleEstacas', 'editar:concretagem') && !Permissions.pode('controleEstacas', 'criar:concretagem')) { Utils.toast('Sem permissão.', 'erro'); return; }
    if (_pecasEmProcessamento.has(m.pecaId)) return; // já processando essa mesma peça — ignora repetição
    _pecasEmProcessamento.add(m.pecaId);
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
        // Lançamentos já feitos pra essa peça, presos numa concretagem
        // DIFERENTE — reatribui junto, senão o relatório mostra a peça no
        // dia/concretagem errado (mesmo bug do popup de atribuir).
        const lansDaPeca = lancamentos.filter(l => l.pecaId === m.pecaId && l.concretagemId !== concId);
        if (lansDaPeca.length) {
          const ops = lansDaPeca.map(l => ({ type: 'update', ref: Database.ref(obraId, COL_LANS).doc(l.id), data: { concretagemId: concId } }));
          await Database.batchWrite(ops);
          lansDaPeca.forEach(l => { l.concretagemId = concId; });
        }
      }
      await renderMapaPlanejamento(); // só o mapa — preserva scroll/zoom pro próximo clique
      _renderCardsConcretagem(); // números dos cards (qtd/volume/diâmetro) atualizados
    } catch (e) {
      Utils.toast('Erro: ' + e.message, 'erro');
    } finally {
      _pecasEmProcessamento.delete(m.pecaId);
    }
  }

  async function renderMapaPlanejamento() {
    const host = document.getElementById('ce-plan-mapa-host');
    if (!host) return;
    const pr = pranchaAtiva();
    if (!pr) { host.innerHTML = `<div class="cc-empty">Nenhuma prancha ainda — vá na aba Marcadores e importe o projeto.</div>`; return; }
    const imagem = await _obterImagemPrancha(pr.id);
    if (!imagem) { host.innerHTML = `<div class="cc-empty">Esta prancha ainda não tem PDF/imagem — importe na aba Marcadores.</div>`; return; }
    const lista = marcadoresDaPranchaView(pr.id).filter(m => m.pecaId); // só marcadores já vinculados podem ser planejados — mostra TODAS, de qualquer concretagem
    const reporScroll = _preservarScroll('#ce-plan-mapa-host');
    host.innerHTML = EC.stageHTML(pr, imagem, lista, statusMarcador, { interativo: true, zoom: zoomE, stageId: 'ce-plan-stage', maxHeight: _alturaMapa() });
    reporScroll();
    _desenharNumerosConcretagem('ce-plan-stage', lista, planFocoConcretagemId, false);
    _ligarEventosToggle('ce-plan-stage', lista, m => planFocoConcretagemId ? _atribuirRapidoFoco(m) : abrirAtribuirConcretagem(m));
  }

  // Escreve o número da concretagem (se já atribuída) em cima de cada
  // marcador — por padrão só na concretagem ATUAL (foco/selecionada), pra
  // não poluir com número de todo mundo; "Mostrar números de todas" (botão)
  // exibe todas de uma vez. Sem nenhuma concretagem atual definida, mostra
  // todas (não tem o que restringir).
  function _desenharNumerosConcretagem(stageId, lista, concretagemAtualId, forcarTodas) {
    const stage = document.getElementById(stageId);
    if (!stage) return;
    const cont = document.createElement('div');
    cont.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:6;';
    lista.forEach(m => {
      const c = _concretagemDaPeca(m.pecaId);
      if (!c) return;
      if (!forcarTodas && concretagemAtualId && c.id !== concretagemAtualId) return;
      // Uma bolha por pedaço da área (m.pontos + m.partesExtras) — cada
      // pedaço aparece marcado no plano, mesmo sendo a mesma peça/concretagem.
      const centros = m.tipo === 'circulo' ? [{ x: m.cx, y: m.cy }] : EC.partesPoligono(m).map(_centroide).filter(Boolean);
      centros.forEach(centro => {
        const bolha = document.createElement('div');
        bolha.style.cssText = `position:absolute;left:${(centro.x * 100).toFixed(3)}%;top:${(centro.y * 100).toFixed(3)}%;transform:translate(-50%,-50%);background:#1e293b;color:#fff;font-size:10px;font-weight:700;padding:1px 5px;border-radius:100px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.4);`;
        bolha.textContent = c.numero;
        cont.appendChild(bolha);
      });
    });
    stage.appendChild(cont);
  }

  function toggleMostrarTodosNumeros() {
    mostrarTodosNumeros = !mostrarTodosNumeros;
    _renderAbaAtual();
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
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <input type="number" id="ce-atribuir-numero" class="form-control" style="width:100px;" value="${_proximoNumeroConc()}">
          <input type="date" id="ce-atribuir-data" class="form-control" style="width:150px;" value="${new Date().toISOString().slice(0, 10)}" title="Data — só é usada se o número acima for novo (vai criar a concretagem já com essa data)">
          <button class="btn btn-primario btn-sm" onclick="CE.atribuirConcretagemNumeroInput()">Atribuir</button>
        </div>
        <span class="text-sm text-muted">A data só é usada se o número acima ainda não existir (vai criar a concretagem com essa data, em vez de hoje). Atribuindo a um número já existente, a data dele não muda.</span>
      </div>
      ${atual ? `<button class="btn btn-secundario btn-sm" style="color:var(--cv-red,#ef4444);margin-top:6px;" onclick="CE.removerDaConcretagem()">🗑 Remover desta concretagem</button>` : ''}
    `;
  }
  function atribuirConcretagemNumeroInput() {
    const numero = parseInt(document.getElementById('ce-atribuir-numero').value) || null;
    if (!numero) { Utils.toast('Digite um número válido.', 'alerta'); return; }
    const data = document.getElementById('ce-atribuir-data')?.value || new Date().toISOString().slice(0, 10);
    atribuirConcretagemNumero(numero, data);
  }
  // Corrige em massa lançamentos "presos" numa concretagem diferente da que
  // o planejamento (pecaConc) diz hoje — cobre peças que já ficaram
  // desalinhadas ANTES do fix de reatribuição (V3.19.30.49), sem precisar
  // reatribuir peça por peça na mão.
  let _planoCorrecao = null; // guarda o diagnóstico calculado, pra "aplicar" usar exatamente o que foi mostrado

  function _rotuloConc(concId) {
    const c = concretagens.find(x => x.id === concId);
    if (!c) return 'sem concretagem';
    return `Nº ${c.numero}${c.data ? ' — ' + _dataBR(c.data) : ' — sem data'}`;
  }

  async function corrigirLancamentosDesalinhados() {
    if (!Permissions.pode('controleEstacas', 'editar:concretagem')) { Utils.toast('Sem permissão.', 'erro'); return; }
    // 1) Peça com MAIS DE UM planejamento (pecaConc) ao mesmo tempo — provável
    // causa real de aparecer em 2 dias no relatório (clique duplo/corrida
    // numa reatribuição antiga). A concretagem "certa" escolhida é a de MAIOR
    // número (a atribuição mais recente) — mostrado explicitamente abaixo,
    // pra conferir antes de aplicar, não é uma caixa preta.
    const porPeca = new Map();
    pecaConc.forEach(pc => { if (!porPeca.has(pc.pecaId)) porPeca.set(pc.pecaId, []); porPeca.get(pc.pecaId).push(pc); });
    const duplicados = []; // {pecaId, pecaNome, manter:{id,concretagemId}, remover:[{id,concretagemId}]}
    const concertoFinal = new Map(); // pecaId -> concretagemId definitiva
    porPeca.forEach((linhas, pecaId) => {
      if (linhas.length <= 1) { concertoFinal.set(pecaId, linhas[0]?.concretagemId); return; }
      const comConc = linhas.map(l => ({ pc: l, num: concretagens.find(c => c.id === l.concretagemId)?.numero || 0 }));
      comConc.sort((a, b) => b.num - a.num);
      const manter = comConc[0].pc;
      duplicados.push({ pecaId, pecaNome: pecas.find(p => p.id === pecaId)?.nome || pecaId, manter, remover: comConc.slice(1).map(x => x.pc) });
      concertoFinal.set(pecaId, manter.concretagemId);
    });

    // 2) Lançamentos apontando pra concretagem diferente do planejamento
    // definitivo (já considerando a limpeza de duplicados acima).
    const desalinhados = []; // {lancamento, pecaNome, de, para}
    lancamentos.forEach(l => {
      const certa = concertoFinal.get(l.pecaId);
      if (certa && l.concretagemId !== certa) desalinhados.push({ lancamento: l, pecaNome: pecas.find(p => p.id === l.pecaId)?.nome || l.pecaId, de: l.concretagemId, para: certa });
    });

    if (!duplicados.length && !desalinhados.length) { Utils.toast('✓ Nada desalinhado — tudo certo.', 'sucesso'); return; }

    _planoCorrecao = { duplicados, desalinhados };
    const el = document.getElementById('ce-corrigir-body');
    if (el) {
      el.innerHTML = `
        <div class="text-sm text-muted" style="margin-bottom:12px;">Confira o "de → para" de cada item antes de aplicar. Nada é alterado até você clicar em "Aplicar correção".</div>
        ${duplicados.length ? `
          <div style="font-weight:700;margin-bottom:6px;">📋 Planejamento duplicado (${duplicados.length} peça${duplicados.length !== 1 ? 's' : ''})</div>
          <div style="margin-bottom:16px;">
            ${duplicados.map(d => `
              <div style="border:1px solid var(--cv-border,#e2e8f0);border-radius:8px;padding:8px 12px;margin-bottom:6px;">
                <div style="font-weight:700;">${esc(d.pecaNome)}</div>
                <div class="text-sm" style="color:#15803d;">✓ Mantém: ${_rotuloConc(d.manter.concretagemId)}</div>
                ${d.remover.map(r => `<div class="text-sm" style="color:var(--cv-red,#ef4444);">✕ Remove duplicata: ${_rotuloConc(r.concretagemId)}</div>`).join('')}
              </div>`).join('')}
          </div>` : ''}
        ${desalinhados.length ? `
          <div style="font-weight:700;margin-bottom:6px;">🚚 Lançamentos fora do lugar (${desalinhados.length})</div>
          <div>
            ${desalinhados.map(d => `
              <div style="border:1px solid var(--cv-border,#e2e8f0);border-radius:8px;padding:8px 12px;margin-bottom:6px;">
                <div style="font-weight:700;">${esc(d.pecaNome)}</div>
                <div class="text-sm">De: <span style="color:var(--cv-red,#ef4444);">${_rotuloConc(d.de)}</span> → Para: <span style="color:#15803d;font-weight:700;">${_rotuloConc(d.para)}</span></div>
              </div>`).join('')}
          </div>` : ''}
      `;
    }
    Utils.abrirModal('modal-ce-corrigir');
  }

  async function aplicarCorrecaoDesalinhados() {
    if (!_planoCorrecao) return;
    const { duplicados, desalinhados } = _planoCorrecao;
    Utils.mostrarLoading();
    try {
      const opsDuplicadas = duplicados.flatMap(d => d.remover.map(r => ({ type: 'delete', ref: Database.ref(obraId, COL_PC).doc(r.id) })));
      const opsLancamentos = desalinhados.map(d => ({ type: 'update', ref: Database.ref(obraId, COL_LANS).doc(d.lancamento.id), data: { concretagemId: d.para } }));
      // batchWrite tem limite por lote — quebra em pedaços de 400 se precisar.
      const todasOps = [...opsDuplicadas, ...opsLancamentos];
      for (let i = 0; i < todasOps.length; i += 400) await Database.batchWrite(todasOps.slice(i, i + 400));
      await carregar();
      await EstacasCalculos.sincronizarVinculosPlanejamento(obraId).catch(e => console.error('Sync Planejamento:', e));
      _renderCardsConcretagem();
      Utils.fecharModal('modal-ce-corrigir');
      _planoCorrecao = null;
      Utils.toast(`✓ Corrigido! ${opsDuplicadas.length ? opsDuplicadas.length + ' planejamento(s) duplicado(s) removido(s), ' : ''}${opsLancamentos.length} lançamento(s) realinhado(s).`, 'sucesso');
    } catch (e) {
      Utils.toast('Erro ao corrigir: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  let _atribuindoConcretagem = false; // trava clique duplo/corrida — era a provável causa real de planejamento duplicado

  async function atribuirConcretagemNumero(numero, dataNova) {
    if (!Permissions.pode('controleEstacas', 'editar:concretagem') && !Permissions.pode('controleEstacas', 'criar:concretagem')) { Utils.toast('Sem permissão.', 'erro'); return; }
    if (_atribuindoConcretagem) return; // já está processando um clique — ignora repetição
    const m = marcadores.find(x => x.id === atribuirMarcadorId);
    if (!m) return;
    _atribuindoConcretagem = true;
    Utils.mostrarLoading();
    try {
      const concExistente = concretagens.find(c => c.numero === numero);
      const criouNova = !concExistente;
      const data = dataNova || new Date().toISOString().slice(0, 10);
      const concId = concExistente ? concExistente.id : await Database.criar(obraId, COL_CONCS, { numero, data, descricao: '', obraId }, EC.genId('conc'));
      const existente = pecaConc.find(pc => pc.pecaId === m.pecaId);
      if (existente) await Database.deletar(obraId, COL_PC, existente.id);
      await Database.criar(obraId, COL_PC, { pecaId: m.pecaId, concretagemId: concId, pctConcretagem: 100, obraId }, EC.genId('pc'));
      // Se essa peça já tinha lançamento(s) registrado(s), eles ficavam
      // presos na concretagem ANTIGA — divergindo do planejamento atual (é
      // esse o bug real: o relatório mostrava a peça no dia/concretagem
      // errado). Reatribui os lançamentos também, pra ficar tudo junto.
      const lansDaPeca = lancamentos.filter(l => l.pecaId === m.pecaId && l.concretagemId !== concId);
      if (lansDaPeca.length) {
        const ops = lansDaPeca.map(l => ({ type: 'update', ref: Database.ref(obraId, COL_LANS).doc(l.id), data: { concretagemId: concId } }));
        await Database.batchWrite(ops);
      }
      await carregar();
      Utils.fecharModal('modal-ce-atribuir-conc');
      _renderAbaPlanejamento();
      if (criouNova) Utils.toast(`✓ Concretagem Nº ${numero} criada com data ${_dataBR(data)}!`, 'sucesso');
      else Utils.toast(`✓ Atribuída à Concretagem Nº ${numero}!${lansDaPeca.length ? ` (${lansDaPeca.length} lançamento(s) movido(s) junto)` : ''}`, 'sucesso');
    } catch (e) {
      Utils.toast('Erro: ' + e.message, 'erro');
    } finally {
      _atribuindoConcretagem = false;
      Utils.esconderLoading();
    }
  }
  async function removerDaConcretagem() {
    const m = marcadores.find(x => x.id === atribuirMarcadorId);
    if (!m) return;
    const existente = pecaConc.find(pc => pc.pecaId === m.pecaId);
    if (!existente) return;
    const temLancamento = lancamentos.some(l => l.pecaId === m.pecaId);
    if (temLancamento) {
      const ok = await Utils.confirmar('Essa peça já tem lançamento (BT) registrado nessa concretagem. Remover só tira o planejamento — o lançamento continua salvo, mas fica sem concretagem vinculada. Quer continuar?');
      if (!ok) return;
    }
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
  // peças da view atual (por diâmetro se Estacas, por tipo se Fundações),
  // % feita de cada grupo, e % geral da obra NAQUELA view.
  function _resumoObraView() {
    const todas = pecasElegiveis();
    const grupos = new Map();
    let volTotal = 0, volFeito = 0, qtdFeitas = 0;
    const idsTodas = new Set(todas.map(p => p.id));
    todas.forEach(p => {
      const pct = ConcretoCalculos.pctConcretado(p, lancamentos);
      const chave = p.diametro ? `⌀${EC.num(p.diametro)}cm${p.comprimento ? ' × ' + EC.num(p.comprimento) + 'm' : ''}` : (p.subTipo || 'sem tipo');
      if (!grupos.has(chave)) grupos.set(chave, { qtd: 0, qtdFeita: 0, volume: 0, volumeFeito: 0 });
      const g = grupos.get(chave);
      g.qtd++; g.volume += p.volume || 0; g.volumeFeito += (p.volume || 0) * (pct / 100);
      if (pct >= 100) { g.qtdFeita++; qtdFeitas++; }
      volTotal += p.volume || 0; volFeito += (p.volume || 0) * (pct / 100);
    });
    // Dias trabalhados = dias distintos (concretagem.data) com pelo menos 1
    // lançamento destas peças. m³/dia = ritmo médio nesses dias. Previsão =
    // hoje + dias restantes no ritmo atual (é aqui em Acompanhamento que a
    // execução de verdade acontece — não faz sentido calcular isso na aba
    // Marcadores, que é só desenho/vínculo).
    const concPorId = new Map(concretagens.map(c => [c.id, c]));
    const diasComLancamento = new Set();
    lancamentos.forEach(l => {
      if (!idsTodas.has(l.pecaId)) return;
      const c = concPorId.get(l.concretagemId);
      if (c && c.data) diasComLancamento.add(c.data);
    });
    const diasTrabalhados = diasComLancamento.size;
    const m3PorDia = diasTrabalhados > 0 ? volFeito / diasTrabalhados : 0;
    const volFaltando = Math.max(0, volTotal - volFeito);
    let previsaoTxt = '—';
    if (m3PorDia > 0 && volFaltando > 0) {
      const dataFim = new Date();
      dataFim.setDate(dataFim.getDate() + Math.ceil(volFaltando / m3PorDia));
      previsaoTxt = dataFim.toLocaleDateString('pt-BR');
    } else if (volFaltando <= 0 && todas.length > 0) {
      previsaoTxt = '✅ Concluído';
    }
    return {
      grupos: [...grupos.entries()], volTotal, volFeito, qtdTotal: todas.length, qtdFeitas,
      pctObra: volTotal > 0 ? (volFeito / volTotal * 100) : 0,
      pctPorQuantidade: todas.length > 0 ? (qtdFeitas / todas.length * 100) : 0,
      diasTrabalhados, m3PorDia, previsaoTxt,
    };
  }

  async function _renderAbaAcompanhamento() {
    const el = document.getElementById('ce-aba-body');
    if (!el) return;
    const reporScroll = _preservarScroll('#ce-acomp-mapa-host');
    // Só concretagens com ao menos 1 peça planejada fazem sentido aqui
    const concsComPlano = [...concretagens].filter(c => _concretagemTemPecaDaView(c.id)).sort((a, b) => (a.numero || 0) - (b.numero || 0));
    const listaPecas = acompConcretagemId ? _pecasPlanejadas(acompConcretagemId) : [];
    const executadas = listaPecas.filter(_pecaExecutada);
    const pendentes = listaPecas.filter(p => !_pecaExecutada(p));
    const resumoObra = _resumoObraView();
    const resumoVol = acompConcretagemId ? _resumoVolumesConcretagem(acompConcretagemId) : null;
    const qtdBTs = acompConcretagemId ? _btsDaConcretagem(acompConcretagemId).length : 0;
    el.innerHTML = `
      <div class="cc-panel">
        <div style="display:flex;justify-content:flex-end;margin-bottom:${painelMinimizado ? '0' : '4px'};">
          <button class="btn btn-secundario btn-sm" onclick="CE.toggleMinimizarPainel()">${painelMinimizado ? '▼ Mostrar controles' : '▲ Minimizar'}</button>
        </div>
        ${painelMinimizado ? '' : `
        <div class="cc-panelTitle">✅ Acompanhamento — clique numa estaca/fundação no mapa pra lançar</div>
        `}
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px;">
          <select class="form-control" id="ce-acomp-conc" style="max-width:280px;" onchange="CE.onTrocarAcompConcretagem()">
            <option value="">— Selecione uma concretagem —</option>
            ${concsComPlano.map(c => `<option value="${c.id}" ${c.id === acompConcretagemId ? 'selected' : ''}>${esc(_concLabel(c))}</option>`).join('')}
          </select>
          ${!concsComPlano.length ? '<span class="text-sm text-muted">Nenhuma concretagem com peças planejadas ainda — vá em Planejamento primeiro.</span>' : ''}
          ${acompConcretagemId ? `<button class="btn btn-secundario btn-sm" onclick="CE.abrirModalBTs()">🚚 ${qtdBTs} BT${qtdBTs !== 1 ? 's' : ''} nesta concretagem</button>` : ''}
        </div>
        ${!painelMinimizado && acompConcretagemId ? `
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:4px;">
            <div class="aba-toggle">
              <button class="aba-btn ${view === 'estacas' ? 'ativo' : ''}" onclick="CE.onTrocarView('estacas')">⚫ Estacas</button>
              <button class="aba-btn ${view === 'fundacoes' ? 'ativo' : ''}" onclick="CE.onTrocarView('fundacoes')">⬛ Fundações</button>
            </div>
            <span class="text-sm text-muted">🟢 concretado · 🟠 parcial · 🟡 anel = planejada, ainda pendente · nº no marcador = concretagem dela</span>
          </div>
          ${_legendaGrupos()}
          <div style="display:flex;gap:8px;align-items:center;justify-content:flex-end;margin:6px 0;flex-wrap:wrap;">
            <button class="btn ${mostrarTodosNumeros ? 'btn-primario' : 'btn-secundario'} btn-sm" onclick="CE.toggleMostrarTodosNumeros()">🔢 ${mostrarTodosNumeros ? 'Mostrando números de todas' : 'Mostrar números de todas'}</button>
            <span style="display:flex;gap:2px;align-items:center;">
            <button class="btn btn-secundario btn-sm" onclick="CE.zoomAjustar(-0.25)">−</button>
            <span class="text-sm text-muted ce-zoom-label" style="width:48px;text-align:center;">${Math.round(zoomE * 100)}%</span>
            <button class="btn btn-secundario btn-sm" onclick="CE.zoomAjustar(0.25)">+</button>
            </span>
          </div>
        ` : ''}
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
              <div class="text-sm" style="font-weight:700;margin-bottom:6px;">✅ Executado ${view === 'estacas' ? 'por diâmetro' : 'por tipo'} (concretagem)</div>
              ${_resumoDiamHTML(_resumoDiamDeLista(executadas))}
            </div>
            <div style="flex:1;min-width:220px;">
              <div class="text-sm" style="font-weight:700;margin-bottom:6px;">⏳ Faltando ${view === 'estacas' ? 'por diâmetro' : 'por tipo'} (concretagem)</div>
              ${_resumoDiamHTML(_resumoDiamDeLista(pendentes))}
            </div>
          </div>
        ` : ''}
      </div>
      ${painelMinimizado ? '' : `
      <div class="cc-panel">
        <div class="cc-panelTitle">📊 ${view === 'estacas' ? 'Estacas' : 'Fundações'} da obra — visão geral</div>
        <div class="cc-kpiGrid" style="grid-template-columns:repeat(3,1fr);margin-bottom:10px;">
          <div class="cc-kpi"><div class="cc-kpiIcon">${view === 'estacas' ? '⚫' : '⬛'}</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Total / feitas</div><div class="cc-kpiValue">${resumoObra.qtdFeitas}<span class="cc-kpiUnit">/ ${resumoObra.qtdTotal}</span></div></div></div>
          <div class="cc-kpi cc-kpiGreen"><div class="cc-kpiIcon">✅</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Volume executado</div><div class="cc-kpiValue">${EC.fmt1(resumoObra.volFeito)}<span class="cc-kpiUnit">/ ${EC.fmt1(resumoObra.volTotal)} m³</span></div></div></div>
          <div class="cc-kpi cc-kpiOrange"><div class="cc-kpiIcon">📈</div><div class="cc-kpiBody"><div class="cc-kpiLabel">% executado (por quantidade)</div><div class="cc-kpiValue">${EC.fmt1(resumoObra.pctPorQuantidade)}<span class="cc-kpiUnit">%</span></div></div></div>
        </div>
        <div class="cc-kpiGrid" style="grid-template-columns:repeat(3,1fr);margin-bottom:14px;">
          <div class="cc-kpi cc-kpiOrange"><div class="cc-kpiIcon">📐</div><div class="cc-kpiBody"><div class="cc-kpiLabel">% executado (por m³)</div><div class="cc-kpiValue">${EC.fmt1(resumoObra.pctObra)}<span class="cc-kpiUnit">%</span></div></div></div>
          <div class="cc-kpi"><div class="cc-kpiIcon">🚚</div><div class="cc-kpiBody"><div class="cc-kpiLabel">m³/dia (${resumoObra.diasTrabalhados} dia${resumoObra.diasTrabalhados !== 1 ? 's' : ''} trabalhado${resumoObra.diasTrabalhados !== 1 ? 's' : ''})</div><div class="cc-kpiValue">${EC.fmt1(resumoObra.m3PorDia)}</div></div></div>
          <div class="cc-kpi"><div class="cc-kpiIcon">🏁</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Previsão de fim (no ritmo atual)</div><div class="cc-kpiValue" style="font-size:1.1rem;">${resumoObra.previsaoTxt}</div></div></div>
        </div>
        ${resumoObra.grupos.length ? `
          <div class="cc-tableWrap">
            <table class="cc-table">
              <thead><tr><th>${view === 'estacas' ? 'Diâmetro' : 'Tipo'}</th><th class="col-num">Qtd. feita/total</th><th class="col-num">Volume feito/total</th><th class="col-num">% do tipo</th></tr></thead>
              <tbody>
                ${resumoObra.grupos.sort((a, b) => a[0].localeCompare(b[0], 'pt-BR', { numeric: true })).map(([d, g]) => `<tr>
                  <td style="font-weight:600;">${esc(d)}</td>
                  <td class="col-num cc-tdMono">${g.qtdFeita} / ${g.qtd}</td>
                  <td class="col-num cc-tdMono">${EC.fmt1(g.volumeFeito)} / ${EC.fmt1(g.volume)} m³</td>
                  <td class="col-num cc-tdMono">${EC.fmt1(g.volume > 0 ? g.volumeFeito / g.volume * 100 : 0)}%</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>` : `<div class="cc-empty">Nenhuma ${view === 'estacas' ? 'estaca' : 'fundação'} cadastrada ainda.</div>`}
      </div>` }
    `;
    Permissions.aplicarNaTela();
    if (acompConcretagemId) await renderMapaAcompanhamento();
    reporScroll();
  }

  async function renderMapaAcompanhamento() {
    const host = document.getElementById('ce-acomp-mapa-host');
    if (!host) return;
    const pr = pranchaAtiva();
    if (!pr) { host.innerHTML = `<div class="cc-empty">Nenhuma prancha selecionada.</div>`; return; }
    const imagem = await _obterImagemPrancha(pr.id);
    if (!imagem) { host.innerHTML = `<div class="cc-empty">Esta prancha ainda não tem PDF/imagem.</div>`; return; }
    const idsPlanejados = new Set(_pecaConcDaConcretagem(acompConcretagemId).map(pc => pc.pecaId));
    // Mostra TODAS as peças vinculadas — visão geral de tudo que já foi
    // feito, de qualquer concretagem. O que fica restrito à concretagem
    // selecionada é o número no marcador (por padrão) e a interação
    // (clicar só abre lançar pras peças desta concretagem).
    const lista = marcadoresDaPranchaView(pr.id).filter(m => m.pecaId);
    const reporScroll = _preservarScroll('#ce-acomp-mapa-host');
    host.innerHTML = EC.stageHTML(pr, imagem, lista, statusMarcador, { interativo: true, zoom: zoomE, stageId: 'ce-acomp-stage', maxHeight: _alturaMapa() });
    reporScroll();
    _desenharNumerosConcretagem('ce-acomp-stage', lista, acompConcretagemId, mostrarTodosNumeros);
    // Anel amarelo só nas peças planejadas AINDA PENDENTES desta concretagem
    // — uma vez 100% (verde sólido), o anel some.
    _desenharDestaques('ce-acomp-stage', lista.filter(m => idsPlanejados.has(m.pecaId)), m => {
      const p = pecas.find(x => x.id === m.pecaId);
      return !p || !_pecaExecutada(p);
    });
    // Clicar numa peça planejada nesta concretagem abre o popup de lançar
    // (fora dela, nada acontece — não faz sentido lançar o que não tá
    // programado nesta concretagem específica).
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
    if (!Permissions.pode('controleEstacas', 'criar:bt')) { Utils.toast('Sem permissão para criar.', 'erro'); return; }
    bt = { concId: acompConcretagemId, btId: '', modo: 'nova-meta', numeroForm: _proximoNumeroBT(acompConcretagemId) };
    _renderModalBTs();
  }
  function fecharPainelBT() { bt = null; _renderModalBTs(); }

  async function criarBTEstacas() {
    if (!Permissions.pode('controleEstacas', 'criar:bt')) { Utils.toast('Sem permissão para criar.', 'erro'); return; }
    const numero = parseInt(document.getElementById('ce-bt-numero-novo').value) || _proximoNumeroBT(bt.concId);
    const volumePrevisto = EC.num((document.getElementById('ce-bt-volume-novo').value || '').replace(',', '.'));
    if (!volumePrevisto) { Utils.toast('Informe o volume previsto da BT.', 'alerta'); return; }
    // Bloqueia número repetido — 2 BTs (documentos diferentes) com o MESMO
    // número apareciam iguais no seletor ("BT-1" duas vezes), passando por
    // cima do bloqueio de duplicidade (que só compara pelo ID interno).
    const jaExiste = _btsDaConcretagem(bt.concId).some(b => b.numero === numero);
    if (jaExiste) { Utils.toast(`Já existe uma BT-${numero} nesta concretagem — escolha outro número.`, 'alerta'); return; }
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
    if (!Permissions.pode('controleEstacas', 'editar:meta')) { Utils.toast('Sem permissão para editar.', 'erro'); return; }
    const b = btsConfig.find(x => x.id === id);
    if (!b) return;
    const meta = _metaBT(id);
    bt = { concId: acompConcretagemId, btId: id, modo: 'editar-meta', numeroForm: b.numero, volumeForm: b.volumePrevisto, nf: b.notaFiscal || '', cod: b.codigoBT || '', ...meta };
    _renderModalBTs();
  }

  async function salvarMetaBT() {
    if (!Permissions.pode('controleEstacas', 'editar:meta')) { Utils.toast('Sem permissão para editar.', 'erro'); return; }
    const numero = parseInt(document.getElementById('ce-bt-numero-edit').value) || bt.numeroForm;
    const volumePrevisto = EC.num((document.getElementById('ce-bt-volume-edit').value || '').replace(',', '.'));
    const nf = (document.getElementById('ce-bt-nf-edit')?.value || '').trim();
    const cod = (document.getElementById('ce-bt-cod-edit')?.value || '').trim();
    const hora = document.getElementById('ce-bt-hora-edit')?.value || '';
    const sobra = EC.num((document.getElementById('ce-bt-sobra-edit')?.value || '').replace(',', '.'));
    const perda = EC.num((document.getElementById('ce-bt-perda-edit')?.value || '').replace(',', '.'));
    const perdaCocho = EC.num((document.getElementById('ce-bt-perdacocho-edit')?.value || '').replace(',', '.'));
    // Mesma proteção da criação — não deixa renomear pra um número que já é de OUTRA BT
    const conflito = _btsDaConcretagem(bt.concId).find(b => b.numero === numero && b.id !== bt.btId);
    if (conflito) { Utils.toast(`Já existe uma BT-${numero} nesta concretagem — escolha outro número.`, 'alerta'); return; }
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
    if (!Permissions.pode('controleEstacas', 'excluir:bt')) { Utils.toast('Sem permissão para excluir.', 'erro'); return; }
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
    if (!Permissions.pode('controleEstacas', 'editar:meta')) { Utils.toast('Sem permissão para editar.', 'erro'); return; }
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
    if (!Permissions.pode('controleEstacas', 'editar:bt') && !Permissions.pode('controleEstacas', 'criar:bt')) { Utils.toast('Sem permissão.', 'erro'); return; }
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
    // Detecta números repetidos (2 documentos de BT diferentes com o mesmo
    // número) — dado ruim que já existia antes da validação de duplicidade.
    const contagemNumero = new Map();
    btsConc.forEach(b => contagemNumero.set(b.numero, (contagemNumero.get(b.numero) || 0) + 1));
    const numerosDuplicados = [...contagemNumero.entries()].filter(([, qtd]) => qtd > 1).map(([n]) => n);

    let html = `
      ${numerosDuplicados.length ? `<div class="cc-alertRed" style="margin-bottom:10px;">⚠ Número${numerosDuplicados.length > 1 ? 's' : ''} repetido${numerosDuplicados.length > 1 ? 's' : ''} entre BTs diferentes: ${numerosDuplicados.map(n => 'BT-' + n).join(', ')} — são documentos DIFERENTES com o mesmo número, marcados em vermelho abaixo. Confira qual é a certa e exclua a duplicata (os lançamentos dela precisam ser refeitos na BT certa antes de excluir).</div>` : ''}
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px;">
        ${btsConc.map(b => {
          const jafoi = lancamentos.some(l => l.btConfigId === b.id);
          const duplicada = numerosDuplicados.includes(b.numero);
          return `<span style="display:inline-flex;align-items:center;gap:4px;border:1px solid ${duplicada ? 'var(--cv-red,#ef4444)' : jafoi ? '#16a34a' : 'var(--cv-border,#e2e8f0)'};${duplicada ? 'background:rgba(239,68,68,.06);' : ''}border-radius:8px;padding:4px 4px 4px 10px;font-size:.82rem;">
            BT-${b.numero} · ${EC.fmt1(b.volumePrevisto)}m³${jafoi ? ' ✓' : ''}
            ${view === 'fundacoes' ? `<button class="btn ${bt && bt.btId === b.id && bt.modo === 'lancar' ? 'btn-primario' : 'btn-secundario'} btn-sm" style="padding:2px 6px;" onclick="CE.abrirLancarBTFund('${b.id}')" title="Lançar peças concretadas por esta BT">🧱 Lançar</button>` : ''}
            <button class="btn btn-secundario btn-sm" style="padding:2px 6px;" onclick="CE.abrirEditarMetaBT('${b.id}')" title="Editar BT">✎</button>
            <button class="btn btn-secundario btn-sm" style="padding:2px 6px;color:var(--cv-red,#ef4444);" onclick="CE.excluirBTEstacas('${b.id}')" title="Excluir BT">🗑</button>
          </span>`;
        }).join('')}
        <button class="btn btn-secundario btn-sm" data-perm="controleEstacas:criar:bt" onclick="CE.abrirNovaBT()">+ Nova BT</button>
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

    if (bt && bt.modo === 'lancar') {
      html += _htmlLancarBTFund();
    }
    el.innerHTML = html;
    Permissions.aplicarNaTela();
  }

  // ══════════════════════════════════════════
  // LANÇAR POR BT (Fundações) — inverso do fluxo de Estacas: em vez de abrir
  // a peça e escolher quais BTs contribuíram nela, aqui se escolhe a BT e
  // diz quanto (%) de CADA peça planejada ela concretou — mesmo modelo do
  // Controle de Concreto (que já lança sempre por BT). Grava nos MESMOS
  // concretoLancamentos — o mapa colore verde/parcial pelo mesmo cálculo de
  // sempre (ConcretoCalculos.pctConcretado), então o resultado visual é
  // idêntico ao do fluxo por-peça das Estacas.
  // ══════════════════════════════════════════
  // Peças planejadas nesta concretagem, restritas ao tipo da view atual —
  // uma concretagem pode em tese ter peças de Estacas e de Fundações
  // juntas; aqui só interessam as da view aberta agora.
  function _pecasPlanejadasView(concId) {
    return _pecasPlanejadas(concId).filter(p => view === 'estacas' ? p.subTipo === 'Estacas' : p.subTipo !== 'Estacas');
  }

  function abrirLancarBTFund(btId) {
    if (!Permissions.pode('controleEstacas', 'criar:btFund') && !Permissions.pode('controleEstacas', 'editar:bt')) { Utils.toast('Sem permissão.', 'erro'); return; }
    const lansBT = lancamentos.filter(l => l.btConfigId === btId);
    const linhas = lansBT.length ? lansBT.map(l => {
      const p = pecas.find(x => x.id === l.pecaId);
      const volConc = p ? _volumeConcPeca(p, acompConcretagemId) : 0;
      const pct = volConc > 0 ? (l.volume / volConc) * 100 : 0;
      return { pecaId: l.pecaId, pct: String(Math.round(pct * 100) / 100) };
    }) : [{ pecaId: '', pct: '' }];
    bt = { concId: acompConcretagemId, btId, modo: 'lancar', linhas, busca: '', esconderCompletas: false };
    _renderModalBTs();
  }

  function _btFundVolLinha(l) {
    const p = pecas.find(x => x.id === l.pecaId);
    const pct = EC.num((l.pct || '').replace(',', '.'));
    if (!p || !pct) return 0;
    return (pct / 100) * _volumeConcPeca(p, bt.concId);
  }
  // % da peça já lançado por OUTRAS BTs nesta concretagem (exclui a BT que está sendo editada agora)
  function _btFundPctJaLancada(pecaId) {
    const p = pecas.find(x => x.id === pecaId);
    if (!p) return 0;
    const volConc = _volumeConcPeca(p, bt.concId);
    if (volConc <= 0) return 0;
    const jaLan = lancamentos.filter(l => l.pecaId === pecaId && l.btConfigId !== bt.btId && l.concretagemId === bt.concId).reduce((s, l) => s + (l.volume || 0), 0);
    return (jaLan / volConc) * 100;
  }
  function _btFundExcessoLinha(l) {
    if (!l.pecaId || !l.pct) return 0;
    const p = pecas.find(x => x.id === l.pecaId);
    if (!p) return 0;
    const volConc = _volumeConcPeca(p, bt.concId);
    const jaLan = lancamentos.filter(x => x.pecaId === l.pecaId && x.btConfigId !== bt.btId && x.concretagemId === bt.concId).reduce((s, x) => s + (x.volume || 0), 0);
    const volEsta = (EC.num((l.pct || '').replace(',', '.')) / 100) * volConc;
    return Math.max(0, jaLan + volEsta - volConc);
  }
  function btFundBusca(v) { bt.busca = v; _atualizarSelectsPecaFund(); }
  function btFundEsconderCompletas(v) { bt.esconderCompletas = v; _renderModalBTs(); }
  // Atualiza só as options dos <select> de peça (preserva foco no campo de busca)
  function _atualizarSelectsPecaFund() {
    const lista = _pecasPlanejadasView(bt.concId);
    const busca = (bt.busca || '').toLowerCase();
    document.querySelectorAll('#ce-bt-fund-linhas .ce-bt-fund-linha select').forEach((sel, i) => {
      const atual = bt.linhas[i]?.pecaId || '';
      const opts = lista.filter(p => {
        if (busca && !p.nome.toLowerCase().includes(busca)) return false;
        if (bt.esconderCompletas && p.id !== atual && _btFundPctJaLancada(p.id) >= 99.995) return false;
        return true;
      });
      sel.innerHTML = `<option value="">— peça —</option>` + opts.map(p => {
        const ja = _btFundPctJaLancada(p.id);
        return `<option value="${p.id}" ${atual === p.id ? 'selected' : ''}>${esc(p.nome)} (${esc(p.andar)})${ja > 0.01 ? ` · ${EC.fmt1(ja)}% lançada` : ''}</option>`;
      }).join('');
    });
  }
  function btFundAddLinha() { bt.linhas.push({ pecaId: '', pct: '' }); _renderModalBTs(); }
  function btFundRemLinha(i) { bt.linhas.splice(i, 1); _renderModalBTs(); }
  function btFundUpdLinha(i, campo, valor) {
    bt.linhas[i][campo] = valor;
    if (campo === 'pecaId') { _renderModalBTs(); return; }
    const l = bt.linhas[i];
    const vol = _btFundVolLinha(l), exc = _btFundExcessoLinha(l);
    const volEl = document.getElementById('ce-bt-fund-vol-' + i);
    if (volEl) { volEl.textContent = `${EC.fmt1(vol)} m³${exc > 0.001 ? ' ⚠' : ''}`; volEl.style.color = exc > 0.001 ? 'var(--cv-red,#ef4444)' : ''; }
    const bSel = btsConfig.find(x => x.id === bt.btId);
    const totalUsado = bt.linhas.reduce((s, x) => s + _btFundVolLinha(x), 0);
    const totalEl = document.getElementById('ce-bt-fund-total');
    const sobEl = document.getElementById('ce-bt-fund-sobra');
    if (totalEl) totalEl.textContent = EC.fmt1(totalUsado) + ' m³';
    if (sobEl) sobEl.textContent = EC.fmt1(Math.max(0, (bSel?.volumePrevisto || 0) - totalUsado)) + ' m³';
    const excBox = document.getElementById('ce-bt-fund-excesso');
    if (excBox) excBox.style.display = bt.linhas.some(x => _btFundExcessoLinha(x) > 0.001) ? 'block' : 'none';
  }

  function _htmlLancarBTFund() {
    const bSel = btsConfig.find(x => x.id === bt.btId);
    if (!bSel) return '';
    const lista = _pecasPlanejadasView(bt.concId);
    const totalUsado = bt.linhas.reduce((s, l) => s + _btFundVolLinha(l), 0);
    const sobEstimada = Math.max(0, (bSel.volumePrevisto || 0) - totalUsado);
    const temExcesso = bt.linhas.some(l => _btFundExcessoLinha(l) > 0.001);
    const opcoesPeca = sel => {
      const busca = (bt.busca || '').toLowerCase();
      const opts = lista.filter(p => {
        if (busca && !p.nome.toLowerCase().includes(busca)) return false;
        if (bt.esconderCompletas && p.id !== sel && _btFundPctJaLancada(p.id) >= 99.995) return false;
        return true;
      });
      return `<option value="">— peça —</option>` + opts.map(p => {
        const ja = _btFundPctJaLancada(p.id);
        return `<option value="${p.id}" ${sel === p.id ? 'selected' : ''}>${esc(p.nome)} (${esc(p.andar)})${ja > 0.01 ? ` · ${EC.fmt1(ja)}% lançada` : ''}</option>`;
      }).join('');
    };
    if (!lista.length) {
      return `<div class="cc-empty" style="margin-top:10px;">Nenhuma fundação planejada nesta concretagem ainda — vá em Planejamento primeiro.</div>`;
    }
    return `
      <hr style="border:none;border-top:1px solid var(--cv-border,#e2e8f0);margin:14px 0;">
      <div style="font-weight:700;font-size:.88rem;margin-bottom:10px;">🧱 Lançando BT-${bSel.numero} <span style="font-family:var(--font-mono,monospace);font-weight:400;font-size:.75rem;color:var(--cv-text3,#94a3b8);">previsto ${EC.fmt1(bSel.volumePrevisto)} m³</span></div>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap;">
        <input type="text" class="form-control" style="flex:1;min-width:160px;" placeholder="🔍 Filtrar peças por nome..." value="${esc(bt.busca)}" oninput="CE.btFundBusca(this.value)">
        <label class="text-sm text-muted" style="display:flex;align-items:center;gap:5px;cursor:pointer;white-space:nowrap;">
          <input type="checkbox" ${bt.esconderCompletas ? 'checked' : ''} onchange="CE.btFundEsconderCompletas(this.checked)"> Esconder 100% lançadas
        </label>
      </div>
      <div id="ce-bt-fund-linhas">
        ${bt.linhas.map((l, i) => {
          const vol = _btFundVolLinha(l), exc = _btFundExcessoLinha(l);
          return `
            <div style="display:grid;grid-template-columns:1fr 80px 90px auto;gap:8px;margin-bottom:6px;align-items:center;" class="ce-bt-fund-linha">
              <select class="form-control" onchange="CE.btFundUpdLinha(${i}, 'pecaId', this.value)">${opcoesPeca(l.pecaId)}</select>
              <input type="text" inputmode="decimal" class="form-control" placeholder="%" value="${esc(l.pct)}" oninput="CE.btFundUpdLinha(${i}, 'pct', this.value)">
              <span id="ce-bt-fund-vol-${i}" style="font-family:var(--font-mono,monospace);font-size:.78rem;color:${exc > 0.001 ? 'var(--cv-red,#ef4444)' : ''};text-align:right;">${EC.fmt1(vol)} m³${exc > 0.001 ? ' ⚠' : ''}</span>
              <button class="btn btn-secundario btn-sm" style="color:var(--cv-red,#ef4444);" onclick="CE.btFundRemLinha(${i})" ${bt.linhas.length <= 1 ? 'disabled' : ''}>✕</button>
            </div>`;
        }).join('')}
      </div>
      <button class="btn btn-secundario btn-sm" onclick="CE.btFundAddLinha()">+ Peça</button>
      <div id="ce-bt-fund-excesso" style="display:${temExcesso ? 'block' : 'none'};background:rgba(239,68,68,.08);border:1px solid var(--cv-red,#ef4444);color:#991b1b;border-radius:8px;padding:8px 12px;font-size:.78rem;margin-top:8px;">
        ⚠️ Uma ou mais peças ultrapassam 100% do volume nesta concretagem (considerando outras BTs).
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;background:var(--cv-surface2,#f8fafc);border:1px solid var(--cv-border,#e2e8f0);border-radius:8px;padding:10px 14px;margin-top:10px;font-family:var(--font-mono,monospace);font-size:.82rem;flex-wrap:wrap;gap:6px;">
        <span>Total usado: <b id="ce-bt-fund-total">${EC.fmt1(totalUsado)} m³</b></span>
        <span>Sobra estimada: <b id="ce-bt-fund-sobra">${EC.fmt1(sobEstimada)} m³</b></span>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;">
        <button class="btn btn-secundario btn-sm" onclick="CE.fecharPainelBT()">Cancelar</button>
        <button class="btn btn-primario btn-sm" onclick="CE.salvarLancarBTFund()">✓ Salvar lançamento</button>
      </div>`;
  }

  async function salvarLancarBTFund() {
    if (!Permissions.pode('controleEstacas', 'criar:btFund') && !Permissions.pode('controleEstacas', 'editar:bt')) { Utils.toast('Sem permissão.', 'erro'); return; }
    const linhasVal = bt.linhas.filter(l => l.pecaId && EC.num((l.pct || '').replace(',', '.')) > 0);
    if (!linhasVal.length) { Utils.toast('Adicione ao menos uma peça com % maior que zero.', 'alerta'); return; }
    const bSel = btsConfig.find(x => x.id === bt.btId);
    if (!bSel) return;
    Utils.mostrarLoading();
    try {
      const meta = _metaBT(bt.btId);
      const ops = [];
      // Regrava do zero os lançamentos DESTA BT — modelo "BT é a fonte da
      // verdade de onde ela foi usada", igual ao Controle de Concreto.
      lancamentos.filter(l => l.btConfigId === bt.btId).forEach(l => ops.push({ type: 'delete', ref: Database.ref(obraId, COL_LANS).doc(l.id) }));
      linhasVal.forEach(l => {
        const p = pecas.find(x => x.id === l.pecaId);
        if (!p) return;
        const volConc = _volumeConcPeca(p, bt.concId);
        const pct = EC.num((l.pct || '').replace(',', '.'));
        const volume = +((pct / 100) * volConc).toFixed(4);
        const pctPeca = volConc > 0 ? +((volume / volConc) * 100).toFixed(2) : 0;
        ops.push({
          type: 'set', ref: Database.ref(obraId, COL_LANS).doc(EC.genId('lan')),
          data: { btConfigId: bt.btId, concretagemId: bt.concId, pecaId: p.id, pct: pctPeca, volume,
            hora: meta.hora, sobraCaminhao: EC.num(meta.sobra), perdaObra: EC.num(meta.perda), perdaCocho: EC.num(meta.perdaCocho), obraId },
        });
      });
      if (ops.length) await Database.batchWrite(ops);
      await carregar();
      await EstacasCalculos.sincronizarVinculosPlanejamento(obraId).catch(e => console.error('Sync Planejamento:', e));
      bt = null;
      _renderAbaAcompanhamento();
      _renderModalBTs();
      Utils.toast(`✓ BT-${bSel.numero} lançada!`, 'sucesso');
    } catch (e) {
      Utils.toast('Erro ao salvar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
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
    // Compara também por NÚMERO (não só ID) — protege contra dado antigo com
    // 2 BTs diferentes (documentos distintos) e o MESMO número, que passariam
    // batido no bloqueio antigo (que só comparava por ID interno).
    const numerosUsados = new Set([...idsUsados].map(id => btsConfig.find(x => x.id === id)?.numero).filter(n => n !== undefined));
    return `<option value="">— BT —</option>` + btsConc.filter(b => {
      if (b.id === selId) return true;
      if (idsUsados.has(b.id) || numerosUsados.has(b.numero)) return false;
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
      ${!btsConc.length ? `<div class="cc-empty">Nenhuma BT criada ainda nesta concretagem. <button class="btn btn-secundario btn-sm" data-perm="controleEstacas:criar:bt" onclick="Utils.fecharModal('modal-ce-lancar-estaca');CE.abrirModalBTs();CE.abrirNovaBT();">+ Criar BT</button></div>` : `
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
            return `<div style="margin-bottom:10px;padding-bottom:8px;border-bottom:1px dashed var(--cv-border,#f1f5f9);">
              <select class="form-control" style="margin-bottom:6px;" onchange="CE.btUpdLinhaPeca(${i}, 'btId', this.value)">${_opcoesBTHTML(l.btId)}</select>
              <div style="display:flex;gap:8px;align-items:center;">
                <input type="text" inputmode="decimal" class="form-control" style="width:70px;flex:none;${excesso ? 'border-color:#ef4444;' : ''}" placeholder="% da BT" value="${esc(l.pctBT)}" oninput="CE.btUpdLinhaPeca(${i}, 'pctBT', this.value)">
                <span id="ce-est-vol-${i}" style="font-family:var(--font-mono);font-size:.8rem;color:var(--cor-texto-secundario);white-space:nowrap;">${EC.fmt1(vol)} m³</span>
                <span style="flex:1;"></span>
                ${ehPrimeiraOuUltima ? `<button class="btn btn-secundario btn-sm" style="${temPerda ? 'border-color:#f59e0b;color:#f59e0b;' : ''}" title="${b.id === primeiraBT?.id ? 'Cocho/linha desta BT (é a primeira)' : 'Sobra de caminhão desta BT (é a última)'}" onclick="CE.toggleMetaInline('${b.id}')">✎ ${b.id === primeiraBT?.id ? 'cocho' : 'sobra'}</button>` : ''}
                <button class="btn btn-secundario btn-sm" style="color:var(--cv-red,#ef4444);flex:none;" onclick="CE.btRemLinhaPeca(${i})" ${estacaAtual.linhas.length <= 1 ? 'disabled' : ''}>✕</button>
              </div>
              <div id="ce-est-aviso-${i}" class="text-sm" style="color:#ef4444;margin-top:4px;${excesso ? '' : 'display:none;'}">⚠ Essa BT já tem ${EC.fmt1(pctOutras)}% usado em outra peça — com esse %, passaria de 100% da BT.</div>
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
        // Destaca TODOS os pedaços da área (m.pontos + m.partesExtras).
        EC.partesPoligono(m).forEach(pontos => {
          const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
          poly.setAttribute('points', pontos.map(p => `${p.x * 100},${p.y * 100}`).join(' '));
          poly.setAttribute('fill', 'none'); poly.setAttribute('stroke', '#eab308');
          poly.setAttribute('stroke-width', '0.8'); poly.setAttribute('vector-effect', 'non-scaling-stroke');
          svg.appendChild(poly);
        });
        cont.appendChild(svg);
      }
    });
    stage.appendChild(cont);
  }

  // Clique num marcador dispara toggleFn(marcador) — usado no Planejamento
  // (incluir/remover da concretagem) e no Acompanhamento (marcar/desmarcar real).
  // Ctrl+roda: zoom · Ctrl+arrastar: pan — igual em Marcadores, Planejamento
  // e Acompanhamento (mesmo stage, "stageId" muda só o id do elemento).
  // Qual dispositivo tocou por último — a folga do hit-test depende disso
  // (dedo precisa de tolerância, mouse é preciso).
  let _ultimoPointerType = 'mouse';
  // Momento do último pan/pinch. O 'click' que o navegador dispara logo depois
  // de arrastar o mapa precisa ser engolido, senão terminar um pan marcava uma
  // estaca sem querer. É timestamp e não flag de propósito: o pinch de 2 dedos
  // NÃO gera click nenhum, então uma flag ficaria pendurada e engoliria o
  // próximo toque de verdade. Com janela de tempo, ela se limpa sozinha.
  let _fimDeGesto = 0;
  const JANELA_GESTO_MS = 350;

  function _tolToquePx() { return _ultimoPointerType === 'mouse' ? 6 : EC.TOL_TOQUE_PX; }

  // Marcador que o usuário quis acertar. No dedo vai direto pela proximidade
  // (EC.marcadorMaisProximo já faz a estaca ganhar do bloco embaixo dela). No
  // mouse tenta primeiro o hit-test nativo, que é exato e respeita o
  // empilhamento, e só cai na proximidade com folga pequena.
  function _marcadorNoEvento(ev, stage, lista) {
    // Acertou em cheio uma ESTACA (.est-marcador só existe pra círculo):
    // respeita a mira. Inclusive quando ela não vale nesta tela — ex: estaca
    // que não está planejada nesta concretagem. Aí o certo é não acontecer
    // nada, e não desviar pra vizinha por proximidade, que confundiria.
    const direto = ev.target && ev.target.closest && ev.target.closest('.est-marcador');
    if (direto) return (lista || []).find(x => x.id === direto.dataset.id) || null;
    // Caiu no fundo ou em cima de um polígono (bloco/sapata): aí sim vale a
    // proximidade — estar "dentro" de um bloco enorme não quer dizer que era
    // nele que o usuário mirou, e a estaca desenhada por cima tem prioridade.
    return EC.marcadorMaisProximo(lista, EC.posRelativa(ev, stage), stage.getBoundingClientRect(), _tolToquePx());
  }

  // Aplica um zoom absoluto guardando a âncora pro próximo render. Se já havia
  // uma âncora pendente (vários frames antes do render sair), preserva o
  // zoomAntigo dela — que é o zoom com que o DOM na tela foi desenhado.
  function _aplicarZoom(zoomNovo, ancora) {
    const z = Math.min(4, Math.max(0.25, +(+zoomNovo || 1).toFixed(2)));
    if (z === zoomE) return false;
    const zoomAntes = zoomE;
    zoomE = z;
    const anc = _ancoraDe(ancora, zoomAntes);
    if (_ancoraZoom && anc) { _ancoraZoom.x = anc.x; _ancoraZoom.y = anc.y; }
    else if (!_ancoraZoom) _ancoraZoom = anc;
    _atualizarLabelZoom();
    return true;
  }

  function _ligarPanZoom(stageId) {
    const stage = document.getElementById(stageId);
    if (!stage) return;
    const scrollEl = stage.parentElement;
    // Rede de segurança: se o mapa re-renderizou no meio de um arrasto (um
    // snapshot do Firestore chegando, por exemplo), os listeners do gesto
    // foram embora junto com o DOM antigo e o pointerup nunca vai rodar. Sem
    // isso a flag ficava presa em true e o pan de 1 dedo morria de vez.
    _arrastandoMarcador = false;

    // Ponto em px relativo à borda VISÍVEL do mapa — é o formato que
    // EC.zoomAncorado espera como âncora.
    const ancoraDoPonto = (clientX, clientY) => {
      const r = scrollEl.getBoundingClientRect();
      return { x: clientX - r.left, y: clientY - r.top };
    };

    stage.addEventListener('pointerdown', ev => { _ultimoPointerType = ev.pointerType || 'mouse'; }, true);

    // Ctrl+roda: zoom ANCORADO NO CURSOR (antes crescia a partir da origem
    // do stage, então o ponto de interesse fugia da tela).
    scrollEl.addEventListener('wheel', ev => {
      if (!ev.ctrlKey) return;
      ev.preventDefault();
      _ultimoPointerType = 'mouse';
      zoomAjustar(ev.deltaY < 0 ? 0.15 : -0.15, ancoraDoPonto(ev.clientX, ev.clientY));
    }, { passive: false });

    // Ctrl+arrastar com mouse: pan
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

    // ── Toque (tablet/celular) ──
    // 2 dedos: pinch-zoom. 1 dedo: arrasta o mapa (pan), só quando NÃO está
    // criando/editando nada.
    //
    // O pinch NÃO re-renderiza a cada frame. Antes re-renderizava, e isso
    // matava o próprio gesto: trocar o innerHTML destrói o elemento que
    // recebeu o touchstart, e os eventos de toque ficam presos ao alvo
    // original — os touchmove seguintes iam pra um nó já fora do DOM, sem
    // ancestral até o document. Resultado: o pinch dava um passo e travava.
    // Agora o gesto é puro CSS transform (não mexe no DOM, não faz reflow) com
    // transform-origin no ponto médio dos dedos — o mapa cresce visualmente
    // debaixo do dedo — e o zoom real é confirmado uma única vez no touchend.
    let toque1 = null, pinchDist0 = null, zoomIni = null, ancoraPinch = null, escalaPinch = 1;

    const limparPinch = () => {
      stage.style.transform = '';
      stage.style.transformOrigin = '';
      pinchDist0 = null; ancoraPinch = null; escalaPinch = 1;
    };

    stage.addEventListener('touchstart', ev => {
      if (ev.touches.length === 2) {
        ev.preventDefault();
        toque1 = null;
        _ultimoPointerType = 'touch';
        const [t1, t2] = ev.touches;
        const midX = (t1.clientX + t2.clientX) / 2, midY = (t1.clientY + t2.clientY) / 2;
        pinchDist0 = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY) || 1;
        zoomIni = zoomE;
        escalaPinch = 1;
        ancoraPinch = ancoraDoPonto(midX, midY);
        // origem do transform em coordenadas do PRÓPRIO stage
        const rs = stage.getBoundingClientRect();
        stage.style.transformOrigin = `${(midX - rs.left).toFixed(1)}px ${(midY - rs.top).toFixed(1)}px`;
      } else if (ev.touches.length === 1 && !modo && !editandoFormaId && !_arrastandoMarcador) {
        const t = ev.touches[0];
        toque1 = { x: t.clientX, y: t.clientY, sl: scrollEl.scrollLeft, st: scrollEl.scrollTop, moveu: false };
      }
    }, { passive: false });

    stage.addEventListener('touchmove', ev => {
      if (ev.touches.length === 2 && pinchDist0) {
        ev.preventDefault();
        const [t1, t2] = ev.touches;
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        // Limita a escala visual ao que o zoom real vai aceitar (0.25..4),
        // pra não mostrar um tamanho que "volta" ao soltar o dedo.
        const alvo = Math.min(4, Math.max(0.25, zoomIni * (dist / pinchDist0)));
        escalaPinch = alvo / zoomIni;
        stage.style.transform = `scale(${escalaPinch.toFixed(4)})`;
        _atualizarLabelZoomTexto(Math.round(alvo * 100) + '%');
        _fimDeGesto = Date.now();
      } else if (ev.touches.length === 1 && toque1) {
        const t = ev.touches[0];
        const dx = t.clientX - toque1.x, dy = t.clientY - toque1.y;
        if (!toque1.moveu && Math.hypot(dx, dy) < 8) return; // ainda pode ser um tap — não rouba o clique
        toque1.moveu = true;
        _fimDeGesto = Date.now(); // foi pan: o click seguinte não marca estaca
        ev.preventDefault();
        scrollEl.scrollLeft = toque1.sl - dx;
        scrollEl.scrollTop = toque1.st - dy;
      }
    }, { passive: false });

    const fimToque = ev => {
      if (toque1 && toque1.moveu) _fimDeGesto = Date.now(); // pan acabou agora
      if (ev.touches.length < 2 && pinchDist0) {
        const zoomFinal = zoomIni * escalaPinch;
        const anc = ancoraPinch;
        _fimDeGesto = Date.now();
        limparPinch();
        // Confirma o zoom de verdade uma única vez, ancorado no ponto onde os
        // dedos estavam — aí sim vale re-renderizar (os marcadores precisam
        // ser redesenhados no tamanho novo, não só escalados).
        if (_aplicarZoom(zoomFinal, anc)) _rerenderMapaDaAba();
        else _atualizarLabelZoom();
      }
      if (ev.touches.length < 1) toque1 = null;
    };
    stage.addEventListener('touchend', fimToque);
    stage.addEventListener('touchcancel', fimToque);
  }

  // Arrasto de um "handle" (bolinha de ajuste de forma / vértice de polígono)
  // com Pointer Events — mesmo caminho pro mouse, pro dedo e pra caneta.
  // Antes era mousedown/mousemove/mouseup, e no celular o navegador nunca
  // emite o mousemove do meio: os pontos de ajuste simplesmente não se moviam.
  // setPointerCapture segura o gesto mesmo quando o dedo sai de cima da bolinha
  // (que tem só 14px — sair dela no meio do arrasto é a regra, não a exceção).
  function _arrastarHandle(el, aoMover, aoSoltar) {
    el.addEventListener('pointerdown', ev => {
      if (!ev.isPrimary) return;
      ev.preventDefault(); ev.stopPropagation();
      _arrastandoMarcador = true; // segura o pan de 1 dedo enquanto ajusta
      try { el.setPointerCapture(ev.pointerId); } catch (e) { /* sem captura: segue sem */ }
      const mover = mv => { if (mv.pointerId === ev.pointerId) aoMover(mv); };
      const soltar = up => {
        if (up.pointerId !== ev.pointerId) return;
        el.removeEventListener('pointermove', mover);
        el.removeEventListener('pointerup', soltar);
        el.removeEventListener('pointercancel', soltar);
        try { el.releasePointerCapture(ev.pointerId); } catch (e) { /* já liberado */ }
        _arrastandoMarcador = false;
        if (aoSoltar) aoSoltar(up);
      };
      el.addEventListener('pointermove', mover);
      el.addEventListener('pointerup', soltar);
      el.addEventListener('pointercancel', soltar);
    });
  }

  function _rerenderMapaDaAba() {
    if (abaPrincipal === 'planejamento') renderMapaPlanejamento();
    else if (abaPrincipal === 'acompanhamento') renderMapaAcompanhamento();
    else renderMapa();
  }

  // Engole o 'click' sintético que vem logo depois de um pan/pinch.
  function _cliqueDeGesto() { return (Date.now() - _fimDeGesto) < JANELA_GESTO_MS; }

  function _ligarEventosToggle(stageId, lista, toggleFn) {
    const stage = document.getElementById(stageId);
    if (!stage) return;
    _ligarPanZoom(stageId);
    stage.style.cursor = 'pointer';
    stage.addEventListener('click', ev => {
      if (ev.ctrlKey) return;
      if (_cliqueDeGesto()) return;
      const m = _marcadorNoEvento(ev, stage, lista);
      if (m) toggleFn(m);
    });
  }

  // ══════════════════════════════════════════
  // MAPA INTERATIVO
  // ══════════════════════════════════════════
  async function _obterImagemPrancha(pranchaId) {
    if (imagemCachePranchaId === pranchaId) return imagemCacheBase64;
    const pr = pranchas.find(p => p.id === pranchaId);
    if (pr && pr.imgUrl) { imagemCachePranchaId = pranchaId; imagemCacheBase64 = pr.imgUrl; return pr.imgUrl; }
    // Compatibilidade com pranchas antigas (imagem embutida em dataURL no
    // Firestore — pra caber no limite de ~950KB do documento, o JPEG saía
    // bem comprimido e a planta técnica perdia nitidez ao dar zoom, mesmo
    // as estacas/marcadores desenhados por cima continuando nítidos, por
    // serem vetor e não pixel. A partir daqui a imagem vai pro Storage, sem
    // esse teto de tamanho e sem recompressão com perda — ver
    // _processarArquivoPrancha).
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
    if (!Permissions.pode('controleEstacas', 'editar:prancha')) { Utils.toast('Sem permissão para editar.', 'erro'); return; }
    const pr = pranchaAtiva();
    if (!pr) { Utils.toast('Nenhuma prancha selecionada.', 'erro'); return; }
    const imagem = await _obterImagemPrancha(pr.id);
    if (!imagem) { Utils.toast('Esta prancha ainda não tem PDF/imagem.', 'erro'); return; }
    Utils.mostrarLoading();
    try {
      // crossOrigin obrigatório: a imagem agora pode vir do Storage (outro
      // domínio) — sem isso o canvas fica "contaminado" e toDataURL()
      // abaixo explode com SecurityError, mesmo a imagem aparecendo
      // normalmente na tela via <img> (mesma causa/fix do Controle de Concreto).
      const img = await new Promise((res, rej) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = rej; im.src = imagem; });
      const Wold = pr.imgWidthPx || img.naturalWidth, Hold = pr.imgHeightPx || img.naturalHeight;
      const canvas = document.createElement('canvas');
      canvas.width = Hold; canvas.height = Wold; // 90° troca largura/altura
      const ctx = canvas.getContext('2d');
      ctx.translate(canvas.width, 0);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, 0, 0, Wold, Hold);
      // PNG sem perda pro Storage (mesmo pipeline do upload — ver
      // _processarArquivoPrancha) — girar não pode ser a hora de degradar
      // uma planta que já tinha sido salva em alta qualidade.
      const dataUrl = canvas.toDataURL('image/png');
      const path = `obras/${obraId}/estacas-plantas/${pr.id}.png`;
      const url = await uploadImagem(path, dataUrl);

      // Recalcula a posição de todos os marcadores desta prancha pro novo sentido
      const marcadoresDaPrancha = marcadores.filter(m => m.pranchaId === pr.id);
      const ops = [];
      marcadoresDaPrancha.forEach(m => {
        if (m.tipo === 'circulo') {
          const novo = EC.rotacionarPontoCW({ x: m.cx, y: m.cy });
          const novoRaio = m.raio * (Wold / Hold);
          ops.push({ type: 'update', ref: Database.ref(obraId, COL_MARCADORES).doc(m.id), data: { cx: novo.x, cy: novo.y, raio: novoRaio } });
        } else if (m.pontos && m.pontos.length) {
          const data = { pontos: m.pontos.map(EC.rotacionarPontoCW) };
          if (Array.isArray(m.partesExtras) && m.partesExtras.length) {
            data.partesExtras = m.partesExtras.map(pe => ({ pontos: (pe.pontos || []).map(EC.rotacionarPontoCW) }));
          }
          ops.push({ type: 'update', ref: Database.ref(obraId, COL_MARCADORES).doc(m.id), data });
        }
      });
      for (let i = 0; i < ops.length; i += 400) await Database.batchWrite(ops.slice(i, i + 400));

      await Database.atualizar(obraId, COL_PRANCHAS, pr.id, { imgUrl: url, imgWidthPx: canvas.width, imgHeightPx: canvas.height });
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
    const reporScroll = _preservarScroll('#ce-mapa-host');
    const html = EC.stageHTML(pr, imagem, lista, statusMarcador, { interativo: true, zoom: zoomE, stageId: 'ce-stage', maxHeight: _alturaMapa() });
    // Barra de ação (Concluir/Desfazer/Cancelar) vai ANTES do mapa, não depois.
    // Antes ficava depois de `html` — com o mapa esticando até 600/720px de
    // altura, a barra caía fora da área visível em telas menores e dava a
    // impressão de que não existia botão nenhum pra terminar o desenho da
    // fundação (só dava pra ver rolando a página pra baixo do mapa inteiro).
    // Quando a área em desenho vai direto pra uma peça já existente
    // (proximaAreaParaPeca — botão "Adicionar outra área pra esta peça" no
    // popup de vínculo), mostra pra quem é, senão dá a impressão de que o
    // clique não fez nada com o vínculo.
    const avisoPeca = proximaAreaParaPeca ? ` <span style="font-weight:600;color:#1d4ed8;">→ esta área vai direto pra ${esc(proximaAreaParaPeca.nome)}</span>` : '';
    // Info de pedaços extras já fechados nesta área (ex: viga que passa por
    // trás de um bloco — pedaços em lugares separados da prancha, mas viram
    // UM marcador só, com um vínculo só).
    const infoPartes = poligonoPartesExtras.length ? ` — ${poligonoPartesExtras.length} pedaço${poligonoPartesExtras.length !== 1 ? 's' : ''} já pronto${poligonoPartesExtras.length !== 1 ? 's' : ''}` : '';
    const podeConcluirPoligono = poligonoPontos.length >= 3 || (!poligonoPontos.length && poligonoPartesExtras.length > 0);
    const barraAcao = modo === 'circulo'
      ? `<div class="ce-barra-acao">Clique no centro da estaca e arraste até o tamanho desejado.${avisoPeca} <button class="btn btn-secundario btn-sm" onclick="CE.cancelarModo()">Cancelar</button></div>`
      : modo === 'poligono'
      ? `<div class="ce-barra-acao">Clique nos vértices da fundação (${poligonoPontos.length} ponto${poligonoPontos.length !== 1 ? 's' : ''}${infoPartes}).${avisoPeca} <button class="btn btn-secundario btn-sm" ${poligonoPontos.length || poligonoPartesExtras.length ? '' : 'disabled'} onclick="CE.desfazerPontoPoligono()">↩ Desfazer ponto</button> <button class="btn btn-secundario btn-sm" ${poligonoPontos.length >= 3 ? '' : 'disabled'} onclick="CE.novoPedacoPoligono()" title="Pra quando a fundação atravessa atrás de outra estrutura e o desenho fica em pedaços separados — todos viram a mesma área">➕ Novo pedaço (área separada)</button> <button class="btn btn-primario btn-sm" ${podeConcluirPoligono ? '' : 'disabled'} onclick="CE.concluirPoligono()">✓ Concluir</button> <button class="btn btn-secundario btn-sm" onclick="CE.cancelarModo()">Cancelar</button></div>`
      : editandoFormaId
      ? `<div class="ce-barra-acao">Ajustando forma — arraste os pontos. <button class="btn btn-primario btn-sm" onclick="CE.concluirAjusteForma()">✓ Concluir ajuste</button> <button class="btn btn-secundario btn-sm" onclick="CE.cancelarAjusteForma()">Cancelar</button></div>`
      : '';
    host.innerHTML = `
      ${barraAcao}
      ${html}
    `;
    reporScroll();
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
      // Pointer Events em vez de mousedown/mousemove/mouseup: no celular o
      // navegador sintetiza um único par mousedown/mouseup, sem mousemove no
      // meio, então o raio saía sempre 0 e o marcador era descartado em
      // silêncio pelo limiar de 3px — não dava pra criar estaca no toque.
      // setPointerCapture mantém os eventos vindo pro stage mesmo quando o
      // dedo sai de cima dele durante o arrasto.
      stage.addEventListener('pointerdown', ev => {
        if (ev.ctrlKey || !ev.isPrimary) return;
        const alvo = ev.target.closest && ev.target.closest('.est-marcador, .est-poligono-hit');
        if (alvo) return; // não inicia criação em cima de marcador existente
        ev.preventDefault();
        try { stage.setPointerCapture(ev.pointerId); } catch (e) { /* navegador sem captura: segue sem */ }
        const centro = EC.posRelativa(ev, stage);
        const cont = _overlayContainer('ce-preview-overlay');
        cont.innerHTML = '';
        const preview = document.createElement('div');
        preview.style.cssText = `position:absolute;left:${(centro.x * 100).toFixed(3)}%;top:${(centro.y * 100).toFixed(3)}%;width:0;height:0;transform:translate(-50%,-50%);border-radius:50%;border:2px dashed #1e293b;background:rgba(59,130,246,.25);z-index:6;`;
        cont.appendChild(preview);
        const mover = mv => {
          if (mv.pointerId !== ev.pointerId) return;
          const raio = EC.raioFracao(centro, EC.posRelativa(mv, stage), stage);
          const diam = raio * 2 * (stage.offsetWidth || 1);
          preview.style.width = diam.toFixed(1) + 'px';
          preview.style.height = diam.toFixed(1) + 'px';
        };
        const soltar = async up => {
          if (up.pointerId !== ev.pointerId) return;
          stage.removeEventListener('pointermove', mover);
          stage.removeEventListener('pointerup', soltar);
          stage.removeEventListener('pointercancel', soltar);
          try { stage.releasePointerCapture(ev.pointerId); } catch (e) { /* já liberado */ }
          cont.innerHTML = '';
          if (up.type === 'pointercancel') return;
          const raio = EC.raioFracao(centro, EC.posRelativa(up, stage), stage);
          const raioPx = raio * (stage.offsetWidth || 1);
          // Limiar em PIXELS DE TELA (não fração da imagem) — com zoom alto,
          // um arrasto normal na tela virava uma fração ínfima da imagem
          // (que ficou enorme) e era descartado em silêncio (o antigo
          // raio<0.004 fixo não escalava com o zoom).
          if (raioPx < 3) return; // arrasto minúsculo, ignora (evita clique acidental)
          await _criarMarcadorCirculo(centro.x, centro.y, raio);
        };
        stage.addEventListener('pointermove', mover);
        stage.addEventListener('pointerup', soltar);
        stage.addEventListener('pointercancel', soltar);
      });
      return;
    }

    if (modo === 'poligono') {
      stage.style.cursor = 'crosshair';
      stage.addEventListener('click', ev => {
        if (ev.ctrlKey) return;
        if (_cliqueDeGesto()) return; // acabou de dar pinch: não crava vértice
        poligonoPontos.push(EC.posRelativa(ev, stage));
        _atualizarToolbarPoligono();
        _desenharPoligonoEmCriacao();
      });
      return;
    }

    // Modo normal: segurar e arrastar uma estaca já move ela direto (sem
    // precisar abrir o popup e clicar em "Ajustar forma" antes) — clique
    // rápido, sem arrastar, continua abrindo o vínculo como sempre.
    stage.addEventListener('pointerdown', ev => {
      if (ev.ctrlKey || !ev.isPrimary) return;
      const marcador = ev.target.closest && ev.target.closest('.est-marcador');
      if (!marcador) return; // arraste direto só pra círculo (estaca) por ora
      const m = marcadores.find(x => x.id === marcador.dataset.id);
      if (!m || m.tipo !== 'circulo') return;
      // Avisa o pan de 1 dedo pra não arrastar o mapa junto. O touchstart do
      // pan é disparado DEPOIS do pointerdown, então essa flag já está de pé
      // quando ele roda.
      _arrastandoMarcador = true;
      try { stage.setPointerCapture(ev.pointerId); } catch (e) { /* sem captura: segue sem */ }
      const inicioX = ev.clientX, inicioY = ev.clientY;
      const orig = { cx: m.cx, cy: m.cy };
      let arrastou = false;
      // Dedo tem tremor natural: 4px disparava arrasto num toque que era só
      // um toque. No touch o limiar é maior, no mouse continua fino.
      const limiar = _ultimoPointerType === 'mouse' ? 4 : 10;
      const mover = mv => {
        if (mv.pointerId !== ev.pointerId) return;
        if (!arrastou && Math.hypot(mv.clientX - inicioX, mv.clientY - inicioY) < limiar) return;
        arrastou = true;
        mv.preventDefault();
        const p = EC.posRelativa(mv, stage);
        m.cx = p.x; m.cy = p.y;
        marcador.style.left = (p.x * 100).toFixed(3) + '%';
        marcador.style.top = (p.y * 100).toFixed(3) + '%';
      };
      const soltar = async up => {
        if (up.pointerId !== ev.pointerId) return;
        stage.removeEventListener('pointermove', mover);
        stage.removeEventListener('pointerup', soltar);
        stage.removeEventListener('pointercancel', soltar);
        try { stage.releasePointerCapture(ev.pointerId); } catch (e) { /* já liberado */ }
        _arrastandoMarcador = false;
        if (!arrastou) return; // foi um toque normal — o listener de 'click' abaixo abre o vínculo
        _arrastouMarcadorAgora = true;
        if (up.type === 'pointercancel') { // gesto abortado: devolve pra posição original
          m.cx = orig.cx; m.cy = orig.cy;
          marcador.style.left = (orig.cx * 100).toFixed(3) + '%';
          marcador.style.top = (orig.cy * 100).toFixed(3) + '%';
          return;
        }
        try {
          await Database.atualizar(obraId, COL_MARCADORES, m.id, { cx: m.cx, cy: m.cy });
        } catch (e) {
          m.cx = orig.cx; m.cy = orig.cy;
          marcador.style.left = (orig.cx * 100).toFixed(3) + '%';
          marcador.style.top = (orig.cy * 100).toFixed(3) + '%';
          Utils.toast('Erro ao salvar posição: ' + e.message, 'erro');
        }
      };
      stage.addEventListener('pointermove', mover);
      stage.addEventListener('pointerup', soltar);
      stage.addEventListener('pointercancel', soltar);
    });

    // Modo normal: clicar num marcador abre o vínculo
    stage.addEventListener('click', ev => {
      if (ev.ctrlKey) return;
      if (_arrastouMarcadorAgora) { _arrastouMarcadorAgora = false; return; } // acabou de arrastar — não abre popup
      if (_cliqueDeGesto()) return; // acabou de dar pan/pinch — não abre popup
      // Só os marcadores DESTA prancha: a busca por proximidade acharia
      // marcador de outra prancha (a lista global tem todas).
      const pr = pranchaAtiva();
      const m = _marcadorNoEvento(ev, stage, pr ? marcadoresDaPranchaView(pr.id) : []);
      if (m) abrirVincular(m.id);
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
    // Pedaços já fechados (via "➕ Novo pedaço") — desenho estático, sem
    // pontinhos de arrastar, só pra mostrar que já fazem parte da área.
    if (poligonoPartesExtras.length) {
      const svgExtras = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svgExtras.setAttribute('viewBox', '0 0 100 100');
      svgExtras.setAttribute('preserveAspectRatio', 'none');
      svgExtras.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:8;';
      poligonoPartesExtras.forEach(pontos => {
        const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        poly.setAttribute('points', pontos.map(p => `${p.x * 100},${p.y * 100}`).join(' '));
        poly.setAttribute('fill', 'rgba(22,163,74,0.18)');
        poly.setAttribute('stroke', '#16a34a'); poly.setAttribute('stroke-width', '0.3'); poly.setAttribute('vector-effect', 'non-scaling-stroke');
        svgExtras.appendChild(poly);
      });
      cont.appendChild(svgExtras);
    }
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
      _arrastarHandle(dot, mv => {
        poligonoPontos[i] = EC.posRelativa(mv, stage);
        _desenharPoligonoEmCriacao();
      });
      cont.appendChild(dot);
    });
  }

  async function iniciarAdicionarCirculo() {
    if (!Permissions.pode('controleEstacas', 'criar:marcador')) { Utils.toast('Sem permissão para criar.', 'erro'); return; }
    modo = 'circulo'; editandoFormaId = null; proximaAreaParaPeca = null;
    await renderMapa();
    _atualizarBotoesModo();
  }
  async function iniciarAdicionarPoligono() {
    if (!Permissions.pode('controleEstacas', 'criar:marcador')) { Utils.toast('Sem permissão para criar.', 'erro'); return; }
    modo = 'poligono'; poligonoPontos = []; poligonoPartesExtras = []; editandoFormaId = null; proximaAreaParaPeca = null;
    await renderMapa();
    _atualizarBotoesModo();
  }
  // Chamado pelo botão "➕ Adicionar outra área pra esta peça" dentro do
  // popup de vínculo — pula direto pro desenho (círculo ou polígono, igual
  // ao marcador de onde veio), sem passar pelo seletor de peça de novo, pra
  // marcar um SEGUNDO (ou terceiro...) pedaço que é a MESMA peça.
  async function iniciarNovaAreaParaPeca(pecaId, nome, tipo) {
    if (!Permissions.pode('controleEstacas', 'criar:marcador')) { Utils.toast('Sem permissão para criar.', 'erro'); return; }
    Utils.fecharModal('modal-ce-vincular');
    proximaAreaParaPeca = { pecaId, nome };
    editandoFormaId = null;
    if (tipo === 'circulo') { modo = 'circulo'; } else { modo = 'poligono'; poligonoPontos = []; poligonoPartesExtras = []; }
    await renderMapa();
    _atualizarBotoesModo();
  }
  function cancelarModo() { modo = null; poligonoPontos = []; poligonoPartesExtras = []; proximaAreaParaPeca = null; renderMapa(); _atualizarBotoesModo(); }
  function _atualizarBotoesModo() {
    const bc = document.getElementById('ce-btn-circulo'), bp = document.getElementById('ce-btn-poligono');
    if (bc) bc.className = `btn ${modo === 'circulo' ? 'btn-primario' : 'btn-secundario'} btn-sm`;
    if (bp) bp.className = `btn ${modo === 'poligono' ? 'btn-primario' : 'btn-secundario'} btn-sm`;
  }
  // Desfaz um ponto do pedaço atual; se o pedaço atual já está vazio, desfaz
  // volta o ÚLTIMO pedaço extra (o do botão "➕ Novo pedaço") pra edição.
  function desfazerPontoPoligono() {
    if (poligonoPontos.length) poligonoPontos.pop();
    else if (poligonoPartesExtras.length) poligonoPontos = poligonoPartesExtras.pop();
    renderMapa();
  }
  // "➕ Novo pedaço (área separada)" — fecha o pedaço em desenho (precisa ter
  // >=3 pontos) e guarda em poligonoPartesExtras, liberando pra começar a
  // clicar os vértices de um pedaço novo, em outro lugar da prancha, que ao
  // salvar vira a MESMA área/marcador (mesmo pecaId, mesmo % de execução).
  function novoPedacoPoligono() {
    if (poligonoPontos.length < 3) return;
    poligonoPartesExtras.push(poligonoPontos);
    poligonoPontos = [];
    renderMapa();
  }

  async function _criarMarcadorCirculo(cx, cy, raio) {
    if (!Permissions.pode('controleEstacas', 'criar:marcador')) { Utils.toast('Sem permissão para criar.', 'erro'); return; }
    Utils.mostrarLoading();
    try {
      const viaPeca = proximaAreaParaPeca;
      const id = await Database.criar(obraId, COL_MARCADORES, { pranchaId: pranchaAtivaId, tipo: 'circulo', cx, cy, raio, pecaId: viaPeca ? viaPeca.pecaId : '' }, EC.genId('em'));
      modo = null; proximaAreaParaPeca = null;
      await carregar();
      if (viaPeca) Utils.toast(`✓ Nova área adicionada a ${viaPeca.nome}!`, 'sucesso');
      else abrirVincular(id);
    } catch (e) {
      Utils.toast('Erro ao criar marcador: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  async function concluirPoligono() {
    // O pedaço em desenho vira m.pontos; qualquer pedaço fechado antes (via
    // "➕ Novo pedaço") vira m.partesExtras — tudo o MESMO marcador/vínculo.
    let pontosFinal = poligonoPontos;
    let extras = poligonoPartesExtras;
    if (pontosFinal.length < 3) {
      if (!extras.length) return;
      extras = extras.slice();
      pontosFinal = extras.pop();
    }
    if (!Permissions.pode('controleEstacas', 'criar:marcador')) { Utils.toast('Sem permissão para criar.', 'erro'); return; }
    Utils.mostrarLoading();
    try {
      const pontos = [...pontosFinal];
      const partesExtras = extras.map(pts => ({ pontos: [...pts] }));
      const viaPeca = proximaAreaParaPeca;
      const dados = { pranchaId: pranchaAtivaId, tipo: 'poligono', pontos, pecaId: viaPeca ? viaPeca.pecaId : '' };
      if (partesExtras.length) dados.partesExtras = partesExtras;
      const id = await Database.criar(obraId, COL_MARCADORES, dados, EC.genId('em'));
      modo = null; poligonoPontos = []; poligonoPartesExtras = []; proximaAreaParaPeca = null;
      await carregar();
      if (viaPeca) Utils.toast(`✓ Nova área adicionada a ${viaPeca.nome}!`, 'sucesso');
      else abrirVincular(id);
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
    if (!Permissions.pode('controleEstacas', 'editar:marcador')) { Utils.toast('Sem permissão para editar.', 'erro'); return; }
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
      _arrastarHandle(centro, mv => { const p = EC.posRelativa(mv, stage); m.cx = p.x; m.cy = p.y; _desenharHandlesEdicaoLeve(m); });
      cont.appendChild(centro);

      const w = stage.getBoundingClientRect().width || 1;
      const bordaX = m.cx + m.raio;
      const borda = document.createElement('div');
      borda.style.cssText = `position:absolute;left:${(bordaX * 100).toFixed(3)}%;top:${(m.cy * 100).toFixed(3)}%;width:14px;height:14px;margin:-7px;border-radius:50%;background:#f59e0b;border:2px solid #fff;box-shadow:0 0 0 1px #f59e0b;cursor:ew-resize;z-index:11;pointer-events:auto;`;
      borda.title = 'Arraste pra redimensionar';
      _arrastarHandle(borda, mv => {
        const p = EC.posRelativa(mv, stage);
        m.raio = Math.max(0.004, EC.raioFracao({ x: m.cx, y: m.cy }, p, stage));
        _desenharHandlesEdicaoLeve(m);
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

    // Polígono: vértice a vértice — pode ter vários pedaços (área com
    // partesExtras); cada pedaço fica editável igual, cada um com seus
    // próprios vértices arrastáveis.
    const partes = [m.pontos || [], ...((m.partesExtras || []).map(pe => pe.pontos || []))];
    partes.forEach((pontos, pi) => {
      pontos.forEach((p, i) => {
        const dot = document.createElement('div');
        dot.style.cssText = `position:absolute;left:${(p.x * 100).toFixed(3)}%;top:${(p.y * 100).toFixed(3)}%;width:14px;height:14px;margin:-7px;border-radius:50%;background:#2563eb;border:2px solid #fff;box-shadow:0 0 0 1px #2563eb;cursor:move;z-index:11;pointer-events:auto;`;
        dot.title = 'Arraste pra ajustar este vértice';
        _arrastarHandle(dot, mv => {
          const np = EC.posRelativa(mv, stage);
          if (pi === 0) m.pontos[i] = np; else m.partesExtras[pi - 1].pontos[i] = np;
          _desenharHandlesEdicaoLeve(m);
        });
        cont.appendChild(dot);
      });
    });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:9;';
    partes.forEach(pontos => {
      const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      poly.setAttribute('points', pontos.map(p => `${p.x * 100},${p.y * 100}`).join(' '));
      poly.setAttribute('fill', 'rgba(59,130,246,0.15)');
      poly.setAttribute('stroke', '#2563eb'); poly.setAttribute('stroke-width', '0.3'); poly.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.appendChild(poly);
    });
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
      const data = m.tipo === 'circulo' ? { cx: m.cx, cy: m.cy, raio: m.raio } : { pontos: m.pontos, partesExtras: (m.partesExtras || []).map(pe => ({ pontos: pe.pontos })) };
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
        ${pecaAtual ? `<button class="btn btn-secundario btn-sm" data-perm="controleEstacas:criar:marcador" onclick="CE.iniciarNovaAreaParaPeca('${pecaAtual.id}', '${esc(pecaAtual.nome)}', '${m.tipo}')">➕ Adicionar outra área pra esta peça</button>` : ''}
        <button class="btn btn-secundario btn-sm" data-perm="controleEstacas:editar:marcador" onclick="CE.iniciarAjusteForma('${m.id}')">✎ Ajustar forma</button>
        <button class="btn btn-secundario btn-sm" style="color:var(--cv-red,#ef4444);" data-perm="controleEstacas:excluir:marcador" onclick="CE.excluirMarcador('${m.id}')">🗑 Excluir marcador</button>
      </div>
      ${pecaAtual ? `<p class="text-sm text-muted" style="margin-top:8px;">Use "Adicionar outra área" quando esta peça aparece dividida em pedaços no desenho (ex: uma viga que passa por dentro/atrás de um bloco e continua do outro lado) — os pedaços ficam todos vinculados à mesma peça, com o mesmo % de execução.</p>` : ''}
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
    if (!Permissions.pode('controleEstacas', 'editar:vinculo') && !Permissions.pode('controleEstacas', 'criar:concretagem')) { Utils.toast('Sem permissão.', 'erro'); return; }
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
    if (!Permissions.pode('controleEstacas', 'excluir:marcador')) { Utils.toast('Sem permissão para excluir.', 'erro'); return; }
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
                <button class="btn btn-secundario btn-sm" data-perm="controleEstacas:excluir:marcador" style="color:var(--cv-red);" onclick="CE.excluirMarcador('${m.id}')">🗑</button>
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
    const titulo = document.getElementById('ce-pranchas-titulo');
    if (titulo) titulo.textContent = view === 'estacas' ? '📄 Pranchas — Projeto de Estacas' : '📄 Pranchas — Projeto de Fundações';
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
        <button class="btn btn-primario btn-sm" data-perm="controleEstacas:criar:prancha" onclick="CE.novaPrancha()">+ Adicionar</button>
      </div>
      ${!lista.length ? '<div class="cc-empty">Nenhuma prancha cadastrada ainda. Dê um nome e já escolha o PDF/imagem acima — os dois num passo só.</div>' :
      lista.map(p => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border:1px solid var(--cor-borda-light);border-radius:8px;margin-bottom:8px;">
          <div style="flex:1;">
            <div style="font-weight:600;">${esc(p.nome || 'Prancha')}</div>
            <div class="text-sm text-muted">${p.imgWidthPx ? `${p.imgWidthPx}×${p.imgHeightPx}px` : 'sem PDF/imagem ainda'}</div>
          </div>
          <button class="btn btn-secundario btn-sm" data-perm="controleEstacas:editar:prancha" onclick="CE.abrirUploadImagem('${p.id}')">⊞ ${p.imgWidthPx ? 'Trocar PDF/Imagem' : 'Importar PDF/Imagem'}</button>
          <button class="btn btn-secundario btn-sm" data-perm="controleEstacas:editar:prancha" onclick="CE.renomearPrancha('${p.id}')">✎</button>
          <button class="btn btn-secundario btn-sm" style="color:var(--cv-red,#ef4444);" data-perm="controleEstacas:excluir:prancha" onclick="CE.excluirPrancha('${p.id}')">🗑</button>
        </div>`).join('')}
    `;
    Permissions.aplicarNaTela(document.getElementById('modal-ce-pranchas'));
  }

  async function novaPrancha() {
    if (!Permissions.pode('controleEstacas', 'criar:prancha')) { Utils.toast('Sem permissão para criar.', 'erro'); return; }
    const input = document.getElementById('ce-nova-prancha');
    const fileInput = document.getElementById('ce-nova-prancha-arquivo');
    const nome = input.value.trim();
    if (!nome) return;
    const file = fileInput && fileInput.files && fileInput.files[0];
    Utils.mostrarLoading();
    try {
      const ordem = pranchas.length ? Math.max(...pranchas.map(p => p.ordem || 0)) + 1 : 1;
      const id = await Database.criar(obraId, COL_PRANCHAS, { nome, ordem, tipo: view }, EC.genId('prancha'));
      input.value = '';
      if (file) {
        await _processarArquivoPrancha(file, id);
        fileInput.value = '';
      }
      await carregar();
      renderPranchas();
      pranchaAtivaId = id;
      pranchaAtivaPorView[view] = id;
      if (!file) abrirUploadImagem(id); // não escolheu arquivo ainda agora — abre o upload dedicado na hora
      else Utils.toast('✓ Prancha criada com o PDF/imagem já importado!', 'sucesso');
    } catch (e) {
      Utils.toast('Erro ao criar prancha: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  async function renomearPrancha(id) {
    if (!Permissions.pode('controleEstacas', 'editar:prancha')) { Utils.toast('Sem permissão para editar.', 'erro'); return; }
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
    if (!Permissions.pode('controleEstacas', 'excluir:prancha')) { Utils.toast('Sem permissão para excluir.', 'erro'); return; }
    const qtdMarcadores = marcadores.filter(m => m.pranchaId === id).length;
    const ok = await Utils.confirmar(`Excluir esta prancha${qtdMarcadores ? ` e seus ${qtdMarcadores} marcador(es)` : ''}? Não afeta as peças do Levantamento de Concreto.`);
    if (!ok) return;
    Utils.mostrarLoading();
    try {
      const ops = [{ type: 'delete', ref: Database.ref(obraId, COL_PRANCHAS).doc(id) }];
      marcadores.filter(m => m.pranchaId === id).forEach(m => ops.push({ type: 'delete', ref: Database.ref(obraId, COL_MARCADORES).doc(m.id) }));
      await Database.batchWrite(ops);
      await db.collection('obras').doc(obraId).collection('config').doc('estacasImagem_' + id).delete().catch(() => {});
      await deletarImagem(`obras/${obraId}/estacas-plantas/${id}.png`).catch(() => {});
      if (pranchaAtivaId === id) pranchaAtivaId = null;
      Object.keys(pranchaAtivaPorView).forEach(k => { if (pranchaAtivaPorView[k] === id) pranchaAtivaPorView[k] = null; });
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

  // Processa o PDF/imagem (rasteriza 1ª página se PDF) e sobe pro Storage —
  // usado tanto ao criar a prancha (arquivo já junto) quanto ao trocar
  // depois (modal dedicado). statusEl é opcional (só o modal dedicado tem).
  // Antes ficava em 2200px + JPEG comprimido pra caber no limite de ~950KB
  // do documento Firestore — planta técnica cheia de texto/cota miúdo
  // ficava ilegível ao dar zoom (as estacas/marcadores desenhados por cima,
  // sendo vetor/CSS e não pixel, não perdiam nitidez — só a imagem de fundo).
  // Agora vai pro Storage (sem esse teto), então sobe a resolução de
  // verdade e salva sem perda (PNG) — mesmo pipeline do Controle de
  // Concreto (V3.26.2).
  async function _processarArquivoPrancha(file, pranchaId, statusEl) {
    if (statusEl) statusEl.textContent = 'Processando...';
    let canvas;
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      await _carregarPdfjs();
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      const page = await pdf.getPage(1);
      const viewportBase = page.getViewport({ scale: 1 });
      const alvo = 4500;
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
      canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
    }
    if (statusEl) statusEl.textContent = 'Enviando (planta em alta qualidade pode demorar um pouco)...';
    const dataUrl = canvas.toDataURL('image/png');
    const path = `obras/${obraId}/estacas-plantas/${pranchaId}.png`;
    const url = await uploadImagem(path, dataUrl);
    await Database.atualizar(obraId, COL_PRANCHAS, pranchaId, { imgUrl: url, imgWidthPx: canvas.width, imgHeightPx: canvas.height });
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
    init, recarregar, renderizar, setAbaPrincipal, alternarTelaCheia, toggleMinimizarPainel, toggleMostrarTodosNumeros,
    onTrocarView, onTrocarPranchaAtiva, zoomAjustar, girarPrancha,
    iniciarAdicionarCirculo, iniciarAdicionarPoligono, cancelarModo, desfazerPontoPoligono, novoPedacoPoligono, concluirPoligono, iniciarNovaAreaParaPeca,
    iniciarAjusteForma, concluirAjusteForma, cancelarAjusteForma,
    abrirVincular, salvarVinculo, excluirMarcador,
    onFocoBuscaPeca, fecharListaPecaBusca, onBuscaPeca, selecionarPecaBusca,
    abrirPranchas, novaPrancha, renomearPrancha, excluirPrancha, abrirUploadImagem, onImagemArquivo,
    atribuirConcretagemNumero, atribuirConcretagemNumeroInput, removerDaConcretagem, onTrocarAcompConcretagem, corrigirLancamentosDesalinhados, aplicarCorrecaoDesalinhados,
    toggleNovaConcPlan, criarConcretagemPlan, focarConcretagemPlan, toggleEditarConc, salvarEdicaoConc,
    abrirNovaBT, fecharPainelBT, criarBTEstacas, abrirEditarMetaBT, salvarMetaBT, excluirBTEstacas,
    abrirModalBTs, abrirEstacaModal, btAddLinhaPeca, btRemLinhaPeca, btUpdLinhaPeca, salvarEstacaAcomp, toggleMostrarBTsCompletas,
    toggleMetaInline, salvarMetaBTInline,
    abrirLancarBTFund, btFundBusca, btFundEsconderCompletas, btFundAddLinha, btFundRemLinha, btFundUpdLinha, salvarLancarBTFund,
  };
})();

const CE = ControleEstacas;

function onObraChanged() {
  ControleEstacas.recarregar();
}

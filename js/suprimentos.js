// ============================================
// Módulo: Suprimentos
// Pipeline de compra por tarefa (padrão CSO, com ajustes):
// Cadastro de Solicitação → Mapa de Cotação → Pedido de Compra →
// Mobilização e Produção → Folga → Início da tarefa.
// As datas de cada etapa são calculadas para trás a partir do
// Início Planejado da tarefa (Planejamento), usando durações
// configuráveis (gear). Ao gerar pela 1ª vez, a data planejada de
// cada etapa fica congelada (baseline) para comparação com a data
// real (editada manualmente ao concluir).
// ============================================

const Suprimentos = (() => {
  let obraId = null;
  let tarefas = [];
  let supPorTarefa = {}; // tarefaId -> doc suprimentos
  let cfg = _cfgDefault();
  let overrides = {}; // tarefaId -> {duracaoCadastro,...} (prazo customizado, sobrepõe cfg global)
  let tarefasSelecionadas = {}; // tarefaId -> 'dados' | 'titulo' (ausente = não aparece no Suprimentos)
  let nivelFixoModal = 0; // nível do filtro dentro do modal de config de prazos (independente da seleção)
  // etapaId -> Set de status marcados no filtro (vazio = mostra tudo)
  const statusFiltro = {};

  const COL = 'suprimentos';
  const CFG_DOC = 'suprimentosConfig';
  const SELECAO_DOC = 'suprimentosSelecao';
  const LIMIAR_PROXIMO_DIAS = 15;

  const ETAPAS = [
    { id: 'cadastro',     label: 'Cadastro de Solicitação',   cfgKey: 'duracaoCadastro' },
    { id: 'mapaCotacao',  label: 'Mapa de Cotação',           cfgKey: 'duracaoMapaCotacao' },
    { id: 'pedidoCompra', label: 'Pedido de Compra',          cfgKey: 'duracaoPedidoCompra' },
    { id: 'mobilizacao',  label: 'Mobilização e Produção',    cfgKey: 'duracaoMobilizacao' },
    { id: 'folga',        label: 'Folga',                     cfgKey: 'duracaoFolga' },
  ];

  function _cfgDefault() {
    // Do Mapa de Cotação até o Início: duracaoPedidoCompra + duracaoMobilizacao +
    // duracaoFolga = 30 dias — atende a exigência de "pelo menos 1 mês antes".
    return { duracaoCadastro: 10, duracaoMapaCotacao: 15, duracaoPedidoCompra: 15, duracaoMobilizacao: 10, duracaoFolga: 5 };
  }

  // ---- Init ----
  async function init() {
    const ok = await Utils.initPagina({ requireObra: true });
    if (!ok) return;
    obraId = Router.getObraId();
    if (!obraId) {
      const c = document.getElementById('modulo-content');
      if (c) c.innerHTML = '<div class="estado-vazio"><div class="icone">📦</div><p>Selecione uma obra.</p></div>';
      return;
    }
    await carregar();
  }

  async function carregar() {
    try {
      Utils.mostrarLoading('Carregando suprimentos...');
      const [tf, cfgDoc, supList, selecaoDoc] = await Promise.all([
        Database.listar(obraId, 'tarefas', 'ordem').catch(() => []),
        Database.obter(obraId, 'config', CFG_DOC).catch(() => null),
        Database.listar(obraId, COL, 'createdAt').catch(() => []),
        Database.obter(obraId, 'config', SELECAO_DOC).catch(() => null),
      ]);
      tarefas = tf;
      if (cfgDoc) { cfg = { ..._cfgDefault(), ...cfgDoc }; overrides = cfgDoc.overrides || {}; delete cfg.overrides; }
      // Retrocompatível: versão antiga salvava um array simples de tarefaIds
      // (todas em modo 'dados'). Versão nova salva { tarefaId: modo }.
      if (selecaoDoc && Array.isArray(selecaoDoc.tarefaIds)) {
        tarefasSelecionadas = {};
        selecaoDoc.tarefaIds.forEach(id => { tarefasSelecionadas[id] = 'dados'; });
      } else {
        tarefasSelecionadas = (selecaoDoc && selecaoDoc.modos) || {};
      }
      supPorTarefa = {};
      supList.forEach(s => { supPorTarefa[s.tarefaId] = s; });

      await _gerarPendentes();
      renderizar();
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao carregar suprimentos: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // Prazo efetivo de uma tarefa: override próprio, senão o global.
  function _cfgPara(tarefaId) {
    return overrides[tarefaId] || cfg;
  }

  // Cria o doc de suprimentos (com datas planejadas congeladas) para toda
  // tarefa SELECIONADA manualmente (config ⚙️) com Início Planejado que
  // ainda não tem doc. Não depende mais de ser folha — a seleção manual é
  // que decide o que entra no pipeline.
  async function _gerarPendentes() {
    const criacoes = [];
    tarefas.forEach((t) => {
      if (tarefasSelecionadas[t.id] !== 'dados' || !t.inicioPlanejado || supPorTarefa[t.id]) return;
      const datas = _calcularDatas(t.inicioPlanejado, _cfgPara(t.id));
      const etapasDoc = {};
      ETAPAS.forEach(e => { etapasDoc[e.id] = { planejada: datas[e.id], data: datas[e.id], status: 'nao_iniciado', manual: false }; });
      const doc = { tarefaId: t.id, etapas: etapasDoc };
      criacoes.push(Database.criar(obraId, COL, doc, t.id).then(() => { supPorTarefa[t.id] = doc; }));
    });
    if (criacoes.length) await Promise.all(criacoes).catch(e => console.warn('Falha ao gerar suprimentos pendentes:', e.message));
  }

  // Calcula as 5 datas planejadas contando para trás a partir do início.
  function _calcularDatas(inicioPlanejado, c) {
    const oneDay = 864e5;
    const ini = new Date(inicioPlanejado + 'T12:00:00');
    const dFolga = new Date(ini - (c.duracaoFolga || 0) * oneDay);
    const dMobilizacao = new Date(dFolga - (c.duracaoMobilizacao || 0) * oneDay);
    const dPedidoCompra = new Date(dMobilizacao - (c.duracaoPedidoCompra || 0) * oneDay);
    const dMapaCotacao = new Date(dPedidoCompra - (c.duracaoMapaCotacao || 0) * oneDay);
    const dCadastro = new Date(dMapaCotacao - (c.duracaoCadastro || 0) * oneDay);
    const iso = (d) => d.toISOString().split('T')[0];
    return { cadastro: iso(dCadastro), mapaCotacao: iso(dMapaCotacao), pedidoCompra: iso(dPedidoCompra), mobilizacao: iso(dMobilizacao), folga: iso(dFolga) };
  }

  // ---- Render ----
  function _nivelMaximo(sorted) {
    return sorted.reduce((max, t) => Math.max(max, t.nivel || 0), 0);
  }

  function renderizar() {
    const container = document.getElementById('modulo-content');
    if (!container) return;
    const headerActions = document.getElementById('header-actions');
    if (headerActions) headerActions.innerHTML = `
      <button class="btn btn-secundario" onclick="Suprimentos.abrirSelecao()">☑️ Configurar Suprimentos</button>
      <button class="btn btn-secundario" onclick="Suprimentos.abrirConfig()">⚙️ Prazos das Etapas</button>`;

    if (!tarefas.length) {
      container.innerHTML = '<div class="estado-vazio"><div class="icone">📦</div><p>Nenhuma tarefa no Planejamento ainda.</p></div>';
      return;
    }

    if (!Object.keys(tarefasSelecionadas).length) {
      container.innerHTML = `<div class="estado-vazio"><div class="icone">📦</div><p>Nenhuma tarefa selecionada para Suprimentos ainda.</p><p class="text-sm text-muted">Clique em "☑️ Configurar Suprimentos" e marque as tarefas do cronograma que precisam de suprimento.</p></div>
        ${_modalSelecaoHTML()}
        ${_modalConfigHTML()}`;
      return;
    }

    const sorted = [...tarefas].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    let linhas = '';
    sorted.forEach((t) => {
      const modo = tarefasSelecionadas[t.id];
      if (!modo) return;
      linhas += modo === 'titulo' ? _linhaTitulo(t) : _linhaFolha(t);
    });
    if (!linhas) linhas = `<tr><td colspan="${ETAPAS.length * 2 + 3}" class="text-sm text-muted" style="text-align:center;padding:20px;">Nenhuma tarefa selecionada bate com o filtro de status.</td></tr>`;

    container.innerHTML = `
      <div class="tabela-container">
        <table class="tabela tabela-compacta" style="table-layout:fixed;width:100%;">
          <thead>
            <tr>
              <th rowspan="2" style="width:14%;">Nome da Tarefa</th>
              ${ETAPAS.map(e => `<th colspan="2" style="text-align:center;">${e.label}</th>`).join('')}
              <th rowspan="2">Desvio</th>
              <th rowspan="2">Início</th>
            </tr>
            <tr>
              ${ETAPAS.map(e => `<th style="font-weight:400;">Data</th><th style="font-weight:400;position:relative;">
                <span style="display:inline-flex;align-items:center;gap:3px;cursor:pointer;" onclick="event.stopPropagation();Suprimentos._toggleFiltroStatus('${e.id}')">
                  Status <span style="font-size:.65rem;color:${statusFiltro[e.id]&&statusFiltro[e.id].size?'var(--cor-primaria)':'#999'};">▼</span>
                </span>
              </th>`).join('')}
            </tr>
          </thead>
          <tbody>${linhas}</tbody>
        </table>
      </div>
      ${_modalSelecaoHTML()}
      ${_modalConfigHTML()}
    `;
  }

  // Linha "título" (2º clique no checkbox de seleção): só o nome, sem
  // pipeline nenhum — serve pra organizar visualmente, ex. mostrar um pai
  // acima de um grupo de filhos sem gerar dados de suprimento pra ele.
  function _linhaTitulo(t) {
    const ind = 8 + (t.nivel || 0) * 16;
    return `<tr class="linha-grupo-suprimentos">
      <td style="padding-left:${ind}px;font-weight:700;color:#555;word-wrap:break-word;overflow-wrap:break-word;">${t.nome}</td>
      <td colspan="${ETAPAS.length * 2 + 2}"></td>
    </tr>`;
  }

  function _linhaFolha(t) {
    const ind = 8 + (t.nivel || 0) * 16;
    const s = supPorTarefa[t.id];
    if (!t.inicioPlanejado || !s) {
      return `<tr>
        <td style="padding-left:${ind}px;word-wrap:break-word;overflow-wrap:break-word;">${t.nome}</td>
        <td colspan="${ETAPAS.length * 2}" class="text-sm text-muted" style="text-align:center;">Sem Início Planejado — defina no Planejamento</td>
        <td></td><td></td>
      </tr>`;
    }
    for (const e of ETAPAS) {
      const filtro = statusFiltro[e.id];
      if (filtro && filtro.size) {
        const et = s.etapas[e.id];
        if (!et || !filtro.has(et.status)) return '';
      }
    }
    const celulas = ETAPAS.map(e => _celulaEtapa(t.id, e.id, s.etapas[e.id])).join('');
    const desvio = _calcDesvio(t);
    const inicioLabel = Utils.formatarData(t.inicioReal || t.inicioPlanejado);
    return `<tr>
      <td style="padding-left:${ind}px;word-wrap:break-word;overflow-wrap:break-word;">${t.nome}</td>
      ${celulas}
      <td class="col-num" style="text-align:center;${desvio!=null&&desvio>0?'color:var(--cor-perigo);font-weight:700;':'color:var(--cor-texto-muted);'}">${desvio==null?'—':(desvio>0?'+':'')+desvio}</td>
      <td class="col-num" style="text-align:center;font-family:var(--font-mono);">${inicioLabel}</td>
    </tr>`;
  }

  // ---- Modal de Seleção: escolher manualmente quais tarefas do Planejamento
  // entram no pipeline de Suprimentos. Mostra a árvore inteira (todos os
  // níveis), com um marcador de 3 estados por linha:
  //  vazio → não aparece | ✓ (dados) → linha completa com pipeline
  //  ● (titulo) → aparece só como título/cabeçalho, sem dados nem pipeline
  // Evita ter que filtrar por nível ou lidar com grupos sem dados: o
  // usuário decide exatamente o que aparece e como.
  let _selecaoTemp = null; // {tarefaId: modo} local editado no modal, só vira oficial ao Salvar

  function abrirSelecao() {
    _selecaoTemp = { ...tarefasSelecionadas };
    _reabrirModalSelecao();
    Utils.abrirModal('modal-selecao-suprimentos');
  }
  function fecharSelecao() {
    _selecaoTemp = null;
    Utils.fecharModal('modal-selecao-suprimentos');
  }

  // Aparência do marcador de 3 estados conforme o modo atual.
  function _marcadorHTML(tarefaId, modo) {
    if (modo === 'dados') {
      return `<div data-sel-marcador="${tarefaId}" onclick="Suprimentos._cicloSelecao('${tarefaId}')" title="Aparece com dados (pipeline completo) — clique para mudar" style="width:18px;height:18px;flex-shrink:0;border:2px solid var(--cor-sucesso);background:var(--cor-sucesso);border-radius:4px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;font-size:.7rem;font-weight:900;line-height:1;">✓</div>`;
    }
    if (modo === 'titulo') {
      return `<div data-sel-marcador="${tarefaId}" onclick="Suprimentos._cicloSelecao('${tarefaId}')" title="Aparece só como título (sem pipeline) — clique para mudar" style="width:18px;height:18px;flex-shrink:0;border:2px solid var(--cor-info);border-radius:4px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
        <span style="width:8px;height:8px;border-radius:50%;background:var(--cor-info);"></span>
      </div>`;
    }
    return `<div data-sel-marcador="${tarefaId}" onclick="Suprimentos._cicloSelecao('${tarefaId}')" title="Não aparece no Suprimentos — clique para mudar" style="width:18px;height:18px;flex-shrink:0;border:2px solid var(--cor-borda);border-radius:4px;cursor:pointer;"></div>`;
  }

  function _modalSelecaoHTML() {
    const sorted = [...tarefas].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    const modos = _selecaoTemp || tarefasSelecionadas;
    const linhas = sorted.map(t => {
      const ind = 8 + (t.nivel || 0) * 18;
      const icone = t.tipo === 'grupo' ? '📁 ' : '';
      return `<div style="display:flex;align-items:center;gap:8px;padding:5px 4px;padding-left:${ind}px;border-bottom:1px solid var(--cor-borda-light);">
        ${_marcadorHTML(t.id, modos[t.id])}
        <span style="font-size:.82rem;${t.tipo==='grupo'?'font-weight:700;color:#555;':''}">${icone}${t.nome}</span>
      </div>`;
    }).join('');
    return `
      <div class="modal-overlay" id="modal-selecao-suprimentos">
        <div class="modal" style="max-width:700px;width:95%;">
          <div class="modal-header"><h3>Configurar Suprimentos — selecionar tarefas</h3></div>
          <div class="modal-body" style="max-height:65vh;overflow-y:auto;">
            <p class="text-sm text-muted" style="margin-bottom:10px;">Clique no marcador pra alternar: vazio → <b style="color:var(--cor-sucesso);">✓ com dados</b> (pipeline completo) → <b style="color:var(--cor-info);">● só título</b> (linha em branco, sem pipeline) → vazio de novo.</p>
            <div>${linhas || '<p class="text-sm text-muted">Nenhuma tarefa no Planejamento.</p>'}</div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secundario" onclick="Suprimentos.fecharSelecao()">Cancelar</button>
            <button class="btn btn-primario" onclick="Suprimentos.salvarSelecao()">Salvar Seleção</button>
          </div>
        </div>
      </div>`;
  }

  function _reabrirModalSelecao() {
    const wrap = document.createElement('div');
    wrap.innerHTML = _modalSelecaoHTML();
    const novo = wrap.firstElementChild;
    const antigo = document.getElementById('modal-selecao-suprimentos');
    if (antigo) antigo.replaceWith(novo);
  }

  // Cicla o estado do marcador: ausente → 'dados' → 'titulo' → ausente.
  // Atualiza só o marcador clicado no DOM (sem re-render do modal inteiro).
  function _cicloSelecao(tarefaId) {
    if (!_selecaoTemp) return;
    const atual = _selecaoTemp[tarefaId];
    let novo;
    if (!atual) novo = 'dados';
    else if (atual === 'dados') novo = 'titulo';
    else novo = null;
    if (novo) _selecaoTemp[tarefaId] = novo; else delete _selecaoTemp[tarefaId];
    const el = document.querySelector(`[data-sel-marcador="${tarefaId}"]`);
    if (el) el.outerHTML = _marcadorHTML(tarefaId, novo);
  }

  // Salva a seleção e sincroniza o pipeline: apaga docs de suprimentos de
  // tarefas que saíram da lista OU viraram 'titulo' (título não tem
  // pipeline), gera pendentes das que entraram em modo 'dados'.
  async function salvarSelecao() {
    if (!_selecaoTemp) return;
    try {
      Utils.mostrarLoading('Salvando seleção...');
      const novaSelecao = _selecaoTemp;
      const idsAntigos = Object.keys(tarefasSelecionadas);
      const removidas = idsAntigos.filter(id => novaSelecao[id] !== 'dados' && supPorTarefa[id]);
      await Promise.all(removidas.map(id => Database.deletar(obraId, COL, id).catch(e => console.warn('Falha ao remover suprimento:', e.message))));
      removidas.forEach(id => { delete supPorTarefa[id]; });

      tarefasSelecionadas = novaSelecao;
      await Database.criar(obraId, 'config', { modos: tarefasSelecionadas }, SELECAO_DOC)
        .catch(() => Database.atualizar(obraId, 'config', SELECAO_DOC, { modos: tarefasSelecionadas }));

      await _gerarPendentes();
      Utils.toast('Seleção de Suprimentos atualizada', 'sucesso');
      fecharSelecao();
      renderizar();
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao salvar seleção: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ---- Filtro por status (por etapa, ▼ no cabeçalho) ----
  function _toggleFiltroStatus(etapaId) {
    let pop = document.getElementById('sup-status-filtro-pop');
    if (pop) { const mesma = pop.dataset.etapa === etapaId; pop.remove(); if (mesma) return; }
    pop = document.createElement('div');
    pop.id = 'sup-status-filtro-pop';
    pop.dataset.etapa = etapaId;
    pop.style.cssText = 'position:fixed;top:130px;left:50%;transform:translateX(-50%);background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:12px;z-index:2000;min-width:200px;box-shadow:0 8px 32px rgba(0,0,0,.5);';
    const atual = statusFiltro[etapaId] || new Set();
    const itens = Object.entries(STATUS_INFO).map(([key, info]) => `
      <label style="display:flex;align-items:center;gap:8px;padding:5px 2px;cursor:pointer;">
        <input type="checkbox" data-status-key="${key}" ${atual.has(key) ? 'checked' : ''} style="width:13px;height:13px;">
        <span style="width:9px;height:9px;border-radius:50%;background:${info.cor};display:inline-block;flex-shrink:0;"></span>
        <span style="font-size:.8rem;color:#ddd;">${info.label}</span>
      </label>`).join('');
    pop.innerHTML = `<div style="font-weight:700;color:var(--cor-primaria);margin-bottom:8px;font-size:.8rem;">Filtrar Status</div>
      ${itens}
      <button class="btn btn-primario btn-sm" style="width:100%;margin-top:10px;" onclick="Suprimentos._aplicarFiltroStatus('${etapaId}')">Filtrar</button>`;
    document.body.appendChild(pop);
    setTimeout(() => document.addEventListener('click', function h(ev) { if (!pop.contains(ev.target)) { pop.remove(); document.removeEventListener('click', h); } }, false), 50);
  }

  function _aplicarFiltroStatus(etapaId) {
    const pop = document.getElementById('sup-status-filtro-pop');
    if (!pop) return;
    const marcados = new Set([...pop.querySelectorAll('input[data-status-key]:checked')].map(i => i.dataset.statusKey));
    statusFiltro[etapaId] = marcados;
    pop.remove();
    renderizar();
  }

  function _calcDesvio(t) {
    if (!t.inicioReal || !t.inicioPlanejado) return null;
    return Math.round((new Date(t.inicioReal) - new Date(t.inicioPlanejado)) / 864e5);
  }

  const STATUS_INFO = {
    nao_iniciado: { label: 'Não Iniciado', cor: 'var(--cor-texto-muted)', bg: '#F0F0F0' },
    em_andamento: { label: 'Em Andamento', cor: 'var(--cor-info)', bg: 'var(--cor-info-bg)' },
    concluido:    { label: 'Concluído',    cor: 'var(--cor-sucesso)', bg: 'var(--cor-sucesso-bg)' },
  };

  function _corPrazo(e, hoje) {
    if (e.status === 'concluido') return { cor: 'var(--cor-sucesso)', bg: 'var(--cor-sucesso-bg)' };
    if (e.data < hoje) return { cor: 'var(--cor-perigo)', bg: 'var(--cor-perigo-bg)' };
    if ((new Date(e.data) - new Date(hoje)) / 864e5 <= LIMIAR_PROXIMO_DIAS) return { cor: 'var(--cor-alerta)', bg: 'var(--cor-alerta-bg)' };
    return { cor: 'var(--cor-texto-muted)', bg: 'transparent' };
  }

  function _celulaEtapa(tarefaId, etapaId, e) {
    if (!e) return '<td>—</td><td>—</td>';
    const hoje = Utils.hoje();
    const { cor, bg } = _corPrazo(e, hoje);
    const st = STATUS_INFO[e.status] || STATUS_INFO.nao_iniciado;
    const tooltip = e.manual ? `Editado manualmente (automático seria ${Utils.formatarData(e.planejada)})` : 'Automático — ainda não editado';
    // Pill compacto: o <input type="date"> real fica por baixo (funcional,
    // abre o calendário do navegador ao clicar), mas sem o ícone/borda
    // nativos — só o texto formatado com fundo colorido, no padrão pedido.
    const inputStyle = `width:100%;border:none;background:${bg};color:${cor};font-size:.74rem;font-weight:700;font-family:var(--font-mono);padding:5px 2px;border-radius:4px;box-sizing:border-box;text-align:center;cursor:pointer;-webkit-appearance:none;appearance:none;`;
    const selStyle = `width:100%;border:1px solid var(--cor-borda);background:#fff;color:var(--cor-texto);font-size:.72rem;padding:5px 2px;border-radius:4px;box-sizing:border-box;cursor:pointer;`;
    return `
      <td class="sup-cel-data" data-tarefa="${tarefaId}" data-etapa="${etapaId}" style="padding:2px;" title="${tooltip}">
        <input type="date" value="${e.data}" style="${inputStyle}" onchange="Suprimentos.onDataInlineChange('${tarefaId}','${etapaId}',this.value)">
      </td>
      <td class="sup-cel-status" data-tarefa="${tarefaId}" data-etapa="${etapaId}" style="padding:2px;">
        <select style="${selStyle}" onchange="Suprimentos.onStatusInlineChange('${tarefaId}','${etapaId}',this.value)">
          ${Object.entries(STATUS_INFO).map(([key, info]) => `<option value="${key}" ${e.status===key?'selected':''}>${info.label}</option>`).join('')}
        </select>
      </td>`;
  }

  // ---- Edição inline (sem popup) ----
  // Atualiza só a célula editada no DOM (sem reconstruir a tabela inteira) —
  // reconstruir tudo a cada clique era o que deixava a edição lenta/travada.
  // O save no Firestore roda em background (local-first).
  function _repintarCelulas(tarefaId, etapaId) {
    const s = supPorTarefa[tarefaId];
    const e = s && s.etapas[etapaId];
    if (!e) return;
    const tdData = document.querySelector(`.sup-cel-data[data-tarefa="${tarefaId}"][data-etapa="${etapaId}"]`);
    const tdStatus = document.querySelector(`.sup-cel-status[data-tarefa="${tarefaId}"][data-etapa="${etapaId}"]`);
    if (!tdData || !tdStatus) return;
    const par = document.createElement('tr');
    par.innerHTML = _celulaEtapa(tarefaId, etapaId, e);
    tdData.replaceWith(par.children[0]);
    tdStatus.replaceWith(par.children[1]);
  }

  async function onDataInlineChange(tarefaId, etapaId, novaData) {
    const s = supPorTarefa[tarefaId];
    if (!s || !novaData) return;
    s.etapas[etapaId].data = novaData;
    s.etapas[etapaId].manual = true; // essa etapa deixou de ser automática
    _repintarCelulas(tarefaId, etapaId);
    try {
      await Database.atualizar(obraId, COL, tarefaId, { etapas: s.etapas });
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao salvar data: ' + e.message, 'erro');
    }
  }

  async function onStatusInlineChange(tarefaId, etapaId, novoStatus) {
    const s = supPorTarefa[tarefaId];
    if (!s) return;
    s.etapas[etapaId].status = novoStatus;
    _repintarCelulas(tarefaId, etapaId);
    try {
      await Database.atualizar(obraId, COL, tarefaId, { etapas: s.etapas });
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao salvar status: ' + e.message, 'erro');
    }
  }

  // ---- Config (prazos padrão + override por tarefa) ----
  function abrirConfig() {
    nivelFixoModal = 0;
    Utils.abrirModal('modal-config-suprimentos');
  }
  function fecharConfig() {
    Utils.fecharModal('modal-config-suprimentos');
  }

  function _descendentes(t, sorted, i) {
    const niv = t.nivel || 0;
    const filhos = [];
    for (let k = i + 1; k < sorted.length; k++) {
      const s2 = sorted[k];
      if ((s2.nivel || 0) <= niv) break;
      filhos.push(s2);
    }
    return filhos;
  }

  function _modalConfigHTML() {
    const sorted = [...tarefas].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    const max = _nivelMaximo(sorted);
    const nivelEfetivo = Math.min(nivelFixoModal, max);
    let botoesNivel = '';
    for (let n = 0; n <= max; n++) {
      botoesNivel += `<button class="btn btn-sm ${nivelFixoModal === n ? 'btn-primario' : 'btn-secundario'}" style="font-size:.7rem;padding:2px 8px;" onclick="Suprimentos._setNivelModal(${n})">Nível ${n}</button>`;
    }
    const itensLista = sorted
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => (t.nivel || 0) === nivelEfetivo)
      .map(({ t }) => {
        const customizado = !!overrides[t.id];
        return `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 4px;border-bottom:1px solid var(--cor-borda-light);">
          <div>
            <div style="font-size:.85rem;">${t.nome}</div>
            <div class="text-sm" style="color:${customizado?'var(--cor-info)':'var(--cor-texto-muted)'};">${customizado?'Customizado':'Padrão'}</div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0;">
            <button class="btn btn-sm btn-secundario" onclick="Suprimentos._editarOverride('${t.id}')" title="Editar prazo desta tarefa (e filhos, se houver)">✏️</button>
            ${customizado ? `<button class="btn btn-sm btn-secundario" onclick="Suprimentos._removerOverride('${t.id}')" title="Voltar ao padrão">↺</button>` : ''}
          </div>
        </div>`;
      }).join('');

    return `
      <div class="modal-overlay" id="modal-config-suprimentos">
        <div class="modal" style="max-width:900px;width:95%;">
          <div class="modal-header"><h3>Configurações de Suprimentos</h3></div>
          <div class="modal-body" style="display:flex;gap:20px;max-height:70vh;">
            <div style="flex:1;min-width:220px;overflow-y:auto;">
              <h4 style="margin-bottom:10px;">Leadtimes Padrão</h4>
              <p class="text-sm text-muted" style="margin-bottom:12px;">Duração (dias) de cada etapa, contada para trás a partir do Início Planejado. Vale para toda tarefa sem prazo customizado.</p>
              ${ETAPAS.map(e => `
                <div class="form-grupo">
                  <label>${e.label} (dias)</label>
                  <input type="number" min="0" class="form-control" id="cfg-${e.cfgKey}" value="${cfg[e.cfgKey]}">
                </div>`).join('')}
            </div>
            <div style="flex:1.4;min-width:280px;border-left:1px solid var(--cor-borda-light);padding-left:20px;overflow-y:auto;">
              <h4 style="margin-bottom:10px;">Prazo por Tarefa</h4>
              <p class="text-sm text-muted" style="margin-bottom:8px;">Filtre por nível e customize uma tarefa específica. Editar um pai aplica o mesmo prazo a todos os filhos dele.</p>
              <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;">${botoesNivel}</div>
              <div>${itensLista || '<p class="text-sm text-muted">Nenhuma tarefa neste nível.</p>'}</div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secundario" onclick="Suprimentos.fecharConfig()">Cancelar</button>
            <button class="btn btn-primario" onclick="Suprimentos.salvarConfig()">Salvar e Recalcular Pendentes</button>
          </div>
        </div>
      </div>
      ${_modalOverrideHTML()}`;
  }

  function _setNivelModal(n) {
    nivelFixoModal = n;
    _reabrirModalConfig();
  }

  // Reconstrói só o conteúdo dos modais de config (sem re-render da tabela
  // toda atrás) — substitui cada um pelo id, sem depender de índice de nó.
  function _reabrirModalConfig() {
    const wrap = document.createElement('div');
    wrap.innerHTML = _modalConfigHTML();
    const novoConfig = wrap.querySelector('#modal-config-suprimentos');
    const novoOverride = wrap.querySelector('#modal-override-tarefa');
    const antigoConfig = document.getElementById('modal-config-suprimentos');
    const antigoOverride = document.getElementById('modal-override-tarefa');
    if (antigoConfig && novoConfig) antigoConfig.replaceWith(novoConfig);
    if (antigoOverride && novoOverride) antigoOverride.replaceWith(novoOverride);
    Utils.abrirModal('modal-config-suprimentos');
  }

  // ---- Modal secundário: editar prazo de UMA tarefa (e filhos, se houver) ----
  let _overrideAlvoId = null;
  function _modalOverrideHTML() {
    return `
      <div class="modal-overlay" id="modal-override-tarefa" style="z-index:2100;">
        <div class="modal">
          <div class="modal-header"><h3 id="override-titulo">Prazo da Tarefa</h3></div>
          <div class="modal-body">
            ${ETAPAS.map(e => `
              <div class="form-grupo">
                <label>${e.label} (dias)</label>
                <input type="number" min="0" class="form-control" id="ov-${e.cfgKey}" value="0">
              </div>`).join('')}
          </div>
          <div class="modal-footer">
            <button class="btn btn-secundario" onclick="Suprimentos._fecharModalOverride()">Cancelar</button>
            <button class="btn btn-primario" onclick="Suprimentos._confirmarOverride()">Aplicar</button>
          </div>
        </div>
      </div>`;
  }

  function _editarOverride(tarefaId) {
    _overrideAlvoId = tarefaId;
    const t = tarefas.find(x => x.id === tarefaId);
    const atual = overrides[tarefaId] || cfg;
    const titulo = document.getElementById('override-titulo');
    if (titulo) titulo.textContent = `Prazo — ${t ? t.nome : ''}`;
    ETAPAS.forEach(e => {
      const input = document.getElementById(`ov-${e.cfgKey}`);
      if (input) input.value = atual[e.cfgKey];
    });
    Utils.abrirModal('modal-override-tarefa');
  }

  function _fecharModalOverride() {
    Utils.fecharModal('modal-override-tarefa');
  }

  // Aplica o prazo editado à tarefa alvo E a todos os descendentes dela
  // (se for um grupo/pai). Grava direto em `overrides` local; persiste
  // no Firestore só quando "Salvar e Recalcular Pendentes" for clicado.
  function _confirmarOverride() {
    if (!_overrideAlvoId) return;
    const novoPrazo = {};
    ETAPAS.forEach(e => { novoPrazo[e.cfgKey] = parseInt(document.getElementById(`ov-${e.cfgKey}`)?.value) || 0; });
    const sorted = [...tarefas].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    const idx = sorted.findIndex(t => t.id === _overrideAlvoId);
    const alvo = sorted[idx];
    const alvos = [alvo, ...(idx >= 0 ? _descendentes(alvo, sorted, idx) : [])];
    alvos.forEach(t => { overrides[t.id] = { ...novoPrazo }; });
    _fecharModalOverride();
    _reabrirModalConfig();
  }

  function _removerOverride(tarefaId) {
    const sorted = [...tarefas].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    const idx = sorted.findIndex(t => t.id === tarefaId);
    const alvo = sorted[idx];
    const alvos = [alvo, ...(idx >= 0 ? _descendentes(alvo, sorted, idx) : [])];
    alvos.forEach(t => { delete overrides[t.id]; });
    _reabrirModalConfig();
  }

  async function salvarConfig() {
    const novaCfg = {};
    ETAPAS.forEach(e => { novaCfg[e.cfgKey] = parseInt(document.getElementById(`cfg-${e.cfgKey}`)?.value) || 0; });
    try {
      Utils.mostrarLoading('Salvando prazos...');
      const payload = { ...novaCfg, overrides };
      await Database.criar(obraId, 'config', payload, CFG_DOC).catch(() => Database.atualizar(obraId, 'config', CFG_DOC, payload));
      cfg = novaCfg;
      await _recalcularNaoEditados();
      Utils.toast('Prazos atualizados', 'sucesso');
      fecharConfig();
      renderizar();
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao salvar prazos: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // Recalcula a data planejada de cada etapa que NÃO foi editada manualmente
  // (etapa por etapa — se só o Pedido de Compra foi editado à mão, as outras
  // 4 etapas daquela mesma tarefa continuam recalculando normal). Usa o
  // prazo efetivo de cada tarefa (override próprio ou o padrão global).
  async function _recalcularNaoEditados() {
    const atualizacoes = [];
    Object.values(supPorTarefa).forEach(s => {
      const t = tarefas.find(x => x.id === s.tarefaId);
      if (!t || !t.inicioPlanejado) return;
      const datas = _calcularDatas(t.inicioPlanejado, _cfgPara(t.id));
      let mudou = false;
      ETAPAS.forEach(e => {
        const et = s.etapas[e.id];
        if (!et) return;
        et.planejada = datas[e.id];
        if (!et.manual) { et.data = datas[e.id]; mudou = true; }
      });
      if (mudou) atualizacoes.push(Database.atualizar(obraId, COL, s.tarefaId, { etapas: s.etapas }));
    });
    if (atualizacoes.length) await Promise.all(atualizacoes).catch(e => console.warn('Falha ao recalcular:', e.message));
  }

  return {
    init, renderizar, abrirConfig, fecharConfig, salvarConfig, onDataInlineChange, onStatusInlineChange,
    abrirSelecao, fecharSelecao, salvarSelecao, _cicloSelecao,
    _toggleFiltroStatus, _aplicarFiltroStatus,
    _setNivelModal, _editarOverride, _fecharModalOverride, _confirmarOverride, _removerOverride,
  };
})();

function onObraChanged() { Suprimentos.init(); }

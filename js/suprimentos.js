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
  let nivelFixo = parseInt(localStorage.getItem('sup_nivel_fixo'), 10);
  if (!Number.isFinite(nivelFixo)) nivelFixo = 0;
  // etapaId -> Set de status marcados no filtro (vazio = mostra tudo)
  const statusFiltro = {};

  const COL = 'suprimentos';
  const CFG_DOC = 'suprimentosConfig';
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
      const [tf, cfgDoc, supList] = await Promise.all([
        Database.listar(obraId, 'tarefas', 'ordem').catch(() => []),
        Database.obter(obraId, 'config', CFG_DOC).catch(() => null),
        Database.listar(obraId, COL, 'createdAt').catch(() => []),
      ]);
      tarefas = tf;
      if (cfgDoc) cfg = { ..._cfgDefault(), ...cfgDoc };
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

  // Cria o doc de suprimentos (com datas planejadas congeladas) para toda
  // tarefa-folha com Início Planejado que ainda não tem doc.
  async function _gerarPendentes() {
    const sorted = [...tarefas].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    const criacoes = [];
    sorted.forEach((t, i) => {
      const nxt = sorted[i + 1];
      const isFolha = !nxt || (nxt.nivel || 0) <= (t.nivel || 0);
      if (!isFolha || !t.inicioPlanejado || supPorTarefa[t.id]) return;
      const datas = _calcularDatas(t.inicioPlanejado, cfg);
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
  function _isFolha(t, sorted, i) {
    const nxt = sorted[i + 1];
    return !nxt || (nxt.nivel || 0) <= (t.nivel || 0);
  }

  function _nivelMaximo(sorted) {
    return sorted.reduce((max, t) => Math.max(max, t.nivel || 0), 0);
  }

  // Filtro por nível (igual ao painel Dashboard): fixa uma "linha de corte"
  // — só tarefas nesse nível aparecem (folha com dados, ou grupo só com
  // nome se tiver filhos). Fora desse nível, a linha fica oculta.
  function _controleNivel(max) {
    let botoes = '';
    for (let n = 0; n <= max; n++) {
      botoes += `<button class="btn btn-sm ${nivelFixo === n ? 'btn-primario' : 'btn-secundario'}" style="font-size:.72rem;padding:3px 10px;" onclick="Suprimentos._setNivelFixo(${n})">Nível ${n}</button>`;
    }
    return `<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;">${botoes}</div>`;
  }

  function _setNivelFixo(n) {
    nivelFixo = n;
    localStorage.setItem('sup_nivel_fixo', String(n));
    renderizar();
  }

  function renderizar() {
    const container = document.getElementById('modulo-content');
    if (!container) return;
    const headerActions = document.getElementById('header-actions');
    if (headerActions) headerActions.innerHTML = `<button class="btn btn-secundario" onclick="Suprimentos.abrirConfig()">⚙️ Prazos das Etapas</button>`;

    if (!tarefas.length) {
      container.innerHTML = '<div class="estado-vazio"><div class="icone">📦</div><p>Nenhuma tarefa no Planejamento ainda.</p></div>';
      return;
    }

    const sorted = [...tarefas].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    const max = _nivelMaximo(sorted);
    const nivelEfetivo = Math.min(nivelFixo, max);

    let linhas = '';
    sorted.forEach((t, i) => {
      const nivel = t.nivel || 0;
      if (nivel !== nivelEfetivo) return; // só mostra a "linha de corte" fixada
      const isFolha = _isFolha(t, sorted, i);
      linhas += isFolha ? _linhaFolha(t) : _linhaGrupo(t);
    });
    if (!linhas) linhas = `<tr><td colspan="${ETAPAS.length * 2 + 3}" class="text-sm text-muted" style="text-align:center;padding:20px;">Nenhuma tarefa neste nível (ou tudo foi ocultado pelo filtro de status).</td></tr>`;

    container.innerHTML = `
      ${_controleNivel(max)}
      <div class="tabela-container">
        <table class="tabela tabela-compacta">
          <thead>
            <tr>
              <th rowspan="2" style="min-width:260px;">Nome da Tarefa</th>
              ${ETAPAS.map(e => `<th colspan="2" style="text-align:center;">${e.label}</th>`).join('')}
              <th rowspan="2">Desvio (Dias)</th>
              <th rowspan="2">Início</th>
            </tr>
            <tr>
              ${ETAPAS.map(e => `<th style="font-weight:400;">Data</th><th style="font-weight:400;position:relative;">
                <span style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;" onclick="event.stopPropagation();Suprimentos._toggleFiltroStatus('${e.id}')">
                  Status <span style="font-size:.7rem;color:${statusFiltro[e.id]&&statusFiltro[e.id].size?'var(--cor-primaria)':'#999'};">▼</span>
                </span>
              </th>`).join('')}
            </tr>
          </thead>
          <tbody>${linhas}</tbody>
        </table>
      </div>
      ${_modalConfigHTML()}
    `;
  }

  function _linhaGrupo(t) {
    const ind = 8 + (t.nivel || 0) * 16;
    const icone = t.tipo === 'grupo' ? '📁 ' : '';
    return `<tr class="linha-grupo-suprimentos">
      <td style="padding-left:${ind}px;font-weight:700;color:#555;">${icone}${t.nome}</td>
      <td colspan="${ETAPAS.length * 2 + 2}"></td>
    </tr>`;
  }

  function _linhaFolha(t) {
    const ind = 8 + (t.nivel || 0) * 16;
    const s = supPorTarefa[t.id];
    if (!t.inicioPlanejado || !s) {
      return `<tr>
        <td style="padding-left:${ind}px;">${t.nome}</td>
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
      <td style="padding-left:${ind}px;">${t.nome}</td>
      ${celulas}
      <td class="col-num" style="text-align:center;${desvio!=null&&desvio>0?'color:var(--cor-perigo);font-weight:700;':'color:var(--cor-texto-muted);'}">${desvio==null?'—':(desvio>0?'+':'')+desvio}</td>
      <td class="col-num" style="text-align:center;font-family:var(--font-mono);">${inicioLabel}</td>
    </tr>`;
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
    const inputStyle = `width:100%;border:1.5px solid ${e.manual?cor:'var(--cor-borda)'};background:${bg};color:${cor};font-size:.72rem;font-family:var(--font-mono);padding:4px 3px;border-radius:5px;box-sizing:border-box;text-align:center;cursor:pointer;`;
    const selStyle = `width:100%;border:1.5px solid ${st.cor};background:${st.bg};color:${st.cor};font-size:.71rem;font-weight:700;padding:4px 3px;border-radius:5px;box-sizing:border-box;cursor:pointer;`;
    return `
      <td class="sup-cel-data" data-tarefa="${tarefaId}" data-etapa="${etapaId}" style="padding:3px;" title="${tooltip}">
        <input type="date" value="${e.data}" style="${inputStyle}" onchange="Suprimentos.onDataInlineChange('${tarefaId}','${etapaId}',this.value)">
      </td>
      <td class="sup-cel-status" data-tarefa="${tarefaId}" data-etapa="${etapaId}" style="padding:3px;">
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

  // ---- Config (prazos entre etapas) ----
  function abrirConfig() {
    Utils.abrirModal('modal-config-suprimentos');
  }
  function fecharConfig() {
    Utils.fecharModal('modal-config-suprimentos');
  }

  function _modalConfigHTML() {
    return `
      <div class="modal-overlay" id="modal-config-suprimentos">
        <div class="modal">
          <div class="modal-header"><h3>Prazos das Etapas</h3></div>
          <div class="modal-body">
            <p class="text-sm text-muted" style="margin-bottom:12px;">Duração (em dias) de cada etapa, contada para trás a partir do Início Planejado da tarefa. Vale só para tarefas cujo mapa ainda não foi gerado ou não foi editado manualmente.</p>
            ${ETAPAS.map(e => `
              <div class="form-grupo">
                <label>${e.label} (dias)</label>
                <input type="number" min="0" class="form-control" id="cfg-${e.cfgKey}" value="${cfg[e.cfgKey]}">
              </div>`).join('')}
          </div>
          <div class="modal-footer">
            <button class="btn btn-secundario" onclick="Suprimentos.fecharConfig()">Cancelar</button>
            <button class="btn btn-primario" onclick="Suprimentos.salvarConfig()">Salvar e Recalcular Pendentes</button>
          </div>
        </div>
      </div>`;
  }

  async function salvarConfig() {
    const novaCfg = {};
    ETAPAS.forEach(e => { novaCfg[e.cfgKey] = parseInt(document.getElementById(`cfg-${e.cfgKey}`)?.value) || 0; });
    try {
      Utils.mostrarLoading('Salvando prazos...');
      await Database.criar(obraId, 'config', novaCfg, CFG_DOC).catch(() => Database.atualizar(obraId, 'config', CFG_DOC, novaCfg));
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
  // 4 etapas daquela mesma tarefa continuam recalculando normal).
  async function _recalcularNaoEditados() {
    const atualizacoes = [];
    Object.values(supPorTarefa).forEach(s => {
      const t = tarefas.find(x => x.id === s.tarefaId);
      if (!t || !t.inicioPlanejado) return;
      const datas = _calcularDatas(t.inicioPlanejado, cfg);
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

  return { init, renderizar, abrirConfig, fecharConfig, salvarConfig, onDataInlineChange, onStatusInlineChange, _setNivelFixo, _toggleFiltroStatus, _aplicarFiltroStatus };
})();

function onObraChanged() { Suprimentos.init(); }

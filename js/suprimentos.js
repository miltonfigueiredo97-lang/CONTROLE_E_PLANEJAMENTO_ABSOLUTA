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
    let linhas = '';
    sorted.forEach((t, i) => {
      const nxt = sorted[i + 1];
      const isFolha = !nxt || (nxt.nivel || 0) <= (t.nivel || 0);
      linhas += isFolha ? _linhaFolha(t) : _linhaGrupo(t);
    });

    container.innerHTML = `
      <div class="tabela-container">
        <table class="tabela tabela-compacta">
          <thead>
            <tr>
              <th rowspan="2" style="min-width:260px;">Nome da Tarefa</th>
              ${ETAPAS.map(e => `<th colspan="2">${e.label}</th>`).join('')}
              <th rowspan="2">Desvio (Dias)</th>
              <th rowspan="2">Início</th>
            </tr>
            <tr>
              ${ETAPAS.map(() => `<th style="font-weight:400;">Data</th><th style="font-weight:400;">Status</th>`).join('')}
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

  function _calcDesvio(t) {
    if (!t.inicioReal || !t.inicioPlanejado) return null;
    return Math.round((new Date(t.inicioReal) - new Date(t.inicioPlanejado)) / 864e5);
  }

  function _celulaEtapa(tarefaId, etapaId, e) {
    if (!e) return '<td>—</td><td>—</td>';
    const hoje = Utils.hoje();
    let cor, corBg;
    if (e.status === 'concluido') { cor = 'var(--cor-sucesso)'; corBg = 'var(--cor-sucesso-bg)'; }
    else if (e.data < hoje) { cor = 'var(--cor-perigo)'; corBg = 'var(--cor-perigo-bg)'; }
    else if ((new Date(e.data) - new Date(hoje)) / 864e5 <= LIMIAR_PROXIMO_DIAS) { cor = 'var(--cor-alerta)'; corBg = 'var(--cor-alerta-bg)'; }
    else { cor = 'var(--cor-texto-muted)'; corBg = 'transparent'; }
    const tooltip = e.manual ? `Editado manualmente (automático seria ${Utils.formatarData(e.planejada)})` : 'Automático — ainda não editado';
    const inputStyle = `width:100%;border:1px solid ${e.manual?cor:'var(--cor-borda)'};background:${corBg};color:${cor};font-size:.72rem;font-family:var(--font-mono);padding:4px 3px;border-radius:4px;box-sizing:border-box;text-align:center;`;
    const selStyle = `width:100%;border:1px solid ${e.manual?cor:'var(--cor-borda)'};background:${corBg};color:${cor};font-size:.72rem;font-weight:600;padding:4px 3px;border-radius:4px;box-sizing:border-box;`;
    return `
      <td style="padding:3px;" title="${tooltip}">
        <input type="date" value="${e.data}" style="${inputStyle}" onchange="Suprimentos.onDataInlineChange('${tarefaId}','${etapaId}',this.value)">
      </td>
      <td style="padding:3px;">
        <select style="${selStyle}" onchange="Suprimentos.onStatusInlineChange('${tarefaId}','${etapaId}',this.value)">
          <option value="nao_iniciado" ${e.status==='nao_iniciado'?'selected':''}>Não Iniciado</option>
          <option value="concluido" ${e.status==='concluido'?'selected':''}>Concluído</option>
        </select>
      </td>`;
  }

  // ---- Edição inline (sem popup) ----
  async function onDataInlineChange(tarefaId, etapaId, novaData) {
    const s = supPorTarefa[tarefaId];
    if (!s || !novaData) return;
    s.etapas[etapaId].data = novaData;
    s.etapas[etapaId].manual = true; // essa etapa deixou de ser automática
    try {
      await Database.atualizar(obraId, COL, tarefaId, { etapas: s.etapas });
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao salvar data: ' + e.message, 'erro');
    }
    renderizar();
  }

  async function onStatusInlineChange(tarefaId, etapaId, novoStatus) {
    const s = supPorTarefa[tarefaId];
    if (!s) return;
    s.etapas[etapaId].status = novoStatus;
    try {
      await Database.atualizar(obraId, COL, tarefaId, { etapas: s.etapas });
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao salvar status: ' + e.message, 'erro');
    }
    renderizar();
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

  return { init, renderizar, abrirConfig, fecharConfig, salvarConfig, onDataInlineChange, onStatusInlineChange };
})();

function onObraChanged() { Suprimentos.init(); }

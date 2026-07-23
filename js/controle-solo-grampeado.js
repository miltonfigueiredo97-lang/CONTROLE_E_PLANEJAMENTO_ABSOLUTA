// ============================================
// Módulo: Controle de Solo Grampeado
// Minimapa interativo por vista: clicar num chumbador marca as
// etapas (Perfuração 20% / Injeção 1 15% / Injeção 2 15%);
// clicar em células da malha marca Projeção (30%) e Acabamento
// (20%) da área. Cada marcação gera um lançamento no relatório
// diário (sgProducaoDiaria). % e m² executados por vista.
// Chumbadores/Vistas vêm do Levantamento de Solo Grampeado —
// aqui só se registra a EXECUÇÃO.
// Dados: Firestore obras/{obraId}/sg*
// ============================================

const ControleSoloGrampeado = (() => {
  const SG = SoloGrampeadoCalculos;
  const COL_VISTAS = 'sgVistas';
  const COL_CHUMBADORES = 'sgChumbadores';
  const COL_EXECUCOES = 'sgExecucoes';
  const COL_PRODUCAO = 'sgProducaoDiaria';
  const COL_AREA = 'sgAreaExecutada';

  let obraId = null;
  let vistas = [];
  let chumbadores = [];
  let execucoes = []; // 1 doc por chumbador: {chumbadorId, vistaId, perfuracao:{feito,data}, injecao1:{...}, injecao2:{...}}
  let producao = []; // log diário (sgProducaoDiaria)
  let areaExecutada = []; // 1 doc por vista: {vistaId, celulasProjecao:[...], celulasAcabamento:[...]}

  let vistaAtivaId = null;
  let modoArea = null; // 'projecao' | 'acabamento' | null
  let chumbAtivoId = null;
  let imagemCacheVistaId = null, imagemCacheBase64 = null;

  const esc = SG.esc;

  // ══════════════════════════════════════════
  // INIT / CARREGAMENTO
  // ══════════════════════════════════════════
  async function init() {
    const ok = await Utils.initPagina({ requireObra: true });
    if (!ok) return;
    obraId = Router.getObraId();
    if (!obraId) {
      document.getElementById('sgc-content').innerHTML =
        `<div class="estado-vazio"><div class="icone">✅</div><p>Selecione uma obra para acessar o controle de solo grampeado.</p></div>`;
      return;
    }
    document.addEventListener('keydown', e => { if (e.key === 'Escape') Utils.fecharTodosModais(); });
    await carregar();
  }

  async function carregar() {
    Utils.mostrarLoading();
    try {
      const [vs, cs, exs, ps, as_] = await Promise.all([
        Database.listar(obraId, COL_VISTAS, null),
        Database.listar(obraId, COL_CHUMBADORES, null),
        Database.listar(obraId, COL_EXECUCOES, null),
        Database.listar(obraId, COL_PRODUCAO, null),
        Database.listar(obraId, COL_AREA, null),
      ]);
      vistas = vs; chumbadores = cs; execucoes = exs; producao = ps; areaExecutada = as_;
      if (!vistaAtivaId && vistas.length) vistaAtivaId = vistasOrdenadas()[0].id;
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
    vistaAtivaId = null;
    await carregar();
  }

  function vistaLabel(v) { return v ? (v.nome ? `${v.numero} — ${v.nome}` : `Vista ${v.numero}`) : '—'; }
  function vistasOrdenadas() { return [...vistas].sort((a, b) => (a.numero || 0) - (b.numero || 0)); }
  function vistaAtiva() { return vistas.find(v => v.id === vistaAtivaId) || null; }
  function chumbadoresDaVista(vistaId) { return chumbadores.filter(c => c.vista === vistaId).sort((a, b) => (a.linha - b.linha) || (a.coluna - b.coluna)); }
  function execDoChumbador(chumbadorId) { return execucoes.find(e => e.chumbadorId === chumbadorId) || null; }
  function execMapDaVista(vistaId) {
    const map = {};
    chumbadoresDaVista(vistaId).forEach(c => { const e = execDoChumbador(c.id); if (e) map[c.id] = e; });
    return map;
  }
  function areaDocDaVista(vistaId) { return areaExecutada.find(a => a.vistaId === vistaId) || null; }

  // ══════════════════════════════════════════
  // RENDER PRINCIPAL
  // ══════════════════════════════════════════
  function renderizar() {
    const c = document.getElementById('sgc-content');
    if (!c) return;

    if (!vistas.length) {
      c.innerHTML = `
        <div class="cc-view">
        <div class="page-header">
          <div><h2>✅ Controle de Solo Grampeado</h2><span class="subtitulo">Minimapa de execução por vista</span></div>
        </div>
        <div class="cc-empty">⛏️<br>Nenhuma vista/grid cadastrado ainda.<br>Configure no <a href="levantamento-solo-grampeado.html" style="color:var(--cor-primaria-dark);font-weight:600;">Levantamento de Solo Grampeado</a>.</div>
        </div>`;
      return;
    }

    // KPIs gerais (todas as vistas)
    const resumos = vistasOrdenadas().map(v => SG.calcPctVista(v, chumbadoresDaVista(v.id), execMapDaVista(v.id), areaDocDaVista(v.id)));
    const m2TotalObra = vistas.reduce((s, v) => s + SG.num(v.m2Total), 0);
    const m2ExecObra = resumos.reduce((s, r) => s + r.m2Executado, 0);
    const pctMedioObra = vistas.length ? resumos.reduce((s, r) => s + r.pct, 0) / vistas.length : 0;
    const chumbTotal = chumbadores.length;
    const chumbFeitos = resumos.reduce((s, r) => s + r.chumbadoresFeitos, 0);

    const v = vistaAtiva();

    c.innerHTML = `
      <div class="cc-view">
      <div class="page-header">
        <div>
          <h2>✅ Controle de Solo Grampeado</h2>
          <span class="subtitulo">Clique num chumbador para marcar etapas, ou ative um modo de área para marcar projeção/acabamento</span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <a class="btn btn-secundario btn-sm" href="levantamento-solo-grampeado.html">⛏️ Levantamento Solo Grampeado</a>
          <button class="btn btn-secundario btn-sm" onclick="SGC_UI.abrirRelatorioDiario()">📅 Relatório Diário</button>
        </div>
      </div>

      <div class="cc-kpiGrid" style="grid-template-columns:repeat(4,1fr);">
        <div class="cc-kpi cc-kpiGreen"><div class="cc-kpiIcon">✅</div><div class="cc-kpiBody"><div class="cc-kpiLabel">% Execução Média</div><div class="cc-kpiValue">${SG.fmt1(pctMedioObra)}<span class="cc-kpiUnit">%</span></div></div></div>
        <div class="cc-kpi cc-kpiPurple"><div class="cc-kpiIcon">📐</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Área Executada</div><div class="cc-kpiValue">${SG.fmt1(m2ExecObra)}<span class="cc-kpiUnit">m²</span></div><div class="cc-kpiSub">de ${SG.fmt1(m2TotalObra)} m²</div></div></div>
        <div class="cc-kpi cc-kpiBlue"><div class="cc-kpiIcon">⛏️</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Chumbadores Concluídos</div><div class="cc-kpiValue">${chumbFeitos}<span class="cc-kpiUnit">/ ${chumbTotal}</span></div></div></div>
        <div class="cc-kpi cc-kpiOrange"><div class="cc-kpiIcon">📅</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Lançamentos no diário</div><div class="cc-kpiValue">${producao.length}</div></div></div>
      </div>

      <div class="cc-panel">
        <div class="cc-panelTitle">🗺️ Minimapa de Execução</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;align-items:center;">
          <select class="form-control" id="sgc-vista-ativa" style="max-width:240px;" onchange="SGC_UI.onTrocarVistaAtiva()">
            ${vistasOrdenadas().map(vv => `<option value="${vv.id}" ${vv.id === vistaAtivaId ? 'selected' : ''}>${esc(vistaLabel(vv))}</option>`).join('')}
          </select>
          <button class="btn ${modoArea === 'projecao' ? 'btn-primario' : 'btn-secundario'} btn-sm" onclick="SGC_UI.toggleModoArea('projecao')">▦ Marcar Projeção (30%)</button>
          <button class="btn ${modoArea === 'acabamento' ? 'btn-primario' : 'btn-secundario'} btn-sm" onclick="SGC_UI.toggleModoArea('acabamento')">▦ Marcar Acabamento (20%)</button>
        </div>
        <div id="sgc-grid-host"></div>
      </div>

      <div class="cc-panel">
        <div class="cc-panelTitle">◈ Progresso por Vista</div>
        <div id="sgc-tabela-vistas"></div>
      </div>
      </div>
    `;
    renderGrid();
    renderTabelaVistas(resumos);
  }

  function onTrocarVistaAtiva() {
    vistaAtivaId = document.getElementById('sgc-vista-ativa').value || null;
    modoArea = null;
    renderizar();
  }

  function toggleModoArea(m) {
    modoArea = (modoArea === m) ? null : m;
    renderizar();
  }

  // ══════════════════════════════════════════
  // MINIMAPA INTERATIVO
  // ══════════════════════════════════════════
  async function renderGrid() {
    const host = document.getElementById('sgc-grid-host');
    if (!host) return;
    const v = vistaAtiva();
    if (!v) { host.innerHTML = `<div class="cc-empty">Nenhuma vista selecionada.</div>`; return; }
    if (!(SG.num(v.gridCols) > 0) || !(SG.num(v.gridRows) > 0)) {
      host.innerHTML = `<div class="cc-empty">Esta vista ainda não tem grid configurado no Levantamento.</div>`;
      return;
    }
    let imagem = null;
    if (imagemCacheVistaId === v.id) imagem = imagemCacheBase64;
    else {
      try {
        const doc = await db.collection('obras').doc(obraId).collection('config').doc('sgImagem_' + v.id).get();
        imagem = doc.exists ? (doc.data().img || null) : null;
        imagemCacheVistaId = v.id; imagemCacheBase64 = imagem;
      } catch (e) { imagem = null; }
    }
    const lista = chumbadoresDaVista(v.id);
    const execMap = execMapDaVista(v.id);
    const areaDoc = areaDocDaVista(v.id);
    const resumo = SG.calcPctVista(v, lista, execMap, areaDoc);
    const svg = SG.svgMinimapa(v, lista, execMap, areaDoc, imagem, {
      interativo: true,
      chumbadorClickFn: 'SGC_UI.onClickChumbador',
      celulaClickFn: 'SGC_UI.onClickCelula',
      modoArea,
    });
    host.innerHTML = `
      <div>${svg}</div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:8px;font-size:0.8rem;font-family:var(--font-mono);">
        <span>🟢 concluído · 🟠 parcial · ⚪ pendente</span>
        <span>Projeção: <b>${resumo.projFeitas}/${resumo.totalCelulas}</b> células (${SG.fmt1(resumo.m2Projetado)} m²)</span>
        <span>Acabamento: <b>${resumo.acabFeitas}/${resumo.totalCelulas}</b> células (${SG.fmt1(resumo.m2Acabado)} m²)</span>
        <span style="font-weight:700;color:var(--cor-primaria-dark,#b8960a);">% da vista: ${SG.fmt1(resumo.pct)}%</span>
      </div>
      ${modoArea ? `<div class="cc-empty" style="margin-top:8px;">Modo ativo: <b>${modoArea === 'projecao' ? 'Projeção da Área' : 'Acabamento da Área'}</b>. Clique nas células do grid para marcar/desmarcar.</div>` : ''}
    `;
  }

  // ── Clique num chumbador → abre modal de etapas ──
  function onClickChumbador(chumbadorId) {
    if (modoArea) return; // em modo área, cliques vão pras células, não pro chumbador
    abrirMarcarEtapas(chumbadorId);
  }

  function abrirMarcarEtapas(chumbadorId) {
    const chb = chumbadores.find(x => x.id === chumbadorId);
    if (!chb) return;
    chumbAtivoId = chumbadorId;
    const exec = execDoChumbador(chumbadorId) || {};
    document.getElementById('sgc-modal-exec-titulo').textContent = `⛏️ Chumbador ${chb.numero} — Etapas`;
    SG.ETAPAS_CHUMBADOR.forEach(et => {
      const dados = exec[et.key] || {};
      document.getElementById(`sgc-et-${et.key}-check`).checked = !!dados.feito;
      document.getElementById(`sgc-et-${et.key}-data`).value = dados.data || Utils.hoje();
    });
    Utils.abrirModal('modal-sgc-execucao');
  }

  async function salvarEtapasChumbador() {
    if (!chumbAtivoId) return;
    const chb = chumbadores.find(x => x.id === chumbAtivoId);
    const existente = execDoChumbador(chumbAtivoId);
    const dadosAntigos = existente || {};
    const novoExec = { chumbadorId: chumbAtivoId, vistaId: chb.vista };
    const novosLancamentos = [];
    SG.ETAPAS_CHUMBADOR.forEach(et => {
      const marcado = document.getElementById(`sgc-et-${et.key}-check`).checked;
      const data = document.getElementById(`sgc-et-${et.key}-data`).value || Utils.hoje();
      novoExec[et.key] = { feito: marcado, data: marcado ? data : (dadosAntigos[et.key]?.data || '') };
      const jaEraFeito = !!(dadosAntigos[et.key] && dadosAntigos[et.key].feito);
      if (marcado && !jaEraFeito) {
        novosLancamentos.push({ data, vistaId: chb.vista, tipo: 'chumbador', chumbadorId: chumbAtivoId, etapa: et.key, obraId });
      }
    });
    Utils.mostrarLoading();
    try {
      if (existente) {
        await Database.atualizar(obraId, COL_EXECUCOES, existente.id, novoExec);
      } else {
        await Database.criar(obraId, COL_EXECUCOES, novoExec, SG.genId('exec'));
      }
      for (const l of novosLancamentos) {
        await Database.criar(obraId, COL_PRODUCAO, l, SG.genId('pd'));
      }
      Utils.toast('✓ Etapas do chumbador atualizadas!', 'sucesso');
      Utils.fecharModal('modal-sgc-execucao');
      await carregar();
    } catch (e) {
      Utils.toast('Erro ao salvar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ── Clique numa célula (modo Projeção/Acabamento) ──
  async function onClickCelula(key) {
    if (!modoArea) return;
    const v = vistaAtiva();
    if (!v) return;
    let doc = areaDocDaVista(v.id);
    const campo = modoArea === 'projecao' ? 'celulasProjecao' : 'celulasAcabamento';
    const atual = new Set((doc && doc[campo]) || []);
    const jaMarcada = atual.has(key);
    if (jaMarcada) atual.delete(key); else atual.add(key);
    const novaLista = [...atual];

    Utils.mostrarLoading();
    try {
      const payload = { vistaId: v.id, [campo]: novaLista };
      if (doc) {
        await Database.atualizar(obraId, COL_AREA, doc.id, payload);
      } else {
        await Database.criar(obraId, COL_AREA, { vistaId: v.id, celulasProjecao: [], celulasAcabamento: [], ...payload }, SG.genId('ae'));
      }
      if (!jaMarcada) {
        await Database.criar(obraId, COL_PRODUCAO, { data: Utils.hoje(), vistaId: v.id, tipo: 'area', etapa: modoArea, celula: key, obraId }, SG.genId('pd'));
      }
      await carregar();
    } catch (e) {
      Utils.toast('Erro ao marcar célula: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ══════════════════════════════════════════
  // TABELA DE PROGRESSO POR VISTA
  // ══════════════════════════════════════════
  function renderTabelaVistas(resumos) {
    const el = document.getElementById('sgc-tabela-vistas');
    if (!el) return;
    const lista = vistasOrdenadas();
    if (!lista.length) { el.innerHTML = '<div class="cc-empty">Nenhuma vista cadastrada.</div>'; return; }
    el.innerHTML = `
      <div class="cc-tableWrap">
      <table class="cc-table">
        <thead><tr><th>Vista</th><th class="col-num">Chumbadores</th><th class="col-num">m² total</th><th class="col-num">m² executado</th><th class="col-num">% Execução</th></tr></thead>
        <tbody>
          ${lista.map((v, i) => {
            const r = resumos[i];
            return `<tr>
              <td style="font-weight:600;">${esc(vistaLabel(v))}</td>
              <td class="col-num cc-tdMono">${r.chumbadoresFeitos}/${r.qtdChumbadores}</td>
              <td class="col-num cc-tdMono">${SG.fmt1(v.m2Total)}</td>
              <td class="col-num cc-tdMono">${SG.fmt1(r.m2Executado)}</td>
              <td class="col-num cc-tdAccent" style="font-weight:700;">${SG.fmt1(r.pct)}%</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      </div>`;
  }

  // ══════════════════════════════════════════
  // RELATÓRIO DIÁRIO (log automático das marcações)
  // ══════════════════════════════════════════
  function abrirRelatorioDiario() {
    renderRelatorioDiario();
    Utils.abrirModal('modal-sgc-relatorio');
  }

  function _labelLancamento(p) {
    const v = vistas.find(x => x.id === p.vistaId);
    if (p.tipo === 'chumbador') {
      const chb = chumbadores.find(x => x.id === p.chumbadorId);
      const et = SG.ETAPAS_CHUMBADOR.find(e => e.key === p.etapa);
      return `Chumbador ${esc(chb ? chb.numero : '?')} (${esc(vistaLabel(v))}) — ${esc(et ? et.label : p.etapa)}`;
    }
    const et = SG.ETAPAS_AREA.find(e => e.key === p.etapa);
    return `${esc(et ? et.label : p.etapa)} — célula ${esc(p.celula)} (${esc(vistaLabel(v))})`;
  }

  function renderRelatorioDiario() {
    const el = document.getElementById('sgc-relatorio-body');
    if (!el) return;
    const porData = {};
    [...producao].forEach(p => { (porData[p.data] = porData[p.data] || []).push(p); });
    const datas = Object.keys(porData).sort((a, b) => b.localeCompare(a));
    if (!datas.length) { el.innerHTML = '<div class="cc-empty">Nenhum lançamento registrado ainda. Marque etapas ou área no minimapa.</div>'; return; }
    el.innerHTML = datas.map(d => `
      <div class="cc-panel" style="padding:10px 14px;margin-bottom:10px;">
        <div style="font-weight:700;font-family:var(--font-mono);margin-bottom:6px;">${esc(d)} <span class="text-sm text-muted">(${porData[d].length} lançamento${porData[d].length !== 1 ? 's' : ''})</span></div>
        <ul style="margin:0;padding-left:18px;font-size:0.85rem;">
          ${porData[d].map(p => `<li>${_labelLancamento(p)}</li>`).join('')}
        </ul>
      </div>
    `).join('');
  }

  return {
    init, recarregar, renderizar, onTrocarVistaAtiva, toggleModoArea,
    onClickChumbador, salvarEtapasChumbador, onClickCelula,
    abrirRelatorioDiario,
  };
})();

const SGC_UI = ControleSoloGrampeado;

function onObraChanged() {
  ControleSoloGrampeado.recarregar();
}

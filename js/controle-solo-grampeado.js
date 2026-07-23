// ============================================
// Módulo: Controle de Solo Grampeado
// Mesmo mapa (imagem + pontos) do Levantamento, agora interativo
// pra EXECUÇÃO: clicar num chumbador marca as etapas (Perfuração
// 20% / Injeção 1 15% / Injeção 2 15%); num modo de área ativo,
// arrastar um retângulo sobre o mapa marca Projeção (30%) ou
// Acabamento (20%) daquele trecho, em m² reais (via escala da
// vista). Cada marcação gera lançamento no relatório diário.
// Chumbadores/Vistas vêm do Levantamento — aqui só a EXECUÇÃO.
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
  let producao = []; // log diário (etapas de chumbador)
  let areaExecutada = []; // N docs por vista: {vistaId, etapa, x1,y1,x2,y2, m2, data}

  let vistaAtivaId = null;
  let modoArea = null; // 'projecao' | 'acabamento' | null
  let chumbAtivoId = null;
  let imagemCacheVistaId = null, imagemCacheBase64 = null;
  let arrastoInicio = null; // {x,y} durante drag de área

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
  function chumbadoresDaVista(vistaId) { return chumbadores.filter(c => c.vista === vistaId); }
  function execDoChumbador(chumbadorId) { return execucoes.find(e => e.chumbadorId === chumbadorId) || null; }
  function execMapDaVista(vistaId) {
    const map = {};
    chumbadoresDaVista(vistaId).forEach(c => { const e = execDoChumbador(c.id); if (e) map[c.id] = e; });
    return map;
  }
  function areasDaVista(vistaId) { return areaExecutada.filter(a => a.vistaId === vistaId); }

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
          <div><h2>✅ Controle de Solo Grampeado</h2><span class="subtitulo">Execução por vista</span></div>
        </div>
        <div class="cc-empty">⛏️<br>Nenhuma vista cadastrada ainda.<br>Configure no <a href="levantamento-solo-grampeado.html" style="color:var(--cor-primaria-dark);font-weight:600;">Levantamento de Solo Grampeado</a>.</div>
        </div>`;
      return;
    }

    const resumos = vistasOrdenadas().map(v => SG.calcPctVista(v, chumbadoresDaVista(v.id), execMapDaVista(v.id), areasDaVista(v.id)));
    const m2TotalObra = vistas.reduce((s, v) => s + SG.num(v.m2Total), 0);
    const m2ExecObra = resumos.reduce((s, r) => s + r.m2Executado, 0);
    const pctMedioObra = vistas.length ? resumos.reduce((s, r) => s + r.pct, 0) / vistas.length : 0;
    const chumbTotal = chumbadores.length;
    const chumbFeitos = resumos.reduce((s, r) => s + r.chumbadoresFeitos, 0);

    c.innerHTML = `
      <div class="cc-view">
      <div class="page-header">
        <div>
          <h2>✅ Controle de Solo Grampeado</h2>
          <span class="subtitulo">Clique num chumbador para marcar etapas, ou ative um modo de área e arraste um retângulo</span>
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
        <div class="cc-panelTitle">🗺️ Mapa de Execução</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;align-items:center;">
          <select class="form-control" id="sgc-vista-ativa" style="max-width:240px;" onchange="SGC_UI.onTrocarVistaAtiva()">
            ${vistasOrdenadas().map(vv => `<option value="${vv.id}" ${vv.id === vistaAtivaId ? 'selected' : ''}>${esc(vistaLabel(vv))}</option>`).join('')}
          </select>
          <button class="btn ${modoArea === 'projecao' ? 'btn-primario' : 'btn-secundario'} btn-sm" onclick="SGC_UI.toggleModoArea('projecao')">▦ Marcar Projeção (30%)</button>
          <button class="btn ${modoArea === 'acabamento' ? 'btn-primario' : 'btn-secundario'} btn-sm" onclick="SGC_UI.toggleModoArea('acabamento')">▦ Marcar Acabamento (20%)</button>
        </div>
        <div id="sgc-mapa-host"></div>
      </div>

      <div class="cc-panel">
        <div class="cc-panelTitle">◈ Progresso por Vista</div>
        <div id="sgc-tabela-vistas"></div>
      </div>
      </div>
    `;
    renderMapa();
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
  // MAPA INTERATIVO
  // ══════════════════════════════════════════
  async function renderMapa() {
    const host = document.getElementById('sgc-mapa-host');
    if (!host) return;
    const v = vistaAtiva();
    if (!v) { host.innerHTML = `<div class="cc-empty">Nenhuma vista selecionada.</div>`; return; }
    let imagem = null;
    if (imagemCacheVistaId === v.id) imagem = imagemCacheBase64;
    else {
      try {
        const doc = await db.collection('obras').doc(obraId).collection('config').doc('sgImagem_' + v.id).get();
        imagem = doc.exists ? (doc.data().img || null) : null;
        imagemCacheVistaId = v.id; imagemCacheBase64 = imagem;
      } catch (e) { imagem = null; }
    }
    if (!imagem) {
      host.innerHTML = `<div class="cc-empty">Esta vista ainda não tem imagem/PDF cadastrado no Levantamento.</div>`;
      return;
    }
    const lista = chumbadoresDaVista(v.id);
    const execMap = execMapDaVista(v.id);
    const areas = areasDaVista(v.id);
    const resumo = SG.calcPctVista(v, lista, execMap, areas);
    const html = SG.mapaHTML(v, imagem, lista, execMap, areas, {
      interativo: true, zoom: 1, stageId: 'sgc-stage', maxHeight: 600,
    });
    host.innerHTML = `
      ${html}
      <div id="sgc-arrasto-preview" style="position:relative;"></div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:8px;font-size:0.8rem;font-family:var(--font-mono);">
        <span>🟢 concluído · 🟠 parcial · ⚪ pendente</span>
        <span>Projeção: <b>${SG.fmt1(resumo.m2Projetado)} m²</b></span>
        <span>Acabamento: <b>${SG.fmt1(resumo.m2Acabado)} m²</b></span>
        <span style="font-weight:700;color:var(--cor-primaria-dark,#b8960a);">% da vista: ${SG.fmt1(resumo.pct)}%</span>
      </div>
      ${modoArea ? `<div class="cc-empty" style="margin-top:8px;">Modo ativo: <b>${modoArea === 'projecao' ? 'Projeção da Área' : 'Acabamento da Área'}</b>. Arraste um retângulo sobre o trecho executado.</div>` : ''}
      ${!modoArea && areas.length ? _htmlListaAreas(areas) : ''}
    `;
    _ligarEventosMapa(v);
  }

  function _htmlListaAreas(areas) {
    return `<div class="cc-tableWrap" style="max-height:160px;overflow-y:auto;margin-top:10px;">
      <table class="cc-table">
        <thead><tr><th>Etapa</th><th class="col-num">m²</th><th>Data</th><th class="col-acoes"></th></tr></thead>
        <tbody>
          ${areas.map(a => `<tr>
            <td>${a.etapa === 'acabamento' ? 'Acabamento' : 'Projeção'}</td>
            <td class="col-num cc-tdMono">${SG.fmt1(a.m2)}</td>
            <td class="cc-tdMono">${esc(a.data)}</td>
            <td class="col-acoes"><button class="btn btn-secundario btn-sm" style="color:var(--cv-red);" onclick="SGC_UI.excluirArea('${a.id}')">🗑</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  }

  function _ligarEventosMapa(v) {
    const stage = document.getElementById('sgc-stage');
    if (!stage) return;

    if (modoArea) {
      stage.style.cursor = 'crosshair';
      stage.addEventListener('mousedown', ev => {
        ev.preventDefault();
        arrastoInicio = SG.posRelativa(ev, stage);
        const preview = document.createElement('div');
        preview.id = 'sgc-preview-rect';
        preview.style.cssText = 'position:absolute;border:2px dashed #1e293b;background:rgba(59,130,246,.25);pointer-events:none;z-index:5;';
        stage.appendChild(preview);
        const mover = mv => {
          const pos = SG.posRelativa(mv, stage);
          const x = Math.min(arrastoInicio.x, pos.x) * 100, y = Math.min(arrastoInicio.y, pos.y) * 100;
          const w = Math.abs(pos.x - arrastoInicio.x) * 100, h = Math.abs(pos.y - arrastoInicio.y) * 100;
          preview.style.left = x + '%'; preview.style.top = y + '%';
          preview.style.width = w + '%'; preview.style.height = h + '%';
        };
        const soltar = async up => {
          document.removeEventListener('mousemove', mover);
          document.removeEventListener('mouseup', soltar);
          preview.remove();
          const fim = SG.posRelativa(up, stage);
          const rect = { x1: arrastoInicio.x, y1: arrastoInicio.y, x2: fim.x, y2: fim.y };
          arrastoInicio = null;
          if (Math.abs(rect.x2 - rect.x1) < 0.005 || Math.abs(rect.y2 - rect.y1) < 0.005) return; // arrasto minúsculo, ignora
          await _salvarAreaMarcada(v, rect);
        };
        document.addEventListener('mousemove', mover);
        document.addEventListener('mouseup', soltar);
      });
      return;
    }

    stage.addEventListener('click', ev => {
      const marcador = ev.target.closest('.sg-marcador');
      if (marcador) abrirMarcarEtapas(marcador.dataset.id);
    });
  }

  async function _salvarAreaMarcada(v, rect) {
    const m2 = SG.calcM2Retangulo(rect, v);
    Utils.mostrarLoading();
    try {
      const data = Utils.hoje();
      await Database.criar(obraId, COL_AREA, { vistaId: v.id, etapa: modoArea, x1: rect.x1, y1: rect.y1, x2: rect.x2, y2: rect.y2, m2, data, obraId }, SG.genId('ae'));
      Utils.toast(`✓ ${modoArea === 'acabamento' ? 'Acabamento' : 'Projeção'} marcado: ${SG.fmt1(m2)} m²`, 'sucesso');
      await carregar();
    } catch (e) {
      Utils.toast('Erro ao marcar área: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  async function excluirArea(id) {
    const ok = await Utils.confirmar('Excluir esta marcação de área?');
    if (!ok) return;
    Utils.mostrarLoading();
    try {
      await Database.deletar(obraId, COL_AREA, id);
      await carregar();
    } catch (e) {
      Utils.toast('Erro: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ── Marcar etapas do chumbador ──
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
  // RELATÓRIO DIÁRIO
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
    return `${esc(et ? et.label : p.etapa)} — ${SG.fmt1(p.m2)} m² (${esc(vistaLabel(v))})`;
  }

  function renderRelatorioDiario() {
    const el = document.getElementById('sgc-relatorio-body');
    if (!el) return;
    const porData = {};
    [...producao, ...areaExecutada.map(a => ({ ...a, tipo: 'area' }))].forEach(p => { (porData[p.data] = porData[p.data] || []).push(p); });
    const datas = Object.keys(porData).sort((a, b) => b.localeCompare(a));
    if (!datas.length) { el.innerHTML = '<div class="cc-empty">Nenhum lançamento registrado ainda. Marque etapas ou área no mapa.</div>'; return; }
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
    init, recarregar, renderizar, onTrocarVistaAtiva, toggleModoArea, excluirArea,
    salvarEtapasChumbador,
    abrirRelatorioDiario,
  };
})();

const SGC_UI = ControleSoloGrampeado;

function onObraChanged() {
  ControleSoloGrampeado.recarregar();
}

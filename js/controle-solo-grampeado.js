// ============================================
// Módulo: Controle de Solo Grampeado
// Execução dos chumbadores (datas de furo/injeção/
// conclusão), produção diária, área executada por
// vista e curva de progresso.
// Chumbadores/Vistas vêm do Levantamento de Solo
// Grampeado — aqui só se registra a EXECUÇÃO.
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
  let execucoes = []; // 1 doc por chumbador executado: {chumbadorId, dataFuro, dataInjecao1, dataInjecao2, dataConclusao}
  let producao = [];
  let areaExecutada = [];

  let fBusca = '', fVista = 'todas', fTipo = 'todos', fStatus = 'todos';
  let execEditId = null; // id do chumbador sendo editado (não da execução)

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
    fBusca = ''; fVista = 'todas'; fTipo = 'todos'; fStatus = 'todos';
    await carregar();
  }

  function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function vistaLabel(v) { return v ? (v.nome ? `${v.numero} — ${v.nome}` : `Vista ${v.numero}`) : '—'; }
  function vistasOrdenadas() { return [...vistas].sort((a, b) => (a.numero || 0) - (b.numero || 0)); }
  function execDoChumbador(chumbadorId) { return execucoes.find(e => e.chumbadorId === chumbadorId) || {}; }

  // ══════════════════════════════════════════
  // KPIs / cálculos combinando chumbador + execução
  // ══════════════════════════════════════════
  function chumbadoresComExecucao() {
    return chumbadores.map(c => ({ ...c, ...execDoChumbador(c.id), chumbadorId: c.id }));
  }

  // ══════════════════════════════════════════
  // RENDER PRINCIPAL
  // ══════════════════════════════════════════
  function renderizar() {
    const c = document.getElementById('sgc-content');
    if (!c) return;

    if (!chumbadores.length) {
      c.innerHTML = `
        <div class="cc-view">
        <div class="page-header">
          <div><h2>✅ Controle de Solo Grampeado</h2><span class="subtitulo">Execução dos chumbadores, produção diária e área executada</span></div>
        </div>
        <div class="cc-empty">⛏️<br>Nenhum chumbador cadastrado ainda.<br>Cadastre no <a href="levantamento-solo-grampeado.html" style="color:var(--cor-primaria-dark);font-weight:600;">Levantamento de Solo Grampeado</a>.</div>
        </div>`;
      return;
    }

    const combinados = chumbadoresComExecucao();
    const kpis = SG.calcKPIsChumbadores(combinados);
    const totalArea = areaExecutada.reduce((s, a) => s + SG.num(a.area), 0);

    c.innerHTML = `
      <div class="cc-view">
      <div class="page-header">
        <div>
          <h2>✅ Controle de Solo Grampeado</h2>
          <span class="subtitulo">Execução dos chumbadores, produção diária e área executada</span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <a class="btn btn-secundario btn-sm" href="levantamento-solo-grampeado.html">⛏️ Levantamento Solo Grampeado</a>
          <button class="btn btn-secundario btn-sm" onclick="SGC_UI.abrirProducaoDiaria()">📅 Produção Diária</button>
          <button class="btn btn-secundario btn-sm" onclick="SGC_UI.abrirAreaExecutada()">📐 Área Executada</button>
        </div>
      </div>

      <div class="cc-kpiGrid" style="grid-template-columns:repeat(5,1fr);">
        <div class="cc-kpi cc-kpiGreen"><div class="cc-kpiIcon">✅</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Concluídos</div><div class="cc-kpiValue">${kpis.concluidos}<span class="cc-kpiUnit">/ ${kpis.total}</span></div><div class="cc-kpiSub">${SG.fmt1(kpis.pct)}%</div></div></div>
        <div class="cc-kpi cc-kpiBlue"><div class="cc-kpiIcon">📏</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Metros Lineares</div><div class="cc-kpiValue">${SG.fmt1(kpis.mlFeito)}<span class="cc-kpiUnit">ml</span></div><div class="cc-kpiSub">de ${SG.fmt1(kpis.mlTotal)} ml previstos</div></div></div>
        <div class="cc-kpi cc-kpiPurple"><div class="cc-kpiIcon">📐</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Área Executada</div><div class="cc-kpiValue">${SG.fmt1(totalArea)}<span class="cc-kpiUnit">m²</span></div></div></div>
        <div class="cc-kpi cc-kpiOrange"><div class="cc-kpiIcon">📅</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Dias com produção</div><div class="cc-kpiValue">${producao.length}</div></div></div>
        <div class="cc-kpi"><div class="cc-kpiIcon">⛏️</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Pendentes</div><div class="cc-kpiValue">${kpis.total - kpis.concluidos}</div></div></div>
      </div>

      <div class="cc-panel">
        <div class="cc-panelTitle">📈 Curva de Progresso (Chumbadores Concluídos)</div>
        <div id="sgc-curva"></div>
      </div>

      <div class="cc-panel">
        <div class="cc-panelTitle">⛏️ Execução por Chumbador</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
          <input type="text" class="form-control" id="sgc-busca" placeholder="🔍 Buscar por nº..." style="flex:1;min-width:140px;" value="${esc(fBusca)}" oninput="SGC_UI.onFiltro()">
          <select class="form-control" id="sgc-f-vista" style="max-width:180px;" onchange="SGC_UI.onFiltro()">
            <option value="todas">Todas as vistas</option>
            ${vistasOrdenadas().map(v => `<option value="${v.id}" ${fVista === v.id ? 'selected' : ''}>${esc(vistaLabel(v))}</option>`).join('')}
          </select>
          <select class="form-control" id="sgc-f-tipo" style="max-width:150px;" onchange="SGC_UI.onFiltro()">
            <option value="todos">Todos os tipos</option>
            ${SG.TIPOS_CHUMBADOR.map(t => `<option value="${t}" ${fTipo === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
          <select class="form-control" id="sgc-f-status" style="max-width:170px;" onchange="SGC_UI.onFiltro()">
            <option value="todos">Todos os status</option>
            ${['Pendente', 'Furo feito', 'Injeção 1ª Parte', 'Injeção 2ª Parte', 'Concluído'].map(s => `<option value="${esc(s)}" ${fStatus === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}
          </select>
        </div>
        <div id="sgc-tabela"></div>
      </div>
      </div>
    `;
    renderCurva(combinados);
    renderTabela(combinados);
  }

  function onFiltro() {
    fBusca = document.getElementById('sgc-busca').value;
    fVista = document.getElementById('sgc-f-vista').value;
    fTipo = document.getElementById('sgc-f-tipo').value;
    fStatus = document.getElementById('sgc-f-status').value;
    renderTabela(chumbadoresComExecucao());
  }

  // ── Curva de progresso ──
  function renderCurva(combinados) {
    const el = document.getElementById('sgc-curva');
    if (!el) return;
    const dados = SG.calcCurvaProgresso(combinados);
    if (!dados.length) { el.innerHTML = `<div class="cc-empty">Nenhum chumbador concluído ainda.</div>`; return; }
    const w = 600, h = 180, padL = 44, padB = 26, padT = 14;
    const chartW = w - padL - 10, chartH = h - padT - padB;
    const maxPct = 100;
    const pts = dados.map((d, i) => {
      const x = padL + (dados.length > 1 ? (i / (dados.length - 1)) * chartW : 0);
      const y = padT + chartH - (d.pctAcumulado / maxPct) * chartH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const grades = [0, 25, 50, 75, 100].map(g => {
      const y = padT + chartH - (g / maxPct) * chartH;
      return `<line x1="${padL}" y1="${y}" x2="${w - 10}" y2="${y}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="${g === 0 ? '0' : '4,4'}"/>
        <text x="${padL - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="#94a3b8" font-family="JetBrains Mono,monospace">${g}%</text>`;
    }).join('');
    const ultimo = dados[dados.length - 1];
    el.innerHTML = `
      <svg viewBox="0 0 ${w} ${h}" width="100%" style="max-width:${w}px;">
        ${grades}
        <polyline points="${pts}" fill="none" stroke="var(--cor-primaria)" stroke-width="2.5"/>
        <circle cx="${pts.split(' ').pop().split(',')[0]}" cy="${pts.split(' ').pop().split(',')[1]}" r="4" fill="var(--cor-primaria-dark,#b8960a)"/>
        <line x1="${padL}" y1="${padT + chartH}" x2="${w - 10}" y2="${padT + chartH}" stroke="#cbd5e1" stroke-width="1.5"/>
      </svg>
      <div style="font-family:var(--font-mono);font-size:0.78rem;color:var(--cor-texto-secundario);margin-top:6px;">
        Último registro: ${esc(ultimo.data)} · ${SG.fmt1(ultimo.pctAcumulado)}% acumulado (${ultimo.acumulado} chumbadores)
      </div>`;
  }

  // ── Tabela de execução por chumbador ──
  function renderTabela(combinados) {
    const el = document.getElementById('sgc-tabela');
    if (!el) return;
    const busca = fBusca.toLowerCase();
    const lista = combinados.filter(c => {
      if (fVista !== 'todas' && c.vista !== fVista) return false;
      if (fTipo !== 'todos' && c.tipo !== fTipo) return false;
      if (fStatus !== 'todos' && SG.statusChumbador(c) !== fStatus) return false;
      if (busca && !String(c.numero).toLowerCase().includes(busca)) return false;
      return true;
    }).sort((a, b) => (a.numero || 0) - (b.numero || 0));

    if (!lista.length) {
      el.innerHTML = `<div class="cc-empty">Nenhum chumbador encontrado para este filtro.</div>`;
      return;
    }
    el.innerHTML = `
      <div class="cc-tableWrap" style="max-height:480px;overflow-y:auto;">
      <table class="cc-table">
        <thead><tr><th>Nº</th><th>Vista</th><th>Tipo</th><th class="col-num">Comp. (ml)</th><th>Status</th><th class="col-acoes"></th></tr></thead>
        <tbody>
          ${lista.map(c => {
            const status = SG.statusChumbador(c);
            const badge = status === 'Concluído' ? 'cc-badgeComplete' : status === 'Pendente' ? 'cc-badgePending' : 'cc-badgePartial';
            const v = vistas.find(x => x.id === c.vista);
            return `<tr>
              <td style="font-weight:600;">${esc(c.numero)}</td>
              <td>${esc(v ? vistaLabel(v) : '—')}</td>
              <td>${esc(c.tipo)}</td>
              <td class="col-num cc-tdMono">${SG.fmt1(c.comprimento)}</td>
              <td><span class="cc-badge ${badge}">${esc(status)}</span></td>
              <td class="col-acoes">
                <button class="btn btn-secundario btn-sm" onclick="SGC_UI.abrirLancarExecucao('${c.chumbadorId}')">✎ Lançar</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      </div>`;
  }

  // ══════════════════════════════════════════
  // LANÇAR EXECUÇÃO DE UM CHUMBADOR
  // ══════════════════════════════════════════
  function abrirLancarExecucao(chumbadorId) {
    const chb = chumbadores.find(x => x.id === chumbadorId);
    if (!chb) return;
    execEditId = chumbadorId;
    const exec = execDoChumbador(chumbadorId);
    document.getElementById('sgc-modal-exec-titulo').textContent = `✎ Execução — Chumbador ${chb.numero}`;
    const f = document.getElementById('form-sgc-execucao');
    f.querySelector('[name=dataFuro]').value = exec.dataFuro || '';
    f.querySelector('[name=dataInjecao1]').value = exec.dataInjecao1 || '';
    f.querySelector('[name=dataInjecao2]').value = exec.dataInjecao2 || '';
    f.querySelector('[name=dataConclusao]').value = exec.dataConclusao || '';
    Utils.abrirModal('modal-sgc-execucao');
  }

  async function salvarExecucao() {
    if (!execEditId) return;
    const f = document.getElementById('form-sgc-execucao');
    const data = {
      chumbadorId: execEditId,
      dataFuro: f.querySelector('[name=dataFuro]').value,
      dataInjecao1: f.querySelector('[name=dataInjecao1]').value,
      dataInjecao2: f.querySelector('[name=dataInjecao2]').value,
      dataConclusao: f.querySelector('[name=dataConclusao]').value,
    };
    Utils.mostrarLoading();
    try {
      const existente = execucoes.find(e => e.chumbadorId === execEditId);
      if (existente) {
        await Database.atualizar(obraId, COL_EXECUCOES, existente.id, data);
      } else {
        await Database.criar(obraId, COL_EXECUCOES, data, SG.genId('exec'));
      }
      Utils.toast('✓ Execução registrada!', 'sucesso');
      Utils.fecharModal('modal-sgc-execucao');
      await carregar();
    } catch (e) {
      Utils.toast('Erro ao salvar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ══════════════════════════════════════════
  // PRODUÇÃO DIÁRIA (Grampos/Extras/Estacas)
  // ══════════════════════════════════════════
  function abrirProducaoDiaria() {
    renderProducaoDiaria();
    Utils.abrirModal('modal-sgc-producao');
  }

  function renderProducaoDiaria() {
    const el = document.getElementById('sgc-producao-body');
    if (!el) return;
    const lista = [...producao].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    const totalMl = producao.reduce((s, p) => s + SG.mlDiaProducao(p), 0);
    el.innerHTML = `
      <div class="form-row">
        <div class="form-grupo"><label>Data</label><input type="date" id="sgc-prod-data" class="form-control" value="${esc(Utils.hoje())}"></div>
      </div>
      <div class="form-row">
        <div class="form-grupo"><label>Grampos (uni)</label><input type="text" inputmode="decimal" id="sgc-prod-grampos" class="form-control" placeholder="0"></div>
        <div class="form-grupo"><label>Tamanho Grampos (m)</label><input type="text" inputmode="decimal" id="sgc-prod-tgrampos" class="form-control" placeholder="0"></div>
      </div>
      <div class="form-row">
        <div class="form-grupo"><label>Extras (uni)</label><input type="text" inputmode="decimal" id="sgc-prod-extras" class="form-control" placeholder="0"></div>
        <div class="form-grupo"><label>Tamanho Extras (m)</label><input type="text" inputmode="decimal" id="sgc-prod-textras" class="form-control" placeholder="0"></div>
      </div>
      <div class="form-row">
        <div class="form-grupo"><label>Estacas (uni)</label><input type="text" inputmode="decimal" id="sgc-prod-estacas" class="form-control" placeholder="0"></div>
        <div class="form-grupo"><label>Tamanho Estacas (m)</label><input type="text" inputmode="decimal" id="sgc-prod-testacas" class="form-control" placeholder="0"></div>
      </div>
      <button class="btn btn-primario btn-sm" onclick="SGC_UI.salvarProducaoDiaria()">+ Registrar dia</button>
      <div class="cc-divider"></div>
      <div style="font-family:var(--font-mono);font-size:0.8rem;color:var(--cor-texto-secundario);margin-bottom:8px;">Total acumulado: <b>${SG.fmt1(totalMl)} ml</b></div>
      ${!lista.length ? `<div class="cc-empty">Nenhum dia registrado ainda.</div>` : `
      <div class="cc-tableWrap" style="max-height:260px;overflow-y:auto;">
        <table class="cc-table">
          <thead><tr><th>Data</th><th class="col-num">Grampos</th><th class="col-num">Extras</th><th class="col-num">Estacas</th><th class="col-num">ml/dia</th><th class="col-acoes"></th></tr></thead>
          <tbody>
            ${lista.map(p => `
              <tr>
                <td class="cc-tdMono">${esc(p.data)}</td>
                <td class="col-num cc-tdMono">${p.grampos || 0}</td>
                <td class="col-num cc-tdMono">${p.extras || 0}</td>
                <td class="col-num cc-tdMono">${p.estacas || 0}</td>
                <td class="col-num cc-tdAccent" style="font-weight:700;">${SG.fmt1(SG.mlDiaProducao(p))}</td>
                <td class="col-acoes"><button class="btn btn-secundario btn-sm" style="color:var(--cv-red);" onclick="SGC_UI.excluirProducaoDiaria('${p.id}')">🗑</button></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`}`;
  }

  async function salvarProducaoDiaria() {
    const data = document.getElementById('sgc-prod-data').value;
    if (!data) { Utils.toast('Informe a data.', 'alerta'); return; }
    const reg = {
      data,
      grampos: SG.num(document.getElementById('sgc-prod-grampos').value),
      tamanhoGrampos: SG.num(document.getElementById('sgc-prod-tgrampos').value),
      extras: SG.num(document.getElementById('sgc-prod-extras').value),
      tamanhoExtras: SG.num(document.getElementById('sgc-prod-textras').value),
      estacas: SG.num(document.getElementById('sgc-prod-estacas').value),
      tamanhoEstacas: SG.num(document.getElementById('sgc-prod-testacas').value),
    };
    Utils.mostrarLoading();
    try {
      await Database.criar(obraId, COL_PRODUCAO, reg, SG.genId('pd'));
      Utils.toast('✓ Produção do dia registrada!', 'sucesso');
      await carregar();
      renderProducaoDiaria();
    } catch (e) {
      Utils.toast('Erro: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  async function excluirProducaoDiaria(id) {
    const ok = await Utils.confirmar('Excluir este registro de produção diária?');
    if (!ok) return;
    Utils.mostrarLoading();
    try {
      await Database.deletar(obraId, COL_PRODUCAO, id);
      await carregar();
      renderProducaoDiaria();
    } catch (e) {
      Utils.toast('Erro: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ══════════════════════════════════════════
  // ÁREA EXECUTADA POR VISTA
  // ══════════════════════════════════════════
  function abrirAreaExecutada() {
    renderAreaExecutada();
    Utils.abrirModal('modal-sgc-area');
  }

  function renderAreaExecutada() {
    const el = document.getElementById('sgc-area-body');
    if (!el) return;
    const lista = [...areaExecutada].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    const total = areaExecutada.reduce((s, a) => s + SG.num(a.area), 0);
    el.innerHTML = `
      <div class="form-row">
        <div class="form-grupo"><label>Data</label><input type="date" id="sgc-area-data" class="form-control" value="${esc(Utils.hoje())}"></div>
        <div class="form-grupo"><label>Vista</label><select id="sgc-area-vista" class="form-control">${vistasOrdenadas().map(v => `<option value="${v.id}">${esc(vistaLabel(v))}</option>`).join('') || '<option value="">— sem vistas cadastradas —</option>'}</select></div>
      </div>
      <div class="form-grupo"><label>Área executada (m²)</label><input type="text" inputmode="decimal" id="sgc-area-valor" class="form-control" placeholder="0"></div>
      <button class="btn btn-primario btn-sm" onclick="SGC_UI.salvarAreaExecutada()">+ Registrar</button>
      <div class="cc-divider"></div>
      <div style="font-family:var(--font-mono);font-size:0.8rem;color:var(--cor-texto-secundario);margin-bottom:8px;">Total acumulado: <b>${SG.fmt1(total)} m²</b></div>
      ${!lista.length ? `<div class="cc-empty">Nenhum registro de área ainda.</div>` : `
      <div class="cc-tableWrap" style="max-height:260px;overflow-y:auto;">
        <table class="cc-table">
          <thead><tr><th>Data</th><th>Vista</th><th class="col-num">Área (m²)</th><th class="col-acoes"></th></tr></thead>
          <tbody>
            ${lista.map(a => {
              const v = vistas.find(x => x.id === a.vista);
              return `<tr>
                <td class="cc-tdMono">${esc(a.data)}</td>
                <td>${esc(v ? vistaLabel(v) : '—')}</td>
                <td class="col-num cc-tdAccent" style="font-weight:700;">${SG.fmt1(a.area)}</td>
                <td class="col-acoes"><button class="btn btn-secundario btn-sm" style="color:var(--cv-red);" onclick="SGC_UI.excluirAreaExecutada('${a.id}')">🗑</button></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`}`;
  }

  async function salvarAreaExecutada() {
    const data = document.getElementById('sgc-area-data').value;
    const vista = document.getElementById('sgc-area-vista').value;
    const area = SG.num(document.getElementById('sgc-area-valor').value);
    if (!data || !(area > 0)) { Utils.toast('Informe data e área maior que zero.', 'alerta'); return; }
    Utils.mostrarLoading();
    try {
      await Database.criar(obraId, COL_AREA, { data, vista, area }, SG.genId('ae'));
      Utils.toast('✓ Área registrada!', 'sucesso');
      await carregar();
      renderAreaExecutada();
    } catch (e) {
      Utils.toast('Erro: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  async function excluirAreaExecutada(id) {
    const ok = await Utils.confirmar('Excluir este registro de área?');
    if (!ok) return;
    Utils.mostrarLoading();
    try {
      await Database.deletar(obraId, COL_AREA, id);
      await carregar();
      renderAreaExecutada();
    } catch (e) {
      Utils.toast('Erro: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  return {
    init, recarregar, renderizar, onFiltro,
    abrirLancarExecucao, salvarExecucao,
    abrirProducaoDiaria, salvarProducaoDiaria, excluirProducaoDiaria,
    abrirAreaExecutada, salvarAreaExecutada, excluirAreaExecutada,
  };
})();

const SGC_UI = ControleSoloGrampeado;

function onObraChanged() {
  ControleSoloGrampeado.recarregar();
}

// ============================================
// Módulo: Levantamento de Solo Grampeado
// Chumbadores (grampos/ancoragens), vistas (faces),
// produção diária e área executada por vista.
// Port do sistema de acompanhamento das abas S.GRAMPEADO*
// do Obra Essence V9.6.6.
// Dados: Firestore obras/{obraId}/sg*
// ============================================

const LevantamentoSoloGrampeado = (() => {
  const SG = SoloGrampeadoCalculos;
  const COL_VISTAS = 'sgVistas';
  const COL_CHUMBADORES = 'sgChumbadores';
  const COL_PRODUCAO = 'sgProducaoDiaria';
  const COL_AREA = 'sgAreaExecutada';

  let obraId = null;
  let vistas = [];
  let chumbadores = [];
  let producao = [];
  let areaExecutada = [];

  let fBusca = '', fVista = 'todas', fTipo = 'todos', fStatus = 'todos';
  let chumbEditId = null;
  let vistaEditId = null;
  let producaoEditId = null;
  let areaEditId = null;
  let previewImport = [];

  // ══════════════════════════════════════════
  // INIT / CARREGAMENTO
  // ══════════════════════════════════════════
  async function init() {
    const ok = await Utils.initPagina({ requireObra: true });
    if (!ok) return;
    obraId = Router.getObraId();
    if (!obraId) {
      document.getElementById('sg-content').innerHTML =
        `<div class="estado-vazio"><div class="icone">⛏️</div><p>Selecione uma obra para acessar o levantamento de solo grampeado.</p></div>`;
      return;
    }
    document.addEventListener('keydown', e => { if (e.key === 'Escape') Utils.fecharTodosModais(); });
    await carregar();
  }

  async function carregar() {
    Utils.mostrarLoading();
    try {
      const [vs, cs, ps, as_] = await Promise.all([
        Database.listar(obraId, COL_VISTAS, null),
        Database.listar(obraId, COL_CHUMBADORES, null),
        Database.listar(obraId, COL_PRODUCAO, null),
        Database.listar(obraId, COL_AREA, null),
      ]);
      vistas = vs; chumbadores = cs; producao = ps; areaExecutada = as_;
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

  // ══════════════════════════════════════════
  // RENDER PRINCIPAL
  // ══════════════════════════════════════════
  function renderizar() {
    const c = document.getElementById('sg-content');
    if (!c) return;
    const kpis = SG.calcKPIsChumbadores(chumbadores);
    const totalArea = areaExecutada.reduce((s, a) => s + (SG.num(a.area)), 0);
    const diasProducao = producao.length;

    c.innerHTML = `
      <div class="cc-view">
      <div class="page-header">
        <div>
          <h2>⛏️ Levantamento de Solo Grampeado</h2>
          <span class="subtitulo">Chumbadores, produção diária e área executada por vista</span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-secundario btn-sm" onclick="SG_UI.abrirVistas()">◈ Vistas</button>
          <button class="btn btn-secundario btn-sm" onclick="SG_UI.abrirImportar()">⊞ Importar Lote</button>
          <button class="btn btn-secundario btn-sm" onclick="SG_UI.abrirProducaoDiaria()">📅 Produção Diária</button>
          <button class="btn btn-secundario btn-sm" onclick="SG_UI.abrirAreaExecutada()">📐 Área Executada</button>
          <button class="btn btn-primario btn-sm" onclick="SG_UI.abrirNovoChumbador()">+ Novo Chumbador</button>
        </div>
      </div>

      <div class="cc-kpiGrid" style="grid-template-columns:repeat(5,1fr);">
        <div class="cc-kpi"><div class="cc-kpiIcon">⛏️</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Chumbadores</div><div class="cc-kpiValue">${kpis.total}</div><div class="cc-kpiSub">${kpis.verticais} vert. · ${kpis.horizontais} horiz.</div></div></div>
        <div class="cc-kpi cc-kpiGreen"><div class="cc-kpiIcon">✅</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Concluídos</div><div class="cc-kpiValue">${kpis.concluidos}</div><div class="cc-kpiSub">${SG.fmt1(kpis.pct)}%</div></div></div>
        <div class="cc-kpi cc-kpiBlue"><div class="cc-kpiIcon">📏</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Metros Lineares</div><div class="cc-kpiValue">${SG.fmt1(kpis.mlFeito)}<span class="cc-kpiUnit">ml</span></div><div class="cc-kpiSub">de ${SG.fmt1(kpis.mlTotal)} ml previstos</div></div></div>
        <div class="cc-kpi cc-kpiPurple"><div class="cc-kpiIcon">📐</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Área Executada</div><div class="cc-kpiValue">${SG.fmt1(totalArea)}<span class="cc-kpiUnit">m²</span></div></div></div>
        <div class="cc-kpi cc-kpiOrange"><div class="cc-kpiIcon">📅</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Dias com produção</div><div class="cc-kpiValue">${diasProducao}</div></div></div>
      </div>

      <div class="cc-panel">
        <div class="cc-panelTitle">📈 Curva de Progresso (Chumbadores Concluídos)</div>
        <div id="sg-curva"></div>
      </div>

      <div class="cc-panel">
        <div class="cc-panelTitle">⛏️ Chumbadores</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
          <input type="text" class="form-control" id="sg-busca" placeholder="🔍 Buscar por nº..." style="flex:1;min-width:140px;" value="${esc(fBusca)}" oninput="SG_UI.onFiltro()">
          <select class="form-control" id="sg-f-vista" style="max-width:180px;" onchange="SG_UI.onFiltro()">
            <option value="todas">Todas as vistas</option>
            ${vistasOrdenadas().map(v => `<option value="${v.id}" ${fVista === v.id ? 'selected' : ''}>${esc(vistaLabel(v))}</option>`).join('')}
          </select>
          <select class="form-control" id="sg-f-tipo" style="max-width:150px;" onchange="SG_UI.onFiltro()">
            <option value="todos">Todos os tipos</option>
            ${SG.TIPOS_CHUMBADOR.map(t => `<option value="${t}" ${fTipo === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
          <select class="form-control" id="sg-f-status" style="max-width:170px;" onchange="SG_UI.onFiltro()">
            <option value="todos">Todos os status</option>
            ${['Pendente', 'Furo feito', 'Injeção 1ª Parte', 'Injeção 2ª Parte', 'Concluído'].map(s => `<option value="${esc(s)}" ${fStatus === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}
          </select>
        </div>
        <div id="sg-tabela-chumbadores"></div>
      </div>
      </div>
    `;
    renderCurva();
    renderTabelaChumbadores();
  }

  function onFiltro() {
    fBusca = document.getElementById('sg-busca').value;
    fVista = document.getElementById('sg-f-vista').value;
    fTipo = document.getElementById('sg-f-tipo').value;
    fStatus = document.getElementById('sg-f-status').value;
    renderTabelaChumbadores();
  }

  // ── Curva de progresso (SVG simples) ──
  function renderCurva() {
    const el = document.getElementById('sg-curva');
    if (!el) return;
    const dados = SG.calcCurvaProgresso(chumbadores);
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

  // ── Tabela de chumbadores ──
  function renderTabelaChumbadores() {
    const el = document.getElementById('sg-tabela-chumbadores');
    if (!el) return;
    const busca = fBusca.toLowerCase();
    const lista = chumbadores.filter(c => {
      if (fVista !== 'todas' && c.vista !== fVista) return false;
      if (fTipo !== 'todos' && c.tipo !== fTipo) return false;
      if (fStatus !== 'todos' && SG.statusChumbador(c) !== fStatus) return false;
      if (busca && !String(c.numero).toLowerCase().includes(busca)) return false;
      return true;
    }).sort((a, b) => (a.numero || 0) - (b.numero || 0));

    if (!lista.length) {
      el.innerHTML = `<div class="cc-empty">⛏️<br>Nenhum chumbador cadastrado. Adicione um ou importe em lote.</div>`;
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
                <button class="btn btn-secundario btn-sm" onclick="SG_UI.abrirEditarChumbador('${c.id}')">✎</button>
                <button class="btn btn-secundario btn-sm" style="color:var(--cv-red);" onclick="SG_UI.excluirChumbador('${c.id}')">🗑</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      </div>`;
  }

  // ══════════════════════════════════════════
  // CRUD DE VISTAS
  // ══════════════════════════════════════════
  function abrirVistas() {
    renderVistas();
    Utils.abrirModal('modal-sg-vistas');
  }

  function renderVistas() {
    const el = document.getElementById('sg-vistas-body');
    if (!el) return;
    el.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <input type="text" id="sg-vista-numero" class="form-control" placeholder="Número (ex: 1)" style="max-width:120px;">
        <input type="text" id="sg-vista-nome" class="form-control" placeholder="Nome (opcional, ex: Face Norte)" style="flex:1;">
        <button class="btn btn-primario btn-sm" onclick="SG_UI.salvarVista()">+ Adicionar</button>
      </div>
      ${!vistas.length ? `<div class="cc-empty">Nenhuma vista cadastrada ainda.</div>` : `
      <div class="cc-tableWrap">
        <table class="cc-table">
          <thead><tr><th>Nº</th><th>Nome</th><th class="col-centro">Chumbadores</th><th class="col-acoes"></th></tr></thead>
          <tbody>
            ${vistasOrdenadas().map(v => `
              <tr>
                <td class="cc-tdAccent" style="font-weight:700;">${esc(v.numero)}</td>
                <td>${esc(v.nome || '—')}</td>
                <td class="col-centro">${chumbadores.filter(c => c.vista === v.id).length}</td>
                <td class="col-acoes"><button class="btn btn-secundario btn-sm" style="color:var(--cv-red);" onclick="SG_UI.excluirVista('${v.id}')">🗑</button></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`}`;
  }

  async function salvarVista() {
    const numero = document.getElementById('sg-vista-numero').value.trim();
    const nome = document.getElementById('sg-vista-nome').value.trim();
    if (!numero) { Utils.toast('Informe o número da vista.', 'alerta'); return; }
    Utils.mostrarLoading();
    try {
      await Database.criar(obraId, COL_VISTAS, { numero: parseInt(numero) || numero, nome }, SG.genId('v'));
      await carregar();
      renderVistas();
      Utils.toast('✓ Vista adicionada!', 'sucesso');
    } catch (e) {
      Utils.toast('Erro: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  async function excluirVista(id) {
    const v = vistas.find(x => x.id === id);
    if (!v) return;
    const emUso = chumbadores.filter(c => c.vista === id).length;
    if (emUso > 0) {
      const ok = await Utils.confirmar(`Esta vista tem ${emUso} chumbador(es) vinculado(s). Excluir mesmo assim? Os chumbadores continuarão existindo, apenas sem vista.`);
      if (!ok) return;
    } else {
      const ok = await Utils.confirmar(`Excluir a vista "${vistaLabel(v)}"?`);
      if (!ok) return;
    }
    Utils.mostrarLoading();
    try {
      await Database.deletar(obraId, COL_VISTAS, id);
      await carregar();
      renderVistas();
    } catch (e) {
      Utils.toast('Erro ao excluir: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ══════════════════════════════════════════
  // CRUD DE CHUMBADORES
  // ══════════════════════════════════════════
  function optVistas(sel) {
    return `<option value="">— sem vista —</option>` + vistasOrdenadas().map(v =>
      `<option value="${v.id}" ${v.id === sel ? 'selected' : ''}>${esc(vistaLabel(v))}</option>`).join('');
  }

  function abrirNovoChumbador() {
    chumbEditId = null;
    document.getElementById('sg-modal-chumb-titulo').textContent = '⛏️ Novo Chumbador';
    const f = document.getElementById('form-sg-chumbador');
    f.reset();
    f.querySelector('[name=vista]').innerHTML = optVistas('');
    f.querySelector('[name=tipo]').innerHTML = SG.TIPOS_CHUMBADOR.map(t => `<option value="${t}">${t}</option>`).join('');
    Utils.abrirModal('modal-sg-chumbador');
  }

  function abrirEditarChumbador(id) {
    const c = chumbadores.find(x => x.id === id);
    if (!c) return;
    chumbEditId = id;
    document.getElementById('sg-modal-chumb-titulo').textContent = `✎ Editando Chumbador ${c.numero}`;
    const f = document.getElementById('form-sg-chumbador');
    f.querySelector('[name=vista]').innerHTML = optVistas(c.vista || '');
    f.querySelector('[name=tipo]').innerHTML = SG.TIPOS_CHUMBADOR.map(t => `<option value="${t}" ${t === c.tipo ? 'selected' : ''}>${t}</option>`).join('');
    f.querySelector('[name=numero]').value = c.numero ?? '';
    f.querySelector('[name=comprimento]').value = c.comprimento ?? '';
    f.querySelector('[name=dataFuro]').value = c.dataFuro || '';
    f.querySelector('[name=dataInjecao1]').value = c.dataInjecao1 || '';
    f.querySelector('[name=dataInjecao2]').value = c.dataInjecao2 || '';
    f.querySelector('[name=dataConclusao]').value = c.dataConclusao || '';
    Utils.abrirModal('modal-sg-chumbador');
  }

  async function salvarChumbador() {
    const f = document.getElementById('form-sg-chumbador');
    const numero = f.querySelector('[name=numero]').value.trim();
    const vista = f.querySelector('[name=vista]').value;
    const tipo = f.querySelector('[name=tipo]').value;
    const comprimento = SG.num(f.querySelector('[name=comprimento]').value);
    const dataFuro = f.querySelector('[name=dataFuro]').value;
    const dataInjecao1 = f.querySelector('[name=dataInjecao1]').value;
    const dataInjecao2 = f.querySelector('[name=dataInjecao2]').value;
    const dataConclusao = f.querySelector('[name=dataConclusao]').value;
    if (!numero || !(comprimento > 0)) {
      Utils.toast('Preencha o número e o comprimento (maior que zero).', 'alerta');
      return;
    }
    Utils.mostrarLoading();
    try {
      const data = { numero, vista, tipo, comprimento, dataFuro, dataInjecao1, dataInjecao2, dataConclusao };
      if (chumbEditId) {
        await Database.atualizar(obraId, COL_CHUMBADORES, chumbEditId, data);
        Utils.toast(`✓ Chumbador ${numero} atualizado!`, 'sucesso');
      } else {
        await Database.criar(obraId, COL_CHUMBADORES, data, SG.genId('ch'));
        Utils.toast(`✓ Chumbador ${numero} adicionado!`, 'sucesso');
      }
      Utils.fecharModal('modal-sg-chumbador');
      await carregar();
    } catch (e) {
      Utils.toast('Erro ao salvar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  async function excluirChumbador(id) {
    const c = chumbadores.find(x => x.id === id);
    if (!c) return;
    const ok = await Utils.confirmar(`Excluir o chumbador ${c.numero}?`);
    if (!ok) return;
    Utils.mostrarLoading();
    try {
      await Database.deletar(obraId, COL_CHUMBADORES, id);
      Utils.toast('Chumbador excluído.', 'sucesso');
      await carregar();
    } catch (e) {
      Utils.toast('Erro ao excluir: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ══════════════════════════════════════════
  // IMPORTAÇÃO EM LOTE (chumbadores)
  // ══════════════════════════════════════════
  function abrirImportar() {
    previewImport = [];
    document.getElementById('sg-import-texto').value = '';
    document.getElementById('sg-import-preview').innerHTML = '';
    document.getElementById('sg-import-erro').style.display = 'none';
    document.getElementById('sg-import-btn').disabled = true;
    Utils.abrirModal('modal-sg-importar');
  }

  function baixarModeloTSV() {
    const header = 'Numero\tVista\tTipo\tComprimento (ml)\n';
    const exemplo = '1\t1\tVertical\t5\n2\t1\tVertical\t5\n3\t2\tHorizontal\t6';
    const blob = new Blob([header + exemplo], { type: 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'modelo_chumbadores.tsv'; a.click();
    URL.revokeObjectURL(url);
  }

  function parsearImport(txt) {
    const erroEl = document.getElementById('sg-import-erro');
    erroEl.style.display = 'none';
    const linhas = String(txt || '').trim().split(/\r?\n/).filter(l => l.trim());
    const itens = [];
    linhas.forEach((linha, i) => {
      if (i === 0 && linha.toLowerCase().includes('numero')) return;
      const cols = linha.split('\t').map(c => c.trim());
      const numero = cols[0], vistaNum = cols[1], tipo = cols[2], compRaw = cols[3];
      if (!numero) return;
      const comp = parseFloat((compRaw || '').replace(',', '.'));
      if (isNaN(comp) || comp <= 0) return;
      const tipoNorm = /horiz/i.test(tipo || '') ? 'Horizontal' : 'Vertical';
      itens.push({ numero, vistaNum, tipo: tipoNorm, comprimento: comp });
    });
    previewImport = itens;
    renderPreviewImport();
    if (!itens.length && linhas.length) {
      erroEl.textContent = 'Nenhuma linha válida encontrada. Verifique o formato (colunas separadas por TAB).';
      erroEl.style.display = 'block';
    }
  }

  function renderPreviewImport() {
    const el = document.getElementById('sg-import-preview');
    const btn = document.getElementById('sg-import-btn');
    btn.disabled = !previewImport.length;
    btn.textContent = previewImport.length ? `✓ Importar ${previewImport.length} chumbadores` : '✓ Importar';
    if (!previewImport.length) { el.innerHTML = ''; return; }
    el.innerHTML = `
      <div class="cc-tableWrap" style="max-height:220px;overflow-y:auto;margin-top:10px;">
        <table class="cc-table">
          <thead><tr><th>#</th><th>Nº</th><th>Vista</th><th>Tipo</th><th class="col-num">ml</th></tr></thead>
          <tbody>${previewImport.map((p, i) => `
            <tr><td>${i + 1}</td><td>${esc(p.numero)}</td><td>${esc(p.vistaNum)}</td><td>${esc(p.tipo)}</td><td class="col-num cc-tdMono">${SG.fmt1(p.comprimento)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function onImportTexto() { parsearImport(document.getElementById('sg-import-texto').value); }

  function onImportArquivo(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => parsearImport(e.target.result);
    reader.readAsText(file, 'UTF-8');
    input.value = '';
  }

  async function salvarImport() {
    if (!previewImport.length) return;
    Utils.mostrarLoading();
    try {
      // Cria vistas ausentes automaticamente
      const vistasExistentes = new Map(vistas.map(v => [String(v.numero), v.id]));
      const novasVistas = [...new Set(previewImport.map(p => p.vistaNum).filter(Boolean))]
        .filter(vn => !vistasExistentes.has(String(vn)));
      for (const vn of novasVistas) {
        const ref = Database.ref(obraId, COL_VISTAS).doc(SG.genId('v'));
        await Database.batchWrite([{ type: 'set', ref, data: { numero: parseInt(vn) || vn, nome: '', obraId } }]);
        vistasExistentes.set(String(vn), ref.id);
      }
      const ops = previewImport.map(p => ({
        type: 'set',
        ref: Database.ref(obraId, COL_CHUMBADORES).doc(SG.genId('ch')),
        data: {
          numero: p.numero, tipo: p.tipo, comprimento: p.comprimento,
          vista: vistasExistentes.get(String(p.vistaNum)) || '',
          dataFuro: '', dataInjecao1: '', dataInjecao2: '', dataConclusao: '',
          obraId,
        },
      }));
      for (let i = 0; i < ops.length; i += 400) {
        await Database.batchWrite(ops.slice(i, i + 400));
      }
      Utils.toast(`✓ ${previewImport.length} chumbadores importados!`, 'sucesso');
      previewImport = [];
      Utils.fecharModal('modal-sg-importar');
      await carregar();
    } catch (e) {
      Utils.toast('Erro ao importar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ══════════════════════════════════════════
  // PRODUÇÃO DIÁRIA (Grampos/Extras/Estacas)
  // ══════════════════════════════════════════
  function abrirProducaoDiaria() {
    producaoEditId = null;
    renderProducaoDiaria();
    Utils.abrirModal('modal-sg-producao');
  }

  function renderProducaoDiaria() {
    const el = document.getElementById('sg-producao-body');
    if (!el) return;
    const lista = [...producao].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    const totalMl = producao.reduce((s, p) => s + SG.mlDiaProducao(p), 0);
    el.innerHTML = `
      <div class="form-row">
        <div class="form-grupo"><label>Data</label><input type="date" id="sg-prod-data" class="form-control" value="${esc(Utils.hoje())}"></div>
      </div>
      <div class="form-row">
        <div class="form-grupo"><label>Grampos (uni)</label><input type="text" inputmode="decimal" id="sg-prod-grampos" class="form-control" placeholder="0"></div>
        <div class="form-grupo"><label>Tamanho Grampos (m)</label><input type="text" inputmode="decimal" id="sg-prod-tgrampos" class="form-control" placeholder="0"></div>
      </div>
      <div class="form-row">
        <div class="form-grupo"><label>Extras (uni)</label><input type="text" inputmode="decimal" id="sg-prod-extras" class="form-control" placeholder="0"></div>
        <div class="form-grupo"><label>Tamanho Extras (m)</label><input type="text" inputmode="decimal" id="sg-prod-textras" class="form-control" placeholder="0"></div>
      </div>
      <div class="form-row">
        <div class="form-grupo"><label>Estacas (uni)</label><input type="text" inputmode="decimal" id="sg-prod-estacas" class="form-control" placeholder="0"></div>
        <div class="form-grupo"><label>Tamanho Estacas (m)</label><input type="text" inputmode="decimal" id="sg-prod-testacas" class="form-control" placeholder="0"></div>
      </div>
      <button class="btn btn-primario btn-sm" onclick="SG_UI.salvarProducaoDiaria()">+ Registrar dia</button>
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
                <td class="col-acoes"><button class="btn btn-secundario btn-sm" style="color:var(--cv-red);" onclick="SG_UI.excluirProducaoDiaria('${p.id}')">🗑</button></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`}`;
  }

  async function salvarProducaoDiaria() {
    const data = document.getElementById('sg-prod-data').value;
    if (!data) { Utils.toast('Informe a data.', 'alerta'); return; }
    const reg = {
      data,
      grampos: SG.num(document.getElementById('sg-prod-grampos').value),
      tamanhoGrampos: SG.num(document.getElementById('sg-prod-tgrampos').value),
      extras: SG.num(document.getElementById('sg-prod-extras').value),
      tamanhoExtras: SG.num(document.getElementById('sg-prod-textras').value),
      estacas: SG.num(document.getElementById('sg-prod-estacas').value),
      tamanhoEstacas: SG.num(document.getElementById('sg-prod-testacas').value),
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
    areaEditId = null;
    renderAreaExecutada();
    Utils.abrirModal('modal-sg-area');
  }

  function renderAreaExecutada() {
    const el = document.getElementById('sg-area-body');
    if (!el) return;
    const lista = [...areaExecutada].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    const total = areaExecutada.reduce((s, a) => s + SG.num(a.area), 0);
    el.innerHTML = `
      <div class="form-row">
        <div class="form-grupo"><label>Data</label><input type="date" id="sg-area-data" class="form-control" value="${esc(Utils.hoje())}"></div>
        <div class="form-grupo"><label>Vista</label><select id="sg-area-vista" class="form-control">${optVistas('')}</select></div>
      </div>
      <div class="form-grupo"><label>Área executada (m²)</label><input type="text" inputmode="decimal" id="sg-area-valor" class="form-control" placeholder="0"></div>
      <button class="btn btn-primario btn-sm" onclick="SG_UI.salvarAreaExecutada()">+ Registrar</button>
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
                <td class="col-acoes"><button class="btn btn-secundario btn-sm" style="color:var(--cv-red);" onclick="SG_UI.excluirAreaExecutada('${a.id}')">🗑</button></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`}`;
  }

  async function salvarAreaExecutada() {
    const data = document.getElementById('sg-area-data').value;
    const vista = document.getElementById('sg-area-vista').value;
    const area = SG.num(document.getElementById('sg-area-valor').value);
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
    abrirVistas, salvarVista, excluirVista,
    abrirNovoChumbador, abrirEditarChumbador, salvarChumbador, excluirChumbador,
    abrirImportar, baixarModeloTSV, onImportTexto, onImportArquivo, salvarImport,
    abrirProducaoDiaria, salvarProducaoDiaria, excluirProducaoDiaria,
    abrirAreaExecutada, salvarAreaExecutada, excluirAreaExecutada,
  };
})();

const SG_UI = LevantamentoSoloGrampeado;

function onObraChanged() {
  LevantamentoSoloGrampeado.recarregar();
}

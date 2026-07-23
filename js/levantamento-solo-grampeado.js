// ============================================
// Módulo: Levantamento de Solo Grampeado
// Vistas = grid de chumbadores (vertical x horizontal), com
// escala calibrada por linha + cm real, m² da vista, imagem de
// fundo opcional (planta), e Especificações de Materiais
// (modelo do chumbador, barra de aço, mangueira/espaguete,
// cimento de injeção) vinculadas à Biblioteca de Materiais.
// A execução (etapas, % e minimapa de progresso) fica em
// Controle de Solo Grampeado.
// Dados: Firestore obras/{obraId}/sg* e config/sgEspecificacoes,
// config/sgImagem_{vistaId}
// ============================================

const LevantamentoSoloGrampeado = (() => {
  const SG = SoloGrampeadoCalculos;
  const COL_VISTAS = 'sgVistas';
  const COL_CHUMBADORES = 'sgChumbadores';

  let obraId = null;
  let vistas = [];
  let chumbadores = [];
  let biblioteca = [];
  let especificacoes = []; // config/sgEspecificacoes.especificacoes

  let vistaAtivaId = null;
  let imagemCacheVistaId = null, imagemCacheBase64 = null;

  let calibClicks = []; // pontos clicados no SVG durante calibração
  let modoCalibrando = false;
  let chumbEditId = null;
  let especEditId = null;

  const esc = SG.esc;

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
      const [vs, cs, mats, cfg] = await Promise.all([
        Database.listar(obraId, COL_VISTAS, null),
        Database.listar(obraId, COL_CHUMBADORES, null),
        Database.listar(obraId, 'materiais', 'nome').catch(() => []),
        Database.obter(obraId, 'config', 'sgEspecificacoes').catch(() => null),
      ]);
      vistas = vs; chumbadores = cs; biblioteca = mats;
      especificacoes = (cfg && cfg.especificacoes) || [];
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
  function especLabel(e) { return e ? e.nome : '—'; }

  // ══════════════════════════════════════════
  // RENDER PRINCIPAL
  // ══════════════════════════════════════════
  function renderizar() {
    const c = document.getElementById('sg-content');
    if (!c) return;
    const v = vistaAtiva();
    const mlTotal = chumbadores.reduce((s, c) => s + SG.num(c.comprimento), 0);
    const verticais = chumbadores.filter(c => c.tipo === 'Vertical').length;
    const horizontais = chumbadores.filter(c => c.tipo === 'Horizontal').length;

    c.innerHTML = `
      <div class="cc-view">
      <div class="page-header">
        <div>
          <h2>⛏️ Levantamento de Solo Grampeado</h2>
          <span class="subtitulo">Grid de chumbadores por vista — quantitativo e especificações de materiais</span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-secundario btn-sm" onclick="SG_UI.abrirVistas()">◈ Vistas</button>
          <button class="btn btn-secundario btn-sm" onclick="SG_UI.abrirEspecificacoes()">🧱 Especificações de Materiais</button>
        </div>
      </div>

      <div class="cc-kpiGrid" style="grid-template-columns:repeat(4,1fr);">
        <div class="cc-kpi"><div class="cc-kpiIcon">⛏️</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Chumbadores</div><div class="cc-kpiValue">${chumbadores.length}</div><div class="cc-kpiSub">${verticais} vert. · ${horizontais} horiz.</div></div></div>
        <div class="cc-kpi cc-kpiBlue"><div class="cc-kpiIcon">📏</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Metros Lineares Previstos</div><div class="cc-kpiValue">${SG.fmt1(mlTotal)}<span class="cc-kpiUnit">ml</span></div></div></div>
        <div class="cc-kpi"><div class="cc-kpiIcon">◈</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Vistas cadastradas</div><div class="cc-kpiValue">${vistas.length}</div></div></div>
        <div class="cc-kpi"><div class="cc-kpiIcon">✅</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Execução</div><div class="cc-kpiValue" style="font-size:14px;">Ver em Controle</div></div></div>
      </div>

      <div class="cc-panel">
        <div class="cc-panelTitle">🗺️ Grid da Vista</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;align-items:center;">
          <select class="form-control" id="sg-vista-ativa" style="max-width:240px;" onchange="SG_UI.onTrocarVistaAtiva()">
            ${!vistas.length ? '<option value="">— nenhuma vista cadastrada —</option>' : ''}
            ${vistasOrdenadas().map(vv => `<option value="${vv.id}" ${vv.id === vistaAtivaId ? 'selected' : ''}>${esc(vistaLabel(vv))}</option>`).join('')}
          </select>
          ${v ? `
          <button class="btn btn-secundario btn-sm" onclick="SG_UI.abrirConfigGrid('${v.id}')">⚙ Config. Grid</button>
          <button class="btn btn-secundario btn-sm" onclick="SG_UI.abrirImagemFundo('${v.id}')">🖼 Imagem de Fundo</button>
          <button class="btn ${modoCalibrando ? 'btn-primario' : 'btn-secundario'} btn-sm" onclick="SG_UI.toggleCalibrar()">📏 ${modoCalibrando ? 'Clique 2 pontos...' : 'Calibrar Escala'}</button>
          ` : ''}
        </div>
        <div id="sg-grid-host"></div>
      </div>

      <div class="cc-panel">
        <div class="cc-panelTitle">⛏️ Chumbadores da Vista</div>
        <div id="sg-tabela-chumbadores"></div>
      </div>
      </div>
    `;
    renderGrid();
    renderTabelaChumbadores();
  }

  async function onTrocarVistaAtiva() {
    vistaAtivaId = document.getElementById('sg-vista-ativa').value || null;
    calibClicks = []; modoCalibrando = false;
    renderizar();
  }

  // ══════════════════════════════════════════
  // GRID VISUAL (SVG) — configuração, não execução
  // ══════════════════════════════════════════
  async function renderGrid() {
    const host = document.getElementById('sg-grid-host');
    if (!host) return;
    const v = vistaAtiva();
    if (!v) { host.innerHTML = `<div class="cc-empty">⛏️<br>Cadastre uma vista para começar.</div>`; return; }
    if (!(SG.num(v.gridCols) > 0) || !(SG.num(v.gridRows) > 0)) {
      host.innerHTML = `<div class="cc-empty">⚙ Configure a quantidade de chumbadores (vertical/horizontal) desta vista em <b>Config. Grid</b>.</div>`;
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
    const execMap = {}; // Levantamento não tem execução — grid usado só p/ posicionar
    const lista = chumbadoresDaVista(v.id);
    const svg = SG.svgMinimapa(v, lista, execMap, null, imagem, {
      interativo: true, chumbadorClickFn: 'SG_UI.onClickBolinha', mostrarCalibracao: true,
    });
    const info = SG.num(v.escalaCmPorPx) > 0
      ? `Escala: 1px ≈ ${SG.fmt2(v.escalaCmPorPx)} cm · m² sugerido: ${SG.fmt1(SG.calcM2Sugerido(v))}`
      : 'Sem escala calibrada ainda';
    host.innerHTML = `
      <div id="sg-svg-wrap" onclick="SG_UI.onClickSvg(event)">${svg}</div>
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-top:8px;font-size:0.78rem;color:var(--cor-texto-secundario);font-family:var(--font-mono);">
        <span>${esc(info)}</span>
        <span>m² total da vista: <b style="color:var(--cor-texto);">${SG.fmt1(v.m2Total)}</b> <button class="btn btn-secundario btn-sm" style="padding:2px 8px;" onclick="SG_UI.abrirEditarM2('${v.id}')">✎</button></span>
      </div>
      ${modoCalibrando ? `<div class="cc-empty" style="margin-top:8px;">Clique dois pontos no grid marcando uma distância conhecida.</div>` : ''}
    `;
  }

  function onClickSvg(ev) {
    if (!modoCalibrando) return;
    const svg = ev.currentTarget.querySelector('svg');
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX; pt.y = ev.clientY;
    const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
    calibClicks.push({ x: loc.x, y: loc.y });
    if (calibClicks.length === 2) {
      const linha = { x1: calibClicks[0].x, y1: calibClicks[0].y, x2: calibClicks[1].x, y2: calibClicks[1].y };
      calibClicks = []; modoCalibrando = false;
      abrirConfirmarCalibracao(linha);
    } else {
      renderGrid();
    }
  }

  function toggleCalibrar() {
    modoCalibrando = !modoCalibrando;
    calibClicks = [];
    renderGrid();
    renderizar();
  }

  function abrirConfirmarCalibracao(linha) {
    document.getElementById('sg-calib-cm').value = '';
    document.getElementById('form-sg-calib').dataset.linha = JSON.stringify(linha);
    Utils.abrirModal('modal-sg-calibracao');
  }

  async function salvarCalibracao() {
    const v = vistaAtiva();
    if (!v) return;
    const linha = JSON.parse(document.getElementById('form-sg-calib').dataset.linha || 'null');
    const cm = SG.num(document.getElementById('sg-calib-cm').value);
    if (!linha || !(cm > 0)) { Utils.toast('Informe o comprimento real (cm) da linha.', 'alerta'); return; }
    const escala = SG.calcEscalaCmPorPx(linha, cm);
    Utils.mostrarLoading();
    try {
      const vTemp = { ...v, escalaCmPorPx: escala, linhaCalibracao: linha };
      const m2Sugerido = SG.calcM2Sugerido(vTemp);
      await Database.atualizar(obraId, COL_VISTAS, v.id, { escalaCmPorPx: escala, linhaCalibracao: linha, m2Total: m2Sugerido });
      Utils.toast(`✓ Escala calibrada! m² sugerido: ${SG.fmt1(m2Sugerido)}`, 'sucesso');
      Utils.fecharModal('modal-sg-calibracao');
      await carregar();
    } catch (e) {
      Utils.toast('Erro ao salvar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  function abrirEditarM2(vistaId) {
    const v = vistas.find(x => x.id === vistaId);
    if (!v) return;
    document.getElementById('sg-m2-vistaid').value = vistaId;
    document.getElementById('sg-m2-valor').value = v.m2Total ?? '';
    Utils.abrirModal('modal-sg-m2');
  }
  async function salvarM2() {
    const vistaId = document.getElementById('sg-m2-vistaid').value;
    const m2 = SG.num(document.getElementById('sg-m2-valor').value);
    Utils.mostrarLoading();
    try {
      await Database.atualizar(obraId, COL_VISTAS, vistaId, { m2Total: m2 });
      Utils.toast('✓ m² total atualizado!', 'sucesso');
      Utils.fecharModal('modal-sg-m2');
      await carregar();
    } catch (e) {
      Utils.toast('Erro: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // Clique numa bolinha do grid (no Levantamento = editar specs do chumbador)
  function onClickBolinha(chumbadorId) {
    abrirEditarChumbador(chumbadorId);
  }

  // ── Tabela de chumbadores (spec, sem status de execução) ──
  function renderTabelaChumbadores() {
    const el = document.getElementById('sg-tabela-chumbadores');
    if (!el) return;
    const v = vistaAtiva();
    if (!v) { el.innerHTML = `<div class="cc-empty">Nenhuma vista selecionada.</div>`; return; }
    const lista = chumbadoresDaVista(v.id);
    if (!lista.length) {
      el.innerHTML = `<div class="cc-empty">⛏️<br>Nenhum chumbador ainda. Configure o grid (linhas × colunas) em "Config. Grid".</div>`;
      return;
    }
    const mlTotal = lista.reduce((s, c) => s + SG.num(c.comprimento), 0);
    el.innerHTML = `
      <div class="cc-tableWrap" style="max-height:420px;overflow-y:auto;">
      <table class="cc-table">
        <thead><tr><th>Nº</th><th>Posição</th><th>Tipo</th><th class="col-num">Comp. (ml)</th><th class="col-num">Prof. (cm)</th><th>Especificação</th><th class="col-acoes"></th></tr></thead>
        <tbody>
          ${lista.map(c => {
            const e = especificacoes.find(x => x.id === c.especId);
            return `<tr>
              <td style="font-weight:600;">${esc(c.numero)}</td>
              <td class="cc-tdMono">L${(c.linha ?? 0) + 1}·C${(c.coluna ?? 0) + 1}</td>
              <td>${esc(c.tipo)}</td>
              <td class="col-num cc-tdMono">${SG.fmt1(c.comprimento)}</td>
              <td class="col-num cc-tdMono">${c.profundidade ? SG.fmt1(c.profundidade) : '—'}</td>
              <td>${esc(especLabel(e))}</td>
              <td class="col-acoes">
                <button class="btn btn-secundario btn-sm" onclick="SG_UI.abrirEditarChumbador('${c.id}')">✎</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot><tr><td colspan="3" style="font-weight:700;">${lista.length} chumbador${lista.length !== 1 ? 'es' : ''}</td><td class="col-num cc-tdMono" style="font-weight:700;">${SG.fmt1(mlTotal)}</td><td colspan="3"></td></tr></tfoot>
      </table>
      </div>`;
  }

  // ══════════════════════════════════════════
  // EDITAR CHUMBADOR (tipo, comprimento, profundidade, especificação)
  // ══════════════════════════════════════════
  function abrirEditarChumbador(id) {
    const c = chumbadores.find(x => x.id === id);
    if (!c) return;
    chumbEditId = id;
    document.getElementById('sg-modal-chumb-titulo').textContent = `✎ Chumbador ${c.numero} (L${(c.linha ?? 0) + 1}·C${(c.coluna ?? 0) + 1})`;
    const f = document.getElementById('form-sg-chumbador');
    f.querySelector('[name=tipo]').innerHTML = SG.TIPOS_CHUMBADOR.map(t => `<option value="${t}" ${t === c.tipo ? 'selected' : ''}>${t}</option>`).join('');
    f.querySelector('[name=especId]').innerHTML = `<option value="">— sem especificação —</option>` +
      especificacoes.map(e => `<option value="${e.id}" ${e.id === c.especId ? 'selected' : ''}>${esc(e.nome)}</option>`).join('');
    f.querySelector('[name=comprimento]').value = c.comprimento ?? '';
    f.querySelector('[name=profundidade]').value = c.profundidade ?? '';
    Utils.abrirModal('modal-sg-chumbador');
  }

  async function salvarChumbador() {
    if (!chumbEditId) return;
    const f = document.getElementById('form-sg-chumbador');
    const tipo = f.querySelector('[name=tipo]').value;
    const comprimento = SG.num(f.querySelector('[name=comprimento]').value);
    const profundidade = SG.num(f.querySelector('[name=profundidade]').value);
    const especId = f.querySelector('[name=especId]').value;
    if (!(comprimento > 0)) { Utils.toast('Informe o comprimento (maior que zero).', 'alerta'); return; }
    Utils.mostrarLoading();
    try {
      await Database.atualizar(obraId, COL_CHUMBADORES, chumbEditId, { tipo, comprimento, profundidade, especId });
      Utils.toast('✓ Chumbador atualizado!', 'sucesso');
      Utils.fecharModal('modal-sg-chumbador');
      await carregar();
    } catch (e) {
      Utils.toast('Erro ao salvar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ══════════════════════════════════════════
  // CONFIG. DE GRID DA VISTA (gera/reconcilia chumbadores)
  // ══════════════════════════════════════════
  function abrirConfigGrid(vistaId) {
    const v = vistas.find(x => x.id === vistaId);
    if (!v) return;
    document.getElementById('sg-cfg-vistaid').value = vistaId;
    document.getElementById('sg-cfg-cols').value = v.gridCols || '';
    document.getElementById('sg-cfg-rows').value = v.gridRows || '';
    document.getElementById('sg-cfg-comp-vert').value = v.comprimentoPadraoVertical ?? '';
    document.getElementById('sg-cfg-comp-horiz').value = v.comprimentoPadraoHorizontal ?? '';
    document.getElementById('sg-cfg-espec').innerHTML = `<option value="">— sem especificação padrão —</option>` +
      especificacoes.map(e => `<option value="${e.id}" ${e.id === v.especIdPadrao ? 'selected' : ''}>${esc(e.nome)}</option>`).join('');
    Utils.abrirModal('modal-sg-config-grid');
  }

  async function salvarConfigGrid() {
    const vistaId = document.getElementById('sg-cfg-vistaid').value;
    const cols = parseInt(document.getElementById('sg-cfg-cols').value) || 0;
    const rows = parseInt(document.getElementById('sg-cfg-rows').value) || 0;
    const compVert = SG.num(document.getElementById('sg-cfg-comp-vert').value) || 1;
    const compHoriz = SG.num(document.getElementById('sg-cfg-comp-horiz').value) || 1;
    const especIdPadrao = document.getElementById('sg-cfg-espec').value;
    if (!(cols > 0) || !(rows > 0)) { Utils.toast('Informe quantidade de colunas e linhas maior que zero.', 'alerta'); return; }
    if (cols * rows > 400) { Utils.toast('Grid muito grande (máx. 400 chumbadores por vista). Divida em mais vistas.', 'alerta'); return; }

    Utils.mostrarLoading();
    try {
      await Database.atualizar(obraId, COL_VISTAS, vistaId, {
        gridCols: cols, gridRows: rows,
        comprimentoPadraoVertical: compVert, comprimentoPadraoHorizontal: compHoriz,
        especIdPadrao,
      });
      await _reconciliarChumbadoresDoGrid(vistaId, cols, rows, compVert, compHoriz, especIdPadrao);
      Utils.toast('✓ Grid configurado!', 'sucesso');
      Utils.fecharModal('modal-sg-config-grid');
      await carregar();
    } catch (e) {
      Utils.toast('Erro ao salvar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // Cria os chumbadores que faltam para o novo grid e remove os que
  // ficaram fora dele. Chumbadores já existentes na mesma posição
  // (linha/coluna) mantêm tipo/comprimento/profundidade/especId.
  async function _reconciliarChumbadoresDoGrid(vistaId, cols, rows, compVert, compHoriz, especIdPadrao) {
    const existentes = chumbadores.filter(c => c.vista === vistaId);
    const existentesPorPos = new Map(existentes.map(c => [`${c.linha}_${c.coluna}`, c]));
    const ops = [];
    let numero = 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const key = `${r}_${c}`;
        if (!existentesPorPos.has(key)) {
          const tipo = 'Vertical';
          ops.push({
            type: 'set',
            ref: Database.ref(obraId, COL_CHUMBADORES).doc(SG.genId('ch')),
            data: { vista: vistaId, numero: numero, linha: r, coluna: c, tipo, comprimento: compVert, profundidade: 0, especId: especIdPadrao || '', obraId },
          });
        } else {
          existentesPorPos.delete(key);
        }
        numero++;
      }
    }
    // Sobrou nesse Map = fora do novo grid → remove
    for (const c of existentesPorPos.values()) {
      ops.push({ type: 'delete', ref: Database.ref(obraId, COL_CHUMBADORES).doc(c.id) });
    }
    for (let i = 0; i < ops.length; i += 400) {
      await Database.batchWrite(ops.slice(i, i + 400));
    }
  }

  // ══════════════════════════════════════════
  // IMAGEM DE FUNDO (planta) — mesmo padrão do mapa de fachada
  // ══════════════════════════════════════════
  function abrirImagemFundo(vistaId) {
    document.getElementById('sg-img-vistaid').value = vistaId;
    Utils.abrirModal('modal-sg-imagem');
  }
  function onImagemArquivo(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async e => {
      const vistaId = document.getElementById('sg-img-vistaid').value;
      const img = e.target.result;
      if (img.length > 950000) { Utils.toast('Imagem muito grande. Tente um arquivo menor.', 'erro'); return; }
      Utils.mostrarLoading();
      try {
        await db.collection('obras').doc(obraId).collection('config').doc('sgImagem_' + vistaId).set({ img });
        imagemCacheVistaId = null;
        Utils.toast('✓ Imagem de fundo salva!', 'sucesso');
        Utils.fecharModal('modal-sg-imagem');
        renderGrid();
      } catch (err) {
        Utils.toast('Erro ao salvar imagem: ' + err.message, 'erro');
      } finally {
        Utils.esconderLoading();
      }
    };
    reader.readAsDataURL(file);
    input.value = '';
  }
  async function removerImagemFundo() {
    const vistaId = document.getElementById('sg-img-vistaid').value;
    Utils.mostrarLoading();
    try {
      await db.collection('obras').doc(obraId).collection('config').doc('sgImagem_' + vistaId).delete();
      imagemCacheVistaId = null;
      Utils.toast('Imagem removida.', 'sucesso');
      Utils.fecharModal('modal-sg-imagem');
      renderGrid();
    } catch (e) {
      Utils.toast('Erro: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
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
        <input type="text" class="form-control" id="sg-nova-vista-nome" placeholder="Nome da vista (ex: Face Norte)">
        <button class="btn btn-primario btn-sm" onclick="SG_UI.salvarVista()">+ Adicionar</button>
      </div>
      ${!vistas.length ? '<div class="cc-empty">Nenhuma vista cadastrada.</div>' : `
      <div class="cc-tableWrap" style="max-height:320px;overflow-y:auto;">
        <table class="cc-table">
          <thead><tr><th>Nº</th><th>Nome</th><th class="col-num">Chumbadores</th><th class="col-acoes"></th></tr></thead>
          <tbody>
            ${vistasOrdenadas().map(v => `
              <tr>
                <td>${esc(v.numero)}</td>
                <td>${esc(v.nome || '—')}</td>
                <td class="col-num cc-tdMono">${chumbadoresDaVista(v.id).length}</td>
                <td class="col-acoes"><button class="btn btn-secundario btn-sm" style="color:var(--cv-red);" onclick="SG_UI.excluirVista('${v.id}')">🗑</button></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`}`;
  }

  async function salvarVista() {
    const nome = document.getElementById('sg-nova-vista-nome').value.trim();
    const proxNumero = vistas.length ? Math.max(...vistas.map(v => v.numero || 0)) + 1 : 1;
    Utils.mostrarLoading();
    try {
      await Database.criar(obraId, COL_VISTAS, { numero: proxNumero, nome, gridCols: 0, gridRows: 0, m2Total: 0, obraId }, SG.genId('v'));
      Utils.toast('✓ Vista adicionada!', 'sucesso');
      document.getElementById('sg-nova-vista-nome').value = '';
      await carregar();
      renderVistas();
    } catch (e) {
      Utils.toast('Erro: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  async function excluirVista(id) {
    const qtd = chumbadoresDaVista(id).length;
    const ok = await Utils.confirmar(`Excluir esta vista? ${qtd ? `Isso também remove os ${qtd} chumbadores cadastrados nela.` : ''}`);
    if (!ok) return;
    Utils.mostrarLoading();
    try {
      const ops = [{ type: 'delete', ref: Database.ref(obraId, COL_VISTAS).doc(id) }];
      chumbadores.filter(c => c.vista === id).forEach(c => ops.push({ type: 'delete', ref: Database.ref(obraId, COL_CHUMBADORES).doc(c.id) }));
      await Database.batchWrite(ops);
      try { await db.collection('obras').doc(obraId).collection('config').doc('sgImagem_' + id).delete(); } catch (e) {}
      Utils.toast('Vista excluída.', 'sucesso');
      if (vistaAtivaId === id) vistaAtivaId = null;
      await carregar();
      renderVistas();
    } catch (e) {
      Utils.toast('Erro ao excluir: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ══════════════════════════════════════════
  // ESPECIFICAÇÕES DE MATERIAIS (config/sgEspecificacoes)
  // Modelo do chumbador + barra de aço + mangueira (espaguete)
  // + cimento de injeção — cada um vinculado à Biblioteca de
  // Materiais (criando o material ali se ainda não existir).
  // ══════════════════════════════════════════
  function abrirEspecificacoes() {
    especEditId = null;
    renderEspecificacoes();
    Utils.abrirModal('modal-sg-especificacoes');
  }

  function _seletorMaterial(campo, valorId) {
    return `
      <select class="form-control sg-mat-select" data-campo="${campo}" style="margin-bottom:4px;">
        <option value="">— selecione —</option>
        ${biblioteca.map(m => `<option value="${m.id}" ${m.id === valorId ? 'selected' : ''}>${esc(m.nome)}${m.fabricante ? ' — ' + esc(m.fabricante) : ''}</option>`).join('')}
      </select>
      <div style="display:flex;gap:4px;">
        <input type="text" class="form-control" placeholder="Novo material..." id="sg-novo-${campo}" style="font-size:0.78rem;">
        <button type="button" class="btn btn-secundario btn-sm" onclick="SG_UI.criarMaterialInline('${campo}')">+ Criar</button>
      </div>`;
  }

  async function criarMaterialInline(campo) {
    const input = document.getElementById(`sg-novo-${campo}`);
    const nome = input.value.trim();
    if (!nome) { Utils.toast('Digite o nome do material.', 'alerta'); return; }
    Utils.mostrarLoading();
    try {
      const id = await Database.criar(obraId, 'materiais', { nome, tipo: '', unidade: 'un', fabricante: '', referencia: '' });
      biblioteca.push({ id, nome, tipo: '', unidade: 'un' });
      const select = document.querySelector(`select.sg-mat-select[data-campo="${campo}"]`);
      if (select) {
        select.innerHTML += `<option value="${id}" selected>${esc(nome)}</option>`;
      }
      input.value = '';
      Utils.toast('✓ Material criado e vinculado!', 'sucesso');
    } catch (e) {
      Utils.toast('Erro ao criar material: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  function renderEspecificacoes() {
    const el = document.getElementById('sg-espec-body');
    if (!el) return;
    const editando = especEditId ? especificacoes.find(e => e.id === especEditId) : null;
    el.innerHTML = `
      <div class="cc-panel" style="padding:12px;margin-bottom:12px;">
        <div class="cc-panelTitle" style="font-size:0.9rem;">${editando ? '✎ Editando especificação' : '+ Nova especificação'}</div>
        <div class="form-grupo"><label>Nome (ex: Chumbador CA-50 Ø10mm)</label><input type="text" class="form-control" id="sg-espec-nome" value="${esc(editando?.nome || '')}"></div>
        <div class="form-row">
          <div class="form-grupo"><label>Modelo do chumbador (material)</label>${_seletorMaterial('modelo', editando?.materialModeloId)}</div>
          <div class="form-grupo"><label>Barra de aço (material)</label>${_seletorMaterial('barraAco', editando?.materialBarraAcoId)}</div>
        </div>
        <div class="form-row">
          <div class="form-grupo"><label>Mangueira / espaguete (material)</label>${_seletorMaterial('mangueira', editando?.materialMangueiraId)}
            <label style="margin-top:4px;">Consumo (m de mangueira por ml de chumbador)</label><input type="number" step="0.01" class="form-control" id="sg-espec-mangueira-consumo" value="${editando?.mangueiraMlPorMl ?? ''}" placeholder="1.0"></div>
          <div class="form-grupo"><label>Cimento de injeção (material)</label>${_seletorMaterial('cimento', editando?.materialCimentoId)}
            <label style="margin-top:4px;">Consumo médio (kg por injeção/chumbador)</label><input type="number" step="0.01" class="form-control" id="sg-espec-cimento-consumo" value="${editando?.cimentoConsumoPorInjecao ?? ''}" placeholder="0"></div>
        </div>
        <div class="form-grupo"><label>Volume de calda injetada (m³ por ml de chumbador)</label><input type="number" step="0.001" class="form-control" id="sg-espec-volume" value="${editando?.volumeConcretoPorMl ?? ''}" placeholder="0"></div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-primario btn-sm" onclick="SG_UI.salvarEspecificacao()">${editando ? 'Salvar alterações' : '+ Adicionar especificação'}</button>
          ${editando ? `<button class="btn btn-secundario btn-sm" onclick="SG_UI.cancelarEdicaoEspec()">Cancelar</button>` : ''}
        </div>
      </div>
      ${!especificacoes.length ? '<div class="cc-empty">Nenhuma especificação cadastrada ainda.</div>' : `
      <div class="cc-tableWrap" style="max-height:260px;overflow-y:auto;">
        <table class="cc-table">
          <thead><tr><th>Nome</th><th>Modelo</th><th>Barra Aço</th><th>Mangueira</th><th>Cimento</th><th class="col-acoes"></th></tr></thead>
          <tbody>
            ${especificacoes.map(e => `
              <tr>
                <td style="font-weight:600;">${esc(e.nome)}</td>
                <td>${esc(biblioteca.find(m => m.id === e.materialModeloId)?.nome || '—')}</td>
                <td>${esc(biblioteca.find(m => m.id === e.materialBarraAcoId)?.nome || '—')}</td>
                <td>${esc(biblioteca.find(m => m.id === e.materialMangueiraId)?.nome || '—')}</td>
                <td>${esc(biblioteca.find(m => m.id === e.materialCimentoId)?.nome || '—')}</td>
                <td class="col-acoes">
                  <button class="btn btn-secundario btn-sm" onclick="SG_UI.editarEspecificacao('${e.id}')">✎</button>
                  <button class="btn btn-secundario btn-sm" style="color:var(--cv-red);" onclick="SG_UI.excluirEspecificacao('${e.id}')">🗑</button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`}`;
  }

  function editarEspecificacao(id) { especEditId = id; renderEspecificacoes(); }
  function cancelarEdicaoEspec() { especEditId = null; renderEspecificacoes(); }

  async function salvarEspecificacao() {
    const nome = document.getElementById('sg-espec-nome').value.trim();
    if (!nome) { Utils.toast('Informe o nome da especificação.', 'alerta'); return; }
    const getSel = campo => document.querySelector(`select.sg-mat-select[data-campo="${campo}"]`)?.value || '';
    const nova = {
      id: especEditId || SG.genId('esp'),
      nome,
      materialModeloId: getSel('modelo'),
      materialBarraAcoId: getSel('barraAco'),
      materialMangueiraId: getSel('mangueira'),
      mangueiraMlPorMl: SG.num(document.getElementById('sg-espec-mangueira-consumo').value),
      materialCimentoId: getSel('cimento'),
      cimentoConsumoPorInjecao: SG.num(document.getElementById('sg-espec-cimento-consumo').value),
      volumeConcretoPorMl: SG.num(document.getElementById('sg-espec-volume').value),
    };
    Utils.mostrarLoading();
    try {
      const novaLista = especEditId
        ? especificacoes.map(e => e.id === especEditId ? nova : e)
        : [...especificacoes, nova];
      await db.collection('obras').doc(obraId).collection('config').doc('sgEspecificacoes').set({ especificacoes: novaLista });
      Utils.toast('✓ Especificação salva!', 'sucesso');
      especEditId = null;
      await carregar();
      renderEspecificacoes();
    } catch (e) {
      Utils.toast('Erro ao salvar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  async function excluirEspecificacao(id) {
    const emUso = chumbadores.filter(c => c.especId === id).length;
    const ok = await Utils.confirmar(`Excluir esta especificação?${emUso ? ` ${emUso} chumbador(es) usam ela — ficarão sem especificação.` : ''}`);
    if (!ok) return;
    Utils.mostrarLoading();
    try {
      const novaLista = especificacoes.filter(e => e.id !== id);
      await db.collection('obras').doc(obraId).collection('config').doc('sgEspecificacoes').set({ especificacoes: novaLista });
      Utils.toast('Especificação excluída.', 'sucesso');
      await carregar();
      renderEspecificacoes();
    } catch (e) {
      Utils.toast('Erro: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  return {
    init, recarregar, renderizar, onTrocarVistaAtiva,
    abrirVistas, salvarVista, excluirVista,
    abrirConfigGrid, salvarConfigGrid,
    abrirImagemFundo, onImagemArquivo, removerImagemFundo,
    toggleCalibrar, onClickSvg, salvarCalibracao, abrirEditarM2, salvarM2,
    onClickBolinha, abrirEditarChumbador, salvarChumbador,
    abrirEspecificacoes, criarMaterialInline, editarEspecificacao, cancelarEdicaoEspec, salvarEspecificacao, excluirEspecificacao,
  };
})();

const SG_UI = LevantamentoSoloGrampeado;

function onObraChanged() {
  LevantamentoSoloGrampeado.recarregar();
}

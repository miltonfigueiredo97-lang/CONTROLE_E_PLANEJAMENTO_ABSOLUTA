// ============================================
// Módulo: Levantamento de Solo Grampeado
// Cada vista = uma imagem de fundo (PDF de elevação renderizado,
// ou foto/planta) sobre a qual os chumbadores são posicionados
// livremente (clique = ponto), pois as vistas reais são
// irregulares (espaçamento variável, terreno inclinado — não dá
// pra usar um grid regular). Escala calibrada por 2 cliques +
// comprimento real (cm). Especificações de Materiais vinculadas
// à Biblioteca de Materiais.
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
  let especificacoes = [];

  let vistaAtivaId = null;
  let imagemCacheVistaId = null, imagemCacheBase64 = null;
  let zoom = 1;
  let modo = null; // null | 'adicionar' | 'calibrar'
  let calibPontos = [];
  let novoPontoTemp = null; // {x,y} aguardando confirmação no modal
  let chumbEditId = null;
  let especEditId = null;
  let pdfjsCarregado = false;

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
  function chumbadoresDaVista(vistaId) { return chumbadores.filter(c => c.vista === vistaId); }
  function especLabel(e) { return e ? e.nome : '—'; }

  // Próximo número sugerido: maior número (numérico) já usado em
  // QUALQUER vista + 1 — a numeração no desenho real é sequencial
  // entre vistas (ex.: termina 211 na Elevação 1, começa 215 na 2).
  function _sugerirProximoNumero() {
    const nums = chumbadores.map(c => parseInt(c.numero)).filter(n => !isNaN(n));
    return nums.length ? Math.max(...nums) + 1 : 1;
  }

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
          <span class="subtitulo">Posicione os chumbadores sobre a elevação (PDF/imagem) de cada vista</span>
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
        <div class="cc-panelTitle">🗺️ Vista</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;align-items:center;">
          <select class="form-control" id="sg-vista-ativa" style="max-width:240px;" onchange="SG_UI.onTrocarVistaAtiva()">
            ${!vistas.length ? '<option value="">— nenhuma vista cadastrada —</option>' : ''}
            ${vistasOrdenadas().map(vv => `<option value="${vv.id}" ${vv.id === vistaAtivaId ? 'selected' : ''}>${esc(vistaLabel(vv))}</option>`).join('')}
          </select>
          ${v ? `
          <button class="btn btn-secundario btn-sm" onclick="SG_UI.abrirImagem('${v.id}')">🖼 PDF/Imagem da Vista</button>
          <button class="btn ${modo === 'adicionar' ? 'btn-primario' : 'btn-secundario'} btn-sm" onclick="SG_UI.toggleModo('adicionar')">⛏️ ${modo === 'adicionar' ? 'Clique no mapa...' : 'Adicionar Chumbador'}</button>
          <button class="btn ${modo === 'calibrar' ? 'btn-primario' : 'btn-secundario'} btn-sm" onclick="SG_UI.toggleModo('calibrar')">📏 ${modo === 'calibrar' ? 'Clique 2 pontos...' : 'Calibrar Escala'}</button>
          <span style="display:flex;gap:2px;align-items:center;margin-left:auto;">
            <button class="btn btn-secundario btn-sm" onclick="SG_UI.zoomAjustar(-0.25)">−</button>
            <span class="text-sm text-muted" style="width:48px;text-align:center;">${Math.round(zoom * 100)}%</span>
            <button class="btn btn-secundario btn-sm" onclick="SG_UI.zoomAjustar(0.25)">+</button>
          </span>
          ` : ''}
        </div>
        <div id="sg-mapa-host"></div>
      </div>

      <div class="cc-panel">
        <div class="cc-panelTitle">⛏️ Chumbadores da Vista</div>
        <div id="sg-tabela-chumbadores"></div>
      </div>
      </div>
    `;
    renderMapa();
    renderTabelaChumbadores();
  }

  function onTrocarVistaAtiva() {
    vistaAtivaId = document.getElementById('sg-vista-ativa').value || null;
    modo = null; calibPontos = []; zoom = 1;
    renderizar();
  }
  function toggleModo(m) {
    modo = (modo === m) ? null : m;
    calibPontos = [];
    renderizar();
  }
  function zoomAjustar(delta) {
    zoom = Math.min(4, Math.max(0.25, +(zoom + delta).toFixed(2)));
    renderMapa();
    const el = document.querySelector('#sg-mapa-host + *');
  }

  // ══════════════════════════════════════════
  // MAPA (imagem + pontos) — construção via SG.mapaHTML e
  // interatividade ligada manualmente após inserir no DOM.
  // ══════════════════════════════════════════
  async function renderMapa() {
    const host = document.getElementById('sg-mapa-host');
    if (!host) return;
    const v = vistaAtiva();
    if (!v) { host.innerHTML = `<div class="cc-empty">⛏️<br>Cadastre uma vista para começar.</div>`; return; }
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
      host.innerHTML = `<div class="cc-empty">🖼 Carregue o PDF ou imagem desta vista em <b>"PDF/Imagem da Vista"</b> para começar a posicionar os chumbadores.</div>`;
      return;
    }
    const lista = chumbadoresDaVista(v.id);
    const html = SG.mapaHTML(v, imagem, lista, {}, [], { interativo: true, readonlyCor: true, zoom, stageId: 'sg-stage', maxHeight: 600 });
    const info = SG.num(v.escalaCmPorPx) > 0
      ? `Escala: 1px da imagem ≈ ${SG.fmt2(v.escalaCmPorPx)} cm`
      : 'Sem escala calibrada ainda';
    host.innerHTML = `
      ${html}
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-top:8px;font-size:0.78rem;color:var(--cor-texto-secundario);font-family:var(--font-mono);">
        <span>${esc(info)}</span>
        <span>m² total da vista: <b style="color:var(--cor-texto);">${SG.fmt1(v.m2Total)}</b> <button class="btn btn-secundario btn-sm" style="padding:2px 8px;" onclick="SG_UI.abrirEditarM2('${v.id}')">✎</button></span>
      </div>
      ${modo === 'adicionar' ? `<div class="cc-empty" style="margin-top:8px;">Clique no mapa onde fica o chumbador.</div>` : ''}
      ${modo === 'calibrar' ? `<div class="cc-empty" style="margin-top:8px;">Clique dois pontos marcando uma distância conhecida (${calibPontos.length}/2).</div>` : ''}
    `;
    _ligarEventosMapa(v);
  }

  function _ligarEventosMapa(v) {
    const stage = document.getElementById('sg-stage');
    if (!stage) return;
    stage.addEventListener('click', ev => {
      const marcador = ev.target.closest('.sg-marcador');
      if (marcador) {
        if (modo) return; // em modo adicionar/calibrar, clique é sobre o mapa, não editar
        abrirEditarChumbador(marcador.dataset.id);
        return;
      }
      const pos = SG.posRelativa(ev, stage);
      if (modo === 'adicionar') {
        novoPontoTemp = pos;
        abrirNovoChumbador();
      } else if (modo === 'calibrar') {
        calibPontos.push(pos);
        if (calibPontos.length === 2) {
          const distPx = SG.distanciaPxEntrePontos(calibPontos[0], calibPontos[1], v);
          calibPontos = []; modo = null;
          abrirConfirmarCalibracao(distPx);
        } else {
          renderMapa();
        }
      }
    });
  }

  // ── Tabela de chumbadores ──
  function renderTabelaChumbadores() {
    const el = document.getElementById('sg-tabela-chumbadores');
    if (!el) return;
    const v = vistaAtiva();
    if (!v) { el.innerHTML = `<div class="cc-empty">Nenhuma vista selecionada.</div>`; return; }
    const lista = chumbadoresDaVista(v.id).sort((a, b) => (parseInt(a.numero) || 0) - (parseInt(b.numero) || 0));
    if (!lista.length) {
      el.innerHTML = `<div class="cc-empty">⛏️<br>Nenhum chumbador ainda. Use "Adicionar Chumbador" e clique no mapa.</div>`;
      return;
    }
    const mlTotal = lista.reduce((s, c) => s + SG.num(c.comprimento), 0);
    el.innerHTML = `
      <div class="cc-tableWrap" style="max-height:360px;overflow-y:auto;">
      <table class="cc-table">
        <thead><tr><th>Nº</th><th>Tipo</th><th class="col-num">Comp. (ml)</th><th class="col-num">Prof. (cm)</th><th>Especificação</th><th class="col-acoes"></th></tr></thead>
        <tbody>
          ${lista.map(c => {
            const e = especificacoes.find(x => x.id === c.especId);
            return `<tr>
              <td style="font-weight:600;">${esc(c.numero)}</td>
              <td>${esc(c.tipo)}</td>
              <td class="col-num cc-tdMono">${SG.fmt1(c.comprimento)}</td>
              <td class="col-num cc-tdMono">${c.profundidade ? SG.fmt1(c.profundidade) : '—'}</td>
              <td>${esc(especLabel(e))}</td>
              <td class="col-acoes">
                <button class="btn btn-secundario btn-sm" onclick="SG_UI.abrirEditarChumbador('${c.id}')">✎</button>
                <button class="btn btn-secundario btn-sm" style="color:var(--cv-red);" onclick="SG_UI.excluirChumbador('${c.id}')">🗑</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot><tr><td style="font-weight:700;">${lista.length} chumb.</td><td></td><td class="col-num cc-tdMono" style="font-weight:700;">${SG.fmt1(mlTotal)}</td><td colspan="3"></td></tr></tfoot>
      </table>
      </div>`;
  }

  // ══════════════════════════════════════════
  // NOVO / EDITAR CHUMBADOR
  // ══════════════════════════════════════════
  function abrirNovoChumbador() {
    chumbEditId = null;
    document.getElementById('sg-modal-chumb-titulo').textContent = '⛏️ Novo Chumbador';
    const f = document.getElementById('form-sg-chumbador');
    f.querySelector('[name=numero]').value = _sugerirProximoNumero();
    f.querySelector('[name=tipo]').innerHTML = SG.TIPOS_CHUMBADOR.map(t => `<option value="${t}">${t}</option>`).join('');
    f.querySelector('[name=especId]').innerHTML = `<option value="">— sem especificação —</option>` +
      especificacoes.map(e => `<option value="${e.id}">${esc(e.nome)}</option>`).join('');
    f.querySelector('[name=comprimento]').value = '';
    f.querySelector('[name=profundidade]').value = '';
    Utils.abrirModal('modal-sg-chumbador');
  }

  function abrirEditarChumbador(id) {
    const c = chumbadores.find(x => x.id === id);
    if (!c) return;
    chumbEditId = id;
    novoPontoTemp = null;
    document.getElementById('sg-modal-chumb-titulo').textContent = `✎ Chumbador ${c.numero}`;
    const f = document.getElementById('form-sg-chumbador');
    f.querySelector('[name=numero]').value = c.numero ?? '';
    f.querySelector('[name=tipo]').innerHTML = SG.TIPOS_CHUMBADOR.map(t => `<option value="${t}" ${t === c.tipo ? 'selected' : ''}>${t}</option>`).join('');
    f.querySelector('[name=especId]').innerHTML = `<option value="">— sem especificação —</option>` +
      especificacoes.map(e => `<option value="${e.id}" ${e.id === c.especId ? 'selected' : ''}>${esc(e.nome)}</option>`).join('');
    f.querySelector('[name=comprimento]').value = c.comprimento ?? '';
    f.querySelector('[name=profundidade]').value = c.profundidade ?? '';
    Utils.abrirModal('modal-sg-chumbador');
  }

  async function salvarChumbador() {
    const v = vistaAtiva();
    const f = document.getElementById('form-sg-chumbador');
    const numero = f.querySelector('[name=numero]').value.trim();
    const tipo = f.querySelector('[name=tipo]').value;
    const comprimento = SG.num(f.querySelector('[name=comprimento]').value);
    const profundidade = SG.num(f.querySelector('[name=profundidade]').value);
    const especId = f.querySelector('[name=especId]').value;
    if (!numero) { Utils.toast('Informe o número do chumbador.', 'alerta'); return; }
    if (!(comprimento > 0)) { Utils.toast('Informe o comprimento (maior que zero).', 'alerta'); return; }
    Utils.mostrarLoading();
    try {
      if (chumbEditId) {
        await Database.atualizar(obraId, COL_CHUMBADORES, chumbEditId, { numero, tipo, comprimento, profundidade, especId });
        Utils.toast('✓ Chumbador atualizado!', 'sucesso');
      } else {
        if (!novoPontoTemp || !v) { Utils.toast('Erro: posição do chumbador perdida. Clique no mapa novamente.', 'erro'); return; }
        await Database.criar(obraId, COL_CHUMBADORES, {
          vista: v.id, numero, tipo, comprimento, profundidade, especId,
          x: novoPontoTemp.x, y: novoPontoTemp.y, obraId,
        }, SG.genId('ch'));
        Utils.toast('✓ Chumbador adicionado!', 'sucesso');
      }
      novoPontoTemp = null; modo = null;
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
    const ok = await Utils.confirmar(`Excluir o chumbador ${c.numero}? Isso também remove o histórico de execução dele em Controle.`);
    if (!ok) return;
    Utils.mostrarLoading();
    try {
      const ops = [{ type: 'delete', ref: Database.ref(obraId, COL_CHUMBADORES).doc(id) }];
      const execSnap = await db.collection('obras').doc(obraId).collection('sgExecucoes').where('chumbadorId', '==', id).get();
      execSnap.forEach(doc => ops.push({ type: 'delete', ref: doc.ref }));
      await Database.batchWrite(ops);
      Utils.toast('Chumbador excluído.', 'sucesso');
      await carregar();
    } catch (e) {
      Utils.toast('Erro ao excluir: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ══════════════════════════════════════════
  // CALIBRAÇÃO DE ESCALA e m² TOTAL
  // ══════════════════════════════════════════
  function abrirConfirmarCalibracao(distPx) {
    document.getElementById('sg-calib-cm').value = '';
    document.getElementById('form-sg-calib').dataset.distpx = distPx;
    Utils.abrirModal('modal-sg-calibracao');
  }

  async function salvarCalibracao() {
    const v = vistaAtiva();
    if (!v) return;
    const distPx = SG.num(document.getElementById('form-sg-calib').dataset.distpx);
    const cm = SG.num(document.getElementById('sg-calib-cm').value);
    if (!(distPx > 0) || !(cm > 0)) { Utils.toast('Informe o comprimento real (cm) da linha.', 'alerta'); return; }
    const escala = SG.calcEscalaCmPorPx(distPx, cm);
    const m2Sugerido = SG.calcM2Imagem(v.imgWidthPx, v.imgHeightPx, escala);
    Utils.mostrarLoading();
    try {
      await Database.atualizar(obraId, COL_VISTAS, v.id, { escalaCmPorPx: escala, m2Total: m2Sugerido });
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

  // ══════════════════════════════════════════
  // IMAGEM/PDF DA VISTA
  // ══════════════════════════════════════════
  function abrirImagem(vistaId) {
    document.getElementById('sg-img-vistaid').value = vistaId;
    document.getElementById('sg-img-status').textContent = '';
    Utils.abrirModal('modal-sg-imagem');
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

  async function onImagemArquivo(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const vistaId = document.getElementById('sg-img-vistaid').value;
    const statusEl = document.getElementById('sg-img-status');
    statusEl.textContent = 'Processando...';
    try {
      let canvas;
      if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
        await _carregarPdfjs();
        const buf = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        const page = await pdf.getPage(1);
        const viewportBase = page.getViewport({ scale: 1 });
        const alvo = 2200; // px no maior lado, boa qualidade pra zoom sem exagerar no tamanho
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
      const { url, width, height, ok } = SG.canvasParaDataURLLimitado(canvas);
      if (!ok) { statusEl.textContent = 'Arquivo grande demais mesmo após compressão. Tente uma exportação menor.'; return; }
      Utils.mostrarLoading();
      await db.collection('obras').doc(obraId).collection('config').doc('sgImagem_' + vistaId).set({ img: url });
      await Database.atualizar(obraId, COL_VISTAS, vistaId, { imgWidthPx: width, imgHeightPx: height });
      imagemCacheVistaId = null;
      statusEl.textContent = '✓ Imagem carregada!';
      Utils.toast('✓ Imagem da vista salva!', 'sucesso');
      Utils.fecharModal('modal-sg-imagem');
      await carregar();
    } catch (e) {
      console.error(e);
      statusEl.textContent = 'Erro: ' + e.message;
      Utils.toast('Erro ao processar arquivo: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
      input.value = '';
    }
  }

  async function removerImagem() {
    const vistaId = document.getElementById('sg-img-vistaid').value;
    Utils.mostrarLoading();
    try {
      await db.collection('obras').doc(obraId).collection('config').doc('sgImagem_' + vistaId).delete();
      imagemCacheVistaId = null;
      Utils.toast('Imagem removida.', 'sucesso');
      Utils.fecharModal('modal-sg-imagem');
      renderMapa();
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
        <input type="text" class="form-control" id="sg-nova-vista-nome" placeholder="Nome da vista (ex: Elevação 1)">
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
      await Database.criar(obraId, COL_VISTAS, { numero: proxNumero, nome, m2Total: 0, obraId }, SG.genId('v'));
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
      if (select) select.innerHTML += `<option value="${id}" selected>${esc(nome)}</option>`;
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
    init, recarregar, renderizar, onTrocarVistaAtiva, toggleModo, zoomAjustar,
    abrirVistas, salvarVista, excluirVista,
    abrirImagem, onImagemArquivo, removerImagem,
    salvarCalibracao, abrirEditarM2, salvarM2,
    abrirNovoChumbador, abrirEditarChumbador, salvarChumbador, excluirChumbador,
    abrirEspecificacoes, criarMaterialInline, editarEspecificacao, cancelarEdicaoEspec, salvarEspecificacao, excluirEspecificacao,
  };
})();

const SG_UI = LevantamentoSoloGrampeado;

function onObraChanged() {
  LevantamentoSoloGrampeado.recarregar();
}

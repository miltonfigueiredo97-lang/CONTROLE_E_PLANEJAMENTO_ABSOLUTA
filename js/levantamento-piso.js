// ============================================
// Módulo: Levantamento de Piso
//
// Fluxo:
//  1) Upload de PDF do projeto (armazenado no Firebase Storage) -> "Planta"
//  2) Cada página do PDF pode virar um "Pavimento" (pavimento/ambiente)
//  3) Dentro do pavimento: desenha-se uma LINHA DE CALIBRAÇÃO sobre uma
//     medida conhecida do desenho -> define a escala (metros por ponto-PDF)
//  4) Com a escala definida, desenham-se POLÍGONOS sobre as áreas de piso
//     -> cada polígono vira uma "Área" com m², tipo de piso, contrapiso
//     e impermeabilização (opcional)
//
// Coordenadas dos pontos (linha de calibração e polígonos) são sempre
// guardadas em espaço "ponto-PDF" (viewport scale=1), independente do
// zoom de renderização em tela — assim a escala nunca se perde.
//
// Dados: obras/{obraId}/pisoPlantas, obras/{obraId}/pisoPavimentos,
//        obras/{obraId}/pisoAreas
// ============================================

const LP = (() => {
  const COL_PLANTAS = 'pisoPlantas';
  const COL_PAV = 'pisoPavimentos';
  const COL_AREAS = 'pisoAreas';

  let obraId = null;
  let plantas = [];
  let pavimentos = [];
  let areas = [];

  let view = 'plantas'; // 'plantas' | 'pavimentos' | 'pavimento'
  let selPlantaId = null;
  let selPavimentoId = null;

  let pdfDoc = null;        // documento pdf.js carregado (da planta atualmente aberta)
  let pdfDocPlantaId = null;
  let renderScale = 1;      // px de tela por ponto-PDF, na renderização atual

  let modo = 'nenhum';      // 'nenhum' | 'calibrar' | 'medir'
  let calibPontos = [];     // pontos-PDF da linha de calibração em progresso
  let poligonoPontos = [];  // vértices-PDF do polígono em progresso

  let areaEditId = null;         // id da área em edição (null = nova)
  let areaPoligonoPendente = null; // polígono (pontos-PDF) aguardando salvar no modal
  let areaM2Pendente = 0;

  // ══════════════════════════════════════════
  // INIT / CARREGAMENTO
  // ══════════════════════════════════════════
  async function init() {
    const ok = await Utils.initPagina({ requireObra: true });
    if (!ok) return;
    obraId = Router.getObraId();
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { cancelarDesenho(); Utils.fecharTodosModais(); }
    });
    if (!obraId) { _renderSemObra(); return; }
    await carregar();
  }

  async function recarregar() {
    obraId = Router.getObraId();
    view = 'plantas'; selPlantaId = null; selPavimentoId = null;
    if (!obraId) { _renderSemObra(); return; }
    await carregar();
  }

  function _renderSemObra() {
    const el = document.getElementById('lp-content');
    if (el) el.innerHTML = `<div class="estado-vazio"><div class="icone">🧱</div><p>Selecione uma obra na barra lateral.</p></div>`;
  }

  async function carregar() {
    Utils.mostrarLoading('Carregando levantamento de piso...');
    try {
      const [lp, pv, ar] = await Promise.all([
        Database.listar(obraId, COL_PLANTAS, 'createdAt', 'desc').catch(() => []),
        Database.listar(obraId, COL_PAV, null).catch(() => []),
        Database.listar(obraId, COL_AREAS, null).catch(() => []),
      ]);
      plantas = lp; pavimentos = pv; areas = ar;
      renderizar();
    } catch (e) {
      console.error('Erro ao carregar levantamento de piso:', e);
      Utils.toast('Erro ao carregar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ══════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════
  function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function _uid() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function fmt2(n) { return (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function num(v) { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? 0 : n; }

  function _ls(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }

  async function _garantirPdfjs() {
    if (typeof pdfjsLib !== 'undefined') return;
    await _ls('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  // Por padrão o pdf.js busca a URL diretamente e usa cabeçalho Range (streaming),
  // o que dispara um preflight OPTIONS que o Firebase Storage não libera via CORS
  // (bucket sem CORS configurado, e Storage não libera fetch/XHR cross-origin
  // mesmo em GET simples). Solução: buscar via proxy serverless próprio
  // (/api/pdf-proxy), que roda no servidor (sem restrição de CORS) e devolve
  // os bytes para o navegador a partir do mesmo domínio.
  async function _carregarPdfDoc(downloadURL) {
    const proxyUrl = '/api/pdf-proxy?url=' + encodeURIComponent(downloadURL);
    let resp;
    try {
      resp = await fetch(proxyUrl);
    } catch (e) {
      throw new Error('Não foi possível baixar o PDF (rede). Detalhe: ' + e.message);
    }
    if (!resp.ok) {
      let msg = 'HTTP ' + resp.status;
      try { const j = await resp.json(); if (j.error) msg = j.error; } catch (e2) {}
      throw new Error('Falha ao baixar o PDF: ' + msg);
    }
    const buf = await resp.arrayBuffer();
    return await pdfjsLib.getDocument({ data: buf }).promise;
  }

  function _areaPoligono(pts) {
    // Fórmula do Shoelace — retorna área em unidades de ponto-PDF²
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
      const p1 = pts[i], p2 = pts[(i + 1) % pts.length];
      a += p1.x * p2.y - p2.x * p1.y;
    }
    return Math.abs(a) / 2;
  }

  function _pavAtual() { return pavimentos.find(p => p.id === selPavimentoId) || null; }
  function _plantaAtual(id) { return plantas.find(p => p.id === (id || selPlantaId)) || null; }
  function _areasDoPavimento(pavId) { return areas.filter(a => a.pavimentoId === pavId); }

  // ══════════════════════════════════════════
  // RENDER — DISPATCH
  // ══════════════════════════════════════════
  function renderizar() {
    const actions = document.getElementById('lp-header-actions');
    const el = document.getElementById('lp-content');
    if (!el) return;
    if (view === 'plantas') { if (actions) actions.innerHTML = ''; _renderPlantas(el); }
    else if (view === 'pavimentos') { if (actions) actions.innerHTML = ''; _renderPavimentos(el); }
    else if (view === 'pavimento') { _renderPavimento(el, actions); }
  }

  // ══════════════════════════════════════════
  // VIEW 1: LISTA DE PLANTAS
  // ══════════════════════════════════════════
  function _renderPlantas(el) {
    el.innerHTML = `
      <div class="page-header">
        <div>
          <h2>Plantas (PDF)</h2>
          <span class="subtitulo">Envie a planta em PDF para calibrar a escala e medir os pisos direto no desenho</span>
        </div>
        <button class="btn btn-primario" onclick="LP.abrirModalPlanta()">+ Nova Planta</button>
      </div>
      ${plantas.length === 0 ? `
        <div class="estado-vazio"><div class="icone">📄</div><p>Nenhuma planta enviada ainda.</p></div>
      ` : `
        <div class="cards-grid">
          ${plantas.map(pl => `
            <div class="lp-planta-card" onclick="LP.abrirPlanta('${pl.id}')">
              <div style="display:flex;justify-content:space-between;align-items:start;gap:8px;">
                <div>
                  <div style="font-weight:700;">📄 ${esc(pl.nome || 'Planta')}</div>
                  <div class="text-sm" style="color:var(--cor-texto-muted);margin-top:4px;">${pl.numPaginas || 1} página(s)</div>
                </div>
                <button class="btn btn-secundario btn-sm" onclick="event.stopPropagation();LP.excluirPlanta('${pl.id}')" title="Excluir planta">✕</button>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    `;
  }

  function abrirModalPlanta() {
    document.getElementById('lp-planta-nome').value = '';
    document.getElementById('lp-planta-arquivo').value = '';
    Utils.abrirModal('modal-lp-planta');
  }

  async function enviarPlanta() {
    const nome = document.getElementById('lp-planta-nome').value.trim() || 'Planta sem nome';
    const input = document.getElementById('lp-planta-arquivo');
    const file = input.files && input.files[0];
    if (!file) { Utils.toast('Selecione um arquivo PDF.', 'alerta'); return; }
    if (file.type !== 'application/pdf') { Utils.toast('O arquivo precisa ser um PDF.', 'alerta'); return; }

    const btn = document.getElementById('lp-btn-upload-planta');
    if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }
    Utils.mostrarLoading('Enviando PDF e lendo páginas...');
    try {
      await _garantirPdfjs();
      const plantaId = _uid();
      const path = `obras/${obraId}/piso-plantas/${plantaId}.pdf`;
      const ref = storage.ref(path);
      await ref.put(file, { contentType: 'application/pdf' });
      const downloadURL = await ref.getDownloadURL();

      const doc = await _carregarPdfDoc(downloadURL);
      const numPaginas = doc.numPages;

      await Database.criar(obraId, COL_PLANTAS, { nome, storagePath: path, downloadURL, numPaginas }, plantaId);
      Utils.fecharModal('modal-lp-planta');
      Utils.toast('Planta enviada!', 'sucesso');
      await carregar();
      abrirPlanta(plantaId);
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao enviar planta: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
      if (btn) { btn.disabled = false; btn.textContent = 'Enviar'; }
    }
  }

  async function excluirPlanta(id) {
    const pl = plantas.find(p => p.id === id); if (!pl) return;
    const pavsLigados = pavimentos.filter(p => p.plantaId === id);
    const msg = pavsLigados.length
      ? `Excluir "${pl.nome}"? Isso também excluirá ${pavsLigados.length} pavimento(s) e todas as áreas medidas neles.`
      : `Excluir a planta "${pl.nome}"?`;
    if (!Utils.confirmar(msg)) return;
    Utils.mostrarLoading('Excluindo...');
    try {
      const ops = [{ type: 'delete', ref: Database.ref(obraId, COL_PLANTAS).doc(id) }];
      pavsLigados.forEach(pv => {
        ops.push({ type: 'delete', ref: Database.ref(obraId, COL_PAV).doc(pv.id) });
        _areasDoPavimento(pv.id).forEach(a => ops.push({ type: 'delete', ref: Database.ref(obraId, COL_AREAS).doc(a.id) }));
      });
      await Database.batchWrite(ops);
      try { await storage.ref(pl.storagePath).delete(); } catch (e2) {}
      Utils.toast('Planta excluída.', 'sucesso');
      await carregar();
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao excluir: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  function abrirPlanta(id) {
    selPlantaId = id;
    view = 'pavimentos';
    renderizar();
  }

  // ══════════════════════════════════════════
  // VIEW 2: PÁGINAS DA PLANTA -> PAVIMENTOS
  // ══════════════════════════════════════════
  function _renderPavimentos(el) {
    const pl = _plantaAtual();
    if (!pl) { view = 'plantas'; renderizar(); return; }
    const pavsDestaPlanta = pavimentos.filter(p => p.plantaId === pl.id);
    const paginas = [];
    for (let i = 1; i <= (pl.numPaginas || 1); i++) paginas.push(i);

    el.innerHTML = `
      <div class="lp-breadcrumb-mini"><a onclick="LP.voltarPlantas()">Plantas</a> › ${esc(pl.nome)}</div>
      <div class="page-header">
        <div><h2>${esc(pl.nome)}</h2><span class="subtitulo">Escolha a página para medir como pavimento</span></div>
      </div>
      <div class="cards-grid">
        ${paginas.map(pagina => {
          const pav = pavsDestaPlanta.find(p => p.pagina === pagina);
          if (pav) {
            const qtdAreas = _areasDoPavimento(pav.id).length;
            const totalM2 = _areasDoPavimento(pav.id).reduce((s, a) => s + (a.areaM2 || 0), 0);
            return `
              <div class="lp-pav-card" onclick="LP.abrirPavimento('${pav.id}')">
                <div style="display:flex;justify-content:space-between;align-items:start;gap:8px;">
                  <div>
                    <div style="font-weight:700;"><span class="lp-pag-badge">${pagina}</span>${esc(pav.nome)}</div>
                    <div class="text-sm" style="color:var(--cor-texto-muted);margin-top:6px;">
                      ${qtdAreas} área(s) · ${fmt2(totalM2)} m² ${pav.escalaMetrosPorPonto ? '' : '· <span style="color:#b45309;">escala não calibrada</span>'}
                    </div>
                  </div>
                  <button class="btn btn-secundario btn-sm" onclick="event.stopPropagation();LP.excluirPavimento('${pav.id}')" title="Excluir pavimento">✕</button>
                </div>
              </div>
            `;
          }
          return `
            <div class="lp-pav-card" style="border-style:dashed;opacity:0.85;" onclick="LP.criarPavimento(${pagina})">
              <div style="font-weight:700;"><span class="lp-pag-badge">${pagina}</span>Usar esta página</div>
              <div class="text-sm" style="color:var(--cor-texto-muted);margin-top:6px;">Página ${pagina} ainda não usada como pavimento</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function voltarPlantas() { view = 'plantas'; selPlantaId = null; renderizar(); }

  async function criarPavimento(pagina) {
    const pl = _plantaAtual(); if (!pl) return;
    const nome = window.prompt('Nome deste pavimento:', `Página ${pagina}`);
    if (nome === null) return;
    Utils.mostrarLoading('Criando pavimento...');
    try {
      const id = await Database.criar(obraId, COL_PAV, {
        plantaId: pl.id, pagina, nome: nome.trim() || `Página ${pagina}`,
        escalaMetrosPorPonto: null, linhaCalibracao: null,
      });
      await carregar();
      abrirPavimento(id);
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao criar pavimento: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  async function excluirPavimento(id) {
    const pv = pavimentos.find(p => p.id === id); if (!pv) return;
    const qtdAreas = _areasDoPavimento(id).length;
    const msg = qtdAreas ? `Excluir "${pv.nome}" e ${qtdAreas} área(s) medida(s) nele?` : `Excluir o pavimento "${pv.nome}"?`;
    if (!Utils.confirmar(msg)) return;
    Utils.mostrarLoading('Excluindo...');
    try {
      const ops = [{ type: 'delete', ref: Database.ref(obraId, COL_PAV).doc(id) }];
      _areasDoPavimento(id).forEach(a => ops.push({ type: 'delete', ref: Database.ref(obraId, COL_AREAS).doc(a.id) }));
      await Database.batchWrite(ops);
      Utils.toast('Pavimento excluído.', 'sucesso');
      await carregar();
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao excluir: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ══════════════════════════════════════════
  // VIEW 3: WORKSPACE DO PAVIMENTO (canvas + medição)
  // ══════════════════════════════════════════
  function _renderPavimento(el, actions) {
    const pav = _pavAtual();
    if (!pav) { view = 'pavimentos'; renderizar(); return; }
    const pl = _plantaAtual(pav.plantaId);
    const temEscala = !!pav.escalaMetrosPorPonto;
    const areasP = _areasDoPavimento(pav.id).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    const totalGeral = areasP.reduce((s, a) => s + (a.areaM2 || 0), 0);

    if (actions) actions.innerHTML = `<button class="btn btn-secundario btn-sm" onclick="LP.voltarPavimentos()">← Voltar</button>`;

    el.innerHTML = `
      <div class="lp-breadcrumb-mini"><a onclick="LP.voltarPlantas()">Plantas</a> › <a onclick="LP.voltarPavimentos()">${esc(pl ? pl.nome : '')}</a> › ${esc(pav.nome)}</div>
      <div class="lp-toolbar">
        <button class="btn btn-secundario btn-sm ${modo === 'calibrar' ? 'lp-modo-ativo' : ''}" onclick="LP.toggleModoCalibrar()">📏 Calibrar Escala</button>
        <button class="btn btn-secundario btn-sm ${modo === 'medir' ? 'lp-modo-ativo' : ''}" onclick="LP.toggleModoMedir()" ${temEscala ? '' : 'disabled title="Calibre a escala primeiro"'}>⬟ Nova Área</button>
        ${modo === 'medir' ? `
          <button class="btn btn-primario btn-sm" onclick="LP.finalizarPoligono()">✓ Finalizar Área (${poligonoPontos.length} pontos)</button>
          <button class="btn btn-secundario btn-sm" onclick="LP.cancelarDesenho()">Cancelar</button>
        ` : ''}
        ${modo === 'calibrar' ? `<button class="btn btn-secundario btn-sm" onclick="LP.cancelarDesenho()">Cancelar</button>` : ''}
        <div class="sep"></div>
        <span class="info">${temEscala ? `Escala: 1 ponto-PDF = ${(pav.escalaMetrosPorPonto * 1000).toFixed(3)} mm` : 'Escala não calibrada'}</span>
      </div>
      ${!temEscala ? `<div class="lp-hint">Antes de medir, clique em "📏 Calibrar Escala", desenhe uma linha sobre uma medida conhecida do desenho (ex: uma cota) e informe a distância real.</div>` : ''}
      ${modo === 'medir' ? `<div class="lp-hint">Clique para adicionar vértices do polígono da área. Quando terminar, clique em "Finalizar Área".</div>` : ''}
      ${modo === 'calibrar' ? `<div class="lp-hint">Clique em dois pontos sobre uma medida conhecida do desenho (ex: início e fim de uma cota).</div>` : ''}
      <div class="lp-workspace">
        <div class="lp-canvas-col" id="lp-canvas-col"><div class="loading-inline">Carregando página do PDF...</div></div>
        <div class="lp-painel-lateral">
          <div class="lp-totais">
            <table>
              <tr><td>Total de áreas</td><td>${areasP.length}</td></tr>
              <tr><td>Área total</td><td>${fmt2(totalGeral)} m²</td></tr>
            </table>
          </div>
          ${areasP.length === 0 ? `<div class="estado-vazio" style="padding:20px;"><p style="font-size:0.85rem;">Nenhuma área medida ainda.</p></div>` : areasP.map(a => `
            <div class="lp-area-card" onclick="LP.editarArea('${a.id}')">
              <div class="nome"><span>${esc(a.nome)}</span><span class="m2">${fmt2(a.areaM2)} m²</span></div>
              <div class="meta">
                ${a.tipoPiso ? `Piso: ${esc(a.tipoPiso)}` : 'Piso: —'}${a.tipoContrapiso ? ` · Contrapiso: ${esc(a.tipoContrapiso)}` : ''}
                ${a.impermeabilizacao ? ` · 💧 Impermeabilizado${a.tipoImpermeabilizacao ? ' (' + esc(a.tipoImpermeabilizacao) + ')' : ''}` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    _popularDatalists();
    _renderCanvasPavimento(pav);
  }

  function _popularDatalists() {
    const camposMap = { tipoPiso: 'lp-lista-pisos', tipoContrapiso: 'lp-lista-contrapisos', tipoImpermeabilizacao: 'lp-lista-imperm' };
    Object.entries(camposMap).forEach(([campo, dlId]) => {
      const dl = document.getElementById(dlId); if (!dl) return;
      const vistos = new Set(); let h = '';
      areas.forEach(a => {
        const v = (a[campo] || '').trim();
        if (v && !vistos.has(v.toLowerCase())) { vistos.add(v.toLowerCase()); h += `<option value="${esc(v)}">`; }
      });
      dl.innerHTML = h;
    });
  }

  function voltarPavimentos() {
    view = 'pavimentos'; selPavimentoId = null; modo = 'nenhum'; calibPontos = []; poligonoPontos = [];
    renderizar();
  }

  async function abrirPavimento(id) {
    selPavimentoId = id; view = 'pavimento'; modo = 'nenhum'; calibPontos = []; poligonoPontos = [];
    renderizar();
  }

  async function _renderCanvasPavimento(pav) {
    const col = document.getElementById('lp-canvas-col');
    if (!col) return;
    try {
      await _garantirPdfjs();
      const pl = _plantaAtual(pav.plantaId);
      if (!pl) return;
      if (pdfDocPlantaId !== pl.id) {
        pdfDoc = await _carregarPdfDoc(pl.downloadURL);
        pdfDocPlantaId = pl.id;
      }
      const page = await pdfDoc.getPage(pav.pagina);
      const viewportBase = page.getViewport({ scale: 1 });
      const larguraDisponivel = Math.max(320, (col.clientWidth || 900) - 24);
      renderScale = Math.min(2.2, larguraDisponivel / viewportBase.width);
      const viewport = page.getViewport({ scale: renderScale });

      const canvas = document.createElement('canvas');
      canvas.className = 'lp-base';
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;

      const stage = document.createElement('div');
      stage.className = 'lp-canvas-stage modo-' + modo;
      stage.style.width = viewport.width + 'px';
      stage.style.height = viewport.height + 'px';
      stage.appendChild(canvas);

      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('class', 'lp-svg-overlay');
      svg.setAttribute('width', viewport.width);
      svg.setAttribute('height', viewport.height);
      stage.appendChild(svg);

      col.innerHTML = '';
      col.appendChild(stage);

      stage.addEventListener('click', _onStageClick);
      stage.addEventListener('dblclick', _onStageDblClick);

      _desenharOverlay(pav);
    } catch (e) {
      console.error('Erro ao renderizar PDF:', e);
      col.innerHTML = `<div class="estado-vazio"><p>Erro ao carregar a página do PDF: ${esc(e.message)}</p></div>`;
    }
  }

  function _clickToPdfPoint(e) {
    const stage = e.currentTarget;
    const rect = stage.getBoundingClientRect();
    const x = (e.clientX - rect.left) / renderScale;
    const y = (e.clientY - rect.top) / renderScale;
    return { x, y };
  }

  function _onStageClick(e) {
    if (modo === 'nenhum') return;
    const pt = _clickToPdfPoint(e);
    if (modo === 'calibrar') {
      calibPontos.push(pt);
      if (calibPontos.length === 2) {
        Utils.abrirModal('modal-lp-calibrar');
        document.getElementById('lp-calibrar-distancia').value = '';
        setTimeout(() => document.getElementById('lp-calibrar-distancia').focus(), 50);
      }
      _redesenharTemp();
    } else if (modo === 'medir') {
      poligonoPontos.push(pt);
      _redesenharTemp();
      _atualizarBotaoFinalizar();
    }
  }

  function _onStageDblClick(e) {
    if (modo === 'medir' && poligonoPontos.length >= 3) {
      e.preventDefault();
      finalizarPoligono();
    }
  }

  function _atualizarBotaoFinalizar() {
    const el = document.getElementById('lp-content');
    const btn = el && el.querySelector('.lp-toolbar .btn-primario');
    if (btn) btn.textContent = `✓ Finalizar Área (${poligonoPontos.length} pontos)`;
  }

  function toggleModoCalibrar() {
    modo = modo === 'calibrar' ? 'nenhum' : 'calibrar';
    calibPontos = []; poligonoPontos = [];
    renderizar();
  }

  function toggleModoMedir() {
    const pav = _pavAtual();
    if (!pav || !pav.escalaMetrosPorPonto) { Utils.toast('Calibre a escala antes de medir.', 'alerta'); return; }
    modo = modo === 'medir' ? 'nenhum' : 'medir';
    calibPontos = []; poligonoPontos = [];
    renderizar();
  }

  function cancelarDesenho() {
    if (modo === 'nenhum') return;
    modo = 'nenhum'; calibPontos = []; poligonoPontos = [];
    renderizar();
  }

  function cancelarCalibracao() {
    Utils.fecharModal('modal-lp-calibrar');
    calibPontos = [];
    _redesenharTemp();
  }

  async function confirmarCalibracao() {
    const distStr = document.getElementById('lp-calibrar-distancia').value;
    const distReal = num(distStr);
    if (!distReal || distReal <= 0) { Utils.toast('Informe uma distância real válida em metros.', 'alerta'); return; }
    if (calibPontos.length < 2) { Utils.toast('Desenhe a linha de calibração primeiro.', 'alerta'); return; }
    const [p1, p2] = calibPontos;
    const distPdf = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
    if (distPdf === 0) { Utils.toast('Linha inválida.', 'erro'); return; }
    const escalaMetrosPorPonto = distReal / distPdf;

    const pav = _pavAtual();
    Utils.mostrarLoading('Salvando escala...');
    try {
      await Database.atualizar(obraId, COL_PAV, pav.id, {
        escalaMetrosPorPonto,
        linhaCalibracao: { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, distanciaReal: distReal },
      });
      Utils.fecharModal('modal-lp-calibrar');
      Utils.toast('Escala calibrada!', 'sucesso');
      modo = 'nenhum'; calibPontos = [];
      await carregar();
      abrirPavimento(pav.id);
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao salvar escala: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  function finalizarPoligono() {
    if (poligonoPontos.length < 3) { Utils.toast('Desenhe pelo menos 3 pontos.', 'alerta'); return; }
    const pav = _pavAtual();
    const areaPdf = _areaPoligono(poligonoPontos);
    const areaM2 = areaPdf * (pav.escalaMetrosPorPonto ** 2);
    areaPoligonoPendente = poligonoPontos.slice();
    areaM2Pendente = areaM2;
    areaEditId = null;
    document.getElementById('lp-area-titulo').textContent = 'Nova Área';
    Utils.limparForm('form-lp-area');
    document.getElementById('lp-area-m2-display').value = fmt2(areaM2);
    document.getElementById('lp-campo-imperm-tipo').style.display = 'none';
    document.getElementById('lp-btn-excluir-area').style.display = 'none';
    Utils.abrirModal('modal-lp-area');
  }

  function editarArea(id) {
    const a = areas.find(x => x.id === id); if (!a) return;
    areaEditId = id;
    areaPoligonoPendente = null;
    document.getElementById('lp-area-titulo').textContent = 'Editar Área';
    Utils.setFormData('form-lp-area', a);
    document.getElementById('lp-area-m2-display').value = fmt2(a.areaM2);
    document.getElementById('lp-campo-imperm-tipo').style.display = a.impermeabilizacao ? '' : 'none';
    document.getElementById('lp-btn-excluir-area').style.display = '';
    Utils.abrirModal('modal-lp-area');
  }

  function onToggleImperm(chk) {
    document.getElementById('lp-campo-imperm-tipo').style.display = chk.checked ? '' : 'none';
  }

  function fecharModalArea() {
    Utils.fecharModal('modal-lp-area');
    if (areaEditId === null) {
      // era uma área nova recém desenhada e não salva — descarta o polígono temporário
      poligonoPontos = []; modo = 'nenhum'; areaPoligonoPendente = null;
      renderizar();
    }
  }

  async function salvarArea() {
    const data = Utils.getFormData('form-lp-area');
    if (!data.nome) { Utils.toast('Informe o nome da área.', 'alerta'); return; }
    if (!data.impermeabilizacao) data.tipoImpermeabilizacao = '';

    const pav = _pavAtual();
    Utils.mostrarLoading('Salvando área...');
    try {
      if (areaEditId) {
        await Database.atualizar(obraId, COL_AREAS, areaEditId, data);
      } else {
        data.pavimentoId = pav.id;
        data.poligono = areaPoligonoPendente;
        data.areaM2 = areaM2Pendente;
        await Database.criar(obraId, COL_AREAS, data);
      }
      Utils.fecharModal('modal-lp-area');
      Utils.toast('Área salva!', 'sucesso');
      poligonoPontos = []; modo = 'nenhum'; areaPoligonoPendente = null; areaEditId = null;
      await carregar();
      abrirPavimento(pav.id);
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao salvar área: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  async function excluirAreaEmEdicao() {
    if (!areaEditId) return;
    if (!Utils.confirmar('Excluir esta área?')) return;
    const pav = _pavAtual();
    Utils.mostrarLoading('Excluindo...');
    try {
      await Database.deletar(obraId, COL_AREAS, areaEditId);
      Utils.fecharModal('modal-lp-area');
      Utils.toast('Área excluída.', 'sucesso');
      areaEditId = null;
      await carregar();
      abrirPavimento(pav.id);
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao excluir: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ══════════════════════════════════════════
  // OVERLAY SVG — desenha linha de calibração + polígonos
  // ══════════════════════════════════════════
  function _ptsAttr(pts) { return pts.map(p => (p.x * renderScale).toFixed(1) + ',' + (p.y * renderScale).toFixed(1)).join(' '); }

  function _desenharOverlay(pav) {
    const svg = document.querySelector('#lp-canvas-col svg.lp-svg-overlay');
    if (!svg) return;
    const svgNS = 'http://www.w3.org/2000/svg';
    let h = '';

    // Linha de calibração salva
    if (pav.linhaCalibracao) {
      const lc = pav.linhaCalibracao;
      h += `<line x1="${lc.x1 * renderScale}" y1="${lc.y1 * renderScale}" x2="${lc.x2 * renderScale}" y2="${lc.y2 * renderScale}" stroke="#16a34a" stroke-width="2" stroke-dasharray="6,4"/>`;
      h += `<circle cx="${lc.x1 * renderScale}" cy="${lc.y1 * renderScale}" r="4" fill="#16a34a"/>`;
      h += `<circle cx="${lc.x2 * renderScale}" cy="${lc.y2 * renderScale}" r="4" fill="#16a34a"/>`;
    }

    // Polígonos das áreas já salvas
    _areasDoPavimento(pav.id).forEach(a => {
      if (!a.poligono || a.poligono.length < 3) return;
      const isEdit = a.id === areaEditId;
      h += `<polygon points="${_ptsAttr(a.poligono)}" fill="${isEdit ? 'rgba(37,99,235,0.28)' : 'rgba(37,99,235,0.14)'}" stroke="#2563eb" stroke-width="1.5"/>`;
      const cx = a.poligono.reduce((s, p) => s + p.x, 0) / a.poligono.length * renderScale;
      const cy = a.poligono.reduce((s, p) => s + p.y, 0) / a.poligono.length * renderScale;
      h += `<text x="${cx}" y="${cy}" text-anchor="middle" font-size="12" font-weight="700" fill="#1e3a8a" style="paint-order:stroke;stroke:#fff;stroke-width:3px;">${esc(a.nome)}</text>`;
    });

    svg.innerHTML = h;
    _redesenharTemp();
  }

  function _redesenharTemp() {
    const svg = document.querySelector('#lp-canvas-col svg.lp-svg-overlay');
    if (!svg) return;
    let extra = '';
    if (modo === 'calibrar' && calibPontos.length) {
      calibPontos.forEach(p => { extra += `<circle cx="${p.x * renderScale}" cy="${p.y * renderScale}" r="4" fill="#f59e0b"/>`; });
      if (calibPontos.length === 2) {
        const [p1, p2] = calibPontos;
        extra += `<line x1="${p1.x * renderScale}" y1="${p1.y * renderScale}" x2="${p2.x * renderScale}" y2="${p2.y * renderScale}" stroke="#f59e0b" stroke-width="2"/>`;
      }
    }
    if (modo === 'medir' && poligonoPontos.length) {
      extra += `<polyline points="${_ptsAttr(poligonoPontos)}" fill="none" stroke="#dc2626" stroke-width="2"/>`;
      poligonoPontos.forEach(p => { extra += `<circle cx="${p.x * renderScale}" cy="${p.y * renderScale}" r="4" fill="#dc2626"/>`; });
      if (poligonoPontos.length >= 3) {
        extra += `<polygon points="${_ptsAttr(poligonoPontos)}" fill="rgba(220,38,38,0.12)" stroke="none"/>`;
      }
    }
    let tempG = svg.querySelector('#lp-temp-g');
    if (!tempG) {
      tempG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      tempG.setAttribute('id', 'lp-temp-g');
      svg.appendChild(tempG);
    }
    tempG.innerHTML = extra;
  }

  return {
    init, recarregar,
    abrirModalPlanta, enviarPlanta, excluirPlanta, abrirPlanta, voltarPlantas,
    criarPavimento, excluirPavimento, abrirPavimento, voltarPavimentos,
    toggleModoCalibrar, toggleModoMedir, cancelarDesenho,
    cancelarCalibracao, confirmarCalibracao,
    finalizarPoligono, editarArea, onToggleImperm, fecharModalArea, salvarArea, excluirAreaEmEdicao,
  };
})();

function onObraChanged() {
  if (typeof LP !== 'undefined') LP.recarregar();
}

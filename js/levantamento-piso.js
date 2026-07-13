// ============================================
// Módulo: Levantamento de Piso
//
// Mesmo formato de menu do Levantamento de Paredes: árvore de locais
// ilimitada em profundidade (ex: Torre > Andar > Apto > Cômodo).
// A diferença é que, em vez de lançar as peças manualmente, cada NÓ
// da árvore pode ter uma PÁGINA DE PDF vinculada — e a partir dela:
//
//  1) CALIBRA-SE a escala (desenha uma linha sobre uma medida
//     conhecida do desenho e informa a distância real em metros)
//  2) MEDE-SE as áreas de piso desenhando polígonos direto sobre a
//     página do PDF — cada polígono vira uma Área com m², tipo de
//     piso, contrapiso e impermeabilização (opcional)
//
// As páginas de PDF ficam numa biblioteca de "Plantas" (reaproveitável
// entre vários nós — ex: a mesma planta arquitetônica, mas cada nó usa
// a página correspondente ao seu pavimento/ambiente).
//
// Coordenadas de calibração e polígonos são guardadas em espaço
// "ponto-PDF" (viewport scale=1), independente do zoom de renderização
// em tela — a escala nunca se perde ao redimensionar.
//
// Dados: obras/{obraId}/config/pisoArvore   (árvore + vínculo de PDF por nó)
//        obras/{obraId}/pisoPlantas          (biblioteca de PDFs enviados)
//        obras/{obraId}/pisoAreas            (áreas medidas, por nodeId)
// ============================================

const LP = (() => {
  const COL_PLANTAS = 'pisoPlantas';
  const COL_AREAS = 'pisoAreas';
  const CONFIG_DOC = 'pisoArvore';

  let obraId = null;
  let arvore = [];      // [{id,nome,filhos:[...], plantaId, pagina, escalaMetrosPorPonto, linhaCalibracao}]
  let plantas = [];     // biblioteca de PDFs enviados (pisoPlantas)
  let areas = [];        // todas as áreas medidas (pisoAreas)
  let openNodes = new Set();
  let selNodeId = null;  // null = Visão Geral

  let pdfDoc = null;         // documento pdf.js carregado (da planta do nó aberto)
  let pdfDocPlantaId = null;
  let renderScale = 1;        // px de tela por ponto-PDF, na renderização atual

  let modo = 'nenhum';        // 'nenhum' | 'calibrar' | 'medir'
  let calibPontos = [];       // pontos-PDF da linha de calibração em progresso
  let poligonoPontos = [];    // vértices-PDF do polígono em progresso

  let zoomCss = 1;            // zoom de exibição (estilo CAD), aplicado via CSS por cima do canvas renderizado
  let pageWidthPts = 0;       // largura da página em pontos-PDF (viewport scale=1), usada pra converter clique -> ponto-PDF em qualquer zoom
  let panAtivo = false;
  let panInicio = { x: 0, y: 0, scrollX: 0, scrollY: 0 };

  let areaEditId = null;           // id da área em edição (null = nova)
  let areaPoligonoPendente = null; // polígono (pontos-PDF) aguardando salvar no modal
  let areaM2Pendente = 0;

  let _pendingVincularNodeId = null; // para qual nó o upload do modal-lp-planta se destina

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
    selNodeId = null; modo = 'nenhum';
    if (!obraId) { _renderSemObra(); return; }
    await carregar();
  }

  function _renderSemObra() {
    const el = document.getElementById('lp-content');
    if (el) el.innerHTML = `<div class="estado-vazio"><div class="icone">🧩</div><p>Selecione uma obra na barra lateral.</p></div>`;
  }

  async function carregar() {
    Utils.mostrarLoading('Carregando levantamento de piso...');
    try {
      const [cfgSnap, lp, ar] = await Promise.all([
        db.collection('obras').doc(obraId).collection('config').doc(CONFIG_DOC).get(),
        Database.listar(obraId, COL_PLANTAS, 'createdAt', 'desc').catch(() => []),
        Database.listar(obraId, COL_AREAS, null).catch(() => []),
      ]);
      arvore = (cfgSnap.exists && Array.isArray(cfgSnap.data().arvore)) ? cfgSnap.data().arvore : [];
      plantas = lp; areas = ar;
      renderizar();
    } catch (e) {
      console.error('Erro ao carregar levantamento de piso:', e);
      Utils.toast('Erro ao carregar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  async function _salvarArvore() {
    await db.collection('obras').doc(obraId).collection('config').doc(CONFIG_DOC).set({ arvore }, { merge: true });
  }

  // ══════════════════════════════════════════
  // HELPERS GERAIS
  // ══════════════════════════════════════════
  function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function _uid() { return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function fmt2(n) { return (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function num(v) { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? 0 : n; }

  function _ls(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }

  async function _garantirPdfjs() {
    if (typeof pdfjsLib !== 'undefined') return;
    await _ls('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  // O Firebase Storage não libera CORS para fetch()/XHR por padrão (só funciona
  // sem CORS em <img>/<embed>). Buscamos os bytes via proxy serverless próprio
  // (api/pdf-proxy.js), que roda no servidor (sem restrição de CORS) e devolve
  // pro navegador a partir do mesmo domínio.
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

  // ══════════════════════════════════════════
  // ÁRVORE — helpers
  // ══════════════════════════════════════════
  function _acharNode(id, nodes = arvore, parent = null) {
    for (const n of nodes) {
      if (n.id === id) return { node: n, parent, lista: nodes };
      const r = _acharNode(id, n.filhos || [], n);
      if (r) return r;
    }
    return null;
  }
  function _idsComDescendentes(n) {
    let ids = [n.id];
    (n.filhos || []).forEach(f => { ids = ids.concat(_idsComDescendentes(f)); });
    return ids;
  }
  function _ordenarNodes(nodes) { return [...nodes].sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR')); }
  function _areasDoNode(nodeId) { return areas.filter(a => a.nodeId === nodeId); }
  function _plantaPorId(id) { return plantas.find(p => p.id === id) || null; }

  // ══════════════════════════════════════════
  // RENDER PRINCIPAL
  // ══════════════════════════════════════════
  function renderizar() {
    const el = document.getElementById('lp-content');
    const actions = document.getElementById('lp-header-actions');
    if (!el) return;
    if (actions) actions.innerHTML = '';
    el.innerHTML = `
      <div class="page-header">
        <div>
          <h2>🧩 Levantamento de Piso</h2>
          <span class="subtitulo">${areas.length} área(s) medida(s) · ${fmt2(areas.reduce((s, a) => s + (a.areaM2 || 0), 0))} m²</span>
        </div>
      </div>
      <div class="ar-layout">
        <div class="ar-tree">
          <div class="ar-tree-header">
            <h3>Locais</h3>
            <button class="btn btn-primario btn-sm" onclick="LP.novoNode(null)">+ Local</button>
          </div>
          <div class="ar-tree-body" id="lp-tree-body">${_renderArvore()}</div>
        </div>
        <div class="ar-painel" id="lp-painel">${_renderPainel()}</div>
      </div>
    `;
    if (selNodeId) {
      const r = _acharNode(selNodeId);
      if (r && r.node.plantaId) _renderCanvasNode(r.node);
    }
  }

  function _renderArvoreNivel(nodes) {
    return _ordenarNodes(nodes).map(n => {
      const aberto = openNodes.has(n.id);
      const ativo = selNodeId === n.id;
      const ids = _idsComDescendentes(n);
      const nAreas = areas.filter(a => ids.includes(a.nodeId)).length;
      let h = `<div class="tree-item${ativo ? ' ativo' : ''}" onclick="LP.toggleNode('${n.id}');LP.selNode('${n.id}')">
        <span class="tree-toggle">${(n.filhos || []).length ? (aberto ? '▼' : '▶') : ''}</span>
        <span class="tree-icon">${n.plantaId ? '📄' : '📍'}</span>
        <span class="tree-label">${esc(n.nome)}</span>
        ${nAreas ? `<span class="tree-badge">${nAreas}</span>` : ''}
        <button class="tree-edit-btn" onclick="event.stopPropagation();LP.renomearNode('${n.id}')" title="Renomear">✎</button>
        <button class="tree-del-btn" onclick="event.stopPropagation();LP.excluirNode('${n.id}')" title="Excluir">✕</button>
      </div>`;
      if (aberto) {
        h += `<div class="tree-children">`;
        h += _renderArvoreNivel(n.filhos || []);
        h += `<div class="ar-add-inline" onclick="event.stopPropagation();LP.novoNode('${n.id}')">+ adicionar sublocal</div>`;
        h += `</div>`;
      }
      return h;
    }).join('');
  }

  function _renderArvore() {
    let h = `<div class="tree-item${!selNodeId ? ' ativo' : ''}" onclick="LP.selGeral()">
      <span class="tree-toggle"></span><span class="tree-icon">📊</span>
      <span class="tree-label"><strong>Visão Geral</strong></span>
    </div>`;
    if (!arvore.length) {
      h += `<div class="estado-vazio"><p class="text-sm">Nenhum local cadastrado. Clique em "+ Local" para começar (ex: Torre A, Térreo, Apto 101).</p></div>`;
      return h;
    }
    h += _renderArvoreNivel(arvore);
    return h;
  }

  function toggleNode(id) { if (openNodes.has(id)) openNodes.delete(id); else openNodes.add(id); }

  function selNode(id) {
    const trocouNode = id !== selNodeId;
    selNodeId = id; modo = 'nenhum'; calibPontos = []; poligonoPontos = [];
    if (trocouNode) zoomCss = 1;
    renderizar();
  }
  function selGeral() {
    selNodeId = null; modo = 'nenhum'; calibPontos = []; poligonoPontos = []; zoomCss = 1;
    renderizar();
  }

  // ══════════════════════════════════════════
  // CRUD DA ÁRVORE
  // ══════════════════════════════════════════
  async function novoNode(parentId) {
    const nome = window.prompt('Nome do local:'); if (!nome) return;
    const novo = { id: _uid(), nome: nome.trim(), filhos: [], plantaId: null, pagina: null, escalaMetrosPorPonto: null, linhaCalibracao: null };
    if (parentId) {
      const r = _acharNode(parentId); if (!r) return;
      r.node.filhos = r.node.filhos || [];
      r.node.filhos.push(novo);
      openNodes.add(parentId);
    } else {
      arvore.push(novo);
    }
    Utils.mostrarLoading('Salvando...');
    try {
      await _salvarArvore();
      selNodeId = novo.id;
      await carregar();
    } catch (e) {
      console.error(e); Utils.toast('Erro ao criar local: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  async function renomearNode(id) {
    const r = _acharNode(id); if (!r) return;
    const nome = window.prompt('Renomear local:', r.node.nome); if (nome === null) return;
    r.node.nome = nome.trim() || r.node.nome;
    Utils.mostrarLoading('Salvando...');
    try { await _salvarArvore(); await carregar(); }
    catch (e) { console.error(e); Utils.toast('Erro ao renomear: ' + e.message, 'erro'); }
    finally { Utils.esconderLoading(); }
  }

  async function excluirNode(id) {
    const r = _acharNode(id); if (!r) return;
    const ids = _idsComDescendentes(r.node);
    const areasParaExcluir = areas.filter(a => ids.includes(a.nodeId));
    const msg = areasParaExcluir.length
      ? `Excluir "${r.node.nome}" e seus sublocais? Isso também excluirá ${areasParaExcluir.length} área(s) medida(s).`
      : `Excluir "${r.node.nome}" e seus sublocais?`;
    if (!Utils.confirmar(msg)) return;
    Utils.mostrarLoading('Excluindo...');
    try {
      const lista = r.parent ? r.parent.filhos : arvore;
      const idx = lista.findIndex(x => x.id === id);
      if (idx > -1) lista.splice(idx, 1);
      await _salvarArvore();
      if (areasParaExcluir.length) {
        const ops = areasParaExcluir.map(a => ({ type: 'delete', ref: Database.ref(obraId, COL_AREAS).doc(a.id) }));
        await Database.batchWrite(ops);
      }
      if (selNodeId && ids.includes(selNodeId)) selNodeId = null;
      Utils.toast('Local excluído.', 'sucesso');
      await carregar();
    } catch (e) {
      console.error(e); Utils.toast('Erro ao excluir: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ══════════════════════════════════════════
  // PAINEL — dispatch
  // ══════════════════════════════════════════
  function _renderPainel() {
    if (!selNodeId) return _renderVisaoGeral();
    const r = _acharNode(selNodeId);
    if (!r) { selNodeId = null; return _renderVisaoGeral(); }
    if (!r.node.plantaId) return _renderVincularPlanta(r.node);
    return _renderWorkspace(r.node);
  }

  // ── VISÃO GERAL ──
  function _renderVisaoGeral() {
    const totalM2 = areas.reduce((s, a) => s + (a.areaM2 || 0), 0);
    const nodesComVinculo = _contarNodesComVinculo(arvore);
    return `
      <div class="page-header">
        <div><h2 style="font-size:1.1rem;">📊 Visão Geral</h2>
          <span class="subtitulo">${areas.length} área(s) · ${fmt2(totalM2)} m² · ${nodesComVinculo} local(is) com planta vinculada</span></div>
      </div>
      <div class="lp-hint">Clique em um local na árvore ao lado (ou crie um novo com "+ Local") para vincular uma planta em PDF e começar a medir.</div>
      <h3 class="mb-2" style="font-size:0.95rem;">📄 Plantas enviadas</h3>
      ${plantas.length === 0 ? `<div class="estado-vazio" style="padding:16px;"><p class="text-sm">Nenhuma planta enviada ainda.</p></div>` : plantas.map(pl => `
        <div class="lp-planta-lib-item">
          <span>${esc(pl.nome)} <span style="color:var(--cor-texto-muted);">· ${pl.numPaginas || 1} página(s)</span></span>
          <button class="btn btn-secundario btn-sm" onclick="LP.excluirPlanta('${pl.id}')" title="Excluir planta">✕</button>
        </div>
      `).join('')}
    `;
  }

  function _contarNodesComVinculo(nodes) {
    let c = 0;
    nodes.forEach(n => { if (n.plantaId) c++; c += _contarNodesComVinculo(n.filhos || []); });
    return c;
  }

  // ── SEM VÍNCULO: escolher/enviar planta ──
  function _renderVincularPlanta(node) {
    return `
      <div class="page-header">
        <div><h2 style="font-size:1.1rem;">${esc(node.nome)}</h2>
          <span class="subtitulo">Este local ainda não tem planta vinculada</span></div>
      </div>
      <div class="lp-vinc-card">
        ${plantas.length ? `
          <div class="form-grupo">
            <label>Escolher planta já enviada</label>
            <select id="lp-sel-planta-existente" class="form-control">
              <option value="">Selecione...</option>
              ${plantas.map(pl => `<option value="${pl.id}">${esc(pl.nome)} (${pl.numPaginas || 1} pág.)</option>`).join('')}
            </select>
          </div>
          <div class="form-grupo">
            <label>Página a usar</label>
            <input type="number" id="lp-input-pagina-existente" class="form-control" min="1" value="1">
          </div>
          <button class="btn btn-primario mb-2" style="width:100%;" onclick="LP.vincularPlantaExistente('${node.id}')">Vincular esta página</button>
          <div style="text-align:center;color:var(--cor-texto-muted);font-size:0.78rem;margin:8px 0;">— ou —</div>
        ` : ''}
        <button class="btn btn-secundario" style="width:100%;" onclick="LP.abrirModalPlanta('${node.id}')">+ Enviar nova planta em PDF</button>
      </div>
    `;
  }

  function abrirModalPlanta(nodeId) {
    _pendingVincularNodeId = nodeId || null;
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

      if (_pendingVincularNodeId) {
        await _vincularNode(_pendingVincularNodeId, plantaId, 1);
      } else {
        await carregar();
      }
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
    const nodesLigados = _contarNodesUsandoPlanta(arvore, id);
    if (nodesLigados > 0) {
      Utils.toast(`Não é possível excluir: ${nodesLigados} local(is) ainda usam esta planta.`, 'alerta');
      return;
    }
    if (!Utils.confirmar(`Excluir a planta "${pl.nome}"?`)) return;
    Utils.mostrarLoading('Excluindo...');
    try {
      await Database.deletar(obraId, COL_PLANTAS, id);
      try { await storage.ref(pl.storagePath).delete(); } catch (e2) {}
      Utils.toast('Planta excluída.', 'sucesso');
      await carregar();
    } catch (e) {
      console.error(e); Utils.toast('Erro ao excluir: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  function _contarNodesUsandoPlanta(nodes, plantaId) {
    let c = 0;
    nodes.forEach(n => { if (n.plantaId === plantaId) c++; c += _contarNodesUsandoPlanta(n.filhos || [], plantaId); });
    return c;
  }

  async function vincularPlantaExistente(nodeId) {
    const sel = document.getElementById('lp-sel-planta-existente');
    const pagInput = document.getElementById('lp-input-pagina-existente');
    const plantaId = sel.value;
    const pagina = parseInt(pagInput.value, 10) || 1;
    if (!plantaId) { Utils.toast('Escolha uma planta.', 'alerta'); return; }
    const pl = _plantaPorId(plantaId);
    if (pl && pagina > (pl.numPaginas || 1)) { Utils.toast(`Esta planta só tem ${pl.numPaginas || 1} página(s).`, 'alerta'); return; }
    await _vincularNode(nodeId, plantaId, pagina);
  }

  async function _vincularNode(nodeId, plantaId, pagina) {
    const r = _acharNode(nodeId); if (!r) return;
    r.node.plantaId = plantaId; r.node.pagina = pagina;
    r.node.escalaMetrosPorPonto = null; r.node.linhaCalibracao = null;
    Utils.mostrarLoading('Vinculando planta...');
    try {
      await _salvarArvore();
      Utils.toast('Planta vinculada! Agora calibre a escala.', 'sucesso');
      await carregar();
      selNode(nodeId);
    } catch (e) {
      console.error(e); Utils.toast('Erro ao vincular: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  async function trocarPlanta(nodeId) {
    if (!Utils.confirmar('Trocar a planta/página deste local? As áreas já medidas continuam salvas, mas os polígonos ficam fora de referência visual até recalibrar a escala.')) return;
    const r = _acharNode(nodeId); if (!r) return;
    r.node.plantaId = null; r.node.pagina = null; r.node.escalaMetrosPorPonto = null; r.node.linhaCalibracao = null;
    Utils.mostrarLoading('Salvando...');
    try { await _salvarArvore(); await carregar(); selNode(nodeId); }
    catch (e) { console.error(e); Utils.toast('Erro: ' + e.message, 'erro'); }
    finally { Utils.esconderLoading(); }
  }

  // ══════════════════════════════════════════
  // WORKSPACE (canvas + medição) — nó com planta vinculada
  // ══════════════════════════════════════════
  function _renderWorkspace(node) {
    const temEscala = !!node.escalaMetrosPorPonto;
    const areasN = _areasDoNode(node.id).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    const totalNode = areasN.reduce((s, a) => s + (a.areaM2 || 0), 0);
    const pl = _plantaPorId(node.plantaId);

    setTimeout(_popularDatalists, 0);

    return `
      <div class="page-header">
        <div><h2 style="font-size:1.1rem;">${esc(node.nome)}</h2>
          <span class="subtitulo">${pl ? esc(pl.nome) : ''} — página ${node.pagina} · ${areasN.length} área(s) · ${fmt2(totalNode)} m²</span></div>
        <button class="btn btn-secundario btn-sm" onclick="LP.trocarPlanta('${node.id}')">🔄 Trocar planta/página</button>
      </div>
      <div class="lp-toolbar">
        <button class="btn btn-secundario btn-sm ${modo === 'calibrar' ? 'lp-modo-ativo' : ''}" onclick="LP.toggleModoCalibrar()">📏 Calibrar Escala</button>
        <button class="btn btn-secundario btn-sm ${modo === 'medir' ? 'lp-modo-ativo' : ''}" onclick="LP.toggleModoMedir()" ${temEscala ? '' : 'disabled title="Calibre a escala primeiro"'}>⬟ Nova Área</button>
        ${modo === 'medir' ? `
          <button class="btn btn-primario btn-sm" id="lp-btn-finalizar" onclick="LP.finalizarPoligono()">✓ Finalizar Área (${poligonoPontos.length} pontos)</button>
          <button class="btn btn-secundario btn-sm" onclick="LP.cancelarDesenho()">Cancelar</button>
        ` : ''}
        ${modo === 'calibrar' ? `<button class="btn btn-secundario btn-sm" onclick="LP.cancelarDesenho()">Cancelar</button>` : ''}
        <div class="sep"></div>
        <button class="btn btn-secundario btn-sm" onclick="LP.zoomOut()" title="Diminuir zoom">➖</button>
        <button class="btn btn-secundario btn-sm" onclick="LP.zoomReset()" title="Redefinir zoom (100%)"><span id="lp-zoom-pct">100%</span></button>
        <button class="btn btn-secundario btn-sm" onclick="LP.zoomIn()" title="Aumentar zoom">➕</button>
        <div class="sep"></div>
        <span class="info">${temEscala ? `Escala: 1 ponto-PDF = ${(node.escalaMetrosPorPonto * 1000).toFixed(3)} mm` : 'Escala não calibrada'}</span>
      </div>
      ${!temEscala ? `<div class="lp-hint">Antes de medir, clique em "📏 Calibrar Escala", desenhe uma linha sobre uma medida conhecida do desenho (ex: uma cota) e informe a distância real.</div>` : ''}
      ${modo === 'medir' ? `<div class="lp-hint">Clique para adicionar vértices do polígono da área. Dê um duplo-clique ou clique em "Finalizar Área" quando terminar. Roda do mouse: zoom · botão do meio: mover a planta.</div>` : ''}
      ${modo === 'calibrar' ? `<div class="lp-hint">Clique em dois pontos sobre uma medida conhecida do desenho (ex: início e fim de uma cota). Roda do mouse: zoom · botão do meio: mover a planta.</div>` : ''}
      ${modo === 'nenhum' ? `<div class="lp-hint">Roda do mouse: zoom (no cursor) · clique e arraste (ou botão do meio): mover a planta — igual AutoCAD.</div>` : ''}
      <div class="lp-workspace">
        <div class="lp-canvas-col" id="lp-canvas-col"><div class="loading-inline">Carregando página do PDF...</div></div>
        <div class="lp-painel-lateral">
          <div class="lp-totais">
            <table>
              <tr><td>Total de áreas</td><td>${areasN.length}</td></tr>
              <tr><td>Área total</td><td>${fmt2(totalNode)} m²</td></tr>
            </table>
          </div>
          ${areasN.length === 0 ? `<div class="estado-vazio" style="padding:20px;"><p style="font-size:0.85rem;">Nenhuma área medida ainda.</p></div>` : areasN.map(a => `
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

  async function _renderCanvasNode(node) {
    const col = document.getElementById('lp-canvas-col');
    if (!col) return;
    try {
      await _garantirPdfjs();
      const pl = _plantaPorId(node.plantaId);
      if (!pl) return;
      if (pdfDocPlantaId !== pl.id) {
        pdfDoc = await _carregarPdfDoc(pl.downloadURL);
        pdfDocPlantaId = pl.id;
      }
      const page = await pdfDoc.getPage(node.pagina);
      const viewportBase = page.getViewport({ scale: 1 });
      pageWidthPts = viewportBase.width;
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
      svg.setAttribute('viewBox', '0 0 ' + viewport.width + ' ' + viewport.height);
      stage.appendChild(svg);

      col.innerHTML = '';
      col.appendChild(stage);

      stage.addEventListener('click', _onStageClick);
      stage.addEventListener('dblclick', _onStageDblClick);
      stage.addEventListener('pointerdown', _iniciarPan);
      stage.addEventListener('pointermove', _moverPan);
      stage.addEventListener('pointerup', _finalizarPan);
      stage.addEventListener('pointercancel', _finalizarPan);
      stage.addEventListener('contextmenu', e => { if (panAtivo) e.preventDefault(); });
      col.addEventListener('wheel', _onWheelZoom, { passive: false });

      _aplicarZoom();
      _desenharOverlay(node);
    } catch (e) {
      console.error('Erro ao renderizar PDF:', e);
      col.innerHTML = `<div class="estado-vazio"><p>Erro ao carregar a página do PDF: ${esc(e.message)}</p></div>`;
    }
  }

  function _clickToPdfPoint(e) {
    const stage = e.currentTarget;
    const rect = stage.getBoundingClientRect();
    const dispScale = rect.width / pageWidthPts; // escala real exibida (já considera o zoom CSS aplicado)
    const x = (e.clientX - rect.left) / dispScale;
    const y = (e.clientY - rect.top) / dispScale;
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
    const btn = document.getElementById('lp-btn-finalizar');
    if (btn) btn.textContent = `✓ Finalizar Área (${poligonoPontos.length} pontos)`;
  }

  // ── PAN (arrastar) — botão do meio sempre; botão esquerdo só fora do modo de desenho ──
  function _iniciarPan(e) {
    const isMeio = e.button === 1;
    const isEsquerdoLivre = e.button === 0 && modo === 'nenhum';
    if (!isMeio && !isEsquerdoLivre) return;
    panAtivo = true;
    const col = document.getElementById('lp-canvas-col');
    panInicio = { x: e.clientX, y: e.clientY, scrollX: col.scrollLeft, scrollY: col.scrollTop };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  }
  function _moverPan(e) {
    if (!panAtivo) return;
    const col = document.getElementById('lp-canvas-col');
    col.scrollLeft = panInicio.scrollX - (e.clientX - panInicio.x);
    col.scrollTop = panInicio.scrollY - (e.clientY - panInicio.y);
  }
  function _finalizarPan(e) {
    if (!panAtivo) return;
    panAtivo = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (err) {}
  }

  // ── ZOOM estilo CAD — CSS por cima do canvas já renderizado (mantém o overlay alinhado) ──
  function _aplicarZoom() {
    const stage = document.querySelector('#lp-canvas-col .lp-canvas-stage');
    if (!stage) return;
    const canvas = stage.querySelector('canvas.lp-base');
    const svg = stage.querySelector('svg.lp-svg-overlay');
    if (!canvas || !svg) return;
    const w = canvas.width * zoomCss, h = canvas.height * zoomCss;
    stage.style.width = w + 'px'; stage.style.height = h + 'px';
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    svg.style.width = w + 'px'; svg.style.height = h + 'px';
    const pct = document.getElementById('lp-zoom-pct');
    if (pct) pct.textContent = Math.round(zoomCss * 100) + '%';
  }

  function _onWheelZoom(e) {
    e.preventDefault();
    const col = document.getElementById('lp-canvas-col');
    const rect = col.getBoundingClientRect();
    const mouseX = e.clientX - rect.left + col.scrollLeft;
    const mouseY = e.clientY - rect.top + col.scrollTop;
    const oldZoom = zoomCss;
    const fator = e.deltaY < 0 ? 1.15 : (1 / 1.15);
    zoomCss = Math.min(5, Math.max(0.2, zoomCss * fator));
    _aplicarZoom();
    const ratio = zoomCss / oldZoom;
    col.scrollLeft = mouseX * ratio - (e.clientX - rect.left);
    col.scrollTop = mouseY * ratio - (e.clientY - rect.top);
  }

  function zoomIn() { zoomCss = Math.min(5, zoomCss * 1.25); _aplicarZoom(); }
  function zoomOut() { zoomCss = Math.max(0.2, zoomCss / 1.25); _aplicarZoom(); }
  function zoomReset() { zoomCss = 1; _aplicarZoom(); }

  function toggleModoCalibrar() {
    modo = modo === 'calibrar' ? 'nenhum' : 'calibrar';
    calibPontos = []; poligonoPontos = [];
    renderizar();
  }

  function toggleModoMedir() {
    const r = _acharNode(selNodeId);
    if (!r || !r.node.escalaMetrosPorPonto) { Utils.toast('Calibre a escala antes de medir.', 'alerta'); return; }
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

    const r = _acharNode(selNodeId); if (!r) return;
    Utils.mostrarLoading('Salvando escala...');
    try {
      r.node.escalaMetrosPorPonto = escalaMetrosPorPonto;
      r.node.linhaCalibracao = { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, distanciaReal: distReal };
      await _salvarArvore();
      Utils.fecharModal('modal-lp-calibrar');
      Utils.toast('Escala calibrada!', 'sucesso');
      modo = 'nenhum'; calibPontos = [];
      await carregar();
      selNode(selNodeId);
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao salvar escala: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  function finalizarPoligono() {
    if (poligonoPontos.length < 3) { Utils.toast('Desenhe pelo menos 3 pontos.', 'alerta'); return; }
    const r = _acharNode(selNodeId); if (!r) return;
    const areaPdf = _areaPoligono(poligonoPontos);
    const areaM2 = areaPdf * (r.node.escalaMetrosPorPonto ** 2);
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
      poligonoPontos = []; modo = 'nenhum'; areaPoligonoPendente = null;
      renderizar();
    }
  }

  async function salvarArea() {
    const data = Utils.getFormData('form-lp-area');
    if (!data.nome) { Utils.toast('Informe o nome da área.', 'alerta'); return; }
    if (!data.impermeabilizacao) data.tipoImpermeabilizacao = '';

    Utils.mostrarLoading('Salvando área...');
    try {
      if (areaEditId) {
        await Database.atualizar(obraId, COL_AREAS, areaEditId, data);
      } else {
        data.nodeId = selNodeId;
        data.poligono = areaPoligonoPendente;
        data.areaM2 = areaM2Pendente;
        await Database.criar(obraId, COL_AREAS, data);
      }
      Utils.fecharModal('modal-lp-area');
      Utils.toast('Área salva!', 'sucesso');
      poligonoPontos = []; modo = 'nenhum'; areaPoligonoPendente = null; areaEditId = null;
      await carregar();
      selNode(selNodeId);
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
    Utils.mostrarLoading('Excluindo...');
    try {
      await Database.deletar(obraId, COL_AREAS, areaEditId);
      Utils.fecharModal('modal-lp-area');
      Utils.toast('Área excluída.', 'sucesso');
      areaEditId = null;
      await carregar();
      selNode(selNodeId);
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

  function _desenharOverlay(node) {
    const svg = document.querySelector('#lp-canvas-col svg.lp-svg-overlay');
    if (!svg) return;
    let h = '';

    if (node.linhaCalibracao) {
      const lc = node.linhaCalibracao;
      h += `<line x1="${lc.x1 * renderScale}" y1="${lc.y1 * renderScale}" x2="${lc.x2 * renderScale}" y2="${lc.y2 * renderScale}" stroke="#16a34a" stroke-width="2" stroke-dasharray="6,4"/>`;
      h += `<circle cx="${lc.x1 * renderScale}" cy="${lc.y1 * renderScale}" r="4" fill="#16a34a"/>`;
      h += `<circle cx="${lc.x2 * renderScale}" cy="${lc.y2 * renderScale}" r="4" fill="#16a34a"/>`;
    }

    _areasDoNode(node.id).forEach(a => {
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
    novoNode, renomearNode, excluirNode, toggleNode, selNode, selGeral,
    abrirModalPlanta, enviarPlanta, excluirPlanta, vincularPlantaExistente, trocarPlanta,
    toggleModoCalibrar, toggleModoMedir, cancelarDesenho,
    cancelarCalibracao, confirmarCalibracao,
    finalizarPoligono, editarArea, onToggleImperm, fecharModalArea, salvarArea, excluirAreaEmEdicao,
    zoomIn, zoomOut, zoomReset,
  };
})();

function onObraChanged() {
  if (typeof LP !== 'undefined') LP.recarregar();
}

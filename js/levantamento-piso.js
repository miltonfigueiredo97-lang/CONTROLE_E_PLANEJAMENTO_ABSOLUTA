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
  let treeColapsada = false;

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
  let fsAtivo = false;        // tela cheia do workspace de medição

  let areaEditId = null;           // id da área em edição (null = nova)
  let areaNodeIdPendente = null;   // nodeId capturado no momento em que o polígono foi fechado
                                    // (não confiar em selNodeId "ao vivo" no momento de salvar —
                                    // evita a área cair no local errado se algo mudar a seleção
                                    // entre desenhar e salvar)
  let areaPoligonoPendente = null; // polígono (pontos-PDF) aguardando salvar no modal
  let areaM2Pendente = 0;
  let rodapeArestasPendente = null; // seleção de arestas com rodapé (nova área) aguardando salvar
  let mlRodapePendente = 0;
  let poligonoRodapeSelecionado = []; // seleção em progresso (modo 'rodape'), array de booleans por aresta
  let _rodapeEditandoAreaId = null;   // se setado, o modo 'rodape' está editando o rodapé de uma área já salva
  let areaDestacadaId = null;      // área destacada temporariamente (ao focar pela árvore)
  let _destacarTimer = null;

  let _pendingVincularNodeId = null; // para qual nó o upload do modal-lp-planta se destina

  // ══════════════════════════════════════════
  // INIT / CARREGAMENTO
  // ══════════════════════════════════════════
  async function init() {
    const ok = await Utils.initPagina({ requireObra: true });
    if (!ok) return;
    obraId = Router.getObraId();
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (modo !== 'nenhum') { cancelarDesenho(); }
        else if (fsAtivo) { toggleFullscreen(); }
        Utils.fecharTodosModais();
      }
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

  let _openNodesInicializado = false;
  function _todosNodeIds(nodes, out = []) {
    nodes.forEach(n => { out.push(n.id); _todosNodeIds(n.filhos || [], out); });
    return out;
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
      if (!_openNodesInicializado) {
        _todosNodeIds(arvore).forEach(id => openNodes.add(id));
        _openNodesInicializado = true;
      }
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

  // Lista achatada de todos os locais que têm planta vinculada, com caminho
  // completo (ex: "Torre › 1º Pavimento") — usada no seletor de mover área.
  function _listarNodesMedicao(nodes = arvore, caminho = []) {
    let out = [];
    _ordenarNodes(nodes).forEach(n => {
      const novoCaminho = [...caminho, n.nome];
      if (n.plantaId) out.push({ id: n.id, label: novoCaminho.join(' › ') });
      out = out.concat(_listarNodesMedicao(n.filhos || [], novoCaminho));
    });
    return out;
  }

  // ══════════════════════════════════════════
  // RENDER PRINCIPAL
  // ══════════════════════════════════════════
  function renderizar() {
    const el = document.getElementById('lp-content');
    const actions = document.getElementById('lp-header-actions');
    if (!el) return;
    if (actions) actions.innerHTML = '';
    const nodeAtual = selNodeId ? _acharNode(selNodeId) : null;
    const emWorkspace = !!(nodeAtual && nodeAtual.node.plantaId);
    el.innerHTML = `
      ${!selNodeId ? `
        <div class="page-header">
          <div>
            <h2>🧩 Levantamento de Piso</h2>
            <span class="subtitulo">${areas.length} área(s) medida(s) · ${fmt2(areas.reduce((s, a) => s + (a.areaM2 || 0), 0))} m²</span>
          </div>
        </div>
      ` : ''}
      <div class="ar-layout ${treeColapsada ? 'tree-colapsada' : ''} ${emWorkspace ? 'lp-workspace-ativo' : ''}">
        <div class="ar-tree">
          <div class="ar-tree-header">
            <h3>Locais</h3>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-secundario btn-sm" onclick="LP.toggleArvore()" title="Recolher árvore">⏴</button>
              <button class="btn btn-primario btn-sm" onclick="LP.novoNode(null)">+ Local</button>
            </div>
          </div>
          <div class="ar-tree-body" id="lp-tree-body">${_renderArvore()}</div>
        </div>
        <div class="ar-painel" id="lp-painel">
          ${treeColapsada ? `<button class="btn btn-secundario btn-sm lp-reabrir-arvore" onclick="LP.toggleArvore()" title="Mostrar árvore de locais">☰ Locais</button>` : ''}
          ${_renderPainel()}
        </div>
      </div>
    `;
    if (selNodeId) {
      const r = _acharNode(selNodeId);
      if (r && r.node.plantaId) _renderCanvasNode(r.node);
    }
  }

  function toggleArvore() { treeColapsada = !treeColapsada; renderizar(); }
  function toggleFullscreen() { fsAtivo = !fsAtivo; renderizar(); }

  // Clique numa área da árvore: seleciona o local (se necessário), centraliza
  // a planta nela com destaque temporário, e abre a edição das informações.
  function focarArea(nodeId, areaId) {
    const trocou = nodeId !== selNodeId;
    selNode(nodeId);
    setTimeout(() => {
      _focarAreaNoCanvas(areaId);
      editarArea(areaId);
    }, trocou ? 650 : 150);
  }

  function _focarAreaNoCanvas(areaId) {
    const a = areas.find(x => x.id === areaId);
    if (!a || !a.poligono || !a.poligono.length) return;
    const col = document.getElementById('lp-canvas-col');
    const stage = document.querySelector('#lp-canvas-col .lp-canvas-stage');
    const canvas = stage && stage.querySelector('canvas.lp-base');
    if (!col || !stage || !canvas || !pageWidthPts) return;
    const cx = a.poligono.reduce((s, p) => s + p.x, 0) / a.poligono.length;
    const cy = a.poligono.reduce((s, p) => s + p.y, 0) / a.poligono.length;
    const dispScale = (canvas.width * zoomCss) / pageWidthPts;
    col.scrollLeft = Math.max(0, cx * dispScale - col.clientWidth / 2);
    col.scrollTop = Math.max(0, cy * dispScale - col.clientHeight / 2);
    _destacarAreaTemporario(areaId);
  }

  function _destacarAreaTemporario(areaId) {
    areaDestacadaId = areaId;
    const r = _acharNode(selNodeId);
    if (r) _desenharOverlay(r.node);
    clearTimeout(_destacarTimer);
    _destacarTimer = setTimeout(() => {
      areaDestacadaId = null;
      const r2 = _acharNode(selNodeId);
      if (r2) _desenharOverlay(r2.node);
    }, 1800);
  }

  function _renderArvoreNivel(nodes) {
    return _ordenarNodes(nodes).map(n => {
      const aberto = openNodes.has(n.id);
      const ativo = selNodeId === n.id;
      const ids = _idsComDescendentes(n);
      const nAreas = areas.filter(a => ids.includes(a.nodeId)).length;
      const areasDoNo = _areasDoNode(n.id).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
      const temExpandir = (n.filhos || []).length > 0 || areasDoNo.length > 0;
      let h = `<div class="tree-item${ativo ? ' ativo' : ''}" onclick="LP.selNode('${n.id}')" title="${esc(n.nome)}">
        <span class="tree-toggle" onclick="event.stopPropagation();LP.toggleNode('${n.id}')">${temExpandir ? (aberto ? '▼' : '▶') : ''}</span>
        <span class="tree-icon">${n.plantaId ? '📄' : '📍'}</span>
        <span class="tree-label">${esc(n.nome)}</span>
        ${nAreas ? `<span class="tree-badge">${nAreas}</span>` : ''}
        <button class="tree-edit-btn" onclick="event.stopPropagation();LP.renomearNode('${n.id}')" title="Renomear">✎</button>
        <button class="tree-del-btn" onclick="event.stopPropagation();LP.excluirNode('${n.id}')" title="Excluir">✕</button>
      </div>`;
      if (aberto) {
        // Áreas medidas diretamente neste local — atrás do mesmo collapse do nó
        // (clique na seta/local minimiza só isso, sem precisar fechar o pai).
        if (areasDoNo.length) {
          h += `<div class="tree-children tree-children-areas">`;
          areasDoNo.forEach(a => {
            h += `<div class="tree-item tree-item-area" onclick="event.stopPropagation();LP.focarArea('${n.id}','${a.id}')" title="Ver esta área na planta">
              <span class="tree-toggle"></span>
              <span class="tree-icon">📐</span>
              <span class="tree-label">${esc(a.nome)}</span>
              <span class="tree-badge tree-badge-area">${fmt2(a.areaM2)}m²</span>
            </div>`;
          });
          h += `</div>`;
        }
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

  function toggleNode(id) {
    if (openNodes.has(id)) openNodes.delete(id); else openNodes.add(id);
    const treeBody = document.getElementById('lp-tree-body');
    if (treeBody) treeBody.innerHTML = _renderArvore();
  }

  function selNode(id) {
    const trocouNode = id !== selNodeId;
    selNodeId = id; modo = 'nenhum'; calibPontos = []; poligonoPontos = [];
    if (trocouNode) { zoomCss = 1; fsAtivo = false; }
    renderizar();
  }
  function selGeral() {
    selNodeId = null; modo = 'nenhum'; calibPontos = []; poligonoPontos = []; zoomCss = 1; fsAtivo = false;
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
    openNodes.add(novo.id);
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
  function _caminhoNode(id, nodes = arvore, caminho = []) {
    for (const n of nodes) {
      if (n.id === id) return [...caminho, n.nome].join(' › ');
      const r = _caminhoNode(id, n.filhos || [], [...caminho, n.nome]);
      if (r) return r;
    }
    return null;
  }

  function _renderVisaoGeral() {
    const totalAreas = areas.length;
    const totalPiso = areas.reduce((s, a) => s + (a.areaM2 || 0), 0);
    const totalContrapiso = areas.reduce((s, a) => s + (a.tipoContrapiso ? (a.areaM2 || 0) : 0), 0);
    const totalImperm = areas.reduce((s, a) => s + (a.impermeabilizacao ? (a.areaM2 || 0) : 0), 0);
    const totalRodape = areas.reduce((s, a) => s + (a.mlRodape || 0), 0);
    const nodesComVinculo = _contarNodesComVinculo(arvore);

    const porTipoPiso = {};
    areas.forEach(a => { const k = a.tipoPiso || '(sem tipo definido)'; porTipoPiso[k] = (porTipoPiso[k] || 0) + (a.areaM2 || 0); });
    const porTipoContrapiso = {};
    areas.forEach(a => { if (!a.tipoContrapiso) return; porTipoContrapiso[a.tipoContrapiso] = (porTipoContrapiso[a.tipoContrapiso] || 0) + (a.areaM2 || 0); });
    const porTipoImperm = {};
    areas.forEach(a => { if (!a.impermeabilizacao) return; const k = a.tipoImpermeabilizacao || '(tipo não informado)'; porTipoImperm[k] = (porTipoImperm[k] || 0) + (a.areaM2 || 0); });

    const linhasTabela = areas.slice().sort((a, b) => {
      const ca = _caminhoNode(a.nodeId) || '', cb = _caminhoNode(b.nodeId) || '';
      return ca === cb ? (a.nome || '').localeCompare(b.nome || '') : ca.localeCompare(cb);
    });

    const barras = (obj, cor) => {
      const entries = Object.entries(obj).sort((a, b) => b[1] - a[1]);
      if (!entries.length) return `<p class="text-sm" style="color:var(--cor-texto-muted);padding:4px 0;">Nenhum dado ainda.</p>`;
      const max = Math.max(...entries.map(e => e[1])) || 1;
      return entries.map(([k, v]) => `
        <div style="margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:4px;">
            <span>${esc(k)}</span><span style="font-family:var(--font-mono);font-weight:700;">${fmt2(v)} m²</span>
          </div>
          <div class="cc-barra"><span style="width:${(v / max * 100).toFixed(1)}%;background:${cor};"></span></div>
        </div>
      `).join('');
    };

    return `
      <div class="page-header">
        <div><h2 style="font-size:1.1rem;">📊 Visão Geral</h2>
          <span class="subtitulo">${totalAreas} área(s) medida(s) · ${nodesComVinculo} local(is) com planta vinculada</span></div>
      </div>

      <div class="cc-kpiGrid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr));">
        <div class="cc-kpi cc-kpiBlue"><div class="cc-kpiIcon">📐</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Total de Áreas</div><div class="cc-kpiValue">${totalAreas}</div></div></div>
        <div class="cc-kpi"><div class="cc-kpiIcon">▦</div><div class="cc-kpiBody"><div class="cc-kpiLabel">M² de Piso</div><div class="cc-kpiValue">${fmt2(totalPiso)}<span class="cc-kpiUnit">m²</span></div></div></div>
        <div class="cc-kpi cc-kpiOrange"><div class="cc-kpiIcon">▤</div><div class="cc-kpiBody"><div class="cc-kpiLabel">M² de Contrapiso</div><div class="cc-kpiValue">${fmt2(totalContrapiso)}<span class="cc-kpiUnit">m²</span></div></div></div>
        <div class="cc-kpi cc-kpiBlue"><div class="cc-kpiIcon">💧</div><div class="cc-kpiBody"><div class="cc-kpiLabel">M² Impermeabilização</div><div class="cc-kpiValue">${fmt2(totalImperm)}<span class="cc-kpiUnit">m²</span></div></div></div>
        <div class="cc-kpi cc-kpiPurple"><div class="cc-kpiIcon">🦶</div><div class="cc-kpiBody"><div class="cc-kpiLabel">ML de Rodapé</div><div class="cc-kpiValue">${fmt2(totalRodape)}<span class="cc-kpiUnit">m</span></div></div></div>
        <div class="cc-kpi cc-kpiGreen"><div class="cc-kpiIcon">📄</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Locais c/ Planta</div><div class="cc-kpiValue">${nodesComVinculo}</div></div></div>
      </div>

      ${totalAreas === 0 ? `<div class="lp-hint">Clique em um local na árvore ao lado (ou crie um novo com "+ Local") para vincular uma planta em PDF e começar a medir.</div>` : `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin:18px 0;">
          <div class="cc-kpi" style="display:block;">
            <strong style="display:block;margin-bottom:10px;font-size:0.85rem;">🧱 M² por Tipo de Piso</strong>
            ${barras(porTipoPiso, 'var(--cor-primaria)')}
          </div>
          <div class="cc-kpi" style="display:block;">
            <strong style="display:block;margin-bottom:10px;font-size:0.85rem;">🪨 M² por Tipo de Contrapiso</strong>
            ${barras(porTipoContrapiso, 'var(--cv-orange)')}
          </div>
          <div class="cc-kpi" style="display:block;">
            <strong style="display:block;margin-bottom:10px;font-size:0.85rem;">💧 M² por Tipo de Impermeabilização</strong>
            ${barras(porTipoImperm, 'var(--cv-blue)')}
          </div>
        </div>

        <h3 class="mb-2" style="font-size:0.95rem;">📋 Todas as Áreas Medidas</h3>
        <div class="tabela-container" style="margin-bottom:18px;">
          <table class="tabela">
            <thead>
              <tr>
                <th>Local</th>
                <th>Área</th>
                <th class="col-num">M² Piso</th>
                <th>Tipo de Piso</th>
                <th>Contrapiso</th>
                <th class="col-centro">Imperm.</th>
                <th class="col-num">ML Rodapé</th>
              </tr>
            </thead>
            <tbody>
              ${linhasTabela.map(a => `
                <tr style="cursor:pointer;" onclick="LP.focarArea('${a.nodeId}','${a.id}')">
                  <td style="color:var(--cor-texto-muted);">${esc(_caminhoNode(a.nodeId) || '—')}</td>
                  <td style="font-weight:600;">${esc(a.nome)}</td>
                  <td class="col-num">${fmt2(a.areaM2)} m²</td>
                  <td>${esc(a.tipoPiso || '—')}</td>
                  <td>${esc(a.tipoContrapiso || '—')}</td>
                  <td class="col-centro">${a.impermeabilizacao ? '💧' : '—'}</td>
                  <td class="col-num">${a.mlRodape ? fmt2(a.mlRodape) + ' m' : '—'}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="2">Total</td>
                <td class="col-num">${fmt2(totalPiso)} m²</td>
                <td colspan="2"></td>
                <td class="col-centro"></td>
                <td class="col-num">${fmt2(totalRodape)} m</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `}

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
    const totalPiso = areasN.reduce((s, a) => s + (a.areaM2 || 0), 0);
    const totalContrapiso = areasN.reduce((s, a) => s + (a.tipoContrapiso ? (a.areaM2 || 0) : 0), 0);
    const totalImperm = areasN.reduce((s, a) => s + (a.impermeabilizacao ? (a.areaM2 || 0) : 0), 0);
    const totalRodape = areasN.reduce((s, a) => s + (a.mlRodape || 0), 0);
    const pl = _plantaPorId(node.plantaId);

    setTimeout(_popularDatalists, 0);

    return `
      <div id="lp-workspace-wrap" class="${fsAtivo ? 'lp-fullscreen-overlay' : ''}">
        <div class="lp-workspace-header">
          <div><h2>${esc(node.nome)}</h2>
            <span class="subtitulo">${pl ? esc(pl.nome) : ''} — pág. ${node.pagina} · ${areasN.length} área(s) · ${fmt2(totalPiso)} m²</span></div>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-primario btn-sm" onclick="LP.toggleFullscreen()">${fsAtivo ? '✕ Sair da tela cheia' : '⛶ Tela cheia'}</button>
            ${fsAtivo ? '' : `<button class="btn btn-secundario btn-sm" onclick="LP.trocarPlanta('${node.id}')">🔄 Trocar planta/página</button>`}
            ${fsAtivo ? '' : `<button class="btn btn-secundario btn-sm" onclick="LP.abrirClonarPavimento('${node.id}')" title="Copiar as áreas deste local para outros (pavimento tipo)">⧉ Clonar/Multiplicar</button>`}
          </div>
        </div>
        <div class="lp-toolbar">
          <button class="btn btn-secundario btn-sm ${modo === 'calibrar' ? 'lp-modo-ativo' : ''}" onclick="LP.toggleModoCalibrar()">📏 Calibrar Escala</button>
          <button class="btn btn-secundario btn-sm ${modo === 'medir' ? 'lp-modo-ativo' : ''}" onclick="LP.toggleModoMedir()" ${temEscala ? '' : 'disabled title="Calibre a escala primeiro"'}>⬟ Nova Área</button>
          ${modo === 'medir' ? `
            <button class="btn btn-primario btn-sm" id="lp-btn-finalizar" onclick="LP.finalizarPoligono()">✓ Finalizar Área (${poligonoPontos.length} pontos)</button>
            <button class="btn btn-secundario btn-sm" onclick="LP.cancelarDesenho()">Cancelar</button>
          ` : ''}
          ${modo === 'calibrar' ? `<button class="btn btn-secundario btn-sm" onclick="LP.cancelarDesenho()">Cancelar</button>` : ''}
          ${modo === 'rodape' ? `
            <span class="info">🦶 Rodapé selecionado: <strong id="lp-rodape-ml">${fmt2(_calcularMlRodape(areaPoligonoPendente, poligonoRodapeSelecionado, node.escalaMetrosPorPonto || 0))} m</strong></span>
            <button class="btn btn-primario btn-sm" onclick="LP.confirmarRodape()">✓ Confirmar Rodapé</button>
            <button class="btn btn-secundario btn-sm" onclick="LP.cancelarRodape()">Cancelar</button>
          ` : ''}
          <div class="sep"></div>
          <button class="btn btn-secundario btn-sm" onclick="LP.zoomOut()" title="Diminuir zoom">➖</button>
          <button class="btn btn-secundario btn-sm" onclick="LP.zoomReset()" title="Redefinir zoom (100%)"><span id="lp-zoom-pct">100%</span></button>
          <button class="btn btn-secundario btn-sm" onclick="LP.zoomIn()" title="Aumentar zoom">➕</button>
          <div class="sep"></div>
          <span class="info">${temEscala ? `Escala: 1pt=${(node.escalaMetrosPorPonto * 1000).toFixed(2)}mm` : 'Sem escala'} · 🖱️ roda=zoom · meio=mover</span>
        </div>
        ${!temEscala ? `<div class="lp-hint">Clique em "📏 Calibrar Escala", desenhe uma linha sobre uma medida conhecida do desenho e informe a distância real.</div>` : ''}
        ${modo === 'medir' ? `<div class="lp-hint">Clique para adicionar vértices do polígono. Duplo-clique ou "Finalizar Área" para terminar.</div>` : ''}
        ${modo === 'calibrar' ? `<div class="lp-hint">Clique em dois pontos sobre uma medida conhecida do desenho.</div>` : ''}
        ${modo === 'rodape' ? `<div class="lp-hint">Clique nas paredes (linhas cinza) que têm rodapé — ficam roxas quando marcadas. Clique de novo pra desmarcar.</div>` : ''}
        <div class="lp-workspace">
          <div class="lp-canvas-col" id="lp-canvas-col"><div class="loading-inline">Carregando página do PDF...</div></div>
          <div class="lp-painel-lateral">
            <div class="lp-totais">
              <table>
                <tr><td>Total de áreas</td><td>${areasN.length}</td></tr>
                <tr><td>M² de Piso</td><td>${fmt2(totalPiso)} m²</td></tr>
                <tr><td>M² de Contrapiso</td><td>${fmt2(totalContrapiso)} m²</td></tr>
                <tr><td>M² de Impermeabilização</td><td>${fmt2(totalImperm)} m²</td></tr>
                <tr><td>ML de Rodapé</td><td>${fmt2(totalRodape)} m</td></tr>
              </table>
            </div>
            ${areasN.length > 0 ? `<input type="text" id="lp-busca-areas" class="form-control" placeholder="🔍 Filtrar áreas por nome ou tipo..." oninput="LP.filtrarAreas(this.value)" style="margin-bottom:2px;">` : ''}
            ${areasN.length > 0 ? `
              <div id="lp-bulk-areas-bar" style="display:none;flex-direction:column;gap:6px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:8px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <strong id="lp-bulk-areas-info" style="font-size:0.78rem;color:#1e40af;">0 selecionada(s)</strong>
                  <button type="button" class="btn btn-secundario btn-sm" onclick="LP.desmarcarTodasAreas()">Cancelar</button>
                </div>
                <select id="lp-bulk-destino-select" class="form-control" style="font-size:0.8rem;">
                  <option value="">Escolha o local de destino...</option>
                  ${_listarNodesMedicao().filter(o => o.id !== node.id).map(o => `<option value="${o.id}">${esc(o.label)}</option>`).join('')}
                </select>
                <div style="display:flex;gap:6px;">
                  <button type="button" class="btn btn-primario btn-sm" style="flex:1;" onclick="LP.moverOuCopiarSelecionadas('mover')">➜ Mover</button>
                  <button type="button" class="btn btn-secundario btn-sm" style="flex:1;" onclick="LP.moverOuCopiarSelecionadas('copiar')">⧉ Copiar</button>
                </div>
              </div>
              <label style="display:flex;align-items:center;gap:6px;font-size:0.76rem;color:var(--cor-texto-muted);cursor:pointer;">
                <input type="checkbox" onclick="LP.marcarTodasAreas(this.checked)"> Selecionar todas
              </label>
            ` : ''}
            ${areasN.length === 0 ? `<div class="estado-vazio" style="padding:20px;"><p style="font-size:0.85rem;">Nenhuma área medida ainda.</p></div>` : areasN.map(a => `
              <div class="lp-area-card ${a.id === areaDestacadaId ? 'lp-area-card-destaque' : ''}" data-busca="${esc((a.nome + ' ' + (a.tipoPiso || '') + ' ' + (a.tipoContrapiso || '')).toLowerCase())}" onclick="LP.editarArea('${a.id}')">
                <div style="display:flex;gap:8px;align-items:flex-start;">
                  <input type="checkbox" class="lp-area-check" data-id="${a.id}" onclick="event.stopPropagation();LP.atualizarBarraSelecaoAreas()" style="margin-top:3px;flex-shrink:0;">
                  <div style="flex:1;min-width:0;">
                    <div class="nome"><span>${esc(a.nome)}</span><span class="m2">${fmt2(a.areaM2)} m²</span></div>
                    <div class="meta">
                      ${a.tipoPiso ? `Piso: ${esc(a.tipoPiso)}` : 'Piso: —'}${a.tipoContrapiso ? ` · Contrapiso: ${esc(a.tipoContrapiso)}` : ''}
                      ${a.impermeabilizacao ? ` · 💧 Impermeabilizado${a.tipoImpermeabilizacao ? ' (' + esc(a.tipoImpermeabilizacao) + ')' : ''}` : ''}
                      ${a.mlRodape ? ` · 🦶 ${fmt2(a.mlRodape)}m rodapé` : ''}
                    </div>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  function marcarTodasAreas(marcar) {
    document.querySelectorAll('.lp-area-check').forEach(cb => { cb.checked = marcar; });
    atualizarBarraSelecaoAreas();
  }

  function desmarcarTodasAreas() {
    document.querySelectorAll('.lp-area-check').forEach(cb => { cb.checked = false; });
    atualizarBarraSelecaoAreas();
  }

  function atualizarBarraSelecaoAreas() {
    const marcadas = document.querySelectorAll('.lp-area-check:checked').length;
    const bar = document.getElementById('lp-bulk-areas-bar');
    if (bar) bar.style.display = marcadas > 0 ? 'flex' : 'none';
    const info = document.getElementById('lp-bulk-areas-info');
    if (info) info.textContent = `${marcadas} selecionada(s)`;
  }

  async function moverOuCopiarSelecionadas(acao) {
    const marcados = Array.from(document.querySelectorAll('.lp-area-check:checked')).map(cb => cb.getAttribute('data-id'));
    if (!marcados.length) { Utils.toast('Selecione pelo menos uma área.', 'alerta'); return; }
    const sel = document.getElementById('lp-bulk-destino-select');
    const destino = sel.value;
    if (!destino) { Utils.toast('Escolha o local de destino.', 'alerta'); return; }
    const destR = _acharNode(destino);
    const escalaDestino = destR ? (destR.node.escalaMetrosPorPonto || 0) : 0;
    const origemId = selNodeId;

    Utils.mostrarLoading(acao === 'copiar' ? 'Copiando áreas...' : 'Movendo áreas...');
    try {
      const ops = [];
      marcados.forEach(id => {
        const a = areas.find(x => x.id === id); if (!a) return;
        if (acao === 'mover') {
          ops.push({ type: 'update', ref: Database.ref(obraId, COL_AREAS).doc(id), data: { nodeId: destino } });
        } else {
          const { id: _aid, nodeId: _nid, ...rest } = a;
          const poligono = rest.poligono || [];
          const novaAreaM2 = escalaDestino ? _areaPoligono(poligono) * (escalaDestino ** 2) : rest.areaM2;
          const novoMlRodape = (rest.rodapeArestas && escalaDestino) ? _calcularMlRodape(poligono, rest.rodapeArestas, escalaDestino) : (rest.mlRodape || 0);
          ops.push({ type: 'set', ref: Database.ref(obraId, COL_AREAS).doc(), data: { ...rest, nodeId: destino, areaM2: novaAreaM2, mlRodape: novoMlRodape } });
        }
      });
      await Database.batchWrite(ops);
      Utils.toast(`✓ ${marcados.length} área(s) ${acao === 'copiar' ? 'copiadas' : 'movidas'}!`, 'sucesso');
      await carregar();
      selNode(acao === 'mover' ? destino : origemId);
    } catch (e) {
      console.error(e);
      Utils.toast('Erro: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  function filtrarAreas(termo) {
    const t = (termo || '').toLowerCase().trim();
    document.querySelectorAll('.lp-area-card').forEach(card => {
      const alvo = card.getAttribute('data-busca') || '';
      card.style.display = (!t || alvo.includes(t)) ? '' : 'none';
    });
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
  let _panRafPendente = false;
  let _panUltimoEvento = null;
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
    // Throttle via requestAnimationFrame — evita recalcular o scroll a cada
    // pointermove (que pode disparar muito mais rápido que a tela consegue
    // pintar, principalmente com o canvas em resolução alta de zoom).
    _panUltimoEvento = e;
    if (_panRafPendente) return;
    _panRafPendente = true;
    requestAnimationFrame(() => {
      _panRafPendente = false;
      if (!panAtivo || !_panUltimoEvento) return;
      const col = document.getElementById('lp-canvas-col');
      col.scrollLeft = panInicio.scrollX - (_panUltimoEvento.clientX - panInicio.x);
      col.scrollTop = panInicio.scrollY - (_panUltimoEvento.clientY - panInicio.y);
    });
  }
  function _finalizarPan(e) {
    if (!panAtivo) return;
    panAtivo = false;
    _panUltimoEvento = null;
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
    zoomCss = Math.min(6, Math.max(0.15, zoomCss * fator));
    _aplicarZoom();
    const ratio = zoomCss / oldZoom;
    col.scrollLeft = mouseX * ratio - (e.clientX - rect.left);
    col.scrollTop = mouseY * ratio - (e.clientY - rect.top);
    _agendarRerenderQualidade();
  }

  function zoomIn() { zoomCss = Math.min(6, zoomCss * 1.25); _aplicarZoom(); _agendarRerenderQualidade(); }
  function zoomOut() { zoomCss = Math.max(0.15, zoomCss / 1.25); _aplicarZoom(); _agendarRerenderQualidade(); }
  function zoomReset() { zoomCss = 1; _aplicarZoom(); }

  // ── QUALIDADE NO ZOOM — o zoom acima é só CSS (rápido, mas perde nitidez ao
  // ampliar muito). Depois de um instante sem mexer no zoom, re-renderiza o
  // PDF em resolução mais alta (na escala efetiva atual) e "dobra" o zoom CSS
  // de volta pra 1 base, mantendo o tamanho em tela igual — sem re-renderizar
  // a cada tique da roda do mouse (custaria caro).
  let _reRenderTimer = null;
  function _agendarRerenderQualidade() {
    if (!selNodeId) return;
    clearTimeout(_reRenderTimer);
    _reRenderTimer = setTimeout(() => {
      const r = _acharNode(selNodeId);
      if (r && r.node.plantaId) _rerenderizarEmAltaResolucao(r.node);
    }, 300);
  }

  async function _rerenderizarEmAltaResolucao(node) {
    const stage = document.querySelector('#lp-canvas-col .lp-canvas-stage');
    if (!stage) return;
    const canvas = stage.querySelector('canvas.lp-base');
    const svg = stage.querySelector('svg.lp-svg-overlay');
    if (!canvas || !svg) return;
    const efetiva = renderScale * zoomCss;
    if (efetiva <= renderScale * 1.05) return; // já está nítido o bastante nesta resolução
    let novaEscala = Math.min(6, efetiva); // limite de segurança pra não estourar memória
    const MAX_DIM_PX = 4096; // canvas muito grande fica pesado pra arrastar (scroll)/pintar
    const projLargura = pageWidthPts * novaEscala;
    if (projLargura > MAX_DIM_PX) novaEscala = MAX_DIM_PX / pageWidthPts;
    const pl = _plantaPorId(node.plantaId);
    if (!pl || !pdfDoc || pdfDocPlantaId !== pl.id) return;
    try {
      const page = await pdfDoc.getPage(node.pagina);
      const viewport = page.getViewport({ scale: novaEscala });
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport }).promise;
      svg.setAttribute('width', viewport.width);
      svg.setAttribute('height', viewport.height);
      svg.setAttribute('viewBox', '0 0 ' + viewport.width + ' ' + viewport.height);
      zoomCss = zoomCss * (renderScale / novaEscala);
      renderScale = novaEscala;
      _aplicarZoom();
      _desenharOverlay(node);
    } catch (e) {
      console.error('Erro ao re-renderizar em alta resolução:', e);
    }
  }

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
    if (modo === 'rodape') { cancelarRodape(); return; }
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
    areaNodeIdPendente = r.node.id; // capturado aqui, não relido depois
    areaPoligonoPendente = poligonoPontos.slice();
    areaM2Pendente = _areaPoligono(areaPoligonoPendente) * (r.node.escalaMetrosPorPonto ** 2);
    areaEditId = null;
    _rodapeEditandoAreaId = null;
    poligonoRodapeSelecionado = new Array(areaPoligonoPendente.length).fill(false);
    poligonoPontos = [];
    modo = 'rodape';
    renderizar();
  }

  // Alterna se a aresta i (entre o vértice i e o próximo) tem rodapé
  function toggleRodapeEdge(i) {
    poligonoRodapeSelecionado[i] = !poligonoRodapeSelecionado[i];
    _redesenharTemp();
    const r = _acharNode(selNodeId);
    const ml = _calcularMlRodape(areaPoligonoPendente, poligonoRodapeSelecionado, r ? (r.node.escalaMetrosPorPonto || 0) : 0);
    const el = document.getElementById('lp-rodape-ml');
    if (el) el.textContent = fmt2(ml) + ' m';
  }

  function _calcularMlRodape(poligono, selecionado, escalaMetrosPorPonto) {
    let total = 0;
    for (let i = 0; i < poligono.length; i++) {
      if (!selecionado[i]) continue;
      const p1 = poligono[i], p2 = poligono[(i + 1) % poligono.length];
      total += Math.hypot(p2.x - p1.x, p2.y - p1.y) * escalaMetrosPorPonto;
    }
    return total;
  }

  function _atualizarMlRodapeDisplay(escalaMetrosPorPonto) {
    // (mantida por compatibilidade — a atualização em tempo real é feita direto em toggleRodapeEdge)
    const ml = _calcularMlRodape(areaPoligonoPendente, poligonoRodapeSelecionado, escalaMetrosPorPonto);
    const el = document.getElementById('lp-rodape-ml');
    if (el) el.textContent = fmt2(ml) + ' m';
    return ml;
  }

  function cancelarRodape() {
    modo = 'nenhum'; areaPoligonoPendente = null; poligonoRodapeSelecionado = []; _rodapeEditandoAreaId = null;
    renderizar();
  }

  function confirmarRodape() {
    let escala = 0;
    if (_rodapeEditandoAreaId) {
      const areaAtual = areas.find(x => x.id === _rodapeEditandoAreaId);
      const rNode = areaAtual ? _acharNode(areaAtual.nodeId) : null;
      escala = rNode ? (rNode.node.escalaMetrosPorPonto || 0) : 0;
    } else {
      const rNode = _acharNode(areaNodeIdPendente);
      escala = rNode ? (rNode.node.escalaMetrosPorPonto || 0) : 0;
    }
    const ml = _calcularMlRodape(areaPoligonoPendente, poligonoRodapeSelecionado, escala);
    if (_rodapeEditandoAreaId) {
      _salvarRodapeDireto(_rodapeEditandoAreaId, poligonoRodapeSelecionado.slice(), ml);
      return;
    }
    rodapeArestasPendente = poligonoRodapeSelecionado.slice();
    mlRodapePendente = ml;
    modo = 'nenhum';
    document.getElementById('lp-area-titulo').textContent = 'Nova Área';
    Utils.limparForm('form-lp-area');
    document.getElementById('lp-area-m2-display').value = fmt2(areaM2Pendente);
    document.getElementById('lp-area-ml-rodape-display').value = fmt2(mlRodapePendente) + ' m';
    document.getElementById('lp-campo-imperm-tipo').style.display = 'none';
    document.getElementById('lp-btn-excluir-area').style.display = 'none';
    document.getElementById('lp-btn-editar-rodape').style.display = 'none';
    document.getElementById('lp-campo-mover').style.display = 'none';
    Utils.abrirModal('modal-lp-area');
    renderizar();
  }

  async function _salvarRodapeDireto(areaId, rodapeArestas, mlRodape) {
    Utils.mostrarLoading('Salvando rodapé...');
    try {
      await Database.atualizar(obraId, COL_AREAS, areaId, { rodapeArestas, mlRodape });
      Utils.toast('Rodapé atualizado!', 'sucesso');
      modo = 'nenhum'; areaPoligonoPendente = null; poligonoRodapeSelecionado = []; _rodapeEditandoAreaId = null;
      await carregar();
      selNode(selNodeId);
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao salvar rodapé: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // Reabre o modo de seleção de rodapé para uma área já salva
  function iniciarEdicaoRodape(areaId) {
    const a = areas.find(x => x.id === areaId); if (!a || !a.poligono) return;
    Utils.fecharModal('modal-lp-area');
    areaPoligonoPendente = a.poligono;
    poligonoRodapeSelecionado = a.rodapeArestas && a.rodapeArestas.length === a.poligono.length
      ? a.rodapeArestas.slice()
      : new Array(a.poligono.length).fill(false);
    _rodapeEditandoAreaId = areaId;
    areaEditId = null;
    modo = 'rodape';
    renderizar();
  }

  function editarArea(id) {
    const a = areas.find(x => x.id === id); if (!a) return;
    areaEditId = id;
    areaPoligonoPendente = null;
    document.getElementById('lp-area-titulo').textContent = 'Editar Área';
    Utils.setFormData('form-lp-area', a);
    document.getElementById('lp-area-m2-display').value = fmt2(a.areaM2);
    document.getElementById('lp-area-ml-rodape-display').value = fmt2(a.mlRodape || 0) + ' m';
    document.getElementById('lp-campo-imperm-tipo').style.display = a.impermeabilizacao ? '' : 'none';
    document.getElementById('lp-btn-excluir-area').style.display = '';
    document.getElementById('lp-btn-editar-rodape').style.display = '';
    document.getElementById('lp-btn-editar-rodape').setAttribute('onclick', `LP.iniciarEdicaoRodape('${id}')`);
    const selMover = document.getElementById('lp-area-mover-select');
    const locais = _listarNodesMedicao().filter(n => n.id !== a.nodeId);
    selMover.innerHTML = locais.length
      ? `<option value="">Selecione...</option>` + locais.map(n => `<option value="${n.id}">${esc(n.label)}</option>`).join('')
      : `<option value="">Nenhum outro local com planta vinculada</option>`;
    document.getElementById('lp-campo-mover').style.display = '';
    Utils.abrirModal('modal-lp-area');
  }

  async function moverArea() {
    if (!areaEditId) return;
    const sel = document.getElementById('lp-area-mover-select');
    const novoNodeId = sel.value;
    if (!novoNodeId) { Utils.toast('Escolha o local de destino.', 'alerta'); return; }
    Utils.mostrarLoading('Movendo área...');
    try {
      await Database.atualizar(obraId, COL_AREAS, areaEditId, { nodeId: novoNodeId });
      Utils.fecharModal('modal-lp-area');
      Utils.toast('Área movida!', 'sucesso');
      areaEditId = null;
      await carregar();
      selNode(novoNodeId);
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao mover: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ══════════════════════════════════════════
  // CLONAR/MULTIPLICAR PAVIMENTO — copia todas as áreas medidas deste local
  // para um ou vários outros locais de uma vez (útil pra pavimento tipo
  // repetido em vários andares da torre).
  // ══════════════════════════════════════════
  let clonarOrigemId = null;

  function abrirClonarPavimento(nodeId) {
    const origem = _acharNode(nodeId); if (!origem) return;
    clonarOrigemId = nodeId;
    const opts = _listarNodesMedicao().filter(o => o.id !== nodeId);
    document.getElementById('lp-clonar-titulo').textContent = `Clonar/Multiplicar "${origem.node.nome}"`;
    const lista = document.getElementById('lp-clonar-lista');
    lista.innerHTML = opts.length
      ? opts.map(o => `
          <label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;cursor:pointer;">
            <input type="checkbox" class="lp-clonar-check" value="${o.id}">
            <span>${esc(o.label)}</span>
            <span style="margin-left:auto;color:var(--cor-texto-muted);font-size:0.75rem;">${_areasDoNode(o.id).length} área(s) hoje</span>
          </label>
        `).join('')
      : `<p class="text-sm" style="color:var(--cor-texto-muted);">Nenhum outro local com planta vinculada ainda. Crie e vincule outros locais primeiro.</p>`;
    Utils.abrirModal('modal-lp-clonar');
  }

  function marcarTodosClonar(marcar) {
    document.querySelectorAll('.lp-clonar-check').forEach(cb => { cb.checked = marcar; });
  }

  async function confirmarClonarPavimento() {
    const alvoIds = Array.from(document.querySelectorAll('.lp-clonar-check:checked')).map(cb => cb.value);
    if (!alvoIds.length) { Utils.toast('Marque pelo menos um local de destino.', 'alerta'); return; }
    const origemR = _acharNode(clonarOrigemId); if (!origemR) return;
    const areasOrigem = _areasDoNode(clonarOrigemId);
    if (!areasOrigem.length) { Utils.toast('Este local ainda não tem áreas medidas para clonar.', 'alerta'); return; }

    const comDadosExistentes = alvoIds.filter(id => _areasDoNode(id).length > 0);
    if (comDadosExistentes.length) {
      const nomes = comDadosExistentes.map(id => { const r = _acharNode(id); return r ? r.node.nome : id; }).join(', ');
      const ok = await Utils.confirmar(`${nomes} já ${comDadosExistentes.length > 1 ? 'têm' : 'tem'} áreas medidas. Elas serão substituídas pelas áreas clonadas de "${origemR.node.nome}". Continuar?`);
      if (!ok) return;
    }

    Utils.fecharModal('modal-lp-clonar');
    Utils.mostrarLoading('Clonando pavimento...');
    try {
      // Remove o que já existir nos destinos marcados
      const delOps = [];
      alvoIds.forEach(id => { _areasDoNode(id).forEach(a => delOps.push({ type: 'delete', ref: Database.ref(obraId, COL_AREAS).doc(a.id) })); });
      for (let i = 0; i < delOps.length; i += 400) await Database.batchWrite(delOps.slice(i, i + 400));

      // Clona as áreas da origem pra cada destino, recalculando m²/ML pela escala de cada destino
      // (a geometria do polígono é a mesma; só a escala pode mudar entre locais)
      const addOps = [];
      alvoIds.forEach(alvoId => {
        const alvoR = _acharNode(alvoId);
        const escalaAlvo = alvoR ? (alvoR.node.escalaMetrosPorPonto || 0) : 0;
        areasOrigem.forEach(a => {
          const { id: _aid, nodeId: _nid, ...rest } = a;
          const poligono = rest.poligono || [];
          const novaAreaM2 = escalaAlvo ? _areaPoligono(poligono) * (escalaAlvo ** 2) : rest.areaM2;
          const novoMlRodape = (rest.rodapeArestas && escalaAlvo) ? _calcularMlRodape(poligono, rest.rodapeArestas, escalaAlvo) : (rest.mlRodape || 0);
          addOps.push({ type: 'set', ref: Database.ref(obraId, COL_AREAS).doc(), data: { ...rest, nodeId: alvoId, areaM2: novaAreaM2, mlRodape: novoMlRodape } });
        });
      });
      for (let i = 0; i < addOps.length; i += 400) await Database.batchWrite(addOps.slice(i, i + 400));

      Utils.toast(`✓ ${areasOrigem.length} área(s) clonadas para ${alvoIds.length} local(is)!`, 'sucesso');
      await carregar();
      selNode(clonarOrigemId);
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao clonar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  function onToggleImperm(chk) {
    document.getElementById('lp-campo-imperm-tipo').style.display = chk.checked ? '' : 'none';
  }

  function fecharModalArea() {
    Utils.fecharModal('modal-lp-area');
    if (areaEditId === null) {
      poligonoPontos = []; modo = 'nenhum'; areaPoligonoPendente = null;
      rodapeArestasPendente = null; mlRodapePendente = 0; poligonoRodapeSelecionado = [];
      renderizar();
    }
  }

  async function salvarArea() {
    const data = Utils.getFormData('form-lp-area');
    if (!data.nome) { Utils.toast('Informe o nome da área.', 'alerta'); return; }
    if (!data.impermeabilizacao) data.tipoImpermeabilizacao = '';

    const nodeIdDestino = areaEditId ? null : (areaNodeIdPendente || selNodeId);

    Utils.mostrarLoading('Salvando área...');
    try {
      if (areaEditId) {
        await Database.atualizar(obraId, COL_AREAS, areaEditId, data);
      } else {
        data.nodeId = nodeIdDestino;
        data.poligono = areaPoligonoPendente;
        data.areaM2 = areaM2Pendente;
        data.rodapeArestas = rodapeArestasPendente || [];
        data.mlRodape = mlRodapePendente || 0;
        await Database.criar(obraId, COL_AREAS, data);
      }
      Utils.fecharModal('modal-lp-area');
      Utils.toast('Área salva!', 'sucesso');
      const irParaNode = areaEditId ? selNodeId : nodeIdDestino;
      poligonoPontos = []; modo = 'nenhum'; areaPoligonoPendente = null; areaEditId = null;
      areaNodeIdPendente = null;
      rodapeArestasPendente = null; mlRodapePendente = 0; poligonoRodapeSelecionado = [];
      await carregar();
      selNode(irParaNode);
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
      const isDestaque = a.id === areaDestacadaId;
      const corTraco = isDestaque ? '#f59e0b' : '#2563eb';
      const largTraco = isDestaque ? 3 : 1.5;
      h += `<polygon points="${_ptsAttr(a.poligono)}" fill="${isDestaque ? 'rgba(245,158,11,0.22)' : (isEdit ? 'rgba(37,99,235,0.28)' : 'rgba(37,99,235,0.14)')}" stroke="${corTraco}" stroke-width="${largTraco}"/>`;
      // Trechos com rodapé — traço grosso por cima da(s) parede(s) marcada(s)
      if (a.rodapeArestas && a.rodapeArestas.length === a.poligono.length) {
        for (let i = 0; i < a.poligono.length; i++) {
          if (!a.rodapeArestas[i]) continue;
          const p1 = a.poligono[i], p2 = a.poligono[(i + 1) % a.poligono.length];
          h += `<line x1="${p1.x * renderScale}" y1="${p1.y * renderScale}" x2="${p2.x * renderScale}" y2="${p2.y * renderScale}" stroke="#7c3aed" stroke-width="4" stroke-linecap="round"/>`;
        }
      }
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
    if (modo === 'rodape' && areaPoligonoPendente && areaPoligonoPendente.length) {
      extra += `<polygon points="${_ptsAttr(areaPoligonoPendente)}" fill="rgba(124,58,237,0.08)" stroke="#c4b5fd" stroke-width="1"/>`;
      for (let i = 0; i < areaPoligonoPendente.length; i++) {
        const sel = !!poligonoRodapeSelecionado[i];
        const p1 = areaPoligonoPendente[i], p2 = areaPoligonoPendente[(i + 1) % areaPoligonoPendente.length];
        extra += `<line x1="${p1.x * renderScale}" y1="${p1.y * renderScale}" x2="${p2.x * renderScale}" y2="${p2.y * renderScale}" `
          + `stroke="${sel ? '#7c3aed' : '#94a3b8'}" stroke-width="${sel ? 7 : 4}" stroke-linecap="round" `
          + `style="pointer-events:auto;cursor:pointer;" onclick="LP.toggleRodapeEdge(${i})"/>`;
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
    novoNode, renomearNode, excluirNode, toggleNode, selNode, selGeral, toggleArvore, toggleFullscreen,
    focarArea,
    abrirModalPlanta, enviarPlanta, excluirPlanta, vincularPlantaExistente, trocarPlanta,
    toggleModoCalibrar, toggleModoMedir, cancelarDesenho,
    cancelarCalibracao, confirmarCalibracao,
    finalizarPoligono, editarArea, onToggleImperm, fecharModalArea, salvarArea, excluirAreaEmEdicao, moverArea,
    filtrarAreas, abrirClonarPavimento, marcarTodosClonar, confirmarClonarPavimento,
    marcarTodasAreas, desmarcarTodasAreas, atualizarBarraSelecaoAreas, moverOuCopiarSelecionadas,
    toggleRodapeEdge, cancelarRodape, confirmarRodape, iniciarEdicaoRodape,
    zoomIn, zoomOut, zoomReset,
  };
})();

function onObraChanged() {
  if (typeof LP !== 'undefined') LP.recarregar();
}

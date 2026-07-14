// ============================================
// Módulo: Levantamento de Teto
//
// Mesmo formato de menu do Levantamento de Paredes: árvore de locais
// ilimitada em profundidade (ex: Torre > Andar > Apto > Cômodo).
// A diferença é que, em vez de lançar as peças manualmente, cada NÓ
// da árvore pode ter uma PÁGINA DE PDF vinculada — e a partir dela:
//
//  1) CALIBRA-SE a escala (desenha uma linha sobre uma medida
//     conhecida do desenho e informa a distância real em metros)
//  2) MEDE-SE as áreas de teto desenhando polígonos direto sobre a
//     página do PDF — cada polígono vira uma Área com m², tipo de
//     Drywall, tipo de Placa de Gesso e Pintura (mistura de cores por %,
//     mesmo modelo do Levantamento de Paredes — Acabamento)
//
// As páginas de PDF ficam numa biblioteca de "Plantas" (reaproveitável
// entre vários nós — ex: a mesma planta arquitetônica, mas cada nó usa
// a página correspondente ao seu pavimento/ambiente).
//
// Coordenadas de calibração e polígonos são guardadas em espaço
// "ponto-PDF" (viewport scale=1), independente do zoom de renderização
// em tela — a escala nunca se perde ao redimensionar.
//
// Dados: obras/{obraId}/config/tetoArvore   (árvore + vínculo de PDF por nó)
//        obras/{obraId}/tetoPlantas          (biblioteca de PDFs enviados)
//        obras/{obraId}/tetoAreas            (áreas medidas, por nodeId)
// ============================================

const LT = (() => {
  const COL_PLANTAS = 'tetoPlantas';
  const COL_AREAS = 'tetoAreas';
  const CONFIG_DOC = 'tetoArvore';

  let obraId = null;
  let arvore = [];      // [{id,nome,filhos:[...], plantaId, pagina, escalaMetrosPorPonto, linhaCalibracao}]
  let plantas = [];     // biblioteca de PDFs enviados (tetoPlantas)
  let areas = [];        // todas as áreas medidas (tetoAreas)
  let openNodes = new Set();
  let selNodeId = null;  // null = Visão Geral
  let treeColapsada = false;
  let visaoGeralFiltroNodeId = null; // filtro de nível na Visão Geral (null = toda a obra)

  let pdfDoc = null;         // documento pdf.js carregado (da planta do nó aberto)
  let pdfDocPlantaId = null;
  let renderScale = 1;        // px de tela por ponto-PDF, na renderização atual
  let _renderToken = 0;       // evita corrida: se uma renderização mais nova começar, a antiga
                               // aborta em vez de terminar e bagunçar o renderScale compartilhado

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
  let tabicaArestasPendente = null; // seleção de arestas com tabica (nova área) aguardando salvar
  let mlTabicaPendente = 0;
  let poligonoTabicaSelecionado = []; // seleção em progresso (modo 'tabica'), array de booleans por aresta
  let _tabicaEditandoAreaId = null;   // se setado, o modo 'tabica' está editando o tabica de uma área já salva
  let pinturaAreaForm = [];        // mistura de cores de pintura (mesmo modelo do Levantamento
                                    // de Paredes — Acabamento), em edição no modal Nova/Editar Área
  let areaDestacadaId = null;      // área destacada temporariamente (ao focar pela árvore)
  let areasSelecionadasParaMover = new Set(); // ids marcados p/ mover/copiar — guardado à parte
                                               // (não só no DOM) pra não se perder se a árvore
                                               // redesenhar por qualquer motivo (ex: clique errado)
  let _destacarTimer = null;

  let _pendingVincularNodeId = null; // para qual nó o upload do modal-lt-planta se destina

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
    selNodeId = null; modo = 'nenhum'; areasSelecionadasParaMover.clear(); visaoGeralFiltroNodeId = null;
    if (!obraId) { _renderSemObra(); return; }
    await carregar();
  }

  function _renderSemObra() {
    const el = document.getElementById('lt-content');
    if (el) el.innerHTML = `<div class="estado-vazio"><div class="icone">🧩</div><p>Selecione uma obra na barra lateral.</p></div>`;
  }

  let _openNodesInicializado = false;
  function _todosNodeIds(nodes, out = []) {
    nodes.forEach(n => { out.push(n.id); _todosNodeIds(n.filhos || [], out); });
    return out;
  }

  async function carregar() {
    Utils.mostrarLoading('Carregando levantamento de teto...');
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
      console.error('Erro ao carregar levantamento de teto:', e);
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

  // Lista achatada de TODOS os locais (com ou sem planta vinculada), com
  // caminho completo (ex: "Torre › 1º Pavimento › Apartamento 1") — usada
  // nos seletores de mover/copiar/clonar áreas. Mover não exige planta no
  // destino; copiar/clonar só recalcula m²/tabica se o destino tiver escala
  // (senão mantém os valores originais, sem quebrar nada).
  function _listarNodesMedicao(nodes = arvore, caminho = []) {
    let out = [];
    _ordenarNodes(nodes).forEach(n => {
      const novoCaminho = [...caminho, n.nome];
      out.push({ id: n.id, label: novoCaminho.join(' › ') + (n.plantaId ? '' : ' (sem planta)') });
      out = out.concat(_listarNodesMedicao(n.filhos || [], novoCaminho));
    });
    return out;
  }

  // ══════════════════════════════════════════
  // RENDER PRINCIPAL
  // ══════════════════════════════════════════
  function renderizar() {
    const el = document.getElementById('lt-content');
    const actions = document.getElementById('lt-header-actions');
    if (!el) return;
    // Substituir o innerHTML abaixo destrói e recria os elementos — se o
    // elemento clicado (ex: botão "Nova Área", "Editar Tabica") estava com
    // foco, o navegador pode jogar o scroll do container pai lá pra cima
    // ao perder o foco. Guardamos e restauramos o scroll pra não pular.
    const scrollEl = document.querySelector('.content');
    const scrollTopAntes = scrollEl ? scrollEl.scrollTop : 0;
    if (actions) actions.innerHTML = '';
    const nodeAtual = selNodeId ? _acharNode(selNodeId) : null;
    const emWorkspace = !!(nodeAtual && nodeAtual.node.plantaId);
    el.innerHTML = `
      ${!selNodeId ? `
        <div class="page-header">
          <div>
            <h2>🧩 Levantamento de Teto</h2>
            <span class="subtitulo">${areas.length} área(s) medida(s) · ${fmt2(areas.reduce((s, a) => s + (a.areaM2 || 0), 0))} m²</span>
          </div>
        </div>
      ` : ''}
      <div class="ar-layout ${treeColapsada ? 'tree-colapsada' : ''} ${emWorkspace ? 'lt-workspace-ativo' : ''}">
        <div class="fachada-tree">
          <div class="fachada-tree-header">
            <h3>Locais</h3>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-secundario btn-sm" onclick="LT.marcarTodasAreas(true)" title="Selecionar todas as áreas visíveis (pra mover/copiar em lote)">☑</button>
              <button class="btn btn-secundario btn-sm" onclick="LT.toggleArvore()" title="Recolher árvore">⏴</button>
              <button class="btn btn-primario btn-sm" onclick="LT.novoNode(null)">+ Local</button>
            </div>
          </div>
          <div id="lt-bulk-areas-bar" style="display:none;flex-direction:column;gap:6px;background:rgba(37,99,235,0.18);border-bottom:1px solid rgba(191,219,254,0.25);padding:8px 10px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong id="lt-bulk-areas-info" style="font-size:0.74rem;color:#bfdbfe;">0 selecionada(s)</strong>
              <button type="button" class="btn btn-secundario btn-sm" onclick="LT.desmarcarTodasAreas()">✕</button>
            </div>
            <select id="lt-bulk-destino-select" class="form-control" style="font-size:0.76rem;padding:5px 6px;">
              <option value="">Escolha o local de destino...</option>
              ${_listarNodesMedicao().map(o => `<option value="${o.id}">${esc(o.label)}</option>`).join('')}
            </select>
            <div style="display:flex;gap:6px;">
              <button type="button" class="btn btn-primario btn-sm" style="flex:1;" onclick="LT.moverOuCopiarSelecionadas('mover')">➜ Mover</button>
              <button type="button" class="btn btn-secundario btn-sm" style="flex:1;" onclick="LT.moverOuCopiarSelecionadas('copiar')">⧉ Copiar</button>
            </div>
          </div>
          <div class="fachada-tree-body" id="lt-tree-body">${_renderArvore()}</div>
        </div>
        <div class="ar-painel" id="lt-painel">
          ${treeColapsada ? `<div style="margin-bottom:10px;"><button class="btn btn-secundario btn-sm" onclick="LT.toggleArvore()" title="Mostrar árvore de locais">☰ Locais</button></div>` : ''}
          ${_renderPainel()}
        </div>
      </div>
    `;
    if (selNodeId) {
      const r = _acharNode(selNodeId);
      if (r && r.node.plantaId) _renderCanvasNode(r.node);
    }
    if (scrollEl) {
      scrollEl.scrollTop = scrollTopAntes;
      requestAnimationFrame(() => { scrollEl.scrollTop = scrollTopAntes; });
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
    const col = document.getElementById('lt-canvas-col');
    const stage = document.querySelector('#lt-canvas-col .lt-canvas-stage');
    const canvas = stage && stage.querySelector('canvas.lt-base');
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
      let h = `<div class="tree-item${ativo ? ' ativo' : ''}" onclick="LT.selNode('${n.id}')" title="${esc(n.nome)}">
        <span class="tree-toggle" onclick="event.stopPropagation();LT.toggleNode('${n.id}')">${temExpandir ? (aberto ? '▼' : '▶') : ''}</span>
        <span class="tree-icon">${n.plantaId ? '📄' : '📍'}</span>
        <span class="tree-label">${esc(n.nome)}</span>
        ${nAreas ? `<span class="tree-badge">${nAreas}</span>` : ''}
        ${n.plantaId ? `<button class="tree-clone-btn" onclick="event.stopPropagation();LT.abrirClonarPavimento('${n.id}')" title="Clonar/Multiplicar as áreas deste local para outros">⧉</button>` : ''}
        <button class="tree-edit-btn" onclick="event.stopPropagation();LT.renomearNode('${n.id}')" title="Renomear">✎</button>
        <button class="tree-del-btn" onclick="event.stopPropagation();LT.excluirNode('${n.id}')" title="Excluir">✕</button>
      </div>`;
      if (aberto) {
        // Áreas medidas diretamente neste local — atrás do mesmo collapse do nó
        // (clique na seta/local minimiza só isso, sem precisar fechar o pai).
        if (areasDoNo.length) {
          h += `<div class="tree-children tree-children-areas">`;
          areasDoNo.forEach(a => {
            h += `<div class="tree-item tree-item-area" onclick="event.stopPropagation();LT.focarArea('${n.id}','${a.id}')" title="Ver esta área na planta">
              <span onclick="event.stopPropagation();LT.toggleSelecaoArea('${a.id}')" style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;flex-shrink:0;cursor:pointer;margin-left:-4px;">
                <input type="checkbox" class="lt-area-check" data-id="${a.id}" ${areasSelecionadasParaMover.has(a.id) ? 'checked' : ''} style="width:15px;height:15px;pointer-events:none;">
              </span>
              <span class="tree-icon" style="color:#2563eb;">▪</span>
              <span class="tree-label">${esc(a.nome)}</span>
              <span class="tree-badge tree-badge-area">${fmt2(a.areaM2)}m²</span>
            </div>`;
          });
          h += `</div>`;
        }
        h += `<div class="tree-children">`;
        h += _renderArvoreNivel(n.filhos || []);
        h += `<div class="ar-add-inline" onclick="event.stopPropagation();LT.novoNode('${n.id}')">+ adicionar sublocal</div>`;
        h += `</div>`;
      }
      return h;
    }).join('');
  }

  function _renderArvore() {
    let h = `<div class="tree-item${!selNodeId ? ' ativo' : ''}" onclick="LT.selGeral()">
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
    const treeBody = document.getElementById('lt-tree-body');
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
    const sublocais = [];
    (function coletar(n) { (n.filhos || []).forEach(f => { sublocais.push(f); coletar(f); }); })(r.node);

    let msg = `Excluir "${r.node.nome}"?`;
    if (sublocais.length) {
      msg += `\n\n⚠️ Isso também vai excluir os sublocais dentro dele:\n` +
        sublocais.map(s => `• ${s.nome} (${_areasDoNode(s.id).length} área(s))`).join('\n');
    }
    if (areasParaExcluir.length) {
      msg += `\n\nNo total, ${areasParaExcluir.length} área(s) medida(s) serão apagadas (contando "${r.node.nome}" e os sublocais acima).`;
    }
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
    const filtroR = visaoGeralFiltroNodeId ? _acharNode(visaoGeralFiltroNodeId) : null;
    const areasFiltradas = filtroR
      ? areas.filter(a => _idsComDescendentes(filtroR.node).includes(a.nodeId))
      : areas;

    const totalAreas = areasFiltradas.length;
    const totalTeto = areasFiltradas.reduce((s, a) => s + (a.areaM2 || 0), 0);
    const totalDryWall = areasFiltradas.reduce((s, a) => s + (a.tipoDryWall ? (a.areaM2 || 0) : 0), 0);
    const totalPlacaGesso = areasFiltradas.reduce((s, a) => s + (a.tipoPlacaGesso ? (a.areaM2 || 0) : 0), 0);
    const totalPintura = areasFiltradas.reduce((s, a) => s + (a.temPintura ? (a.areaM2 || 0) : 0), 0);
    const totalTabica = areasFiltradas.reduce((s, a) => s + (a.mlTabica || 0), 0);
    const nodesComVinculo = _contarNodesComVinculo(arvore);

    const porTipoDryWall = {};
    areasFiltradas.forEach(a => { if (!a.tipoDryWall) return; porTipoDryWall[a.tipoDryWall] = (porTipoDryWall[a.tipoDryWall] || 0) + (a.areaM2 || 0); });
    const porTipoPlacaGesso = {};
    areasFiltradas.forEach(a => { if (!a.tipoPlacaGesso) return; porTipoPlacaGesso[a.tipoPlacaGesso] = (porTipoPlacaGesso[a.tipoPlacaGesso] || 0) + (a.areaM2 || 0); });
    const porCorPintura = {};
    areasFiltradas.forEach(a => {
      if (!a.temPintura || !a.pintura) return;
      a.pintura.forEach(pt => {
        const k = pt.cor || '(sem nome)';
        porCorPintura[k] = (porCorPintura[k] || 0) + (a.areaM2 || 0) * (num(pt.pct) / 100);
      });
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
          <span class="subtitulo">${areas.length} área(s) medida(s) no total · ${nodesComVinculo} local(is) com planta vinculada</span></div>
      </div>

      <div class="form-grupo" style="max-width:420px;margin-bottom:14px;">
        <label style="font-size:0.8rem;">Ver dados de:</label>
        <select class="form-control" onchange="LT.filtrarVisaoGeral(this.value)">
          <option value="" ${!visaoGeralFiltroNodeId ? 'selected' : ''}>Toda a obra</option>
          ${_listarNodesMedicao().map(o => `<option value="${o.id}" ${o.id === visaoGeralFiltroNodeId ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
        </select>
      </div>

      <div class="fachada-info-bar">
        <div class="fachada-info-item">
          <div class="info-label">M² de Teto</div>
          <div class="info-valor destaque">${fmt2(totalTeto)}</div>
        </div>
        <div class="fachada-info-item">
          <div class="info-label">M² de Drywall</div>
          <div class="info-valor">${fmt2(totalDryWall)}</div>
        </div>
        <div class="fachada-info-item">
          <div class="info-label">M² de Placa de Gesso</div>
          <div class="info-valor">${fmt2(totalPlacaGesso)}</div>
        </div>
        <div class="fachada-info-item">
          <div class="info-label">M² com Pintura</div>
          <div class="info-valor">${fmt2(totalPintura)}</div>
        </div>
        <div class="fachada-info-item">
          <div class="info-label">ML de Tabica</div>
          <div class="info-valor" style="font-size:1.05rem;">${fmt2(totalTabica)}ML</div>
        </div>
      </div>

      ${totalAreas === 0 ? `<div class="lt-hint">${areas.length === 0 ? 'Clique em um local na árvore ao lado (ou crie um novo com "+ Local") para vincular uma planta em PDF e começar a medir.' : 'Nenhuma área medida neste local (ou nos sublocais dele).'}</div>` : `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin:18px 0;">
          <div class="fachada-info-item">
            <strong style="display:flex;align-items:center;gap:7px;margin-bottom:10px;font-size:0.85rem;"><span style="width:9px;height:9px;border-radius:2px;background:var(--cor-primaria);display:inline-block;"></span>M² por Tipo de Drywall</strong>
            ${barras(porTipoDryWall, 'var(--cor-primaria)')}
          </div>
          <div class="fachada-info-item">
            <strong style="display:flex;align-items:center;gap:7px;margin-bottom:10px;font-size:0.85rem;"><span style="width:9px;height:9px;border-radius:2px;background:var(--cv-orange);display:inline-block;"></span>M² por Tipo de Placa de Gesso</strong>
            ${barras(porTipoPlacaGesso, 'var(--cv-orange)')}
          </div>
          <div class="fachada-info-item">
            <strong style="display:flex;align-items:center;gap:7px;margin-bottom:10px;font-size:0.85rem;"><span style="width:9px;height:9px;border-radius:2px;background:var(--cv-blue);display:inline-block;"></span>🎨 Pintura por Cor</strong>
            ${barras(porCorPintura, 'var(--cv-blue)')}
          </div>
        </div>
      `}

      <h3 class="mb-2" style="font-size:0.95rem;">📄 Plantas enviadas</h3>
      ${plantas.length === 0 ? `<div class="estado-vazio" style="padding:16px;"><p class="text-sm">Nenhuma planta enviada ainda.</p></div>` : plantas.map(pl => `
        <div class="lt-planta-lib-item">
          <span>${esc(pl.nome)} <span style="color:var(--cor-texto-muted);">· ${pl.numPaginas || 1} página(s)</span></span>
          <button class="btn btn-secundario btn-sm" onclick="LT.excluirPlanta('${pl.id}')" title="Excluir planta">✕</button>
        </div>
      `).join('')}
    `;
  }

  function filtrarVisaoGeral(nodeId) {
    visaoGeralFiltroNodeId = nodeId || null;
    renderizar();
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
      <div class="lt-vinc-card">
        ${plantas.length ? `
          <div class="form-grupo">
            <label>Escolher planta já enviada</label>
            <select id="lt-sel-planta-existente" class="form-control">
              <option value="">Selecione...</option>
              ${plantas.map(pl => `<option value="${pl.id}">${esc(pl.nome)} (${pl.numPaginas || 1} pág.)</option>`).join('')}
            </select>
          </div>
          <div class="form-grupo">
            <label>Página a usar</label>
            <input type="number" id="lt-input-pagina-existente" class="form-control" min="1" value="1">
          </div>
          <button class="btn btn-primario mb-2" style="width:100%;" onclick="LT.vincularPlantaExistente('${node.id}')">Vincular esta página</button>
          <div style="text-align:center;color:var(--cor-texto-muted);font-size:0.78rem;margin:8px 0;">— ou —</div>
        ` : ''}
        <button class="btn btn-secundario" style="width:100%;" onclick="LT.abrirModalPlanta('${node.id}')">+ Enviar nova planta em PDF</button>
      </div>
    `;
  }

  function abrirModalPlanta(nodeId) {
    _pendingVincularNodeId = nodeId || null;
    document.getElementById('lt-planta-nome').value = '';
    document.getElementById('lt-planta-arquivo').value = '';
    Utils.abrirModal('modal-lt-planta');
  }

  async function enviarPlanta() {
    const nome = document.getElementById('lt-planta-nome').value.trim() || 'Planta sem nome';
    const input = document.getElementById('lt-planta-arquivo');
    const file = input.files && input.files[0];
    if (!file) { Utils.toast('Selecione um arquivo PDF.', 'alerta'); return; }
    if (file.type !== 'application/pdf') { Utils.toast('O arquivo precisa ser um PDF.', 'alerta'); return; }

    const btn = document.getElementById('lt-btn-upload-planta');
    if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }
    Utils.mostrarLoading('Enviando PDF e lendo páginas...');
    try {
      await _garantirPdfjs();
      const plantaId = _uid();
      const path = `obras/${obraId}/teto-plantas/${plantaId}.pdf`;
      const ref = storage.ref(path);
      await ref.put(file, { contentType: 'application/pdf' });
      const downloadURL = await ref.getDownloadURL();

      const doc = await _carregarPdfDoc(downloadURL);
      const numPaginas = doc.numPages;

      await Database.criar(obraId, COL_PLANTAS, { nome, storagePath: path, downloadURL, numPaginas }, plantaId);
      Utils.fecharModal('modal-lt-planta');
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
    const sel = document.getElementById('lt-sel-planta-existente');
    const pagInput = document.getElementById('lt-input-pagina-existente');
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
    const totalTeto = areasN.reduce((s, a) => s + (a.areaM2 || 0), 0);
    const totalDryWall = areasN.reduce((s, a) => s + (a.tipoDryWall ? (a.areaM2 || 0) : 0), 0);
    const totalPlacaGesso = areasN.reduce((s, a) => s + (a.tipoPlacaGesso ? (a.areaM2 || 0) : 0), 0);
    const totalPintura = areasN.reduce((s, a) => s + (a.temPintura ? (a.areaM2 || 0) : 0), 0);
    const totalTabica = areasN.reduce((s, a) => s + (a.mlTabica || 0), 0);
    const pl = _plantaPorId(node.plantaId);

    setTimeout(_popularDatalists, 0);

    return `
      <div id="lt-workspace-wrap" class="${fsAtivo ? 'lt-fullscreen-overlay' : ''}">
        <div class="lt-workspace-header">
          <div><h2>${esc(node.nome)}</h2>
            <span class="subtitulo">${pl ? esc(pl.nome) : ''} — pág. ${node.pagina} · ${areasN.length} área(s) · ${fmt2(totalTeto)} m²</span></div>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-primario btn-sm" onclick="LT.toggleFullscreen()">${fsAtivo ? '✕ Sair da tela cheia' : '⛶ Tela cheia'}</button>
            ${fsAtivo ? '' : `<button class="btn btn-secundario btn-sm" onclick="LT.trocarPlanta('${node.id}')">🔄 Trocar planta/página</button>`}
          </div>
        </div>
        <div class="lt-toolbar">
          <button class="btn btn-secundario btn-sm ${modo === 'calibrar' ? 'lt-modo-ativo' : ''}" onclick="LT.toggleModoCalibrar()">📏 Calibrar Escala</button>
          <button class="btn btn-secundario btn-sm ${modo === 'medir' ? 'lt-modo-ativo' : ''}" onclick="LT.toggleModoMedir()" ${temEscala ? '' : 'disabled title="Calibre a escala primeiro"'}>⬟ Nova Área</button>
          ${modo === 'medir' ? `
            <button class="btn btn-primario btn-sm" id="lt-btn-finalizar" onclick="LT.finalizarPoligono()">✓ Finalizar Área (${poligonoPontos.length} pontos)</button>
            <button class="btn btn-secundario btn-sm" onclick="LT.cancelarDesenho()">Cancelar</button>
          ` : ''}
          ${modo === 'calibrar' ? `<button class="btn btn-secundario btn-sm" onclick="LT.cancelarDesenho()">Cancelar</button>` : ''}
          ${modo === 'tabica' ? `
            <span class="info">🔲 Tabica selecionado: <strong id="lt-tabica-ml">${fmt2(_calcularMlTabica(areaPoligonoPendente, poligonoTabicaSelecionado, node.escalaMetrosPorPonto || 0))} m</strong></span>
            <button class="btn btn-primario btn-sm" onclick="LT.confirmarTabica()">✓ Confirmar Tabica</button>
            <button class="btn btn-secundario btn-sm" onclick="LT.cancelarTabica()">Cancelar</button>
          ` : ''}
          <div class="sep"></div>
          <button class="btn btn-secundario btn-sm" onclick="LT.zoomOut()" title="Diminuir zoom">➖</button>
          <button class="btn btn-secundario btn-sm" onclick="LT.zoomReset()" title="Redefinir zoom (100%)"><span id="lt-zoom-pct">100%</span></button>
          <button class="btn btn-secundario btn-sm" onclick="LT.zoomIn()" title="Aumentar zoom">➕</button>
          <div class="sep"></div>
          <span class="info">${temEscala ? `Escala: 1pt=${(node.escalaMetrosPorPonto * 1000).toFixed(2)}mm` : 'Sem escala'} · 🖱️ roda=zoom · meio=mover</span>
        </div>
        ${!temEscala ? `<div class="lt-hint">Clique em "📏 Calibrar Escala", desenhe uma linha sobre uma medida conhecida do desenho e informe a distância real.</div>` : ''}
        ${modo === 'medir' ? `<div class="lt-hint">Clique para adicionar vértices do polígono. Duplo-clique ou "Finalizar Área" para terminar.</div>` : ''}
        ${modo === 'calibrar' ? `<div class="lt-hint">Clique em dois pontos sobre uma medida conhecida do desenho.</div>` : ''}
        ${modo === 'tabica' ? `<div class="lt-hint">Clique nas bordas (linhas cinza) do teto que têm tabica — ficam roxas quando marcadas. Clique de novo pra desmarcar.</div>` : ''}
        <div class="lt-workspace">
          <div class="lt-canvas-col" id="lt-canvas-col"><div class="loading-inline">Carregando página do PDF...</div></div>
          <div class="lt-painel-lateral">
            <div class="lt-totais">
              <table>
                <tr><td>Total de áreas</td><td>${areasN.length}</td></tr>
                <tr><td>M² de Teto</td><td>${fmt2(totalTeto)} m²</td></tr>
                <tr><td>M² de Drywall</td><td>${fmt2(totalDryWall)} m²</td></tr>
                <tr><td>M² de Placa de Gesso</td><td>${fmt2(totalPlacaGesso)} m²</td></tr>
                <tr><td>M² com Pintura</td><td>${fmt2(totalPintura)} m²</td></tr>
                <tr><td>ML de Tabica</td><td>${fmt2(totalTabica)} m</td></tr>
              </table>
            </div>
            ${areasN.length > 0 ? `<input type="text" id="lt-busca-areas" class="form-control" placeholder="🔍 Filtrar áreas por nome ou tipo..." oninput="LT.filtrarAreas(this.value)" style="margin-bottom:2px;">` : ''}
            ${areasN.length === 0 ? `<div class="estado-vazio" style="padding:20px;"><p style="font-size:0.85rem;">Nenhuma área medida ainda.</p></div>` : areasN.map(a => `
              <div class="lt-area-card ${a.id === areaDestacadaId ? 'lt-area-card-destaque' : ''}" data-busca="${esc((a.nome + ' ' + (a.tipoDryWall || '') + ' ' + (a.tipoPlacaGesso || '') + ' ' + (a.pintura || []).map(pt => pt.cor || '').join(' ')).toLowerCase())}" onclick="LT.editarArea('${a.id}')">
                <div class="nome"><span>${esc(a.nome)}</span><span class="m2">${fmt2(a.areaM2)} m²</span></div>
                <div class="meta">
                  ${a.tipoDryWall ? `Drywall: ${esc(a.tipoDryWall)}` : (a.tipoPlacaGesso ? `Placa de Gesso: ${esc(a.tipoPlacaGesso)}` : 'Sistema: —')}
                  ${a.temPintura ? ` · 🎨 ${(a.pintura || []).map(pt => `${esc(pt.cor || '?')} ${num(pt.pct)}%`).join(', ')}` : ''}
                  ${a.mlTabica ? ` · 🔲 ${fmt2(a.mlTabica)}m tabica` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  function toggleSelecaoArea(id) {
    if (areasSelecionadasParaMover.has(id)) areasSelecionadasParaMover.delete(id);
    else areasSelecionadasParaMover.add(id);
    const treeBody = document.getElementById('lt-tree-body');
    if (treeBody) treeBody.innerHTML = _renderArvore();
    atualizarBarraSelecaoAreas();
  }

  function marcarTodasAreas(marcar) {
    if (marcar) {
      document.querySelectorAll('.lt-area-check').forEach(cb => areasSelecionadasParaMover.add(cb.getAttribute('data-id')));
    } else {
      areasSelecionadasParaMover.clear();
    }
    const treeBody = document.getElementById('lt-tree-body');
    if (treeBody) treeBody.innerHTML = _renderArvore();
    atualizarBarraSelecaoAreas();
  }

  function desmarcarTodasAreas() {
    areasSelecionadasParaMover.clear();
    const treeBody = document.getElementById('lt-tree-body');
    if (treeBody) treeBody.innerHTML = _renderArvore();
    atualizarBarraSelecaoAreas();
  }

  function atualizarBarraSelecaoAreas() {
    const marcadas = areasSelecionadasParaMover.size;
    const bar = document.getElementById('lt-bulk-areas-bar');
    if (bar) bar.style.display = marcadas > 0 ? 'flex' : 'none';
    const info = document.getElementById('lt-bulk-areas-info');
    if (info) info.textContent = `${marcadas} selecionada(s)`;
  }

  // Se o local de destino ainda não tem planta vinculada, herda a mesma
  // planta/página/escala/linha de calibração de onde a área veio — assim ela
  // continua aparecendo certinha sobre o desenho no novo local, sem precisar
  // vincular e recalibrar tudo de novo. Só copia; nunca mexe na origem.
  async function _herdarPlantaSeNecessario(destR, idsAreas) {
    if (!destR || destR.node.plantaId) return false;
    for (const id of idsAreas) {
      const a = areas.find(x => x.id === id); if (!a) continue;
      const origemR = _acharNode(a.nodeId);
      if (origemR && origemR.node.plantaId) {
        destR.node.plantaId = origemR.node.plantaId;
        destR.node.pagina = origemR.node.pagina;
        destR.node.escalaMetrosPorPonto = origemR.node.escalaMetrosPorPonto;
        destR.node.linhaCalibracao = origemR.node.linhaCalibracao;
        await _salvarArvore();
        return true;
      }
    }
    return false;
  }

  async function moverOuCopiarSelecionadas(acao) {
    const marcados = Array.from(areasSelecionadasParaMover);
    if (!marcados.length) { Utils.toast('Selecione pelo menos uma área.', 'alerta'); return; }
    const sel = document.getElementById('lt-bulk-destino-select');
    const destino = sel.value;
    if (!destino) { Utils.toast('Escolha o local de destino.', 'alerta'); return; }
    const destR = _acharNode(destino);
    if (!destR) return;

    Utils.mostrarLoading(acao === 'copiar' ? 'Copiando áreas...' : 'Movendo áreas...');
    try {
      await _herdarPlantaSeNecessario(destR, marcados);
      const escalaDestino = destR.node.escalaMetrosPorPonto || 0;
      const ops = [];
      marcados.forEach(id => {
        const a = areas.find(x => x.id === id); if (!a) return;
        if (acao === 'mover') {
          ops.push({ type: 'update', ref: Database.ref(obraId, COL_AREAS).doc(id), data: { nodeId: destino } });
        } else {
          const { id: _aid, nodeId: _nid, ...rest } = a;
          const poligono = rest.poligono || [];
          const novaAreaM2 = escalaDestino ? _areaPoligono(poligono) * (escalaDestino ** 2) : rest.areaM2;
          const novoMlTabica = (rest.tabicaArestas && escalaDestino) ? _calcularMlTabica(poligono, rest.tabicaArestas, escalaDestino) : (rest.mlTabica || 0);
          ops.push({ type: 'set', ref: Database.ref(obraId, COL_AREAS).doc(), data: { ...rest, nodeId: destino, areaM2: novaAreaM2, mlTabica: novoMlTabica } });
        }
      });
      await Database.batchWrite(ops);
      Utils.toast(`✓ ${marcados.length} área(s) ${acao === 'copiar' ? 'copiadas' : 'movidas'}!`, 'sucesso');
      areasSelecionadasParaMover.clear();
      await carregar();
      selNode(destino);
    } catch (e) {
      console.error(e);
      Utils.toast('Erro: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  function filtrarAreas(termo) {
    const t = (termo || '').toLowerCase().trim();
    document.querySelectorAll('.lt-area-card').forEach(card => {
      const alvo = card.getAttribute('data-busca') || '';
      card.style.display = (!t || alvo.includes(t)) ? '' : 'none';
    });
  }

  function _popularDatalists() {
    const camposMap = { tipoDryWall: 'lt-lista-drywall', tipoPlacaGesso: 'lt-lista-placagesso' };
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
    const col = document.getElementById('lt-canvas-col');
    if (!col) return;
    const meuToken = ++_renderToken;
    try {
      await _garantirPdfjs();
      if (meuToken !== _renderToken) return; // uma renderização mais nova já começou — abortar
      const pl = _plantaPorId(node.plantaId);
      if (!pl) return;
      if (pdfDocPlantaId !== pl.id) {
        pdfDoc = await _carregarPdfDoc(pl.downloadURL);
        if (meuToken !== _renderToken) return;
        pdfDocPlantaId = pl.id;
      }
      const page = await pdfDoc.getPage(node.pagina);
      if (meuToken !== _renderToken) return;
      const viewportBase = page.getViewport({ scale: 1 });
      const larguraDisponivel = Math.max(320, (col.clientWidth || 900) - 24);
      const escalaCalculada = Math.min(2.2, larguraDisponivel / viewportBase.width);
      const viewport = page.getViewport({ scale: escalaCalculada });

      const canvas = document.createElement('canvas');
      canvas.className = 'lt-base';
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;
      if (meuToken !== _renderToken) return; // aborta antes de tocar no DOM ou no estado compartilhado

      // só agora, com a certeza de que ninguém mais começou depois, aplica de fato
      pageWidthPts = viewportBase.width;
      renderScale = escalaCalculada;

      const stage = document.createElement('div');
      stage.className = 'lt-canvas-stage modo-' + modo;
      stage.style.width = viewport.width + 'px';
      stage.style.height = viewport.height + 'px';
      stage.appendChild(canvas);

      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('class', 'lt-svg-overlay');
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
        Utils.abrirModal('modal-lt-calibrar');
        document.getElementById('lt-calibrar-distancia').value = '';
        setTimeout(() => document.getElementById('lt-calibrar-distancia').focus(), 50);
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
    const btn = document.getElementById('lt-btn-finalizar');
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
    const col = document.getElementById('lt-canvas-col');
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
      const col = document.getElementById('lt-canvas-col');
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
    const stage = document.querySelector('#lt-canvas-col .lt-canvas-stage');
    if (!stage) return;
    const canvas = stage.querySelector('canvas.lt-base');
    const svg = stage.querySelector('svg.lt-svg-overlay');
    if (!canvas || !svg) return;
    const w = canvas.width * zoomCss, h = canvas.height * zoomCss;
    stage.style.width = w + 'px'; stage.style.height = h + 'px';
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    svg.style.width = w + 'px'; svg.style.height = h + 'px';
    const pct = document.getElementById('lt-zoom-pct');
    if (pct) pct.textContent = Math.round(zoomCss * 100) + '%';
  }

  function _onWheelZoom(e) {
    e.preventDefault();
    const col = document.getElementById('lt-canvas-col');
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
    const stage = document.querySelector('#lt-canvas-col .lt-canvas-stage');
    if (!stage) return;
    const canvas = stage.querySelector('canvas.lt-base');
    const svg = stage.querySelector('svg.lt-svg-overlay');
    if (!canvas || !svg) return;
    const efetiva = renderScale * zoomCss;
    if (efetiva <= renderScale * 1.05) return; // já está nítido o bastante nesta resolução
    let novaEscala = Math.min(6, efetiva); // limite de segurança pra não estourar memória
    const MAX_DIM_PX = 4096; // canvas muito grande fica pesado pra arrastar (scroll)/pintar
    const projLargura = pageWidthPts * novaEscala;
    if (projLargura > MAX_DIM_PX) novaEscala = MAX_DIM_PX / pageWidthPts;
    const pl = _plantaPorId(node.plantaId);
    if (!pl || !pdfDoc || pdfDocPlantaId !== pl.id) return;
    const meuToken = _renderToken; // se uma renderização nova (troca de local) começar
                                    // enquanto isso roda, aborta em vez de bagunçar o renderScale
    try {
      const page = await pdfDoc.getPage(node.pagina);
      if (meuToken !== _renderToken) return;
      const viewport = page.getViewport({ scale: novaEscala });
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport }).promise;
      if (meuToken !== _renderToken) return;
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
    if (modo === 'tabica') { cancelarTabica(); return; }
    modo = 'nenhum'; calibPontos = []; poligonoPontos = [];
    renderizar();
  }

  function cancelarCalibracao() {
    Utils.fecharModal('modal-lt-calibrar');
    calibPontos = [];
    _redesenharTemp();
  }

  async function confirmarCalibracao() {
    const distStr = document.getElementById('lt-calibrar-distancia').value;
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
      Utils.fecharModal('modal-lt-calibrar');
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
    _tabicaEditandoAreaId = null;
    poligonoTabicaSelecionado = new Array(areaPoligonoPendente.length).fill(false);
    poligonoPontos = [];
    modo = 'tabica';
    renderizar();
  }

  // Alterna se a aresta i (entre o vértice i e o próximo) tem tabica
  function toggleTabicaEdge(i) {
    poligonoTabicaSelecionado[i] = !poligonoTabicaSelecionado[i];
    _redesenharTemp();
    const r = _acharNode(selNodeId);
    const ml = _calcularMlTabica(areaPoligonoPendente, poligonoTabicaSelecionado, r ? (r.node.escalaMetrosPorPonto || 0) : 0);
    const el = document.getElementById('lt-tabica-ml');
    if (el) el.textContent = fmt2(ml) + ' m';
  }

  function _calcularMlTabica(poligono, selecionado, escalaMetrosPorPonto) {
    let total = 0;
    for (let i = 0; i < poligono.length; i++) {
      if (!selecionado[i]) continue;
      const p1 = poligono[i], p2 = poligono[(i + 1) % poligono.length];
      total += Math.hypot(p2.x - p1.x, p2.y - p1.y) * escalaMetrosPorPonto;
    }
    return total;
  }

  function _atualizarMlTabicaDisplay(escalaMetrosPorPonto) {
    // (mantida por compatibilidade — a atualização em tempo real é feita direto em toggleTabicaEdge)
    const ml = _calcularMlTabica(areaPoligonoPendente, poligonoTabicaSelecionado, escalaMetrosPorPonto);
    const el = document.getElementById('lt-tabica-ml');
    if (el) el.textContent = fmt2(ml) + ' m';
    return ml;
  }

  function cancelarTabica() {
    modo = 'nenhum'; areaPoligonoPendente = null; poligonoTabicaSelecionado = []; _tabicaEditandoAreaId = null;
    renderizar();
  }

  function confirmarTabica() {
    let escala = 0;
    if (_tabicaEditandoAreaId) {
      const areaAtual = areas.find(x => x.id === _tabicaEditandoAreaId);
      const rNode = areaAtual ? _acharNode(areaAtual.nodeId) : null;
      escala = rNode ? (rNode.node.escalaMetrosPorPonto || 0) : 0;
    } else {
      const rNode = _acharNode(areaNodeIdPendente);
      escala = rNode ? (rNode.node.escalaMetrosPorPonto || 0) : 0;
    }
    const ml = _calcularMlTabica(areaPoligonoPendente, poligonoTabicaSelecionado, escala);
    if (_tabicaEditandoAreaId) {
      _salvarTabicaDireto(_tabicaEditandoAreaId, poligonoTabicaSelecionado.slice(), ml);
      return;
    }
    tabicaArestasPendente = poligonoTabicaSelecionado.slice();
    mlTabicaPendente = ml;
    modo = 'nenhum';
    document.getElementById('lt-area-titulo').textContent = 'Nova Área';
    Utils.limparForm('form-lt-area');
    document.getElementById('lt-area-m2-display').value = fmt2(areaM2Pendente);
    document.getElementById('lt-area-ml-tabica-display').value = fmt2(mlTabicaPendente) + ' m';
    document.querySelector('#form-lt-area input[name="lt-sistema-teto"][value=""]').checked = true;
    _mostrarCampoSistemaTeto('');
    pinturaAreaForm = [];
    document.getElementById('lt-check-pintura').checked = false;
    document.getElementById('lt-campo-pintura').style.display = 'none';
    document.getElementById('lt-btn-excluir-area').style.display = 'none';
    document.getElementById('lt-btn-editar-tabica').style.display = 'none';
    document.getElementById('lt-campo-mover').style.display = 'none';
    Utils.abrirModal('modal-lt-area');
    renderizar();
  }

  async function _salvarTabicaDireto(areaId, tabicaArestas, mlTabica) {
    Utils.mostrarLoading('Salvando tabica...');
    try {
      await Database.atualizar(obraId, COL_AREAS, areaId, { tabicaArestas, mlTabica });
      Utils.toast('Tabica atualizado!', 'sucesso');
      modo = 'nenhum'; areaPoligonoPendente = null; poligonoTabicaSelecionado = []; _tabicaEditandoAreaId = null;
      await carregar();
      selNode(selNodeId);
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao salvar tabica: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // Reabre o modo de seleção de tabica para uma área já salva
  function iniciarEdicaoTabica(areaId) {
    const a = areas.find(x => x.id === areaId); if (!a || !a.poligono) return;
    Utils.fecharModal('modal-lt-area');
    areaPoligonoPendente = a.poligono;
    poligonoTabicaSelecionado = a.tabicaArestas && a.tabicaArestas.length === a.poligono.length
      ? a.tabicaArestas.slice()
      : new Array(a.poligono.length).fill(false);
    _tabicaEditandoAreaId = areaId;
    areaEditId = null;
    modo = 'tabica';
    renderizar();
  }

  function editarArea(id) {
    const a = areas.find(x => x.id === id); if (!a) return;
    areaEditId = id;
    areaPoligonoPendente = null;
    document.getElementById('lt-area-titulo').textContent = 'Editar Área';
    Utils.setFormData('form-lt-area', a);
    document.getElementById('lt-area-m2-display').value = fmt2(a.areaM2);
    document.getElementById('lt-area-ml-tabica-display').value = fmt2(a.mlTabica || 0) + ' m';
    const sistemaAtual = a.tipoDryWall ? 'drywall' : (a.tipoPlacaGesso ? 'placagesso' : '');
    document.querySelector(`#form-lt-area input[name="lt-sistema-teto"][value="${sistemaAtual}"]`).checked = true;
    _mostrarCampoSistemaTeto(sistemaAtual);
    pinturaAreaForm = (a.pintura && a.pintura.length) ? JSON.parse(JSON.stringify(a.pintura)) : [{ cor: '', hex: '#ffffff', pct: 100 }];
    document.getElementById('lt-check-pintura').checked = !!a.temPintura;
    document.getElementById('lt-campo-pintura').style.display = a.temPintura ? '' : 'none';
    _renderPinturaAreaForm();
    document.getElementById('lt-btn-excluir-area').style.display = '';
    document.getElementById('lt-btn-editar-tabica').style.display = '';
    document.getElementById('lt-btn-editar-tabica').setAttribute('onclick', `LT.iniciarEdicaoTabica('${id}')`);
    const selMover = document.getElementById('lt-area-mover-select');
    const locais = _listarNodesMedicao().filter(n => n.id !== a.nodeId);
    selMover.innerHTML = locais.length
      ? `<option value="">Selecione...</option>` + locais.map(n => `<option value="${n.id}">${esc(n.label)}</option>`).join('')
      : `<option value="">Nenhum outro local cadastrado ainda</option>`;
    document.getElementById('lt-campo-mover').style.display = '';
    Utils.abrirModal('modal-lt-area');
  }

  async function moverArea() {
    if (!areaEditId) return;
    const sel = document.getElementById('lt-area-mover-select');
    const novoNodeId = sel.value;
    if (!novoNodeId) { Utils.toast('Escolha o local de destino.', 'alerta'); return; }
    Utils.mostrarLoading('Movendo área...');
    try {
      const destR = _acharNode(novoNodeId);
      await _herdarPlantaSeNecessario(destR, [areaEditId]);
      await Database.atualizar(obraId, COL_AREAS, areaEditId, { nodeId: novoNodeId });
      Utils.fecharModal('modal-lt-area');
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
    const nomeInput = document.getElementById('lt-clonar-novo-nome');
    if (nomeInput) nomeInput.value = '';
    const opts = _listarNodesMedicao().filter(o => o.id !== nodeId);
    document.getElementById('lt-clonar-titulo').textContent = `Clonar/Multiplicar "${origem.node.nome}"`;
    const lista = document.getElementById('lt-clonar-lista');
    lista.innerHTML = opts.length
      ? opts.map(o => `
          <label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;cursor:pointer;">
            <input type="checkbox" class="lt-clonar-check" value="${o.id}">
            <span>${esc(o.label)}</span>
            <span style="margin-left:auto;color:var(--cor-texto-muted);font-size:0.75rem;">${_areasDoNode(o.id).length} área(s) hoje</span>
          </label>
        `).join('')
      : `<p class="text-sm" style="color:var(--cor-texto-muted);">Nenhum outro local cadastrado ainda. Crie um novo local primeiro (botão "+ Local").</p>`;
    Utils.abrirModal('modal-lt-clonar');
  }

  function marcarTodosClonar(marcar) {
    document.querySelectorAll('.lt-clonar-check').forEach(cb => { cb.checked = marcar; });
  }

  // Cria um local NOVO ao lado da origem (mesmo pai na árvore) e já clona
  // as áreas pra ele — resolve o caso de querer "duplicar" um local inteiro
  // como um novo local irmão, em vez de só copiar pra um local já existente.
  async function criarNovoLocalEClonar() {
    const nomeInput = document.getElementById('lt-clonar-novo-nome');
    const nome = nomeInput.value.trim();
    if (!nome) { Utils.toast('Digite o nome do novo local.', 'alerta'); return; }
    const origemR = _acharNode(clonarOrigemId); if (!origemR) return;
    const areasOrigem = _areasDoNode(clonarOrigemId);
    if (!areasOrigem.length) { Utils.toast('Este local ainda não tem áreas medidas para clonar.', 'alerta'); return; }

    Utils.mostrarLoading('Criando local e clonando...');
    try {
      const novo = { id: _uid(), nome, filhos: [], plantaId: null, pagina: null, escalaMetrosPorPonto: null, linhaCalibracao: null };
      if (origemR.parent) {
        origemR.parent.filhos = origemR.parent.filhos || [];
        origemR.parent.filhos.push(novo);
        openNodes.add(origemR.parent.id);
      } else {
        arvore.push(novo);
      }
      openNodes.add(novo.id);
      await _salvarArvore();

      const novoR = _acharNode(novo.id);
      await _herdarPlantaSeNecessario(novoR, [areasOrigem[0].id]);
      const escalaAlvo = novoR.node.escalaMetrosPorPonto || 0;

      const addOps = areasOrigem.map(a => {
        const { id: _aid, nodeId: _nid, ...rest } = a;
        const poligono = rest.poligono || [];
        const novaAreaM2 = escalaAlvo ? _areaPoligono(poligono) * (escalaAlvo ** 2) : rest.areaM2;
        const novoMlTabica = (rest.tabicaArestas && escalaAlvo) ? _calcularMlTabica(poligono, rest.tabicaArestas, escalaAlvo) : (rest.mlTabica || 0);
        return { type: 'set', ref: Database.ref(obraId, COL_AREAS).doc(), data: { ...rest, nodeId: novo.id, areaM2: novaAreaM2, mlTabica: novoMlTabica } };
      });
      await Database.batchWrite(addOps);

      Utils.fecharModal('modal-lt-clonar');
      Utils.toast(`✓ "${nome}" criado com ${areasOrigem.length} área(s) clonada(s)!`, 'sucesso');
      await carregar();
      selNode(novo.id);
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao criar e clonar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  async function confirmarClonarPavimento() {
    const alvoIds = Array.from(document.querySelectorAll('.lt-clonar-check:checked')).map(cb => cb.value);
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

    Utils.fecharModal('modal-lt-clonar');
    Utils.mostrarLoading('Clonando pavimento...');
    try {
      // Remove o que já existir nos destinos marcados
      const delOps = [];
      alvoIds.forEach(id => { _areasDoNode(id).forEach(a => delOps.push({ type: 'delete', ref: Database.ref(obraId, COL_AREAS).doc(a.id) })); });
      for (let i = 0; i < delOps.length; i += 400) await Database.batchWrite(delOps.slice(i, i + 400));

      // Se algum destino ainda não tiver planta nenhuma vinculada, herda a
      // mesma planta/página/escala da origem (só nesse caso — locais que já
      // têm sua própria planta continuam com a deles).
      for (const alvoId of alvoIds) {
        await _herdarPlantaSeNecessario(_acharNode(alvoId), areasOrigem.length ? [areasOrigem[0].id] : []);
      }

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
          const novoMlTabica = (rest.tabicaArestas && escalaAlvo) ? _calcularMlTabica(poligono, rest.tabicaArestas, escalaAlvo) : (rest.mlTabica || 0);
          addOps.push({ type: 'set', ref: Database.ref(obraId, COL_AREAS).doc(), data: { ...rest, nodeId: alvoId, areaM2: novaAreaM2, mlTabica: novoMlTabica } });
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

  // ── Sistema de Forro (Drywall ou Placa de Gesso — mutuamente exclusivos) ──
  function _mostrarCampoSistemaTeto(sistema) {
    document.getElementById('lt-campo-drywall').style.display = sistema === 'drywall' ? '' : 'none';
    document.getElementById('lt-campo-placagesso').style.display = sistema === 'placagesso' ? '' : 'none';
  }
  function toggleSistemaTeto(sistema) {
    _mostrarCampoSistemaTeto(sistema);
    // Limpa o campo que não se aplica, pra não salvar um valor "fantasma"
    // digitado antes de trocar de sistema.
    const dw = document.querySelector('#form-lt-area [name="tipoDryWall"]');
    const pg = document.querySelector('#form-lt-area [name="tipoPlacaGesso"]');
    if (sistema !== 'drywall' && dw) dw.value = '';
    if (sistema !== 'placagesso' && pg) pg.value = '';
  }

  // ── Pintura (mistura de cores por %) — mesmo modelo do Levantamento de
  // Paredes (Acabamento): cada cor tem nome + hex + percentual da área.
  function _somaPct(arr) { return (arr || []).reduce((s, x) => s + num(x.pct), 0); }

  function _renderPinturaAreaForm() {
    const el = document.getElementById('lt-lista-pinturas');
    if (!el) return;
    el.innerHTML = pinturaAreaForm.map((pt, i) => `
      <div style="display:flex;gap:6px;margin-bottom:6px;align-items:center;">
        <input type="color" value="${esc(pt.hex || '#ffffff')}" style="width:34px;height:34px;border:1px solid #e2e8f0;border-radius:6px;padding:0;flex-shrink:0;" onchange="LT.updPinturaItem(${i},'hex',this.value)">
        <input type="text" class="form-control" style="flex:1.4;" placeholder="Nome da cor" value="${esc(pt.cor)}" oninput="LT.updPinturaItem(${i},'cor',this.value)">
        <input type="number" class="form-control" style="flex:0.7;" step="1" min="0" max="100" value="${esc(pt.pct)}" oninput="LT.updPinturaItem(${i},'pct',this.value)">
        <span style="font-size:0.78rem;color:var(--cor-texto-muted);">%</span>
        ${pinturaAreaForm.length > 1 ? `<button type="button" class="btn btn-secundario btn-sm" onclick="LT.remPinturaItem(${i})">✕</button>` : ''}
      </div>`).join('');
    const soma = _somaPct(pinturaAreaForm);
    const somaEl = document.getElementById('lt-soma-pintura');
    if (somaEl) { somaEl.textContent = fmt2(soma) + '%'; somaEl.style.color = Math.abs(soma - 100) < 0.01 ? '#16a34a' : '#ef4444'; }
  }

  function togglePintura(checked) {
    document.getElementById('lt-campo-pintura').style.display = checked ? '' : 'none';
    if (checked && !pinturaAreaForm.length) pinturaAreaForm.push({ cor: '', hex: '#ffffff', pct: 100 });
    _renderPinturaAreaForm();
  }
  function addPinturaItem() { pinturaAreaForm.push({ cor: '', hex: '#ffffff', pct: 0 }); _renderPinturaAreaForm(); }
  function remPinturaItem(i) { pinturaAreaForm.splice(i, 1); _renderPinturaAreaForm(); }
  function updPinturaItem(i, campo, valor) {
    pinturaAreaForm[i][campo] = valor;
    if (campo === 'pct') {
      const soma = _somaPct(pinturaAreaForm);
      const el = document.getElementById('lt-soma-pintura');
      if (el) { el.textContent = fmt2(soma) + '%'; el.style.color = Math.abs(soma - 100) < 0.01 ? '#16a34a' : '#ef4444'; }
    }
  }

  function fecharModalArea() {
    Utils.fecharModal('modal-lt-area');
    if (areaEditId === null) {
      poligonoPontos = []; modo = 'nenhum'; areaPoligonoPendente = null;
      tabicaArestasPendente = null; mlTabicaPendente = 0; poligonoTabicaSelecionado = [];
      pinturaAreaForm = [];
      renderizar();
    }
  }

  async function salvarArea() {
    const data = Utils.getFormData('form-lt-area');
    if (!data.nome) { Utils.toast('Informe o nome da área.', 'alerta'); return; }

    const temPintura = !!document.getElementById('lt-check-pintura')?.checked;
    if (temPintura) {
      const soma = _somaPct(pinturaAreaForm);
      if (Math.abs(soma - 100) > 0.5) {
        Utils.toast(`A soma dos % de pintura deve ser 100% (está em ${fmt2(soma)}%).`, 'alerta');
        return;
      }
    }
    data.temPintura = temPintura;
    data.pintura = temPintura ? pinturaAreaForm.map(p => ({ cor: p.cor || '', hex: p.hex || '#ffffff', pct: num(p.pct) })) : [];

    const nodeIdDestino = areaEditId ? null : (areaNodeIdPendente || selNodeId);

    Utils.mostrarLoading('Salvando área...');
    try {
      if (areaEditId) {
        await Database.atualizar(obraId, COL_AREAS, areaEditId, data);
      } else {
        data.nodeId = nodeIdDestino;
        data.poligono = areaPoligonoPendente;
        data.areaM2 = areaM2Pendente;
        data.tabicaArestas = tabicaArestasPendente || [];
        data.mlTabica = mlTabicaPendente || 0;
        await Database.criar(obraId, COL_AREAS, data);
      }
      Utils.fecharModal('modal-lt-area');
      Utils.toast('Área salva!', 'sucesso');
      const irParaNode = areaEditId ? selNodeId : nodeIdDestino;
      poligonoPontos = []; modo = 'nenhum'; areaPoligonoPendente = null; areaEditId = null;
      areaNodeIdPendente = null;
      tabicaArestasPendente = null; mlTabicaPendente = 0; poligonoTabicaSelecionado = [];
      pinturaAreaForm = [];
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
      Utils.fecharModal('modal-lt-area');
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
    const svg = document.querySelector('#lt-canvas-col svg.lt-svg-overlay');
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
      // Trechos com tabica — traço grosso por cima da(s) parede(s) marcada(s)
      if (a.tabicaArestas && a.tabicaArestas.length === a.poligono.length) {
        for (let i = 0; i < a.poligono.length; i++) {
          if (!a.tabicaArestas[i]) continue;
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
    const svg = document.querySelector('#lt-canvas-col svg.lt-svg-overlay');
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
    if (modo === 'tabica' && areaPoligonoPendente && areaPoligonoPendente.length) {
      extra += `<polygon points="${_ptsAttr(areaPoligonoPendente)}" fill="rgba(124,58,237,0.08)" stroke="#c4b5fd" stroke-width="1"/>`;
      for (let i = 0; i < areaPoligonoPendente.length; i++) {
        const sel = !!poligonoTabicaSelecionado[i];
        const p1 = areaPoligonoPendente[i], p2 = areaPoligonoPendente[(i + 1) % areaPoligonoPendente.length];
        extra += `<line x1="${p1.x * renderScale}" y1="${p1.y * renderScale}" x2="${p2.x * renderScale}" y2="${p2.y * renderScale}" `
          + `stroke="${sel ? '#7c3aed' : '#94a3b8'}" stroke-width="${sel ? 7 : 4}" stroke-linecap="round" `
          + `style="pointer-events:auto;cursor:pointer;" onclick="LT.toggleTabicaEdge(${i})"/>`;
      }
    }
    let tempG = svg.querySelector('#lt-temp-g');
    if (!tempG) {
      tempG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      tempG.setAttribute('id', 'lt-temp-g');
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
    finalizarPoligono, editarArea, toggleSistemaTeto, togglePintura, addPinturaItem, remPinturaItem, updPinturaItem, fecharModalArea, salvarArea, excluirAreaEmEdicao, moverArea,
    filtrarAreas, abrirClonarPavimento, marcarTodosClonar, confirmarClonarPavimento, criarNovoLocalEClonar, filtrarVisaoGeral,
    marcarTodasAreas, desmarcarTodasAreas, atualizarBarraSelecaoAreas, moverOuCopiarSelecionadas, toggleSelecaoArea,
    toggleTabicaEdge, cancelarTabica, confirmarTabica, iniciarEdicaoTabica,
    zoomIn, zoomOut, zoomReset,
  };
})();

function onObraChanged() {
  if (typeof LT !== 'undefined') LT.recarregar();
}

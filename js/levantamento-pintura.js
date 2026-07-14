// ============================================
// Módulo: Levantamento de Pintura
//
// NÃO lança área nova — é alimentado pelos módulos de Paredes
// (aba Acabamento, coleção paredesAcabamentoPecas) e Teto
// (coleção tetoAreas). Tem sua PRÓPRIA árvore de locais
// (obras/{obraId}/config/pinturaArvore) e cada nó dela pode ser
// VINCULADO a 1 nó da árvore de Paredes + 1 nó da árvore de Teto
// (árvores independentes, nodeIds diferentes — por isso o vínculo
// manual). A partir do vínculo, a Pintura:
//
//  - Soma m² pintável (parede + teto) daquele local e sublocais
//  - Mostra dash por cor (mistura por %, mesmo modelo de Paredes/Teto)
//  - Permite EDITAR a mistura de cor/% direto por aqui — grava no
//    MESMO documento (paredesAcabamentoPecas/tetoAreas) que os módulos
//    de origem usam, então é 100% sincronizado nos dois sentidos.
//  - Permite aplicar uma mistura em massa pra todas as peças/áreas
//    vinculadas a um local de uma vez.
//
// Dados: obras/{obraId}/config/pinturaArvore   (árvore própria + vínculos)
//        obras/{obraId}/paredesAcabamentoPecas (leitura/escrita do campo pintura)
//        obras/{obraId}/tetoAreas              (leitura/escrita do campo pintura)
// ============================================

const LevantamentoPintura = (() => {
  const CONFIG_DOC = 'pinturaArvore';
  const CONFIG_DOC_PAREDES = 'paredesArvore';
  const CONFIG_DOC_TETO = 'tetoArvore';
  const COL_ACAB = 'paredesAcabamentoPecas';
  const COL_TETO_AREAS = 'tetoAreas';

  let obraId = null;
  let arvore = [];          // árvore própria da Pintura [{id,nome,filhos,paredesNodeId,tetoNodeId}]
  let arvoreParedes = [];   // árvore de Paredes (só leitura, pra vincular)
  let arvoreTeto = [];      // árvore de Teto (só leitura, pra vincular)
  let pecasAcabamento = []; // paredesAcabamentoPecas (todas)
  let areasTeto = [];       // tetoAreas (todas)
  let openNodes = new Set();
  let selNodeId = null;     // null = Visão Geral
  let pintAba = 'parede';   // 'parede' | 'teto' | 'consolidado'

  // Estado modal de nó (criar/renomear)
  let nodeModo = null;      // 'novo-raiz' | 'novo-filho' | 'renomear'
  let nodeParentId = null;
  let nodeEditId = null;

  // Estado modal de vínculo
  let vincNodeId = null;
  let vincParedesSel = null;
  let vincTetoSel = null;
  let vincBuscaParedes = '';
  let vincBuscaTeto = '';

  // Estado modal de edição de pintura (peça de parede ou área de teto)
  let editTipo = null;      // 'parede' | 'teto'
  let editId = null;
  let editTemPintura = false;
  let editForm = [];        // [{cor,hex,pct}]

  // Estado modal de aplicação em massa
  let massaNodeId = null;
  let massaTipo = 'parede'; // 'parede' | 'teto'
  let massaIncluirSublocais = true;
  let massaForm = [];

  // ══════════════════════════════════════════
  // INIT / CARREGAMENTO
  // ══════════════════════════════════════════
  async function init() {
    const ok = await Utils.initPagina({ requireObra: true });
    if (!ok) return;
    obraId = Router.getObraId();
    const main = document.getElementById('lpt-content');
    if (!obraId) {
      if (main) main.innerHTML = `<div class="estado-vazio"><div class="icone">🎨</div><p>Selecione uma obra na barra lateral.</p></div>`;
      return;
    }
    document.addEventListener('keydown', e => { if (e.key === 'Escape') Utils.fecharTodosModais(); });
    await carregar();
  }

  async function recarregar() {
    obraId = Router.getObraId();
    if (!obraId) return;
    selNodeId = null;
    await carregar();
  }

  async function carregar() {
    Utils.mostrarLoading('Carregando levantamento de pintura...');
    try {
      const [cfgSnap, cfgParedes, cfgTeto, listaAcab, listaTeto] = await Promise.all([
        db.collection('obras').doc(obraId).collection('config').doc(CONFIG_DOC).get(),
        db.collection('obras').doc(obraId).collection('config').doc(CONFIG_DOC_PAREDES).get(),
        db.collection('obras').doc(obraId).collection('config').doc(CONFIG_DOC_TETO).get(),
        Database.listar(obraId, COL_ACAB, null).catch(() => []),
        Database.listar(obraId, COL_TETO_AREAS, null).catch(() => []),
      ]);
      arvore = (cfgSnap.exists && Array.isArray(cfgSnap.data().arvore)) ? cfgSnap.data().arvore : [];
      arvoreParedes = (cfgParedes.exists && Array.isArray(cfgParedes.data().arvore)) ? cfgParedes.data().arvore : [];
      arvoreTeto = (cfgTeto.exists && Array.isArray(cfgTeto.data().arvore)) ? cfgTeto.data().arvore : [];
      pecasAcabamento = listaAcab;
      areasTeto = listaTeto;
      renderizar();
    } catch (e) {
      console.error('Erro ao carregar levantamento de pintura:', e);
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

  // ── Árvore própria da Pintura ──
  function _acharNode(id, nodes = arvore, path = []) {
    for (const n of nodes) {
      if (n.id === id) return { node: n, path: [...path, n.nome] };
      if (n.filhos && n.filhos.length) {
        const r = _acharNode(id, n.filhos, [...path, n.nome]);
        if (r) return r;
      }
    }
    return null;
  }
  function _idsComDescendentes(node) {
    let out = [node.id];
    (node.filhos || []).forEach(f => { out = out.concat(_idsComDescendentes(f)); });
    return out;
  }
  function _removerNode(id, nodes = arvore) {
    const i = nodes.findIndex(n => n.id === id);
    if (i !== -1) { nodes.splice(i, 1); return true; }
    for (const n of nodes) { if (n.filhos && _removerNode(id, n.filhos)) return true; }
    return false;
  }
  function _ordenarNodes(nodes) {
    return (nodes || []).slice().sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' }));
  }
  function _breadcrumb(nodeId) {
    const r = _acharNode(nodeId);
    return r ? r.path.join(' › ') : '';
  }

  // ── Árvores externas (Paredes / Teto) — genéricas, só leitura ──
  function _acharNodeGen(id, nodes, path = []) {
    for (const n of nodes) {
      if (n.id === id) return { node: n, path: [...path, n.nome] };
      if (n.filhos && n.filhos.length) {
        const r = _acharNodeGen(id, n.filhos, [...path, n.nome]);
        if (r) return r;
      }
    }
    return null;
  }
  function _idsComDescendentesGen(node) {
    let out = [node.id];
    (node.filhos || []).forEach(f => { out = out.concat(_idsComDescendentesGen(f)); });
    return out;
  }
  function _listaNosFlatGen(nodes, path = [], out = []) {
    _ordenarNodes(nodes).forEach(n => {
      out.push({ id: n.id, label: [...path, n.nome].join(' › ') });
      _listaNosFlatGen(n.filhos || [], [...path, n.nome], out);
    });
    return out;
  }
  function _breadcrumbParedes(nodeId) { const r = _acharNodeGen(nodeId, arvoreParedes); return r ? r.path.join(' › ') : '(local removido)'; }
  function _breadcrumbTeto(nodeId) { const r = _acharNodeGen(nodeId, arvoreTeto); return r ? r.path.join(' › ') : '(local removido)'; }

  // Conjunto de nodeIds (Paredes) alcançados por este nó de Pintura + seus
  // sublocais de Pintura (Set — dedupe automático evita contagem dupla se
  // um nó pai e um filho apontarem pro mesmo galho da árvore de origem).
  function _targetIdsParede(pnode) {
    const set = new Set();
    _idsComDescendentes(pnode).forEach(pid => {
      const r = _acharNode(pid);
      if (r && r.node.paredesNodeId) {
        const alvo = _acharNodeGen(r.node.paredesNodeId, arvoreParedes);
        if (alvo) _idsComDescendentesGen(alvo.node).forEach(id => set.add(id));
      }
    });
    return set;
  }
  function _targetIdsTeto(pnode) {
    const set = new Set();
    _idsComDescendentes(pnode).forEach(pid => {
      const r = _acharNode(pid);
      if (r && r.node.tetoNodeId) {
        const alvo = _acharNodeGen(r.node.tetoNodeId, arvoreTeto);
        if (alvo) _idsComDescendentesGen(alvo.node).forEach(id => set.add(id));
      }
    });
    return set;
  }
  // Todos os alvos da árvore inteira de uma vez (pra totais gerais sem
  // depender de percorrer raiz por raiz).
  function _todosTargetIds(tipo) {
    const set = new Set();
    (function walk(nodes) {
      nodes.forEach(n => {
        if (tipo === 'parede' && n.paredesNodeId) {
          const alvo = _acharNodeGen(n.paredesNodeId, arvoreParedes);
          if (alvo) _idsComDescendentesGen(alvo.node).forEach(id => set.add(id));
        }
        if (tipo === 'teto' && n.tetoNodeId) {
          const alvo = _acharNodeGen(n.tetoNodeId, arvoreTeto);
          if (alvo) _idsComDescendentesGen(alvo.node).forEach(id => set.add(id));
        }
        walk(n.filhos || []);
      });
    })(arvore);
    return set;
  }

  // ══════════════════════════════════════════
  // CÁLCULOS
  // ══════════════════════════════════════════
  // Parede: mesma fórmula da área líquida de LP.acabamento — recalculada
  // aqui pra não depender do módulo de Paredes (peça já traz seus campos).
  function _areaLiquidaAcab(p) {
    const compM = num(p.comprimento) / 100;
    const altM = num(p.altura) / 100;
    const areaBruta = compM * altM;
    const areaVaos = (p.vaos || []).reduce((s, v) => {
      const compV = num(v.comprimento) / 100, altV = num(v.altura) / 100, qtdV = num(v.qtd) || 1;
      return s + (compV > 0 && altV > 0 ? compV * altV * qtdV : 0);
    }, 0);
    return Math.max(0, areaBruta - areaVaos);
  }
  function _pinturaM2Peca(p) {
    if (!p.temPintura || !(p.pintura || []).length) return 0;
    const area = _areaLiquidaAcab(p);
    return (p.pintura || []).reduce((s, pt) => s + area * (num(pt.pct) / 100), 0);
  }
  function _pinturaPorCorPeca(p, acc) {
    if (!p.temPintura || !(p.pintura || []).length) return;
    const area = _areaLiquidaAcab(p);
    (p.pintura || []).forEach(pt => {
      const cor = pt.cor || '(sem nome)';
      acc[cor] = (acc[cor] || 0) + area * (num(pt.pct) / 100);
    });
  }
  function _pinturaM2Area(a) {
    if (!a.temPintura || !(a.pintura || []).length) return 0;
    return (a.pintura || []).reduce((s, pt) => s + (a.areaM2 || 0) * (num(pt.pct) / 100), 0);
  }
  function _pinturaPorCorArea(a, acc) {
    if (!a.temPintura || !(a.pintura || []).length) return;
    (a.pintura || []).forEach(pt => {
      const cor = pt.cor || '(sem nome)';
      acc[cor] = (acc[cor] || 0) + (a.areaM2 || 0) * (num(pt.pct) / 100);
    });
  }

  function _totaisParede(idsSet) {
    const lista = pecasAcabamento.filter(p => idsSet.has(p.nodeId));
    const porCor = {};
    let total = 0, comPintura = 0;
    lista.forEach(p => {
      const m2 = _pinturaM2Peca(p);
      total += m2;
      if (p.temPintura) comPintura++;
      _pinturaPorCorPeca(p, porCor);
    });
    return { lista, total, porCor, qtd: lista.length, comPintura };
  }
  function _totaisTeto(idsSet) {
    const lista = areasTeto.filter(a => idsSet.has(a.nodeId));
    const porCor = {};
    let total = 0, comPintura = 0;
    lista.forEach(a => {
      const m2 = _pinturaM2Area(a);
      total += m2;
      if (a.temPintura) comPintura++;
      _pinturaPorCorArea(a, porCor);
    });
    return { lista, total, porCor, qtd: lista.length, comPintura };
  }
  function _mesclarPorCor(a, b) {
    const out = {};
    Object.entries(a).forEach(([k, v]) => { out[k] = (out[k] || 0) + v; });
    Object.entries(b).forEach(([k, v]) => { out[k] = (out[k] || 0) + v; });
    return out;
  }

  // ══════════════════════════════════════════
  // RENDER — SHELL
  // ══════════════════════════════════════════
  function renderizar() {
    const c = document.getElementById('lpt-content');
    if (!c) return;
    c.innerHTML = `
      <div class="page-header">
        <div>
          <h2>🎨 Levantamento de Pintura</h2>
          <span class="subtitulo">Alimentado por Paredes (Acabamento) e Teto · vincule cada local e acompanhe o dash por cor</span>
        </div>
      </div>
      <div class="ar-layout">
        <div class="ar-tree">
          <div class="ar-tree-header">
            <h3>Locais</h3>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-secundario btn-sm" onclick="LPT.novoNode(null)">+ Local</button>
            </div>
          </div>
          <div class="ar-tree-body">${_renderArvore()}</div>
        </div>
        <div class="ar-painel">${_renderPainel()}</div>
      </div>`;
  }

  function _renderArvoreNivel(nodes) {
    return _ordenarNodes(nodes).map(n => {
      const aberto = openNodes.has(n.id);
      const ativo = selNodeId === n.id;
      const idsSet = new Set(_idsComDescendentes(n));
      idsSet.delete(n.id);
      const temLink = !!(n.paredesNodeId || n.tetoNodeId);
      const ehFolha = !(n.filhos || []).length;
      const semVinculo = ehFolha && !temLink;
      let h = `<div class="tree-item${ativo ? ' ativo' : ''}" onclick="LPT.toggleNode('${n.id}');LPT.selNode('${n.id}')">
        <span class="tree-toggle">${(n.filhos || []).length ? (aberto ? '▼' : '▶') : ''}</span>
        <span class="tree-icon">${temLink ? '🔗' : (semVinculo ? '⚠️' : '📍')}</span>
        <span class="tree-label">${esc(n.nome)}</span>
        <button class="tree-edit-btn" onclick="event.stopPropagation();LPT.renomearNode('${n.id}')" title="Renomear">✎</button>
        <button class="tree-del-btn" onclick="event.stopPropagation();LPT.excluirNode('${n.id}')" title="Excluir">✕</button>
      </div>`;
      if (aberto) {
        h += `<div class="tree-children">`;
        h += _renderArvoreNivel(n.filhos || []);
        h += `<div class="ar-add-inline" onclick="event.stopPropagation();LPT.novoNode('${n.id}')">+ adicionar sublocal</div>`;
        h += `</div>`;
      }
      return h;
    }).join('');
  }

  function _renderArvore() {
    let h = `<div class="tree-item${!selNodeId ? ' ativo' : ''}" onclick="LPT.selGeral()">
      <span class="tree-toggle"></span><span class="tree-icon">📊</span>
      <span class="tree-label"><strong>Visão Geral</strong></span>
    </div>`;
    if (!arvore.length) {
      h += `<div class="estado-vazio"><p class="text-sm">Nenhum local cadastrado. Clique em "+ Local" para começar (ex: Torre, Andar, Apto, Cômodo).</p></div>`;
      return h;
    }
    h += _renderArvoreNivel(arvore);
    return h;
  }

  function selGeral() { selNodeId = null; renderizar(); }
  function selNode(id) { selNodeId = id; renderizar(); }
  function toggleNode(id) { if (openNodes.has(id)) openNodes.delete(id); else openNodes.add(id); }
  function setPintAba(a) { pintAba = a; renderizar(); }

  // ══════════════════════════════════════════
  // CRUD DE NÓS
  // ══════════════════════════════════════════
  function novoNode(parentId) {
    nodeModo = parentId ? 'novo-filho' : 'novo-raiz';
    nodeParentId = parentId; nodeEditId = null;
    document.getElementById('lpt-node-titulo').textContent = parentId ? 'Novo Sublocal' : 'Novo Local';
    document.getElementById('lpt-node-nome').value = '';
    Utils.abrirModal('modal-lpt-node');
    setTimeout(() => document.getElementById('lpt-node-nome')?.focus(), 60);
  }
  function renomearNode(id) {
    const r = _acharNode(id); if (!r) return;
    nodeModo = 'renomear'; nodeEditId = id; nodeParentId = null;
    document.getElementById('lpt-node-titulo').textContent = 'Renomear Local';
    document.getElementById('lpt-node-nome').value = r.node.nome;
    Utils.abrirModal('modal-lpt-node');
    setTimeout(() => document.getElementById('lpt-node-nome')?.focus(), 60);
  }
  async function salvarNode() {
    const nome = document.getElementById('lpt-node-nome').value.trim();
    if (!nome) { Utils.toast('Informe um nome.', 'alerta'); return; }
    if (nodeModo === 'renomear') {
      const r = _acharNode(nodeEditId);
      if (r) r.node.nome = nome;
    } else if (nodeModo === 'novo-filho') {
      const r = _acharNode(nodeParentId);
      if (r) { r.node.filhos = r.node.filhos || []; r.node.filhos.push({ id: _uid(), nome, filhos: [], paredesNodeId: null, tetoNodeId: null }); openNodes.add(nodeParentId); }
    } else {
      arvore.push({ id: _uid(), nome, filhos: [], paredesNodeId: null, tetoNodeId: null });
    }
    try {
      await _salvarArvore();
      Utils.fecharModal('modal-lpt-node');
      Utils.toast('✓ Salvo!', 'sucesso');
      renderizar();
    } catch (e) { Utils.toast('Erro ao salvar: ' + e.message, 'erro'); }
  }
  async function excluirNode(id) {
    const r = _acharNode(id); if (!r) return;
    const temFilhos = r.node.filhos && r.node.filhos.length;
    const ok = Utils.confirmar(`Excluir o local "${r.node.nome}"${temFilhos ? ' e seus sublocais' : ''}? (Isso só remove o agrupamento da Pintura — não apaga nada em Paredes ou Teto.)`);
    if (!ok) return;
    _removerNode(id);
    if (selNodeId && _idsComDescendentes(r.node).includes(selNodeId)) selNodeId = null;
    try {
      await _salvarArvore();
      Utils.toast('Local excluído.', 'sucesso');
      renderizar();
    } catch (e) { Utils.toast('Erro ao excluir: ' + e.message, 'erro'); }
  }

  // ══════════════════════════════════════════
  // VÍNCULO (Pintura → Paredes / Teto)
  // ══════════════════════════════════════════
  function abrirVincular(id) {
    const r = _acharNode(id); if (!r) return;
    vincNodeId = id;
    vincParedesSel = r.node.paredesNodeId || null;
    vincTetoSel = r.node.tetoNodeId || null;
    vincBuscaParedes = ''; vincBuscaTeto = '';
    document.getElementById('lpt-vinc-titulo').textContent = 'Vincular Local: ' + r.node.nome;
    _renderVinculoModal();
    Utils.abrirModal('modal-lpt-vinc');
  }
  function _renderVinculoModal() {
    const body = document.getElementById('lpt-vinc-body'); if (!body) return;
    const listaP = _listaNosFlatGen(arvoreParedes).filter(x => !vincBuscaParedes.trim() || x.label.toLowerCase().includes(vincBuscaParedes.trim().toLowerCase()));
    const listaT = _listaNosFlatGen(arvoreTeto).filter(x => !vincBuscaTeto.trim() || x.label.toLowerCase().includes(vincBuscaTeto.trim().toLowerCase()));
    const item = (x, sel, onclick) => `<div class="tree-item${sel === x.id ? ' ativo' : ''}" style="cursor:pointer;" onclick="${onclick}('${x.id}')">
      <span class="tree-icon">📍</span><span class="tree-label">${esc(x.label)}</span>
    </div>`;
    body.innerHTML = `
      <div class="form-row">
        <div class="form-grupo" style="flex:1;">
          <label>🧱 Local em Paredes (Acabamento)</label>
          <input type="text" class="form-control" placeholder="🔎 Buscar..." value="${esc(vincBuscaParedes)}" oninput="LPT.onBuscaVincParedes(this.value)">
          <div style="border:1px solid var(--cor-borda-light);border-radius:8px;max-height:220px;overflow-y:auto;margin-top:6px;">
            <div class="tree-item${!vincParedesSel ? ' ativo' : ''}" style="cursor:pointer;" onclick="LPT.selVincParedes('')"><span class="tree-icon">✕</span><span class="tree-label text-muted">Nenhum</span></div>
            ${!listaP.length ? `<div class="cc-empty">Nenhum local em Paredes ainda.</div>` : listaP.map(x => item(x, vincParedesSel, 'LPT.selVincParedes')).join('')}
          </div>
        </div>
        <div class="form-grupo" style="flex:1;">
          <label>🔲 Local em Teto</label>
          <input type="text" class="form-control" placeholder="🔎 Buscar..." value="${esc(vincBuscaTeto)}" oninput="LPT.onBuscaVincTeto(this.value)">
          <div style="border:1px solid var(--cor-borda-light);border-radius:8px;max-height:220px;overflow-y:auto;margin-top:6px;">
            <div class="tree-item${!vincTetoSel ? ' ativo' : ''}" style="cursor:pointer;" onclick="LPT.selVincTeto('')"><span class="tree-icon">✕</span><span class="tree-label text-muted">Nenhum</span></div>
            ${!listaT.length ? `<div class="cc-empty">Nenhum local em Teto ainda.</div>` : listaT.map(x => item(x, vincTetoSel, 'LPT.selVincTeto')).join('')}
          </div>
        </div>
      </div>
      <p class="text-sm text-muted" style="margin-top:10px;">Dica: vincule os locais FOLHA (cômodos) da Pintura direto ao cômodo correspondente em Paredes/Teto, pra evitar contar a mesma área duas vezes.</p>
    `;
  }
  function onBuscaVincParedes(v) { vincBuscaParedes = v; _renderVinculoModal(); }
  function onBuscaVincTeto(v) { vincBuscaTeto = v; _renderVinculoModal(); }
  function selVincParedes(id) { vincParedesSel = id || null; _renderVinculoModal(); }
  function selVincTeto(id) { vincTetoSel = id || null; _renderVinculoModal(); }
  async function salvarVinculo() {
    const r = _acharNode(vincNodeId); if (!r) return;
    r.node.paredesNodeId = vincParedesSel || null;
    r.node.tetoNodeId = vincTetoSel || null;
    try {
      await _salvarArvore();
      Utils.fecharModal('modal-lpt-vinc');
      Utils.toast('✓ Vínculo salvo!', 'sucesso');
      renderizar();
    } catch (e) { Utils.toast('Erro ao salvar: ' + e.message, 'erro'); }
  }

  // ══════════════════════════════════════════
  // PAINEL — VISÃO GERAL
  // ══════════════════════════════════════════
  function _barras(obj) {
    const entries = Object.entries(obj).sort((a, b) => b[1] - a[1]);
    if (!entries.length) return `<p class="text-sm" style="color:var(--cor-texto-muted);padding:4px 0;">Nenhuma pintura lançada ainda.</p>`;
    const max = Math.max(...entries.map(e => e[1])) || 1;
    return entries.map(([k, v]) => `
      <div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:4px;">
          <span>${esc(k)}</span><span style="font-family:var(--font-mono);font-weight:700;">${fmt2(v)} m²</span>
        </div>
        <div style="background:var(--cor-fundo);border-radius:4px;height:8px;overflow:hidden;">
          <div style="width:${(v / max * 100).toFixed(1)}%;height:100%;background:var(--cv-blue,#3b82f6);"></div>
        </div>
      </div>`).join('');
  }

  function _nosSemVinculo() {
    const out = [];
    (function walk(nodes) {
      nodes.forEach(n => {
        const ehFolha = !(n.filhos || []).length;
        if (ehFolha && !n.paredesNodeId && !n.tetoNodeId) out.push(n);
        walk(n.filhos || []);
      });
    })(arvore);
    return out;
  }

  function _renderPainel() {
    if (!selNodeId) return _renderVisaoGeral();
    const r = _acharNode(selNodeId);
    if (!r) { selNodeId = null; return _renderVisaoGeral(); }
    return _renderNode(r);
  }

  function _renderVisaoGeral() {
    const idsP = _todosTargetIds('parede');
    const idsT = _todosTargetIds('teto');
    const tP = _totaisParede(idsP);
    const tT = _totaisTeto(idsT);
    const porCorTotal = _mesclarPorCor(tP.porCor, tT.porCor);
    const semVinculo = _nosSemVinculo();

    return `
      <div class="page-header">
        <div><h2 style="font-size:1.1rem;">📊 Visão Geral — Pintura</h2>
          <span class="subtitulo">${tP.qtd + tT.qtd} lançamento(s) de origem · ${fmt2(tP.total + tT.total)} m² pintados</span></div>
      </div>
      <div class="cc-kpiGrid" style="grid-template-columns:repeat(3,1fr);">
        <div class="cc-kpi"><div class="cc-kpiIcon">🎨</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Total Pintura</div><div class="cc-kpiValue">${fmt2(tP.total + tT.total)}<span class="cc-kpiUnit">m²</span></div></div></div>
        <div class="cc-kpi"><div class="cc-kpiIcon">🧱</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Pintura de Parede</div><div class="cc-kpiValue">${fmt2(tP.total)}<span class="cc-kpiUnit">m²</span></div></div></div>
        <div class="cc-kpi"><div class="cc-kpiIcon">🔲</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Pintura de Teto</div><div class="cc-kpiValue">${fmt2(tT.total)}<span class="cc-kpiUnit">m²</span></div></div></div>
      </div>

      ${semVinculo.length ? `<div class="cc-panel" style="border-color:#f59e0b;">
        <div class="cc-panelTitle">⚠️ ${semVinculo.length} local(is) sem vínculo</div>
        <p class="text-sm text-muted">Esses locais ainda não têm nenhum vínculo com Paredes ou Teto — não entram nos totais. Clique no local na árvore e depois em "🔗 Vincular Local".</p>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">
          ${semVinculo.map(n => `<span class="badge badge-alerta" style="cursor:pointer;" onclick="LPT.selNode('${n.id}')">${esc(n.nome)}</span>`).join('')}
        </div>
      </div>` : ''}

      <div class="cc-panel">
        <div class="cc-panelTitle">🎨 Pintura por Cor (Parede + Teto)</div>
        ${_barras(porCorTotal)}
      </div>

      <div class="cc-panel">
        <div class="cc-panelTitle">📍 Resumo por Local</div>
        ${!arvore.length ? `<div class="cc-empty">Cadastre locais na árvore ao lado para ver o resumo.</div>` : `
        <div class="tabela-container"><table class="tabela">
          <thead><tr><th>Local</th><th style="text-align:right;">Parede</th><th style="text-align:right;">Teto</th><th style="text-align:right;">Total</th></tr></thead>
          <tbody>
            ${_ordenarNodes(arvore).map(raiz => {
              const rP = _totaisParede(_targetIdsParede(raiz));
              const rT = _totaisTeto(_targetIdsTeto(raiz));
              return `<tr style="cursor:pointer;" onclick="LPT.selNode('${raiz.id}')"><td><strong>${esc(raiz.nome)}</strong></td><td style="text-align:right;">${fmt2(rP.total)}</td><td style="text-align:right;">${fmt2(rT.total)}</td><td style="text-align:right;"><strong>${fmt2(rP.total + rT.total)}</strong></td></tr>`;
            }).join('')}
          </tbody>
        </table></div>`}
      </div>`;
  }

  // ══════════════════════════════════════════
  // PAINEL — NÓ SELECIONADO
  // ══════════════════════════════════════════
  function _renderNode(r) {
    const n = r.node;
    const temLink = !!(n.paredesNodeId || n.tetoNodeId);
    const idsP = _targetIdsParede(n);
    const idsT = _targetIdsTeto(n);
    const tP = _totaisParede(idsP);
    const tT = _totaisTeto(idsT);

    const cabecalho = `
      <div class="page-header">
        <div>
          <h2 style="font-size:1.1rem;">📍 ${esc(r.path.join(' › '))}</h2>
          <span class="subtitulo">
            ${n.paredesNodeId ? `🧱 ${esc(_breadcrumbParedes(n.paredesNodeId))}` : '🧱 <span class="text-muted">sem vínculo de parede</span>'}
            &nbsp;·&nbsp;
            ${n.tetoNodeId ? `🔲 ${esc(_breadcrumbTeto(n.tetoNodeId))}` : '🔲 <span class="text-muted">sem vínculo de teto</span>'}
          </span>
        </div>
        <button class="btn btn-secundario btn-sm" onclick="LPT.abrirVincular('${n.id}')">🔗 Vincular Local</button>
      </div>`;

    if (!temLink) {
      return cabecalho + `<div class="estado-vazio"><div class="icone">🔗</div><p>Este local ainda não está vinculado a nenhum ponto de Paredes ou Teto.</p>
        <button class="btn btn-primario btn-sm" onclick="LPT.abrirVincular('${n.id}')">Vincular agora</button></div>`;
    }

    return cabecalho + `
      <div class="aba-toggle mb-2">
        <button class="aba-btn ${pintAba === 'parede' ? 'ativo' : ''}" onclick="LPT.setPintAba('parede')">🧱 Parede (${tP.qtd})</button>
        <button class="aba-btn ${pintAba === 'teto' ? 'ativo' : ''}" onclick="LPT.setPintAba('teto')">🔲 Teto (${tT.qtd})</button>
        <button class="aba-btn ${pintAba === 'consolidado' ? 'ativo' : ''}" onclick="LPT.setPintAba('consolidado')">📊 Consolidado</button>
      </div>
      ${pintAba === 'parede' ? _renderAbaParede(n, tP) : pintAba === 'teto' ? _renderAbaTeto(n, tT) : _renderAbaConsolidado(tP, tT)}
    `;
  }

  function _renderAbaConsolidado(tP, tT) {
    const porCor = _mesclarPorCor(tP.porCor, tT.porCor);
    return `
      <div class="cc-kpiGrid" style="grid-template-columns:repeat(3,1fr);">
        <div class="cc-kpi"><div class="cc-kpiIcon">🎨</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Total</div><div class="cc-kpiValue">${fmt2(tP.total + tT.total)}<span class="cc-kpiUnit">m²</span></div></div></div>
        <div class="cc-kpi"><div class="cc-kpiIcon">🧱</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Parede</div><div class="cc-kpiValue">${fmt2(tP.total)}<span class="cc-kpiUnit">m²</span></div></div></div>
        <div class="cc-kpi"><div class="cc-kpiIcon">🔲</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Teto</div><div class="cc-kpiValue">${fmt2(tT.total)}<span class="cc-kpiUnit">m²</span></div></div></div>
      </div>
      <div class="cc-panel"><div class="cc-panelTitle">🎨 Pintura por Cor</div>${_barras(porCor)}</div>`;
  }

  function _renderAbaParede(n, t) {
    return `
      <div class="cc-kpiGrid" style="grid-template-columns:repeat(3,1fr);">
        <div class="cc-kpi"><div class="cc-kpiIcon">🧱</div><div class="cc-kpiBody"><div class="cc-kpiLabel">M² Pintura Parede</div><div class="cc-kpiValue">${fmt2(t.total)}<span class="cc-kpiUnit">m²</span></div></div></div>
        <div class="cc-kpi"><div class="cc-kpiIcon">✅</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Faces com Pintura</div><div class="cc-kpiValue">${t.comPintura}<span class="cc-kpiUnit">/ ${t.qtd}</span></div></div></div>
        <div class="cc-kpi" style="display:flex;align-items:center;justify-content:center;">
          <button class="btn btn-secundario btn-sm" onclick="LPT.abrirMassa('${n.id}','parede')">🖌️ Aplicar em massa</button>
        </div>
      </div>
      <div class="cc-panel"><div class="cc-panelTitle">🎨 Pintura por Cor</div>${_barras(t.porCor)}</div>
      <div class="cc-panel">
        <div class="cc-panelTitle">🧱 Faces de Acabamento vinculadas</div>
        ${!t.lista.length ? `<div class="cc-empty">Nenhuma face de acabamento encontrada no local vinculado. Lance as faces em Levantamento de Paredes.</div>` : `
        <div class="tabela-container"><table class="tabela">
          <thead><tr><th>Face</th><th>Local (Paredes)</th><th style="text-align:right;">m²</th><th>Pintura</th><th></th></tr></thead>
          <tbody>
            ${t.lista.map(p => {
              const m2 = _pinturaM2Peca(p);
              const cores = p.temPintura ? (p.pintura || []).map(pt => `${esc(pt.cor || '?')} ${num(pt.pct)}%`).join(', ') : '<span class="text-muted">sem pintura</span>';
              return `<tr>
                <td>${esc(p.nome || '(sem nome)')}</td>
                <td class="text-sm text-muted">${esc(_breadcrumbParedes(p.nodeId))}</td>
                <td style="text-align:right;">${fmt2(m2)}</td>
                <td class="text-sm">${cores}</td>
                <td><button class="btn btn-secundario btn-sm" onclick="LPT.editarPintura('parede','${p.id}')">✎ Editar</button></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table></div>`}
      </div>`;
  }

  function _renderAbaTeto(n, t) {
    return `
      <div class="cc-kpiGrid" style="grid-template-columns:repeat(3,1fr);">
        <div class="cc-kpi"><div class="cc-kpiIcon">🔲</div><div class="cc-kpiBody"><div class="cc-kpiLabel">M² Pintura Teto</div><div class="cc-kpiValue">${fmt2(t.total)}<span class="cc-kpiUnit">m²</span></div></div></div>
        <div class="cc-kpi"><div class="cc-kpiIcon">✅</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Áreas com Pintura</div><div class="cc-kpiValue">${t.comPintura}<span class="cc-kpiUnit">/ ${t.qtd}</span></div></div></div>
        <div class="cc-kpi" style="display:flex;align-items:center;justify-content:center;">
          <button class="btn btn-secundario btn-sm" onclick="LPT.abrirMassa('${n.id}','teto')">🖌️ Aplicar em massa</button>
        </div>
      </div>
      <div class="cc-panel"><div class="cc-panelTitle">🎨 Pintura por Cor</div>${_barras(t.porCor)}</div>
      <div class="cc-panel">
        <div class="cc-panelTitle">🔲 Áreas de Teto vinculadas</div>
        ${!t.lista.length ? `<div class="cc-empty">Nenhuma área de teto encontrada no local vinculado. Meça as áreas em Levantamento de Teto.</div>` : `
        <div class="tabela-container"><table class="tabela">
          <thead><tr><th>Área</th><th>Local (Teto)</th><th style="text-align:right;">m²</th><th>Pintura</th><th></th></tr></thead>
          <tbody>
            ${t.lista.map(a => {
              const m2 = _pinturaM2Area(a);
              const cores = a.temPintura ? (a.pintura || []).map(pt => `${esc(pt.cor || '?')} ${num(pt.pct)}%`).join(', ') : '<span class="text-muted">sem pintura</span>';
              return `<tr>
                <td>${esc(a.nome || '(sem nome)')}</td>
                <td class="text-sm text-muted">${esc(_breadcrumbTeto(a.nodeId))}</td>
                <td style="text-align:right;">${fmt2(m2)}</td>
                <td class="text-sm">${cores}</td>
                <td><button class="btn btn-secundario btn-sm" onclick="LPT.editarPintura('teto','${a.id}')">✎ Editar</button></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table></div>`}
      </div>`;
  }

  // ══════════════════════════════════════════
  // EDITAR PINTURA (peça/área — grava direto na origem)
  // ══════════════════════════════════════════
  function editarPintura(tipo, id) {
    editTipo = tipo; editId = id;
    const src = tipo === 'parede' ? pecasAcabamento.find(x => x.id === id) : areasTeto.find(x => x.id === id);
    if (!src) return;
    editTemPintura = !!src.temPintura;
    editForm = (src.pintura && src.pintura.length) ? JSON.parse(JSON.stringify(src.pintura)) : [{ cor: '', hex: '#ffffff', pct: 100 }];
    document.getElementById('lpt-edit-titulo').textContent = (tipo === 'parede' ? '🧱 ' : '🔲 ') + (src.nome || 'Pintura');
    _renderEditModal();
    Utils.abrirModal('modal-lpt-edit');
  }
  function _somaPct(arr) { return (arr || []).reduce((s, x) => s + num(x.pct), 0); }
  function _renderEditModal() {
    const body = document.getElementById('lpt-edit-body'); if (!body) return;
    const soma = _somaPct(editForm);
    body.innerHTML = `
      <div class="form-check mb-2">
        <input type="checkbox" id="lpt-edit-check" ${editTemPintura ? 'checked' : ''} onchange="LPT.toggleEditPintura(this.checked)">
        <label for="lpt-edit-check">Tem pintura?</label>
      </div>
      <div id="lpt-edit-lista">${editTemPintura ? _renderEditLista() : ''}</div>
      ${editTemPintura ? `<div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
        <button class="btn btn-secundario btn-sm" onclick="LPT.addEditItem()">+ cor</button>
        <span class="text-sm" id="lpt-edit-soma" style="color:${Math.abs(soma - 100) < 0.01 ? '#16a34a' : '#ef4444'};font-weight:700;">${fmt2(soma)}%</span>
      </div>` : ''}
    `;
  }
  function _renderEditLista() {
    return editForm.map((pt, i) => `
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
        <input type="color" value="${esc(pt.hex || '#ffffff')}" style="width:34px;height:34px;border:1px solid #e2e8f0;border-radius:6px;padding:0;flex-shrink:0;" onchange="LPT.updEditItem(${i},'hex',this.value)">
        <input type="text" class="form-control" style="flex:1.4;" placeholder="Nome da cor" value="${esc(pt.cor)}" oninput="LPT.updEditItem(${i},'cor',this.value)">
        <input type="number" class="form-control" style="flex:0.7;" step="1" min="0" max="100" value="${esc(pt.pct)}" oninput="LPT.updEditItem(${i},'pct',this.value)">
        ${editForm.length > 1 ? `<button type="button" class="btn btn-secundario btn-sm" onclick="LPT.remEditItem(${i})">✕</button>` : ''}
      </div>`).join('');
  }
  function toggleEditPintura(checked) {
    editTemPintura = checked;
    if (checked && !editForm.length) editForm.push({ cor: '', hex: '#ffffff', pct: 100 });
    _renderEditModal();
  }
  function addEditItem() { editForm.push({ cor: '', hex: '#ffffff', pct: 0 }); _renderEditModal(); }
  function remEditItem(i) { editForm.splice(i, 1); _renderEditModal(); }
  function updEditItem(i, campo, valor) {
    editForm[i][campo] = valor;
    if (campo === 'pct') {
      const soma = _somaPct(editForm);
      const el = document.getElementById('lpt-edit-soma');
      if (el) { el.textContent = fmt2(soma) + '%'; el.style.color = Math.abs(soma - 100) < 0.01 ? '#16a34a' : '#ef4444'; }
    }
  }
  async function salvarEdicaoPintura() {
    if (editTemPintura) {
      const soma = _somaPct(editForm);
      if (Math.abs(soma - 100) > 0.01) { Utils.toast(`A soma dos % deve ser 100% (está em ${fmt2(soma)}%).`, 'alerta'); return; }
    }
    const dados = {
      temPintura: editTemPintura,
      pintura: editTemPintura ? editForm.map(p => ({ cor: p.cor || '', hex: p.hex || '#ffffff', pct: num(p.pct) })) : [],
    };
    const col = editTipo === 'parede' ? COL_ACAB : COL_TETO_AREAS;
    try {
      await Database.atualizar(obraId, col, editId, dados);
      const lista = editTipo === 'parede' ? pecasAcabamento : areasTeto;
      const item = lista.find(x => x.id === editId);
      if (item) Object.assign(item, dados);
      Utils.fecharModal('modal-lpt-edit');
      Utils.toast('✓ Pintura atualizada!', 'sucesso');
      renderizar();
    } catch (e) { Utils.toast('Erro ao salvar: ' + e.message, 'erro'); }
  }

  // ══════════════════════════════════════════
  // APLICAR EM MASSA
  // ══════════════════════════════════════════
  function abrirMassa(nodeId, tipo) {
    massaNodeId = nodeId; massaTipo = tipo; massaIncluirSublocais = true;
    massaForm = [{ cor: '', hex: '#ffffff', pct: 100 }];
    document.getElementById('lpt-massa-titulo').textContent = 'Aplicar Pintura em Massa — ' + (tipo === 'parede' ? '🧱 Parede' : '🔲 Teto');
    _renderMassaModal();
    Utils.abrirModal('modal-lpt-massa');
  }
  function _alvoMassaNode() {
    const r = _acharNode(massaNodeId); if (!r) return null;
    return massaIncluirSublocais ? r.node : { ...r.node, filhos: [] };
  }
  function _listaMassaAtual() {
    const alvo = _alvoMassaNode(); if (!alvo) return [];
    return massaTipo === 'parede'
      ? pecasAcabamento.filter(p => _targetIdsParede(alvo).has(p.nodeId))
      : areasTeto.filter(a => _targetIdsTeto(alvo).has(a.nodeId));
  }
  function _renderMassaModal() {
    const body = document.getElementById('lpt-massa-body'); if (!body) return;
    const soma = _somaPct(massaForm);
    const qtd = _listaMassaAtual().length;
    body.innerHTML = `
      <p class="text-sm text-muted mb-2">Isso substitui a mistura de cor/% em TODAS as ${massaTipo === 'parede' ? 'faces de acabamento' : 'áreas de teto'} listadas abaixo. Não dá pra desfazer — confira antes de aplicar.</p>
      <div class="form-check mb-2">
        <input type="checkbox" id="lpt-massa-sub" ${massaIncluirSublocais ? 'checked' : ''} onchange="LPT.toggleMassaSublocais(this.checked)">
        <label for="lpt-massa-sub">Incluir sublocais</label>
      </div>
      <div style="background:var(--cor-fundo);border-radius:8px;padding:8px 14px;margin-bottom:12px;font-size:0.82rem;">
        <strong>${qtd}</strong> ${massaTipo === 'parede' ? 'face(s)' : 'área(s)'} será(ão) atualizada(s).
      </div>
      <div id="lpt-massa-lista">${massaForm.map((pt, i) => `
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
          <input type="color" value="${esc(pt.hex || '#ffffff')}" style="width:34px;height:34px;border:1px solid #e2e8f0;border-radius:6px;padding:0;flex-shrink:0;" onchange="LPT.updMassaItem(${i},'hex',this.value)">
          <input type="text" class="form-control" style="flex:1.4;" placeholder="Nome da cor" value="${esc(pt.cor)}" oninput="LPT.updMassaItem(${i},'cor',this.value)">
          <input type="number" class="form-control" style="flex:0.7;" step="1" min="0" max="100" value="${esc(pt.pct)}" oninput="LPT.updMassaItem(${i},'pct',this.value)">
          ${massaForm.length > 1 ? `<button type="button" class="btn btn-secundario btn-sm" onclick="LPT.remMassaItem(${i})">✕</button>` : ''}
        </div>`).join('')}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <button class="btn btn-secundario btn-sm" onclick="LPT.addMassaItem()">+ cor</button>
        <span class="text-sm" style="color:${Math.abs(soma - 100) < 0.01 ? '#16a34a' : '#ef4444'};font-weight:700;">${fmt2(soma)}%</span>
      </div>
    `;
  }
  function toggleMassaSublocais(v) { massaIncluirSublocais = v; _renderMassaModal(); }
  function addMassaItem() { massaForm.push({ cor: '', hex: '#ffffff', pct: 0 }); _renderMassaModal(); }
  function remMassaItem(i) { massaForm.splice(i, 1); _renderMassaModal(); }
  function updMassaItem(i, campo, valor) { massaForm[i][campo] = valor; _renderMassaModal(); }
  async function confirmarMassa() {
    const soma = _somaPct(massaForm);
    if (Math.abs(soma - 100) > 0.01) { Utils.toast(`A soma dos % deve ser 100% (está em ${fmt2(soma)}%).`, 'alerta'); return; }
    const lista = _listaMassaAtual();
    if (!lista.length) { Utils.toast('Nenhum item encontrado para aplicar.', 'alerta'); return; }
    const ok = Utils.confirmar(`Aplicar essa mistura de cor em ${lista.length} item(ns)? Isso substitui a pintura atual de cada um.`);
    if (!ok) return;
    Utils.mostrarLoading('Aplicando...');
    const dados = { temPintura: true, pintura: massaForm.map(p => ({ cor: p.cor || '', hex: p.hex || '#ffffff', pct: num(p.pct) })) };
    const col = massaTipo === 'parede' ? COL_ACAB : COL_TETO_AREAS;
    try {
      const ops = lista.map(item => ({ type: 'update', ref: Database.ref(obraId, col).doc(item.id), data: { ...dados } }));
      for (let i = 0; i < ops.length; i += 400) await Database.batchWrite(ops.slice(i, i + 400));
      lista.forEach(item => Object.assign(item, dados));
      Utils.fecharModal('modal-lpt-massa');
      Utils.toast(`✓ Pintura aplicada em ${lista.length} item(ns)!`, 'sucesso');
      renderizar();
    } catch (e) {
      Utils.toast('Erro ao aplicar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  return {
    init, recarregar,
    selGeral, selNode, toggleNode, setPintAba,
    novoNode, renomearNode, salvarNode, excluirNode,
    abrirVincular, onBuscaVincParedes, onBuscaVincTeto, selVincParedes, selVincTeto, salvarVinculo,
    editarPintura, toggleEditPintura, addEditItem, remEditItem, updEditItem, salvarEdicaoPintura,
    abrirMassa, toggleMassaSublocais, addMassaItem, remMassaItem, updMassaItem, confirmarMassa,
  };
})();

const LPT = LevantamentoPintura;
function onObraChanged() { LevantamentoPintura.recarregar(); }

// ============================================
// Módulo: Levantamento de Paredes
// Árvore de locais genérica e ilimitada em profundidade
// (ex: Torre > 1º Andar > Apto 11 > Cozinha) + peças (paredes).
// Cada parede gera: Alvenaria (Estrutural/Vedação), Gesso Liso,
// Reboco, Revestimento e Pintura (por cor) — por Lado A/B, com
// mistura de acabamentos por % dentro do mesmo lado.
// Altura da Parede (m² de alvenaria) e Altura do Acabamento
// (m² de gesso/reboco/revestimento/pintura) são independentes.
// Dados: Firestore obras/{obraId}/paredesPecas + config/paredesArvore
// ============================================

const LevantamentoParedes = (() => {
  const COL_PECAS = 'paredesPecas';
  const CONFIG_DOC = 'paredesArvore';

  const TIPOS_ACABAMENTO = [
    { id: 'gesso', label: 'Gesso Liso' },
    { id: 'reboco', label: 'Reboco' },
    { id: 'revestimento', label: 'Revestimento' },
    { id: 'fachada', label: 'Fachada (não contabilizado)' },
  ];

  let obraId = null;
  let arvore = [];        // [{id,nome,filhos:[...]}]
  let pecas = [];         // paredesPecas docs
  let openNodes = new Set();
  let selNodeId = null;   // null = Visão Geral

  // Estado modal de nó (criar/renomear)
  let nodeModo = null;    // 'novo-raiz' | 'novo-filho' | 'renomear'
  let nodeParentId = null;
  let nodeEditId = null;

  // Estado modal de parede
  let pecaEditId = null;
  let pecaForm = null;

  // ══════════════════════════════════════════
  // INIT / CARREGAMENTO
  // ══════════════════════════════════════════
  async function init() {
    const ok = await Utils.initPagina({ requireObra: true });
    if (!ok) return;
    obraId = Router.getObraId();
    const main = document.getElementById('lp-content');
    if (!obraId) {
      if (main) main.innerHTML = `<div class="estado-vazio"><div class="icone">🧱</div><p>Selecione uma obra na barra lateral.</p></div>`;
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
    Utils.mostrarLoading('Carregando levantamento de paredes...');
    try {
      const [cfgSnap, lista] = await Promise.all([
        db.collection('obras').doc(obraId).collection('config').doc(CONFIG_DOC).get(),
        Database.listar(obraId, COL_PECAS, null).catch(() => []),
      ]);
      arvore = (cfgSnap.exists && Array.isArray(cfgSnap.data().arvore)) ? cfgSnap.data().arvore : [];
      pecas = lista;
      renderizar();
    } catch (e) {
      console.error('Erro ao carregar levantamento de paredes:', e);
      Utils.toast('Erro ao carregar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  async function _salvarArvore() {
    await db.collection('obras').doc(obraId).collection('config').doc(CONFIG_DOC).set({ arvore }, { merge: true });
  }

  // ══════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════
  function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function _uid() { return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function fmt2(n) { return (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function num(v) { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? 0 : n; }

  // Permite digitar contas simples nos campos de medida (ex: 291+100 + Enter = 391)
  // — mesmo padrão usado no Levantamento de Fachada.
  function calcExprEnter(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const r = _avaliarExpr(e.target.value);
    if (r !== null) {
      e.target.value = _fmtExprResultado(r);
      e.target.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  function _avaliarExpr(str) {
    if (str == null) return null;
    const s = String(str).trim().replace(/,/g, '.');
    if (!s) return null;
    if (!/^[0-9+\-*/.() ]+$/.test(s)) return null; // só números e operadores básicos
    if (!/[+\-*/]/.test(s)) return null; // sem operador: não precisa calcular
    try {
      const r = Function('"use strict";return (' + s + ')')();
      if (typeof r === 'number' && isFinite(r)) return r;
    } catch (err) {}
    return null;
  }
  function _fmtExprResultado(n) {
    const r = Math.round(n * 100) / 100;
    return Number.isInteger(r) ? String(r) : String(r).replace('.', ',');
  }

  // Percorre a árvore procurando um nó por id, retorna {node, path:[nomes]}
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
  // Retorna array de todos os ids descendentes de um nó (incluindo ele mesmo)
  function _idsComDescendentes(node) {
    let out = [node.id];
    (node.filhos || []).forEach(f => { out = out.concat(_idsComDescendentes(f)); });
    return out;
  }
  function _removerNode(id, nodes = arvore) {
    const i = nodes.findIndex(n => n.id === id);
    if (i !== -1) { nodes.splice(i, 1); return true; }
    for (const n of nodes) {
      if (n.filhos && _removerNode(id, n.filhos)) return true;
    }
    return false;
  }
  function _pecasDe(nodeId) { return pecas.filter(p => p.nodeId === nodeId); }

  // ══════════════════════════════════════════
  // CÁLCULO DE UMA PEÇA (PAREDE)
  // ══════════════════════════════════════════
  // Altura da Parede -> usada só para o m² de Alvenaria (Estrutural/Vedação)
  // Altura do Acabamento -> usada para Gesso/Reboco/Revestimento/Pintura
  // Compatível com peças antigas que só tinham "altura" (uma altura única).
  function _alturas(p) {
    const alturaParede = num(p.alturaParede ?? p.altura);
    const alturaAcabamento = num(p.alturaAcabamento ?? p.alturaParede ?? p.altura);
    return { alturaParede, alturaAcabamento };
  }

  function _calcularPeca(p) {
    const compM = num(p.comprimento) / 100;
    const { alturaParede, alturaAcabamento } = _alturas(p);
    const altParedeM = alturaParede / 100;
    const altAcabM = alturaAcabamento / 100;

    const areaBrutaAlvenaria = compM * altParedeM;
    const areaBrutaAcabamento = compM * altAcabM;
    const areaVaos = (p.vaos || []).reduce((s, v) => s + (num(v.comprimento) / 100) * (num(v.altura) / 100) * (num(v.qtd) || 1), 0);
    const areaLiquidaAlvenaria = Math.max(0, areaBrutaAlvenaria - areaVaos);
    const areaLiquidaAcabamento = Math.max(0, areaBrutaAcabamento - areaVaos);

    const acabTotais = { gesso: 0, reboco: 0, revestimento: 0 };
    const pinturaTotais = {}; // cor -> m²
    let pinturaArea = 0;

    ['ladoA', 'ladoB'].forEach(lado => {
      const l = p[lado] || {};
      (l.acabamentos || []).forEach(a => {
        const area = areaLiquidaAcabamento * (num(a.pct) / 100);
        if (acabTotais[a.tipo] != null) acabTotais[a.tipo] += area;
      });
      if (l.temPintura) {
        (l.pintura || []).forEach(pt => {
          const area = areaLiquidaAcabamento * (num(pt.pct) / 100);
          pinturaArea += area;
          const cor = pt.cor || '(sem nome)';
          pinturaTotais[cor] = (pinturaTotais[cor] || 0) + area;
        });
      }
    });

    return {
      areaBrutaAlvenaria, areaBrutaAcabamento, areaVaos,
      areaLiquidaAlvenaria, areaLiquidaAcabamento,
      alvenariaVedacao: p.tipoAlvenaria === 'vedacao' ? areaLiquidaAlvenaria : 0,
      alvenariaEstrutural: p.tipoAlvenaria === 'estrutural' ? areaLiquidaAlvenaria : 0,
      gesso: acabTotais.gesso,
      reboco: acabTotais.reboco,
      revestimento: acabTotais.revestimento,
      pintura: pinturaArea,
      pinturaPorCor: pinturaTotais,
    };
  }

  function _totaisDe(listaPecas) {
    const t = {
      alvenariaVedacao: 0, alvenariaEstrutural: 0, gesso: 0, reboco: 0, revestimento: 0, pintura: 0,
      pinturaPorCor: {}, areaLiquidaAlvenaria: 0, areaLiquidaAcabamento: 0, qtdPecas: listaPecas.length,
    };
    listaPecas.forEach(p => {
      const c = _calcularPeca(p);
      t.alvenariaVedacao += c.alvenariaVedacao;
      t.alvenariaEstrutural += c.alvenariaEstrutural;
      t.gesso += c.gesso;
      t.reboco += c.reboco;
      t.revestimento += c.revestimento;
      t.pintura += c.pintura;
      t.areaLiquidaAlvenaria += c.areaLiquidaAlvenaria;
      t.areaLiquidaAcabamento += c.areaLiquidaAcabamento;
      Object.entries(c.pinturaPorCor).forEach(([cor, area]) => { t.pinturaPorCor[cor] = (t.pinturaPorCor[cor] || 0) + area; });
    });
    return t;
  }

  // ══════════════════════════════════════════
  // RENDER PRINCIPAL
  // ══════════════════════════════════════════
  function renderizar() {
    const c = document.getElementById('lp-content');
    if (!c) return;
    c.innerHTML = `
      <div class="page-header">
        <div>
          <h2>🧱 Levantamento de Paredes</h2>
          <span class="subtitulo">${pecas.length} parede(s) levantada(s)</span>
        </div>
      </div>
      <div class="ar-layout">
        <div class="ar-tree">
          <div class="ar-tree-header">
            <h3>Locais</h3>
            <button class="btn btn-secundario btn-sm" onclick="LP.novoNode(null)">+ Local</button>
          </div>
          <div class="ar-tree-body">${_renderArvore()}</div>
        </div>
        <div class="ar-painel">${_renderPainel()}</div>
      </div>`;
  }

  function _renderArvoreNivel(nodes) {
    return nodes.map(n => {
      const aberto = openNodes.has(n.id);
      const ativo = selNodeId === n.id;
      const ids = _idsComDescendentes(n);
      const nPecas = pecas.filter(p => ids.includes(p.nodeId)).length;
      let h = `<div class="tree-item${ativo ? ' ativo' : ''}" onclick="LP.toggleNode('${n.id}');LP.selNode('${n.id}')">
        <span class="tree-toggle">${(n.filhos || []).length ? (aberto ? '▼' : '▶') : ''}</span>
        <span class="tree-icon">📍</span>
        <span class="tree-label">${esc(n.nome)}</span>
        ${nPecas ? `<span class="tree-badge">${nPecas}</span>` : ''}
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
      h += `<div class="estado-vazio"><p class="text-sm">Nenhum local cadastrado. Clique em "+ Local" para começar (ex: Térreo, Torre).</p></div>`;
      return h;
    }
    h += _renderArvoreNivel(arvore);
    return h;
  }

  function _breadcrumb(nodeId) {
    const r = _acharNode(nodeId);
    if (!r) return '';
    return r.path.join(' → ');
  }

  // ══════════════════════════════════════════
  // PAINEL: VISÃO GERAL (RESUMO / QUANTITATIVOS)
  // ══════════════════════════════════════════
  function _renderResumoGeral() {
    const t = _totaisDe(pecas);
    const coresOrdenadas = Object.entries(t.pinturaPorCor).sort((a, b) => b[1] - a[1]);

    return `
      <div class="page-header">
        <div><h2 style="font-size:1.1rem;">📊 Visão Geral — Quantitativos de Parede</h2>
          <span class="subtitulo">${t.qtdPecas} parede(s) cadastrada(s) · ${fmt2(t.areaLiquidaAlvenaria)} m² de alvenaria · ${fmt2(t.areaLiquidaAcabamento)} m² de acabamento</span></div>
      </div>
      <div class="cc-kpiGrid" style="grid-template-columns:repeat(3,1fr);">
        <div class="cc-kpi"><div class="cc-kpiIcon">🧱</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Alvenaria de Vedação</div><div class="cc-kpiValue">${fmt2(t.alvenariaVedacao)}<span class="cc-kpiUnit">m²</span></div></div></div>
        <div class="cc-kpi"><div class="cc-kpiIcon">🧱</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Alvenaria Estrutural</div><div class="cc-kpiValue">${fmt2(t.alvenariaEstrutural)}<span class="cc-kpiUnit">m²</span></div></div></div>
        <div class="cc-kpi"><div class="cc-kpiIcon">🎨</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Pintura (total)</div><div class="cc-kpiValue">${fmt2(t.pintura)}<span class="cc-kpiUnit">m²</span></div></div></div>
        <div class="cc-kpi"><div class="cc-kpiIcon">🏳️</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Gesso Liso</div><div class="cc-kpiValue">${fmt2(t.gesso)}<span class="cc-kpiUnit">m²</span></div><div class="cc-kpiSub">Chapisco + Gesso na mesma área</div></div></div>
        <div class="cc-kpi"><div class="cc-kpiIcon">🪨</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Reboco</div><div class="cc-kpiValue">${fmt2(t.reboco)}<span class="cc-kpiUnit">m²</span></div><div class="cc-kpiSub">Chapisco + Massa na mesma área</div></div></div>
        <div class="cc-kpi"><div class="cc-kpiIcon">◻️</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Revestimento</div><div class="cc-kpiValue">${fmt2(t.revestimento)}<span class="cc-kpiUnit">m²</span></div><div class="cc-kpiSub">Porcelanato / cerâmica</div></div></div>
      </div>

      <div class="cc-panel">
        <div class="cc-panelTitle">🎨 Pintura por Cor</div>
        ${!coresOrdenadas.length ? `<div class="cc-empty">Nenhuma pintura lançada ainda.</div>` : `
        <div class="tabela-container"><table class="tabela">
          <thead><tr><th>Cor</th><th style="text-align:right;">m²</th><th style="text-align:right;">%</th></tr></thead>
          <tbody>
            ${coresOrdenadas.map(([cor, area]) => `
              <tr><td>${esc(cor)}</td><td style="text-align:right;">${fmt2(area)}</td><td style="text-align:right;">${t.pintura ? fmt2(area / t.pintura * 100) : '0,00'}%</td></tr>
            `).join('')}
          </tbody>
        </table></div>`}
      </div>

      <div class="cc-panel">
        <div class="cc-panelTitle">📍 Resumo por Local (nível superior)</div>
        ${!arvore.length ? `<div class="cc-empty">Cadastre locais na árvore ao lado para ver o resumo.</div>` : `
        <div class="tabela-container"><table class="tabela">
          <thead><tr><th>Local</th><th style="text-align:right;">Paredes</th><th style="text-align:right;">m² Alvenaria</th><th style="text-align:right;">m² Acabamento</th><th style="text-align:right;">Vedação</th><th style="text-align:right;">Estrutural</th><th style="text-align:right;">Pintura</th></tr></thead>
          <tbody>
            ${arvore.map(raiz => {
              const ids = _idsComDescendentes(raiz);
              const lst = pecas.filter(p => ids.includes(p.nodeId));
              const rt = _totaisDe(lst);
              return `<tr><td><strong>${esc(raiz.nome)}</strong></td><td style="text-align:right;">${rt.qtdPecas}</td><td style="text-align:right;">${fmt2(rt.areaLiquidaAlvenaria)}</td><td style="text-align:right;">${fmt2(rt.areaLiquidaAcabamento)}</td><td style="text-align:right;">${fmt2(rt.alvenariaVedacao)}</td><td style="text-align:right;">${fmt2(rt.alvenariaEstrutural)}</td><td style="text-align:right;">${fmt2(rt.pintura)}</td></tr>`;
            }).join('')}
          </tbody>
        </table></div>`}
      </div>`;
  }

  // ══════════════════════════════════════════
  // PAINEL: LOCAL SELECIONADO (LISTA DE PAREDES)
  // ══════════════════════════════════════════
  function _renderPainel() {
    if (!selNodeId) return _renderResumoGeral();
    const r = _acharNode(selNodeId);
    if (!r) { selNodeId = null; return _renderResumoGeral(); }
    const lista = _pecasDe(selNodeId);
    const t = _totaisDe(lista);

    return `
      <div class="page-header">
        <div><h2 style="font-size:1.1rem;">${esc(r.path.join(' → '))}</h2>
          <span class="subtitulo">${lista.length} parede(s) · ${fmt2(t.areaLiquidaAlvenaria)} m² alvenaria · ${fmt2(t.areaLiquidaAcabamento)} m² acabamento</span></div>
        <button class="btn btn-primario btn-sm" onclick="LP.novaParede()">+ Nova Parede</button>
      </div>

      ${!lista.length ? `<div class="estado-vazio"><div class="icone">🧱</div><p>Nenhuma parede levantada neste local ainda.</p>
        <button class="btn btn-primario" onclick="LP.novaParede()">+ Nova Parede</button></div>` : `
      <div class="cc-kpiGrid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px;">
        <div class="cc-kpi"><div class="cc-kpiIcon">🧱</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Vedação</div><div class="cc-kpiValue">${fmt2(t.alvenariaVedacao)}<span class="cc-kpiUnit">m²</span></div></div></div>
        <div class="cc-kpi"><div class="cc-kpiIcon">🏳️</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Gesso Liso</div><div class="cc-kpiValue">${fmt2(t.gesso)}<span class="cc-kpiUnit">m²</span></div></div></div>
        <div class="cc-kpi"><div class="cc-kpiIcon">🪨</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Reboco</div><div class="cc-kpiValue">${fmt2(t.reboco)}<span class="cc-kpiUnit">m²</span></div></div></div>
        <div class="cc-kpi"><div class="cc-kpiIcon">🎨</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Pintura</div><div class="cc-kpiValue">${fmt2(t.pintura)}<span class="cc-kpiUnit">m²</span></div></div></div>
      </div>
      <div class="cc-panel" style="padding:0;">
        <div class="tabela-container"><table class="tabela">
          <thead><tr>
            <th>Parede</th><th>Comp x Alt Parede/Acab (cm)</th><th style="text-align:right;">m² Alvenaria</th><th style="text-align:right;">m² Acabamento</th>
            <th>Alvenaria</th><th>Lado A</th><th>Lado B</th><th></th>
          </tr></thead>
          <tbody>
            ${lista.map(p => _renderLinhaPeca(p)).join('')}
          </tbody>
        </table></div>
      </div>`}`;
  }

  function _resumoLado(l) {
    if (!l) return '—';
    const acabs = (l.acabamentos || []).map(a => {
      const label = TIPOS_ACABAMENTO.find(t => t.id === a.tipo)?.label || a.tipo;
      return `${label} ${num(a.pct)}%`;
    }).join(' + ') || '—';
    const pint = l.temPintura ? ` <span style="color:#888;">| 🎨 ${(l.pintura || []).map(pt => `${esc(pt.cor || '?')} ${num(pt.pct)}%`).join(', ')}</span>` : '';
    return acabs + pint;
  }

  function _renderLinhaPeca(p) {
    const c = _calcularPeca(p);
    const { alturaParede, alturaAcabamento } = _alturas(p);
    return `<tr>
      <td><strong>${esc(p.nome || 'Parede')}</strong>${p.vaos && p.vaos.length ? `<div class="text-sm text-muted">${p.vaos.length} vão(s)</div>` : ''}</td>
      <td>${num(p.comprimento)} x ${alturaParede}${alturaAcabamento !== alturaParede ? '/' + alturaAcabamento : ''}</td>
      <td style="text-align:right;">${fmt2(c.areaLiquidaAlvenaria)}</td>
      <td style="text-align:right;">${fmt2(c.areaLiquidaAcabamento)}</td>
      <td>${p.tipoAlvenaria === 'estrutural' ? 'Estrutural' : 'Vedação'}</td>
      <td class="text-sm">${_resumoLado(p.ladoA)}</td>
      <td class="text-sm">${_resumoLado(p.ladoB)}</td>
      <td style="white-space:nowrap;">
        <button class="btn btn-secundario btn-sm" onclick="LP.editarParede('${p.id}')" title="Editar">✎</button>
        <button class="btn btn-secundario btn-sm" onclick="LP.excluirParede('${p.id}')" title="Excluir">✕</button>
      </td>
    </tr>`;
  }

  // ══════════════════════════════════════════
  // NAVEGAÇÃO NA ÁRVORE
  // ══════════════════════════════════════════
  function selGeral() { selNodeId = null; renderizar(); }
  function selNode(id) { selNodeId = id; renderizar(); }
  function toggleNode(id) {
    if (openNodes.has(id)) openNodes.delete(id); else openNodes.add(id);
  }

  // ══════════════════════════════════════════
  // CRUD DE NÓS (LOCAIS)
  // ══════════════════════════════════════════
  function novoNode(parentId) {
    nodeModo = parentId ? 'novo-filho' : 'novo-raiz';
    nodeParentId = parentId;
    nodeEditId = null;
    document.getElementById('lp-node-titulo').textContent = parentId ? 'Novo Sublocal' : 'Novo Local';
    document.getElementById('lp-node-nome').value = '';
    Utils.abrirModal('modal-lp-node');
    setTimeout(() => document.getElementById('lp-node-nome')?.focus(), 60);
  }

  function renomearNode(id) {
    const r = _acharNode(id); if (!r) return;
    nodeModo = 'renomear'; nodeEditId = id; nodeParentId = null;
    document.getElementById('lp-node-titulo').textContent = 'Renomear Local';
    document.getElementById('lp-node-nome').value = r.node.nome;
    Utils.abrirModal('modal-lp-node');
    setTimeout(() => document.getElementById('lp-node-nome')?.focus(), 60);
  }

  async function salvarNode() {
    const nome = document.getElementById('lp-node-nome').value.trim();
    if (!nome) { Utils.toast('Informe um nome.', 'alerta'); return; }
    if (nodeModo === 'renomear') {
      const r = _acharNode(nodeEditId);
      if (r) r.node.nome = nome;
    } else if (nodeModo === 'novo-filho') {
      const r = _acharNode(nodeParentId);
      if (r) {
        r.node.filhos = r.node.filhos || [];
        r.node.filhos.push({ id: _uid(), nome, filhos: [] });
        openNodes.add(nodeParentId);
      }
    } else {
      arvore.push({ id: _uid(), nome, filhos: [] });
    }
    try {
      await _salvarArvore();
      Utils.fecharModal('modal-lp-node');
      Utils.toast('✓ Salvo!', 'sucesso');
      renderizar();
    } catch (e) {
      Utils.toast('Erro ao salvar: ' + e.message, 'erro');
    }
  }

  async function excluirNode(id) {
    const r = _acharNode(id); if (!r) return;
    const ids = _idsComDescendentes(r.node);
    const nPecas = pecas.filter(p => ids.includes(p.nodeId)).length;
    const msg = nPecas
      ? `"${r.node.nome}" (e seus sublocais) possui ${nPecas} parede(s) cadastrada(s). Excluir vai apagar o local E todas as paredes vinculadas a ele. Confirma?`
      : `Excluir o local "${r.node.nome}"${r.node.filhos && r.node.filhos.length ? ' e seus sublocais' : ''}?`;
    const ok = await Utils.confirmar(msg);
    if (!ok) return;
    Utils.mostrarLoading();
    try {
      const ops = pecas.filter(p => ids.includes(p.nodeId)).map(p => ({ type: 'delete', ref: Database.ref(obraId, COL_PECAS).doc(p.id) }));
      for (let i = 0; i < ops.length; i += 400) await Database.batchWrite(ops.slice(i, i + 400));
      _removerNode(id);
      if (selNodeId && ids.includes(selNodeId)) selNodeId = null;
      await _salvarArvore();
      Utils.toast('Local excluído.', 'sucesso');
      await carregar();
    } catch (e) {
      Utils.toast('Erro ao excluir: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ══════════════════════════════════════════
  // MODAL DE PAREDE — ESTADO DO FORMULÁRIO
  // ══════════════════════════════════════════
  function _novoLado() { return { acabamentos: [{ tipo: 'gesso', pct: 100 }], temPintura: false, pintura: [{ cor: '', hex: '#ffffff', pct: 100 }] }; }

  function novaParede() {
    if (!selNodeId) { Utils.toast('Selecione um local na árvore.', 'alerta'); return; }
    pecaEditId = null;
    pecaForm = {
      nome: `Parede ${_pecasDe(selNodeId).length + 1}`,
      comprimento: '', alturaParede: '', alturaAcabamento: '',
      tipoAlvenaria: 'vedacao',
      possuiVao: false,
      vaos: [],
      ladoA: _novoLado(),
      ladoB: _novoLado(),
    };
    document.getElementById('lp-parede-titulo').textContent = 'Nova Parede';
    _renderFormParede();
    Utils.abrirModal('modal-lp-parede');
    setTimeout(() => document.getElementById('lp-p-comp')?.focus(), 60);
  }

  function editarParede(id) {
    const p = pecas.find(x => x.id === id); if (!p) return;
    pecaEditId = id;
    pecaForm = JSON.parse(JSON.stringify(p));
    const { alturaParede, alturaAcabamento } = _alturas(p);
    pecaForm.alturaParede = alturaParede || '';
    pecaForm.alturaAcabamento = alturaAcabamento || '';
    pecaForm.possuiVao = !!(pecaForm.vaos && pecaForm.vaos.length);
    pecaForm.ladoA = pecaForm.ladoA || _novoLado();
    pecaForm.ladoB = pecaForm.ladoB || _novoLado();
    if (!pecaForm.ladoA.acabamentos || !pecaForm.ladoA.acabamentos.length) pecaForm.ladoA.acabamentos = [{ tipo: 'gesso', pct: 100 }];
    if (!pecaForm.ladoB.acabamentos || !pecaForm.ladoB.acabamentos.length) pecaForm.ladoB.acabamentos = [{ tipo: 'gesso', pct: 100 }];
    if (!pecaForm.ladoA.pintura || !pecaForm.ladoA.pintura.length) pecaForm.ladoA.pintura = [{ cor: '', hex: '#ffffff', pct: 100 }];
    if (!pecaForm.ladoB.pintura || !pecaForm.ladoB.pintura.length) pecaForm.ladoB.pintura = [{ cor: '', hex: '#ffffff', pct: 100 }];
    document.getElementById('lp-parede-titulo').textContent = 'Editar Parede';
    _renderFormParede();
    Utils.abrirModal('modal-lp-parede');
  }

  async function excluirParede(id) {
    const ok = await Utils.confirmar('Excluir esta parede do levantamento?');
    if (!ok) return;
    Utils.mostrarLoading();
    try {
      await Database.deletar(obraId, COL_PECAS, id);
      Utils.toast('Parede excluída.', 'sucesso');
      await carregar();
    } catch (e) {
      Utils.toast('Erro ao excluir: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ── Render do formulário ──
  // IMPORTANTE: o corpo inteiro só é re-renderizado ao abrir o modal e em
  // ações estruturais (add/remover linha, marcar checkbox). Digitação em
  // campos de texto/número NUNCA recria o input (senão o cursor volta pro
  // início a cada tecla e a digitação sai invertida) — só atualiza pecaForm
  // e, quando necessário, um bloco de resumo via innerHTML de um id estável.
  function _somaP(arr) { return (arr || []).reduce((s, x) => s + num(x.pct), 0); }

  function _renderFormParede() {
    const body = document.getElementById('lp-parede-body'); if (!body) return;
    body.innerHTML = `
      <div style="background:var(--cor-fundo);border-radius:8px;padding:8px 14px;margin-bottom:14px;font-size:0.82rem;color:var(--cor-texto-secundario);">
        Local: <strong style="color:var(--cor-primaria-dark);">${esc(_breadcrumb(selNodeId))}</strong>
      </div>

      <div class="form-grupo"><label>Identificação da parede</label>
        <input type="text" id="lp-p-nome" class="form-control" value="${esc(pecaForm.nome)}" placeholder="Ex: Parede 1, Parede Norte..." oninput="LP.updCampo('nome', this.value)"></div>

      <div class="form-row">
        <div class="form-grupo"><label>Comprimento (cm)</label>
          <input type="text" inputmode="decimal" id="lp-p-comp" class="form-control" placeholder="Ex: 350 ou 150+200" value="${esc(pecaForm.comprimento)}" oninput="LP.updCampo('comprimento', this.value)" onkeydown="LP.calcExprEnter(event)"></div>
        <div class="form-grupo"><label>Altura da Parede (cm)</label>
          <input type="text" inputmode="decimal" id="lp-p-altparede" class="form-control" placeholder="Ex: 280" value="${esc(pecaForm.alturaParede)}" oninput="LP.updCampo('alturaParede', this.value)" onkeydown="LP.calcExprEnter(event)"></div>
        <div class="form-grupo"><label>Altura do Acabamento (cm)</label>
          <input type="text" inputmode="decimal" id="lp-p-altacab" class="form-control" placeholder="Igual à da parede, se vazio" value="${esc(pecaForm.alturaAcabamento)}" oninput="LP.updCampo('alturaAcabamento', this.value)" onkeydown="LP.calcExprEnter(event)"></div>
      </div>
      <div class="form-row">
        <div class="form-grupo"><label>Alvenaria</label>
          <select id="lp-p-tipo" class="form-control" onchange="LP.updCampo('tipoAlvenaria', this.value)">
            <option value="vedacao" ${pecaForm.tipoAlvenaria === 'vedacao' ? 'selected' : ''}>Vedação</option>
            <option value="estrutural" ${pecaForm.tipoAlvenaria === 'estrutural' ? 'selected' : ''}>Estrutural</option>
          </select></div>
      </div>

      <div class="form-check mb-2">
        <input type="checkbox" id="lp-p-possuivao" ${pecaForm.possuiVao ? 'checked' : ''} onchange="LP.toggleVao(this.checked)">
        <label for="lp-p-possuivao">Possui vão (porta ou janela)?</label>
      </div>
      <div id="lp-vaos-wrap">${pecaForm.possuiVao ? _renderVaos() : ''}</div>

      <div id="lp-resumo-areas">${_htmlResumoAreas()}</div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div id="lp-lado-ladoA">${_renderLado('ladoA', 'Lado A')}</div>
        <div id="lp-lado-ladoB">${_renderLado('ladoB', 'Lado B')}</div>
      </div>
    `;
  }

  function _htmlResumoAreas() {
    const compM = num(pecaForm.comprimento) / 100;
    const altParedeM = num(pecaForm.alturaParede) / 100;
    const altAcabM = (num(pecaForm.alturaAcabamento) || num(pecaForm.alturaParede)) / 100;
    const areaBrutaAlvenaria = compM * altParedeM;
    const areaBrutaAcabamento = compM * altAcabM;
    const areaVaos = (pecaForm.vaos || []).reduce((s, v) => s + (num(v.comprimento) / 100) * (num(v.altura) / 100) * (num(v.qtd) || 1), 0);
    const areaLiquidaAlvenaria = Math.max(0, areaBrutaAlvenaria - areaVaos);
    const areaLiquidaAcabamento = Math.max(0, areaBrutaAcabamento - areaVaos);
    return `
      <div style="background:var(--cor-fundo);border-radius:8px;padding:10px 14px;margin:14px 0;font-size:0.85rem;display:flex;flex-direction:column;gap:4px;">
        <span>🧱 Alvenaria (Comp x Altura Parede): área bruta <strong>${fmt2(areaBrutaAlvenaria)} m²</strong> − vãos <strong>${fmt2(areaVaos)} m²</strong> = <strong style="color:var(--cor-primaria-dark);">${fmt2(areaLiquidaAlvenaria)} m²</strong></span>
        <span>🎨 Acabamento (Comp x Altura Acabamento): área bruta <strong>${fmt2(areaBrutaAcabamento)} m²</strong> − vãos <strong>${fmt2(areaVaos)} m²</strong> = <strong style="color:var(--cor-primaria-dark);">${fmt2(areaLiquidaAcabamento)} m²</strong></span>
      </div>`;
  }

  function _atualizarResumoAreas() {
    const el = document.getElementById('lp-resumo-areas');
    if (el) el.innerHTML = _htmlResumoAreas();
  }

  function _renderVaos() {
    return `
      <div style="border:1px solid var(--cor-borda-light);border-radius:8px;padding:10px;margin-bottom:8px;">
        ${(pecaForm.vaos || []).map((v, i) => `
          <div class="form-row" style="align-items:end;margin-bottom:6px;grid-template-columns:1fr 1fr 1fr 0.6fr auto;">
            <div class="form-grupo" style="margin:0;"><label class="text-sm">Tipo</label>
              <select class="form-control" onchange="LP.updVao(${i},'tipo',this.value)">
                <option value="porta" ${v.tipo === 'porta' ? 'selected' : ''}>Porta</option>
                <option value="janela" ${v.tipo === 'janela' ? 'selected' : ''}>Janela</option>
              </select></div>
            <div class="form-grupo" style="margin:0;"><label class="text-sm">Comp. (cm)</label>
              <input type="text" inputmode="decimal" class="form-control" placeholder="Ex: 80" value="${esc(v.comprimento)}" oninput="LP.updVao(${i},'comprimento',this.value)" onkeydown="LP.calcExprEnter(event)"></div>
            <div class="form-grupo" style="margin:0;"><label class="text-sm">Altura (cm)</label>
              <input type="text" inputmode="decimal" class="form-control" placeholder="Ex: 210" value="${esc(v.altura)}" oninput="LP.updVao(${i},'altura',this.value)" onkeydown="LP.calcExprEnter(event)"></div>
            <div class="form-grupo" style="margin:0;"><label class="text-sm">Qtd</label>
              <input type="number" class="form-control" step="1" min="1" value="${esc(v.qtd || 1)}" oninput="LP.updVao(${i},'qtd',this.value)"></div>
            <button class="btn btn-secundario btn-sm" onclick="LP.remVao(${i})" title="Remover">✕</button>
          </div>
        `).join('')}
        <button class="btn btn-secundario btn-sm" onclick="LP.addVao()">+ Adicionar vão</button>
      </div>`;
  }

  function _renderLado(ladoKey, label) {
    const l = pecaForm[ladoKey];
    const somaAcab = _somaP(l.acabamentos);
    const somaPint = _somaP(l.pintura);
    return `
      <div style="border:1.5px solid var(--cor-borda-light);border-radius:10px;padding:12px;">
        <div style="font-weight:700;margin-bottom:8px;">${label}</div>
        <div style="font-size:0.78rem;color:var(--cor-texto-secundario);margin-bottom:6px;">Acabamento (pode misturar tipos por %)</div>
        ${l.acabamentos.map((a, i) => `
          <div style="display:flex;gap:6px;margin-bottom:6px;align-items:center;">
            <select class="form-control" style="flex:1.4;" onchange="LP.updAcab('${ladoKey}',${i},'tipo',this.value)">
              ${TIPOS_ACABAMENTO.map(t => `<option value="${t.id}" ${a.tipo === t.id ? 'selected' : ''}>${t.label}</option>`).join('')}
            </select>
            <input type="number" class="form-control" style="flex:0.7;" step="1" min="0" max="100" value="${esc(a.pct)}" oninput="LP.updAcab('${ladoKey}',${i},'pct',this.value)">
            <span style="font-size:0.78rem;color:var(--cor-texto-secundario);">%</span>
            ${l.acabamentos.length > 1 ? `<button class="btn btn-secundario btn-sm" onclick="LP.remAcab('${ladoKey}',${i})">✕</button>` : ''}
          </div>`).join('')}
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <button class="btn btn-secundario btn-sm" onclick="LP.addAcab('${ladoKey}')">+ acabamento</button>
          <span class="text-sm" id="lp-soma-acab-${ladoKey}" style="color:${Math.abs(somaAcab - 100) < 0.01 ? '#16a34a' : '#ef4444'};font-weight:700;">${fmt2(somaAcab)}%</span>
        </div>

        <div class="form-check" style="margin-bottom:8px;">
          <input type="checkbox" id="lp-pint-${ladoKey}" ${l.temPintura ? 'checked' : ''} onchange="LP.togglePintura('${ladoKey}', this.checked)">
          <label for="lp-pint-${ladoKey}">Tem pintura?</label>
        </div>
        ${l.temPintura ? `
          <div style="font-size:0.78rem;color:var(--cor-texto-secundario);margin-bottom:6px;">Cor(es) — pode adicionar mais de uma cor com %</div>
          ${l.pintura.map((pt, i) => `
            <div style="display:flex;gap:6px;margin-bottom:6px;align-items:center;">
              <input type="color" value="${esc(pt.hex || '#ffffff')}" style="width:34px;height:34px;border:1px solid var(--cor-borda-light);border-radius:6px;padding:0;flex-shrink:0;" onchange="LP.updPintura('${ladoKey}',${i},'hex',this.value)">
              <input type="text" class="form-control" style="flex:1.4;" placeholder="Nome da cor" value="${esc(pt.cor)}" oninput="LP.updPintura('${ladoKey}',${i},'cor',this.value)">
              <input type="number" class="form-control" style="flex:0.7;" step="1" min="0" max="100" value="${esc(pt.pct)}" oninput="LP.updPintura('${ladoKey}',${i},'pct',this.value)">
              <span style="font-size:0.78rem;color:var(--cor-texto-secundario);">%</span>
              ${l.pintura.length > 1 ? `<button class="btn btn-secundario btn-sm" onclick="LP.remPintura('${ladoKey}',${i})">✕</button>` : ''}
            </div>`).join('')}
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <button class="btn btn-secundario btn-sm" onclick="LP.addPintura('${ladoKey}')">+ cor</button>
            <span class="text-sm" id="lp-soma-pint-${ladoKey}" style="color:${Math.abs(somaPint - 100) < 0.01 ? '#16a34a' : '#ef4444'};font-weight:700;">${fmt2(somaPint)}%</span>
          </div>` : ''}
      </div>`;
  }

  function _atualizarSomaAcab(ladoKey) {
    const soma = _somaP(pecaForm[ladoKey].acabamentos);
    const el = document.getElementById(`lp-soma-acab-${ladoKey}`);
    if (el) { el.textContent = fmt2(soma) + '%'; el.style.color = Math.abs(soma - 100) < 0.01 ? '#16a34a' : '#ef4444'; }
  }
  function _atualizarSomaPint(ladoKey) {
    const soma = _somaP(pecaForm[ladoKey].pintura);
    const el = document.getElementById(`lp-soma-pint-${ladoKey}`);
    if (el) { el.textContent = fmt2(soma) + '%'; el.style.color = Math.abs(soma - 100) < 0.01 ? '#16a34a' : '#ef4444'; }
  }
  function _atualizarLado(ladoKey) {
    const el = document.getElementById(`lp-lado-${ladoKey}`);
    if (el) el.innerHTML = _renderLado(ladoKey, ladoKey === 'ladoA' ? 'Lado A' : 'Lado B');
  }

  // ── Handlers de edição do form (mutam pecaForm; SEM re-render do input) ──
  function updCampo(campo, valor) {
    pecaForm[campo] = valor;
    if (campo === 'comprimento' || campo === 'alturaParede' || campo === 'alturaAcabamento') _atualizarResumoAreas();
  }

  function toggleVao(checked) {
    pecaForm.possuiVao = checked;
    if (checked && !pecaForm.vaos.length) pecaForm.vaos.push({ tipo: 'porta', comprimento: '', altura: '', qtd: 1 });
    const wrap = document.getElementById('lp-vaos-wrap');
    if (wrap) wrap.innerHTML = pecaForm.possuiVao ? _renderVaos() : '';
    _atualizarResumoAreas();
  }
  function addVao() {
    pecaForm.vaos.push({ tipo: 'porta', comprimento: '', altura: '', qtd: 1 });
    const wrap = document.getElementById('lp-vaos-wrap');
    if (wrap) wrap.innerHTML = _renderVaos();
    _atualizarResumoAreas();
  }
  function remVao(i) {
    pecaForm.vaos.splice(i, 1);
    const wrap = document.getElementById('lp-vaos-wrap');
    if (wrap) wrap.innerHTML = _renderVaos();
    _atualizarResumoAreas();
  }
  function updVao(i, campo, valor) {
    pecaForm.vaos[i][campo] = valor;
    _atualizarResumoAreas();
  }

  function addAcab(ladoKey) { pecaForm[ladoKey].acabamentos.push({ tipo: 'gesso', pct: 0 }); _atualizarLado(ladoKey); }
  function remAcab(ladoKey, i) { pecaForm[ladoKey].acabamentos.splice(i, 1); _atualizarLado(ladoKey); }
  function updAcab(ladoKey, i, campo, valor) {
    pecaForm[ladoKey].acabamentos[i][campo] = valor;
    if (campo === 'tipo') _atualizarLado(ladoKey); else _atualizarSomaAcab(ladoKey);
  }

  function togglePintura(ladoKey, checked) {
    pecaForm[ladoKey].temPintura = checked;
    if (checked && !pecaForm[ladoKey].pintura.length) pecaForm[ladoKey].pintura.push({ cor: '', hex: '#ffffff', pct: 100 });
    _atualizarLado(ladoKey);
  }
  function addPintura(ladoKey) { pecaForm[ladoKey].pintura.push({ cor: '', hex: '#ffffff', pct: 0 }); _atualizarLado(ladoKey); }
  function remPintura(ladoKey, i) { pecaForm[ladoKey].pintura.splice(i, 1); _atualizarLado(ladoKey); }
  function updPintura(ladoKey, i, campo, valor) {
    pecaForm[ladoKey].pintura[i][campo] = valor;
    if (campo === 'pct') _atualizarSomaPint(ladoKey);
  }

  // ══════════════════════════════════════════
  // SALVAR PEÇA
  // ══════════════════════════════════════════
  function _montarDadosPeca() {
    return {
      nodeId: selNodeId,
      nome: pecaForm.nome || 'Parede',
      comprimento: num(pecaForm.comprimento),
      alturaParede: num(pecaForm.alturaParede),
      alturaAcabamento: num(pecaForm.alturaAcabamento) || num(pecaForm.alturaParede),
      tipoAlvenaria: pecaForm.tipoAlvenaria,
      vaos: pecaForm.possuiVao ? (pecaForm.vaos || []).filter(v => num(v.comprimento) && num(v.altura)).map(v => ({ tipo: v.tipo, comprimento: num(v.comprimento), altura: num(v.altura), qtd: num(v.qtd) || 1 })) : [],
      ladoA: {
        acabamentos: pecaForm.ladoA.acabamentos.map(a => ({ tipo: a.tipo, pct: num(a.pct) })),
        temPintura: !!pecaForm.ladoA.temPintura,
        pintura: pecaForm.ladoA.temPintura ? pecaForm.ladoA.pintura.map(p => ({ cor: p.cor || '', hex: p.hex || '#ffffff', pct: num(p.pct) })) : [],
      },
      ladoB: {
        acabamentos: pecaForm.ladoB.acabamentos.map(a => ({ tipo: a.tipo, pct: num(a.pct) })),
        temPintura: !!pecaForm.ladoB.temPintura,
        pintura: pecaForm.ladoB.temPintura ? pecaForm.ladoB.pintura.map(p => ({ cor: p.cor || '', hex: p.hex || '#ffffff', pct: num(p.pct) })) : [],
      },
    };
  }

  function _validarPeca() {
    if (!num(pecaForm.comprimento) || !num(pecaForm.alturaParede)) {
      Utils.toast('Informe comprimento e altura da parede.', 'alerta'); return false;
    }
    for (const lado of ['ladoA', 'ladoB']) {
      const soma = _somaP(pecaForm[lado].acabamentos);
      if (Math.abs(soma - 100) > 0.5) {
        Utils.toast(`A soma dos % de acabamento do ${lado === 'ladoA' ? 'Lado A' : 'Lado B'} deve ser 100% (está em ${fmt2(soma)}%).`, 'alerta');
        return false;
      }
      if (pecaForm[lado].temPintura) {
        const somaP = _somaP(pecaForm[lado].pintura);
        if (Math.abs(somaP - 100) > 0.5) {
          Utils.toast(`A soma dos % de pintura do ${lado === 'ladoA' ? 'Lado A' : 'Lado B'} deve ser 100% (está em ${fmt2(somaP)}%).`, 'alerta');
          return false;
        }
      }
    }
    return true;
  }

  async function salvarParede(continuar) {
    if (!_validarPeca()) return;
    const data = _montarDadosPeca();
    Utils.mostrarLoading();
    try {
      if (pecaEditId) await Database.atualizar(obraId, COL_PECAS, pecaEditId, data);
      else await Database.criar(obraId, COL_PECAS, data);
      pecaEditId = null;
      if (continuar) {
        Utils.toast('✓ Parede salva! Pronta para a próxima.', 'sucesso');
        await carregar();
        novaParede();
      } else {
        Utils.fecharModal('modal-lp-parede');
        Utils.toast('✓ Parede salva!', 'sucesso');
        await carregar();
      }
    } catch (e) {
      Utils.toast('Erro ao salvar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  return {
    init, recarregar, renderizar,
    selGeral, selNode, toggleNode,
    novoNode, renomearNode, salvarNode, excluirNode,
    novaParede, editarParede, excluirParede, salvarParede,
    updCampo, calcExprEnter, toggleVao, addVao, remVao, updVao,
    addAcab, remAcab, updAcab,
    togglePintura, addPintura, remPintura, updPintura,
  };
})();

const LP = LevantamentoParedes;

function onObraChanged() { LevantamentoParedes.recarregar(); }

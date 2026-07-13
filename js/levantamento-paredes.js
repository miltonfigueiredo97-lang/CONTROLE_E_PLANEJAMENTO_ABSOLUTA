// ============================================
// Módulo: Levantamento de Paredes
// Duas abas independentes, dentro da mesma árvore de locais
// (ilimitada em profundidade, ex: Torre > Andar > Apto > Cômodo):
//
//  🧱 ALVENARIA — a parede FÍSICA, lançada 1 vez (Vedação ou
//     Estrutural). Não tem Lado A/B: alvenaria é uma coisa só,
//     independente de quantos ambientes ela separa.
//
//  🎨 ACABAMENTO — cada FACE de parede dentro de um cômodo,
//     lançada separadamente (mesma parede pode gerar 2 faces,
//     uma em cada cômodo vizinho, cada uma com seu próprio
//     comprimento e mistura de acabamento/pintura por %).
//
// Isso evita o conflito de dobrar o m² de alvenaria ao lançar as
// duas faces de uma mesma parede para pegar os comprimentos
// diferentes de acabamento de cada lado.
//
// Dados: Firestore obras/{obraId}/paredesAlvenariaPecas,
//        obras/{obraId}/paredesAcabamentoPecas,
//        obras/{obraId}/config/paredesArvore
// ============================================

const LevantamentoParedes = (() => {
  const COL_ALV = 'paredesAlvenariaPecas';
  const COL_ACAB = 'paredesAcabamentoPecas';
  const CONFIG_DOC = 'paredesArvore';

  const TIPOS_ACABAMENTO = [
    { id: 'gesso', label: 'Gesso Liso' },
    { id: 'reboco', label: 'Reboco' },
    { id: 'revestimento', label: 'Revestimento' },
    { id: 'fachada', label: 'Fachada (não contabilizado)' },
  ];

  let obraId = null;
  let arvore = [];             // [{id,nome,filhos:[...]}]
  let pecasAlvenaria = [];     // paredesAlvenariaPecas docs
  let pecasAcabamento = [];    // paredesAcabamentoPecas docs
  let openNodes = new Set();
  let selNodeId = null;        // null = Visão Geral
  let aba = 'alvenaria';       // 'alvenaria' | 'acabamento'

  // Estado modal de nó (criar/renomear)
  let nodeModo = null;    // 'novo-raiz' | 'novo-filho' | 'renomear'
  let nodeParentId = null;
  let nodeEditId = null;

  // Estado modal de peça (compartilhado entre os dois formulários)
  let pecaEditId = null;
  let pecaForm = null;

  // Estado modal de mover
  let pecaMoverId = null;

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
      const [cfgSnap, listaAlv, listaAcab] = await Promise.all([
        db.collection('obras').doc(obraId).collection('config').doc(CONFIG_DOC).get(),
        Database.listar(obraId, COL_ALV, null).catch(() => []),
        Database.listar(obraId, COL_ACAB, null).catch(() => []),
      ]);
      arvore = (cfgSnap.exists && Array.isArray(cfgSnap.data().arvore)) ? cfgSnap.data().arvore : [];
      pecasAlvenaria = listaAlv;
      pecasAcabamento = listaAcab;
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
  // HELPERS GERAIS
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
    if (!/^[0-9+\-*/.() ]+$/.test(s)) return null;
    if (!/[+\-*/]/.test(s)) return null;
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

  // ══════════════════════════════════════════
  // CONFIGURAÇÕES DE CÁLCULO (Vãos e Metro Linear) — vale para os dois lançamentos
  // ══════════════════════════════════════════
  function _getCfg() {
    const d = {
      vao_modo: 'desconto_total',
      vao_limite_x: 1.5,
      vao_valor_y: 1.0,
      ml_menor_que: 0.50,
      ml_percentual: 50,
    };
    try { return Object.assign(d, JSON.parse(localStorage.getItem('paredesCfg_' + obraId) || '{}')); } catch (e) { return d; }
  }
  function _saveCfg(cfg) { localStorage.setItem('paredesCfg_' + obraId, JSON.stringify(cfg)); }

  function _descontoVao(compV, altV, qtdV, cfg) {
    if (!(qtdV > 0 && compV > 0 && altV > 0)) return 0;
    if (cfg.vao_modo === 'nenhum') return 0;
    const areaUnitaria = compV * altV;
    const areaTotal = areaUnitaria * qtdV;
    const limX = num(cfg.vao_limite_x) || 1.5;
    const valY = num(cfg.vao_valor_y) || 1.0;
    if (cfg.vao_modo === 'desconto_total') return areaTotal;
    if (cfg.vao_modo === 'parcial_considera') return areaUnitaria > limX ? Math.max(0, (areaUnitaria - valY) * qtdV) : 0;
    if (cfg.vao_modo === 'parcial_desconta') return areaUnitaria > limX ? valY * qtdV : 0;
    if (cfg.vao_modo === 'metade') return areaTotal / 2;
    return 0;
  }

  // ══════════════════════════════════════════
  // ÁRVORE DE LOCAIS (compartilhada pelas duas abas)
  // ══════════════════════════════════════════
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
    for (const n of nodes) {
      if (n.filhos && _removerNode(id, n.filhos)) return true;
    }
    return false;
  }
  function _acharArrayPai(id, nodes = arvore) {
    if (nodes.some(n => n.id === id)) return nodes;
    for (const n of nodes) {
      if (n.filhos && n.filhos.length) {
        const found = _acharArrayPai(id, n.filhos);
        if (found) return found;
      }
    }
    return null;
  }
  function _clonarSubarvore(node, novoNomeRaiz) {
    const mapaIds = {};
    function clone(n, nome) {
      const novoId = _uid();
      mapaIds[n.id] = novoId;
      return { id: novoId, nome, filhos: (n.filhos || []).map(f => clone(f, f.nome)) };
    }
    const novoNode = clone(node, novoNomeRaiz);
    return { novoNode, mapaIds };
  }
  function _breadcrumb(nodeId) {
    const r = _acharNode(nodeId);
    return r ? r.path.join(' → ') : '';
  }
  function _listaNosFlat(nodes = arvore, path = [], out = []) {
    nodes.forEach(n => {
      out.push({ id: n.id, label: [...path, n.nome].join(' → ') });
      _listaNosFlat(n.filhos || [], [...path, n.nome], out);
    });
    return out;
  }

  // ══════════════════════════════════════════
  // CÁLCULOS — ALVENARIA (parede física, uma vez só)
  // ══════════════════════════════════════════
  function _calcularAlvenaria(p, cfg) {
    if (!cfg) cfg = _getCfg();
    const compM = num(p.comprimento) / 100;
    const altM = num(p.altura) / 100;
    const areaBruta = compM * altM;
    const areaVaos = (p.vaos || []).reduce((s, v) => s + _descontoVao(num(v.comprimento) / 100, num(v.altura) / 100, num(v.qtd) || 1, cfg), 0);
    const areaLiquida = Math.max(0, areaBruta - areaVaos);
    const podeML = !!p.podeSerML;
    const mlPct = (num(cfg.ml_percentual) || 50) / 100;
    const ml = podeML ? Math.max(compM, altM) : 0;
    const m2comPuro = podeML ? 0 : areaLiquida;
    return {
      areaBruta, areaVaos, areaLiquida, podeML, mlPct, ml, m2comPuro,
      vedacao: p.tipoAlvenaria === 'vedacao' ? areaLiquida : 0,
      estrutural: p.tipoAlvenaria === 'estrutural' ? areaLiquida : 0,
    };
  }

  function _totaisAlvenaria(lista) {
    const cfg = _getCfg();
    const t = { vedacao: 0, estrutural: 0, areaLiquida: 0, ml: 0, mlEquiv: 0, m2comPuro: 0, qtdPecas: lista.length };
    lista.forEach(p => {
      const c = _calcularAlvenaria(p, cfg);
      t.vedacao += c.vedacao; t.estrutural += c.estrutural; t.areaLiquida += c.areaLiquida;
      t.ml += c.ml; t.mlEquiv += c.ml * c.mlPct; t.m2comPuro += c.m2comPuro;
    });
    t.m2comEquiv = t.m2comPuro + t.mlEquiv;
    return t;
  }

  // ══════════════════════════════════════════
  // CÁLCULOS — ACABAMENTO (uma face de parede dentro de um cômodo)
  // ══════════════════════════════════════════
  function _calcularAcabamento(p, cfg) {
    if (!cfg) cfg = _getCfg();
    const compM = num(p.comprimento) / 100;
    const altM = num(p.altura) / 100;
    const areaBruta = compM * altM;
    const areaVaos = (p.vaos || []).reduce((s, v) => s + _descontoVao(num(v.comprimento) / 100, num(v.altura) / 100, num(v.qtd) || 1, cfg), 0);
    const areaLiquida = Math.max(0, areaBruta - areaVaos);
    const podeML = !!p.podeSerML;
    const mlPct = (num(cfg.ml_percentual) || 50) / 100;
    const ml = podeML ? Math.max(compM, altM) : 0;
    const m2comPuro = podeML ? 0 : areaLiquida;

    const acabTotais = { gesso: 0, reboco: 0, revestimento: 0 };
    (p.acabamentos || []).forEach(a => {
      const area = areaLiquida * (num(a.pct) / 100);
      if (acabTotais[a.tipo] != null) acabTotais[a.tipo] += area;
    });
    const pinturaTotais = {};
    let pinturaArea = 0;
    if (p.temPintura) {
      (p.pintura || []).forEach(pt => {
        const area = areaLiquida * (num(pt.pct) / 100);
        pinturaArea += area;
        const cor = pt.cor || '(sem nome)';
        pinturaTotais[cor] = (pinturaTotais[cor] || 0) + area;
      });
    }
    return {
      areaBruta, areaVaos, areaLiquida, podeML, mlPct, ml, m2comPuro,
      gesso: acabTotais.gesso, reboco: acabTotais.reboco, revestimento: acabTotais.revestimento,
      pintura: pinturaArea, pinturaPorCor: pinturaTotais,
    };
  }

  function _totaisAcabamento(lista) {
    const cfg = _getCfg();
    const t = { gesso: 0, reboco: 0, revestimento: 0, pintura: 0, pinturaPorCor: {}, areaLiquida: 0, ml: 0, mlEquiv: 0, m2comPuro: 0, qtdPecas: lista.length };
    lista.forEach(p => {
      const c = _calcularAcabamento(p, cfg);
      t.gesso += c.gesso; t.reboco += c.reboco; t.revestimento += c.revestimento; t.pintura += c.pintura;
      t.areaLiquida += c.areaLiquida; t.ml += c.ml; t.mlEquiv += c.ml * c.mlPct; t.m2comPuro += c.m2comPuro;
      Object.entries(c.pinturaPorCor).forEach(([cor, area]) => { t.pinturaPorCor[cor] = (t.pinturaPorCor[cor] || 0) + area; });
    });
    t.m2comEquiv = t.m2comPuro + t.mlEquiv;
    return t;
  }

  function _htmlBarraML(t) {
    return `
      <div class="cc-panel">
        <div class="cc-panelTitle">📏 Metro Linear</div>
        <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:0.85rem;">
          <span>m² sem ML: <strong>${fmt2(t.areaLiquida)}</strong></span>
          <span>ML: <strong>${fmt2(t.ml)}</strong></span>
          <span>m² com ML equivalente: <strong style="color:var(--cor-primaria-dark);">${fmt2(t.m2comEquiv)}</strong></span>
        </div>
      </div>`;
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
          <span class="subtitulo">${pecasAlvenaria.length} parede(s) de alvenaria · ${pecasAcabamento.length} face(s) de acabamento</span>
        </div>
      </div>
      <div class="aba-toggle mb-2">
        <button class="aba-btn ${aba === 'alvenaria' ? 'ativo' : ''}" onclick="LP.setAba('alvenaria')">🧱 Alvenaria</button>
        <button class="aba-btn ${aba === 'acabamento' ? 'ativo' : ''}" onclick="LP.setAba('acabamento')">🎨 Acabamento de Paredes</button>
      </div>
      <div class="ar-layout">
        <div class="ar-tree">
          <div class="ar-tree-header">
            <h3>Locais</h3>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-secundario btn-sm" onclick="LP.abrirConfig()" title="Configurações de cálculo (vãos e Metro Linear)">⚙️</button>
              <button class="btn btn-secundario btn-sm" onclick="LP.novoNode(null)">+ Local</button>
            </div>
          </div>
          <div class="ar-tree-body">${_renderArvore()}</div>
        </div>
        <div class="ar-painel">${_renderPainel()}</div>
      </div>`;
  }

  function setAba(novaAba) { aba = novaAba; renderizar(); }

  function _pecasAtual() { return aba === 'alvenaria' ? pecasAlvenaria : pecasAcabamento; }
  function _colAtual() { return aba === 'alvenaria' ? COL_ALV : COL_ACAB; }

  function _renderArvoreNivel(nodes) {
    const pecasAtuais = _pecasAtual();
    return nodes.map(n => {
      const aberto = openNodes.has(n.id);
      const ativo = selNodeId === n.id;
      const ids = _idsComDescendentes(n);
      const nPecas = pecasAtuais.filter(p => ids.includes(p.nodeId)).length;
      let h = `<div class="tree-item${ativo ? ' ativo' : ''}" onclick="LP.toggleNode('${n.id}');LP.selNode('${n.id}')">
        <span class="tree-toggle">${(n.filhos || []).length ? (aberto ? '▼' : '▶') : ''}</span>
        <span class="tree-icon">📍</span>
        <span class="tree-label">${esc(n.nome)}</span>
        ${nPecas ? `<span class="tree-badge">${nPecas}</span>` : ''}
        <button class="tree-edit-btn" onclick="event.stopPropagation();LP.renomearNode('${n.id}')" title="Renomear">✎</button>
        <button class="tree-clone-btn" onclick="event.stopPropagation();LP.clonarNode('${n.id}')" title="Clonar local (com sublocais, alvenaria e acabamento)">⧉</button>
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

  // ══════════════════════════════════════════
  // PAINEL
  // ══════════════════════════════════════════
  function _renderPainel() {
    if (!selNodeId) return aba === 'alvenaria' ? _renderResumoGeralAlvenaria() : _renderResumoGeralAcabamento();
    const r = _acharNode(selNodeId);
    if (!r) { selNodeId = null; return aba === 'alvenaria' ? _renderResumoGeralAlvenaria() : _renderResumoGeralAcabamento(); }
    return aba === 'alvenaria' ? _renderPainelAlvenaria(r) : _renderPainelAcabamento(r);
  }

  // ── Visão Geral: Alvenaria ──
  function _renderResumoGeralAlvenaria() {
    const t = _totaisAlvenaria(pecasAlvenaria);
    return `
      <div class="page-header">
        <div><h2 style="font-size:1.1rem;">📊 Visão Geral — Alvenaria</h2>
          <span class="subtitulo">${t.qtdPecas} parede(s) cadastrada(s) · ${fmt2(t.areaLiquida)} m²</span></div>
      </div>
      <div class="cc-kpiGrid" style="grid-template-columns:repeat(2,1fr);">
        <div class="cc-kpi"><div class="cc-kpiIcon">🧱</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Alvenaria de Vedação</div><div class="cc-kpiValue">${fmt2(t.vedacao)}<span class="cc-kpiUnit">m²</span></div></div></div>
        <div class="cc-kpi"><div class="cc-kpiIcon">🧱</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Alvenaria Estrutural</div><div class="cc-kpiValue">${fmt2(t.estrutural)}<span class="cc-kpiUnit">m²</span></div></div></div>
      </div>
      ${_htmlBarraML(t)}
      <div class="cc-panel">
        <div class="cc-panelTitle">📍 Resumo por Local (nível superior)</div>
        ${!arvore.length ? `<div class="cc-empty">Cadastre locais na árvore ao lado para ver o resumo.</div>` : `
        <div class="tabela-container"><table class="tabela">
          <thead><tr><th>Local</th><th style="text-align:right;">Paredes</th><th style="text-align:right;">Vedação</th><th style="text-align:right;">Estrutural</th></tr></thead>
          <tbody>
            ${arvore.map(raiz => {
              const ids = _idsComDescendentes(raiz);
              const lst = pecasAlvenaria.filter(p => ids.includes(p.nodeId));
              const rt = _totaisAlvenaria(lst);
              return `<tr><td><strong>${esc(raiz.nome)}</strong></td><td style="text-align:right;">${rt.qtdPecas}</td><td style="text-align:right;">${fmt2(rt.vedacao)}</td><td style="text-align:right;">${fmt2(rt.estrutural)}</td></tr>`;
            }).join('')}
          </tbody>
        </table></div>`}
      </div>`;
  }

  // ── Visão Geral: Acabamento ──
  function _renderResumoGeralAcabamento() {
    const t = _totaisAcabamento(pecasAcabamento);
    const coresOrdenadas = Object.entries(t.pinturaPorCor).sort((a, b) => b[1] - a[1]);
    return `
      <div class="page-header">
        <div><h2 style="font-size:1.1rem;">📊 Visão Geral — Acabamento de Paredes</h2>
          <span class="subtitulo">${t.qtdPecas} face(s) cadastrada(s) · ${fmt2(t.areaLiquida)} m²</span></div>
      </div>
      <div class="cc-kpiGrid" style="grid-template-columns:repeat(4,1fr);">
        <div class="cc-kpi"><div class="cc-kpiIcon">🏳️</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Gesso Liso</div><div class="cc-kpiValue">${fmt2(t.gesso)}<span class="cc-kpiUnit">m²</span></div><div class="cc-kpiSub">Chapisco + Gesso na mesma área</div></div></div>
        <div class="cc-kpi"><div class="cc-kpiIcon">🪨</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Reboco</div><div class="cc-kpiValue">${fmt2(t.reboco)}<span class="cc-kpiUnit">m²</span></div><div class="cc-kpiSub">Chapisco + Massa na mesma área</div></div></div>
        <div class="cc-kpi"><div class="cc-kpiIcon">◻️</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Revestimento</div><div class="cc-kpiValue">${fmt2(t.revestimento)}<span class="cc-kpiUnit">m²</span></div><div class="cc-kpiSub">Porcelanato / cerâmica</div></div></div>
        <div class="cc-kpi"><div class="cc-kpiIcon">🎨</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Pintura</div><div class="cc-kpiValue">${fmt2(t.pintura)}<span class="cc-kpiUnit">m²</span></div></div></div>
      </div>
      ${_htmlBarraML(t)}
      <div class="cc-panel">
        <div class="cc-panelTitle">🎨 Pintura por Cor</div>
        ${!coresOrdenadas.length ? `<div class="cc-empty">Nenhuma pintura lançada ainda.</div>` : `
        <div class="tabela-container"><table class="tabela">
          <thead><tr><th>Cor</th><th style="text-align:right;">m²</th><th style="text-align:right;">%</th></tr></thead>
          <tbody>
            ${coresOrdenadas.map(([cor, area]) => `<tr><td>${esc(cor)}</td><td style="text-align:right;">${fmt2(area)}</td><td style="text-align:right;">${t.pintura ? fmt2(area / t.pintura * 100) : '0,00'}%</td></tr>`).join('')}
          </tbody>
        </table></div>`}
      </div>
      <div class="cc-panel">
        <div class="cc-panelTitle">📍 Resumo por Local (nível superior)</div>
        ${!arvore.length ? `<div class="cc-empty">Cadastre locais na árvore ao lado para ver o resumo.</div>` : `
        <div class="tabela-container"><table class="tabela">
          <thead><tr><th>Local</th><th style="text-align:right;">Faces</th><th style="text-align:right;">Gesso</th><th style="text-align:right;">Reboco</th><th style="text-align:right;">Rev.</th><th style="text-align:right;">Pintura</th></tr></thead>
          <tbody>
            ${arvore.map(raiz => {
              const ids = _idsComDescendentes(raiz);
              const lst = pecasAcabamento.filter(p => ids.includes(p.nodeId));
              const rt = _totaisAcabamento(lst);
              return `<tr><td><strong>${esc(raiz.nome)}</strong></td><td style="text-align:right;">${rt.qtdPecas}</td><td style="text-align:right;">${fmt2(rt.gesso)}</td><td style="text-align:right;">${fmt2(rt.reboco)}</td><td style="text-align:right;">${fmt2(rt.revestimento)}</td><td style="text-align:right;">${fmt2(rt.pintura)}</td></tr>`;
            }).join('')}
          </tbody>
        </table></div>`}
      </div>`;
  }

  // ── Painel de local: Alvenaria ──
  function _renderPainelAlvenaria(r) {
    const node = r.node;
    const idsSubtree = _idsComDescendentes(node);
    const listaSubtree = pecasAlvenaria.filter(p => idsSubtree.includes(p.nodeId));
    const listaDireta = pecasAlvenaria.filter(p => p.nodeId === selNodeId);
    const tSub = _totaisAlvenaria(listaSubtree);
    const temFilhos = node.filhos && node.filhos.length;

    let html = `
      <div class="page-header">
        <div><h2 style="font-size:1.1rem;">${esc(r.path.join(' → '))} <span class="text-sm text-muted">— Alvenaria</span></h2>
          <span class="subtitulo">${listaSubtree.length} parede(s) no total${temFilhos ? ` (${listaDireta.length} direta[s] neste local)` : ''} · ${fmt2(tSub.areaLiquida)} m²</span></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-secundario btn-sm" onclick="LP.clonarNode('${selNodeId}')" title="Clonar local">⧉ Clonar Local</button>
          <button class="btn btn-primario btn-sm" onclick="LP.novaAlvenaria()">+ Nova Parede</button>
        </div>
      </div>
      <div class="cc-kpiGrid" style="grid-template-columns:repeat(2,1fr);margin-bottom:16px;">
        <div class="cc-kpi"><div class="cc-kpiIcon">🧱</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Vedação</div><div class="cc-kpiValue">${fmt2(tSub.vedacao)}<span class="cc-kpiUnit">m²</span></div></div></div>
        <div class="cc-kpi"><div class="cc-kpiIcon">🧱</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Estrutural</div><div class="cc-kpiValue">${fmt2(tSub.estrutural)}<span class="cc-kpiUnit">m²</span></div></div></div>
      </div>
      ${_htmlBarraML(tSub)}`;

    if (temFilhos) {
      html += `
      <div class="cc-panel">
        <div class="cc-panelTitle">📍 Resumo por Sublocal</div>
        <div class="tabela-container"><table class="tabela">
          <thead><tr><th>Sublocal</th><th style="text-align:right;">Paredes</th><th style="text-align:right;">Vedação</th><th style="text-align:right;">Estrutural</th><th></th></tr></thead>
          <tbody>
            ${node.filhos.map(f => {
              const idsF = _idsComDescendentes(f);
              const lstF = pecasAlvenaria.filter(p => idsF.includes(p.nodeId));
              const tF = _totaisAlvenaria(lstF);
              return `<tr style="cursor:pointer;" onclick="LP.selNode('${f.id}')">
                <td><strong>${esc(f.nome)}</strong></td>
                <td style="text-align:right;">${tF.qtdPecas}</td>
                <td style="text-align:right;">${fmt2(tF.vedacao)}</td>
                <td style="text-align:right;">${fmt2(tF.estrutural)}</td>
                <td style="white-space:nowrap;" onclick="event.stopPropagation();"><button class="btn btn-secundario btn-sm" onclick="LP.clonarNode('${f.id}')" title="Clonar">⧉</button></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table></div>
      </div>`;
    }

    html += `<div class="cc-panel">
      <div class="cc-panelTitle">🧱 Paredes lançadas diretamente neste local</div>
      ${!listaDireta.length ? `<div class="cc-empty">Nenhuma parede lançada diretamente aqui ainda.${temFilhos ? ' Veja o resumo por sublocal acima ou' : ''} Clique em "+ Nova Parede" para começar.</div>` : `
      <div class="tabela-container"><table class="tabela">
        <thead><tr><th>Parede</th><th>Comp x Alt (cm)</th><th style="text-align:right;">m²</th><th>Tipo</th><th></th></tr></thead>
        <tbody>${listaDireta.map(p => _renderLinhaAlvenaria(p)).join('')}</tbody>
      </table></div>`}
    </div>`;

    return html;
  }

  // ── Painel de local: Acabamento ──
  function _renderPainelAcabamento(r) {
    const node = r.node;
    const idsSubtree = _idsComDescendentes(node);
    const listaSubtree = pecasAcabamento.filter(p => idsSubtree.includes(p.nodeId));
    const listaDireta = pecasAcabamento.filter(p => p.nodeId === selNodeId);
    const tSub = _totaisAcabamento(listaSubtree);
    const temFilhos = node.filhos && node.filhos.length;

    let html = `
      <div class="page-header">
        <div><h2 style="font-size:1.1rem;">${esc(r.path.join(' → '))} <span class="text-sm text-muted">— Acabamento</span></h2>
          <span class="subtitulo">${listaSubtree.length} face(s) no total${temFilhos ? ` (${listaDireta.length} direta[s] neste local)` : ''} · ${fmt2(tSub.areaLiquida)} m²</span></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-secundario btn-sm" onclick="LP.clonarNode('${selNodeId}')" title="Clonar local">⧉ Clonar Local</button>
          <button class="btn btn-primario btn-sm" onclick="LP.novaAcabamento()">+ Nova Face</button>
        </div>
      </div>
      <div class="cc-kpiGrid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px;">
        <div class="cc-kpi"><div class="cc-kpiIcon">🏳️</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Gesso Liso</div><div class="cc-kpiValue">${fmt2(tSub.gesso)}<span class="cc-kpiUnit">m²</span></div></div></div>
        <div class="cc-kpi"><div class="cc-kpiIcon">🪨</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Reboco</div><div class="cc-kpiValue">${fmt2(tSub.reboco)}<span class="cc-kpiUnit">m²</span></div></div></div>
        <div class="cc-kpi"><div class="cc-kpiIcon">◻️</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Revestimento</div><div class="cc-kpiValue">${fmt2(tSub.revestimento)}<span class="cc-kpiUnit">m²</span></div></div></div>
        <div class="cc-kpi"><div class="cc-kpiIcon">🎨</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Pintura</div><div class="cc-kpiValue">${fmt2(tSub.pintura)}<span class="cc-kpiUnit">m²</span></div></div></div>
      </div>
      ${_htmlBarraML(tSub)}`;

    if (temFilhos) {
      html += `
      <div class="cc-panel">
        <div class="cc-panelTitle">📍 Resumo por Sublocal</div>
        <div class="tabela-container"><table class="tabela">
          <thead><tr><th>Sublocal</th><th style="text-align:right;">Faces</th><th style="text-align:right;">Gesso</th><th style="text-align:right;">Reboco</th><th style="text-align:right;">Rev.</th><th style="text-align:right;">Pintura</th><th></th></tr></thead>
          <tbody>
            ${node.filhos.map(f => {
              const idsF = _idsComDescendentes(f);
              const lstF = pecasAcabamento.filter(p => idsF.includes(p.nodeId));
              const tF = _totaisAcabamento(lstF);
              return `<tr style="cursor:pointer;" onclick="LP.selNode('${f.id}')">
                <td><strong>${esc(f.nome)}</strong></td>
                <td style="text-align:right;">${tF.qtdPecas}</td>
                <td style="text-align:right;">${fmt2(tF.gesso)}</td>
                <td style="text-align:right;">${fmt2(tF.reboco)}</td>
                <td style="text-align:right;">${fmt2(tF.revestimento)}</td>
                <td style="text-align:right;">${fmt2(tF.pintura)}</td>
                <td style="white-space:nowrap;" onclick="event.stopPropagation();"><button class="btn btn-secundario btn-sm" onclick="LP.clonarNode('${f.id}')" title="Clonar">⧉</button></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table></div>
      </div>`;
    }

    html += `<div class="cc-panel">
      <div class="cc-panelTitle">🎨 Faces lançadas diretamente neste local</div>
      ${!listaDireta.length ? `<div class="cc-empty">Nenhuma face de acabamento lançada diretamente aqui ainda.${temFilhos ? ' Veja o resumo por sublocal acima ou' : ''} Clique em "+ Nova Face" para começar.</div>` : `
      <div class="tabela-container"><table class="tabela">
        <thead><tr><th>Face</th><th>Comp x Alt (cm)</th><th style="text-align:right;">m²</th><th>Acabamento</th><th></th></tr></thead>
        <tbody>${listaDireta.map(p => _renderLinhaAcabamento(p)).join('')}</tbody>
      </table></div>`}
    </div>`;

    return html;
  }

  function _renderLinhaAlvenaria(p) {
    const c = _calcularAlvenaria(p);
    return `<tr${p.conferido ? ' style="background:rgba(22,163,74,0.06);"' : ''}>
      <td><strong>${esc(p.nome || 'Parede')}</strong>${p.conferido ? ' <span style="color:#16a34a;" title="Conferida">✓</span>' : ''}${p.podeSerML ? ' <span style="color:#b45309;" title="Marcada como ML">📏</span>' : ''}${p.vaos && p.vaos.length ? `<div class="text-sm text-muted">${p.vaos.length} vão(s)</div>` : ''}</td>
      <td>${num(p.comprimento)} x ${num(p.altura)}</td>
      <td style="text-align:right;">${fmt2(c.areaLiquida)}</td>
      <td>${p.tipoAlvenaria === 'estrutural' ? 'Estrutural' : 'Vedação'}</td>
      <td style="white-space:nowrap;">
        <button class="btn btn-secundario btn-sm" onclick="LP.editarAlvenaria('${p.id}')" title="Editar">✎</button>
        <button class="btn btn-sm btn-icon" onclick="LP.abrirMoverPeca('${p.id}')" title="Mover para outro local">⇄</button>
        <button class="btn btn-sm btn-icon" onclick="LP.duplicarPeca('${p.id}')" title="Duplicar">⧉</button>
        <button class="btn btn-sm btn-icon" onclick="LP.conferirPeca('${p.id}')" title="${p.conferido ? 'Desmarcar conferência' : 'Marcar como conferida'}">${p.conferido ? '↩' : '✓'}</button>
        <button class="btn btn-perigo btn-sm btn-icon" onclick="LP.excluirPeca('${p.id}')" title="Excluir">✕</button>
      </td>
    </tr>`;
  }

  function _resumoAcab(p) {
    const acabs = (p.acabamentos || []).map(a => {
      const label = TIPOS_ACABAMENTO.find(t => t.id === a.tipo)?.label || a.tipo;
      return `${label} ${num(a.pct)}%`;
    }).join(' + ') || '—';
    const pint = p.temPintura ? ` <span style="color:#888;">| 🎨 ${(p.pintura || []).map(pt => `${esc(pt.cor || '?')} ${num(pt.pct)}%`).join(', ')}</span>` : '';
    return acabs + pint;
  }

  function _renderLinhaAcabamento(p) {
    const c = _calcularAcabamento(p);
    return `<tr${p.conferido ? ' style="background:rgba(22,163,74,0.06);"' : ''}>
      <td><strong>${esc(p.nome || 'Face')}</strong>${p.conferido ? ' <span style="color:#16a34a;" title="Conferida">✓</span>' : ''}${p.podeSerML ? ' <span style="color:#b45309;" title="Marcada como ML">📏</span>' : ''}${p.vaos && p.vaos.length ? `<div class="text-sm text-muted">${p.vaos.length} vão(s)</div>` : ''}</td>
      <td>${num(p.comprimento)} x ${num(p.altura)}</td>
      <td style="text-align:right;">${fmt2(c.areaLiquida)}</td>
      <td class="text-sm">${_resumoAcab(p)}</td>
      <td style="white-space:nowrap;">
        <button class="btn btn-secundario btn-sm" onclick="LP.editarAcabamento('${p.id}')" title="Editar">✎</button>
        <button class="btn btn-sm btn-icon" onclick="LP.abrirMoverPeca('${p.id}')" title="Mover para outro local">⇄</button>
        <button class="btn btn-sm btn-icon" onclick="LP.duplicarPeca('${p.id}')" title="Duplicar">⧉</button>
        <button class="btn btn-sm btn-icon" onclick="LP.conferirPeca('${p.id}')" title="${p.conferido ? 'Desmarcar conferência' : 'Marcar como conferida'}">${p.conferido ? '↩' : '✓'}</button>
        <button class="btn btn-perigo btn-sm btn-icon" onclick="LP.excluirPeca('${p.id}')" title="Excluir">✕</button>
      </td>
    </tr>`;
  }

  // ══════════════════════════════════════════
  // NAVEGAÇÃO NA ÁRVORE
  // ══════════════════════════════════════════
  function selGeral() { selNodeId = null; renderizar(); }
  function selNode(id) { selNodeId = id; renderizar(); }
  function toggleNode(id) { if (openNodes.has(id)) openNodes.delete(id); else openNodes.add(id); }

  // ══════════════════════════════════════════
  // CRUD DE NÓS (LOCAIS) — compartilhado pelas duas abas
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
    const nAlv = pecasAlvenaria.filter(p => ids.includes(p.nodeId)).length;
    const nAcab = pecasAcabamento.filter(p => ids.includes(p.nodeId)).length;
    const total = nAlv + nAcab;
    const msg = total
      ? `"${r.node.nome}" (e seus sublocais) possui ${nAlv} parede(s) de alvenaria e ${nAcab} face(s) de acabamento. Excluir vai apagar o local E todos esses lançamentos. Confirma?`
      : `Excluir o local "${r.node.nome}"${r.node.filhos && r.node.filhos.length ? ' e seus sublocais' : ''}?`;
    const ok = await Utils.confirmar(msg);
    if (!ok) return;
    Utils.mostrarLoading();
    try {
      const ops = [
        ...pecasAlvenaria.filter(p => ids.includes(p.nodeId)).map(p => ({ type: 'delete', ref: Database.ref(obraId, COL_ALV).doc(p.id) })),
        ...pecasAcabamento.filter(p => ids.includes(p.nodeId)).map(p => ({ type: 'delete', ref: Database.ref(obraId, COL_ACAB).doc(p.id) })),
      ];
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

  async function clonarNode(id) {
    const r = _acharNode(id); if (!r) return;
    const ok = await Utils.confirmar(`Clonar "${r.node.nome}" com todos os sublocais, alvenaria e acabamento, como "${r.node.nome} (cópia)"?`);
    if (!ok) return;
    Utils.mostrarLoading();
    try {
      const parentArr = _acharArrayPai(id);
      if (!parentArr) throw new Error('Não foi possível localizar o local pai.');
      const { novoNode, mapaIds } = _clonarSubarvore(r.node, r.node.nome + ' (cópia)');
      parentArr.push(novoNode);
      const oldIds = _idsComDescendentes(r.node);
      const novasAlv = pecasAlvenaria.filter(p => oldIds.includes(p.nodeId));
      const novasAcab = pecasAcabamento.filter(p => oldIds.includes(p.nodeId));
      const ops = [
        ...novasAlv.map(p => { const { id: _pid, ...rest } = p; return { type: 'set', ref: Database.ref(obraId, COL_ALV).doc(), data: { ...rest, nodeId: mapaIds[p.nodeId] } }; }),
        ...novasAcab.map(p => { const { id: _pid, ...rest } = p; return { type: 'set', ref: Database.ref(obraId, COL_ACAB).doc(), data: { ...rest, nodeId: mapaIds[p.nodeId] } }; }),
      ];
      for (let i = 0; i < ops.length; i += 400) await Database.batchWrite(ops.slice(i, i + 400));
      await _salvarArvore();
      Utils.toast(`✓ "${r.node.nome}" clonado com ${novasAlv.length} parede(s) e ${novasAcab.length} face(s)!`, 'sucesso');
      await carregar();
    } catch (e) {
      Utils.toast('Erro ao clonar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ══════════════════════════════════════════
  // AÇÕES RÁPIDAS GENÉRICAS (MOVER / DUPLICAR / CONFERIR / EXCLUIR)
  // Operam sobre a coleção da aba ativa no momento do clique.
  // ══════════════════════════════════════════
  async function duplicarPeca(id) {
    const arr = _pecasAtual();
    const p = arr.find(x => x.id === id); if (!p) return;
    Utils.mostrarLoading();
    try {
      const { id: _pid, ...rest } = p;
      await Database.criar(obraId, _colAtual(), { ...rest, nome: (rest.nome || (aba === 'alvenaria' ? 'Parede' : 'Face')) + ' (cópia)' });
      Utils.toast('✓ Duplicado!', 'sucesso');
      await carregar();
    } catch (e) {
      Utils.toast('Erro ao duplicar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  async function conferirPeca(id) {
    const arr = _pecasAtual();
    const p = arr.find(x => x.id === id); if (!p) return;
    Utils.mostrarLoading();
    try {
      await Database.atualizar(obraId, _colAtual(), id, { conferido: !p.conferido });
      await carregar();
    } catch (e) {
      Utils.toast('Erro: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  function abrirMoverPeca(id) {
    const arr = _pecasAtual();
    const p = arr.find(x => x.id === id); if (!p) return;
    pecaMoverId = id;
    const opts = _listaNosFlat();
    const sel = document.getElementById('lp-mover-destino');
    if (sel) sel.innerHTML = opts.map(o => `<option value="${o.id}" ${o.id === p.nodeId ? 'selected' : ''}>${esc(o.label)}</option>`).join('');
    document.getElementById('lp-mover-titulo').textContent = `Mover "${p.nome || (aba === 'alvenaria' ? 'Parede' : 'Face')}"`;
    Utils.abrirModal('modal-lp-mover');
  }

  async function confirmarMoverPeca() {
    const destino = document.getElementById('lp-mover-destino')?.value;
    if (!destino || !pecaMoverId) return;
    Utils.mostrarLoading();
    try {
      await Database.atualizar(obraId, _colAtual(), pecaMoverId, { nodeId: destino });
      Utils.fecharModal('modal-lp-mover');
      Utils.toast('✓ Movido!', 'sucesso');
      pecaMoverId = null;
      await carregar();
    } catch (e) {
      Utils.toast('Erro ao mover: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  async function excluirPeca(id) {
    const ok = await Utils.confirmar('Excluir este lançamento?');
    if (!ok) return;
    Utils.mostrarLoading();
    try {
      await Database.deletar(obraId, _colAtual(), id);
      Utils.toast('Excluído.', 'sucesso');
      await carregar();
    } catch (e) {
      Utils.toast('Erro ao excluir: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ══════════════════════════════════════════
  // FORMULÁRIO: sugestão de ML (comum aos dois tipos)
  // ══════════════════════════════════════════
  function _sugerirML(areaBrutaCb) {
    if (pecaForm._mlManualTouch) return;
    const cfg = _getCfg();
    const compM = num(pecaForm.comprimento) / 100;
    const altM = num(pecaForm.altura) / 100;
    if (!compM || !altM) return;
    const areaBruta = compM * altM;
    const menor = num(cfg.ml_menor_que) || 0.5;
    const sugerido = areaBruta <= menor;
    pecaForm.podeSerML = sugerido;
    const cb = document.getElementById(areaBrutaCb);
    if (cb) cb.checked = sugerido;
  }
  function onClickPodeML(checked) {
    pecaForm._mlManualTouch = true;
    pecaForm.podeSerML = checked;
  }

  // ══════════════════════════════════════════
  // MÓDULO ALVENARIA — formulário
  // ══════════════════════════════════════════
  function novaAlvenaria() {
    if (!selNodeId) { Utils.toast('Selecione um local na árvore.', 'alerta'); return; }
    pecaEditId = null;
    pecaForm = {
      nome: `Parede ${pecasAlvenaria.filter(p => p.nodeId === selNodeId).length + 1}`,
      comprimento: '', altura: '',
      tipoAlvenaria: 'vedacao',
      podeSerML: false, _mlManualTouch: false,
      possuiVao: false,
      vaos: [],
    };
    document.getElementById('lp-alv-titulo').textContent = 'Nova Parede (Alvenaria)';
    _renderFormAlvenaria();
    Utils.abrirModal('modal-lp-alv');
    setTimeout(() => document.getElementById('lp-alv-comp')?.focus(), 60);
  }

  function editarAlvenaria(id) {
    const p = pecasAlvenaria.find(x => x.id === id); if (!p) return;
    pecaEditId = id;
    pecaForm = JSON.parse(JSON.stringify(p));
    pecaForm.podeSerML = !!p.podeSerML;
    pecaForm._mlManualTouch = true;
    pecaForm.possuiVao = !!(pecaForm.vaos && pecaForm.vaos.length);
    document.getElementById('lp-alv-titulo').textContent = 'Editar Parede (Alvenaria)';
    _renderFormAlvenaria();
    Utils.abrirModal('modal-lp-alv');
  }

  function _renderFormAlvenaria() {
    const body = document.getElementById('lp-alv-body'); if (!body) return;
    body.innerHTML = `
      <div style="background:var(--cor-fundo);border-radius:8px;padding:8px 14px;margin-bottom:14px;font-size:0.82rem;color:var(--cor-texto-secundario);">
        Local: <strong style="color:var(--cor-primaria-dark);">${esc(_breadcrumb(selNodeId))}</strong>
      </div>
      <div class="form-grupo"><label>Identificação da parede</label>
        <input type="text" id="lp-alv-nome" class="form-control" value="${esc(pecaForm.nome)}" placeholder="Ex: Parede D/B, Parede Norte..." oninput="LP.updAlv('nome', this.value)"></div>
      <div class="form-row">
        <div class="form-grupo"><label>Comprimento (cm)</label>
          <input type="text" inputmode="decimal" id="lp-alv-comp" class="form-control" placeholder="Ex: 350 ou 150+200" value="${esc(pecaForm.comprimento)}" oninput="LP.updAlv('comprimento', this.value)" onkeydown="LP.calcExprEnter(event)"></div>
        <div class="form-grupo"><label>Altura (cm)</label>
          <input type="text" inputmode="decimal" id="lp-alv-alt" class="form-control" placeholder="Ex: 280" value="${esc(pecaForm.altura)}" oninput="LP.updAlv('altura', this.value)" onkeydown="LP.calcExprEnter(event)"></div>
        <div class="form-grupo"><label>Alvenaria</label>
          <select id="lp-alv-tipo" class="form-control" onchange="LP.updAlv('tipoAlvenaria', this.value)">
            <option value="vedacao" ${pecaForm.tipoAlvenaria === 'vedacao' ? 'selected' : ''}>Vedação</option>
            <option value="estrutural" ${pecaForm.tipoAlvenaria === 'estrutural' ? 'selected' : ''}>Estrutural</option>
          </select></div>
      </div>
      <div class="form-check mb-2">
        <input type="checkbox" id="lp-alv-podeml" ${pecaForm.podeSerML ? 'checked' : ''} onchange="LP.onClickPodeML(this.checked)">
        <label for="lp-alv-podeml">Pode ser ML? (parede estreita)</label>
      </div>
      <div class="form-check mb-2">
        <input type="checkbox" id="lp-alv-possuivao" ${pecaForm.possuiVao ? 'checked' : ''} onchange="LP.toggleVaoAlv(this.checked)">
        <label for="lp-alv-possuivao">Possui vão (porta ou janela)?</label>
      </div>
      <div id="lp-alv-vaos-wrap">${pecaForm.possuiVao ? _renderVaos('alv') : ''}</div>
      <div id="lp-alv-resumo">${_htmlResumoAlv()}</div>
    `;
  }

  function _htmlResumoAlv() {
    const cfg = _getCfg();
    const compM = num(pecaForm.comprimento) / 100;
    const altM = num(pecaForm.altura) / 100;
    const areaBruta = compM * altM;
    const areaVaos = (pecaForm.vaos || []).reduce((s, v) => s + _descontoVao(num(v.comprimento) / 100, num(v.altura) / 100, num(v.qtd) || 1, cfg), 0);
    const areaLiquida = Math.max(0, areaBruta - areaVaos);
    let html = `
      <div style="background:var(--cor-fundo);border-radius:8px;padding:10px 14px;margin:14px 0;font-size:0.85rem;display:flex;flex-direction:column;gap:4px;">
        <span>Área bruta: <strong>${fmt2(areaBruta)} m²</strong> − vãos <strong>${fmt2(areaVaos)} m²</strong> = <strong style="color:var(--cor-primaria-dark);">${fmt2(areaLiquida)} m²</strong></span>`;
    if (pecaForm.podeSerML) {
      const mlPct = (num(cfg.ml_percentual) || 50) / 100;
      const ml = Math.max(compM, altM);
      html += `<span style="color:#b45309;">📏 Marcada como ML: <strong>${fmt2(ml)} ML</strong> (≈${fmt2(ml * mlPct)} m² equiv.)</span>`;
    }
    html += `</div>`;
    return html;
  }
  function _atualizarResumoAlv() {
    const el = document.getElementById('lp-alv-resumo');
    if (el) el.innerHTML = _htmlResumoAlv();
  }

  function updAlv(campo, valor) {
    pecaForm[campo] = valor;
    if (campo === 'comprimento' || campo === 'altura') {
      _sugerirML('lp-alv-podeml');
      _atualizarResumoAlv();
    }
  }

  function toggleVaoAlv(checked) {
    pecaForm.possuiVao = checked;
    if (checked && !pecaForm.vaos.length) pecaForm.vaos.push({ tipo: 'porta', comprimento: '', altura: '', qtd: 1 });
    const wrap = document.getElementById('lp-alv-vaos-wrap');
    if (wrap) wrap.innerHTML = pecaForm.possuiVao ? _renderVaos('alv') : '';
    _atualizarResumoAlv();
  }

  async function salvarAlvenaria(continuar) {
    if (!num(pecaForm.comprimento) || !num(pecaForm.altura)) {
      Utils.toast('Informe comprimento e altura da parede.', 'alerta'); return;
    }
    const data = {
      nodeId: selNodeId,
      nome: pecaForm.nome || 'Parede',
      comprimento: num(pecaForm.comprimento),
      altura: num(pecaForm.altura),
      tipoAlvenaria: pecaForm.tipoAlvenaria,
      podeSerML: !!pecaForm.podeSerML,
      vaos: pecaForm.possuiVao ? (pecaForm.vaos || []).filter(v => num(v.comprimento) && num(v.altura)).map(v => ({ tipo: v.tipo, comprimento: num(v.comprimento), altura: num(v.altura), qtd: num(v.qtd) || 1 })) : [],
    };
    Utils.mostrarLoading();
    try {
      if (pecaEditId) await Database.atualizar(obraId, COL_ALV, pecaEditId, data);
      else await Database.criar(obraId, COL_ALV, data);
      pecaEditId = null;
      if (continuar) {
        Utils.toast('✓ Parede salva! Pronta para a próxima.', 'sucesso');
        await carregar();
        novaAlvenaria();
      } else {
        Utils.fecharModal('modal-lp-alv');
        Utils.toast('✓ Parede salva!', 'sucesso');
        await carregar();
      }
    } catch (e) {
      Utils.toast('Erro ao salvar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ══════════════════════════════════════════
  // MÓDULO ACABAMENTO — formulário
  // ══════════════════════════════════════════
  function novaAcabamento() {
    if (!selNodeId) { Utils.toast('Selecione um local na árvore.', 'alerta'); return; }
    pecaEditId = null;
    pecaForm = {
      nome: `Face ${pecasAcabamento.filter(p => p.nodeId === selNodeId).length + 1}`,
      comprimento: '', altura: '',
      podeSerML: false, _mlManualTouch: false,
      possuiVao: false,
      vaos: [],
      acabamentos: [{ tipo: 'gesso', pct: 100 }],
      temPintura: false,
      pintura: [{ cor: '', hex: '#ffffff', pct: 100 }],
    };
    document.getElementById('lp-acab-titulo').textContent = 'Nova Face (Acabamento)';
    _renderFormAcabamento();
    Utils.abrirModal('modal-lp-acab');
    setTimeout(() => document.getElementById('lp-acab-comp')?.focus(), 60);
  }

  function editarAcabamento(id) {
    const p = pecasAcabamento.find(x => x.id === id); if (!p) return;
    pecaEditId = id;
    pecaForm = JSON.parse(JSON.stringify(p));
    pecaForm.podeSerML = !!p.podeSerML;
    pecaForm._mlManualTouch = true;
    pecaForm.possuiVao = !!(pecaForm.vaos && pecaForm.vaos.length);
    if (!pecaForm.acabamentos || !pecaForm.acabamentos.length) pecaForm.acabamentos = [{ tipo: 'gesso', pct: 100 }];
    if (!pecaForm.pintura || !pecaForm.pintura.length) pecaForm.pintura = [{ cor: '', hex: '#ffffff', pct: 100 }];
    document.getElementById('lp-acab-titulo').textContent = 'Editar Face (Acabamento)';
    _renderFormAcabamento();
    Utils.abrirModal('modal-lp-acab');
  }

  function _somaP(arr) { return (arr || []).reduce((s, x) => s + num(x.pct), 0); }

  function _renderFormAcabamento() {
    const body = document.getElementById('lp-acab-body'); if (!body) return;
    const somaAcab = _somaP(pecaForm.acabamentos);
    const somaPint = _somaP(pecaForm.pintura);
    body.innerHTML = `
      <div style="background:var(--cor-fundo);border-radius:8px;padding:8px 14px;margin-bottom:14px;font-size:0.82rem;color:var(--cor-texto-secundario);">
        Local: <strong style="color:var(--cor-primaria-dark);">${esc(_breadcrumb(selNodeId))}</strong>
      </div>
      <div class="form-grupo"><label>Identificação da face</label>
        <input type="text" id="lp-acab-nome" class="form-control" value="${esc(pecaForm.nome)}" placeholder="Ex: Parede D (lado Elevador)..." oninput="LP.updAcabCampo('nome', this.value)"></div>
      <div class="form-row">
        <div class="form-grupo"><label>Comprimento (cm)</label>
          <input type="text" inputmode="decimal" id="lp-acab-comp" class="form-control" placeholder="Ex: 350 ou 150+200" value="${esc(pecaForm.comprimento)}" oninput="LP.updAcabCampo('comprimento', this.value)" onkeydown="LP.calcExprEnter(event)"></div>
        <div class="form-grupo"><label>Altura (cm)</label>
          <input type="text" inputmode="decimal" id="lp-acab-alt" class="form-control" placeholder="Ex: 280" value="${esc(pecaForm.altura)}" oninput="LP.updAcabCampo('altura', this.value)" onkeydown="LP.calcExprEnter(event)"></div>
      </div>
      <div class="form-check mb-2">
        <input type="checkbox" id="lp-acab-podeml" ${pecaForm.podeSerML ? 'checked' : ''} onchange="LP.onClickPodeML(this.checked)">
        <label for="lp-acab-podeml">Pode ser ML? (face estreita)</label>
      </div>
      <div class="form-check mb-2">
        <input type="checkbox" id="lp-acab-possuivao" ${pecaForm.possuiVao ? 'checked' : ''} onchange="LP.toggleVaoAcab(this.checked)">
        <label for="lp-acab-possuivao">Possui vão (porta ou janela)?</label>
      </div>
      <div id="lp-acab-vaos-wrap">${pecaForm.possuiVao ? _renderVaos('acab') : ''}</div>
      <div id="lp-acab-resumo">${_htmlResumoAcab()}</div>

      <div style="border:1.5px solid var(--cor-borda-light);border-radius:10px;padding:12px;margin-top:14px;">
        <div style="font-size:0.78rem;color:var(--cor-texto-secundario);margin-bottom:6px;">Acabamento desta face (pode misturar tipos por %)</div>
        <div id="lp-acab-acabamentos">${_renderAcabamentos()}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin:10px 0;">
          <button class="btn btn-secundario btn-sm" onclick="LP.addAcabItem()">+ acabamento</button>
          <span class="text-sm" id="lp-soma-acab" style="color:${Math.abs(somaAcab - 100) < 0.01 ? '#16a34a' : '#ef4444'};font-weight:700;">${fmt2(somaAcab)}%</span>
        </div>

        <div class="form-check" style="margin-bottom:8px;">
          <input type="checkbox" id="lp-acab-pintura" ${pecaForm.temPintura ? 'checked' : ''} onchange="LP.togglePinturaAcab(this.checked)">
          <label for="lp-acab-pintura">Tem pintura?</label>
        </div>
        <div id="lp-acab-pinturas">${pecaForm.temPintura ? _renderPinturas() : ''}</div>
        ${pecaForm.temPintura ? `<div style="display:flex;justify-content:space-between;align-items:center;">
          <button class="btn btn-secundario btn-sm" onclick="LP.addPinturaItem()">+ cor</button>
          <span class="text-sm" id="lp-soma-pint" style="color:${Math.abs(somaPint - 100) < 0.01 ? '#16a34a' : '#ef4444'};font-weight:700;">${fmt2(somaPint)}%</span>
        </div>` : ''}
      </div>
    `;
  }

  function _htmlResumoAcab() {
    const cfg = _getCfg();
    const compM = num(pecaForm.comprimento) / 100;
    const altM = num(pecaForm.altura) / 100;
    const areaBruta = compM * altM;
    const areaVaos = (pecaForm.vaos || []).reduce((s, v) => s + _descontoVao(num(v.comprimento) / 100, num(v.altura) / 100, num(v.qtd) || 1, cfg), 0);
    const areaLiquida = Math.max(0, areaBruta - areaVaos);
    let html = `
      <div style="background:var(--cor-fundo);border-radius:8px;padding:10px 14px;margin:14px 0;font-size:0.85rem;display:flex;flex-direction:column;gap:4px;">
        <span>Área bruta: <strong>${fmt2(areaBruta)} m²</strong> − vãos <strong>${fmt2(areaVaos)} m²</strong> = <strong style="color:var(--cor-primaria-dark);">${fmt2(areaLiquida)} m²</strong></span>`;
    if (pecaForm.podeSerML) {
      const mlPct = (num(cfg.ml_percentual) || 50) / 100;
      const ml = Math.max(compM, altM);
      html += `<span style="color:#b45309;">📏 Marcada como ML: <strong>${fmt2(ml)} ML</strong> (≈${fmt2(ml * mlPct)} m² equiv.)</span>`;
    }
    html += `</div>`;
    return html;
  }
  function _atualizarResumoAcab() {
    const el = document.getElementById('lp-acab-resumo');
    if (el) el.innerHTML = _htmlResumoAcab();
  }

  function updAcabCampo(campo, valor) {
    pecaForm[campo] = valor;
    if (campo === 'comprimento' || campo === 'altura') {
      _sugerirML('lp-acab-podeml');
      _atualizarResumoAcab();
    }
  }

  function toggleVaoAcab(checked) {
    pecaForm.possuiVao = checked;
    if (checked && !pecaForm.vaos.length) pecaForm.vaos.push({ tipo: 'porta', comprimento: '', altura: '', qtd: 1 });
    const wrap = document.getElementById('lp-acab-vaos-wrap');
    if (wrap) wrap.innerHTML = pecaForm.possuiVao ? _renderVaos('acab') : '';
    _atualizarResumoAcab();
  }

  // ── Vãos (compartilhado pelos dois formulários; prefixo 'alv' ou 'acab') ──
  function _renderVaos(prefixo) {
    return `
      <div style="border:1px solid var(--cor-borda-light);border-radius:8px;padding:10px;margin-bottom:8px;">
        ${(pecaForm.vaos || []).map((v, i) => `
          <div class="form-row" style="align-items:end;margin-bottom:6px;grid-template-columns:1fr 1fr 1fr 0.6fr auto;">
            <div class="form-grupo" style="margin:0;"><label class="text-sm">Tipo</label>
              <select class="form-control" onchange="LP.updVao('${prefixo}',${i},'tipo',this.value)">
                <option value="porta" ${v.tipo === 'porta' ? 'selected' : ''}>Porta</option>
                <option value="janela" ${v.tipo === 'janela' ? 'selected' : ''}>Janela</option>
              </select></div>
            <div class="form-grupo" style="margin:0;"><label class="text-sm">Comp. (cm)</label>
              <input type="text" inputmode="decimal" class="form-control" placeholder="Ex: 80" value="${esc(v.comprimento)}" oninput="LP.updVao('${prefixo}',${i},'comprimento',this.value)" onkeydown="LP.calcExprEnter(event)"></div>
            <div class="form-grupo" style="margin:0;"><label class="text-sm">Altura (cm)</label>
              <input type="text" inputmode="decimal" class="form-control" placeholder="Ex: 210" value="${esc(v.altura)}" oninput="LP.updVao('${prefixo}',${i},'altura',this.value)" onkeydown="LP.calcExprEnter(event)"></div>
            <div class="form-grupo" style="margin:0;"><label class="text-sm">Qtd</label>
              <input type="number" class="form-control" step="1" min="1" value="${esc(v.qtd || 1)}" oninput="LP.updVao('${prefixo}',${i},'qtd',this.value)"></div>
            <button class="btn btn-secundario btn-sm" onclick="LP.remVao('${prefixo}',${i})" title="Remover">✕</button>
          </div>
        `).join('')}
        <button class="btn btn-secundario btn-sm" onclick="LP.addVao('${prefixo}')">+ Adicionar vão</button>
      </div>`;
  }
  function addVao(prefixo) {
    pecaForm.vaos.push({ tipo: 'porta', comprimento: '', altura: '', qtd: 1 });
    const wrap = document.getElementById(`lp-${prefixo}-vaos-wrap`);
    if (wrap) wrap.innerHTML = _renderVaos(prefixo);
    prefixo === 'alv' ? _atualizarResumoAlv() : _atualizarResumoAcab();
  }
  function remVao(prefixo, i) {
    pecaForm.vaos.splice(i, 1);
    const wrap = document.getElementById(`lp-${prefixo}-vaos-wrap`);
    if (wrap) wrap.innerHTML = _renderVaos(prefixo);
    prefixo === 'alv' ? _atualizarResumoAlv() : _atualizarResumoAcab();
  }
  function updVao(prefixo, i, campo, valor) {
    pecaForm.vaos[i][campo] = valor;
    prefixo === 'alv' ? _atualizarResumoAlv() : _atualizarResumoAcab();
  }

  // ── Acabamentos (mistura de tipos por %) ──
  function _renderAcabamentos() {
    return pecaForm.acabamentos.map((a, i) => `
      <div style="display:flex;gap:6px;margin-bottom:6px;align-items:center;">
        <select class="form-control" style="flex:1.4;" onchange="LP.updAcabItem(${i},'tipo',this.value)">
          ${TIPOS_ACABAMENTO.map(t => `<option value="${t.id}" ${a.tipo === t.id ? 'selected' : ''}>${t.label}</option>`).join('')}
        </select>
        <input type="number" class="form-control" style="flex:0.7;" step="1" min="0" max="100" value="${esc(a.pct)}" oninput="LP.updAcabItem(${i},'pct',this.value)">
        <span style="font-size:0.78rem;color:var(--cor-texto-secundario);">%</span>
        ${pecaForm.acabamentos.length > 1 ? `<button class="btn btn-secundario btn-sm" onclick="LP.remAcabItem(${i})">✕</button>` : ''}
      </div>`).join('');
  }
  function _atualizarAcabamentos() {
    const el = document.getElementById('lp-acab-acabamentos');
    if (el) el.innerHTML = _renderAcabamentos();
  }
  function _atualizarSomaAcabGlobal() {
    const soma = _somaP(pecaForm.acabamentos);
    const el = document.getElementById('lp-soma-acab');
    if (el) { el.textContent = fmt2(soma) + '%'; el.style.color = Math.abs(soma - 100) < 0.01 ? '#16a34a' : '#ef4444'; }
  }
  function addAcabItem() { pecaForm.acabamentos.push({ tipo: 'gesso', pct: 0 }); _atualizarAcabamentos(); _atualizarSomaAcabGlobal(); }
  function remAcabItem(i) { pecaForm.acabamentos.splice(i, 1); _atualizarAcabamentos(); _atualizarSomaAcabGlobal(); }
  function updAcabItem(i, campo, valor) {
    pecaForm.acabamentos[i][campo] = valor;
    if (campo === 'tipo') _atualizarAcabamentos(); else _atualizarSomaAcabGlobal();
  }

  // ── Pintura (múltiplas cores por %) ──
  function _renderPinturas() {
    return pecaForm.pintura.map((pt, i) => `
      <div style="display:flex;gap:6px;margin-bottom:6px;align-items:center;">
        <input type="color" value="${esc(pt.hex || '#ffffff')}" style="width:34px;height:34px;border:1px solid var(--cor-borda-light);border-radius:6px;padding:0;flex-shrink:0;" onchange="LP.updPinturaItem(${i},'hex',this.value)">
        <input type="text" class="form-control" style="flex:1.4;" placeholder="Nome da cor" value="${esc(pt.cor)}" oninput="LP.updPinturaItem(${i},'cor',this.value)">
        <input type="number" class="form-control" style="flex:0.7;" step="1" min="0" max="100" value="${esc(pt.pct)}" oninput="LP.updPinturaItem(${i},'pct',this.value)">
        <span style="font-size:0.78rem;color:var(--cor-texto-secundario);">%</span>
        ${pecaForm.pintura.length > 1 ? `<button class="btn btn-secundario btn-sm" onclick="LP.remPinturaItem(${i})">✕</button>` : ''}
      </div>`).join('');
  }
  function togglePinturaAcab(checked) {
    pecaForm.temPintura = checked;
    if (checked && !pecaForm.pintura.length) pecaForm.pintura.push({ cor: '', hex: '#ffffff', pct: 100 });
    _renderFormAcabamento();
  }
  function addPinturaItem() { pecaForm.pintura.push({ cor: '', hex: '#ffffff', pct: 0 }); _renderFormAcabamento(); }
  function remPinturaItem(i) { pecaForm.pintura.splice(i, 1); _renderFormAcabamento(); }
  function updPinturaItem(i, campo, valor) {
    pecaForm.pintura[i][campo] = valor;
    if (campo === 'pct') {
      const soma = _somaP(pecaForm.pintura);
      const el = document.getElementById('lp-soma-pint');
      if (el) { el.textContent = fmt2(soma) + '%'; el.style.color = Math.abs(soma - 100) < 0.01 ? '#16a34a' : '#ef4444'; }
    }
  }

  async function salvarAcabamento(continuar) {
    if (!num(pecaForm.comprimento) || !num(pecaForm.altura)) {
      Utils.toast('Informe comprimento e altura da face.', 'alerta'); return;
    }
    const soma = _somaP(pecaForm.acabamentos);
    if (Math.abs(soma - 100) > 0.5) {
      Utils.toast(`A soma dos % de acabamento deve ser 100% (está em ${fmt2(soma)}%).`, 'alerta');
      return;
    }
    if (pecaForm.temPintura) {
      const somaP = _somaP(pecaForm.pintura);
      if (Math.abs(somaP - 100) > 0.5) {
        Utils.toast(`A soma dos % de pintura deve ser 100% (está em ${fmt2(somaP)}%).`, 'alerta');
        return;
      }
    }
    const data = {
      nodeId: selNodeId,
      nome: pecaForm.nome || 'Face',
      comprimento: num(pecaForm.comprimento),
      altura: num(pecaForm.altura),
      podeSerML: !!pecaForm.podeSerML,
      vaos: pecaForm.possuiVao ? (pecaForm.vaos || []).filter(v => num(v.comprimento) && num(v.altura)).map(v => ({ tipo: v.tipo, comprimento: num(v.comprimento), altura: num(v.altura), qtd: num(v.qtd) || 1 })) : [],
      acabamentos: pecaForm.acabamentos.map(a => ({ tipo: a.tipo, pct: num(a.pct) })),
      temPintura: !!pecaForm.temPintura,
      pintura: pecaForm.temPintura ? pecaForm.pintura.map(p => ({ cor: p.cor || '', hex: p.hex || '#ffffff', pct: num(p.pct) })) : [],
    };
    Utils.mostrarLoading();
    try {
      if (pecaEditId) await Database.atualizar(obraId, COL_ACAB, pecaEditId, data);
      else await Database.criar(obraId, COL_ACAB, data);
      pecaEditId = null;
      if (continuar) {
        Utils.toast('✓ Face salva! Pronta para a próxima.', 'sucesso');
        await carregar();
        novaAcabamento();
      } else {
        Utils.fecharModal('modal-lp-acab');
        Utils.toast('✓ Face salva!', 'sucesso');
        await carregar();
      }
    } catch (e) {
      Utils.toast('Erro ao salvar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ══════════════════════════════════════════
  // CONFIGURAÇÕES DE CÁLCULO (modal)
  // ══════════════════════════════════════════
  function abrirConfig() {
    const cfg = _getCfg();
    document.getElementById('lp-cfg-vao-modo').value = cfg.vao_modo || 'desconto_total';
    document.getElementById('lp-cfg-vao-limite').value = cfg.vao_limite_x || '';
    document.getElementById('lp-cfg-vao-valor-y').value = cfg.vao_valor_y || '';
    document.getElementById('lp-cfg-ml-menor').value = cfg.ml_menor_que || 0.50;
    document.getElementById('lp-cfg-ml-pct').value = cfg.ml_percentual || 50;
    _toggleCfgVao(cfg.vao_modo || 'desconto_total');
    Utils.abrirModal('modal-lp-config');
  }
  function _toggleCfgVao(modo) {
    const row = document.getElementById('lp-cfg-vao-limite-row');
    const hint = document.getElementById('lp-cfg-vao-hint');
    if (!row) return;
    const mostra = modo === 'parcial_considera' || modo === 'parcial_desconta';
    row.style.display = mostra ? 'block' : 'none';
    if (hint) {
      if (modo === 'parcial_considera') hint.textContent = 'Considera Y m² por vão';
      else if (modo === 'parcial_desconta') hint.textContent = 'Desconta Y m² por vão';
      else hint.textContent = '';
    }
  }
  function onChangeCfgVao(sel) { _toggleCfgVao(sel.value); }
  function salvarConfig() {
    const cfg = {
      vao_modo: document.getElementById('lp-cfg-vao-modo').value || 'desconto_total',
      vao_limite_x: num(document.getElementById('lp-cfg-vao-limite').value) || 1.5,
      vao_valor_y: num(document.getElementById('lp-cfg-vao-valor-y').value) || 1.0,
      ml_menor_que: num(document.getElementById('lp-cfg-ml-menor').value) || 0.50,
      ml_percentual: num(document.getElementById('lp-cfg-ml-pct').value) || 50,
    };
    _saveCfg(cfg);
    Utils.fecharModal('modal-lp-config');
    Utils.toast('✓ Configurações salvas! Recalculando...', 'sucesso');
    renderizar();
  }

  return {
    init, recarregar, renderizar, setAba,
    selGeral, selNode, toggleNode,
    novoNode, renomearNode, salvarNode, excluirNode, clonarNode,
    duplicarPeca, conferirPeca, abrirMoverPeca, confirmarMoverPeca, excluirPeca,
    calcExprEnter, onClickPodeML,
    novaAlvenaria, editarAlvenaria, salvarAlvenaria, updAlv, toggleVaoAlv,
    novaAcabamento, editarAcabamento, salvarAcabamento, updAcabCampo, toggleVaoAcab,
    addVao, remVao, updVao,
    addAcabItem, remAcabItem, updAcabItem,
    togglePinturaAcab, addPinturaItem, remPinturaItem, updPinturaItem,
    abrirConfig, onChangeCfgVao, salvarConfig,
  };
})();

const LP = LevantamentoParedes;

function onObraChanged() { LevantamentoParedes.recarregar(); }

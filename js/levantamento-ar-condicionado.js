// ============================================
// Levantamento de Ar Condicionado / Hidráulica — V1
// Áreas configuráveis (Área Comum, Torre etc.) > Subáreas
// Itens vinculados à biblioteca de Materiais (tipo Ar Condicionado / Hidráulica)
// ============================================
const LevantamentoAr = (() => {
  let obraId = null;
  let areas = [];          // [{id,nome,subareas:[{id,nome}]}]
  let itens = [];          // levantamentoAr docs
  let biblioteca = [];     // todos os materiais da obra
  let openAreas = new Set();
  let sel = { areaId: null, subareaId: null };
  let editandoItemId = null;
  let modoItem = 'buscar'; // 'buscar' | 'criar'
  let buscaTexto = '';
  let materialSelecionadoId = '';

  const COL_ITENS = 'levantamentoAr';
  const CONFIG_DOC = 'arCondicionadoAreas';
  const TIPOS_PERMITIDOS = ['Ar Condicionado', 'Hidráulica'];

  // ===================== INIT =====================
  async function init() {
    const ok = await Utils.initPagina({ requireObra: true });
    if (!ok) return;
    obraId = Router.getObraId();
    const main = document.getElementById('ar-content');
    if (!obraId) {
      if (main) main.innerHTML = `<div class="estado-vazio"><div class="icone">❄️</div><p>Selecione uma obra na barra lateral.</p></div>`;
      return;
    }
    document.addEventListener('keydown', e => { if (e.key === 'Escape') Utils.fecharTodosModais(); });
    await carregar();
  }

  async function carregar() {
    try {
      Utils.mostrarLoading('Carregando levantamento...');
      const [cfgSnap, itensLista, mats] = await Promise.all([
        db.collection('obras').doc(obraId).collection('config').doc(CONFIG_DOC).get(),
        Database.listar(obraId, COL_ITENS, null).catch(() => []),
        Database.listar(obraId, 'materiais', 'nome').catch(() => []),
      ]);
      if (cfgSnap.exists && Array.isArray(cfgSnap.data().areas) && cfgSnap.data().areas.length) {
        areas = cfgSnap.data().areas;
      } else {
        areas = _areasDefault();
        await _salvarAreas();
      }
      itens = itensLista;
      biblioteca = mats;
      if (!sel.areaId && areas.length) sel = { areaId: null, subareaId: null }; // começa na visão geral
      renderizar();
    } catch (e) {
      console.error('Erro ao carregar levantamento de ar:', e);
      Utils.toast('Erro ao carregar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  function _areasDefault() {
    return [
      { id: _uid(), nome: 'Área Comum', subareas: [] },
      { id: _uid(), nome: 'Torre (Apartamentos)', subareas: [] },
    ];
  }

  function _uid() { return 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  async function _salvarAreas() {
    await db.collection('obras').doc(obraId).collection('config').doc(CONFIG_DOC).set({ areas }, { merge: true });
  }

  // ===================== RENDER =====================
  function renderizar() {
    const c = document.getElementById('ar-content');
    if (!c) return;
    c.innerHTML = `
      <div class="page-header">
        <div>
          <h2>❄️ Levantamento — Ar Condicionado / Hidráulica</h2>
          <span class="subtitulo">${itens.length} item(ns) levantado(s) em ${areas.length} área(s)</span>
        </div>
      </div>
      <div class="ar-layout">
        <div class="ar-tree">
          <div class="ar-tree-header">
            <h3>Áreas da Obra</h3>
            <button class="btn btn-secundario btn-sm" onclick="LevantamentoAr.novaArea()">+ Área</button>
          </div>
          <div class="ar-tree-body">${_renderArvore()}</div>
        </div>
        <div class="ar-painel">${_renderPainel()}</div>
      </div>`;
  }

  function _renderArvore() {
    if (!areas.length) return `<div class="estado-vazio"><p class="text-sm">Nenhuma área cadastrada.</p></div>`;
    let h = '';
    h += `<div class="tree-item${!sel.areaId ? ' ativo' : ''}" onclick="LevantamentoAr.selGeral()">
      <span class="tree-toggle"></span><span class="tree-icon">📊</span>
      <span class="tree-label"><strong>Visão Geral</strong></span>
    </div>`;
    areas.forEach(a => {
      const aberto = openAreas.has(a.id);
      const ativoArea = sel.areaId === a.id && !sel.subareaId;
      const nItens = _itensDe(a.id, null).length;
      h += `<div class="tree-item${ativoArea ? ' ativo' : ''}" onclick="LevantamentoAr.toggleArea('${a.id}');LevantamentoAr.selArea('${a.id}')">
        <span class="tree-toggle">${a.subareas.length ? (aberto ? '▼' : '▶') : ''}</span>
        <span class="tree-icon">🏢</span>
        <span class="tree-label">${a.nome}</span>
        ${nItens ? `<span class="tree-badge">${nItens}</span>` : ''}
        <button class="tree-edit-btn" onclick="event.stopPropagation();LevantamentoAr.renomearArea('${a.id}')" title="Renomear">✎</button>
        <button class="tree-del-btn" onclick="event.stopPropagation();LevantamentoAr.excluirArea('${a.id}')" title="Excluir">✕</button>
      </div>`;
      if (aberto) {
        h += `<div class="tree-children">`;
        a.subareas.forEach(s => {
          const ativoSub = sel.areaId === a.id && sel.subareaId === s.id;
          const nSub = _itensDe(a.id, s.id).length;
          h += `<div class="tree-item${ativoSub ? ' ativo' : ''}" onclick="LevantamentoAr.selSubarea('${a.id}','${s.id}')">
            <span class="tree-toggle"></span><span class="tree-icon">📍</span>
            <span class="tree-label">${s.nome}</span>
            ${nSub ? `<span class="tree-badge">${nSub}</span>` : ''}
            <button class="tree-edit-btn" onclick="event.stopPropagation();LevantamentoAr.renomearSubarea('${a.id}','${s.id}')" title="Renomear">✎</button>
            <button class="tree-del-btn" onclick="event.stopPropagation();LevantamentoAr.excluirSubarea('${a.id}','${s.id}')" title="Excluir">✕</button>
          </div>`;
        });
        h += `<div class="ar-add-inline" onclick="event.stopPropagation();LevantamentoAr.novaSubarea('${a.id}')">+ adicionar subárea/local</div>`;
        h += `</div>`;
      }
    });
    return h;
  }

  function _itensDe(areaId, subareaId) {
    return itens.filter(it => it.areaId === areaId && (subareaId === undefined || (it.subareaId || null) === (subareaId || null)));
  }

  function _nomeArea(areaId) { return areas.find(a => a.id === areaId)?.nome || '(área removida)'; }
  function _nomeSubarea(areaId, subareaId) {
    if (!subareaId) return '';
    const a = areas.find(x => x.id === areaId);
    return a?.subareas.find(s => s.id === subareaId)?.nome || '';
  }

  function _renderPainel() {
    if (!sel.areaId) return _renderResumoGeral();

    const area = areas.find(a => a.id === sel.areaId);
    if (!area) { sel = { areaId: null, subareaId: null }; return _renderResumoGeral(); }
    const label = sel.subareaId ? `${area.nome} → ${_nomeSubarea(area.id, sel.subareaId)}` : area.nome;
    const lista = _itensDe(sel.areaId, sel.subareaId);

    return `
      <div class="page-header">
        <div><h2 style="font-size:1.1rem;">${label}</h2>
          <span class="subtitulo">${lista.length} item(ns)</span></div>
        <button class="btn btn-primario btn-sm" onclick="LevantamentoAr.novoItem()">+ Adicionar Item</button>
      </div>
      ${!lista.length ? `<div class="estado-vazio"><div class="icone">🧯</div><p>Nenhum item levantado nesta ${sel.subareaId ? 'subárea' : 'área'} ainda.</p>
        <button class="btn btn-primario" onclick="LevantamentoAr.novoItem()">+ Adicionar Item</button></div>` : `
      <div class="tabela-container"><table class="tabela tabela-compacta">
        <thead><tr><th>Material</th><th>Tipo</th><th>Fabricante</th>
          <th class="col-num">Quantidade</th><th>Observações</th><th class="col-acoes">Ações</th></tr></thead>
        <tbody>${lista.map(it => {
          const m = biblioteca.find(x => x.id === it.materialId);
          return `<tr>
            <td><strong>${m ? m.nome : '(material removido)'}</strong></td>
            <td>${m?.tipo || '—'}</td>
            <td>${m?.fabricante || '—'}</td>
            <td class="col-num" style="font-family:var(--font-mono);font-weight:700;">${Utils.formatarNumero(it.quantidade)} ${it.unidade || ''}</td>
            <td class="text-sm text-muted">${it.observacoes || '—'}</td>
            <td class="col-acoes">
              <button class="btn btn-secundario btn-sm" onclick="LevantamentoAr.editarItem('${it.id}')">✎</button>
              <button class="btn btn-perigo btn-sm btn-icon" onclick="LevantamentoAr.excluirItem('${it.id}')">✕</button>
            </td></tr>`;
        }).join('')}</tbody></table></div>`}`;
  }

  function _renderResumoGeral() {
    if (!itens.length) {
      return `<div class="estado-vazio"><div class="icone">❄️</div>
        <p>Nenhum item levantado ainda. Selecione uma área ao lado para começar.</p></div>`;
    }
    // Agrupa por material, somando quantidade em todas as áreas
    const porMaterial = {};
    itens.forEach(it => {
      if (!porMaterial[it.materialId]) porMaterial[it.materialId] = { qtd: 0, unidade: it.unidade, ocorrencias: 0 };
      porMaterial[it.materialId].qtd += parseFloat(it.quantidade) || 0;
      porMaterial[it.materialId].ocorrencias++;
    });
    const linhas = Object.entries(porMaterial).map(([matId, info]) => {
      const m = biblioteca.find(x => x.id === matId);
      return { nome: m ? m.nome : '(removido)', tipo: m?.tipo || '—', fabricante: m?.fabricante || '—', ...info };
    }).sort((a, b) => a.nome.localeCompare(b.nome));

    return `
      <div class="page-header">
        <div><h2 style="font-size:1.1rem;">Resumo Geral — Todas as Áreas</h2>
          <span class="subtitulo">Consolidado por material</span></div>
      </div>
      <div class="tabela-container"><table class="tabela tabela-compacta">
        <thead><tr><th>Material</th><th>Tipo</th><th>Fabricante</th>
          <th class="col-num">Total</th><th class="col-num">Áreas c/ ocorrência</th></tr></thead>
        <tbody>${linhas.map(l => `<tr>
          <td><strong>${l.nome}</strong></td><td>${l.tipo}</td><td>${l.fabricante}</td>
          <td class="col-num" style="font-family:var(--font-mono);font-weight:700;color:var(--cor-primaria);">${Utils.formatarNumero(l.qtd)} ${l.unidade || ''}</td>
          <td class="col-num">${l.ocorrencias}</td>
        </tr>`).join('')}</tbody></table></div>
      <div class="text-sm text-muted" style="padding:4px 2px;">
        Este levantamento ainda não está vinculado a tarefas do Planejamento — o vínculo será feito numa próxima etapa,
        permitindo calcular o valor/consumo previsto por dia no cronograma.
      </div>`;
  }

  // ===================== SELEÇÃO / EXPANSÃO =====================
  function selGeral() { sel = { areaId: null, subareaId: null }; renderizar(); }
  function selArea(areaId) { sel = { areaId, subareaId: null }; renderizar(); }
  function selSubarea(areaId, subareaId) { sel = { areaId, subareaId }; renderizar(); }
  function toggleArea(areaId) {
    if (openAreas.has(areaId)) openAreas.delete(areaId); else openAreas.add(areaId);
  }

  // ===================== CRUD ÁREAS =====================
  async function novaArea() {
    const nome = prompt('Nome da nova área:');
    if (!nome || !nome.trim()) return;
    areas.push({ id: _uid(), nome: nome.trim(), subareas: [] });
    try { await _salvarAreas(); Utils.toast('Área criada.', 'sucesso'); renderizar(); }
    catch (e) { Utils.toast('Erro ao salvar área.', 'erro'); }
  }
  async function renomearArea(areaId) {
    const a = areas.find(x => x.id === areaId); if (!a) return;
    const nome = prompt('Renomear área:', a.nome);
    if (!nome || !nome.trim()) return;
    a.nome = nome.trim();
    try { await _salvarAreas(); renderizar(); } catch (e) { Utils.toast('Erro ao salvar.', 'erro'); }
  }
  async function excluirArea(areaId) {
    const n = _itensDe(areaId).length;
    if (!Utils.confirmar(n ? `Esta área tem ${n} item(ns) levantado(s). Excluir mesmo assim? Os itens não serão apagados, mas ficarão órfãos.` : 'Excluir esta área?')) return;
    areas = areas.filter(a => a.id !== areaId);
    if (sel.areaId === areaId) sel = { areaId: null, subareaId: null };
    try { await _salvarAreas(); Utils.toast('Área excluída.', 'sucesso'); renderizar(); }
    catch (e) { Utils.toast('Erro ao salvar.', 'erro'); }
  }

  // ===================== CRUD SUBÁREAS =====================
  async function novaSubarea(areaId) {
    const a = areas.find(x => x.id === areaId); if (!a) return;
    const nome = prompt('Nome da subárea/local (ex: Pavimento 1, Piscina):');
    if (!nome || !nome.trim()) return;
    a.subareas.push({ id: _uid(), nome: nome.trim() });
    openAreas.add(areaId);
    try { await _salvarAreas(); Utils.toast('Subárea criada.', 'sucesso'); renderizar(); }
    catch (e) { Utils.toast('Erro ao salvar.', 'erro'); }
  }
  async function renomearSubarea(areaId, subId) {
    const a = areas.find(x => x.id === areaId); if (!a) return;
    const s = a.subareas.find(x => x.id === subId); if (!s) return;
    const nome = prompt('Renomear subárea:', s.nome);
    if (!nome || !nome.trim()) return;
    s.nome = nome.trim();
    try { await _salvarAreas(); renderizar(); } catch (e) { Utils.toast('Erro ao salvar.', 'erro'); }
  }
  async function excluirSubarea(areaId, subId) {
    const n = _itensDe(areaId, subId).length;
    if (!Utils.confirmar(n ? `Esta subárea tem ${n} item(ns). Excluir mesmo assim?` : 'Excluir esta subárea?')) return;
    const a = areas.find(x => x.id === areaId); if (!a) return;
    a.subareas = a.subareas.filter(s => s.id !== subId);
    if (sel.subareaId === subId) sel.subareaId = null;
    try { await _salvarAreas(); Utils.toast('Subárea excluída.', 'sucesso'); renderizar(); }
    catch (e) { Utils.toast('Erro ao salvar.', 'erro'); }
  }

  // ===================== BUSCA FUZZY DE MATERIAL =====================
  function _normalizar(s) {
    return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }
  function _levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
    for (let j = 0; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        d[i][j] = a[i - 1] === b[j - 1] ? d[i - 1][j - 1] : 1 + Math.min(d[i - 1][j], d[i][j - 1], d[i - 1][j - 1]);
      }
    }
    return d[m][n];
  }
  function _scoreMaterial(nomeNorm, queryNorm) {
    if (!queryNorm) return 1;
    if (nomeNorm === queryNorm) return 100;
    if (nomeNorm.startsWith(queryNorm)) return 90;
    if (nomeNorm.includes(queryNorm)) return 80;
    const palavrasQ = queryNorm.split(/\s+/).filter(Boolean);
    const palavrasN = nomeNorm.split(/\s+/).filter(Boolean);
    const matchTodas = palavrasQ.every(pq => palavrasN.some(pn => pn.includes(pq)));
    if (matchTodas) return 70;
    // tolerância a erro de digitação: distância pequena em relação ao tamanho da palavra
    const dist = _levenshtein(nomeNorm, queryNorm);
    const tolerancia = Math.max(2, Math.floor(queryNorm.length * 0.35));
    if (dist <= tolerancia) return 60 - dist;
    // ao menos alguma palavra próxima
    const algumaProxima = palavrasQ.some(pq => palavrasN.some(pn => _levenshtein(pn, pq) <= Math.max(1, Math.floor(pq.length * 0.3))));
    if (algumaProxima) return 40;
    return -1;
  }
  function _materiaisPermitidos() {
    return biblioteca.filter(m => TIPOS_PERMITIDOS.includes(m.tipo));
  }
  function _buscarMateriais(texto) {
    const q = _normalizar(texto);
    return _materiaisPermitidos()
      .map(m => ({ m, score: _scoreMaterial(_normalizar(m.nome), q) }))
      .filter(x => x.score >= 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.m);
  }

  // ===================== MODAL ITEM =====================
  function novoItem() {
    if (!sel.areaId) { Utils.toast('Selecione uma área ou subárea primeiro.', 'alerta'); return; }
    editandoItemId = null; modoItem = 'buscar'; buscaTexto = ''; materialSelecionadoId = '';
    document.getElementById('modal-ar-titulo').textContent = 'Adicionar Item ao Levantamento';
    _renderItemModal(null);
    Utils.abrirModal('modal-ar-item');
  }
  function editarItem(id) {
    const it = itens.find(x => x.id === id); if (!it) return;
    editandoItemId = id; modoItem = 'buscar'; buscaTexto = ''; materialSelecionadoId = it.materialId;
    document.getElementById('modal-ar-titulo').textContent = 'Editar Item';
    _renderItemModal(it);
    Utils.abrirModal('modal-ar-item');
  }
  function setModoItem(m) { modoItem = m; _renderItemModal(editandoItemId ? itens.find(x => x.id === editandoItemId) : null); }
  function onBuscaMaterial(texto) {
    buscaTexto = texto;
    const lista = document.getElementById('ar-busca-resultados');
    if (lista) lista.innerHTML = _renderResultadosBusca();
  }
  function selecionarMaterialBusca(materialId) {
    materialSelecionadoId = materialId;
    _renderItemModal(editandoItemId ? itens.find(x => x.id === editandoItemId) : null);
  }

  function _renderResultadosBusca() {
    const resultados = _buscarMateriais(buscaTexto).slice(0, 30);
    if (!resultados.length) return `<div class="text-sm text-muted" style="padding:8px;">Nenhum material de Ar Condicionado/Hidráulica encontrado com esse nome.</div>`;
    return resultados.map(m => `
      <div class="tree-item${materialSelecionadoId === m.id ? ' ativo' : ''}" style="padding:8px 10px;" onclick="LevantamentoAr.selecionarMaterialBusca('${m.id}')">
        <span class="tree-icon">🧊</span>
        <span class="tree-label">${m.nome}${m.fabricante ? ' — <span style=\'color:#888\'>' + m.fabricante + '</span>' : ''}</span>
        <span class="tree-badge">${m.tipo}</span>
      </div>`).join('');
  }

  function _renderItemModal(it) {
    const body = document.getElementById('ar-item-body'); if (!body) return;
    const areaLabel = sel.subareaId ? `${_nomeArea(sel.areaId)} → ${_nomeSubarea(sel.areaId, sel.subareaId)}` : _nomeArea(sel.areaId);
    const matSel = biblioteca.find(m => m.id === materialSelecionadoId);

    body.innerHTML = `
      <div style="background:var(--cor-fundo);border-radius:8px;padding:8px 14px;margin-bottom:14px;font-size:0.82rem;color:var(--cor-texto-secundario);">
        Local: <strong style="color:var(--cor-primaria-dark);">${areaLabel}</strong>
      </div>
      <div style="display:flex;gap:6px;margin-bottom:16px;">
        <button class="btn btn-sm ${modoItem === 'buscar' ? 'btn-primario' : 'btn-secundario'}" onclick="LevantamentoAr.setModoItem('buscar')">🔎 Usar da biblioteca</button>
        <button class="btn btn-sm ${modoItem === 'criar' ? 'btn-primario' : 'btn-secundario'}" onclick="LevantamentoAr.setModoItem('criar')">+ Criar novo material</button>
      </div>

      ${modoItem === 'buscar' ? `
        <div class="form-grupo"><label>Buscar peça/material (Ar Condicionado / Hidráulica)</label>
          <input type="text" class="form-control" placeholder="Ex: dreno, tubo cobre, VRF..." value="${buscaTexto}"
            oninput="LevantamentoAr.onBuscaMaterial(this.value)"></div>
        <div id="ar-busca-resultados" style="max-height:220px;overflow-y:auto;border:1px solid var(--cor-borda-light);border-radius:8px;margin-bottom:14px;">
          ${_renderResultadosBusca()}
        </div>
        ${matSel ? `<div class="text-sm" style="margin-bottom:10px;">Selecionado: <strong>${matSel.nome}</strong> (${matSel.unidade || '?'})</div>` : ''}
      ` : `
        <div style="background:rgba(245,200,0,0.07);border:1.5px solid rgba(245,200,0,0.25);border-radius:8px;padding:14px;margin-bottom:14px;">
          <div style="font-size:0.8rem;font-weight:700;color:var(--cor-primaria);margin-bottom:10px;">Novo material → será salvo na biblioteca</div>
          <div class="form-grupo"><label>Nome *</label><input id="ar-nm-nome" class="form-control" placeholder="Ex: Tubo de cobre 3/8"></div>
          <div class="form-row">
            <div class="form-grupo"><label>Tipo</label>
              <select id="ar-nm-tipo" class="form-control">
                ${TIPOS_PERMITIDOS.map(t => `<option>${t}</option>`).join('')}
              </select></div>
            <div class="form-grupo"><label>Fabricante</label><input id="ar-nm-fab" class="form-control"></div>
          </div>
          <div class="form-row">
            <div class="form-grupo"><label>Referência</label><input id="ar-nm-ref" class="form-control"></div>
            <div class="form-grupo"><label>Unidade base</label>
              <select id="ar-nm-und" class="form-control">
                ${['un','m','kg','L','saco','caixa','rolo','par','conjunto'].map(u => `<option>${u}</option>`).join('')}
              </select></div>
          </div>
        </div>
      `}

      <div class="form-row">
        <div class="form-grupo"><label>Quantidade *</label>
          <input id="ar-qtd" type="number" step="0.001" min="0" class="form-control" value="${it?.quantidade || ''}" placeholder="0,000"></div>
        <div class="form-grupo"><label>Unidade</label>
          <input id="ar-unidade" class="form-control" value="${it?.unidade || matSel?.unidade || ''}" placeholder="un, m, kg..."></div>
      </div>
      <div class="form-grupo"><label>Observações</label>
        <textarea id="ar-obs" class="form-control" rows="2">${it?.observacoes || ''}</textarea></div>`;
  }

  async function salvarItem() {
    if (!sel.areaId) { Utils.toast('Selecione uma área.', 'alerta'); return; }
    const quantidade = parseFloat(document.getElementById('ar-qtd')?.value) || 0;
    if (!quantidade) { Utils.toast('Informe a quantidade.', 'alerta'); return; }
    const unidade = document.getElementById('ar-unidade')?.value?.trim() || '';
    const observacoes = document.getElementById('ar-obs')?.value?.trim() || '';
    let materialId = materialSelecionadoId;

    if (modoItem === 'criar') {
      const nome = document.getElementById('ar-nm-nome')?.value?.trim();
      if (!nome) { Utils.toast('Informe o nome do material.', 'alerta'); return; }
      try {
        materialId = await Database.criar(obraId, 'materiais', {
          nome,
          tipo: document.getElementById('ar-nm-tipo')?.value || TIPOS_PERMITIDOS[0],
          fabricante: document.getElementById('ar-nm-fab')?.value?.trim() || '',
          referencia: document.getElementById('ar-nm-ref')?.value?.trim() || '',
          unidade: document.getElementById('ar-nm-und')?.value || 'un',
        });
      } catch (e) { console.error(e); Utils.toast('Erro ao criar material.', 'erro'); return; }
    } else if (!materialId) {
      Utils.toast('Selecione um material na busca.', 'alerta'); return;
    }

    const data = {
      materialId,
      areaId: sel.areaId,
      subareaId: sel.subareaId || null,
      quantidade,
      unidade,
      observacoes,
    };
    try {
      if (editandoItemId) await Database.atualizar(obraId, COL_ITENS, editandoItemId, data);
      else await Database.criar(obraId, COL_ITENS, data);
      Utils.fecharModal('modal-ar-item');
      Utils.toast(`Item ${modoItem === 'criar' ? 'criado e ' : ''}salvo!`, 'sucesso');
      editandoItemId = null;
      await carregar();
    } catch (e) { console.error(e); Utils.toast('Erro ao salvar item.', 'erro'); }
  }

  async function excluirItem(id) {
    if (!Utils.confirmar('Remover este item do levantamento?')) return;
    try { await Database.deletar(obraId, COL_ITENS, id); Utils.toast('Removido.', 'sucesso'); await carregar(); }
    catch (e) { Utils.toast('Erro.', 'erro'); }
  }

  return {
    init, carregar, renderizar,
    selGeral, selArea, selSubarea, toggleArea,
    novaArea, renomearArea, excluirArea,
    novaSubarea, renomearSubarea, excluirSubarea,
    novoItem, editarItem, setModoItem, onBuscaMaterial, selecionarMaterialBusca,
    salvarItem, excluirItem,
  };
})();

function onObraChanged() { LevantamentoAr.init(); }

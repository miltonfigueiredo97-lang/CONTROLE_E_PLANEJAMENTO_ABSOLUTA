// ============================================
// Levantamento de Ar Condicionado / Hidráulica — V2
// Locais em árvore com profundidade ILIMITADA (local > sublocal > sub-sublocal...)
// Itens: avulsos (buscar/criar da biblioteca) OU Máquinas (calculadas automaticamente
// a partir da Configuração de Máquinas — ver levantamento-ar-config.html)
// ============================================
const LevantamentoAr = (() => {
  let obraId = null;
  let areas = [];            // árvore recursiva: [{id,nome,filhos:[...]}]
  let itens = [];            // levantamentoAr (itens avulsos)
  let maquinasLanc = [];     // levantamentoArMaquinas (máquinas lançadas)
  let maquinasCfg = { cobre: [], pex: [], duto: [] }; // configuração (somente leitura aqui)
  let biblioteca = [];
  let openNodes = new Set();
  let expandedMaquinas = new Set();
  let sel = { localId: null };
  let editandoItemId = null;
  let modoItem = 'buscar';
  let buscaTexto = '';
  let materialSelecionadoId = '';

  // draft do modal de lançamento de máquina
  let maqDraft = null;
  let editandoMaqId = null;
  let _buscaManualTexto = '';

  const COL_ITENS = 'levantamentoAr';
  const COL_MAQUINAS = 'levantamentoArMaquinas';
  const CONFIG_AREAS_DOC = 'arCondicionadoAreas';
  const CONFIG_MAQUINAS_DOC = 'arMaquinasConfig';
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
      const [cfgAreasSnap, cfgMaqSnap, itensLista, maqLista, mats] = await Promise.all([
        db.collection('obras').doc(obraId).collection('config').doc(CONFIG_AREAS_DOC).get(),
        db.collection('obras').doc(obraId).collection('config').doc(CONFIG_MAQUINAS_DOC).get(),
        Database.listar(obraId, COL_ITENS, null).catch(() => []),
        Database.listar(obraId, COL_MAQUINAS, null).catch(() => []),
        Database.listar(obraId, 'materiais', 'nome').catch(() => []),
      ]);

      if (cfgAreasSnap.exists && Array.isArray(cfgAreasSnap.data().areas) && cfgAreasSnap.data().areas.length) {
        areas = _migrarArvore(cfgAreasSnap.data().areas);
      } else {
        areas = _areasDefault();
        await _salvarAreas();
      }
      maquinasCfg = cfgMaqSnap.exists ? { cobre: [], pex: [], duto: [], ...cfgMaqSnap.data() } : { cobre: [], pex: [], duto: [] };
      itens = itensLista;
      maquinasLanc = maqLista;
      biblioteca = mats;
      renderizar();
    } catch (e) {
      console.error('Erro ao carregar levantamento de ar:', e);
      Utils.toast('Erro ao carregar: ' + e.message, 'erro');
    } finally { Utils.esconderLoading(); }
  }

  // Converte formato antigo (subareas, 2 níveis) para árvore recursiva (filhos, N níveis)
  function _migrarArvore(lista) {
    return (lista || []).map(n => ({
      id: n.id,
      nome: n.nome,
      filhos: _migrarArvore(n.filhos || n.subareas || []),
    }));
  }

  function _areasDefault() {
    return [
      { id: _uid(), nome: 'Área Comum', filhos: [] },
      { id: _uid(), nome: 'Torre (Apartamentos)', filhos: [] },
    ];
  }

  function _uid() { return 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  async function _salvarAreas() {
    await db.collection('obras').doc(obraId).collection('config').doc(CONFIG_AREAS_DOC).set({ areas }, { merge: true });
  }

  // ===================== HELPERS DE ÁRVORE =====================
  function _encontrarNo(id, lista = areas) {
    for (const n of lista) {
      if (n.id === id) return n;
      const achado = _encontrarNo(id, n.filhos || []);
      if (achado) return achado;
    }
    return null;
  }
  function _encontrarPaiLista(id, lista = areas) {
    for (const n of lista) {
      if ((n.filhos || []).some(f => f.id === id)) return n.filhos;
      const achado = _encontrarPaiLista(id, n.filhos || []);
      if (achado) return achado;
    }
    return null;
  }
  function _caminho(id, lista = areas, atual = []) {
    for (const n of lista) {
      const novoAtual = [...atual, n.nome];
      if (n.id === id) return novoAtual;
      const achado = _caminho(id, n.filhos || [], novoAtual);
      if (achado) return achado;
    }
    return null;
  }
  function _descendentesIds(id) {
    const no = _encontrarNo(id);
    if (!no) return [];
    const ids = [];
    (function walk(n) { ids.push(n.id); (n.filhos || []).forEach(walk); })(no);
    return ids;
  }

  // ===================== RENDER =====================
  function renderizar() {
    const c = document.getElementById('ar-content'); if (!c) return;
    c.innerHTML = `
      <div class="page-header">
        <div>
          <h2>❄️ Levantamento — Ar Condicionado / Hidráulica</h2>
          <span class="subtitulo">${itens.length} item(ns) avulso(s) · ${maquinasLanc.length} máquina(s) lançada(s)</span>
        </div>
        <button class="btn btn-secundario btn-sm" onclick="Router.navegar('levantamento-ar-config.html')">⚙️ Configurar Máquinas</button>
      </div>
      <div class="ar-layout">
        <div class="ar-tree">
          <div class="ar-tree-header">
            <h3>Locais da Obra</h3>
            <button class="btn btn-secundario btn-sm" onclick="LevantamentoAr.novaArea()">+ Local</button>
          </div>
          <div class="ar-tree-body">${_renderArvore()}</div>
        </div>
        <div class="ar-painel">${_renderPainel()}</div>
      </div>`;
  }

  function _renderArvore() {
    if (!areas.length) return `<div class="estado-vazio"><p class="text-sm">Nenhum local cadastrado.</p></div>`;
    let h = `<div class="tree-item${!sel.localId ? ' ativo' : ''}" onclick="LevantamentoAr.selGeral()">
      <span class="tree-toggle"></span><span class="tree-icon">📊</span>
      <span class="tree-label"><strong>Visão Geral</strong></span>
    </div>`;
    areas.forEach(n => { h += _renderNo(n, 0); });
    return h;
  }

  function _renderNo(n, depth) {
    const aberto = openNodes.has(n.id);
    const ativo = sel.localId === n.id;
    const nItens = _itensDiretos(n.id).length + _maquinasDiretas(n.id).length;
    const temFilhos = (n.filhos || []).length > 0;
    let h = `<div class="tree-item${ativo ? ' ativo' : ''}" style="padding-left:${8 + depth * 16}px;" onclick="LevantamentoAr.selNo('${n.id}')">
      <span class="tree-toggle" ${temFilhos ? `onclick="event.stopPropagation();LevantamentoAr.toggleNo('${n.id}')"` : ''}>${temFilhos ? (aberto ? '▼' : '▶') : ''}</span>
      <span class="tree-icon">${depth === 0 ? '🏢' : '📍'}</span>
      <span class="tree-label">${n.nome}</span>
      ${nItens ? `<span class="tree-badge">${nItens}</span>` : ''}
      <button class="tree-edit-btn" onclick="event.stopPropagation();LevantamentoAr.novoSublocal('${n.id}')" title="Adicionar sublocal aqui dentro" style="color:var(--cor-primaria-dark);font-weight:900;">+</button>
      <button class="tree-edit-btn" onclick="event.stopPropagation();LevantamentoAr.duplicarNo('${n.id}')" title="Duplicar (com sublocais)">⧉</button>
      <button class="tree-edit-btn" onclick="event.stopPropagation();LevantamentoAr.renomearNo('${n.id}')" title="Renomear">✎</button>
      <button class="tree-del-btn" onclick="event.stopPropagation();LevantamentoAr.excluirNo('${n.id}')" title="Excluir">✕</button>
    </div>`;
    if (aberto && temFilhos) {
      h += `<div class="tree-children">`;
      (n.filhos || []).forEach(f => { h += _renderNo(f, depth + 1); });
      h += `</div>`;
    }
    return h;
  }

  function _itensDiretos(localId) { return itens.filter(it => _localDoItem(it) === localId); }
  function _maquinasDiretas(localId) { return maquinasLanc.filter(m => m.localId === localId); }
  function _localDoItem(it) { return it.localId || it.subareaId || it.areaId || null; }

  function _renderPainel() {
    if (!sel.localId) return _renderResumoGeral();
    const no = _encontrarNo(sel.localId);
    if (!no) { sel = { localId: null }; return _renderResumoGeral(); }
    const caminho = (_caminho(sel.localId) || [no.nome]).join(' → ');
    const listaItens = _itensDiretos(sel.localId);
    const listaMaquinas = _maquinasDiretas(sel.localId);
    const temDescendentes = (no.filhos || []).length > 0;

    return `
      <div class="page-header">
        <div><h2 style="font-size:1.1rem;">${caminho}</h2>
          <span class="subtitulo">${listaItens.length} item(ns) avulso(s) · ${listaMaquinas.length} máquina(s)</span></div>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-secundario btn-sm" onclick="LevantamentoAr.novoItem()">+ Item avulso</button>
          <button class="btn btn-primario btn-sm" onclick="LevantamentoAr.novaMaquinaLancamento()">+ Máquina</button>
        </div>
      </div>

      ${_renderTabelaMaquinas(listaMaquinas)}
      ${_renderTabelaItens(listaItens)}

      ${temDescendentes ? `
        <div style="margin-top:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <h3 style="font-size:0.9rem;margin:0;">Resumo consolidado (${no.nome} + sublocais)</h3>
            <button class="btn btn-secundario btn-sm" onclick="LevantamentoAr.exportarResumo('local')">📤 Exportar CSV</button>
          </div>
          ${_renderTabelaResumo(_agregarSubarvore(sel.localId))}
        </div>` : ''}
    `;
  }

  function _renderTabelaItens(lista) {
    if (!lista.length) return '';
    return `
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
        }).join('')}</tbody></table></div>`;
  }

  function _renderTabelaMaquinas(lista) {
    if (!lista.length) return '';
    return `
      <div class="tabela-container" style="margin-bottom:16px;"><table class="tabela tabela-compacta">
        <thead><tr><th>Máquina</th><th>Modelo</th><th class="col-num">ML lançado</th>
          <th class="col-num">ML total (c/ perda)</th><th class="col-acoes">Ações</th></tr></thead>
        <tbody>${lista.map(doc => {
          const cfg = _obterMaquinaConfig(doc.modeloTipo, doc.maquinaConfigId);
          const kit = cfg ? Utils.calcularKitAr(cfg, doc.mlBase) : null;
          const aberto = expandedMaquinas.has(doc.id);
          let linhas = `<tr onclick="LevantamentoAr.toggleExpandirMaquina('${doc.id}')" style="cursor:pointer;">
            <td><strong>${cfg?.nome || '(config removida)'}</strong> <span class="text-muted">${aberto ? '▲' : '▼'}</span></td>
            <td>${doc.modeloTipo?.toUpperCase() || '—'}</td>
            <td class="col-num" style="font-family:var(--font-mono);">${Utils.formatarNumero(doc.mlBase)} m</td>
            <td class="col-num" style="font-family:var(--font-mono);font-weight:700;">${kit ? Utils.formatarNumero(kit.mlTotal) : '—'} m</td>
            <td class="col-acoes">
              <button class="btn btn-secundario btn-sm" onclick="event.stopPropagation();LevantamentoAr.editarMaquinaLancamento('${doc.id}')">✎</button>
              <button class="btn btn-perigo btn-sm btn-icon" onclick="event.stopPropagation();LevantamentoAr.excluirMaquinaLancamento('${doc.id}')">✕</button>
            </td></tr>`;
          if (aberto && kit) {
            linhas += `<tr><td colspan="5" style="background:var(--cor-fundo);padding:10px 16px;">
              ${_expandirMaquina(doc, cfg, kit).map(l => `<div class="text-sm" style="padding:2px 0;">• ${l.nome}: <strong>${Utils.formatarNumero(l.quantidade)} ${l.unidade}</strong>${l.mPorUnidade ? ` (${Utils.formatarNumero(Math.ceil(l.quantidade / l.mPorUnidade), 0)} un de ${l.mPorUnidade}${l.unidade})` : ''}</div>`).join('')}
            </td></tr>`;
          }
          return linhas;
        }).join('')}</tbody></table></div>`;
  }

  function _renderTabelaResumo(mapaTotais) {
    const linhas = Object.values(mapaTotais).sort((a, b) => a.nome.localeCompare(b.nome));
    if (!linhas.length) return `<div class="text-sm text-muted">Nada levantado ainda.</div>`;
    return `
      <div class="tabela-container"><table class="tabela tabela-compacta">
        <thead><tr><th>Material</th><th class="col-num">Total</th><th class="col-num">Comprar</th></tr></thead>
        <tbody>${linhas.map(l => `<tr>
          <td>${l.nome}</td>
          <td class="col-num" style="font-family:var(--font-mono);font-weight:700;color:var(--cor-primaria);">${Utils.formatarNumero(l.quantidade)} ${l.unidade}</td>
          <td class="col-num" style="font-family:var(--font-mono);">${l.mPorUnidade ? Utils.formatarNumero(Math.ceil(l.quantidade / l.mPorUnidade), 0) + ` un (${l.mPorUnidade}${l.unidade}/un)` : '—'}</td>
        </tr>`).join('')}</tbody></table></div>`;
  }

  function _renderResumoGeral() {
    const totalAvulsos = itens.length, totalMaq = maquinasLanc.length;
    if (!totalAvulsos && !totalMaq) {
      return `<div class="estado-vazio"><div class="icone">❄️</div>
        <p>Nenhum item levantado ainda. Selecione um local ao lado para começar.</p></div>`;
    }
    const mapa = _agregarTudo();
    const porLocal = [];
    (function walk(lista, prefixo) {
      lista.forEach(n => {
        const caminho = prefixo ? `${prefixo} → ${n.nome}` : n.nome;
        const nAvulso = _itensDiretos(n.id).length, nMaq = _maquinasDiretas(n.id).length;
        if (nAvulso || nMaq) porLocal.push({ id: n.id, caminho, nAvulso, nMaq });
        walk(n.filhos || [], caminho);
      });
    })(areas, '');

    return `
      <div class="page-header">
        <div><h2 style="font-size:1.1rem;">Resumo Geral — Todos os Locais</h2>
          <span class="subtitulo">Consolidado por material (itens avulsos + máquinas calculadas)</span></div>
        <button class="btn btn-primario btn-sm" onclick="LevantamentoAr.exportarResumo('geral')">📤 Exportar para Compras (CSV)</button>
      </div>
      ${_renderTabelaResumo(mapa)}
      ${porLocal.length ? `
        <div style="margin-top:20px;">
          <h3 style="font-size:0.9rem;margin-bottom:8px;">Por Local</h3>
          <div class="tabela-container"><table class="tabela tabela-compacta">
            <thead><tr><th>Local</th><th class="col-num">Itens avulsos</th><th class="col-num">Máquinas</th><th></th></tr></thead>
            <tbody>${porLocal.map(l => `<tr>
              <td>${l.caminho}</td><td class="col-num">${l.nAvulso}</td><td class="col-num">${l.nMaq}</td>
              <td class="col-acoes"><button class="btn btn-secundario btn-sm" onclick="LevantamentoAr.selNo('${l.id}')">Ver</button></td>
            </tr>`).join('')}</tbody></table></div>
        </div>` : ''}
      <div class="text-sm text-muted" style="padding:10px 2px;">
        Este levantamento ainda não está vinculado a tarefas do Planejamento — o vínculo será feito numa próxima etapa,
        permitindo calcular o valor/consumo previsto por dia no cronograma.
      </div>`;
  }

  // ===================== AGREGAÇÃO (itens + máquinas -> totais por material) =====================
  function _obterMaquinaConfig(modeloTipo, maquinaConfigId) {
    return (maquinasCfg[modeloTipo] || []).find(m => m.id === maquinaConfigId) || null;
  }
  function _expandirMaquina(doc, cfg, kit) {
    if (!cfg || !kit) return [];
    const linhas = [];
    if (kit.cobre) linhas.push({
      materialId: kit.cobre.materialId, nome: kit.cobre.nomeExibicao || kit.cobre.nome,
      quantidade: kit.cobre.metros, unidade: 'm', chaveExtra: kit.diametroLabel || '', forcarNome: true,
    });
    kit.vinculados.forEach(v => linhas.push({ materialId: v.materialId, nome: v.nome, quantidade: v.metros, unidade: 'm' }));
    kit.porMl.forEach(p => linhas.push({
      materialId: p.materialId, nome: p.nome, quantidade: p.quantidade,
      unidade: p.tipo === 'uni_por_ml' ? 'un' : 'm', mPorUnidade: p.mPorUnidade || null,
    }));
    (doc.manuaisAvulsos || []).forEach(m => {
      if (m.quantidade) linhas.push({ materialId: m.materialId, nome: m.nome, quantidade: m.quantidade, unidade: m.unidade || 'un' });
    });
    return linhas;
  }
  // chaveExtra separa o mesmo material em linhas diferentes no resumo (ex: diâmetros distintos de cobre).
  // forcarNome usa o nome informado (com diâmetro) em vez do nome cru da biblioteca.
  function _acumular(mapa, materialId, nomeFallback, quantidade, unidade, mPorUnidade, chaveExtra, forcarNome) {
    if (!quantidade) return;
    let nome = nomeFallback;
    if (!forcarNome) {
      const m = biblioteca.find(x => x.id === materialId);
      nome = m ? m.nome : (nomeFallback || '(material removido)');
    }
    const chave = (materialId || nome) + (chaveExtra ? '|' + chaveExtra : '');
    if (!mapa[chave]) mapa[chave] = { nome, quantidade: 0, unidade, mPorUnidade: mPorUnidade || null };
    mapa[chave].quantidade += parseFloat(quantidade) || 0;
    if (mPorUnidade && !mapa[chave].mPorUnidade) mapa[chave].mPorUnidade = mPorUnidade;
  }
  function _agregarLista(listaItens, listaMaquinas) {
    const mapa = {};
    listaItens.forEach(it => _acumular(mapa, it.materialId, null, it.quantidade, it.unidade));
    listaMaquinas.forEach(doc => {
      const cfg = _obterMaquinaConfig(doc.modeloTipo, doc.maquinaConfigId);
      const kit = cfg ? Utils.calcularKitAr(cfg, doc.mlBase) : null;
      _expandirMaquina(doc, cfg, kit).forEach(l => _acumular(mapa, l.materialId, l.nome, l.quantidade, l.unidade, l.mPorUnidade, l.chaveExtra, l.forcarNome));
    });
    return mapa;
  }
  function _agregarSubarvore(localId) {
    const ids = new Set(_descendentesIds(localId));
    return _agregarLista(itens.filter(it => ids.has(_localDoItem(it))), maquinasLanc.filter(m => ids.has(m.localId)));
  }
  function _agregarTudo() { return _agregarLista(itens, maquinasLanc); }

  // ===================== EXPORTAR PARA COMPRAS (CSV) =====================
  function exportarResumo(escopo) {
    let mapa, nomeArquivo, tituloLocal;
    if (escopo === 'local' && sel.localId) {
      const no = _encontrarNo(sel.localId);
      mapa = _agregarSubarvore(sel.localId);
      tituloLocal = no ? no.nome : 'Local';
      nomeArquivo = 'levantamento-ar-' + tituloLocal.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    } else {
      mapa = _agregarTudo();
      tituloLocal = 'Resumo Geral';
      nomeArquivo = 'levantamento-ar-resumo-geral';
    }
    const linhas = Object.values(mapa).sort((a, b) => a.nome.localeCompare(b.nome));
    if (!linhas.length) { Utils.toast('Nada para exportar ainda.', 'alerta'); return; }

    let csv = `Levantamento de Ar Condicionado / Hidraulica - ${tituloLocal}\r\n`;
    csv += `Material;Total;Unidade;Comprar (unidades)\r\n`;
    linhas.forEach(l => {
      const comprar = l.mPorUnidade ? `${Math.ceil(l.quantidade / l.mPorUnidade)} un de ${l.mPorUnidade}${l.unidade}` : '';
      csv += `"${l.nome}";${Utils.formatarNumero(l.quantidade)};${l.unidade};"${comprar}"\r\n`;
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${nomeArquivo}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    Utils.toast('CSV exportado — pronto pra mandar pra equipe de compras.', 'sucesso');
  }

  // ===================== SELEÇÃO / EXPANSÃO =====================
  function selGeral() { sel = { localId: null }; renderizar(); }
  function selNo(id) { sel = { localId: id }; renderizar(); }
  function toggleNo(id) { if (openNodes.has(id)) openNodes.delete(id); else openNodes.add(id); renderizar(); }
  function toggleExpandirMaquina(id) { if (expandedMaquinas.has(id)) expandedMaquinas.delete(id); else expandedMaquinas.add(id); renderizar(); }

  // ===================== CRUD DA ÁRVORE (profundidade ilimitada) =====================
  async function novaArea() {
    const nome = prompt('Nome do novo local (nível raiz):');
    if (!nome || !nome.trim()) return;
    areas.push({ id: _uid(), nome: nome.trim(), filhos: [] });
    try { await _salvarAreas(); Utils.toast('Local criado.', 'sucesso'); renderizar(); }
    catch (e) { Utils.toast('Erro ao salvar.', 'erro'); }
  }
  async function novoSublocal(paiId) {
    const pai = _encontrarNo(paiId); if (!pai) return;
    const nome = prompt(`Nome do sublocal dentro de "${pai.nome}":`);
    if (!nome || !nome.trim()) return;
    pai.filhos = pai.filhos || [];
    pai.filhos.push({ id: _uid(), nome: nome.trim(), filhos: [] });
    openNodes.add(paiId);
    try { await _salvarAreas(); Utils.toast('Sublocal criado.', 'sucesso'); renderizar(); }
    catch (e) { Utils.toast('Erro ao salvar.', 'erro'); }
  }
  async function renomearNo(id) {
    const n = _encontrarNo(id); if (!n) return;
    const nome = prompt('Renomear local:', n.nome);
    if (!nome || !nome.trim()) return;
    n.nome = nome.trim();
    try { await _salvarAreas(); renderizar(); } catch (e) { Utils.toast('Erro ao salvar.', 'erro'); }
  }
  async function excluirNo(id) {
    const idsAfetados = new Set(_descendentesIds(id));
    const nItens = itens.filter(it => idsAfetados.has(_localDoItem(it))).length;
    const nMaq = maquinasLanc.filter(m => idsAfetados.has(m.localId)).length;
    const aviso = (nItens || nMaq)
      ? `Este local (e seus sublocais) tem ${nItens} item(ns) avulso(s) e ${nMaq} máquina(s) lançada(s). Excluir mesmo assim? Os lançamentos não serão apagados, mas ficarão órfãos.`
      : 'Excluir este local e todos os seus sublocais?';
    if (!Utils.confirmar(aviso)) return;

    const listaPai = _encontrarPaiLista(id) || areas;
    const idx = listaPai.findIndex(n => n.id === id);
    if (idx >= 0) listaPai.splice(idx, 1);
    if (sel.localId && idsAfetados.has(sel.localId)) sel = { localId: null };
    try { await _salvarAreas(); Utils.toast('Local excluído.', 'sucesso'); renderizar(); }
    catch (e) { Utils.toast('Erro ao salvar.', 'erro'); }
  }

  // Clona um nó (e todos os sublocais dentro dele) com IDs novos, sem copiar itens/máquinas lançadas.
  // Útil para duplicar "Apto 1" -> "Apto 1 (cópia)" e depois só renomear para "Apto 2".
  function _clonarNo(n) {
    return { id: _uid(), nome: n.nome, filhos: (n.filhos || []).map(_clonarNo) };
  }
  async function duplicarNo(id) {
    const listaPai = _encontrarPaiLista(id) || areas;
    const idx = listaPai.findIndex(n => n.id === id);
    if (idx < 0) return;
    const original = listaPai[idx];
    const copia = _clonarNo(original);
    copia.nome = original.nome + ' (cópia)';
    listaPai.splice(idx + 1, 0, copia);
    try {
      await _salvarAreas();
      Utils.toast('Local duplicado. Renomeie para o novo local (ex: Apto 2).', 'sucesso');
      renderizar();
      renomearNo(copia.id);
    } catch (e) { Utils.toast('Erro ao salvar.', 'erro'); }
  }

  // ===================== BUSCA FUZZY DE MATERIAL =====================
  function _normalizar(s) { return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
  function _levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
    for (let j = 0; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
      d[i][j] = a[i - 1] === b[j - 1] ? d[i - 1][j - 1] : 1 + Math.min(d[i - 1][j], d[i][j - 1], d[i - 1][j - 1]);
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
    if (palavrasQ.every(pq => palavrasN.some(pn => pn.includes(pq)))) return 70;
    const dist = _levenshtein(nomeNorm, queryNorm);
    const tolerancia = Math.max(2, Math.floor(queryNorm.length * 0.35));
    if (dist <= tolerancia) return 60 - dist;
    const algumaProxima = palavrasQ.some(pq => palavrasN.some(pn => _levenshtein(pn, pq) <= Math.max(1, Math.floor(pq.length * 0.3))));
    if (algumaProxima) return 40;
    return -1;
  }
  function _materiaisPermitidos() { return biblioteca.filter(m => TIPOS_PERMITIDOS.includes(m.tipo)); }
  function _buscarMateriais(texto) {
    const q = _normalizar(texto);
    return _materiaisPermitidos()
      .map(m => ({ m, score: _scoreMaterial(_normalizar(m.nome), q) }))
      .filter(x => x.score >= 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.m);
  }
  function _destacar(nome, query) {
    if (!query || !query.trim()) return nome;
    const qNorm = _normalizar(query), nNorm = _normalizar(nome);
    const idx = nNorm.indexOf(qNorm);
    if (idx === -1) return nome;
    return nome.slice(0, idx) + '<mark style="background:rgba(245,200,0,0.35);color:inherit;border-radius:2px;">' + nome.slice(idx, idx + query.length) + '</mark>' + nome.slice(idx + query.length);
  }

  // ===================== MODAL: ITEM AVULSO =====================
  function novoItem() {
    if (!sel.localId) { Utils.toast('Selecione um local primeiro.', 'alerta'); return; }
    editandoItemId = null; modoItem = 'buscar'; buscaTexto = ''; materialSelecionadoId = '';
    document.getElementById('modal-ar-titulo').textContent = 'Adicionar Item ao Levantamento';
    _renderItemModal(null);
    Utils.abrirModal('modal-ar-item');
    _focarBusca();
  }
  function editarItem(id) {
    const it = itens.find(x => x.id === id); if (!it) return;
    editandoItemId = id; modoItem = 'buscar'; buscaTexto = ''; materialSelecionadoId = it.materialId;
    document.getElementById('modal-ar-titulo').textContent = 'Editar Item';
    _renderItemModal(it);
    Utils.abrirModal('modal-ar-item');
    _focarBusca();
  }
  function setModoItem(m) {
    modoItem = m;
    _renderItemModal(editandoItemId ? itens.find(x => x.id === editandoItemId) : null);
    if (m === 'buscar') _focarBusca();
  }
  function _focarBusca() { setTimeout(() => { document.getElementById('ar-busca-input')?.focus(); }, 60); }
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
        <span class="tree-label">${_destacar(m.nome, buscaTexto)}${m.fabricante ? ' — <span style=\'color:#888\'>' + m.fabricante + '</span>' : ''}</span>
        <span class="tree-badge">${m.tipo}</span>
      </div>`).join('');
  }
  function _renderItemModal(it) {
    const body = document.getElementById('ar-item-body'); if (!body) return;
    const localLabel = (_caminho(sel.localId) || []).join(' → ');
    const matSel = biblioteca.find(m => m.id === materialSelecionadoId);
    body.innerHTML = `
      <div style="background:var(--cor-fundo);border-radius:8px;padding:8px 14px;margin-bottom:14px;font-size:0.82rem;color:var(--cor-texto-secundario);">
        Local: <strong style="color:var(--cor-primaria-dark);">${localLabel}</strong>
      </div>
      <div style="display:flex;gap:6px;margin-bottom:16px;">
        <button class="btn btn-sm ${modoItem === 'buscar' ? 'btn-primario' : 'btn-secundario'}" onclick="LevantamentoAr.setModoItem('buscar')">🔎 Usar da biblioteca</button>
        <button class="btn btn-sm ${modoItem === 'criar' ? 'btn-primario' : 'btn-secundario'}" onclick="LevantamentoAr.setModoItem('criar')">+ Criar novo material</button>
      </div>
      ${modoItem === 'buscar' ? `
        <div class="form-grupo"><label>Buscar peça/material (Ar Condicionado / Hidráulica)</label>
          <input type="text" id="ar-busca-input" class="form-control" placeholder="Ex: dreno, tubo cobre, VRF..." value="${buscaTexto}"
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
              <select id="ar-nm-tipo" class="form-control">${TIPOS_PERMITIDOS.map(t => `<option>${t}</option>`).join('')}</select></div>
            <div class="form-grupo"><label>Fabricante</label><input id="ar-nm-fab" class="form-control"></div>
          </div>
          <div class="form-row">
            <div class="form-grupo"><label>Referência</label><input id="ar-nm-ref" class="form-control"></div>
            <div class="form-grupo"><label>Unidade base</label>
              <select id="ar-nm-und" class="form-control">${['un', 'm', 'kg', 'L', 'saco', 'caixa', 'rolo', 'par', 'conjunto'].map(u => `<option>${u}</option>`).join('')}</select></div>
          </div>
        </div>
      `}
      <div class="form-row">
        <div class="form-grupo"><label>Quantidade *</label>
          <input id="ar-qtd" type="number" step="0.001" min="0" class="form-control" value="${it?.quantidade || ''}" placeholder="0,000"></div>
        <div class="form-grupo"><label>Unidade</label>
          <input id="ar-unidade" class="form-control" value="${it?.unidade || matSel?.unidade || ''}" placeholder="un, m, kg..."></div>
      </div>
      <div class="form-grupo"><label>Observações</label><textarea id="ar-obs" class="form-control" rows="2">${it?.observacoes || ''}</textarea></div>`;
  }
  async function salvarItem() {
    if (!sel.localId) { Utils.toast('Selecione um local.', 'alerta'); return; }
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
          nome, tipo: document.getElementById('ar-nm-tipo')?.value || TIPOS_PERMITIDOS[0],
          fabricante: document.getElementById('ar-nm-fab')?.value?.trim() || '',
          referencia: document.getElementById('ar-nm-ref')?.value?.trim() || '',
          unidade: document.getElementById('ar-nm-und')?.value || 'un',
        });
      } catch (e) { console.error(e); Utils.toast('Erro ao criar material.', 'erro'); return; }
    } else if (!materialId) { Utils.toast('Selecione um material na busca.', 'alerta'); return; }

    const data = { materialId, localId: sel.localId, quantidade, unidade, observacoes };
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

  // ===================== MODAL: LANÇAMENTO DE MÁQUINA =====================
  function novaMaquinaLancamento() {
    if (!sel.localId) { Utils.toast('Selecione um local primeiro.', 'alerta'); return; }
    const temAlgumaConfig = (maquinasCfg.cobre || []).length || (maquinasCfg.pex || []).length;
    if (!temAlgumaConfig) {
      Utils.toast('Nenhuma máquina configurada ainda. Configure ao menos uma antes de lançar.', 'alerta');
      Router.navegar('levantamento-ar-config.html');
      return;
    }
    editandoMaqId = null;
    const modeloInicial = (maquinasCfg.cobre || []).length ? 'cobre' : 'pex';
    maqDraft = { modeloTipo: modeloInicial, maquinaConfigId: (maquinasCfg[modeloInicial] || [])[0]?.id || '', mlBase: '', manuaisAvulsos: [], observacoes: '' };
    document.getElementById('modal-armaq-titulo').textContent = 'Nova Máquina';
    _buscaManualTexto = '';
    _renderMaquinaModal();
    Utils.abrirModal('modal-armaq-lancamento');
  }
  function editarMaquinaLancamento(id) {
    const doc = maquinasLanc.find(x => x.id === id); if (!doc) return;
    editandoMaqId = id;
    maqDraft = {
      modeloTipo: doc.modeloTipo, maquinaConfigId: doc.maquinaConfigId, mlBase: doc.mlBase,
      manuaisAvulsos: JSON.parse(JSON.stringify(doc.manuaisAvulsos || [])), observacoes: doc.observacoes || '',
    };
    document.getElementById('modal-armaq-titulo').textContent = 'Editar Máquina';
    _buscaManualTexto = '';
    _renderMaquinaModal();
    Utils.abrirModal('modal-armaq-lancamento');
  }
  async function excluirMaquinaLancamento(id) {
    if (!Utils.confirmar('Remover esta máquina do levantamento?')) return;
    try { await Database.deletar(obraId, COL_MAQUINAS, id); Utils.toast('Removida.', 'sucesso'); await carregar(); }
    catch (e) { Utils.toast('Erro.', 'erro'); }
  }
  function setModeloLancamento(tipo) {
    maqDraft.modeloTipo = tipo;
    maqDraft.maquinaConfigId = (maquinasCfg[tipo] || [])[0]?.id || '';
    _renderMaquinaModal();
  }
  function setMaquinaLancamento(id) { maqDraft.maquinaConfigId = id; _renderMaquinaModal(); }
  function onCampoMaquinaLancamento(campo, valor) { maqDraft[campo] = valor; _atualizarPreviewMaquina(); }

  // ---- peça manual (avulsa) dentro do lançamento: busca/cria + quantidade ----
  function onBuscaManual(texto) {
    _buscaManualTexto = texto;
    const lista = document.getElementById('armaq-busca-resultados');
    if (lista) lista.innerHTML = _renderResultadosBuscaManual();
  }
  function _renderResultadosBuscaManual() {
    if (!_buscaManualTexto.trim()) return '';
    const resultados = _buscarMateriais(_buscaManualTexto).slice(0, 10);
    const criarBtn = `<div style="padding:6px 10px;border-top:${resultados.length ? '1px solid var(--cor-borda-light)' : 'none'};">
      <button class="btn btn-secundario btn-sm" onclick="LevantamentoAr.criarMaterialManual()">+ Criar material novo: "${_buscaManualTexto}"</button>
    </div>`;
    if (!resultados.length) {
      return `<div class="text-sm text-muted" style="padding:6px;">Nenhum material parecido encontrado na biblioteca.</div>${criarBtn}`;
    }
    return resultados.map(m => `
      <div class="tree-item" style="padding:6px 10px;" onclick="LevantamentoAr.adicionarPecaManual('${m.id}','${m.nome.replace(/'/g, "\\'")}','${m.unidade || 'un'}')">
        <span class="tree-icon">🔩</span><span class="tree-label">${_destacar(m.nome, _buscaManualTexto)}</span><span class="tree-badge">${m.tipo}</span>
      </div>`).join('') + criarBtn;
  }
  async function criarMaterialManual() {
    const nome = _buscaManualTexto.trim(); if (!nome) return;
    try {
      const materialId = await Database.criar(obraId, 'materiais', { nome, tipo: TIPOS_PERMITIDOS[0], unidade: 'un', fabricante: '', referencia: '' });
      biblioteca.push({ id: materialId, nome, tipo: TIPOS_PERMITIDOS[0], unidade: 'un' });
      adicionarPecaManual(materialId, nome, 'un');
    } catch (e) { Utils.toast('Erro ao criar material.', 'erro'); }
  }
  function adicionarPecaManual(materialId, nome, unidade) {
    maqDraft.manuaisAvulsos.push({ materialId, nome, unidade, quantidade: 1 });
    _buscaManualTexto = '';
    _renderMaquinaModal();
  }
  function onQtdPecaManual(idx, valor) { maqDraft.manuaisAvulsos[idx].quantidade = parseFloat(valor) || 0; }
  function removerPecaManual(idx) { maqDraft.manuaisAvulsos.splice(idx, 1); _renderMaquinaModal(); }

  function _renderMaquinaModal() {
    const body = document.getElementById('armaq-modal-body'); if (!body || !maqDraft) return;
    const cfg = _obterMaquinaConfig(maqDraft.modeloTipo, maqDraft.maquinaConfigId);
    const opcoesModelo = ['cobre', 'pex'].filter(t => (maquinasCfg[t] || []).length);
    body.innerHTML = `
      <div class="form-row">
        <div class="form-grupo"><label>Modelo</label>
          <select class="form-control" onchange="LevantamentoAr.setModeloLancamento(this.value)">
            ${opcoesModelo.map(t => `<option value="${t}" ${maqDraft.modeloTipo === t ? 'selected' : ''}>${t.toUpperCase()}</option>`).join('')}
          </select></div>
        <div class="form-grupo"><label>Máquina configurada</label>
          <select class="form-control" onchange="LevantamentoAr.setMaquinaLancamento(this.value)">
            ${(maquinasCfg[maqDraft.modeloTipo] || []).map(m => `<option value="${m.id}" ${maqDraft.maquinaConfigId === m.id ? 'selected' : ''}>${m.nome}</option>`).join('')}
          </select></div>
      </div>
      <div class="form-grupo"><label>ML lançado (comprimento base do projeto) *</label>
        <input type="number" step="0.01" class="form-control" value="${maqDraft.mlBase}" oninput="LevantamentoAr.onCampoMaquinaLancamento('mlBase', this.value)"></div>

      <div style="margin:14px 0;">
        <div style="font-size:0.8rem;font-weight:700;color:var(--cor-primaria-dark);margin-bottom:8px;">Peças manuais (ex: dreno) — adicione livremente</div>
        <input type="text" id="armaq-busca-manual" class="form-control" placeholder="Buscar peça na biblioteca (ex: dreno)..." value="${_buscaManualTexto}"
          oninput="LevantamentoAr.onBuscaManual(this.value)">
        <div id="armaq-busca-resultados" style="max-height:160px;overflow-y:auto;">${_renderResultadosBuscaManual()}</div>
        ${maqDraft.manuaisAvulsos.length ? `
          <div style="margin-top:8px;">
            ${maqDraft.manuaisAvulsos.map((m, idx) => `
              <div style="display:grid;grid-template-columns:2fr 1fr 28px;gap:6px;align-items:center;margin-bottom:6px;">
                <div class="text-sm">${m.nome}</div>
                <input type="number" step="1" min="0" class="form-control" value="${m.quantidade}" oninput="LevantamentoAr.onQtdPecaManual(${idx}, this.value)">
                <button class="arcfg-del-btn" style="width:28px;height:28px;border-radius:6px;border:none;background:rgba(220,38,38,0.1);color:#dc2626;cursor:pointer;" onclick="LevantamentoAr.removerPecaManual(${idx})">✕</button>
              </div>`).join('')}
          </div>` : `<div class="text-sm text-muted" style="margin-top:6px;">Nenhuma peça manual adicionada ainda.</div>`}
      </div>

      <div class="form-grupo"><label>Observações</label><textarea class="form-control" rows="2" oninput="LevantamentoAr.onCampoMaquinaLancamento('observacoes', this.value)">${maqDraft.observacoes || ''}</textarea></div>

      <div style="background:rgba(34,197,94,0.06);border:1.5px solid rgba(34,197,94,0.25);border-radius:8px;padding:14px;margin-top:8px;">
        <div style="font-size:0.8rem;font-weight:700;color:#15803d;margin-bottom:8px;">Peças calculadas automaticamente</div>
        <div id="armaq-preview" class="text-sm">${_renderPreviewMaquina(cfg)}</div>
      </div>`;
  }
  function _renderPreviewMaquina(cfg) {
    if (!cfg) return `<div class="text-muted">Nenhuma máquina configurada para este modelo. <a href="levantamento-ar-config.html" style="color:var(--cor-primaria-dark);">Configurar agora</a>.</div>`;
    const kit = Utils.calcularKitAr(cfg, maqDraft.mlBase);
    let h = `<div style="font-family:var(--font-mono);margin-bottom:6px;">ML total (com perda): <strong>${Utils.formatarNumero(kit.mlTotal)} m</strong></div>`;
    if (kit.cobre) h += `<div>• ${kit.cobre.nomeExibicao || kit.cobre.nome}: <strong>${Utils.formatarNumero(kit.cobre.metros)} m</strong> (${Utils.formatarNumero(kit.cobre.rolos)} rolo(s))</div>`;
    kit.vinculados.forEach(v => { h += `<div>• ${v.nome}: <strong>${Utils.formatarNumero(v.metros)} m</strong> (${Utils.formatarNumero(v.rolos)} rolo(s))</div>`; });
    kit.porMl.forEach(p => {
      if (p.tipo === 'uni_por_ml') { h += `<div>• ${p.nome}: <strong>${Utils.formatarNumero(p.quantidade, 0)} un</strong></div>`; return; }
      const unTxt = p.unidades != null ? ` (${Utils.formatarNumero(Math.ceil(p.unidades), 0)} un de ${p.mPorUnidade}m)` : '';
      h += `<div>• ${p.nome}: <strong>${Utils.formatarNumero(p.quantidade)} m</strong>${unTxt}</div>`;
    });
    return h;
  }
  function _atualizarPreviewMaquina() {
    const p = document.getElementById('armaq-preview');
    if (p) p.innerHTML = _renderPreviewMaquina(_obterMaquinaConfig(maqDraft.modeloTipo, maqDraft.maquinaConfigId));
  }
  async function salvarMaquinaLancamento() {
    if (!sel.localId) { Utils.toast('Selecione um local.', 'alerta'); return; }
    if (!maqDraft.maquinaConfigId) { Utils.toast('Selecione uma máquina configurada.', 'alerta'); return; }
    const mlBase = parseFloat(maqDraft.mlBase) || 0;
    if (!mlBase) { Utils.toast('Informe o ML lançado.', 'alerta'); return; }
    const data = {
      localId: sel.localId, modeloTipo: maqDraft.modeloTipo, maquinaConfigId: maqDraft.maquinaConfigId,
      mlBase, manuaisAvulsos: maqDraft.manuaisAvulsos || [], observacoes: maqDraft.observacoes || '',
    };
    try {
      if (editandoMaqId) await Database.atualizar(obraId, COL_MAQUINAS, editandoMaqId, data);
      else await Database.criar(obraId, COL_MAQUINAS, data);
      Utils.fecharModal('modal-armaq-lancamento');
      Utils.toast('Máquina salva!', 'sucesso');
      editandoMaqId = null; maqDraft = null;
      await carregar();
    } catch (e) { console.error(e); Utils.toast('Erro ao salvar máquina.', 'erro'); }
  }

  return {
    init, carregar, renderizar,
    selGeral, selNo, toggleNo, toggleExpandirMaquina,
    novaArea, novoSublocal, renomearNo, excluirNo, duplicarNo,
    novoItem, editarItem, setModoItem, onBuscaMaterial, selecionarMaterialBusca, salvarItem, excluirItem,
    novaMaquinaLancamento, editarMaquinaLancamento, excluirMaquinaLancamento,
    setModeloLancamento, setMaquinaLancamento, onCampoMaquinaLancamento, salvarMaquinaLancamento,
    onBuscaManual, criarMaterialManual, adicionarPecaManual, onQtdPecaManual, removerPecaManual,
    exportarResumo,
  };
})();

function onObraChanged() { LevantamentoAr.init(); }

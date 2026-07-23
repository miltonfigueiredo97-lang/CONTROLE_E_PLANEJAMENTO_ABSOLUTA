// ============================================
// Configuração de Máquinas — Levantamento de Ar Condicionado
// Modelos: Cobre (funcional), PEX (reaproveita motor do Cobre), Duto (em breve)
// Cada item de config é auto-vinculado à biblioteca de Materiais.
// Itens manuais (ex: dreno) NÃO são configurados aqui — são adicionados livremente
// no momento do lançamento da máquina (ver levantamento-ar-condicionado.js).
// ============================================
const LevantamentoArConfig = (() => {
  let obraId = null;
  let config = { cobre: [], pex: [], duto: [] };
  let biblioteca = [];
  let aba = 'cobre';
  let draft = null;       // máquina em edição no modal (cópia de trabalho)
  let editandoId = null;  // id da máquina sendo editada, null = nova
  let mlTeste = 5;

  const CONFIG_DOC = 'arMaquinasConfig';
  const TIPOS_ATIVOS = ['cobre', 'pex']; // duto ainda não implementado

  // ===================== INIT =====================
  async function init() {
    const ok = await Utils.initPagina({ requireObra: true });
    if (!ok) return;
    obraId = Router.getObraId();
    const main = document.getElementById('arcfg-content');
    if (!obraId) {
      if (main) main.innerHTML = `<div class="estado-vazio"><div class="icone">⚙️</div><p>Selecione uma obra na barra lateral.</p></div>`;
      return;
    }
    await carregar();
  }

  async function carregar() {
    try {
      Utils.mostrarLoading('Carregando configuração...');
      const [snap, mats] = await Promise.all([
        db.collection('obras').doc(obraId).collection('config').doc(CONFIG_DOC).get(),
        Database.listar(obraId, 'materiais', 'nome').catch(() => []),
      ]);
      config = snap.exists ? { cobre: [], pex: [], duto: [], ...snap.data() } : { cobre: [], pex: [], duto: [] };
      biblioteca = mats;
      renderizar();
    } catch (e) {
      console.error('Erro ao carregar config de ar:', e);
      Utils.toast('Erro ao carregar: ' + e.message, 'erro');
    } finally { Utils.esconderLoading(); }
  }

  async function _salvarConfig() {
    await db.collection('obras').doc(obraId).collection('config').doc(CONFIG_DOC).set(config, { merge: true });
  }

  function _uid() { return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function _formatarDiametro(m) {
    const d = Utils.formatarDiametroAr(m);
    return d || '?';
  }

  // ===================== MATERIAL AUTO-LINK =====================
  async function _materialGetOrCreate(nome, unidade) {
    if (!nome || !nome.trim()) return null;
    const nomeNorm = nome.trim().toLowerCase();
    const existente = biblioteca.find(m => (m.nome || '').trim().toLowerCase() === nomeNorm);
    if (existente) return existente.id;
    const id = await Database.criar(obraId, 'materiais', {
      nome: nome.trim(), tipo: 'Ar Condicionado', unidade: unidade || 'un', fabricante: '', referencia: '',
    });
    biblioteca.push({ id, nome: nome.trim(), tipo: 'Ar Condicionado', unidade: unidade || 'un' });
    return id;
  }
  async function _materialSync(materialId, novoNome, unidade) {
    // Mantém o nome/unidade do material da biblioteca em sincronia com o item da config
    if (!materialId) return _materialGetOrCreate(novoNome, unidade);
    try {
      await Database.atualizar(obraId, 'materiais', materialId, { nome: novoNome.trim(), unidade: unidade || 'un' });
      const m = biblioteca.find(x => x.id === materialId);
      if (m) { m.nome = novoNome.trim(); m.unidade = unidade || 'un'; }
      return materialId;
    } catch (e) {
      // material pode ter sido excluído da biblioteca manualmente -> recria
      return _materialGetOrCreate(novoNome, unidade);
    }
  }

  // ===================== RENDER =====================
  function renderizar() {
    const c = document.getElementById('arcfg-content'); if (!c) return;
    c.innerHTML = `
      <div class="page-header">
        <div><h2>⚙️ Configuração de Máquinas — Ar Condicionado</h2>
          <span class="subtitulo">Defina a composição de peças por máquina. Ao lançar o levantamento, basta informar o ML e o sistema calcula tudo.</span></div>
      </div>
      <div style="display:flex;gap:6px;margin-bottom:18px;">
        ${['cobre', 'pex', 'duto'].map(t => `
          <button class="btn btn-sm ${aba === t ? 'btn-primario' : 'btn-secundario'}" onclick="LevantamentoArConfig.setAba('${t}')">
            ${t === 'cobre' ? '🔧 Cobre' : t === 'pex' ? '🧵 PEX' : '🌀 Duto'}
            ${!TIPOS_ATIVOS.includes(t) ? ' <span class="badge badge-neutro" style="margin-left:4px;">em breve</span>' : ''}
          </button>`).join('')}
      </div>
      ${!TIPOS_ATIVOS.includes(aba) ? `
        <div class="estado-vazio"><div class="icone">🌀</div><p>Modelo "${aba.toUpperCase()}" ainda não disponível. Em breve.</p></div>
      ` : _renderListaMaquinas()}
    `;
  }

  function _renderListaMaquinas() {
    const lista = config[aba] || [];
    return `
      <div class="page-header" style="margin-bottom:12px;">
        <div><h3 style="font-size:1rem;">Máquinas configuradas</h3>
          <span class="subtitulo">${lista.length} máquina(s)</span></div>
        <button class="btn btn-primario btn-sm" onclick="LevantamentoArConfig.novaMaquina()">+ Nova Máquina</button>
      </div>
      ${!lista.length ? `<div class="estado-vazio"><div class="icone">❄️</div><p>Nenhuma máquina configurada em ${aba.toUpperCase()} ainda.</p>
        <button class="btn btn-primario" onclick="LevantamentoArConfig.novaMaquina()">+ Nova Máquina</button></div>` : `
      <div class="cards-grid">
        ${lista.map(m => `
          <div class="card">
            <div class="card-body">
              <div class="obra-nome">${m.nome || '(sem nome)'}</div>
              <div class="obra-info text-sm">Ø ${_formatarDiametro(m)} · perda ${m.perdaCm || 0}cm + ${m.perdaPercentual || 0}%</div>
              <div class="text-sm text-muted" style="margin-top:6px;">
                ${(m.vinculados || []).length} vinculado(s) · ${(m.porMl || []).length} item(ns)/ML
              </div>
              <div style="display:flex;gap:6px;margin-top:12px;">
                <button class="btn btn-secundario btn-sm" onclick="LevantamentoArConfig.editarMaquina('${m.id}')">✎ Editar</button>
                <button class="btn btn-secundario btn-sm" onclick="LevantamentoArConfig.duplicarMaquina('${m.id}')" title="Duplicar máquina">⧉ Duplicar</button>
                <button class="btn btn-perigo btn-sm" onclick="LevantamentoArConfig.excluirMaquina('${m.id}')">✕ Excluir</button>
              </div>
            </div>
          </div>`).join('')}
      </div>`}
    `;
  }

  // ===================== ABA =====================
  function setAba(t) { aba = t; renderizar(); }

  // ===================== CRUD MÁQUINA =====================
  function novaMaquina() {
    editandoId = null;
    draft = {
      id: _uid(), nome: '', diametroValor: '', diametroUnidade: 'mm', perdaCm: 10, perdaPercentual: 5,
      cobre: { nome: aba === 'pex' ? 'Tubo PEX' : 'Barra de Cobre', mPorRolo: 15, materialId: null },
      vinculados: [{ id: _uid(), nome: 'Espuma Polipex Ivertape IVL-A', mPorRolo: 2, materialId: null }],
      porMl: [
        { id: _uid(), nome: 'Fita de PVC', tipo: 'cm_por_ml', taxa: 100, mPorUnidade: 100, materialId: null },
        { id: _uid(), nome: 'Silver Tape', tipo: 'cm_por_ml', taxa: 50, mPorUnidade: 100, materialId: null },
        { id: _uid(), nome: 'Fita Perfurada', tipo: 'cm_por_ml', taxa: 100, mPorUnidade: 50, materialId: null },
        { id: _uid(), nome: 'Bucha 6', tipo: 'uni_por_ml', taxa: 1, mPorUnidade: null, materialId: null },
        { id: _uid(), nome: 'Parafuso 6', tipo: 'uni_por_ml', taxa: 1, mPorUnidade: null, materialId: null },
        { id: _uid(), nome: 'Broca 6', tipo: 'uni_por_ml', taxa: 0.2, mPorUnidade: null, materialId: null },
      ],
    };
    mlTeste = 5;
    document.getElementById('modal-arcfg-titulo').textContent = 'Nova Máquina';
    _renderModal();
    Utils.abrirModal('modal-arcfg-maquina');
  }

  function editarMaquina(id) {
    const m = (config[aba] || []).find(x => x.id === id); if (!m) return;
    editandoId = id;
    draft = JSON.parse(JSON.stringify(m)); // cópia de trabalho
    // migração leve: máquinas antigas tinham diametroMm (número) sem unidade
    if (draft.diametroValor === undefined) {
      draft.diametroValor = draft.diametroMm || '';
      draft.diametroUnidade = 'mm';
    }
    delete draft.manuais; // itens manuais não vivem mais na config
    draft.porMl = (draft.porMl || []).map(p => ({ mPorUnidade: null, ...p }));
    mlTeste = 5;
    document.getElementById('modal-arcfg-titulo').textContent = `Editar Máquina — ${m.nome}`;
    _renderModal();
    Utils.abrirModal('modal-arcfg-maquina');
  }

  async function excluirMaquina(id) {
    if (!Utils.confirmar('Excluir esta máquina configurada? Lançamentos já feitos com ela deixarão de calcular automaticamente.')) return;
    config[aba] = (config[aba] || []).filter(x => x.id !== id);
    try { await _salvarConfig(); Utils.toast('Máquina excluída.', 'sucesso'); renderizar(); }
    catch (e) { Utils.toast('Erro ao salvar.', 'erro'); }
  }

  async function duplicarMaquina(id) {
    const original = (config[aba] || []).find(x => x.id === id); if (!original) return;
    const copia = JSON.parse(JSON.stringify(original));
    copia.id = _uid();
    copia.nome = (original.nome || '') + ' (cópia)';
    // materialId é mantido — a cópia usa os mesmos materiais da biblioteca até serem renomeados
    (config[aba] = config[aba] || []).push(copia);
    try {
      await _salvarConfig();
      Utils.toast('Máquina duplicada. Renomeie e ajuste o que precisar.', 'sucesso');
      renderizar();
      editarMaquina(copia.id);
    } catch (e) { Utils.toast('Erro ao salvar.', 'erro'); }
  }

  // ===================== MODAL: EDIÇÃO DA MÁQUINA =====================
  function _renderModal() {
    const body = document.getElementById('arcfg-modal-body'); if (!body || !draft) return;
    const kit = Utils.calcularKitAr(draft, mlTeste);
    const rotulo = aba === 'pex' ? 'PEX' : 'Barra de Cobre';

    body.innerHTML = `
      <div class="form-grupo"><label>Nome da Máquina *</label>
        <input id="am-nome" class="form-control" value="${draft.nome}" placeholder="Ex: 9.000 BTU" oninput="LevantamentoArConfig.onCampo('nome', this.value)"></div>

      <div class="form-grupo"><label>Diâmetro do ${aba === 'pex' ? 'PEX' : 'cobre'}</label>
        <div style="display:flex;gap:8px;">
          <input id="am-diam" type="${draft.diametroUnidade === 'pol' ? 'text' : 'number'}" step="0.1" class="form-control"
            style="flex:1;" placeholder="${draft.diametroUnidade === 'pol' ? 'Ex: 5/8' : 'Ex: 9.5'}"
            value="${draft.diametroValor}" oninput="LevantamentoArConfig.onCampo('diametroValor', this.value)">
          <div style="display:flex;gap:4px;">
            <button type="button" class="btn btn-sm ${draft.diametroUnidade === 'mm' ? 'btn-primario' : 'btn-secundario'}" onclick="LevantamentoArConfig.setDiametroUnidade('mm')">mm</button>
            <button type="button" class="btn btn-sm ${draft.diametroUnidade === 'pol' ? 'btn-primario' : 'btn-secundario'}" onclick="LevantamentoArConfig.setDiametroUnidade('pol')">pol (fração)</button>
          </div>
        </div>
      </div>

      <div class="form-row">
        <div class="form-grupo"><label>Perda fixa (cm) — Z</label>
          <input type="number" step="0.1" class="form-control" value="${draft.perdaCm}" oninput="LevantamentoArConfig.onCampo('perdaCm', this.value)"></div>
        <div class="form-grupo"><label>Perda percentual (%) — A</label>
          <input type="number" step="0.1" class="form-control" value="${draft.perdaPercentual}" oninput="LevantamentoArConfig.onCampo('perdaPercentual', this.value)"></div>
      </div>
      <div class="text-sm text-muted" style="margin:-6px 0 16px;">
        Fórmula: ML total = (ML lançado no levantamento + Z/100) × (1 + A%). Esse ML total é a base de todos os itens abaixo.
      </div>

      <div style="background:var(--cor-fundo);border-radius:8px;padding:12px 14px;margin-bottom:16px;">
        <div style="font-size:0.8rem;font-weight:700;color:var(--cor-primaria-dark);margin-bottom:10px;">Item Principal (${rotulo})</div>
        <div class="form-row">
          <div class="form-grupo"><label>Nome</label>
            <input class="form-control" value="${draft.cobre.nome}" oninput="LevantamentoArConfig.onCampoCobre('nome', this.value)"></div>
          <div class="form-grupo"><label>1 rolo = quantos metros?</label>
            <input type="number" step="0.1" class="form-control" value="${draft.cobre.mPorRolo}" oninput="LevantamentoArConfig.onCampoCobre('mPorRolo', this.value)"></div>
        </div>
      </div>

      <div style="margin-bottom:18px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div style="font-size:0.8rem;font-weight:700;color:var(--cor-primaria-dark);">Itens Vinculados <span class="text-muted" style="font-weight:400;">(mesma metragem/qtd do item principal)</span></div>
          <button class="btn btn-secundario btn-sm" onclick="LevantamentoArConfig.addVinculado()">+ item</button>
        </div>
        ${!draft.vinculados.length ? `<div class="text-sm text-muted">Nenhum item vinculado.</div>` : `
        <div class="arcfg-grid-header arcfg-grid-vinc"><span>Nome</span><span>1 rolo = X m</span><span></span></div>
        ${draft.vinculados.map(v => `
          <div class="arcfg-grid-row arcfg-grid-vinc">
            <input class="form-control" value="${v.nome}" placeholder="Nome (ex: Espuma)" oninput="LevantamentoArConfig.onCampoVinculado('${v.id}','nome',this.value)">
            <input type="number" step="0.1" class="form-control" value="${v.mPorRolo}" placeholder="m/rolo" oninput="LevantamentoArConfig.onCampoVinculado('${v.id}','mPorRolo',this.value)">
            <button class="arcfg-del-btn" title="Remover" onclick="LevantamentoArConfig.removerVinculado('${v.id}')">✕</button>
          </div>`).join('')}`}
      </div>

      <div style="margin-bottom:18px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div style="font-size:0.8rem;font-weight:700;color:var(--cor-primaria-dark);">Itens por Metro Linear</div>
          <button class="btn btn-secundario btn-sm" onclick="LevantamentoArConfig.addPorMl()">+ item</button>
        </div>
        ${!draft.porMl.length ? `<div class="text-sm text-muted">Nenhum item por ML.</div>` : `
        <div class="arcfg-grid-header arcfg-grid-porml"><span>Nome</span><span>Regra</span><span>Taxa</span><span>1 un = X m</span><span></span></div>
        ${draft.porMl.map(p => `
          <div class="arcfg-grid-row arcfg-grid-porml">
            <input class="form-control" value="${p.nome}" placeholder="Nome (ex: Fita de PVC)" oninput="LevantamentoArConfig.onCampoPorMl('${p.id}','nome',this.value)">
            <select class="form-control" onchange="LevantamentoArConfig.onCampoPorMl('${p.id}','tipo',this.value)">
              <option value="cm_por_ml" ${p.tipo === 'cm_por_ml' ? 'selected' : ''}>cm/ML</option>
              <option value="uni_por_ml" ${p.tipo === 'uni_por_ml' ? 'selected' : ''}>un/ML</option>
            </select>
            <input type="number" step="0.01" class="form-control" value="${p.taxa}" placeholder="taxa" oninput="LevantamentoArConfig.onCampoPorMl('${p.id}','taxa',this.value)">
            ${p.tipo === 'cm_por_ml'
              ? `<input type="number" step="0.1" class="form-control" value="${p.mPorUnidade || ''}" placeholder="ex: 100" oninput="LevantamentoArConfig.onCampoPorMl('${p.id}','mPorUnidade',this.value)">`
              : `<div class="text-sm text-muted" style="align-self:center;">—</div>`}
            <button class="arcfg-del-btn" title="Remover" onclick="LevantamentoArConfig.removerPorMl('${p.id}')">✕</button>
          </div>`).join('')}`}
        <div class="text-sm text-muted" style="margin-top:6px;">"1 un = X m" é opcional — se preenchido (ex: fita isolante 1 rolo = 100m), o sistema já informa quantas unidades comprar, além dos metros.</div>
      </div>

      <div style="background:rgba(59,130,246,0.06);border:1.5px solid rgba(59,130,246,0.25);border-radius:8px;padding:12px 14px;margin-bottom:16px;font-size:0.8rem;color:var(--cor-texto-secundario);">
        💡 Itens manuais (ex: dreno, peças avulsas) não ficam aqui — eles são adicionados livremente na hora de lançar cada máquina no levantamento.
      </div>

      <div style="background:rgba(34,197,94,0.06);border:1.5px solid rgba(34,197,94,0.25);border-radius:8px;padding:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div style="font-size:0.8rem;font-weight:700;color:#15803d;">Pré-visualização do cálculo</div>
          <div style="display:flex;align-items:center;gap:6px;">
            <label class="text-sm" style="margin:0;">ML de teste:</label>
            <input type="number" step="0.1" style="width:80px;" class="form-control" value="${mlTeste}" oninput="LevantamentoArConfig.onMlTeste(this.value)">
          </div>
        </div>
        <div class="text-sm" id="arcfg-preview">${_renderPreview(kit)}</div>
      </div>

      <style>
        .arcfg-grid-header, .arcfg-grid-row { display:grid; gap:6px; align-items:center; margin-bottom:6px; }
        .arcfg-grid-vinc { grid-template-columns: 2fr 1fr 28px; }
        .arcfg-grid-porml { grid-template-columns: 1.6fr 0.9fr 0.7fr 0.9fr 28px; }
        .arcfg-grid-header span { font-size:0.7rem; color:var(--cor-texto-secundario); font-weight:700; text-transform:uppercase; }
        .arcfg-del-btn { width:28px; height:28px; border-radius:6px; border:none; background:rgba(220,38,38,0.1); color:#dc2626;
          font-size:0.8rem; cursor:pointer; display:flex; align-items:center; justify-content:center; padding:0; }
        .arcfg-del-btn:hover { background:rgba(220,38,38,0.2); }
        @media (max-width: 640px) {
          .arcfg-grid-vinc, .arcfg-grid-porml { grid-template-columns: 1fr 28px; }
          .arcfg-grid-header { display:none; }
        }
      </style>
    `;
  }

  function _renderPreview(kit) {
    let h = `<div style="font-family:var(--font-mono);margin-bottom:6px;">ML total (com perda): <strong>${Utils.formatarNumero(kit.mlTotal)} m</strong></div>`;
    if (kit.cobre) h += `<div>• ${kit.cobre.nomeExibicao || kit.cobre.nome || 'Item principal'}: <strong>${Utils.formatarNumero(kit.cobre.metros)} m</strong> (${Utils.formatarNumero(kit.cobre.rolos)} rolo(s))</div>`;
    kit.vinculados.forEach(v => { h += `<div>• ${v.nome}: <strong>${Utils.formatarNumero(v.metros)} m</strong> (${Utils.formatarNumero(v.rolos)} rolo(s))</div>`; });
    kit.porMl.forEach(p => {
      if (p.tipo === 'uni_por_ml') { h += `<div>• ${p.nome}: <strong>${Utils.formatarNumero(p.quantidade, 0)} un</strong></div>`; return; }
      const unTxt = p.unidades != null ? ` (${Utils.formatarNumero(Math.ceil(p.unidades), 0)} un de ${p.mPorUnidade}m)` : '';
      h += `<div>• ${p.nome}: <strong>${Utils.formatarNumero(p.quantidade)} m</strong>${unTxt}</div>`;
    });
    return h;
  }

  function _atualizarPreview() {
    const p = document.getElementById('arcfg-preview');
    if (p) p.innerHTML = _renderPreview(Utils.calcularKitAr(draft, mlTeste));
  }

  // ---- handlers de campo (atualizam o draft em memória + preview) ----
  function onCampo(campo, valor) { draft[campo] = valor; _atualizarPreview(); }
  function onCampoCobre(campo, valor) { draft.cobre[campo] = valor; _atualizarPreview(); }
  function onCampoVinculado(id, campo, valor) { const v = draft.vinculados.find(x => x.id === id); if (v) v[campo] = valor; _atualizarPreview(); }
  function onCampoPorMl(id, campo, valor) {
    const p = draft.porMl.find(x => x.id === id); if (!p) return;
    p[campo] = valor;
    if (campo === 'tipo') {
      if (valor === 'uni_por_ml') p.mPorUnidade = null;
      _renderModal(); // tipo alterna a coluna "1 un = X m", precisa re-render completo
    } else {
      _atualizarPreview(); // nome/taxa/mPorUnidade: só atualiza a prévia, preserva foco e scroll
    }
  }
  function onMlTeste(valor) { mlTeste = parseFloat(valor) || 0; _atualizarPreview(); }
  function setDiametroUnidade(u) { draft.diametroUnidade = u; draft.diametroValor = ''; _renderModal(); }

  function addVinculado() { draft.vinculados.push({ id: _uid(), nome: '', mPorRolo: 1, materialId: null }); _renderModal(); }
  function removerVinculado(id) { draft.vinculados = draft.vinculados.filter(x => x.id !== id); _renderModal(); }
  function addPorMl() { draft.porMl.push({ id: _uid(), nome: '', tipo: 'cm_por_ml', taxa: 0, mPorUnidade: null, materialId: null }); _renderModal(); }
  function removerPorMl(id) { draft.porMl = draft.porMl.filter(x => x.id !== id); _renderModal(); }

  // ===================== SALVAR MÁQUINA =====================
  async function salvarMaquina() {
    if (!draft.nome || !draft.nome.trim()) { Utils.toast('Informe o nome da máquina.', 'alerta'); return; }
    try {
      Utils.mostrarLoading('Salvando e sincronizando com a biblioteca...');
      draft.cobre.materialId = await _materialSync(draft.cobre.materialId, draft.cobre.nome, 'm');
      for (const v of draft.vinculados) {
        if (!v.nome || !v.nome.trim()) continue;
        v.materialId = await _materialSync(v.materialId, v.nome, 'm');
      }
      draft.vinculados = draft.vinculados.filter(v => v.nome && v.nome.trim());
      for (const p of draft.porMl) {
        if (!p.nome || !p.nome.trim()) continue;
        p.materialId = await _materialSync(p.materialId, p.nome, p.tipo === 'uni_por_ml' ? 'un' : 'm');
      }
      draft.porMl = draft.porMl.filter(p => p.nome && p.nome.trim());

      const idx = (config[aba] || []).findIndex(x => x.id === draft.id);
      if (idx >= 0) config[aba][idx] = draft; else (config[aba] = config[aba] || []).push(draft);

      await _salvarConfig();
      Utils.fecharModal('modal-arcfg-maquina');
      Utils.toast('Máquina salva!', 'sucesso');
      editandoId = null; draft = null;
      await carregar();
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao salvar máquina: ' + e.message, 'erro');
    } finally { Utils.esconderLoading(); }
  }

  return {
    init, carregar, renderizar, setAba,
    novaMaquina, editarMaquina, excluirMaquina, duplicarMaquina, salvarMaquina,
    onCampo, onCampoCobre, onCampoVinculado, onCampoPorMl, onMlTeste, setDiametroUnidade,
    addVinculado, removerVinculado, addPorMl, removerPorMl,
  };
})();

function onObraChanged() { LevantamentoArConfig.init(); }

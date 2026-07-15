// ============================================
// Configuração de Máquinas — Levantamento de Ar Condicionado
// Modelos: Cobre (funcional), PEX (reaproveita motor do Cobre), Duto (em breve)
// Cada item de config é auto-vinculado à biblioteca de Materiais.
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
              <div class="obra-info text-sm">Ø ${m.diametroMm || '?'}mm · perda ${m.perdaCm || 0}cm + ${m.perdaPercentual || 0}%</div>
              <div class="text-sm text-muted" style="margin-top:6px;">
                ${(m.vinculados || []).length} vinculado(s) · ${(m.porMl || []).length} item(ns)/ML · ${(m.manuais || []).length} manual(is)
              </div>
              <div style="display:flex;gap:6px;margin-top:12px;">
                <button class="btn btn-secundario btn-sm" onclick="LevantamentoArConfig.editarMaquina('${m.id}')">✎ Editar</button>
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
      id: _uid(), nome: '', diametroMm: '', perdaCm: 10, perdaPercentual: 5,
      cobre: { nome: aba === 'pex' ? 'Tubo PEX' : 'Barra de Cobre', mPorRolo: 15, materialId: null },
      vinculados: [{ id: _uid(), nome: 'Espuma Polipex Ivertape IVL-A', mPorRolo: 2, materialId: null }],
      porMl: [
        { id: _uid(), nome: 'Fita de PVC', tipo: 'cm_por_ml', taxa: 100, materialId: null },
        { id: _uid(), nome: 'Silver Tape', tipo: 'cm_por_ml', taxa: 50, materialId: null },
        { id: _uid(), nome: 'Fita Perfurada', tipo: 'cm_por_ml', taxa: 100, materialId: null },
        { id: _uid(), nome: 'Bucha 6', tipo: 'uni_por_ml', taxa: 1, materialId: null },
        { id: _uid(), nome: 'Parafuso 6', tipo: 'uni_por_ml', taxa: 1, materialId: null },
        { id: _uid(), nome: 'Broca 6', tipo: 'uni_por_ml', taxa: 0.2, materialId: null },
      ],
      manuais: [{ id: _uid(), nome: 'Dreno 25mm (7/8) PVC Marrom', materialId: null }],
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

  // ===================== MODAL: EDIÇÃO DA MÁQUINA =====================
  function _renderModal() {
    const body = document.getElementById('arcfg-modal-body'); if (!body || !draft) return;
    const kit = Utils.calcularKitAr(draft, mlTeste);

    body.innerHTML = `
      <div class="form-row">
        <div class="form-grupo"><label>Nome da Máquina *</label>
          <input id="am-nome" class="form-control" value="${draft.nome}" placeholder="Ex: 9.000 BTU" oninput="LevantamentoArConfig.onCampo('nome', this.value)"></div>
        <div class="form-grupo"><label>Diâmetro do ${aba === 'pex' ? 'PEX' : 'cobre'} (mm)</label>
          <input id="am-diam" type="number" step="0.1" class="form-control" value="${draft.diametroMm}" oninput="LevantamentoArConfig.onCampo('diametroMm', this.value)"></div>
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
        <div style="font-size:0.8rem;font-weight:700;color:var(--cor-primaria-dark);margin-bottom:10px;">Item Principal (${aba === 'pex' ? 'PEX' : 'Barra de Cobre'})</div>
        <div class="form-row">
          <div class="form-grupo"><label>Nome</label>
            <input class="form-control" value="${draft.cobre.nome}" oninput="LevantamentoArConfig.onCampoCobre('nome', this.value)"></div>
          <div class="form-grupo"><label>1 rolo = quantos metros?</label>
            <input type="number" step="0.1" class="form-control" value="${draft.cobre.mPorRolo}" oninput="LevantamentoArConfig.onCampoCobre('mPorRolo', this.value)"></div>
        </div>
      </div>

      <div style="margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div style="font-size:0.8rem;font-weight:700;color:var(--cor-primaria-dark);">Itens Vinculados <span class="text-muted" style="font-weight:400;">(mesma metragem/qtd do item principal)</span></div>
          <button class="btn btn-secundario btn-sm" onclick="LevantamentoArConfig.addVinculado()">+ item</button>
        </div>
        ${!draft.vinculados.length ? `<div class="text-sm text-muted">Nenhum item vinculado.</div>` : draft.vinculados.map(v => `
          <div class="form-row" style="align-items:end;margin-bottom:6px;">
            <div class="form-grupo" style="flex:2;"><input class="form-control" value="${v.nome}" placeholder="Nome" oninput="LevantamentoArConfig.onCampoVinculado('${v.id}','nome',this.value)"></div>
            <div class="form-grupo"><input type="number" step="0.1" class="form-control" value="${v.mPorRolo}" placeholder="m/rolo" oninput="LevantamentoArConfig.onCampoVinculado('${v.id}','mPorRolo',this.value)"></div>
            <button class="btn btn-perigo btn-sm" onclick="LevantamentoArConfig.removerVinculado('${v.id}')">✕</button>
          </div>`).join('')}
      </div>

      <div style="margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div style="font-size:0.8rem;font-weight:700;color:var(--cor-primaria-dark);">Itens por Metro Linear</div>
          <button class="btn btn-secundario btn-sm" onclick="LevantamentoArConfig.addPorMl()">+ item</button>
        </div>
        ${!draft.porMl.length ? `<div class="text-sm text-muted">Nenhum item por ML.</div>` : draft.porMl.map(p => `
          <div class="form-row" style="align-items:end;margin-bottom:6px;">
            <div class="form-grupo" style="flex:2;"><input class="form-control" value="${p.nome}" placeholder="Nome" oninput="LevantamentoArConfig.onCampoPorMl('${p.id}','nome',this.value)"></div>
            <div class="form-grupo">
              <select class="form-control" onchange="LevantamentoArConfig.onCampoPorMl('${p.id}','tipo',this.value)">
                <option value="cm_por_ml" ${p.tipo === 'cm_por_ml' ? 'selected' : ''}>cm / ML</option>
                <option value="uni_por_ml" ${p.tipo === 'uni_por_ml' ? 'selected' : ''}>un / ML</option>
              </select>
            </div>
            <div class="form-grupo"><input type="number" step="0.01" class="form-control" value="${p.taxa}" placeholder="taxa" oninput="LevantamentoArConfig.onCampoPorMl('${p.id}','taxa',this.value)"></div>
            <button class="btn btn-perigo btn-sm" onclick="LevantamentoArConfig.removerPorMl('${p.id}')">✕</button>
          </div>`).join('')}
      </div>

      <div style="margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div style="font-size:0.8rem;font-weight:700;color:var(--cor-primaria-dark);">Itens Manuais <span class="text-muted" style="font-weight:400;">(quantidade informada em cada lançamento)</span></div>
          <button class="btn btn-secundario btn-sm" onclick="LevantamentoArConfig.addManual()">+ item</button>
        </div>
        ${!draft.manuais.length ? `<div class="text-sm text-muted">Nenhum item manual.</div>` : draft.manuais.map(mm => `
          <div class="form-row" style="align-items:end;margin-bottom:6px;">
            <div class="form-grupo" style="flex:2;"><input class="form-control" value="${mm.nome}" placeholder="Nome" oninput="LevantamentoArConfig.onCampoManual('${mm.id}','nome',this.value)"></div>
            <button class="btn btn-perigo btn-sm" onclick="LevantamentoArConfig.removerManual('${mm.id}')">✕</button>
          </div>`).join('')}
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
    `;
  }

  function _renderPreview(kit) {
    let h = `<div style="font-family:var(--font-mono);margin-bottom:6px;">ML total (com perda): <strong>${Utils.formatarNumero(kit.mlTotal)} m</strong></div>`;
    if (kit.cobre) h += `<div>• ${kit.cobre.nome || 'Item principal'}: <strong>${Utils.formatarNumero(kit.cobre.metros)} m</strong> (${Utils.formatarNumero(kit.cobre.rolos)} rolo(s))</div>`;
    kit.vinculados.forEach(v => { h += `<div>• ${v.nome}: <strong>${Utils.formatarNumero(v.metros)} m</strong> (${Utils.formatarNumero(v.rolos)} rolo(s))</div>`; });
    kit.porMl.forEach(p => { h += `<div>• ${p.nome}: <strong>${Utils.formatarNumero(p.quantidade)} ${p.tipo === 'uni_por_ml' ? 'un' : 'm'}</strong></div>`; });
    if (draft.manuais.length) h += `<div class="text-muted" style="margin-top:6px;">+ ${draft.manuais.map(m => m.nome).join(', ')} (informado no lançamento)</div>`;
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
  function onCampoPorMl(id, campo, valor) { const p = draft.porMl.find(x => x.id === id); if (p) p[campo] = valor; _atualizarPreview(); }
  function onCampoManual(id, campo, valor) { const m = draft.manuais.find(x => x.id === id); if (m) m[campo] = valor; }
  function onMlTeste(valor) { mlTeste = parseFloat(valor) || 0; _atualizarPreview(); }

  function addVinculado() { draft.vinculados.push({ id: _uid(), nome: '', mPorRolo: 1, materialId: null }); _renderModal(); }
  function removerVinculado(id) { draft.vinculados = draft.vinculados.filter(x => x.id !== id); _renderModal(); }
  function addPorMl() { draft.porMl.push({ id: _uid(), nome: '', tipo: 'cm_por_ml', taxa: 0, materialId: null }); _renderModal(); }
  function removerPorMl(id) { draft.porMl = draft.porMl.filter(x => x.id !== id); _renderModal(); }
  function addManual() { draft.manuais.push({ id: _uid(), nome: '', materialId: null }); _renderModal(); }
  function removerManual(id) { draft.manuais = draft.manuais.filter(x => x.id !== id); _renderModal(); }

  // ===================== SALVAR MÁQUINA =====================
  async function salvarMaquina() {
    if (!draft.nome || !draft.nome.trim()) { Utils.toast('Informe o nome da máquina.', 'alerta'); return; }
    try {
      Utils.mostrarLoading('Salvando e sincronizando com a biblioteca...');
      // item principal
      draft.cobre.materialId = await _materialSync(draft.cobre.materialId, draft.cobre.nome, 'm');
      // vinculados
      for (const v of draft.vinculados) {
        if (!v.nome || !v.nome.trim()) continue;
        v.materialId = await _materialSync(v.materialId, v.nome, 'm');
      }
      draft.vinculados = draft.vinculados.filter(v => v.nome && v.nome.trim());
      // por ML
      for (const p of draft.porMl) {
        if (!p.nome || !p.nome.trim()) continue;
        p.materialId = await _materialSync(p.materialId, p.nome, p.tipo === 'uni_por_ml' ? 'un' : 'm');
      }
      draft.porMl = draft.porMl.filter(p => p.nome && p.nome.trim());
      // manuais
      for (const m of draft.manuais) {
        if (!m.nome || !m.nome.trim()) continue;
        m.materialId = await _materialSync(m.materialId, m.nome, 'un');
      }
      draft.manuais = draft.manuais.filter(m => m.nome && m.nome.trim());

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
    novaMaquina, editarMaquina, excluirMaquina, salvarMaquina,
    onCampo, onCampoCobre, onCampoVinculado, onCampoPorMl, onCampoManual, onMlTeste,
    addVinculado, removerVinculado, addPorMl, removerPorMl, addManual, removerManual,
  };
})();

function onObraChanged() { LevantamentoArConfig.init(); }

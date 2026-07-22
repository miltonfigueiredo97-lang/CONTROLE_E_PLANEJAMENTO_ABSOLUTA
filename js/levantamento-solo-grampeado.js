// ============================================
// Módulo: Levantamento de Solo Grampeado
// Vistas (faces) e Chumbadores (grampos/ancoragens) —
// cadastro/quantitativo, sem dados de execução.
// A execução (datas, produção diária, área executada,
// curva de progresso) fica em Controle de Solo Grampeado.
// Dados: Firestore obras/{obraId}/sg*
// ============================================

const LevantamentoSoloGrampeado = (() => {
  const SG = SoloGrampeadoCalculos;
  const COL_VISTAS = 'sgVistas';
  const COL_CHUMBADORES = 'sgChumbadores';

  let obraId = null;
  let vistas = [];
  let chumbadores = [];

  let fBusca = '', fVista = 'todas', fTipo = 'todos';
  let chumbEditId = null;
  let previewImport = [];

  // ══════════════════════════════════════════
  // INIT / CARREGAMENTO
  // ══════════════════════════════════════════
  async function init() {
    const ok = await Utils.initPagina({ requireObra: true });
    if (!ok) return;
    obraId = Router.getObraId();
    if (!obraId) {
      document.getElementById('sg-content').innerHTML =
        `<div class="estado-vazio"><div class="icone">⛏️</div><p>Selecione uma obra para acessar o levantamento de solo grampeado.</p></div>`;
      return;
    }
    document.addEventListener('keydown', e => { if (e.key === 'Escape') Utils.fecharTodosModais(); });
    await carregar();
  }

  async function carregar() {
    Utils.mostrarLoading();
    try {
      const [vs, cs] = await Promise.all([
        Database.listar(obraId, COL_VISTAS, null),
        Database.listar(obraId, COL_CHUMBADORES, null),
      ]);
      vistas = vs; chumbadores = cs;
      renderizar();
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao carregar dados: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  async function recarregar() {
    obraId = Router.getObraId();
    if (!obraId) return;
    fBusca = ''; fVista = 'todas'; fTipo = 'todos';
    await carregar();
  }

  function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function vistaLabel(v) { return v ? (v.nome ? `${v.numero} — ${v.nome}` : `Vista ${v.numero}`) : '—'; }
  function vistasOrdenadas() { return [...vistas].sort((a, b) => (a.numero || 0) - (b.numero || 0)); }

  // ══════════════════════════════════════════
  // RENDER PRINCIPAL
  // ══════════════════════════════════════════
  function renderizar() {
    const c = document.getElementById('sg-content');
    if (!c) return;
    const mlTotal = chumbadores.reduce((s, c) => s + SG.num(c.comprimento), 0);
    const verticais = chumbadores.filter(c => c.tipo === 'Vertical').length;
    const horizontais = chumbadores.filter(c => c.tipo === 'Horizontal').length;

    c.innerHTML = `
      <div class="cc-view">
      <div class="page-header">
        <div>
          <h2>⛏️ Levantamento de Solo Grampeado</h2>
          <span class="subtitulo">Vistas e chumbadores (grampos/ancoragens) — cadastro e quantitativo</span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-secundario btn-sm" onclick="SG_UI.abrirVistas()">◈ Vistas</button>
          <button class="btn btn-secundario btn-sm" onclick="SG_UI.abrirImportar()">⊞ Importar Lote</button>
          <button class="btn btn-primario btn-sm" onclick="SG_UI.abrirNovoChumbador()">+ Novo Chumbador</button>
        </div>
      </div>

      <div class="cc-kpiGrid" style="grid-template-columns:repeat(4,1fr);">
        <div class="cc-kpi"><div class="cc-kpiIcon">⛏️</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Chumbadores</div><div class="cc-kpiValue">${chumbadores.length}</div><div class="cc-kpiSub">${verticais} vert. · ${horizontais} horiz.</div></div></div>
        <div class="cc-kpi cc-kpiBlue"><div class="cc-kpiIcon">📏</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Metros Lineares Previstos</div><div class="cc-kpiValue">${SG.fmt1(mlTotal)}<span class="cc-kpiUnit">ml</span></div></div></div>
        <div class="cc-kpi"><div class="cc-kpiIcon">◈</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Vistas cadastradas</div><div class="cc-kpiValue">${vistas.length}</div></div></div>
        <div class="cc-kpi"><div class="cc-kpiIcon">✅</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Execução</div><div class="cc-kpiValue" style="font-size:14px;">Ver em Controle</div></div></div>
      </div>

      <div class="cc-panel">
        <div class="cc-panelTitle">⛏️ Chumbadores</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
          <input type="text" class="form-control" id="sg-busca" placeholder="🔍 Buscar por nº..." style="flex:1;min-width:140px;" value="${esc(fBusca)}" oninput="SG_UI.onFiltro()">
          <select class="form-control" id="sg-f-vista" style="max-width:180px;" onchange="SG_UI.onFiltro()">
            <option value="todas">Todas as vistas</option>
            ${vistasOrdenadas().map(v => `<option value="${v.id}" ${fVista === v.id ? 'selected' : ''}>${esc(vistaLabel(v))}</option>`).join('')}
          </select>
          <select class="form-control" id="sg-f-tipo" style="max-width:150px;" onchange="SG_UI.onFiltro()">
            <option value="todos">Todos os tipos</option>
            ${SG.TIPOS_CHUMBADOR.map(t => `<option value="${t}" ${fTipo === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <div id="sg-tabela-chumbadores"></div>
      </div>
      </div>
    `;
    renderTabelaChumbadores();
  }

  function onFiltro() {
    fBusca = document.getElementById('sg-busca').value;
    fVista = document.getElementById('sg-f-vista').value;
    fTipo = document.getElementById('sg-f-tipo').value;
    renderTabelaChumbadores();
  }

  // ── Tabela de chumbadores (spec, sem status de execução) ──
  function renderTabelaChumbadores() {
    const el = document.getElementById('sg-tabela-chumbadores');
    if (!el) return;
    const busca = fBusca.toLowerCase();
    const lista = chumbadores.filter(c => {
      if (fVista !== 'todas' && c.vista !== fVista) return false;
      if (fTipo !== 'todos' && c.tipo !== fTipo) return false;
      if (busca && !String(c.numero).toLowerCase().includes(busca)) return false;
      return true;
    }).sort((a, b) => (a.numero || 0) - (b.numero || 0));

    if (!lista.length) {
      el.innerHTML = `<div class="cc-empty">⛏️<br>Nenhum chumbador cadastrado. Adicione um ou importe em lote.</div>`;
      return;
    }
    const mlFiltro = lista.reduce((s, c) => s + SG.num(c.comprimento), 0);
    el.innerHTML = `
      <div class="cc-tableWrap" style="max-height:480px;overflow-y:auto;">
      <table class="cc-table">
        <thead><tr><th>Nº</th><th>Vista</th><th>Tipo</th><th class="col-num">Comp. (ml)</th><th class="col-acoes"></th></tr></thead>
        <tbody>
          ${lista.map(c => {
            const v = vistas.find(x => x.id === c.vista);
            return `<tr>
              <td style="font-weight:600;">${esc(c.numero)}</td>
              <td>${esc(v ? vistaLabel(v) : '—')}</td>
              <td>${esc(c.tipo)}</td>
              <td class="col-num cc-tdMono">${SG.fmt1(c.comprimento)}</td>
              <td class="col-acoes">
                <button class="btn btn-secundario btn-sm" onclick="SG_UI.abrirEditarChumbador('${c.id}')">✎</button>
                <button class="btn btn-secundario btn-sm" style="color:var(--cv-red);" onclick="SG_UI.excluirChumbador('${c.id}')">🗑</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot><tr><td colspan="3" style="font-weight:700;">${lista.length} chumbador${lista.length !== 1 ? 'es' : ''}</td><td class="col-num cc-tdMono" style="font-weight:700;">${SG.fmt1(mlFiltro)}</td><td></td></tr></tfoot>
      </table>
      </div>`;
  }

  // ══════════════════════════════════════════
  // CRUD DE VISTAS
  // ══════════════════════════════════════════
  function abrirVistas() {
    renderVistas();
    Utils.abrirModal('modal-sg-vistas');
  }

  function renderVistas() {
    const el = document.getElementById('sg-vistas-body');
    if (!el) return;
    el.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <input type="text" id="sg-vista-numero" class="form-control" placeholder="Número (ex: 1)" style="max-width:120px;">
        <input type="text" id="sg-vista-nome" class="form-control" placeholder="Nome (opcional, ex: Face Norte)" style="flex:1;">
        <button class="btn btn-primario btn-sm" onclick="SG_UI.salvarVista()">+ Adicionar</button>
      </div>
      ${!vistas.length ? `<div class="cc-empty">Nenhuma vista cadastrada ainda.</div>` : `
      <div class="cc-tableWrap">
        <table class="cc-table">
          <thead><tr><th>Nº</th><th>Nome</th><th class="col-centro">Chumbadores</th><th class="col-acoes"></th></tr></thead>
          <tbody>
            ${vistasOrdenadas().map(v => `
              <tr>
                <td class="cc-tdAccent" style="font-weight:700;">${esc(v.numero)}</td>
                <td>${esc(v.nome || '—')}</td>
                <td class="col-centro">${chumbadores.filter(c => c.vista === v.id).length}</td>
                <td class="col-acoes"><button class="btn btn-secundario btn-sm" style="color:var(--cv-red);" onclick="SG_UI.excluirVista('${v.id}')">🗑</button></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`}`;
  }

  async function salvarVista() {
    const numero = document.getElementById('sg-vista-numero').value.trim();
    const nome = document.getElementById('sg-vista-nome').value.trim();
    if (!numero) { Utils.toast('Informe o número da vista.', 'alerta'); return; }
    Utils.mostrarLoading();
    try {
      await Database.criar(obraId, COL_VISTAS, { numero: parseInt(numero) || numero, nome }, SG.genId('v'));
      await carregar();
      renderVistas();
      Utils.toast('✓ Vista adicionada!', 'sucesso');
    } catch (e) {
      Utils.toast('Erro: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  async function excluirVista(id) {
    const v = vistas.find(x => x.id === id);
    if (!v) return;
    const emUso = chumbadores.filter(c => c.vista === id).length;
    if (emUso > 0) {
      const ok = await Utils.confirmar(`Esta vista tem ${emUso} chumbador(es) vinculado(s). Excluir mesmo assim? Os chumbadores continuarão existindo, apenas sem vista.`);
      if (!ok) return;
    } else {
      const ok = await Utils.confirmar(`Excluir a vista "${vistaLabel(v)}"?`);
      if (!ok) return;
    }
    Utils.mostrarLoading();
    try {
      await Database.deletar(obraId, COL_VISTAS, id);
      await carregar();
      renderVistas();
    } catch (e) {
      Utils.toast('Erro ao excluir: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ══════════════════════════════════════════
  // CRUD DE CHUMBADORES (spec — sem datas de execução)
  // ══════════════════════════════════════════
  function optVistas(sel) {
    return `<option value="">— sem vista —</option>` + vistasOrdenadas().map(v =>
      `<option value="${v.id}" ${v.id === sel ? 'selected' : ''}>${esc(vistaLabel(v))}</option>`).join('');
  }

  function abrirNovoChumbador() {
    chumbEditId = null;
    document.getElementById('sg-modal-chumb-titulo').textContent = '⛏️ Novo Chumbador';
    const f = document.getElementById('form-sg-chumbador');
    f.reset();
    f.querySelector('[name=vista]').innerHTML = optVistas('');
    f.querySelector('[name=tipo]').innerHTML = SG.TIPOS_CHUMBADOR.map(t => `<option value="${t}">${t}</option>`).join('');
    Utils.abrirModal('modal-sg-chumbador');
  }

  function abrirEditarChumbador(id) {
    const c = chumbadores.find(x => x.id === id);
    if (!c) return;
    chumbEditId = id;
    document.getElementById('sg-modal-chumb-titulo').textContent = `✎ Editando Chumbador ${c.numero}`;
    const f = document.getElementById('form-sg-chumbador');
    f.querySelector('[name=vista]').innerHTML = optVistas(c.vista || '');
    f.querySelector('[name=tipo]').innerHTML = SG.TIPOS_CHUMBADOR.map(t => `<option value="${t}" ${t === c.tipo ? 'selected' : ''}>${t}</option>`).join('');
    f.querySelector('[name=numero]').value = c.numero ?? '';
    f.querySelector('[name=comprimento]').value = c.comprimento ?? '';
    Utils.abrirModal('modal-sg-chumbador');
  }

  async function salvarChumbador() {
    const f = document.getElementById('form-sg-chumbador');
    const numero = f.querySelector('[name=numero]').value.trim();
    const vista = f.querySelector('[name=vista]').value;
    const tipo = f.querySelector('[name=tipo]').value;
    const comprimento = SG.num(f.querySelector('[name=comprimento]').value);
    if (!numero || !(comprimento > 0)) {
      Utils.toast('Preencha o número e o comprimento (maior que zero).', 'alerta');
      return;
    }
    Utils.mostrarLoading();
    try {
      const data = { numero, vista, tipo, comprimento };
      if (chumbEditId) {
        await Database.atualizar(obraId, COL_CHUMBADORES, chumbEditId, data);
        Utils.toast(`✓ Chumbador ${numero} atualizado!`, 'sucesso');
      } else {
        await Database.criar(obraId, COL_CHUMBADORES, data, SG.genId('ch'));
        Utils.toast(`✓ Chumbador ${numero} adicionado!`, 'sucesso');
      }
      Utils.fecharModal('modal-sg-chumbador');
      await carregar();
    } catch (e) {
      Utils.toast('Erro ao salvar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  async function excluirChumbador(id) {
    const c = chumbadores.find(x => x.id === id);
    if (!c) return;
    const ok = await Utils.confirmar(`Excluir o chumbador ${c.numero}? Isso também remove o histórico de execução dele em Controle.`);
    if (!ok) return;
    Utils.mostrarLoading();
    try {
      const ops = [{ type: 'delete', ref: Database.ref(obraId, COL_CHUMBADORES).doc(id) }];
      // Remove também a execução vinculada (Controle), se existir
      const execSnap = await db.collection('obras').doc(obraId).collection('sgExecucoes').where('chumbadorId', '==', id).get();
      execSnap.forEach(doc => ops.push({ type: 'delete', ref: doc.ref }));
      await Database.batchWrite(ops);
      Utils.toast('Chumbador excluído.', 'sucesso');
      await carregar();
    } catch (e) {
      Utils.toast('Erro ao excluir: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ══════════════════════════════════════════
  // IMPORTAÇÃO EM LOTE (chumbadores)
  // ══════════════════════════════════════════
  function abrirImportar() {
    previewImport = [];
    document.getElementById('sg-import-texto').value = '';
    document.getElementById('sg-import-preview').innerHTML = '';
    document.getElementById('sg-import-erro').style.display = 'none';
    document.getElementById('sg-import-btn').disabled = true;
    Utils.abrirModal('modal-sg-importar');
  }

  function baixarModeloTSV() {
    const header = 'Numero\tVista\tTipo\tComprimento (ml)\n';
    const exemplo = '1\t1\tVertical\t5\n2\t1\tVertical\t5\n3\t2\tHorizontal\t6';
    const blob = new Blob([header + exemplo], { type: 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'modelo_chumbadores.tsv'; a.click();
    URL.revokeObjectURL(url);
  }

  function parsearImport(txt) {
    const erroEl = document.getElementById('sg-import-erro');
    erroEl.style.display = 'none';
    const linhas = String(txt || '').trim().split(/\r?\n/).filter(l => l.trim());
    const itens = [];
    linhas.forEach((linha, i) => {
      if (i === 0 && linha.toLowerCase().includes('numero')) return;
      const cols = linha.split('\t').map(c => c.trim());
      const numero = cols[0], vistaNum = cols[1], tipo = cols[2], compRaw = cols[3];
      if (!numero) return;
      const comp = parseFloat((compRaw || '').replace(',', '.'));
      if (isNaN(comp) || comp <= 0) return;
      const tipoNorm = /horiz/i.test(tipo || '') ? 'Horizontal' : 'Vertical';
      itens.push({ numero, vistaNum, tipo: tipoNorm, comprimento: comp });
    });
    previewImport = itens;
    renderPreviewImport();
    if (!itens.length && linhas.length) {
      erroEl.textContent = 'Nenhuma linha válida encontrada. Verifique o formato (colunas separadas por TAB).';
      erroEl.style.display = 'block';
    }
  }

  function renderPreviewImport() {
    const el = document.getElementById('sg-import-preview');
    const btn = document.getElementById('sg-import-btn');
    btn.disabled = !previewImport.length;
    btn.textContent = previewImport.length ? `✓ Importar ${previewImport.length} chumbadores` : '✓ Importar';
    if (!previewImport.length) { el.innerHTML = ''; return; }
    el.innerHTML = `
      <div class="cc-tableWrap" style="max-height:220px;overflow-y:auto;margin-top:10px;">
        <table class="cc-table">
          <thead><tr><th>#</th><th>Nº</th><th>Vista</th><th>Tipo</th><th class="col-num">ml</th></tr></thead>
          <tbody>${previewImport.map((p, i) => `
            <tr><td>${i + 1}</td><td>${esc(p.numero)}</td><td>${esc(p.vistaNum)}</td><td>${esc(p.tipo)}</td><td class="col-num cc-tdMono">${SG.fmt1(p.comprimento)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function onImportTexto() { parsearImport(document.getElementById('sg-import-texto').value); }

  function onImportArquivo(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => parsearImport(e.target.result);
    reader.readAsText(file, 'UTF-8');
    input.value = '';
  }

  async function salvarImport() {
    if (!previewImport.length) return;
    Utils.mostrarLoading();
    try {
      // Cria vistas ausentes automaticamente
      const vistasExistentes = new Map(vistas.map(v => [String(v.numero), v.id]));
      const novasVistas = [...new Set(previewImport.map(p => p.vistaNum).filter(Boolean))]
        .filter(vn => !vistasExistentes.has(String(vn)));
      for (const vn of novasVistas) {
        const ref = Database.ref(obraId, COL_VISTAS).doc(SG.genId('v'));
        await Database.batchWrite([{ type: 'set', ref, data: { numero: parseInt(vn) || vn, nome: '', obraId } }]);
        vistasExistentes.set(String(vn), ref.id);
      }
      const ops = previewImport.map(p => ({
        type: 'set',
        ref: Database.ref(obraId, COL_CHUMBADORES).doc(SG.genId('ch')),
        data: {
          numero: p.numero, tipo: p.tipo, comprimento: p.comprimento,
          vista: vistasExistentes.get(String(p.vistaNum)) || '',
          obraId,
        },
      }));
      for (let i = 0; i < ops.length; i += 400) {
        await Database.batchWrite(ops.slice(i, i + 400));
      }
      Utils.toast(`✓ ${previewImport.length} chumbadores importados!`, 'sucesso');
      previewImport = [];
      Utils.fecharModal('modal-sg-importar');
      await carregar();
    } catch (e) {
      Utils.toast('Erro ao importar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  return {
    init, recarregar, renderizar, onFiltro,
    abrirVistas, salvarVista, excluirVista,
    abrirNovoChumbador, abrirEditarChumbador, salvarChumbador, excluirChumbador,
    abrirImportar, baixarModeloTSV, onImportTexto, onImportArquivo, salvarImport,
  };
})();

const SG_UI = LevantamentoSoloGrampeado;

function onObraChanged() {
  LevantamentoSoloGrampeado.recarregar();
}

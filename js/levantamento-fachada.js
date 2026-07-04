// ============================================
// Módulo: Levantamento de Fachada — COMPLETO
// Conforme Especificação Funcional Mestra Cap. Fachada (40 seções)
// Hierarquia: Obra → Fachada → Conjunto → Balancim → Vista → Peça
// ============================================

const LevantamentoFachada = (() => {
  let obraId = null;
  // Dados carregados
  let fachadas = [], conjuntos = [], balancins = [], vistas = [], pecas = [], tarefas = [];
  // Seleção na árvore
  let sel = { fachadaId: null, conjuntoId: null, balancimId: null, vistaId: null };
  let editandoId = null;
  let editandoTipo = null;

  // ===================== INIT =====================
  async function init() {
    const ok = await Utils.initPagina({ requireObra: true });
    if (!ok) return;
    obraId = Router.getObraId();
    if (!obraId) {
      _msg('fachada-main', '🏢', 'Selecione uma obra na barra lateral.');
      return;
    }
    _bindGlobal();
    await carregarTudo();
  }

  function _bindGlobal() {
    document.addEventListener('keydown', e => { if (e.key === 'Escape') Utils.fecharTodosModais(); });
  }

  // ===================== CARREGAR =====================
  async function carregarTudo() {
    try {
      Utils.mostrarLoading('Carregando fachada...');
      const [_fach, _conj, _bal, _vis, _pec, _tar] = await Promise.all([
        Database.query(obraId, 'levFachada', [{ field: 'tipo', op: '==', value: 'fachada' }]),
        Database.query(obraId, 'levFachada', [{ field: 'tipo', op: '==', value: 'conjunto' }]),
        Database.query(obraId, 'levFachada', [{ field: 'tipo', op: '==', value: 'balancim' }]),
        Database.query(obraId, 'levFachada', [{ field: 'tipo', op: '==', value: 'vista' }]),
        Database.query(obraId, 'levFachada', [{ field: 'tipo', op: '==', value: 'peca' }]),
        Database.listar(obraId, 'tarefas', 'nome')
      ]);
      fachadas = _fach; conjuntos = _conj; balancins = _bal; vistas = _vis; pecas = _pec; tarefas = _tar;
      renderArvore();
      renderPainel();
    } catch (e) {
      console.error('Erro:', e);
      // Fallback: tenta subcoleção antiga
      try {
        const dados = await Database.listar(obraId, 'levantamentosFachada', 'createdAt');
        fachadas = dados.filter(d => d.tipo === 'fachada');
        conjuntos = dados.filter(d => d.tipo === 'conjunto');
        balancins = dados.filter(d => d.tipo === 'balancim');
        vistas = dados.filter(d => d.tipo === 'vista');
        pecas = dados.filter(d => d.tipo === 'peca');
        tarefas = [];
        try { tarefas = await Database.listar(obraId, 'tarefas', 'nome'); } catch(e2){}
        renderArvore();
        renderPainel();
      } catch (e2) {
        console.error('Fallback erro:', e2);
        Utils.toast('Erro ao carregar dados.', 'erro');
      }
    } finally {
      Utils.esconderLoading();
    }
  }

  function _col() { return 'levFachada'; }

  // ===================== ÁRVORE HIERÁRQUICA =====================
  function renderArvore() {
    const c = document.getElementById('fachada-tree-body');
    if (!c) return;
    if (fachadas.length === 0) {
      c.innerHTML = `<div class="estado-vazio" style="padding:20px 12px;">
        <p class="text-sm">Nenhuma fachada.</p>
        <button class="btn btn-primario btn-sm mt-1" onclick="LF.novoItem('fachada')">+ Fachada</button></div>`;
      return;
    }
    let h = '';
    fachadas.forEach(f => {
      const fSel = sel.fachadaId === f.id;
      const fConjs = conjuntos.filter(x => x.fachadaId === f.id);
      const fPecas = pecas.filter(x => x.fachadaId === f.id);
      h += _treeItem(f.id, 'fachada', '🏢', f.nome, fPecas.length, fSel && !sel.conjuntoId, fConjs.length > 0);

      if (fSel) {
        h += '<div class="tree-children">';
        fConjs.forEach(cj => {
          const cSel = sel.conjuntoId === cj.id;
          const cBals = balancins.filter(x => x.conjuntoId === cj.id);
          h += _treeItem(cj.id, 'conjunto', '📦', cj.nome, cBals.length, cSel && !sel.balancimId, cBals.length > 0);

          if (cSel) {
            h += '<div class="tree-children">';
            cBals.forEach(bl => {
              const bSel = sel.balancimId === bl.id;
              const bVistas = vistas.filter(x => x.balancimId === bl.id);
              const bPecas = pecas.filter(x => x.balancimId === bl.id);
              h += _treeItem(bl.id, 'balancim', '🪜', bl.nome || bl.codigo || 'Balancim', bPecas.length, bSel && !sel.vistaId, bVistas.length > 0);

              if (bSel) {
                h += '<div class="tree-children">';
                // Se não tem vistas criadas, mostrar opções padrão
                if (bVistas.length === 0) {
                  h += `<div class="tree-item" style="opacity:0.5;font-size:0.75rem;padding-left:20px;">
                    <span class="tree-label">Crie uma vista para cadastrar peças</span></div>`;
                }
                bVistas.forEach(vi => {
                  const vSel = sel.vistaId === vi.id;
                  const vPecas = pecas.filter(x => x.vistaId === vi.id);
                  const icon = vi.tipoVista === 'externa' ? '🔵' : vi.tipoVista === 'interna' ? '🟡' : '⚪';
                  h += _treeItem(vi.id, 'vista', icon, vi.nome || (vi.tipoVista === 'externa' ? 'Vista Externa' : 'Vista Interna'), vPecas.length, vSel, false);
                });
                h += '</div>';
              }
            });
            h += '</div>';
          }
        });
        h += '</div>';
      }
    });
    c.innerHTML = h;
  }

  function _treeItem(id, tipo, icon, label, badge, ativo, hasChildren) {
    return `<div class="tree-item ${ativo ? 'ativo' : ''}" onclick="LF.selecionar('${tipo}','${id}')">
      <span class="tree-toggle">${hasChildren ? '▾' : (tipo === 'vista' ? '' : '▸')}</span>
      <span class="tree-icon">${icon}</span>
      <span class="tree-label">${label}</span>
      ${badge > 0 ? `<span class="tree-badge">${badge}</span>` : ''}
    </div>`;
  }

  // ===================== SELEÇÃO =====================
  function selecionar(tipo, id) {
    if (tipo === 'fachada') {
      sel = { fachadaId: id, conjuntoId: null, balancimId: null, vistaId: null };
    } else if (tipo === 'conjunto') {
      const cj = conjuntos.find(x => x.id === id);
      sel.fachadaId = cj?.fachadaId || sel.fachadaId;
      sel.conjuntoId = id; sel.balancimId = null; sel.vistaId = null;
    } else if (tipo === 'balancim') {
      const bl = balancins.find(x => x.id === id);
      const cj = conjuntos.find(x => x.id === bl?.conjuntoId);
      sel.fachadaId = cj?.fachadaId || sel.fachadaId;
      sel.conjuntoId = bl?.conjuntoId || sel.conjuntoId;
      sel.balancimId = id; sel.vistaId = null;
    } else if (tipo === 'vista') {
      const vi = vistas.find(x => x.id === id);
      const bl = balancins.find(x => x.id === vi?.balancimId);
      const cj = conjuntos.find(x => x.id === bl?.conjuntoId);
      sel.fachadaId = cj?.fachadaId || sel.fachadaId;
      sel.conjuntoId = bl?.conjuntoId || sel.conjuntoId;
      sel.balancimId = vi?.balancimId || sel.balancimId;
      sel.vistaId = id;
    }
    renderArvore();
    renderPainel();
  }

  // ===================== PAINEL PRINCIPAL =====================
  function renderPainel() {
    const p = document.getElementById('fachada-painel');
    if (!p) return;
    if (!sel.fachadaId) return renderResumoGeral(p);
    if (sel.vistaId) return renderPecas(p);
    if (sel.balancimId) return renderResumoBalancim(p);
    if (sel.conjuntoId) return renderResumoConjunto(p);
    renderResumoFachada(p);
  }

  // ===================== RESUMO GERAL =====================
  function renderResumoGeral(p) {
    const tot = _somarPecas(pecas);
    let rows = '';
    fachadas.forEach(f => {
      const t = _somarPecas(pecas.filter(x => x.fachadaId === f.id));
      const nConj = conjuntos.filter(x => x.fachadaId === f.id).length;
      const nPec = pecas.filter(x => x.fachadaId === f.id).length;
      const statusBadge = _statusBadge(f.status);
      rows += `<tr>
        <td><a href="#" onclick="LF.selecionar('fachada','${f.id}');return false;">${f.nome}</a></td>
        <td class="col-centro">${statusBadge}</td>
        <td class="col-num">${nConj}</td><td class="col-num">${nPec}</td>
        <td class="col-num">${_fn(t.areaBruta)}</td><td class="col-num">${_fn(t.areaJanela)}</td>
        <td class="col-num">${_fn(t.areaLiquida)}</td><td class="col-num">${_fn(t.metroLinear)}</td>
        <td class="col-num">${_fn(t.vaoCompleto)}</td>
        <td class="col-acoes">
          <button class="btn btn-secundario btn-sm" onclick="LF.editarItem('fachada','${f.id}')">✎</button>
          <button class="btn btn-sm btn-icon" title="Duplicar" onclick="LF.duplicarItem('fachada','${f.id}')">⧉</button>
          <button class="btn btn-perigo btn-sm btn-icon" onclick="LF.excluirItem('fachada','${f.id}')">✕</button>
        </td>
      </tr>`;
    });
    p.innerHTML = `
      <div class="page-header">
        <div><h2>Resumo Geral — Levantamento de Fachada</h2>
        <span class="subtitulo">${fachadas.length} fachada(s) · ${pecas.length} peça(s)</span></div>
        <div class="btn-grupo">
          <button class="btn btn-secundario btn-sm" onclick="LF.exportarResumo()">📥 Exportar</button>
          <button class="btn btn-primario" onclick="LF.novoItem('fachada')">+ Nova Fachada</button>
        </div>
      </div>
      ${_infoCards(tot)}
      <div class="tabela-container mt-2"><table class="tabela">
        <thead><tr><th>Fachada</th><th class="col-centro">Status</th><th class="col-num">Conj.</th><th class="col-num">Peças</th>
        <th class="col-num">m² Bruto</th><th class="col-num">m² Janela</th><th class="col-num">m² Líquido</th>
        <th class="col-num">ML</th><th class="col-num">Vão Comp.</th><th class="col-acoes">Ações</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="10" class="text-center text-muted">Nenhuma fachada cadastrada.</td></tr>'}</tbody>
        <tfoot><tr><td><strong>TOTAL GERAL</strong></td><td></td><td class="col-num">${conjuntos.length}</td><td class="col-num">${pecas.length}</td>
        <td class="col-num">${_fn(tot.areaBruta)}</td><td class="col-num">${_fn(tot.areaJanela)}</td>
        <td class="col-num">${_fn(tot.areaLiquida)}</td><td class="col-num">${_fn(tot.metroLinear)}</td>
        <td class="col-num">${_fn(tot.vaoCompleto)}</td><td></td></tr></tfoot>
      </table></div>`;
  }

  // ===================== RESUMO FACHADA =====================
  function renderResumoFachada(p) {
    const f = fachadas.find(x => x.id === sel.fachadaId);
    if (!f) return;
    const fConjs = conjuntos.filter(x => x.fachadaId === f.id);
    const fPecas = pecas.filter(x => x.fachadaId === f.id);
    const tot = _somarPecas(fPecas);
    // Totais interna vs externa
    const fVistas = vistas.filter(v => fPecas.some(pc => pc.vistaId === v.id));
    const pecasExt = fPecas.filter(pc => { const v = vistas.find(x => x.id === pc.vistaId); return v && v.tipoVista === 'externa'; });
    const pecasInt = fPecas.filter(pc => { const v = vistas.find(x => x.id === pc.vistaId); return v && v.tipoVista === 'interna'; });
    const totExt = _somarPecas(pecasExt);
    const totInt = _somarPecas(pecasInt);

    let rows = '';
    fConjs.forEach(cj => {
      const tc = _somarPecas(pecas.filter(x => {
        const bl = balancins.find(b => b.id === x.balancimId);
        return bl && bl.conjuntoId === cj.id;
      }));
      const nBal = balancins.filter(b => b.conjuntoId === cj.id).length;
      rows += `<tr>
        <td><a href="#" onclick="LF.selecionar('conjunto','${cj.id}');return false;">${cj.nome}</a></td>
        <td class="col-num">${nBal}</td>
        <td class="col-num">${_fn(tc.areaBruta)}</td><td class="col-num">${_fn(tc.areaLiquida)}</td>
        <td class="col-num">${_fn(tc.metroLinear)}</td><td class="col-num">${_fn(tc.vaoCompleto)}</td>
        <td class="col-acoes">
          <button class="btn btn-secundario btn-sm" onclick="LF.editarItem('conjunto','${cj.id}')">✎</button>
          <button class="btn btn-sm btn-icon" title="Duplicar" onclick="LF.duplicarItem('conjunto','${cj.id}')">⧉</button>
          <button class="btn btn-perigo btn-sm btn-icon" onclick="LF.excluirItem('conjunto','${cj.id}')">✕</button>
        </td>
      </tr>`;
    });

    p.innerHTML = `
      <div class="page-header">
        <div><h2>🏢 ${f.nome}</h2><span class="subtitulo">${fConjs.length} conjunto(s) · ${fPecas.length} peça(s) · ${_statusBadge(f.status)}</span></div>
        <div class="btn-grupo">
          <button class="btn btn-secundario btn-sm" onclick="LF.editarItem('fachada','${f.id}')">✎ Editar</button>
          <button class="btn btn-primario btn-sm" onclick="LF.novoItem('conjunto','${f.id}')">+ Conjunto</button>
        </div>
      </div>
      ${_infoCards(tot)}
      <div class="resumo-grid mt-2">
        <div class="resumo-card"><div class="resumo-label">🔵 Vista Externa</div><div class="resumo-valor">${_fn(totExt.areaLiquida)}</div><div class="resumo-unidade">m² líquido</div></div>
        <div class="resumo-card"><div class="resumo-label">🟡 Vista Interna</div><div class="resumo-valor">${_fn(totInt.areaLiquida)}</div><div class="resumo-unidade">m² líquido</div></div>
        <div class="resumo-card"><div class="resumo-label">Total ML</div><div class="resumo-valor">${_fn(tot.metroLinear)}</div><div class="resumo-unidade">metros</div></div>
        <div class="resumo-card"><div class="resumo-label">Vão Completo</div><div class="resumo-valor">${_fn(tot.vaoCompleto)}</div><div class="resumo-unidade">m²</div></div>
      </div>
      <div class="tabela-container mt-2"><table class="tabela">
        <thead><tr><th>Conjunto</th><th class="col-num">Balancins</th>
        <th class="col-num">m² Bruto</th><th class="col-num">m² Líquido</th><th class="col-num">ML</th><th class="col-num">Vão</th><th class="col-acoes">Ações</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="7" class="text-center text-muted">Nenhum conjunto.</td></tr>'}</tbody>
      </table></div>`;
  }

  // ===================== RESUMO CONJUNTO =====================
  function renderResumoConjunto(p) {
    const cj = conjuntos.find(x => x.id === sel.conjuntoId);
    if (!cj) return;
    const cBals = balancins.filter(x => x.conjuntoId === cj.id);
    const cPecas = pecas.filter(x => cBals.some(b => b.id === x.balancimId));
    const tot = _somarPecas(cPecas);

    let rows = '';
    cBals.forEach(bl => {
      const bPecas = pecas.filter(x => x.balancimId === bl.id);
      const tb = _somarPecas(bPecas);
      const bVistas = vistas.filter(v => v.balancimId === bl.id);
      rows += `<tr>
        <td><a href="#" onclick="LF.selecionar('balancim','${bl.id}');return false;">${bl.nome || bl.codigo || 'Balancim'}</a></td>
        <td class="col-num">${bVistas.length}</td><td class="col-num">${bPecas.length}</td>
        <td class="col-num">${_fn(tb.areaBruta)}</td><td class="col-num">${_fn(tb.areaLiquida)}</td>
        <td class="col-num">${_fn(tb.metroLinear)}</td><td class="col-num">${_fn(tb.vaoCompleto)}</td>
        <td class="col-acoes">
          <button class="btn btn-secundario btn-sm" onclick="LF.editarItem('balancim','${bl.id}')">✎</button>
          <button class="btn btn-sm btn-icon" title="Duplicar balancim + peças" onclick="LF.duplicarBalancim('${bl.id}')">⧉</button>
          <button class="btn btn-perigo btn-sm btn-icon" onclick="LF.excluirItem('balancim','${bl.id}')">✕</button>
        </td>
      </tr>`;
    });

    p.innerHTML = `
      <div class="page-header">
        <div><h2>📦 ${cj.nome}</h2><span class="subtitulo">${cBals.length} balancim(ns) · ${cPecas.length} peça(s)</span></div>
        <div class="btn-grupo">
          <button class="btn btn-secundario btn-sm" onclick="LF.editarItem('conjunto','${cj.id}')">✎ Editar</button>
          <button class="btn btn-primario btn-sm" onclick="LF.novoItem('balancim','${cj.id}')">+ Balancim</button>
        </div>
      </div>
      ${_infoCards(tot)}
      <div class="tabela-container mt-2"><table class="tabela">
        <thead><tr><th>Balancim</th><th class="col-num">Vistas</th><th class="col-num">Peças</th>
        <th class="col-num">m² Bruto</th><th class="col-num">m² Líquido</th><th class="col-num">ML</th><th class="col-num">Vão</th><th class="col-acoes">Ações</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="8" class="text-center text-muted">Nenhum balancim.</td></tr>'}</tbody>
        <tfoot><tr><td><strong>Total</strong></td><td></td><td class="col-num">${cPecas.length}</td>
        <td class="col-num">${_fn(tot.areaBruta)}</td><td class="col-num">${_fn(tot.areaLiquida)}</td>
        <td class="col-num">${_fn(tot.metroLinear)}</td><td class="col-num">${_fn(tot.vaoCompleto)}</td><td></td></tr></tfoot>
      </table></div>`;
  }

  // ===================== RESUMO BALANCIM =====================
  function renderResumoBalancim(p) {
    const bl = balancins.find(x => x.id === sel.balancimId);
    if (!bl) return;
    const bVistas = vistas.filter(x => x.balancimId === bl.id);
    const bPecas = pecas.filter(x => x.balancimId === bl.id);
    const tot = _somarPecas(bPecas);

    let vistaCards = '';
    bVistas.forEach(vi => {
      const vPecas = pecas.filter(x => x.vistaId === vi.id);
      const tv = _somarPecas(vPecas);
      const icon = vi.tipoVista === 'externa' ? '🔵' : vi.tipoVista === 'interna' ? '🟡' : '⚪';
      vistaCards += `<div class="resumo-card" style="cursor:pointer" onclick="LF.selecionar('vista','${vi.id}')">
        <div class="resumo-label">${icon} ${vi.nome || (vi.tipoVista === 'externa' ? 'Vista Externa' : 'Vista Interna')}</div>
        <div class="resumo-valor">${_fn(tv.areaLiquida)}</div>
        <div class="resumo-unidade">${vPecas.length} peça(s) · ${_fn(tv.metroLinear)} ML</div>
        <div style="margin-top:6px;">
          <button class="btn btn-secundario btn-sm" onclick="event.stopPropagation();LF.editarItem('vista','${vi.id}')">✎</button>
          <button class="btn btn-perigo btn-sm btn-icon" onclick="event.stopPropagation();LF.excluirItem('vista','${vi.id}')">✕</button>
        </div>
      </div>`;
    });

    p.innerHTML = `
      <div class="page-header">
        <div><h2>🪜 ${bl.nome || bl.codigo || 'Balancim'}</h2>
        <span class="subtitulo">${bVistas.length} vista(s) · ${bPecas.length} peça(s)</span></div>
        <div class="btn-grupo">
          <button class="btn btn-secundario btn-sm" onclick="LF.editarItem('balancim','${bl.id}')">✎ Editar</button>
          <button class="btn btn-sm btn-secundario" onclick="LF.duplicarBalancim('${bl.id}')">⧉ Duplicar</button>
          <button class="btn btn-primario btn-sm" onclick="LF.novoItem('vista','${bl.id}')">+ Vista</button>
        </div>
      </div>
      ${_infoCards(tot)}
      <div class="resumo-grid mt-2">${vistaCards || '<div class="estado-vazio" style="grid-column:1/-1;"><p>Nenhuma vista cadastrada. Crie uma Vista Externa ou Interna para começar.</p></div>'}</div>`;
  }

  // ===================== TABELA DE PEÇAS (vista selecionada) =====================
  function renderPecas(p) {
    const vi = vistas.find(x => x.id === sel.vistaId);
    if (!vi) return;
    const bl = balancins.find(x => x.id === vi.balancimId);
    const icon = vi.tipoVista === 'externa' ? '🔵' : '🟡';
    const vPecas = pecas.filter(x => x.vistaId === vi.id);

    let rows = '';
    let tBruto = 0, tJan = 0, tLiq = 0, tML = 0, tVao = 0;
    vPecas.forEach((pc, idx) => {
      const c = calcularPeca(pc);
      tBruto += c.areaBruta; tJan += c.areaJanela; tLiq += c.areaLiquida; tML += c.metroLinear; tVao += c.vaoCompleto;
      const confIcon = pc.conferido ? '✅' : '';
      const tarefaNome = pc.tarefaId ? (tarefas.find(t => t.id === pc.tarefaId)?.nome || '—') : '';
      const alertas = _validarPeca(pc, c);
      const alertaIcon = alertas.length > 0 ? `<span title="${alertas.join('; ')}" style="color:var(--cor-alerta);cursor:help;">⚠</span>` : '';

      rows += `<tr>
        <td>${idx + 1}</td>
        <td>${pc.nome || '—'} ${alertaIcon}</td>
        <td class="col-centro"><span class="badge badge-${_tipoMedicaoCor(pc.tipoMedicao)}">${_tipoMedicaoLabel(pc.tipoMedicao)}</span></td>
        <td class="col-num">${_fn(pc.comprimento)}</td>
        <td class="col-num">${_fn(pc.altura)}</td>
        <td class="col-num col-centro">${pc.quantidade || 1}</td>
        <td class="col-centro">${pc.possuiJanela ? '✓' : ''}</td>
        <td class="col-num">${_fn(c.areaBruta)}</td>
        <td class="col-num">${_fn(c.areaJanela)}</td>
        <td class="col-num" style="font-weight:600;color:var(--cor-primaria);">${_fn(c.areaLiquida)}</td>
        <td class="col-num">${_fn(c.metroLinear)}</td>
        <td class="col-num">${_fn(c.vaoCompleto)}</td>
        <td class="col-centro">${confIcon}</td>
        <td class="col-acoes" style="white-space:nowrap;">
          <button class="btn btn-secundario btn-sm" onclick="LF.editarPeca('${pc.id}')" title="Editar">✎</button>
          <button class="btn btn-sm btn-icon" onclick="LF.duplicarPeca('${pc.id}')" title="Duplicar">⧉</button>
          <button class="btn btn-sm btn-icon" onclick="LF.conferirPeca('${pc.id}')" title="${pc.conferido ? 'Desconferir' : 'Conferir'}">${pc.conferido ? '↩' : '✓'}</button>
          <button class="btn btn-perigo btn-sm btn-icon" onclick="LF.excluirPeca('${pc.id}')" title="Excluir">✕</button>
        </td>
      </tr>`;
    });

    p.innerHTML = `
      <div class="page-header">
        <div><h2>${icon} ${vi.nome || (vi.tipoVista === 'externa' ? 'Vista Externa' : 'Vista Interna')} — ${bl?.nome || 'Balancim'}</h2>
        <span class="subtitulo">${vPecas.length} peça(s)</span></div>
        <div class="btn-grupo">
          <button class="btn btn-secundario btn-sm" onclick="LF.exportarVista('${vi.id}')">📥 Exportar</button>
          <button class="btn btn-primario btn-sm" onclick="LF.novaPeca()">+ Nova Peça</button>
        </div>
      </div>
      <div class="fachada-info-bar">
        <div class="fachada-info-item"><div class="info-label">m² Bruto</div><div class="info-valor">${_fn(tBruto)}</div></div>
        <div class="fachada-info-item"><div class="info-label">m² Janelas</div><div class="info-valor">${_fn(tJan)}</div></div>
        <div class="fachada-info-item"><div class="info-label">m² Líquido</div><div class="info-valor destaque">${_fn(tLiq)}</div></div>
        <div class="fachada-info-item"><div class="info-label">Metro Linear</div><div class="info-valor">${_fn(tML)}</div></div>
        <div class="fachada-info-item"><div class="info-label">Vão Completo</div><div class="info-valor">${_fn(tVao)}</div></div>
      </div>
      <div class="tabela-container mt-2"><table class="tabela tabela-compacta">
        <thead><tr><th class="col-sm">#</th><th>Peça</th><th class="col-centro">Tipo</th>
        <th class="col-num">Comp</th><th class="col-num">Alt</th><th class="col-num col-centro">Qtd</th>
        <th class="col-centro">Jan</th><th class="col-num">m² Brut</th><th class="col-num">m² Jan</th>
        <th class="col-num">m² Líq</th><th class="col-num">ML</th><th class="col-num">Vão</th>
        <th class="col-centro">Conf</th><th class="col-acoes">Ações</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="14" class="text-center text-muted">Nenhuma peça. Clique em "+ Nova Peça".</td></tr>'}</tbody>
        <tfoot><tr><td></td><td><strong>TOTAL</strong></td><td></td><td></td><td></td><td></td><td></td>
        <td class="col-num">${_fn(tBruto)}</td><td class="col-num">${_fn(tJan)}</td>
        <td class="col-num">${_fn(tLiq)}</td><td class="col-num">${_fn(tML)}</td>
        <td class="col-num">${_fn(tVao)}</td><td></td><td></td></tr></tfoot>
      </table></div>`;
  }

  // ===================== CÁLCULOS (Spec seções 11-15) =====================
  function calcularPeca(pc) {
    const comp = _pn(pc.comprimento), alt = _pn(pc.altura), qtd = _pn(pc.quantidade) || 1;
    const tipo = pc.tipoMedicao || 'm2';
    let areaBruta = 0, areaJanela = 0, areaLiquida = 0, metroLinear = 0, vaoCompleto = 0;

    if (tipo === 'm2' || tipo === 'misto') {
      areaBruta = comp * alt * qtd;
      if (pc.possuiJanela) {
        areaJanela = _pn(pc.larguraJanela) * _pn(pc.alturaJanela) * (_pn(pc.quantidadeJanelas) || 1) * qtd;
      }
      areaLiquida = areaBruta - areaJanela;
      if (areaLiquida < 0) areaLiquida = 0;
    }
    if (tipo === 'ml' || tipo === 'misto' || (alt > 0 && alt < 0.5 && tipo === 'm2')) {
      metroLinear = comp * qtd;
      if (tipo === 'ml') { areaBruta = 0; areaJanela = 0; areaLiquida = 0; }
    }
    if (tipo === 'vao_completo') {
      vaoCompleto = comp * alt * qtd;
    }
    return { areaBruta, areaJanela, areaLiquida, metroLinear, vaoCompleto };
  }

  function _somarPecas(lista) {
    let areaBruta = 0, areaJanela = 0, areaLiquida = 0, metroLinear = 0, vaoCompleto = 0;
    lista.forEach(pc => {
      const c = calcularPeca(pc);
      areaBruta += c.areaBruta; areaJanela += c.areaJanela;
      areaLiquida += c.areaLiquida; metroLinear += c.metroLinear; vaoCompleto += c.vaoCompleto;
    });
    return { areaBruta, areaJanela, areaLiquida, metroLinear, vaoCompleto };
  }

  // ===================== VALIDAÇÕES (Spec seção 36) =====================
  function _validarPeca(pc, calc) {
    const alertas = [];
    if (!pc.nome) alertas.push('Sem nome');
    if (_pn(pc.comprimento) <= 0) alertas.push('Comprimento inválido');
    if (_pn(pc.altura) < 0) alertas.push('Altura negativa');
    if ((_pn(pc.quantidade) || 0) <= 0) alertas.push('Quantidade zero');
    if (calc && calc.areaLiquida < 0) alertas.push('Área líquida negativa');
    if (pc.possuiJanela && _pn(pc.larguraJanela) * _pn(pc.alturaJanela) > _pn(pc.comprimento) * _pn(pc.altura)) {
      alertas.push('Janela maior que peça');
    }
    return alertas;
  }

  // ===================== CRUD — ENTIDADES (fachada/conjunto/balancim/vista) =====================
  function novoItem(tipo, parentId) {
    editandoId = null; editandoTipo = tipo;
    const labels = { fachada: 'Nova Fachada', conjunto: 'Novo Conjunto de Balancins', balancim: 'Novo Balancim', vista: 'Nova Vista' };
    document.getElementById('modal-ent-titulo').textContent = labels[tipo] || 'Novo';
    document.getElementById('form-ent-tipo').value = tipo;
    document.getElementById('form-ent-id').value = '';
    document.getElementById('form-ent-parent').value = parentId || '';
    Utils.limparForm('form-entidade');
    // Campos de vista
    const campoVista = document.getElementById('campo-tipo-vista');
    const campoStatus = document.getElementById('campo-status-ent');
    const campoCodigo = document.getElementById('campo-codigo-ent');
    campoVista.classList.toggle('hidden', tipo !== 'vista');
    campoStatus.classList.toggle('hidden', tipo === 'vista');
    campoCodigo.classList.toggle('hidden', tipo === 'fachada');
    Utils.abrirModal('modal-entidade');
  }

  function editarItem(tipo, id) {
    const listas = { fachada: fachadas, conjunto: conjuntos, balancim: balancins, vista: vistas };
    const item = listas[tipo]?.find(x => x.id === id);
    if (!item) return;
    editandoId = id; editandoTipo = tipo;
    document.getElementById('modal-ent-titulo').textContent = `Editar ${tipo}`;
    document.getElementById('form-ent-tipo').value = tipo;
    document.getElementById('form-ent-id').value = id;
    document.getElementById('form-ent-parent').value = '';
    document.querySelector('#form-entidade [name="nome"]').value = item.nome || '';
    document.querySelector('#form-entidade [name="descricao"]').value = item.descricao || '';
    document.querySelector('#form-entidade [name="codigo"]').value = item.codigo || '';
    document.querySelector('#form-entidade [name="status"]').value = item.status || 'rascunho';
    if (tipo === 'vista') document.querySelector('#form-entidade [name="tipoVista"]').value = item.tipoVista || 'externa';
    const campoVista = document.getElementById('campo-tipo-vista');
    const campoStatus = document.getElementById('campo-status-ent');
    const campoCodigo = document.getElementById('campo-codigo-ent');
    campoVista.classList.toggle('hidden', tipo !== 'vista');
    campoStatus.classList.toggle('hidden', tipo === 'vista');
    campoCodigo.classList.toggle('hidden', tipo === 'fachada');
    Utils.abrirModal('modal-entidade');
  }

  async function salvarEntidade() {
    const tipo = document.getElementById('form-ent-tipo').value;
    const id = document.getElementById('form-ent-id').value;
    const parent = document.getElementById('form-ent-parent').value;
    const nome = document.querySelector('#form-entidade [name="nome"]').value.trim();
    if (!nome) { Utils.toast('Informe o nome.', 'alerta'); return; }
    const data = {
      tipo,
      nome,
      descricao: document.querySelector('#form-entidade [name="descricao"]').value.trim(),
      codigo: document.querySelector('#form-entidade [name="codigo"]').value.trim(),
      status: document.querySelector('#form-entidade [name="status"]').value || 'rascunho'
    };
    if (tipo === 'vista') data.tipoVista = document.querySelector('#form-entidade [name="tipoVista"]').value;
    // Parent refs
    if (tipo === 'conjunto') data.fachadaId = parent || sel.fachadaId;
    if (tipo === 'balancim') { data.conjuntoId = parent || sel.conjuntoId; const cj = conjuntos.find(c => c.id === data.conjuntoId); data.fachadaId = cj?.fachadaId || sel.fachadaId; }
    if (tipo === 'vista') { data.balancimId = parent || sel.balancimId; const bl = balancins.find(b => b.id === data.balancimId); const cj = conjuntos.find(c => c.id === bl?.conjuntoId); data.conjuntoId = bl?.conjuntoId; data.fachadaId = cj?.fachadaId || sel.fachadaId; }

    try {
      if (id) {
        await Database.atualizar(obraId, _col(), id, data);
        await Audit.editar(obraId, 'lev-fachada', tipo, id, `Editou ${tipo}: ${nome}`);
      } else {
        const novoId = await Database.criar(obraId, _col(), data);
        await Audit.criar(obraId, 'lev-fachada', tipo, novoId, `Criou ${tipo}: ${nome}`);
      }
      Utils.fecharModal('modal-entidade');
      Utils.toast('Salvo!', 'sucesso');
      await carregarTudo();
    } catch (e) { console.error(e); Utils.toast('Erro ao salvar.', 'erro'); }
  }

  async function excluirItem(tipo, id) {
    const listas = { fachada: fachadas, conjunto: conjuntos, balancim: balancins, vista: vistas };
    const item = listas[tipo]?.find(x => x.id === id);
    if (!Utils.confirmar(`Excluir ${tipo} "${item?.nome}" e todos os dados vinculados?`)) return;
    try {
      Utils.mostrarLoading('Excluindo...');
      await _excluirCascata(tipo, id);
      await Audit.excluir(obraId, 'lev-fachada', tipo, id, `Excluiu ${tipo}: ${item?.nome}`);
      // Limpar seleção
      if (tipo === 'fachada') sel = { fachadaId: null, conjuntoId: null, balancimId: null, vistaId: null };
      else if (tipo === 'conjunto') { sel.conjuntoId = null; sel.balancimId = null; sel.vistaId = null; }
      else if (tipo === 'balancim') { sel.balancimId = null; sel.vistaId = null; }
      else if (tipo === 'vista') { sel.vistaId = null; }
      Utils.toast('Excluído.', 'sucesso');
      await carregarTudo();
    } catch (e) { Utils.toast('Erro.', 'erro'); }
    finally { Utils.esconderLoading(); }
  }

  async function _excluirCascata(tipo, id) {
    if (tipo === 'fachada') {
      const cjs = conjuntos.filter(x => x.fachadaId === id);
      for (const cj of cjs) await _excluirCascata('conjunto', cj.id);
      const fps = pecas.filter(x => x.fachadaId === id);
      for (const pc of fps) await Database.deletar(obraId, _col(), pc.id);
    } else if (tipo === 'conjunto') {
      const bls = balancins.filter(x => x.conjuntoId === id);
      for (const bl of bls) await _excluirCascata('balancim', bl.id);
    } else if (tipo === 'balancim') {
      const vis = vistas.filter(x => x.balancimId === id);
      for (const vi of vis) await _excluirCascata('vista', vi.id);
      const bPecas = pecas.filter(x => x.balancimId === id);
      for (const pc of bPecas) await Database.deletar(obraId, _col(), pc.id);
    } else if (tipo === 'vista') {
      const vPecas = pecas.filter(x => x.vistaId === id);
      for (const pc of vPecas) await Database.deletar(obraId, _col(), pc.id);
    }
    await Database.deletar(obraId, _col(), id);
  }

  // ===================== CRUD — PEÇAS =====================
  function novaPeca() {
    if (!sel.vistaId) { Utils.toast('Selecione uma vista primeiro.', 'alerta'); return; }
    editandoId = null;
    document.getElementById('modal-peca-titulo').textContent = 'Nova Peça';
    Utils.limparForm('form-peca');
    document.querySelector('#form-peca [name="quantidade"]').value = 1;
    document.querySelector('#form-peca [name="quantidadeJanelas"]').value = 1;
    _toggleJanela(false);
    _popularTarefasSelect();
    Utils.abrirModal('modal-peca');
  }

  function editarPeca(id) {
    const pc = pecas.find(x => x.id === id);
    if (!pc) return;
    editandoId = id;
    document.getElementById('modal-peca-titulo').textContent = 'Editar Peça';
    _popularTarefasSelect();
    Utils.setFormData('form-peca', pc);
    _toggleJanela(!!pc.possuiJanela);
    Utils.abrirModal('modal-peca');
  }

  async function salvarPeca() {
    const data = Utils.getFormData('form-peca');
    if (!data.nome) { Utils.toast('Informe o nome da peça.', 'alerta'); return; }
    // Campos calculáveis
    data.tipo = 'peca';
    data.fachadaId = sel.fachadaId;
    data.conjuntoId = sel.conjuntoId;
    data.balancimId = sel.balancimId;
    data.vistaId = sel.vistaId;
    data.comprimento = _pn(data.comprimento);
    data.altura = _pn(data.altura);
    data.quantidade = _pn(data.quantidade) || 1;
    data.tipoMedicao = data.tipoMedicao || 'm2';
    data.possuiJanela = !!data.possuiJanela;
    data.larguraJanela = _pn(data.larguraJanela);
    data.alturaJanela = _pn(data.alturaJanela);
    data.quantidadeJanelas = _pn(data.quantidadeJanelas) || 0;
    data.vaoFechado = data.vaoFechado || 'nenhum';
    data.tarefaId = data.tarefaId || null;
    // Regra < 50cm
    if (data.altura > 0 && data.altura < 0.5 && data.tipoMedicao === 'm2') data.tipoMedicao = 'ml';
    // Validações
    if (data.comprimento < 0) { Utils.toast('Comprimento não pode ser negativo.', 'alerta'); return; }
    if (data.altura < 0) { Utils.toast('Altura não pode ser negativa.', 'alerta'); return; }
    if (data.quantidade <= 0) { Utils.toast('Quantidade deve ser maior que zero.', 'alerta'); return; }

    try {
      if (editandoId) {
        await Database.atualizar(obraId, _col(), editandoId, data);
        await Audit.editar(obraId, 'lev-fachada', 'peca', editandoId, `Editou peça: ${data.nome}`);
      } else {
        const novoId = await Database.criar(obraId, _col(), data);
        await Audit.criar(obraId, 'lev-fachada', 'peca', novoId, `Criou peça: ${data.nome}`);
      }
      Utils.fecharModal('modal-peca');
      Utils.toast('Peça salva!', 'sucesso');
      editandoId = null;
      await carregarTudo();
    } catch (e) { console.error(e); Utils.toast('Erro ao salvar.', 'erro'); }
  }

  async function excluirPeca(id) {
    if (!Utils.confirmar('Excluir esta peça?')) return;
    try {
      await Database.deletar(obraId, _col(), id);
      await Audit.excluir(obraId, 'lev-fachada', 'peca', id, 'Excluiu peça');
      Utils.toast('Peça excluída.', 'sucesso');
      await carregarTudo();
    } catch (e) { Utils.toast('Erro.', 'erro'); }
  }

  // ===================== DUPLICAÇÃO (Spec seções 34-35) =====================
  async function duplicarPeca(id) {
    const pc = pecas.find(x => x.id === id);
    if (!pc) return;
    const clone = { ...pc }; delete clone.id; delete clone.createdAt; delete clone.updatedAt; delete clone.createdBy; delete clone.updatedBy;
    clone.nome = pc.nome + ' (cópia)';
    clone.conferido = false; clone.conferidoPor = null; clone.conferidoEm = null;
    try {
      await Database.criar(obraId, _col(), clone);
      await Audit.criar(obraId, 'lev-fachada', 'peca', '', `Duplicou peça: ${pc.nome}`);
      Utils.toast('Peça duplicada!', 'sucesso');
      await carregarTudo();
    } catch (e) { Utils.toast('Erro.', 'erro'); }
  }

  async function duplicarBalancim(balancimId) {
    const bl = balancins.find(x => x.id === balancimId);
    if (!bl) return;
    if (!Utils.confirmar(`Duplicar balancim "${bl.nome}" com todas as vistas e peças?`)) return;
    try {
      Utils.mostrarLoading('Duplicando...');
      const blClone = { ...bl }; delete blClone.id; delete blClone.createdAt; delete blClone.updatedAt;
      blClone.nome = bl.nome + ' (cópia)';
      const novoBlId = await Database.criar(obraId, _col(), blClone);
      // Duplicar vistas
      const bVistas = vistas.filter(v => v.balancimId === balancimId);
      for (const vi of bVistas) {
        const viClone = { ...vi }; delete viClone.id; delete viClone.createdAt; delete viClone.updatedAt;
        viClone.balancimId = novoBlId;
        const novoViId = await Database.criar(obraId, _col(), viClone);
        // Duplicar peças desta vista
        const vPecas = pecas.filter(p => p.vistaId === vi.id);
        for (const pc of vPecas) {
          const pcClone = { ...pc }; delete pcClone.id; delete pcClone.createdAt; delete pcClone.updatedAt;
          pcClone.balancimId = novoBlId; pcClone.vistaId = novoViId;
          pcClone.conferido = false;
          await Database.criar(obraId, _col(), pcClone);
        }
      }
      await Audit.criar(obraId, 'lev-fachada', 'balancim', novoBlId, `Duplicou balancim: ${bl.nome}`);
      Utils.toast('Balancim duplicado com todas as peças!', 'sucesso');
      await carregarTudo();
    } catch (e) { console.error(e); Utils.toast('Erro.', 'erro'); }
    finally { Utils.esconderLoading(); }
  }

  async function duplicarItem(tipo, id) {
    if (tipo === 'balancim') return duplicarBalancim(id);
    const listas = { fachada: fachadas, conjunto: conjuntos };
    const item = listas[tipo]?.find(x => x.id === id);
    if (!item) return;
    const clone = { ...item }; delete clone.id; delete clone.createdAt; delete clone.updatedAt;
    clone.nome = item.nome + ' (cópia)';
    try {
      await Database.criar(obraId, _col(), clone);
      Utils.toast(`${tipo} duplicado!`, 'sucesso');
      await carregarTudo();
    } catch (e) { Utils.toast('Erro.', 'erro'); }
  }

  // ===================== CONFERÊNCIA (Spec seção 33) =====================
  async function conferirPeca(id) {
    const pc = pecas.find(x => x.id === id);
    if (!pc) return;
    const novo = !pc.conferido;
    try {
      await Database.atualizar(obraId, _col(), id, {
        conferido: novo,
        conferidoPor: novo ? Auth.getUid() : null,
        conferidoEm: novo ? new Date().toISOString() : null
      });
      Utils.toast(novo ? 'Peça conferida.' : 'Conferência removida.', 'sucesso');
      await carregarTudo();
    } catch (e) { Utils.toast('Erro.', 'erro'); }
  }

  // ===================== EXPORTAÇÃO (Spec seção 31) =====================
  function exportarResumo() { _exportarCSV(pecas, 'resumo_geral_fachada'); }
  function exportarVista(vistaId) { _exportarCSV(pecas.filter(x => x.vistaId === vistaId), 'vista_fachada'); }

  function _exportarCSV(lista, nomeArquivo) {
    const headers = ['Peça','Tipo Medição','Comprimento','Altura','Quantidade','Janela','Larg. Janela','Alt. Janela','Qtd Janelas','m² Bruto','m² Janela','m² Líquido','ML','Vão Completo','Conferido','Observações'];
    let csv = headers.join(';') + '\n';
    lista.forEach(pc => {
      const c = calcularPeca(pc);
      csv += [pc.nome, _tipoMedicaoLabel(pc.tipoMedicao), pc.comprimento, pc.altura, pc.quantidade,
        pc.possuiJanela ? 'Sim' : 'Não', pc.larguraJanela || '', pc.alturaJanela || '', pc.quantidadeJanelas || '',
        c.areaBruta.toFixed(2), c.areaJanela.toFixed(2), c.areaLiquida.toFixed(2), c.metroLinear.toFixed(2), c.vaoCompleto.toFixed(2),
        pc.conferido ? 'Sim' : 'Não', pc.observacao || ''].join(';') + '\n';
    });
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${nomeArquivo}.csv`; a.click();
    URL.revokeObjectURL(url);
    Utils.toast('Exportado!', 'sucesso');
  }

  // ===================== HELPERS =====================
  function _toggleJanela(show) {
    const el = document.getElementById('campos-janela');
    if (el) el.style.display = show ? 'grid' : 'none';
  }
  function onToggleJanela(cb) { _toggleJanela(cb.checked); }

  function _popularTarefasSelect() {
    const sel = document.querySelector('#form-peca [name="tarefaId"]');
    if (!sel) return;
    sel.innerHTML = '<option value="">Nenhuma tarefa vinculada</option>';
    tarefas.forEach(t => { sel.innerHTML += `<option value="${t.id}">${t.nome}</option>`; });
  }

  function _fn(n) { return Utils.formatarNumero(n); }
  function _pn(v) { return Utils.parseNum(v); }

  function _infoCards(t) {
    return `<div class="fachada-info-bar">
      <div class="fachada-info-item"><div class="info-label">m² Bruto</div><div class="info-valor">${_fn(t.areaBruta)}</div></div>
      <div class="fachada-info-item"><div class="info-label">m² Janelas</div><div class="info-valor">${_fn(t.areaJanela)}</div></div>
      <div class="fachada-info-item"><div class="info-label">m² Líquido</div><div class="info-valor destaque">${_fn(t.areaLiquida)}</div></div>
      <div class="fachada-info-item"><div class="info-label">Metro Linear</div><div class="info-valor">${_fn(t.metroLinear)}</div></div>
      <div class="fachada-info-item"><div class="info-label">Vão Completo</div><div class="info-valor">${_fn(t.vaoCompleto)}</div></div>
    </div>`;
  }

  function _statusBadge(st) {
    const map = { rascunho: 'badge-neutro', em_conferencia: 'badge-alerta', aprovado: 'badge-sucesso', revisado: 'badge-info', cancelado: 'badge-perigo' };
    const labels = { rascunho: 'Rascunho', em_conferencia: 'Em conferência', aprovado: 'Aprovado', revisado: 'Revisado', cancelado: 'Cancelado' };
    return `<span class="badge ${map[st] || 'badge-neutro'}">${labels[st] || 'Rascunho'}</span>`;
  }

  function _tipoMedicaoLabel(t) {
    return { m2: 'm²', ml: 'ML', vao_completo: 'Vão Comp.', misto: 'Misto' }[t] || 'm²';
  }
  function _tipoMedicaoCor(t) {
    return { m2: 'info', ml: 'alerta', vao_completo: 'sucesso', misto: 'neutro' }[t] || 'info';
  }

  function _msg(containerId, icon, text) {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = `<div class="estado-vazio"><div class="icone">${icon}</div><p>${text}</p></div>`;
  }

  // API PÚBLICA (alias LF)
  return {
    init, carregarTudo, selecionar,
    novoItem, editarItem, salvarEntidade, excluirItem, duplicarItem,
    novaPeca, editarPeca, salvarPeca, excluirPeca, duplicarPeca,
    duplicarBalancim, conferirPeca,
    exportarResumo, exportarVista,
    onToggleJanela
  };
})();

// Alias curto para onclick
const LF = LevantamentoFachada;
function onObraChanged() { LF.init(); }

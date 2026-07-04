// ============================================
// Módulo: Levantamento de Fachada — COMPLETO
// Especificação Funcional (40 seções)
// Fachada → Conjunto → Balancim → Vista → Peça
// ============================================

const LevantamentoFachada = (() => {
  let obraId = null;
  let fachadas=[], conjuntos=[], balancins=[], vistas=[], pecas=[], tarefas=[];
  let sel = { fachadaId:null, conjuntoId:null, balancimId:null, vistaId:null };
  let editandoId = null;
  const COL = 'levantamentosFachada';

  // ===================== INIT =====================
  async function init() {
    const ok = await Utils.initPagina({ requireObra: true });
    if (!ok) return;
    obraId = Router.getObraId();
    if (!obraId) { _empty('fachada-main','🏢','Selecione uma obra na barra lateral.'); return; }
    document.addEventListener('keydown', e => { if(e.key==='Escape') Utils.fecharTodosModais(); });
    await carregarTudo();
  }

  // ===================== DADOS =====================
  async function carregarTudo() {
    try {
      Utils.mostrarLoading('Carregando fachada...');
      const todos = await Database.listar(obraId, COL, null);
      fachadas  = todos.filter(d => d.tipo === 'fachada');
      conjuntos = todos.filter(d => d.tipo === 'conjunto');
      balancins = todos.filter(d => d.tipo === 'balancim');
      vistas    = todos.filter(d => d.tipo === 'vista');
      pecas     = todos.filter(d => d.tipo === 'peca');
      try { tarefas = await Database.listar(obraId, 'tarefas', 'nome'); } catch(e){ tarefas=[]; }
      renderArvore();
      renderPainel();
    } catch (e) {
      console.error('Erro ao carregar:', e);
      Utils.toast('Erro ao carregar dados.', 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ===================== ÁRVORE =====================
  function renderArvore() {
    const c = document.getElementById('fachada-tree-body');
    if (!c) return;
    if (fachadas.length === 0) {
      c.innerHTML = '<div style="padding:20px 12px;text-align:center;"><p style="color:#94a3b8;font-size:0.82rem;">Nenhuma fachada.</p><button class="btn btn-primario btn-sm" style="margin-top:8px;" onclick="LF.novoItem(\'fachada\')">+ Fachada</button></div>';
      return;
    }
    let h = '';
    fachadas.forEach(f => {
      const fSel = sel.fachadaId === f.id;
      const nPec = pecas.filter(x => x.fachadaId === f.id).length;
      h += _ti(f.id,'fachada','🏢',f.nome,nPec,fSel&&!sel.conjuntoId);
      if (fSel) {
        h += '<div class="tree-children">';
        conjuntos.filter(x => x.fachadaId===f.id).forEach(cj => {
          const cSel = sel.conjuntoId===cj.id;
          h += _ti(cj.id,'conjunto','📦',cj.nome,0,cSel&&!sel.balancimId);
          if (cSel) {
            h += '<div class="tree-children">';
            balancins.filter(x => x.conjuntoId===cj.id).forEach(bl => {
              const bSel = sel.balancimId===bl.id;
              const bPec = pecas.filter(x => x.balancimId===bl.id).length;
              h += _ti(bl.id,'balancim','🪜',bl.nome||bl.codigo||'Balancim',bPec,bSel&&!sel.vistaId);
              if (bSel) {
                h += '<div class="tree-children">';
                vistas.filter(x => x.balancimId===bl.id).forEach(vi => {
                  const vSel = sel.vistaId===vi.id;
                  const vPec = pecas.filter(x => x.vistaId===vi.id).length;
                  const ico = vi.tipoVista==='externa'?'🔵':vi.tipoVista==='interna'?'🟡':'⚪';
                  h += _ti(vi.id,'vista',ico,vi.nome||(vi.tipoVista==='externa'?'Vista Externa':'Vista Interna'),vPec,vSel);
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

  function _ti(id,tipo,icon,label,badge,ativo) {
    return '<div class="tree-item'+(ativo?' ativo':'')+'" onclick="LF.selecionar(\''+tipo+'\',\''+id+'\')"><span class="tree-toggle">'+(tipo==='vista'?'':'▸')+'</span><span class="tree-icon">'+icon+'</span><span class="tree-label">'+label+'</span>'+(badge>0?'<span class="tree-badge">'+badge+'</span>':'')+'</div>';
  }

  // ===================== SELEÇÃO =====================
  function selecionar(tipo, id) {
    if (tipo==='fachada') sel = {fachadaId:id,conjuntoId:null,balancimId:null,vistaId:null};
    else if (tipo==='conjunto') { const cj=conjuntos.find(x=>x.id===id); sel.fachadaId=cj?.fachadaId||sel.fachadaId; sel.conjuntoId=id; sel.balancimId=null; sel.vistaId=null; }
    else if (tipo==='balancim') { const bl=balancins.find(x=>x.id===id); const cj=conjuntos.find(x=>x.id===bl?.conjuntoId); sel.fachadaId=cj?.fachadaId||sel.fachadaId; sel.conjuntoId=bl?.conjuntoId||sel.conjuntoId; sel.balancimId=id; sel.vistaId=null; }
    else if (tipo==='vista') { const vi=vistas.find(x=>x.id===id); const bl=balancins.find(x=>x.id===vi?.balancimId); const cj=conjuntos.find(x=>x.id===bl?.conjuntoId); sel.fachadaId=cj?.fachadaId||sel.fachadaId; sel.conjuntoId=bl?.conjuntoId||sel.conjuntoId; sel.balancimId=vi?.balancimId||sel.balancimId; sel.vistaId=id; }
    renderArvore(); renderPainel();
  }

  // ===================== PAINEL =====================
  function renderPainel() {
    const p = document.getElementById('fachada-painel');
    if (!p) return;
    if (sel.vistaId) return renderPecas(p);
    if (sel.balancimId) return renderBalancim(p);
    if (sel.conjuntoId) return renderConjunto(p);
    if (sel.fachadaId) return renderFachada(p);
    renderGeral(p);
  }

  // ---- RESUMO GERAL ----
  function renderGeral(p) {
    const tot = _somar(pecas);
    let rows = fachadas.map(f => {
      const t = _somar(pecas.filter(x=>x.fachadaId===f.id));
      const nc = conjuntos.filter(x=>x.fachadaId===f.id).length;
      const np = pecas.filter(x=>x.fachadaId===f.id).length;
      return '<tr><td><a href="#" onclick="LF.selecionar(\'fachada\',\''+f.id+'\');return false;">'+f.nome+'</a></td><td class="col-centro">'+_stBadge(f.status)+'</td><td class="col-num">'+nc+'</td><td class="col-num">'+np+'</td><td class="col-num">'+_f(t.bruto)+'</td><td class="col-num">'+_f(t.janela)+'</td><td class="col-num" style="font-weight:600;color:var(--cor-primaria);">'+_f(t.liquido)+'</td><td class="col-num">'+_f(t.ml)+'</td><td class="col-num">'+_f(t.vao)+'</td><td class="col-acoes"><button class="btn btn-secundario btn-sm" onclick="LF.editarItem(\'fachada\',\''+f.id+'\')">✎</button> <button class="btn btn-perigo btn-sm btn-icon" onclick="LF.excluirItem(\'fachada\',\''+f.id+'\')">✕</button></td></tr>';
    }).join('');
    p.innerHTML = '<div class="page-header"><div><h2>Resumo Geral — Fachada</h2><span class="subtitulo">'+fachadas.length+' fachada(s) · '+pecas.length+' peça(s)</span></div><div class="btn-grupo"><button class="btn btn-secundario btn-sm" onclick="LF.exportarCSV()">📥 Exportar CSV</button><button class="btn btn-primario" onclick="LF.novoItem(\'fachada\')">+ Nova Fachada</button></div></div>'+_cards(tot)+'<div class="tabela-container mt-2"><table class="tabela"><thead><tr><th>Fachada</th><th class="col-centro">Status</th><th class="col-num">Conj.</th><th class="col-num">Peças</th><th class="col-num">m² Bruto</th><th class="col-num">m² Janela</th><th class="col-num">m² Líquido</th><th class="col-num">ML</th><th class="col-num">Vão</th><th class="col-acoes">Ações</th></tr></thead><tbody>'+(rows||'<tr><td colspan="10" class="text-center text-muted">Nenhuma fachada.</td></tr>')+'</tbody><tfoot><tr><td><strong>TOTAL</strong></td><td></td><td class="col-num">'+conjuntos.length+'</td><td class="col-num">'+pecas.length+'</td><td class="col-num">'+_f(tot.bruto)+'</td><td class="col-num">'+_f(tot.janela)+'</td><td class="col-num">'+_f(tot.liquido)+'</td><td class="col-num">'+_f(tot.ml)+'</td><td class="col-num">'+_f(tot.vao)+'</td><td></td></tr></tfoot></table></div>';
  }

  // ---- FACHADA ----
  function renderFachada(p) {
    const f = fachadas.find(x=>x.id===sel.fachadaId); if(!f) return;
    const fConj = conjuntos.filter(x=>x.fachadaId===f.id);
    const fPec = pecas.filter(x=>x.fachadaId===f.id);
    const tot = _somar(fPec);
    let rows = fConj.map(cj => {
      const t = _somarConj(cj.id);
      const nb = balancins.filter(b=>b.conjuntoId===cj.id).length;
      return '<tr><td><a href="#" onclick="LF.selecionar(\'conjunto\',\''+cj.id+'\');return false;">'+cj.nome+'</a></td><td class="col-num">'+nb+'</td><td class="col-num">'+_f(t.bruto)+'</td><td class="col-num">'+_f(t.liquido)+'</td><td class="col-num">'+_f(t.ml)+'</td><td class="col-num">'+_f(t.vao)+'</td><td class="col-acoes"><button class="btn btn-secundario btn-sm" onclick="LF.editarItem(\'conjunto\',\''+cj.id+'\')">✎</button> <button class="btn btn-perigo btn-sm btn-icon" onclick="LF.excluirItem(\'conjunto\',\''+cj.id+'\')">✕</button></td></tr>';
    }).join('');
    p.innerHTML = '<div class="page-header"><div><h2>🏢 '+f.nome+'</h2><span class="subtitulo">'+fConj.length+' conjunto(s) · '+_stBadge(f.status)+'</span></div><div class="btn-grupo"><button class="btn btn-secundario btn-sm" onclick="LF.editarItem(\'fachada\',\''+f.id+'\')">✎</button><button class="btn btn-primario btn-sm" onclick="LF.novoItem(\'conjunto\',\''+f.id+'\')">+ Conjunto de Balancins</button></div></div>'+_cards(tot)+'<div class="tabela-container mt-2"><table class="tabela"><thead><tr><th>Conjunto</th><th class="col-num">Balancins</th><th class="col-num">m² Bruto</th><th class="col-num">m² Líquido</th><th class="col-num">ML</th><th class="col-num">Vão</th><th class="col-acoes">Ações</th></tr></thead><tbody>'+(rows||'<tr><td colspan="7" class="text-center text-muted">Nenhum conjunto. Clique "+ Conjunto de Balancins" para começar.</td></tr>')+'</tbody></table></div>';
  }

  // ---- CONJUNTO ----
  function renderConjunto(p) {
    const cj = conjuntos.find(x=>x.id===sel.conjuntoId); if(!cj) return;
    const cBal = balancins.filter(x=>x.conjuntoId===cj.id);
    const tot = _somarConj(cj.id);
    let rows = cBal.map(bl => {
      const t = _somarBal(bl.id);
      const nv = vistas.filter(v=>v.balancimId===bl.id).length;
      const np = pecas.filter(pc=>pc.balancimId===bl.id).length;
      return '<tr><td><a href="#" onclick="LF.selecionar(\'balancim\',\''+bl.id+'\');return false;">'+(bl.nome||bl.codigo||'Balancim')+'</a></td><td class="col-num">'+nv+'</td><td class="col-num">'+np+'</td><td class="col-num">'+_f(t.bruto)+'</td><td class="col-num">'+_f(t.liquido)+'</td><td class="col-num">'+_f(t.ml)+'</td><td class="col-num">'+_f(t.vao)+'</td><td class="col-acoes"><button class="btn btn-secundario btn-sm" onclick="LF.editarItem(\'balancim\',\''+bl.id+'\')">✎</button> <button class="btn btn-sm btn-icon" title="Duplicar com peças" onclick="LF.duplicarBalancim(\''+bl.id+'\')">⧉</button> <button class="btn btn-perigo btn-sm btn-icon" onclick="LF.excluirItem(\'balancim\',\''+bl.id+'\')">✕</button></td></tr>';
    }).join('');
    p.innerHTML = '<div class="page-header"><div><h2>📦 '+cj.nome+'</h2><span class="subtitulo">'+cBal.length+' balancim(ns)</span></div><div class="btn-grupo"><button class="btn btn-primario btn-sm" onclick="LF.novoItem(\'balancim\',\''+cj.id+'\')">+ Balancim</button></div></div>'+_cards(tot)+'<div class="tabela-container mt-2"><table class="tabela"><thead><tr><th>Balancim</th><th class="col-num">Vistas</th><th class="col-num">Peças</th><th class="col-num">m² Bruto</th><th class="col-num">m² Líquido</th><th class="col-num">ML</th><th class="col-num">Vão</th><th class="col-acoes">Ações</th></tr></thead><tbody>'+(rows||'<tr><td colspan="8" class="text-center text-muted">Nenhum balancim.</td></tr>')+'</tbody></table></div>';
  }

  // ---- BALANCIM (mostra vistas e botão de criar peça rápida) ----
  function renderBalancim(p) {
    const bl = balancins.find(x=>x.id===sel.balancimId); if(!bl) return;
    const bVis = vistas.filter(x=>x.balancimId===bl.id);
    const bPec = pecas.filter(x=>x.balancimId===bl.id);
    const tot = _somarBal(bl.id);

    let vistaCards = bVis.map(vi => {
      const vPec = pecas.filter(x=>x.vistaId===vi.id);
      const tv = _somar(vPec);
      const ico = vi.tipoVista==='externa'?'🔵':vi.tipoVista==='interna'?'🟡':'⚪';
      return '<div class="resumo-card" style="cursor:pointer" onclick="LF.selecionar(\'vista\',\''+vi.id+'\')"><div class="resumo-label">'+ico+' '+(vi.nome||(vi.tipoVista==='externa'?'Vista Externa':'Vista Interna'))+'</div><div class="resumo-valor">'+_f(tv.liquido)+'</div><div class="resumo-unidade">'+vPec.length+' peça(s) · '+_f(tv.ml)+' ML</div><div style="margin-top:8px;"><button class="btn btn-secundario btn-sm" onclick="event.stopPropagation();LF.editarItem(\'vista\',\''+vi.id+'\')">✎</button> <button class="btn btn-perigo btn-sm btn-icon" onclick="event.stopPropagation();LF.excluirItem(\'vista\',\''+vi.id+'\')">✕</button></div></div>';
    }).join('');

    if (bVis.length === 0) {
      vistaCards = '<div style="grid-column:1/-1;text-align:center;padding:20px;color:#94a3b8;"><p>Nenhuma vista. Ao criar uma vista, você poderá cadastrar peças.</p><p style="margin-top:10px;"><button class="btn btn-primario btn-sm" onclick="LF.novoItem(\'vista\',\''+bl.id+'\')">+ Vista Externa</button></p></div>';
    }

    p.innerHTML = '<div class="page-header"><div><h2>🪜 '+(bl.nome||bl.codigo||'Balancim')+'</h2><span class="subtitulo">'+bVis.length+' vista(s) · '+bPec.length+' peça(s) — Clique em uma vista para cadastrar peças</span></div><div class="btn-grupo"><button class="btn btn-secundario btn-sm" onclick="LF.duplicarBalancim(\''+bl.id+'\')">⧉ Duplicar</button><button class="btn btn-primario btn-sm" onclick="LF.novoItem(\'vista\',\''+bl.id+'\')">+ Nova Vista</button></div></div>'+_cards(tot)+'<div class="resumo-grid mt-2">'+vistaCards+'</div>';
  }

  // ---- PEÇAS (vista selecionada) — A CALCULADORA ----
  function renderPecas(p) {
    const vi = vistas.find(x=>x.id===sel.vistaId); if(!vi) return;
    const bl = balancins.find(x=>x.id===vi.balancimId);
    const ico = vi.tipoVista==='externa'?'🔵':'🟡';
    const vPec = pecas.filter(x=>x.vistaId===vi.id);

    let rows = '', tB=0, tJ=0, tL=0, tM=0, tV=0;
    vPec.forEach((pc,i) => {
      const c = _calc(pc);
      tB+=c.bruto; tJ+=c.janela; tL+=c.liquido; tM+=c.ml; tV+=c.vao;
      const alerts = _validar(pc,c);
      const alertIcon = alerts.length>0?'<span title="'+alerts.join('; ')+'" style="color:var(--cor-alerta);cursor:help;margin-left:4px;">⚠</span>':'';
      const confIcon = pc.conferido?'✅':'';
      rows += '<tr><td>'+(i+1)+'</td><td>'+pc.nome+alertIcon+'</td><td class="col-centro"><span class="badge badge-'+_tipoCor(pc.tipoMedicao)+'">'+_tipoLabel(pc.tipoMedicao)+'</span></td><td class="col-num">'+_f(pc.comprimento)+'</td><td class="col-num">'+_f(pc.altura)+'</td><td class="col-num col-centro">'+(pc.quantidade||1)+'</td><td class="col-centro">'+(pc.possuiJanela?'✓':'')+'</td><td class="col-num">'+_f(c.bruto)+'</td><td class="col-num">'+_f(c.janela)+'</td><td class="col-num" style="font-weight:600;color:var(--cor-primaria);">'+_f(c.liquido)+'</td><td class="col-num">'+_f(c.ml)+'</td><td class="col-num">'+_f(c.vao)+'</td><td class="col-centro">'+confIcon+'</td><td class="col-acoes" style="white-space:nowrap;"><button class="btn btn-secundario btn-sm" onclick="LF.editarPeca(\''+pc.id+'\')" title="Editar">✎</button> <button class="btn btn-sm btn-icon" onclick="LF.duplicarPeca(\''+pc.id+'\')" title="Duplicar">⧉</button> <button class="btn btn-sm btn-icon" onclick="LF.conferirPeca(\''+pc.id+'\')" title="'+(pc.conferido?'Desconferir':'Conferir')+'">'+(pc.conferido?'↩':'✓')+'</button> <button class="btn btn-perigo btn-sm btn-icon" onclick="LF.excluirPeca(\''+pc.id+'\')">✕</button></td></tr>';
    });

    p.innerHTML = '<div class="page-header"><div><h2>'+ico+' '+(vi.nome||(vi.tipoVista==='externa'?'Vista Externa':'Vista Interna'))+' — '+(bl?.nome||'Balancim')+'</h2><span class="subtitulo">'+vPec.length+' peça(s)</span></div><div class="btn-grupo"><button class="btn btn-secundario btn-sm" onclick="LF.exportarVista()">📥 CSV</button><button class="btn btn-primario" onclick="LF.novaPeca()">+ Nova Peça</button></div></div><div class="fachada-info-bar"><div class="fachada-info-item"><div class="info-label">m² Bruto</div><div class="info-valor">'+_f(tB)+'</div></div><div class="fachada-info-item"><div class="info-label">m² Janelas</div><div class="info-valor">'+_f(tJ)+'</div></div><div class="fachada-info-item"><div class="info-label">m² Líquido</div><div class="info-valor destaque">'+_f(tL)+'</div></div><div class="fachada-info-item"><div class="info-label">Metro Linear</div><div class="info-valor">'+_f(tM)+'</div></div><div class="fachada-info-item"><div class="info-label">Vão Completo</div><div class="info-valor">'+_f(tV)+'</div></div></div><div class="tabela-container mt-2"><table class="tabela tabela-compacta"><thead><tr><th class="col-sm">#</th><th>Peça</th><th class="col-centro">Tipo</th><th class="col-num">Comp</th><th class="col-num">Alt</th><th class="col-num col-centro">Qtd</th><th class="col-centro">Jan</th><th class="col-num">m² Brut</th><th class="col-num">m² Jan</th><th class="col-num">m² Líq</th><th class="col-num">ML</th><th class="col-num">Vão</th><th class="col-centro">Conf</th><th class="col-acoes">Ações</th></tr></thead><tbody>'+(rows||'<tr><td colspan="14" class="text-center text-muted">Nenhuma peça. Clique "+ Nova Peça" para começar a calcular.</td></tr>')+'</tbody><tfoot><tr><td></td><td><strong>TOTAL</strong></td><td></td><td></td><td></td><td></td><td></td><td class="col-num">'+_f(tB)+'</td><td class="col-num">'+_f(tJ)+'</td><td class="col-num" style="font-weight:700;color:var(--cor-primaria);">'+_f(tL)+'</td><td class="col-num">'+_f(tM)+'</td><td class="col-num">'+_f(tV)+'</td><td></td><td></td></tr></tfoot></table></div>';
  }

  // ===================== CÁLCULOS =====================
  function _calc(pc) {
    const comp=_pn(pc.comprimento), alt=_pn(pc.altura), qtd=_pn(pc.quantidade)||1;
    const tipo = pc.tipoMedicao||'m2';
    let bruto=0, janela=0, liquido=0, ml=0, vao=0;
    if (tipo==='m2'||tipo==='misto') {
      bruto = comp*alt*qtd;
      if (pc.possuiJanela) janela = _pn(pc.larguraJanela)*_pn(pc.alturaJanela)*(_pn(pc.quantidadeJanelas)||1)*qtd;
      liquido = Math.max(0, bruto-janela);
    }
    if (tipo==='ml'||tipo==='misto'||(alt>0&&alt<0.5&&tipo==='m2')) {
      ml = comp*qtd;
      if (tipo==='ml') { bruto=0;janela=0;liquido=0; }
    }
    if (tipo==='vao_completo') vao = comp*alt*qtd;
    return {bruto,janela,liquido,ml,vao};
  }
  function _somar(lista) { let b=0,j=0,l=0,m=0,v=0; lista.forEach(pc=>{const c=_calc(pc);b+=c.bruto;j+=c.janela;l+=c.liquido;m+=c.ml;v+=c.vao;}); return {bruto:b,janela:j,liquido:l,ml:m,vao:v}; }
  function _somarBal(blId) { return _somar(pecas.filter(x=>x.balancimId===blId)); }
  function _somarConj(cjId) { const bls=balancins.filter(b=>b.conjuntoId===cjId); return _somar(pecas.filter(pc=>bls.some(b=>b.id===pc.balancimId))); }
  function _validar(pc,c) { const a=[]; if(!pc.nome)a.push('Sem nome'); if(_pn(pc.comprimento)<=0)a.push('Comp inválido'); if(c&&c.liquido<0)a.push('Área negativa'); if(pc.possuiJanela&&_pn(pc.larguraJanela)*_pn(pc.alturaJanela)>_pn(pc.comprimento)*_pn(pc.altura))a.push('Janela > peça'); return a; }

  // ===================== CRUD ENTIDADE =====================
  function novoItem(tipo, parentId) {
    editandoId = null;
    const labels = {fachada:'Nova Fachada',conjunto:'Novo Conjunto de Balancins',balancim:'Novo Balancim',vista:'Nova Vista'};
    document.getElementById('modal-ent-titulo').textContent = labels[tipo]||'Novo';
    document.getElementById('form-ent-tipo').value = tipo;
    document.getElementById('form-ent-id').value = '';
    document.getElementById('form-ent-parent').value = parentId||'';
    Utils.limparForm('form-entidade');
    // Mostrar/ocultar campos por tipo
    document.getElementById('campo-tipo-vista').classList.toggle('hidden', tipo!=='vista');
    document.getElementById('campo-status-ent').classList.toggle('hidden', tipo==='vista');
    document.getElementById('campo-codigo-ent').classList.toggle('hidden', tipo==='fachada');
    Utils.abrirModal('modal-entidade');
  }

  function editarItem(tipo, id) {
    const map = {fachada:fachadas,conjunto:conjuntos,balancim:balancins,vista:vistas};
    const item = map[tipo]?.find(x=>x.id===id); if(!item) return;
    editandoId = id;
    document.getElementById('modal-ent-titulo').textContent = 'Editar '+ tipo;
    document.getElementById('form-ent-tipo').value = tipo;
    document.getElementById('form-ent-id').value = id;
    document.getElementById('form-ent-parent').value = '';
    document.querySelector('#form-entidade [name="nome"]').value = item.nome||'';
    document.querySelector('#form-entidade [name="descricao"]').value = item.descricao||'';
    document.querySelector('#form-entidade [name="codigo"]').value = item.codigo||'';
    document.querySelector('#form-entidade [name="status"]').value = item.status||'rascunho';
    if(tipo==='vista') document.querySelector('#form-entidade [name="tipoVista"]').value = item.tipoVista||'externa';
    document.getElementById('campo-tipo-vista').classList.toggle('hidden', tipo!=='vista');
    document.getElementById('campo-status-ent').classList.toggle('hidden', tipo==='vista');
    document.getElementById('campo-codigo-ent').classList.toggle('hidden', tipo==='fachada');
    Utils.abrirModal('modal-entidade');
  }

  async function salvarEntidade() {
    const tipo = document.getElementById('form-ent-tipo').value;
    const id = document.getElementById('form-ent-id').value;
    const parent = document.getElementById('form-ent-parent').value;
    const nome = document.querySelector('#form-entidade [name="nome"]').value.trim();
    if (!nome) { Utils.toast('Informe o nome.','alerta'); return; }
    const data = { tipo, nome,
      descricao: document.querySelector('#form-entidade [name="descricao"]').value.trim(),
      codigo: document.querySelector('#form-entidade [name="codigo"]').value.trim(),
      status: document.querySelector('#form-entidade [name="status"]').value||'rascunho'
    };
    if(tipo==='vista') data.tipoVista = document.querySelector('#form-entidade [name="tipoVista"]').value;
    // Refs hierárquicas
    if(tipo==='conjunto') data.fachadaId = parent||sel.fachadaId;
    if(tipo==='balancim') { data.conjuntoId=parent||sel.conjuntoId; const cj=conjuntos.find(c=>c.id===data.conjuntoId); data.fachadaId=cj?.fachadaId||sel.fachadaId; }
    if(tipo==='vista') { data.balancimId=parent||sel.balancimId; const bl=balancins.find(b=>b.id===data.balancimId); const cj=conjuntos.find(c=>c.id===bl?.conjuntoId); data.conjuntoId=bl?.conjuntoId; data.fachadaId=cj?.fachadaId||sel.fachadaId; }
    try {
      if(id) { await Database.atualizar(obraId,COL,id,data); await Audit.editar(obraId,'lev-fachada',tipo,id,'Editou '+tipo+': '+nome); }
      else {
        const novoId = await Database.criar(obraId,COL,data);
        await Audit.criar(obraId,'lev-fachada',tipo,novoId,'Criou '+tipo+': '+nome);
        // AUTO-CRIAR vistas ao criar balancim
        if(tipo==='balancim') {
          await Database.criar(obraId,COL,{tipo:'vista',tipoVista:'externa',nome:'Vista Externa',balancimId:novoId,conjuntoId:data.conjuntoId,fachadaId:data.fachadaId});
          await Database.criar(obraId,COL,{tipo:'vista',tipoVista:'interna',nome:'Vista Interna',balancimId:novoId,conjuntoId:data.conjuntoId,fachadaId:data.fachadaId});
        }
      }
      Utils.fecharModal('modal-entidade');
      Utils.toast('Salvo!','sucesso');
      await carregarTudo();
    } catch(e) { console.error(e); Utils.toast('Erro ao salvar.','erro'); }
  }

  async function excluirItem(tipo, id) {
    const map = {fachada:fachadas,conjunto:conjuntos,balancim:balancins,vista:vistas};
    const item = map[tipo]?.find(x=>x.id===id);
    if(!Utils.confirmar('Excluir "'+item?.nome+'" e todos os dados vinculados?')) return;
    try {
      Utils.mostrarLoading('Excluindo...');
      await _excluirCascata(tipo,id);
      await Audit.excluir(obraId,'lev-fachada',tipo,id,'Excluiu '+tipo);
      if(tipo==='fachada') sel={fachadaId:null,conjuntoId:null,balancimId:null,vistaId:null};
      else if(tipo==='conjunto'){sel.conjuntoId=null;sel.balancimId=null;sel.vistaId=null;}
      else if(tipo==='balancim'){sel.balancimId=null;sel.vistaId=null;}
      else if(tipo==='vista') sel.vistaId=null;
      Utils.toast('Excluído.','sucesso');
      await carregarTudo();
    } catch(e){ Utils.toast('Erro.','erro'); }
    finally { Utils.esconderLoading(); }
  }

  async function _excluirCascata(tipo,id) {
    if(tipo==='fachada'){ for(const c of conjuntos.filter(x=>x.fachadaId===id)) await _excluirCascata('conjunto',c.id); for(const pc of pecas.filter(x=>x.fachadaId===id)) await Database.deletar(obraId,COL,pc.id); }
    else if(tipo==='conjunto'){ for(const b of balancins.filter(x=>x.conjuntoId===id)) await _excluirCascata('balancim',b.id); }
    else if(tipo==='balancim'){ for(const v of vistas.filter(x=>x.balancimId===id)) await _excluirCascata('vista',v.id); for(const pc of pecas.filter(x=>x.balancimId===id)) await Database.deletar(obraId,COL,pc.id); }
    else if(tipo==='vista'){ for(const pc of pecas.filter(x=>x.vistaId===id)) await Database.deletar(obraId,COL,pc.id); }
    await Database.deletar(obraId,COL,id);
  }

  // ===================== CRUD PEÇAS =====================
  function novaPeca() {
    if(!sel.vistaId) { Utils.toast('Selecione uma vista primeiro.','alerta'); return; }
    editandoId = null;
    document.getElementById('modal-peca-titulo').textContent = 'Nova Peça';
    Utils.limparForm('form-peca');
    document.querySelector('#form-peca [name="quantidade"]').value = 1;
    document.querySelector('#form-peca [name="quantidadeJanelas"]').value = 1;
    _toggleJan(false);
    _popularTarefas();
    Utils.abrirModal('modal-peca');
  }

  function editarPeca(id) {
    const pc = pecas.find(x=>x.id===id); if(!pc) return;
    editandoId = id;
    document.getElementById('modal-peca-titulo').textContent = 'Editar Peça';
    _popularTarefas();
    Utils.setFormData('form-peca', pc);
    _toggleJan(!!pc.possuiJanela);
    Utils.abrirModal('modal-peca');
  }

  async function salvarPeca() {
    const data = Utils.getFormData('form-peca');
    if(!data.nome) { Utils.toast('Informe o nome.','alerta'); return; }
    data.tipo='peca'; data.fachadaId=sel.fachadaId; data.conjuntoId=sel.conjuntoId; data.balancimId=sel.balancimId; data.vistaId=sel.vistaId;
    data.comprimento=_pn(data.comprimento); data.altura=_pn(data.altura); data.quantidade=_pn(data.quantidade)||1;
    data.tipoMedicao=data.tipoMedicao||'m2'; data.possuiJanela=!!data.possuiJanela;
    data.larguraJanela=_pn(data.larguraJanela); data.alturaJanela=_pn(data.alturaJanela); data.quantidadeJanelas=_pn(data.quantidadeJanelas)||0;
    data.vaoFechado=data.vaoFechado||'nenhum'; data.tarefaId=data.tarefaId||null;
    if(data.altura>0&&data.altura<0.5&&data.tipoMedicao==='m2') data.tipoMedicao='ml';
    if(data.comprimento<0){Utils.toast('Comprimento negativo.','alerta');return;}
    if(data.quantidade<=0){Utils.toast('Quantidade deve ser > 0.','alerta');return;}
    try {
      if(editandoId) { await Database.atualizar(obraId,COL,editandoId,data); await Audit.editar(obraId,'lev-fachada','peca',editandoId,'Editou peça: '+data.nome); }
      else { const nid=await Database.criar(obraId,COL,data); await Audit.criar(obraId,'lev-fachada','peca',nid,'Criou peça: '+data.nome); }
      Utils.fecharModal('modal-peca'); Utils.toast('Peça salva!','sucesso'); editandoId=null; await carregarTudo();
    } catch(e){ console.error(e); Utils.toast('Erro.','erro'); }
  }

  async function excluirPeca(id) { if(!Utils.confirmar('Excluir peça?'))return; try{await Database.deletar(obraId,COL,id); Utils.toast('Excluída.','sucesso'); await carregarTudo();}catch(e){Utils.toast('Erro.','erro');} }

  // ===================== DUPLICAÇÃO =====================
  async function duplicarPeca(id) {
    const pc=pecas.find(x=>x.id===id); if(!pc)return;
    const clone={...pc}; delete clone.id; delete clone.createdAt; delete clone.updatedAt; delete clone.createdBy; delete clone.updatedBy;
    clone.nome=pc.nome+' (cópia)'; clone.conferido=false;
    try { await Database.criar(obraId,COL,clone); Utils.toast('Peça duplicada!','sucesso'); await carregarTudo(); } catch(e){Utils.toast('Erro.','erro');}
  }

  async function duplicarBalancim(blId) {
    const bl=balancins.find(x=>x.id===blId); if(!bl)return;
    if(!Utils.confirmar('Duplicar "'+bl.nome+'" com todas as vistas e peças?'))return;
    try {
      Utils.mostrarLoading('Duplicando...');
      const blC={...bl}; delete blC.id; delete blC.createdAt; delete blC.updatedAt; blC.nome=bl.nome+' (cópia)';
      const nblId = await Database.criar(obraId,COL,blC);
      for(const vi of vistas.filter(v=>v.balancimId===blId)) {
        const viC={...vi}; delete viC.id; delete viC.createdAt; delete viC.updatedAt; viC.balancimId=nblId;
        const nviId = await Database.criar(obraId,COL,viC);
        for(const pc of pecas.filter(p=>p.vistaId===vi.id)) {
          const pcC={...pc}; delete pcC.id; delete pcC.createdAt; delete pcC.updatedAt; pcC.balancimId=nblId; pcC.vistaId=nviId; pcC.conferido=false;
          await Database.criar(obraId,COL,pcC);
        }
      }
      Utils.toast('Balancim duplicado!','sucesso'); await carregarTudo();
    } catch(e){Utils.toast('Erro.','erro');} finally{Utils.esconderLoading();}
  }

  // ===================== CONFERÊNCIA =====================
  async function conferirPeca(id) {
    const pc=pecas.find(x=>x.id===id); if(!pc)return;
    const novo=!pc.conferido;
    try { await Database.atualizar(obraId,COL,id,{conferido:novo,conferidoPor:novo?Auth.getUid():null,conferidoEm:novo?new Date().toISOString():null}); Utils.toast(novo?'Conferida.':'Desconferida.','sucesso'); await carregarTudo(); }catch(e){Utils.toast('Erro.','erro');}
  }

  // ===================== EXPORTAÇÃO =====================
  function exportarCSV() { _csv(pecas,'fachada_resumo_geral'); }
  function exportarVista() { _csv(pecas.filter(x=>x.vistaId===sel.vistaId),'fachada_vista'); }
  function _csv(lista,nome) {
    const h='Peça;Tipo;Comprimento;Altura;Qtd;Janela;Larg Jan;Alt Jan;Qtd Jan;m2 Bruto;m2 Janela;m2 Liquido;ML;Vao Completo;Conferido;Obs\n';
    let csv=h; lista.forEach(pc=>{const c=_calc(pc);csv+=[pc.nome,_tipoLabel(pc.tipoMedicao),pc.comprimento,pc.altura,pc.quantidade,pc.possuiJanela?'Sim':'Nao',pc.larguraJanela||'',pc.alturaJanela||'',pc.quantidadeJanelas||'',c.bruto.toFixed(2),c.janela.toFixed(2),c.liquido.toFixed(2),c.ml.toFixed(2),c.vao.toFixed(2),pc.conferido?'Sim':'Nao',pc.observacao||''].join(';')+'\n';});
    const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=nome+'.csv';a.click();URL.revokeObjectURL(url); Utils.toast('Exportado!','sucesso');
  }

  // ===================== HELPERS =====================
  function _toggleJan(s){const e=document.getElementById('campos-janela');if(e)e.style.display=s?'grid':'none';}
  function onToggleJanela(cb){_toggleJan(cb.checked);}
  function _popularTarefas(){const s=document.querySelector('#form-peca [name="tarefaId"]');if(!s)return;s.innerHTML='<option value="">Sem tarefa</option>';tarefas.forEach(t=>{s.innerHTML+='<option value="'+t.id+'">'+t.nome+'</option>';});}
  function _f(n){return Utils.formatarNumero(n);}
  function _pn(v){return Utils.parseNum(v);}
  function _cards(t){return '<div class="fachada-info-bar"><div class="fachada-info-item"><div class="info-label">m² Bruto</div><div class="info-valor">'+_f(t.bruto)+'</div></div><div class="fachada-info-item"><div class="info-label">m² Janelas</div><div class="info-valor">'+_f(t.janela)+'</div></div><div class="fachada-info-item"><div class="info-label">m² Líquido</div><div class="info-valor destaque">'+_f(t.liquido)+'</div></div><div class="fachada-info-item"><div class="info-label">Metro Linear</div><div class="info-valor">'+_f(t.ml)+'</div></div><div class="fachada-info-item"><div class="info-label">Vão Completo</div><div class="info-valor">'+_f(t.vao)+'</div></div></div>';}
  function _stBadge(st){const m={rascunho:'badge-neutro',em_conferencia:'badge-alerta',aprovado:'badge-sucesso',revisado:'badge-info',cancelado:'badge-perigo'};const l={rascunho:'Rascunho',em_conferencia:'Em conferência',aprovado:'Aprovado',revisado:'Revisado',cancelado:'Cancelado'};return '<span class="badge '+(m[st]||'badge-neutro')+'">'+(l[st]||'Rascunho')+'</span>';}
  function _tipoLabel(t){return{m2:'m²',ml:'ML',vao_completo:'Vão Comp.',misto:'Misto'}[t]||'m²';}
  function _tipoCor(t){return{m2:'info',ml:'alerta',vao_completo:'sucesso',misto:'neutro'}[t]||'info';}
  function _empty(id,ico,txt){const e=document.getElementById(id);if(e)e.innerHTML='<div class="estado-vazio"><div class="icone">'+ico+'</div><p>'+txt+'</p></div>';}

  return {init,carregarTudo,selecionar,novoItem,editarItem,salvarEntidade,excluirItem,novaPeca,editarPeca,salvarPeca,excluirPeca,duplicarPeca,duplicarBalancim,conferirPeca,exportarCSV,exportarVista,onToggleJanela};
})();
const LF = LevantamentoFachada;
function onObraChanged(){LF.init();}

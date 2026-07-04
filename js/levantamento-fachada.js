// ============================================
// Levantamento de Fachada — V4
// UX simplificado, cálculos automáticos
// ============================================
const LevantamentoFachada = (() => {
  let obraId=null;
  let fachadas=[],conjuntos=[],balancins=[],vistas=[],pecas=[];
  let sel={fachadaId:null,conjuntoId:null,balancimId:null,vistaId:null};
  let editandoId=null;
  const COL='levantamentosFachada';

  async function init(){
    const ok=await Utils.initPagina({requireObra:true});
    if(!ok)return;
    obraId=Router.getObraId();
    if(!obraId){document.getElementById('fachada-main').innerHTML='<div class="estado-vazio"><div class="icone">🏗️</div><p>Selecione uma obra na barra lateral.</p></div>';return;}
    document.addEventListener('keydown',e=>{if(e.key==='Escape')Utils.fecharTodosModais();});
    await carregar();
  }

  async function carregar(){
    try{
      Utils.mostrarLoading('Carregando...');
      const todos=await Database.listar(obraId,COL,null);
      fachadas=todos.filter(d=>d.tipo==='fachada');
      conjuntos=todos.filter(d=>d.tipo==='conjunto');
      balancins=todos.filter(d=>d.tipo==='balancim');
      vistas=todos.filter(d=>d.tipo==='vista');
      pecas=todos.filter(d=>d.tipo==='peca');
      renderArvore();renderPainel();
    }catch(e){console.error(e);Utils.toast('Erro ao carregar.','erro');}
    finally{Utils.esconderLoading();}
  }

  // Próximo número de balancim GLOBAL na fachada
  function _proximoBAL(fachadaId){
    const bals=balancins.filter(b=>b.fachadaId===fachadaId);
    // Encontrar o maior número existente
    let max=0;
    bals.forEach(b=>{
      const m=(b.codigo||b.nome||'').match(/(\d+)/);
      if(m)max=Math.max(max,parseInt(m[1]));
    });
    return 'BAL-'+String(max+1).padStart(2,'0');
  }

  // ===================== ÁRVORE =====================
  function renderArvore(){
    const c=document.getElementById('fachada-tree-body');if(!c)return;
    if(!fachadas.length){
      c.innerHTML='<div style="padding:24px 16px;text-align:center;"><p style="color:#94a3b8;font-size:0.85rem;margin-bottom:12px;">Crie sua primeira fachada.</p><button class="btn btn-primario btn-sm" onclick="LF.criarFachada()">+ Nova Fachada</button></div>';
      return;
    }
    let h='';
    fachadas.forEach(f=>{
      const fSel=sel.fachadaId===f.id;
      const nPec=pecas.filter(x=>x.fachadaId===f.id).length;
      h+='<div class="tree-item'+(fSel&&!sel.conjuntoId?' ativo':'')+'" onclick="LF.sel(\'fachada\',\''+f.id+'\')">';
      h+='<span class="tree-toggle">'+(fSel?'▾':'▸')+'</span>';
      h+='<span class="tree-icon">🏢</span>';
      h+='<span class="tree-label" style="font-weight:600;">'+f.nome+'</span>';
      if(nPec>0)h+='<span class="tree-badge">'+nPec+'</span>';
      h+='</div>';

      if(fSel){
        const fConj=conjuntos.filter(x=>x.fachadaId===f.id);
        fConj.forEach(cj=>{
          const cSel=sel.conjuntoId===cj.id;
          const cBal=balancins.filter(x=>x.conjuntoId===cj.id);
          h+='<div class="tree-children"><div class="tree-item'+(cSel&&!sel.balancimId?' ativo':'')+'" onclick="LF.sel(\'conjunto\',\''+cj.id+'\')">';
          h+='<span class="tree-toggle">'+(cSel?'▾':'▸')+'</span>';
          h+='<span class="tree-icon">📦</span>';
          h+='<span class="tree-label">'+cj.nome+'</span>';
          h+='<span class="tree-badge">'+cBal.length+'</span></div>';

          if(cSel){
            cBal.sort((a,b)=>(a.nome||a.codigo||'').localeCompare(b.nome||b.codigo||'',undefined,{numeric:true})).forEach(bl=>{
              const bSel=sel.balancimId===bl.id;
              const bVis=vistas.filter(v=>v.balancimId===bl.id);
              const bPec=pecas.filter(x=>x.balancimId===bl.id);
              h+='<div class="tree-children"><div class="tree-item'+(bSel&&!sel.vistaId?' ativo':'')+'" onclick="LF.sel(\'balancim\',\''+bl.id+'\')">';
              h+='<span class="tree-toggle">'+(bSel?'▾':'▸')+'</span>';
              h+='<span class="tree-icon">⬛</span>';
              h+='<span class="tree-label">'+(bl.nome||bl.codigo)+'</span>';
              if(bPec.length>0)h+='<span class="tree-badge">'+bPec.length+'</span>';
              h+='</div>';

              if(bSel){
                bVis.forEach(vi=>{
                  const vSel=sel.vistaId===vi.id;
                  const vPec=pecas.filter(x=>x.vistaId===vi.id);
                  const ico=vi.tipoVista==='externa'?'🔵':'🟡';
                  const lbl=vi.tipoVista==='externa'?'Vista Externa':'Vista Interna';
                  h+='<div class="tree-children"><div class="tree-item'+(vSel?' ativo':'')+'" onclick="LF.sel(\'vista\',\''+vi.id+'\')">';
                  h+='<span class="tree-toggle"></span>';
                  h+='<span class="tree-icon">'+ico+'</span>';
                  h+='<span class="tree-label">'+lbl+'</span>';
                  if(vPec.length>0)h+='<span class="tree-badge">'+vPec.length+'</span>';
                  h+='</div></div>';
                });
                // + balancim inline
                h+='<div class="tree-children"><div class="tree-item" style="opacity:0.5;font-size:0.78rem;" onclick="LF.criarBalancimRapido(\''+cj.id+'\')"><span class="tree-toggle" style="color:var(--cor-primaria);">+</span><span class="tree-icon"></span><span class="tree-label">adicionar balancim</span></div></div>';
              }
              h+='</div>';
            });
            if(!cBal.length){
              h+='<div class="tree-children"><div class="tree-item" style="opacity:0.5;font-size:0.78rem;" onclick="LF.criarBalancimRapido(\''+cj.id+'\')"><span class="tree-toggle" style="color:var(--cor-primaria);">+</span><span class="tree-icon"></span><span class="tree-label">adicionar balancim</span></div></div>';
            }
          }
          h+='</div>';
        });
        // + conjunto inline
        h+='<div class="tree-children"><div class="tree-item" style="opacity:0.5;font-size:0.78rem;" onclick="LF.criarConjuntoRapido(\''+f.id+'\')"><span class="tree-toggle" style="color:var(--cor-primaria);">+</span><span class="tree-icon"></span><span class="tree-label">adicionar conjunto</span></div></div>';
      }
    });
    c.innerHTML=h;
  }

  // ===================== SELEÇÃO =====================
  function selecionar(tipo,id){
    if(tipo==='fachada')sel={fachadaId:id,conjuntoId:null,balancimId:null,vistaId:null};
    else if(tipo==='conjunto'){const x=conjuntos.find(c=>c.id===id);sel.fachadaId=x?.fachadaId||sel.fachadaId;sel.conjuntoId=id;sel.balancimId=null;sel.vistaId=null;}
    else if(tipo==='balancim'){const x=balancins.find(b=>b.id===id);const cj=conjuntos.find(c=>c.id===x?.conjuntoId);sel.fachadaId=cj?.fachadaId||sel.fachadaId;sel.conjuntoId=x?.conjuntoId||sel.conjuntoId;sel.balancimId=id;sel.vistaId=null;}
    else if(tipo==='vista'){const x=vistas.find(v=>v.id===id);const bl=balancins.find(b=>b.id===x?.balancimId);const cj=conjuntos.find(c=>c.id===bl?.conjuntoId);sel.fachadaId=cj?.fachadaId||sel.fachadaId;sel.conjuntoId=bl?.conjuntoId||sel.conjuntoId;sel.balancimId=x?.balancimId||sel.balancimId;sel.vistaId=id;}
    renderArvore();renderPainel();
  }

  // ===================== CRIAÇÃO RÁPIDA =====================
  async function criarFachada(){
    const nome=prompt('Nome da fachada:');
    if(!nome||!nome.trim())return;
    try{
      Utils.mostrarLoading('Criando...');
      const fId=await Database.criar(obraId,COL,{tipo:'fachada',nome:nome.trim(),status:'rascunho'});
      const cId=await Database.criar(obraId,COL,{tipo:'conjunto',nome:'Conjunto 01',fachadaId:fId});
      const balNome=_proximoBAL(fId);
      const bId=await Database.criar(obraId,COL,{tipo:'balancim',nome:balNome,codigo:balNome,conjuntoId:cId,fachadaId:fId});
      const veId=await Database.criar(obraId,COL,{tipo:'vista',tipoVista:'externa',nome:'Vista Externa',balancimId:bId,conjuntoId:cId,fachadaId:fId});
      await Database.criar(obraId,COL,{tipo:'vista',tipoVista:'interna',nome:'Vista Interna',balancimId:bId,conjuntoId:cId,fachadaId:fId});
      await Audit.criar(obraId,'lev-fachada','fachada',fId,'Criou fachada: '+nome.trim());
      Utils.toast('Fachada criada!','sucesso');
      await carregar();
      sel={fachadaId:fId,conjuntoId:cId,balancimId:bId,vistaId:veId};
      renderArvore();renderPainel();
    }catch(e){console.error(e);Utils.toast('Erro ao criar fachada.','erro');}
    finally{Utils.esconderLoading();}
  }

  async function criarConjuntoRapido(fachadaId){
    const nome=prompt('Nome do conjunto:');
    if(!nome||!nome.trim())return;
    try{
      const cId=await Database.criar(obraId,COL,{tipo:'conjunto',nome:nome.trim(),fachadaId});
      await carregar(); // Recarregar pra _proximoBAL funcionar
      const balNome=_proximoBAL(fachadaId);
      const bId=await Database.criar(obraId,COL,{tipo:'balancim',nome:balNome,codigo:balNome,conjuntoId:cId,fachadaId});
      const veId=await Database.criar(obraId,COL,{tipo:'vista',tipoVista:'externa',nome:'Vista Externa',balancimId:bId,conjuntoId:cId,fachadaId});
      await Database.criar(obraId,COL,{tipo:'vista',tipoVista:'interna',nome:'Vista Interna',balancimId:bId,conjuntoId:cId,fachadaId});
      Utils.toast('Conjunto criado com '+balNome+'!','sucesso');
      await carregar();
      sel.conjuntoId=cId;sel.balancimId=bId;sel.vistaId=veId;
      renderArvore();renderPainel();
    }catch(e){Utils.toast('Erro.','erro');}
  }

  async function criarBalancimRapido(conjuntoId){
    const cj=conjuntos.find(c=>c.id===conjuntoId);
    const fachadaId=cj?.fachadaId||sel.fachadaId;
    const balNome=_proximoBAL(fachadaId);
    const nome=prompt('Nome do balancim:',balNome);
    if(!nome||!nome.trim())return;
    try{
      const bId=await Database.criar(obraId,COL,{tipo:'balancim',nome:nome.trim(),codigo:nome.trim(),conjuntoId,fachadaId});
      const veId=await Database.criar(obraId,COL,{tipo:'vista',tipoVista:'externa',nome:'Vista Externa',balancimId:bId,conjuntoId,fachadaId});
      await Database.criar(obraId,COL,{tipo:'vista',tipoVista:'interna',nome:'Vista Interna',balancimId:bId,conjuntoId,fachadaId});
      Utils.toast(nome.trim()+' criado!','sucesso');
      await carregar();
      sel.balancimId=bId;sel.vistaId=veId;
      renderArvore();renderPainel();
    }catch(e){Utils.toast('Erro.','erro');}
  }

  // ===================== PAINEL =====================
  function renderPainel(){
    const p=document.getElementById('fachada-painel');if(!p)return;
    if(sel.vistaId)return renderPecas(p);
    if(sel.balancimId)return renderBalancim(p);
    if(sel.conjuntoId)return renderConjunto(p);
    if(sel.fachadaId)return renderFachada(p);
    renderGeral(p);
  }

  function renderGeral(p){
    const tot=_somar(pecas);
    let rows=fachadas.map(f=>{const t=_somar(pecas.filter(x=>x.fachadaId===f.id));const nc=conjuntos.filter(x=>x.fachadaId===f.id).length;const np=pecas.filter(x=>x.fachadaId===f.id).length;return '<tr><td><a href="#" onclick="LF.sel(\'fachada\',\''+f.id+'\');return false;"><strong>'+f.nome+'</strong></a></td><td class="col-centro">'+_badge(f.status)+'</td><td class="col-num">'+nc+'</td><td class="col-num">'+np+'</td><td class="col-num">'+_f(t.bruto)+'</td><td class="col-num">'+_f(t.janela)+'</td><td class="col-num" style="font-weight:600;color:var(--cor-primaria);">'+_f(t.liquido)+'</td><td class="col-num">'+_f(t.ml)+'</td><td class="col-num">'+_f(t.vao)+'</td><td class="col-acoes"><button class="btn btn-secundario btn-sm" onclick="LF.editar(\'fachada\',\''+f.id+'\')">✎</button> <button class="btn btn-perigo btn-sm btn-icon" onclick="LF.excluir(\'fachada\',\''+f.id+'\')">✕</button></td></tr>';}).join('');
    p.innerHTML='<div class="page-header"><div><h2>Resumo Geral — Fachada</h2><span class="subtitulo">'+fachadas.length+' fachada(s) · '+pecas.length+' peça(s)</span></div><div class="btn-grupo"><button class="btn btn-secundario btn-sm" onclick="LF.exportarCSV()">📥 CSV</button><button class="btn btn-primario" onclick="LF.criarFachada()">+ Nova Fachada</button></div></div>'+_cards(tot)+'<div class="tabela-container mt-2"><table class="tabela"><thead><tr><th>Fachada</th><th class="col-centro">Status</th><th class="col-num">Conj.</th><th class="col-num">Peças</th><th class="col-num">m² Bruto</th><th class="col-num">m² Jan.</th><th class="col-num">m² Líquido</th><th class="col-num">ML</th><th class="col-num">Vão Fech.</th><th class="col-acoes">Ações</th></tr></thead><tbody>'+(rows||'<tr><td colspan="10" class="text-center text-muted">Clique "+ Nova Fachada" para começar.</td></tr>')+'</tbody></table></div>';
  }

  function renderFachada(p){const f=fachadas.find(x=>x.id===sel.fachadaId);if(!f)return;const fConj=conjuntos.filter(x=>x.fachadaId===f.id);const tot=_somar(pecas.filter(x=>x.fachadaId===f.id));let rows=fConj.map(cj=>{const t=_somarConj(cj.id);const nb=balancins.filter(b=>b.conjuntoId===cj.id).length;return '<tr><td><a href="#" onclick="LF.sel(\'conjunto\',\''+cj.id+'\');return false;"><strong>'+cj.nome+'</strong></a></td><td class="col-num">'+nb+'</td><td class="col-num">'+_f(t.bruto)+'</td><td class="col-num" style="font-weight:600;color:var(--cor-primaria);">'+_f(t.liquido)+'</td><td class="col-num">'+_f(t.ml)+'</td><td class="col-num">'+_f(t.vao)+'</td><td class="col-acoes"><button class="btn btn-secundario btn-sm" onclick="LF.editar(\'conjunto\',\''+cj.id+'\')">✎</button> <button class="btn btn-perigo btn-sm btn-icon" onclick="LF.excluir(\'conjunto\',\''+cj.id+'\')">✕</button></td></tr>';}).join('');p.innerHTML='<div class="page-header"><div><h2>🏢 '+f.nome+'</h2><span class="subtitulo">'+fConj.length+' conjunto(s) · '+_badge(f.status)+'</span></div><div class="btn-grupo"><button class="btn btn-secundario btn-sm" onclick="LF.editar(\'fachada\',\''+f.id+'\')">✎</button><button class="btn btn-primario btn-sm" onclick="LF.criarConjuntoRapido(\''+f.id+'\')">+ Conjunto</button></div></div>'+_cards(tot)+'<div class="tabela-container mt-2"><table class="tabela"><thead><tr><th>Conjunto</th><th class="col-num">Bal.</th><th class="col-num">m² Bruto</th><th class="col-num">m² Líquido</th><th class="col-num">ML</th><th class="col-num">Vão</th><th class="col-acoes">Ações</th></tr></thead><tbody>'+(rows||'<tr><td colspan="7" class="text-center text-muted">Nenhum conjunto.</td></tr>')+'</tbody></table></div>';}

  function renderConjunto(p){const cj=conjuntos.find(x=>x.id===sel.conjuntoId);if(!cj)return;const cBal=balancins.filter(x=>x.conjuntoId===cj.id);const tot=_somarConj(cj.id);let rows=cBal.map(bl=>{const t=_somarBal(bl.id);const np=pecas.filter(x=>x.balancimId===bl.id).length;return '<tr><td><a href="#" onclick="LF.sel(\'balancim\',\''+bl.id+'\');return false;"><strong>'+(bl.nome||bl.codigo)+'</strong></a></td><td class="col-num">'+np+'</td><td class="col-num">'+_f(t.bruto)+'</td><td class="col-num" style="font-weight:600;color:var(--cor-primaria);">'+_f(t.liquido)+'</td><td class="col-num">'+_f(t.ml)+'</td><td class="col-num">'+_f(t.vao)+'</td><td class="col-acoes"><button class="btn btn-secundario btn-sm" onclick="LF.editar(\'balancim\',\''+bl.id+'\')">✎</button> <button class="btn btn-sm btn-icon" onclick="LF.duplicarBal(\''+bl.id+'\')" title="Duplicar">⧉</button> <button class="btn btn-perigo btn-sm btn-icon" onclick="LF.excluir(\'balancim\',\''+bl.id+'\')">✕</button></td></tr>';}).join('');p.innerHTML='<div class="page-header"><div><h2>📦 '+cj.nome+'</h2><span class="subtitulo">'+cBal.length+' balancim(ns)</span></div><div class="btn-grupo"><button class="btn btn-secundario btn-sm" onclick="LF.editar(\'conjunto\',\''+cj.id+'\')">✎</button><button class="btn btn-primario btn-sm" onclick="LF.criarBalancimRapido(\''+cj.id+'\')">+ Balancim</button></div></div>'+_cards(tot)+'<div class="tabela-container mt-2"><table class="tabela"><thead><tr><th>Balancim</th><th class="col-num">Peças</th><th class="col-num">m² Bruto</th><th class="col-num">m² Líquido</th><th class="col-num">ML</th><th class="col-num">Vão</th><th class="col-acoes">Ações</th></tr></thead><tbody>'+(rows||'<tr><td colspan="7" class="text-center text-muted">Nenhum balancim.</td></tr>')+'</tbody></table></div>';}

  function renderBalancim(p){const bl=balancins.find(x=>x.id===sel.balancimId);if(!bl)return;const bVis=vistas.filter(x=>x.balancimId===bl.id);const tot=_somarBal(bl.id);let viCards=bVis.map(vi=>{const vp=pecas.filter(x=>x.vistaId===vi.id);const tv=_somar(vp);const ico=vi.tipoVista==='externa'?'🔵':'🟡';const lbl=vi.tipoVista==='externa'?'Vista Externa':'Vista Interna';return '<div class="resumo-card" style="cursor:pointer" onclick="LF.sel(\'vista\',\''+vi.id+'\')"><div class="resumo-label" style="font-size:0.95rem;font-weight:600;">'+ico+' '+lbl+'</div><div class="resumo-valor">'+_f(tv.liquido)+'</div><div class="resumo-unidade">m² líquido · '+vp.length+' peça(s)</div><div style="font-size:0.8rem;color:var(--cor-texto-secundario);margin-top:4px;">ML: '+_f(tv.ml)+' · Vão: '+_f(tv.vao)+'</div></div>';}).join('');p.innerHTML='<div class="page-header"><div><h2>⬛ '+(bl.nome||bl.codigo)+'</h2><span class="subtitulo">Clique em uma vista para cadastrar peças</span></div><div class="btn-grupo"><button class="btn btn-secundario btn-sm" onclick="LF.editar(\'balancim\',\''+bl.id+'\')">✎</button><button class="btn btn-sm btn-secundario" onclick="LF.duplicarBal(\''+bl.id+'\')">⧉ Duplicar</button></div></div>'+_cards(tot)+'<div class="resumo-grid mt-2">'+viCards+'</div>';}

  // ===================== PEÇAS (a calculadora!) =====================
  function renderPecas(p){
    const vi=vistas.find(x=>x.id===sel.vistaId);if(!vi)return;
    const bl=balancins.find(x=>x.id===vi.balancimId);
    const cj=conjuntos.find(x=>x.id===bl?.conjuntoId);
    const ico=vi.tipoVista==='externa'?'🔵':'🟡';
    const lbl=vi.tipoVista==='externa'?'Vista Externa':'Vista Interna';
    const vPec=pecas.filter(x=>x.vistaId===vi.id);
    let rows='',tB=0,tJ=0,tL=0,tM=0,tV=0;
    vPec.forEach((pc,i)=>{
      const c=_calc(pc);tB+=c.bruto;tJ+=c.janela;tL+=c.liquido;tM+=c.ml;tV+=c.vao;
      const al=_validar(pc,c);const ai=al.length?'<span title="'+al.join('; ')+'" style="color:var(--cor-alerta);cursor:help;margin-left:4px;">⚠</span>':'';
      rows+='<tr><td>'+(i+1)+'</td><td>'+pc.nome+ai+'</td><td class="col-num">'+_f(pc.comprimento)+'</td><td class="col-num">'+_f(pc.altura)+'</td><td class="col-num col-centro">'+(pc.quantidade||1)+'</td><td class="col-centro">'+(pc.possuiJanela?'✓':'')+'</td><td class="col-centro">'+(pc.possuiVaoFechado?'✓':'')+'</td><td class="col-num">'+_f(c.bruto)+'</td><td class="col-num">'+_f(c.janela)+'</td><td class="col-num" style="font-weight:600;color:var(--cor-primaria);">'+_f(c.liquido)+'</td><td class="col-num">'+_f(c.ml)+'</td><td class="col-num">'+_f(c.vao)+'</td><td class="text-sm">'+(pc.acabamento||'')+'</td><td class="col-centro">'+(pc.conferido?'✅':'')+'</td><td class="col-acoes" style="white-space:nowrap;"><button class="btn btn-secundario btn-sm" onclick="LF.editarPeca(\''+pc.id+'\')">✎</button> <button class="btn btn-sm btn-icon" onclick="LF.duplicarPeca(\''+pc.id+'\')" title="Duplicar">⧉</button> <button class="btn btn-sm btn-icon" onclick="LF.conferirPeca(\''+pc.id+'\')">'+(pc.conferido?'↩':'✓')+'</button> <button class="btn btn-perigo btn-sm btn-icon" onclick="LF.excluirPeca(\''+pc.id+'\')">✕</button></td></tr>';
    });
    const path=(cj?.nome||'')+' › '+(bl?.nome||'')+' › '+lbl;
    p.innerHTML='<div class="page-header"><div><h2>'+ico+' '+lbl+' — '+(bl?.nome||'')+'</h2><span class="subtitulo">'+path+' · '+vPec.length+' peça(s)</span></div><div class="btn-grupo"><button class="btn btn-secundario btn-sm" onclick="LF.exportarVista()">📥 CSV</button><button class="btn btn-primario" onclick="LF.novaPeca()">+ Nova Peça</button></div></div><div class="fachada-info-bar"><div class="fachada-info-item"><div class="info-label">m² Bruto</div><div class="info-valor">'+_f(tB)+'</div></div><div class="fachada-info-item"><div class="info-label">m² Janelas</div><div class="info-valor">'+_f(tJ)+'</div></div><div class="fachada-info-item"><div class="info-label">m² Líquido</div><div class="info-valor destaque">'+_f(tL)+'</div></div><div class="fachada-info-item"><div class="info-label">Metro Linear</div><div class="info-valor">'+_f(tM)+'</div></div><div class="fachada-info-item"><div class="info-label">Vão Fechado</div><div class="info-valor">'+_f(tV)+'</div></div></div><div class="tabela-container mt-2"><table class="tabela tabela-compacta"><thead><tr><th class="col-sm">#</th><th>Peça</th><th class="col-num">Comp</th><th class="col-num">Alt</th><th class="col-num col-centro">Qtd</th><th class="col-centro">Jan</th><th class="col-centro">Vão</th><th class="col-num">m² Brut</th><th class="col-num">m² Jan</th><th class="col-num">m² Líq</th><th class="col-num">ML</th><th class="col-num">Vão F.</th><th>Acab.</th><th class="col-centro">Conf</th><th class="col-acoes">Ações</th></tr></thead><tbody>'+(rows||'<tr><td colspan="15" class="text-center text-muted">Clique "+ Nova Peça" para começar.</td></tr>')+'</tbody><tfoot><tr><td></td><td><strong>TOTAL</strong></td><td></td><td></td><td></td><td></td><td></td><td class="col-num">'+_f(tB)+'</td><td class="col-num">'+_f(tJ)+'</td><td class="col-num" style="font-weight:700;color:var(--cor-primaria);">'+_f(tL)+'</td><td class="col-num">'+_f(tM)+'</td><td class="col-num">'+_f(tV)+'</td><td></td><td></td><td></td></tr></tfoot></table></div>';
  }

  // ===================== CÁLCULOS AUTOMÁTICOS =====================
  // Tudo é calculado a partir das medidas brutas — sem seletor de tipo
  function _calc(pc){
    const co=_pn(pc.comprimento),al=_pn(pc.altura),qt=_pn(pc.quantidade)||1;
    // m² bruto sempre
    const bruto=co*al*qt;
    // Desconto janela
    let janela=0;
    if(pc.possuiJanela)janela=_pn(pc.larguraJanela)*_pn(pc.alturaJanela)*(_pn(pc.quantidadeJanelas)||1)*qt;
    // m² líquido
    const liquido=Math.max(0,bruto-janela);
    // ML sempre calculado (comprimento × qtd)
    const ml=co*qt;
    // Vão fechado (área separada)
    let vao=0;
    if(pc.possuiVaoFechado)vao=_pn(pc.comprimentoVao)*_pn(pc.alturaVao)*qt;
    return{bruto,janela,liquido,ml,vao};
  }
  function _somar(l){let b=0,j=0,q=0,m=0,v=0;l.forEach(pc=>{const c=_calc(pc);b+=c.bruto;j+=c.janela;q+=c.liquido;m+=c.ml;v+=c.vao;});return{bruto:b,janela:j,liquido:q,ml:m,vao:v};}
  function _somarBal(id){return _somar(pecas.filter(x=>x.balancimId===id));}
  function _somarConj(id){return _somar(pecas.filter(pc=>balancins.filter(b=>b.conjuntoId===id).some(b=>b.id===pc.balancimId)));}
  function _validar(pc,c){const a=[];if(!pc.nome)a.push('Sem nome');if(_pn(pc.comprimento)<=0)a.push('Comp. inválido');if(c&&c.liquido<0)a.push('Área negativa');if(pc.possuiJanela&&_pn(pc.larguraJanela)*_pn(pc.alturaJanela)>_pn(pc.comprimento)*_pn(pc.altura))a.push('Janela > peça');return a;}

  // ===================== CRUD PEÇA =====================
  function novaPeca(){
    if(!sel.vistaId){Utils.toast('Selecione uma vista.','alerta');return;}
    editandoId=null;
    document.getElementById('modal-peca-titulo').textContent='Nova Peça';
    Utils.limparForm('form-peca');
    document.querySelector('#form-peca [name="quantidade"]').value=1;
    document.querySelector('#form-peca [name="quantidadeJanelas"]').value=1;
    _togJ(false);_togV(false);
    Utils.abrirModal('modal-peca');
  }
  function editarPeca(id){
    const pc=pecas.find(x=>x.id===id);if(!pc)return;
    editandoId=id;
    document.getElementById('modal-peca-titulo').textContent='Editar Peça';
    Utils.setFormData('form-peca',pc);
    _togJ(!!pc.possuiJanela);_togV(!!pc.possuiVaoFechado);
    Utils.abrirModal('modal-peca');
  }
  async function salvarPeca(fechar){
    const data=Utils.getFormData('form-peca');
    if(!data.nome){Utils.toast('Informe o nome.','alerta');return;}
    data.tipo='peca';data.fachadaId=sel.fachadaId;data.conjuntoId=sel.conjuntoId;data.balancimId=sel.balancimId;data.vistaId=sel.vistaId;
    data.comprimento=_pn(data.comprimento);data.altura=_pn(data.altura);data.quantidade=_pn(data.quantidade)||1;
    data.possuiJanela=!!data.possuiJanela;
    data.larguraJanela=_pn(data.larguraJanela);data.alturaJanela=_pn(data.alturaJanela);data.quantidadeJanelas=_pn(data.quantidadeJanelas)||0;
    data.possuiVaoFechado=!!data.possuiVaoFechado;
    data.comprimentoVao=_pn(data.comprimentoVao);data.alturaVao=_pn(data.alturaVao);
    if(data.comprimento<0){Utils.toast('Comprimento negativo.','alerta');return;}
    if(data.quantidade<=0){Utils.toast('Qtd > 0.','alerta');return;}
    try{
      if(editandoId){await Database.atualizar(obraId,COL,editandoId,data);await Audit.editar(obraId,'lev-fachada','peca',editandoId,'Editou: '+data.nome);}
      else{const nid=await Database.criar(obraId,COL,data);await Audit.criar(obraId,'lev-fachada','peca',nid,'Criou: '+data.nome);}
      Utils.toast('Peça salva!','sucesso');editandoId=null;await carregar();
      if(fechar!==false)Utils.fecharModal('modal-peca');
      else{Utils.limparForm('form-peca');document.querySelector('#form-peca [name="quantidade"]').value=1;document.querySelector('#form-peca [name="quantidadeJanelas"]').value=1;_togJ(false);_togV(false);document.querySelector('#form-peca [name="nome"]').focus();}
    }catch(e){console.error(e);Utils.toast('Erro.','erro');}
  }
  async function excluirPeca(id){if(!Utils.confirmar('Excluir peça?'))return;try{await Database.deletar(obraId,COL,id);Utils.toast('Excluída.','sucesso');await carregar();}catch(e){Utils.toast('Erro.','erro');}}
  async function duplicarPeca(id){const pc=pecas.find(x=>x.id===id);if(!pc)return;const cl={...pc};delete cl.id;delete cl.createdAt;delete cl.updatedAt;delete cl.createdBy;delete cl.updatedBy;cl.nome=pc.nome+' (cópia)';cl.conferido=false;try{await Database.criar(obraId,COL,cl);Utils.toast('Duplicada!','sucesso');await carregar();}catch(e){Utils.toast('Erro.','erro');}}
  async function conferirPeca(id){const pc=pecas.find(x=>x.id===id);if(!pc)return;const n=!pc.conferido;try{await Database.atualizar(obraId,COL,id,{conferido:n,conferidoPor:n?Auth.getUid():null,conferidoEm:n?new Date().toISOString():null});Utils.toast(n?'Conferida.':'Desconferida.','sucesso');await carregar();}catch(e){Utils.toast('Erro.','erro');}}

  // ===================== EDITAR/EXCLUIR ENTIDADES =====================
  function editar(tipo,id){const map={fachada:fachadas,conjunto:conjuntos,balancim:balancins,vista:vistas};const item=map[tipo]?.find(x=>x.id===id);if(!item)return;editandoId=id;document.getElementById('modal-ent-titulo').textContent='Editar '+(tipo==='conjunto'?'Conjunto':tipo==='balancim'?'Balancim':tipo==='vista'?'Vista':'Fachada');document.getElementById('form-ent-tipo').value=tipo;document.getElementById('form-ent-id').value=id;document.querySelector('#form-entidade [name="nome"]').value=item.nome||'';document.querySelector('#form-entidade [name="descricao"]').value=item.descricao||'';document.querySelector('#form-entidade [name="status"]').value=item.status||'rascunho';document.getElementById('campo-tipo-vista').classList.toggle('hidden',tipo!=='vista');document.getElementById('campo-status-ent').classList.toggle('hidden',tipo==='vista');if(tipo==='vista')document.querySelector('#form-entidade [name="tipoVista"]').value=item.tipoVista||'externa';Utils.abrirModal('modal-entidade');}
  async function salvarEntidade(){const tipo=document.getElementById('form-ent-tipo').value;const id=document.getElementById('form-ent-id').value;const nome=document.querySelector('#form-entidade [name="nome"]').value.trim();if(!nome){Utils.toast('Informe o nome.','alerta');return;}const data={nome,descricao:document.querySelector('#form-entidade [name="descricao"]').value.trim(),status:document.querySelector('#form-entidade [name="status"]').value||'rascunho'};if(tipo==='vista')data.tipoVista=document.querySelector('#form-entidade [name="tipoVista"]').value;try{await Database.atualizar(obraId,COL,id,data);Utils.fecharModal('modal-entidade');Utils.toast('Salvo!','sucesso');await carregar();}catch(e){Utils.toast('Erro.','erro');}}
  async function excluir(tipo,id){const map={fachada:fachadas,conjunto:conjuntos,balancim:balancins,vista:vistas};const item=map[tipo]?.find(x=>x.id===id);if(!Utils.confirmar('Excluir "'+item?.nome+'" e tudo vinculado?'))return;try{Utils.mostrarLoading('Excluindo...');await _exc(tipo,id);if(tipo==='fachada')sel={fachadaId:null,conjuntoId:null,balancimId:null,vistaId:null};else if(tipo==='conjunto'){sel.conjuntoId=null;sel.balancimId=null;sel.vistaId=null;}else if(tipo==='balancim'){sel.balancimId=null;sel.vistaId=null;}else if(tipo==='vista')sel.vistaId=null;Utils.toast('Excluído.','sucesso');await carregar();}catch(e){Utils.toast('Erro.','erro');}finally{Utils.esconderLoading();}}
  async function _exc(t,id){if(t==='fachada'){for(const c of conjuntos.filter(x=>x.fachadaId===id))await _exc('conjunto',c.id);for(const pc of pecas.filter(x=>x.fachadaId===id))await Database.deletar(obraId,COL,pc.id);}else if(t==='conjunto'){for(const b of balancins.filter(x=>x.conjuntoId===id))await _exc('balancim',b.id);}else if(t==='balancim'){for(const v of vistas.filter(x=>x.balancimId===id))await _exc('vista',v.id);for(const pc of pecas.filter(x=>x.balancimId===id))await Database.deletar(obraId,COL,pc.id);}else if(t==='vista'){for(const pc of pecas.filter(x=>x.vistaId===id))await Database.deletar(obraId,COL,pc.id);}await Database.deletar(obraId,COL,id);}
  async function duplicarBal(blId){const bl=balancins.find(x=>x.id===blId);if(!bl||!Utils.confirmar('Duplicar "'+bl.nome+'" com peças?'))return;try{Utils.mostrarLoading('Duplicando...');const blC={...bl};delete blC.id;delete blC.createdAt;delete blC.updatedAt;blC.nome=_proximoBAL(bl.fachadaId);blC.codigo=blC.nome;const nbl=await Database.criar(obraId,COL,blC);for(const vi of vistas.filter(v=>v.balancimId===blId)){const viC={...vi};delete viC.id;delete viC.createdAt;delete viC.updatedAt;viC.balancimId=nbl;const nvi=await Database.criar(obraId,COL,viC);for(const pc of pecas.filter(p=>p.vistaId===vi.id)){const pcC={...pc};delete pcC.id;delete pcC.createdAt;delete pcC.updatedAt;pcC.balancimId=nbl;pcC.vistaId=nvi;pcC.conferido=false;await Database.criar(obraId,COL,pcC);}}Utils.toast('Duplicado!','sucesso');await carregar();}catch(e){Utils.toast('Erro.','erro');}finally{Utils.esconderLoading();}}

  // ===================== EXPORTAR =====================
  function exportarCSV(){_csv(pecas,'fachada_geral');}
  function exportarVista(){_csv(pecas.filter(x=>x.vistaId===sel.vistaId),'fachada_vista');}
  function _csv(lista,nome){let csv='Peça;Comp;Alt;Qtd;Janela;Larg Jan;Alt Jan;Qtd Jan;Vão Fech;Comp Vão;Alt Vão;m2 Bruto;m2 Janela;m2 Liquido;ML;Vão Fechado m2;Conferido;Obs\n';lista.forEach(pc=>{const c=_calc(pc);csv+=[pc.nome,pc.comprimento,pc.altura,pc.quantidade,pc.possuiJanela?'Sim':'Nao',pc.larguraJanela||'',pc.alturaJanela||'',pc.quantidadeJanelas||'',pc.possuiVaoFechado?'Sim':'Nao',pc.comprimentoVao||'',pc.alturaVao||'',c.bruto.toFixed(2),c.janela.toFixed(2),c.liquido.toFixed(2),c.ml.toFixed(2),c.vao.toFixed(2),pc.conferido?'Sim':'Nao',pc.observacao||''].join(';')+'\n';});const b=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=nome+'.csv';a.click();URL.revokeObjectURL(u);Utils.toast('Exportado!','sucesso');}

  // ===================== HELPERS =====================
  function _togJ(s){const e=document.getElementById('campos-janela');if(e)e.style.display=s?'grid':'none';}
  function _togV(s){const e=document.getElementById('campos-vao');if(e)e.style.display=s?'grid':'none';}
  function onToggleJanela(cb){_togJ(cb.checked);}
  function onToggleVao(cb){_togV(cb.checked);}
  function _f(n){return Utils.formatarNumero(n);}
  function _pn(v){return Utils.parseNum(v);}
  function _cards(t){return '<div class="fachada-info-bar"><div class="fachada-info-item"><div class="info-label">m² Bruto</div><div class="info-valor">'+_f(t.bruto)+'</div></div><div class="fachada-info-item"><div class="info-label">m² Janelas</div><div class="info-valor">'+_f(t.janela)+'</div></div><div class="fachada-info-item"><div class="info-label">m² Líquido</div><div class="info-valor destaque">'+_f(t.liquido)+'</div></div><div class="fachada-info-item"><div class="info-label">Metro Linear</div><div class="info-valor">'+_f(t.ml)+'</div></div><div class="fachada-info-item"><div class="info-label">Vão Fechado</div><div class="info-valor">'+_f(t.vao)+'</div></div></div>';}
  function _badge(st){const m={rascunho:'badge-neutro',em_conferencia:'badge-alerta',aprovado:'badge-sucesso',revisado:'badge-info',cancelado:'badge-perigo'};const l={rascunho:'Rascunho',em_conferencia:'Em conferência',aprovado:'Aprovado',revisado:'Revisado',cancelado:'Cancelado'};return '<span class="badge '+(m[st]||'badge-neutro')+'">'+(l[st]||'Rascunho')+'</span>';}

  return {init,carregar,sel:selecionar,criarFachada,criarConjuntoRapido,criarBalancimRapido,editar,salvarEntidade,excluir,novaPeca,editarPeca,salvarPeca,excluirPeca,duplicarPeca,duplicarBal,conferirPeca,exportarCSV,exportarVista,onToggleJanela,onToggleVao};
})();
const LF=LevantamentoFachada;
function onObraChanged(){LF.init();}

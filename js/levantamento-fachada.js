// ============================================
// Levantamento de Fachada — V8
// Config de cálculo, vão fechado por vista, sem vão na peça
// ============================================
const LevantamentoFachada = (() => {
  let obraId=null;
  let fachadas=[],balancins=[],vistas=[],pecas=[];
  let sel={fachadaId:null,balancimId:null,vistaId:null};
  let editandoId=null;
  let abaAtiva='resumo';
  const COL='levantamentosFachada';

  // ===================== CONFIGURAÇÕES DE CÁLCULO =====================
  // Salvas no localStorage por obra
  function _getCfg(){
    const d={
      janela_modo:'desconto_total', // 'desconto_total' | 'valor_fixo' | 'metade'
      janela_valor_fixo:1.0,        // m² fixo a considerar do vão
      ml_menor_que:0.50,            // m² — peças menores que isso são ML
      ml_percentual:50              // % do m² que conta (padrão 50%)
    };
    try{return Object.assign(d,JSON.parse(localStorage.getItem('fachadaCfg_'+obraId)||'{}'));}catch(e){return d;}
  }
  function _saveCfg(cfg){localStorage.setItem('fachadaCfg_'+obraId,JSON.stringify(cfg));}

  // ===================== INIT =====================
  async function init(){
    const ok=await Utils.initPagina({requireObra:true});if(!ok)return;
    obraId=Router.getObraId();
    if(!obraId){document.getElementById('fachada-main').innerHTML='<div class="estado-vazio"><div class="icone">🏗️</div><p>Selecione uma obra na barra lateral.</p></div>';return;}
    document.addEventListener('keydown',e=>{if(e.key==='Escape')Utils.fecharTodosModais();});
    await carregar();
  }

  async function carregar(){
    try{
      Utils.mostrarLoading('Carregando...');
      const todos=await Database.listar(obraId,COL,null);
      fachadas=todos.filter(d=>d.tipo==='fachada').sort(_sNome);
      balancins=todos.filter(d=>d.tipo==='balancim').sort(_sNome);
      vistas=todos.filter(d=>d.tipo==='vista');
      pecas=todos.filter(d=>d.tipo==='peca');
      renderArvore();renderPainel();
    }catch(e){console.error(e);Utils.toast('Erro ao carregar.','erro');}
    finally{Utils.esconderLoading();}
  }

  function _sNome(a,b){return(a.nome||a.codigo||'').localeCompare(b.nome||b.codigo||'',undefined,{numeric:true});}
  function _proximoBAL(fachadaId){let max=0;balancins.filter(b=>b.fachadaId===fachadaId).forEach(b=>{const m=(b.codigo||b.nome||'').match(/(\d+)/);if(m)max=Math.max(max,parseInt(m[1]));});return 'BAL-'+String(max+1).padStart(2,'0');}
  function _m(cm){return _pn(cm)/100;}

  // ===================== CÁLCULOS COM CONFIG =====================
  function _calc(pc, cfg){
    if(!cfg) cfg=_getCfg();
    const co=_m(_pn(pc.comprimento)), al=_m(_pn(pc.altura)), qt=_pn(pc.quantidade)||1;
    const larJ=_m(_pn(pc.larguraJanela)), altJ=_m(_pn(pc.alturaJanela)), qtJ=_pn(pc.quantidadeJanelas)||0;
    const podeML=!!pc.podeSerML;

    const bruto=co*al*qt;

    // ---- Desconto janela: 4 modos ----
    let janela=0;
    if(pc.possuiJanela && qtJ>0 && larJ>0 && altJ>0){
      const areaUnitaria=larJ*altJ;            // m² de 1 janela
      const areaTotal=areaUnitaria*qtJ*qt;     // m² de todas as janelas
      const limX=_pn(cfg.janela_limite_x)||1.5; // limite de tamanho X
      const valY=_pn(cfg.janela_valor_y)||1.0;  // valor aplicado Y

      if(cfg.janela_modo==='desconto_total'){
        janela=areaTotal;

      } else if(cfg.janela_modo==='parcial_considera'){
        // Vão > X m²: considera apenas Y m², desconta o excedente (areaUnitaria - Y)
        // Vão ≤ X m²: NÃO desconta nada
        if(areaUnitaria>limX){
          const desconto=(areaUnitaria-valY)*qtJ*qt;
          janela=Math.max(0,desconto);
        } else {
          janela=0;
        }

      } else if(cfg.janela_modo==='parcial_desconta'){
        // Vão > X m²: desconta apenas Y m² por vão (mantém o resto)
        // Vão ≤ X m²: NÃO desconta nada
        if(areaUnitaria>limX){
          janela=valY*qtJ*qt;
        } else {
          janela=0;
        }

      } else if(cfg.janela_modo==='metade'){
        janela=areaTotal/2;
      }
    }

    const areaLiq=Math.max(0,bruto-janela);
    const m2semML=areaLiq;
    const maiorLado=Math.max(co,al);
    const ml=podeML?(maiorLado*qt):0;
    const m2comML_puro=podeML?0:areaLiq;

    return{bruto,janela,areaLiq,m2semML,m2comML_puro,ml,podeML};
  }

  // Soma peças (com cfg) + vão das vistas
  function _somar(listaPecas, listaVistas){
    const cfg=_getCfg(); // carrega config uma vez para todo o batch
    let m2semML=0,m2comML_puro=0,ml=0,bruto=0,janela=0;
    listaPecas.forEach(pc=>{
      const c=_calc(pc, cfg);
      m2semML+=c.m2semML; m2comML_puro+=c.m2comML_puro;
      ml+=c.ml; bruto+=c.bruto; janela+=c.janela;
    });
    let vao=0;
    if(listaVistas){
      listaVistas.forEach(vi=>{
        const coV=_m(_pn(vi.vaoComp)), alV=_m(_pn(vi.vaoAlt));
        vao+=coV*alV;
      });
    }
    const m2comML_equiv=m2comML_puro+(ml/2);
    return{m2semML,m2comML_puro,ml,m2comML_equiv,vao,bruto,janela};
  }

  function _somarBal(blId){
    return _somar(pecas.filter(x=>x.balancimId===blId), vistas.filter(v=>v.balancimId===blId));
  }
  function _somarFachada(fId){
    const bIds=balancins.filter(b=>b.fachadaId===fId).map(b=>b.id);
    const fVis=vistas.filter(v=>bIds.includes(v.balancimId));
    return _somar(pecas.filter(x=>x.fachadaId===fId), fVis);
  }
  function _somarGeral(){
    return _somar(pecas, vistas);
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
      h+=_ti(f.id,'fachada','🏢',f.nome,nPec,fSel&&!sel.balancimId,true,true);
      if(fSel){
        h+='<div class="tree-children">';
        balancins.filter(x=>x.fachadaId===f.id).forEach(bl=>{
          const bSel=sel.balancimId===bl.id;
          const bPec=pecas.filter(x=>x.balancimId===bl.id).length;
          h+=_ti(bl.id,'balancim','⬛',bl.nome||bl.codigo,bPec,bSel&&!sel.vistaId,true,true);
          if(bSel){
            h+='<div class="tree-children">';
            vistas.filter(v=>v.balancimId===bl.id).sort((a,b)=>a.tipoVista==='externa'?-1:1).forEach(vi=>{
              const vSel=sel.vistaId===vi.id;
              const vPec=pecas.filter(x=>x.vistaId===vi.id).length;
              const ico=vi.tipoVista==='externa'?'🔵':'🟡';
              const lbl=vi.tipoVista==='externa'?'Vista Externa':'Vista Interna';
              h+=_ti(vi.id,'vista',ico,lbl,vPec,vSel,false);
            });
            h+='<div class="tree-item" style="opacity:0.5;font-size:0.78rem;" onclick="event.stopPropagation();LF.criarBalancim(\''+f.id+'\')"><span class="tree-toggle" style="color:var(--cor-primaria);">+</span><span class="tree-label">adicionar balancim</span></div>';
            h+='</div>';
          }
        });
        h+='<div class="tree-item" style="opacity:0.5;font-size:0.78rem;" onclick="event.stopPropagation();LF.criarBalancim(\''+f.id+'\')"><span class="tree-toggle" style="color:var(--cor-primaria);">+</span><span class="tree-label">adicionar balancim</span></div>';
        h+='</div>';
      }
    });
    c.innerHTML=h;
  }

  function _ti(id,tipo,icon,label,badge,ativo,hasT,showDel){
    const delBtn=showDel
      ?'<button class="tree-del-btn" onclick="event.stopPropagation();LF.excluir(\''+tipo+'\',\''+id+'\')" title="Excluir">✕</button>'
      :'';
    return '<div class="tree-item'+(ativo?' ativo':'')+'" onclick="LF.sel(\''+tipo+'\',\''+id+'\')">'+
      '<span class="tree-toggle">'+(hasT?(ativo?'▾':'▸'):'')+'</span>'+
      '<span class="tree-icon">'+icon+'</span>'+
      '<span class="tree-label"'+(tipo==='fachada'?' style="font-weight:600;"':'')+'>'+label+'</span>'+
      (badge>0?'<span class="tree-badge">'+badge+'</span>':'')+
      delBtn+
      '</div>';
  }

  // ===================== SELEÇÃO COM TOGGLE =====================
  function selecionar(tipo,id){
    if(tipo==='fachada'){if(sel.fachadaId===id&&!sel.balancimId)sel={fachadaId:null,balancimId:null,vistaId:null};else sel={fachadaId:id,balancimId:null,vistaId:null};}
    else if(tipo==='balancim'){if(sel.balancimId===id&&!sel.vistaId){sel.balancimId=null;sel.vistaId=null;}else{const bl=balancins.find(b=>b.id===id);sel.fachadaId=bl?.fachadaId||sel.fachadaId;sel.balancimId=id;sel.vistaId=null;}}
    else if(tipo==='vista'){const vi=vistas.find(v=>v.id===id);const bl=balancins.find(b=>b.id===vi?.balancimId);sel.fachadaId=bl?.fachadaId||sel.fachadaId;sel.balancimId=vi?.balancimId||sel.balancimId;sel.vistaId=id;}
    renderArvore();renderPainel();
  }

  // ===================== CRIAÇÃO =====================
  async function criarFachada(){
    const nome=prompt('Nome da fachada (ex: Fachada Norte):');
    if(!nome||!nome.trim())return;
    try{
      Utils.mostrarLoading('Criando...');
      const fId=await Database.criar(obraId,COL,{tipo:'fachada',nome:nome.trim(),status:'rascunho'});
      const bNome='BAL-01';
      const bId=await Database.criar(obraId,COL,{tipo:'balancim',nome:bNome,codigo:bNome,fachadaId:fId});
      const veId=await Database.criar(obraId,COL,{tipo:'vista',tipoVista:'externa',nome:'Vista Externa',balancimId:bId,fachadaId:fId});
      await Database.criar(obraId,COL,{tipo:'vista',tipoVista:'interna',nome:'Vista Interna',balancimId:bId,fachadaId:fId});
      await Audit.criar(obraId,'lev-fachada','fachada',fId,'Criou fachada: '+nome.trim());
      Utils.toast('Fachada criada!','sucesso');
      await carregar();
      sel={fachadaId:fId,balancimId:bId,vistaId:veId};
      renderArvore();renderPainel();
    }catch(e){console.error(e);Utils.toast('Erro ao criar fachada.','erro');}
    finally{Utils.esconderLoading();}
  }

  async function criarBalancim(fachadaId){
    const bNome=_proximoBAL(fachadaId);
    const nome=prompt('Nome do balancim:',bNome);
    if(!nome||!nome.trim())return;
    try{
      const bId=await Database.criar(obraId,COL,{tipo:'balancim',nome:nome.trim(),codigo:nome.trim(),fachadaId});
      const veId=await Database.criar(obraId,COL,{tipo:'vista',tipoVista:'externa',nome:'Vista Externa',balancimId:bId,fachadaId});
      await Database.criar(obraId,COL,{tipo:'vista',tipoVista:'interna',nome:'Vista Interna',balancimId:bId,fachadaId});
      Utils.toast(nome.trim()+' criado!','sucesso');
      await carregar();
      sel.balancimId=bId;sel.vistaId=veId;
      renderArvore();renderPainel();
    }catch(e){Utils.toast('Erro.','erro');}
  }

  // ===================== PAINEL: Toggle + Roteamento =====================
  function renderPainel(){
    const p=document.getElementById('fachada-painel');if(!p)return;
    // Toggle sempre visível no topo
    const toggleHtml='<div class="aba-toggle mb-2"><button class="aba-btn'+(abaAtiva==='resumo'?' ativo':'')+'" onclick="LF.setAba(\'resumo\')">Resumo Geral</button><button class="aba-btn'+(abaAtiva==='visao'?' ativo':'')+'" onclick="LF.setAba(\'visao\')">Visão Geral</button></div>';

    if(abaAtiva==='visao') return renderVisaoGeral(p, toggleHtml);

    // Aba Resumo Geral
    if(sel.vistaId) return renderPecas(p, toggleHtml);
    if(sel.balancimId) return renderBalancim(p, toggleHtml);
    if(sel.fachadaId) return renderFachada(p, toggleHtml);
    renderGeral(p, toggleHtml);
  }

  function setAba(aba){abaAtiva=aba;renderPainel();}

  // ===================== CARDS DE MÉTRICAS =====================
  function _cards(t){
    // m² com ML exibe: Xm² e XML = X total
    const comMLstr=_f(t.m2comML_puro)+'m² e '+_f(t.ml)+'ML';
    const comMLequiv='= '+_f(t.m2comML_equiv)+'m²';
    return '<div class="fachada-info-bar">'+
      '<div class="fachada-info-item">'+
        '<div class="info-label">m² sem ML</div>'+
        '<div class="info-valor destaque">'+_f(t.m2semML)+'</div>'+
        '<div class="info-sub">tudo como m²</div>'+
      '</div>'+
      '<div class="fachada-info-item">'+
        '<div class="info-label">m² com ML</div>'+
        '<div class="info-valor" style="font-size:0.95rem;">'+comMLstr+'</div>'+
        '<div class="info-sub">'+comMLequiv+'</div>'+
      '</div>'+
      '<div class="fachada-info-item">'+
        '<div class="info-label">m² Vão Fechado</div>'+
        '<div class="info-valor">'+_f(t.vao)+'</div>'+
        '<div class="info-sub">apenas vãos</div>'+
      '</div>'+
      '</div>';
  }

  // ===================== RESUMO GERAL =====================
  function renderGeral(p, toggle){
    const tot=_somarGeral();
    let rows=fachadas.map(f=>{
      const t=_somarFachada(f.id);
      const nb=balancins.filter(b=>b.fachadaId===f.id).length;
      const np=pecas.filter(x=>x.fachadaId===f.id).length;
      return '<tr><td><a href="#" onclick="LF.sel(\'fachada\',\''+f.id+'\');return false;"><strong>'+f.nome+'</strong></a></td>'+
        '<td class="col-centro">'+_badge(f.status)+'</td>'+
        '<td class="col-num">'+nb+'</td><td class="col-num">'+np+'</td>'+
        '<td class="col-num" style="font-weight:600;color:var(--cor-primaria);">'+_f(t.m2semML)+'</td>'+
        '<td class="col-num">'+_f(t.m2comML_equiv)+'</td>'+
        '<td class="col-num">'+_f(t.ml)+'</td>'+
        '<td class="col-num">'+_f(t.vao)+'</td>'+
        '<td class="col-acoes"><button class="btn btn-secundario btn-sm" onclick="LF.editar(\'fachada\',\''+f.id+'\')">✎</button> <button class="btn btn-perigo btn-sm btn-icon" onclick="LF.excluir(\'fachada\',\''+f.id+'\')">✕</button></td></tr>';
    }).join('');
    p.innerHTML=toggle+
      '<div class="page-header"><div><h2>Resumo Geral</h2><span class="subtitulo">'+fachadas.length+' fachada(s) · '+pecas.length+' peça(s)</span></div>'+
      '<div class="btn-grupo"><button class="btn btn-secundario btn-sm" onclick="LF.exportarCSV()">📥 CSV</button><button class="btn btn-primario" onclick="LF.criarFachada()">+ Nova Fachada</button></div></div>'+
      _cards(tot)+
      '<div class="tabela-container mt-2"><table class="tabela"><thead><tr>'+
      '<th>Fachada</th><th class="col-centro">Status</th><th class="col-num">Bal.</th><th class="col-num">Peças</th>'+
      '<th class="col-num">m² sem ML</th><th class="col-num">m² com ML</th><th class="col-num">ML</th><th class="col-num">Vão Fech.</th>'+
      '<th class="col-acoes">Ações</th></tr></thead>'+
      '<tbody>'+(rows||'<tr><td colspan="9" class="text-center text-muted">Clique "+ Nova Fachada".</td></tr>')+'</tbody></table></div>';
  }

  // ===================== FACHADA =====================
  function renderFachada(p, toggle){
    const f=fachadas.find(x=>x.id===sel.fachadaId);if(!f)return;
    const fp=pecas.filter(x=>x.fachadaId===f.id);
    const tot=_somarFachada(f.id);
    const fBals=balancins.filter(b=>b.fachadaId===f.id);
    let rows=fBals.map(bl=>{
      const t=_somarBal(bl.id);const np=pecas.filter(x=>x.balancimId===bl.id).length;
      return '<tr><td><a href="#" onclick="LF.sel(\'balancim\',\''+bl.id+'\');return false;"><strong>'+(bl.nome||bl.codigo)+'</strong></a></td>'+
        '<td class="col-num">'+np+'</td>'+
        '<td class="col-num" style="font-weight:600;color:var(--cor-primaria);">'+_f(t.m2semML)+'</td>'+
        '<td class="col-num">'+_f(t.m2comML_puro)+'m²<br><span style="font-size:0.75rem;color:var(--cor-texto-muted);">+'+_f(t.ml)+'ML = '+_f(t.m2comML_equiv)+'m²</span></td>'+
        '<td class="col-num">'+_f(t.vao)+'</td>'+
        '<td class="col-acoes"><button class="btn btn-secundario btn-sm" onclick="LF.editar(\'balancim\',\''+bl.id+'\')">✎</button> <button class="btn btn-sm btn-icon" onclick="LF.duplicarBal(\''+bl.id+'\')" title="Duplicar">⧉</button> <button class="btn btn-perigo btn-sm btn-icon" onclick="LF.excluir(\'balancim\',\''+bl.id+'\')">✕</button></td></tr>';
    }).join('');
    p.innerHTML=toggle+
      '<div class="page-header"><div><h2>🏢 '+f.nome+'</h2><span class="subtitulo">'+fBals.length+' balancim(ns) · '+fp.length+' peça(s) · '+_badge(f.status)+'</span></div>'+
      '<div class="btn-grupo"><button class="btn btn-secundario btn-sm" onclick="LF.editar(\'fachada\',\''+f.id+'\')">✎</button><button class="btn btn-primario btn-sm" onclick="LF.criarBalancim(\''+f.id+'\')">+ Balancim</button></div></div>'+
      _cards(tot)+
      '<div class="tabela-container mt-2"><table class="tabela"><thead><tr>'+
      '<th>Balancim</th><th class="col-num">Peças</th>'+
      '<th class="col-num">m² sem ML</th><th class="col-num">m² com ML</th><th class="col-num">Vão F.</th>'+
      '<th class="col-acoes">Ações</th></tr></thead>'+
      '<tbody>'+(rows||'<tr><td colspan="6" class="text-center text-muted">Nenhum balancim.</td></tr>')+'</tbody>'+
      '<tfoot><tr><td><strong>TOTAL</strong></td><td class="col-num">'+fp.length+'</td>'+
      '<td class="col-num" style="font-weight:700;color:var(--cor-primaria);">'+_f(tot.m2semML)+'</td>'+
      '<td class="col-num">'+_f(tot.m2comML_puro)+'m²<br><span style="font-size:0.75rem;color:var(--cor-texto-muted);">+'+_f(tot.ml)+'ML = '+_f(tot.m2comML_equiv)+'m²</span></td>'+
      '<td class="col-num">'+_f(tot.vao)+'</td><td></td></tr></tfoot>'+
      '</table></div>';
  }

  // ===================== BALANCIM =====================
  function renderBalancim(p, toggle){
    const bl=balancins.find(x=>x.id===sel.balancimId);if(!bl)return;
    const bVis=vistas.filter(x=>x.balancimId===bl.id).sort((a,b)=>a.tipoVista==='externa'?-1:1);
    const tot=_somarBal(bl.id);
    let viCards=bVis.map(vi=>{
      const vp=pecas.filter(x=>x.vistaId===vi.id);const tv=_somar(vp,[vi]);
      const ico=vi.tipoVista==='externa'?'🔵':'🟡';
      const lbl=vi.tipoVista==='externa'?'Vista Externa':'Vista Interna';
      const temVao=_pn(vi.vaoComp)>0&&_pn(vi.vaoAlt)>0;
      const vaoM2=_m(_pn(vi.vaoComp))*_m(_pn(vi.vaoAlt));
      return '<div class="resumo-card" style="position:relative;">'+
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">'+
          '<div class="resumo-label" style="font-size:0.95rem;font-weight:600;margin:0;">'+ico+' '+lbl+'</div>'+
          '<button class="btn btn-secundario btn-sm" onclick="LF.abrirVaoVista(\''+vi.id+'\')" title="Vão Fechado">📐 Vão</button>'+
        '</div>'+
        '<div style="cursor:pointer" onclick="LF.sel(\'vista\',\''+vi.id+'\')">'+
          '<div class="resumo-valor">'+_f(tv.m2semML)+'</div>'+
          '<div class="resumo-unidade">m² sem ML · '+vp.length+' peça(s)</div>'+
          (temVao?'<div style="font-size:0.8rem;color:var(--cor-primaria);margin-top:4px;font-weight:600;">📐 Vão: '+_f(vaoM2)+'m²</div>':'<div style="font-size:0.78rem;color:#94a3b8;margin-top:4px;">Sem vão fechado</div>')+
          '<div style="font-size:0.78rem;color:var(--cor-texto-secundario);margin-top:2px;">Clique para ver peças →</div>'+
        '</div>'+
      '</div>';
    }).join('');
    p.innerHTML=toggle+
      '<div class="page-header"><div><h2>⬛ '+(bl.nome||bl.codigo)+'</h2><span class="subtitulo">Clique em uma vista para cadastrar peças</span></div>'+
      '<div class="btn-grupo"><button class="btn btn-secundario btn-sm" onclick="LF.editar(\'balancim\',\''+bl.id+'\')">✎</button><button class="btn btn-sm btn-secundario" onclick="LF.duplicarBal(\''+bl.id+'\')">⧉</button></div></div>'+
      _cards(tot)+'<div class="resumo-grid mt-2">'+viCards+'</div>';
  }

  // Abre modal de vão fechado da vista
  function abrirVaoVista(vistaId){
    const vi=vistas.find(v=>v.id===vistaId);if(!vi)return;
    document.getElementById('vao-vista-id').value=vistaId;
    document.getElementById('vao-vista-label').textContent=(vi.tipoVista==='externa'?'🔵 Vista Externa':'🟡 Vista Interna');
    document.getElementById('vao-comp').value=vi.vaoComp||'';
    document.getElementById('vao-alt').value=vi.vaoAlt||'';
    _atualizarPreviewVao();
    Utils.abrirModal('modal-vao-vista');
  }

  function _atualizarPreviewVao(){
    const co=_m(_pn(document.getElementById('vao-comp').value));
    const al=_m(_pn(document.getElementById('vao-alt').value));
    const m2=co*al;
    const prev=document.getElementById('vao-preview');
    if(prev) prev.textContent=m2>0?_f(m2)+' m²':'—';
  }

  async function salvarVaoVista(){
    const vistaId=document.getElementById('vao-vista-id').value;
    const vaoComp=_pn(document.getElementById('vao-comp').value);
    const vaoAlt=_pn(document.getElementById('vao-alt').value);
    try{
      await Database.atualizar(obraId,COL,vistaId,{vaoComp,vaoAlt});
      Utils.fecharModal('modal-vao-vista');
      Utils.toast('Vão salvo!','sucesso');
      await carregar();
    }catch(e){Utils.toast('Erro.','erro');}
  }

  // ===================== CONFIGURAÇÕES DE CÁLCULO =====================
  function abrirConfig(){
    const cfg=_getCfg();
    document.getElementById('cfg-janela-modo').value=cfg.janela_modo||'desconto_total';
    document.getElementById('cfg-janela-limite').value=cfg.janela_limite_x||'';
    document.getElementById('cfg-janela-valor-y').value=cfg.janela_valor_y||'';
    document.getElementById('cfg-ml-menor').value=cfg.ml_menor_que||0.50;
    document.getElementById('cfg-ml-pct').value=cfg.ml_percentual||50;
    _toggleCfgJanela(cfg.janela_modo||'desconto_total');
    Utils.abrirModal('modal-config');
  }

  function _toggleCfgJanela(modo){
    const row=document.getElementById('cfg-janela-limite-row');
    const hint=document.getElementById('cfg-janela-hint');
    if(!row) return;
    const mostra=modo==='parcial_considera'||modo==='parcial_desconta';
    row.style.display=mostra?'block':'none';
    if(hint){
      if(modo==='parcial_considera') hint.textContent='Considera Y m² por vão';
      else if(modo==='parcial_desconta') hint.textContent='Desconta Y m² por vão';
      else hint.textContent='';
    }
  }

  function onChangeCfgJanela(sel){_toggleCfgJanela(sel.value);}

  function salvarConfig(){
    const cfg={
      janela_modo:document.getElementById('cfg-janela-modo').value||'desconto_total',
      janela_limite_x:_pn(document.getElementById('cfg-janela-limite').value)||1.5,
      janela_valor_y:_pn(document.getElementById('cfg-janela-valor-y').value)||1.0,
      ml_menor_que:_pn(document.getElementById('cfg-ml-menor').value)||0.50,
      ml_percentual:_pn(document.getElementById('cfg-ml-pct').value)||50
    };
    _saveCfg(cfg);
    Utils.fecharModal('modal-config');
    Utils.toast('Configurações salvas! Recalculando...','sucesso');
    renderPainel();
  }
  function renderPecas(p, toggle){
    const vi=vistas.find(x=>x.id===sel.vistaId);if(!vi)return;
    const bl=balancins.find(x=>x.id===vi.balancimId);
    const f=fachadas.find(x=>x.id===bl?.fachadaId);
    const ico=vi.tipoVista==='externa'?'🔵':'🟡';
    const lbl=vi.tipoVista==='externa'?'Vista Externa':'Vista Interna';
    const vPec=pecas.filter(x=>x.vistaId===vi.id);
    const tot=_somar(vPec);
    let rows='';
    vPec.forEach((pc,i)=>{
      const c=_calc(pc);
      rows+='<tr>'+
        '<td>'+(i+1)+'</td>'+
        '<td>'+pc.nome+(c.podeML?'<span class="badge badge-alerta" style="margin-left:4px;font-size:0.65rem;">ML</span>':'')+'</td>'+
        '<td class="col-num">'+_pn(pc.comprimento)+'</td>'+
        '<td class="col-num">'+_pn(pc.altura)+'</td>'+
        '<td class="col-num col-centro">'+(pc.quantidade||1)+'</td>'+
        '<td class="col-centro">'+(pc.possuiJanela?'✓':'')+'</td>'+
        '<td class="col-num" style="font-weight:600;color:var(--cor-primaria);">'+_f(c.m2semML)+'</td>'+
        '<td class="col-num">'+_f(c.vao)+'</td>'+
        '<td class="text-sm">'+(pc.acabamento||'')+'</td>'+
        '<td class="col-centro">'+(pc.conferido?'✅':'')+'</td>'+
        '<td class="col-acoes" style="white-space:nowrap;">'+
        '<button class="btn btn-secundario btn-sm" onclick="LF.editarPeca(\''+pc.id+'\')">✎</button> '+
        '<button class="btn btn-sm btn-icon" onclick="LF.duplicarPeca(\''+pc.id+'\')" title="Duplicar">⧉</button> '+
        '<button class="btn btn-sm btn-icon" onclick="LF.conferirPeca(\''+pc.id+'\')">'+(pc.conferido?'↩':'✓')+'</button> '+
        '<button class="btn btn-perigo btn-sm btn-icon" onclick="LF.excluirPeca(\''+pc.id+'\')">✕</button></td></tr>';
    });
    const path=(f?.nome||'')+' › '+(bl?.nome||'')+' › '+lbl;
    p.innerHTML=toggle+
      '<div class="page-header"><div><h2>'+ico+' '+lbl+' — '+(bl?.nome||'')+'</h2><span class="subtitulo">'+path+' · '+vPec.length+' peça(s)</span></div>'+
      '<div class="btn-grupo"><button class="btn btn-secundario btn-sm" onclick="LF.exportarVista()">📥 CSV</button>'+
      '<button class="btn btn-primario" onclick="LF.novaPeca()">+ Nova Peça</button></div></div>'+
      '<div class="fachada-info-bar">'+
      '<div class="fachada-info-item"><div class="info-label">m² sem ML</div><div class="info-valor destaque">'+_f(tot.m2semML)+'</div><div class="info-sub">tudo como m²</div></div>'+
      '<div class="fachada-info-item"><div class="info-label">m² com ML</div><div class="info-valor" style="font-size:0.95rem;">'+_f(tot.m2comML_puro)+'m² e '+_f(tot.ml)+'ML</div><div class="info-sub">= '+_f(tot.m2comML_equiv)+'m²</div></div>'+
      '<div class="fachada-info-item"><div class="info-label">m² Vão Fechado</div><div class="info-valor">'+_f(tot.vao)+'</div><div class="info-sub">apenas vãos</div></div>'+
      '</div>'+
      '<div class="tabela-container mt-2"><table class="tabela tabela-compacta"><thead><tr>'+
      '<th class="col-sm">#</th><th>Peça</th><th class="col-num">Comp cm</th><th class="col-num">Alt cm</th>'+
      '<th class="col-num col-centro">Qtd</th><th class="col-centro">Jan</th>'+
      '<th class="col-num">m² sem ML</th><th class="col-num">Vão F.</th>'+
      '<th>Acab.</th><th class="col-centro">Conf</th><th class="col-acoes">Ações</th></tr></thead>'+
      '<tbody>'+(rows||'<tr><td colspan="11" class="text-center text-muted">Clique "+ Nova Peça".</td></tr>')+'</tbody>'+
      '<tfoot><tr><td></td><td><strong>TOTAL</strong></td><td></td><td></td><td></td><td></td>'+
      '<td class="col-num" style="font-weight:700;color:var(--cor-primaria);">'+_f(tot.m2semML)+'</td>'+
      '<td class="col-num">'+_f(tot.vao)+'</td>'+
      '<td></td><td></td><td></td></tr></tfoot></table></div>';
  }

  // ===================== VISÃO GERAL (mapa + caixas) =====================
  function renderVisaoGeral(p, toggle){
    // Carregar dados salvos do mapa
    const mapData=JSON.parse(localStorage.getItem('fachadaMap_'+obraId)||'{"img":null,"caixas":[]}');
    const caixasHtml=mapData.caixas.map((cx,i)=>{
      const f=fachadas.find(x=>x.id===cx.fachadaId);
      const t=cx.fachadaId?_somarFachada(cx.fachadaId):{m2semML:0,m2comML_equiv:0,m2comML_puro:0,vao:0};
      const nome=f?f.nome:'Fachada';
      return '<div class="mapa-caixa" id="cx-'+i+'" style="left:'+cx.x+'px;top:'+cx.y+'px;'+(cx.travada?'cursor:default;':'cursor:move;')+'" '+
        (cx.travada?'':'ondragstart="LF.cxDragStart(event,'+i+')" draggable="true"')+'>'+
        '<div class="mapa-caixa-header">'+
          '<span class="mapa-caixa-nome">'+nome+'</span>'+
          '<div class="mapa-caixa-btns">'+
            '<button class="btn btn-sm btn-icon" title="'+(cx.travada?'Destravar':'Travar')+'" onclick="LF.cxTravar('+i+')">'+(cx.travada?'🔒':'🔓')+'</button>'+
            '<button class="btn btn-sm btn-icon" title="Vincular fachada" onclick="LF.cxVincular('+i+')">✎</button>'+
            '<button class="btn btn-perigo btn-sm btn-icon" onclick="LF.cxRemover('+i+')">✕</button>'+
          '</div>'+
        '</div>'+
        '<div class="mapa-caixa-dados">'+
          '<div><span class="mapa-dado-label">m² sem ML</span><span class="mapa-dado-valor">'+_f(t.m2semML)+'</span></div>'+
          '<div><span class="mapa-dado-label">m² com ML</span><span class="mapa-dado-valor">'+_f(t.m2comML_equiv)+'</span></div>'+
          '<div><span class="mapa-dado-label">Vão Fechado</span><span class="mapa-dado-valor">'+_f(t.vao)+'</span></div>'+
        '</div>'+
      '</div>';
    }).join('');

    const imgArea=mapData.img?
      '<img src="'+mapData.img+'" style="width:100%;height:100%;object-fit:contain;position:absolute;top:0;left:0;pointer-events:none;">':
      '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#94a3b8;flex-direction:column;gap:8px;"><div style="font-size:2rem;">📐</div><p>Importe uma planta (PNG/JPG) para começar</p></div>';

    p.innerHTML=toggle+
      '<div class="page-header"><div><h2>Visão Geral</h2><span class="subtitulo">Mapa visual da fachada</span></div>'+
      '<div class="btn-grupo">'+
      '<label class="btn btn-secundario btn-sm" style="cursor:pointer;">📎 Importar Mapa<input type="file" accept="image/*" style="display:none;" onchange="LF.importarMapa(event)"></label>'+
      '<button class="btn btn-secundario btn-sm" onclick="LF.cxAdicionar()">+ Caixa</button>'+
      (mapData.img?'<button class="btn btn-perigo btn-sm" onclick="LF.limparMapa()">🗑 Limpar</button>':'')+
      '</div></div>'+
      '<div class="mapa-container" id="mapa-area" ondragover="event.preventDefault()" ondrop="LF.cxDrop(event)">'+
        imgArea+
        '<div id="mapa-caixas" style="position:absolute;inset:0;pointer-events:none;">'+
          '<div style="position:relative;width:100%;height:100%;pointer-events:none;">'+caixasHtml+'</div>'+
        '</div>'+
      '</div>';
  }

  // ===================== VISÃO GERAL — MAPA =====================
  let _cxDragIdx=null, _cxDragOffX=0, _cxDragOffY=0;

  function importarMapa(e){
    const file=e.target.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{
      const data=_getMapData();data.img=ev.target.result;_saveMapData(data);renderPainel();
    };
    reader.readAsDataURL(file);
  }

  function cxAdicionar(){
    const data=_getMapData();
    data.caixas.push({x:20+(data.caixas.length*20),y:20+(data.caixas.length*20),fachadaId:null,travada:false});
    _saveMapData(data);renderPainel();
  }

  function cxRemover(i){if(!confirm('Remover caixa?'))return;const data=_getMapData();data.caixas.splice(i,1);_saveMapData(data);renderPainel();}

  function cxTravar(i){const data=_getMapData();data.caixas[i].travada=!data.caixas[i].travada;_saveMapData(data);renderPainel();}

  function cxVincular(i){
    const opts=fachadas.map(f=>'<option value="'+f.id+'">'+f.nome+'</option>').join('');
    const data=_getMapData();
    const atual=data.caixas[i].fachadaId||'';
    const sel2=prompt('ID ou nome da fachada — escolha:\n'+fachadas.map((f,j)=>(j+1)+'. '+f.nome).join('\n'));
    if(!sel2)return;
    const idx=parseInt(sel2)-1;
    if(idx>=0&&idx<fachadas.length){data.caixas[i].fachadaId=fachadas[idx].id;_saveMapData(data);renderPainel();}
  }

  function cxDragStart(e,i){_cxDragIdx=i;const el=document.getElementById('cx-'+i);const r=el.getBoundingClientRect();_cxDragOffX=e.clientX-r.left;_cxDragOffY=e.clientY-r.top;}

  function cxDrop(e){
    if(_cxDragIdx===null)return;
    const area=document.getElementById('mapa-area').getBoundingClientRect();
    const x=e.clientX-area.left-_cxDragOffX;
    const y=e.clientY-area.top-_cxDragOffY;
    const data=_getMapData();
    data.caixas[_cxDragIdx].x=Math.max(0,x);
    data.caixas[_cxDragIdx].y=Math.max(0,y);
    _saveMapData(data);_cxDragIdx=null;renderPainel();
  }

  function limparMapa(){if(!confirm('Limpar mapa e todas as caixas?'))return;localStorage.removeItem('fachadaMap_'+obraId);renderPainel();}
  function _getMapData(){return JSON.parse(localStorage.getItem('fachadaMap_'+obraId)||'{"img":null,"caixas":[]}');}
  function _saveMapData(d){localStorage.setItem('fachadaMap_'+obraId,JSON.stringify(d));}

  // ===================== CRUD PEÇA =====================
  function novaPeca(){
    if(!sel.vistaId){Utils.toast('Selecione uma vista.','alerta');return;}
    editandoId=null;document.getElementById('modal-peca-titulo').textContent='Nova Peça';
    Utils.limparForm('form-peca');
    document.querySelector('#form-peca [name="quantidade"]').value=1;
    document.querySelector('#form-peca [name="quantidadeJanelas"]').value=1;
    _togJ(false);Utils.abrirModal('modal-peca');
  }

  function editarPeca(id){
    const pc=pecas.find(x=>x.id===id);if(!pc)return;
    editandoId=id;document.getElementById('modal-peca-titulo').textContent='Editar Peça';
    Utils.setFormData('form-peca',pc);_togJ(!!pc.possuiJanela);Utils.abrirModal('modal-peca');
  }

  async function salvarPeca(fechar){
    const data=Utils.getFormData('form-peca');
    if(!data.nome){Utils.toast('Informe o nome.','alerta');return;}
    data.tipo='peca';data.fachadaId=sel.fachadaId;data.balancimId=sel.balancimId;data.vistaId=sel.vistaId;
    data.comprimento=_pn(data.comprimento);data.altura=_pn(data.altura);data.quantidade=_pn(data.quantidade)||1;
    data.possuiJanela=!!data.possuiJanela;
    data.larguraJanela=_pn(data.larguraJanela);data.alturaJanela=_pn(data.alturaJanela);data.quantidadeJanelas=_pn(data.quantidadeJanelas)||0;
    data.comprimentoVao=_pn(data.comprimentoVao);data.alturaVao=_pn(data.alturaVao);
    data.podeSerML=!!data.podeSerML;
    data.acabamento=(data.acabamento||'').trim();
    if(data.comprimento<0){Utils.toast('Comprimento negativo.','alerta');return;}
    if(data.quantidade<=0){Utils.toast('Qtd > 0.','alerta');return;}
    try{
      if(editandoId){await Database.atualizar(obraId,COL,editandoId,data);}
      else{await Database.criar(obraId,COL,data);}
      Utils.toast('Peça salva!','sucesso');editandoId=null;await carregar();
      if(fechar!==false)Utils.fecharModal('modal-peca');
      else{Utils.limparForm('form-peca');document.querySelector('#form-peca [name="quantidade"]').value=1;document.querySelector('#form-peca [name="quantidadeJanelas"]').value=1;_togJ(false);document.querySelector('#form-peca [name="nome"]').focus();}
    }catch(e){console.error(e);Utils.toast('Erro.','erro');}
  }

  async function excluirPeca(id){if(!Utils.confirmar('Excluir peça?'))return;try{await Database.deletar(obraId,COL,id);Utils.toast('Excluída.','sucesso');await carregar();}catch(e){Utils.toast('Erro.','erro');}}
  async function duplicarPeca(id){const pc=pecas.find(x=>x.id===id);if(!pc)return;const cl={...pc};delete cl.id;delete cl.createdAt;delete cl.updatedAt;delete cl.createdBy;delete cl.updatedBy;cl.nome=pc.nome+' (cópia)';cl.conferido=false;try{await Database.criar(obraId,COL,cl);Utils.toast('Duplicada!','sucesso');await carregar();}catch(e){Utils.toast('Erro.','erro');}}
  async function conferirPeca(id){const pc=pecas.find(x=>x.id===id);if(!pc)return;const n=!pc.conferido;try{await Database.atualizar(obraId,COL,id,{conferido:n,conferidoPor:n?Auth.getUid():null,conferidoEm:n?new Date().toISOString():null});Utils.toast(n?'Conferida.':'Desconferida.','sucesso');await carregar();}catch(e){Utils.toast('Erro.','erro');}}

  // ===================== EDITAR/EXCLUIR ENTIDADES =====================
  function editar(tipo,id){
    const map={fachada:fachadas,balancim:balancins,vista:vistas};
    const item=map[tipo]?.find(x=>x.id===id);if(!item)return;
    editandoId=id;
    document.getElementById('modal-ent-titulo').textContent='Editar '+(tipo==='balancim'?'Balancim':tipo==='vista'?'Vista':'Fachada');
    document.getElementById('form-ent-tipo').value=tipo;
    document.getElementById('form-ent-id').value=id;
    document.querySelector('#form-entidade [name="nome"]').value=item.nome||'';
    document.querySelector('#form-entidade [name="descricao"]').value=item.descricao||'';
    document.querySelector('#form-entidade [name="status"]').value=item.status||'rascunho';
    document.getElementById('campo-tipo-vista').classList.toggle('hidden',tipo!=='vista');
    document.getElementById('campo-status-ent').classList.toggle('hidden',tipo==='vista');
    if(tipo==='vista')document.querySelector('#form-entidade [name="tipoVista"]').value=item.tipoVista||'externa';
    Utils.abrirModal('modal-entidade');
  }

  async function salvarEntidade(){
    const id=document.getElementById('form-ent-id').value;
    const tipo=document.getElementById('form-ent-tipo').value;
    const nome=document.querySelector('#form-entidade [name="nome"]').value.trim();
    if(!nome){Utils.toast('Nome obrigatório.','alerta');return;}
    const data={nome,descricao:document.querySelector('#form-entidade [name="descricao"]').value.trim(),status:document.querySelector('#form-entidade [name="status"]').value||'rascunho'};
    if(tipo==='vista')data.tipoVista=document.querySelector('#form-entidade [name="tipoVista"]').value;
    try{await Database.atualizar(obraId,COL,id,data);Utils.fecharModal('modal-entidade');Utils.toast('Salvo!','sucesso');await carregar();}catch(e){Utils.toast('Erro.','erro');}
  }

  async function excluir(tipo,id){
    const map={fachada:fachadas,balancim:balancins,vista:vistas};
    const item=map[tipo]?.find(x=>x.id===id);
    if(!Utils.confirmar('Excluir "'+item?.nome+'" e tudo vinculado?'))return;
    try{Utils.mostrarLoading('Excluindo...');await _exc(tipo,id);
      if(tipo==='fachada')sel={fachadaId:null,balancimId:null,vistaId:null};
      else if(tipo==='balancim'){sel.balancimId=null;sel.vistaId=null;}
      else if(tipo==='vista')sel.vistaId=null;
      Utils.toast('Excluído.','sucesso');await carregar();
    }catch(e){Utils.toast('Erro.','erro');}finally{Utils.esconderLoading();}
  }

  async function _exc(t,id){
    if(t==='fachada'){for(const b of balancins.filter(x=>x.fachadaId===id))await _exc('balancim',b.id);for(const pc of pecas.filter(x=>x.fachadaId===id))await Database.deletar(obraId,COL,pc.id);}
    else if(t==='balancim'){for(const v of vistas.filter(x=>x.balancimId===id))await _exc('vista',v.id);for(const pc of pecas.filter(x=>x.balancimId===id))await Database.deletar(obraId,COL,pc.id);}
    else if(t==='vista'){for(const pc of pecas.filter(x=>x.vistaId===id))await Database.deletar(obraId,COL,pc.id);}
    await Database.deletar(obraId,COL,id);
  }

  async function duplicarBal(blId){
    const bl=balancins.find(x=>x.id===blId);if(!bl||!Utils.confirmar('Duplicar "'+bl.nome+'" com peças?'))return;
    try{Utils.mostrarLoading('Duplicando...');
      const blC={...bl};delete blC.id;delete blC.createdAt;delete blC.updatedAt;
      blC.nome=_proximoBAL(bl.fachadaId);blC.codigo=blC.nome;
      const nbl=await Database.criar(obraId,COL,blC);
      for(const vi of vistas.filter(v=>v.balancimId===blId)){
        const viC={...vi};delete viC.id;delete viC.createdAt;delete viC.updatedAt;viC.balancimId=nbl;
        const nvi=await Database.criar(obraId,COL,viC);
        for(const pc of pecas.filter(p=>p.vistaId===vi.id)){const pcC={...pc};delete pcC.id;delete pcC.createdAt;delete pcC.updatedAt;pcC.balancimId=nbl;pcC.vistaId=nvi;pcC.conferido=false;await Database.criar(obraId,COL,pcC);}
      }
      Utils.toast('Duplicado!','sucesso');await carregar();
    }catch(e){Utils.toast('Erro.','erro');}finally{Utils.esconderLoading();}
  }

  // ===================== EXPORTAR =====================
  function exportarCSV(){_csv(pecas,'fachada_geral');}
  function exportarVista(){_csv(pecas.filter(x=>x.vistaId===sel.vistaId),'fachada_vista');}
  function _csv(lista,nome){
    let csv='Peça;Comp cm;Alt cm;Qtd;Janela;L-Jan cm;A-Jan cm;Q-Jan;Comp Vão cm;Alt Vão cm;Pode ML;m2 sem ML;m2 com ML;ML;Vão m2;Acabamento;Conferido;Obs\n';
    lista.forEach(pc=>{const c=_calc(pc);csv+=[pc.nome,pc.comprimento,pc.altura,pc.quantidade,pc.possuiJanela?'Sim':'Nao',pc.larguraJanela||'',pc.alturaJanela||'',pc.quantidadeJanelas||'',pc.comprimentoVao||'',pc.alturaVao||'',pc.podeSerML?'Sim':'Nao',c.m2semML.toFixed(2),c.m2comML_puro.toFixed(2),c.ml.toFixed(2),c.vao.toFixed(2),pc.acabamento||'',pc.conferido?'Sim':'Nao',pc.observacao||''].join(';')+'\n';});
    const b=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=nome+'.csv';a.click();URL.revokeObjectURL(u);Utils.toast('Exportado!','sucesso');
  }

  // ===================== HELPERS =====================
  function _togJ(s){const e=document.getElementById('campos-janela');if(e)e.style.display=s?'grid':'none';}
  function onToggleJanela(cb){_togJ(cb.checked);}
  function _f(n){return Utils.formatarNumero(n);}
  function _pn(v){return Utils.parseNum(v);}
  function _badge(st){const m={rascunho:'badge-neutro',em_conferencia:'badge-alerta',aprovado:'badge-sucesso',revisado:'badge-info',cancelado:'badge-perigo'};const l={rascunho:'Rascunho',em_conferencia:'Em conferência',aprovado:'Aprovado',revisado:'Revisado',cancelado:'Cancelado'};return '<span class="badge '+(m[st]||'badge-neutro')+'">'+(l[st]||'Rascunho')+'</span>';}

  return {init,carregar,sel:selecionar,setAba,criarFachada,criarBalancim,editar,salvarEntidade,excluir,novaPeca,editarPeca,salvarPeca,excluirPeca,duplicarPeca,duplicarBal,conferirPeca,exportarCSV,exportarVista,onToggleJanela,importarMapa,cxAdicionar,cxRemover,cxTravar,cxVincular,cxDragStart,cxDrop,limparMapa,abrirVaoVista,salvarVaoVista,_atualizarPreviewVao,abrirConfig,salvarConfig,onChangeCfgJanela};
})();
const LF=LevantamentoFachada;
function onObraChanged(){LF.init();}

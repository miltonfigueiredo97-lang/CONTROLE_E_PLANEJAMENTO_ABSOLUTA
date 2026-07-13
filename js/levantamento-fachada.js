// ============================================
// Levantamento de Fachada — V8
// Config de cálculo, vão fechado por vista, sem vão na peça
// ============================================
const LevantamentoFachada = (() => {
  let obraId=null;
  let fachadas=[],balancins=[],vistas=[],pecas=[];
  // openFachadas: Set of fachadaIds that are expanded (multiple allowed)
  // sel tracks what's actively selected/highlighted
  let openFachadas=new Set();
  let sel={fachadaId:null,balancimId:null,vistaId:null};
  let editandoId=null;
  let abaAtiva='visao';
  let clonarAlvoId=null;
  let _mapaDoc={img:null,caixas:[]};  // carregado do Firestore
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
      let todos=[];
      try{ todos=await Database.listar(obraId,COL,null); }
      catch(e1){
        try{ todos=await Database.listar(obraId,COL,'createdAt'); }
        catch(e2){ todos=[]; }
      }
      fachadas=todos.filter(d=>d.tipo==='fachada').sort(_sNome);
      balancins=todos.filter(d=>d.tipo==='balancim').sort(_sNome);
      vistas=todos.filter(d=>d.tipo==='vista');
      pecas=todos.filter(d=>d.tipo==='peca');
      // Carrega mapa (imagem + caixas + imgState) do Firestore
      try{
        const mapaSnap=await db.collection('obras').doc(obraId).collection('config').doc('mapaVisao').get();
        _mapaDoc=mapaSnap.exists?mapaSnap.data():{img:null,caixas:[],imgState:null};
      }catch(em){ _mapaDoc={img:null,caixas:[],imgState:null}; }
      console.log(`✅ Fachada: ${fachadas.length} fachadas, ${pecas.length} peças, mapa:${_mapaDoc.img?'sim':'não'}`);
      renderArvore(); renderPainel();
    }catch(e){
      console.error('Erro ao carregar fachada:',e);
      Utils.toast('Erro ao carregar: '+e.message,'erro');
    }finally{ Utils.esconderLoading(); }
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
    const m2unitario=qt>0?areaLiq/qt:areaLiq; // m² de 1 peça só, sem multiplicar pela qtd
    const maiorLado=Math.max(co,al);

    // ML: aplica percentual do config (não mais fixo em 50%)
    // ml_percentual = quanto do metro linear conta no equivalente m²
    // Ex: 100% → ml conta como ml inteiro; 50% → ml/2
    const mlPct=_pn(cfg.ml_percentual)/100; // 0.0 a 1.0
    const ml=podeML?(maiorLado*qt):0;
    const m2comML_puro=podeML?0:areaLiq;

    // ---- Friso (arquitetônico ou estrutural) — soma à parte, em ML ----
    let mlFrisoArq=0,mlFrisoEst=0;
    if(pc.possuiFriso){
      const frisoM=_m(_pn(pc.frisoComprimento));
      const qtF=_pn(pc.frisoQuantidade)||0;
      const totalFriso=frisoM*qtF*qt;
      if(pc.frisoTipo==='estrutural') mlFrisoEst=totalFriso;
      else mlFrisoArq=totalFriso;
    }

    return{bruto,janela,areaLiq,m2semML,m2unitario,m2comML_puro,ml,mlPct,podeML,mlFrisoArq,mlFrisoEst};
  }

  function _somar(listaPecas, listaVistas){
    const cfg=_getCfg();
    let m2semML=0,m2comML_puro=0,ml=0,mlEquiv=0,bruto=0,janela=0,mlFrisoArq=0,mlFrisoEst=0;
    listaPecas.forEach(pc=>{
      const c=_calc(pc, cfg);
      m2semML+=c.m2semML; m2comML_puro+=c.m2comML_puro;
      ml+=c.ml; bruto+=c.bruto; janela+=c.janela;
      mlEquiv+=c.ml*c.mlPct; // usa percentual configurado
      mlFrisoArq+=c.mlFrisoArq; mlFrisoEst+=c.mlFrisoEst;
    });
    let vao=0;
    if(listaVistas){
      listaVistas.forEach(vi=>{
        // Vão fechado: pode ter múltiplos (vãos = array) ou legado (vaoComp/vaoAlt)
        if(vi.vaos&&vi.vaos.length){
          vi.vaos.forEach(v=>{
            const coV=_m(_pn(v.comp)),alV=_m(_pn(v.alt)),qtV=_pn(v.qtd)||1;
            vao+=coV*alV*qtV;
          });
        } else {
          const coV=_m(_pn(vi.vaoComp)),alV=_m(_pn(vi.vaoAlt));
          vao+=coV*alV;
        }
      });
    }
    const m2comML_equiv=m2comML_puro+mlEquiv;
    return{m2semML,m2comML_puro,ml,m2comML_equiv,vao,bruto,janela,mlFrisoArq,mlFrisoEst};
  }

  function _somarBal(blId){
    return _somar(pecas.filter(x=>x.balancimId===blId), vistas.filter(v=>v.balancimId===blId));
  }
  function _balIdsFachada(fId){return balancins.filter(b=>b.fachadaId===fId).map(b=>b.id);}
  function _pecasDaFachada(fId){const ids=_balIdsFachada(fId);return pecas.filter(p=>ids.includes(p.balancimId));}
  function _somarFachada(fId){
    const bIds=_balIdsFachada(fId);
    const fVis=vistas.filter(v=>bIds.includes(v.balancimId));
    return _somar(pecas.filter(x=>bIds.includes(x.balancimId)), fVis);
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
      const nPec=_pecasDaFachada(f.id).length;
      h+=_ti(f.id,'fachada','🏢',f.nome,nPec,fSel&&!sel.balancimId,true,true);
      if(openFachadas.has(f.id)||fSel){
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
    const delBtn=showDel?'<button class="tree-del-btn" onclick="event.stopPropagation();LF.excluir(\''+tipo+'\',\''+id+'\')" title="Excluir">✕</button>':'';
    const editBtn='<button class="tree-edit-btn" onclick="event.stopPropagation();LF.editarNomeInline(\"'+tipo+'\",\"'+id+'\")" title="Renomear">✎</button>';
    const cloneBtn=tipo==='balancim'?'<button class="tree-clone-btn" onclick="event.stopPropagation();LF.abrirClonarBal(\''+id+'\')" title="Clonar peças de outro balancim">⧉</button>':'';
    return '<div class="tree-item'+(ativo?' ativo':'')+'" onclick="LF.sel(\''+tipo+'\',\''+id+'\')">'+
      '<span class="tree-toggle">'+(hasT?(ativo?'▾':'▸'):'')+'</span>'+
      '<span class="tree-icon">'+icon+'</span>'+
      '<span class="tree-label"'+(tipo==='fachada'?' style="font-weight:600;"':'')+'>'+label+'</span>'+
      (badge>0?'<span class="tree-badge">'+badge+'</span>':'')+
      editBtn+cloneBtn+delBtn+
      '</div>';
  }

  // ===================== SELEÇÃO COM TOGGLE =====================
  function selecionar(tipo,id){
    if(tipo==='fachada'){
      if(openFachadas.has(id)&&sel.fachadaId===id&&!sel.balancimId){
        openFachadas.delete(id); sel={fachadaId:null,balancimId:null,vistaId:null};
      } else {
        openFachadas.add(id); sel={fachadaId:id,balancimId:null,vistaId:null};
      }
    }
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
    const tree=document.getElementById('fachada-tree');
    const layout=document.getElementById('fachada-layout');

    if(abaAtiva==='visao'){
      // Esconde a coluna Estrutura — tela toda para o mapa
      if(tree){tree.style.display='none';}
      if(layout){layout.style.gridTemplateColumns='1fr';}
      const toggleHtml='<div class="aba-toggle mb-2"><button class="aba-btn ativo" onclick="LF.setAba(\'visao\')">Visão Geral</button><button class="aba-btn" onclick="LF.setAba(\'resumo\')">Resumo Geral</button></div>';
      return renderVisaoGeral(p, toggleHtml);
    }

    // Resumo Geral — mostra coluna Estrutura
    if(tree){tree.style.display='';}
    if(layout){layout.style.gridTemplateColumns='252px 1fr';}
    const toggleHtml='<div class="aba-toggle mb-2"><button class="aba-btn" onclick="LF.setAba(\'visao\')">Visão Geral</button><button class="aba-btn ativo" onclick="LF.setAba(\'resumo\')">Resumo Geral</button></div>';

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
      '<div class="fachada-info-item">'+
        '<div class="info-label">Friso Arquitetônico</div>'+
        '<div class="info-valor" style="font-size:0.95rem;">'+_f(t.mlFrisoArq)+'ML</div>'+
        '<div class="info-sub">comprimento total</div>'+
      '</div>'+
      '<div class="fachada-info-item">'+
        '<div class="info-label">Friso Estrutural</div>'+
        '<div class="info-valor" style="font-size:0.95rem;">'+_f(t.mlFrisoEst)+'ML</div>'+
        '<div class="info-sub">comprimento total</div>'+
      '</div>'+
      '</div>';
  }

  // ===================== RESUMO GERAL =====================
  function renderGeral(p, toggle){
    const tot=_somarGeral();
    let rows=fachadas.map(f=>{
      const t=_somarFachada(f.id);
      const nb=balancins.filter(b=>b.fachadaId===f.id).length;
      const np=_pecasDaFachada(f.id).length;
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
    const fp=_pecasDaFachada(f.id);
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
      return '<div class="resumo-card" style="position:relative;cursor:pointer" onclick="LF.sel(\'vista\',\''+vi.id+'\')">'+
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">'+
          '<div class="resumo-label" style="font-size:0.95rem;font-weight:600;margin:0;">'+ico+' '+lbl+'</div>'+
          '<button class="btn btn-secundario btn-sm" onclick="event.stopPropagation();LF.abrirVaoVista(\''+vi.id+'\')" title="Vão Fechado">📐 Vão</button>'+
        '</div>'+
        '<div>'+
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

  // Abre modal de vão fechado da vista — suporta múltiplos vãos
  function abrirVaoVista(vistaId){
    const vi=vistas.find(v=>v.id===vistaId);if(!vi)return;
    document.getElementById('vao-vista-id').value=vistaId;
    document.getElementById('vao-vista-label').textContent=(vi.tipoVista==='externa'?'🔵 Vista Externa':'🟡 Vista Interna');
    // Carregar vãos existentes (novo formato array ou legado)
    const vaos=vi.vaos&&vi.vaos.length?vi.vaos:[{comp:vi.vaoComp||'',alt:vi.vaoAlt||'',qtd:1}];
    _renderVaosModal(vaos);
    Utils.abrirModal('modal-vao-vista');
  }

  function _renderVaosModal(vaos){
    const container=document.getElementById('vaos-container');if(!container)return;
    container.innerHTML=vaos.map((v,i)=>`
      <div class="vao-row" id="vao-row-${i}" style="display:grid;grid-template-columns:1fr 1fr 80px 32px;gap:8px;align-items:end;margin-bottom:8px;">
        <div class="form-grupo" style="margin:0"><label>Comp (cm)</label>
          <input type="text" inputmode="decimal" class="form-control vao-comp" data-i="${i}" placeholder="Ex: 291+100" value="${v.comp||''}" oninput="LF._atualizarPreviewVao()" onkeydown="LF.calcExprEnter(event)"></div>
        <div class="form-grupo" style="margin:0"><label>Alt (cm)</label>
          <input type="text" inputmode="decimal" class="form-control vao-alt" data-i="${i}" placeholder="Ex: 291+100" value="${v.alt||''}" oninput="LF._atualizarPreviewVao()" onkeydown="LF.calcExprEnter(event)"></div>
        <div class="form-grupo" style="margin:0"><label>Qtd</label>
          <input type="number" class="form-control vao-qtd" data-i="${i}" step="1" min="1" value="${v.qtd||1}" oninput="LF._atualizarPreviewVao()"></div>
        <div class="form-grupo" style="margin:0"><label>&nbsp;</label>
          <button class="btn btn-perigo btn-sm btn-icon" onclick="LF.removerVaoRow(${i})" ${vaos.length<=1?'disabled':''}>✕</button></div>
      </div>`).join('');
    _atualizarPreviewVao();
  }

  function adicionarVaoRow(){
    const rows=document.querySelectorAll('.vao-row');
    const vaos=_getVaosDoModal();
    vaos.push({comp:'',alt:'',qtd:1});
    _renderVaosModal(vaos);
  }

  function removerVaoRow(i){
    const vaos=_getVaosDoModal();
    vaos.splice(i,1);
    _renderVaosModal(vaos);
  }

  function _getVaosDoModal(){
    const comps=document.querySelectorAll('.vao-comp');
    const alts=document.querySelectorAll('.vao-alt');
    const qtds=document.querySelectorAll('.vao-qtd');
    return Array.from(comps).map((_,i)=>({
      comp:_pn(comps[i].value),alt:_pn(alts[i].value),qtd:_pn(qtds[i].value)||1
    }));
  }

  function _atualizarPreviewVao(){
    const vaos=_getVaosDoModal();
    let total=0;
    vaos.forEach(v=>{total+=_m(v.comp)*_m(v.alt)*(v.qtd||1);});
    const prev=document.getElementById('vao-preview');
    if(prev)prev.textContent=total>0?_f(total)+' m²':'—';
  }

  async function salvarVaoVista(){
    const vistaId=document.getElementById('vao-vista-id').value;
    const vaos=_getVaosDoModal().filter(v=>v.comp>0&&v.alt>0);
    try{
      // Salva como array (novo formato)
      await Database.atualizar(obraId,COL,vistaId,{vaos,vaoComp:vaos[0]?.comp||0,vaoAlt:vaos[0]?.alt||0});
      Utils.fecharModal('modal-vao-vista');
      Utils.toast('Vão(s) salvo(s)!','sucesso');
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
    const vPec=pecas.filter(x=>x.vistaId===vi.id).sort(_sNome);
    const tot=_somar(vPec,[vi]);
    let rows='';
    vPec.forEach((pc,i)=>{
      const c=_calc(pc);
      const frisoTxt=pc.possuiFriso&&_pn(pc.frisoComprimento)>0?(_pn(pc.frisoComprimento)+'cm ('+(pc.frisoTipo==='estrutural'?'Est':'Arq')+')'):'—';
      rows+='<tr>'+
        '<td>'+(i+1)+'</td>'+
        '<td>'+pc.nome+'</td>'+
        '<td class="col-num">'+_pn(pc.comprimento)+'</td>'+
        '<td class="col-num">'+_pn(pc.altura)+'</td>'+
        '<td class="col-num col-centro">'+(pc.quantidade||1)+'</td>'+
        '<td class="col-centro">'+(pc.possuiJanela?'✓':'')+'</td>'+
        '<td class="text-sm col-centro">'+frisoTxt+'</td>'+
        '<td class="col-centro"><button class="btn btn-sm btn-icon" onclick="LF.togglePecaML(\''+pc.id+'\')" title="Pode ser considerado ML? (clique para alternar)">'+(c.podeML?'✅':'—')+'</button></td>'+
        '<td class="col-num" style="font-weight:600;color:var(--cor-primaria);">'+_f(c.m2semML)+'</td>'+
        '<td class="col-num text-muted">'+_f(c.m2unitario)+'</td>'+
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
      _cards(tot)+
      '<div class="tabela-container mt-2"><table class="tabela tabela-compacta"><thead><tr>'+
      '<th class="col-sm">#</th><th>Peça</th><th class="col-num">Comp cm</th><th class="col-num">Alt cm</th>'+
      '<th class="col-num col-centro">Qtd</th><th class="col-centro">Jan</th><th class="col-centro">Friso</th><th class="col-centro">ML?</th>'+
      '<th class="col-num">m² sem ML</th><th class="col-num">m² unit.</th>'+
      '<th>Acab.</th><th class="col-centro">Conf</th><th class="col-acoes">Ações</th></tr></thead>'+
      '<tbody>'+(rows||'<tr><td colspan="13" class="text-center text-muted">Clique "+ Nova Peça".</td></tr>')+'</tbody>'+
      '<tfoot><tr><td></td><td><strong>TOTAL</strong></td><td></td><td></td><td></td><td></td><td></td><td></td>'+
      '<td class="col-num" style="font-weight:700;color:var(--cor-primaria);">'+_f(tot.m2semML)+'</td>'+
      '<td class="col-num"></td>'+
      '<td></td><td></td><td></td></tr></tfoot></table></div>';
  }

  // ===================== VISÃO GERAL =====================
  let _imgEditando = false;
  function _imgState(){ return _mapaDoc.imgState || {x:40,y:40,w:0}; }
  function _setImgState(s){ _mapaDoc.imgState = Object.assign(_imgState(), s); }

  function renderVisaoGeral(p, toggle){
    const md=_getMapData(), tot=_somarGeral(), is=_imgState(), ed=_imgEditando;

    const totalCard='<div class="mapa-total-card">'+
      '<span class="mapa-total-title">📊 Total Geral</span>'+
      '<div class="mapa-total-grid">'+
        '<div><span class="mapa-dado-label">m² sem ML</span><span class="mapa-dado-valor">'+_f(tot.m2semML)+'</span></div>'+
        '<div><span class="mapa-dado-label">m² com ML</span><span class="mapa-dado-valor">'+_f(tot.m2comML_equiv)+'</span></div>'+
        '<div><span class="mapa-dado-label">Vão Fechado</span><span class="mapa-dado-valor">'+_f(tot.vao)+'</span></div>'+
        '<div><span class="mapa-dado-label">Friso Arquitetônico</span><span class="mapa-dado-valor">'+_f(tot.mlFrisoArq)+'ML</span></div>'+
        '<div><span class="mapa-dado-label">Friso Estrutural</span><span class="mapa-dado-valor">'+_f(tot.mlFrisoEst)+'ML</span></div>'+
      '</div></div>';

    // Handles da imagem
    const handles=ed?['nw','n','ne','w','e','sw','s','se'].map(d=>{
      const pos={nw:'top:-7px;left:-7px;cursor:nw-resize',n:'top:-7px;left:50%;transform:translateX(-50%);cursor:n-resize',
        ne:'top:-7px;right:-7px;cursor:ne-resize',e:'top:50%;right:-7px;transform:translateY(-50%);cursor:e-resize',
        se:'bottom:-7px;right:-7px;cursor:se-resize',s:'bottom:-7px;left:50%;transform:translateX(-50%);cursor:s-resize',
        sw:'bottom:-7px;left:-7px;cursor:sw-resize',w:'top:50%;left:-7px;transform:translateY(-50%);cursor:w-resize'}[d];
      return '<div data-d="'+d+'" onpointerdown="LF.imgRZEv(event,this)" style="position:absolute;'+pos+
        ';width:14px;height:14px;border-radius:50%;background:var(--cor-primaria);border:2px solid #fff;z-index:5;pointer-events:all;"></div>';
    }).join('') : '';

    const imgArea=md.img?
      '<div id="vi-img" '+(ed?'onpointerdown="LF.imgMD(event)"':'')+' style="position:absolute;'+
        'left:'+is.x+'px;top:'+is.y+'px;width:'+(is.w||'auto')+(is.w?'px':'')+';z-index:1;'+
        'cursor:'+(ed?'move':'default')+';user-select:none;'+
        (ed?'outline:2px dashed var(--cor-primaria);outline-offset:3px;':'')+'">' +
        '<img src="'+md.img+'" draggable="false" style="display:block;width:100%;height:auto;pointer-events:none;">'+
        handles+'</div>'
      :'<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:14px;color:#bbb;">'+
        '<div style="font-size:3rem;">📐</div><p style="margin:0">Importe uma planta</p>'+
        '<label class="btn btn-primario btn-sm" style="cursor:pointer;">📎 Importar'+
          '<input type="file" accept="image/*" style="display:none" onchange="LF.importarMapa(event)"></label></div>';

    const topbar='<div class="visao-geral-topbar">'+toggle+
      '<div class="btn-grupo">'+
        (md.img&&!ed?'<button class="btn btn-secundario btn-sm" onclick="LF.entrarEditImg()">✎ Editar Imagem</button>':'')+
        (md.img&&ed?'<button class="btn btn-primario btn-sm" onclick="LF.sairEditImg()">✓ Confirmar</button>':'')+
        '<label class="btn btn-secundario btn-sm" style="cursor:pointer;">📎 Importar Mapa'+
          '<input type="file" accept="image/*" style="display:none" onchange="LF.importarMapa(event)"></label>'+
        '<button class="btn btn-secundario btn-sm" onclick="LF.cxAdicionar()">+ Caixa</button>'+
        (md.img?'<button class="btn btn-perigo btn-sm" onclick="LF.limparMapa()">🗑 Limpar</button>':'')+
      '</div></div>';

    // Canvas para imagem (overflow:hidden ok)
    // Overlay FORA do canvas — overflow:visible — caixas nunca cortadas
    p.innerHTML=
      '<div class="visao-geral-layout">'+topbar+totalCard+
        '<div style="position:relative;flex:1;min-height:0;">'+
          '<div id="mapa-canvas" style="width:100%;height:100%;background:#fff;border-radius:8px;border:1px solid #e0e0e0;overflow:hidden;position:relative;">'+
            imgArea+
          '</div>'+
          '<div id="mapa-overlay" style="position:absolute;inset:0;pointer-events:none;overflow:visible;z-index:100;"></div>'+
        '</div>'+
      '</div>';

    // Fit imagem primeira vez
    if(md.img&&!is.w){
      const img=document.querySelector('#vi-img img'), cv=document.getElementById('mapa-canvas');
      if(img&&cv){
        const fit=()=>{
          const r=img.naturalWidth/img.naturalHeight, cw=cv.clientWidth-80, ch=cv.clientHeight-80;
          let w=cw, h=w/r; if(h>ch){h=ch;w=h*r;}
          _setImgState({x:40,y:40,w:Math.round(w)});
          const el=document.getElementById('vi-img');
          if(el){el.style.width=_imgState().w+'px';el.style.left='40px';el.style.top='40px';}
          _saveMapData(_getMapData());
        };
        if(img.complete&&img.naturalWidth)fit();else img.onload=fit;
      }
    }
    _renderCaixas(md);
  }

  function _cxRow(l,v){
    return '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:6px;flex-wrap:wrap;">'+
      '<span style="font-size:0.65rem;color:#888;text-transform:uppercase;white-space:nowrap;">'+l+'</span>'+
      '<span style="font-family:var(--font-mono);font-weight:700;font-size:0.88rem;color:var(--cor-primaria);">'+v+'</span></div>';
  }

  function _cxRowML(t){
    return '<div>'+
      '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:6px;flex-wrap:wrap;">'+
        '<span style="font-size:0.65rem;color:#888;text-transform:uppercase;white-space:nowrap;">m² com ML</span>'+
        '<span style="font-family:var(--font-mono);font-weight:700;font-size:0.82rem;color:var(--cor-primaria);text-align:right;">'+_f(t.m2comML_puro)+'m² + '+_f(t.ml)+'ML</span>'+
      '</div>'+
      '<div style="text-align:right;font-size:0.66rem;color:#94a3b8;">= '+_f(t.m2comML_equiv)+'m²</div>'+
    '</div>';
  }

  function _renderCaixas(md){
    const overlay=document.getElementById('mapa-overlay'); if(!overlay)return;
    if(!md)md=_getMapData();
    overlay.innerHTML=md.caixas.map((cx,i)=>{
      const f=fachadas.find(x=>x.id===cx.fachadaId);
      const t=cx.fachadaId?_somarFachada(cx.fachadaId):{m2semML:0,m2comML_puro:0,ml:0,m2comML_equiv:0,vao:0,mlFrisoArq:0,mlFrisoEst:0};
      const nome=f?f.nome:(cx.nome||'Caixa '+(i+1));
      const w=cx.w||220, h=cx.h?'height:'+cx.h+'px;':'';
      const livre=!cx.travada;
      return '<div id="cx-'+i+'" '+
          'style="position:absolute;left:'+cx.x+'px;top:'+cx.y+'px;width:'+w+'px;'+h+
          'pointer-events:all;background:#fff;border:2px solid var(--cor-primaria);border-radius:8px;'+
          'box-shadow:0 4px 20px rgba(0,0,0,0.2);user-select:none;">'+
        // HEADER: é aqui que arrasta — onpointerdown direto no header
        '<div '+(livre?'onpointerdown="LF.cxMouseDown(event,'+i+')"':'')+
          ' style="background:var(--cor-primaria);padding:7px 10px;'+
          'border-radius:6px 6px 0 0;display:flex;align-items:center;gap:5px;'+
          'cursor:'+(livre?'grab':'default')+';">'+
          '<span style="flex:1;font-weight:800;font-size:0.82rem;color:#000;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+nome+'</span>'+
          '<button onclick="LF.cxTravar('+i+')" onpointerdown="event.stopPropagation()" style="border:none;cursor:pointer;'+
            'font-size:0.62rem;font-weight:800;padding:2px 6px;border-radius:3px;'+
            'background:'+(livre?'#dcfce7':'#fee2e2')+';color:'+(livre?'#15803d':'#dc2626')+';"> '+(livre?'LIVRE':'TRAV')+'</button>'+
          '<button onclick="LF.cxEditar('+i+')" onpointerdown="event.stopPropagation()" style="border:none;cursor:pointer;background:rgba(0,0,0,0.12);border-radius:3px;padding:2px 6px;font-size:0.8rem;">✎</button>'+
          '<button onclick="LF.cxRemover('+i+')" onpointerdown="event.stopPropagation()" style="border:none;cursor:pointer;background:rgba(220,38,38,0.15);border-radius:3px;padding:2px 6px;font-size:0.8rem;color:#dc2626;">✕</button>'+
        '</div>'+
        '<div style="padding:10px 12px;display:flex;flex-direction:column;gap:5px;">'+
          _cxRow('m² sem ML',_f(t.m2semML))+
          _cxRowML(t)+
          _cxRow('Vão Fechado',_f(t.vao))+
          (t.mlFrisoArq>0?_cxRow('Friso Arq.',_f(t.mlFrisoArq)+'ML'):'')+
          (t.mlFrisoEst>0?_cxRow('Friso Est.',_f(t.mlFrisoEst)+'ML'):'')+
        '</div>'+
        (livre?'<div data-i="'+i+'" data-d="se" onpointerdown="LF.cxResizeEv(event)" style="position:absolute;bottom:0;right:0;width:18px;height:18px;cursor:se-resize;background:var(--cor-primaria);border-radius:3px 0 6px 0;display:flex;align-items:center;justify-content:center;font-size:0.7rem;color:#000;font-weight:900;">⤡</div>':'')+
      '</div>';
    }).join('');
  }

  function entrarEditImg(){_imgEditando=true;renderPainel();}
  async function sairEditImg(){_imgEditando=false;await _saveMapData(_getMapData());renderPainel();}

  function imgMD(e){
    if(e.button!==0||e.target.dataset.d)return;
    e.preventDefault();e.stopPropagation();
    const el=document.getElementById('vi-img');if(!el)return;
    const is=_imgState(), sx=e.clientX-is.x, sy=e.clientY-is.y;
    el.style.cursor='grabbing';
    try{el.setPointerCapture(e.pointerId);}catch(err){}
    const move=ev=>{is.x=ev.clientX-sx;is.y=ev.clientY-sy;el.style.left=is.x+'px';el.style.top=is.y+'px';};
    const up=()=>{
      el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',up);
      try{el.releasePointerCapture(e.pointerId);}catch(err){}
      el.style.cursor='move';
    };
    el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);
  }

  function imgRZ(e,dir){
    e.preventDefault();e.stopPropagation();
    const el=document.getElementById('vi-img'),imgEl=el?el.querySelector('img'):null;if(!el||!imgEl)return;
    const handle=e.currentTarget||el;
    const sx=e.clientX,sy=e.clientY,sw=el.offsetWidth,sh=el.offsetHeight;
    const is=_imgState(),sl=is.x,st=is.y,ratio=imgEl.naturalWidth/imgEl.naturalHeight;
    try{handle.setPointerCapture(e.pointerId);}catch(err){}
    const move=ev=>{
      const dx=ev.clientX-sx,dy=ev.clientY-sy;let w=sw,x=sl,y=st;
      if(dir==='e')w=Math.max(60,sw+dx);
      else if(dir==='w'){w=Math.max(60,sw-dx);x=sl+(sw-w);}
      else if(dir==='s')w=Math.max(60,sw+dy*ratio);
      else if(dir==='n'){w=Math.max(60,sw-dy*ratio);y=st+(sw-w)/ratio;}
      else if(dir==='se')w=Math.max(60,sw+Math.max(dx,dy*ratio));
      else if(dir==='sw'){w=Math.max(60,sw-Math.min(dx,-dy*ratio));x=sl+(sw-w);}
      else if(dir==='ne'){w=Math.max(60,sw+Math.max(dx,-dy*ratio));y=st-(w-sw)/ratio;}
      else if(dir==='nw'){w=Math.max(60,sw+Math.max(-dx,-dy*ratio));x=sl-(w-sw);y=st-(w-sw)/ratio;}
      is.x=Math.round(x);is.y=Math.round(y);is.w=Math.round(w);
      el.style.left=is.x+'px';el.style.top=is.y+'px';el.style.width=is.w+'px';
    };
    const up=()=>{
      handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',up);handle.removeEventListener('pointercancel',up);
      try{handle.releasePointerCapture(e.pointerId);}catch(err){}
    };
    handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',up);handle.addEventListener('pointercancel',up);
  }
  function imgRZEv(e,el){imgRZ(e,el.dataset.d);}

  function cxMouseDown(e,i){
    if(e.button!==0)return;
    e.preventDefault();e.stopPropagation();
    const el=document.getElementById('cx-'+i);
    if(!el)return;

    const startLeft=parseInt(el.style.left)||0;
    const startTop=parseInt(el.style.top)||0;
    const startX=e.clientX;
    const startY=e.clientY;

    el.style.cursor='grabbing';
    el.style.zIndex='999';
    // Pointer Capture: garante que move/up cheguem neste elemento
    // mesmo se o mouse sair da janela do navegador (evita listener travado)
    try{el.setPointerCapture(e.pointerId);}catch(err){}

    function move(ev){
      const dx=ev.clientX-startX;
      const dy=ev.clientY-startY;
      el.style.left=(startLeft+dx)+'px';
      el.style.top=(startTop+dy)+'px';
    }

    async function up(ev){
      el.removeEventListener('pointermove',move);
      el.removeEventListener('pointerup',up);
      el.removeEventListener('pointercancel',up);
      try{el.releasePointerCapture(e.pointerId);}catch(err){}
      el.style.cursor='grab';
      el.style.zIndex='20';
      const dx=ev.clientX-startX;
      const dy=ev.clientY-startY;
      const data=_getMapData();
      if(data.caixas[i]){
        data.caixas[i].x=startLeft+dx;
        data.caixas[i].y=startTop+dy;
        await _saveMapData(data);
      }
    }

    el.addEventListener('pointermove',move);
    el.addEventListener('pointerup',up);
    el.addEventListener('pointercancel',up);
  }

  function cxResize(e,i,dir){
    e.preventDefault();e.stopPropagation();
    const el=document.getElementById('cx-'+i);if(!el)return;
    const handle=e.currentTarget||el;
    const sx=e.clientX,sy=e.clientY,sw=el.offsetWidth,sh=el.offsetHeight;
    try{handle.setPointerCapture(e.pointerId);}catch(err){}
    const move=ev=>{
      if(dir==='se'||dir==='e')el.style.width=Math.max(160,sw+(ev.clientX-sx))+'px';
      if(dir==='se'||dir==='s')el.style.height=Math.max(80,sh+(ev.clientY-sy))+'px';
    };
    const up=async ev=>{
      handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',up);handle.removeEventListener('pointercancel',up);
      try{handle.releasePointerCapture(e.pointerId);}catch(err){}
      const data=_getMapData();
      if(data.caixas[i]){
        if(dir==='se'||dir==='e')data.caixas[i].w=Math.max(160,sw+(ev.clientX-sx));
        if(dir==='se'||dir==='s')data.caixas[i].h=Math.max(80,sh+(ev.clientY-sy));
        await _saveMapData(data);
      }
    };
    handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',up);handle.addEventListener('pointercancel',up);
  }
  function cxResizeEv(e){const el=e.currentTarget;cxResize(e,parseInt(el.dataset.i),el.dataset.d);}

  function imgMouseDown(e){imgMD(e);}
  function imgResize(e,d){imgRZ(e,d);}
  function toggleEditImg(){} function fecharEditImg(){} function onImgResize(){} function setZoomMapa(){}

  // Salvar imgState no Firestore junto com caixas e img
  function _getMapData(){ return _mapaDoc; }

  async function _saveMapData(d){
    if(!obraId){console.warn('_saveMapData: obraId null');return;}
    _mapaDoc=d;
    try{
      const ref=db.collection('obras').doc(obraId).collection('config').doc('mapaVisao');
      const payload={img:d.img||null,caixas:d.caixas||[],imgState:d.imgState||null,updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
      const sz=JSON.stringify(payload);
      console.log('Salvando mapa:',Math.round(sz.length/1024)+'KB');
      if(sz.length>950000){Utils.toast('Imagem muito grande. Tente um arquivo menor.','erro');return;}
      await ref.set(payload);
      console.log('Mapa salvo');
    }catch(e){console.error('Erro ao salvar mapa:',e.code,e.message);Utils.toast('Erro ao salvar: '+e.message,'erro');}
  }

  // ===================== CRUD PEÇA =====================
  // ===================== CRUD PEÇA =====================
  function _popularAcabamentos(){
    const dl=document.getElementById('lista-acabamentos');if(!dl)return;
    const vistos=new Set();
    let h='';
    pecas.forEach(pc=>{
      const a=(pc.acabamento||'').trim();
      if(a&&!vistos.has(a.toLowerCase())){vistos.add(a.toLowerCase());h+='<option value="'+a.replace(/"/g,'&quot;')+'">';}
    });
    dl.innerHTML=h;
  }

  function novaPeca(){
    if(!sel.vistaId){Utils.toast('Selecione uma vista.','alerta');return;}
    editandoId=null;document.getElementById('modal-peca-titulo').textContent='Nova Peça';
    Utils.limparForm('form-peca');
    document.querySelector('#form-peca [name="quantidade"]').value=1;
    document.querySelector('#form-peca [name="quantidadeJanelas"]').value=1;
    document.querySelector('#form-peca [name="frisoQuantidade"]').value=1;
    _mlManualTouch=false;
    _popularAcabamentos();
    _togJ(false);_togF(false);Utils.abrirModal('modal-peca');
  }

  function editarPeca(id){
    const pc=pecas.find(x=>x.id===id);if(!pc)return;
    editandoId=id;document.getElementById('modal-peca-titulo').textContent='Editar Peça';
    _mlManualTouch=true;
    _popularAcabamentos();
    Utils.setFormData('form-peca',pc);_togJ(!!pc.possuiJanela);_togF(!!pc.possuiFriso);Utils.abrirModal('modal-peca');
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
    data.possuiFriso=!!data.possuiFriso;
    data.frisoComprimento=_pn(data.frisoComprimento);data.frisoTipo=data.frisoTipo||'arquitetonico';data.frisoQuantidade=_pn(data.frisoQuantidade)||0;
    data.acabamento=(data.acabamento||'').trim();
    if(data.comprimento<0){Utils.toast('Comprimento negativo.','alerta');return;}
    if(data.quantidade<=0){Utils.toast('Qtd > 0.','alerta');return;}
    try{
      if(editandoId){await Database.atualizar(obraId,COL,editandoId,data);}
      else{await Database.criar(obraId,COL,data);}
      Utils.toast('Peça salva!','sucesso');editandoId=null;await carregar();
      if(fechar!==false)Utils.fecharModal('modal-peca');
      else{Utils.limparForm('form-peca');document.querySelector('#form-peca [name="quantidade"]').value=1;document.querySelector('#form-peca [name="quantidadeJanelas"]').value=1;document.querySelector('#form-peca [name="frisoQuantidade"]').value=1;_togJ(false);_togF(false);document.querySelector('#form-peca [name="nome"]').focus();}
    }catch(e){console.error(e);Utils.toast('Erro.','erro');}
  }

  async function excluirPeca(id){if(!Utils.confirmar('Excluir peça?'))return;try{await Database.deletar(obraId,COL,id);Utils.toast('Excluída.','sucesso');await carregar();}catch(e){Utils.toast('Erro.','erro');}}
  async function duplicarPeca(id){const pc=pecas.find(x=>x.id===id);if(!pc)return;const cl={...pc};delete cl.id;delete cl.createdAt;delete cl.updatedAt;delete cl.createdBy;delete cl.updatedBy;cl.nome=pc.nome+' (cópia)';cl.conferido=false;try{await Database.criar(obraId,COL,cl);Utils.toast('Duplicada!','sucesso');await carregar();}catch(e){Utils.toast('Erro.','erro');}}
  async function conferirPeca(id){const pc=pecas.find(x=>x.id===id);if(!pc)return;const n=!pc.conferido;try{await Database.atualizar(obraId,COL,id,{conferido:n,conferidoPor:n?Auth.getUid():null,conferidoEm:n?new Date().toISOString():null});Utils.toast(n?'Conferida.':'Desconferida.','sucesso');await carregar();}catch(e){Utils.toast('Erro.','erro');}}
  async function togglePecaML(id){const pc=pecas.find(x=>x.id===id);if(!pc)return;const n=!pc.podeSerML;try{await Database.atualizar(obraId,COL,id,{podeSerML:n});Utils.toast(n?'Marcada como ML.':'Desmarcada como ML.','sucesso');await carregar();}catch(e){Utils.toast('Erro.','erro');}}

  // Sugestão automática do "Pode ser ML" no formulário, baseada na config
  // (peça com área <= ml_menor_que já nasce marcada; double-check manual continua liberado)
  let _mlManualTouch=false;
  function onClickCheckML(){_mlManualTouch=true;}
  function onCompAltInput(){
    if(_mlManualTouch)return;
    const cInp=document.querySelector('#form-peca [name="comprimento"]');
    const aInp=document.querySelector('#form-peca [name="altura"]');
    const cb=document.getElementById('check-ml');
    if(!cInp||!aInp||!cb)return;
    const co=_pn(cInp.value), al=_pn(aInp.value);
    if(!co||!al)return;
    const areaUnit=(co/100)*(al/100);
    const cfg=_getCfg();
    cb.checked=areaUnit<=(_pn(cfg.ml_menor_que)||0.5);
  }

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

  async function corrigirVinculos(){
    if(!Utils.confirmar('Isso revisa todas as peças e vistas e corrige o vínculo com a fachada certa, com base no balancim de cada uma (corrige clones antigos feitos antes da correção). Continuar?'))return;
    try{
      Utils.mostrarLoading('Corrigindo vínculos...');
      let corrigidas=0;
      for(const pc of pecas){
        const bl=balancins.find(b=>b.id===pc.balancimId);
        if(bl&&pc.fachadaId!==bl.fachadaId){
          await Database.atualizar(obraId,COL,pc.id,{fachadaId:bl.fachadaId});
          corrigidas++;
        }
      }
      for(const vi of vistas){
        const bl=balancins.find(b=>b.id===vi.balancimId);
        if(bl&&vi.fachadaId!==bl.fachadaId){
          await Database.atualizar(obraId,COL,vi.id,{fachadaId:bl.fachadaId});
          corrigidas++;
        }
      }
      Utils.toast(corrigidas>0?(corrigidas+' vínculo(s) corrigido(s)!'):'Tudo certo, nada pra corrigir.','sucesso');
      await carregar();
    }catch(e){Utils.toast('Erro ao corrigir.','erro');}finally{Utils.esconderLoading();}
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

  // Clonar peças de OUTRO balancim para dentro deste (mantém nome/código deste)
  function abrirClonarBal(blId){
    const alvo=balancins.find(x=>x.id===blId);if(!alvo)return;
    clonarAlvoId=blId;
    const sel=document.getElementById('clonar-bal-origem');if(!sel)return;
    let h='<option value="">Selecione...</option>';
    fachadas.forEach(f=>{
      const opts=balancins.filter(b=>b.fachadaId===f.id&&b.id!==blId);
      if(!opts.length)return;
      h+='<optgroup label="'+f.nome+'">';
      opts.forEach(b=>{h+='<option value="'+b.id+'">'+(b.nome||b.codigo)+'</option>';});
      h+='</optgroup>';
    });
    sel.innerHTML=h;
    const tit=document.getElementById('clonar-bal-titulo');
    if(tit)tit.textContent='Clonar peças para "'+(alvo.nome||alvo.codigo)+'"';
    Utils.abrirModal('modal-clonar-bal');
  }

  async function confirmarClonarBal(){
    const origemId=document.getElementById('clonar-bal-origem')?.value;
    if(!origemId){Utils.toast('Selecione um balancim de origem.','erro');return;}
    const alvoId=clonarAlvoId;
    const alvo=balancins.find(x=>x.id===alvoId);
    const origem=balancins.find(x=>x.id===origemId);
    if(!alvo||!origem)return;
    const pecasAlvoAtuais=pecas.filter(p=>p.balancimId===alvoId);
    if(pecasAlvoAtuais.length&&!Utils.confirmar('"'+(alvo.nome||alvo.codigo)+'" já possui '+pecasAlvoAtuais.length+' peça(s). Elas serão substituídas pelas peças clonadas de "'+(origem.nome||origem.codigo)+'". Continuar?')){return;}
    Utils.fecharModal('modal-clonar-bal');
    try{
      Utils.mostrarLoading('Clonando peças...');
      for(const pc of pecasAlvoAtuais){await Database.deletar(obraId,COL,pc.id);}
      const vistasOrigem=vistas.filter(v=>v.balancimId===origemId);
      const vistasAlvo=vistas.filter(v=>v.balancimId===alvoId);
      for(const viO of vistasOrigem){
        const viA=vistasAlvo.find(v=>v.tipoVista===viO.tipoVista);
        if(!viA)continue;
        // Clona também o Vão Fechado da vista de origem para a vista de destino
        const vaoUpdate={
          vaos:(viO.vaos&&viO.vaos.length)?viO.vaos.map(v=>({...v})):[],
          vaoComp:viO.vaoComp||null,
          vaoAlt:viO.vaoAlt||null
        };
        await Database.atualizar(obraId,COL,viA.id,vaoUpdate);
        for(const pc of pecas.filter(p=>p.vistaId===viO.id)){
          const pcC={...pc};delete pcC.id;delete pcC.createdAt;delete pcC.updatedAt;
          pcC.balancimId=alvoId;pcC.vistaId=viA.id;pcC.fachadaId=alvo.fachadaId;pcC.conferido=false;
          await Database.criar(obraId,COL,pcC);
        }
      }
      Utils.toast('Peças clonadas!','sucesso');await carregar();
    }catch(e){Utils.toast('Erro ao clonar.','erro');}finally{Utils.esconderLoading();}
  }

  // ===================== EXPORTAR =====================
  function exportarCSV(){_csv(pecas,'fachada_geral');}
  function exportarVista(){_csv(pecas.filter(x=>x.vistaId===sel.vistaId),'fachada_vista');}
  function _csv(lista,nome){
    let csv='Peça;Comp cm;Alt cm;Qtd;Janela;L-Jan cm;A-Jan cm;Q-Jan;Comp Vão cm;Alt Vão cm;Pode ML;Friso;Comp Friso cm;Tipo Friso;Qtd Friso;ML Friso Arq;ML Friso Est;m2 unitario;m2 sem ML;m2 com ML;ML;Acabamento;Conferido;Obs\n';
    lista.forEach(pc=>{const c=_calc(pc);csv+=[pc.nome,pc.comprimento,pc.altura,pc.quantidade,pc.possuiJanela?'Sim':'Nao',pc.larguraJanela||'',pc.alturaJanela||'',pc.quantidadeJanelas||'',pc.comprimentoVao||'',pc.alturaVao||'',pc.podeSerML?'Sim':'Nao',pc.possuiFriso?'Sim':'Nao',pc.frisoComprimento||'',pc.frisoTipo==='estrutural'?'Estrutural':(pc.possuiFriso?'Arquitetônico':''),pc.frisoQuantidade||'',c.mlFrisoArq.toFixed(2),c.mlFrisoEst.toFixed(2),c.m2unitario.toFixed(2),c.m2semML.toFixed(2),c.m2comML_puro.toFixed(2),c.ml.toFixed(2),pc.acabamento||'',pc.conferido?'Sim':'Nao',pc.observacao||''].join(';')+'\n';});
    const b=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=nome+'.csv';a.click();URL.revokeObjectURL(u);Utils.toast('Exportado!','sucesso');
  }

  // ===================== HELPERS =====================
  function _togJ(s){const e=document.getElementById('campos-janela');if(e)e.style.display=s?'grid':'none';}
  function _togF(s){const e=document.getElementById('campos-friso');if(e)e.style.display=s?'grid':'none';}
  // Permite digitar contas simples nos campos de medida (ex: 291+100 + Enter = 391)
  function calcExprEnter(e){
    if(e.key!=='Enter')return;
    e.preventDefault();
    const r=_avaliarExpr(e.target.value);
    if(r!==null){
      e.target.value=_fmtExprResultado(r);
      e.target.dispatchEvent(new Event('input',{bubbles:true}));
    }
  }
  function _avaliarExpr(str){
    if(str==null)return null;
    const s=String(str).trim().replace(/,/g,'.');
    if(!s)return null;
    if(!/^[0-9+\-*/.() ]+$/.test(s))return null; // só permite números e operadores básicos
    if(!/[+\-*/]/.test(s))return null; // sem operador: usuário só digitou um número, não precisa calcular
    try{
      const r=Function('"use strict";return ('+s+')')();
      if(typeof r==='number'&&isFinite(r))return r;
    }catch(err){}
    return null;
  }
  function _fmtExprResultado(n){
    const r=Math.round(n*100)/100;
    return Number.isInteger(r)?String(r):String(r).replace('.',',');
  }

  function onToggleJanela(cb){_togJ(cb.checked);}
  function onToggleFriso(cb){_togF(cb.checked);}
  function _f(n){return Utils.formatarNumero(n);}
  function _pn(v){return Utils.parseNum(v);}
  function _badge(st){const m={rascunho:'badge-neutro',em_conferencia:'badge-alerta',aprovado:'badge-sucesso',revisado:'badge-info',cancelado:'badge-perigo'};const l={rascunho:'Rascunho',em_conferencia:'Em conferência',aprovado:'Aprovado',revisado:'Revisado',cancelado:'Cancelado'};return '<span class="badge '+(m[st]||'badge-neutro')+'">'+(l[st]||'Rascunho')+'</span>';}

  // Editar nome direto na árvore
  async function editarNomeInline(tipo,id){
    const map={fachada:fachadas,balancim:balancins,vista:vistas};
    const obj=(map[tipo]||[]).find(x=>x.id===id);
    const nomeAtual=obj?(obj.nome||obj.codigo||''):'';
    const novo=prompt('Renomear:',nomeAtual);
    if(!novo||!novo.trim()||novo.trim()===nomeAtual)return;
    try{
      await Database.atualizar(obraId,COL,id,{nome:novo.trim()});
      Utils.toast('Renomeado!','sucesso');
      await carregar();
    }catch(e){Utils.toast('Erro.','erro');}
  }

  function importarMapa(e){
    const file=e.target.files[0];if(!file)return;
    Utils.mostrarLoading('Processando imagem...');
    const reader=new FileReader();
    reader.onload=ev=>{
      const img=new Image();
      img.onload=async ()=>{
        try{
          const MAX_W=2400,MAX_H=2400;
          let w=img.width,h=img.height;
          if(w>MAX_W){h=Math.round(h*MAX_W/w);w=MAX_W;}
          if(h>MAX_H){w=Math.round(w*MAX_H/h);h=MAX_H;}
          const canvas=document.createElement('canvas');
          canvas.width=w;canvas.height=h;
          canvas.getContext('2d').drawImage(img,0,0,w,h);
          let dataUrl='';
          for(let q=0.85;q>=0.3;q-=0.1){
            dataUrl=canvas.toDataURL('image/jpeg',q);
            if(dataUrl.length<900000)break;
          }
          const data=_getMapData();
          data.img=dataUrl;
          _img={x:40,y:40,w:0}; // reset fit
          await _saveMapData(data);
          renderPainel();
          Utils.toast('Imagem importada!','sucesso');
        }catch(err){
          Utils.toast('Erro ao salvar: '+err.message,'erro');
        }finally{Utils.esconderLoading();}
      };
      img.src=ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  async function cxAdicionar(){
    const data=_getMapData();
    data.caixas.push({x:40+(data.caixas.length*30),y:40+(data.caixas.length*20),fachadaId:null,travada:false,w:220});
    await _saveMapData(data);
    _renderCaixas(data);
  }

  async function cxRemover(i){
    if(!confirm('Remover caixa?'))return;
    const data=_getMapData();
    data.caixas.splice(i,1);
    await _saveMapData(data);
    _renderCaixas(data);
  }

  async function cxTravar(i){
    const data=_getMapData();
    if(!data.caixas[i])return;
    data.caixas[i].travada=!data.caixas[i].travada;
    await _saveMapData(data);
    _renderCaixas(data);
  }

  function cxEditar(i){
    const data=_getMapData();const cx=data.caixas[i];if(!cx)return;
    document.getElementById('cx-edit-idx').value=i;
    document.getElementById('cx-edit-nome').value=cx.nome||'';
    const sel=document.getElementById('cx-edit-fachada');
    sel.innerHTML='<option value="">— Sem vínculo —</option>'+
      fachadas.map(f=>'<option value="'+f.id+'"'+(f.id===cx.fachadaId?' selected':'')+'>'+f.nome+'</option>').join('');
    Utils.abrirModal('modal-cx-edit');
  }

  async function salvarCxEdit(){
    const i=parseInt(document.getElementById('cx-edit-idx').value);
    const data=_getMapData();
    if(!data.caixas[i])return;
    data.caixas[i].nome=document.getElementById('cx-edit-nome').value.trim();
    data.caixas[i].fachadaId=document.getElementById('cx-edit-fachada').value||null;
    await _saveMapData(data);
    Utils.fecharModal('modal-cx-edit');
    _renderCaixas(data);
  }

  async function limparMapa(){
    if(!confirm('Limpar mapa e todas as caixas?'))return;
    await _saveMapData({img:null,caixas:[],imgState:null});
    _imgEditando=false;
    renderPainel();
  }

  async function cxDrop(e){ /* não usado — substituído por cxMouseDown */ }

  // Event wrappers for inline handlers that need direction
  function imgRZEv(e, el){ imgRZ(e, el.dataset.d); }
  function cxResizeEv(e){ cxResize(e, parseInt(e.currentTarget.dataset.i), e.currentTarget.dataset.d); }

  return {init,carregar,sel:selecionar,setAba,criarFachada,criarBalancim,editar,salvarEntidade,excluir,novaPeca,editarPeca,salvarPeca,excluirPeca,duplicarPeca,duplicarBal,editarNomeInline,abrirClonarBal,confirmarClonarBal,corrigirVinculos,conferirPeca,togglePecaML,onClickCheckML,onCompAltInput,calcExprEnter,onToggleFriso,exportarCSV,exportarVista,onToggleJanela,importarMapa,cxAdicionar,cxRemover,cxTravar,cxEditar,salvarCxEdit,cxMouseDown,cxDrop,cxResize,imgMouseDown,imgResize,entrarEditImg,sairEditImg,imgMD,imgRZEv,cxResizeEv,toggleEditImg,fecharEditImg,onImgResize,limparMapa,abrirVaoVista,salvarVaoVista,_atualizarPreviewVao,adicionarVaoRow,removerVaoRow,abrirConfig,salvarConfig,onChangeCfgJanela};
})();
const LF=LevantamentoFachada;
function onObraChanged(){LF.init();}

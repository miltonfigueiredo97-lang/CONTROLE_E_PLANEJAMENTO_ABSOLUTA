// ============================================
// Módulo: Materiais — V1.2
// Biblioteca com UID único + vínculos por tarefa
// ============================================
const Materiais = (() => {
  let obraId=null;
  let biblioteca=[], vinculos=[], tarefas=[], levFachadas=[];
  let abaAtiva='vinculos';
  let filtroTarefa='';
  let editandoBiblId=null, editandoVincId=null;
  const COL_BIB='materiais', COL_VIN='materiais_vinculos';

  // Unidades de consumo: "quantidade por unidade da tarefa"
  const UNIDADES_CONSUMO=[
    'kg/m²','kg/m','kg/un','kg/saco',
    'L/m²','L/m','L/un',
    'm²/m²','m/m²','m/m',
    'un/m²','un/m','un/un',
    'saco/m²','saco/m','saco/un',
    'caixa/m²','caixa/m','caixa/un',
    't/m²','t/m',
  ];
  const UNIDADES_MAT=['kg','L','m²','m','un','saco','caixa','t'];

  async function init(){
    const ok=await Utils.initPagina();if(!ok)return;
    obraId=Router.getObraId();
    if(!obraId){
      const c=document.getElementById('materiais-content');
      if(c)c.innerHTML='<div class="estado-vazio"><div class="icone">🧱</div><p>Selecione uma obra.</p></div>';
      return;
    }
    await carregar();
  }

  async function carregar(){
    try{
      Utils.mostrarLoading('Carregando materiais...');
      [biblioteca,vinculos,tarefas,levFachadas]=await Promise.all([
        Database.listar(obraId,COL_BIB,'nome').catch(()=>[]),
        Database.listar(obraId,COL_VIN,'createdAt').catch(()=>[]),
        Database.listar(obraId,'tarefas','ordem').catch(()=>[]),
        Database.listar(obraId,'levantamentosFachada',null).catch(()=>[]),
      ]);
      renderizar();
    }catch(e){console.error(e);Utils.toast('Erro ao carregar.','erro');}
    finally{Utils.esconderLoading();}
  }

  function renderizar(){
    const c=document.getElementById('materiais-content');if(!c)return;
    c.innerHTML=
      `<div class="page-header">
        <div>
          <h2>Materiais</h2>
          <span class="subtitulo">${biblioteca.length} material(is) na biblioteca · ${vinculos.length} vínculo(s)</span>
        </div>
        <div class="btn-grupo">
          ${abaAtiva==='biblioteca'
            ? `<button class="btn btn-secundario btn-sm" onclick="Materiais.setAba('vinculos')">← Por Tarefa</button>
               <button class="btn btn-primario btn-sm" onclick="Materiais.novoMaterialBib()">+ Novo Material</button>`
            : `<button class="btn btn-secundario btn-sm" onclick="Materiais.setAba('biblioteca')">📚 Biblioteca (${biblioteca.length})</button>
               <button class="btn btn-primario btn-sm" onclick="Materiais.novoVinculo()">+ Vincular / Criar</button>`
          }
        </div>
      </div>
      <div id="mat-corpo">${abaAtiva==='biblioteca'?_renderBib():_renderVinculos()}</div>`;
  }

  // ---- BIBLIOTECA ----
  function _renderBib(){
    if(!biblioteca.length) return `<div class="estado-vazio">
      <div class="icone">📚</div><p>Biblioteca vazia. Cadastre materiais aqui ou crie diretamente ao vincular.</p>
      <button class="btn btn-primario" onclick="Materiais.novoMaterialBib()">+ Cadastrar Material</button></div>`;

    return `<div class="tabela-container"><table class="tabela">
      <thead><tr>
        <th>Material</th><th>Tipo</th><th>Fabricante</th><th>Ref.</th>
        <th class="col-num">Unidade</th><th class="col-num">Vínculos</th><th class="col-acoes">Ações</th>
      </tr></thead>
      <tbody>${biblioteca.map(m=>{
        const usos=vinculos.filter(v=>v.materialId===m.id).length;
        return `<tr>
          <td><strong>${m.nome}</strong></td>
          <td>${m.tipo||'—'}</td><td>${m.fabricante||'—'}</td><td class="text-sm text-muted">${m.referencia||'—'}</td>
          <td class="col-num">${m.unidade||'—'}</td>
          <td class="col-num">${usos?`<span class="badge badge-amarelo">${usos}</span>`:'—'}</td>
          <td class="col-acoes">
            <button class="btn btn-secundario btn-sm" onclick="Materiais.editarMaterialBib('${m.id}')">✎</button>
            <button class="btn btn-perigo btn-sm btn-icon" onclick="Materiais.excluirMaterialBib('${m.id}')">✕</button>
          </td></tr>`;
      }).join('')}</tbody></table></div>`;
  }

  // ---- POR TAREFA ----
  function _renderVinculos(){
    const opts=_getOpcoesTarefa();
    const vf=filtroTarefa ? vinculos.filter(v=>v.tarefaId===filtroTarefa) : vinculos;
    const info=filtroTarefa?_getTarefaInfo(filtroTarefa):null;

    return `
      <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;align-items:center;">
        <select class="form-control" style="width:300px;" onchange="Materiais.setFiltro(this.value)">
          <option value="">Todos os serviços / tarefas</option>
          ${opts.map(o=>`<option value="${o.id}" ${filtroTarefa===o.id?'selected':''}>${o.label}</option>`).join('')}
        </select>
        ${filtroTarefa?`<button class="btn btn-secundario btn-sm" onclick="Materiais.setFiltro('')">✕ Limpar</button>`:''}
      </div>

      ${info?`<div style="background:var(--cor-dark-800);border-radius:8px;padding:12px 18px;margin-bottom:14px;
        border-left:3px solid var(--cor-primaria);display:flex;gap:8px;align-items:center;">
        <span style="font-weight:700;color:var(--cor-primaria);font-size:0.88rem;">${info.label}</span>
        <span style="color:#666;margin:0 8px;">|</span>
        <span style="font-size:0.8rem;color:#aaa;">Total:</span>
        <span style="font-weight:700;font-family:var(--font-mono);color:#fff;">${Utils.formatarNumero(info.quantidade)} ${info.unidade}</span>
      </div>`:''}

      ${!vf.length?`<div class="estado-vazio">
        <div class="icone">🔗</div>
        <p>${filtroTarefa?'Nenhum material vinculado.':'Nenhum vínculo cadastrado.'}</p>
        <button class="btn btn-primario" onclick="Materiais.novoVinculo()">+ Vincular / Criar material</button>
      </div>`:`
      <div class="tabela-container"><table class="tabela tabela-compacta">
        <thead><tr>
          <th>Material</th><th>Tipo</th><th>Fabricante</th><th>Serviço/Tarefa</th>
          <th class="col-num">Consumo Prev.</th><th class="col-num">Consumo Real</th>
          <th class="col-num" style="color:var(--cor-primaria);">Total</th>
          <th class="col-acoes">Ações</th>
        </tr></thead>
        <tbody>${vf.map(v=>{
          const mat=biblioteca.find(m=>m.id===v.materialId);
          const ti=_getTarefaInfo(v.tarefaId);
          const qtd=_calcQtd(ti,v,mat);
          return `<tr>
            <td><strong>${mat?mat.nome:'(removido)'}</strong>
              ${mat?.referencia?`<br><span class="text-sm text-muted">${mat.referencia}</span>`:''}</td>
            <td>${mat?.tipo||'—'}</td><td>${mat?.fabricante||'—'}</td>
            <td style="font-size:0.82rem;">${ti?ti.label:'—'}</td>
            <td class="col-num" style="font-family:var(--font-mono);">${v.consumoPrevisto?v.consumoPrevisto+' '+v.unidadeConsumo:'—'}</td>
            <td class="col-num" style="font-family:var(--font-mono);">${v.consumoReal?v.consumoReal+' '+v.unidadeConsumo:'—'}</td>
            <td class="col-num" style="font-weight:700;color:var(--cor-primaria);font-family:var(--font-mono);">${qtd}</td>
            <td class="col-acoes">
              <button class="btn btn-secundario btn-sm" onclick="Materiais.editarVinculo('${v.id}')">✎</button>
              <button class="btn btn-perigo btn-sm btn-icon" onclick="Materiais.excluirVinculo('${v.id}')">✕</button>
            </td></tr>`;
        }).join('')}</tbody></table></div>`}`;
  }

  // ---- HELPERS ----
  function _getOpcoesTarefa(){
    const opts=[];
    tarefas.forEach(t=>{if(t.tipo!=='grupo')opts.push({id:t.id,label:`[Plan] ${t.codigo?t.codigo+' ':''}${t.nome}`,tipo:'tarefa'});});
    if(levFachadas.some(d=>d.tipo==='fachada'))opts.push({id:'__fachada__',label:'[Levantamento] Fachada',tipo:'fachada'});
    return opts;
  }

  function _getTarefaInfo(id){
    if(!id)return null;
    const t=tarefas.find(x=>x.id===id);
    if(t)return {id,label:`[Plan] ${t.nome}`,quantidade:t.quantidade||0,unidade:t.unidade||'un'};
    if(id==='__fachada__'){
      const pecas=levFachadas.filter(x=>x.tipo==='peca');
      const m2=pecas.reduce((s,p)=>s+(parseFloat(p.comprimento)||0)/100*(parseFloat(p.altura)||0)/100*(parseFloat(p.quantidade)||1),0);
      return {id,label:'[Levantamento] Fachada',quantidade:m2,unidade:'m²'};
    }
    return null;
  }

  function _calcQtd(info,v,mat){
    if(!info||!info.quantidade)return '—';
    const cons=parseFloat(v.consumoPrevisto)||0;
    if(!cons)return Utils.formatarNumero(info.quantidade)+' '+info.unidade;
    return Utils.formatarNumero(info.quantidade*cons)+' '+(mat?.unidade||'');
  }

  // ---- MODAIS INLINE ----
  function _optsBib(){
    return `<option value="">— Selecione material —</option>`+
      biblioteca.map(m=>`<option value="${m.id}">${m.nome}${m.fabricante?' — '+m.fabricante:''} (${m.unidade||'?'})</option>`).join('');
  }
  function _optsTarefa(){
    return `<option value="">— Selecione serviço/tarefa —</option>`+_getOpcoesTarefa().map(o=>`<option value="${o.id}">${o.label}</option>`).join('');
  }
  function _optsUnidConsumo(sel=''){
    return UNIDADES_CONSUMO.map(u=>`<option value="${u}" ${u===sel?'selected':''}>${u}</option>`).join('');
  }
  function _optsUnid(sel=''){
    return UNIDADES_MAT.map(u=>`<option value="${u}" ${u===sel?'selected':''}>${u}</option>`).join('');
  }

  // ---- CRUD BIBLIOTECA ----
  function novoMaterialBib(){
    editandoBiblId=null;
    document.getElementById('modal-bib-titulo').textContent='Novo Material na Biblioteca';
    Utils.limparForm('form-material-bib');
    document.getElementById('bib-unidade').innerHTML=_optsUnid();
    Utils.abrirModal('modal-material-bib');
  }
  function editarMaterialBib(id){
    const m=biblioteca.find(x=>x.id===id);if(!m)return;
    editandoBiblId=id;
    document.getElementById('modal-bib-titulo').textContent='Editar Material';
    Utils.setFormData('form-material-bib',m);
    document.getElementById('bib-unidade').innerHTML=_optsUnid(m.unidade);
    document.getElementById('bib-unidade').value=m.unidade||'kg';
    Utils.abrirModal('modal-material-bib');
  }
  async function salvarMaterialBib(){
    const data=Utils.getFormData('form-material-bib');
    data.unidade=document.getElementById('bib-unidade').value;
    if(!data.nome){Utils.toast('Informe o nome.','alerta');return;}
    try{
      if(editandoBiblId)await Database.atualizar(obraId,COL_BIB,editandoBiblId,data);
      else await Database.criar(obraId,COL_BIB,data);
      Utils.fecharModal('modal-material-bib');
      Utils.toast('Material salvo na biblioteca!','sucesso');
      editandoBiblId=null;await carregar();
    }catch(e){Utils.toast('Erro.','erro');}
  }
  async function excluirMaterialBib(id){
    const usos=vinculos.filter(v=>v.materialId===id).length;
    const msg=usos?`Este material está em ${usos} vínculo(s). Excluir mesmo assim?`:'Excluir material da biblioteca?';
    if(!Utils.confirmar(msg))return;
    try{await Database.deletar(obraId,COL_BIB,id);Utils.toast('Excluído.','sucesso');await carregar();}
    catch(e){Utils.toast('Erro.','erro');}
  }

  // ---- CRUD VÍNCULOS ----
  let _modoVinculo='vincular'; // 'vincular' | 'criar'

  function novoVinculo(){
    editandoVincId=null;
    _modoVinculo='vincular';
    document.getElementById('modal-vinc-titulo').textContent='Adicionar Material à Tarefa';
    Utils.limparForm('form-material-vinc');
    _renderVincModal();
    Utils.abrirModal('modal-material-vinc');
  }
  function editarVinculo(id){
    const v=vinculos.find(x=>x.id===id);if(!v)return;
    editandoVincId=id;
    _modoVinculo='vincular';
    document.getElementById('modal-vinc-titulo').textContent='Editar Vínculo';
    _renderVincModal(v);
    Utils.abrirModal('modal-material-vinc');
  }
  function toggleModoVinc(modo){_modoVinculo=modo;_renderVincModal();}

  function _renderVincModal(v){
    const body=document.getElementById('vinc-body');if(!body)return;
    const uc=v?.unidadeConsumo||'kg/m²';
    body.innerHTML=`
      <div style="display:flex;gap:6px;margin-bottom:14px;">
        <button class="btn btn-sm ${_modoVinculo==='vincular'?'btn-primario':'btn-secundario'}" 
          onclick="Materiais.toggleModoVinc('vincular')">🔗 Vincular da biblioteca</button>
        <button class="btn btn-sm ${_modoVinculo==='criar'?'btn-primario':'btn-secundario'}" 
          onclick="Materiais.toggleModoVinc('criar')">+ Criar novo material</button>
      </div>

      ${_modoVinculo==='vincular'?`
        <div class="form-grupo"><label>Material *</label>
          <select id="vinc-material-sel" class="form-control">
            ${_optsBib()}
          </select>
          ${!biblioteca.length?'<p class="text-sm text-muted" style="margin-top:4px;">Biblioteca vazia. Use "Criar novo material" acima.</p>':''}
        </div>`:`
        <div style="background:var(--cor-primaria-ultra-light);border:1.5px solid var(--cor-primaria);border-radius:8px;padding:14px;margin-bottom:12px;">
          <div style="font-size:0.8rem;font-weight:700;margin-bottom:10px;">Novo material (será salvo na biblioteca)</div>
          <div class="form-grupo"><label>Nome *</label>
            <input type="text" id="novo-mat-nome" class="form-control" placeholder="Ex: Cimento CP-III Votorantim"></div>
          <div class="form-row">
            <div class="form-grupo"><label>Tipo</label>
              <select id="novo-mat-tipo" class="form-control">
                <option value="">—</option>
                ${['Revestimento','Pintura','Argamassa','Cimento','Impermeabilizante','Fixação','Estrutural','Acabamento','Outro'].map(t=>`<option>${t}</option>`).join('')}
              </select></div>
            <div class="form-grupo"><label>Fabricante</label>
              <input type="text" id="novo-mat-fab" class="form-control" placeholder="Ex: Votorantim"></div>
            <div class="form-grupo"><label>Referência</label>
              <input type="text" id="novo-mat-ref" class="form-control" placeholder="Ex: CP-III-40"></div>
          </div>
          <div class="form-grupo"><label>Unidade do material</label>
            <select id="novo-mat-und" class="form-control">${_optsUnid()}</select></div>
        </div>`}

      <div class="form-grupo"><label>Serviço / Tarefa *</label>
        <select id="vinc-tarefa-sel" class="form-control">
          ${_optsTarefa()}
        </select></div>
      <div class="form-row">
        <div class="form-grupo">
          <label>Consumo Previsto</label>
          <div style="display:flex;gap:6px;">
            <input type="number" id="vinc-cp" class="form-control" step="0.001" min="0" 
              value="${v?.consumoPrevisto||''}" placeholder="0,000"
              style="flex:1">
            <select id="vinc-uc" class="form-control" style="width:110px;">${_optsUnidConsumo(uc)}</select>
          </div>
        </div>
        <div class="form-grupo">
          <label>Consumo Real</label>
          <div style="display:flex;gap:6px;">
            <input type="number" id="vinc-cr" class="form-control" step="0.001" min="0"
              value="${v?.consumoReal||''}" placeholder="0,000"
              style="flex:1">
            <span id="vinc-uc-label" style="align-self:center;font-size:0.8rem;color:#888;white-space:nowrap;min-width:60px;" 
              ></span>
          </div>
        </div>
      </div>
      <div class="form-grupo"><label>Observações</label>
        <textarea id="vinc-obs" class="form-control" rows="2">${v?.observacoes||''}</textarea></div>`;

    // Tarefa selecionada
    if(v?.tarefaId) setTimeout(()=>{
      const s=document.getElementById('vinc-tarefa-sel');if(s)s.value=v.tarefaId;
    },50);
    if(v?.materialId&&_modoVinculo==='vincular') setTimeout(()=>{
      const s=document.getElementById('vinc-material-sel');if(s)s.value=v.materialId;
    },50);

    // Sincroniza label unidade consumo real
    const ucSel=document.getElementById('vinc-uc');
    const ucLbl=document.getElementById('vinc-uc-label');
    if(ucSel&&ucLbl){
      ucLbl.textContent=ucSel.value;
      ucSel.onchange=()=>ucLbl.textContent=ucSel.value;
    }
  }

  async function salvarVinculo(){
    const tarefaId=document.getElementById('vinc-tarefa-sel')?.value;
    if(!tarefaId){Utils.toast('Selecione uma tarefa/serviço.','alerta');return;}
    const consumoPrevisto=parseFloat(document.getElementById('vinc-cp')?.value)||0;
    const consumoReal=parseFloat(document.getElementById('vinc-cr')?.value)||0;
    const unidadeConsumo=document.getElementById('vinc-uc')?.value||'kg/m²';
    const observacoes=document.getElementById('vinc-obs')?.value||'';

    let materialId='';

    if(_modoVinculo==='criar'){
      // Criar material na biblioteca primeiro
      const nome=document.getElementById('novo-mat-nome')?.value?.trim();
      if(!nome){Utils.toast('Informe o nome do material.','alerta');return;}
      try{
        materialId=await Database.criar(obraId,COL_BIB,{
          nome,
          tipo:document.getElementById('novo-mat-tipo')?.value||'',
          fabricante:document.getElementById('novo-mat-fab')?.value||'',
          referencia:document.getElementById('novo-mat-ref')?.value||'',
          unidade:document.getElementById('novo-mat-und')?.value||'kg',
        });
      }catch(e){Utils.toast('Erro ao criar material.','erro');return;}
    } else {
      materialId=document.getElementById('vinc-material-sel')?.value;
      if(!materialId){Utils.toast('Selecione um material.','alerta');return;}
    }

    // Verificar duplicidade
    if(!editandoVincId){
      const existe=vinculos.find(v=>v.materialId===materialId&&v.tarefaId===tarefaId);
      if(existe&&!Utils.confirmar('Este material já está vinculado a esta tarefa. Criar outro vínculo?'))return;
    }

    const data={materialId,tarefaId,consumoPrevisto,consumoReal,unidadeConsumo,observacoes};
    try{
      if(editandoVincId)await Database.atualizar(obraId,COL_VIN,editandoVincId,data);
      else await Database.criar(obraId,COL_VIN,data);
      Utils.fecharModal('modal-material-vinc');
      Utils.toast(`Material ${_modoVinculo==='criar'?'criado e ':''}vinculado!`,'sucesso');
      editandoVincId=null;await carregar();
    }catch(e){Utils.toast('Erro.','erro');}
  }

  async function excluirVinculo(id){
    if(!Utils.confirmar('Remover este vínculo?'))return;
    try{await Database.deletar(obraId,COL_VIN,id);Utils.toast('Removido.','sucesso');await carregar();}
    catch(e){Utils.toast('Erro.','erro');}
  }

  function setAba(a){abaAtiva=a;renderizar();}
  function setFiltro(v){filtroTarefa=v;renderizar();}

  return {init,carregar,renderizar,setAba,setFiltro,
    novoMaterialBib,editarMaterialBib,salvarMaterialBib,excluirMaterialBib,
    novoVinculo,editarVinculo,salvarVinculo,excluirVinculo,toggleModoVinc};
})();
function onObraChanged(){Materiais.init();}

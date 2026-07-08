// ============================================
// Módulo: Mão de Obra — V1.0
// Biblioteca de mão de obra + vínculo por tarefa
// Valor unitário × quantidade da tarefa = custo total (base de cálculo)
// ============================================
const MaoDeObra = (() => {
  let obraId=null;
  let biblioteca=[], vinculos=[], tarefas=[];
  let abaAtiva='vinculos', filtroTarefa='';
  let editandoBiblId=null, editandoVincId=null, _modoVinc='vincular';
  const COL_BIB='maoDeObra', COL_VIN='maoDeObra_vinculos';

  const CATEGORIAS=['Pedreiro','Servente','Ajudante','Carpinteiro','Armador',
    'Eletricista','Encanador / Hidráulica','Pintor','Gesseiro','Azulejista',
    'Empreiteira / Terceirizado','Outro'];
  const UNIDADES=['m²','m','un','vb','h','diária','mês','kg','t'];

  async function init(){
    const ok=await Utils.initPagina();if(!ok)return;
    obraId=Router.getObraId();
    if(!obraId){
      const c=document.getElementById('mdo-content');
      if(c)c.innerHTML='<div class="estado-vazio"><div class="icone">👷</div><p>Selecione uma obra.</p></div>';
      return;
    }
    await carregar();
  }

  async function carregar(){
    try{
      Utils.mostrarLoading('Carregando mão de obra...');
      [biblioteca,vinculos,tarefas]=await Promise.all([
        Database.listar(obraId,COL_BIB,'nome').catch(()=>[]),
        Database.listar(obraId,COL_VIN,'createdAt').catch(()=>[]),
        Database.listar(obraId,'tarefas','ordem').catch(()=>[]),
      ]);
      renderizar();
    }catch(e){console.error(e);Utils.toast('Erro ao carregar.','erro');}
    finally{Utils.esconderLoading();}
  }

  function renderizar(){
    const c=document.getElementById('mdo-content');if(!c)return;
    c.innerHTML=
      `<div class="page-header">
        <div><h2>Mão de Obra</h2>
          <span class="subtitulo">${biblioteca.length} na biblioteca · ${vinculos.length} vínculo(s)</span></div>
        <div class="btn-grupo">
          ${abaAtiva==='biblioteca'
            ?`<button class="btn btn-secundario btn-sm" onclick="MaoDeObra.setAba('vinculos')">← Por Tarefa</button>
              <button class="btn btn-primario btn-sm" onclick="MaoDeObra.novaMaoDeObraBib()">+ Nova Mão de Obra</button>`
            :`<button class="btn btn-secundario btn-sm" onclick="MaoDeObra.setAba('biblioteca')">👷 Biblioteca (${biblioteca.length})</button>
              <button class="btn btn-primario btn-sm" onclick="MaoDeObra.novoVinculo()">+ Vincular à Tarefa</button>`}
        </div>
      </div>
      <div id="mdo-corpo">${abaAtiva==='biblioteca'?_renderBib():_renderVinculos()}</div>`;
  }

  // ====== BIBLIOTECA ======
  function _renderBib(){
    if(!biblioteca.length) return `<div class="estado-vazio">
      <div class="icone">👷</div><p>Biblioteca vazia.</p>
      <button class="btn btn-primario" onclick="MaoDeObra.novaMaoDeObraBib()">+ Cadastrar Mão de Obra</button></div>`;
    return `<div class="tabela-container"><table class="tabela">
      <thead><tr><th>Mão de Obra</th><th>Categoria</th>
        <th class="col-num">Vínculos</th><th class="col-acoes">Ações</th></tr></thead>
      <tbody>${biblioteca.map(m=>{
        const usos=vinculos.filter(v=>v.maoDeObraId===m.id).length;
        return `<tr>
          <td><strong>${m.nome}</strong>${m.observacoes?`<br><small class="text-muted">${m.observacoes}</small>`:''}</td>
          <td>${m.categoria||'—'}</td>
          <td class="col-num">${usos?`<span class="badge badge-amarelo">${usos}</span>`:'—'}</td>
          <td class="col-acoes">
            <button class="btn btn-secundario btn-sm" onclick="MaoDeObra.editarMaoDeObraBib('${m.id}')">✎ Editar</button>
            <button class="btn btn-perigo btn-sm btn-icon" onclick="MaoDeObra.excluirMaoDeObraBib('${m.id}')">✕</button>
          </td></tr>`;
      }).join('')}</tbody></table></div>`;
  }

  // ====== POR TAREFA ======
  function _renderVinculos(){
    const opts=_getOpcoesTarefa();
    const vf=filtroTarefa?vinculos.filter(v=>v.tarefaId===filtroTarefa):vinculos;
    const info=filtroTarefa?_getTarefaInfo(filtroTarefa):null;
    const totalGeral=vf.reduce((s,v)=>{
      const ti=_getTarefaInfo(v.tarefaId);
      return s+_calcTotalNum(ti,v);
    },0);

    return `
      <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;align-items:center;">
        <select class="form-control" style="width:300px;" onchange="MaoDeObra.setFiltro(this.value)">
          <option value="">Todos os serviços / tarefas</option>
          ${opts.map(o=>`<option value="${o.id}" ${filtroTarefa===o.id?'selected':''}>${o.label}</option>`).join('')}
        </select>
        ${filtroTarefa?`<button class="btn btn-secundario btn-sm" onclick="MaoDeObra.setFiltro('')">✕ Limpar</button>`:''}
        <div style="margin-left:auto;background:var(--cor-dark-800);border-radius:8px;padding:8px 16px;
          border-left:3px solid var(--cor-primaria);">
          <span style="font-size:0.75rem;color:#888;">Custo total (mão de obra):</span>
          <strong style="font-family:var(--font-mono);color:var(--cor-primaria);margin-left:6px;">R$ ${_fNum(totalGeral)}</strong>
        </div>
      </div>

      ${info?`<div style="background:var(--cor-dark-800);border-radius:8px;padding:12px 18px;margin-bottom:14px;
        border-left:3px solid var(--cor-primaria);display:flex;gap:16px;flex-wrap:wrap;align-items:center;">
        <span style="font-weight:700;color:var(--cor-primaria);font-size:0.88rem;">${info.label}</span>
        <span style="color:#555;">|</span>
        <span style="font-size:0.8rem;color:#888;">Quantidade:</span>
        <span style="font-weight:700;font-family:var(--font-mono);color:#fff;">${_fNum(info.quantidade)} ${info.unidade}</span>
      </div>`:''}

      ${!vf.length?`<div class="estado-vazio"><div class="icone">🔗</div>
        <p>${filtroTarefa?'Nenhuma mão de obra vinculada.':'Nenhum vínculo cadastrado.'}</p>
        <button class="btn btn-primario" onclick="MaoDeObra.novoVinculo()">+ Vincular / Criar mão de obra</button></div>`:`
      <div class="tabela-container"><table class="tabela tabela-compacta">
        <thead><tr><th>Mão de Obra</th><th>Categoria</th><th>Serviço</th>
          <th class="col-num">Valor Unit.</th><th class="col-num">Quantidade</th>
          <th class="col-num" style="color:var(--cor-primaria);">Custo Total</th>
          <th class="col-acoes">Ações</th></tr></thead>
        <tbody>${vf.map(v=>{
          const mo=biblioteca.find(m=>m.id===v.maoDeObraId);
          const ti=_getTarefaInfo(v.tarefaId);
          const total=_calcTotalNum(ti,v);
          return `<tr>
            <td><strong>${mo?mo.nome:'(removido)'}</strong></td>
            <td>${mo?.categoria||'—'}</td>
            <td style="font-size:0.82rem;">${ti?ti.label:'—'}</td>
            <td class="col-num" style="font-family:var(--font-mono);">R$ ${_fNum(v.valor)} / ${v.unidade}</td>
            <td class="col-num" style="font-family:var(--font-mono);">${ti?_fNum(ti.quantidade)+' '+ti.unidade:'—'}</td>
            <td class="col-num" style="font-weight:700;color:var(--cor-primaria);font-family:var(--font-mono);">R$ ${_fNum(total)}</td>
            <td class="col-acoes">
              <button class="btn btn-secundario btn-sm" onclick="MaoDeObra.editarVinculo('${v.id}')">✎</button>
              <button class="btn btn-perigo btn-sm btn-icon" onclick="MaoDeObra.excluirVinculo('${v.id}')">✕</button>
            </td></tr>`;
        }).join('')}</tbody></table></div>`}`;
  }

  // ====== HELPERS ======
  function _getOpcoesTarefa(){
    return Utils.opcoesTarefaHierarquia(tarefas);
  }

  function _getTarefaInfo(id){
    if(!id)return null;
    const t=tarefas.find(x=>x.id===id);
    if(t)return {id,label:`[Plan] ${t.nome}`,quantidade:t.quantidade||0,unidade:t.unidade||'un'};
    return null;
  }

  // Custo total = valor unitário × quantidade da tarefa, quando a unidade bate;
  // caso a tarefa não tenha quantidade, mostra apenas o valor unitário informado.
  function _calcTotalNum(info,v){
    const valor=parseFloat(v.valor)||0;
    if(!info||!info.quantidade)return valor;
    return valor*info.quantidade;
  }

  function _fNum(n){return Utils.formatarNumero(n);}

  // ====== CRUD BIBLIOTECA ======
  function novaMaoDeObraBib(){
    editandoBiblId=null;
    document.getElementById('modal-mdo-bib-titulo').textContent='Nova Mão de Obra';
    document.getElementById('form-mdo-bib').reset();
    Utils.abrirModal('modal-mdo-bib');
  }

  function editarMaoDeObraBib(id){
    const m=biblioteca.find(x=>x.id===id);
    if(!m){Utils.toast('Mão de obra não encontrada.','erro');return;}
    editandoBiblId=id;
    document.getElementById('modal-mdo-bib-titulo').textContent='Editar Mão de Obra';
    const f=document.getElementById('form-mdo-bib');
    f.reset();
    f.querySelector('[name="nome"]').value=m.nome||'';
    f.querySelector('[name="categoria"]').value=m.categoria||'';
    f.querySelector('[name="observacoes"]').value=m.observacoes||'';
    Utils.abrirModal('modal-mdo-bib');
  }

  async function salvarMaoDeObraBib(){
    const f=document.getElementById('form-mdo-bib');
    const nome=f.querySelector('[name="nome"]').value.trim();
    if(!nome){Utils.toast('Informe o nome.','alerta');return;}
    const data={
      nome,
      categoria:f.querySelector('[name="categoria"]').value,
      observacoes:f.querySelector('[name="observacoes"]').value.trim(),
    };
    try{
      if(editandoBiblId)await Database.atualizar(obraId,COL_BIB,editandoBiblId,data);
      else await Database.criar(obraId,COL_BIB,data);
      Utils.fecharModal('modal-mdo-bib');
      Utils.toast('Mão de obra salva!','sucesso');
      editandoBiblId=null;await carregar();
    }catch(e){console.error(e);Utils.toast('Erro ao salvar.','erro');}
  }

  async function excluirMaoDeObraBib(id){
    const usos=vinculos.filter(v=>v.maoDeObraId===id).length;
    if(!Utils.confirmar(usos?`Em uso em ${usos} vínculo(s). Excluir mesmo assim?`:'Excluir da biblioteca?'))return;
    try{await Database.deletar(obraId,COL_BIB,id);Utils.toast('Excluído.','sucesso');await carregar();}
    catch(e){Utils.toast('Erro.','erro');}
  }

  // ====== CRUD VÍNCULOS ======
  function novoVinculo(){
    editandoVincId=null;_modoVinc='vincular';
    document.getElementById('modal-mdo-vinc-titulo').textContent='Vincular Mão de Obra à Tarefa';
    _renderVincModal(null);
    Utils.abrirModal('modal-mdo-vinc');
  }
  function editarVinculo(id){
    const v=vinculos.find(x=>x.id===id);if(!v)return;
    editandoVincId=id;_modoVinc='vincular';
    document.getElementById('modal-mdo-vinc-titulo').textContent='Editar Vínculo';
    _renderVincModal(v);
    Utils.abrirModal('modal-mdo-vinc');
  }
  function toggleModoVinc(m){_modoVinc=m;_renderVincModal(null);}

  function _renderVincModal(v){
    const body=document.getElementById('mdo-vinc-body');if(!body)return;
    body.innerHTML=`
      <div style="display:flex;gap:6px;margin-bottom:16px;">
        <button class="btn btn-sm ${_modoVinc==='vincular'?'btn-primario':'btn-secundario'}"
          onclick="MaoDeObra.toggleModoVinc('vincular')">🔗 Da biblioteca</button>
        <button class="btn btn-sm ${_modoVinc==='criar'?'btn-primario':'btn-secundario'}"
          onclick="MaoDeObra.toggleModoVinc('criar')">+ Criar nova</button>
      </div>

      ${_modoVinc==='vincular'?`
        <div class="form-grupo"><label>Mão de Obra *</label>
          <select id="mdo-vinc-mo-sel" class="form-control">
            <option value="">— Selecione —</option>
            ${biblioteca.map(m=>`<option value="${m.id}" ${v?.maoDeObraId===m.id?'selected':''}>${m.nome}${m.categoria?' — '+m.categoria:''}</option>`).join('')}
          </select></div>`:`
        <div style="background:rgba(245,200,0,0.07);border:1.5px solid rgba(245,200,0,0.25);border-radius:8px;padding:14px;margin-bottom:12px;">
          <div style="font-size:0.8rem;font-weight:700;color:var(--cor-primaria);margin-bottom:10px;">Nova mão de obra → será salva na biblioteca</div>
          <div class="form-grupo"><label>Nome *</label><input id="mdo-nm-nome" class="form-control" placeholder="Ex: Pedreiro, Empreiteira Alvenaria"></div>
          <div class="form-grupo"><label>Categoria</label>
            <select id="mdo-nm-cat" class="form-control"><option value="">—</option>
              ${CATEGORIAS.map(c=>`<option>${c}</option>`).join('')}
            </select></div>
        </div>`}

      <div class="form-grupo"><label>Serviço / Tarefa *</label>
        <select id="mdo-vinc-tar-sel" class="form-control">
          <option value="">— Selecione —</option>
          ${_getOpcoesTarefa().map(o=>`<option value="${o.id}" ${v?.tarefaId===o.id?'selected':''}>${o.label}</option>`).join('')}
        </select></div>

      <div class="form-row">
        <div class="form-grupo">
          <label>Valor (R$) *</label>
          <input id="mdo-vinc-valor" type="number" step="0.01" min="0" class="form-control"
            value="${v?.valor||''}" placeholder="0,00">
        </div>
        <div class="form-grupo">
          <label>Unidade do valor *</label>
          <select id="mdo-vinc-und" class="form-control">
            ${UNIDADES.map(u=>`<option value="${u}" ${(v?.unidade||'m²')===u?'selected':''}>${u}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-grupo"><label>Observações</label>
        <textarea id="mdo-vinc-obs" class="form-control" rows="2">${v?.observacoes||''}</textarea></div>`;
  }

  async function salvarVinculo(){
    const tarefaId=document.getElementById('mdo-vinc-tar-sel')?.value;
    if(!tarefaId){Utils.toast('Selecione uma tarefa.','alerta');return;}
    const valor=parseFloat(document.getElementById('mdo-vinc-valor')?.value);
    if(!valor||valor<=0){Utils.toast('Informe o valor.','alerta');return;}
    const unidade=document.getElementById('mdo-vinc-und')?.value||'m²';
    const observacoes=document.getElementById('mdo-vinc-obs')?.value||'';
    let maoDeObraId='';

    if(_modoVinc==='criar'){
      const nome=document.getElementById('mdo-nm-nome')?.value?.trim();
      if(!nome){Utils.toast('Informe o nome da mão de obra.','alerta');return;}
      try{
        maoDeObraId=await Database.criar(obraId,COL_BIB,{
          nome,
          categoria:document.getElementById('mdo-nm-cat')?.value||'',
          observacoes:'',
        });
      }catch(e){Utils.toast('Erro ao criar mão de obra.','erro');return;}
    } else {
      maoDeObraId=document.getElementById('mdo-vinc-mo-sel')?.value;
      if(!maoDeObraId){Utils.toast('Selecione uma mão de obra.','alerta');return;}
    }

    if(!editandoVincId){
      const existe=vinculos.find(v=>v.maoDeObraId===maoDeObraId&&v.tarefaId===tarefaId);
      if(existe&&!Utils.confirmar('Mão de obra já vinculada a esta tarefa. Criar outro vínculo mesmo assim?'))return;
    }

    const data={maoDeObraId,tarefaId,valor,unidade,observacoes};
    try{
      if(editandoVincId)await Database.atualizar(obraId,COL_VIN,editandoVincId,data);
      else await Database.criar(obraId,COL_VIN,data);
      Utils.fecharModal('modal-mdo-vinc');
      Utils.toast(`Mão de obra ${_modoVinc==='criar'?'criada e ':''}vinculada!`,'sucesso');
      editandoVincId=null;await carregar();
    }catch(e){console.error(e);Utils.toast('Erro.','erro');}
  }

  async function excluirVinculo(id){
    if(!Utils.confirmar('Remover este vínculo?'))return;
    try{await Database.deletar(obraId,COL_VIN,id);Utils.toast('Removido.','sucesso');await carregar();}
    catch(e){Utils.toast('Erro.','erro');}
  }

  function setAba(a){abaAtiva=a;renderizar();}
  function setFiltro(v){filtroTarefa=v;renderizar();}

  return {init,carregar,renderizar,setAba,setFiltro,
    novaMaoDeObraBib,editarMaoDeObraBib,salvarMaoDeObraBib,excluirMaoDeObraBib,
    novoVinculo,editarVinculo,salvarVinculo,excluirVinculo,toggleModoVinc};
})();
function onObraChanged(){MaoDeObra.init();}

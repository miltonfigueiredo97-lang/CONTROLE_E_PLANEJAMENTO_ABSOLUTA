// ============================================
// Módulo: Materiais — V1.1
// Biblioteca de materiais (UID único por material)
// Vínculos material↔tarefa separados (consumo por tarefa)
// ============================================
const Materiais = (() => {
  let obraId=null;
  let biblioteca=[];    // todos os materiais (biblioteca global da obra)
  let vinculos=[];      // vínculos material↔tarefa com consumo
  let tarefas=[];       // tarefas do planejamento
  let levFachadas=[];   // peças/fachadas do levantamento

  let abaAtiva='vinculos'; // 'vinculos' | 'biblioteca'
  let filtroTarefa='';
  let editandoBiblId=null;  // editando material na biblioteca
  let editandoVincId=null;  // editando vínculo

  const COL_BIB='materiais';
  const COL_VIN='materiais_vinculos';

  // ===================== INIT =====================
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

  // ===================== RENDER PRINCIPAL =====================
  function renderizar(){
    const c=document.getElementById('materiais-content');if(!c)return;
    c.innerHTML=`
      <div class="page-header">
        <div><h2>Materiais</h2>
          <span class="subtitulo">${biblioteca.length} material(is) na biblioteca · ${vinculos.length} vínculo(s)</span></div>
        <div class="btn-grupo">
          <button class="btn btn-secundario btn-sm" onclick="Materiais.setAba('biblioteca')" 
            style="${abaAtiva==='biblioteca'?'background:var(--cor-dark-800);color:var(--cor-primaria);border-color:var(--cor-primaria);':''}">
            📚 Biblioteca</button>
          <button class="btn btn-secundario btn-sm" onclick="Materiais.setAba('vinculos')"
            style="${abaAtiva==='vinculos'?'background:var(--cor-dark-800);color:var(--cor-primaria);border-color:var(--cor-primaria);':''}">
            🔗 Por Tarefa</button>
          ${abaAtiva==='biblioteca'
            ?'<button class="btn btn-primario btn-sm" onclick="Materiais.novoMaterialBib()">+ Novo Material</button>'
            :'<button class="btn btn-primario btn-sm" onclick="Materiais.novoVinculo()">+ Vincular Material</button>'}
        </div>
      </div>
      <div id="mat-corpo">${abaAtiva==='biblioteca'?_renderBiblioteca():_renderVinculos()}</div>`;
  }

  // ===================== ABA: BIBLIOTECA =====================
  function _renderBiblioteca(){
    if(!biblioteca.length) return `<div class="estado-vazio">
      <div class="icone">📚</div>
      <p>Nenhum material cadastrado na biblioteca.</p>
      <button class="btn btn-primario" onclick="Materiais.novoMaterialBib()">+ Cadastrar primeiro material</button>
    </div>`;

    return `<div class="tabela-container"><table class="tabela tabela-compacta">
      <thead><tr>
        <th>Material</th><th>Tipo</th><th>Fabricante</th><th class="col-num">Unidade</th>
        <th class="col-num">Usado em</th><th class="col-acoes">Ações</th>
      </tr></thead>
      <tbody>${biblioteca.map(m=>{
        const usos=vinculos.filter(v=>v.materialId===m.id).length;
        return `<tr>
          <td><strong>${m.nome}</strong>${m.referencia?`<br><span class="text-sm text-muted">${m.referencia}</span>`:''}
          </td>
          <td>${m.tipo||'—'}</td>
          <td>${m.fabricante||'—'}</td>
          <td class="col-num">${m.unidade||'—'}</td>
          <td class="col-num">
            ${usos?`<span class="badge badge-amarelo">${usos} tarefa(s)</span>`:'<span class="text-muted">—</span>'}
          </td>
          <td class="col-acoes">
            <button class="btn btn-secundario btn-sm" onclick="Materiais.editarMaterialBib('${m.id}')">✎</button>
            <button class="btn btn-perigo btn-sm btn-icon" onclick="Materiais.excluirMaterialBib('${m.id}')">✕</button>
          </td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;
  }

  // ===================== ABA: VÍNCULOS POR TAREFA =====================
  function _renderVinculos(){
    const opcoesTarefa=_getOpcoesTarefa();

    const vincsFiltrados=filtroTarefa
      ? vinculos.filter(v=>v.tarefaId===filtroTarefa)
      : vinculos;

    const tarefaInfo=filtroTarefa?_getTarefaInfo(filtroTarefa):null;

    return `
      <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;align-items:center;">
        <select class="form-control" style="width:300px;" onchange="Materiais.setFiltro(this.value)">
          <option value="">Todos os serviços / tarefas</option>
          ${opcoesTarefa.map(o=>`<option value="${o.id}" ${filtroTarefa===o.id?'selected':''}>${o.label}</option>`).join('')}
        </select>
        ${filtroTarefa?`<button class="btn btn-secundario btn-sm" onclick="Materiais.setFiltro('')">✕ Limpar</button>`:''}
      </div>

      ${tarefaInfo?_renderCardTarefa(tarefaInfo):''}

      ${!vincsFiltrados.length?`<div class="estado-vazio">
        <div class="icone">🔗</div>
        <p>${filtroTarefa?'Nenhum material vinculado a este serviço.':'Nenhum vínculo cadastrado.'}</p>
        <button class="btn btn-primario" onclick="Materiais.novoVinculo()">+ Vincular material</button>
      </div>` : `
      <div class="tabela-container"><table class="tabela tabela-compacta">
        <thead><tr>
          <th>Material</th><th>Tipo</th><th>Fabricante</th>
          <th>Serviço / Tarefa</th>
          <th class="col-num">Consumo Prev.</th>
          <th class="col-num">Consumo Real</th>
          <th class="col-num" style="color:var(--cor-primaria);">Qtd Total</th>
          <th class="col-acoes">Ações</th>
        </tr></thead>
        <tbody>${vincsFiltrados.map(v=>{
          const mat=biblioteca.find(m=>m.id===v.materialId);
          const tInfo=_getTarefaInfo(v.tarefaId);
          const qtd=_calcQtd(tInfo,v);
          return `<tr>
            <td><strong>${mat?mat.nome:'Material removido'}</strong>
              ${mat?.fabricante?`<br><span class="text-sm text-muted">${mat.fabricante}</span>`:''}
            </td>
            <td>${mat?.tipo||'—'}</td>
            <td>${mat?.fabricante||'—'}</td>
            <td>${tInfo?tInfo.label:'—'}</td>
            <td class="col-num" style="font-family:var(--font-mono);">
              ${v.consumoPrevisto||'—'} ${mat?.unidade||''}
            </td>
            <td class="col-num" style="font-family:var(--font-mono);">
              ${v.consumoReal||'—'} ${mat?.unidade||''}
            </td>
            <td class="col-num" style="font-weight:700;color:var(--cor-primaria);font-family:var(--font-mono);">
              ${qtd}
            </td>
            <td class="col-acoes">
              <button class="btn btn-secundario btn-sm" onclick="Materiais.editarVinculo('${v.id}')">✎</button>
              <button class="btn btn-perigo btn-sm btn-icon" onclick="Materiais.excluirVinculo('${v.id}')">✕</button>
            </td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>`}`;
  }

  function _renderCardTarefa(info){
    if(!info.detalhes)return '';
    return `<div style="background:var(--cor-dark-800);border-radius:8px;padding:14px 18px;
      margin-bottom:16px;border-left:3px solid var(--cor-primaria);display:flex;gap:20px;flex-wrap:wrap;align-items:center;">
      <div style="font-weight:700;color:var(--cor-primaria);font-size:0.9rem;min-width:120px;">${info.label}</div>
      ${info.detalhes.map(d=>`
        <div style="display:flex;flex-direction:column;gap:2px;">
          <span style="font-size:0.65rem;color:#777;text-transform:uppercase;">${d.label}</span>
          <span style="font-weight:700;color:#fff;font-family:var(--font-mono);">${d.valor}</span>
        </div>`).join('')}
    </div>`;
  }

  // ===================== HELPERS TAREFA/QUANTIDADE =====================
  function _getOpcoesTarefa(){
    const opts=[];
    tarefas.forEach(t=>{
      if(t.tipo!=='grupo')
        opts.push({id:t.id,label:`[Plan] ${t.codigo?t.codigo+' ':''}${t.nome}`,tipo:'tarefa'});
    });
    if(levFachadas.some(d=>d.tipo==='fachada'))
      opts.push({id:'__fachada__',label:'[Levantamento] Fachada',tipo:'fachada_agregada'});
    return opts;
  }

  function _getTarefaInfo(id){
    if(!id)return null;
    const t=tarefas.find(x=>x.id===id);
    if(t)return {id,label:`[Plan] ${t.nome}`,quantidade:t.quantidade||0,unidade:t.unidade||'un',detalhes:[
      {label:'Qtd Prevista',valor:`${t.quantidade||0} ${t.unidade||''}`},
      {label:'% Concluído',valor:`${t.percentualConcluido||0}%`},
    ]};
    if(id==='__fachada__'){
      const fachadas=levFachadas.filter(x=>x.tipo==='fachada');
      const pecas=levFachadas.filter(x=>x.tipo==='peca');
      const m2=pecas.reduce((s,p)=>s+(_m(p.comprimento)*_m(p.altura)*(p.quantidade||1)),0);
      return {id,label:'[Levantamento] Fachada',quantidade:m2,unidade:'m²',detalhes:[
        {label:'m² Total',valor:_f(m2)+' m²'},
        {label:'Fachadas',valor:fachadas.length},
        ...fachadas.slice(0,3).map(f=>{
          const m2f=pecas.filter(p=>p.fachadaId===f.id).reduce((s,p)=>s+(_m(p.comprimento)*_m(p.altura)*(p.quantidade||1)),0);
          return {label:f.nome,valor:_f(m2f)+' m²'};
        }),
      ]};
    }
    return null;
  }

  function _calcQtd(info,v){
    if(!info||!info.quantidade)return '—';
    const cons=parseFloat(v.consumoPrevisto)||0;
    if(!cons)return _f(info.quantidade)+' '+info.unidade;
    const mat=biblioteca.find(m=>m.id===v.materialId);
    return _f(info.quantidade*cons)+' '+(mat?.unidade||'');
  }

  // ===================== CRUD BIBLIOTECA =====================
  function novoMaterialBib(){
    editandoBiblId=null;
    document.getElementById('modal-bib-titulo').textContent='Novo Material';
    Utils.limparForm('form-material-bib');
    Utils.abrirModal('modal-material-bib');
  }

  function editarMaterialBib(id){
    const m=biblioteca.find(x=>x.id===id);if(!m)return;
    editandoBiblId=id;
    document.getElementById('modal-bib-titulo').textContent='Editar Material';
    Utils.setFormData('form-material-bib',m);
    Utils.abrirModal('modal-material-bib');
  }

  async function salvarMaterialBib(){
    const data=Utils.getFormData('form-material-bib');
    if(!data.nome){Utils.toast('Informe o nome.','alerta');return;}
    try{
      if(editandoBiblId)await Database.atualizar(obraId,COL_BIB,editandoBiblId,data);
      else await Database.criar(obraId,COL_BIB,data);
      Utils.fecharModal('modal-material-bib');
      Utils.toast('Material salvo!','sucesso');
      editandoBiblId=null;await carregar();
    }catch(e){Utils.toast('Erro.','erro');}
  }

  async function excluirMaterialBib(id){
    const usos=vinculos.filter(v=>v.materialId===id).length;
    if(usos&&!Utils.confirmar(`Este material está em ${usos} vínculo(s). Excluir mesmo assim?`))return;
    if(!usos&&!Utils.confirmar('Excluir material da biblioteca?'))return;
    try{await Database.deletar(obraId,COL_BIB,id);Utils.toast('Excluído.','sucesso');await carregar();}
    catch(e){Utils.toast('Erro.','erro');}
  }

  // ===================== CRUD VÍNCULOS =====================
  function novoVinculo(){
    editandoVincId=null;
    document.getElementById('modal-vinc-titulo').textContent='Vincular Material à Tarefa';
    Utils.limparForm('form-material-vinc');
    _popVincSelects();
    Utils.abrirModal('modal-material-vinc');
  }

  function editarVinculo(id){
    const v=vinculos.find(x=>x.id===id);if(!v)return;
    editandoVincId=id;
    document.getElementById('modal-vinc-titulo').textContent='Editar Vínculo';
    _popVincSelects();
    Utils.setFormData('form-material-vinc',v);
    document.getElementById('vinc-material-sel').value=v.materialId||'';
    document.getElementById('vinc-tarefa-sel').value=v.tarefaId||'';
    Utils.abrirModal('modal-material-vinc');
  }

  function _popVincSelects(){
    // Materiais da biblioteca
    const sm=document.getElementById('vinc-material-sel');
    if(sm){
      sm.innerHTML='<option value="">— Selecione o material —</option>'+
        biblioteca.map(m=>`<option value="${m.id}">${m.nome}${m.fabricante?' — '+m.fabricante:''}${m.unidade?' ('+m.unidade+')':''}</option>`).join('');
    }
    // Tarefas
    const st=document.getElementById('vinc-tarefa-sel');
    if(st){
      const opts=_getOpcoesTarefa();
      st.innerHTML='<option value="">— Selecione o serviço/tarefa —</option>'+
        opts.map(o=>`<option value="${o.id}">${o.label}</option>`).join('');
    }
  }

  async function salvarVinculo(){
    const materialId=document.getElementById('vinc-material-sel').value;
    const tarefaId=document.getElementById('vinc-tarefa-sel').value;
    if(!materialId){Utils.toast('Selecione um material.','alerta');return;}
    if(!tarefaId){Utils.toast('Selecione uma tarefa/serviço.','alerta');return;}
    const data={
      ...Utils.getFormData('form-material-vinc'),
      materialId,
      tarefaId,
    };
    // Verificar duplicidade (mesmo material + mesma tarefa)
    if(!editandoVincId){
      const existe=vinculos.find(v=>v.materialId===materialId&&v.tarefaId===tarefaId);
      if(existe&&!Utils.confirmar('Este material já está vinculado a esta tarefa. Criar outro vínculo?'))return;
    }
    try{
      if(editandoVincId)await Database.atualizar(obraId,COL_VIN,editandoVincId,data);
      else await Database.criar(obraId,COL_VIN,data);
      Utils.fecharModal('modal-material-vinc');
      Utils.toast('Vínculo salvo!','sucesso');
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

  function _m(cm){return (parseFloat(cm)||0)/100;}
  function _f(n){return Utils.formatarNumero(n);}

  return {init,carregar,renderizar,setAba,setFiltro,
    novoMaterialBib,editarMaterialBib,salvarMaterialBib,excluirMaterialBib,
    novoVinculo,editarVinculo,salvarVinculo,excluirVinculo};
})();
function onObraChanged(){Materiais.init();}

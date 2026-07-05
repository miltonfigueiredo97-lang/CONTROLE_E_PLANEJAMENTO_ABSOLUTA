// ============================================
// Módulo: Materiais — V1.0
// Vinculado ao Levantamento (tarefas/fachadas)
// Material → Tarefa → Quantidade calculada
// ============================================
const Materiais = (() => {
  let obraId=null;
  let materiais=[], tarefas=[], levFachadas=[];
  let filtroTarefa='', editandoId=null;
  const COL='materiais';

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
      [materiais, tarefas, levFachadas]=await Promise.all([
        Database.listar(obraId,COL,'nome').catch(()=>[]),
        Database.listar(obraId,'tarefas','ordem').catch(()=>[]),
        Database.listar(obraId,'levantamentosFachada',null).catch(()=>[]),
      ]);
      renderizar();
    }catch(e){console.error(e);Utils.toast('Erro ao carregar.','erro');}
    finally{Utils.esconderLoading();}
  }

  function renderizar(){
    const c=document.getElementById('materiais-content');if(!c)return;

    // Agrupa tarefas únicas referenciadas nos materiais
    // + tarefas do planejamento + levantamentos de fachada como "tarefas"
    const opcoesTarefa=_getOpcoesTarefa();

    const matsFiltrados=filtroTarefa
      ? materiais.filter(m=>m.tarefaId===filtroTarefa)
      : materiais;

    c.innerHTML=`
      <div class="page-header">
        <div><h2>Materiais</h2>
          <span class="subtitulo">${materiais.length} material(is) cadastrado(s)</span></div>
        <button class="btn btn-primario" onclick="Materiais.novoMaterial()">+ Novo Material</button>
      </div>

      <!-- Filtro por tarefa/serviço -->
      <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;align-items:center;">
        <select class="form-control" style="width:280px;" onchange="Materiais.setFiltro(this.value)">
          <option value="">Todos os serviços/tarefas</option>
          ${opcoesTarefa.map(o=>`<option value="${o.id}" ${filtroTarefa===o.id?'selected':''}>${o.label}</option>`).join('')}
        </select>
        ${filtroTarefa?`<button class="btn btn-secundario btn-sm" onclick="Materiais.setFiltro('')">✕ Limpar filtro</button>`:''}
      </div>

      ${!matsFiltrados.length?`
        <div class="estado-vazio">
          <div class="icone">🧱</div>
          <p>${filtroTarefa?'Nenhum material neste serviço.':'Nenhum material cadastrado.'}</p>
          <button class="btn btn-primario" onclick="Materiais.novoMaterial()">+ Cadastrar primeiro material</button>
        </div>` : `
      <div class="tabela-container">
        <table class="tabela">
          <thead><tr>
            <th>Material</th><th>Tipo</th><th>Fabricante</th>
            <th>Serviço / Tarefa</th>
            <th class="col-num">Consumo Prev.</th><th class="col-num">Consumo Real</th>
            <th class="col-num">Qtd Tarefa</th><th class="col-num">Un</th>
            <th class="col-acoes">Ações</th>
          </tr></thead>
          <tbody>
            ${matsFiltrados.map(m=>{
              const tarefa=_getTarefaInfo(m.tarefaId||m.tarefaRef);
              const qtd=tarefa?_calcQtdTarefa(tarefa,m):'—';
              return `<tr>
                <td><strong>${m.nome}</strong></td>
                <td>${m.tipo||'—'}</td>
                <td>${m.fabricante||'—'}</td>
                <td>${tarefa?tarefa.label:'—'}</td>
                <td class="col-num" style="font-family:var(--font-mono);">${m.consumoPrevisto||'—'}</td>
                <td class="col-num" style="font-family:var(--font-mono);">${m.consumoReal||'—'}</td>
                <td class="col-num" style="font-weight:700;color:var(--cor-primaria);font-family:var(--font-mono);">${qtd}</td>
                <td class="col-num">${m.unidade||'—'}</td>
                <td class="col-acoes">
                  <button class="btn btn-secundario btn-sm" onclick="Materiais.editarMaterial('${m.id}')">✎</button>
                  <button class="btn btn-perigo btn-sm btn-icon" onclick="Materiais.excluirMaterial('${m.id}')">✕</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- Painel de detalhes se filtro de tarefa ativo -->
      ${filtroTarefa?_renderDetalhesTarefa(filtroTarefa,matsFiltrados):''}`}`;
  }

  // Renderiza painel de detalhes da tarefa/fachada selecionada
  function _renderDetalhesTarefa(tarefaId, mats){
    const info=_getTarefaInfo(tarefaId);
    if(!info)return '';
    const total=mats.reduce((acc,m)=>{
      const qtd=info?_calcQtdTarefaNum(info,m):0;
      return acc;
    },0);
    return `
      <div style="background:var(--cor-dark-800);border-radius:8px;padding:16px;margin-top:16px;border:1px solid var(--cor-primaria);">
        <div style="font-weight:700;color:var(--cor-primaria);margin-bottom:12px;">📊 Detalhes: ${info.label}</div>
        ${info.detalhes?`<div style="display:flex;gap:16px;flex-wrap:wrap;">
          ${info.detalhes.map(d=>`
            <div style="background:rgba(255,255,255,0.05);border-radius:6px;padding:10px 14px;min-width:140px;">
              <div style="font-size:0.68rem;color:#777;text-transform:uppercase;">${d.label}</div>
              <div style="font-size:1.1rem;font-weight:700;font-family:var(--font-mono);color:#fff;">${d.valor}</div>
            </div>`).join('')}
        </div>`:''}
      </div>`;
  }

  // Retorna lista de opções: tarefas do planejamento + "Levantamento de Fachada" como entrada única
  function _getOpcoesTarefa(){
    const opts=[];
    // Tarefas do planejamento
    tarefas.forEach(t=>{
      if(t.tipo!=='grupo')opts.push({id:t.id,label:`[Plan] ${t.codigo?t.codigo+' ':''}${t.nome}`,tipo:'tarefa'});
    });
    // Levantamento de Fachada como entrada única (agrega todas as fachadas)
    const temFachada=levFachadas.some(d=>d.tipo==='fachada');
    if(temFachada){
      opts.push({id:'__fachada__',label:'[Levantamento] Fachada',tipo:'fachada_agregada'});
    }
    return opts;
  }

  function _getTarefaInfo(id){
    if(!id)return null;
    // Tarefa do planejamento
    const t=tarefas.find(x=>x.id===id);
    if(t)return {id,label:`[Plan] ${t.nome}`,tipo:'tarefa',unidade:t.unidade||'un',quantidade:t.quantidade||0,detalhes:[
      {label:'Qtd Prevista',valor:`${t.quantidade||0} ${t.unidade||''}`},
      {label:'% Concluído',valor:`${t.percentualConcluido||0}%`},
      {label:'Responsável',valor:t.responsavel||'—'},
    ]};
    // Levantamento de Fachada agregado
    if(id==='__fachada__'){
      const fachadas=levFachadas.filter(x=>x.tipo==='fachada');
      const pecasTodas=levFachadas.filter(x=>x.tipo==='peca');
      const m2Total=pecasTodas.reduce((s,p)=>s+(_m(p.comprimento)*_m(p.altura)*(p.quantidade||1)),0);
      // Detalhe por fachada
      const porFachada=fachadas.map(f=>{
        const pecasF=pecasTodas.filter(p=>p.fachadaId===f.id);
        const m2F=pecasF.reduce((s,p)=>s+(_m(p.comprimento)*_m(p.altura)*(p.quantidade||1)),0);
        return {label:f.nome,valor:_f(m2F)+' m²'};
      });
      return {id,label:'[Levantamento] Fachada',tipo:'fachada_agregada',quantidade:m2Total,unidade:'m²',detalhes:[
        {label:'m² Total Geral',valor:_f(m2Total)+' m²'},
        {label:'Fachadas',valor:fachadas.length},
        {label:'Peças',valor:pecasTodas.length},
        ...porFachada.slice(0,4), // mostra até 4 fachadas no detalhe
      ]};
    }
    return null;
  }

  function _calcQtdTarefa(info,m){
    const n=_calcQtdTarefaNum(info,m);
    return n?_f(n)+' '+( m.unidade||''):info.quantidade?_f(info.quantidade)+' '+(info.unidade||''):'—';
  }
  function _calcQtdTarefaNum(info,m){
    if(!info||!info.quantidade)return 0;
    const cons=parseFloat(m.consumoPrevisto)||0;
    return cons?parseFloat((info.quantidade*cons).toFixed(2)):info.quantidade;
  }

  // CRUD
  function novoMaterial(){
    editandoId=null;
    document.getElementById('modal-material-titulo').textContent='Novo Material';
    Utils.limparForm('form-material');
    _popTarefaSelect();
    Utils.abrirModal('modal-material');
  }
  function editarMaterial(id){
    const m=materiais.find(x=>x.id===id);if(!m)return;
    editandoId=id;
    document.getElementById('modal-material-titulo').textContent='Editar Material';
    _popTarefaSelect();
    Utils.setFormData('form-material',m);
    document.getElementById('mat-tarefa-sel').value=m.tarefaId||m.tarefaRef||'';
    Utils.abrirModal('modal-material');
  }

  function _popTarefaSelect(){
    const sel=document.getElementById('mat-tarefa-sel');if(!sel)return;
    const opts=_getOpcoesTarefa();
    sel.innerHTML='<option value="">— Sem vínculo —</option>'+
      opts.map(o=>`<option value="${o.id}">${o.label}</option>`).join('');
  }

  async function salvarMaterial(){
    const data=Utils.getFormData('form-material');
    const tarefaId=document.getElementById('mat-tarefa-sel').value;
    if(!data.nome){Utils.toast('Informe o nome.','alerta');return;}
    data.tarefaId=tarefaId||null;
    try{
      if(editandoId){await Database.atualizar(obraId,COL,editandoId,data);}
      else{await Database.criar(obraId,COL,data);}
      Utils.fecharModal('modal-material');
      Utils.toast('Material salvo!','sucesso');
      editandoId=null;
      await carregar();
    }catch(e){Utils.toast('Erro.','erro');}
  }

  async function excluirMaterial(id){
    if(!Utils.confirmar('Excluir material?'))return;
    try{await Database.deletar(obraId,COL,id);Utils.toast('Excluído.','sucesso');await carregar();}
    catch(e){Utils.toast('Erro.','erro');}
  }

  function setFiltro(v){filtroTarefa=v;renderizar();}

  // Helpers
  function _m(cm){return (parseFloat(cm)||0)/100;}
  function _f(n){return Utils.formatarNumero(n);}

  return {init,carregar,renderizar,novoMaterial,editarMaterial,salvarMaterial,excluirMaterial,setFiltro};
})();
function onObraChanged(){Materiais.init();}

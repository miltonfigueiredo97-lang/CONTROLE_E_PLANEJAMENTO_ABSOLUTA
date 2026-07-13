// ============================================
// Módulo: Mão de Obra — V1.1
// Biblioteca de mão de obra + vínculo por tarefa
// Valor unitário × quantidade da tarefa = custo total (base de cálculo)
// Vínculo por busca hierárquica (nível 1, depois níveis 2 dele, etc.),
// igual ao padrão adotado em Materiais — pode vincular a qualquer nível
// (grupo/etapa ou tarefa folha) do Planejamento.
// ============================================
const MaoDeObra = (() => {
  let obraId=null;
  let biblioteca=[], vinculos=[], tarefas=[], levFachadas=[];
  let abaAtiva='vinculos', filtroTarefa='';
  let editandoBiblId=null, editandoVincId=null, _modoVinc='vincular';
  let _buscaTarText='', _vincTarSelIds=[];
  const COL_BIB='maoDeObra', COL_VIN='maoDeObra_vinculos';

  const CATEGORIAS=['Pedreiro','Servente','Ajudante','Carpinteiro','Armador',
    'Eletricista','Encanador / Hidráulica','Pintor','Gesseiro','Azulejista',
    'Empreiteira / Terceirizado','Outro'];
  const UNIDADES=['m²','m³','m','un','vb','h','diária','mês','kg','t'];

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
    const c=document.getElementById('mdo-content');if(!c)return;
    c.innerHTML=
      `<div class="page-header">
        <div><h2>Mão de Obra</h2>
          <span class="subtitulo">${biblioteca.length} na biblioteca · ${vinculos.length} vínculo(s)</span></div>
        <div class="btn-grupo">
          <button class="btn btn-secundario btn-sm" onclick="MaoDeObra.exportar()">📤 Exportar</button>
          ${abaAtiva==='biblioteca'
            ?`<button class="btn btn-secundario btn-sm" onclick="MaoDeObra.setAba('vinculos')">← Por Tarefa</button>
              <button class="btn btn-primario btn-sm" onclick="MaoDeObra.novaMaoDeObraBib()">+ Nova Mão de Obra</button>`
            :`<button class="btn btn-secundario btn-sm" onclick="MaoDeObra.setAba('biblioteca')">👷 Biblioteca (${biblioteca.length})</button>
              <button class="btn btn-primario btn-sm" onclick="MaoDeObra.novoVinculo()">+ Adicionar Nova Mão de Obra</button>`}
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
    const vf=filtroTarefa?vinculos.filter(v=>_getTarefaIds(v).includes(filtroTarefa)):vinculos;
    const info=filtroTarefa?_getTarefaInfo(filtroTarefa):null;
    const totalGeral=vf.reduce((s,v)=>{
      const ti=_getTarefaInfoMulti(_getTarefaIds(v));
      return s+_calcTotalNum(ti,v);
    },0);

    return `
      <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;align-items:center;">
        <select class="form-control" style="width:340px;" onchange="MaoDeObra.setFiltro(this.value)">
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
        <button class="btn btn-primario" onclick="MaoDeObra.novoVinculo()">+ Adicionar Nova Mão de Obra</button></div>`:`
      <div class="tabela-container"><table class="tabela tabela-compacta">
        <thead><tr><th>Mão de Obra</th><th>Categoria</th><th>Serviço</th>
          <th class="col-num">Valor Unit.</th><th class="col-num">Quantidade</th>
          <th class="col-num" style="color:var(--cor-primaria);">Custo Total</th>
          <th class="col-acoes">Ações</th></tr></thead>
        <tbody>${vf.map(v=>{
          const mo=biblioteca.find(m=>m.id===v.maoDeObraId);
          const ti=_getTarefaInfoMulti(_getTarefaIds(v));
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
  // Todos os níveis do Planejamento (grupos e tarefas), com indentação e
  // ordem hierárquica — usa o helper compartilhado (mesma convenção adotada
  // em Materiais) para permitir vincular tanto a um nível maior (grupo/etapa)
  // quanto a um nível menor (tarefa folha).
  function _getOpcoesTarefa(){
    const opts=Utils.opcoesTarefaHierarquia(tarefas);
    if(levFachadas.some(d=>d.tipo==='fachada'))opts.push({id:'__fachada__',label:'[Levantamento] Fachada',nivel:0,tipo:'especial'});
    return opts;
  }

  function _getTarefaInfo(id){
    if(!id)return null;
    if(id==='__fachada__'){
      const m2=Utils.calcularFachadaM2(levFachadas.filter(x=>x.tipo==='peca'),obraId).m2semML;
      return {id,label:'[Levantamento] Fachada',quantidade:m2,unidade:'m²',tipo:'especial'};
    }
    const t=tarefas.find(x=>x.id===id);
    if(!t)return null;
    return {id,label:t.nome||'',quantidade:t.quantidade||0,unidade:t.unidade||'un',tipo:t.tipo||'tarefa'};
  }

  // Um vínculo pode estar ligado a mais de uma tarefa (tarefaIds). Docs
  // antigos têm apenas tarefaId (singular) — suporta os dois formatos.
  function _getTarefaIds(v){
    return v.tarefaIds||(v.tarefaId?[v.tarefaId]:[]);
  }

  // Combina as tarefas de um vínculo em uma única "linha": nomes unidos
  // por " + " e quantidade SOMADA (não uma linha por tarefa).
  function _getTarefaInfoMulti(ids){
    const infos=(ids||[]).map(_getTarefaInfo).filter(Boolean);
    if(!infos.length)return null;
    if(infos.length===1)return infos[0];
    const mesmaUnidade=infos.every(i=>i.unidade===infos[0].unidade);
    return {
      id:ids.join(','),
      label:infos.map(i=>i.label).join(' + '),
      quantidade:infos.reduce((s,i)=>s+(i.quantidade||0),0),
      unidade:mesmaUnidade?infos[0].unidade:'(misto)',
      tipo:'multi',
    };
  }

  // Custo total = valor unitário × quantidade da tarefa, quando a tarefa
  // tem quantidade; caso contrário, mostra apenas o valor unitário informado.
  function _calcTotalNum(info,v){
    const valor=parseFloat(v.valor)||0;
    if(!info||!info.quantidade)return valor;
    return valor*info.quantidade;
  }

  function _fNum(n){return Utils.formatarNumero(n);}

  // ===== Busca fuzzy de tarefa (código ou nome), tolerante a erro de digitação =====
  function _normalizar(s){return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();}
  function _levenshtein(a,b){
    const m=a.length,n=b.length;
    if(!m)return n;if(!n)return m;
    const d=Array.from({length:m+1},(_,i)=>[i,...Array(n).fill(0)]);
    for(let j=0;j<=n;j++)d[0][j]=j;
    for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)
      d[i][j]=a[i-1]===b[j-1]?d[i-1][j-1]:1+Math.min(d[i-1][j],d[i][j-1],d[i-1][j-1]);
    return d[m][n];
  }
  function _score(txtNorm,queryNorm){
    if(!queryNorm)return 1;
    if(txtNorm===queryNorm)return 100;
    if(txtNorm.startsWith(queryNorm))return 90;
    if(txtNorm.includes(queryNorm))return 80;
    const pq=queryNorm.split(/\s+/).filter(Boolean),pn=txtNorm.split(/\s+/).filter(Boolean);
    if(pq.every(q=>pn.some(n=>n.includes(q))))return 70;
    const dist=_levenshtein(txtNorm,queryNorm);
    const tol=Math.max(2,Math.floor(queryNorm.length*0.35));
    if(dist<=tol)return 60-dist;
    if(pq.some(q=>pn.some(n=>_levenshtein(n,q)<=Math.max(1,Math.floor(q.length*0.3)))))return 40;
    return -1;
  }
  function _destacar(txt,query){
    if(!query||!query.trim())return txt;
    const qN=_normalizar(query),tN=_normalizar(txt);
    const idx=tN.indexOf(qN);
    if(idx===-1)return txt;
    return txt.slice(0,idx)+'<mark style="background:rgba(245,200,0,0.35);color:inherit;border-radius:2px;">'+txt.slice(idx,idx+query.length)+'</mark>'+txt.slice(idx+query.length);
  }
  function _buscarTarefaOpts(texto){
    const opts=_getOpcoesTarefa();
    const q=_normalizar(texto);
    if(!q)return opts; // sem busca: mostra a árvore completa (nível 1, depois níveis 2 dele, etc.)
    return opts.map(o=>({o,score:_score(_normalizar(o.label),q)}))
      .filter(x=>x.score>=0).sort((a,b)=>b.score-a.score).map(x=>x.o);
  }

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
    editandoVincId=null;_modoVinc='vincular';_buscaTarText='';_vincTarSelIds=[];
    document.getElementById('modal-mdo-vinc-titulo').textContent='Adicionar Nova Mão de Obra';
    _renderVincModal(null);
    Utils.abrirModal('modal-mdo-vinc');
  }
  function editarVinculo(id){
    const v=vinculos.find(x=>x.id===id);if(!v)return;
    editandoVincId=id;_modoVinc='vincular';
    _vincTarSelIds=_getTarefaIds(v);
    _buscaTarText='';
    document.getElementById('modal-mdo-vinc-titulo').textContent='Editar Vínculo';
    _renderVincModal(v);
    Utils.abrirModal('modal-mdo-vinc');
  }
  function toggleModoVinc(m){_modoVinc=m;_renderVincModal(editandoVincId?vinculos.find(x=>x.id===editandoVincId):null);}

  function _renderResultadosTarefa(){
    const resultados=_buscarTarefaOpts(_buscaTarText).slice(0,40);
    if(!resultados.length)return `<div class="text-sm text-muted" style="padding:8px;">Nenhuma tarefa/serviço encontrado.</div>`;
    return resultados.map(o=>`
      <div class="tree-item${_vincTarSelIds.includes(o.id)?' ativo':''}" style="padding:8px 10px;white-space:pre;" onclick="MaoDeObra.selecionarTarefaVinc('${o.id}')">
        <span class="tree-icon">${_vincTarSelIds.includes(o.id)?'✅':(o.tipo==='especial'?'🏗️':(o.tipo==='grupo'?'📁':'📄'))}</span>
        <span class="tree-label" style="white-space:pre;">${_destacar(o.label,_buscaTarText)}</span>
      </div>`).join('');
  }

  function _renderTarefasSelecionadasChips(){
    if(!_vincTarSelIds.length)return '';
    const opts=_getOpcoesTarefa();
    return `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;">
      ${_vincTarSelIds.map(id=>{
        const o=opts.find(x=>x.id===id);
        const label=o?o.label.replace(/\u2007/g,''):id;
        return `<span class="badge badge-amarelo" style="display:inline-flex;align-items:center;gap:6px;">${label}
          <span style="cursor:pointer;font-weight:800;" onclick="MaoDeObra.removerTarefaVinc('${id}')">✕</span></span>`;
      }).join('')}
    </div>`;
  }

  function _renderVincModal(v){
    const body=document.getElementById('mdo-vinc-body');if(!body)return;
    const snap=_snapshotVincForm(body);
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

      <div class="form-grupo"><label>Buscar serviço / tarefa *
        <span class="text-muted" style="font-weight:400;font-size:0.75rem;"> (qualquer nível — pode selecionar mais de uma tarefa)</span></label>
        <input type="text" id="mdo-vinc-tar-busca" class="form-control" placeholder="Digite para buscar... Ex: alvenaria, pintura"
          value="${_buscaTarText}" oninput="MaoDeObra.onBuscaTarefaVinc(this.value)"></div>
      <div id="mdo-vinc-tar-resultados" style="max-height:200px;overflow-y:auto;border:1px solid var(--cor-borda-light);border-radius:8px;margin-bottom:10px;">
        ${_renderResultadosTarefa()}
      </div>
      <div id="mdo-vinc-chips">${_renderTarefasSelecionadasChips()}</div>

      <div class="form-row">
        <div class="form-grupo">
          <label>Valor (R$) *</label>
          <input id="mdo-vinc-valor" type="number" step="0.01" min="0" class="form-control"
            value="${v?.valor||''}" placeholder="0,00">
        </div>
        <div class="form-grupo">
          <label>Unidade do valor *
            <span class="text-muted" style="font-weight:400;font-size:0.7rem;">(digite p/ criar nova, ex: m³)</span></label>
          <input id="mdo-vinc-und" class="form-control" list="mdo-unidades-list"
            value="${v?.unidade||'m²'}" placeholder="m², m³, un...">
          <datalist id="mdo-unidades-list">${UNIDADES.map(u=>`<option value="${u}">`).join('')}</datalist>
        </div>
      </div>
      <div class="form-grupo"><label>Observações</label>
        <textarea id="mdo-vinc-obs" class="form-control" rows="2">${v?.observacoes||''}</textarea></div>`;
    _restoreVincForm(body,snap);
  }

  // Preserva o que o usuário já digitou (nome, valor, observações, etc.)
  // ao re-renderizar o modal por causa de uma seleção de tarefa/mão de
  // obra — sem isso, o innerHTML novo apaga tudo que já tinha sido escrito.
  function _snapshotVincForm(body){
    const snap={};
    body.querySelectorAll('input[id], textarea[id], select[id]').forEach(el=>{snap[el.id]=el.value;});
    return snap;
  }
  function _restoreVincForm(body,snap){
    Object.keys(snap).forEach(id=>{
      const el=body.querySelector('#'+id);
      if(el)el.value=snap[id];
    });
  }

  function onBuscaTarefaVinc(texto){
    _buscaTarText=texto;
    const lista=document.getElementById('mdo-vinc-tar-resultados');
    if(lista)lista.innerHTML=_renderResultadosTarefa();
  }
  function selecionarTarefaVinc(id){
    const i=_vincTarSelIds.indexOf(id);
    if(i>=0)_vincTarSelIds.splice(i,1);else _vincTarSelIds.push(id);
    const lista=document.getElementById('mdo-vinc-tar-resultados');
    if(lista)lista.innerHTML=_renderResultadosTarefa();
    const chips=document.getElementById('mdo-vinc-chips');
    if(chips)chips.innerHTML=_renderTarefasSelecionadasChips();
  }
  function removerTarefaVinc(id){
    _vincTarSelIds=_vincTarSelIds.filter(x=>x!==id);
    const lista=document.getElementById('mdo-vinc-tar-resultados');
    if(lista)lista.innerHTML=_renderResultadosTarefa();
    const chips=document.getElementById('mdo-vinc-chips');
    if(chips)chips.innerHTML=_renderTarefasSelecionadasChips();
  }

  async function salvarVinculo(){
    const tarefaIds=_vincTarSelIds.slice();
    if(!tarefaIds.length){Utils.toast('Busque e selecione ao menos uma tarefa.','alerta');return;}
    const valor=parseFloat(document.getElementById('mdo-vinc-valor')?.value);
    if(!valor||valor<=0){Utils.toast('Informe o valor.','alerta');return;}
    const unidade=document.getElementById('mdo-vinc-und')?.value.trim()||'m²';
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
      const chave=[...tarefaIds].sort().join('|');
      const existe=vinculos.find(x=>x.maoDeObraId===maoDeObraId&&
        [..._getTarefaIds(x)].sort().join('|')===chave);
      if(existe&&!Utils.confirmar('Já existe um vínculo idêntico (mesma mão de obra e mesmas tarefas). Criar mesmo assim?'))return;
    }

    const data={maoDeObraId,tarefaIds,valor,unidade,observacoes};
    try{
      if(editandoVincId)await Database.atualizar(obraId,COL_VIN,editandoVincId,data);
      else await Database.criar(obraId,COL_VIN,data);
      Utils.fecharModal('modal-mdo-vinc');
      Utils.toast('Vínculo salvo!','sucesso');
      editandoVincId=null;await carregar();
    }catch(e){console.error(e);Utils.toast('Erro.','erro');}
  }

  async function excluirVinculo(id){
    if(!Utils.confirmar('Remover este vínculo?'))return;
    try{await Database.deletar(obraId,COL_VIN,id);Utils.toast('Removido.','sucesso');await carregar();}
    catch(e){Utils.toast('Erro.','erro');}
  }

  // ===================== EXPORTAR (XLSX) =====================
  // Nome da obra em destaque (linha grande mesclada) antes da tabela em si,
  // seguido de subtítulo com a aba atual (Biblioteca ou Por Tarefa) e data.
  function _ls(src){return new Promise((r,j)=>{const s=document.createElement('script');s.src=src;s.onload=r;s.onerror=j;document.head.appendChild(s);});}

  async function exportar(){
    try{
      Utils.mostrarLoading('Gerando planilha...');
      if(typeof XLSX==='undefined')await _ls('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
      const obra=Router.getObra();
      const nomeObra=(obra?.nome||'Obra sem nome').toUpperCase();
      const dataExp=new Date().toLocaleDateString('pt-BR');

      let H,rows,subtitulo;
      if(abaAtiva==='biblioteca'){
        subtitulo='Mão de Obra — Biblioteca';
        H=['Mão de Obra','Categoria','Observações','Nº de Vínculos'];
        rows=biblioteca.map(m=>[m.nome||'',m.categoria||'',m.observacoes||'',
          vinculos.filter(v=>v.maoDeObraId===m.id).length]);
      }else{
        const infoFiltro=filtroTarefa?_getTarefaInfo(filtroTarefa):null;
        subtitulo='Mão de Obra — Por Tarefa'+(infoFiltro?` (filtrado: ${infoFiltro.label})`:'');
        H=['Mão de Obra','Categoria','Serviço / Tarefa','Valor Unit. (R$)','Unidade','Quantidade da Tarefa','Custo Total (R$)'];
        const vf=filtroTarefa?vinculos.filter(v=>_getTarefaIds(v).includes(filtroTarefa)):vinculos;
        rows=vf.map(v=>{
          const mo=biblioteca.find(m=>m.id===v.maoDeObraId);
          const ti=_getTarefaInfoMulti(_getTarefaIds(v));
          const total=_calcTotalNum(ti,v);
          return[mo?mo.nome:'(removido)',mo?.categoria||'',ti?ti.label:'',
            parseFloat(v.valor)||0,v.unidade||'',ti?ti.quantidade:'',total];
        });
        const totalGeral=rows.reduce((s,r)=>s+(parseFloat(r[6])||0),0);
        rows.push(['','','','','','TOTAL GERAL',totalGeral]);
      }

      const ncols=H.length;
      const aoa=[[nomeObra],[subtitulo+' — Exportado em '+dataExp],[],H,...rows];
      const ws=XLSX.utils.aoa_to_sheet(aoa);
      ws['!merges']=[
        {s:{r:0,c:0},e:{r:0,c:ncols-1}},
        {s:{r:1,c:0},e:{r:1,c:ncols-1}},
      ];
      ws['!rows']=[{hpx:34},{hpx:20},{hpx:8}];
      if(ws['A1'])ws['A1'].s={font:{bold:true,sz:20},alignment:{horizontal:'center',vertical:'center'}};
      if(ws['A2'])ws['A2'].s={font:{bold:true,sz:12,color:{rgb:'8a6d00'}},alignment:{horizontal:'center'}};
      ws['!cols']=H.map((h,i)=>i===0?{wch:26}:i===2?{wch:34}:{wch:16});

      const wb=XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb,ws,'Mão de Obra');
      const nomeArquivo=`mao_de_obra_${(obra?.nome||'obra').replace(/[^a-z0-9]/gi,'_')}.xlsx`;
      XLSX.writeFile(wb,nomeArquivo,{cellStyles:true});
      Utils.toast('Planilha exportada!','sucesso');
    }catch(e){console.error(e);Utils.toast('Erro ao exportar: '+e.message,'erro');}
    finally{Utils.esconderLoading();}
  }

  function setAba(a){abaAtiva=a;renderizar();}
  function setFiltro(v){filtroTarefa=v;renderizar();}

  return {init,carregar,renderizar,setAba,setFiltro,
    novaMaoDeObraBib,editarMaoDeObraBib,salvarMaoDeObraBib,excluirMaoDeObraBib,
    novoVinculo,editarVinculo,salvarVinculo,excluirVinculo,toggleModoVinc,
    onBuscaTarefaVinc,selecionarTarefaVinc,removerTarefaVinc,exportar};
})();
function onObraChanged(){MaoDeObra.init();}

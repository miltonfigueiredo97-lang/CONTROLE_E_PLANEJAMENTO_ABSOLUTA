// ============================================
// Módulo: Materiais — V1.3
// Biblioteca com UID único + conversão embalagem
// Vínculos por tarefa com relatório de fachada
// ============================================
const Materiais = (() => {
  let obraId=null;
  let biblioteca=[], vinculos=[], tarefas=[], levFachadas=[];
  let abaAtiva='vinculos', filtroTarefa='';
  let editandoBiblId=null, editandoVincId=null, _modoVinc='vincular';
  let _buscaTarText='', _buscaMatText='', _vincTarSelIds=[], _vincMatSelId='';
  const COL_BIB='materiais', COL_VIN='materiais_vinculos';

  const UNIDADES_CONSUMO=['kg/m²','kg/m','kg/un','kg/m³','L/m²','L/m','L/un','L/m³',
    'saco/m²','saco/m','saco/un','caixa/m²','caixa/m','caixa/un',
    'un/m²','un/m','un/un','un/m³','m²/m²','m/m²','m/m','m³/m²','m³/m','m³/un','t/m²','t/m','t/m³'];
  const UNIDADES_MAT=['kg','L','m²','m³','m','un','saco','caixa','lata','balde','fardo','rolo','t'];

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
        <div><h2>Materiais</h2>
          <span class="subtitulo">${biblioteca.length} na biblioteca · ${vinculos.length} vínculo(s)</span></div>
        <div class="btn-grupo">
          ${abaAtiva==='biblioteca'
            ?`<button class="btn btn-secundario btn-sm" onclick="Materiais.setAba('vinculos')">← Por Tarefa</button>
              <button class="btn btn-primario btn-sm" onclick="Materiais.novoMaterialBib()">+ Novo Material</button>`
            :`<button class="btn btn-secundario btn-sm" onclick="Materiais.setAba('biblioteca')">📚 Biblioteca (${biblioteca.length})</button>
              <button class="btn btn-primario btn-sm" onclick="Materiais.novoVinculo()">+ Vincular / Criar</button>`}
        </div>
      </div>
      <div id="mat-corpo">${abaAtiva==='biblioteca'?_renderBib():_renderVinculos()}</div>`;
  }

  // ====== BIBLIOTECA ======
  function _renderBib(){
    if(!biblioteca.length) return `<div class="estado-vazio">
      <div class="icone">📚</div><p>Biblioteca vazia.</p>
      <button class="btn btn-primario" onclick="Materiais.novoMaterialBib()">+ Cadastrar Material</button></div>`;
    return `<div class="tabela-container"><table class="tabela">
      <thead><tr><th>Material</th><th>Tipo</th><th>Fabricante</th><th>Ref.</th>
        <th class="col-num">Unidade</th><th class="col-num">Preço Unit.</th><th class="col-num">Embalagem</th>
        <th class="col-num">Vínculos</th><th class="col-acoes">Ações</th></tr></thead>
      <tbody>${biblioteca.map(m=>{
        const usos=vinculos.filter(v=>v.materialId===m.id).length;
        const emb=m.embalagemQtd&&m.embalagemUnidade
          ?`1 ${m.embalagemUnidade} = ${m.embalagemQtd} ${m.embalagemBaseUnidade||m.unidade}`:'—';
        return `<tr>
          <td><strong>${m.nome}</strong>${m.referencia?`<br><small class="text-muted">${m.referencia}</small>`:''}</td>
          <td>${m.tipo||'—'}</td><td>${m.fabricante||'—'}</td>
          <td class="text-sm text-muted">${m.referencia||'—'}</td>
          <td class="col-num">${m.unidade||'—'}</td>
          <td class="col-num" style="font-family:var(--font-mono);">${m.preco?'R$ '+_fNum(m.preco):'—'}</td>
          <td class="col-num" style="font-size:0.75rem;color:#888;">${emb}</td>
          <td class="col-num">${usos?`<span class="badge badge-amarelo">${usos}</span>`:'—'}</td>
          <td class="col-acoes">
            <button class="btn btn-secundario btn-sm" onclick="Materiais.editarMaterialBib('${m.id}')">✎ Editar</button>
            <button class="btn btn-perigo btn-sm btn-icon" onclick="Materiais.excluirMaterialBib('${m.id}')">✕</button>
          </td></tr>`;
      }).join('')}</tbody></table></div>`;
  }

  // ====== POR TAREFA ======
  function _renderVinculos(){
    const opts=_getOpcoesTarefa();
    const vf=filtroTarefa?vinculos.filter(v=>_getTarefaIds(v).includes(filtroTarefa)):vinculos;
    const info=filtroTarefa?_getTarefaInfo(filtroTarefa):null;
    const isFachada=filtroTarefa==='__fachada__';

    return `
      <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;align-items:center;">
        <select class="form-control" style="width:300px;" onchange="Materiais.setFiltro(this.value)">
          <option value="">Todos os serviços / tarefas</option>
          ${opts.map(o=>`<option value="${o.id}" ${filtroTarefa===o.id?'selected':''}>${o.label}</option>`).join('')}
        </select>
        ${filtroTarefa?`<button class="btn btn-secundario btn-sm" onclick="Materiais.setFiltro('')">✕ Limpar</button>`:''}
      </div>

      ${info?`<div style="background:var(--cor-dark-800);border-radius:8px;padding:12px 18px;margin-bottom:14px;
        border-left:3px solid var(--cor-primaria);display:flex;gap:16px;flex-wrap:wrap;align-items:center;">
        <span style="font-weight:700;color:var(--cor-primaria);font-size:0.88rem;">${info.label}</span>
        <span style="color:#555;">|</span>
        <span style="font-size:0.8rem;color:#888;">Total:</span>
        <span style="font-weight:700;font-family:var(--font-mono);color:#fff;">${_fNum(info.quantidade)} ${info.unidade}</span>
      </div>`:''}

      ${isFachada&&info?_renderRelatorioFachada(vf):''}

      ${!vf.length?`<div class="estado-vazio"><div class="icone">🔗</div>
        <p>${filtroTarefa?'Nenhum material vinculado.':'Nenhum vínculo cadastrado.'}</p>
        <button class="btn btn-primario" onclick="Materiais.novoVinculo()">+ Vincular / Criar material</button></div>`:`
      <div style="display:flex;justify-content:flex-end;margin-bottom:8px;">
        <div style="background:var(--cor-dark-800);border-radius:8px;padding:8px 16px;border-left:3px solid var(--cor-primaria);">
          <span style="font-size:0.75rem;color:#888;">Custo total (materiais):</span>
          <strong style="font-family:var(--font-mono);color:var(--cor-primaria);margin-left:6px;">R$ ${_fNum(vf.reduce((s,v)=>{
            const mat=biblioteca.find(m=>m.id===v.materialId);
            const ti=_getTarefaInfoMulti(_getTarefaIds(v));
            return s+_calcCustoNum(ti,v,mat);
          },0))}</strong>
        </div>
      </div>
      <div class="tabela-container"><table class="tabela tabela-compacta">
        <thead><tr><th>Material</th><th>Tipo</th><th>Fabricante</th><th>Serviço</th>
          <th class="col-num">Consumo Prev.</th><th class="col-num">Consumo Real</th>
          <th class="col-num" style="color:var(--cor-primaria);">Total (mat.)</th>
          <th class="col-num" style="color:#aaa;">Total (emb.)</th>
          <th class="col-num" style="color:var(--cor-primaria);">Custo (R$)</th>
          <th class="col-acoes">Ações</th></tr></thead>
        <tbody>${vf.map(v=>{
          const mat=biblioteca.find(m=>m.id===v.materialId);
          const ti=_getTarefaInfoMulti(_getTarefaIds(v));
          const {totalBase,totalEmb}=_calcTotal(ti,v,mat);
          const custo=_calcCustoNum(ti,v,mat);
          return `<tr>
            <td><strong>${mat?mat.nome:'(removido)'}</strong></td>
            <td>${mat?.tipo||'—'}</td><td>${mat?.fabricante||'—'}</td>
            <td style="font-size:0.82rem;">${ti?ti.label:'—'}</td>
            <td class="col-num" style="font-family:var(--font-mono);">${v.consumoPrevisto?v.consumoPrevisto+' '+v.unidadeConsumo:'—'}</td>
            <td class="col-num" style="font-family:var(--font-mono);">${v.consumoReal?v.consumoReal+' '+v.unidadeConsumo:'—'}</td>
            <td class="col-num" style="font-weight:700;color:var(--cor-primaria);font-family:var(--font-mono);">${totalBase}</td>
            <td class="col-num" style="color:#888;font-family:var(--font-mono);">${totalEmb}</td>
            <td class="col-num" style="font-weight:700;color:var(--cor-primaria);font-family:var(--font-mono);">${custo?'R$ '+_fNum(custo):'—'}</td>
            <td class="col-acoes">
              <button class="btn btn-secundario btn-sm" onclick="Materiais.editarVinculo('${v.id}')">✎</button>
              <button class="btn btn-perigo btn-sm btn-icon" onclick="Materiais.excluirVinculo('${v.id}')">✕</button>
            </td></tr>`;
        }).join('')}</tbody></table></div>`}`;
  }

  // ====== RELATÓRIO FACHADA ======
  function _renderRelatorioFachada(vf){
    const fachadas=levFachadas.filter(x=>x.tipo==='fachada');
    const balancins=levFachadas.filter(x=>x.tipo==='balancim');
    const pecas=levFachadas.filter(x=>x.tipo==='peca');
    if(!fachadas.length||!vf.length)return '';

    // Para cada material vinculado, calcula por fachada e por balancim
    return `<div style="margin-bottom:16px;">
      ${vf.map(v=>{
        const mat=biblioteca.find(m=>m.id===v.materialId);
        if(!mat)return '';
        const cons=parseFloat(v.consumoPrevisto)||0;
        const uc=v.unidadeConsumo||'';

        return `<div style="background:var(--cor-dark-800);border-radius:8px;margin-bottom:10px;overflow:hidden;">
          <div style="background:var(--cor-dark-900);padding:10px 16px;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-weight:700;color:#fff;">${mat.nome}</span>
            <span style="font-size:0.75rem;color:#888;">${cons?cons+' '+uc:'sem consumo definido'}</span>
          </div>
          <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:0.8rem;">
            <thead>
              <tr style="background:rgba(255,255,255,0.03);">
                <th style="padding:8px 12px;text-align:left;color:#666;font-weight:600;border-bottom:1px solid #1a1a1a;">Fachada</th>
                <th style="padding:8px 12px;text-align:left;color:#666;font-weight:600;border-bottom:1px solid #1a1a1a;">Balancim</th>
                <th style="padding:8px 12px;text-align:right;color:#666;font-weight:600;border-bottom:1px solid #1a1a1a;">m²</th>
                ${cons?`<th style="padding:8px 12px;text-align:right;color:var(--cor-primaria);font-weight:600;border-bottom:1px solid #1a1a1a;">Total ${mat.unidade||''}</th>`:''}
                ${cons&&mat.embalagemQtd?`<th style="padding:8px 12px;text-align:right;color:#888;font-weight:600;border-bottom:1px solid #1a1a1a;">Total ${mat.embalagemUnidade||''}</th>`:''}
              </tr>
            </thead>
            <tbody>
              ${fachadas.map(f=>{
                const bals=balancins.filter(b=>b.fachadaId===f.id);
                let fachadaM2=0;
                const balRows=bals.map(b=>{
                  const pBal=pecas.filter(p=>p.balancimId===b.id);
                  const m2=pBal.reduce((s,p)=>{
                    const co=(parseFloat(p.comprimento)||0)/100;
                    const al=(parseFloat(p.altura)||0)/100;
                    return s+co*al*(parseFloat(p.quantidade)||1);
                  },0);
                  fachadaM2+=m2;
                  const tot=cons?_fNum(m2*cons):'—';
                  const emb=cons&&mat.embalagemQtd?_fNum(m2*cons/parseFloat(mat.embalagemQtd)):'';
                  return `<tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                    <td style="padding:6px 12px;color:#555;"></td>
                    <td style="padding:6px 12px;color:#aaa;">${b.nome||'Balancim'}</td>
                    <td style="padding:6px 12px;text-align:right;font-family:var(--font-mono);color:#888;">${_fNum(m2)}</td>
                    ${cons?`<td style="padding:6px 12px;text-align:right;font-family:var(--font-mono);color:#fff;">${tot}</td>`:''}
                    ${cons&&mat.embalagemQtd?`<td style="padding:6px 12px;text-align:right;font-family:var(--font-mono);color:#888;">${emb}</td>`:''}
                  </tr>`;
                }).join('');
                const facTot=cons?_fNum(fachadaM2*cons):'—';
                const facEmb=cons&&mat.embalagemQtd?_fNum(fachadaM2*cons/parseFloat(mat.embalagemQtd)):'';
                return `<tr style="background:rgba(245,200,0,0.04);border-top:1px solid rgba(245,200,0,0.15);">
                  <td style="padding:7px 12px;font-weight:700;color:var(--cor-primaria);" colspan="1">${f.nome}</td>
                  <td style="padding:7px 12px;color:#666;font-size:0.72rem;">${bals.length} balancim(s)</td>
                  <td style="padding:7px 12px;text-align:right;font-family:var(--font-mono);font-weight:700;color:#ccc;">${_fNum(fachadaM2)}</td>
                  ${cons?`<td style="padding:7px 12px;text-align:right;font-family:var(--font-mono);font-weight:700;color:var(--cor-primaria);">${facTot}</td>`:''}
                  ${cons&&mat.embalagemQtd?`<td style="padding:7px 12px;text-align:right;font-family:var(--font-mono);color:#888;">${facEmb}</td>`:''}
                </tr>${balRows}`;
              }).join('')}
              <tr style="background:rgba(245,200,0,0.1);border-top:2px solid var(--cor-primaria);">
                <td style="padding:8px 12px;font-weight:800;color:var(--cor-primaria);" colspan="2">TOTAL GERAL</td>
                <td style="padding:8px 12px;text-align:right;font-family:var(--font-mono);font-weight:700;color:#fff;">
                  ${_fNum(pecas.reduce((s,p)=>s+(parseFloat(p.comprimento)||0)/100*(parseFloat(p.altura)||0)/100*(parseFloat(p.quantidade)||1),0))}
                </td>
                ${cons?`<td style="padding:8px 12px;text-align:right;font-family:var(--font-mono);font-weight:800;color:var(--cor-primaria);">
                  ${_fNum(pecas.reduce((s,p)=>s+(parseFloat(p.comprimento)||0)/100*(parseFloat(p.altura)||0)/100*(parseFloat(p.quantidade)||1),0)*cons)} ${mat.unidade||''}
                </td>`:''}
                ${cons&&mat.embalagemQtd?`<td style="padding:8px 12px;text-align:right;font-family:var(--font-mono);font-weight:700;color:#aaa;">
                  ${_fNum(pecas.reduce((s,p)=>s+(parseFloat(p.comprimento)||0)/100*(parseFloat(p.altura)||0)/100*(parseFloat(p.quantidade)||1),0)*cons/parseFloat(mat.embalagemQtd))} ${mat.embalagemUnidade||''}
                </td>`:''}
              </tr>
            </tbody>
          </table>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }

  // ====== HELPERS ======
  function _getOpcoesTarefa(){
    return Utils.opcoesTarefaHierarquia(tarefas);
  }

  function _getTarefaInfo(id){
    if(!id)return null;
    const t=tarefas.find(x=>x.id===id);
    if(t)return {id,label:`[Plan] ${t.nome}`,quantidade:t.quantidade||0,unidade:t.unidade||'un'};
    if(id==='__fachada__'){
      const m2=Utils.calcularFachadaM2(levFachadas.filter(x=>x.tipo==='peca'),obraId).m2semML;
      return {id,label:'[Levantamento] Fachada',quantidade:m2,unidade:'m²'};
    }
    return null;
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
    };
  }

  function _calcTotal(info,v,mat){
    if(!info||!info.quantidade)return {totalBase:'—',totalEmb:'—'};
    const cons=parseFloat(v.consumoPrevisto)||0;
    if(!cons)return {totalBase:_fNum(info.quantidade)+' '+(info.unidade||''),totalEmb:'—'};
    const base=info.quantidade*cons;
    const baseStr=_fNum(base)+' '+(mat?.unidade||'');
    let embStr='—';
    if(mat?.embalagemQtd&&parseFloat(mat.embalagemQtd)>0){
      const emb=base/parseFloat(mat.embalagemQtd);
      embStr=_fNum(emb)+' '+(mat.embalagemUnidade||'emb.');
    }
    return {totalBase:baseStr,totalEmb:embStr};
  }

  // Quantidade em unidade base (número puro, sem formatação) = quantidade da
  // tarefa vinculada × consumo previsto. Usado para calcular custo (R$).
  function _calcQtdBaseNum(info,v){
    if(!info||!info.quantidade)return 0;
    const cons=parseFloat(v.consumoPrevisto)||0;
    if(!cons)return 0;
    return info.quantidade*cons;
  }

  // Custo em R$ = quantidade em unidade base × preço unitário do material.
  function _calcCustoNum(info,v,mat){
    if(!mat?.preco)return 0;
    return _calcQtdBaseNum(info,v)*parseFloat(mat.preco);
  }

  function _fNum(n){return Utils.formatarNumero(n);}

  // ====== BUSCA FUZZY (tarefa e material) ======
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
    if(!q)return opts;
    return opts.map(o=>({o,score:_score(_normalizar(o.label),q)}))
      .filter(x=>x.score>=0).sort((a,b)=>b.score-a.score).map(x=>x.o);
  }
  function _buscarMateriaisBib(texto){
    const q=_normalizar(texto);
    if(!q)return biblioteca;
    return biblioteca.map(m=>({m,score:_score(_normalizar(m.nome+' '+(m.fabricante||'')),q)}))
      .filter(x=>x.score>=0).sort((a,b)=>b.score-a.score).map(x=>x.m);
  }

  // ====== CRUD BIBLIOTECA ======
  function novoMaterialBib(){
    editandoBiblId=null;
    document.getElementById('modal-bib-titulo').textContent='Novo Material na Biblioteca';
    document.getElementById('form-material-bib').reset();
    Utils.abrirModal('modal-material-bib');
  }

  function editarMaterialBib(id){
    const m=biblioteca.find(x=>x.id===id);
    if(!m){Utils.toast('Material não encontrado.','erro');return;}
    editandoBiblId=id;
    document.getElementById('modal-bib-titulo').textContent='Editar Material';
    // Preenche campos manualmente (mais confiável que Utils.setFormData com selects)
    const f=document.getElementById('form-material-bib');
    f.reset();
    f.querySelector('[name="nome"]').value=m.nome||'';
    f.querySelector('[name="tipo"]').value=m.tipo||'';
    f.querySelector('[name="fabricante"]').value=m.fabricante||'';
    f.querySelector('[name="referencia"]').value=m.referencia||'';
    f.querySelector('[name="observacoes"]').value=m.observacoes||'';
    f.querySelector('[name="preco"]').value=m.preco||'';
    document.getElementById('bib-unidade').value=m.unidade||'kg';
    document.getElementById('bib-emb-und').value=m.embalagemUnidade||'';
    f.querySelector('[name="embalagemQtd"]').value=m.embalagemQtd||'';
    document.getElementById('bib-emb-base').value=m.embalagemBaseUnidade||m.unidade||'kg';
    Utils.abrirModal('modal-material-bib');
  }

  async function salvarMaterialBib(){
    const f=document.getElementById('form-material-bib');
    const nome=f.querySelector('[name="nome"]').value.trim();
    if(!nome){Utils.toast('Informe o nome.','alerta');return;}
    const data={
      nome,
      tipo:f.querySelector('[name="tipo"]').value,
      fabricante:f.querySelector('[name="fabricante"]').value.trim(),
      referencia:f.querySelector('[name="referencia"]').value.trim(),
      observacoes:f.querySelector('[name="observacoes"]').value.trim(),
      preco:parseFloat(f.querySelector('[name="preco"]').value)||0,
      unidade:document.getElementById('bib-unidade').value,
      embalagemUnidade:document.getElementById('bib-emb-und').value,
      embalagemQtd:parseFloat(f.querySelector('[name="embalagemQtd"]').value)||0,
      embalagemBaseUnidade:document.getElementById('bib-emb-base').value,
    };
    try{
      if(editandoBiblId)await Database.atualizar(obraId,COL_BIB,editandoBiblId,data);
      else await Database.criar(obraId,COL_BIB,data);
      Utils.fecharModal('modal-material-bib');
      Utils.toast('Material salvo!','sucesso');
      editandoBiblId=null;await carregar();
    }catch(e){console.error(e);Utils.toast('Erro ao salvar.','erro');}
  }

  async function excluirMaterialBib(id){
    const usos=vinculos.filter(v=>v.materialId===id).length;
    if(!Utils.confirmar(usos?`Em uso em ${usos} vínculo(s). Excluir mesmo assim?`:'Excluir da biblioteca?'))return;
    try{await Database.deletar(obraId,COL_BIB,id);Utils.toast('Excluído.','sucesso');await carregar();}
    catch(e){Utils.toast('Erro.','erro');}
  }

  // ====== CRUD VÍNCULOS ======
  function novoVinculo(){
    editandoVincId=null;_modoVinc='vincular';
    _buscaTarText='';_buscaMatText='';_vincTarSelIds=[];_vincMatSelId='';
    document.getElementById('modal-vinc-titulo').textContent='Adicionar Material à Tarefa';
    _renderVincModal(null);
    Utils.abrirModal('modal-material-vinc');
  }
  function editarVinculo(id){
    const v=vinculos.find(x=>x.id===id);if(!v)return;
    editandoVincId=id;_modoVinc='vincular';
    _vincTarSelIds=_getTarefaIds(v);_vincMatSelId=v.materialId||'';
    const m=biblioteca.find(x=>x.id===_vincMatSelId);
    _buscaTarText='';
    _buscaMatText=m?m.nome:'';
    document.getElementById('modal-vinc-titulo').textContent='Editar Vínculo';
    _renderVincModal(v);
    Utils.abrirModal('modal-material-vinc');
  }
  function toggleModoVinc(m){
    _modoVinc=m;_buscaMatText='';_vincMatSelId='';
    _renderVincModal(editandoVincId?vinculos.find(x=>x.id===editandoVincId):null);
  }

  function _renderResultadosTarefa(){
    const resultados=_buscarTarefaOpts(_buscaTarText).slice(0,40);
    if(!resultados.length)return `<div class="text-sm text-muted" style="padding:8px;">Nenhuma tarefa/serviço encontrado.</div>`;
    return resultados.map(o=>`
      <div class="tree-item${_vincTarSelIds.includes(o.id)?' ativo':''}" style="padding:8px 10px;white-space:pre;" onclick="Materiais.selecionarTarefaVinc('${o.id}')">
        <span class="tree-icon">${_vincTarSelIds.includes(o.id)?'✅':(o.tipo==='especial'?'🏗️':(o.tipo==='grupo'?'📁':'📌'))}</span>
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
          <span style="cursor:pointer;font-weight:800;" onclick="Materiais.removerTarefaVinc('${id}')">✕</span></span>`;
      }).join('')}
    </div>`;
  }
  function _renderMaterialSelecionado(){
    if(!_vincMatSelId)return '';
    const matSel=biblioteca.find(m=>m.id===_vincMatSelId);
    if(!matSel)return '';
    return `<div class="text-sm" style="margin-bottom:14px;">Selecionado: <strong>${matSel.nome}</strong>${matSel.fabricante?' — '+matSel.fabricante:''} (${matSel.unidade||'?'})</div>`;
  }
  function _renderResultadosMaterial(){
    const resultados=_buscarMateriaisBib(_buscaMatText).slice(0,40);
    if(!resultados.length)return `<div class="text-sm text-muted" style="padding:8px;">Nenhum material encontrado na biblioteca.</div>`;
    return resultados.map(m=>`
      <div class="tree-item${_vincMatSelId===m.id?' ativo':''}" style="padding:8px 10px;" onclick="Materiais.selecionarMaterialVinc('${m.id}')">
        <span class="tree-icon">🧱</span>
        <span class="tree-label">${_destacar(m.nome,_buscaMatText)}${m.fabricante?' — <span style=\'color:#888\'>'+m.fabricante+'</span>':''}</span>
        <span class="tree-badge">${m.unidade||'?'}</span>
      </div>`).join('');
  }
  function _renderSugestoesDuplicado(){
    const q=_buscaMatText.trim();
    if(!q||q.length<3)return '';
    const parecidos=_buscarMateriaisBib(q).slice(0,4);
    if(!parecidos.length)return '';
    return `<div style="background:rgba(255,255,255,0.03);border:1px dashed #555;border-radius:8px;padding:10px 12px;margin-bottom:12px;">
      <div style="font-size:0.75rem;color:#999;margin-bottom:6px;">⚠️ Materiais parecidos já cadastrados — clique para usar em vez de criar outro:</div>
      ${parecidos.map(m=>`<div class="tree-item" style="padding:6px 8px;" onclick="Materiais.usarExistenteAoCriar('${m.id}')">
        <span class="tree-icon">🧱</span><span class="tree-label">${m.nome}${m.fabricante?' — '+m.fabricante:''}</span>
        <span class="tree-badge">${m.unidade||'?'}</span></div>`).join('')}
    </div>`;
  }

  function _renderVincModal(v){
    const uc=v?.unidadeConsumo||'kg/m²';
    const body=document.getElementById('vinc-body');if(!body)return;
    const snap=_snapshotVincForm(body);
    body.innerHTML=`
      <div style="display:flex;gap:6px;margin-bottom:16px;">
        <button class="btn btn-sm ${_modoVinc==='vincular'?'btn-primario':'btn-secundario'}"
          onclick="Materiais.toggleModoVinc('vincular')">🔗 Da biblioteca</button>
        <button class="btn btn-sm ${_modoVinc==='criar'?'btn-primario':'btn-secundario'}"
          onclick="Materiais.toggleModoVinc('criar')">+ Criar novo</button>
      </div>

      ${_modoVinc==='vincular'?`
        <div class="form-grupo"><label>Buscar material na biblioteca *</label>
          <input type="text" id="vinc-mat-busca" class="form-control" placeholder="Digite para buscar... Ex: cimento, argamassa"
            value="${_buscaMatText}" oninput="Materiais.onBuscaMaterialVinc(this.value)"></div>
        <div id="vinc-mat-resultados" style="max-height:200px;overflow-y:auto;border:1px solid var(--cor-borda-light);border-radius:8px;margin-bottom:10px;">
          ${_renderResultadosMaterial()}
        </div>
        <div id="vinc-mat-selecionado">${_renderMaterialSelecionado()}</div>`:`
        <div style="background:rgba(245,200,0,0.07);border:1.5px solid rgba(245,200,0,0.25);border-radius:8px;padding:14px;margin-bottom:12px;">
          <div style="font-size:0.8rem;font-weight:700;color:var(--cor-primaria);margin-bottom:10px;">Novo material → será salvo na biblioteca</div>
          <div class="form-grupo"><label>Nome *</label><input id="nm-nome" class="form-control" placeholder="Ex: Cimento CP-III Votorantim"
            value="${_buscaMatText}" oninput="Materiais.onDigitarNomeNovo(this.value)"></div>
          <div id="nm-sugestoes-holder">${_renderSugestoesDuplicado()}</div>
          <div class="form-row">
            <div class="form-grupo"><label>Tipo</label>
              <select id="nm-tipo" class="form-control"><option value="">—</option>
                ${['Revestimento','Pintura','Argamassa','Cimento','Impermeabilizante','Fixação','Estrutural','Acabamento','Ar Condicionado','Hidráulica','Outro'].map(t=>`<option>${t}</option>`).join('')}
              </select></div>
            <div class="form-grupo"><label>Fabricante</label><input id="nm-fab" class="form-control"></div>
          </div>
          <div class="form-row">
            <div class="form-grupo"><label>Referência</label><input id="nm-ref" class="form-control"></div>
            <div class="form-grupo"><label>Unidade base
              <span class="text-muted" style="font-weight:400;font-size:0.68rem;">(digite p/ nova)</span></label>
              <input id="nm-und" class="form-control" list="mat-unidades-list" value="kg" placeholder="kg, L, m², m³...">
              </div>
            <div class="form-grupo"><label>Preço unitário (R$)</label>
              <input id="nm-preco" type="number" step="0.01" min="0" class="form-control" placeholder="Ex: 32,50"></div>
          </div>
          <div class="form-row" style="align-items:center;">
            <div class="form-grupo"><label>Embalagem</label>
              <input id="nm-emb-und" class="form-control" list="mat-emb-list" placeholder="— sem —">
              <datalist id="mat-emb-list">${['saco','caixa','lata','balde','fardo','rolo','un'].map(u=>`<option value="${u}">`).join('')}</datalist></div>
            <div style="padding-top:20px;color:#555;">=</div>
            <div class="form-grupo"><label>Qtd/embalagem</label>
              <input id="nm-emb-qtd" type="number" step="0.001" class="form-control" placeholder="Ex: 20"></div>
            <div class="form-grupo"><label>Unidade</label>
              <input id="nm-emb-base" class="form-control" list="mat-unidades-list" placeholder="kg, L, m², m³...">
              <datalist id="mat-unidades-list">${UNIDADES_MAT.map(u=>`<option value="${u}">`).join('')}</datalist></div>
          </div>
        </div>`}

      <div class="form-grupo"><label>Buscar serviço / tarefa *
        <span class="text-muted" style="font-weight:400;font-size:0.75rem;"> (pode selecionar mais de uma tarefa)</span></label>
        <input type="text" id="vinc-tar-busca" class="form-control" placeholder="Digite para buscar... Ex: alvenaria, pintura"
          value="${_buscaTarText}" oninput="Materiais.onBuscaTarefaVinc(this.value)"></div>
      <div id="vinc-tar-resultados" style="max-height:200px;overflow-y:auto;border:1px solid var(--cor-borda-light);border-radius:8px;margin-bottom:10px;">
        ${_renderResultadosTarefa()}
      </div>
      <div id="vinc-tar-chips">${_renderTarefasSelecionadasChips()}</div>

      <div class="form-row">
        <div class="form-grupo">
          <label>Consumo Previsto</label>
          <div style="display:flex;gap:6px;">
            <input id="vinc-cp" type="number" step="0.001" min="0" class="form-control"
              value="${v?.consumoPrevisto||''}" placeholder="0,000" style="flex:1;">
            <input id="vinc-uc" class="form-control" list="mat-unidades-consumo-list" style="width:120px;"
              value="${uc}" oninput="document.getElementById('vinc-uc2').textContent=this.value">
            <datalist id="mat-unidades-consumo-list">${UNIDADES_CONSUMO.map(u=>`<option value="${u}">`).join('')}</datalist>
          </div>
        </div>
        <div class="form-grupo">
          <label>Consumo Real</label>
          <div style="display:flex;gap:6px;align-items:center;">
            <input id="vinc-cr" type="number" step="0.001" min="0" class="form-control"
              value="${v?.consumoReal||''}" placeholder="0,000" style="flex:1;">
            <span id="vinc-uc2" style="font-size:0.8rem;color:#888;white-space:nowrap;min-width:60px;">${uc}</span>
          </div>
        </div>
      </div>
      <div class="form-grupo"><label>Observações</label>
        <textarea id="vinc-obs" class="form-control" rows="2">${v?.observacoes||''}</textarea></div>`;
    _restoreVincForm(body,snap);
  }

  // Preserva o que o usuário já digitou (nome do novo material, preço,
  // consumo, observações, etc.) ao re-renderizar o modal por causa de
  // um toggle de modo — sem isso, o innerHTML novo apaga tudo.
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

  function onBuscaMaterialVinc(texto){
    _buscaMatText=texto;
    const lista=document.getElementById('vinc-mat-resultados');
    if(lista)lista.innerHTML=_renderResultadosMaterial();
  }
  function selecionarMaterialVinc(id){
    _vincMatSelId=id;
    const m=biblioteca.find(x=>x.id===id);
    if(m)_buscaMatText=m.nome;
    const lista=document.getElementById('vinc-mat-resultados');
    if(lista)lista.innerHTML=_renderResultadosMaterial();
    const sel=document.getElementById('vinc-mat-selecionado');
    if(sel)sel.innerHTML=_renderMaterialSelecionado();
    const busca=document.getElementById('vinc-mat-busca');
    if(busca)busca.value=_buscaMatText;
  }
  function onBuscaTarefaVinc(texto){
    _buscaTarText=texto;
    const lista=document.getElementById('vinc-tar-resultados');
    if(lista)lista.innerHTML=_renderResultadosTarefa();
  }
  function selecionarTarefaVinc(id){
    const i=_vincTarSelIds.indexOf(id);
    if(i>=0)_vincTarSelIds.splice(i,1);else _vincTarSelIds.push(id);
    const lista=document.getElementById('vinc-tar-resultados');
    if(lista)lista.innerHTML=_renderResultadosTarefa();
    const chips=document.getElementById('vinc-tar-chips');
    if(chips)chips.innerHTML=_renderTarefasSelecionadasChips();
  }
  function removerTarefaVinc(id){
    _vincTarSelIds=_vincTarSelIds.filter(x=>x!==id);
    const lista=document.getElementById('vinc-tar-resultados');
    if(lista)lista.innerHTML=_renderResultadosTarefa();
    const chips=document.getElementById('vinc-tar-chips');
    if(chips)chips.innerHTML=_renderTarefasSelecionadasChips();
  }
  function onDigitarNomeNovo(texto){
    _buscaMatText=texto;
    const holder=document.getElementById('nm-sugestoes-holder');
    if(holder)holder.innerHTML=_renderSugestoesDuplicado();
  }
  function usarExistenteAoCriar(materialId){
    _modoVinc='vincular';
    _vincMatSelId=materialId;
    const m=biblioteca.find(x=>x.id===materialId);
    if(m)_buscaMatText=m.nome;
    _renderVincModal(editandoVincId?vinculos.find(x=>x.id===editandoVincId):null);
  }

  async function salvarVinculo(){
    const tarefaIds=_vincTarSelIds.slice();
    if(!tarefaIds.length){Utils.toast('Busque e selecione ao menos uma tarefa.','alerta');return;}
    const consumoPrevisto=parseFloat(document.getElementById('vinc-cp')?.value)||0;
    const consumoReal=parseFloat(document.getElementById('vinc-cr')?.value)||0;
    const unidadeConsumo=document.getElementById('vinc-uc')?.value.trim()||'kg/m²';
    const observacoes=document.getElementById('vinc-obs')?.value||'';
    let materialId='';

    if(_modoVinc==='criar'){
      const nome=document.getElementById('nm-nome')?.value?.trim();
      if(!nome){Utils.toast('Informe o nome do material.','alerta');return;}
      try{
        materialId=await Database.criar(obraId,COL_BIB,{
          nome,
          tipo:document.getElementById('nm-tipo')?.value||'',
          fabricante:document.getElementById('nm-fab')?.value||'',
          referencia:document.getElementById('nm-ref')?.value||'',
          unidade:document.getElementById('nm-und')?.value.trim()||'kg',
          preco:parseFloat(document.getElementById('nm-preco')?.value)||0,
          embalagemUnidade:document.getElementById('nm-emb-und')?.value.trim()||'',
          embalagemQtd:parseFloat(document.getElementById('nm-emb-qtd')?.value)||0,
          embalagemBaseUnidade:document.getElementById('nm-emb-base')?.value.trim()||'kg',
        });
      }catch(e){Utils.toast('Erro ao criar material.','erro');return;}
    } else {
      materialId=_vincMatSelId;
      if(!materialId){Utils.toast('Busque e selecione um material.','alerta');return;}
    }

    if(!editandoVincId){
      const chave=[...tarefaIds].sort().join('|');
      const existe=vinculos.find(x=>x.materialId===materialId&&
        [..._getTarefaIds(x)].sort().join('|')===chave);
      if(existe&&!Utils.confirmar('Já existe um vínculo idêntico (mesmo material e mesmas tarefas). Criar mesmo assim?'))return;
    }

    const data={materialId,tarefaIds,consumoPrevisto,consumoReal,unidadeConsumo,observacoes};
    try{
      if(editandoVincId)await Database.atualizar(obraId,COL_VIN,editandoVincId,data);
      else await Database.criar(obraId,COL_VIN,data);
      Utils.fecharModal('modal-material-vinc');
      Utils.toast('Vínculo salvo!','sucesso');
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
    novoMaterialBib,editarMaterialBib,salvarMaterialBib,excluirMaterialBib,
    novoVinculo,editarVinculo,salvarVinculo,excluirVinculo,toggleModoVinc,
    onBuscaMaterialVinc,selecionarMaterialVinc,onBuscaTarefaVinc,selecionarTarefaVinc,removerTarefaVinc,
    onDigitarNomeNovo,usarExistenteAoCriar};
})();
function onObraChanged(){Materiais.init();}

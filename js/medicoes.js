// ============================================
// Medições V1
// Árvore completa do planejamento com Esperado/Real,
// lançamento individual de executado (progresso, datas
// reais, fotos) e salvamento como sessão de medição.
// ============================================
const Medicoes = (() => {
  let obraId=null, tarefas=[], sorted=[], leafSet=new Set();
  let view='lista';           // 'lista' | 'nova'
  let pend={};                // taskId -> {progresso, inicioReal, terminoReal, fotos:[dataUrl]}
  let colapsados=new Set();   // ids de grupos recolhidos
  let busca='';
  let medEditId=null;         // tarefa aberta no modal
  const COL='tarefas', COLM='medicoes';

  // ==================== DATAS / HELPERS ====================
  function _d(s){if(!s)return null;if(s.toDate)s=s.toDate();if(s instanceof Date)return new Date(s.getFullYear(),s.getMonth(),s.getDate());
    const m=String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);if(m)return new Date(+m[1],+m[2]-1,+m[3]);
    const d=new Date(s);return isNaN(d)?null:new Date(d.getFullYear(),d.getMonth(),d.getDate());}
  function _iso(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  function _fmt(s){const d=_d(s);return d?`${String(d.getDate()).padStart(2,'0')} ${['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][d.getMonth()]} ${d.getFullYear()}`:'-';}
  function _hoje(){const n=new Date();return new Date(n.getFullYear(),n.getMonth(),n.getDate());}
  function _esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function _t(id){return tarefas.find(x=>x.id===id);}
  function _peso(t){return Math.max(1,t.duracao||1);}

  function _espAt(t,d){
    const i=_d(t.inicioPlanejado),f=_d(t.terminoPlanejado);
    if(!i||!f)return Math.round(t.percentualEsperado||0);
    if(d<i)return 0;if(d>=f)return 100;
    const tot=Math.max(1,Math.round((f-i)/864e5)+1);
    const done=Math.round((d-i)/864e5)+1;
    return Math.min(100,Math.max(0,Math.round(done/tot*100)));
  }
  function _progAtual(t){return pend[t.id]?.progresso!=null?pend[t.id].progresso:Math.min(100,t.percentualConcluido||0);}

  // ==================== INIT ====================
  async function init(){
    const ok=await Utils.initPagina({requireObra:true});if(!ok)return;
    obraId=Router.getObraId();
    if(!obraId){_el().innerHTML='<div class="estado-vazio"><div class="icone">📏</div><p>Selecione uma obra.</p></div>';return;}
    await carregar();
  }
  function _el(){return document.getElementById('modulo-content')||document.body;}

  async function carregar(){
    try{
      Utils.mostrarLoading('Carregando...');
      tarefas=await Database.listar(obraId,COL,'ordem').catch(()=>[]);
      sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
      leafSet=new Set();
      for(let i=0;i<sorted.length;i++){
        const nxt=sorted[i+1];
        if(!nxt||((nxt.nivel||0)<=(sorted[i].nivel||0)))leafSet.add(sorted[i].id);
      }
      _render();
    }catch(e){console.error(e);Utils.toast('Erro ao carregar.','erro');}
    finally{Utils.esconderLoading();}
  }

  // ==================== AGREGAÇÕES ====================
  // % de um grupo: média ponderada das folhas descendentes
  function _aggGrupo(idx){
    const g=sorted[idx],lvl=g.nivel||0;const hoje=_hoje();
    let sw=0,sr=0,se=0;
    for(let i=idx+1;i<sorted.length;i++){
      const t=sorted[i];if((t.nivel||0)<=lvl)break;
      if(!leafSet.has(t.id))continue;
      const w=_peso(t);sw+=w;
      sr+=_progAtual(t)*w;
      se+=_espAt(t,hoje)*w;
    }
    return sw?{real:sr/sw,esp:se/sw}:{real:0,esp:0};
  }
  function _totais(){
    let sw=0,sr=0,srOrig=0;const hoje=_hoje();let se=0;
    for(const t of sorted){
      if(!leafSet.has(t.id))continue;
      const w=_peso(t);sw+=w;
      sr+=_progAtual(t)*w;
      srOrig+=Math.min(100,t.percentualConcluido||0)*w;
      se+=_espAt(t,hoje)*w;
    }
    return sw?{total:sr/sw,medicao:(sr-srOrig)/sw,esp:se/sw}:{total:0,medicao:0,esp:0};
  }

  // ==================== RENDER ====================
  function _render(){
    if(view==='lista')_renderLista();else _renderNova();
  }

  async function _renderLista(){
    _el().innerHTML=`
    <style id="med-css">
      .med-top{display:flex;align-items:center;gap:10px;margin-bottom:14px;}
      .med-chip{display:inline-flex;align-items:baseline;gap:4px;background:#f1f5f9;border-radius:8px;padding:6px 12px;font-size:.8rem;font-weight:700;}
      .med-chip small{font-weight:500;color:#94a3b8;font-size:.66rem;}
      .med-tree{background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:auto;max-height:calc(100vh - 230px);}
      .med-node{display:flex;align-items:center;gap:8px;padding:7px 12px;border-bottom:1px solid #f8fafc;font-size:.82rem;}
      .med-node:hover{background:#fefce8;}
      .med-node .tog{width:18px;cursor:pointer;color:#64748b;font-weight:700;text-align:center;user-select:none;}
      .med-node .nm{font-weight:600;}
      .med-node .sub{font-size:.66rem;color:#94a3b8;}
      .med-node .sp{flex:1;}
      .med-node.leaf .nm{font-weight:500;}
      .med-node.sel{background:#ecfdf5;}
      .med-mod{border:1px solid #f5c800;background:#fffbeb;border-radius:6px;font-size:.64rem;padding:1px 6px;color:#92400e;font-weight:700;}
      .med-tbl{border-collapse:collapse;width:100%;font-size:.8rem;background:#fff;}
      .med-tbl th{background:#f8fafc;padding:8px 10px;text-align:left;font-size:.72rem;color:#475569;border-bottom:2px solid #e2e8f0;}
      .med-tbl td{padding:8px 10px;border-bottom:1px solid #f1f5f9;}
    </style>
    <div class="med-top">
      <button class="btn btn-primario" onclick="Medicoes.novaMedicao()">＋ Nova Medição</button>
    </div>
    <div id="med-lista"><p style="color:#94a3b8;font-size:.85rem;">Carregando medições...</p></div>`;
    try{
      const docs=(await Database.listar(obraId,COLM,'createdAt','desc').catch(()=>[]));
      const el=document.getElementById('med-lista');if(!el)return;
      if(!docs.length){el.innerHTML='<div class="estado-vazio"><div class="icone">📏</div><p>Nenhuma medição registrada.</p><p class="text-sm text-muted">Clique em "Nova Medição" para lançar o executado das tarefas do planejamento.</p></div>';return;}
      el.innerHTML=`<table class="med-tbl">
        <thead><tr><th>Data</th><th>Itens medidos</th><th>% Medição (avanço)</th><th>Ações</th></tr></thead>
        <tbody>${docs.map(d=>`<tr>
          <td>${_fmt(d.data)}</td>
          <td>${(d.itens||[]).length}</td>
          <td>${(d.pctMedicao||0).toFixed(2)}%</td>
          <td><button class="btn btn-sm btn-outline" onclick="Medicoes.verMedicao('${d.id}')">📄 Ver</button>
              <button class="btn btn-sm btn-outline" style="color:#dc2626;" onclick="Medicoes.excluirMedicao('${d.id}')">🗑️</button></td>
        </tr>`).join('')}</tbody></table>`;
    }catch(e){console.error(e);}
  }

  function novaMedicao(){
    if(!sorted.length){Utils.toast('Nenhuma tarefa no planejamento.','alerta');return;}
    pend={};busca='';colapsados=new Set();view='nova';_render();
  }
  function voltar(){
    if(Object.keys(pend).length&&!Utils.confirmar('Descartar os lançamentos não salvos desta medição?'))return;
    pend={};view='lista';_render();
  }

  function _renderNova(){
    const tot=_totais();
    const q=busca.toLowerCase().trim();
    let rows='';
    let skipLevel=-1;
    for(let i=0;i<sorted.length;i++){
      const t=sorted[i];const niv=t.nivel||0;
      if(skipLevel>=0){if(niv>skipLevel)continue;skipLevel=-1;}
      const isLeaf=leafSet.has(t.id);
      if(q&&isLeaf&&!(t.nome||'').toLowerCase().includes(q))continue;
      if(!isLeaf){
        if(q)continue; // na busca, mostra só folhas
        const col=colapsados.has(t.id);
        if(col)skipLevel=niv;
        const a=_aggGrupo(i);
        rows+=`<div class="med-node" style="padding-left:${12+niv*16}px;background:${niv===0?'#e2e8f0':niv===1?'#eef2f7':'#f8fafc'};">
          <span class="tog" onclick="Medicoes.toggleGrupo('${t.id}')">${col?'＋':'－'}</span>
          <div><div class="nm">${_esc(t.nome)}</div>
          <div class="sub">Esperado: ${a.esp.toFixed(0)}%&nbsp;&nbsp;Real: ${a.real.toFixed(0)}%</div></div>
          <span class="sp"></span>
        </div>`;
        continue;
      }
      const p=pend[t.id];
      const prog=_progAtual(t);
      const esp=_espAt(t,_hoje());
      rows+=`<div class="med-node leaf ${p?'sel':''}" style="padding-left:${12+niv*16}px;">
        <span class="tog" style="cursor:pointer;" onclick="Medicoes.abrirMedicao('${t.id}')" title="Lançar medição">✏️</span>
        <div style="cursor:pointer;" onclick="Medicoes.abrirMedicao('${t.id}')">
          <div class="nm">${_esc(t.nome)}</div>
          <div class="sub">Esperado: ${esp}%&nbsp;&nbsp;Real: ${prog}%${p?` &nbsp;<span class="med-mod">alterado: ${Math.min(100,t.percentualConcluido||0)}% → ${p.progresso}%</span>`:''}</div>
        </div>
        <span class="sp"></span>
        ${p?`<button class="btn-icone" title="Descartar alteração" onclick="event.stopPropagation();Medicoes.descartarItem('${t.id}')">✕</button>`:''}
      </div>`;
    }
    if(!rows)rows='<p style="padding:20px;color:#94a3b8;font-size:.85rem;">Nenhuma tarefa encontrada.</p>';
    const nPend=Object.keys(pend).length;
    _el().innerHTML=`
    <style id="med-css2"></style>
    <div class="med-top" style="flex-wrap:wrap;">
      <button class="btn btn-sm btn-outline" onclick="Medicoes.voltar()" title="Voltar">←</button>
      <button class="btn btn-sm btn-primario" onclick="Medicoes.salvarMedicao()" title="Salvar medição">💾 Salvar${nPend?` (${nPend})`:''}</button>
      <span class="med-chip">${tot.total.toFixed(2)}% <small>Total</small></span>
      <span class="med-chip" style="background:${tot.medicao>0?'#ecfdf5':'#f1f5f9'};">${tot.medicao.toFixed(2)}% <small>Medição</small></span>
      <span class="med-chip" style="background:#fffbeb;">${tot.esp.toFixed(2)}% <small>Esperado hoje</small></span>
      <div style="flex:1;"></div>
      <input class="form-control" style="max-width:260px;font-size:.8rem;" placeholder="Busca por Nome" value="${_esc(busca)}" oninput="Medicoes.setBusca(this.value)">
    </div>
    <div class="med-tree">${rows}</div>`;
    // reinjeta o css da lista se necessário
    if(!document.getElementById('med-css')){
      _renderListaCssOnly();
    }
  }
  function _renderListaCssOnly(){
    const st=document.createElement('style');st.id='med-css';
    st.textContent=`.med-top{display:flex;align-items:center;gap:10px;margin-bottom:14px;}
      .med-chip{display:inline-flex;align-items:baseline;gap:4px;background:#f1f5f9;border-radius:8px;padding:6px 12px;font-size:.8rem;font-weight:700;}
      .med-chip small{font-weight:500;color:#94a3b8;font-size:.66rem;}
      .med-tree{background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:auto;max-height:calc(100vh - 230px);}
      .med-node{display:flex;align-items:center;gap:8px;padding:7px 12px;border-bottom:1px solid #f8fafc;font-size:.82rem;}
      .med-node:hover{background:#fefce8;}
      .med-node .tog{width:18px;cursor:pointer;color:#64748b;font-weight:700;text-align:center;user-select:none;}
      .med-node .nm{font-weight:600;}
      .med-node .sub{font-size:.66rem;color:#94a3b8;}
      .med-node .sp{flex:1;}
      .med-node.leaf .nm{font-weight:500;}
      .med-node.sel{background:#ecfdf5;}
      .med-mod{border:1px solid #f5c800;background:#fffbeb;border-radius:6px;font-size:.64rem;padding:1px 6px;color:#92400e;font-weight:700;}
      .med-tbl{border-collapse:collapse;width:100%;font-size:.8rem;background:#fff;}
      .med-tbl th{background:#f8fafc;padding:8px 10px;text-align:left;font-size:.72rem;color:#475569;border-bottom:2px solid #e2e8f0;}
      .med-tbl td{padding:8px 10px;border-bottom:1px solid #f1f5f9;}`;
    document.head.appendChild(st);
  }

  function toggleGrupo(id){if(colapsados.has(id))colapsados.delete(id);else colapsados.add(id);_render();}
  function setBusca(v){busca=v||'';_render();}
  function descartarItem(id){delete pend[id];_render();}

  // ==================== MODAL DE MEDIÇÃO ====================
  function abrirMedicao(id){
    const t=_t(id);if(!t)return;
    medEditId=id;
    const p=pend[id]||{};
    document.getElementById('med-modal-nome').textContent=t.nome||'';
    document.getElementById('med-modal-periodo').textContent=`${_fmt(t.inicioPlanejado)} — ${_fmt(t.terminoPlanejado)}`;
    document.getElementById('med-prog').value=p.progresso!=null?p.progresso:(t.percentualConcluido||0);
    document.getElementById('med-ini').value=p.inicioReal!=null?p.inicioReal:(t.inicioReal?_iso(_d(t.inicioReal)):'');
    document.getElementById('med-fim').value=p.terminoReal!=null?p.terminoReal:(t.terminoReal?_iso(_d(t.terminoReal)):'');
    document.getElementById('med-fotos-prev').innerHTML=(p.fotos||[]).map((f,i)=>`<div style="position:relative;"><img src="${f}" style="width:70px;height:70px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0;"><button onclick="Medicoes.removerFoto(${i})" style="position:absolute;top:-6px;right:-6px;background:#dc2626;color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:10px;cursor:pointer;">✕</button></div>`).join('');
    Utils.abrirModal('modal-medicao');
  }
  function progDelta(d){
    const el=document.getElementById('med-prog');
    if(d===100)el.value=100;
    else el.value=Math.min(100,Math.max(0,(parseFloat(el.value)||0)+d));
  }
  function removerFoto(i){
    if(!pend[medEditId])return;
    pend[medEditId].fotos.splice(i,1);
    abrirMedicao(medEditId);
  }
  async function fotoSelecionada(input){
    const files=[...(input.files||[])];input.value='';
    if(!files.length)return;
    if(!pend[medEditId])pend[medEditId]={fotos:[]};
    if(!pend[medEditId].fotos)pend[medEditId].fotos=[];
    for(const f of files){
      try{const dataUrl=await _comprimir(f);pend[medEditId].fotos.push(dataUrl);}
      catch(e){console.error(e);Utils.toast('Erro ao processar foto.','erro');}
    }
    abrirMedicao(medEditId);
  }
  function _comprimir(file){
    return new Promise((res,rej)=>{
      const r=new FileReader();
      r.onload=()=>{const img=new Image();
        img.onload=()=>{
          const max=1280;let w=img.width,h=img.height;
          if(w>max||h>max){const k=max/Math.max(w,h);w=Math.round(w*k);h=Math.round(h*k);}
          const c=document.createElement('canvas');c.width=w;c.height=h;
          c.getContext('2d').drawImage(img,0,0,w,h);
          res(c.toDataURL('image/jpeg',0.72));
        };
        img.onerror=rej;img.src=r.result;};
      r.onerror=rej;r.readAsDataURL(file);
    });
  }
  function confirmarMedicao(){
    const t=_t(medEditId);if(!t)return;
    const prog=Math.min(100,Math.max(0,parseFloat(document.getElementById('med-prog').value)||0));
    const ini=document.getElementById('med-ini').value;
    const fim=document.getElementById('med-fim').value;
    const fotos=pend[medEditId]?.fotos||[];
    const origProg=Math.min(100,t.percentualConcluido||0);
    const origIni=t.inicioReal?_iso(_d(t.inicioReal)):'';
    const origFim=t.terminoReal?_iso(_d(t.terminoReal)):'';
    if(prog===origProg&&ini===origIni&&fim===origFim&&!fotos.length){
      delete pend[medEditId];
    }else{
      pend[medEditId]={progresso:prog,inicioReal:ini,terminoReal:fim,fotos};
    }
    Utils.fecharModal('modal-medicao');
    medEditId=null;_render();
  }

  // ==================== SALVAR MEDIÇÃO ====================
  async function salvarMedicao(){
    const ids=Object.keys(pend);
    if(!ids.length){Utils.toast('Nenhum lançamento nesta medição.','alerta');return;}
    if(!Utils.confirmar(`Salvar medição com ${ids.length} item(ns)? Os percentuais serão gravados no planejamento.`))return;
    try{
      Utils.mostrarLoading('Salvando medição...');
      const hoje=_iso(_hoje());
      const ts=Date.now();
      const itens=[];
      let n=0;
      for(const id of ids){
        const t=_t(id);if(!t)continue;
        const p=pend[id];
        const de=Math.min(100,t.percentualConcluido||0);
        const upd={};
        if(p.progresso!=null&&p.progresso!==de)upd.percentualConcluido=p.progresso;
        const novo=p.progresso!=null?p.progresso:de;
        let ini=p.inicioReal||'';let fim=p.terminoReal||'';
        if(novo>0&&!ini&&!t.inicioReal)ini=hoje;
        if(novo>=100&&!fim&&!t.terminoReal)fim=hoje;
        if(ini&&ini!==(t.inicioReal?_iso(_d(t.inicioReal)):''))upd.inicioReal=ini;
        if(fim!==(t.terminoReal?_iso(_d(t.terminoReal)):''))upd.terminoReal=fim;
        if(novo<100&&t.terminoReal&&!p.terminoReal)upd.terminoReal='';
        // fotos → storage
        const urls=[];
        for(let i=0;i<(p.fotos||[]).length;i++){
          Utils.mostrarLoading(`Enviando fotos (${_esc(t.nome).slice(0,30)}...)`);
          try{urls.push(await uploadImagem(`medicoes/${obraId}/${ts}_${id}_${i}.jpg`,p.fotos[i]));}
          catch(e){console.error('foto',e);}
        }
        if(Object.keys(upd).length)await Database.atualizar(obraId,COL,id,upd).catch(console.error);
        if(upd.percentualConcluido!=null)Audit.campo(obraId,'Medições',id,t.nome,'percentualConcluido',de,upd.percentualConcluido).catch(()=>{});
        Object.assign(t,upd);
        itens.push({taskId:id,nome:t.nome||'',de,para:novo,inicioReal:upd.inicioReal||t.inicioReal||'',terminoReal:(upd.terminoReal!=null?upd.terminoReal:t.terminoReal)||'',fotos:urls});
        n++;
        Utils.mostrarLoading(`Salvando ${n}/${ids.length}...`);
      }
      // % medição ponderado
      let sw=0,sd=0;
      for(const t of sorted){if(!leafSet.has(t.id))continue;sw+=_peso(t);}
      for(const it of itens){const t=_t(it.taskId);if(t)sd+=(it.para-it.de)*_peso(t);}
      const pctMedicao=sw?sd/sw:0;
      await Database.criar(obraId,COLM,{data:hoje,itens,pctMedicao,obraId});
      pend={};view='lista';
      Utils.toast(`✅ Medição salva (${itens.length} itens, +${pctMedicao.toFixed(2)}%).`,'sucesso');
      await carregar();
    }catch(e){console.error(e);Utils.toast('Erro ao salvar medição.','erro');}
    finally{Utils.esconderLoading();}
  }

  // ==================== VER / EXCLUIR ====================
  async function verMedicao(id){
    const d=await Database.obter(obraId,COLM,id).catch(()=>null);
    if(!d){Utils.toast('Medição não encontrada.','alerta');return;}
    document.getElementById('med-ver-body').innerHTML=`
      <p style="font-size:.8rem;color:#64748b;margin-bottom:10px;">Data: <b>${_fmt(d.data)}</b> · Avanço: <b>+${(d.pctMedicao||0).toFixed(2)}%</b></p>
      <table class="med-tbl"><thead><tr><th>Tarefa</th><th>De</th><th>Para</th><th>Início Real</th><th>Fim Real</th><th>Fotos</th></tr></thead>
      <tbody>${(d.itens||[]).map(i=>`<tr>
        <td style="white-space:normal;">${_esc(i.nome)}</td>
        <td>${i.de}%</td><td style="font-weight:700;color:#16a34a;">${i.para}%</td>
        <td>${i.inicioReal?_fmt(i.inicioReal):'-'}</td><td>${i.terminoReal?_fmt(i.terminoReal):'-'}</td>
        <td>${(i.fotos||[]).map(u=>`<a href="${u}" target="_blank"><img src="${u}" style="width:44px;height:44px;object-fit:cover;border-radius:6px;margin-right:4px;"></a>`).join('')||'-'}</td>
      </tr>`).join('')}</tbody></table>`;
    Utils.abrirModal('modal-med-ver');
  }
  async function excluirMedicao(id){
    if(!Utils.confirmar('Excluir esta medição? (Não altera os % já gravados no planejamento.)'))return;
    try{await Database.deletar(obraId,COLM,id);Utils.toast('Medição excluída.','sucesso');_render();}
    catch(e){console.error(e);Utils.toast('Erro.','erro');}
  }

  return{init,carregar,novaMedicao,voltar,toggleGrupo,setBusca,descartarItem,
    abrirMedicao,progDelta,removerFoto,fotoSelecionada,confirmarMedicao,
    salvarMedicao,verMedicao,excluirMedicao};
})();

function onObraChanged(){ Medicoes.init(); }

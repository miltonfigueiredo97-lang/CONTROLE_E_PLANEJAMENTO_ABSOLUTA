// ============================================
// Backup de Planejamentos — histórico de todas as
// alterações feitas via Planejamento, Semanal, Diário
// de Obra e Medições (alimentado pelo módulo Audit).
// Permite ver linha a linha, desfazer uma alteração
// (grava o valor "antes" de volta na tarefa) ou excluir
// entradas do histórico (não desfaz o dado, só limpa o log).
// Coleção: obras/{id}/auditoria (mesma do Audit)
// ============================================
const BackupPlanejamento = (() => {
  let obraId=null, itens=[], carregando=false;
  let _mods=new Set(), _busca='', _de='', _ate='';
  const MODULOS=['Planejamento','Semanal','Diário de Obra','Medições'];
  const MOD_COR={Planejamento:'#3b82f6',Semanal:'#8b5cf6','Diário de Obra':'#16a34a',Medições:'#ca8a04'};

  function _el(){return document.getElementById('modulo-content')||document.body;}
  function _esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function _dt(ts){
    if(!ts)return null;
    if(ts.toDate)return ts.toDate();
    if(ts instanceof Date)return ts;
    const d=new Date(ts);return isNaN(d)?null:d;
  }
  function _fmtDT(ts){
    const d=_dt(ts);if(!d)return'—';
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  async function init(){
    const ok=await Utils.initPagina({requireObra:true});if(!ok)return;
    obraId=Router.getObraId();
    if(!obraId){_el().innerHTML='<div class="estado-vazio"><div class="icone">🗂️</div><p>Selecione uma obra.</p></div>';return;}
    await carregar();
  }

  async function carregar(){
    try{
      carregando=true;_render();
      itens=await Database.listar(obraId,'auditoria','timestamp','desc').catch(()=>[]);
    }catch(e){console.error(e);Utils.toast('Erro ao carregar histórico.','erro');}
    finally{carregando=false;_render();}
  }

  function _filtrados(){
    return itens.filter(it=>{
      if(_mods.size&&!_mods.has(it.modulo))return false;
      if(_de){const d=_dt(it.timestamp);if(!d||_iso(d)<_de)return false;}
      if(_ate){const d=_dt(it.timestamp);if(!d||_iso(d)>_ate)return false;}
      if(_busca){
        const q=_busca.toLowerCase();
        const alvo=`${it.descricao||''} ${it.email||''} ${it.dados?.campo||''}`.toLowerCase();
        if(!alvo.includes(q))return false;
      }
      return true;
    });
  }
  function _iso(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}

  function toggleMod(m){
    if(_mods.has(m))_mods.delete(m);else _mods.add(m);
    _render();
  }
  function setBusca(v){_busca=v;_render();
    requestAnimationFrame(()=>{const i=document.getElementById('bkp-busca');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length);}});}
  function setDe(v){_de=v;_render();}
  function setAte(v){_ate=v;_render();}

  // Desfaz UMA alteração: grava dados.antes de volta no campo, na
  // coleção 'tarefas'. Marca a entrada como desfeita (não desfaz 2x).
  async function desfazer(id){
    const it=itens.find(x=>x.id===id);if(!it||!it.dados?.campo)return;
    if(!confirm(`Desfazer: voltar "${it.dados.campo}" para "${it.dados.antes??'—'}"?`))return;
    try{
      Utils.mostrarLoading('Desfazendo...');
      await Database.atualizar(obraId,'tarefas',it.entidadeId,{[it.dados.campo]:it.dados.antes});
      await Database.atualizar(obraId,'auditoria',id,{desfeito:true,desfeitoEm:new Date().toISOString()});
      it.desfeito=true;
      _render();
      Utils.toast('Desfeito! Confira no módulo de origem.','sucesso');
    }catch(e){console.error(e);Utils.toast('Erro ao desfazer.','erro');}
    finally{Utils.esconderLoading();}
  }
  async function excluir(id){
    if(!confirm('Excluir esta entrada do histórico? (não desfaz o dado, só limpa o registro)'))return;
    try{await Database.deletar(obraId,'auditoria',id);itens=itens.filter(x=>x.id!==id);_render();}
    catch(e){console.error(e);Utils.toast('Erro ao excluir.','erro');}
  }
  async function excluirTodasFiltradas(){
    const f=_filtrados();
    if(!f.length)return;
    if(!confirm(`Excluir ${f.length} entrada(s) do histórico (filtro atual)? Não desfaz os dados, só limpa o registro.`))return;
    try{
      Utils.mostrarLoading(`Excluindo ${f.length}...`);
      for(const it of f)await Database.deletar(obraId,'auditoria',it.id).catch(()=>{});
      itens=itens.filter(x=>!f.some(y=>y.id===x.id));
      _render();
      Utils.toast('Histórico limpo.','sucesso');
    }catch(e){console.error(e);Utils.toast('Erro.','erro');}
    finally{Utils.esconderLoading();}
  }
  async function desfazerTodasFiltradas(){
    const f=_filtrados().filter(it=>it.dados?.campo&&!it.desfeito);
    if(!f.length){Utils.toast('Nada para desfazer neste filtro.','alerta');return;}
    if(!confirm(`Desfazer ${f.length} alteração(ões) do filtro atual? Cada tarefa volta ao valor anterior daquele campo.`))return;
    try{
      Utils.mostrarLoading(`Desfazendo ${f.length}...`);
      for(const it of f){
        await Database.atualizar(obraId,'tarefas',it.entidadeId,{[it.dados.campo]:it.dados.antes}).catch(()=>{});
        await Database.atualizar(obraId,'auditoria',it.id,{desfeito:true,desfeitoEm:new Date().toISOString()}).catch(()=>{});
        it.desfeito=true;
      }
      _render();
      Utils.toast(`${f.length} alteração(ões) desfeita(s)!`,'sucesso');
    }catch(e){console.error(e);Utils.toast('Erro.','erro');}
    finally{Utils.esconderLoading();}
  }

  function _render(){
    const f=_filtrados();
    _el().innerHTML=`
    <style>
      .bkp-chip{border:1.5px solid #333;background:#111;color:#888;border-radius:7px;padding:4px 10px;font-size:.74rem;font-weight:700;cursor:pointer;}
      .bkp-chip.on{background:var(--cor-primaria);color:#000;border-color:var(--cor-primaria);}
      .bkp-row{background:#141414;border:1px solid #222;border-radius:9px;padding:9px 12px;margin-bottom:6px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
      .bkp-row.desfeito{opacity:.45;}
      .bkp-tag{padding:2px 8px;border-radius:6px;font-size:.66rem;font-weight:800;color:#000;white-space:nowrap;}
      .bkp-desc{flex:1;min-width:220px;font-size:.8rem;color:#ddd;}
      .bkp-meta{font-size:.7rem;color:#666;white-space:nowrap;}
      .bkp-acoes button{border:1.5px solid #333;background:#1a1a1a;border-radius:6px;padding:4px 9px;cursor:pointer;font-size:.7rem;font-weight:700;color:#aaa;white-space:nowrap;}
      .bkp-acoes .desf{border-color:#3b82f6;color:#3b82f6;}
      .bkp-acoes .exc{border-color:#dc2626;color:#dc2626;}
    </style>
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
      <div style="display:flex;gap:6px;align-items:center;">
        <h2 style="margin:0;font-size:1.1rem;color:var(--cor-primaria);">🗂️ Backup de Planejamentos</h2>
        <span style="font-size:.75rem;color:#666;">${f.length} de ${itens.length} registro(s)</span>
      </div>
      <div style="display:flex;gap:6px;">
        <button class="btn btn-sm btn-outline" title="Desfaz todas as alterações do filtro atual" onclick="BackupPlanejamento.desfazerTodasFiltradas()">↩️ Desfazer filtradas</button>
        <button class="btn btn-sm btn-outline" style="border-color:#dc2626;color:#dc2626;" title="Remove do histórico (não desfaz dados)" onclick="BackupPlanejamento.excluirTodasFiltradas()">🗑️ Excluir filtradas</button>
      </div>
    </div>

    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px;background:#141414;border:1px solid #222;border-radius:9px;padding:10px;">
      ${MODULOS.map(m=>`<button class="bkp-chip ${_mods.has(m)?'on':''}" onclick="BackupPlanejamento.toggleMod('${m}')">${_esc(m)}</button>`).join('')}
      <span style="color:#333;">|</span>
      <input type="text" id="bkp-busca" value="${_esc(_busca)}" placeholder="Buscar por tarefa, campo, e-mail..." oninput="BackupPlanejamento.setBusca(this.value)" style="padding:5px 9px;border:1px solid #333;background:#1a1a1a;color:#eee;border-radius:6px;font-size:.78rem;min-width:220px;">
      <input type="date" value="${_esc(_de)}" title="De" onchange="BackupPlanejamento.setDe(this.value)" style="padding:5px 8px;border:1px solid #333;background:#1a1a1a;color:#eee;border-radius:6px;font-size:.76rem;">
      <span style="color:#555;font-size:.76rem;">até</span>
      <input type="date" value="${_esc(_ate)}" title="Até" onchange="BackupPlanejamento.setAte(this.value)" style="padding:5px 8px;border:1px solid #333;background:#1a1a1a;color:#eee;border-radius:6px;font-size:.76rem;">
    </div>

    ${carregando?`<div style="text-align:center;color:#666;padding:30px;">Carregando...</div>`:
      !f.length?`<div class="estado-vazio"><div class="icone">🗂️</div><p>Nenhum registro encontrado.</p></div>`:
      f.map(it=>`<div class="bkp-row ${it.desfeito?'desfeito':''}">
        <span class="bkp-tag" style="background:${MOD_COR[it.modulo]||'#666'};">${_esc(it.modulo||'—')}</span>
        <span class="bkp-desc">${_esc(it.descricao||'')}${it.desfeito?' <span style="color:#3b82f6;font-weight:700;">· desfeito</span>':''}</span>
        <span class="bkp-meta">${_esc(it.email||'')} · ${_fmtDT(it.timestamp)}</span>
        <div class="bkp-acoes" style="display:flex;gap:5px;">
          ${it.dados?.campo&&!it.desfeito?`<button class="desf" title="Voltar este campo ao valor anterior" onclick="BackupPlanejamento.desfazer('${it.id}')">↩️ Desfazer</button>`:''}
          <button class="exc" title="Remover do histórico (não desfaz o dado)" onclick="BackupPlanejamento.excluir('${it.id}')">🗑️</button>
        </div>
      </div>`).join('')}`;
  }

  return{init,carregar,toggleMod,setBusca,setDe,setAte,desfazer,excluir,excluirTodasFiltradas,desfazerTodasFiltradas};
})();
function onObraChanged(){BackupPlanejamento.init();}

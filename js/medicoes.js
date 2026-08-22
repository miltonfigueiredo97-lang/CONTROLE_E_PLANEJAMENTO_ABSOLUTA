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
  const COL='tarefas', COLM='medicoes';
  // Filtro por Frente de Serviço (equipe/disciplina) — cache de sessão,
  // igual ao filtro de responsável do Planejamento. Não é dado de negócio.
  let filtroFrente=(()=>{try{return localStorage.getItem('med_filtroFrente')||'';}catch(e){return'';}})();
  function setFiltroFrente(v){
    filtroFrente=v||'';
    try{localStorage.setItem('med_filtroFrente',filtroFrente);}catch(e){}
    _render();
  }
  // Ocultar tarefas já em 100% — foco só no que falta preencher.
  let ocultarConcluidos=(()=>{try{return localStorage.getItem('med_ocultarConcluidos')==='1';}catch(e){return false;}})();
  function setOcultarConcluidos(v){
    ocultarConcluidos=!!v;
    try{localStorage.setItem('med_ocultarConcluidos',ocultarConcluidos?'1':'0');}catch(e){}
    _render();
  }

  // ==================== DATAS / HELPERS ====================
  function _d(s){if(!s)return null;if(s.toDate)s=s.toDate();if(s instanceof Date)return new Date(s.getFullYear(),s.getMonth(),s.getDate());
    const m=String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);if(m)return new Date(+m[1],+m[2]-1,+m[3]);
    const d=new Date(s);return isNaN(d)?null:new Date(d.getFullYear(),d.getMonth(),d.getDate());}
  function _iso(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  function _fmt(s){const d=_d(s);return d?`${String(d.getDate()).padStart(2,'0')} ${['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][d.getMonth()]} ${d.getFullYear()}`:'-';}
  function _hoje(){const n=new Date();return new Date(n.getFullYear(),n.getMonth(),n.getDate());}
  function _esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function _t(id){return tarefas.find(x=>x.id===id);}
  function _peso(t){return t._pesoCache!=null?t._pesoCache:Math.max(1,t.duracao||1);}

  function _espAt(t,d){
    // Se "d" é hoje (o caso de longe mais comum, chamado em todo render),
    // usa o valor pré-calculado em carregar() — evita reparsear datas.
    if(t._espCache!=null&&d.getTime()===_hoje().getTime())return t._espCache;
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
  function _el(){
    const el=document.getElementById('modulo-content')||document.body;
    // Preenche 100% da altura disponível (mesmo padrão do Planejamento) —
    // sem isso a árvore fica com altura fixa/curta e sobra área cinza vazia
    // embaixo em telas maiores, em vez de usar o espaço todo.
    el.style.cssText='display:flex;flex-direction:column;min-height:0;height:100%;';
    return el;
  }

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
      // Pré-calcula peso e % esperado hoje UMA VEZ (envolve parsear datas —
      // repetir isso pra cada tarefa a cada tecla digitada, em obra grande
      // com milhares de tarefas, era o que travava a digitação/o calendário).
      // "Hoje" não muda durante a sessão, então o cache vale até recarregar.
      const hoje=_hoje();
      for(const t of tarefas){t._pesoCache=_peso(t);t._espCache=_espAt(t,hoje);}
      _render();
    }catch(e){console.error(e);Utils.toast('Erro ao carregar.','erro');}
    finally{Utils.esconderLoading();}
  }

  // ==================== AGREGAÇÕES ====================
  // % de cada grupo = média ponderada das folhas descendentes. Antes cada
  // grupo visível escaneava sua subárvore inteira de novo (o grupo raiz
  // escaneava a obra TODA) — em obra grande, com vários grupos abertos,
  // isso multiplicava o custo várias vezes A CADA RENDER (cada tecla, cada
  // %, cada data). Agora é um único passe por toda a árvore que já calcula
  // o total geral E o agregado de todo grupo ao mesmo tempo, usando uma
  // pilha de acumuladores por nível (mesmo truque usado no filtro de
  // Frente/busca).
  function _calcularAgregados(){
    const porGrupo=new Map(); // id do grupo -> {sw,sr,se,srOrig}
    const pilha=[];
    const hoje=_hoje();
    let sw=0,sr=0,se=0,srOrig=0;
    for(let i=0;i<sorted.length;i++){
      const t=sorted[i],niv=t.nivel||0;
      pilha.length=niv;
      if(!leafSet.has(t.id)){
        const o={sw:0,sr:0,se:0};
        porGrupo.set(t.id,o);
        pilha[niv]=o;
        continue;
      }
      const w=_peso(t),r=_progAtual(t),e=_espAt(t,hoje),rOrig=Math.min(100,t.percentualConcluido||0);
      sw+=w;sr+=r*w;se+=e*w;srOrig+=rOrig*w;
      for(const o of pilha){if(o){o.sw+=w;o.sr+=r*w;o.se+=e*w;}}
    }
    return{
      totais:sw?{total:sr/sw,medicao:(sr-srOrig)/sw,esp:se/sw}:{total:0,medicao:0,esp:0},
      porGrupo,
    };
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
      .med-tree{background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:auto;}
      .med-node{display:flex;align-items:center;gap:8px;padding:7px 12px;border-bottom:1px solid #f8fafc;font-size:.82rem;}
      .med-node{padding-left:calc(12px + var(--niv,0) * 16px);}
      .med-node:hover{background:#fefce8;}
      .med-node .tog{width:26px;height:26px;min-width:26px;cursor:pointer;color:#1e293b;font-weight:800;font-size:1rem;text-align:center;user-select:none;display:flex;align-items:center;justify-content:center;background:#e2e8f0;border-radius:7px;flex-shrink:0;}
      .med-node .tog:hover{background:#cbd5e1;}
      .med-node.busca-match{background:#fef9c3;}
      .med-node .nm{font-weight:600;}
      .med-node .sub{font-size:.66rem;color:#94a3b8;}
      .med-node .sp{flex:1;}
      .med-node.leaf .nm{font-weight:500;}
      .med-node.sel{background:#ecfdf5;}
      .med-mod{border:1px solid #f5c800;background:#fffbeb;border-radius:6px;font-size:.64rem;padding:1px 6px;color:#92400e;font-weight:700;}
      .med-edit{display:flex;gap:6px;align-items:center;flex-wrap:wrap;flex:1 1 auto;padding-top:2px;}
      .med-inp{border:1px solid #cbd5e1;border-radius:6px;padding:5px 6px;font-size:.75rem;font-family:inherit;background:#fff;height:30px;box-sizing:border-box;}
      .med-inp:disabled{background:#f1f5f9;color:#94a3b8;}
      .med-inp-pct{width:52px;text-align:center;font-weight:700;}
      .med-inp-data{width:122px;}
      .med-btn-100{border:1px solid #16a34a;color:#16a34a;background:#f0fdf4;border-radius:6px;width:34px;height:30px;font-size:.85rem;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0;}
      .med-campo{display:flex;flex-direction:column;gap:3px;min-width:0;}
      .med-campo label{font-size:.62rem;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:.02em;}
      .med-hint{color:#dc2626;text-transform:none;font-weight:600;letter-spacing:0;}
      .med-pct-linha{display:flex;gap:5px;}
      .med-pct-linha .med-inp-pct{flex:1;min-width:0;}
      .med-previsto{display:flex;align-items:center;height:30px;padding:0 10px;border:1px solid #e2e8f0;background:#f8fafc;border-radius:6px;font-weight:700;color:#64748b;font-size:.85rem;}
      .med-btn-100:hover{background:#dcfce7;}
      .med-foto-btn{display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:6px;background:#f1f5f9;cursor:pointer;font-size:.95rem;flex-shrink:0;}
      .med-foto-btn:hover{background:#e2e8f0;}
      .med-fotos-row{display:flex;gap:6px;flex-wrap:wrap;padding:2px 12px 8px 12px;width:100%;}
      .med-foto-thumb{position:relative;}
      .med-foto-thumb img{width:48px;height:48px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0;}
      .med-foto-thumb button{position:absolute;top:-6px;right:-6px;background:#dc2626;color:#fff;border:none;border-radius:50%;width:16px;height:16px;font-size:9px;cursor:pointer;}
      .med-tbl{border-collapse:collapse;width:100%;font-size:.8rem;background:#fff;}
      .med-tbl th{background:#f8fafc;padding:8px 10px;text-align:left;font-size:.72rem;color:#475569;border-bottom:2px solid #e2e8f0;}
      .med-tbl td{padding:8px 10px;border-bottom:1px solid #f1f5f9;}
      .btn-icone{width:28px;height:28px;min-width:28px;border:none;background:#fee2e2;color:#dc2626;border-radius:7px;font-size:.85rem;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;}
      .btn-icone:hover{background:#fecaca;}
      .med-frente-badge{color:#fff;font-size:.58rem;font-weight:700;padding:1px 6px;border-radius:7px;}
      .med-header-row{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex:1 1 220px;min-width:0;}
      .med-acoes-topo{display:flex;gap:6px;align-items:center;flex-shrink:0;}
      @media (max-width:1024px){
        .med-spacer{display:none;}
        /* Recuo de hierarquia (nivel*16px) come a largura toda no celular —
           trava num recuo pequeno e fixo, não importa a profundidade real. */
        .med-node{padding-left:calc(8px + min(var(--niv,0),2) * 8px) !important;}
        .med-top{gap:6px;padding:2px 0;}
        .med-top .btn-sm{padding:8px 10px;font-size:.82rem;flex:1 1 auto;}
        .med-top select, .med-top input.form-control{max-width:none !important;flex:1 1 47%;padding:9px;font-size:.85rem;}
        .med-chip{font-size:.82rem;padding:7px 10px;flex:1 1 30%;justify-content:center;text-align:center;}
        .med-chip small{font-size:.68rem;}
        .med-node{padding:8px 10px;}
        .med-node.leaf{padding-bottom:9px;}
        .med-node .tog{width:36px;height:36px;font-size:1.2rem;}
        .med-node .nm{font-size:.98rem;}
        .med-node .sub{font-size:.78rem;}
        .med-frente-badge{font-size:.68rem;padding:2px 7px;}
        /* Início/Término, %/100% e Foto/Descartar pareados em 2 colunas —
           input type=date tem largura mínima própria que não encolhe bem
           com flex simples, então usa grid pra garantir 2 por linha sempre. */
        .med-header-row{flex:1 1 100%;width:100%;}
        /* Card mínimo no mobile: só nome + Início/Término/% — sem badge de
           Frente (já dá pra ver no filtro de cima) nem texto de Esperado. */
        .med-frente-badge{display:none;}
        .med-leaf-esp{display:none;}
        .med-node.leaf{padding-bottom:8px;}
        .med-edit{display:grid;grid-template-columns:1fr 1fr;gap:6px;width:100%;margin-top:6px;}
        .med-inp{height:40px;font-size:.86rem;width:100%;box-sizing:border-box;min-width:0;}
        .med-inp-data{min-width:0;}
        .med-inp-pct{width:100%;flex:1;min-width:0;}
        .med-btn-100{height:40px;font-size:1rem;width:40px;flex-shrink:0;}
        .med-campo label{font-size:.64rem;}
        .med-previsto{height:40px;font-size:.9rem;}
        .med-foto-btn{width:38px;height:38px;font-size:1.15rem;}
        .btn-icone{width:38px;height:38px;font-size:1.05rem;}
        .med-foto-thumb img{width:56px;height:56px;}
      }
    </style>
    <div class="med-top">
      <button class="btn btn-primario" data-perm="medicoes:criar:medicao" onclick="Medicoes.novaMedicao()">＋ Nova Medição</button>
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
              <button class="btn btn-sm btn-outline" style="color:#dc2626;" data-perm="medicoes:excluir:medicao" onclick="Medicoes.excluirMedicao('${d.id}')">🗑️</button></td>
        </tr>`).join('')}</tbody></table>`;
      Permissions.aplicarNaTela();
    }catch(e){console.error(e);}
  }

  function novaMedicao(){
    if(!Permissions.pode('medicoes','criar:medicao')){Utils.toast('Sem permissão para criar medição.','erro');return;}
    if(!sorted.length){Utils.toast('Nenhuma tarefa no planejamento.','alerta');return;}
    pend={};busca='';view='nova';
    // Começa tudo RECOLHIDO (só os grupos de topo) — abrir tudo de cara faz
    // rolar telas e telas antes de achar o que quer; melhor ir abrindo só
    // o que precisa.
    colapsados=new Set();
    for(let i=0;i<sorted.length;i++){
      const t=sorted[i],niv=t.nivel||0,nxt=sorted[i+1];
      const isLeaf=!nxt||(nxt.nivel||0)<=niv;
      if(!isLeaf)colapsados.add(t.id);
    }
    _render();
  }
  function voltar(){
    if(Object.keys(pend).length&&!Utils.confirmar('Descartar os lançamentos não salvos desta medição?'))return;
    pend={};view='lista';_render();
  }

  function _renderNova(){
    const {totais:tot,porGrupo}=_calcularAgregados();
    const q=busca.toLowerCase().trim();
    const frenteFiltro=filtroFrente;
    const temFiltro=!!q||!!frenteFiltro||ocultarConcluidos;
    // Pré-calcula (num único passe) quem bate nos filtros (texto + Frente +
    // ocultar concluídos) e quais grupos têm ao menos um descendente que
    // bate — grupo sem nenhum alvo fica oculto. Se tem texto de busca,
    // também abre automaticamente os ancestrais de cada resultado (senão o
    // resultado fica escondido dentro de um grupo recolhido e parece que
    // "não achou nada").
    let gruposComAlvo=null, leavesVisiveis=null;
    if(temFiltro){
      gruposComAlvo=new Set();leavesVisiveis=new Set();
      const pilha=[];
      for(let i=0;i<sorted.length;i++){
        const t=sorted[i],niv=t.nivel||0;
        pilha.length=niv;
        if(!leafSet.has(t.id)){pilha[niv]=t.id;continue;}
        const okQ=!q||(t.nome||'').toLowerCase().includes(q);
        const okF=!frenteFiltro||t.frenteServico===frenteFiltro;
        // Se a tarefa tem edição pendente nesta sessão, ela NUNCA some pelo
        // "Ocultar 100%" — senão a tarefa desaparece na sua frente assim que
        // você termina de digitar 100%, sem chance de revisar/corrigir antes
        // de salvar (só reaparece pra quem você ainda não mexeu).
        const okC=!ocultarConcluidos||_progAtual(t)<100||pend[t.id];
        if(okQ&&okF&&okC){
          leavesVisiveis.add(t.id);
          for(const gid of pilha){if(gid){gruposComAlvo.add(gid);if(q)colapsados.delete(gid);}}
        }
      }
    }
    let rows='';
    let skipLevel=-1;
    let primeiroMatchId=null;
    for(let i=0;i<sorted.length;i++){
      const t=sorted[i];const niv=t.nivel||0;
      if(skipLevel>=0){if(niv>skipLevel)continue;skipLevel=-1;}
      const isLeaf=leafSet.has(t.id);
      if(isLeaf&&temFiltro&&!leavesVisiveis.has(t.id))continue;
      if(!isLeaf){
        if(temFiltro&&!gruposComAlvo.has(t.id))continue; // grupo sem nenhum alvo (texto e/ou Frente filtrada)
        const col=colapsados.has(t.id);
        if(col)skipLevel=niv;
        const o=porGrupo.get(t.id);
        const a=o&&o.sw?{real:o.sr/o.sw,esp:o.se/o.sw}:{real:0,esp:0};
        rows+=`<div class="med-node" style="--niv:${niv};background:${niv===0?'#e2e8f0':niv===1?'#eef2f7':'#f8fafc'};">
          <span class="tog" onclick="Medicoes.toggleGrupo('${t.id}')">${col?'＋':'－'}</span>
          <div><div class="nm">${_esc(t.nome)}</div>
          <div class="sub">Esperado: ${a.esp.toFixed(0)}%&nbsp;&nbsp;Real: ${a.real.toFixed(0)}%</div></div>
          <span class="sp"></span>
        </div>`;
        continue;
      }
      if(q&&!primeiroMatchId)primeiroMatchId=t.id;
      const p=pend[t.id];
      const prog=_progAtual(t);
      const esp=_espAt(t,_hoje());
      const iniVal=p?.inicioReal!=null?p.inicioReal:(t.inicioReal?_iso(_d(t.inicioReal)):'');
      const fimVal=p?.terminoReal!=null?p.terminoReal:(t.terminoReal?_iso(_d(t.terminoReal)):'');
      const fimHabilitado=prog>=100;
      const fotos=p?.fotos||[];
      rows+=`<div class="med-node leaf ${p?'sel':''} ${q&&t.id===primeiroMatchId?'busca-match':''}" id="med-row-${t.id}" style="--niv:${niv};flex-wrap:wrap;align-items:flex-start;">
        <div class="med-header-row">
          <div style="flex:1;min-width:0;padding-top:3px;">
            <div class="nm">${_esc(t.nome)}${t.frenteServico?` <span class="med-frente-badge" style="background:${Utils.corFrente(t.frenteServico)};">${t.frenteServico}</span>`:''}</div>
          </div>
          <div class="med-acoes-topo">
            <label class="med-foto-btn" title="Adicionar foto">📷<input type="file" accept="image/*" multiple style="display:none;" onchange="Medicoes.fotoSelecionada('${t.id}',this)"></label>
            ${p?`<button class="btn-icone" title="Descartar alteração" onclick="Medicoes.descartarItem('${t.id}')">✕</button>`:''}
          </div>
        </div>
        <div class="med-edit">
          <div class="med-campo">
            <label>Início Real</label>
            <input type="date" class="med-inp med-inp-data" value="${iniVal}" onchange="Medicoes.setCampo('${t.id}','inicioReal',this.value)">
          </div>
          <div class="med-campo">
            <label>Término Real${fimHabilitado?'':' <span class="med-hint">(só com 100%)</span>'}</label>
            <input type="date" class="med-inp med-inp-data" value="${fimVal}" ${fimHabilitado?'':'disabled'} onchange="Medicoes.setCampo('${t.id}','terminoReal',this.value)">
          </div>
          <div class="med-campo">
            <label>% Executado</label>
            <div class="med-pct-linha">
              <input type="number" class="med-inp med-inp-pct" min="0" max="100" value="${prog}" onchange="Medicoes.setCampo('${t.id}','progresso',this.value)">
              <button class="med-btn-100" title="Marcar 100%" onclick="Medicoes.setCampo('${t.id}','progresso',100)">✓</button>
            </div>
          </div>
          <div class="med-campo">
            <label>% Previsto</label>
            <div class="med-previsto">${esp}%</div>
          </div>
        </div>
        ${fotos.length?`<div class="med-fotos-row">${fotos.map((f,fi)=>`<div class="med-foto-thumb"><img src="${f}"><button onclick="Medicoes.removerFoto('${t.id}',${fi})">✕</button></div>`).join('')}</div>`:''}
      </div>`;
    }
    if(!rows)rows='<p style="padding:20px;color:#94a3b8;font-size:.85rem;">Nenhuma tarefa encontrada.</p>';
    const nPend=Object.keys(pend).length;
    const scrollAntes=document.querySelector('.med-tree')?.scrollTop||0;
    _el().innerHTML=`
    <style id="med-css2"></style>
    <div class="med-top" style="flex-wrap:wrap;flex-shrink:0;">
      <button class="btn btn-sm btn-outline" onclick="Medicoes.voltar()" title="Voltar">←</button>
      <button class="btn btn-sm btn-primario" onclick="Medicoes.salvarMedicao()" title="Salvar medição">💾 Salvar${nPend?` (${nPend})`:''}</button>
      ${nPend?`<button class="btn btn-sm btn-outline" style="color:#dc2626;border-color:#fecaca;" onclick="Medicoes.descartarTudo()" title="Descartar todas as alterações não salvas desta medição">🗑 Descartar tudo (${nPend})</button>`:''}
      <button class="btn btn-sm btn-outline" onclick="Medicoes.expandirTudo()" title="Abrir todos os grupos">▾ Expandir</button>
      <button class="btn btn-sm btn-outline" onclick="Medicoes.recolherTudo()" title="Fechar todos os grupos">▸ Recolher</button>
      <span class="med-chip">${tot.total.toFixed(2)}% <small>Total</small></span>
      <span class="med-chip" style="background:${tot.medicao>0?'#ecfdf5':'#f1f5f9'};">${tot.medicao.toFixed(2)}% <small>Medição</small></span>
      <span class="med-chip" style="background:#fffbeb;">${tot.esp.toFixed(2)}% <small>Esperado hoje</small></span>
      <button class="btn btn-sm ${ocultarConcluidos?'btn-primario':'btn-outline'}" onclick="Medicoes.setOcultarConcluidos(${!ocultarConcluidos})" title="Esconder tarefas já em 100%">${ocultarConcluidos?'☑':'☐'} Ocultar 100%</button>
      <div class="med-spacer" style="flex:1;"></div>
      <select class="form-control" style="max-width:180px;font-size:.8rem;" onchange="Medicoes.setFiltroFrente(this.value)">
        <option value="">Todas as Frentes</option>
        ${Utils.FRENTES_SERVICO.map(f=>`<option value="${f}" ${f===frenteFiltro?'selected':''}>${f}</option>`).join('')}
      </select>
      <input id="med-busca" class="form-control" style="max-width:260px;font-size:.8rem;" placeholder="Busca por Nome" value="${_esc(busca)}" oninput="Medicoes.setBusca(this.value)">
    </div>
    <div class="med-tree" style="flex:1;min-height:0;">${rows}</div>`;
    // reinjeta o css da lista se necessário
    if(!document.getElementById('med-css')){
      _renderListaCssOnly();
    }
    if(q&&primeiroMatchId){
      const el=document.getElementById('med-row-'+primeiroMatchId);
      if(el)el.scrollIntoView({block:'center'});
    } else {
      // preserva a posição de rolagem — sem isso, cada edição (que dispara
      // _render()) chutava a lista de volta pro topo.
      const treeEl=document.querySelector('.med-tree');
      if(treeEl)treeEl.scrollTop=scrollAntes;
    }
  }
  function _renderListaCssOnly(){
    const st=document.createElement('style');st.id='med-css';
    st.textContent=`.med-top{display:flex;align-items:center;gap:10px;margin-bottom:14px;}
      .med-chip{display:inline-flex;align-items:baseline;gap:4px;background:#f1f5f9;border-radius:8px;padding:6px 12px;font-size:.8rem;font-weight:700;}
      .med-chip small{font-weight:500;color:#94a3b8;font-size:.66rem;}
      .med-tree{background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:auto;}
      .med-node{display:flex;align-items:center;gap:8px;padding:7px 12px;border-bottom:1px solid #f8fafc;font-size:.82rem;}
      .med-node{padding-left:calc(12px + var(--niv,0) * 16px);}
      .med-node:hover{background:#fefce8;}
      .med-node .tog{width:26px;height:26px;min-width:26px;cursor:pointer;color:#1e293b;font-weight:800;font-size:1rem;text-align:center;user-select:none;display:flex;align-items:center;justify-content:center;background:#e2e8f0;border-radius:7px;flex-shrink:0;}
      .med-node .tog:hover{background:#cbd5e1;}
      .med-node.busca-match{background:#fef9c3;}
      .med-node .nm{font-weight:600;}
      .med-node .sub{font-size:.66rem;color:#94a3b8;}
      .med-node .sp{flex:1;}
      .med-node.leaf .nm{font-weight:500;}
      .med-node.sel{background:#ecfdf5;}
      .med-mod{border:1px solid #f5c800;background:#fffbeb;border-radius:6px;font-size:.64rem;padding:1px 6px;color:#92400e;font-weight:700;}
      .med-edit{display:flex;gap:6px;align-items:center;flex-wrap:wrap;flex:1 1 auto;padding-top:2px;}
      .med-inp{border:1px solid #cbd5e1;border-radius:6px;padding:5px 6px;font-size:.75rem;font-family:inherit;background:#fff;height:30px;box-sizing:border-box;}
      .med-inp:disabled{background:#f1f5f9;color:#94a3b8;}
      .med-inp-pct{width:52px;text-align:center;font-weight:700;}
      .med-inp-data{width:122px;}
      .med-btn-100{border:1px solid #16a34a;color:#16a34a;background:#f0fdf4;border-radius:6px;width:34px;height:30px;font-size:.85rem;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0;}
      .med-campo{display:flex;flex-direction:column;gap:3px;min-width:0;}
      .med-campo label{font-size:.62rem;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:.02em;}
      .med-hint{color:#dc2626;text-transform:none;font-weight:600;letter-spacing:0;}
      .med-pct-linha{display:flex;gap:5px;}
      .med-pct-linha .med-inp-pct{flex:1;min-width:0;}
      .med-previsto{display:flex;align-items:center;height:30px;padding:0 10px;border:1px solid #e2e8f0;background:#f8fafc;border-radius:6px;font-weight:700;color:#64748b;font-size:.85rem;}
      .med-btn-100:hover{background:#dcfce7;}
      .med-foto-btn{display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:6px;background:#f1f5f9;cursor:pointer;font-size:.95rem;flex-shrink:0;}
      .med-foto-btn:hover{background:#e2e8f0;}
      .med-fotos-row{display:flex;gap:6px;flex-wrap:wrap;padding:2px 12px 8px 12px;width:100%;}
      .med-foto-thumb{position:relative;}
      .med-foto-thumb img{width:48px;height:48px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0;}
      .med-foto-thumb button{position:absolute;top:-6px;right:-6px;background:#dc2626;color:#fff;border:none;border-radius:50%;width:16px;height:16px;font-size:9px;cursor:pointer;}
      .med-tbl{border-collapse:collapse;width:100%;font-size:.8rem;background:#fff;}
      .med-tbl th{background:#f8fafc;padding:8px 10px;text-align:left;font-size:.72rem;color:#475569;border-bottom:2px solid #e2e8f0;}
      .med-tbl td{padding:8px 10px;border-bottom:1px solid #f1f5f9;}
      .btn-icone{width:28px;height:28px;min-width:28px;border:none;background:#fee2e2;color:#dc2626;border-radius:7px;font-size:.85rem;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;}
      .btn-icone:hover{background:#fecaca;}
      .med-frente-badge{color:#fff;font-size:.58rem;font-weight:700;padding:1px 6px;border-radius:7px;}
      .med-header-row{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex:1 1 220px;min-width:0;}
      .med-acoes-topo{display:flex;gap:6px;align-items:center;flex-shrink:0;}
      @media (max-width:1024px){
        .med-spacer{display:none;}
        /* Recuo de hierarquia (nivel*16px) come a largura toda no celular —
           trava num recuo pequeno e fixo, não importa a profundidade real. */
        .med-node{padding-left:calc(8px + min(var(--niv,0),2) * 8px) !important;}
        .med-top{gap:6px;padding:2px 0;}
        .med-top .btn-sm{padding:8px 10px;font-size:.82rem;flex:1 1 auto;}
        .med-top select, .med-top input.form-control{max-width:none !important;flex:1 1 47%;padding:9px;font-size:.85rem;}
        .med-chip{font-size:.82rem;padding:7px 10px;flex:1 1 30%;justify-content:center;text-align:center;}
        .med-chip small{font-size:.68rem;}
        .med-node{padding:8px 10px;}
        .med-node.leaf{padding-bottom:9px;}
        .med-node .tog{width:36px;height:36px;font-size:1.2rem;}
        .med-node .nm{font-size:.98rem;}
        .med-node .sub{font-size:.78rem;}
        .med-frente-badge{font-size:.68rem;padding:2px 7px;}
        /* Início/Término, %/100% e Foto/Descartar pareados em 2 colunas —
           input type=date tem largura mínima própria que não encolhe bem
           com flex simples, então usa grid pra garantir 2 por linha sempre. */
        .med-header-row{flex:1 1 100%;width:100%;}
        /* Card mínimo no mobile: só nome + Início/Término/% — sem badge de
           Frente (já dá pra ver no filtro de cima) nem texto de Esperado. */
        .med-frente-badge{display:none;}
        .med-leaf-esp{display:none;}
        .med-node.leaf{padding-bottom:8px;}
        .med-edit{display:grid;grid-template-columns:1fr 1fr;gap:6px;width:100%;margin-top:6px;}
        .med-inp{height:40px;font-size:.86rem;width:100%;box-sizing:border-box;min-width:0;}
        .med-inp-data{min-width:0;}
        .med-inp-pct{width:100%;flex:1;min-width:0;}
        .med-btn-100{height:40px;font-size:1rem;width:40px;flex-shrink:0;}
        .med-campo label{font-size:.64rem;}
        .med-previsto{height:40px;font-size:.9rem;}
        .med-foto-btn{width:38px;height:38px;font-size:1.15rem;}
        .btn-icone{width:38px;height:38px;font-size:1.05rem;}
        .med-foto-thumb img{width:56px;height:56px;}
      }`;
    document.head.appendChild(st);
  }

  function toggleGrupo(id){if(colapsados.has(id))colapsados.delete(id);else colapsados.add(id);_render();}
  function expandirTudo(){colapsados=new Set();_render();}
  function recolherTudo(){
    colapsados=new Set();
    for(let i=0;i<sorted.length;i++){
      const t=sorted[i],niv=t.nivel||0,nxt=sorted[i+1];
      const isLeaf=!nxt||(nxt.nivel||0)<=niv;
      if(!isLeaf)colapsados.add(t.id);
    }
    _render();
  }
  let _buscaTimer=null;
  function setBusca(v){
    busca=v||'';
    // _render() reconstrói a árvore inteira (pode ser bem grande) — fazer
    // isso a cada tecla trava a digitação. Espera uma pausa curta (250ms)
    // depois da última tecla antes de filtrar de verdade; o campo em si
    // continua respondendo normal (é o navegador que mostra o que foi
    // digitado, não depende do render).
    clearTimeout(_buscaTimer);
    _buscaTimer=setTimeout(()=>{
      const inp=document.getElementById('med-busca');
      const pos=inp?inp.selectionStart:null;
      _render();
      // O _render() reconstrói o innerHTML inteiro (destrói e recria o
      // input) — sem isso, o campo perde o foco depois de cada filtragem.
      requestAnimationFrame(()=>{
        const inp2=document.getElementById('med-busca');
        if(inp2){inp2.focus();if(pos!=null)inp2.setSelectionRange(pos,pos);}
      });
    },250);
  }
  function descartarItem(id){delete pend[id];_render();}
  function descartarTudo(){
    const n=Object.keys(pend).length;
    if(!n)return;
    if(!Utils.confirmar(`Descartar as ${n} alteração(ões) não salva(s) desta medição? Isso não afeta nada que já foi salvo antes.`))return;
    pend={};_render();
  }

  // ==================== EDIÇÃO INLINE (sem popup) ====================
  // Início Real, Término Real e % direto na linha — sem clicar em lápis
  // pra abrir modal. Fim Real só habilita/aceita com 100% de progresso.
  function _syncPend(id){
    const t=_t(id);if(!t)return;
    const p=pend[id];if(!p)return;
    const origProg=Math.min(100,t.percentualConcluido||0);
    const origIni=t.inicioReal?_iso(_d(t.inicioReal)):'';
    const origFim=t.terminoReal?_iso(_d(t.terminoReal)):'';
    const progIgual=p.progresso==null||p.progresso===origProg;
    const iniIgual=p.inicioReal==null||p.inicioReal===origIni;
    const fimIgual=p.terminoReal==null||p.terminoReal===origFim;
    if(progIgual&&iniIgual&&fimIgual&&!(p.fotos&&p.fotos.length))delete pend[id];
  }
  const _dataTimers={};
  function setCampo(id,campo,valor){
    const t=_t(id);if(!t)return;
    if(campo==='inicioReal'||campo==='terminoReal'){
      // O navegador considera a data "completa" assim que QUALQUER dígito é
      // digitado no ano (preenche o resto com zero por dentro) — validar na
      // hora dispara erro no meio da digitação, antes da pessoa terminar de
      // escrever o ano todo. Espera uma pausa (700ms) sem mexer no campo
      // antes de checar de verdade — só reage quando a digitação realmente parou.
      const chave=id+'|'+campo;
      clearTimeout(_dataTimers[chave]);
      _dataTimers[chave]=setTimeout(()=>_aplicarCampoData(id,campo,valor),700);
      return;
    }
    if(!pend[id])pend[id]={};
    if(campo==='progresso'){
      let v=parseFloat(valor);
      if(isNaN(v))v=0;
      if(v>100){Utils.toast('Não existe mais que 100%. Ajustado pra 100%.','alerta');v=100;}
      if(v<0)v=0;
      pend[id].progresso=v;
      // Caiu abaixo de 100 → Término Real deixa de fazer sentido, some.
      if(v<100)pend[id].terminoReal='';
    }
    _syncPend(id);
    // requestAnimationFrame: deixa o navegador terminar de fechar o calendário
    // /mostrar o valor digitado ANTES de reconstruir a árvore (que pode ser
    // grande) — sem isso, a reconstrução pesada roda junto com o fechamento
    // do popup e passa a sensação de travamento bem na hora de escolher a data.
    requestAnimationFrame(_render);
  }
  // Digitar data dígito-por-dígito no input nativo é fácil de errar (ano
  // vira "0002" no meio da digitação) — trava qualquer ano fora de uma
  // faixa plausível pra pegar isso antes de salvar.
  function _anoValido(valorISO){
    const ano=parseInt(String(valorISO).split('-')[0],10);
    const anoAtual=new Date().getFullYear();
    return ano>=2015&&ano<=anoAtual+3;
  }
  function _aplicarCampoData(id,campo,valor){
    const t=_t(id);if(!t)return;
    if(!pend[id])pend[id]={};
    if(valor&&!_anoValido(valor)){
      Utils.toast('Ano inválido nessa data — confira e digite de novo (ou toque no 📅).','erro');
      requestAnimationFrame(_render);
      return;
    }
    if(campo==='terminoReal'){
      const progEfetivo=pend[id].progresso!=null?pend[id].progresso:Math.min(100,t.percentualConcluido||0);
      if(valor&&progEfetivo<100){Utils.toast('Término Real só com a tarefa em 100% de progresso.','erro');requestAnimationFrame(_render);return;}
    }
    pend[id][campo]=valor||'';
    _syncPend(id);
    requestAnimationFrame(_render);
  }
  function removerFoto(id,i){
    if(!pend[id]?.fotos)return;
    pend[id].fotos.splice(i,1);
    _syncPend(id);
    requestAnimationFrame(_render);
  }
  async function fotoSelecionada(id,input){
    const files=[...(input.files||[])];input.value='';
    if(!files.length)return;
    if(!pend[id])pend[id]={};
    if(!pend[id].fotos)pend[id].fotos=[];
    Utils.mostrarLoading('Processando foto...');
    for(const f of files){
      try{const dataUrl=await _comprimir(f);pend[id].fotos.push(dataUrl);}
      catch(e){console.error(e);Utils.toast('Erro ao processar foto.','erro');}
    }
    Utils.esconderLoading();
    requestAnimationFrame(_render);
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

  // ==================== SALVAR MEDIÇÃO ====================
  async function salvarMedicao(){
    if(!Permissions.pode('medicoes','criar:medicao')){Utils.toast('Sem permissão.','erro');return;}
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
        // Início/Término Real também empurram o cronograma ATUAL (inicioPlanejado/
        // terminoPlanejado) pra refletir a realidade — a Linha de Base
        // (inicioPlanejadoBase/terminoPlanejadoBase) nunca é tocada aqui.
        if(upd.inicioReal)upd.inicioPlanejado=upd.inicioReal;
        if(upd.terminoReal){
          upd.terminoPlanejado=upd.terminoReal;
          const iniRef=upd.inicioPlanejado||t.inicioPlanejado;
          if(iniRef)upd.duracao=Math.max(0,Math.ceil((new Date(upd.terminoReal)-new Date(iniRef))/864e5));
        }
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
    if(!Permissions.pode('medicoes','excluir:medicao')){Utils.toast('Sem permissão para excluir.','erro');return;}
    if(!Utils.confirmar('Excluir esta medição? (Não altera os % já gravados no planejamento.)'))return;
    try{await Database.deletar(obraId,COLM,id);Utils.toast('Medição excluída.','sucesso');_render();}
    catch(e){console.error(e);Utils.toast('Erro.','erro');}
  }

  return{init,carregar,novaMedicao,voltar,toggleGrupo,expandirTudo,recolherTudo,setBusca,setFiltroFrente,setOcultarConcluidos,descartarItem,descartarTudo,
    setCampo,removerFoto,fotoSelecionada,
    salvarMedicao,verMedicao,excluirMedicao};
})();

function onObraChanged(){ Medicoes.init(); }

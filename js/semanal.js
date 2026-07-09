// ============================================
// Semanal / Diário — Planejamento Semanal V1
// Alimentado pelo Planejamento e alimenta de volta:
// lançamentos de % gravam em percentualConcluido e
// atualizam inicioReal/terminoReal das tarefas.
// ============================================
const Semanal = (() => {
  let obraId=null, tarefas=[], sorted=[], leafSet=new Set(), idxMap=new Map();
  let modo='semana';          // 'semana' | 'dia'
  let refDate=null;           // Date dentro do período visível
  let semDoc=null;            // doc da semana/dia atual (coleção 'semanas')
  let vista='atuais';         // 'atuais' | 'omitidas'
  let ordenacao='ordem';      // 'ordem' | 'status'
  let aba='tarefas';          // 'dashboard' | 'tarefas' | 'diario'
  let sel=new Set();          // ids selecionados (checkbox)
  let omitindo=[];            // ids em processo de omissão
  const COL='tarefas', COLS='semanas', COLD='diario';
  // ---- Diário de obra ----
  let diaRef=null;            // Date do dia sendo lançado/visto no Diário
  let lancamentosDia=[];      // lançamentos do dia carregado
  let _diaBusca='', _diaTarSel='', _diaStatus='executado', _diaEditId=null;
  const DIAS=['dom','seg','ter','qua','qui','sex','sáb'];
  const MOTIVOS=['Frente/Predecessora Não Liberada','Atraso Entrega de Material','Atraso Programação de Material','Falta de Material (Sobreconsumo)','Material Não Conforme','Material Não Comprado','Necessidade Não Prevista (EAP)','Especificação de Projeto','Equipamentos Indisponíveis','Serviço Não Contratado','Mudança no Plano de Ataque','Atraso em Documentações','Baixa Produtividade Prevista','Intempéries','Outros'];
  const ST_LABEL={atual:'Atual',adicionada:'Adicionada',atrasada:'Atrasada',omitida:'Omitida'};
  const ST_CSS={atual:'background:#fde047;color:#713f12;',adicionada:'background:#86efac;color:#14532d;',atrasada:'background:#ef4444;color:#fff;',omitida:'background:#e2e8f0;color:#475569;'};

  // ==================== DATAS ====================
  function _d(s){if(!s)return null;if(s.toDate)s=s.toDate();if(s instanceof Date)return new Date(s.getFullYear(),s.getMonth(),s.getDate());
    const m=String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);if(m)return new Date(+m[1],+m[2]-1,+m[3]);
    const b=String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);if(b)return new Date(+b[3],+b[2]-1,+b[1]);
    const d=new Date(s);return isNaN(d)?null:new Date(d.getFullYear(),d.getMonth(),d.getDate());}
  function _iso(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  function _fmt(s){const d=_d(s);return d?`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`:'-';}
  function _hoje(){const n=new Date();return new Date(n.getFullYear(),n.getMonth(),n.getDate());}
  function _addD(d,n){const r=new Date(d);r.setDate(r.getDate()+n);return r;}
  function _isoWeek(d){const t=new Date(d);t.setHours(0,0,0,0);t.setDate(t.getDate()+3-((t.getDay()+6)%7));const w1=new Date(t.getFullYear(),0,4);return{w:1+Math.round(((t-w1)/864e5-3+((w1.getDay()+6)%7))/7),y:t.getFullYear()};}

  function _periodo(){
    if(modo==='dia'){const d=refDate;return{ini:d,fim:d,id:'D'+_iso(d),label:`${DIAS[d.getDay()]}, ${_fmt(_iso(d))}`};}
    const ini=_addD(refDate,-refDate.getDay());const fim=_addD(ini,6);
    const {w,y}=_isoWeek(_addD(ini,1));
    return{ini,fim,id:`S${String(w).padStart(2,'0')}-${y}`,label:`S${w} A${y}`};
  }

  // ==================== INIT / LOAD ====================
  async function init(){
    const ok=await Utils.initPagina({requireObra:true});if(!ok)return;
    obraId=Router.getObraId();
    if(!obraId){_el().innerHTML='<div class="estado-vazio"><div class="icone">📋</div><p>Selecione uma obra.</p></div>';return;}
    refDate=_hoje();
    await carregar();
  }
  function _el(){return document.getElementById('modulo-content')||document.body;}

  async function carregar(){
    try{
      Utils.mostrarLoading('Carregando...');
      tarefas=await Database.listar(obraId,COL,'ordem').catch(()=>[]);
      _prep();
      await _loadDoc();
      _render();
    }catch(e){console.error(e);Utils.toast('Erro ao carregar.','erro');}
    finally{Utils.esconderLoading();}
  }

  function _prep(){
    sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    idxMap=new Map();sorted.forEach((t,i)=>idxMap.set(t.id,i));
    leafSet=new Set();
    for(let i=0;i<sorted.length;i++){
      const nxt=sorted[i+1];
      if(!nxt||((nxt.nivel||0)<=(sorted[i].nivel||0)))leafSet.add(sorted[i].id);
    }
  }

  async function _loadDoc(){
    const p=_periodo();
    semDoc=await Database.obter(obraId,COLS,p.id).catch(()=>null);
    if(!semDoc){
      const baseline={};
      _baseUniverso(null).forEach(t=>baseline[t.id]=t.percentualConcluido||0);
      semDoc={tipo:modo,inicio:_iso(p.ini),fim:_iso(p.fim),label:p.label,status:'aberta',adicionadas:[],omitidas:{},baseline,justificativas:{},obraId};
      try{await Database.criar(obraId,COLS,{...semDoc},p.id);}catch(e){console.warn(e);}
      semDoc.id=p.id;
    }
    semDoc.adicionadas=semDoc.adicionadas||[];
    semDoc.omitidas=semDoc.omitidas||{};
    semDoc.baseline=semDoc.baseline||{};
    semDoc.justificativas=semDoc.justificativas||{};
  }
  async function _saveDoc(campos){
    try{await Database.atualizar(obraId,COLS,semDoc.id,campos);Object.assign(semDoc,campos);}
    catch(e){console.error(e);Utils.toast('Erro ao salvar período.','erro');}
  }

  // ==================== CÁLCULOS ====================
  function _espAt(t,d){
    const i=_d(t.inicioPlanejado),f=_d(t.terminoPlanejado);
    if(!i||!f)return Math.round(t.percentualEsperado||0);
    if(d<i)return 0;if(d>=f)return 100;
    const tot=Math.max(1,Math.round((f-i)/864e5)+1);
    const done=Math.round((d-i)/864e5)+1;
    return Math.min(100,Math.max(0,Math.round(done/tot*100)));
  }
  function _peso(t){return Math.max(1,t.duracao||1);}

  // universo do período: tarefas-folha no intervalo, atrasadas e adicionadas
  function _baseUniverso(doc){
    const {ini,fim}=_periodo();
    const add=new Set((doc||semDoc)?.adicionadas||[]);
    const out=[];
    for(const t of sorted){
      if(!leafSet.has(t.id))continue;
      const i=_d(t.inicioPlanejado),f=_d(t.terminoPlanejado);
      const perc=t.percentualConcluido||0;
      if(i&&f&&i<=fim&&f>=ini){t._st='atual';out.push(t);continue;}
      if(f&&f<ini&&perc<100){t._st='atrasada';out.push(t);continue;}
      if(add.has(t.id)){t._st='adicionada';out.push(t);}
    }
    return out;
  }
  function _ativas(){return _baseUniverso(semDoc);}
  function _ro(){return semDoc?.status==='fechada';}

  function _totaisObra(){
    let sw=0,sr=0,se=0;const hoje=_hoje();
    for(const t of sorted){
      if(!leafSet.has(t.id))continue;
      const w=_peso(t);sw+=w;
      sr+=Math.min(100,t.percentualConcluido||0)*w;
      se+=_espAt(t,hoje)*w;
    }
    return sw?{real:sr/sw,esp:se/sw}:{real:0,esp:0};
  }

  // ==================== LINHAS ====================
  function _linhas(){
    const om=semDoc.omitidas;
    const univ=_ativas();
    let list=vista==='atuais'?univ.filter(t=>!om[t.id]):univ.filter(t=>om[t.id]);
    if(ordenacao==='status'||vista==='omitidas'){
      const pr={atrasada:0,atual:1,adicionada:2};
      list=[...list].sort((a,b)=>(pr[a._st]-pr[b._st])||(idxMap.get(a.id)-idxMap.get(b.id)));
      return list.map(t=>({t,grp:false}));
    }
    // Por Ordem: intercala linhas de grupo (ancestrais)
    const incl=new Map();
    for(const t of list){
      let lvl=(t.nivel||0);
      const chain=[];
      for(let i=idxMap.get(t.id)-1;i>=0&&lvl>0;i--){
        const a=sorted[i];
        if((a.nivel||0)<lvl){chain.unshift(a);lvl=a.nivel||0;}
      }
      chain.forEach(a=>{if(!incl.has(a.id))incl.set(a.id,{t:a,grp:true});});
      incl.set(t.id,{t,grp:false});
    }
    return [...incl.values()].sort((a,b)=>idxMap.get(a.t.id)-idxMap.get(b.t.id));
  }

  // ==================== RENDER ====================
  function _render(){
    const p=_periodo();
    const dias=[];for(let d=new Date(p.ini);d<=p.fim;d=_addD(d,1))dias.push(new Date(d));
    const linhas=_linhas();
    const om=semDoc.omitidas;
    const ro=_ro();

    let banner='';
    if(ro){
      banner=`<div class="sem-banner">✅ ${modo==='semana'?'Semana':'Dia'} <b>${p.label}</b> fechado em ${_fmt(semDoc.fechadaEm)} —
        <button class="btn btn-sm" onclick="Semanal.verRelatorio()">📄 Ver relatório</button>
        <button class="btn btn-sm btn-outline" onclick="Semanal.reabrir()">↺ Reabrir</button></div>`;
    }

    let thDias=dias.map(d=>`<th class="sem-dia-h">${DIAS[d.getDay()]},<br>${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}</th>`).join('');

    let rows='';
    for(const {t,grp} of linhas){
      const num=idxMap.get(t.id)+1;
      if(grp){
        rows+=`<tr class="sem-grp"><td></td><td></td><td class="col-num">${num}</td>
          <td colspan="${10+dias.length}" style="font-weight:700;padding-left:${8+(t.nivel||0)*14}px;">${_esc(t.nome)}</td><td></td></tr>`;
        continue;
      }
      const st=om[t.id]?'omitida':t._st;
      const perc=Math.min(100,t.percentualConcluido||0);
      const esp=_espAt(t,p.fim);
      const iniP=_d(t.inicioPlanejado),fimP=_d(t.terminoPlanejado);
      const podeIni=perc<=0&&!ro;
      let tdDias=dias.map(d=>{
        const on=iniP&&fimP&&d>=iniP&&d<=fimP;
        return `<td class="sem-dia ${on?'sem-dia-on':''}"></td>`;
      }).join('');
      const omInfo=om[t.id]?` title="Motivo: ${_esc(om[t.id].motivo||'')}${om[t.id].detalhamento?' — '+_esc(om[t.id].detalhamento):''}"`:'';
      rows+=`<tr class="sem-row" data-id="${t.id}">
        <td class="col-centro"><input type="checkbox" ${sel.has(t.id)?'checked':''} onchange="Semanal.toggleSel('${t.id}',this.checked)"></td>
        <td><span class="sem-chip" style="${ST_CSS[st]}"${omInfo}>${ST_LABEL[st]}</span></td>
        <td class="col-num">${num}</td>
        <td style="padding-left:${8+(t.nivel||0)*14}px;">${_esc(t.nome)}</td>
        <td class="col-centro ${podeIni?'sem-edit':''}" ${podeIni?`onclick="Semanal.editarInicio('${t.id}',this)"`:''}>${_fmt(t.inicioPlanejado)}</td>
        <td class="col-centro">${_fmt(t.terminoPlanejado)}</td>
        <td class="col-centro" style="color:#555;">${esp}</td>
        <td class="col-centro sem-prog ${ro?'':'sem-edit'}" ${ro?'':`onclick="Semanal.editarProgresso('${t.id}',this)"`} style="color:${perc>=100?'#16a34a':perc>0?'#2563eb':'#2563eb'};font-weight:600;">${perc}</td>
        <td class="col-centro">${_esc(t.local||'-')}</td>
        <td class="col-centro">${_esc(t.grupo||'-')}</td>
        <td class="col-centro ${ro?'':'sem-edit'}" ${ro?'':`onclick="Semanal.editarData('${t.id}','inicioReal',this)"`}>✏️ ${t.inicioReal?_fmt(t.inicioReal):'-'}</td>
        <td class="col-centro ${ro?'':'sem-edit'}" ${ro?'':`onclick="Semanal.editarData('${t.id}','terminoReal',this)"`}>✏️ ${t.terminoReal?_fmt(t.terminoReal):'-'}</td>
        <td class="col-centro ${ro?'':'sem-edit'}" ${ro?'':`onclick="Semanal.editarResp('${t.id}',this)"`}>✏️ ${_esc(t.responsavel||'')}</td>
        ${tdDias}
        <td class="col-centro">${ro?'':vista==='omitidas'
          ?`<button class="btn-icone" title="Restaurar na semana" onclick="Semanal.restaurar('${t.id}')">↩️</button>`
          :`<button class="btn-icone" title="Remover da ${modo==='semana'?'semana':'programação do dia'}" onclick="Semanal.abrirOmitir(['${t.id}'])">🗑️</button>`}</td>
      </tr>`;
    }
    if(!rows)rows=`<tr><td colspan="${14+dias.length}" style="text-align:center;padding:30px;color:#94a3b8;">Nenhuma tarefa ${vista==='atuais'?'no período':'omitida'}.</td></tr>`;

    const tot=_totaisObra();
    const html=`
    <style id="sem-css">
      .sem-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px;}
      .sem-top .sp{flex:1;}
      .sem-nav{display:flex;align-items:center;background:#0f172a;color:#fff;border-radius:8px;overflow:hidden;}
      .sem-nav button{background:none;border:none;color:#fff;padding:8px 10px;cursor:pointer;font-size:.9rem;}
      .sem-nav .lbl{padding:0 10px;font-weight:700;font-size:.85rem;white-space:nowrap;}
      .sem-seg{display:flex;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;}
      .sem-seg button{background:#fff;border:none;padding:7px 12px;cursor:pointer;font-size:.8rem;font-weight:600;color:#475569;}
      .sem-seg button.on{background:#0f172a;color:#fff;}
      .sem-chip{display:inline-block;padding:3px 10px;border-radius:6px;font-size:.72rem;font-weight:700;white-space:nowrap;}
      .sem-tbl-wrap{overflow:auto;border:1px solid #e2e8f0;border-radius:10px;background:#fff;max-height:calc(100vh - 260px);}
      .sem-tbl{border-collapse:collapse;width:100%;font-size:.78rem;}
      .sem-tbl th{position:sticky;top:0;background:#f8fafc;z-index:3;padding:8px 8px;border-bottom:2px solid #e2e8f0;text-align:left;font-size:.72rem;color:#475569;white-space:nowrap;}
      .sem-tbl td{padding:6px 8px;border-bottom:1px solid #f1f5f9;white-space:nowrap;}
      .sem-tbl .col-num{text-align:right;font-family:monospace;color:#64748b;}
      .sem-tbl .col-centro{text-align:center;}
      .sem-grp td{background:#e5e7eb;font-size:.76rem;}
      .sem-row:hover td{background:#fefce8;}
      .sem-dia,.sem-dia-h{width:36px;min-width:36px;text-align:center;border-left:1px solid #f1f5f9;font-size:.66rem;}
      .sem-dia-on{background:#fde047;}
      .sem-edit{cursor:pointer;}
      .sem-edit:hover{outline:1px dashed #f5c800;}
      .sem-banner{background:#ecfdf5;border:1px solid #6ee7b7;color:#065f46;padding:10px 14px;border-radius:8px;margin-bottom:10px;display:flex;align-items:center;gap:10px;font-size:.85rem;}
      .sem-addbar{background:#0f172a;color:#fff;padding:10px 14px;border-radius:0 0 10px 10px;cursor:pointer;font-size:.82rem;font-weight:600;}
      .sem-addbar:hover{background:#1e293b;}
      .sem-selbar{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:#0f172a;color:#fff;border-radius:10px;padding:8px 14px;display:flex;gap:14px;align-items:center;z-index:50;box-shadow:0 8px 24px rgba(0,0,0,.3);font-size:.82rem;}
      .sem-selbar button{background:none;border:none;color:#fff;cursor:pointer;font-size:.82rem;font-weight:600;}
      .sem-selbar button:hover{color:#f5c800;}
      .sem-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:16px;}
      .sem-card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px;}
      .sem-card .v{font-size:1.5rem;font-weight:800;}
      .sem-card .l{font-size:.72rem;color:#64748b;text-transform:uppercase;letter-spacing:.4px;}
      .sem-subtabs{display:flex;gap:16px;border-bottom:1px solid #e2e8f0;margin-bottom:12px;}
      .sem-subtabs button{background:none;border:none;padding:8px 2px;cursor:pointer;font-size:.85rem;color:#64748b;border-bottom:2px solid transparent;font-weight:600;}
      .sem-subtabs button.on{color:#0f172a;border-bottom-color:#f5c800;}
      .sem-tree{max-height:52vh;overflow:auto;border:1px solid #e2e8f0;border-radius:8px;padding:6px;}
      .sem-tree .tg{background:#e5e7eb;border-radius:6px;padding:6px 10px;margin:4px 0;font-weight:700;font-size:.78rem;}
      .sem-tree .tl{display:flex;align-items:flex-start;gap:8px;padding:6px 10px;font-size:.8rem;border-bottom:1px solid #f8fafc;}
      .sem-tree .tl .sub{color:#94a3b8;font-size:.68rem;}
      @media print{.sidebar,.header,.sem-top,.sem-addbar,.sem-selbar,.sem-subtabs{display:none !important;}.sem-tbl-wrap{max-height:none;overflow:visible;}}
    </style>
    ${banner}
    <div class="sem-subtabs">
      <button class="${aba==='dashboard'?'on':''}" onclick="Semanal.setAba('dashboard')">Dashboard</button>
      <button class="${aba==='tarefas'?'on':''}" onclick="Semanal.setAba('tarefas')">Tarefas</button>
      <button class="${aba==='diario'?'on':''}" onclick="Semanal.setAba('diario')">Diário</button>
    </div>
    ${aba==='diario'?'':`<div class="sem-top">
      <div class="sem-nav">
        <button onclick="Semanal.nav(-1)" title="Anterior">‹</button>
        <span class="lbl">${p.label}</span>
        <button onclick="Semanal.nav(1)" title="Próximo">›</button>
        <button onclick="Semanal.hojeBtn()" title="Ir para hoje" style="border-left:1px solid #334155;">●</button>
      </div>
      <div class="sem-seg">
        <button class="${modo==='semana'?'on':''}" onclick="Semanal.setModo('semana')">Semana</button>
        <button class="${modo==='dia'?'on':''}" onclick="Semanal.setModo('dia')">Dia</button>
      </div>
      ${ro?'':semDoc.status==='aberta'
        ?`<button class="btn btn-sm btn-primario" onclick="Semanal.iniciar()">▶ Iniciar ${modo==='semana'?'semana':'dia'}</button>`
        :`<span class="sem-chip" style="background:#dbeafe;color:#1e40af;">Em andamento desde ${_fmt(semDoc.iniciadaEm)}</span>`}
      ${ro?'':`<button class="btn btn-sm" style="background:#0f172a;color:#fff;" onclick="Semanal.abrirFechar()">■ Fechar relatório</button>`}
      ${ro?'':`<button class="btn btn-sm btn-outline" style="color:#dc2626;" onclick="Semanal.resetar()">↺ Resetar</button>`}
      <div class="sp"></div>
      <div class="sem-seg">
        <button class="${vista==='atuais'?'on':''}" onclick="Semanal.setVista('atuais')">Atuais</button>
        <button class="${vista==='omitidas'?'on':''}" onclick="Semanal.setVista('omitidas')">Omitidas</button>
      </div>
      <div class="sem-seg">
        <button class="${ordenacao==='ordem'?'on':''}" onclick="Semanal.setOrdem('ordem')">Por Ordem</button>
        <button class="${ordenacao==='status'?'on':''}" onclick="Semanal.setOrdem('status')">Por Status</button>
      </div>
      <button class="btn btn-sm btn-outline" onclick="window.print()" title="Imprimir">🖨️</button>
    </div>`}
    ${aba==='dashboard'?_dashHTML(tot):aba==='diario'?_diarioHTML():`
    <div class="sem-tbl-wrap">
      <table class="sem-tbl">
        <thead><tr>
          <th style="width:30px;"></th><th>Status</th><th style="width:44px;">#</th><th style="min-width:220px;">Nome</th>
          <th>Início</th><th>Término</th><th>Esperado</th><th>Progresso</th><th>Local</th><th>Grupo</th>
          <th>Início Real</th><th>Término Real</th><th>Responsável</th>${thDias}<th>Ações</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${ro?'':`<div class="sem-addbar" onclick="Semanal.abrirAdicionar()">＋ Adicionar tarefas</div>`}
    `}
    ${sel.size&&!ro?`<div class="sem-selbar">
      <span>${sel.size} tarefa${sel.size>1?'s':''} selecionada${sel.size>1?'s':''}</span>
      <button onclick="Semanal.limparSel()">✕</button>
      <button onclick="Semanal.selDatas()">📅 Datas</button>
      <button onclick="Semanal.selResp()">👤 Responsável</button>
      <button onclick="Semanal.abrirOmitirSel()">🚫 Omitir</button>
    </div>`:''}`;
    _el().innerHTML=html;
    if(aba==='dashboard')carregarHistorico();
  }

  function _dashHTML(tot){
    const p=_periodo();
    const univ=_ativas();
    const om=semDoc.omitidas;
    const ativos=univ.filter(t=>!om[t.id]);
    const conc=ativos.filter(t=>(t.percentualConcluido||0)>=_espAt(t,p.fim)).length;
    const atras=ativos.filter(t=>t._st==='atrasada').length;
    const ppc=ativos.length?Math.round(conc/ativos.length*100):0;
    return `
    <div class="sem-cards">
      <div class="sem-card"><div class="v">${ativos.length}</div><div class="l">Tarefas no período</div></div>
      <div class="sem-card"><div class="v" style="color:#16a34a;">${conc}</div><div class="l">Dentro do esperado</div></div>
      <div class="sem-card"><div class="v" style="color:#dc2626;">${atras}</div><div class="l">Atrasadas</div></div>
      <div class="sem-card"><div class="v" style="color:#64748b;">${Object.keys(om).length}</div><div class="l">Omitidas</div></div>
      <div class="sem-card"><div class="v">${ppc}%</div><div class="l">PPC (aderência)</div></div>
      <div class="sem-card"><div class="v" style="color:#2563eb;">${tot.real.toFixed(1)}%</div><div class="l">% Total atual (obra)</div></div>
      <div class="sem-card"><div class="v" style="color:#555;">${tot.esp.toFixed(1)}%</div><div class="l">% Total esperado (hoje)</div></div>
    </div>
    <h3 style="font-size:.95rem;margin:8px 0;">Períodos fechados</h3>
    <div id="sem-historico" style="font-size:.82rem;color:#94a3b8;">Carregando histórico...</div>`;
  }

  async function carregarHistorico(){
    const el=document.getElementById('sem-historico');if(!el)return;
    try{
      const docs=(await Database.listar(obraId,COLS,'fim')).filter(d=>d.status==='fechada')
        .sort((a,b)=>String(b.fim).localeCompare(String(a.fim)));
      if(!docs.length){el.textContent='Nenhum período fechado ainda.';return;}
      el.innerHTML=`<table class="sem-tbl" style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;">
        <thead><tr><th>Período</th><th>Intervalo</th><th class="col-centro">% Período</th><th class="col-centro">PPC</th><th class="col-centro">Omitidas</th><th></th></tr></thead>
        <tbody>${docs.map(d=>`<tr>
          <td><b>${_esc(d.label||d.id)}</b></td>
          <td>${_fmt(d.inicio)} — ${_fmt(d.fim)}</td>
          <td class="col-centro">${(d.relatorio?.resumo?.pctPeriodoReal??0).toFixed(1)}%</td>
          <td class="col-centro">${d.relatorio?.resumo?.ppc??0}%</td>
          <td class="col-centro">${Object.keys(d.omitidas||{}).length}</td>
          <td class="col-centro"><button class="btn btn-sm btn-outline" onclick="Semanal.verRelatorioDoc('${d.id}')">📄 Ver</button></td>
        </tr>`).join('')}</tbody></table>`;
    }catch(e){console.error(e);el.textContent='Erro ao carregar histórico.';}
  }

  function _esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

  // ==================== NAVEGAÇÃO / ESTADO ====================
  async function nav(dir){refDate=_addD(refDate,dir*(modo==='semana'?7:1));sel.clear();await _loadDoc();_render();}
  async function hojeBtn(){refDate=_hoje();sel.clear();await _loadDoc();_render();}
  async function setModo(m){if(m===modo)return;modo=m;sel.clear();await _loadDoc();_render();}
  function setVista(v){vista=v;sel.clear();_render();}
  function setOrdem(o){ordenacao=o;_render();}
  function setAba(a){
    aba=a;
    if(a==='diario'){
      if(!diaRef)diaRef=_hoje();
      _loadDiario().then(()=>_render());
      return;
    }
    _render();
  }
  function toggleSel(id,on){if(on)sel.add(id);else sel.delete(id);_render();}
  function limparSel(){sel.clear();_render();}

  // ==================== EDIÇÃO INLINE ====================
  function _inline(el,tipo,val,onSave){
    if(el.querySelector('input'))return;
    const old=el.innerHTML;
    el.innerHTML=`<input type="${tipo}" value="${val??''}" style="width:${tipo==='date'?'130px':tipo==='number'?'64px':'120px'};font-size:.78rem;padding:2px 4px;border:1px solid #f5c800;border-radius:4px;" ${tipo==='number'?'min="0" max="100"':''}>`;
    const inp=el.querySelector('input');inp.focus();if(tipo!=='date')inp.select();
    let done=false;
    const fin=async(save)=>{if(done)return;done=true;
      if(save){const v=inp.value;el.innerHTML=old;await onSave(v);}else el.innerHTML=old;};
    inp.addEventListener('keydown',e=>{if(e.key==='Enter')fin(true);if(e.key==='Escape')fin(false);});
    inp.addEventListener('blur',()=>fin(true));
  }
  function _t(id){return tarefas.find(x=>x.id===id);}

  async function _salvarTarefa(id,upd){
    try{
      await Database.atualizar(obraId,COL,id,upd);
      const t=_t(id);if(t)Object.assign(t,upd);
      _prep();_render();
    }catch(e){console.error(e);Utils.toast('Erro ao salvar.','erro');}
  }

  function editarProgresso(id,el){
    const t=_t(id);if(!t)return;
    _inline(el,'number',t.percentualConcluido||0,async v=>{
      let n=Math.min(100,Math.max(0,parseFloat(v)||0));
      const upd={percentualConcluido:n};
      const hoje=_iso(_hoje());
      if(n>0&&!t.inicioReal)upd.inicioReal=hoje;
      if(n>=100&&!t.terminoReal)upd.terminoReal=hoje;
      if(n<100&&t.terminoReal)upd.terminoReal='';
      await _salvarTarefa(id,upd);
      Utils.toast('Progresso salvo no planejamento.','sucesso');
    });
  }

  function editarInicio(id,el){
    const t=_t(id);if(!t)return;
    if((t.percentualConcluido||0)>0){Utils.toast('Tarefa já iniciada — início planejado bloqueado.','alerta');return;}
    const cur=_d(t.inicioPlanejado);
    _inline(el,'date',cur?_iso(cur):'',async v=>{
      if(!v)return;
      const ini=_d(v);const upd={inicioPlanejado:_iso(ini)};
      const dur=t.duracao||0;
      if(dur)upd.terminoPlanejado=_iso(_addD(ini,dur));
      else if(t.terminoPlanejado){
        const f=_d(t.terminoPlanejado),i0=_d(t.inicioPlanejado);
        if(f&&i0)upd.terminoPlanejado=_iso(_addD(ini,Math.round((f-i0)/864e5)));
      }
      await _salvarTarefa(id,upd);
      Utils.toast('Datas atualizadas no planejamento.','sucesso');
    });
  }

  function editarData(id,campo,el){
    const t=_t(id);if(!t)return;
    const cur=_d(t[campo]);
    _inline(el,'date',cur?_iso(cur):'',async v=>{
      const upd={};upd[campo]=v?_iso(_d(v)):'';
      if(campo==='terminoReal'&&v&&(t.percentualConcluido||0)<100)upd.percentualConcluido=100;
      await _salvarTarefa(id,upd);
    });
  }

  function editarResp(id,el){
    const t=_t(id);if(!t)return;
    _inline(el,'text',t.responsavel||'',async v=>{await _salvarTarefa(id,{responsavel:v.trim()});});
  }

  // ==================== SELEÇÃO EM MASSA ====================
  async function selDatas(){
    const v=prompt('Nova data de início planejado (DD/MM/AAAA) para as tarefas selecionadas NÃO iniciadas:');
    if(!v)return;const ini=_d(v);if(!ini){Utils.toast('Data inválida.','alerta');return;}
    let n=0;
    for(const id of sel){
      const t=_t(id);if(!t||(t.percentualConcluido||0)>0)continue;
      const upd={inicioPlanejado:_iso(ini)};
      if(t.duracao)upd.terminoPlanejado=_iso(_addD(ini,t.duracao));
      await Database.atualizar(obraId,COL,id,upd).then(()=>{Object.assign(t,upd);n++;}).catch(console.error);
    }
    _prep();sel.clear();_render();
    Utils.toast(`${n} tarefa(s) reprogramada(s).`,'sucesso');
  }
  async function selResp(){
    const v=prompt('Responsável para as tarefas selecionadas:');
    if(v==null)return;
    for(const id of sel){
      const t=_t(id);if(!t)continue;
      await Database.atualizar(obraId,COL,id,{responsavel:v.trim()}).then(()=>{t.responsavel=v.trim();}).catch(console.error);
    }
    sel.clear();_render();Utils.toast('Responsável atualizado.','sucesso');
  }

  // ==================== OMITIR / RESTAURAR ====================
  function abrirOmitir(ids){
    omitindo=ids;
    document.getElementById('sem-omitir-sub').textContent=ids.length>1?'Múltiplas Tarefas':'Uma Tarefa';
    document.getElementById('sem-omitir-motivo').innerHTML='<option value=""></option>'+MOTIVOS.map(m=>`<option>${m}</option>`).join('');
    document.getElementById('sem-omitir-det').value='';
    Utils.abrirModal('modal-sem-omitir');
  }
  function abrirOmitirSel(){if(!sel.size)return;abrirOmitir([...sel]);}
  async function salvarOmitir(){
    const motivo=document.getElementById('sem-omitir-motivo').value;
    const det=document.getElementById('sem-omitir-det').value.trim();
    if(!motivo){Utils.toast('Selecione o motivo.','alerta');return;}
    const om={...semDoc.omitidas};
    omitindo.forEach(id=>{om[id]={motivo,detalhamento:det,data:_iso(_hoje())};});
    await _saveDoc({omitidas:om});
    Utils.fecharModal('modal-sem-omitir');
    sel.clear();omitindo=[];
    _render();Utils.toast('Tarefa(s) omitida(s) do período.','sucesso');
  }
  async function restaurar(id){
    const om={...semDoc.omitidas};delete om[id];
    await _saveDoc({omitidas:om});
    _render();Utils.toast('Tarefa restaurada no período.','sucesso');
  }

  // ==================== ADICIONAR TAREFAS ====================
  function abrirAdicionar(){
    const univ=new Set(_ativas().map(t=>t.id));
    const body=document.getElementById('sem-add-lista');
    let html='';
    for(const t of sorted){
      const isLeaf=leafSet.has(t.id);
      if(!isLeaf){html+=`<div class="tg sem-add-grp" data-nome="${_esc((t.nome||'').toLowerCase())}" style="margin-left:${(t.nivel||0)*12}px;">${_esc(t.nome)}</div>`;continue;}
      if(univ.has(t.id))continue;
      html+=`<label class="tl sem-add-leaf" data-nome="${_esc((t.nome||'').toLowerCase())}" style="margin-left:${(t.nivel||0)*12}px;">
        <input type="checkbox" value="${t.id}">
        <span>${_esc(t.nome)}<br><span class="sub">${_fmt(t.inicioPlanejado)} — ${_fmt(t.terminoPlanejado)} · ${(t.percentualConcluido||0)}%</span></span>
      </label>`;
    }
    body.innerHTML=html||'<p style="color:#94a3b8;padding:14px;">Todas as tarefas já estão no período.</p>';
    document.getElementById('sem-add-busca').value='';
    Utils.abrirModal('modal-sem-add');
  }
  function filtrarAdicionar(q){
    q=(q||'').toLowerCase().trim();
    const body=document.getElementById('sem-add-lista');
    body.querySelectorAll('.sem-add-leaf').forEach(el=>{
      el.style.display=!q||el.dataset.nome.includes(q)?'':'none';
    });
    body.querySelectorAll('.sem-add-grp').forEach(el=>{el.style.display=q?'none':'';});
  }
  async function confirmarAdicionar(){
    const ids=[...document.querySelectorAll('#sem-add-lista input:checked')].map(i=>i.value);
    if(!ids.length){Utils.toast('Selecione ao menos uma tarefa.','alerta');return;}
    const add=[...new Set([...(semDoc.adicionadas||[]),...ids])];
    const baseline={...semDoc.baseline};
    ids.forEach(id=>{const t=_t(id);if(t&&baseline[id]==null)baseline[id]=t.percentualConcluido||0;});
    await _saveDoc({adicionadas:add,baseline});
    Utils.fecharModal('modal-sem-add');
    _render();Utils.toast(`${ids.length} tarefa(s) adicionada(s) ao período.`,'sucesso');
  }

  // ==================== INICIAR / RESETAR ====================
  async function iniciar(){
    if(!Utils.confirmar(`Iniciar ${modo==='semana'?'a semana':'o dia'} ${_periodo().label}? O avanço passa a ser medido a partir de agora.`))return;
    const baseline={};
    _ativas().forEach(t=>baseline[t.id]=t.percentualConcluido||0);
    await _saveDoc({status:'iniciada',iniciadaEm:_iso(_hoje()),baseline});
    _render();Utils.toast('Período iniciado.','sucesso');
  }
  async function resetar(){
    if(!Utils.confirmar('Resetar o período? Remove adicionadas, omitidas e o fechamento (não altera o % das tarefas).'))return;
    try{await Database.deletar(obraId,COLS,semDoc.id);}catch(e){console.error(e);}
    await _loadDoc();_render();Utils.toast('Período resetado.','sucesso');
  }

  // ==================== FECHAR RELATÓRIO ====================
  function _calcRelatorio(){
    const p=_periodo();
    const om=semDoc.omitidas;
    const base=semDoc.baseline||{};
    const ativos=_ativas().filter(t=>!om[t.id]);
    let sw=0,sReal=0,sEsp=0,conc=0;
    const itens=ativos.map(t=>{
      const w=_peso(t);
      const b=base[t.id]!=null?base[t.id]:0;
      const prog=Math.min(100,t.percentualConcluido||0);
      const espFim=_espAt(t,p.fim);
      const espIni=_espAt(t,_addD(p.ini,-1));
      sw+=w;
      sReal+=Math.max(0,prog-b)*w;
      sEsp+=Math.max(0,espFim-espIni)*w;
      if(prog>=espFim)conc++;
      return{id:t.id,nome:t.nome,st:t._st,esperado:espFim,progresso:prog,avanco:Math.max(0,prog-b)};
    });
    const tot=_totaisObra();
    return{itens,resumo:{
      pctPeriodoReal:sw?sReal/sw:0,
      pctPeriodoEsp:sw?sEsp/sw:0,
      totalAtual:tot.real,totalEsperado:tot.esp,
      ppc:itens.length?Math.round(conc/itens.length*100):0,
      tarefas:itens.length,concluidasNoEsperado:conc,
      omitidas:Object.keys(om).length
    }};
  }

  function abrirFechar(){
    const r=_calcRelatorio();
    const pend=r.itens.filter(i=>i.progresso<i.esperado);
    const om=semDoc.omitidas;
    const just=semDoc.justificativas||{};
    let html=`
      <div class="sem-cards" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));">
        <div class="sem-card"><div class="v">${r.resumo.pctPeriodoReal.toFixed(1)}%</div><div class="l">% do período (real)</div></div>
        <div class="sem-card"><div class="v" style="color:#555;">${r.resumo.pctPeriodoEsp.toFixed(1)}%</div><div class="l">% do período (esperado)</div></div>
        <div class="sem-card"><div class="v" style="color:#2563eb;">${r.resumo.totalAtual.toFixed(1)}%</div><div class="l">% total atual</div></div>
        <div class="sem-card"><div class="v" style="color:#555;">${r.resumo.totalEsperado.toFixed(1)}%</div><div class="l">% total esperado</div></div>
        <div class="sem-card"><div class="v">${r.resumo.ppc}%</div><div class="l">PPC</div></div>
      </div>`;
    if(pend.length){
      html+=`<p style="font-size:.82rem;margin:8px 0;"><b>${pend.length} tarefa(s) abaixo do esperado</b> — informe o motivo (obrigatório) e detalhe se necessário:</p>`;
      html+=pend.map(i=>`
        <div style="border:1px solid #fecaca;background:#fef2f2;border-radius:8px;padding:10px;margin-bottom:8px;" data-just="${i.id}">
          <div style="font-size:.8rem;font-weight:700;margin-bottom:6px;">${_esc(i.nome)} <span style="color:#dc2626;">(${i.progresso}% de ${i.esperado}% esperado)</span></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <select class="form-control" style="flex:1;min-width:200px;font-size:.8rem;" data-motivo>
              <option value=""></option>${MOTIVOS.map(m=>`<option ${just[i.id]?.motivo===m?'selected':''}>${m}</option>`).join('')}
            </select>
            <input class="form-control" style="flex:2;min-width:200px;font-size:.8rem;" placeholder="Observação (opcional)" data-obs value="${_esc(just[i.id]?.detalhamento||'')}">
          </div>
        </div>`).join('');
    } else html+=`<p style="font-size:.85rem;color:#16a34a;">✅ Todas as tarefas dentro do esperado.</p>`;
    if(Object.keys(om).length){
      html+=`<p style="font-size:.82rem;margin:10px 0 4px;"><b>Omitidas do período</b> (já justificadas):</p>`+
        Object.entries(om).map(([id,o])=>{const t=_t(id);return `<div style="font-size:.78rem;color:#64748b;padding:3px 0;">🚫 ${_esc(t?.nome||id)} — <b>${_esc(o.motivo)}</b>${o.detalhamento?' · '+_esc(o.detalhamento):''}</div>`;}).join('');
    }
    document.getElementById('sem-fechar-body').innerHTML=html;
    Utils.abrirModal('modal-sem-fechar');
  }

  async function confirmarFechar(){
    const blocos=[...document.querySelectorAll('#sem-fechar-body [data-just]')];
    const just={};
    for(const b of blocos){
      const id=b.dataset.just;
      const motivo=b.querySelector('[data-motivo]').value;
      const obs=b.querySelector('[data-obs]').value.trim();
      if(!motivo&&!obs){Utils.toast('Toda tarefa abaixo do esperado precisa de motivo ou observação.','alerta');b.scrollIntoView?.({block:'center'});return;}
      just[id]={motivo,detalhamento:obs};
    }
    const r=_calcRelatorio();
    r.itens.forEach(i=>{if(just[i.id])i.justificativa=just[i.id];});
    await _saveDoc({status:'fechada',fechadaEm:_iso(_hoje()),justificativas:just,relatorio:r});
    Utils.fecharModal('modal-sem-fechar');
    _render();
    verRelatorio();
  }

  async function reabrir(){
    if(!Utils.confirmar('Reabrir o período fechado?'))return;
    await _saveDoc({status:'iniciada'});
    _render();
  }

  // ==================== VER RELATÓRIO ====================
  function _relatorioHTML(doc){
    const r=doc.relatorio;if(!r)return '<p>Sem relatório salvo.</p>';
    const om=doc.omitidas||{};
    return `
      <p style="font-size:.8rem;color:#64748b;margin-bottom:8px;">${_esc(doc.label||doc.id)} · ${_fmt(doc.inicio)} — ${_fmt(doc.fim)} · fechado em ${_fmt(doc.fechadaEm)}</p>
      <div class="sem-cards" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));">
        <div class="sem-card"><div class="v">${r.resumo.pctPeriodoReal.toFixed(1)}%</div><div class="l">% período real</div></div>
        <div class="sem-card"><div class="v" style="color:#555;">${r.resumo.pctPeriodoEsp.toFixed(1)}%</div><div class="l">% período esperado</div></div>
        <div class="sem-card"><div class="v" style="color:#2563eb;">${r.resumo.totalAtual.toFixed(1)}%</div><div class="l">% total atual</div></div>
        <div class="sem-card"><div class="v" style="color:#555;">${r.resumo.totalEsperado.toFixed(1)}%</div><div class="l">% total esperado</div></div>
        <div class="sem-card"><div class="v">${r.resumo.ppc}%</div><div class="l">PPC</div></div>
        <div class="sem-card"><div class="v">${r.resumo.omitidas}</div><div class="l">Omitidas</div></div>
      </div>
      <table class="sem-tbl" style="background:#fff;border:1px solid #e2e8f0;">
        <thead><tr><th>Tarefa</th><th class="col-centro">Esperado</th><th class="col-centro">Progresso</th><th class="col-centro">Avanço</th><th>Justificativa</th></tr></thead>
        <tbody>${(r.itens||[]).map(i=>`<tr>
          <td style="white-space:normal;">${_esc(i.nome)}</td>
          <td class="col-centro">${i.esperado}%</td>
          <td class="col-centro" style="color:${i.progresso>=i.esperado?'#16a34a':'#dc2626'};font-weight:700;">${i.progresso}%</td>
          <td class="col-centro">+${i.avanco}%</td>
          <td style="white-space:normal;font-size:.74rem;color:#64748b;">${i.justificativa?`<b>${_esc(i.justificativa.motivo||'')}</b>${i.justificativa.detalhamento?' · '+_esc(i.justificativa.detalhamento):''}`:'-'}</td>
        </tr>`).join('')}</tbody>
      </table>
      ${Object.keys(om).length?`<p style="font-size:.82rem;margin:10px 0 4px;"><b>Omitidas:</b></p>`+
        Object.entries(om).map(([id,o])=>`<div style="font-size:.78rem;color:#64748b;padding:2px 0;">🚫 ${_esc((r.itens||[]).find(x=>x.id===id)?.nome||_t(id)?.nome||id)} — <b>${_esc(o.motivo)}</b>${o.detalhamento?' · '+_esc(o.detalhamento):''}</div>`).join(''):''}`;
  }
  function verRelatorio(){
    document.getElementById('sem-rel-body').innerHTML=_relatorioHTML(semDoc);
    Utils.abrirModal('modal-sem-rel');
  }
  async function verRelatorioDoc(id){
    const doc=await Database.obter(obraId,COLS,id).catch(()=>null);
    if(!doc||!doc.relatorio){Utils.toast('Relatório não encontrado.','alerta');return;}
    document.getElementById('sem-rel-body').innerHTML=_relatorioHTML(doc);
    Utils.abrirModal('modal-sem-rel');
  }

  // ============================================================
  // DIÁRIO DE OBRA — lançamento rápido do que está sendo feito,
  // vinculado a tarefa do Planejamento (busca fuzzy hierárquica,
  // mesmo padrão de Materiais/Mão de Obra), com relatório do dia:
  // executado / não executado / deveria estar / porquês.
  // Coleção: obras/{id}/diario — um doc por lançamento:
  // {data:'YYYY-MM-DD', tarefaId, tarefaLabel, atividade, status,
  //  motivo, detalhe, createdAt}
  // ============================================================

  async function _loadDiario(){
    const iso=_iso(diaRef);
    try{
      const todos=await Database.listar(obraId,COLD,'createdAt').catch(()=>[]);
      lancamentosDia=todos.filter(l=>l.data===iso);
    }catch(e){console.error(e);lancamentosDia=[];}
  }

  // --- busca fuzzy de tarefa (mesmo padrão de mao-de-obra.js) ---
  function _dNorm(s){return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();}
  function _dLev(a,b){
    const m=a.length,n=b.length;if(!m)return n;if(!n)return m;
    const d=Array.from({length:m+1},(_,i)=>[i,...Array(n).fill(0)]);
    for(let j=0;j<=n;j++)d[0][j]=j;
    for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)
      d[i][j]=a[i-1]===b[j-1]?d[i-1][j-1]:1+Math.min(d[i-1][j],d[i][j-1],d[i-1][j-1]);
    return d[m][n];
  }
  function _dScore(t,q){
    if(!q)return 1;
    if(t===q)return 100;if(t.startsWith(q))return 90;if(t.includes(q))return 80;
    const pq=q.split(/\s+/).filter(Boolean),pn=t.split(/\s+/).filter(Boolean);
    if(pq.every(x=>pn.some(n=>n.includes(x))))return 70;
    const dist=_dLev(t,q),tol=Math.max(2,Math.floor(q.length*0.35));
    if(dist<=tol)return 60-dist;
    if(pq.some(x=>pn.some(n=>_dLev(n,x)<=Math.max(1,Math.floor(x.length*0.3)))))return 40;
    return -1;
  }
  function _dOpcoesTarefa(){return Utils.opcoesTarefaHierarquia(tarefas);}
  function _dBuscarOpts(texto){
    const opts=_dOpcoesTarefa(),q=_dNorm(texto);
    if(!q)return opts;
    return opts.map(o=>({o,score:_dScore(_dNorm(o.label),q)}))
      .filter(x=>x.score>=0).sort((a,b)=>b.score-a.score).map(x=>x.o);
  }

  // --- UI da aba ---
  const D_STATUS={
    executado:   {label:'✅ Executado',     cor:'#16a34a', bg:'#dcfce7'},
    parcial:     {label:'◐ Parcial',        cor:'#ca8a04', bg:'#fef9c3'},
    nao_executado:{label:'✖ Não executado', cor:'#dc2626', bg:'#fee2e2'},
  };

  function _diarioHTML(){
    const iso=_iso(diaRef);
    const hojeIso=_iso(_hoje());
    const precisaMotivo=_diaStatus!=='executado';
    const tarSel=_diaTarSel?tarefas.find(t=>t.id===_diaTarSel):null;
    const opts=_dBuscarOpts(_diaBusca).slice(0,60);

    // Lançamentos do dia agrupados por status
    const porStatus={executado:[],parcial:[],nao_executado:[]};
    lancamentosDia.forEach(l=>{(porStatus[l.status]||porStatus.executado).push(l);});

    return `
    <style>
      .dia-form{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:14px;}
      .dia-form label{font-size:.72rem;color:#64748b;font-weight:700;text-transform:uppercase;display:block;margin-bottom:3px;}
      .dia-form input[type=text],.dia-form select,.dia-form textarea{width:100%;padding:7px 9px;border:1px solid #cbd5e1;border-radius:7px;font-size:.85rem;box-sizing:border-box;}
      .dia-res{max-height:230px;overflow:auto;border:1px solid #e2e8f0;border-radius:8px;margin-top:4px;background:#fff;position:relative;z-index:20;}
      .dia-res div{padding:6px 10px;cursor:pointer;font-size:.8rem;border-bottom:1px solid #f8fafc;white-space:pre;}
      .dia-res div:hover{background:#fefce8;}
      .dia-st{display:flex;gap:6px;}
      .dia-st button{flex:1;border:1.5px solid #cbd5e1;background:#fff;border-radius:8px;padding:8px 4px;cursor:pointer;font-size:.78rem;font-weight:700;color:#64748b;}
      .dia-lanc{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:10px 14px;margin-bottom:8px;display:flex;gap:10px;align-items:flex-start;}
      .dia-lanc .tag{padding:2px 8px;border-radius:6px;font-size:.68rem;font-weight:800;white-space:nowrap;flex-shrink:0;}
      .dia-sec-t{font-size:.85rem;font-weight:800;margin:14px 0 8px;display:flex;align-items:center;gap:8px;}
    </style>
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
      <div class="sem-nav">
        <button onclick="Semanal.diarioNav(-1)">‹</button>
        <span class="lbl">${DIAS[diaRef.getDay()]}, ${_fmt(iso)}${iso===hojeIso?' (hoje)':''}</span>
        <button onclick="Semanal.diarioNav(1)">›</button>
        <button onclick="Semanal.diarioHoje()" title="Ir para hoje" style="border-left:1px solid #334155;">●</button>
      </div>
      <input type="date" value="${iso}" onchange="Semanal.diarioSetData(this.value)" style="padding:7px 9px;border:1px solid #cbd5e1;border-radius:8px;font-size:.82rem;">
      <div style="flex:1;"></div>
      <button class="btn btn-sm" style="background:#0f172a;color:#fff;" onclick="Semanal.gerarRelatorioDiario()">📄 Relatório do dia</button>
    </div>

    <div class="dia-form">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div style="position:relative;">
          <label>Tarefa vinculada (busque por código ou nome)</label>
          <input type="text" id="dia-busca" value="${_esc(_diaBusca)}" placeholder="Ex: alvenaria 3 pav, 1.3.1..." oninput="Semanal.onBuscaDiario(this.value)" autocomplete="off">
          ${tarSel?`<div style="margin-top:5px;font-size:.78rem;color:#16a34a;font-weight:700;">✓ ${_esc((tarSel.codigo?tarSel.codigo+' ':'')+tarSel.nome)}</div>`:''}
          ${_diaBusca&&!tarSel?`<div class="dia-res">${opts.length?opts.map(o=>
            `<div onclick="Semanal.selTarefaDiario('${o.id}')">${_esc(o.label)}</div>`).join(''):
            '<div style="color:#94a3b8;cursor:default;">Nenhuma tarefa encontrada</div>'}</div>`:''}
        </div>
        <div>
          <label>O que está sendo feito</label>
          <input type="text" id="dia-atividade" placeholder="Ex: Elevação de alvenaria eixo A-B, 2 pedreiros" autocomplete="off">
          <div style="margin-top:10px;">
            <label>Situação</label>
            <div class="dia-st">
              ${Object.entries(D_STATUS).map(([k,v])=>`<button onclick="Semanal.setStatusDiario('${k}')" style="${_diaStatus===k?`background:${v.bg};border-color:${v.cor};color:${v.cor};`:''}">${v.label}</button>`).join('')}
            </div>
          </div>
        </div>
      </div>
      ${precisaMotivo?`
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px;">
        <div>
          <label>Motivo (por quê?)</label>
          <select id="dia-motivo">${MOTIVOS.map(m=>`<option value="${_esc(m)}">${_esc(m)}</option>`).join('')}</select>
        </div>
        <div>
          <label>Detalhe (opcional)</label>
          <input type="text" id="dia-detalhe" placeholder="Complemento do motivo" autocomplete="off">
        </div>
      </div>`:''}
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px;">
        ${_diaEditId?`<button class="btn btn-sm btn-outline" onclick="Semanal.cancelarEdicaoDiario()">Cancelar edição</button>`:''}
        <button class="btn btn-sm btn-primario" onclick="Semanal.salvarLancamento()">${_diaEditId?'💾 Salvar alteração':'＋ Lançar'}</button>
      </div>
    </div>

    ${!lancamentosDia.length?`<div style="text-align:center;color:#94a3b8;padding:26px;font-size:.85rem;">Nenhum lançamento neste dia ainda.</div>`:
      Object.entries(D_STATUS).map(([k,v])=>{
        const ls=porStatus[k];if(!ls.length)return'';
        return `<div class="dia-sec-t" style="color:${v.cor};">${v.label} <span style="color:#94a3b8;font-weight:600;">(${ls.length})</span></div>`+
          ls.map(l=>`<div class="dia-lanc">
            <span class="tag" style="background:${v.bg};color:${v.cor};">${v.label}</span>
            <div style="flex:1;min-width:0;">
              <div style="font-size:.82rem;font-weight:700;">${_esc(l.tarefaLabel||'(tarefa)')}</div>
              <div style="font-size:.8rem;color:#334155;">${_esc(l.atividade||'')}</div>
              ${l.motivo?`<div style="font-size:.75rem;color:#dc2626;margin-top:2px;">Motivo: ${_esc(l.motivo)}${l.detalhe?' — '+_esc(l.detalhe):''}</div>`:''}
            </div>
            <button class="btn-icone" title="Editar" onclick="Semanal.editarLancamento('${l.id}')">✏️</button>
            <button class="btn-icone" title="Excluir" onclick="Semanal.excluirLancamento('${l.id}')">🗑️</button>
          </div>`).join('');
      }).join('')}`;
  }

  // --- handlers ---
  async function diarioNav(dir){diaRef=_addD(diaRef,dir);await _loadDiario();_render();}
  async function diarioHoje(){diaRef=_hoje();await _loadDiario();_render();}
  async function diarioSetData(v){const d=_d(v);if(!d)return;diaRef=d;await _loadDiario();_render();}
  function onBuscaDiario(v){_diaBusca=v;_diaTarSel='';_render();
    // devolve o foco ao campo depois do re-render (para digitação contínua)
    requestAnimationFrame(()=>{const i=document.getElementById('dia-busca');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length);}});}
  function selTarefaDiario(id){
    _diaTarSel=id;
    const t=tarefas.find(x=>x.id===id);
    _diaBusca=t?((t.codigo?t.codigo+' ':'')+(t.nome||'')):'';
    _render();
    requestAnimationFrame(()=>{const i=document.getElementById('dia-atividade');if(i)i.focus();});
  }
  function setStatusDiario(s){
    // preserva o texto digitado da atividade antes do re-render
    const at=document.getElementById('dia-atividade');
    if(at)_diaAtividadeTmp=at.value;
    _diaStatus=s;_render();
    requestAnimationFrame(()=>{const i=document.getElementById('dia-atividade');if(i&&_diaAtividadeTmp)i.value=_diaAtividadeTmp;});
  }
  let _diaAtividadeTmp='';

  async function salvarLancamento(){
    if(!_diaTarSel){Utils.toast('Selecione a tarefa vinculada.','alerta');return;}
    const atividade=(document.getElementById('dia-atividade')?.value||'').trim();
    if(!atividade){Utils.toast('Descreva o que está sendo feito.','alerta');return;}
    const t=tarefas.find(x=>x.id===_diaTarSel);
    const dados={
      data:_iso(diaRef),
      tarefaId:_diaTarSel,
      tarefaLabel:t?((t.codigo?t.codigo+' ':'')+(t.nome||'')):'',
      atividade,
      status:_diaStatus,
      motivo:_diaStatus!=='executado'?(document.getElementById('dia-motivo')?.value||''):'',
      detalhe:_diaStatus!=='executado'?(document.getElementById('dia-detalhe')?.value||'').trim():'',
      obraId,
    };
    try{
      Utils.mostrarLoading('Salvando...');
      if(_diaEditId)await Database.atualizar(obraId,COLD,_diaEditId,dados);
      else await Database.criar(obraId,COLD,{...dados,createdAt:new Date().toISOString()});
      _diaEditId=null;_diaBusca='';_diaTarSel='';_diaStatus='executado';_diaAtividadeTmp='';
      await _loadDiario();_render();
      Utils.toast('Lançamento salvo!','sucesso');
      requestAnimationFrame(()=>{const i=document.getElementById('dia-busca');if(i)i.focus();});
    }catch(e){console.error(e);Utils.toast('Erro ao salvar.','erro');}
    finally{Utils.esconderLoading();}
  }

  function editarLancamento(id){
    const l=lancamentosDia.find(x=>x.id===id);if(!l)return;
    _diaEditId=id;_diaTarSel=l.tarefaId;_diaBusca=l.tarefaLabel||'';_diaStatus=l.status||'executado';
    _render();
    requestAnimationFrame(()=>{
      const a=document.getElementById('dia-atividade');if(a)a.value=l.atividade||'';
      const m=document.getElementById('dia-motivo');if(m&&l.motivo)m.value=l.motivo;
      const d=document.getElementById('dia-detalhe');if(d)d.value=l.detalhe||'';
    });
  }
  function cancelarEdicaoDiario(){_diaEditId=null;_diaBusca='';_diaTarSel='';_diaStatus='executado';_render();}

  async function excluirLancamento(id){
    if(!confirm('Excluir este lançamento?'))return;
    try{await Database.deletar(obraId,COLD,id);await _loadDiario();_render();Utils.toast('Excluído.','sucesso');}
    catch(e){console.error(e);Utils.toast('Erro ao excluir.','erro');}
  }

  // --- relatório do dia ---
  function gerarRelatorioDiario(){
    const iso=_iso(diaRef);
    const dia=diaRef;
    // Tarefas-folha que DEVERIAM estar em execução neste dia
    const deveriam=sorted.filter(t=>{
      if(!leafSet.has(t.id))return false;
      if((t.percentualConcluido||0)>=100)return false;
      const i=_d(t.inicioPlanejado),f=_d(t.terminoPlanejado);
      return i&&f&&dia>=i&&dia<=f;
    });
    const comLanc=new Set(lancamentosDia.map(l=>l.tarefaId));
    const semLanc=deveriam.filter(t=>!comLanc.has(t.id));
    const exec=lancamentosDia.filter(l=>l.status==='executado');
    const parc=lancamentosDia.filter(l=>l.status==='parcial');
    const nao=lancamentosDia.filter(l=>l.status==='nao_executado');
    const porques=lancamentosDia.filter(l=>l.motivo);

    const bloco=(titulo,cor,itens,vazio)=>`
      <div style="margin-bottom:16px;">
        <div style="font-weight:800;font-size:.9rem;color:${cor};border-bottom:2px solid ${cor};padding-bottom:4px;margin-bottom:8px;">${titulo} (${itens.length})</div>
        ${itens.length?itens.join(''):`<div style="color:#94a3b8;font-size:.8rem;">${vazio}</div>`}
      </div>`;
    const li=l=>`<div style="padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:.82rem;">
      <b>${_esc(l.tarefaLabel||'')}</b> — ${_esc(l.atividade||'')}
      ${l.motivo?`<div style="color:#dc2626;font-size:.76rem;">Motivo: ${_esc(l.motivo)}${l.detalhe?' — '+_esc(l.detalhe):''}</div>`:''}
    </div>`;
    const liT=t=>`<div style="padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:.82rem;">
      <b>${_esc((t.codigo?t.codigo+' ':'')+t.nome)}</b>
      <span style="color:#64748b;font-size:.76rem;"> · ${_fmt(t.inicioPlanejado)} → ${_fmt(t.terminoPlanejado)} · ${t.percentualConcluido||0}% concluído</span>
    </div>`;

    const html=`
    <div id="dia-rel-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:1000;display:flex;align-items:flex-start;justify-content:center;padding:30px 16px;overflow:auto;" onclick="if(event.target===this)this.remove()">
      <div style="background:#fff;border-radius:12px;max-width:860px;width:100%;padding:24px;" id="dia-rel-print">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <h2 style="margin:0;font-size:1.1rem;">Diário de Obra — ${DIAS[dia.getDay()]}, ${_fmt(iso)}</h2>
          <div style="display:flex;gap:8px;" class="no-print">
            <button class="btn btn-sm btn-outline" onclick="Semanal.imprimirRelatorioDiario()">🖨️ Imprimir</button>
            <button class="btn btn-sm btn-outline" onclick="document.getElementById('dia-rel-overlay').remove()">✕ Fechar</button>
          </div>
        </div>
        <div style="font-size:.78rem;color:#64748b;margin-bottom:16px;">${lancamentosDia.length} lançamento(s) · ${deveriam.length} tarefa(s) previstas para o dia no Planejamento</div>
        ${bloco('✅ Executado','#16a34a',exec.map(li),'Nenhum lançamento como executado.')}
        ${bloco('◐ Parcial','#ca8a04',parc.map(li),'Nenhum lançamento parcial.')}
        ${bloco('✖ Não executado','#dc2626',nao.map(li),'Nenhum lançamento como não executado.')}
        ${bloco('⚠️ Deveria estar em execução (sem lançamento)','#7c3aed',semLanc.map(liT),'Tudo que estava previsto tem lançamento. 👏')}
        ${bloco('📋 Porquês do dia','#0f172a',porques.map(l=>`<div style="padding:5px 0;border-bottom:1px solid #f1f5f9;font-size:.8rem;"><b>${_esc(l.motivo)}</b>${l.detalhe?' — '+_esc(l.detalhe):''} <span style="color:#64748b;">(${_esc(l.tarefaLabel||'')})</span></div>`),'Nenhum motivo registrado hoje.')}
      </div>
    </div>`;
    const div=document.createElement('div');div.innerHTML=html;
    document.body.appendChild(div.firstElementChild);
  }

  function imprimirRelatorioDiario(){
    const rel=document.getElementById('dia-rel-print');if(!rel)return;
    const w=window.open('','_blank');
    w.document.write('<html><head><title>Diário de Obra</title><style>body{font-family:system-ui,Arial;padding:20px;}.no-print{display:none;}</style></head><body>'+rel.innerHTML+'</body></html>');
    w.document.close();w.focus();
    setTimeout(()=>{w.print();},300);
  }

  return{init,carregar,nav,hojeBtn,setModo,setVista,setOrdem,setAba,toggleSel,limparSel,
    editarProgresso,editarInicio,editarData,editarResp,selDatas,selResp,
    abrirOmitir,abrirOmitirSel,salvarOmitir,restaurar,
    abrirAdicionar,filtrarAdicionar,confirmarAdicionar,
    iniciar,resetar,abrirFechar,confirmarFechar,reabrir,
    verRelatorio,verRelatorioDoc,carregarHistorico,
    diarioNav,diarioHoje,diarioSetData,onBuscaDiario,selTarefaDiario,setStatusDiario,
    salvarLancamento,editarLancamento,cancelarEdicaoDiario,excluirLancamento,
    gerarRelatorioDiario,imprimirRelatorioDiario};
})();

function onObraChanged(){ Semanal.init(); }

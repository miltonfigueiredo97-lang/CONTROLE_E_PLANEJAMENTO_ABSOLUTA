// ============================================
// Módulo: Planejamento — V1.0
// Cronograma: Gantt, Linha de Balanço, Escadinha, Tabela
// Entidade central: TAREFA (uid único)
// Integra com: Levantamento (quantidades), Controle (% executado)
// ============================================
const Planejamento = (() => {
  let obraId=null, tarefas=[], etapas=[], pacotes=[], locais=[], equipes=[];
  let abaAtiva='gantt', zoomGantt='mes', editandoId=null;
  let filtros={etapa:'',status:'',busca:''};
  const COL='tarefas';

  async function init(){
    const ok=await Utils.initPagina({requireObra:true});if(!ok)return;
    obraId=Router.getObraId();
    if(!obraId){
      const c=document.getElementById('planejamento-content');
      if(c) c.innerHTML='<div class="estado-vazio"><div class="icone">🏗️</div><p>Selecione uma obra na barra lateral.</p></div>';
      return;
    }
    document.addEventListener('keydown',e=>{if(e.key==='Escape')Utils.fecharTodosModais();});
    await carregar();
  }

  async function carregar(){
    try{
      Utils.mostrarLoading('Carregando planejamento...');
      [tarefas,etapas,pacotes,locais,equipes]=await Promise.all([
        Database.listar(obraId,COL,'ordem').catch(()=>[]),
        Database.listar(obraId,'etapas','nome').catch(()=>[]),
        Database.listar(obraId,'pacotes','nome').catch(()=>[]),
        Database.listar(obraId,'locais','ordem').catch(()=>[]),
        Database.listar(obraId,'equipes','nome').catch(()=>[])
      ]);
      renderizar();
    }catch(e){console.error(e);Utils.toast('Erro ao carregar.','erro');}
    finally{Utils.esconderLoading();}
  }

  function renderizar(){
    const c=document.getElementById('planejamento-content');if(!c)return;
    const abas=[
      {id:'gantt',icon:'📊',label:'Gantt'},
      {id:'linha_balanco',icon:'📈',label:'Linha de Balanço'},
      {id:'escadinha',icon:'🔲',label:'Escadinha'},
      {id:'tabela',icon:'📋',label:'Tabela'}
    ];
    const cabecalho=`<div class="plan-header">
      <div class="plan-abas">
        ${abas.map(a=>`<button class="plan-aba${abaAtiva===a.id?' ativo':''}" onclick="Planejamento.setAba('${a.id}')">${a.icon} ${a.label}</button>`).join('')}
      </div>
      <div class="plan-actions">
        <button class="btn btn-secundario btn-sm" onclick="Planejamento.importarExcel()">📥 Importar</button>
        <button class="btn btn-secundario btn-sm" onclick="Planejamento.exportar()">📤 Exportar</button>
        <button class="btn btn-primario btn-sm" onclick="Planejamento.novaTarefa()">+ Tarefa</button>
      </div>
    </div>
    <div class="plan-filtros">
      <select id="filtro-etapa" class="form-control" style="width:160px" onchange="Planejamento.aplicarFiltro()">
        <option value="">Todas as etapas</option>
        ${etapas.map(e=>`<option value="${e.id}">${e.nome}</option>`).join('')}
      </select>
      <select id="filtro-status" class="form-control" style="width:160px" onchange="Planejamento.aplicarFiltro()">
        <option value="">Todos status</option>
        <option value="nao_iniciado">Não iniciado</option>
        <option value="em_andamento">Em andamento</option>
        <option value="concluido">Concluído</option>
        <option value="atrasado">Atrasado</option>
      </select>
      <input id="filtro-busca" class="form-control" style="width:200px" placeholder="🔍 Buscar..." oninput="Planejamento.aplicarFiltro()">
    </div>`;
    const corpos={gantt:_renderGantt,linha_balanco:_renderLinhaBalanco,escadinha:_renderEscadinha,tabela:_renderTabela};
    c.innerHTML=cabecalho+`<div class="plan-corpo">${(corpos[abaAtiva]||_renderGantt)()}</div>`;
  }

  // --- GANTT ---
  function _renderGantt(){
    const tf=_filtradas();
    if(!tf.length) return `<div class="estado-vazio"><div class="icone">📅</div>
      <p>Nenhuma tarefa. Crie tarefas ou importe do Excel.</p>
      <button class="btn btn-primario" onclick="Planejamento.novaTarefa()">+ Criar primeira tarefa</button></div>`;

    const hoje=new Date();
    const datas=tf.flatMap(t=>[t.inicioPlanejado,t.terminoPlanejado].filter(Boolean).map(d=>new Date(d)));
    const dMin=datas.length?new Date(Math.min(...datas)):new Date(hoje.getTime()-7*864e5);
    const dMax=datas.length?new Date(Math.max(...datas)):new Date(hoje.getTime()+37*864e5);
    dMin.setDate(dMin.getDate()-5); dMax.setDate(dMax.getDate()+10);

    const lpd={dia:40,semana:20,mes:8,trimestre:4,ano:2}[zoomGantt]||8;
    const totalDias=Math.ceil((dMax-dMin)/864e5);
    const W=totalDias*lpd;
    const ROW=38;

    // Header datas
    const meses=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    let hDatas='';
    let d=new Date(dMin);
    let lastM=-1;
    while(d<=dMax){
      const x=(d-dMin)/864e5*lpd;
      if(d.getMonth()!==lastM){
        hDatas+=`<div style="position:absolute;left:${x}px;top:2px;font-size:0.7rem;color:#aaa;white-space:nowrap;">${meses[d.getMonth()]}/${d.getFullYear()}</div>`;
        lastM=d.getMonth();
      }
      d.setDate(d.getDate()+1);
    }

    const hojeX=(hoje-dMin)/864e5*lpd;

    // Rows + barras
    let linhas='',barras='';
    tf.forEach((t,i)=>{
      const st=_status(t);
      const perc=_perc(t);
      const cor={nao_iniciado:'#555',em_andamento:'#2563eb',concluido:'#16a34a',atrasado:'#dc2626',marco:'#7c3aed'}[st]||'#555';
      const ind=(t.nivel||0)*16;
      const y=i*ROW;

      linhas+=`<div class="gantt-row${t.tipo==='grupo'?' gantt-grupo':''}" style="height:${ROW}px">
        <div class="gr-st"><span class="status-dot ${st}"></span></div>
        <div class="gr-cod" title="${t.codigo||''}">${t.codigo||''}</div>
        <div class="gr-nome" style="padding-left:${ind+6}px" title="${t.nome}">${t.nome}</div>
        <div class="gr-dt">${_fd(t.inicioPlanejado)}</div>
        <div class="gr-dt">${_fd(t.terminoPlanejado)}</div>
        <div class="gr-num">${t.duracao||'—'}</div>
        <div class="gr-num">${perc}%</div>
        <div class="gr-act">
          <button class="btn btn-sm btn-icon" onclick="Planejamento.editarTarefa('${t.id}')">✎</button>
          <button class="btn btn-sm btn-icon btn-perigo" onclick="Planejamento.excluirTarefa('${t.id}')">✕</button>
        </div>
      </div>`;

      // Grid bg
      barras+=`<div style="position:absolute;left:0;top:${y}px;width:${W}px;height:${ROW}px;background:${i%2?'rgba(255,255,255,0.02)':'transparent'};border-bottom:1px solid rgba(255,255,255,0.04)"></div>`;

      if(t.inicioPlanejado&&t.terminoPlanejado){
        const x=(new Date(t.inicioPlanejado)-dMin)/864e5*lpd;
        const w=Math.max(lpd,(new Date(t.terminoPlanejado)-new Date(t.inicioPlanejado))/864e5*lpd);
        const by=y+6;
        if(t.tipo==='marco'){
          barras+=`<div style="position:absolute;left:${x}px;top:${by+4}px;color:#7c3aed;font-size:1.1rem;">◆</div>`;
        } else {
          barras+=`<div class="gantt-barra" style="left:${x}px;top:${by}px;width:${w}px;background:${cor}" title="${t.nome} — ${perc}%">
            <div style="width:${perc}%;height:100%;background:rgba(255,255,255,0.3);border-radius:3px 0 0 3px"></div>
            ${w>80?`<span class="gantt-blabel">${t.nome}</span>`:''}
          </div>`;
        }
      }
    });

    return `<div class="gantt-zoom-bar">
      ${['dia','semana','mes','trimestre','ano'].map(z=>`<button class="btn btn-sm${zoomGantt===z?' btn-dark':' btn-secundario'}" onclick="Planejamento.setZoom('${z}')">${z.charAt(0).toUpperCase()+z.slice(1)}</button>`).join('')}
    </div>
    <div class="gantt-wrap">
      <div class="gantt-left">
        <div class="gantt-left-header">
          <div class="gr-st"></div><div class="gr-cod">Cód</div><div class="gr-nome">Tarefa</div>
          <div class="gr-dt">Início</div><div class="gr-dt">Fim</div><div class="gr-num">Dur</div>
          <div class="gr-num">%</div><div class="gr-act">Ações</div>
        </div>
        ${linhas}
      </div>
      <div class="gantt-right" id="gantt-scroll">
        <div style="width:${W}px;position:relative;">
          <div style="position:relative;height:26px;border-bottom:1px solid rgba(255,255,255,0.1);">${hDatas}</div>
          <div style="position:relative;height:${tf.length*ROW}px;">
            ${barras}
            <div class="gantt-hoje-line" style="left:${hojeX}px;height:${tf.length*ROW}px"></div>
          </div>
        </div>
      </div>
    </div>`;
  }

  // --- LINHA DE BALANÇO ---
  function _renderLinhaBalanco(){
    const tf=_filtradas().filter(t=>t.tipo==='tarefa'&&t.local&&t.inicioPlanejado&&t.terminoPlanejado);
    if(!tf.length) return `<div class="estado-vazio"><div class="icone">📈</div>
      <p>Cadastre tarefas com local e datas para ver a Linha de Balanço.</p></div>`;

    const locsU=[...new Set(tf.map(t=>t.local))];
    const pacsU=[...new Set(tf.map(t=>t.pacote||t.etapa||'Serviço'))];
    const cores=['#F5C800','#2563eb','#16a34a','#dc2626','#d97706','#7c3aed','#0891b2'];
    const meses=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const todas_datas=tf.flatMap(t=>[t.inicioPlanejado,t.terminoPlanejado].map(d=>new Date(d)));
    const dMin=new Date(Math.min(...todas_datas)); dMin.setDate(1);
    const dMax=new Date(Math.max(...todas_datas)); dMax.setDate(dMax.getDate()+20);
    const totalD=Math.ceil((dMax-dMin)/864e5);
    const esc=700/totalD;
    const padX=130,padY=50,lH=36;
    const svgH=padY+locsU.length*lH+30;
    const svgW=padX+720;
    let svg=`<svg width="${svgW}" height="${svgH}" font-family="Inter,sans-serif">`;
    locsU.forEach((loc,i)=>{
      const y=padY+i*lH;
      svg+=`<line x1="${padX}" y1="${y}" x2="${svgW-10}" y2="${y}" stroke="#333" stroke-width="1"/>`;
      svg+=`<text x="${padX-6}" y="${y+lH/2}" text-anchor="end" font-size="11" fill="#888">${loc}</text>`;
    });
    let dd=new Date(dMin);
    while(dd<=dMax){
      if(dd.getDate()===1){
        const x=padX+(dd-dMin)/864e5*esc;
        svg+=`<line x1="${x}" y1="${padY}" x2="${x}" y2="${svgH-20}" stroke="#333" stroke-dasharray="3,4"/>`;
        svg+=`<text x="${x}" y="${padY-6}" text-anchor="middle" font-size="10" fill="#666">${meses[dd.getMonth()]}/${dd.getFullYear()}</text>`;
      }
      dd.setDate(dd.getDate()+1);
    }
    const hx=padX+(new Date()-dMin)/864e5*esc;
    svg+=`<line x1="${hx}" y1="${padY-15}" x2="${hx}" y2="${svgH-10}" stroke="#F5C800" stroke-width="2"/>`;
    svg+=`<text x="${hx}" y="${padY-17}" text-anchor="middle" font-size="9" fill="#F5C800" font-weight="bold">Hoje</text>`;
    pacsU.forEach((pac,pi)=>{
      const cor=cores[pi%cores.length];
      const pts=tf.filter(t=>(t.pacote||t.etapa||'Serviço')===pac).map(t=>{
        const li=locsU.indexOf(t.local);
        const x1=padX+(new Date(t.inicioPlanejado)-dMin)/864e5*esc;
        const x2=padX+(new Date(t.terminoPlanejado)-dMin)/864e5*esc;
        return {x1,x2,y:padY+li*lH+lH/2};
      }).sort((a,b)=>a.y-b.y);
      if(pts.length<2)return;
      const path=pts.map((p,i)=>`${i===0?'M':'L'}${p.x1},${p.y} L${p.x2},${p.y}`).join(' ');
      svg+=`<path d="${path}" fill="none" stroke="${cor}" stroke-width="2.5"/>`;
      pts.forEach(p=>{svg+=`<circle cx="${p.x1}" cy="${p.y}" r="4" fill="${cor}"/><circle cx="${p.x2}" cy="${p.y}" r="4" fill="${cor}"/>`;});
    });
    svg+='</svg>';
    const leg=pacsU.map((p,i)=>`<span style="display:inline-flex;align-items:center;gap:5px;font-size:0.78rem;margin-right:12px;"><span style="display:inline-block;width:18px;height:3px;background:${cores[i%cores.length]};border-radius:2px;"></span>${p}</span>`).join('');
    return `<div style="margin-bottom:10px;">${leg}</div><div style="overflow:auto;">${svg}</div>`;
  }

  // --- ESCADINHA ---
  function _renderEscadinha(){
    const locsOrdem=[...locais].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    if(!locsOrdem.length||!pacotes.length) return `<div class="estado-vazio"><div class="icone">🔲</div>
      <p>Configure locais e pacotes em Configuração da Obra.</p></div>`;
    const corSt={nao_iniciado:'#2a2a2a',em_andamento:'#1d4ed8',concluido:'#15803d',atrasado:'#dc2626'};
    const icSt={nao_iniciado:'—',em_andamento:'▶',concluido:'✓',atrasado:'⚠'};
    const hdr=`<tr><th style="min-width:120px">Local</th>${pacotes.map(p=>`<th style="min-width:80px;font-size:0.7rem;">${p.nome}</th>`).join('')}</tr>`;
    const rows=locsOrdem.map(loc=>{
      const cells=pacotes.map(pac=>{
        const tf=tarefas.find(t=>t.local===loc.nome&&(t.pacoteId===pac.id||t.pacote===pac.nome));
        const st=tf?_status(tf):'nao_iniciado';
        const perc=tf?_perc(tf):0;
        return `<td style="background:${corSt[st]};color:${st==='nao_iniciado'?'#555':'#fff'};text-align:center;font-size:1rem;border:1px solid #111;padding:8px 4px;">
          <div>${icSt[st]}</div><div style="font-size:0.65rem;opacity:0.8;">${perc}%</div></td>`;
      }).join('');
      return `<tr><td style="font-size:0.8rem;padding:6px 10px;color:#ccc;white-space:nowrap;">${loc.nome}</td>${cells}</tr>`;
    }).join('');
    const leg=Object.entries({nao_iniciado:'Não iniciado',em_andamento:'Em andamento',concluido:'Concluído',atrasado:'Atrasado'}).map(([k,v])=>
      `<span style="display:inline-flex;align-items:center;gap:5px;font-size:0.78rem;margin-right:12px;"><span style="display:inline-block;width:12px;height:12px;background:${corSt[k]};border-radius:2px;border:1px solid #333;"></span>${v}</span>`).join('');
    return `<div style="margin-bottom:10px;">${leg}</div><div class="tabela-container"><table class="tabela" style="border-collapse:collapse;"><thead>${hdr}</thead><tbody>${rows}</tbody></table></div>`;
  }

  // --- TABELA ---
  function _renderTabela(){
    const tf=_filtradas();
    if(!tf.length) return `<div class="estado-vazio"><div class="icone">📋</div><p>Nenhuma tarefa.</p>
      <button class="btn btn-primario" onclick="Planejamento.novaTarefa()">+ Tarefa</button></div>`;
    const rows=tf.map(t=>{
      const st=_status(t);const perc=_perc(t);const pprev=_percPrev(t);
      return `<tr>
        <td class="col-centro"><span class="status-dot ${st}"></span></td>
        <td>${t.codigo||'—'}</td>
        <td style="padding-left:${((t.nivel||0)*14)+6}px"><strong>${t.nome}</strong></td>
        <td class="col-num">${_fd(t.inicioPlanejado)}</td>
        <td class="col-num">${_fd(t.terminoPlanejado)}</td>
        <td class="col-num">${t.duracao||'—'}</td>
        <td class="col-num"><strong>${perc}%</strong></td>
        <td class="col-num">${pprev}%</td>
        <td>${t.responsavel||'—'}</td>
        <td class="col-acoes">
          <button class="btn btn-sm btn-icon" onclick="Planejamento.editarTarefa('${t.id}')">✎</button>
          <button class="btn btn-sm btn-icon btn-perigo" onclick="Planejamento.excluirTarefa('${t.id}')">✕</button>
        </td>
      </tr>`;
    }).join('');
    return `<div class="tabela-container"><table class="tabela tabela-compacta">
      <thead><tr><th></th><th>Cód</th><th>Tarefa</th><th class="col-num">Início</th><th class="col-num">Fim</th>
        <th class="col-num">Dur</th><th class="col-num">% Exec</th><th class="col-num">% Prev</th>
        <th>Responsável</th><th class="col-acoes">Ações</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
  }

  // --- CRUD ---
  function novaTarefa(parentId){
    editandoId=null;
    document.getElementById('modal-tarefa-titulo').textContent='Nova Tarefa';
    Utils.limparForm('form-tarefa');
    _popSelects();
    if(parentId){const el=document.querySelector('#form-tarefa [name="parentId"]');if(el)el.value=parentId;}
    Utils.abrirModal('modal-tarefa');
  }

  function editarTarefa(id){
    const t=tarefas.find(x=>x.id===id);if(!t)return;
    editandoId=id;
    document.getElementById('modal-tarefa-titulo').textContent='Editar Tarefa';
    _popSelects();Utils.setFormData('form-tarefa',t);Utils.abrirModal('modal-tarefa');
  }

  function _popSelects(){
    const sel=(id,lista,vId,vLbl,vazio)=>{const e=document.getElementById(id);if(!e)return;e.innerHTML=`<option value="">${vazio}</option>`+lista.map(i=>`<option value="${i[vId]||i.id}">${i[vLbl||'nome']}</option>`).join('');};
    sel('st-etapa',etapas,'id','nome','— Etapa —');
    sel('st-pacote',pacotes,'id','nome','— Pacote —');
    sel('st-local',locais,'nome','nome','— Local —');
    sel('st-equipe',equipes,'id','nome','— Equipe —');
    const sp=document.getElementById('st-pred');if(sp)sp.innerHTML='<option value="">— Sem predecessora —</option>'+tarefas.filter(t=>t.id!==editandoId).map(t=>`<option value="${t.id}">${t.codigo||''} ${t.nome}</option>`).join('');
  }

  async function salvarTarefa(){
    const data=Utils.getFormData('form-tarefa');
    if(!data.nome){Utils.toast('Informe o nome.','alerta');return;}
    data.obraId=obraId;
    data.ordem=Utils.parseNum(data.ordem)||tarefas.length+1;
    if(data.inicioPlanejado&&data.terminoPlanejado){
      data.duracao=Math.max(0,Math.ceil((new Date(data.terminoPlanejado)-new Date(data.inicioPlanejado))/864e5));
    }
    try{
      if(editandoId){await Database.atualizar(obraId,COL,editandoId,data);}
      else{await Database.criar(obraId,COL,data);}
      Utils.fecharModal('modal-tarefa');Utils.toast('Salvo!','sucesso');editandoId=null;await carregar();
    }catch(e){console.error(e);Utils.toast('Erro.','erro');}
  }

  async function excluirTarefa(id){
    const t=tarefas.find(x=>x.id===id);
    if(!Utils.confirmar(`Excluir "${t?.nome}"?`))return;
    try{await Database.deletar(obraId,COL,id);Utils.toast('Excluído.','sucesso');await carregar();}catch(e){Utils.toast('Erro.','erro');}
  }

  // --- HELPERS ---
  function _filtradas(){
    let tf=[...tarefas];
    const fe=document.getElementById('filtro-etapa')?.value;
    const fs=document.getElementById('filtro-status')?.value;
    const fb=(document.getElementById('filtro-busca')?.value||'').toLowerCase();
    if(fe)tf=tf.filter(t=>t.etapaId===fe);
    if(fs)tf=tf.filter(t=>_status(t)===fs);
    if(fb)tf=tf.filter(t=>(t.nome||'').toLowerCase().includes(fb)||(t.codigo||'').toLowerCase().includes(fb));
    return tf;
  }

  function _status(t){
    if(!t.inicioPlanejado)return 'nao_iniciado';
    if(_perc(t)>=100)return 'concluido';
    const hoje=new Date(),fim=new Date(t.terminoPlanejado);
    if(_perc(t)>0)return hoje>fim?'atrasado':'em_andamento';
    return hoje>fim?'atrasado':'nao_iniciado';
  }
  function _perc(t){return Math.round(t.percentualConcluido||t.percConcluido||0);}
  function _percPrev(t){
    if(!t.inicioPlanejado||!t.terminoPlanejado)return 0;
    const h=new Date(),i=new Date(t.inicioPlanejado),f=new Date(t.terminoPlanejado);
    if(h<i)return 0;if(h>f)return 100;
    return Math.round((h-i)/(f-i)*100);
  }
  function _fd(d){return d?new Date(d).toLocaleDateString('pt-BR'):'—';}

  function setAba(a){abaAtiva=a;renderizar();}
  function setZoom(z){zoomGantt=z;renderizar();}
  function aplicarFiltro(){renderizar();}
  function importarExcel(){Utils.toast('Em desenvolvimento.','alerta');}
  function exportar(){Utils.toast('Em desenvolvimento.','alerta');}

  return {init,carregar,renderizar,novaTarefa,editarTarefa,salvarTarefa,excluirTarefa,setAba,setZoom,aplicarFiltro,importarExcel,exportar};
})();
function onObraChanged(){Planejamento.init();}

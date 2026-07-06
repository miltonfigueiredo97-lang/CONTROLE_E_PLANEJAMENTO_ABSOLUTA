// ============================================
// Planejamento — V1.3.1
// Performance: renderização virtual (só linhas visíveis)
// ============================================
const Planejamento = (() => {
  let obraId=null, tarefas=[], tarefasFiltradas=[];
  let abaAtiva='gantt', zoomGantt='mes', editandoId=null, selectedIdx=-1;
  let splitX=420;
  let ganttVisible=true;
  let colsRecolhidas=new Set();
  let colsHidden=new Set(); // colunas escondidas
  const COL='tarefas';
  const ROW_H=32; // altura da linha
  let _scrollTop=0;
  let _viewportH=600;

  // Definição de colunas
  const COLUNAS=[
    {id:'num',label:'#',w:36,fixed:true},
    {id:'codigo',label:'Código',w:70},
    {id:'nome',label:'Tarefa',w:0,flex:true},
    {id:'inicio',label:'Início',w:90},
    {id:'termino',label:'Término',w:90},
    {id:'duracao',label:'Duração',w:62},
    {id:'percEsp',label:'% Esperado',w:75},
    {id:'percConc',label:'% Concluído',w:82},
    {id:'predecessora',label:'Predecessora',w:82},
    {id:'responsavel',label:'Responsável',w:100},
    {id:'local',label:'Local',w:80},
    {id:'grupo',label:'Grupo',w:80},
    {id:'acoes',label:'',w:64,fixed:true},
  ];

  async function init(){
    const ok=await Utils.initPagina({requireObra:true});if(!ok)return;
    obraId=Router.getObraId();
    if(!obraId){_el().innerHTML='<div class="estado-vazio"><div class="icone">📅</div><p>Selecione uma obra.</p></div>';return;}
    document.addEventListener('keydown',_onKey);
    await carregar();
  }

  function _el(){return document.getElementById('planejamento-content')||document.body;}

  async function carregar(){
    try{
      Utils.mostrarLoading('Carregando...');
      tarefas=await Database.listar(obraId,COL,'ordem').catch(()=>[]);
      _aplicarFiltro();
      renderizar();
      requestAnimationFrame(()=>_afterRender());
    }catch(e){console.error(e);Utils.toast('Erro.','erro');}
    finally{Utils.esconderLoading();}
  }

  function _onKey(e){
    if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.tagName==='SELECT')return;
    if((e.ctrlKey||e.metaKey)&&(e.key==='+'||e.key==='=')){e.preventDefault();inserirTarefa();}
    if((e.ctrlKey||e.metaKey)&&e.key==='-'){e.preventDefault();if(selectedIdx>=0){const t=tarefasFiltradas[selectedIdx];if(t)excluirTarefa(t.id);}}
  }

  function _aplicarFiltro(){
    const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    // Recolher filhos de grupos fechados
    if(!colsRecolhidas.size){tarefasFiltradas=sorted;return;}
    const fechados=new Set();
    for(const id of colsRecolhidas){
      const t=tarefas.find(x=>x.id===id);
      if(t)fechados.add(t.nome);
    }
    const result=[];
    let skipLevel=-1;
    for(const t of sorted){
      if(skipLevel>=0&&(t.nivel||0)>skipLevel){continue;}
      skipLevel=-1;
      result.push(t);
      if(fechados.has(t.nome)&&t.tipo==='grupo'){skipLevel=t.nivel||0;}
    }
    tarefasFiltradas=result;
  }

  // ===================== RENDER PRINCIPAL =====================
  function renderizar(){
    const c=_el();
    c.innerHTML=`
      <div class="plan-header">
        <div class="plan-abas">
          <button class="plan-aba ativo">📊 Planejamento</button>
        </div>
        <div class="plan-actions" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
          <label class="btn btn-secundario btn-sm" style="cursor:pointer;">📥 Importar<input type="file" accept=".xlsx,.xls" style="display:none" onchange="Planejamento.importarExcel(event)"></label>
          <button class="btn btn-secundario btn-sm" onclick="Planejamento.exportar()">📤 Exportar</button>
          <button class="btn btn-secundario btn-sm" onclick="Planejamento.toggleGantt()" id="btn-toggle-gantt">📊 Esconder Gantt</button>
          <button class="btn btn-primario btn-sm" onclick="Planejamento.inserirTarefa()">＋ Tarefa</button>
        </div>
      </div>
      <div style="font-size:.72rem;color:#444;margin-bottom:6px;">${tarefasFiltradas.length} tarefas · Ctrl++ inserir · Ctrl+- excluir · clique para selecionar · duplo-clique para editar</div>
      <div id="plan-corpo">${_renderGantt()}</div>`;
  }

  // ===================== GANTT (virtual scroll) =====================
  function _renderGantt(){
    const tf=tarefasFiltradas;
    if(!tf.length)return`<div class="estado-vazio"><div class="icone">📅</div>
      <p>Nenhuma tarefa. Importe um Excel ou crie manualmente.</p></div>`;

    const visibleCols=COLUNAS.filter(c=>!colsHidden.has(c.id));
    const hoje=new Date();
    const datas=tf.flatMap(t=>[t.inicioPlanejado,t.terminoPlanejado].filter(Boolean).map(d=>new Date(d)));
    const dMin=datas.length?new Date(Math.min(...datas)):new Date(hoje.getTime()-30*864e5);
    const dMax=datas.length?new Date(Math.max(...datas)):new Date(hoje.getTime()+60*864e5);
    dMin.setDate(dMin.getDate()-3);dMax.setDate(dMax.getDate()+10);
    const lpd={dia:32,semana:8,mes:3,trimestre:1.2,ano:0.4}[zoomGantt]||3;
    const totalDias=Math.ceil((dMax-dMin)/864e5);
    const W=Math.max(600,Math.round(totalDias*lpd));
    const totalH=tf.length*ROW_H;

    // Header colunas com ▼ para esconder
    const hdr=visibleCols.map(c=>{
      const w=c.flex?'flex:1;min-width:120px;':`width:${c.w}px;flex-shrink:0;`;
      const hideBtn=!c.fixed?` <span onclick="Planejamento.hideCol('${c.id}')" style="cursor:pointer;font-size:.6rem;opacity:.4;margin-left:2px;" title="Esconder coluna">▼</span>`:'';
      return`<div style="${w}font-size:.63rem;font-weight:700;color:#555;text-transform:uppercase;padding:0 3px;overflow:hidden;white-space:nowrap;display:flex;align-items:center;">${c.label}${hideBtn}</div>`;
    }).join('');

    // Zoom buttons
    const zoomHtml=['dia','semana','mes','trimestre','ano'].map(z=>
      `<button class="btn btn-sm ${zoomGantt===z?'btn-primario':'btn-secundario'}" onclick="Planejamento.setZoom('${z}')" style="font-size:.72rem;padding:2px 8px;">${z.charAt(0).toUpperCase()+z.slice(1)}</button>`).join('');

    // Datas header do gantt — granularidade depende do zoom
    const meses=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    let hDatas='';
    if(zoomGantt==='dia'){
      // Mostrar cada dia
      let d=new Date(dMin),lastM=-1;
      while(d<=dMax){
        const x=Math.round((d-dMin)/864e5*lpd);
        const m=d.getMonth();
        if(m!==lastM){
          hDatas+=`<div style="position:absolute;left:${x}px;top:1px;font-size:.55rem;color:#666;white-space:nowrap;">${meses[m]} ${d.getFullYear()}</div>`;
          lastM=m;
        }
        const dow=d.getDay();
        hDatas+=`<div style="position:absolute;left:${x}px;top:0;bottom:0;border-left:1px solid rgba(255,255,255,${dow===0||dow===6?'.08':'.03'});"></div>`;
        hDatas+=`<div style="position:absolute;left:${x+2}px;top:13px;font-size:.55rem;color:${dow===0||dow===6?'#666':'#444'};white-space:nowrap;">${d.getDate()}</div>`;
        d.setDate(d.getDate()+1);
      }
    } else if(zoomGantt==='semana'){
      let d=new Date(dMin); d.setDate(d.getDate()-(d.getDay()||7)+1); // segunda
      let lastM=-1;
      while(d<=dMax){
        const x=Math.round((d-dMin)/864e5*lpd);
        if(d.getMonth()!==lastM){
          hDatas+=`<div style="position:absolute;left:${x}px;top:1px;font-size:.55rem;color:#666;white-space:nowrap;">${meses[d.getMonth()]} ${d.getFullYear()}</div>`;
          lastM=d.getMonth();
        }
        hDatas+=`<div style="position:absolute;left:${x}px;top:0;bottom:0;border-left:1px solid rgba(255,255,255,.06);"></div>`;
        hDatas+=`<div style="position:absolute;left:${x+2}px;top:13px;font-size:.5rem;color:#444;">${d.getDate()}</div>`;
        d.setDate(d.getDate()+7);
      }
    } else if(zoomGantt==='mes'){
      let d=new Date(dMin.getFullYear(),dMin.getMonth(),1);
      while(d<=dMax){
        const x=Math.round((d-dMin)/864e5*lpd);
        hDatas+=`<div style="position:absolute;left:${x}px;top:0;bottom:0;border-left:1px solid rgba(255,255,255,.06);"></div>`;
        hDatas+=`<div style="position:absolute;left:${x+3}px;top:6px;font-size:.6rem;color:#555;white-space:nowrap;">${meses[d.getMonth()]} ${d.getFullYear()}</div>`;
        d.setMonth(d.getMonth()+1);
      }
    } else if(zoomGantt==='trimestre'){
      let d=new Date(dMin.getFullYear(),Math.floor(dMin.getMonth()/3)*3,1);
      while(d<=dMax){
        const x=Math.round((d-dMin)/864e5*lpd);
        const q=Math.floor(d.getMonth()/3)+1;
        hDatas+=`<div style="position:absolute;left:${x}px;top:0;bottom:0;border-left:1px solid rgba(255,255,255,.06);"></div>`;
        hDatas+=`<div style="position:absolute;left:${x+3}px;top:6px;font-size:.6rem;color:#555;white-space:nowrap;">T${q} ${d.getFullYear()}</div>`;
        d.setMonth(d.getMonth()+3);
      }
    } else { // ano
      let y=dMin.getFullYear();
      while(y<=dMax.getFullYear()+1){
        const d=new Date(y,0,1);
        const x=Math.round((d-dMin)/864e5*lpd);
        hDatas+=`<div style="position:absolute;left:${x}px;top:0;bottom:0;border-left:1px solid rgba(255,255,255,.06);"></div>`;
        hDatas+=`<div style="position:absolute;left:${x+3}px;top:6px;font-size:.65rem;color:#555;font-weight:700;">${y}</div>`;
        y++;
      }
    }
    const hojeX=Math.round((hoje-dMin)/864e5*lpd);

    return`
    <div style="display:flex;gap:6px;margin-bottom:6px;align-items:center;">
      ${zoomHtml}
      ${colsHidden.size?`<button class="btn btn-secundario btn-sm" onclick="Planejamento.showAllCols()" style="font-size:.7rem;">Mostrar colunas (${colsHidden.size})</button>`:''}
    </div>
    <div id="gantt-container" style="display:flex;border:1px solid #222;border-radius:6px;overflow:hidden;height:calc(100vh - 210px);min-height:300px;">
      <div id="gantt-esq" style="width:${splitX}px;flex-shrink:0;background:#111;display:flex;flex-direction:column;overflow:hidden;">
        <div style="height:26px;background:#0d0d0d;border-bottom:1px solid #222;display:flex;align-items:center;flex-shrink:0;">${hdr}</div>
        <div id="gantt-esq-scroll" style="overflow-y:auto;flex:1;" onscroll="Planejamento._syncScroll(this)">
          <div style="height:${totalH}px;position:relative;" id="gantt-esq-virt"></div>
        </div>
      </div>
      <div id="gantt-divider" style="width:4px;background:var(--cor-primaria);cursor:col-resize;flex-shrink:0;opacity:.7;" onmousedown="Planejamento._startDivider(event)"></div>
      <div id="gantt-dir" style="flex:1;min-width:0;background:#0d0d0d;display:flex;flex-direction:column;overflow:hidden;">
        <div style="height:26px;background:#0a0a0a;border-bottom:1px solid #222;overflow:hidden;flex-shrink:0;" id="gantt-hdr-dates">
          <div style="width:${W}px;height:100%;position:relative;">${hDatas}</div>
        </div>
        <div id="gantt-dir-scroll" style="overflow:auto;flex:1;" onscroll="Planejamento._syncScroll(this)">
          <div style="width:${W}px;height:${totalH}px;position:relative;" id="gantt-dir-virt">
            <div style="position:absolute;left:${hojeX}px;top:0;bottom:0;width:2px;background:var(--cor-primaria);opacity:.8;z-index:5;pointer-events:none;">
              <div style="position:absolute;top:0;left:-16px;background:var(--cor-primaria);color:#000;font-size:.55rem;font-weight:800;padding:1px 4px;border-radius:2px;">Hoje</div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }

  // Chamado após renderizar o gantt — faz virtual render
  function _afterRender(){
    if(abaAtiva!=='gantt')return;
    const esqScroll=document.getElementById('gantt-esq-scroll');
    if(!esqScroll)return;
    _viewportH=esqScroll.clientHeight;
    _renderVisibleRows();
  }

  function _syncScroll(src){
    const esq=document.getElementById('gantt-esq-scroll');
    const dir=document.getElementById('gantt-dir-scroll');
    const hdr=document.getElementById('gantt-hdr-dates');
    if(!esq||!dir)return;
    if(src===esq){dir.scrollTop=esq.scrollTop;}
    else if(src===dir){esq.scrollTop=dir.scrollTop;if(hdr)hdr.scrollLeft=dir.scrollLeft;}
    _scrollTop=esq.scrollTop;
    _renderVisibleRows();
  }

  function _renderVisibleRows(){
    const tf=tarefasFiltradas;
    const esqVirt=document.getElementById('gantt-esq-virt');
    const dirVirt=document.getElementById('gantt-dir-virt');
    if(!esqVirt||!dirVirt||!tf.length)return;

    const startIdx=Math.max(0,Math.floor(_scrollTop/ROW_H)-5);
    const endIdx=Math.min(tf.length,Math.ceil((_scrollTop+_viewportH)/ROW_H)+5);

    const visibleCols=COLUNAS.filter(c=>!colsHidden.has(c.id));
    const hoje=new Date();
    const datas=tf.flatMap(t=>[t.inicioPlanejado,t.terminoPlanejado].filter(Boolean).map(d=>new Date(d)));
    const dMin=datas.length?new Date(Math.min(...datas)):new Date(hoje.getTime()-30*864e5);
    dMin.setDate(dMin.getDate()-3);
    const lpd={dia:32,semana:8,mes:3,trimestre:1.2,ano:0.4}[zoomGantt]||3;

    let rowsHtml='', barsHtml='';
    for(let i=startIdx;i<endIdx;i++){
      const t=tf[i], y=i*ROW_H;
      const isSel=i===selectedIdx;
      const isG=t.tipo==='grupo';
      const st=_status(t), perc=_perc(t);
      const bg=isSel?'rgba(245,200,0,.12)':'';
      const ind=(t.nivel||0)*14;

      // Linhas da tabela
      let cells='';
      for(const c of visibleCols){
        const w=c.flex?'flex:1;min-width:120px;':`width:${c.w}px;flex-shrink:0;`;
        const base=`${w}overflow:hidden;white-space:nowrap;text-overflow:ellipsis;padding:0 3px;font-size:.78rem;`;
        if(c.id==='num')       cells+=`<div style="${base}color:#444;font-family:var(--font-mono);font-size:.68rem;text-align:center;">${i+1}</div>`;
        else if(c.id==='codigo') cells+=`<div style="${base}color:#555;font-family:var(--font-mono);font-size:.7rem;">${t.codigo||''}</div>`;
        else if(c.id==='nome'){
          const temFilhos=isG&&tarefas.some(x=>(x.tarefaPai||'')===(t.nome||''));
          const toggle=temFilhos?`<span onclick="event.stopPropagation();Planejamento.toggleRecolher('${t.id}')" style="cursor:pointer;color:#666;font-size:.65rem;margin-right:3px;">${colsRecolhidas.has(t.id)?'▶':'▼'}</span>`:'';
          cells+=`<div style="${base}padding-left:${ind+4}px;color:${isG?'var(--cor-primaria)':'#ccc'};font-weight:${isG?700:400};" title="${t.nome}">${toggle}${t.nome}</div>`;
        }
        else if(c.id==='inicio')  cells+=`<div style="${base}color:#666;font-size:.7rem;text-align:center;">${_fd(t.inicioPlanejado)}</div>`;
        else if(c.id==='termino') cells+=`<div style="${base}color:#666;font-size:.7rem;text-align:center;">${_fd(t.terminoPlanejado)}</div>`;
        else if(c.id==='duracao') cells+=`<div style="${base}color:#666;font-size:.7rem;text-align:center;">${t.duracao||'—'}</div>`;
        else if(c.id==='percEsp') cells+=`<div style="${base}color:#555;font-size:.7rem;text-align:center;">${t.percentualEsperado||0}%</div>`;
        else if(c.id==='percConc')cells+=`<div style="${base}font-size:.7rem;text-align:center;color:${perc>=100?'#16a34a':perc>0?'#2563eb':'#555'};">${perc}%</div>`;
        else if(c.id==='predecessora') cells+=`<div style="${base}color:#555;font-size:.7rem;text-align:center;">${t.predecessora||'—'}</div>`;
        else if(c.id==='responsavel') cells+=`<div style="${base}color:#555;font-size:.7rem;">${t.responsavel||'—'}</div>`;
        else if(c.id==='local')   cells+=`<div style="${base}color:#555;font-size:.7rem;">${t.local||'—'}</div>`;
        else if(c.id==='grupo')   cells+=`<div style="${base}color:#555;font-size:.7rem;">${t.grupo||'—'}</div>`;
        else if(c.id==='acoes')   cells+=`<div style="${base}display:flex;gap:1px;justify-content:center;">` +
          `<button style="background:#222;color:#888;border:1px solid #333;border-radius:3px;cursor:pointer;font-size:.6rem;padding:0 3px;line-height:1.5;" onclick="event.stopPropagation();Planejamento.recuarNivel('${t.id}')" title="Recuar nível">←</button>` +
          `<button style="background:#222;color:#888;border:1px solid #333;border-radius:3px;cursor:pointer;font-size:.6rem;padding:0 3px;line-height:1.5;" onclick="event.stopPropagation();Planejamento.avancarNivel('${t.id}')" title="Avançar nível">→</button>` +
          `<button style="background:#222;color:#888;border:1px solid #333;border-radius:3px;cursor:pointer;font-size:.6rem;padding:0 3px;line-height:1.5;" onclick="event.stopPropagation();Planejamento.editarTarefa('${t.id}')" title="Editar">✎</button></div>`;
      }

      rowsHtml+=`<div style="position:absolute;top:${y}px;left:0;right:0;height:${ROW_H}px;display:flex;align-items:center;border-bottom:1px solid #1a1a1a;background:${bg};cursor:pointer;"
        onclick="Planejamento.selectIdx(${i})" ondblclick="Planejamento.editarTarefa('${t.id}')">${cells}</div>`;

      // Barras
      barsHtml+=`<div style="position:absolute;left:0;top:${y}px;width:100%;height:${ROW_H}px;background:${bg};border-bottom:1px solid #1a1a1a;"></div>`;
      if(t.inicioPlanejado&&t.terminoPlanejado){
        const bx=Math.round((new Date(t.inicioPlanejado)-dMin)/864e5*lpd);
        const bw=Math.max(4,Math.round((new Date(t.terminoPlanejado)-new Date(t.inicioPlanejado))/864e5*lpd));
        const by=y+6,bh=20;
        const cor={nao_iniciado:'#333',em_andamento:'#1d4ed8',concluido:'#15803d',atrasado:'#dc2626'}[st]||'#333';
        if(isG){
          barsHtml+=`<div style="position:absolute;left:${bx}px;top:${by+8}px;width:${bw}px;height:5px;background:var(--cor-primaria);border-radius:1px;"></div>`;
        } else {
          barsHtml+=`<div style="position:absolute;left:${bx}px;top:${by}px;width:${bw}px;height:${bh}px;background:${cor};border-radius:3px;overflow:hidden;" title="${t.nome} ${perc}%">
            <div style="height:100%;width:${perc}%;background:rgba(255,255,255,.25);"></div>
            ${bw>50?`<span style="position:absolute;left:4px;top:4px;font-size:.6rem;color:rgba(255,255,255,.85);white-space:nowrap;overflow:hidden;max-width:${bw-8}px;">${t.nome}</span>`:''}
          </div>`;
        }
      }
    }

    // Manter existentes fora da viewport
    esqVirt.innerHTML=rowsHtml;
    // Barras: preservar a linha Hoje que está no container
    const hojeEl=dirVirt.querySelector('[style*="background:var(--cor-primaria)"]');
    dirVirt.innerHTML=barsHtml;
  }


  // ===================== COLUNAS =====================
  function hideCol(id){colsHidden.add(id);renderizar();requestAnimationFrame(_afterRender);}
  function showAllCols(){
    // Show popup with hidden columns
    const hidden=[...colsHidden];
    if(!hidden.length)return;
    const labels=COLUNAS.reduce((m,c)=>{m[c.id]=c.label;return m;},{});
    let pop=document.getElementById('show-cols-pop');
    if(pop){pop.remove();return;}
    pop=document.createElement('div');
    pop.id='show-cols-pop';
    pop.style.cssText='position:fixed;top:100px;right:20px;background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:14px;z-index:1000;min-width:180px;box-shadow:0 8px 32px rgba(0,0,0,.5);';
    pop.innerHTML='<div style="font-weight:700;color:var(--cor-primaria);margin-bottom:10px;font-size:.82rem;">Colunas ocultas</div>'+
      hidden.map(id=>'<button class="btn btn-secundario btn-sm" style="display:block;width:100%;margin-bottom:4px;text-align:left;" onclick="Planejamento._showCol(\''+id+'\')">+ '+(labels[id]||id)+'</button>').join('')+
      '<hr style="border-color:#333;margin:8px 0;"><button class="btn btn-primario btn-sm" style="width:100%;" onclick="Planejamento._showAllCols()">Mostrar todas</button>';
    document.body.appendChild(pop);
    setTimeout(()=>document.addEventListener('click',function h(e){if(!pop.contains(e.target)){pop.remove();document.removeEventListener('click',h);}},false),100);
  }
  function _showCol(id){colsHidden.delete(id);const p=document.getElementById('show-cols-pop');if(p)p.remove();renderizar();requestAnimationFrame(_afterRender);}
  function _showAllCols(){colsHidden.clear();const p=document.getElementById('show-cols-pop');if(p)p.remove();renderizar();requestAnimationFrame(_afterRender);}

  // ===================== RESIZE COLUNAS =====================
  function _startColResize(e, colId){
    e.preventDefault(); e.stopPropagation();
    const col=COLUNAS.find(c=>c.id===colId); if(!col)return;
    const sx=e.clientX, sw=col.w;
    const move=ev=>{col.w=Math.max(30,sw+(ev.clientX-sx));renderizar();requestAnimationFrame(_afterRender);};
    const up=()=>{document.removeEventListener('mousemove',move);document.removeEventListener('mouseup',up);};
    document.addEventListener('mousemove',move);document.addEventListener('mouseup',up);
  }

  // ===================== DIVISOR =====================
  function _startDivider(e){
    e.preventDefault();
    const sx=e.clientX,sw=splitX;
    const move=ev=>{splitX=Math.max(250,Math.min(800,sw+(ev.clientX-sx)));const el=document.getElementById('gantt-esq');if(el)el.style.width=splitX+'px';};
    const up=()=>{document.removeEventListener('mousemove',move);document.removeEventListener('mouseup',up);};
    document.addEventListener('mousemove',move);document.addEventListener('mouseup',up);
  }

  // ===================== HIERARQUIA =====================
  function toggleRecolher(id){
    if(colsRecolhidas.has(id))colsRecolhidas.delete(id);else colsRecolhidas.add(id);
    _aplicarFiltro();renderizar();requestAnimationFrame(_afterRender);
  }
  async function recuarNivel(id){
    const t=tarefas.find(x=>x.id===id);if(!t)return;
    const diff=-1;
    // Move task and all children below it that have higher level
    const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    const idx=sorted.findIndex(x=>x.id===id);
    const updates=[{id,nivel:Math.max(0,(t.nivel||0)+diff)}];
    for(let i=idx+1;i<sorted.length;i++){
      if((sorted[i].nivel||0)>(t.nivel||0)){
        updates.push({id:sorted[i].id,nivel:Math.max(0,(sorted[i].nivel||0)+diff)});
      } else break;
    }
    try{await Promise.all(updates.map(u=>Database.atualizar(obraId,COL,u.id,{nivel:u.nivel})));await carregar();}
    catch(e){Utils.toast('Erro.','erro');}
  }
  async function avancarNivel(id){
    const t=tarefas.find(x=>x.id===id);if(!t)return;
    const diff=1;
    const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    const idx=sorted.findIndex(x=>x.id===id);
    const updates=[{id,nivel:(t.nivel||0)+diff}];
    for(let i=idx+1;i<sorted.length;i++){
      if((sorted[i].nivel||0)>(t.nivel||0)){
        updates.push({id:sorted[i].id,nivel:(sorted[i].nivel||0)+diff});
      } else break;
    }
    try{await Promise.all(updates.map(u=>Database.atualizar(obraId,COL,u.id,{nivel:u.nivel})));await carregar();}
    catch(e){Utils.toast('Erro.','erro');}
  }

  // ===================== SELEÇÃO + CRUD =====================
  function selectIdx(i){selectedIdx=i;_renderVisibleRows();}

  function inserirTarefa(){
    editandoId=null;
    document.getElementById('modal-tarefa-titulo').textContent='Nova Tarefa';
    document.getElementById('form-tarefa').reset();
    // Se tem seleção, herda grupo/nível
    if(selectedIdx>=0){
      const sel=tarefasFiltradas[selectedIdx];
      if(sel){
        const f=document.getElementById('form-tarefa');
        f.querySelector('[name="nivel"]').value=sel.nivel||0;
        f.querySelector('[name="grupo"]').value=sel.grupo||'';
        f.querySelector('[name="local"]').value=sel.local||'';
        f.querySelector('[name="ordem"]').value=(sel.ordem||0)+1;
      }
    } else {
      document.querySelector('#form-tarefa [name="ordem"]').value=tarefas.length+1;
    }
    Utils.abrirModal('modal-tarefa');
  }

  function editarTarefa(id){
    const t=tarefas.find(x=>x.id===id);if(!t)return;
    editandoId=id;
    document.getElementById('modal-tarefa-titulo').textContent='Editar Tarefa';
    const f=document.getElementById('form-tarefa');f.reset();
    const campos=['codigo','nome','tipo','nivel','ordem','inicioPlanejado','terminoPlanejado','duracao',
      'percentualEsperado','percentualConcluido','predecessora','tarefaPai','grupo','local',
      'custo','receita','responsavel','inicioPlanejadoBase','terminoPlanejadoBase',
      'inicioDesafio','terminoDesafio','observacoes'];
    campos.forEach(k=>{const el=f.querySelector(`[name="${k}"]`);if(el&&t[k]!=null)el.value=t[k];});
    Utils.abrirModal('modal-tarefa');
  }

  async function salvarTarefa(){
    const f=document.getElementById('form-tarefa');
    const g=n=>f.querySelector(`[name="${n}"]`)?.value;
    const nome=g('nome')?.trim();
    if(!nome){Utils.toast('Informe o nome.','alerta');return;}
    const ini=g('inicioPlanejado'),ter=g('terminoPlanejado');
    let dur=parseInt(g('duracao'))||0;
    if(ini&&ter&&!dur)dur=Math.max(0,Math.ceil((new Date(ter)-new Date(ini))/864e5));
    const data={
      tipo:g('tipo')||'tarefa',codigo:g('codigo')||'',nome,
      nivel:parseInt(g('nivel'))||0,ordem:parseFloat(g('ordem'))||tarefas.length+1,
      inicioPlanejado:ini||'',terminoPlanejado:ter||'',duracao:dur,
      percentualEsperado:parseFloat(g('percentualEsperado'))||0,
      percentualConcluido:parseFloat(g('percentualConcluido'))||0,
      predecessora:g('predecessora')||'',tarefaPai:g('tarefaPai')||'',
      grupo:g('grupo')||'',local:g('local')||'',
      custo:parseFloat(g('custo'))||0,receita:parseFloat(g('receita'))||0,
      responsavel:g('responsavel')||'',
      inicioPlanejadoBase:g('inicioPlanejadoBase')||'',terminoPlanejadoBase:g('terminoPlanejadoBase')||'',
      inicioDesafio:g('inicioDesafio')||'',terminoDesafio:g('terminoDesafio')||'',
      observacoes:g('observacoes')||'',obraId,
    };
    try{
      if(editandoId)await Database.atualizar(obraId,COL,editandoId,data);
      else{
        // Reordenar: empurra tarefas com ordem >= pra baixo
        const ordemNova=data.ordem;
        const updates=tarefas.filter(t=>(t.ordem||0)>=ordemNova);
        for(const u of updates){await Database.atualizar(obraId,COL,u.id,{ordem:(u.ordem||0)+1}).catch(()=>{});}
        await Database.criar(obraId,COL,data);
      }
      Utils.fecharModal('modal-tarefa');Utils.toast('Salvo!','sucesso');editandoId=null;await carregar();
    }catch(e){console.error(e);Utils.toast('Erro.','erro');}
  }

  async function excluirTarefa(id){
    const t=tarefas.find(x=>x.id===id);
    if(!confirm(`Excluir "${t?.nome}"?`))return;
    try{await Database.deletar(obraId,COL,id);Utils.toast('Excluído.','sucesso');if(selectedIdx>=0)selectedIdx=-1;await carregar();}
    catch(e){Utils.toast('Erro.','erro');}
  }

  // ===================== IMPORTAR =====================
  async function importarExcel(event){
    const file=event.target.files[0];if(!file)return;
    event.target.value='';
    if(!confirm(`Importar vai SUBSTITUIR todas as ${tarefas.length} tarefas. Confirmar?`))return;
    try{
      Utils.mostrarLoading('Lendo planilha...');
      if(typeof XLSX==='undefined')await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
      const ab=await file.arrayBuffer();
      const wb=XLSX.read(ab,{type:'array'});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
      if(rows.length<2){Utils.toast('Planilha vazia.','alerta');return;}

      const hdrs=rows[0].map(h=>String(h||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' '));
      const ci=name=>{
        const a={id:['id'],codigo:['codigo','code'],nome:['nome','name','tarefa'],
          duracao:['duracao','duration'],inicio:['inicio','start','inicio planejado'],
          termino:['termino','finish','fim','termino planejado'],
          percEsp:['esperado','% esperado'],percConc:['concluido','% concluido','% complete'],
          pred:['predecessora','predecessor','prececessora'],pai:['tarefa pai','parent'],
          grupo:['grupo','group'],local:['local','location'],
          custo:['custo','cost'],receita:['receita','revenue'],
          resp:['responsavel','responsible','resource'],
          iniBase:['inicio linha de base'],terBase:['termino linha de base'],
          iniDes:['inicio desafio'],terDes:['termino desafio']};
        for(const al of(a[name]||[])){const i=hdrs.indexOf(al);if(i>=0)return i;}return -1;
      };
      const iNome=ci('nome');if(iNome<0){Utils.toast('Coluna Nome não encontrada.','erro');return;}

      // Apagar existentes em lotes
      Utils.mostrarLoading('Limpando tarefas antigas...');
      const LOTE=200;
      for(let i=0;i<tarefas.length;i+=LOTE){
        await Promise.all(tarefas.slice(i,i+LOTE).map(t=>Database.deletar(obraId,COL,t.id).catch(()=>{})));
      }

      // Montar registros — todas as linhas com nome
      const registros=[];
      for(let r=1;r<rows.length;r++){
        const row=rows[r];
        const nomeRaw=String(row[iNome]||'');
        const nome=nomeRaw.trim();
        if(!nome)continue;
        const codigo=String(row[ci('codigo')]||'').trim();

        const nivel=Math.floor((nomeRaw.length-nomeRaw.trimStart().length)/2);
        const pontos=(codigo.match(/\./g)||[]).length;
        registros.push({
          tipo:pontos<=1&&codigo?'grupo':'tarefa',codigo,nome,nivel,ordem:registros.length+1,
          inicioPlanejado:_parseData(row[ci('inicio')]),terminoPlanejado:_parseData(row[ci('termino')]),
          duracao:_parseDur(row[ci('duracao')]),
          percentualEsperado:_parseNum(row[ci('percEsp')]),percentualConcluido:_parseNum(row[ci('percConc')]),
          predecessora:String(row[ci('pred')]||'').trim(),tarefaPai:String(row[ci('pai')]||'').trim(),
          grupo:String(row[ci('grupo')]||'').trim(),local:String(row[ci('local')]||'').trim(),
          custo:_parseNum(row[ci('custo')]),receita:_parseNum(row[ci('receita')]),
          responsavel:String(row[ci('resp')]||'').trim(),
          inicioPlanejadoBase:_parseData(row[ci('iniBase')]),terminoPlanejadoBase:_parseData(row[ci('terBase')]),
          inicioDesafio:_parseData(row[ci('iniDes')]),terminoDesafio:_parseData(row[ci('terDes')]),
          obraId,
        });
      }

      let imp=0;
      for(let i=0;i<registros.length;i+=LOTE){
        Utils.mostrarLoading(`Importando ${Math.min(i+LOTE,registros.length)}/${registros.length}...`);
        await Promise.all(registros.slice(i,i+LOTE).map(d=>Database.criar(obraId,COL,d).then(()=>imp++).catch(console.error)));
      }
      Utils.toast(`✅ ${imp} tarefas importadas!`,'sucesso');
      await carregar();
    }catch(e){console.error(e);Utils.toast('Erro: '+e.message,'erro');}
    finally{Utils.esconderLoading();}
  }

  // ===================== EXPORTAR =====================
  async function exportar(){
    try{
      Utils.mostrarLoading('Gerando...');
      if(typeof XLSX==='undefined')await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
      const HDR=['ID','Código','Nome','Duração','Início','Término','% Esperado','% Concluído',
        'Prececessora','Tarefa Pai','Grupo','Local','Custo','Receita','Responsável',
        'Inicio Linha de Base','Termino Linha de Base','Inicio Desafio','Termino Desafio'];
      const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
      const rows=sorted.map((t,i)=>[i+1,t.codigo||'','  '.repeat(t.nivel||0)+(t.nome||''),
        t.duracao?t.duracao+'d':'',_fBR(t.inicioPlanejado),_fBR(t.terminoPlanejado),
        t.percentualEsperado||0,t.percentualConcluido||0,t.predecessora||'',
        t.tarefaPai||'',t.grupo||'',t.local||'',t.custo||0,t.receita||0,t.responsavel||'',
        _fBR(t.inicioPlanejadoBase),_fBR(t.terminoPlanejadoBase),_fBR(t.inicioDesafio),_fBR(t.terminoDesafio)]);
      const ws=XLSX.utils.aoa_to_sheet([HDR,...rows]);
      ws['!cols']=[{wch:6},{wch:10},{wch:45},{wch:8},{wch:13},{wch:13},{wch:11},{wch:11},
        {wch:13},{wch:20},{wch:18},{wch:15},{wch:10},{wch:10},{wch:18},{wch:22},{wch:22},{wch:15},{wch:15}];
      const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Cronograma');
      const obra=Router.getObra();
      XLSX.writeFile(wb,`cronograma_${(obra?.nome||'obra').replace(/[^a-z0-9]/gi,'_')}.xlsx`);
      Utils.toast('Exportado!','sucesso');
    }catch(e){Utils.toast('Erro: '+e.message,'erro');}
    finally{Utils.esconderLoading();}
  }

  // ===================== HELPERS =====================
  function _status(t){
    if(!t.inicioPlanejado)return 'nao_iniciado';
    if(_perc(t)>=100)return 'concluido';
    const h=new Date(),f=t.terminoPlanejado?new Date(t.terminoPlanejado):null;
    if(_perc(t)>0)return f&&h>f?'atrasado':'em_andamento';
    return f&&h>f?'atrasado':'nao_iniciado';
  }
  function _perc(t){return Math.round(t.percentualConcluido||0);}
  function _fd(d){if(!d)return'—';try{return new Date(d+'T12:00:00').toLocaleDateString('pt-BR');}catch(e){return d;}}
  function _fBR(d){if(!d)return'';try{return new Date(d+'T12:00:00').toLocaleDateString('pt-BR');}catch(e){return'';}}
  function _parseDur(v){return parseInt(String(v||'').replace(/\D/g,''))||0;}
  function _parseNum(v){return parseFloat(String(v||'').replace(',','.'))||0;}
  function _parseData(v){
    if(!v)return'';if(v instanceof Date)return v.toISOString().split('T')[0];
    if(typeof v==='number')return new Date((v-25569)*864e5).toISOString().split('T')[0];
    const s=String(v).trim(),m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if(m)return`${m[3]}-${m[2]}-${m[1]}`;if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.split('T')[0];return'';
  }
  function _loadScript(src){return new Promise((r,j)=>{const s=document.createElement('script');s.src=src;s.onload=r;s.onerror=j;document.head.appendChild(s);});}

  function toggleGantt(){
    ganttVisible=!ganttVisible;
    const dir=document.getElementById('gantt-dir');
    const div=document.getElementById('gantt-divider');
    const btn=document.getElementById('btn-toggle-gantt');
    if(dir){dir.style.display=ganttVisible?'':'none';}
    if(div){div.style.display=ganttVisible?'':'none';}
    if(btn){btn.textContent=ganttVisible?'📊 Esconder Gantt':'📊 Mostrar Gantt';}
    const esq=document.getElementById('gantt-esq');
    if(esq){esq.style.width=ganttVisible?splitX+'px':'100%';}
  }
  function setAba(a){abaAtiva=a;renderizar();requestAnimationFrame(_afterRender);}
  function setZoom(z){zoomGantt=z;renderizar();requestAnimationFrame(_afterRender);}

  return {init,carregar,renderizar,inserirTarefa,editarTarefa,salvarTarefa,excluirTarefa,
    selectIdx,toggleRecolher,recuarNivel,avancarNivel,
    setAba,setZoom,hideCol,showAllCols,_startDivider,_syncScroll,_afterRender,
    importarExcel,exportar,_startColResize,_showCol,_showAllCols,toggleGantt};
})();
function onObraChanged(){Planejamento.init();}

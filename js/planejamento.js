// ============================================
// Planejamento V2.0
// Todas as features solicitadas implementadas
// ============================================
const Planejamento = (() => {
  let obraId=null, tarefas=[], filtradas=[];
  let zoomGantt='mes', editandoId=null, selectedIdx=-1;
  let splitX=440, ganttVisible=true;
  let colsRecolhidas=new Set();
  const COL='tarefas';
  const ROW_H=30;
  let _rafId=null;

  // Colunas: ordem editável, largura editável
  let colOrdem=['num','nivel','codigo','nome','inicio','termino','duracao','percEsp','percConc','predecessora','responsavel','local','grupo','acoes'];
  let colLarguras={num:36,nivel:42,codigo:70,nome:250,inicio:88,termino:88,duracao:60,percEsp:72,percConc:78,predecessora:80,responsavel:100,local:80,grupo:80,acoes:64};
  let colsHidden=new Set();

  const COL_LABELS={num:'#',nivel:'Nível',codigo:'Código',nome:'Tarefa',inicio:'Início',termino:'Término',duracao:'Duração',percEsp:'% Esperado',percConc:'% Concluído',predecessora:'Predecessora',responsavel:'Responsável',local:'Local',grupo:'Grupo',acoes:''};
  const COL_FIXED=new Set(['num','nome','acoes']);
  const COL_EDITABLE=new Set(['codigo','nome','inicio','termino','duracao','percEsp','percConc','predecessora','responsavel','local','grupo','nivel']);

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
      _buildFiltradas();
      _render();
    }catch(e){console.error(e);Utils.toast('Erro.','erro');}
    finally{Utils.esconderLoading();}
  }

  function _onKey(e){
    if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.tagName==='SELECT')return;
    if((e.ctrlKey||e.metaKey)&&(e.key==='+'||e.key==='=')){e.preventDefault();inserirTarefa();}
    if((e.ctrlKey||e.metaKey)&&e.key==='-'){e.preventDefault();if(selectedIdx>=0&&filtradas[selectedIdx])excluirTarefa(filtradas[selectedIdx].id);}
  }

  function _buildFiltradas(){
    const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    if(!colsRecolhidas.size){filtradas=sorted;return;}
    const result=[];
    let skipLevel=-1; // se >= 0, pula tudo com nível > skipLevel
    for(const t of sorted){
      const niv=t.nivel||0;
      // Se estamos pulando e este item tem nível > o grupo recolhido, pula
      if(skipLevel>=0){
        if(niv>skipLevel){continue;} // filho do recolhido — esconde
        else skipLevel=-1; // chegou em item do mesmo nível ou acima — para de pular
      }
      result.push(t);
      // Se este item está recolhido, começa a pular filhos
      if(colsRecolhidas.has(t.id)){skipLevel=niv;}
    }
    filtradas=result;
  }

  // ===================== RENDER =====================
  function _render(){
    const c=_el();
    const visCols=colOrdem.filter(id=>!colsHidden.has(id));

    c.innerHTML=`
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px;">
        <div style="display:flex;gap:6px;align-items:center;">
          <h2 style="margin:0;font-size:1.1rem;color:var(--cor-primaria);">📊 Planejamento</h2>
          <span style="font-size:.75rem;color:#555;">${filtradas.length} tarefas</span>
        </div>
        <div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;">
          ${['dia','semana','mes','trimestre','ano'].map(z=>`<button class="btn btn-sm ${zoomGantt===z?'btn-primario':'btn-secundario'}" onclick="Planejamento.setZoom('${z}')" style="font-size:.7rem;padding:2px 8px;">${z.charAt(0).toUpperCase()+z.slice(1)}</button>`).join('')}
          <span style="color:#333;margin:0 4px;">|</span>
          <label class="btn btn-secundario btn-sm" style="cursor:pointer;font-size:.72rem;">📥 Importar<input type="file" accept=".xlsx,.xls" style="display:none" onchange="Planejamento.importarExcel(event)"></label>
          <button class="btn btn-secundario btn-sm" onclick="Planejamento.exportar()" style="font-size:.72rem;">📤 Exportar</button>
          <button class="btn btn-secundario btn-sm" onclick="Planejamento.exportarPNG()" style="font-size:.72rem;">🖼 PNG</button>
          <button class="btn btn-secundario btn-sm" onclick="Planejamento.toggleGantt()" id="btn-tg" style="font-size:.72rem;">${ganttVisible?'◀ Esconder Gantt':'▶ Mostrar Gantt'}</button>
          ${colsHidden.size?`<button class="btn btn-secundario btn-sm" onclick="Planejamento.showColsMenu()" style="font-size:.72rem;">＋ Colunas (${colsHidden.size})</button>`:''}
          <button class="btn btn-primario btn-sm" onclick="Planejamento.inserirTarefa()" style="font-size:.72rem;">＋ Tarefa</button>
        </div>
      </div>
      <div style="font-size:.68rem;color:#444;margin-bottom:4px;">Ctrl++ inserir · Ctrl+- excluir · clique na célula para editar · clique direito no header para esconder coluna</div>
      ${_renderGantt(visCols)}`;
    requestAnimationFrame(()=>_paintRows());
  }

  function _renderGantt(visCols){
    const tf=filtradas;
    if(!tf.length)return`<div class="estado-vazio"><div class="icone">📅</div><p>Nenhuma tarefa.</p></div>`;

    const totalH=tf.length*ROW_H;
    const hoje=new Date();
    const datas=tf.flatMap(t=>[t.inicioPlanejado,t.terminoPlanejado].filter(Boolean).map(d=>new Date(d)));
    const dMin=datas.length?new Date(Math.min(...datas)):new Date(hoje.getTime()-30*864e5);
    const dMax=datas.length?new Date(Math.max(...datas)):new Date(hoje.getTime()+60*864e5);
    dMin.setDate(dMin.getDate()-5);dMax.setDate(dMax.getDate()+10);
    const lpd={dia:32,semana:8,mes:3,trimestre:1.2,ano:0.4}[zoomGantt]||3;
    const W=Math.max(600,Math.round(Math.ceil((dMax-dMin)/864e5)*lpd));

    // Header colunas
    const hdr=visCols.map(id=>{
      const w=id==='nome'?'flex:1;min-width:150px;':`width:${colLarguras[id]||60}px;flex-shrink:0;`;
      return`<div style="${w}position:relative;padding:0 4px;font-size:.63rem;font-weight:700;color:#555;text-transform:uppercase;overflow:hidden;white-space:nowrap;display:flex;align-items:center;user-select:none;cursor:pointer;"
        oncontextmenu="event.preventDefault();Planejamento.hideCol('${id}')"
        draggable="${COL_FIXED.has(id)?'false':'true'}"
        ondragstart="Planejamento._colDragStart(event,'${id}')"
        ondragover="event.preventDefault()"
        ondrop="Planejamento._colDrop(event,'${id}')"
        title="Arraste para reordenar · Clique direito para esconder">${COL_LABELS[id]||id}${id!=='nome'&&!COL_FIXED.has(id)?'<div onmousedown="Planejamento._colResizeStart(event,\''+id+'\')" style="position:absolute;right:0;top:0;bottom:0;width:4px;cursor:col-resize;"></div>':''}</div>`;
    }).join('');

    // Datas header gantt
    const hDatas=_buildDateHeader(dMin,dMax,lpd,W);
    const hojeX=Math.round((hoje-dMin)/864e5*lpd);

    return`<div id="gantt-c" style="display:flex;border:1px solid #222;border-radius:6px;overflow:hidden;height:calc(100vh - 200px);min-height:300px;">
      <div id="g-esq" style="width:${ganttVisible?splitX+'px':'100%'};flex-shrink:${ganttVisible?'0':'1'};background:#111;display:flex;flex-direction:column;overflow:hidden;${ganttVisible?'':'flex:1;'}">
        <div style="height:26px;background:#0d0d0d;border-bottom:1px solid #222;display:flex;align-items:center;flex-shrink:0;">${hdr}</div>
        <div id="g-esq-s" style="overflow:auto;flex:1;" onscroll="Planejamento._sync(this)">
          <div style="height:${totalH}px;position:relative;" id="g-esq-v"></div>
        </div>
      </div>
      ${ganttVisible?`<div id="g-div" style="width:4px;background:var(--cor-primaria);cursor:col-resize;flex-shrink:0;opacity:.7;" onmousedown="Planejamento._divStart(event)"></div>
      <div id="g-dir" style="flex:1;min-width:0;background:#0d0d0d;display:flex;flex-direction:column;overflow:hidden;">
        <div style="height:26px;background:#0a0a0a;border-bottom:1px solid #222;overflow:hidden;flex-shrink:0;" id="g-hdr-d">
          <div style="width:${W}px;height:100%;position:relative;">${hDatas}</div>
        </div>
        <div id="g-dir-s" style="overflow:auto;flex:1;" onscroll="Planejamento._sync(this)">
          <div style="width:${W}px;height:${totalH}px;position:relative;" id="g-dir-v">
            <div id="gantt-hoje" style="position:absolute;left:${hojeX}px;top:0;bottom:0;width:2px;background:var(--cor-primaria);opacity:.8;z-index:5;pointer-events:none;">
              <div style="position:absolute;top:0;left:-14px;background:var(--cor-primaria);color:#000;font-size:.5rem;font-weight:800;padding:1px 3px;border-radius:2px;">Hoje</div>
            </div>
          </div>
        </div>
      </div>`:''}
    </div>`;
  }

  // ===================== VIRTUAL ROWS =====================
  function _paintRows(){
    const esqS=document.getElementById('g-esq-s');if(!esqS)return;
    const vH=esqS.clientHeight, st=esqS.scrollTop;
    const s=Math.max(0,Math.floor(st/ROW_H)-3);
    const e=Math.min(filtradas.length,Math.ceil((st+vH)/ROW_H)+3);
    const visCols=colOrdem.filter(id=>!colsHidden.has(id));

    const hoje=new Date();
    const datas=filtradas.flatMap(t=>[t.inicioPlanejado,t.terminoPlanejado].filter(Boolean).map(d=>new Date(d)));
    const dMin=datas.length?new Date(Math.min(...datas)):new Date(hoje.getTime()-30*864e5);
    dMin.setDate(dMin.getDate()-5);
    const lpd={dia:32,semana:8,mes:3,trimestre:1.2,ano:0.4}[zoomGantt]||3;

    let rH='', bH='';
    for(let i=s;i<e;i++){
      const t=filtradas[i], y=i*ROW_H;
      const sel=i===selectedIdx, isG=t.tipo==='grupo';
      const st2=_status(t), perc=_perc(t);

      // Build row cells
      let cells='';
      for(const cid of visCols){
        const w=cid==='nome'?'flex:1;min-width:150px;':`width:${colLarguras[cid]||60}px;flex-shrink:0;`;
        const base=`${w}overflow:hidden;white-space:nowrap;text-overflow:ellipsis;padding:0 4px;font-size:.78rem;height:100%;display:flex;align-items:center;`;
        const editable=COL_EDITABLE.has(cid);
        const clickEdit=editable?`onclick="Planejamento._editCell(event,${i},'${cid}')"`:cid==='num'?`onclick="Planejamento.selectIdx(${i})"`:''

        if(cid==='num'){
          cells+=`<div style="${base}color:#444;font-family:var(--font-mono);font-size:.65rem;justify-content:center;cursor:pointer;" ${clickEdit}>${i+1}</div>`;
        } else if(cid==='nivel'){
          cells+=`<div style="${base}color:#666;font-family:var(--font-mono);font-size:.68rem;justify-content:center;cursor:pointer;" ${clickEdit}>${t.nivel||0}</div>`;
        } else if(cid==='codigo'){
          cells+=`<div style="${base}color:#555;font-family:var(--font-mono);font-size:.7rem;cursor:pointer;" ${clickEdit}>${t.codigo||''}</div>`;
        } else if(cid==='nome'){
          const ind=(t.nivel||0)*14;
          // Tem filhos = próxima tarefa na ordem tem nível maior
          const tIdx=tarefas.sort((a,b)=>(a.ordem||0)-(b.ordem||0)).findIndex(x=>x.id===t.id);
          const temF=tIdx>=0&&tIdx<tarefas.length-1&&(tarefas[tIdx+1].nivel||0)>(t.nivel||0);
          const tog=temF?`<span onclick="event.stopPropagation();Planejamento.toggleRecolher('${t.id}')" style="cursor:pointer;color:#666;font-size:.6rem;margin-right:3px;flex-shrink:0;">${colsRecolhidas.has(t.id)?'▶':'▼'}</span>`:'';
          cells+=`<div style="${base}padding-left:${ind+4}px;cursor:pointer;" ${clickEdit} title="${t.nome}">
            ${tog}<span style="color:${isG?'var(--cor-primaria)':'#ccc'};font-weight:${isG?700:400};overflow:hidden;text-overflow:ellipsis;">${t.nome||''}</span></div>`;
        } else if(cid==='inicio'){
          cells+=`<div style="${base}color:#666;font-size:.7rem;justify-content:center;cursor:pointer;" ${clickEdit}>${_fd(t.inicioPlanejado)}</div>`;
        } else if(cid==='termino'){
          cells+=`<div style="${base}color:#666;font-size:.7rem;justify-content:center;cursor:pointer;" ${clickEdit}>${_fd(t.terminoPlanejado)}</div>`;
        } else if(cid==='duracao'){
          cells+=`<div style="${base}color:#666;font-size:.7rem;justify-content:center;cursor:pointer;" ${clickEdit}>${t.duracao||'—'}</div>`;
        } else if(cid==='percEsp'){
          cells+=`<div style="${base}color:#555;font-size:.7rem;justify-content:center;cursor:pointer;" ${clickEdit}>${t.percentualEsperado||0}%</div>`;
        } else if(cid==='percConc'){
          cells+=`<div style="${base}font-size:.7rem;justify-content:center;color:${perc>=100?'#16a34a':perc>0?'#2563eb':'#555'};cursor:pointer;" ${clickEdit}>${perc}%</div>`;
        } else if(cid==='predecessora'){
          cells+=`<div style="${base}color:#555;font-size:.7rem;justify-content:center;cursor:pointer;" ${clickEdit}>${t.predecessora||'—'}</div>`;
        } else if(cid==='responsavel'){
          cells+=`<div style="${base}color:#555;font-size:.7rem;cursor:pointer;" ${clickEdit}>${t.responsavel||'—'}</div>`;
        } else if(cid==='local'){
          cells+=`<div style="${base}color:#555;font-size:.7rem;cursor:pointer;" ${clickEdit}>${t.local||'—'}</div>`;
        } else if(cid==='grupo'){
          cells+=`<div style="${base}color:#555;font-size:.7rem;cursor:pointer;" ${clickEdit}>${t.grupo||'—'}</div>`;
        } else if(cid==='acoes'){
          cells+=`<div style="${base}display:flex;gap:1px;justify-content:center;">
            <button style="background:#222;color:#888;border:1px solid #333;border-radius:3px;cursor:pointer;font-size:.58rem;padding:0 3px;line-height:1.4;" onclick="event.stopPropagation();Planejamento.recuarNivel('${t.id}')" title="Recuar nível">←</button>
            <button style="background:#222;color:#888;border:1px solid #333;border-radius:3px;cursor:pointer;font-size:.58rem;padding:0 3px;line-height:1.4;" onclick="event.stopPropagation();Planejamento.avancarNivel('${t.id}')" title="Avançar nível">→</button>
            <button style="background:#222;color:#dc2626;border:1px solid #333;border-radius:3px;cursor:pointer;font-size:.58rem;padding:0 3px;line-height:1.4;" onclick="event.stopPropagation();Planejamento.excluirTarefa('${t.id}')" title="Excluir">✕</button>
          </div>`;
        }
      }

      rH+=`<div style="position:absolute;top:${y}px;left:0;right:0;height:${ROW_H}px;display:flex;align-items:center;border-bottom:1px solid #1a1a1a;background:${sel?'rgba(245,200,0,.12)':''};">${cells}</div>`;

      // Barra Gantt
      if(ganttVisible&&t.inicioPlanejado&&t.terminoPlanejado){
        const bx=Math.round((new Date(t.inicioPlanejado)-dMin)/864e5*lpd);
        const bw=Math.max(4,Math.round((new Date(t.terminoPlanejado)-new Date(t.inicioPlanejado))/864e5*lpd));
        const by=y+5, bh=20;
        const cor={nao_iniciado:'#333',em_andamento:'#1d4ed8',concluido:'#15803d',atrasado:'#dc2626'}[st2]||'#333';
        if(isG){
          bH+=`<div style="position:absolute;left:${bx}px;top:${by+8}px;width:${bw}px;height:5px;background:var(--cor-primaria);border-radius:1px;"></div>`;
        } else {
          bH+=`<div style="position:absolute;left:${bx}px;top:${by}px;width:${bw}px;height:${bh}px;background:${cor};border-radius:3px;overflow:hidden;" title="${t.nome} ${perc}%">
            <div style="height:100%;width:${perc}%;background:rgba(255,255,255,.25);"></div>
            ${bw>50?`<span style="position:absolute;left:4px;top:4px;font-size:.58rem;color:rgba(255,255,255,.85);white-space:nowrap;overflow:hidden;max-width:${bw-8}px;">${t.nome}</span>`:''}
          </div>`;
        }
      }
      bH+=`<div style="position:absolute;left:0;top:${y}px;width:100%;height:${ROW_H}px;border-bottom:1px solid #1a1a1a;background:${sel?'rgba(245,200,0,.06)':''};pointer-events:none;"></div>`;
    }

    const ev=document.getElementById('g-esq-v');if(ev)ev.innerHTML=rH;
    if(ganttVisible){
      const dv=document.getElementById('g-dir-v');
      if(dv){
        const hojeEl=document.getElementById('gantt-hoje');
        const hojeHTML=hojeEl?hojeEl.outerHTML:'';
        dv.innerHTML=bH+hojeHTML;
      } else {
        console.warn('g-dir-v NÃO ENCONTRADO — Gantt não renderiza barras');
      }
    }
  }

  // ===================== INLINE EDIT =====================
  function _editCell(e, idx, colId){
    e.stopPropagation();
    const t=filtradas[idx]; if(!t)return;
    selectedIdx=idx;
    const cell=e.currentTarget;
    const map={codigo:'codigo',nome:'nome',inicio:'inicioPlanejado',termino:'terminoPlanejado',
      duracao:'duracao',percEsp:'percentualEsperado',percConc:'percentualConcluido',
      predecessora:'predecessora',responsavel:'responsavel',local:'local',grupo:'grupo',nivel:'nivel'};
    const field=map[colId]; if(!field)return;
    const val=t[field]||'';
    const isDate=colId==='inicio'||colId==='termino';
    const isNum=colId==='duracao'||colId==='percEsp'||colId==='percConc'||colId==='nivel';

    const input=document.createElement('input');
    input.type=isDate?'date':isNum?'number':'text';
    input.value=val;
    input.style.cssText='width:100%;height:100%;border:2px solid var(--cor-primaria);background:#1a1a1a;color:#fff;padding:0 4px;font-size:.78rem;font-family:inherit;outline:none;box-sizing:border-box;border-radius:3px;';
    if(isNum){input.min='0';if(colId==='percEsp'||colId==='percConc')input.max='100';}
    cell.innerHTML='';
    cell.appendChild(input);
    input.focus();
    input.select();

    const save=async()=>{
      let v=input.value.trim();
      if(isNum)v=parseFloat(v)||0;
      if(field==='duracao')v=parseInt(v)||0;
      try{
        await Database.atualizar(obraId,COL,t.id,{[field]:v});
        t[field]=v; // update local
        _paintRows();
      }catch(er){Utils.toast('Erro ao salvar.','erro');}
    };
    input.addEventListener('blur',save);
    input.addEventListener('keydown',ev=>{
      if(ev.key==='Enter'){ev.preventDefault();input.blur();}
      if(ev.key==='Escape'){input.value=val;input.blur();}
      if(ev.key==='Tab'){ev.preventDefault();input.blur();/* TODO: move to next cell */}
    });
  }

  // ===================== SYNC SCROLL =====================
  function _sync(src){
    const es=document.getElementById('g-esq-s');
    const ds=document.getElementById('g-dir-s');
    const hd=document.getElementById('g-hdr-d');
    if(src===es&&ds){ds.scrollTop=es.scrollTop;}
    else if(src===ds&&es){es.scrollTop=ds.scrollTop;if(hd)hd.scrollLeft=ds.scrollLeft;}
    if(_rafId)cancelAnimationFrame(_rafId);
    _rafId=requestAnimationFrame(()=>_paintRows());
  }

  // ===================== TOGGLE GANTT =====================
  function toggleGantt(){
    ganttVisible=!ganttVisible;
    _render(); // re-render completely since DOM structure changes
  }

  // ===================== DATE HEADERS =====================
  function _buildDateHeader(dMin,dMax,lpd,W){
    const M=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    let h='';
    if(zoomGantt==='dia'){
      let d=new Date(dMin),lm=-1;
      while(d<=dMax){
        const x=Math.round((d-dMin)/864e5*lpd);
        if(d.getMonth()!==lm){h+=`<div style="position:absolute;left:${x}px;top:1px;font-size:.5rem;color:#666;">${M[d.getMonth()]} ${d.getFullYear()}</div>`;lm=d.getMonth();}
        const we=d.getDay()===0||d.getDay()===6;
        h+=`<div style="position:absolute;left:${x}px;top:0;bottom:0;border-left:1px solid rgba(255,255,255,${we?'.07':'.03'});"></div>`;
        h+=`<div style="position:absolute;left:${x+1}px;top:13px;font-size:.5rem;color:${we?'#555':'#444'};">${d.getDate()}</div>`;
        d.setDate(d.getDate()+1);
      }
    } else if(zoomGantt==='semana'){
      let d=new Date(dMin);d.setDate(d.getDate()-(d.getDay()||7)+1);let lm=-1;
      while(d<=dMax){
        const x=Math.round((d-dMin)/864e5*lpd);
        if(d.getMonth()!==lm){h+=`<div style="position:absolute;left:${x}px;top:1px;font-size:.5rem;color:#666;">${M[d.getMonth()]} ${d.getFullYear()}</div>`;lm=d.getMonth();}
        h+=`<div style="position:absolute;left:${x}px;top:0;bottom:0;border-left:1px solid rgba(255,255,255,.05);"></div>`;
        h+=`<div style="position:absolute;left:${x+1}px;top:13px;font-size:.48rem;color:#444;">${d.getDate()}</div>`;
        d.setDate(d.getDate()+7);
      }
    } else if(zoomGantt==='mes'){
      let d=new Date(dMin.getFullYear(),dMin.getMonth(),1);
      while(d<=dMax){const x=Math.round((d-dMin)/864e5*lpd);
        h+=`<div style="position:absolute;left:${x}px;top:0;bottom:0;border-left:1px solid rgba(255,255,255,.06);"></div>`;
        h+=`<div style="position:absolute;left:${x+3}px;top:6px;font-size:.58rem;color:#555;">${M[d.getMonth()]} ${d.getFullYear()}</div>`;
        d.setMonth(d.getMonth()+1);}
    } else if(zoomGantt==='trimestre'){
      let d=new Date(dMin.getFullYear(),Math.floor(dMin.getMonth()/3)*3,1);
      while(d<=dMax){const x=Math.round((d-dMin)/864e5*lpd);
        h+=`<div style="position:absolute;left:${x}px;top:0;bottom:0;border-left:1px solid rgba(255,255,255,.06);"></div>`;
        h+=`<div style="position:absolute;left:${x+3}px;top:6px;font-size:.6rem;color:#555;">T${Math.floor(d.getMonth()/3)+1} ${d.getFullYear()}</div>`;
        d.setMonth(d.getMonth()+3);}
    } else {
      for(let y=dMin.getFullYear();y<=dMax.getFullYear()+1;y++){
        const x=Math.round((new Date(y,0,1)-dMin)/864e5*lpd);
        h+=`<div style="position:absolute;left:${x}px;top:0;bottom:0;border-left:1px solid rgba(255,255,255,.06);"></div>`;
        h+=`<div style="position:absolute;left:${x+3}px;top:6px;font-size:.65rem;color:#555;font-weight:700;">${y}</div>`;}
    }
    return h;
  }

  // ===================== COLUMN RESIZE =====================
  function _colResizeStart(e, colId){
    e.preventDefault();e.stopPropagation();
    const sx=e.clientX, sw=colLarguras[colId]||60;
    const move=ev=>{
      colLarguras[colId]=Math.max(30,sw+(ev.clientX-sx));
      _render();
    };
    // Throttle: only update on animation frame
    let pending=false;
    const moveT=ev=>{if(!pending){pending=true;requestAnimationFrame(()=>{colLarguras[colId]=Math.max(30,sw+(ev.clientX-sx));_render();pending=false;});}};
    const up=()=>{document.removeEventListener('mousemove',moveT);document.removeEventListener('mouseup',up);};
    document.addEventListener('mousemove',moveT);document.addEventListener('mouseup',up);
  }

  // ===================== COLUMN DRAG REORDER =====================
  let _dragColId=null;
  function _colDragStart(e, colId){if(COL_FIXED.has(colId)){e.preventDefault();return;}_dragColId=colId;e.dataTransfer.effectAllowed='move';}
  function _colDrop(e, targetId){
    e.preventDefault();if(!_dragColId||_dragColId===targetId||COL_FIXED.has(targetId))return;
    const from=colOrdem.indexOf(_dragColId);
    const to=colOrdem.indexOf(targetId);
    if(from<0||to<0)return;
    colOrdem.splice(from,1);
    colOrdem.splice(to,0,_dragColId);
    _dragColId=null;
    _render();
  }

  // ===================== COLUMN HIDE/SHOW =====================
  function hideCol(id){if(COL_FIXED.has(id))return;colsHidden.add(id);_render();}
  function showColsMenu(){
    const hidden=[...colsHidden];if(!hidden.length)return;
    let pop=document.getElementById('sc-pop');if(pop){pop.remove();return;}
    pop=document.createElement('div');pop.id='sc-pop';
    pop.style.cssText='position:fixed;top:90px;right:20px;background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:12px;z-index:1000;min-width:180px;box-shadow:0 8px 32px rgba(0,0,0,.5);';
    pop.innerHTML='<div style="font-weight:700;color:var(--cor-primaria);margin-bottom:8px;font-size:.82rem;">Colunas ocultas</div>'+
      hidden.map(id=>`<button class="btn btn-secundario btn-sm" style="display:block;width:100%;margin-bottom:3px;text-align:left;font-size:.75rem;" onclick="Planejamento._showCol('${id}')">+ ${COL_LABELS[id]||id}</button>`).join('')+
      '<button class="btn btn-primario btn-sm" style="width:100%;margin-top:6px;font-size:.75rem;" onclick="Planejamento._showAll()">Mostrar todas</button>';
    document.body.appendChild(pop);
    setTimeout(()=>document.addEventListener('click',function h(e){if(!pop.contains(e.target)){pop.remove();document.removeEventListener('click',h);}},false),50);
  }
  function _showCol(id){colsHidden.delete(id);const p=document.getElementById('sc-pop');if(p)p.remove();_render();}
  function _showAll(){colsHidden.clear();const p=document.getElementById('sc-pop');if(p)p.remove();_render();}

  // ===================== DIVIDER =====================
  function _divStart(e){
    e.preventDefault();const sx=e.clientX,sw=splitX;
    const move=ev=>{splitX=Math.max(250,Math.min(900,sw+(ev.clientX-sx)));const el=document.getElementById('g-esq');if(el)el.style.width=splitX+'px';};
    const up=()=>{document.removeEventListener('mousemove',move);document.removeEventListener('mouseup',up);};
    document.addEventListener('mousemove',move);document.addEventListener('mouseup',up);
  }

  // ===================== HIERARCHY =====================
  function toggleRecolher(id){if(colsRecolhidas.has(id))colsRecolhidas.delete(id);else colsRecolhidas.add(id);_buildFiltradas();_render();}

  async function recuarNivel(id){await _moverNivel(id,-1);}
  async function avancarNivel(id){await _moverNivel(id,1);}
  async function _moverNivel(id,diff){
    const t=tarefas.find(x=>x.id===id);
    if(!t){console.error('Tarefa não encontrada:',id);return;}
    if(diff<0&&(t.nivel||0)<=0){Utils.toast('Já está no nível mínimo.','alerta');return;}
    
    const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    const idx=sorted.findIndex(x=>x.id===id);
    if(idx<0){console.error('Índice não encontrado');return;}
    
    // Coleta tarefa + filhos (tudo abaixo com nível maior)
    const updates=[{id:t.id,nivel:Math.max(0,(t.nivel||0)+diff)}];
    for(let i=idx+1;i<sorted.length;i++){
      if((sorted[i].nivel||0)>(t.nivel||0)){
        updates.push({id:sorted[i].id,nivel:Math.max(0,(sorted[i].nivel||0)+diff)});
      } else break;
    }
    
    console.log('Movendo nível:',diff,'para',updates.length,'tarefas');
    
    // Atualiza localmente PRIMEIRO (responsividade)
    updates.forEach(u=>{
      const tt=tarefas.find(x=>x.id===u.id);
      if(tt)tt.nivel=u.nivel;
    });
    _buildFiltradas();
    _render();
    requestAnimationFrame(()=>_paintRows());
    
    // Salva no Firestore em background (lotes de 20)
    const LOTE=20;
    for(let i=0;i<updates.length;i+=LOTE){
      const batch=updates.slice(i,i+LOTE);
      await Promise.all(batch.map(u=>
        Database.atualizar(obraId,COL,u.id,{nivel:u.nivel}).catch(e=>console.error('Erro update:',u.id,e))
      ));
    }
  }

  // ===================== CRUD =====================
  function selectIdx(i){selectedIdx=i;_paintRows();}

  function inserirTarefa(){
    editandoId=null;
    document.getElementById('modal-tarefa-titulo').textContent='Nova Tarefa';
    document.getElementById('form-tarefa').reset();
    if(selectedIdx>=0&&filtradas[selectedIdx]){
      const sel=filtradas[selectedIdx];
      const f=document.getElementById('form-tarefa');
      f.querySelector('[name="nivel"]').value=sel.nivel||0;
      f.querySelector('[name="grupo"]').value=sel.grupo||'';
      f.querySelector('[name="local"]').value=sel.local||'';
      f.querySelector('[name="ordem"]').value=(sel.ordem||0)+1;
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
    ['codigo','nome','tipo','nivel','ordem','inicioPlanejado','terminoPlanejado','duracao',
      'percentualEsperado','percentualConcluido','predecessora','tarefaPai','grupo','local',
      'custo','receita','responsavel','inicioPlanejadoBase','terminoPlanejadoBase',
      'inicioDesafio','terminoDesafio','observacoes'].forEach(k=>{
      const el=f.querySelector(`[name="${k}"]`);if(el&&t[k]!=null)el.value=t[k];
    });
    Utils.abrirModal('modal-tarefa');
  }

  async function salvarTarefa(){
    const f=document.getElementById('form-tarefa');
    const g=n=>f.querySelector(`[name="${n}"]`)?.value;
    const nome=g('nome')?.trim();if(!nome){Utils.toast('Nome obrigatório.','alerta');return;}
    const ini=g('inicioPlanejado'),ter=g('terminoPlanejado');
    let dur=parseInt(g('duracao'))||0;
    if(ini&&ter&&!dur)dur=Math.max(0,Math.ceil((new Date(ter)-new Date(ini))/864e5));
    const data={tipo:g('tipo')||'tarefa',codigo:g('codigo')||'',nome,nivel:parseInt(g('nivel'))||0,
      ordem:parseFloat(g('ordem'))||tarefas.length+1,inicioPlanejado:ini||'',terminoPlanejado:ter||'',duracao:dur,
      percentualEsperado:parseFloat(g('percentualEsperado'))||0,percentualConcluido:parseFloat(g('percentualConcluido'))||0,
      predecessora:g('predecessora')||'',tarefaPai:g('tarefaPai')||'',grupo:g('grupo')||'',local:g('local')||'',
      custo:parseFloat(g('custo'))||0,receita:parseFloat(g('receita'))||0,responsavel:g('responsavel')||'',
      inicioPlanejadoBase:g('inicioPlanejadoBase')||'',terminoPlanejadoBase:g('terminoPlanejadoBase')||'',
      inicioDesafio:g('inicioDesafio')||'',terminoDesafio:g('terminoDesafio')||'',observacoes:g('observacoes')||'',obraId};
    try{
      if(editandoId)await Database.atualizar(obraId,COL,editandoId,data);
      else await Database.criar(obraId,COL,data);
      Utils.fecharModal('modal-tarefa');Utils.toast('Salvo!','sucesso');editandoId=null;await carregar();
    }catch(e){console.error(e);Utils.toast('Erro.','erro');}
  }

  async function excluirTarefa(id){
    const t=tarefas.find(x=>x.id===id);if(!confirm(`Excluir "${t?.nome}"?`))return;
    try{await Database.deletar(obraId,COL,id);Utils.toast('Excluído.','sucesso');selectedIdx=-1;await carregar();}
    catch(e){Utils.toast('Erro.','erro');}
  }

  // ===================== IMPORTAR =====================
  async function importarExcel(event){
    const file=event.target.files[0];if(!file)return;event.target.value='';
    if(!confirm(`Importar substituirá as ${tarefas.length} tarefas atuais. Confirmar?`))return;
    try{
      Utils.mostrarLoading('Lendo...');
      if(typeof XLSX==='undefined')await _ls('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
      const ab=await file.arrayBuffer();
      const wb=XLSX.read(ab,{type:'array'});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
      if(rows.length<2){Utils.toast('Planilha vazia.','alerta');return;}
      const hdrs=rows[0].map(h=>String(h||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' '));
      const ci=n=>{const a={id:['id'],codigo:['codigo','code'],nome:['nome','name','tarefa'],duracao:['duracao','duration'],
        inicio:['inicio','start','inicio planejado'],termino:['termino','finish','fim','termino planejado'],
        percEsp:['esperado','% esperado'],percConc:['concluido','% concluido','% complete'],
        pred:['predecessora','predecessor','prececessora'],pai:['tarefa pai','parent'],grupo:['grupo','group'],
        local:['local','location'],custo:['custo','cost'],receita:['receita','revenue'],
        resp:['responsavel','responsible','resource'],iniB:['inicio linha de base'],terB:['termino linha de base'],
        iniD:['inicio desafio'],terD:['termino desafio']};
        for(const al of(a[n]||[])){const i=hdrs.indexOf(al);if(i>=0)return i;}return-1;};
      const iN=ci('nome');if(iN<0){Utils.toast('Coluna Nome não encontrada.','erro');return;}
      Utils.mostrarLoading('Limpando...');
      const L=200;
      for(let i=0;i<tarefas.length;i+=L)await Promise.all(tarefas.slice(i,i+L).map(t=>Database.deletar(obraId,COL,t.id).catch(()=>{})));
      const regs=[];
      for(let r=1;r<rows.length;r++){
        const row=rows[r],nR=String(row[iN]||''),nm=nR.trim();if(!nm)continue;
        const cd=String(row[ci('codigo')]||'').trim();
        // Nível: pelo código (1=0, 1.1=1, 1.1.1=2) OU pelo recuo de espaços
        const pts=(cd.match(/\./g)||[]).length;
        const nivelByCod=pts; // 0 pontos = nível 0, 1 ponto = nível 1, etc.
        const nivelBySpace=Math.floor((nR.length-nR.trimStart().length)/2);
        const niv=cd?nivelByCod:nivelBySpace; // prioriza código se existir
        const tipo=pts<=1&&cd?'grupo':'tarefa';
        regs.push({tipo,codigo:cd,nome:nm,nivel:niv,ordem:regs.length+1,
          inicioPlanejado:_pd(row[ci('inicio')]),terminoPlanejado:_pd(row[ci('termino')]),
          duracao:_pDur(row[ci('duracao')]),percentualEsperado:_pN(row[ci('percEsp')]),
          percentualConcluido:_pN(row[ci('percConc')]),predecessora:String(row[ci('pred')]||'').trim(),
          tarefaPai:String(row[ci('pai')]||'').trim(),grupo:String(row[ci('grupo')]||'').trim(),
          local:String(row[ci('local')]||'').trim(),custo:_pN(row[ci('custo')]),receita:_pN(row[ci('receita')]),
          responsavel:String(row[ci('resp')]||'').trim(),inicioPlanejadoBase:_pd(row[ci('iniB')]),
          terminoPlanejadoBase:_pd(row[ci('terB')]),inicioDesafio:_pd(row[ci('iniD')]),
          terminoDesafio:_pd(row[ci('terD')]),obraId});
      }
      let imp=0;
      for(let i=0;i<regs.length;i+=L){
        Utils.mostrarLoading(`Importando ${Math.min(i+L,regs.length)}/${regs.length}...`);
        await Promise.all(regs.slice(i,i+L).map(d=>Database.criar(obraId,COL,d).then(()=>imp++).catch(console.error)));
      }
      Utils.toast(`✅ ${imp} tarefas importadas!`,'sucesso');await carregar();
    }catch(e){console.error(e);Utils.toast('Erro: '+e.message,'erro');}finally{Utils.esconderLoading();}
  }

  // ===================== EXPORTAR =====================
  async function exportar(){
    try{Utils.mostrarLoading('Gerando...');
      if(typeof XLSX==='undefined')await _ls('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
      const H=['ID','Código','Nome','Duração','Início','Término','% Esperado','% Concluído',
        'Prececessora','Tarefa Pai','Grupo','Local','Custo','Receita','Responsável',
        'Inicio Linha de Base','Termino Linha de Base','Inicio Desafio','Termino Desafio'];
      const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
      const rows=sorted.map((t,i)=>[i+1,t.codigo||'','  '.repeat(t.nivel||0)+(t.nome||''),
        t.duracao?t.duracao+'d':'',_fBR(t.inicioPlanejado),_fBR(t.terminoPlanejado),
        t.percentualEsperado||0,t.percentualConcluido||0,t.predecessora||'',t.tarefaPai||'',
        t.grupo||'',t.local||'',t.custo||0,t.receita||0,t.responsavel||'',
        _fBR(t.inicioPlanejadoBase),_fBR(t.terminoPlanejadoBase),_fBR(t.inicioDesafio),_fBR(t.terminoDesafio)]);
      const ws=XLSX.utils.aoa_to_sheet([H,...rows]);
      ws['!cols']=[{wch:6},{wch:10},{wch:45},{wch:8},{wch:13},{wch:13},{wch:11},{wch:11},
        {wch:13},{wch:20},{wch:18},{wch:15},{wch:10},{wch:10},{wch:18},{wch:22},{wch:22},{wch:15},{wch:15}];
      const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Cronograma');
      const obra=Router.getObra();
      XLSX.writeFile(wb,`cronograma_${(obra?.nome||'obra').replace(/[^a-z0-9]/gi,'_')}.xlsx`);
      Utils.toast('Exportado!','sucesso');
    }catch(e){Utils.toast('Erro: '+e.message,'erro');}finally{Utils.esconderLoading();}
  }

  // ===================== EXPORTAR PNG =====================
  async function exportarPNG(){
    const container=document.getElementById('gantt-c');
    if(!container){Utils.toast('Abra o Gantt primeiro.','alerta');return;}
    try{
      Utils.mostrarLoading('Gerando imagem completa...');
      if(typeof html2canvas==='undefined')await _ls('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
      // Temporarily expand to show all content
      const esqS=document.getElementById('g-esq-s');
      const dirS=document.getElementById('g-dir-s');
      const oldEH=esqS?.style.height, oldDH=dirS?.style.height;
      const oldCH=container.style.height;
      const totalH=filtradas.length*ROW_H+30;
      container.style.height=totalH+'px';
      if(esqS){esqS.style.height=totalH+'px';esqS.style.overflow='visible';}
      if(dirS){dirS.style.height=totalH+'px';dirS.style.overflow='visible';}
      // Force paint all rows
      const origSt=esqS?.scrollTop||0;
      if(esqS)esqS.scrollTop=0;
      // Paint all rows (not just viewport)
      const ev=document.getElementById('g-esq-v');
      const dv=document.getElementById('g-dir-v');
      // Save and restore after screenshot
      _paintAllRows();
      await new Promise(r=>setTimeout(r,200));
      const canvas=await html2canvas(container,{backgroundColor:'#0d0d0d',scale:1.5,logging:false,windowHeight:totalH+100});
      // Restore
      container.style.height=oldCH||'';
      if(esqS){esqS.style.height=oldEH||'';esqS.style.overflow='auto';esqS.scrollTop=origSt;}
      if(dirS){dirS.style.height=oldDH||'';dirS.style.overflow='auto';}
      _paintRows();
      const link=document.createElement('a');link.download=`gantt_${new Date().toISOString().split('T')[0]}.png`;
      link.href=canvas.toDataURL('image/png');link.click();
      Utils.toast('Gantt exportado como PNG!','sucesso');
    }catch(e){Utils.toast('Erro: '+e.message,'erro');}finally{Utils.esconderLoading();}
  }
  function _paintAllRows(){
    // Paint ALL rows for PNG export
    const visCols=colOrdem.filter(id=>!colsHidden.has(id));
    // Same as _paintRows but with s=0, e=filtradas.length
    const orig_s=0, orig_e=filtradas.length;
    // Reuse _paintRows logic by temporarily changing viewport
    const ev=document.getElementById('g-esq-v');
    const dv=document.getElementById('g-dir-v');
    // Just call with full range - simplify
    const hoje=new Date();
    const datas=filtradas.flatMap(t=>[t.inicioPlanejado,t.terminoPlanejado].filter(Boolean).map(d=>new Date(d)));
    const dMin=datas.length?new Date(Math.min(...datas)):new Date(hoje.getTime()-30*864e5);
    dMin.setDate(dMin.getDate()-5);
    const lpd={dia:32,semana:8,mes:3,trimestre:1.2,ano:0.4}[zoomGantt]||3;
    let rH='',bH='';
    for(let i=0;i<filtradas.length;i++){
      const t=filtradas[i],y=i*ROW_H;
      const st2=_status(t),perc=_perc(t),isG=t.tipo==='grupo';
      let cells='';
      for(const cid of visCols){
        const w=cid==='nome'?'flex:1;min-width:150px;':`width:${colLarguras[cid]||60}px;flex-shrink:0;`;
        const base=`${w}overflow:hidden;white-space:nowrap;text-overflow:ellipsis;padding:0 4px;font-size:.78rem;height:100%;display:flex;align-items:center;`;
        if(cid==='num')cells+=`<div style="${base}color:#444;font-size:.65rem;justify-content:center;">${i+1}</div>`;
        else if(cid==='nivel')cells+=`<div style="${base}color:#666;font-size:.68rem;justify-content:center;">${t.nivel||0}</div>`;
        else if(cid==='codigo')cells+=`<div style="${base}color:#555;font-size:.7rem;">${t.codigo||''}</div>`;
        else if(cid==='nome'){const ind=(t.nivel||0)*14;cells+=`<div style="${base}padding-left:${ind+4}px;color:${isG?'var(--cor-primaria)':'#ccc'};font-weight:${isG?700:400};">${t.nome||''}</div>`;}
        else if(cid==='inicio')cells+=`<div style="${base}color:#666;font-size:.7rem;justify-content:center;">${_fd(t.inicioPlanejado)}</div>`;
        else if(cid==='termino')cells+=`<div style="${base}color:#666;font-size:.7rem;justify-content:center;">${_fd(t.terminoPlanejado)}</div>`;
        else if(cid==='duracao')cells+=`<div style="${base}color:#666;font-size:.7rem;justify-content:center;">${t.duracao||'—'}</div>`;
        else if(cid==='percEsp')cells+=`<div style="${base}color:#555;font-size:.7rem;justify-content:center;">${t.percentualEsperado||0}%</div>`;
        else if(cid==='percConc')cells+=`<div style="${base}font-size:.7rem;justify-content:center;color:${perc>=100?'#16a34a':perc>0?'#2563eb':'#555'};">${perc}%</div>`;
        else if(cid==='predecessora')cells+=`<div style="${base}color:#555;font-size:.7rem;justify-content:center;">${t.predecessora||'—'}</div>`;
        else if(cid==='responsavel')cells+=`<div style="${base}color:#555;font-size:.7rem;">${t.responsavel||'—'}</div>`;
        else if(cid==='local')cells+=`<div style="${base}color:#555;font-size:.7rem;">${t.local||'—'}</div>`;
        else if(cid==='grupo')cells+=`<div style="${base}color:#555;font-size:.7rem;">${t.grupo||'—'}</div>`;
        else if(cid==='acoes')cells+=`<div style="${base}"></div>`;
      }
      rH+=`<div style="position:absolute;top:${y}px;left:0;right:0;height:${ROW_H}px;display:flex;align-items:center;border-bottom:1px solid #1a1a1a;">${cells}</div>`;
      if(ganttVisible&&t.inicioPlanejado&&t.terminoPlanejado){
        const bx=Math.round((new Date(t.inicioPlanejado)-dMin)/864e5*lpd);
        const bw=Math.max(4,Math.round((new Date(t.terminoPlanejado)-new Date(t.inicioPlanejado))/864e5*lpd));
        const cor={nao_iniciado:'#333',em_andamento:'#1d4ed8',concluido:'#15803d',atrasado:'#dc2626'}[st2]||'#333';
        if(isG)bH+=`<div style="position:absolute;left:${bx}px;top:${y+13}px;width:${bw}px;height:5px;background:var(--cor-primaria);"></div>`;
        else bH+=`<div style="position:absolute;left:${bx}px;top:${y+5}px;width:${bw}px;height:20px;background:${cor};border-radius:3px;overflow:hidden;"><div style="height:100%;width:${perc}%;background:rgba(255,255,255,.25);"></div></div>`;
      }
    }
    if(ev)ev.innerHTML=rH;
    if(dv)dv.innerHTML=bH;
  }

  // ===================== HELPERS =====================
  function _status(t){if(!t.inicioPlanejado)return'nao_iniciado';if(_perc(t)>=100)return'concluido';
    const h=new Date(),f=t.terminoPlanejado?new Date(t.terminoPlanejado):null;
    if(_perc(t)>0)return f&&h>f?'atrasado':'em_andamento';return f&&h>f?'atrasado':'nao_iniciado';}
  function _perc(t){return Math.round(t.percentualConcluido||0);}
  function _fd(d){if(!d)return'—';try{return new Date(d+'T12:00:00').toLocaleDateString('pt-BR');}catch(e){return d;}}
  function _fBR(d){if(!d)return'';try{return new Date(d+'T12:00:00').toLocaleDateString('pt-BR');}catch(e){return'';}}
  function _pd(v){if(!v)return'';if(v instanceof Date)return v.toISOString().split('T')[0];
    if(typeof v==='number')return new Date((v-25569)*864e5).toISOString().split('T')[0];
    const s=String(v).trim(),m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if(m)return`${m[3]}-${m[2]}-${m[1]}`;if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.split('T')[0];return'';}
  function _pDur(v){return parseInt(String(v||'').replace(/\D/g,''))||0;}
  function _pN(v){return parseFloat(String(v||'').replace(',','.'))||0;}
  function _ls(src){return new Promise((r,j)=>{const s=document.createElement('script');s.src=src;s.onload=r;s.onerror=j;document.head.appendChild(s);});}
  function setZoom(z){zoomGantt=z;_render();}

  return{init,carregar,setZoom,insertTarefa:inserirTarefa,inserirTarefa,editarTarefa,salvarTarefa,excluirTarefa,
    selectIdx,toggleRecolher,recuarNivel,avancarNivel,
    toggleGantt,hideCol,showColsMenu,_showCol,_showAll,
    _colResizeStart,_colDragStart,_colDrop,_divStart,_sync,_editCell,
    importarExcel,exportar,exportarPNG};
})();
function onObraChanged(){Planejamento.init();}

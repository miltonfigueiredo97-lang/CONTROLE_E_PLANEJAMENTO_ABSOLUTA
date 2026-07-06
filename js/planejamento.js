// ============================================
// Planejamento — V1.3
// Gantt hierárquico tipo MS Project
// ============================================
const Planejamento = (() => {
  let obraId=null, tarefas=[];
  let abaAtiva='gantt', zoomGantt='mes';
  let editandoId=null;
  let selectedId=null; // linha selecionada
  let colsVisiveis={codigo:true,nome:true,inicio:true,termino:true,duracao:true,percEsp:true,percConc:true,responsavel:true,local:true,grupo:true,custo:false,receita:false,predecessora:false};
  let splitX=420; // largura painel esquerdo do Gantt
  let colsRecolhidas=new Set(); // IDs de grupos recolhidos
  const COL='tarefas';

  // ===================== INIT =====================
  async function init(){
    const ok=await Utils.initPagina({requireObra:true});if(!ok)return;
    obraId=Router.getObraId();
    if(!obraId){
      const c=document.getElementById('planejamento-content');
      if(c)c.innerHTML='<div class="estado-vazio"><div class="icone">📅</div><p>Selecione uma obra.</p></div>';
      return;
    }
    document.addEventListener('keydown',_onKey);
    await carregar();
  }

  async function carregar(){
    try{
      Utils.mostrarLoading('Carregando...');
      tarefas=await Database.listar(obraId,COL,'ordem').catch(()=>[]);
      renderizar();
    }catch(e){console.error(e);Utils.toast('Erro.','erro');}
    finally{Utils.esconderLoading();}
  }

  // ===================== TECLADO =====================
  function _onKey(e){
    if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.tagName==='SELECT')return;
    if((e.ctrlKey||e.metaKey)&&e.key==='+'){e.preventDefault();novaTarefa();}
    if((e.ctrlKey||e.metaKey)&&e.key==='-'){e.preventDefault();if(selectedId)excluirTarefa(selectedId);}
  }

  // ===================== RENDER =====================
  function renderizar(){
    const c=document.getElementById('planejamento-content');if(!c)return;
    const abas=[{id:'gantt',icon:'📊',label:'Gantt'},{id:'tabela',icon:'📋',label:'Tabela'}];
    c.innerHTML=`
      <div class="plan-header">
        <div class="plan-abas">
          ${abas.map(a=>`<button class="plan-aba${abaAtiva===a.id?' ativo':''}" onclick="Planejamento.setAba('${a.id}')">${a.icon} ${a.label}</button>`).join('')}
        </div>
        <div class="plan-actions" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
          <label class="btn btn-secundario btn-sm" style="cursor:pointer;">📥 Importar<input type="file" accept=".xlsx,.xls" style="display:none" onchange="Planejamento.importarExcel(event)"></label>
          <button class="btn btn-secundario btn-sm" onclick="Planejamento.exportar()">📤 Exportar</button>
          <button class="btn btn-secundario btn-sm" onclick="Planejamento.exportarGanttPDF()">🖼 Gantt PDF</button>
          <button class="btn btn-secundario btn-sm" onclick="Planejamento.toggleColunas()">⚙ Colunas</button>
          <button class="btn btn-primario btn-sm" onclick="Planejamento.novaTarefa()">＋ Tarefa <kbd style="font-size:0.6rem;opacity:.6;">Ctrl++</kbd></button>
        </div>
      </div>
      <div id="plan-corpo">${_renderCorpo()}</div>`;
  }

  function _renderCorpo(){
    if(abaAtiva==='gantt')return _renderGantt();
    return _renderTabela();
  }

  // ===================== GANTT =====================
  function _renderGantt(){
    const tf=_visiveis();
    if(!tf.length)return `<div class="estado-vazio"><div class="icone">📅</div>
      <p>Nenhuma tarefa. Importe um Excel ou crie manualmente.</p>
      <button class="btn btn-primario" onclick="Planejamento.novaTarefa()">+ Criar tarefa</button></div>`;

    const hoje=new Date();
    const colunas=_colsAtivas();
    const ROW=34;

    // Calcular datas mín/máx para o Gantt
    const datas=tf.flatMap(t=>[t.inicioPlanejado,t.terminoPlanejado].filter(Boolean).map(d=>new Date(d)));
    const dMin=datas.length?new Date(Math.min(...datas)):new Date(hoje.getTime()-30*864e5);
    const dMax=datas.length?new Date(Math.max(...datas)):new Date(hoje.getTime()+60*864e5);
    dMin.setDate(dMin.getDate()-3); dMax.setDate(dMax.getDate()+10);
    const lpd={dia:40,semana:14,mes:5,trimestre:2,ano:1}[zoomGantt]||5;
    const totalDias=Math.ceil((dMax-dMin)/864e5);
    const W=Math.max(600,totalDias*lpd);

    // Header datas do Gantt
    const meses=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    let hDatas='', lastM=-1, lastY=-1;
    let d=new Date(dMin);
    while(d<=dMax){
      const x=Math.round((d-dMin)/864e5*lpd);
      const m=d.getMonth(), y=d.getFullYear();
      if(m!==lastM||y!==lastY){
        hDatas+=`<div style="position:absolute;left:${x}px;top:0;bottom:0;border-left:1px solid rgba(255,255,255,0.06);"></div>`;
        hDatas+=`<div style="position:absolute;left:${x+4}px;top:6px;font-size:0.65rem;color:#666;white-space:nowrap;">${meses[m]} ${y}</div>`;
        lastM=m; lastY=y;
      }
      if(zoomGantt==='semana'&&d.getDay()===1){
        hDatas+=`<div style="position:absolute;left:${x}px;top:0;bottom:0;border-left:1px solid rgba(255,255,255,0.04);"></div>`;
      }
      if(zoomGantt==='dia'){
        hDatas+=`<div style="position:absolute;left:${x}px;top:14px;font-size:0.6rem;color:#444;">${d.getDate()}</div>`;
      }
      d.setDate(d.getDate()+1);
    }
    const hojeX=Math.round((hoje-dMin)/864e5*lpd);

    // Linhas da tabela esquerda + barras do Gantt
    let linhasHtml='', barrasHtml='';
    tf.forEach((t,i)=>{
      const st=_status(t), perc=_perc(t), percEsp=t.percentualEsperado||0;
      const isSel=t.id===selectedId;
      const isGrupo=t.tipo==='grupo';
      const ind=(t.nivel||0)*16;
      const bg=isSel?'rgba(245,200,0,0.12)':(i%2?'rgba(255,255,255,0.015)':'transparent');
      const y=i*ROW;

      // Célula nome com toggle se grupo
      const temFilhos=tarefas.some(x=>x.tarefaPai===t.nome||x.tarefaPai===t.codigo);
      const toggleBtn=isGrupo&&temFilhos
        ?`<span onclick="Planejamento.toggleRecolher('${t.id}')" style="cursor:pointer;margin-right:4px;color:#888;font-size:0.7rem;">${colsRecolhidas.has(t.id)?'▶':'▼'}</span>`
        :'<span style="display:inline-block;width:14px;margin-right:4px;"></span>';

      let cells='<div style="width:28px;flex-shrink:0;display:flex;align-items:center;justify-content:center;">';
      cells+=`<span class="status-dot ${st}" onclick="Planejamento.selectTarefa('${t.id}')" style="cursor:pointer;"></span></div>`;

      if(colsVisiveis.codigo) cells+=`<div style="width:64px;flex-shrink:0;font-family:var(--font-mono);font-size:0.7rem;color:#555;padding:0 4px;overflow:hidden;">${t.codigo||''}</div>`;

      // Nome (sempre visível)
      cells+=`<div style="flex:1;min-width:0;padding-left:${ind}px;display:flex;align-items:center;overflow:hidden;cursor:pointer;"
        onclick="Planejamento.selectTarefa('${t.id}')" ondblclick="Planejamento.editarTarefa('${t.id}')">
        ${toggleBtn}
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.82rem;
          color:${isGrupo?'var(--cor-primaria)':'#ccc'};font-weight:${isGrupo?'700':'400'};" title="${t.nome}">${t.nome}</span>
      </div>`;

      if(colsVisiveis.inicio)   cells+=`<div style="width:82px;flex-shrink:0;font-size:0.72rem;color:#666;text-align:center;">${_fd(t.inicioPlanejado)}</div>`;
      if(colsVisiveis.termino)  cells+=`<div style="width:82px;flex-shrink:0;font-size:0.72rem;color:#666;text-align:center;">${_fd(t.terminoPlanejado)}</div>`;
      if(colsVisiveis.duracao)  cells+=`<div style="width:44px;flex-shrink:0;font-size:0.72rem;color:#666;text-align:center;">${t.duracao||'—'}</div>`;
      if(colsVisiveis.percEsp)  cells+=`<div style="width:44px;flex-shrink:0;font-size:0.72rem;color:#666;text-align:center;">${percEsp}%</div>`;
      if(colsVisiveis.percConc) cells+=`<div style="width:44px;flex-shrink:0;font-size:0.72rem;text-align:center;color:${perc>=100?'#16a34a':perc>0?'#2563eb':'#555'};">${perc}%</div>`;
      if(colsVisiveis.responsavel) cells+=`<div style="width:90px;flex-shrink:0;font-size:0.7rem;color:#555;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 4px;">${t.responsavel||'—'}</div>`;
      if(colsVisiveis.local)    cells+=`<div style="width:80px;flex-shrink:0;font-size:0.7rem;color:#555;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 4px;">${t.local||'—'}</div>`;
      if(colsVisiveis.grupo)    cells+=`<div style="width:80px;flex-shrink:0;font-size:0.7rem;color:#555;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 4px;">${t.grupo||'—'}</div>`;
      if(colsVisiveis.custo)    cells+=`<div style="width:70px;flex-shrink:0;font-size:0.7rem;color:#555;text-align:right;padding-right:6px;">${t.custo?_fMoeda(t.custo):'—'}</div>`;
      if(colsVisiveis.receita)  cells+=`<div style="width:70px;flex-shrink:0;font-size:0.7rem;color:#555;text-align:right;padding-right:6px;">${t.receita?_fMoeda(t.receita):'—'}</div>`;
      if(colsVisiveis.predecessora) cells+=`<div style="width:54px;flex-shrink:0;font-size:0.7rem;color:#555;text-align:center;">${t.predecessora||'—'}</div>`;

      cells+=`<div style="width:52px;flex-shrink:0;display:flex;gap:2px;justify-content:center;padding:2px;">
        <button class="btn btn-sm btn-icon" style="background:#222;color:#aaa;border-color:#333;font-size:0.7rem;" onclick="Planejamento.editarTarefa('${t.id}')">✎</button>
        <button class="btn btn-sm btn-icon btn-perigo" style="font-size:0.7rem;" onclick="Planejamento.excluirTarefa('${t.id}')">✕</button>
      </div>`;

      linhasHtml+=`<div class="gantt-row" data-id="${t.id}" style="height:${ROW}px;display:flex;align-items:center;
        border-bottom:1px solid #1a1a1a;background:${bg};">${cells}</div>`;

      // Barra Gantt
      barrasHtml+=`<div style="position:absolute;left:0;top:${y}px;width:100%;height:${ROW}px;background:${bg};border-bottom:1px solid #1a1a1a;"></div>`;
      if(t.inicioPlanejado&&t.terminoPlanejado){
        const bx=Math.round((new Date(t.inicioPlanejado)-dMin)/864e5*lpd);
        const bw=Math.max(4,Math.round((new Date(t.terminoPlanejado)-new Date(t.inicioPlanejado))/864e5*lpd));
        const by=y+6;
        const bh=22;
        const corSt={nao_iniciado:'#333',em_andamento:'#1d4ed8',concluido:'#15803d',atrasado:'#dc2626'}[st]||'#333';
        if(t.tipo==='marco'){
          barrasHtml+=`<div style="position:absolute;left:${bx}px;top:${by+4}px;color:#7c3aed;font-size:0.9rem;" title="${t.nome} ◆">◆</div>`;
        } else if(isGrupo){
          barrasHtml+=`<div style="position:absolute;left:${bx}px;top:${by+8}px;width:${bw}px;height:6px;background:var(--cor-primaria);border-radius:2px;" title="${t.nome}"></div>
          <div style="position:absolute;left:${bx}px;top:${by+8}px;width:6px;height:12px;background:var(--cor-primaria);border-radius:0 0 0 3px;"></div>
          <div style="position:absolute;left:${bx+bw-6}px;top:${by+8}px;width:6px;height:12px;background:var(--cor-primaria);border-radius:0 0 3px 0;"></div>`;
        } else {
          barrasHtml+=`<div style="position:absolute;left:${bx}px;top:${by}px;width:${bw}px;height:${bh}px;
            background:${corSt};border-radius:4px;overflow:hidden;" title="${t.nome} — ${perc}%">
            <div style="height:100%;width:${Math.round(percEsp)}%;background:rgba(255,255,255,0.1);"></div>
            <div style="position:absolute;top:0;left:0;height:100%;width:${perc}%;background:rgba(255,255,255,0.25);"></div>
            ${bw>60?`<span style="position:absolute;left:5px;top:5px;font-size:0.65rem;color:rgba(255,255,255,0.85);white-space:nowrap;overflow:hidden;max-width:calc(100%-10px);">${t.nome}</span>`:''}
          </div>`;
        }
      }
    });

    // Header esquerdo
    let hEsq=`<div style="width:28px;flex-shrink:0;"></div>`;
    if(colsVisiveis.codigo) hEsq+=`<div style="width:64px;flex-shrink:0;font-size:0.65rem;font-weight:700;color:#555;text-transform:uppercase;padding:0 4px;">Cód</div>`;
    hEsq+=`<div style="flex:1;font-size:0.65rem;font-weight:700;color:#555;text-transform:uppercase;padding:0 6px;">Tarefa</div>`;
    if(colsVisiveis.inicio)      hEsq+=`<div style="width:82px;flex-shrink:0;text-align:center;font-size:0.65rem;font-weight:700;color:#555;text-transform:uppercase;">Início</div>`;
    if(colsVisiveis.termino)     hEsq+=`<div style="width:82px;flex-shrink:0;text-align:center;font-size:0.65rem;font-weight:700;color:#555;text-transform:uppercase;">Fim</div>`;
    if(colsVisiveis.duracao)     hEsq+=`<div style="width:44px;flex-shrink:0;text-align:center;font-size:0.65rem;font-weight:700;color:#555;text-transform:uppercase;">Dur</div>`;
    if(colsVisiveis.percEsp)     hEsq+=`<div style="width:44px;flex-shrink:0;text-align:center;font-size:0.65rem;font-weight:700;color:#555;text-transform:uppercase;">%Esp</div>`;
    if(colsVisiveis.percConc)    hEsq+=`<div style="width:44px;flex-shrink:0;text-align:center;font-size:0.65rem;font-weight:700;color:#555;text-transform:uppercase;">%Conc</div>`;
    if(colsVisiveis.responsavel) hEsq+=`<div style="width:90px;flex-shrink:0;font-size:0.65rem;font-weight:700;color:#555;text-transform:uppercase;padding:0 4px;">Responsável</div>`;
    if(colsVisiveis.local)       hEsq+=`<div style="width:80px;flex-shrink:0;font-size:0.65rem;font-weight:700;color:#555;text-transform:uppercase;padding:0 4px;">Local</div>`;
    if(colsVisiveis.grupo)       hEsq+=`<div style="width:80px;flex-shrink:0;font-size:0.65rem;font-weight:700;color:#555;text-transform:uppercase;padding:0 4px;">Grupo</div>`;
    if(colsVisiveis.custo)       hEsq+=`<div style="width:70px;flex-shrink:0;text-align:right;padding-right:6px;font-size:0.65rem;font-weight:700;color:#555;text-transform:uppercase;">Custo</div>`;
    if(colsVisiveis.receita)     hEsq+=`<div style="width:70px;flex-shrink:0;text-align:right;padding-right:6px;font-size:0.65rem;font-weight:700;color:#555;text-transform:uppercase;">Receita</div>`;
    if(colsVisiveis.predecessora)hEsq+=`<div style="width:54px;flex-shrink:0;text-align:center;font-size:0.65rem;font-weight:700;color:#555;text-transform:uppercase;">Pred.</div>`;
    hEsq+=`<div style="width:52px;flex-shrink:0;"></div>`;

    return `
    <!-- Controles zoom -->
    <div style="display:flex;gap:6px;margin-bottom:8px;align-items:center;flex-wrap:wrap;">
      ${['dia','semana','mes','trimestre','ano'].map(z=>`<button class="btn btn-sm ${zoomGantt===z?'btn-primario':'btn-secundario'}" onclick="Planejamento.setZoom('${z}')">${z.charAt(0).toUpperCase()+z.slice(1)}</button>`).join('')}
      <span style="margin-left:8px;font-size:0.75rem;color:#555;">${tf.length} tarefas</span>
      <span style="margin-left:auto;font-size:0.72rem;color:#555;">Ctrl++ nova tarefa · Ctrl+- excluir · duplo-clique editar</span>
    </div>

    <!-- Container principal dividido -->
    <div id="gantt-container" style="display:flex;border:1px solid #222;border-radius:8px;overflow:hidden;height:calc(100vh - 240px);min-height:400px;">
      <!-- Painel esquerdo (tabela) -->
      <div id="gantt-esq" style="width:${splitX}px;flex-shrink:0;background:#111;border-right:2px solid var(--cor-primaria);display:flex;flex-direction:column;overflow:hidden;">
        <!-- Header -->
        <div style="height:28px;background:#0d0d0d;border-bottom:1px solid #222;display:flex;align-items:center;flex-shrink:0;">
          ${hEsq}
        </div>
        <!-- Linhas (sincronizadas com scroll do gantt) -->
        <div id="gantt-esq-body" style="overflow-y:auto;flex:1;" onscroll="document.getElementById('gantt-dir-body').scrollTop=this.scrollTop;">
          ${linhasHtml}
        </div>
      </div>

      <!-- Divisor arrastável -->
      <div id="gantt-divider" style="width:5px;background:#F5C800;cursor:col-resize;flex-shrink:0;opacity:0.7;"
        onmousedown="Planejamento.iniciarDivider(event)"></div>

      <!-- Painel direito (barras) -->
      <div id="gantt-dir" style="flex:1;min-width:0;background:#0d0d0d;display:flex;flex-direction:column;overflow:hidden;">
        <!-- Header datas -->
        <div style="height:28px;background:#0a0a0a;border-bottom:1px solid #222;position:relative;overflow:hidden;flex-shrink:0;"
          id="gantt-hdr-datas">
          <div style="width:${W}px;height:100%;position:relative;">${hDatas}</div>
        </div>
        <!-- Barras -->
        <div id="gantt-dir-body" style="overflow:auto;flex:1;" 
          onscroll="document.getElementById('gantt-esq-body').scrollTop=this.scrollTop;document.getElementById('gantt-hdr-datas').querySelector('div').style.marginLeft='-'+this.scrollLeft+'px'">
          <div style="width:${W}px;position:relative;height:${tf.length*ROW}px;">
            ${barrasHtml}
            <!-- Linha Hoje -->
            <div style="position:absolute;left:${hojeX}px;top:0;bottom:0;width:2px;background:var(--cor-primaria);opacity:0.9;z-index:10;pointer-events:none;">
              <div style="position:absolute;top:0;left:-18px;background:var(--cor-primaria);color:#000;font-size:0.58rem;font-weight:800;padding:2px 4px;border-radius:2px;white-space:nowrap;">Hoje</div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }

  // ===================== TABELA =====================
  function _renderTabela(){
    const tf=_visiveis();
    if(!tf.length)return`<div class="estado-vazio"><div class="icone">📋</div><p>Nenhuma tarefa.</p>
      <button class="btn btn-primario" onclick="Planejamento.novaTarefa()">+ Tarefa</button></div>`;
    return`<div class="tabela-container"><table class="tabela tabela-compacta">
      <thead><tr>
        <th></th><th>Cód</th><th>Tarefa</th><th>Início</th><th>Fim</th>
        <th>Dur</th><th>%Esp</th><th>%Conc</th><th>Responsável</th><th>Local</th><th>Grupo</th>
        <th class="col-acoes">Ações</th>
      </tr></thead>
      <tbody>${tf.map(t=>{
        const st=_status(t),p=_perc(t),ind=`padding-left:${(t.nivel||0)*14+6}px`;
        const isG=t.tipo==='grupo';
        return`<tr style="background:${t.id===selectedId?'rgba(245,200,0,0.1)':''}" onclick="Planejamento.selectTarefa('${t.id}')" ondblclick="Planejamento.editarTarefa('${t.id}')">
          <td><span class="status-dot ${st}"></span></td>
          <td style="font-family:var(--font-mono);font-size:0.75rem;">${t.codigo||''}</td>
          <td style="${ind}"><span style="color:${isG?'var(--cor-primaria)':'inherit'};font-weight:${isG?700:400};">${t.nome}</span></td>
          <td>${_fd(t.inicioPlanejado)}</td><td>${_fd(t.terminoPlanejado)}</td>
          <td>${t.duracao||'—'}</td>
          <td>${t.percentualEsperado||0}%</td>
          <td style="color:${p>=100?'#16a34a':p>0?'#2563eb':'#aaa'}"><strong>${p}%</strong></td>
          <td>${t.responsavel||'—'}</td><td>${t.local||'—'}</td><td>${t.grupo||''}</td>
          <td class="col-acoes">
            <button class="btn btn-secundario btn-sm" onclick="event.stopPropagation();Planejamento.recuarNivel('${t.id}')" title="Recuar nível (←)">←</button>
            <button class="btn btn-secundario btn-sm" onclick="event.stopPropagation();Planejamento.avancarNivel('${t.id}')" title="Avançar nível (→)">→</button>
            <button class="btn btn-secundario btn-sm" onclick="event.stopPropagation();Planejamento.editarTarefa('${t.id}')">✎</button>
            <button class="btn btn-perigo btn-sm btn-icon" onclick="event.stopPropagation();Planejamento.excluirTarefa('${t.id}')">✕</button>
          </td>
        </tr>`;
      }).join('')}</tbody></table></div>`;
  }

  // ===================== DIVISOR GANTT =====================
  function iniciarDivider(e){
    e.preventDefault();
    const startX=e.clientX, startW=splitX;
    const move=ev=>{splitX=Math.max(280,Math.min(900,startW+(ev.clientX-startX)));_updateDivider();};
    const up=()=>{document.removeEventListener('mousemove',move);document.removeEventListener('mouseup',up);};
    document.addEventListener('mousemove',move);
    document.addEventListener('mouseup',up);
  }
  function _updateDivider(){
    const esq=document.getElementById('gantt-esq');
    if(esq)esq.style.width=splitX+'px';
  }

  // ===================== COLUNAS =====================
  function toggleColunas(){
    const nomes={codigo:'Código',inicio:'Início',termino:'Fim',duracao:'Duração',
      percEsp:'% Esperado',percConc:'% Concluído',responsavel:'Responsável',
      local:'Local',grupo:'Grupo',custo:'Custo',receita:'Receita',predecessora:'Predecessora'};
    const checks=Object.entries(colsVisiveis).map(([k,v])=>
      `<label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;">
        <input type="checkbox" ${v?'checked':''} onchange="Planejamento._toggleCol('${k}',this.checked)">
        <span>${nomes[k]||k}</span>
      </label>`).join('');

    // Inline popup
    let pop=document.getElementById('cols-popup');
    if(pop){pop.remove();return;}
    pop=document.createElement('div');
    pop.id='cols-popup';
    pop.style.cssText='position:fixed;top:80px;right:20px;background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:16px;z-index:1000;min-width:200px;box-shadow:0 8px 32px rgba(0,0,0,0.5);';
    pop.innerHTML=`<div style="font-weight:700;color:var(--cor-primaria);margin-bottom:10px;font-size:0.85rem;">Colunas visíveis</div>${checks}
      <button class="btn btn-primario btn-sm" style="width:100%;margin-top:10px;" onclick="document.getElementById('cols-popup').remove();Planejamento.renderizar()">Aplicar</button>`;
    document.body.appendChild(pop);
    setTimeout(()=>document.addEventListener('click',function h(e){if(!pop.contains(e.target)){pop.remove();document.removeEventListener('click',h);}},false),100);
  }
  function _toggleCol(k,v){colsVisiveis[k]=v;}
  function _colsAtivas(){return Object.entries(colsVisiveis).filter(([,v])=>v).map(([k])=>k);}

  // ===================== HIERARQUIA =====================
  function _visiveis(){
    const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    if(!colsRecolhidas.size)return sorted;
    // Filtra filhos de recolhidos
    const result=[];
    const recolhadosNomes=new Set([...colsRecolhidas].map(id=>{const t=tarefas.find(x=>x.id===id);return t?t.nome:'';}).filter(Boolean));
    for(const t of sorted){
      const pai=t.tarefaPai;
      if(pai&&recolhadosNomes.has(pai))continue;
      result.push(t);
    }
    return result;
  }

  function toggleRecolher(id){
    if(colsRecolhidas.has(id))colsRecolhidas.delete(id);else colsRecolhidas.add(id);
    renderizar();
  }

  async function recuarNivel(id){
    const t=tarefas.find(x=>x.id===id);if(!t)return;
    const novoNivel=Math.max(0,(t.nivel||0)-1);
    await Database.atualizar(obraId,COL,id,{nivel:novoNivel});
    await carregar();
  }
  async function avancarNivel(id){
    const t=tarefas.find(x=>x.id===id);if(!t)return;
    const novoNivel=(t.nivel||0)+1;
    await Database.atualizar(obraId,COL,id,{nivel:novoNivel});
    await carregar();
  }

  // ===================== CRUD =====================
  function selectTarefa(id){selectedId=id;_refreshSelecao();}
  function _refreshSelecao(){
    document.querySelectorAll('.gantt-row').forEach(r=>{
      r.style.background=r.dataset.id===selectedId?'rgba(245,200,0,0.12)':'';
    });
  }

  function novaTarefa(){
    editandoId=null;
    document.getElementById('modal-tarefa-titulo').textContent='Nova Tarefa';
    _limparFormTarefa();
    if(selectedId){
      const sel=tarefas.find(t=>t.id===selectedId);
      if(sel){
        document.querySelector('#form-tarefa [name="nivel"]').value=sel.nivel||0;
        document.querySelector('#form-tarefa [name="tarefaPai"]').value=sel.tarefaPai||'';
        document.querySelector('#form-tarefa [name="grupo"]').value=sel.grupo||'';
      }
    }
    Utils.abrirModal('modal-tarefa');
  }
  function editarTarefa(id){
    const t=tarefas.find(x=>x.id===id);if(!t)return;
    editandoId=id;
    document.getElementById('modal-tarefa-titulo').textContent='Editar Tarefa';
    _limparFormTarefa();
    const f=document.getElementById('form-tarefa');
    const campos=['codigo','nome','tipo','nivel','ordem','inicioPlanejado','terminoPlanejado','duracao',
      'percentualEsperado','percentualConcluido','predecessora','tarefaPai','grupo','local',
      'custo','receita','responsavel','inicioPlanejadoBase','terminoPlanejadoBase','inicioDesafio','terminoDesafio','observacoes'];
    campos.forEach(k=>{const el=f.querySelector(`[name="${k}"]`);if(el&&t[k]!=null)el.value=t[k];});
    Utils.abrirModal('modal-tarefa');
  }
  function _limparFormTarefa(){document.getElementById('form-tarefa').reset();}

  async function salvarTarefa(){
    const f=document.getElementById('form-tarefa');
    const g=n=>f.querySelector(`[name="${n}"]`)?.value;
    const nome=g('nome')?.trim();
    if(!nome){Utils.toast('Informe o nome.','alerta');return;}
    const ini=g('inicioPlanejado'), ter=g('terminoPlanejado');
    let dur=parseInt(g('duracao'))||0;
    if(ini&&ter&&!dur)dur=Math.max(0,Math.ceil((new Date(ter)-new Date(ini))/864e5));
    const data={
      tipo:g('tipo')||'tarefa', codigo:g('codigo')||'', nome,
      nivel:parseInt(g('nivel'))||0, ordem:parseInt(g('ordem'))||tarefas.length+1,
      inicioPlanejado:ini||'', terminoPlanejado:ter||'', duracao:dur,
      percentualEsperado:parseFloat(g('percentualEsperado'))||0,
      percentualConcluido:parseFloat(g('percentualConcluido'))||0,
      predecessora:g('predecessora')||'', tarefaPai:g('tarefaPai')||'',
      grupo:g('grupo')||'', local:g('local')||'',
      custo:parseFloat(g('custo'))||0, receita:parseFloat(g('receita'))||0,
      responsavel:g('responsavel')||'',
      inicioPlanejadoBase:g('inicioPlanejadoBase')||'',
      terminoPlanejadoBase:g('terminoPlanejadoBase')||'',
      inicioDesafio:g('inicioDesafio')||'', terminoDesafio:g('terminoDesafio')||'',
      observacoes:g('observacoes')||'', obraId,
    };
    try{
      if(editandoId)await Database.atualizar(obraId,COL,editandoId,data);
      else await Database.criar(obraId,COL,data);
      Utils.fecharModal('modal-tarefa');Utils.toast('Salvo!','sucesso');editandoId=null;await carregar();
    }catch(e){console.error(e);Utils.toast('Erro.','erro');}
  }

  async function excluirTarefa(id){
    const t=tarefas.find(x=>x.id===id);
    if(!confirm(`Excluir "${t?.nome}"?`))return;
    try{await Database.deletar(obraId,COL,id);Utils.toast('Excluído.','sucesso');if(selectedId===id)selectedId=null;await carregar();}
    catch(e){Utils.toast('Erro.','erro');}
  }

  // ===================== IMPORTAR =====================
  async function importarExcel(event){
    const file=event.target.files[0];if(!file)return;
    event.target.value='';
    if(!confirm(`Importar vai SUBSTITUIR todas as ${tarefas.length} tarefas existentes. Confirmar?`))return;
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
        const aliases={id:['id'],codigo:['codigo','code','cod'],nome:['nome','name','tarefa'],
          duracao:['duracao','duration'],inicio:['inicio','start','inicio planejado'],
          termino:['termino','finish','fim','termino planejado'],
          percEsp:['esperado','% esperado','perc esperado'],percConc:['concluido','% concluido','perc concluido','% complete'],
          pred:['predecessora','predecessor','prececessora'],pai:['tarefa pai','parent','pai'],
          grupo:['grupo','group','fase'],local:['local','location'],
          custo:['custo','cost'],receita:['receita','revenue'],responsavel:['responsavel','responsible','resource'],
          iniBase:['inicio linha de base','baseline start'],terBase:['termino linha de base','baseline finish'],
          iniDes:['inicio desafio'],terDes:['termino desafio']};
        for(const a of (aliases[name]||[name])){const i=hdrs.indexOf(a);if(i>=0)return i;}return -1;
      };
      if(ci('nome')<0){Utils.toast('Coluna Nome não encontrada.','erro');return;}

      // Apagar tarefas existentes
      Utils.mostrarLoading('Apagando tarefas antigas...');
      await Promise.all(tarefas.map(t=>Database.deletar(obraId,COL,t.id).catch(()=>{})));

      // Parse
      const registros=[];
      for(let r=1;r<rows.length;r++){
        const row=rows[r];
        const nome=String(row[ci('nome')]||'').trim();
        if(!nome)continue;
        const nomeOrig=String(row[ci('nome')]||'');
        const nivel=Math.floor((nomeOrig.length-nomeOrig.trimStart().length)/2);
        const codigo=String(row[ci('codigo')]||'').trim();
        const pontos=(codigo.match(/\./g)||[]).length;
        registros.push({
          tipo:pontos<=1&&codigo?'grupo':'tarefa', codigo, nome, nivel, ordem:r,
          inicioPlanejado:_parseData(row[ci('inicio')]), terminoPlanejado:_parseData(row[ci('termino')]),
          duracao:_parseDur(row[ci('duracao')]),
          percentualEsperado:_parseNum(row[ci('percEsp')]), percentualConcluido:_parseNum(row[ci('percConc')]),
          predecessora:String(row[ci('pred')]||'').trim(), tarefaPai:String(row[ci('pai')]||'').trim(),
          grupo:String(row[ci('grupo')]||'').trim(), local:String(row[ci('local')]||'').trim(),
          custo:_parseNum(row[ci('custo')]), receita:_parseNum(row[ci('receita')]),
          responsavel:String(row[ci('responsavel')]||'').trim(),
          inicioPlanejadoBase:_parseData(row[ci('iniBase')]), terminoPlanejadoBase:_parseData(row[ci('terBase')]),
          inicioDesafio:_parseData(row[ci('iniDes')]), terminoDesafio:_parseData(row[ci('terDes')]),
          obraId,
        });
      }

      // Gravar em lotes
      let imp=0;
      const LOTE=50;
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
      Utils.mostrarLoading('Gerando planilha...');
      if(typeof XLSX==='undefined')await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
      const HDR=['ID','Código','Nome','Duração','Início','Término','% Esperado','% Concluído',
        'Prececessora','Tarefa Pai','Grupo','Local','Custo','Receita','Responsável',
        'Inicio Linha de Base','Termino Linha de Base','Inicio Desafio','Termino Desafio'];
      const sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
      const rows=sorted.map((t,i)=>[i+1,t.codigo||'','  '.repeat(t.nivel||0)+(t.nome||''),
        t.duracao?t.duracao+'d':'',_fDataBR(t.inicioPlanejado),_fDataBR(t.terminoPlanejado),
        t.percentualEsperado||0,t.percentualConcluido||0,
        t.predecessora||'',t.tarefaPai||'',t.grupo||'',t.local||'',
        t.custo||0,t.receita||0,t.responsavel||'',
        _fDataBR(t.inicioPlanejadoBase),_fDataBR(t.terminoPlanejadoBase),
        _fDataBR(t.inicioDesafio),_fDataBR(t.terminoDesafio)]);
      const ws=XLSX.utils.aoa_to_sheet([HDR,...rows]);
      ws['!cols']=[{wch:6},{wch:10},{wch:45},{wch:8},{wch:13},{wch:13},{wch:11},{wch:11},
        {wch:13},{wch:20},{wch:18},{wch:15},{wch:10},{wch:10},{wch:18},{wch:22},{wch:22},{wch:15},{wch:15}];
      const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Cronograma');
      const obra=Router.getObra();
      XLSX.writeFile(wb,`cronograma_${(obra?.nome||'obra').replace(/[^a-z0-9]/gi,'_')}_${_hoje()}.xlsx`);
      Utils.toast('Exportado!','sucesso');
    }catch(e){Utils.toast('Erro: '+e.message,'erro');}
    finally{Utils.esconderLoading();}
  }

  // ===================== EXPORTAR GANTT PDF =====================
  async function exportarGanttPDF(){
    const container=document.getElementById('gantt-container');
    if(!container){Utils.toast('Abra o Gantt primeiro.','alerta');return;}
    try{
      Utils.mostrarLoading('Gerando imagem...');
      if(typeof html2canvas==='undefined')await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
      const canvas=await html2canvas(container,{backgroundColor:'#0d0d0d',scale:1.5,useCORS:true,logging:false});
      const link=document.createElement('a');
      link.download=`gantt_${_hoje()}.png`;
      link.href=canvas.toDataURL('image/png');
      link.click();
      Utils.toast('Gantt exportado como PNG!','sucesso');
    }catch(e){Utils.toast('Erro ao exportar: '+e.message,'erro');}
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
  function _fd(d){if(!d)return '—';try{return new Date(d+'T12:00:00').toLocaleDateString('pt-BR');}catch(e){return d;}}
  function _fDataBR(d){if(!d)return '';try{return new Date(d+'T12:00:00').toLocaleDateString('pt-BR');}catch(e){return '';}}
  function _fMoeda(n){return 'R$ '+Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2});}
  function _hoje(){return new Date().toISOString().split('T')[0];}
  function _parseDur(v){if(!v)return 0;return parseInt(String(v).replace(/\D/g,''))||0;}
  function _parseNum(v){return parseFloat(String(v||'').replace(',','.'))||0;}
  function _parseData(v){
    if(!v)return '';
    if(v instanceof Date)return v.toISOString().split('T')[0];
    if(typeof v==='number'){return new Date((v-25569)*864e5).toISOString().split('T')[0];}
    const s=String(v).trim();
    const m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if(m)return `${m[3]}-${m[2]}-${m[1]}`;
    if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.split('T')[0];
    return '';
  }
  function _loadScript(src){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=rej;document.head.appendChild(s);});}

  function setAba(a){abaAtiva=a;renderizar();}
  function setZoom(z){zoomGantt=z;renderizar();}

  return {init,carregar,renderizar,novaTarefa,editarTarefa,salvarTarefa,excluirTarefa,
    selectTarefa,toggleRecolher,recuarNivel,avancarNivel,
    setAba,setZoom,toggleColunas,_toggleCol,iniciarDivider,
    importarExcel,exportar,exportarGanttPDF};
})();
function onObraChanged(){Planejamento.init();}

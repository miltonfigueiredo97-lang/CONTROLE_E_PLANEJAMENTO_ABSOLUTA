// ============================================
// Diário de Obra — módulo independente (Gestão)
// Lançamento rápido de campo: o que está sendo feito,
// vinculado a tarefa do Planejamento (busca fuzzy hierárquica),
// com % de avanço que grava de volta no Planejamento
// (percentualConcluido + inicioReal/terminoReal) e
// relatório do dia: executado / não executado /
// deveria estar / porquês.
// Coleção: obras/{id}/diario — um doc por lançamento:
// {data:'YYYY-MM-DD', tarefaId, tarefaLabel, atividade, status,
//  percAntes, percDepois, motivo, detalhe, obraId, createdAt}
// ============================================
const Diario = (() => {
  let obraId=null, tarefas=[], sorted=[], leafSet=new Set();
  let diaRef=null;
  let lancamentosDia=[];
  let _busca='', _tarSel='', _status='executado', _editId=null, _atividadeTmp='', _percTmp='';
  const COL='tarefas', COLD='diario';
  const DIAS=['dom','seg','ter','qua','qui','sex','sáb'];
  const MOTIVOS=['Frente/Predecessora Não Liberada','Atraso Entrega de Material','Atraso Programação de Material','Falta de Material (Sobreconsumo)','Material Não Conforme','Material Não Comprado','Necessidade Não Prevista (EAP)','Especificação de Projeto','Equipamentos Indisponíveis','Serviço Não Contratado','Mudança no Plano de Ataque','Atraso em Documentações','Baixa Produtividade Prevista','Intempéries','Outros'];
  const D_STATUS={
    executado:    {label:'✅ Executado',    cor:'#16a34a', bg:'#dcfce7'},
    parcial:      {label:'◐ Parcial',       cor:'#ca8a04', bg:'#fef9c3'},
    nao_executado:{label:'✖ Não executado', cor:'#dc2626', bg:'#fee2e2'},
  };

  // ==================== DATAS ====================
  function _d(s){if(!s)return null;if(s.toDate)s=s.toDate();if(s instanceof Date)return new Date(s.getFullYear(),s.getMonth(),s.getDate());
    const m=String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);if(m)return new Date(+m[1],+m[2]-1,+m[3]);
    const b=String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);if(b)return new Date(+b[3],+b[2]-1,+b[1]);
    const d=new Date(s);return isNaN(d)?null:new Date(d.getFullYear(),d.getMonth(),d.getDate());}
  function _iso(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  function _fmt(s){const d=_d(s);return d?`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`:'-';}
  function _hoje(){const n=new Date();return new Date(n.getFullYear(),n.getMonth(),n.getDate());}
  function _addD(d,n){const r=new Date(d);r.setDate(r.getDate()+n);return r;}
  function _esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

  // ==================== INIT / LOAD ====================
  async function init(){
    const ok=await Utils.initPagina({requireObra:true});if(!ok)return;
    obraId=Router.getObraId();
    if(!obraId){_el().innerHTML='<div class="estado-vazio"><div class="icone">📓</div><p>Selecione uma obra.</p></div>';return;}
    diaRef=_hoje();
    await carregar();
  }
  function _el(){return document.getElementById('modulo-content')||document.body;}

  async function carregar(){
    try{
      Utils.mostrarLoading('Carregando...');
      tarefas=await Database.listar(obraId,COL,'ordem').catch(()=>[]);
      _prep();
      await _loadDia();
      _render();
    }catch(e){console.error(e);Utils.toast('Erro ao carregar.','erro');}
    finally{Utils.esconderLoading();}
  }

  function _prep(){
    sorted=[...tarefas].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    leafSet=new Set();
    for(let i=0;i<sorted.length;i++){
      const nxt=sorted[i+1];
      if(!nxt||((nxt.nivel||0)<=(sorted[i].nivel||0)))leafSet.add(sorted[i].id);
    }
  }

  async function _loadDia(){
    const iso=_iso(diaRef);
    try{
      const todos=await Database.listar(obraId,COLD,'createdAt').catch(()=>[]);
      lancamentosDia=todos.filter(l=>l.data===iso);
    }catch(e){console.error(e);lancamentosDia=[];}
  }

  // ==================== BUSCA FUZZY DE TAREFA ====================
  function _norm(s){return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();}
  function _lev(a,b){
    const m=a.length,n=b.length;if(!m)return n;if(!n)return m;
    const d=Array.from({length:m+1},(_,i)=>[i,...Array(n).fill(0)]);
    for(let j=0;j<=n;j++)d[0][j]=j;
    for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)
      d[i][j]=a[i-1]===b[j-1]?d[i-1][j-1]:1+Math.min(d[i-1][j],d[i][j-1],d[i-1][j-1]);
    return d[m][n];
  }
  function _score(t,q){
    if(!q)return 1;
    if(t===q)return 100;if(t.startsWith(q))return 90;if(t.includes(q))return 80;
    const pq=q.split(/\s+/).filter(Boolean),pn=t.split(/\s+/).filter(Boolean);
    if(pq.every(x=>pn.some(n=>n.includes(x))))return 70;
    const dist=_lev(t,q),tol=Math.max(2,Math.floor(q.length*0.35));
    if(dist<=tol)return 60-dist;
    if(pq.some(x=>pn.some(n=>_lev(n,x)<=Math.max(1,Math.floor(x.length*0.3)))))return 40;
    return -1;
  }
  function _buscarOpts(texto){
    const opts=Utils.opcoesTarefaHierarquia(tarefas),q=_norm(texto);
    if(!q)return opts;
    return opts.map(o=>({o,score:_score(_norm(o.label),q)}))
      .filter(x=>x.score>=0).sort((a,b)=>b.score-a.score).map(x=>x.o);
  }

  // ==================== RENDER ====================
  function _render(){
    const iso=_iso(diaRef);
    const hojeIso=_iso(_hoje());
    const precisaMotivo=_status!=='executado';
    const tarSel=_tarSel?tarefas.find(t=>t.id===_tarSel):null;
    const opts=_buscarOpts(_busca).slice(0,60);

    const porStatus={executado:[],parcial:[],nao_executado:[]};
    lancamentosDia.forEach(l=>{(porStatus[l.status]||porStatus.executado).push(l);});

    _el().innerHTML=`
    <style>
      .dia-nav{display:flex;align-items:center;background:#0f172a;color:#fff;border-radius:8px;overflow:hidden;}
      .dia-nav button{background:none;border:none;color:#fff;padding:8px 10px;cursor:pointer;font-size:.9rem;}
      .dia-nav .lbl{padding:0 10px;font-weight:700;font-size:.85rem;white-space:nowrap;}
      .dia-form{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:14px;}
      .dia-form label{font-size:.72rem;color:#64748b;font-weight:700;text-transform:uppercase;display:block;margin-bottom:3px;}
      .dia-form input[type=text],.dia-form input[type=number],.dia-form select{width:100%;padding:7px 9px;border:1px solid #cbd5e1;border-radius:7px;font-size:.85rem;box-sizing:border-box;}
      .dia-res{max-height:230px;overflow:auto;border:1px solid #e2e8f0;border-radius:8px;margin-top:4px;background:#fff;position:relative;z-index:20;}
      .dia-res div{padding:6px 10px;cursor:pointer;font-size:.8rem;border-bottom:1px solid #f8fafc;white-space:pre;}
      .dia-res div:hover{background:#fefce8;}
      .dia-st{display:flex;gap:6px;}
      .dia-st button{flex:1;border:1.5px solid #cbd5e1;background:#fff;border-radius:8px;padding:8px 4px;cursor:pointer;font-size:.78rem;font-weight:700;color:#64748b;}
      .dia-lanc{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:10px 14px;margin-bottom:8px;display:flex;gap:10px;align-items:flex-start;}
      .dia-lanc .tag{padding:2px 8px;border-radius:6px;font-size:.68rem;font-weight:800;white-space:nowrap;flex-shrink:0;}
      .dia-sec-t{font-size:.85rem;font-weight:800;margin:14px 0 8px;display:flex;align-items:center;gap:8px;}
      .btn-icone{background:none;border:none;cursor:pointer;font-size:.9rem;padding:2px;}
    </style>
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
      <div class="dia-nav">
        <button onclick="Diario.nav(-1)">‹</button>
        <span class="lbl">${DIAS[diaRef.getDay()]}, ${_fmt(iso)}${iso===hojeIso?' (hoje)':''}</span>
        <button onclick="Diario.nav(1)">›</button>
        <button onclick="Diario.hojeBtn()" title="Ir para hoje" style="border-left:1px solid #334155;">●</button>
      </div>
      <input type="date" value="${iso}" onchange="Diario.setData(this.value)" style="padding:7px 9px;border:1px solid #cbd5e1;border-radius:8px;font-size:.82rem;">
      <div style="flex:1;"></div>
      <button class="btn btn-sm" style="background:#0f172a;color:#fff;" onclick="Diario.gerarRelatorio()">📄 Relatório do dia</button>
    </div>

    <div class="dia-form">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div style="position:relative;">
          <label>Tarefa vinculada (busque por código ou nome)</label>
          <input type="text" id="dia-busca" value="${_esc(_busca)}" placeholder="Ex: alvenaria 3 pav, 1.3.1..." oninput="Diario.onBusca(this.value)" autocomplete="off">
          ${tarSel?`<div style="margin-top:5px;font-size:.78rem;color:#16a34a;font-weight:700;">✓ ${_esc((tarSel.codigo?tarSel.codigo+' ':'')+tarSel.nome)} <span style="color:#64748b;font-weight:600;">· ${tarSel.percentualConcluido||0}% concluído hoje</span></div>`:''}
          ${_busca&&!tarSel?`<div class="dia-res">${opts.length?opts.map(o=>
            `<div onclick="Diario.selTarefa('${o.id}')">${_esc(o.label)}</div>`).join(''):
            '<div style="color:#94a3b8;cursor:default;">Nenhuma tarefa encontrada</div>'}</div>`:''}
        </div>
        <div>
          <label>O que está sendo feito</label>
          <input type="text" id="dia-atividade" placeholder="Ex: Elevação de alvenaria eixo A-B, 2 pedreiros" autocomplete="off">
          <div style="display:grid;grid-template-columns:1fr 130px;gap:10px;margin-top:10px;align-items:end;">
            <div>
              <label>Situação</label>
              <div class="dia-st">
                ${Object.entries(D_STATUS).map(([k,v])=>`<button onclick="Diario.setStatus('${k}')" style="${_status===k?`background:${v.bg};border-color:${v.cor};color:${v.cor};`:''}">${v.label}</button>`).join('')}
              </div>
            </div>
            <div>
              <label title="Grava no Planejamento">Avanço % (opcional)</label>
              <input type="number" id="dia-perc" min="0" max="100" step="1" placeholder="${tarSel?(tarSel.percentualConcluido||0):'—'}" autocomplete="off">
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
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;">
        <div style="font-size:.72rem;color:#94a3b8;">O % informado é gravado direto no Planejamento (com início/término real automáticos).</div>
        <div style="display:flex;gap:8px;">
          ${_editId?`<button class="btn btn-sm btn-outline" onclick="Diario.cancelarEdicao()">Cancelar edição</button>`:''}
          <button class="btn btn-sm btn-primario" onclick="Diario.salvar()">${_editId?'💾 Salvar alteração':'＋ Lançar'}</button>
        </div>
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
              ${l.percDepois!=null&&l.percDepois!==''?`<div style="font-size:.75rem;color:#2563eb;margin-top:2px;">Avanço: ${l.percAntes??'?'}% → <b>${l.percDepois}%</b></div>`:''}
              ${l.motivo?`<div style="font-size:.75rem;color:#dc2626;margin-top:2px;">Motivo: ${_esc(l.motivo)}${l.detalhe?' — '+_esc(l.detalhe):''}</div>`:''}
            </div>
            <button class="btn-icone" title="Editar" onclick="Diario.editar('${l.id}')">✏️</button>
            <button class="btn-icone" title="Excluir" onclick="Diario.excluir('${l.id}')">🗑️</button>
          </div>`).join('');
      }).join('')}`;
  }

  // ==================== HANDLERS ====================
  async function nav(dir){diaRef=_addD(diaRef,dir);await _loadDia();_render();}
  async function hojeBtn(){diaRef=_hoje();await _loadDia();_render();}
  async function setData(v){const d=_d(v);if(!d)return;diaRef=d;await _loadDia();_render();}

  function _preservarCampos(){
    const at=document.getElementById('dia-atividade');if(at)_atividadeTmp=at.value;
    const pc=document.getElementById('dia-perc');if(pc)_percTmp=pc.value;
  }
  function _restaurarCampos(){
    requestAnimationFrame(()=>{
      const at=document.getElementById('dia-atividade');if(at&&_atividadeTmp)at.value=_atividadeTmp;
      const pc=document.getElementById('dia-perc');if(pc&&_percTmp)pc.value=_percTmp;
    });
  }

  function onBusca(v){
    _preservarCampos();
    _busca=v;_tarSel='';_render();_restaurarCampos();
    requestAnimationFrame(()=>{const i=document.getElementById('dia-busca');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length);}});
  }
  function selTarefa(id){
    _preservarCampos();
    _tarSel=id;
    const t=tarefas.find(x=>x.id===id);
    _busca=t?((t.codigo?t.codigo+' ':'')+(t.nome||'')):'';
    _render();_restaurarCampos();
    requestAnimationFrame(()=>{const i=document.getElementById('dia-atividade');if(i)i.focus();});
  }
  function setStatus(s){_preservarCampos();_status=s;_render();_restaurarCampos();}

  async function salvar(){
    if(!_tarSel){Utils.toast('Selecione a tarefa vinculada.','alerta');return;}
    const atividade=(document.getElementById('dia-atividade')?.value||'').trim();
    if(!atividade){Utils.toast('Descreva o que está sendo feito.','alerta');return;}
    const t=tarefas.find(x=>x.id===_tarSel);
    const percRaw=(document.getElementById('dia-perc')?.value||'').trim();
    let percDepois=null;
    if(percRaw!==''){
      percDepois=Math.min(100,Math.max(0,parseFloat(percRaw)||0));
    }
    const dados={
      data:_iso(diaRef),
      tarefaId:_tarSel,
      tarefaLabel:t?((t.codigo?t.codigo+' ':'')+(t.nome||'')):'',
      atividade,
      status:_status,
      percAntes:t?(t.percentualConcluido||0):null,
      percDepois:percDepois,
      motivo:_status!=='executado'?(document.getElementById('dia-motivo')?.value||''):'',
      detalhe:_status!=='executado'?(document.getElementById('dia-detalhe')?.value||'').trim():'',
      obraId,
    };
    try{
      Utils.mostrarLoading('Salvando...');
      if(_editId)await Database.atualizar(obraId,COLD,_editId,dados);
      else await Database.criar(obraId,COLD,{...dados,createdAt:new Date().toISOString()});

      // Grava o avanço no Planejamento (mesmas regras do Semanal:
      // primeiro progresso marca inicioReal, 100% marca terminoReal,
      // voltar de 100% limpa terminoReal)
      if(percDepois!=null&&t){
        const upd={percentualConcluido:percDepois};
        const hoje=_iso(_hoje());
        if(percDepois>0&&!t.inicioReal)upd.inicioReal=hoje;
        if(percDepois>=100&&!t.terminoReal)upd.terminoReal=hoje;
        if(percDepois<100&&t.terminoReal)upd.terminoReal='';
        await Database.atualizar(obraId,COL,_tarSel,upd);
        Object.assign(t,upd);
      }

      _editId=null;_busca='';_tarSel='';_status='executado';_atividadeTmp='';_percTmp='';
      await _loadDia();_render();
      Utils.toast(percDepois!=null?'Lançado! Avanço gravado no Planejamento.':'Lançamento salvo!','sucesso');
      requestAnimationFrame(()=>{const i=document.getElementById('dia-busca');if(i)i.focus();});
    }catch(e){console.error(e);Utils.toast('Erro ao salvar.','erro');}
    finally{Utils.esconderLoading();}
  }

  function editar(id){
    const l=lancamentosDia.find(x=>x.id===id);if(!l)return;
    _editId=id;_tarSel=l.tarefaId;_busca=l.tarefaLabel||'';_status=l.status||'executado';
    _atividadeTmp='';_percTmp='';
    _render();
    requestAnimationFrame(()=>{
      const a=document.getElementById('dia-atividade');if(a)a.value=l.atividade||'';
      const p=document.getElementById('dia-perc');if(p&&l.percDepois!=null)p.value=l.percDepois;
      const m=document.getElementById('dia-motivo');if(m&&l.motivo)m.value=l.motivo;
      const d=document.getElementById('dia-detalhe');if(d)d.value=l.detalhe||'';
    });
  }
  function cancelarEdicao(){_editId=null;_busca='';_tarSel='';_status='executado';_atividadeTmp='';_percTmp='';_render();}

  async function excluir(id){
    if(!confirm('Excluir este lançamento?'))return;
    try{await Database.deletar(obraId,COLD,id);await _loadDia();_render();Utils.toast('Excluído.','sucesso');}
    catch(e){console.error(e);Utils.toast('Erro ao excluir.','erro');}
  }

  // ==================== RELATÓRIO DO DIA ====================
  function gerarRelatorio(){
    const iso=_iso(diaRef);
    const dia=diaRef;
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
      ${l.percDepois!=null&&l.percDepois!==''?`<span style="color:#2563eb;font-size:.76rem;"> · avanço ${l.percAntes??'?'}% → ${l.percDepois}%</span>`:''}
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
            <button class="btn btn-sm btn-outline" onclick="Diario.imprimirRelatorio()">🖨️ Imprimir</button>
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

  function imprimirRelatorio(){
    const rel=document.getElementById('dia-rel-print');if(!rel)return;
    const w=window.open('','_blank');
    w.document.write('<html><head><title>Diário de Obra</title><style>body{font-family:system-ui,Arial;padding:20px;}.no-print{display:none;}</style></head><body>'+rel.innerHTML+'</body></html>');
    w.document.close();w.focus();
    setTimeout(()=>{w.print();},300);
  }

  return{init,carregar,nav,hojeBtn,setData,onBusca,selTarefa,setStatus,
    salvar,editar,cancelarEdicao,excluir,gerarRelatorio,imprimirRelatorio};
})();
function onObraChanged(){Diario.init();}

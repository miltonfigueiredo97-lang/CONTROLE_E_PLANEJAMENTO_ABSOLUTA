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
  // Pauta do dia
  let _pautaExp={};        // {tarefaId:'andou'|'parado'} — card expandido
  let _skips=new Set();    // tarefas puladas nesta sessão
  let _grpAberto=new Set();// grupos (pais) expandidos na pauta
  let _extras=new Set();   // tarefas do planejamento adicionadas manualmente à pauta
  let _buscaPauta='';      // busca p/ adicionar tarefa do planejamento à pauta
  let _formAberto=false;   // formulário "fora da pauta"
  let _atrasAberto=false;  // seção de atrasadas expandida
  let _visao=(typeof localStorage!=='undefined'&&localStorage.getItem('diario_visao'))||'servico'; // 'local'|'servico'
  let _subExp=null;        // subgrupo com "Lançar em todos" aberto
  let _subReg={};          // {chave:[ids das folhas]} — montado no render
  let _avulsas=[];         // tarefas avulsas pendentes (rolam entre dias)
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
      lancamentosDia=todos.filter(l=>l.data===iso&&!l.avulsa);
      // Avulsas: pendentes (qualquer data) + concluídas neste dia
      _avulsas=todos.filter(l=>l.avulsa&&(!l.concluida||l.dataConclusao===iso));
    }catch(e){console.error(e);lancamentosDia=[];_avulsas=[];}
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

  // ==================== PAUTA DO DIA ====================
  // Lê o Planejamento e monta a agenda da reunião: folhas previstas
  // para o dia (início<=dia<=término, %<100) agrupadas pelo pai direto,
  // + atrasadas (término<dia, %<100). Nada fixo: 100% dirigido pelos dados.
  function _pautaItens(){
    const dia=diaRef;
    const previstas=[],atrasadas=[];
    for(const t of sorted){
      if(!leafSet.has(t.id))continue;
      if((t.percentualConcluido||0)>=100)continue;
      const i=_d(t.inicioPlanejado),f=_d(t.terminoPlanejado);
      if(!i||!f)continue;
      if(dia>=i&&dia<=f)previstas.push(t);
      else if(f<dia)atrasadas.push(t);
    }
    // Extras: tarefas do planejamento adicionadas manualmente à pauta
    const jaIds=new Set(previstas.map(t=>t.id));
    for(const id of _extras){
      if(jaIds.has(id))continue;
      const t=tarefas.find(x=>x.id===id);
      if(t)previstas.push(t);
    }
    // Atrasadas ficam na ordem do planejamento (sorted) — famílias juntas.
    previstas.sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    return {previstas,atrasadas};
  }

  // Agrupa folhas pelo pai direto (via Utils.percFamilia). Retorna
  // [{pai:tarefa|null, itens:[folhas]}] na ordem do planejamento.
  function _agruparPorPai(folhas){
    const fam=Utils.percFamilia(tarefas);
    const grupos=[],idx=new Map();
    for(const t of folhas){
      const pai=fam.ancestrais(t)[0]||null;
      const k=pai?pai.id:'__sem_pai__';
      if(!idx.has(k)){idx.set(k,grupos.length);grupos.push({pai,itens:[]});}
      grupos[idx.get(k)].itens.push(t);
    }
    return grupos;
  }

  // ===== VISÃO DA PAUTA: por LOCAL (campo grupo) ou por SERVIÇO =====
  // Serviço = prefixo do nome antes de ':' (ex: "Gesso Liso: 1° Pav - F02"
  // → "Gesso Liso"); sem ':', usa o nome do pai; sem pai, o próprio nome.
  function _servico(t){
    const n=(t.nome||'').trim();
    if(n.includes(':'))return n.split(':')[0].trim()||'Sem serviço';
    const pai=Utils.percFamilia(tarefas).ancestrais(t)[0];
    return (pai&&(pai.nome||'').trim())||n||'Sem serviço';
  }
  function _local(t){return ((t.grupo||'').trim())||'Sem local';}

  // Ordenação natural de locais de obra: Subsolo → Térreo → 1°..N° → Cobertura → resto
  function _ordLocal(nome){
    const n=_norm(nome);
    const num=parseInt((n.match(/\d+/)||[])[0]||'0',10);
    if(n.includes('subsolo'))return -1000+num;
    if(n.includes('terreo'))return -500;
    if(n.includes('cobertura'))return 100000;
    if(/\d/.test(n))return num;
    return 200000; // sem número: vai pro fim, ordem alfabética
  }
  function _cmpLocal(a,b){const d=_ordLocal(a)-_ordLocal(b);return d!==0?d:a.localeCompare(b,'pt-BR');}
  function _cmpAlfa(a,b){return a.localeCompare(b,'pt-BR');}

  // Agrupa em 2 níveis conforme a visão:
  // 'local'  → categoria = local (andar), sub = serviço (alfabético)
  // 'servico'→ categoria = serviço (alfabético), sub = local (natural)
  function _agruparPauta(folhas){
    const catFn=_visao==='servico'?_servico:_local;
    const subFn=_visao==='servico'?_local:_servico;
    const catCmp=_visao==='servico'?_cmpAlfa:_cmpLocal;
    const subCmp=_visao==='servico'?_cmpLocal:_cmpAlfa;
    const map=new Map();
    for(const t of folhas){
      const cn=catFn(t);
      if(!map.has(cn))map.set(cn,new Map());
      const sub=map.get(cn);
      const sn=subFn(t);
      if(!sub.has(sn))sub.set(sn,[]);
      sub.get(sn).push(t);
    }
    return [...map.keys()].sort(catCmp).map(cn=>{
      const sub=map.get(cn);
      const subgrupos=[...sub.keys()].sort(subCmp).map(sn=>({nome:sn,itens:sub.get(sn)}));
      const itens=subgrupos.flatMap(s=>s.itens);
      return {nome:cn,subgrupos,itens};
    });
  }

  // % previsto pelo planejamento para o dia do diário (linear pelas
  // datas planejadas): antes do início 0, depois do término 100,
  // no meio proporcional ao prazo decorrido.
  function _percPrevisto(t){
    const i=_d(t.inicioPlanejado),f=_d(t.terminoPlanejado);
    if(!i||!f)return null;
    if(diaRef<i)return 0;
    if(diaRef>=f)return 100;
    const total=(f-i)/86400000+1;
    const dec=(diaRef-i)/86400000+1;
    return Math.round(dec/total*1000)/10;
  }

  // % recomendada pelo CONTROLE — módulo ainda em construção; quando
  // houver vínculo tarefa↔controle, calcular aqui. Por ora, sem vínculo.
  function _percControle(t){
    return null; // null = sem vínculo com o Controle ainda
  }

  // Produção física: delta% × quantidade, na unidade da própria tarefa.
  function _prodFisica(t,percAntes,percDepois){
    const q=parseFloat(t?.quantidade)||0;
    if(!q||percDepois==null||percAntes==null)return null;
    const delta=(percDepois-percAntes)/100*q;
    if(Math.abs(delta)<0.001)return null;
    return {qtd:delta,unidade:(t.unidade||'un')};
  }
  function _fmtQtd(v){return (Math.round(v*100)/100).toLocaleString('pt-BR');}

  // Gravação de avanço no Planejamento — caminho ÚNICO de escrita.
  // Regras do Semanal (inicioReal/terminoReal) + % em família (Utils).
  // dataISO: data do lançamento (padrão = dia do diário aberto, então
  // lançamento retroativo grava início/término real na data certa).
  async function _gravarAvanco(t,percDepois,dataISO){
    const dt=dataISO||_iso(diaRef);
    const upd={percentualConcluido:percDepois};
    const percAntesAudit=t.percentualConcluido||0;
    if(percDepois>0&&!t.inicioReal)upd.inicioReal=dt;
    if(percDepois>=100)upd.terminoReal=dt;
    if(percDepois<100&&t.terminoReal)upd.terminoReal='';
    await Database.atualizar(obraId,COL,t.id,upd);
    Object.assign(t,upd);
    Audit.campo(obraId,'Diário de Obra',t.id,t.nome,'percentualConcluido',percAntesAudit,percDepois).catch(()=>{});
    const fam=Utils.percFamilia(tarefas);
    let famUps=[];
    if(fam.filhosDiretos(t).length>0){
      famUps=Utils.distribuirPercDescendentes(tarefas,t.id,percDepois)
        .concat(Utils.recalcularPercAncestrais(tarefas,t.id));
    } else {
      famUps=Utils.recalcularPercAncestrais(tarefas,t.id);
    }
    for(const u of famUps){
      await Database.atualizar(obraId,COL,u.id,{percentualConcluido:u.percentualConcluido});
    }
    return famUps.length;
  }

  // --- handlers dos cards da pauta ---
  function pautaAbrir(tid,modo){_pautaExp={};_pautaExp[tid]=modo;_render();
    requestAnimationFrame(()=>{const i=document.getElementById('pt-perc-'+tid)||document.getElementById('pt-det-'+tid);if(i)i.focus();});}
  function pautaFechar(){_pautaExp={};_render();}
  function pautaPular(tid){_skips.add(tid);delete _pautaExp[tid];_render();}
  function pautaPreview(tid){
    const t=tarefas.find(x=>x.id===tid);if(!t)return;
    const inp=document.getElementById('pt-perc-'+tid);
    const out=document.getElementById('pt-prev-'+tid);
    if(!inp||!out)return;
    const v=parseFloat(inp.value);
    if(isNaN(v)){out.textContent='';return;}
    const pd=Math.min(100,Math.max(0,v));
    const pa=t.percentualConcluido||0;
    const partes=[];
    const pf=_prodFisica(t,pa,pd);
    if(pf)partes.push(`${pf.qtd>=0?'+':''}${_fmtQtd(pf.qtd)} ${pf.unidade}`);
    const fam=Utils.percFamilia(tarefas);
    const pai=fam.ancestrais(t)[0];
    if(pai){
      const antes=Math.round(fam.percCalculado(pai)*10)/10;
      const bkp=t.percentualConcluido;t.percentualConcluido=pd;
      const depois=Math.round(fam.percCalculado(pai)*10)/10;
      t.percentualConcluido=bkp;
      if(Math.abs(depois-antes)>=0.05)partes.push(`${pai.nome||'pai'}: ${antes}% → ${depois}%`);
    }
    out.textContent=partes.join(' · ');
  }
  async function pautaSalvarAvanco(tid){
    const t=tarefas.find(x=>x.id===tid);if(!t)return;
    const inp=document.getElementById('pt-perc-'+tid);
    const v=parseFloat(inp?.value);
    if(isNaN(v)){Utils.toast('Informe o % atual da tarefa.','alerta');return;}
    const percDepois=Math.min(100,Math.max(0,v));
    const percAntes=t.percentualConcluido||0;
    const atv=(document.getElementById('pt-atv-'+tid)?.value||'').trim();
    const dtRaw=(document.getElementById('pt-dt-'+tid)?.value||'').trim();
    const dtISO=dtRaw||_iso(diaRef);
    try{
      Utils.mostrarLoading('Salvando...');
      const ehPai=Utils.percFamilia(tarefas).filhosDiretos(t).length>0;
      await Database.criar(obraId,COLD,{
        data:_iso(diaRef),tarefaId:tid,
        tarefaLabel:(t.codigo?t.codigo+' ':'')+(t.nome||''),
        atividade:atv||'Avanço lançado pela pauta',
        status:percDepois>=100?'executado':'parcial',
        percAntes,percDepois,motivo:'',detalhe:'',obraId,
        createdAt:new Date().toISOString(),
      });
      const nFam=await _gravarAvanco(t,percDepois,dtISO);
      delete _pautaExp[tid];
      await _loadDia();_render();
      const pf=_prodFisica(t,percAntes,percDepois);
      Utils.toast(`Lançado!${pf?` ${pf.qtd>=0?'+':''}${_fmtQtd(pf.qtd)} ${pf.unidade}.`:''}${ehPai&&nFam?` % distribuído p/ ${nFam} tarefa(s).`:''}`,'sucesso');
    }catch(e){console.error(e);Utils.toast('Erro ao salvar.','erro');}
    finally{Utils.esconderLoading();}
  }
  async function pautaSalvarParado(tid){
    const t=tarefas.find(x=>x.id===tid);if(!t)return;
    const motivo=document.getElementById('pt-mot-'+tid)?.value||'';
    const detalhe=(document.getElementById('pt-det-'+tid)?.value||'').trim();
    try{
      Utils.mostrarLoading('Salvando...');
      await Database.criar(obraId,COLD,{
        data:_iso(diaRef),tarefaId:tid,
        tarefaLabel:(t.codigo?t.codigo+' ':'')+(t.nome||''),
        atividade:detalhe||'Não executado',
        status:'nao_executado',
        percAntes:t.percentualConcluido||0,percDepois:null,
        motivo,detalhe,obraId,
        createdAt:new Date().toISOString(),
      });
      delete _pautaExp[tid];
      await _loadDia();_render();
      Utils.toast('Registrado.','sucesso');
    }catch(e){console.error(e);Utils.toast('Erro ao salvar.','erro');}
    finally{Utils.esconderLoading();}
  }
  function toggleAtrasadas(){_atrasAberto=!_atrasAberto;_render();}
  function setVisao(v){
    _visao=v==='local'?'local':'servico';
    try{localStorage.setItem('diario_visao',_visao);}catch(e){}
    _subExp=null;_render();
  }
  function pautaAbrirSub(sk){_subExp=sk;_pautaExp={};_render();
    requestAnimationFrame(()=>{const i=document.querySelector('[id^="sb-perc-"]');if(i)i.focus();});}
  function pautaFecharSub(){_subExp=null;_render();}
  // Aplica o mesmo % a todas as folhas pendentes do subgrupo:
  // 1 lançamento por tarefa (percAntes correto) + gravação no Planejamento.
  async function pautaSalvarSub(sk,sfx){
    const ids=_subReg[sk]||[];
    if(!ids.length){Utils.toast('Nenhuma tarefa pendente neste bloco.','alerta');return;}
    const v=parseFloat(document.getElementById('sb-perc-'+sfx)?.value);
    if(isNaN(v)){Utils.toast('Informe o %.','alerta');return;}
    const percDepois=Math.min(100,Math.max(0,v));
    const dtISO=(document.getElementById('sb-dt-'+sfx)?.value||'').trim()||_iso(diaRef);
    const atv=(document.getElementById('sb-atv-'+sfx)?.value||'').trim();
    try{
      Utils.mostrarLoading(`Lançando em ${ids.length} tarefa(s)...`);
      for(const tid of ids){
        const t=tarefas.find(x=>x.id===tid);if(!t)continue;
        await Database.criar(obraId,COLD,{
          data:_iso(diaRef),tarefaId:tid,
          tarefaLabel:(t.codigo?t.codigo+' ':'')+(t.nome||''),
          atividade:atv||'Avanço lançado em lote pela pauta',
          status:percDepois>=100?'executado':'parcial',
          percAntes:t.percentualConcluido||0,percDepois,
          motivo:'',detalhe:'',obraId,
          createdAt:new Date().toISOString(),
        });
        await _gravarAvanco(t,percDepois,dtISO);
      }
      _subExp=null;
      await _loadDia();_render();
      Utils.toast(`Lançado em ${ids.length} tarefa(s)!`,'sucesso');
    }catch(e){console.error(e);Utils.toast('Erro ao salvar.','erro');}
    finally{Utils.esconderLoading();}
  }
  function toggleGrupo(pid){
    if(_grpAberto.has(pid))_grpAberto.delete(pid);else _grpAberto.add(pid);
    _render();
  }
  // Busca fuzzy p/ adicionar tarefa do planejamento à pauta.
  // Atualização parcial do DOM (só o holder de resultados) para não
  // perder o foco do input enquanto digita.
  function _optsNome(texto){
    const q=_norm(texto);
    const base=sorted.map(t=>({
      id:t.id,
      label:'\u2007\u2007'.repeat(t.nivel||0)+((t.nivel||0)>0?'– ':'')+(t.nome||''),
      nome:t.nome||'',
    }));
    if(!q)return base;
    return base.map(o=>({o,score:_score(_norm(o.nome),q)}))
      .filter(x=>x.score>=0).sort((a,b)=>b.score-a.score).map(x=>x.o);
  }
  function _pautaBuscaResHtml(){
    if(!_buscaPauta)return'';
    const opts=_optsNome(_buscaPauta).slice(0,40);
    return `<div class="dia-res">${opts.length?opts.map(o=>
      `<div onclick="Diario.pautaAddExtra('${o.id}')">${_esc(o.label)}</div>`).join(''):
      '<div style="color:#94a3b8;cursor:default;">Nenhuma tarefa encontrada</div>'}</div>`;
  }
  function pautaBuscar(v){
    _buscaPauta=v;
    const holder=document.getElementById('pauta-busca-res');
    if(holder)holder.innerHTML=_pautaBuscaResHtml();
  }
  function pautaAddExtra(id){
    _extras.add(id);_skips.delete(id);_buscaPauta='';
    const t=tarefas.find(x=>x.id===id);
    // Abre a categoria da tarefa (na visão atual) para o card aparecer na hora
    if(t){
      const {previstas}=_pautaItens();
      const visL=previstas.filter(x=>!_skips.has(x.id));
      const cats=_agruparPauta(visL);
      const nome=_visao==='servico'?_servico(t):_local(t);
      const ci=cats.findIndex(c=>c.nome===nome);
      if(ci>=0)_grpAberto.add('cat:'+_visao+':'+ci);
    }
    _render();
    Utils.toast('Tarefa adicionada à pauta.','sucesso');
  }
  function toggleForm(){_formAberto=!_formAberto;_render();
    if(_formAberto)requestAnimationFrame(()=>{const i=document.getElementById('dia-busca');if(i)i.focus();});}

  // --- avulsas (rolam entre dias até concluir) ---
  async function avulsaAdd(){
    const inp=document.getElementById('dia-avulsa-txt');
    const txt=(inp?.value||'').trim();
    if(!txt){Utils.toast('Descreva a tarefa avulsa.','alerta');return;}
    try{
      await Database.criar(obraId,COLD,{
        avulsa:true,concluida:false,data:_iso(diaRef),
        atividade:txt,obraId,createdAt:new Date().toISOString(),
      });
      await _loadDia();_render();
      requestAnimationFrame(()=>{const i=document.getElementById('dia-avulsa-txt');if(i)i.focus();});
    }catch(e){console.error(e);Utils.toast('Erro ao salvar.','erro');}
  }
  async function avulsaConcluir(id){
    const a=_avulsas.find(x=>x.id===id);if(!a)return;
    try{
      await Database.atualizar(obraId,COLD,id,{concluida:!a.concluida,dataConclusao:a.concluida?'':_iso(diaRef)});
      await _loadDia();_render();
    }catch(e){console.error(e);Utils.toast('Erro.','erro');}
  }
  async function avulsaExcluir(id){
    if(!confirm('Excluir esta tarefa avulsa?'))return;
    try{await Database.deletar(obraId,COLD,id);await _loadDia();_render();}
    catch(e){console.error(e);Utils.toast('Erro.','erro');}
  }

  // ==================== RENDER ====================
  function _cardPauta(t,lancMap,atrasada){
    const perc=t.percentualConcluido||0;
    const q=parseFloat(t.quantidade)||0;
    const lanc=lancMap.get(t.id);
    const exp=_pautaExp[t.id];
    const st=lanc?D_STATUS[lanc.status]:null;
    const pPrev=_percPrevisto(t);
    const inf=[`<b>${perc}%</b>${pPrev!=null?` <span style="color:${perc>=pPrev?'#16a34a':'#dc2626'};">(prev. ${pPrev}%)</span>`:''}`];
    if(q)inf.push(`${_fmtQtd(q)} ${_esc(t.unidade||'un')}`);
    inf.push(`Prev: ${_fmt(t.inicioPlanejado)}→${_fmt(t.terminoPlanejado)}`);
    inf.push(`Real: ${t.inicioReal?_fmt(t.inicioReal):'—'}→${t.terminoReal?_fmt(t.terminoReal):'—'}`);
    let acoes='';
    if(lanc&&st){
      acoes=`<span class="pt-badge" style="background:${st.bg};color:${st.cor};">${st.label}${lanc.percDepois!=null?` ${lanc.percAntes??'?'}→${lanc.percDepois}%`:''}</span>`;
    } else if(!exp){
      acoes=`<div class="pt-acao">
        <button class="a-and" title="Lançar avanço de % (grava no Planejamento)" onclick="Diario.pautaAbrir('${t.id}','andou')">✅ Andou</button>
        <button class="a-par" title="Registrar que não foi executado e o motivo" onclick="Diario.pautaAbrir('${t.id}','parado')">✖ Parado</button>
        <button title="Pular — deixar de fora da pauta de hoje" onclick="Diario.pautaPular('${t.id}')">⏭</button>
      </div>`;
    }
    let expH='';
    if(exp==='andou'){
      const pCtrl=_percControle(t);
      expH=`<div class="pt-exp">
        <div style="width:100%;font-size:.72rem;color:#475569;">
          💡 Recomendado — Planejamento: <b>${pPrev!=null?pPrev+'%':'sem datas'}</b> · Controle: <b>${pCtrl!=null?pCtrl+'%':'sem vínculo ainda'}</b>
        </div>
        <div><label>% atual</label><input type="number" id="pt-perc-${t.id}" min="0" max="100" step="1" value="${perc}" style="width:90px;" oninput="Diario.pautaPreview('${t.id}')" onkeydown="if(event.key==='Enter')Diario.pautaSalvarAvanco('${t.id}')"></div>
        <div><label title="Data usada para início/término real no Planejamento">Data</label><input type="date" id="pt-dt-${t.id}" value="${_iso(diaRef)}" style="width:135px;" title="Data do lançamento — vira início/término real no Planejamento (retroativo ok)"></div>
        <div style="flex:1;min-width:160px;"><label>O que foi feito (opcional)</label><input type="text" id="pt-atv-${t.id}" style="width:100%;" placeholder="Ex: eixo A-B, 2 pedreiros" onkeydown="if(event.key==='Enter')Diario.pautaSalvarAvanco('${t.id}')"></div>
        <button class="btn btn-sm btn-primario" title="Salvar e gravar no Planejamento" onclick="Diario.pautaSalvarAvanco('${t.id}')">Lançar</button>
        <button class="btn btn-sm btn-outline" title="Fechar sem salvar" onclick="Diario.pautaFechar()">✕</button>
        <div class="pt-prev" id="pt-prev-${t.id}"></div>
      </div>`;
    } else if(exp==='parado'){
      expH=`<div class="pt-exp">
        <div style="min-width:200px;"><label>Motivo</label><select id="pt-mot-${t.id}">${MOTIVOS.map(m=>`<option value="${_esc(m)}">${_esc(m)}</option>`).join('')}</select></div>
        <div style="flex:1;min-width:160px;"><label>Detalhe (opcional)</label><input type="text" id="pt-det-${t.id}" style="width:100%;" onkeydown="if(event.key==='Enter')Diario.pautaSalvarParado('${t.id}')"></div>
        <button class="btn btn-sm btn-primario" onclick="Diario.pautaSalvarParado('${t.id}')">Registrar</button>
        <button class="btn btn-sm btn-outline" onclick="Diario.pautaFechar()">✕</button>
      </div>`;
    }
    return `<div class="pt-card"${atrasada?' style="background:#fffbeb;"':''}>
      <div class="pt-l1">
        ${atrasada?'<span class="pt-badge" style="background:#fee2e2;color:#dc2626;">ATRASADA</span>':''}
        <span class="nm" title="${_esc(t.codigo||'')}">${_esc(t.nome||'')}</span>
        <span class="inf">${inf.join(' · ')}</span>
        ${acoes}
      </div>${expH}</div>`;
  }

  function _pautaHtml(){
    const {previstas,atrasadas}=_pautaItens();
    const lancMap=new Map();
    lancamentosDia.forEach(l=>{if(l.tarefaId)lancMap.set(l.tarefaId,l);});
    const fam=Utils.percFamilia(tarefas);
    const vis=previstas.filter(t=>!_skips.has(t.id));
    const cats=_agruparPauta(vis);
    const feitos=vis.filter(t=>lancMap.has(t.id)).length;
    _subReg={};

    // Sub-divisor (serviço ou local, conforme a visão) com "Lançar em todos"
    const subDivH=(s,ci,si)=>{
      const sk=`sub:${ci}:${si}`;
      const pend=s.itens.filter(t=>!lancMap.has(t.id));
      _subReg[sk]=pend.map(t=>t.id);
      const exp=_subExp===sk;
      let expH='';
      if(exp){
        expH=`<div class="pt-exp" style="margin:8px 12px;">
          <div><label>% p/ todas</label><input type="number" id="sb-perc-${ci}-${si}" min="0" max="100" step="1" style="width:90px;" onkeydown="if(event.key==='Enter')Diario.pautaSalvarSub('${sk}','${ci}-${si}')"></div>
          <div><label title="Data usada para início/término real">Data</label><input type="date" id="sb-dt-${ci}-${si}" value="${_iso(diaRef)}" style="width:135px;"></div>
          <div style="flex:1;min-width:140px;"><label>O que foi feito (opcional)</label><input type="text" id="sb-atv-${ci}-${si}" style="width:100%;"></div>
          <button class="btn btn-sm btn-primario" title="Aplica o % a todas as tarefas pendentes deste bloco" onclick="Diario.pautaSalvarSub('${sk}','${ci}-${si}')">Lançar em todas</button>
          <button class="btn btn-sm btn-outline" title="Fechar sem salvar" onclick="Diario.pautaFecharSub()">✕</button>
          <div class="pt-prev" style="color:#b45309;">⚠ Aplica o mesmo % às ${pend.length} tarefa(s) ainda não tratadas deste bloco.</div>
        </div>`;
      }
      return `<div style="padding:6px 12px;background:#f1f5f9;font-size:.76rem;font-weight:800;color:#334155;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:8px;">
        <span style="flex:1;">${_esc(s.nome)}</span>
        <span style="font-weight:600;color:#64748b;">${s.itens.length-pend.length}/${s.itens.length}</span>
        ${exp||!pend.length?'':`<button style="border:1px solid #cbd5e1;background:#fff;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:.68rem;font-weight:700;color:#475569;" title="Lançar o mesmo % em todas as tarefas pendentes deste bloco" onclick="Diario.pautaAbrirSub('${sk}')">Lançar em todas</button>`}
      </div>${expH}`;
    };

    // Categoria (nível 1: local ou serviço, conforme a visão) — recolhível
    const catH=(c,ci)=>{
      const k='cat:'+_visao+':'+ci;
      const aberto=_grpAberto.has(k)||c.itens.some(t=>_pautaExp[t.id])||(_subExp&&_subExp.startsWith(`sub:${ci}:`));
      const tratadas=c.itens.filter(t=>lancMap.has(t.id)).length;
      const pct=c.itens.length?Math.round(tratadas/c.itens.length*100):0;
      return `<div class="pt-grupo">
        <div class="pt-grupo-h" style="cursor:pointer;" title="${aberto?'Recolher':'Expandir'}" onclick="Diario.toggleGrupo('${k}')">
          <span class="nm">${aberto?'▾':'▸'} ${_esc(c.nome)}</span>
          <span class="inf">${tratadas}/${c.itens.length}</span>
          <span style="width:70px;height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden;flex-shrink:0;"><span style="display:block;height:100%;width:${pct}%;background:${pct>=100?'#16a34a':'#3b82f6'};"></span></span>
        </div>
        ${aberto?c.subgrupos.map((s,si)=>subDivH(s,ci,si)+s.itens.map(t=>_cardPauta(t,lancMap,false)).join('')).join(''):''}
      </div>`;
    };

    const atrasVis=atrasadas.filter(t=>!_skips.has(t.id));
    const catsAtras=_agruparPauta(atrasVis);
    const avPend=_avulsas.filter(a=>!a.concluida);
    const avDia=_avulsas.filter(a=>a.concluida);

    return `
    <div class="dia-sec-t" style="color:#0f172a;margin-top:0;">📌 Pauta do dia
      <span style="color:#94a3b8;font-weight:600;">(${feitos}/${vis.length} tratadas)</span>
      <span style="flex:1;"></span>
      <span style="display:inline-flex;border:1.5px solid #cbd5e1;border-radius:8px;overflow:hidden;font-size:.72rem;font-weight:800;">
        <button title="Agrupar por serviço (Gesso, Alvenaria...)" onclick="Diario.setVisao('servico')" style="border:none;padding:5px 12px;cursor:pointer;${_visao==='servico'?'background:#0f172a;color:#fff;':'background:#fff;color:#64748b;'}">Por Serviço</button>
        <button title="Agrupar por local (Térreo, 1° Pavimento...)" onclick="Diario.setVisao('local')" style="border:none;padding:5px 12px;cursor:pointer;${_visao==='local'?'background:#0f172a;color:#fff;':'background:#fff;color:#64748b;'}">Por Local</button>
      </span>
    </div>
    ${vis.length?cats.map(catH).join(''):
      `<div style="background:#fff;border:1px dashed #cbd5e1;border-radius:10px;padding:18px;text-align:center;color:#94a3b8;font-size:.82rem;margin-bottom:10px;">Nenhuma tarefa prevista para este dia no Planejamento.</div>`}

    <div class="pt-grupo">
      <div class="pt-card" style="position:relative;">
        <label style="font-size:.68rem;color:#64748b;font-weight:700;text-transform:uppercase;display:block;margin-bottom:3px;">🔎 Adicionar tarefa do planejamento à pauta</label>
        <input type="text" id="pauta-busca-inp" value="${_esc(_buscaPauta)}" placeholder="Busque pelo nome — ex: fachada, alvenaria 15..." style="width:100%;padding:7px 9px;border:1px solid #cbd5e1;border-radius:7px;font-size:.82rem;box-sizing:border-box;" oninput="Diario.pautaBuscar(this.value)" autocomplete="off">
        <div id="pauta-busca-res">${_pautaBuscaResHtml()}</div>
      </div>
    </div>

    ${atrasVis.length?`
    <div class="pt-grupo" style="border-color:#fbbf24;">
      <div class="pt-grupo-h" style="background:#fffbeb;cursor:pointer;" title="${_atrasAberto?'Recolher':'Expandir'} atrasadas" onclick="Diario.toggleAtrasadas()">
        <span class="nm" style="color:#b45309;">⚠ Atrasadas — término já passou e não concluíram</span>
        <span class="inf" style="color:#b45309;font-weight:800;">${atrasVis.length} ${_atrasAberto?'▴':'▾'}</span>
      </div>
      ${_atrasAberto?catsAtras.map(c=>`
        <div style="padding:6px 12px;background:#fef3c7;font-size:.76rem;font-weight:800;color:#92400e;border-bottom:1px solid #fde68a;">${_esc(c.nome)}</div>
        ${c.subgrupos.map(s=>`
          ${c.subgrupos.length>1||s.nome!==c.nome?`<div style="padding:4px 12px;background:#fffbeb;font-size:.7rem;font-weight:700;color:#a16207;border-bottom:1px solid #fde68a;">${_esc(s.nome)}</div>`:''}
          ${s.itens.map(t=>_cardPauta(t,lancMap,true)).join('')}`).join('')}`).join(''):''}
    </div>`:''}

    <div class="pt-grupo">
      <div class="pt-grupo-h">
        <span class="nm">📝 Tarefas avulsas <span style="font-weight:600;color:#94a3b8;">(fora do planejamento — rolam até concluir)</span></span>
      </div>
      <div class="pt-card" style="display:flex;gap:8px;">
        <input type="text" id="dia-avulsa-txt" placeholder="Ex: conversar com projetista sobre detalhe da fachada" style="flex:1;padding:6px 9px;border:1px solid #cbd5e1;border-radius:7px;font-size:.8rem;" onkeydown="if(event.key==='Enter')Diario.avulsaAdd()">
        <button class="btn btn-sm btn-primario" title="Adicionar tarefa avulsa (fora do planejamento) — rola para os próximos dias até concluir" onclick="Diario.avulsaAdd()">＋ Adicionar</button>
      </div>
      ${avPend.map(a=>`<div class="pt-card"><div class="pt-l1">
        <input type="checkbox" title="Marcar como concluída" onchange="Diario.avulsaConcluir('${a.id}')" style="cursor:pointer;">
        <span class="nm">${_esc(a.atividade||'')}</span>
        <span class="inf">desde ${_fmt(a.data)}</span>
        <button class="btn-icone" title="Excluir" onclick="Diario.avulsaExcluir('${a.id}')">🗑️</button>
      </div></div>`).join('')}
      ${avDia.map(a=>`<div class="pt-card" style="opacity:.6;"><div class="pt-l1">
        <input type="checkbox" checked onchange="Diario.avulsaConcluir('${a.id}')" style="cursor:pointer;">
        <span class="nm" style="text-decoration:line-through;">${_esc(a.atividade||'')}</span>
        <span class="inf">concluída hoje</span>
      </div></div>`).join('')}
      ${!avPend.length&&!avDia.length?'<div class="pt-card" style="color:#94a3b8;font-size:.78rem;">Nenhuma tarefa avulsa pendente.</div>':''}
    </div>`;
  }

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
      .pt-grupo{background:#fff;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:10px;overflow:hidden;}
      .pt-grupo-h{background:#f8fafc;padding:8px 12px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #e2e8f0;flex-wrap:wrap;}
      .pt-grupo-h .nm{font-weight:800;font-size:.84rem;color:#0f172a;flex:1;min-width:0;}
      .pt-grupo-h .inf{font-size:.72rem;color:#64748b;white-space:nowrap;}
      .pt-card{padding:9px 12px;border-bottom:1px solid #f1f5f9;}
      .pt-card:last-child{border-bottom:none;}
      .pt-l1{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
      .pt-l1 .nm{font-size:.82rem;font-weight:700;flex:1;min-width:180px;}
      .pt-l1 .inf{font-size:.72rem;color:#64748b;white-space:nowrap;}
      .pt-acao{display:flex;gap:5px;}
      .pt-acao button{border:1.5px solid #cbd5e1;background:#fff;border-radius:7px;padding:4px 9px;cursor:pointer;font-size:.72rem;font-weight:700;color:#475569;white-space:nowrap;}
      .pt-acao .a-and{border-color:#16a34a;color:#16a34a;}
      .pt-acao .a-par{border-color:#dc2626;color:#dc2626;}
      .pt-exp{margin-top:8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;}
      .pt-exp label{font-size:.68rem;color:#64748b;font-weight:700;text-transform:uppercase;display:block;margin-bottom:2px;}
      .pt-exp input,.pt-exp select{padding:6px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:.8rem;box-sizing:border-box;}
      .pt-badge{padding:2px 7px;border-radius:6px;font-size:.66rem;font-weight:800;white-space:nowrap;}
      .pt-prev{font-size:.74rem;color:#2563eb;font-weight:700;min-height:1em;width:100%;}
    </style>
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
      <div class="dia-nav">
        <button title="Dia anterior" onclick="Diario.nav(-1)">‹</button>
        <span class="lbl">${DIAS[diaRef.getDay()]}, ${_fmt(iso)}${iso===hojeIso?' (hoje)':''}</span>
        <button title="Próximo dia" onclick="Diario.nav(1)">›</button>
        <button onclick="Diario.hojeBtn()" title="Ir para hoje" style="border-left:1px solid #334155;">●</button>
      </div>
      <input type="date" value="${iso}" title="Escolher uma data" onchange="Diario.setData(this.value)" style="padding:7px 9px;border:1px solid #cbd5e1;border-radius:8px;font-size:.82rem;">
      <div style="flex:1;"></div>
      <button class="btn btn-sm btn-outline" title="Lançamento livre com busca em todo o Planejamento" onclick="Diario.toggleForm()">${_formAberto?'✕ Fechar':'＋ Fora da pauta'}</button>
      <button class="btn btn-sm" style="background:#0f172a;color:#fff;" title="Gerar o relatório completo do dia" onclick="Diario.gerarRelatorio()">📄 Relatório do dia</button>
    </div>

    ${_pautaHtml()}

    ${(_formAberto||_editId)?`<div class="dia-sec-t" style="color:#0f172a;">🔎 Lançamento fora da pauta <span style="color:#94a3b8;font-weight:600;">(busca em todo o Planejamento)</span></div>
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
    </div>`:''}

    ${lancamentosDia.length?`<div class="dia-sec-t" style="color:#0f172a;margin-top:18px;">🗒 Lançamentos do dia <span style="color:#94a3b8;font-weight:600;">(${lancamentosDia.length})</span></div>`:''}
    ${!lancamentosDia.length?``:
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

      // Grava o avanço no Planejamento — caminho único (_gravarAvanco):
      // regras do Semanal (inicioReal/terminoReal) + % em família (Utils)
      if(percDepois!=null&&t){
        await _gravarAvanco(t,percDepois,_iso(diaRef));
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

    // ===== PRODUÇÃO FÍSICA DO DIA =====
    // delta% × quantidade da tarefa, agrupado pela unidade dela.
    const prodItens=[];
    const prodPorUnidade={};
    for(const l of lancamentosDia){
      if(l.percDepois==null||l.percAntes==null)continue;
      const t=tarefas.find(x=>x.id===l.tarefaId);if(!t)continue;
      const pf=_prodFisica(t,l.percAntes,l.percDepois);
      prodItens.push({l,t,pf});
      if(pf){
        prodPorUnidade[pf.unidade]=(prodPorUnidade[pf.unidade]||0)+pf.qtd;
      }
    }
    const avPend=_avulsas.filter(a=>!a.concluida);

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
        ${Object.keys(prodPorUnidade).length?`
        <div style="margin-bottom:16px;">
          <div style="font-weight:800;font-size:.9rem;color:#0369a1;border-bottom:2px solid #0369a1;padding-bottom:4px;margin-bottom:8px;">📐 Produção física do dia</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px;">
            ${Object.entries(prodPorUnidade).map(([u,q])=>`<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:8px 14px;font-size:.95rem;font-weight:800;color:#0369a1;">${q>=0?'+':''}${_fmtQtd(q)} <span style="font-size:.72rem;font-weight:700;">${_esc(u)}</span></div>`).join('')}
          </div>
          ${prodItens.map(({l,t,pf})=>`<div style="padding:4px 0;border-bottom:1px solid #f1f5f9;font-size:.8rem;">
            <b>${_esc(l.tarefaLabel||'')}</b> · ${l.percAntes}% → ${l.percDepois}%
            ${pf?`<span style="color:#0369a1;font-weight:700;"> · ${pf.qtd>=0?'+':''}${_fmtQtd(pf.qtd)} ${_esc(pf.unidade)}</span>`:'<span style="color:#94a3b8;font-size:.72rem;"> · sem quantidade cadastrada</span>'}
          </div>`).join('')}
        </div>`:''}
        ${bloco('✅ Executado','#16a34a',exec.map(li),'Nenhum lançamento como executado.')}
        ${bloco('◐ Parcial','#ca8a04',parc.map(li),'Nenhum lançamento parcial.')}
        ${bloco('✖ Não executado','#dc2626',nao.map(li),'Nenhum lançamento como não executado.')}
        ${bloco('⚠️ Deveria estar em execução (sem lançamento)','#7c3aed',semLanc.map(liT),'Tudo que estava previsto tem lançamento. 👏')}
        ${bloco('📋 Porquês do dia','#0f172a',porques.map(l=>`<div style="padding:5px 0;border-bottom:1px solid #f1f5f9;font-size:.8rem;"><b>${_esc(l.motivo)}</b>${l.detalhe?' — '+_esc(l.detalhe):''} <span style="color:#64748b;">(${_esc(l.tarefaLabel||'')})</span></div>`),'Nenhum motivo registrado hoje.')}
        ${bloco('📝 Pendências / tarefas avulsas em aberto','#b45309',avPend.map(a=>`<div style="padding:5px 0;border-bottom:1px solid #f1f5f9;font-size:.8rem;">${_esc(a.atividade||'')} <span style="color:#94a3b8;font-size:.72rem;">(desde ${_fmt(a.data)})</span></div>`),'Nenhuma pendência em aberto.')}
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
    salvar,editar,cancelarEdicao,excluir,gerarRelatorio,imprimirRelatorio,
    pautaAbrir,pautaFechar,pautaPular,pautaPreview,pautaSalvarAvanco,pautaSalvarParado,
    toggleAtrasadas,toggleGrupo,toggleForm,pautaBuscar,pautaAddExtra,
    setVisao,pautaAbrirSub,pautaFecharSub,pautaSalvarSub,
    avulsaAdd,avulsaConcluir,avulsaExcluir};
})();
function onObraChanged(){Diario.init();}

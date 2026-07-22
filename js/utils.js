// Utils — Controle e Planejamento Absoluta
const Utils = (() => {

  // ---- Formatação ----
  const formatarNumero = (n, d=2) => isNaN(n)||n==null ? '0,00' : Number(n).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
  const formatarInteiro = (n) => isNaN(n)||n==null ? '0' : Number(n).toLocaleString('pt-BR',{maximumFractionDigits:0});
  const formatarData = (d) => { if(!d)return'—'; if(d.toDate)d=d.toDate(); return new Date(d).toLocaleDateString('pt-BR'); };
  const formatarDataHora = (d) => { if(!d)return'—'; if(d.toDate)d=d.toDate(); const dt=new Date(d); return dt.toLocaleDateString('pt-BR')+' '+dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); };
  const formatarM2 = (v) => formatarNumero(v)+' m²';
  const formatarML = (v) => formatarNumero(v)+' m';
  const parseNum = (v) => { if(typeof v==='number')return v; if(!v)return 0; return parseFloat(String(v).replace(',','.'))||0; };
  const hoje = () => new Date().toISOString().split('T')[0];

  // ---- Toast ----
  function toast(msg, tipo='info', dur=3500) {
    let box = document.querySelector('.toast-container');
    if (!box) { box=document.createElement('div'); box.className='toast-container'; document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = `toast ${tipo}`;
    t.innerHTML = `<span>${{sucesso:'✓',erro:'✕',alerta:'⚠',info:'ℹ'}[tipo]||'ℹ'}</span> ${msg}`;
    box.appendChild(t);
    setTimeout(() => { t.style.cssText='opacity:0;transform:translateX(20px);transition:all .3s'; setTimeout(()=>t.remove(),300); }, dur);
  }

  // ---- Modal ----
  const abrirModal = (id) => { const m=document.getElementById(id); if(m){m.classList.add('ativo');document.body.style.overflow='hidden';} };
  const fecharModal = (id) => { const m=document.getElementById(id); if(m){m.classList.remove('ativo');document.body.style.overflow='';} };
  const fecharTodosModais = () => { document.querySelectorAll('.modal-overlay.ativo').forEach(m=>m.classList.remove('ativo')); document.body.style.overflow=''; };
  const confirmar = (msg) => window.confirm(msg);

  // ---- Loading ----
  function mostrarLoading(msg='Carregando...') {
    let el=document.getElementById('loading-global');
    if(!el){el=document.createElement('div');el.id='loading-global';el.className='loading-overlay';el.innerHTML=`<div class="spinner spinner-lg"></div><span style="color:#64748b;font-size:.9rem">${msg}</span>`;document.body.appendChild(el);}
    el.style.display='flex';
  }
  const esconderLoading = () => { const el=document.getElementById('loading-global'); if(el)el.style.display='none'; };

  // ---- Form helpers ----
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  function limparForm(id) {
    const f=document.getElementById(id); if(!f)return;
    f.querySelectorAll('input,select,textarea').forEach(el => { if(el.type==='checkbox')el.checked=false; else el.value=''; });
  }
  function getFormData(id) {
    const f=document.getElementById(id); if(!f)return{};
    const d={};
    f.querySelectorAll('[name]').forEach(el => {
      if(el.type==='checkbox') d[el.name]=el.checked;
      else if(el.type==='number') d[el.name]=parseNum(el.value);
      else d[el.name]=el.value.trim();
    });
    return d;
  }
  function setFormData(id, data) {
    const f=document.getElementById(id); if(!f||!data)return;
    Object.entries(data).forEach(([k,v])=>{ const el=f.querySelector(`[name="${k}"]`); if(!el)return; if(el.type==='checkbox')el.checked=!!v; else el.value=v??''; });
  }
  const debounce = (fn,delay=300) => { let t; return (...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),delay);}; };

  // ---- Renderiza info do usuário na sidebar ----
  function _renderUser() {
    const p = Auth.getProfile();
    const u = Auth.getUser();
    const nome = p?.nome || u?.email?.split('@')[0] || 'Usuário';
    const perfil = p?.perfil === 'admin' ? 'Administrador' : 'Usuário';
    const avatar = nome.charAt(0).toUpperCase();
    const nameEl   = document.querySelector('.user-name');
    const roleEl   = document.querySelector('.user-role');
    const avatarEl = document.querySelector('.user-avatar');
    if (nameEl)   nameEl.textContent   = nome;
    if (roleEl)   roleEl.textContent   = perfil;
    if (avatarEl) avatarEl.textContent = avatar;
  }

  // ---- PWA: manifest + service worker (pra aparecer no menu de compartilhar do Android) ----
  function _registrarPWA() {
    try {
      if (!document.querySelector('link[rel="manifest"]')) {
        const link = document.createElement('link');
        link.rel = 'manifest';
        link.href = '/manifest.json';
        document.head.appendChild(link);
      }
      if ('serviceWorker' in navigator) {
        // Escopo restrito a /share-target/: o SW só controla essa rota
        // (recebe o compartilhamento do Samsung Notes/Android), sem
        // interceptar a navegação normal entre módulos do sistema.
        //
        // IMPORTANTE: navegadores que já visitaram o site antes desta
        // correção podem ter um SW antigo registrado com escopo raiz
        // ("/"), que passava a controlar TODA a navegação do site —
        // essa era a causa do travamento ao trocar de módulo. Por isso
        // limpamos qualquer registro com escopo raiz antes de registrar
        // o novo, restrito.
        navigator.serviceWorker.getRegistrations().then((regs) => {
          regs.forEach((reg) => {
            const scopePath = new URL(reg.scope).pathname;
            if (scopePath === '/' || scopePath === '') {
              reg.unregister().catch(() => {});
            }
          });
        }).catch(() => {});

        navigator.serviceWorker.register('/service-worker.js', { scope: '/share-target/' }).catch((e) => {
          console.warn('Service worker não registrado:', e.message);
        });
      }
    } catch (e) {
      console.warn('PWA não registrado:', e.message);
    }
  }

  // ---- initPagina: robusto, sem timers conflitantes ----
  async function initPagina(options = {}) {
    _registrarPWA();

    // 1. Firebase
    if (!initFirebase()) {
      console.error('Firebase falhou ao inicializar');
      return false;
    }

    // 2. Auth — aguarda o resultado (o próprio Auth.init() tem timeout de 8s)
    const user = await Auth.init();

    if (!user) {
      window.location.href = 'login.html';
      return false;
    }

    // 3. Seletor de obras (erro aqui NÃO bloqueia a página)
    try {
      Router.init();
      await Router.popularSeletorObras();
    } catch (e) {
      console.warn('Seletor de obras falhou:', e.message);
    }

    // 4. Info do usuário na sidebar
    _renderUser();

    return true;
  }

  // Gera opções de <select> com hierarquia visual (indentação por nível),
  // na mesma ordem do Planejamento. Usada em todo módulo que vincula algo
  // a uma tarefa (Materiais, Mão de Obra, Suprimentos, etc.) para permitir
  // vincular tanto a um nível "pai" quanto a um nível "filho" específico.
  // Retorna array de {id, label, nivel, tipo} pronto para .map() em <option>.
  function opcoesTarefaHierarquia(tarefas){
    const sorted=[...(tarefas||[])].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    // \u2007 (figure space) não é colapsado pelo navegador dentro de <option>,
    // diferente do espaço normal — é o que permite a indentação visual.
    return sorted.map(t=>{
      const nivel=t.nivel||0;
      const indent='\u2007\u2007'.repeat(nivel);
      const marcador=t.tipo==='grupo'?'▸ ':(nivel>0?'– ':'');
      const label=indent+marcador+(t.nome||'');
      return {id:t.id, label, codigo:t.codigo||'', nivel, tipo:t.tipo||'tarefa'};
    });
  }

  // ============================================================
  // % EM FAMÍLIA (pai ↔ filhos), estilo MS Project.
  // Hierarquia definida por ordem + nivel: o pai de uma tarefa é a
  // tarefa anterior (na ordem) com nível menor; filhos diretos são a
  // sequência seguinte com nível = nivel+1 até voltar a nível <= nivel.
  // Ponderação: pela quantidade dos filhos quando TODOS os filhos
  // diretos têm quantidade > 0; senão, média simples.
  // Usado por Planejamento, Semanal e Diário — NÃO duplicar a lógica.
  // ============================================================
  function percFamilia(tarefas){
    const sorted=[...(tarefas||[])].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    const idx=new Map(sorted.map((t,i)=>[t.id,i]));
    function filhosDiretos(t){
      const i=idx.get(t.id);if(i==null)return[];
      const n=t.nivel||0;const out=[];
      for(let j=i+1;j<sorted.length;j++){
        const nj=sorted[j].nivel||0;
        if(nj<=n)break;
        if(nj===n+1)out.push(sorted[j]);
      }
      return out;
    }
    function ancestrais(t){
      const i=idx.get(t.id);if(i==null)return[];
      let n=t.nivel||0;const out=[];
      for(let j=i-1;j>=0&&n>0;j--){
        const nj=sorted[j].nivel||0;
        if(nj<n){out.push(sorted[j]);n=nj;}
      }
      return out;
    }
    function descendentes(t){
      const i=idx.get(t.id);if(i==null)return[];
      const n=t.nivel||0;const out=[];
      for(let j=i+1;j<sorted.length;j++){
        if((sorted[j].nivel||0)<=n)break;
        out.push(sorted[j]);
      }
      return out;
    }
    // Peso = duração da tarefa (nunca quantidade) — mesma regra de
    // obras.js:_calcularProgresso, pra não divergir do Dashboard/KPIs.
    function percCalculado(t){
      const f=filhosDiretos(t);
      if(!f.length)return Math.min(100,Math.max(0,parseFloat(t.percentualConcluido)||0));
      let sp=0,sw=0;
      for(const x of f){
        const w=Math.max(1,parseFloat(x.duracao)||1);
        sp+=percCalculado(x)*w;sw+=w;
      }
      return sw?sp/sw:0;
    }
    return {sorted, filhosDiretos, ancestrais, descendentes, percCalculado};
  }

  // Recalcula o % dos ancestrais de uma tarefa (após editar o % dela).
  // Muta as tarefas em memória e retorna [{id, percentualConcluido}] só
  // dos ancestrais que mudaram, para o chamador persistir no Firestore.
  function recalcularPercAncestrais(tarefas, tarefaId){
    const fam=percFamilia(tarefas);
    const t=fam.sorted.find(x=>x.id===tarefaId);if(!t)return[];
    const ups=[];
    for(const a of fam.ancestrais(t)){
      const p=Math.round(fam.percCalculado(a)*10)/10;
      if(Math.abs(p-(parseFloat(a.percentualConcluido)||0))>0.05){
        a.percentualConcluido=p;
        ups.push({id:a.id,percentualConcluido:p});
      }
    }
    return ups;
  }

  // Distribui o % digitado em um pai para TODOS os descendentes
  // (folhas e intermediários ficam com o mesmo %). Muta em memória e
  // retorna [{id, percentualConcluido}] dos descendentes que mudaram.
  // O chamador é responsável por salvar o % do próprio pai.
  function distribuirPercDescendentes(tarefas, tarefaId, perc){
    const fam=percFamilia(tarefas);
    const t=fam.sorted.find(x=>x.id===tarefaId);if(!t)return[];
    const p=Math.min(100,Math.max(0,parseFloat(perc)||0));
    const ups=[];
    for(const d of fam.descendentes(t)){
      if(Math.abs(p-(parseFloat(d.percentualConcluido)||0))>0.05){
        d.percentualConcluido=p;
        ups.push({id:d.id,percentualConcluido:p});
      }
    }
    return ups;
  }

  // ============================================================
  // CÁLCULO DE M² LÍQUIDO DO LEVANTAMENTO DE FACHADA (com desconto de
  // janela/vão, igual à lógica de js/levantamento-fachada.js). Usado por
  // Materiais e Mão de Obra para vincular quantidade DIRETO ao levantamento
  // (opção especial "[Levantamento] Fachada" na busca de tarefa) — assim,
  // vários serviços (chapisco, reboco, limpeza...) podem usar o MESMO m²
  // real da fachada, sem depender do campo quantidade da tarefa no
  // Planejamento. Mantido em sincronia manual com levantamento-fachada.js;
  // se a config de cálculo mudar lá, replicar aqui.
  // cfg: objeto de configuração passado pelo módulo (já carregado do Firestore).
  //      Se omitido, usa os defaults (desconto total de janela, ML < 0.5m²).
  function calcularFachadaM2(pecas, obraId, cfg){
    const pn=v=>{const n=parseFloat(String(v==null?'':v).replace(',','.'));return isNaN(n)?0:n;};
    const m=cm=>pn(cm)/100;
    // cfg vem do Firestore via levantamento-fachada.js — não mais do localStorage
    if(!cfg)cfg={janela_modo:'desconto_total',janela_valor_fixo:1.0,ml_menor_que:0.50,ml_percentual:50};

    function descontoJanela(larJ,altJ,qtJ,qt){
      if(!(qtJ>0&&larJ>0&&altJ>0))return 0;
      if(cfg.janela_modo==='nenhum')return 0;
      const areaUnitaria=larJ*altJ;
      const areaTotal=areaUnitaria*qtJ*qt;
      const limX=pn(cfg.janela_limite_x)||1.5;
      const valY=pn(cfg.janela_valor_y)||1.0;
      if(cfg.janela_modo==='desconto_total')return areaTotal;
      if(cfg.janela_modo==='parcial_considera')return areaUnitaria>limX?Math.max(0,(areaUnitaria-valY)*qtJ*qt):0;
      if(cfg.janela_modo==='parcial_desconta')return areaUnitaria>limX?valY*qtJ*qt:0;
      if(cfg.janela_modo==='metade')return areaTotal/2;
      return 0;
    }

    let m2semML=0,m2comML_puro=0,ml=0,mlEquiv=0;
    const mlPct=pn(cfg.ml_percentual)/100;
    (pecas||[]).forEach(pc=>{
      const co=m(pn(pc.comprimento)),al=m(pn(pc.altura)),qt=pn(pc.quantidade)||1;
      const bruto=co*al*qt;
      let janela=0;
      if(pc.possuiJanela){
        const listaJ=(pc.janelas&&pc.janelas.length)?pc.janelas:((pc.larguraJanela||pc.quantidadeJanelas)?[{largura:pc.larguraJanela,altura:pc.alturaJanela,quantidade:pc.quantidadeJanelas}]:[]);
        listaJ.forEach(j=>{
          const larJ=m(pn(j.largura)),altJ=m(pn(j.altura)),qtJ=pn(j.quantidade)||0;
          janela+=descontoJanela(larJ,altJ,qtJ,qt);
        });
      }
      const areaLiq=Math.max(0,bruto-janela);
      const maiorLado=Math.max(co,al);
      m2semML+=areaLiq;
      if(pc.podeSerML){ml+=maiorLado*qt;mlEquiv+=maiorLado*qt*mlPct;}
      else{m2comML_puro+=areaLiq;}
    });
    return {m2semML,m2comML_puro,ml,m2comML_equiv:m2comML_puro+mlEquiv};
  }

  // ===================== CÁLCULO DE KIT — LEVANTAMENTO AR CONDICIONADO =====================
  // Dado uma máquina configurada (modelo Cobre) e o comprimento base (Y, do projeto/levantamento),
  // calcula o metro linear total de cobre (com perda) e deriva todos os itens vinculados/por ML.
  function calcularKitAr(maquina, mlBase) {
    const Y = parseFloat(mlBase) || 0;
    const Z = parseFloat(maquina?.perdaCm) || 0;   // perda em cm
    const A = parseFloat(maquina?.perdaPercentual) || 0; // perda em %
    const mlTotal = (Y + (Z / 100)) * (1 + (A / 100));

    const rolo = (mPorRolo, metros) => {
      const mr = parseFloat(mPorRolo) || 0;
      return mr > 0 ? metros / mr : 0;
    };

    const cobre = maquina?.cobre ? {
      ...maquina.cobre,
      metros: mlTotal,
      rolos: rolo(maquina.cobre.mPorRolo, mlTotal),
    } : null;

    const vinculados = (maquina?.vinculados || []).map(v => ({
      ...v,
      metros: mlTotal,
      rolos: rolo(v.mPorRolo, mlTotal),
    }));

    const porMl = (maquina?.porMl || []).map(p => {
      const taxa = parseFloat(p.taxa) || 0;
      if (p.tipo === 'uni_por_ml') {
        return { ...p, quantidade: Math.ceil(taxa * mlTotal) };
      }
      // cm_por_ml -> converte para metros no total
      const metros = (taxa * mlTotal) / 100;
      const mPorUnidade = parseFloat(p.mPorUnidade) || 0;
      const unidades = mPorUnidade > 0 ? metros / mPorUnidade : null;
      return { ...p, quantidade: metros, unidades };
    });

    return { mlBase: Y, mlTotal, cobre, vinculados, porMl };
  }

  return {
    formatarNumero, formatarInteiro, formatarData, formatarDataHora, formatarM2, formatarML,
    parseNum, hoje, toast, abrirModal, fecharModal, fecharTodosModais, confirmar,
    mostrarLoading, esconderLoading, $, $$, limparForm, getFormData, setFormData, debounce,
    initPagina, opcoesTarefaHierarquia, calcularFachadaM2,
    percFamilia, recalcularPercAncestrais, distribuirPercDescendentes, calcularKitAr,
  };
})();

// ============================================================
// GAVETA LATERAL — tablet/APK (≤1024px)
// Injeta botão hambúrguer e overlay em todas as páginas.
// No desktop não aparece (CSS oculta via display:none).
// ============================================================
(function initGaveta(){
  function _abrir(){
    document.querySelector('.sidebar')?.classList.add('aberta');
    _ov().classList.add('ativo');
  }
  function _fechar(){
    document.querySelector('.sidebar')?.classList.remove('aberta');
    _ov().classList.remove('ativo');
  }
  function _ov(){
    let ov=document.querySelector('.sidebar-overlay');
    if(!ov){
      ov=document.createElement('div');
      ov.className='sidebar-overlay';
      ov.onclick=_fechar;
      document.querySelector('.app-container')?.appendChild(ov);
    }
    return ov;
  }
  function _setup(){
    const header=document.querySelector('.header');
    if(!header||header.querySelector('.btn-menu-tablet')) return;
    const btn=document.createElement('button');
    btn.className='btn-menu-tablet';
    btn.setAttribute('aria-label','Menu');
    btn.innerHTML='☰';
    btn.onclick=_abrir;
    header.insertBefore(btn,header.firstChild);
    // Fecha ao clicar num link da nav
    document.querySelectorAll('.sidebar-nav a').forEach(a=>a.addEventListener('click',_fechar));
    // Fecha ao girar para paisagem se não for mais tablet
    window.addEventListener('resize',()=>{if(window.innerWidth>1024)_fechar();});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',_setup);
  else _setup();
})();

// ============================================================
// ACESSO SECRETO — Tarefas do Sistema
// 5 cliques na logo da sidebar (em até 2s) abrem a lista de
// tarefas. Não aparece em lugar nenhum do menu — só quem sabe.
// ============================================================
(function initAcessoSecreto(){
  function _setup(){
    const logo = document.querySelector('.sidebar-logo');
    if(!logo || logo.dataset.segredoAtivo) return;
    logo.dataset.segredoAtivo = '1';
    logo.style.cursor = 'pointer';
    let cliques = 0, timer = null;
    logo.addEventListener('click', () => {
      cliques++;
      clearTimeout(timer);
      timer = setTimeout(() => { cliques = 0; }, 2000);
      if (cliques >= 5) {
        cliques = 0;
        clearTimeout(timer);
        window.location.href = 'todo.html';
      }
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',_setup);
  else _setup();
})();

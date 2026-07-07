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

  return {
    formatarNumero, formatarInteiro, formatarData, formatarDataHora, formatarM2, formatarML,
    parseNum, hoje, toast, abrirModal, fecharModal, fecharTodosModais, confirmar,
    mostrarLoading, esconderLoading, $, $$, limparForm, getFormData, setFormData, debounce,
    initPagina,
  };
})();

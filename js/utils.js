// ============================================
// Utilitários Globais
// ============================================

const Utils = (() => {

  function formatarNumero(num, decimais = 2) {
    if (num == null || isNaN(num)) return '0,00';
    return Number(num).toLocaleString('pt-BR', {
      minimumFractionDigits: decimais,
      maximumFractionDigits: decimais
    });
  }
  function formatarInteiro(num) {
    if (num == null || isNaN(num)) return '0';
    return Number(num).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
  }
  function formatarData(data) {
    if (!data) return '—';
    if (data.toDate) data = data.toDate();
    if (typeof data === 'string') data = new Date(data);
    return data.toLocaleDateString('pt-BR');
  }
  function formatarDataHora(data) {
    if (!data) return '—';
    if (data.toDate) data = data.toDate();
    if (typeof data === 'string') data = new Date(data);
    return data.toLocaleDateString('pt-BR') + ' ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  function formatarM2(valor) { return formatarNumero(valor) + ' m²'; }
  function formatarML(valor) { return formatarNumero(valor) + ' m'; }
  function parseNum(valor) {
    if (typeof valor === 'number') return valor;
    if (!valor) return 0;
    return parseFloat(String(valor).replace(',', '.')) || 0;
  }

  // ---- Toast ----
  function toast(mensagem, tipo = 'info', duracao = 3500) {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const t = document.createElement('div');
    t.className = `toast ${tipo}`;
    const icons = { sucesso: '✓', erro: '✕', alerta: '⚠', info: 'ℹ' };
    t.innerHTML = `<span>${icons[tipo] || 'ℹ'}</span> ${mensagem}`;
    container.appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0'; t.style.transform = 'translateX(20px)';
      t.style.transition = 'all 0.3s ease';
      setTimeout(() => t.remove(), 300);
    }, duracao);
  }

  // ---- Modal ----
  function abrirModal(id) {
    const modal = document.getElementById(id);
    if (modal) { modal.classList.add('ativo'); document.body.style.overflow = 'hidden'; }
  }
  function fecharModal(id) {
    const modal = document.getElementById(id);
    if (modal) { modal.classList.remove('ativo'); document.body.style.overflow = ''; }
  }
  function fecharTodosModais() {
    document.querySelectorAll('.modal-overlay.ativo').forEach(m => m.classList.remove('ativo'));
    document.body.style.overflow = '';
  }

  function confirmar(mensagem) { return window.confirm(mensagem); }

  // ---- Loading ----
  function mostrarLoading(msg = 'Carregando...') {
    let overlay = document.getElementById('loading-global');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'loading-global';
      overlay.className = 'loading-overlay';
      overlay.innerHTML = `<div class="spinner spinner-lg"></div><span style="color:#64748b;font-size:0.9rem;">${msg}</span>`;
      document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
  }
  function esconderLoading() {
    const overlay = document.getElementById('loading-global');
    if (overlay) overlay.style.display = 'none';
  }

  // ---- DOM ----
  function $(seletor) { return document.querySelector(seletor); }
  function $$(seletor) { return document.querySelectorAll(seletor); }

  function limparForm(formId) {
    const form = document.getElementById(formId);
    if (form) form.querySelectorAll('input, select, textarea').forEach(el => {
      if (el.type === 'checkbox') el.checked = false;
      else el.value = '';
    });
  }

  function getFormData(formId) {
    const form = document.getElementById(formId);
    if (!form) return {};
    const data = {};
    form.querySelectorAll('[name]').forEach(el => {
      if (el.type === 'checkbox') data[el.name] = el.checked;
      else if (el.type === 'number') data[el.name] = parseNum(el.value);
      else data[el.name] = el.value.trim();
    });
    return data;
  }

  function setFormData(formId, data) {
    const form = document.getElementById(formId);
    if (!form || !data) return;
    Object.entries(data).forEach(([key, value]) => {
      const el = form.querySelector(`[name="${key}"]`);
      if (!el) return;
      if (el.type === 'checkbox') el.checked = !!value;
      else el.value = value ?? '';
    });
  }

  function debounce(fn, delay = 300) {
    let timer;
    return function (...args) { clearTimeout(timer); timer = setTimeout(() => fn.apply(this, args), delay); };
  }

  function hoje() { return new Date().toISOString().split('T')[0]; }

  // ---- INIT PÁGINA (robusto, não redireciona por erro de Firestore) ----
  async function initPagina(options = {}) {
    // 1. Inicializar Firebase
    if (!initFirebase()) return false;

    // 2. Aguardar autenticação (com timeout de 8s)
    let user;
    try {
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('auth_timeout')), 8000));
      user = await Promise.race([Auth.init(), timeout]);
    } catch (e) {
      if (e.message === 'auth_timeout') {
        console.warn('Auth timeout — redirecionando para login');
        window.location.href = 'login.html';
        return false;
      }
      console.error('Erro de auth:', e);
      window.location.href = 'login.html';
      return false;
    }

    if (!user) {
      window.location.href = 'login.html';
      return false;
    }

    // 3. Router + Obras (sem bloquear se falhar)
    try {
      Router.init();
      await Router.popularSeletorObras();
    } catch (e) {
      console.warn('Erro ao carregar obras no seletor:', e.message);
    }

    // 4. Renderizar info do usuário
    _renderUserInfo();

    return true;
  }

  function _renderUserInfo() {
    const profile = Auth.getProfile();
    const email = Auth.getUser()?.email || '';

    const nameEl = document.querySelector('.user-name');
    const roleEl = document.querySelector('.user-role');
    const avatarEl = document.querySelector('.user-avatar');

    if (nameEl) nameEl.textContent = profile?.nome || email.split('@')[0] || 'Usuário';
    if (roleEl) roleEl.textContent = profile?.perfil === 'admin' ? 'Administrador' : 'Usuário';
    if (avatarEl) avatarEl.textContent = ((profile?.nome || email).charAt(0) || 'U').toUpperCase();
  }

  return {
    formatarNumero, formatarInteiro, formatarData, formatarDataHora,
    formatarM2, formatarML, parseNum,
    toast, abrirModal, fecharModal, fecharTodosModais, confirmar,
    mostrarLoading, esconderLoading,
    $, $$, limparForm, getFormData, setFormData, debounce, hoje,
    initPagina
  };
})();

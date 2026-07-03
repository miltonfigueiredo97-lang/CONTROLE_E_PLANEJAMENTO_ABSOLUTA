// ============================================
// Utilitários Globais
// Funções reutilizáveis em todos os módulos
// ============================================

const Utils = (() => {

  // --- Formatação ---
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
    if (data.toDate) data = data.toDate(); // Firestore Timestamp
    if (typeof data === 'string') data = new Date(data);
    return data.toLocaleDateString('pt-BR');
  }

  function formatarDataHora(data) {
    if (!data) return '—';
    if (data.toDate) data = data.toDate();
    if (typeof data === 'string') data = new Date(data);
    return data.toLocaleDateString('pt-BR') + ' ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function formatarM2(valor) {
    return formatarNumero(valor) + ' m²';
  }

  function formatarML(valor) {
    return formatarNumero(valor) + ' m';
  }

  // Converter input para número
  function parseNum(valor) {
    if (typeof valor === 'number') return valor;
    if (!valor) return 0;
    // Aceita tanto , quanto . como decimal
    return parseFloat(String(valor).replace(',', '.')) || 0;
  }

  // --- Toast / Notificações ---
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
      t.style.opacity = '0';
      t.style.transform = 'translateX(20px)';
      t.style.transition = 'all 0.3s ease';
      setTimeout(() => t.remove(), 300);
    }, duracao);
  }

  // --- Modal ---
  function abrirModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.add('ativo');
      document.body.style.overflow = 'hidden';
    }
  }

  function fecharModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.remove('ativo');
      document.body.style.overflow = '';
    }
  }

  function fecharTodosModais() {
    document.querySelectorAll('.modal-overlay.ativo').forEach(m => {
      m.classList.remove('ativo');
    });
    document.body.style.overflow = '';
  }

  // --- Confirmação ---
  function confirmar(mensagem) {
    return window.confirm(mensagem);
  }

  // --- Loading ---
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

  // --- DOM Helpers ---
  function $(seletor) {
    return document.querySelector(seletor);
  }

  function $$(seletor) {
    return document.querySelectorAll(seletor);
  }

  function criarElemento(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'className') el.className = v;
      else if (k === 'textContent') el.textContent = v;
      else if (k === 'innerHTML') el.innerHTML = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, v);
    });
    children.forEach(c => {
      if (typeof c === 'string') el.appendChild(document.createTextNode(c));
      else if (c) el.appendChild(c);
    });
    return el;
  }

  // Limpar formulário
  function limparForm(formId) {
    const form = document.getElementById(formId);
    if (form) {
      form.querySelectorAll('input, select, textarea').forEach(el => {
        if (el.type === 'checkbox') el.checked = false;
        else el.value = '';
      });
    }
  }

  // Pegar valores do formulário
  function getFormData(formId) {
    const form = document.getElementById(formId);
    if (!form) return {};
    const data = {};
    form.querySelectorAll('[name]').forEach(el => {
      if (el.type === 'checkbox') {
        data[el.name] = el.checked;
      } else if (el.type === 'number') {
        data[el.name] = parseNum(el.value);
      } else {
        data[el.name] = el.value.trim();
      }
    });
    return data;
  }

  // Preencher formulário com dados
  function setFormData(formId, data) {
    const form = document.getElementById(formId);
    if (!form || !data) return;
    Object.entries(data).forEach(([key, value]) => {
      const el = form.querySelector(`[name="${key}"]`);
      if (!el) return;
      if (el.type === 'checkbox') {
        el.checked = !!value;
      } else {
        el.value = value ?? '';
      }
    });
  }

  // --- Debounce ---
  function debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // --- Gerar código sequencial ---
  function gerarCodigo(prefix, numero) {
    return `${prefix}_${String(numero).padStart(6, '0')}`;
  }

  // --- Data atual ISO ---
  function hoje() {
    return new Date().toISOString().split('T')[0];
  }

  // --- Inicialização padrão de página ---
  async function initPagina(options = {}) {
    if (!initFirebase()) return false;

    const user = await Auth.init();
    if (!user) {
      window.location.href = 'login.html';
      return false;
    }

    Router.init();
    await Router.popularSeletorObras();
    _renderUserInfo();

    if (options.requireObra && !Router.getObraId()) {
      // Não tem obra selecionada, mostrar aviso
    }

    return true;
  }

  function _renderUserInfo() {
    const profile = Auth.getProfile();
    if (!profile) return;

    const nameEl = document.querySelector('.user-name');
    const roleEl = document.querySelector('.user-role');
    const avatarEl = document.querySelector('.user-avatar');

    if (nameEl) nameEl.textContent = profile.nome || profile.email;
    if (roleEl) roleEl.textContent = profile.perfil === 'admin' ? 'Administrador' : 'Usuário';
    if (avatarEl) avatarEl.textContent = (profile.nome || profile.email).charAt(0).toUpperCase();
  }

  return {
    formatarNumero,
    formatarInteiro,
    formatarData,
    formatarDataHora,
    formatarM2,
    formatarML,
    parseNum,
    toast,
    abrirModal,
    fecharModal,
    fecharTodosModais,
    confirmar,
    mostrarLoading,
    esconderLoading,
    $, $$,
    criarElemento,
    limparForm,
    getFormData,
    setFormData,
    debounce,
    gerarCodigo,
    hoje,
    initPagina
  };
})();

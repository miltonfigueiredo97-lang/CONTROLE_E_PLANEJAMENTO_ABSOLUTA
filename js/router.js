// ============================================
// Router e Navegação
// Gerencia estado de obra selecionada e navegação
// ============================================

const Router = (() => {
  const OBRA_KEY = 'obra_selecionada';
  let obraAtual = null;

  function init() {
    // Restaurar obra selecionada do localStorage
    const saved = localStorage.getItem(OBRA_KEY);
    if (saved) {
      try {
        obraAtual = JSON.parse(saved);
      } catch(e) {
        obraAtual = null;
      }
    }
    _highlightCurrentPage();
  }

  // Obra selecionada
  function getObraId() {
    return obraAtual ? obraAtual.id : null;
  }

  function getObra() {
    return obraAtual;
  }

  function setObra(obra) {
    obraAtual = obra;
    if (obra) {
      localStorage.setItem(OBRA_KEY, JSON.stringify({ id: obra.id, nome: obra.nome }));
    } else {
      localStorage.removeItem(OBRA_KEY);
    }
    // Atualizar select na sidebar
    const select = document.getElementById('seletor-obra');
    if (select && obra) {
      select.value = obra.id;
    }
  }

  // Requer obra selecionada
  function requireObra() {
    if (!obraAtual || !obraAtual.id) {
      Utils.toast('Selecione uma obra primeiro.', 'alerta');
      return false;
    }
    return true;
  }

  // Navegar
  function navegar(pagina) {
    window.location.href = pagina;
  }

  // Popular select de obras na sidebar
  async function popularSeletorObras() {
    const select = document.getElementById('seletor-obra');
    if (!select) return;

    try {
      const obras = await Database.getObras();
      select.innerHTML = '<option value="">Selecione a obra...</option>';
      obras.forEach(obra => {
        const opt = document.createElement('option');
        opt.value = obra.id;
        opt.textContent = obra.nome;
        if (obraAtual && obraAtual.id === obra.id) {
          opt.selected = true;
        }
        select.appendChild(opt);
      });

      select.addEventListener('change', async () => {
        if (select.value) {
          const obra = await Database.getObra(select.value);
          setObra(obra);
          // Recarregar dados do módulo atual
          if (typeof onObraChanged === 'function') {
            onObraChanged(obra);
          }
        } else {
          setObra(null);
        }
      });
    } catch (e) {
      console.error('Erro ao carregar obras:', e);
    }
  }

  // Highlight da página atual no menu
  function _highlightCurrentPage() {
    const pagina = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.sidebar-nav a').forEach(link => {
      const href = link.getAttribute('href');
      if (href === pagina) {
        link.classList.add('ativo');
      } else {
        link.classList.remove('ativo');
      }
    });
  }

  return {
    init,
    getObraId,
    getObra,
    setObra,
    requireObra,
    navegar,
    popularSeletorObras
  };
})();

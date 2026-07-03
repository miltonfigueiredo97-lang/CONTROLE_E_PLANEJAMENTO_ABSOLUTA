// ============================================
// Módulo: linha-balanco
// Stub — será implementado conforme roadmap
// ============================================

const LinhaBalanco = (() => {
  async function init() {
    const ok = await Utils.initPagina({ requireObra: true });
    if (!ok) return;
    renderizar();
  }

  function renderizar() {
    const container = document.getElementById('modulo-content');
    if (!container) return;
    container.innerHTML = `
      <div class="estado-vazio">
        <div class="icone">🚧</div>
        <p>Módulo em desenvolvimento.</p>
        <p class="text-sm text-muted">Este módulo será construído conforme o roadmap do projeto.</p>
      </div>`;
  }

  return { init, renderizar };
})();

function onObraChanged() { LinhaBalanco.init(); }

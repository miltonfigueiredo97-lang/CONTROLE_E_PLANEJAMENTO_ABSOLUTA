// ============================================
// Módulo: Controle (Hub)
// Lista os módulos de controle operacional da obra
// ============================================

const Controle = (() => {
  async function init() {
    const ok = await Utils.initPagina({ requireObra: true });
    if (!ok) return;
    renderizar();
  }

  function renderizar() {
    const container = document.getElementById('modulo-content');
    if (!container) return;

    const obraId = Router.getObraId();
    if (!obraId) {
      container.innerHTML = `<div class="estado-vazio"><div class="icone">✅</div><p>Selecione uma obra para acessar o controle.</p></div>`;
      return;
    }

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h2>Controle</h2>
          <span class="subtitulo">Controle operacional e acompanhamento da produção</span>
        </div>
      </div>

      <div class="cards-grid">
        <div class="card obra-card" onclick="Router.navegar('controle-solo-grampeado.html')">
          <div class="card-body">
            <div class="obra-nome">⛏️ Controle Solo Grampeado</div>
            <div class="obra-info text-sm">Execução dos chumbadores, produção diária, área executada e curva de progresso.</div>
            <div class="mt-1"><span class="badge badge-sucesso">Disponível</span></div>
          </div>
        </div>
        <div class="card obra-card" onclick="Router.navegar('controle-terraplanagem.html')">
          <div class="card-body">
            <div class="obra-nome">🚚 Controle Terraplanagem</div>
            <div class="obra-info text-sm">Viagens/remoções de caminhão e progresso do volume removido.</div>
            <div class="mt-1"><span class="badge badge-sucesso">Disponível</span></div>
          </div>
        </div>
        <div class="card obra-card" onclick="Router.navegar('controle-concreto.html')">
          <div class="card-body">
            <div class="obra-nome">🪨 Controle Concreto</div>
            <div class="obra-info text-sm">Lançamento de BTs, previsto × realizado, índices de perda e relatórios.</div>
            <div class="mt-1"><span class="badge badge-sucesso">Disponível</span></div>
          </div>
        </div>
      </div>
    `;
  }

  return { init, renderizar };
})();

function onObraChanged() { Controle.renderizar(); }

// ============================================
// Módulo: Levantamento (Hub)
// Lista calculadoras e bases de quantitativos
// ============================================

const Levantamento = (() => {
  async function init() {
    const ok = await Utils.initPagina({ requireObra: true });
    if (!ok) return;
    renderizar();
  }

  function renderizar() {
    const container = document.getElementById('levantamento-content');
    if (!container) return;

    const obraId = Router.getObraId();
    if (!obraId) {
      container.innerHTML = `<div class="estado-vazio"><div class="icone">📐</div><p>Selecione uma obra para acessar os levantamentos.</p></div>`;
      return;
    }

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h2>Levantamentos</h2>
          <span class="subtitulo">Calculadoras e bases de quantitativos da obra</span>
        </div>
      </div>

      <h3 class="mb-2" style="font-size:1rem;">Calculadoras</h3>
      <div class="cards-grid mb-3">
        <div class="card obra-card" onclick="Router.navegar('levantamento-fachada.html')">
          <div class="card-body">
            <div class="obra-nome">🏢 Fachada</div>
            <div class="obra-info text-sm">Levantamento por balancim, vista interna/externa, cálculo de m² e ML.</div>
            <div class="mt-1"><span class="badge badge-sucesso">Disponível</span></div>
          </div>
        </div>
        <div class="card" style="opacity:0.5">
          <div class="card-body">
            <div class="obra-nome">🧱 Alvenaria</div>
            <div class="obra-info text-sm">Levantamento de alvenaria por pavimento e tipo de bloco.</div>
            <div class="mt-1"><span class="badge badge-neutro">Em breve</span></div>
          </div>
        </div>
        <div class="card" style="opacity:0.5">
          <div class="card-body">
            <div class="obra-nome">🔩 Aço</div>
            <div class="obra-info text-sm">Levantamento de armadura por elemento estrutural.</div>
            <div class="mt-1"><span class="badge badge-neutro">Em breve</span></div>
          </div>
        </div>
        <div class="card" style="opacity:0.5">
          <div class="card-body">
            <div class="obra-nome">🪨 Concreto</div>
            <div class="obra-info text-sm">Volume de concreto por elemento e pavimento.</div>
            <div class="mt-1"><span class="badge badge-neutro">Em breve</span></div>
          </div>
        </div>
      </div>

      <h3 class="mb-2" style="font-size:1rem;">Bases de Quantitativos / Composições</h3>
      <div class="cards-grid">
        <div class="card" style="opacity:0.5">
          <div class="card-body">
            <div class="obra-nome">❄️ Ar Condicionado</div>
            <div class="obra-info text-sm">Composição por tipologia de unidade.</div>
            <div class="mt-1"><span class="badge badge-neutro">Em breve</span></div>
          </div>
        </div>
      </div>
    `;
  }

  return { init, renderizar };
})();

function onObraChanged() {
  Levantamento.renderizar();
}

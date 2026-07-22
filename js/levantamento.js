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
        <div class="card obra-card" onclick="Router.navegar('levantamento-paredes.html')">
          <div class="card-body">
            <div class="obra-nome">🧱 Paredes</div>
            <div class="obra-info text-sm">Duas abas: Alvenaria (a parede física) e Acabamento (cada face, com gesso/reboco/revestimento/pintura por %).</div>
            <div class="mt-1"><span class="badge badge-sucesso">Disponível</span></div>
          </div>
        </div>
        <div class="card" style="opacity:0.5">
          <div class="card-body">
            <div class="obra-nome">🔩 Aço</div>
            <div class="obra-info text-sm">Levantamento de armadura por elemento estrutural.</div>
            <div class="mt-1"><span class="badge badge-neutro">Em breve</span></div>
          </div>
        </div>
        <div class="card obra-card" onclick="Router.navegar('levantamento-concreto.html')">
          <div class="card-body">
            <div class="obra-nome">🪨 Concreto</div>
            <div class="obra-info text-sm">Volume de concreto por elemento e pavimento, com montagem de concretagens.</div>
            <div class="mt-1"><span class="badge badge-sucesso">Disponível</span></div>
          </div>
        </div>
        <div class="card obra-card" onclick="Router.navegar('levantamento-solo-grampeado.html')">
          <div class="card-body">
            <div class="obra-nome">⛏️ Solo Grampeado</div>
            <div class="obra-info text-sm">Chumbadores (grampos/ancoragens) por vista, produção diária e área executada.</div>
            <div class="mt-1"><span class="badge badge-sucesso">Disponível</span></div>
          </div>
        </div>
        <div class="card obra-card" onclick="Router.navegar('levantamento-terraplanagem.html')">
          <div class="card-body">
            <div class="obra-nome">🚚 Terraplanagem</div>
            <div class="obra-info text-sm">Volume de corte de terra por seções transversais, caminhões e remoção acumulada.</div>
            <div class="mt-1"><span class="badge badge-sucesso">Disponível</span></div>
          </div>
        </div>
        <div class="card obra-card" onclick="Router.navegar('levantamento-piso.html')">
          <div class="card-body">
            <div class="obra-nome">🧩 Piso</div>
            <div class="obra-info text-sm">Envie a planta em PDF, calibre a escala e meça os m² de piso, contrapiso e impermeabilização direto no desenho.</div>
            <div class="mt-1"><span class="badge badge-sucesso">Disponível</span></div>
          </div>
        </div>
        <div class="card obra-card" onclick="Router.navegar('levantamento-teto.html')">
          <div class="card-body">
            <div class="obra-nome">🔲 Teto</div>
            <div class="obra-info text-sm">Envie a planta em PDF, calibre a escala e meça os m² de teto: Dry Wall, Placa de Gesso e Pintura, direto no desenho.</div>
            <div class="mt-1"><span class="badge badge-sucesso">Disponível</span></div>
          </div>
        </div>
        <div class="card obra-card" onclick="Router.navegar('levantamento-pintura.html')">
          <div class="card-body">
            <div class="obra-nome">🎨 Pintura</div>
            <div class="obra-info text-sm">Vincula os locais de Paredes e Teto e monta o dash de pintura por cor e por local — sem lançar nada novo, só consolida.</div>
            <div class="mt-1"><span class="badge badge-sucesso">Disponível</span></div>
          </div>
        </div>
      </div>

      <h3 class="mb-2" style="font-size:1rem;">Bases de Quantitativos / Composições</h3>
      <div class="cards-grid">
        <div class="card obra-card" onclick="Router.navegar('levantamento-ar-condicionado.html')">
          <div class="card-body">
            <div class="obra-nome">❄️ Ar Condicionado</div>
            <div class="obra-info text-sm">Levantamento de materiais de ar condicionado e hidráulica por área da obra.</div>
            <div class="mt-1"><span class="badge badge-sucesso">Disponível</span></div>
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

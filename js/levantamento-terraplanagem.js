// ============================================
// Módulo: Levantamento de Terraplanagem
// Calculadora de corte de terra (método das seções
// transversais), configuração de empolamento e
// cadastro de caminhões — quantitativo/planejamento.
// A execução (viagens/remoções e progresso) fica em
// Controle de Terraplanagem.
//
// Modo "Marcar no Projeto": UM projeto (planta/foto)
// só, compartilhado por TODAS as seções (horizontais
// e verticais) — a imagem e a escala são únicas pra
// obra toda. Cada seção é uma linha de pontos (com
// cota) marcada em cima dessa mesma imagem.
//
// Dados: Firestore obras/{obraId}/terra*
// ============================================

const LevantamentoTerraplanagem = (() => {
  const TC = TerraplanagemCalculos;
  const COL_CAMINHOES = 'terraCaminhoes';
  const DOC_CONFIG = 'terraplanagem';
  const DOC_SECOES = 'terraplanagemSecoes';
  const DOC_PROJETO_IMG = 'terraProjetoImg';
  const PALETA_SECOES = ['#f59e0b', '#3b82f6', '#22c55e', '#ef4444', '#a855f7', '#06b6d4', '#f97316', '#84cc16'];

  let obraId = null;
  let caminhoes = [];
  let config = {
    taxaEmpolamento: 0.3, capacidadeGrande: 15.6, capacidadePequena: 10, cotaReferencia: '',
    tiposCaminhao: [{ nome: 'Grande', capacidade: 15.6 }, { nome: 'Pequeno', capacidade: 10 }],
    modoLevantamento: 'manual', // 'manual' | 'pontos'
    temImagemProjeto: false, imgW: 0, imgH: 0, escalaPxPorMetro: 0,
    areas: [], pontosCota: [], // modo "Marcar no Projeto": áreas (polígono + cota final) + pontos de cota superior dentro delas
  };
  let secoes = { horizontal: [], vertical: [] };

  let secDir = 'horizontal';
  let secAberta = null;

  // Imagem do projeto (única, compartilhada) fica em doc separado
  // (config/terraProjetoImg), fora do doc principal, pra não estourar
  // o limite de ~1MB do documento Firestore. Cache em memória:
  let imagemProjetoCache = null;
  let calibrando = false;      // aguardando os 2 cliques de calibração
  let calibPontoTemp = null;   // 1º ponto clicado da calibração, aguardando o 2º
  let pdfjsCarregado = false;
  let ferramenta = null;       // null | 'area' | 'cota' — ferramenta ativa no projeto
  let pontosCotaAbertos = null; // id da área com a lista de pontos de cota expandida (achar outlier)
  let areaEmDesenho = null;    // { pontos: [] } enquanto uma área nova está sendo clicada

  function _corSecao(i) { return PALETA_SECOES[i % PALETA_SECOES.length]; }

  // ══════════════════════════════════════════
  // INIT / CARREGAMENTO
  // ══════════════════════════════════════════
  async function init() {
    const ok = await Utils.initPagina({ requireObra: true });
    if (!ok) return;
    obraId = Router.getObraId();
    if (!obraId) {
      document.getElementById('tp-content').innerHTML =
        `<div class="estado-vazio"><div class="icone">🚚</div><p>Selecione uma obra para acessar o levantamento de terraplanagem.</p></div>`;
      return;
    }
    document.addEventListener('keydown', e => { if (e.key === 'Escape') Utils.fecharTodosModais(); });
    await carregar();
  }

  async function carregar() {
    Utils.mostrarLoading();
    try {
      caminhoes = await Database.listar(obraId, COL_CAMINHOES, null);
      await carregarConfig();
      await carregarSecoes();
      imagemProjetoCache = null; // força buscar de novo (troca de obra, etc.)
      renderizar();
      if (config.modoLevantamento === 'pontos') _garantirImagemProjetoCarregada();
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao carregar dados: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  async function carregarConfig() {
    try {
      const doc = await db.collection('obras').doc(obraId).collection('config').doc(DOC_CONFIG).get();
      if (doc.exists) config = { ...config, ...doc.data() };
    } catch (e) { /* mantém default */ }
    if (!Array.isArray(config.tiposCaminhao) || !config.tiposCaminhao.length) {
      config.tiposCaminhao = [{ nome: 'Grande', capacidade: TC.num(config.capacidadeGrande) || 15.6 }, { nome: 'Pequeno', capacidade: TC.num(config.capacidadePequena) || 10 }];
    }
  }
  async function carregarSecoes() {
    try {
      const doc = await db.collection('obras').doc(obraId).collection('config').doc(DOC_SECOES).get();
      if (doc.exists) {
        const d = doc.data();
        secoes = { horizontal: d.horizontal || [], vertical: d.vertical || [] };
      }
    } catch (e) { /* mantém default */ }
    // Compatibilidade: garante id nas seções carregadas
    ['horizontal', 'vertical'].forEach(dir => {
      (secoes[dir] || []).forEach(s => { if (!s.id) s.id = TC.genId('sec'); });
    });
  }
  async function salvarConfig() {
    if (!Permissions.pode('levantamentoTerra', 'editar') && !Permissions.pode('levantamentoTerra', 'criar')) return;
    await db.collection('obras').doc(obraId).collection('config').doc(DOC_CONFIG).set(config, { merge: true });
  }
  async function salvarSecoes() {
    if(!Permissions.pode('levantamentoTerra','criar')&&!Permissions.pode('levantamentoTerra','editar'))return;
    await db.collection('obras').doc(obraId).collection('config').doc(DOC_SECOES).set(secoes, { merge: false });
  }

  async function recarregar() {
    obraId = Router.getObraId();
    if (!obraId) return;
    secAberta = null; calibrando = false; calibPontoTemp = null;
    await carregar();
  }

  function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ══════════════════════════════════════════
  // CÁLCULOS AGREGADOS
  // ══════════════════════════════════════════
  function secoesComVolume(lista) {
    return lista.map((s, i) => {
      const volEntre = i < lista.length - 1 ? TC.calcVolumeEntreSecoes(s.area, lista[i + 1].area, s.distanciaProxima) : 0;
      return { ...s, volEntre };
    });
  }
  function volumeTotalDirecao(dir) {
    return TC.calcVolumeTotalSecoes(secoes[dir] || []);
  }
  function kpisGerais() {
    const volH = volumeTotalDirecao('horizontal');
    const volV = volumeTotalDirecao('vertical');
    const volMedio = TC.calcVolumeMedio(volH, volV);
    const volEmpolado = TC.calcVolumeComEmpolamento(volMedio, config.taxaEmpolamento);
    return { volH, volV, volMedio, volEmpolado };
  }

  // Altura de corte/aterro = cota do terreno MENOS cota final — subtração
  // padrão, que já funciona certo com valores negativos dos dois lados (ex:
  // terreno -4,57 e cota final -7,18 → altura = -4,57-(-7,18) = +2,61,
  // positivo, corte — bate certo). A versão anterior deslocava a cota pela
  // própria cota final antes de subtrair, o que CANCELAVA a cota final da
  // conta (o resultado saía sempre = a cota digitada, ignorando o fundo) —
  // por isso qualquer terreno com valor negativo saía tudo aterro, errado.
  function _ajustarConvencao(cotas, cotaFinal) {
    return { cotas: cotas.map(c => TC.num(c)), cotaFinal: TC.num(cotaFinal) };
  }
  // Mesma lógica, versão escalar (um ponto por vez) — usada no 3D, que
  // trabalha em cima de uma grade de pontos, não de arrays de seção.
  function _ajustarConvencaoEscalar(cota, cotaFinal) {
    return { cota: TC.num(cota), cotaFinal: TC.num(cotaFinal) };
  }

  function recalcArea(s) {
    if (s.areaManual !== '' && s.areaManual != null && !isNaN(parseFloat(s.areaManual))) {
      s.area = TC.num(s.areaManual);
      return;
    }
    const cotas = s.cotas || [];
    // Seções geradas depois da unificação por área já trazem cotasFinais[]
    // (uma por ponto, varia se a seção atravessa pra outra área com cota
    // final diferente). Seções antigas/manuais só têm o valor escalar —
    // nesse caso, usa ele repetido pra todos os pontos (mesma conta de sempre).
    const cotasFinais = (s.cotasFinais && s.cotasFinais.length === cotas.length) ? s.cotasFinais : cotas.map(() => s.cotaFinal);
    s.area = _calcAreaSecaoVariavel(cotas, cotasFinais, s.distanciasCotas || []);
  }
  function _recalcTudo() {
    (secoes.horizontal || []).forEach(recalcArea);
    (secoes.vertical || []).forEach(recalcArea);
  }

  // ══════════════════════════════════════════
  // RENDER PRINCIPAL
  // ══════════════════════════════════════════
  function renderizar() {
    const c = document.getElementById('tp-content');
    if (!c) return;
    const k = kpisGerais();

    c.innerHTML = `
      <div class="cc-view">
      <div class="page-header">
        <div>
          <h2>🚚 Levantamento de Terraplanagem</h2>
          <span class="subtitulo">Corte de terra por seções transversais, empolamento e caminhões</span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-secundario btn-sm" onclick="TP_UI.abrirConfig()">⚙️ Config</button>
          <button class="btn btn-secundario btn-sm" onclick="TP_UI.baixarLevantamentoPDF()">📄 Relatório PDF</button>
          <button class="btn btn-secundario btn-sm" onclick="TP_UI.compartilharLevantamentoPDF()">📤 Compartilhar</button>
          <button class="btn btn-primario btn-sm" onclick="TP_UI.abrirCaminhoes()">🚚 Caminhões</button>
          <button class="btn btn-secundario btn-sm" data-perm="levantamentoTerra:limpar" style="color:var(--cv-red,#dc2626);" onclick="TP_UI.limparBase()">🗑 Limpar Base</button>
        </div>
      </div>

      <div class="cc-kpiGrid" style="grid-template-columns:repeat(3,1fr);">
        <div class="cc-kpi"><div class="cc-kpiIcon">📐</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Vol. Médio (banco)</div><div class="cc-kpiValue">${TC.fmt1(k.volMedio)}<span class="cc-kpiUnit">m³</span></div><div class="cc-kpiSub">Horiz: ${TC.fmt1(k.volH)} · Vert: ${TC.fmt1(k.volV)}</div></div></div>
        <div class="cc-kpi cc-kpiOrange"><div class="cc-kpiIcon">📦</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Vol. c/ Empolamento (a remover)</div><div class="cc-kpiValue">${TC.fmt1(k.volEmpolado)}<span class="cc-kpiUnit">m³</span></div><div class="cc-kpiSub">taxa ${TC.fmt1(config.taxaEmpolamento * 100)}%</div></div></div>
        <div class="cc-kpi cc-kpiBlue"><div class="cc-kpiIcon">🚚</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Caminhões cadastrados</div><div class="cc-kpiValue">${caminhoes.length}</div></div></div>
      </div>

      <div class="cc-panel">
        <div class="cc-panelTitle">📐 Calculadora de Corte de Terra <span style="font-family:var(--cv-mono);font-size:10px;color:var(--cv-text3);font-weight:400;text-transform:none;letter-spacing:0;">método das seções transversais</span></div>
        <div id="tp-secoes"></div>
      </div>
      </div>
    `;
    renderSecoes();
    Permissions.aplicarNaTela();
  }

  // ══════════════════════════════════════════
  // CALCULADORA DE CORTE DE TERRA (seções)
  // ══════════════════════════════════════════
  function setSecDir(dir) { secDir = dir; secAberta = null; renderSecoes(); }

  function setModoLevantamento(modo) {
    config.modoLevantamento = modo;
    _recalcTudo();
    renderSecoes();
    if (modo === 'pontos') _garantirImagemProjetoCarregada();
    salvarConfig().catch(() => {}); // guarda a preferência de modo (sem travar a UI)
  }

  function renderSecoes() {
    const el = document.getElementById('tp-secoes');
    if (!el) return;
    (secoes[secDir] || []).forEach(recalcArea);
    const lista = secoesComVolume(secoes[secDir] || []);
    const volTotal = TC.calcVolumeTotalSecoes(secoes[secDir] || []);
    const modoPontos = config.modoLevantamento === 'pontos';

    el.innerHTML = `
      <div class="aba-toggle" style="margin-bottom:14px;">
        <button class="aba-btn ${!modoPontos ? 'ativo' : ''}" onclick="TP_UI.setModoLevantamento('manual')">✍️ Digitar Manualmente</button>
        <button class="aba-btn ${modoPontos ? 'ativo' : ''}" onclick="TP_UI.setModoLevantamento('pontos')">🖼️ Marcar no Projeto</button>
      </div>
      ${modoPontos ? _painelProjetoHTML() : ''}
      <div class="aba-toggle" style="margin-bottom:14px;">
        <button class="aba-btn ${secDir === 'horizontal' ? 'ativo' : ''}" onclick="TP_UI.setSecDir('horizontal')">Seções Horizontais</button>
        <button class="aba-btn ${secDir === 'vertical' ? 'ativo' : ''}" onclick="TP_UI.setSecDir('vertical')">Seções Verticais</button>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
        <span style="font-family:var(--cv-mono);font-size:0.85rem;font-weight:700;color:var(--cv-accent3);">Volume total ${secDir}: ${TC.fmt1(volTotal)} m³</span>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-secundario btn-sm" onclick="TP_UI.abrirVerSecoes()">👁️ Ver Seções</button>
          <button class="btn btn-secundario btn-sm" onclick="TP_UI.abrir3D()">🧊 Ver em 3D</button>
          <button class="btn btn-secundario btn-sm" onclick="TP_UI.secAdd()">+ Nova Seção</button>
        </div>
      </div>
      ${!lista.length ? `<div class="cc-empty">Nenhuma seção cadastrada. ${modoPontos ? 'Desenhe áreas, marque cotas e clique em "▦ Gerar Seções" acima, ou' : 'Clique em'} "+ Nova Seção" pra criar manualmente.</div>` :
      lista.map((s, i) => `
        <div style="border:1px solid var(--cv-border);margin-bottom:8px;">
          <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--cv-surface2);cursor:pointer;" onclick="TP_UI.secToggle(${i})">
            <span style="font-weight:700;font-size:0.85rem;color:var(--cv-accent3);min-width:70px;">Seção ${s.numero ?? i + 1}</span>
            <span style="font-family:var(--cv-mono);font-size:0.78rem;color:var(--cv-text2);">Área: ${TC.fmt2(s.area)} m²</span>
            ${i < lista.length - 1 ? (s.distanciaProxima !== '' && s.distanciaProxima != null
              ? `<span style="font-family:var(--cv-mono);font-size:0.78rem;color:var(--cv-text2);">Dist. próxima: ${TC.fmt1(s.distanciaProxima)} m</span>
                 <span style="font-family:var(--cv-mono);font-size:0.78rem;color:var(--cv-accent3);font-weight:700;">Vol. entre: ${TC.fmt1(s.volEntre)} m³</span>`
              : `<span style="font-family:var(--cv-mono);font-size:0.72rem;color:var(--cv-text3);">· fim deste trecho ·</span>`) : ''}
            <span style="margin-left:auto;color:var(--cv-text3);">${secAberta === i ? '▲' : '▼'}</span>
            <button class="btn btn-secundario btn-sm" style="color:var(--cv-red);" onclick="event.stopPropagation();TP_UI.secRemover(${i})">🗑</button>
          </div>
          ${secAberta === i ? `
          <div style="padding:14px;">
            <div class="form-row">
              <div class="form-grupo"><label>Nº da Seção</label><input type="text" class="form-control" value="${esc(s.numero ?? i + 1)}" oninput="TP_UI.secUpd(${i}, 'numero', this.value)"></div>
              <div class="form-grupo"><label>Distância até a próxima seção (m)</label><input type="text" inputmode="decimal" class="form-control" value="${esc(s.distanciaProxima ?? '')}" placeholder="15" oninput="TP_UI.secUpd(${i}, 'distanciaProxima', this.value)"></div>
            </div>
            ${_painelManualHTML(i, s)}
            <div style="font-family:var(--cv-mono);font-size:0.8rem;color:var(--cv-text2);margin-top:8px;">Área calculada: <b style="color:var(--cv-accent3);">${TC.fmt2(s.area)} m²</b> · Comprimento: <b>${TC.fmt1(TC.calcComprimentoSecao(s.distanciasCotas || []))} m</b></div>
            <p class="text-sm text-muted mt-1">Se preferir, pode digitar a área diretamente:</p>
            <div class="form-grupo"><label>Área manual (m²) — sobrepõe qualquer cálculo acima</label><input type="text" inputmode="decimal" class="form-control" value="${esc(s.areaManual ?? '')}" placeholder="deixe em branco para usar o cálculo acima" oninput="TP_UI.secUpdAreaManual(${i}, this.value)"></div>
          </div>` : ''}
        </div>`).join('')}
      ${lista.length ? `<div style="text-align:right;margin-top:8px;"><button class="btn btn-secundario btn-sm" onclick="TP_UI.salvarSecoesBtn()">💾 Salvar Seções</button></div>` : ''}
    `;
    if (modoPontos) { _attachImgClickGlobal(); _aplicarZoomPanProjeto(); }
  }

  // ── Painel modo MANUAL (texto — comportamento original, inalterado) ──
  function _painelManualHTML(i, s) {
    return `
      <p class="text-sm text-muted mb-1">Cotas de nivelamento (separadas por vírgula ou espaço) e a cota final de referência (projeto):</p>
      <div class="form-grupo"><label>Cotas (ex: 99.72, 99.31, 99, 98.65...)</label><textarea class="form-control" rows="2" oninput="TP_UI.secUpdCotas(${i}, this.value)">${esc((s.cotas || []).join(', '))}</textarea></div>
      <div class="form-row">
        <div class="form-grupo"><label>Cota Final (projeto)</label><input type="text" inputmode="decimal" class="form-control" value="${esc(s.cotaFinal ?? '')}" placeholder="93.4" oninput="TP_UI.secUpdCotaFinal(${i}, this.value)"></div>
        <div class="form-grupo"><label>Distâncias entre cotas (ex: 8.71, 5.14...)</label><input type="text" class="form-control" value="${esc((s.distanciasCotas || []).join(', '))}" oninput="TP_UI.secUpdDistCotas(${i}, this.value)"></div>
      </div>
    `;
  }

  // ── Painel do PROJETO ÚNICO (compartilhado por todas as seções) ──
  // Fluxo: 1) desenha uma ou mais Áreas (polígono + cota final) — 2) marca
  // pontos de Cota Superior dentro delas — 3) "Gerar Seções" divide cada
  // área em linhas horizontais e verticais de 1,5 em 1,5m, interpola a cota
  // em cada linha a partir dos pontos marcados e calcula área/volume —
  // mesmo motor de cálculo das seções manuais (área = (cota_i+cota_i+1)/2
  // − cotaFinal × distância, volume entre seções = média das áreas × 1,5m).
  function _painelProjetoHTML() {
    if (!config.temImagemProjeto) {
      return `<div style="border:1px dashed var(--cv-border);border-radius:8px;padding:16px;margin-bottom:14px;text-align:center;">
        <div class="cc-empty" style="margin-bottom:10px;">Nenhum projeto (planta/imagem) inserido ainda — é um projeto só, compartilhado por todas as seções.</div>
        <button class="btn btn-primario btn-sm" onclick="TP_UI.escolherImagemProjeto()">📎 Inserir Projeto (imagem ou PDF)</button>
      </div>`;
    }
    if (!imagemProjetoCache) {
      return `<div class="cc-empty" style="margin-bottom:14px;">⏳ Carregando projeto...</div>`;
    }
    const calibrado = config.escalaPxPorMetro > 0;
    const areas = config.areas || [];
    const pontosCota = config.pontosCota || [];
    return `
      <div style="border:1px solid var(--cv-border);border-radius:8px;padding:12px;margin-bottom:14px;background:var(--cv-surface2);">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px;">
          ${!calibrado
            ? `<button class="btn ${calibrando ? 'btn-primario' : 'btn-secundario'} btn-sm" onclick="TP_UI.calibrarProjeto()">${calibrando ? (calibPontoTemp ? '🎯 Clique no 2º ponto de referência...' : '🎯 Clique no 1º ponto de referência...') : '🎯 Calibrar Escala'}</button>`
            : `<span style="font-family:var(--cv-mono);font-size:.75rem;color:var(--cv-text2);">📏 Escala: ${TC.fmt1(config.escalaPxPorMetro)} px/m</span>
               <button class="btn btn-secundario btn-sm" onclick="TP_UI.calibrarProjeto()">🔁 Recalibrar</button>`}
          <button class="btn btn-secundario btn-sm" onclick="TP_UI.escolherImagemProjeto()">🖼️ Trocar Projeto</button>
        </div>
        ${calibrado ? `
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px;">
          <button class="btn ${ferramenta === 'area' ? 'btn-primario' : 'btn-secundario'} btn-sm" onclick="TP_UI.setFerramenta('area')">🔷 ${ferramenta === 'area' ? (areaEmDesenho ? `Área: ${areaEmDesenho.pontos.length} ponto${areaEmDesenho.pontos.length !== 1 ? 's' : ''} — clique nos cantos, depois "Concluir"` : 'Clique nos cantos da área...') : 'Nova Área'}</button>
          ${ferramenta === 'area' && areaEmDesenho && areaEmDesenho.pontos.length >= 3 ? `<button class="btn btn-primario btn-sm" onclick="TP_UI.concluirArea()">✓ Concluir Área</button>` : ''}
          ${ferramenta === 'area' ? `<button class="btn btn-secundario btn-sm" onclick="TP_UI.cancelarArea()">✕ Cancelar</button>` : ''}
          <button class="btn ${ferramenta === 'cota' ? 'btn-primario' : 'btn-secundario'} btn-sm" onclick="TP_UI.setFerramenta('cota')" ${!areas.length ? 'disabled title="Desenhe uma área primeiro"' : ''}>📍 ${ferramenta === 'cota' ? 'Clique dentro de uma área pra marcar a cota...' : 'Marcar Cota'}</button>
          <button class="btn btn-secundario btn-sm" onclick="TP_UI.gerarSecoes()" ${!areas.length || !pontosCota.length ? 'disabled title="Marque pontos de cota primeiro"' : ''}>▦ Gerar Seções (grade 1,5m)</button>
        </div>` : ''}
        <div style="display:flex;gap:6px;margin-bottom:6px;">
          <button class="btn btn-secundario btn-sm" onclick="TP_UI.projZoomOut()">➖</button>
          <button class="btn btn-secundario btn-sm" onclick="TP_UI.projZoomIn()">➕</button>
          <button class="btn btn-secundario btn-sm" onclick="TP_UI.projZoomReset()">🔄 Resetar zoom</button>
        </div>
        <div id="tp-projeto-mapa" style="border:1px solid var(--cv-border);border-radius:6px;overflow:hidden;position:relative;height:55vh;min-height:380px;background:#111;touch-action:none;display:flex;align-items:center;justify-content:center;">
          <div id="tp-projeto-zoomwrap" style="transform-origin:center center;position:relative;max-width:100%;max-height:100%;aspect-ratio:${config.imgW || 1} / ${config.imgH || 1};">
            <img id="tp-img-projeto" src="${imagemProjetoCache}" style="width:100%;height:100%;display:block;user-select:none;cursor:${ferramenta ? 'crosshair' : 'default'};" draggable="false">
            ${calibPontoTemp ? `<div style="position:absolute;left:${(calibPontoTemp.x * 100).toFixed(3)}%;top:${(calibPontoTemp.y * 100).toFixed(3)}%;transform:translate(-50%,-50%) scale(${(1 / projZoom).toFixed(4)});width:12px;height:12px;border-radius:50%;background:#ef4444;box-shadow:0 0 0 2px #fff;pointer-events:none;"></div>` : ''}
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;">
              ${areas.map((a, ai) => `<polygon points="${a.pontos.map(p => `${(p.x * 100).toFixed(3)},${(p.y * 100).toFixed(3)}`).join(' ')}" fill="${_corSecao(ai)}" fill-opacity="0.18" stroke="${_corSecao(ai)}" stroke-width="0.35" vector-effect="non-scaling-stroke"/>`).join('')}
              ${areaEmDesenho && areaEmDesenho.pontos.length ? `<polyline points="${areaEmDesenho.pontos.map(p => `${(p.x * 100).toFixed(3)},${(p.y * 100).toFixed(3)}`).join(' ')}" fill="none" stroke="#fff" stroke-width="0.4" stroke-dasharray="1.2,1" vector-effect="non-scaling-stroke"/>` : ''}
            </svg>
            ${areaEmDesenho ? areaEmDesenho.pontos.map(p => `<div style="position:absolute;left:${(p.x * 100).toFixed(3)}%;top:${(p.y * 100).toFixed(3)}%;transform:translate(-50%,-50%) scale(${(1 / projZoom).toFixed(4)});width:8px;height:8px;border-radius:50%;background:#fff;box-shadow:0 0 0 1.5px #000;pointer-events:none;"></div>`).join('') : ''}
            ${pontosCota.map(p => {
              const ai = areas.findIndex(a => a.id === p.areaId);
              const cor = ai >= 0 ? _corSecao(ai) : '#999';
              return `<div style="position:absolute;left:${(p.x * 100).toFixed(3)}%;top:${(p.y * 100).toFixed(3)}%;transform:translate(-50%,-50%) scale(${(1 / projZoom).toFixed(4)});width:9px;height:9px;border-radius:50%;background:${cor};box-shadow:0 0 0 1.5px #fff;pointer-events:none;" title="Cota ${TC.fmt2(p.cota)}"></div>`;
            }).join('')}
          </div>
        </div>
        <p class="text-sm text-muted mt-1">${!calibrado ? 'Calibre a escala antes de desenhar áreas: clique em "🎯 Calibrar Escala" e depois em 2 pontos na imagem com distância real conhecida entre eles.' : ferramenta === 'area' ? 'Clique nos cantos da área (mínimo 3) e depois em "✓ Concluir Área" pra fechar e definir a cota final.' : ferramenta === 'cota' ? 'Clique dentro de uma área já desenhada pra marcar a cota do terreno naquele ponto.' : 'Desenhe uma ou mais áreas, marque as cotas do terreno dentro delas, e clique em "▦ Gerar Seções" — o sistema divide cada área numa grade de linhas de 1,5m e calcula a área/volume de cada uma automaticamente.'}</p>
        ${areas.length ? `
        <div class="cc-tableWrap" style="margin-top:8px;">
          <table class="cc-table">
            <thead><tr><th></th><th>Área</th><th class="col-num">Área Real (m²)</th><th class="col-num">Cota Final</th><th class="col-num">Pontos de Cota</th><th class="col-acoes"></th></tr></thead>
            <tbody>
              ${areas.map((a, ai) => { const dim = _dimensoesArea(a); const pts = pontosCota.filter(p => p.areaId === a.id); return `<tr>
                <td><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${_corSecao(ai)};"></span></td>
                <td>Área ${ai + 1}</td>
                <td class="col-num cc-tdMono" style="font-weight:700;">${TC.fmt1(dim.areaReal)}</td>
                <td class="col-num"><input type="text" inputmode="decimal" class="form-control" style="width:90px;display:inline-block;" value="${esc(a.cotaFinal)}" onchange="TP_UI.atualizarCotaArea('${a.id}', this.value)"></td>
                <td class="col-num cc-tdMono"><a href="#" onclick="event.preventDefault();TP_UI.togglePontosCota('${a.id}')" style="text-decoration:underline;">${pts.length} ${pontosCotaAbertos === a.id ? '▲' : '▼'}</a></td>
                <td class="col-acoes"><button class="btn btn-secundario btn-sm" style="color:var(--cv-red);" onclick="TP_UI.removerArea('${a.id}')">🗑</button></td>
              </tr>
              ${pontosCotaAbertos === a.id ? _linhaPontosCotaHTML(pts) : ''}`; }).join('')}
            </tbody>
          </table>
        </div>
        <p class="text-sm text-muted mt-1">"Área Real (m²)" é o tamanho de verdade do polígono que você desenhou (não é uma caixa/retângulo — calculado certo mesmo em formato L, T etc.). Se o prédio inteiro cobre uma área bem maior que isso, é porque o desenho não cobriu tudo (redesenhe maior) — ou a escala foi calibrada errado (confira "🔁 Recalibrar" usando uma medida já impressa na planta, se tiver). "Cota Final" é a profundidade de referência (zero) desta área — cotas do terreno marcadas em cima são digitadas com sinal em relação a esse zero: positivo = acima (corte), negativo = abaixo (aterro).</p>` : ''}
      </div>
    `;
  }

  // ── Zoom/pan do painel "Marcar no Projeto" (mesma ideia do "Ver Seções") ──
  let projZoom = 1, projPanX = 0, projPanY = 0;
  function projZoomIn() { projZoom = Math.min(6, projZoom * 1.4); _aplicarZoomPanProjeto(); }
  function projZoomOut() { projZoom = Math.max(1, projZoom / 1.4); if (projZoom === 1) { projPanX = 0; projPanY = 0; } _aplicarZoomPanProjeto(); }
  function projZoomReset() { projZoom = 1; projPanX = 0; projPanY = 0; _aplicarZoomPanProjeto(); }
  function _aplicarZoomPanProjeto() {
    const wrap = document.getElementById('tp-projeto-zoomwrap');
    if (wrap) wrap.style.transform = `translate(${projPanX}px, ${projPanY}px) scale(${projZoom})`;
  }

  // ── Clique/toque na imagem ÚNICA do projeto: calibrar, desenhar área ou
  // marcar cota — usa pointer events pra distinguir TOQUE (marca um ponto)
  // de ARRASTAR (só dá pan quando tem zoom, não marca nada por engano).
  function _attachImgClickGlobal() {
    const container = document.getElementById('tp-projeto-mapa');
    const img = document.getElementById('tp-img-projeto');
    if (!container || !img) return;
    let baixouX = 0, baixouY = 0, arrastou = false, panX0 = 0, panY0 = 0, rastreando = false;
    container.onpointerdown = ev => {
      rastreando = true;
      baixouX = ev.clientX; baixouY = ev.clientY; arrastou = false;
      panX0 = projPanX; panY0 = projPanY;
      try { container.setPointerCapture(ev.pointerId); } catch (e) {}
    };
    container.onpointermove = ev => {
      // SÓ calcula arrasto se houve um pointerdown de verdade NESTA instância do
      // painel — sem essa trava, depois de marcar um ponto (o que recria o painel
      // do zero), qualquer movimento do mouse (mesmo sem clicar) calculava a
      // distância a partir de 0 (valor zerado por padrão), dava um número gigante,
      // ativava o "modo arrastar" na hora e a imagem ficava perseguindo o mouse.
      if (!rastreando) return;
      const dx = ev.clientX - baixouX, dy = ev.clientY - baixouY;
      if (!arrastou && Math.hypot(dx, dy) > 6) arrastou = true;
      if (arrastou && projZoom > 1) {
        projPanX = panX0 + dx; projPanY = panY0 + dy;
        _aplicarZoomPanProjeto();
      }
    };
    container.onpointerup = ev => {
      rastreando = false;
      if (arrastou) { container.style.cursor = 'grab'; return; } // foi pan, não marca ponto
      _tocarProjeto(ev, img);
    };
    container.onpointercancel = () => { rastreando = false; arrastou = false; };
    container.onwheel = ev => {
      ev.preventDefault();
      const rect = container.getBoundingClientRect();
      const cx = ev.clientX - rect.left - rect.width / 2, cy = ev.clientY - rect.top - rect.height / 2;
      const zoomAntigo = projZoom;
      projZoom = Math.max(1, Math.min(6, projZoom * (ev.deltaY < 0 ? 1.15 : 0.87)));
      // Mantém o ponto sob o cursor fixo na tela — sem isso, o zoom sempre
      // amplia a partir do CENTRO da imagem, e o que você quer ver (se não
      // estiver no meio) se afasta cada vez mais até sair da tela.
      const fatorReal = projZoom / zoomAntigo;
      projPanX = cx - (cx - projPanX) * fatorReal;
      projPanY = cy - (cy - projPanY) * fatorReal;
      if (projZoom === 1) { projPanX = 0; projPanY = 0; }
      _aplicarZoomPanProjeto();
    };
  }

  function _tocarProjeto(evt, img) {
    const p = TC.posRelativa(evt, img);
    if (calibrando) {
      if (!calibPontoTemp) { calibPontoTemp = p; renderSecoes(); return; }
      const distStr = prompt('Distância real entre os dois pontos clicados (metros):');
      const distM = TC.num(distStr);
      if (!(distM > 0)) {
        Utils.toast('Calibração cancelada — informe uma distância válida.', 'alerta');
        calibrando = false; calibPontoTemp = null; renderSecoes(); return;
      }
      const distPx = Math.hypot((p.x - calibPontoTemp.x) * config.imgW, (p.y - calibPontoTemp.y) * config.imgH);
      config.escalaPxPorMetro = distPx / distM;
      calibrando = false; calibPontoTemp = null;
      _recalcTudo();
      Utils.toast('✓ Escala calibrada!', 'sucesso');
      salvarConfig().catch(() => {});
      renderSecoes();
      return;
    }
    if (ferramenta === 'area') {
      if (!areaEmDesenho) areaEmDesenho = { pontos: [] };
      areaEmDesenho.pontos.push(p);
      renderSecoes();
      return;
    }
    if (ferramenta === 'cota') {
      const area = _areaQueContem(p);
      if (!area) { Utils.toast('Clique dentro de uma área já desenhada.', 'alerta'); return; }
      const cotaStr = prompt('Cota (elevação) do terreno neste ponto:');
      if (cotaStr === null || cotaStr.trim() === '') return;
      config.pontosCota = config.pontosCota || [];
      config.pontosCota.push({ id: TC.genId('pc'), x: p.x, y: p.y, cota: TC.num(cotaStr), areaId: area.id });
      salvarConfig().catch(() => {});
      renderSecoes();
    }
  }

  // ══════════════════════════════════════════
  // GEOMETRIA — áreas (polígono + cota final), pontos de cota superior,
  // e geração automática de seções em grade (1,5m) por interpolação (IDW)
  // ══════════════════════════════════════════
  function setFerramenta(f) {
    ferramenta = ferramenta === f ? null : f;
    if (ferramenta !== 'area') areaEmDesenho = null;
    renderSecoes();
  }
  function cancelarArea() { areaEmDesenho = null; ferramenta = null; renderSecoes(); }
  function togglePontosCota(areaId) {
    pontosCotaAbertos = pontosCotaAbertos === areaId ? null : areaId;
    renderSecoes();
  }

  // Lista os pontos de cota de uma área ordenados por valor — destaca em
  // vermelho quem se desvia muito da mediana (é assim que se acha um ponto
  // digitado errado, tipo "78" em vez de "7,8", que gera um espinho isolado
  // no 3D mesmo o resto do terreno estando tudo raso e consistente).
  function _linhaPontosCotaHTML(pontos) {
    if (!pontos.length) return `<tr><td colspan="7" class="cc-empty" style="padding:8px 14px;">Nenhum ponto de cota nesta área ainda.</td></tr>`;
    const valores = pontos.map(p => TC.num(p.cota)).sort((a, b) => a - b);
    const mediana = valores.length % 2 ? valores[(valores.length - 1) / 2] : (valores[valores.length / 2 - 1] + valores[valores.length / 2]) / 2;
    const desvios = valores.map(v => Math.abs(v - mediana)).sort((a, b) => a - b);
    const madMediano = desvios[Math.floor(desvios.length / 2)] || 0;
    const limiar = Math.max(madMediano * 5, 2); // tolera variação normal do terreno; só marca desvio grande
    const ordenados = [...pontos].sort((a, b) => TC.num(a.cota) - TC.num(b.cota));
    return `<tr><td colspan="7" style="padding:10px 14px;background:var(--cv-surface1,#fafafa);">
      <div style="font-family:var(--cv-mono);font-size:.78rem;color:var(--cv-text2);margin-bottom:6px;">Mediana: ${TC.fmt2(mediana)} — pontos bem diferentes da mediana aparecem em vermelho (provável erro de digitação):</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        ${ordenados.map(p => {
          const foraDoNormal = Math.abs(TC.num(p.cota) - mediana) > limiar;
          return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:12px;font-family:var(--cv-mono);font-size:.78rem;background:${foraDoNormal ? '#fee2e2' : 'var(--cv-surface2)'};color:${foraDoNormal ? 'var(--cv-red)' : 'inherit'};font-weight:${foraDoNormal ? '700' : '400'};">
            ${foraDoNormal ? '⚠️ ' : ''}${TC.fmt2(p.cota)}
            <a href="#" onclick="event.preventDefault();TP_UI.editarPontoCota('${p.id}')" title="Editar">✎</a>
            <a href="#" onclick="event.preventDefault();TP_UI.removerPontoCota('${p.id}')" title="Remover" style="color:var(--cv-red);">✕</a>
          </span>`;
        }).join('')}
      </div>
    </td></tr>`;
  }

  function editarPontoCota(pontoId) {
    const p = (config.pontosCota || []).find(x => x.id === pontoId);
    if (!p) return;
    const novo = prompt('Nova cota deste ponto:', p.cota);
    if (novo === null) return;
    p.cota = TC.num(novo);
    salvarConfig().catch(() => {});
    renderSecoes();
  }
  async function removerPontoCota(pontoId) {
    const ok = await Utils.confirmar('Remover este ponto de cota?');
    if (!ok) return;
    config.pontosCota = (config.pontosCota || []).filter(p => p.id !== pontoId);
    Utils.mostrarLoading();
    try { await salvarConfig(); } finally { Utils.esconderLoading(); }
    renderSecoes();
  }

  function _dimensoesArea(area) {
    const m = area.pontos.map(_paraMetros);
    const xs = m.map(p => p.x), ys = m.map(p => p.y);
    return { largura: Math.max(...xs) - Math.min(...xs), altura: Math.max(...ys) - Math.min(...ys), areaReal: _areaPoligono(m) };
  }
  // Área real do polígono (fórmula de Shoelace) — diferente da caixa (largura
  // × altura) quando a área não é um retângulo (ex: formato L, T, etc.)
  function _areaPoligono(pontosMetros) {
    let area = 0;
    const n = pontosMetros.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += pontosMetros[i].x * pontosMetros[j].y - pontosMetros[j].x * pontosMetros[i].y;
    }
    return Math.abs(area) / 2;
  }
  async function concluirArea() {
    if (!areaEmDesenho || areaEmDesenho.pontos.length < 3) { Utils.toast('Marque pelo menos 3 pontos pra formar a área.', 'alerta'); return; }
    const cotaStr = prompt('Cota Final (profundidade de referência/zero) desta área:', config.cotaReferencia || '');
    if (cotaStr === null) return;
    const cotaFinal = TC.num(cotaStr);
    const novaArea = { id: TC.genId('area'), pontos: areaEmDesenho.pontos, cotaFinal };
    config.areas = config.areas || [];
    config.areas.push(novaArea);
    areaEmDesenho = null; ferramenta = null;
    const dim = _dimensoesArea(novaArea);
    Utils.mostrarLoading();
    try {
      await salvarConfig();
      Utils.toast(`✓ Área criada! Área real: ${TC.fmt1(dim.areaReal)} m² — confira se bate com o que você esperava.`, 'sucesso');
    } finally { Utils.esconderLoading(); }
    renderSecoes();
  }
  async function removerArea(id) {
    const ok = await Utils.confirmar('Remover esta área? Os pontos de cota marcados dentro dela também serão removidos.');
    if (!ok) return;
    config.areas = (config.areas || []).filter(a => a.id !== id);
    config.pontosCota = (config.pontosCota || []).filter(p => p.areaId !== id);
    Utils.mostrarLoading();
    try { await salvarConfig(); } finally { Utils.esconderLoading(); }
    renderSecoes();
  }
  function atualizarCotaArea(id, valor) {
    const a = (config.areas || []).find(x => x.id === id);
    if (!a) return;
    a.cotaFinal = TC.num(valor);
    salvarConfig().catch(() => {});
  }

  // Ray casting — funciona em fração (0..1) ou em metros, contanto que
  // ponto e polígono estejam no mesmo sistema.
  function _pontoDentroPoligono(p, poligono) {
    let dentro = false;
    for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
      const xi = poligono[i].x, yi = poligono[i].y, xj = poligono[j].x, yj = poligono[j].y;
      if (((yi > p.y) !== (yj > p.y)) && (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi)) dentro = !dentro;
    }
    return dentro;
  }
  function _areaQueContem(pFrac) {
    return (config.areas || []).find(a => _pontoDentroPoligono(pFrac, a.pontos));
  }
  // Converte um ponto em fração (0..1 da imagem) pra metros reais, usando
  // a mesma escala calibrada (assume escala igual em X e Y — planta sem distorção).
  function _paraMetros(p) {
    return { x: p.x * config.imgW / config.escalaPxPorMetro, y: p.y * config.imgH / config.escalaPxPorMetro };
  }
  // Inverso de _paraMetros — usado pra desenhar de volta na planta as linhas
  // de seção geradas (que só existem em metros durante o cálculo).
  function _paraFracao(pMetros) {
    return { x: pMetros.x * config.escalaPxPorMetro / config.imgW, y: pMetros.y * config.escalaPxPorMetro / config.imgH };
  }

  // Gera as seções (horizontais e verticais) de UMA área: divide o
  // retângulo da área numa grade de 1,5m, corta cada linha pelo polígono
  // (fica só o trecho por dentro), interpola a cota do terreno em cada
  // linha por IDW a partir dos pontos marcados, e calcula a área da seção
  // com o MESMO motor usado no modo manual (calcAreaSecao).
  // Área/volume com cota final VARIÁVEL ponto a ponto (não mais um valor só
  // por seção) — cada trapézio usa a cota final do ponto de cada lado. Se os
  // dois pontos são da mesma área, dá exatamente a mesma fórmula de sempre;
  // se a seção atravessa pra uma área com cota final diferente, o trapézio
  // daquele trecho já entra com o degrau certo, sem precisar quebrar a seção.
  function _calcAreaSecaoVariavel(cotas, cotasFinais, distancias) {
    let area = 0;
    for (let i = 0; i < cotas.length - 1; i++) {
      const h0 = TC.num(cotas[i]) - TC.num(cotasFinais[i]);
      const h1 = TC.num(cotas[i + 1]) - TC.num(cotasFinais[i + 1]);
      area += ((h0 + h1) / 2) * TC.num(distancias[i]);
    }
    return area;
  }

  // Gera as seções considerando TODAS as áreas JUNTAS — uma linha de grade
  // passa reto de uma área pra outra vizinha (só muda a cota final usada
  // naquele trecho, criando o degrau real), e só quebra em cadeias/seções
  // diferentes onde não há NENHUMA área cobrindo (vazio de verdade), ou onde
  // há uma reentrância/pátio (formato não-convexo).
  function _gerarSecoesUnificadas(areas) {
    const PASSO_GRADE = 1.5, PASSO_AMOSTRA = 0.5;
    const areasComPontos = areas.map(area => {
      const pontosArea = (config.pontosCota || []).filter(p => p.areaId === area.id).map(p => ({ ..._paraMetros(p), cota: p.cota }));
      return { area, poligonoM: area.pontos.map(_paraMetros), pontosArea };
    }).filter(ap => ap.pontosArea.length >= 1);
    if (!areasComPontos.length) return { horizontais: [], verticais: [] };

    // Bounds globais — união das caixas de TODAS as áreas
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    areasComPontos.forEach(ap => {
      ap.poligonoM.forEach(p => {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      });
    });

    function acharAreaNoPonto(pt) {
      for (const ap of areasComPontos) if (_pontoDentroPoligono(pt, ap.poligonoM)) return ap;
      return null;
    }
    function interpolarNaArea(ap, x, y) {
      let somaPeso = 0, somaPesoCota = 0;
      for (const p of ap.pontosArea) {
        const d2 = (p.x - x) ** 2 + (p.y - y) ** 2;
        if (d2 < 1e-6) return p.cota;
        const peso = 1 / d2;
        somaPeso += peso; somaPesoCota += peso * p.cota;
      }
      return somaPeso > 0 ? somaPesoCota / somaPeso : TC.num(ap.area.cotaFinal);
    }
    function _refinarBordaO(oDentro, oFora, fixarX, v) {
      let a = oDentro, b = oFora;
      for (let iter = 0; iter < 12; iter++) {
        const m = (a + b) / 2;
        const pt = fixarX ? { x: v, y: m } : { x: m, y: v };
        if (acharAreaNoPonto(pt)) a = m; else b = m;
      }
      return a;
    }

    function linhasNaDirecao(fixarX) {
      const inicioFixo = fixarX ? minX : minY, fimFixo = fixarX ? maxX : maxY;
      const outroMin = fixarX ? minY : minX, outroMax = fixarX ? maxY : maxX;

      const linhasBrutas = [];
      for (let v = inicioFixo; v <= fimFixo + 1e-6; v += PASSO_GRADE) {
        const pontosLinha = [];
        for (let o = outroMin - PASSO_AMOSTRA; o <= outroMax + PASSO_AMOSTRA + 1e-6; o += PASSO_AMOSTRA) {
          const pt = fixarX ? { x: v, y: o } : { x: o, y: v };
          pontosLinha.push({ o, ap: acharAreaNoPonto(pt) });
        }
        const segmentos = [];
        let atual = [], inicioIdx = -1;
        for (let i = 0; i < pontosLinha.length; i++) {
          const p = pontosLinha[i];
          if (p.ap) { if (atual.length === 0) inicioIdx = i; atual.push(p); }
          else {
            if (atual.length >= 2) {
              let oIni = atual[0].o, oFim = atual[atual.length - 1].o;
              if (inicioIdx > 0) oIni = _refinarBordaO(oIni, pontosLinha[inicioIdx - 1].o, fixarX, v);
              oFim = _refinarBordaO(oFim, p.o, fixarX, v);
              const ajustado = atual.slice();
              ajustado[0] = { o: oIni, ap: atual[0].ap };
              ajustado[ajustado.length - 1] = { o: oFim, ap: atual[atual.length - 1].ap };
              segmentos.push(ajustado);
            }
            atual = []; inicioIdx = -1;
          }
        }
        if (atual.length >= 2) segmentos.push(atual);
        linhasBrutas.push({ v, segmentos });
      }

      // Agrupa segmentos em cadeias por sobreposição de intervalo com a linha
      // anterior — só quebra em vazio de verdade ou reentrância, NUNCA na
      // fronteira entre duas áreas vizinhas (essa passa reto).
      const cadeias = [];
      let cadeiasAtivas = [];
      linhasBrutas.forEach(({ v, segmentos }) => {
        const novasAtivas = [];
        const usadas = new Set();
        segmentos.forEach(seg => {
          const oIni = seg[0].o, oFim = seg[seg.length - 1].o;
          let melhor = null, melhorSobreposicao = 0;
          cadeiasAtivas.forEach((cad, ci) => {
            if (usadas.has(ci)) return;
            const ultimo = cad[cad.length - 1];
            const sobreposicao = Math.min(oFim, ultimo.oFim) - Math.max(oIni, ultimo.oIni);
            if (sobreposicao > melhorSobreposicao) { melhorSobreposicao = sobreposicao; melhor = ci; }
          });
          const item = { v, seg, oIni, oFim };
          if (melhor !== null) { cadeiasAtivas[melhor].push(item); usadas.add(melhor); novasAtivas[melhor] = cadeiasAtivas[melhor]; }
          else { const nova = [item]; cadeias.push(nova); novasAtivas.push(nova); }
        });
        cadeiasAtivas = novasAtivas.filter(Boolean);
      });

      const linhas = [];
      cadeias.forEach((cadeia, ci) => {
        cadeia.forEach(({ v, seg }, idx) => {
          const amostras = seg.map(p => ({
            o: p.o,
            cota: interpolarNaArea(p.ap, fixarX ? v : p.o, fixarX ? p.o : v),
            cotaFinal: TC.num(p.ap.area.cotaFinal),
            areaId: p.ap.area.id,
          }));
          const cotas = amostras.map(a2 => a2.cota);
          const cotasFinais = amostras.map(a2 => a2.cotaFinal);
          const areaIds = amostras.map(a2 => a2.areaId);
          const distancias = [];
          for (let k = 0; k < amostras.length - 1; k++) distancias.push(+(amostras[k + 1].o - amostras[k].o).toFixed(3));
          const pInicioM = fixarX ? { x: v, y: amostras[0].o } : { x: amostras[0].o, y: v };
          const pFimM = fixarX ? { x: v, y: amostras[amostras.length - 1].o } : { x: amostras[amostras.length - 1].o, y: v };
          const proximaNaCadeia = cadeia[idx + 1];
          linhas.push({
            pos: v, cadeiaId: ci, cotas, cotasFinais, areaIds, distanciasCotas: distancias,
            cotaFinal: cotasFinais[0], // valor de referência (1º trecho) pra exibição simples — a conta usa cotasFinais[] completo
            area: _calcAreaSecaoVariavel(cotas, cotasFinais, distancias),
            areaId: areaIds[0],
            origemFrac: _paraFracao(pInicioM), fimFrac: _paraFracao(pFimM),
            origemGlobal: +amostras[0].o.toFixed(3),
            distanciaProxima: proximaNaCadeia ? +(proximaNaCadeia.v - v).toFixed(3) : '',
          });
        });
      });
      return linhas;
    }

    return { verticais: linhasNaDirecao(true), horizontais: linhasNaDirecao(false) };
  }

  async function gerarSecoes() {
    const areas = config.areas || [];
    if (!areas.length) { Utils.toast('Desenhe pelo menos uma área antes.', 'alerta'); return; }
    if (!(config.escalaPxPorMetro > 0)) { Utils.toast('Calibre a escala antes.', 'alerta'); return; }
    if ((secoes.horizontal.length || secoes.vertical.length)) {
      const ok = await Utils.confirmar('Gerar seções agora vai SUBSTITUIR todas as seções atuais (horizontais e verticais). Continuar?');
      if (!ok) return;
    }
    Utils.mostrarLoading('Gerando seções (grade de 1,5m)...');
    try {
      const { horizontais: todasH, verticais: todasV } = _gerarSecoesUnificadas(areas);
      if (!todasH.length && !todasV.length) {
        Utils.toast('Nenhuma seção gerada — confira se marcou pontos de cota suficientes (mínimo 1) dentro das áreas.', 'alerta');
        return;
      }
      todasH.sort((a, b) => a.pos - b.pos);
      todasV.sort((a, b) => a.pos - b.pos);
      // distanciaProxima já vem certa de cada cadeia (calculada lá dentro,
      // antes do sort abaixo — que só serve pra numerar/exibir em ordem).
      const monta = linhas => linhas.map((l, i) => ({
        id: TC.genId('sec'), numero: i + 1, cotas: l.cotas, cotasFinais: l.cotasFinais, distanciasCotas: l.distanciasCotas, cotaFinal: l.cotaFinal,
        area: l.area, distanciaProxima: l.distanciaProxima, areaManual: '',
        areaId: l.areaId, areaIds: l.areaIds, cadeiaId: l.cadeiaId, origemFrac: l.origemFrac, fimFrac: l.fimFrac, origemGlobal: l.origemGlobal,
      }));
      secoes.horizontal = monta(todasH);
      secoes.vertical = monta(todasV);
      secAberta = null;
      await salvarSecoes();
      Utils.toast(`✓ ${secoes.horizontal.length} seções horizontais e ${secoes.vertical.length} verticais geradas!`, 'sucesso');
      renderizar();
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao gerar seções: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  function secAdd() {
    const lista = secoes[secDir];
    lista.push({
      id: TC.genId('sec'), numero: lista.length + 1,
      cotas: [], cotaFinal: '', distanciasCotas: [], area: 0, distanciaProxima: '', areaManual: '',
    });
    secAberta = lista.length - 1;
    renderSecoes();
  }
  function secRemover(i) {
    secoes[secDir].splice(i, 1);
    if (secAberta === i) secAberta = null;
    renderSecoes();
  }
  function secToggle(i) {
    secAberta = secAberta === i ? null : i;
    renderSecoes();
  }

  function secUpd(i, campo, valor) { secoes[secDir][i][campo] = valor; renderSecoes(); }
  function secUpdCotas(i, valor) {
    const s = secoes[secDir][i];
    s.cotas = TC.parseLista(valor);
    recalcArea(s);
    renderSecoes();
  }
  function secUpdCotaFinal(i, valor) {
    const s = secoes[secDir][i];
    s.cotaFinal = valor;
    s.cotasFinais = null; // edição manual do valor escalar sobrepõe o array por ponto (se tinha)
    recalcArea(s);
    renderSecoes();
  }
  function secUpdDistCotas(i, valor) {
    const s = secoes[secDir][i];
    s.distanciasCotas = TC.parseLista(valor);
    recalcArea(s);
    renderSecoes();
  }
  function secUpdAreaManual(i, valor) {
    const s = secoes[secDir][i];
    s.areaManual = valor;
    recalcArea(s);
    renderSecoes();
  }

  async function salvarSecoesBtn() {
    Utils.mostrarLoading();
    try {
      await salvarSecoes();
      Utils.toast('✓ Seções salvas!', 'sucesso');
      renderizar();
    } catch (e) {
      Utils.toast('Erro ao salvar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ══════════════════════════════════════════
  // PROJETO ÚNICO — imagem/PDF compartilhada por todas as seções
  // (armazenada à parte, fora do doc principal, pra não estourar
  // limite de tamanho do Firestore)
  // ══════════════════════════════════════════
  function _ls(src) { return new Promise((r, j) => { const s = document.createElement('script'); s.src = src; s.onload = r; s.onerror = j; document.head.appendChild(s); }); }
  async function _carregarPdfjs() {
    if (pdfjsCarregado || typeof pdfjsLib !== 'undefined') { pdfjsCarregado = true; return; }
    await _ls('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    pdfjsCarregado = true;
  }
  async function _garantirImagemProjetoCarregada() {
    if (imagemProjetoCache || !config.temImagemProjeto) return;
    try {
      const doc = await db.collection('obras').doc(obraId).collection('config').doc(DOC_PROJETO_IMG).get();
      const url = doc.exists ? (doc.data().img || null) : null;
      if (url) { imagemProjetoCache = url; renderSecoes(); }
    } catch (e) { /* ignora — mostra "carregando" até a próxima tentativa */ }
  }

  function escolherImagemProjeto() {
    if (!Permissions.pode('levantamentoTerra', 'criar') && !Permissions.pode('levantamentoTerra', 'editar')) { Utils.toast('Sem permissão.', 'erro'); return; }
    const eraTrocar = config.temImagemProjeto;
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.pdf,image/*';
    inp.onchange = e => processarImagemProjeto(e.target.files[0], eraTrocar);
    inp.click();
  }

  async function processarImagemProjeto(file, eraTrocar) {
    if (!file) return;
    if (eraTrocar) {
      const totalAreas = (config.areas || []).length, totalPontos = (config.pontosCota || []).length;
      if (totalAreas > 0 || totalPontos > 0) {
        const ok = await Utils.confirmar(`Trocar o projeto vai apagar a escala calibrada, ${totalAreas} área(s) e ${totalPontos} ponto(s) de cota já marcados (as posições não valem mais na imagem nova). As seções já geradas continuam salvas. Continuar?`);
        if (!ok) return;
      }
    }
    Utils.mostrarLoading('Processando projeto...');
    try {
      let canvas;
      if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
        await _carregarPdfjs();
        const buf = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        const page = await pdf.getPage(1);
        const viewportBase = page.getViewport({ scale: 1 });
        const alvo = 2200;
        const escala = Math.min(4, alvo / Math.max(viewportBase.width, viewportBase.height));
        const viewport = page.getViewport({ scale: escala });
        canvas = document.createElement('canvas');
        canvas.width = viewport.width; canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      } else {
        const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = URL.createObjectURL(file); });
        const alvo = 2200;
        const fator = Math.min(1, alvo / Math.max(img.naturalWidth, img.naturalHeight));
        canvas = document.createElement('canvas');
        canvas.width = Math.round(img.naturalWidth * fator);
        canvas.height = Math.round(img.naturalHeight * fator);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      }
      const { url, width, height, ok } = TC.canvasParaDataURLLimitado(canvas);
      if (!ok) throw new Error('Arquivo grande demais mesmo após compressão. Tente uma exportação menor.');
      await db.collection('obras').doc(obraId).collection('config').doc(DOC_PROJETO_IMG).set({ img: url });
      imagemProjetoCache = url;
      config.temImagemProjeto = true; config.imgW = width; config.imgH = height; config.escalaPxPorMetro = 0;
      config.areas = []; config.pontosCota = [];
      ferramenta = null; areaEmDesenho = null;
      await salvarConfig();
      Utils.toast('✓ Projeto inserido! Agora calibre a escala.', 'sucesso');
      renderSecoes();
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao processar arquivo: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  function calibrarProjeto() {
    calibrando = !calibrando;
    calibPontoTemp = null;
    renderSecoes();
  }

  // ══════════════════════════════════════════
  // CONFIG (empolamento + capacidades padrão)
  // ══════════════════════════════════════════
  function abrirConfig() {
    renderConfig();
    Utils.abrirModal('modal-tp-config');
  }
  function renderConfig() {
    const el = document.getElementById('tp-config-body');
    if (!el) return;
    el.innerHTML = `
      <div class="form-grupo"><label>Cota de Referência Padrão do Projeto (m)</label><input type="text" inputmode="decimal" id="tp-cfg-cotaref" class="form-control" value="${esc(config.cotaReferencia ?? '')}" placeholder="ex: 93.40"></div>
      <p class="text-sm text-muted mb-1">Usada como base (cota inferior) em todas as seções no modo "Marcar no Projeto" que não tiverem uma cota própria definida.</p>
      <div class="form-row" style="align-items:end;">
        <div class="form-grupo"><label>Preset de Empolamento</label>
          <select id="tp-cfg-empolamento-preset" class="form-control" onchange="TP_UI.aplicarPresetEmpolamento()">
            <option value="">— manual —</option>
            ${TC.PRESETS_EMPOLAMENTO.map((p, idx) => `<option value="${idx}">${esc(p.label)}</option>`).join('')}
          </select>
        </div>
        <div class="form-grupo"><label>Taxa de Empolamento (%)</label><input type="text" inputmode="decimal" id="tp-cfg-empolamento" class="form-control" value="${esc((config.taxaEmpolamento * 100).toString())}" placeholder="30"></div>
      </div>
      <p class="text-sm text-muted">A taxa de empolamento converte o volume de banco (corte) para o volume solto transportado pelos caminhões.</p>
      <div class="cc-divider"></div>
      <label style="font-weight:700;font-size:.85rem;">🚚 Tipos de Caminhão (nome + capacidade)</label>
      <p class="text-sm text-muted mb-1">Não precisa ser só Grande/Pequeno — adicione quantos tipos precisar (ex: "Barra Azul").</p>
      <div id="tp-cfg-tipos-lista">${_tiposCaminhaoRowsHTML()}</div>
      <button class="btn btn-secundario btn-sm" onclick="TP_UI.adicionarTipoCaminhao()">+ Adicionar Tipo</button>
    `;
  }
  function _tiposCaminhaoRowsHTML() {
    return (config.tiposCaminhao || []).map((t, i) => `
      <div class="form-row" style="align-items:end;" data-tipo-row="${i}">
        <div class="form-grupo"><label>Nome</label><input type="text" class="form-control" value="${esc(t.nome)}" placeholder="ex: Barra Azul" oninput="TP_UI.atualizarTipoCaminhao(${i},'nome',this.value)"></div>
        <div class="form-grupo"><label>Capacidade (m³)</label><input type="text" inputmode="decimal" class="form-control" value="${esc(t.capacidade)}" placeholder="12" oninput="TP_UI.atualizarTipoCaminhao(${i},'capacidade',this.value)"></div>
        <button class="btn btn-secundario btn-sm" style="color:var(--cv-red);height:38px;" onclick="TP_UI.removerTipoCaminhao(${i})" title="Remover tipo">🗑</button>
      </div>`).join('');
  }
  function adicionarTipoCaminhao() {
    config.tiposCaminhao.push({ nome: '', capacidade: '' });
    document.getElementById('tp-cfg-tipos-lista').innerHTML = _tiposCaminhaoRowsHTML();
  }
  function atualizarTipoCaminhao(i, campo, valor) { config.tiposCaminhao[i][campo] = campo === 'capacidade' ? TC.num(valor) : valor; }
  function removerTipoCaminhao(i) {
    config.tiposCaminhao.splice(i, 1);
    document.getElementById('tp-cfg-tipos-lista').innerHTML = _tiposCaminhaoRowsHTML();
  }
  function aplicarPresetEmpolamento() {
    const idx = document.getElementById('tp-cfg-empolamento-preset').value;
    if (idx === '') return;
    const preset = TC.PRESETS_EMPOLAMENTO[parseInt(idx)];
    if (preset) document.getElementById('tp-cfg-empolamento').value = (preset.taxa * 100).toString();
  }
  async function salvarConfigBtn() {
    const empolPct = TC.num(document.getElementById('tp-cfg-empolamento').value);
    config.taxaEmpolamento = empolPct / 100;
    config.cotaReferencia = document.getElementById('tp-cfg-cotaref').value.trim();
    config.tiposCaminhao = (config.tiposCaminhao || []).filter(t => (t.nome || '').trim() && t.capacidade > 0);
    if (!config.tiposCaminhao.length) { Utils.toast('Cadastre pelo menos 1 tipo de caminhão com nome e capacidade.', 'alerta'); return; }
    const nomes = config.tiposCaminhao.map(t => t.nome.trim().toLowerCase());
    if (new Set(nomes).size !== nomes.length) { Utils.toast('Tem tipo de caminhão com nome repetido.', 'alerta'); return; }
    // compat: mantém capacidadeGrande/capacidadePequena legado sincronizado, se existirem os nomes
    const grande = config.tiposCaminhao.find(t => t.nome.trim().toLowerCase() === 'grande');
    const pequeno = config.tiposCaminhao.find(t => t.nome.trim().toLowerCase() === 'pequeno');
    if (grande) config.capacidadeGrande = grande.capacidade;
    if (pequeno) config.capacidadePequena = pequeno.capacidade;
    Utils.mostrarLoading();
    try {
      await salvarConfig();
      _recalcTudo();
      Utils.toast('✓ Configuração salva!', 'sucesso');
      Utils.fecharModal('modal-tp-config');
      renderizar();
    } catch (e) {
      Utils.toast('Erro: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ══════════════════════════════════════════
  // CAMINHÕES
  // ══════════════════════════════════════════
  function abrirCaminhoes() {
    renderCaminhoes();
    Utils.abrirModal('modal-tp-caminhoes');
  }
  function renderCaminhoes() {
    const el = document.getElementById('tp-caminhoes-body');
    if (!el) return;
    el.innerHTML = `
      <div class="form-row" style="align-items:end;">
        <div class="form-grupo"><label>Placa</label><input type="text" id="tp-cam-placa" class="form-control" placeholder="EZR-4251" style="text-transform:uppercase;"></div>
        <div class="form-grupo"><label>Tamanho</label><select id="tp-cam-tamanho" class="form-control">${(config.tiposCaminhao || []).map(t => `<option value="${esc(t.nome)}">${esc(t.nome)} (${TC.fmt1(t.capacidade)} m³)</option>`).join('')}</select></div>
      </div>
      <p class="text-sm text-muted" style="margin-top:-6px;">Precisa de outro tipo? Cadastra em <a href="#" onclick="event.preventDefault();Utils.fecharModal('modal-tp-caminhoes');TP_UI.abrirConfig();">⚙️ Config</a>.</p>
      <div class="form-row" style="align-items:end;">
        <div class="form-grupo"><label>Empresa</label><input type="text" id="tp-cam-empresa" class="form-control" placeholder="Locaterh"></div>
        <button class="btn btn-primario btn-sm" data-perm="levantamentoTerra:criar" style="height:38px;" onclick="TP_UI.salvarCaminhao()">+ Adicionar</button>
      </div>
      <div class="cc-divider"></div>
      ${!caminhoes.length ? `<div class="cc-empty">Nenhum caminhão cadastrado.</div>` : `
      <div class="cc-tableWrap">
        <table class="cc-table">
          <thead><tr><th>Placa</th><th>Tamanho</th><th>Empresa</th><th class="col-acoes"></th></tr></thead>
          <tbody>
            ${caminhoes.map(c => `
              <tr>
                <td class="cc-tdMono" style="font-weight:700;">${esc(c.placa)}</td>
                <td>${esc(c.tamanho)}</td>
                <td>${esc(c.empresa || '—')}</td>
                <td class="col-acoes"><button class="btn btn-secundario btn-sm" data-perm="levantamentoTerra:excluir" style="color:var(--cv-red);" onclick="TP_UI.excluirCaminhao('${c.id}')">🗑</button></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`}`;
    Permissions.aplicarNaTela();
  }
  async function salvarCaminhao() {
    if(!Permissions.pode('levantamentoTerra','criar')&&!Permissions.pode('levantamentoTerra','editar')){Utils.toast('Sem permissão.','erro');return;}
    const placa = document.getElementById('tp-cam-placa').value.trim().toUpperCase();
    const tamanho = document.getElementById('tp-cam-tamanho').value;
    const empresa = document.getElementById('tp-cam-empresa').value.trim();
    if (!placa) { Utils.toast('Informe a placa.', 'alerta'); return; }
    Utils.mostrarLoading();
    try {
      await Database.criar(obraId, COL_CAMINHOES, { placa, tamanho, empresa }, TC.genId('cam'));
      await carregar();
      renderCaminhoes();
      Utils.toast('✓ Caminhão adicionado!', 'sucesso');
    } catch (e) {
      Utils.toast('Erro: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }
  async function excluirCaminhao(id) {
    if(!Permissions.pode('levantamentoTerra','excluir')){Utils.toast('Sem permissão para excluir.','erro');return;}
    const ok = await Utils.confirmar('Excluir este caminhão?');
    if (!ok) return;
    Utils.mostrarLoading();
    try {
      await Database.deletar(obraId, COL_CAMINHOES, id);
      await carregar();
      renderCaminhoes();
    } catch (e) {
      Utils.toast('Erro: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ══════════════════════════════════════════
  // VISUALIZAÇÃO 3D — loft entre as seções da direção atual, formando o
  // sólido do corte de terra (superfície do terreno até a cota de
  // referência). Usa Three.js puro (sem OrbitControls — rotação/zoom
  // feitos na mão, com pointer events, pra não depender de addon externo).
  // ══════════════════════════════════════════
  let _3d = null; // { renderer, scene, camera, group, raf, ...estado de arraste }

  function _corProfundidade(prof, profMin, profMax) {
    const t = profMax > profMin ? Math.max(0, Math.min(1, (prof - profMin) / (profMax - profMin))) : 0;
    // raso (t=0) verde → fundo (t=1) vermelho
    const r = Math.round(34 + t * (220 - 34));
    const g = Math.round(160 - t * (160 - 38));
    const b = Math.round(70 - t * (70 - 38));
    return { r: r / 255, g: g / 255, b: b / 255 };
  }

  // ══════════════════════════════════════════
  // VER SEÇÕES — planta com a linha da seção SELECIONADA riscada (só ela —
  // as outras ficam apagadas, senão fica ilegível com 30+ seções) + zoom/pan
  // no mapa + perfil lateral (2D) da seção, com trechos VERDES (corte, acima
  // da referência) e VERMELHOS (abaixo — é aí que a área pode sair negativa).
  // ══════════════════════════════════════════
  let secaoVisualizada = 0;
  let verSecZoom = 1, verSecPanX = 0, verSecPanY = 0;
  async function abrirVerSecoes() {
    const lista = secoes[secDir] || [];
    if (!lista.length) { Utils.toast('Nenhuma seção nesta direção ainda.', 'alerta'); return; }
    secaoVisualizada = 0;
    verSecZoom = 1; verSecPanX = 0; verSecPanY = 0;
    if (config.temImagemProjeto && !imagemProjetoCache) await _garantirImagemProjetoCarregada();
    renderVerSecoes();
    Utils.abrirModal('modal-tp-versecoes');
  }
  function fecharVerSecoes() { Utils.fecharModal('modal-tp-versecoes'); }
  function selecionarSecaoVisualizada(i) { secaoVisualizada = i; renderVerSecoes(); }
  function verSecZoomIn() { verSecZoom = Math.min(6, verSecZoom * 1.4); _aplicarZoomPan(); }
  function verSecZoomOut() { verSecZoom = Math.max(1, verSecZoom / 1.4); if (verSecZoom === 1) { verSecPanX = 0; verSecPanY = 0; } _aplicarZoomPan(); }
  function verSecZoomReset() { verSecZoom = 1; verSecPanX = 0; verSecPanY = 0; _aplicarZoomPan(); }
  function _aplicarZoomPan() {
    const wrap = document.getElementById('tp-versecoes-zoomwrap');
    if (wrap) wrap.style.transform = `translate(${verSecPanX}px, ${verSecPanY}px) scale(${verSecZoom})`;
  }
  function _attachPanZoomVerSecoes() {
    const container = document.getElementById('tp-versecoes-mapa');
    if (!container) return;
    let arrastando = false, lastX = 0, lastY = 0;
    container.onpointerdown = ev => {
      if (verSecZoom <= 1) return;
      arrastando = true; lastX = ev.clientX; lastY = ev.clientY; container.style.cursor = 'grabbing';
      try { container.setPointerCapture(ev.pointerId); } catch (e) {}
    };
    container.onpointermove = ev => {
      if (!arrastando) return;
      verSecPanX += ev.clientX - lastX; verSecPanY += ev.clientY - lastY;
      lastX = ev.clientX; lastY = ev.clientY;
      _aplicarZoomPan();
    };
    const parar = () => { arrastando = false; container.style.cursor = verSecZoom > 1 ? 'grab' : 'default'; };
    container.onpointerup = parar; container.onpointerleave = parar; container.onpointercancel = parar;
    container.onwheel = ev => {
      ev.preventDefault();
      const rect = container.getBoundingClientRect();
      const cx = ev.clientX - rect.left - rect.width / 2, cy = ev.clientY - rect.top - rect.height / 2;
      const zoomAntigo = verSecZoom;
      verSecZoom = Math.max(1, Math.min(6, verSecZoom * (ev.deltaY < 0 ? 1.15 : 0.87)));
      const fatorReal = verSecZoom / zoomAntigo;
      verSecPanX = cx - (cx - verSecPanX) * fatorReal;
      verSecPanY = cy - (cy - verSecPanY) * fatorReal;
      if (verSecZoom === 1) { verSecPanX = 0; verSecPanY = 0; }
      _aplicarZoomPan();
    };
  }

  function renderVerSecoes() {
    const el = document.getElementById('tp-versecoes-body');
    if (!el) return;
    const listaEl = document.getElementById('tp-versecoes-lista');
    const scrollAntes = listaEl ? listaEl.scrollTop : 0; // guarda antes de recriar o HTML, senão reseta pro topo a cada clique
    const lista = secoesComVolume(secoes[secDir] || []);
    if (secaoVisualizada >= lista.length) secaoVisualizada = 0;
    const s = lista[secaoVisualizada];
    const temPlanta = config.temImagemProjeto && imagemProjetoCache;
    const semPosicaoSalva = temPlanta && lista.length && !lista.some(sec => sec.origemFrac && sec.fimFrac);
    el.innerHTML = `
      <div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:12px;">
        ${temPlanta ? `
        <div style="flex:2 1 420px;min-width:280px;">
          <div style="display:flex;gap:6px;margin-bottom:6px;">
            <button class="btn btn-secundario btn-sm" onclick="TP_UI.verSecZoomOut()">➖</button>
            <button class="btn btn-secundario btn-sm" onclick="TP_UI.verSecZoomIn()">➕</button>
            <button class="btn btn-secundario btn-sm" onclick="TP_UI.verSecZoomReset()">🔄 Resetar zoom</button>
          </div>
          <div id="tp-versecoes-mapa" style="border:1px solid var(--cv-border);border-radius:6px;overflow:hidden;position:relative;height:65vh;min-height:420px;background:#111;touch-action:none;display:flex;align-items:center;justify-content:center;">
            <div id="tp-versecoes-zoomwrap" style="transform-origin:center center;position:relative;max-width:100%;max-height:100%;aspect-ratio:${config.imgW || 1} / ${config.imgH || 1};">
              <img src="${imagemProjetoCache}" style="width:100%;height:100%;display:block;user-select:none;" draggable="false">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;">
                ${s && s.origemFrac && s.fimFrac ? `<line x1="${(s.origemFrac.x * 100).toFixed(2)}" y1="${(s.origemFrac.y * 100).toFixed(2)}" x2="${(s.fimFrac.x * 100).toFixed(2)}" y2="${(s.fimFrac.y * 100).toFixed(2)}" stroke="#ff2d55" stroke-width="1.1" vector-effect="non-scaling-stroke"/>` : ''}
              </svg>
            </div>
          </div>
          <p class="text-sm text-muted mt-1">${semPosicaoSalva ? '⚠️ Estas seções foram geradas antes desta função existir — clique em "▦ Gerar Seções" de novo pra elas ganharem posição na planta.' : 'Arraste (com zoom) ou role o scroll pra dar zoom no mapa. A linha vermelha é a seção selecionada.'}</p>
        </div>` : ''}
        <div style="flex:1 1 220px;min-width:200px;">
          <div id="tp-versecoes-lista" class="cc-tableWrap" style="max-height:65vh;overflow-y:auto;">
            <table class="cc-table">
              <thead><tr><th>#</th><th class="col-num">Área (m²)</th></tr></thead>
              <tbody>
                ${lista.map((sec, i) => `<tr style="cursor:pointer;${i === secaoVisualizada ? 'background:var(--cv-surface2);' : ''}" onclick="TP_UI.selecionarSecaoVisualizada(${i})">
                  <td class="cc-tdMono" style="${i === secaoVisualizada ? 'color:#ff2d55;font-weight:700;' : ''}">${sec.numero ?? i + 1}</td>
                  <td class="col-num cc-tdMono" style="${sec.area < 0 ? 'color:var(--cv-red);font-weight:700;' : ''}">${TC.fmt2(sec.area)}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      ${s ? `
      <div style="font-family:var(--cv-mono);font-size:.85rem;margin-bottom:8px;">
        Seção ${s.numero ?? secaoVisualizada + 1} — Comprimento: <b style="color:var(--cv-accent3);">${TC.fmt2(TC.calcComprimentoSecao(s.distanciasCotas || []))} m</b> — Área: <b style="${s.area < 0 ? 'color:var(--cv-red);' : 'color:var(--cv-accent3);'}">${TC.fmt2(s.area)} m²</b>
        ${s.area < 0 ? ' ⚠️ negativa — tem trecho do terreno ABAIXO da cota final desta área (em vermelho no desenho)' : ''}
      </div>
      ${_svgPerfilLateral(s)}` : `<div class="cc-empty">Selecione uma seção.</div>`}
    `;
    if (temPlanta) { _attachPanZoomVerSecoes(); _aplicarZoomPan(); }
    const listaElNova = document.getElementById('tp-versecoes-lista');
    if (listaElNova) listaElNova.scrollTop = scrollAntes;
  }

  // Desenha o perfil 2D (lateral) de uma seção: linha do terreno, linha
  // pontilhada da cota final, e o preenchimento por trecho — verde onde o
  // terreno tá acima da referência (corte), vermelho onde tá abaixo
  // (contribui NEGATIVO pra área — é aqui que dá pra ver o porquê).
  function _svgPerfilLateral(s) {
    const cotas = (s.cotas || []).map(c => TC.num(c)); // valores ORIGINAIS (como digitado/marcado) — sempre usados nos textos
    const dist = s.distanciasCotas || [];
    if (cotas.length < 2) return `<div class="cc-empty">Esta seção não tem cotas suficientes pra desenhar o perfil.</div>`;
    // cotasFinais por ponto (degrau real se a seção atravessa pra outra área
    // com cota final diferente) — seções antigas/manuais só têm o escalar,
    // repete ele pra todos os pontos nesse caso.
    const cotasFinais = (s.cotasFinais && s.cotasFinais.length === cotas.length) ? s.cotasFinais.map(c => TC.num(c)) : cotas.map(() => TC.num(s.cotaFinal));
    const xs = [0];
    for (let i = 0; i < dist.length; i++) xs.push(xs[i] + TC.num(dist[i]));
    const minY = Math.min(...cotas, ...cotasFinais, 0), maxY = Math.max(...cotas, ...cotasFinais, 0); // inclui 0 sempre, pra linha de referência aparecer
    const pad = Math.max(0.3, (maxY - minY) * 0.15);
    const yLo = minY - pad, yHi = maxY + pad;
    const totalW = xs[xs.length - 1] || 1;
    const PX0 = 55, PX1 = 590, PY0 = 20, PY1 = 250;
    const mapX = x => PX0 + (x / totalW) * (PX1 - PX0);
    const mapY = y => yHi > yLo ? PY1 - ((y - yLo) / (yHi - yLo)) * (PY1 - PY0) : (PY0 + PY1) / 2;
    const quads = [];
    // Corte (verde, positivo) e Aterro (vermelho, negativo) somados separado —
    // é a MESMA decomposição da fórmula de área (trapézios), só exposta aqui
    // pra dar pra auditar visualmente de onde vem um resultado negativo.
    let areaCorte = 0, areaAterro = 0;
    for (let i = 0; i < cotas.length - 1; i++) {
      const x1 = mapX(xs[i]), x2 = mapX(xs[i + 1]);
      const y1 = mapY(cotas[i]), y2 = mapY(cotas[i + 1]);
      const yf1 = mapY(cotasFinais[i]), yf2 = mapY(cotasFinais[i + 1]);
      const contrib = ((cotas[i] - cotasFinais[i]) + (cotas[i + 1] - cotasFinais[i + 1])) / 2 * TC.num(dist[i]);
      if (contrib >= 0) areaCorte += contrib; else areaAterro += contrib;
      const cor = contrib >= 0 ? '#22c55e' : '#ef4444';
      quads.push(`<polygon points="${x1},${y1} ${x2},${y2} ${x2},${yf2} ${x1},${yf1}" fill="${cor}" fill-opacity="${contrib >= 0 ? 0.4 : 0.65}"/>`);
    }
    // Linha da cota final em DEGRAU (não mais uma reta única) — segue
    // cotasFinais[] ponto a ponto, mostrando o salto de verdade onde a seção
    // atravessa de uma área pra outra com referência diferente.
    const linhaCf = `<polyline points="${cotasFinais.map((c, i) => `${mapX(xs[i]).toFixed(1)},${mapY(c).toFixed(1)}`).join(' ')}" fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="5,3"/>`;
    const linhaZero = `<line x1="${PX0}" y1="${mapY(0).toFixed(1)}" x2="${PX1}" y2="${mapY(0).toFixed(1)}" stroke="#94a3b8" stroke-width="1" stroke-dasharray="2,3"/><text x="${PX1 - 4}" y="${(mapY(0) - 5).toFixed(1)}" font-size="10" fill="#94a3b8" text-anchor="end" font-family="monospace">Cota 0</text>`;
    const linhaTerreno = `<polyline points="${cotas.map((c, i) => `${mapX(xs[i]).toFixed(1)},${mapY(c).toFixed(1)}`).join(' ')}" fill="none" stroke="#fff" stroke-width="2"/>`;
    const pontos = cotas.map((c, i) => `<circle cx="${mapX(xs[i]).toFixed(1)}" cy="${mapY(c).toFixed(1)}" r="3.5" fill="#3b82f6" stroke="#fff" stroke-width="1"/><text x="${mapX(xs[i]).toFixed(1)}" y="${(mapY(c) - 8).toFixed(1)}" font-size="9" fill="#fff" text-anchor="middle" font-family="monospace">${TC.fmt2(c)}</text>`).join('');
    // Rótulo mostra a cota final do PRIMEIRO trecho, e avisa se varia ao longo da seção
    const varia = cotasFinais.some(c => Math.abs(c - cotasFinais[0]) > 1e-6);
    const rotuloCf = `<text x="${PX0 + 4}" y="${(mapY(cotasFinais[0]) - 5).toFixed(1)}" font-size="10" fill="#f59e0b" font-family="monospace">Cota Final: ${TC.fmt2(cotasFinais[0])}${varia ? ' (varia — atravessa outra área)' : ''}</text>`;
    const resumo = `<p class="text-sm" style="font-family:var(--cv-mono);margin-top:6px;">🟩 Corte: <b style="color:#22c55e;">+${TC.fmt2(areaCorte)} m²</b> · 🟥 Aterro: <b style="color:#ef4444;">${TC.fmt2(areaAterro)} m²</b> · Líquido: <b>${TC.fmt2(areaCorte + areaAterro)} m²</b></p>`;
    return `<svg viewBox="0 0 620 270" style="width:100%;background:#14141f;border-radius:8px;display:block;">${quads.join('')}${linhaZero}${linhaCf}${linhaTerreno}${pontos}${rotuloCf}</svg>${resumo}`;
  }

  async function abrir3D() {
    const temDados = (config.areas || []).some(a => (config.pontosCota || []).filter(p => p.areaId === a.id).length >= 3);
    if (!temDados) { Utils.toast('Marque pelo menos 3 pontos de cota numa área pra gerar o 3D.', 'alerta'); return; }
    Utils.mostrarLoading('Montando visualização 3D...');
    try {
      if (typeof THREE === 'undefined') await _ls('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
      Utils.abrirModal('modal-tp-3d');
      await new Promise(r => setTimeout(r, 60)); // deixa o modal montar antes de medir o container
      _montarCena();
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao montar o 3D: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  function fechar3D() {
    if (_3d) {
      cancelAnimationFrame(_3d.raf);
      _3d.container.removeEventListener('pointerdown', _3d.onDown);
      window.removeEventListener('pointermove', _3d.onMove);
      window.removeEventListener('pointerup', _3d.onUp);
      _3d.container.removeEventListener('wheel', _3d.onWheel);
      _3d.renderer.dispose();
      if (_3d.renderer.domElement.parentNode) _3d.renderer.domElement.parentNode.removeChild(_3d.renderer.domElement);
      _3d = null;
    }
    Utils.fecharModal('modal-tp-3d');
  }

  // Gera uma grade de alturas de UMA área: divide o retângulo dela em células
  // de "passo" metros (em X e Y JUNTOS — não é seção de uma direção só) e
  // interpola a cota em cada nó da grade por IDW, igual ao cálculo de área.
  // É essa grade 2D que vira a malha 3D — não uma seção "esticada".
  function _gerarGradeAltura(area, passo) {
    const pontosArea = (config.pontosCota || []).filter(p => p.areaId === area.id).map(p => ({ ..._paraMetros(p), cota: p.cota }));
    if (pontosArea.length < 1) return null; // sem nenhum ponto marcado não tem o que interpolar
    const poligonoM = area.pontos.map(_paraMetros);
    const xs = poligonoM.map(p => p.x), ys = poligonoM.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    function interpolarCota(x, y) {
      let somaPeso = 0, somaPesoCota = 0;
      for (const pt of pontosArea) {
        const d2 = (pt.x - x) ** 2 + (pt.y - y) ** 2;
        if (d2 < 1e-6) return pt.cota;
        const peso = 1 / d2;
        somaPeso += peso; somaPesoCota += peso * pt.cota;
      }
      return somaPeso > 0 ? somaPesoCota / somaPeso : area.cotaFinal;
    }
    const nx = Math.max(2, Math.round((maxX - minX) / passo) + 1);
    const ny = Math.max(2, Math.round((maxY - minY) / passo) + 1);
    const grid = [];
    for (let j = 0; j < ny; j++) {
      const y = minY + (maxY - minY) * (ny > 1 ? j / (ny - 1) : 0);
      const linha = [];
      for (let i = 0; i < nx; i++) {
        const x = minX + (maxX - minX) * (nx > 1 ? i / (nx - 1) : 0);
        const dentro = _pontoDentroPoligono({ x, y }, poligonoM);
        linha.push({ x, y, dentro, cota: dentro ? interpolarCota(x, y) : null });
      }
      grid.push(linha);
    }
    return { nx, ny, grid, cotaFinal: TC.num(area.cotaFinal) };
  }

  // Constrói cena Three.js a partir da grade de alturas de TODAS as áreas —
  // usada tanto no modal interativo quanto no snapshot pro PDF do relatório.
  // Cada área na sua posição REAL da planta (mesma calibração), sem respiro
  // artificial nenhum entre elas.
  function _construirCena3D() {
    const grades = (config.areas || []).map(a => _gerarGradeAltura(a, 1.5)).filter(Boolean);
    if (!grades.length) return null;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity, minProf = Infinity, maxProf = -Infinity;
    grades.forEach(g => {
      g.grid.forEach(linha => linha.forEach(pt => {
        if (!pt.dentro) return;
        const { cota: cotaPos, cotaFinal: cfPos } = _ajustarConvencaoEscalar(pt.cota, g.cotaFinal);
        minX = Math.min(minX, pt.x); maxX = Math.max(maxX, pt.x);
        minZ = Math.min(minZ, pt.y); maxZ = Math.max(maxZ, pt.y); // Y da planta = Z da cena
        minY = Math.min(minY, cotaPos, cfPos); maxY = Math.max(maxY, cotaPos, cfPos);
        const prof = cotaPos - cfPos;
        minProf = Math.min(minProf, prof); maxProf = Math.max(maxProf, prof);
      }));
    });

    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
    // Escala horizontal (X/Z) fiel à planta — normaliza pra caber numa cena ~100 unidades.
    const escalaXZ = 100 / Math.max(maxX - minX, maxZ - minZ || 1, 1);
    // Escala vertical (Y = profundidade do corte) INDEPENDENTE da horizontal —
    // senão, como o corte costuma ser de só alguns metros num prédio de
    // dezenas de metros, o 3D saía todo achatado. Exagera visualmente a
    // profundidade pra ela ficar sempre bem visível, sem depender do tamanho da planta.
    const ALTURA_VISUAL = 20;
    const escalaY = Math.min(ALTURA_VISUAL / Math.max(maxY - minY, 0.5), escalaXZ * 2);

    const THREE_ = window.THREE;
    const scene = new THREE_.Scene();
    scene.background = new THREE_.Color(0x14141f);
    const group = new THREE_.Group();

    grades.forEach(g => {
      const idx = (i, j) => j * g.nx + i;
      const posTopo = [], corTopo = [], posFundo = [];
      for (let j = 0; j < g.ny; j++) {
        for (let i = 0; i < g.nx; i++) {
          const pt = g.grid[j][i];
          if (!pt.dentro) { posTopo.push(0, 0, 0); posFundo.push(0, 0, 0); corTopo.push(0, 0, 0); continue; }
          const { cota: cotaPos, cotaFinal: cfPos } = _ajustarConvencaoEscalar(pt.cota, g.cotaFinal);
          posTopo.push((pt.x - cx) * escalaXZ, (cotaPos - cy) * escalaY, (pt.y - cz) * escalaXZ);
          posFundo.push((pt.x - cx) * escalaXZ, (cfPos - cy) * escalaY, (pt.y - cz) * escalaXZ);
          const c = _corProfundidade(cotaPos - cfPos, minProf, maxProf);
          corTopo.push(c.r, c.g, c.b);
        }
      }
      const facesTopo = [], facesFundo = [];
      for (let j = 0; j < g.ny - 1; j++) {
        for (let i = 0; i < g.nx - 1; i++) {
          if (!g.grid[j][i].dentro || !g.grid[j][i + 1].dentro || !g.grid[j + 1][i].dentro || !g.grid[j + 1][i + 1].dentro) continue;
          const a = idx(i, j), b = idx(i + 1, j), c = idx(i, j + 1), d = idx(i + 1, j + 1);
          facesTopo.push(a, c, b, b, c, d);
          facesFundo.push(a, b, c, b, d, c); // fundo com winding invertido (normal pra baixo)
        }
      }
      if (!facesTopo.length) return;

      const geoTopo = new THREE_.BufferGeometry();
      geoTopo.setAttribute('position', new THREE_.Float32BufferAttribute(posTopo, 3));
      geoTopo.setAttribute('color', new THREE_.Float32BufferAttribute(corTopo, 3));
      geoTopo.setIndex(facesTopo);
      geoTopo.computeVertexNormals();
      const matTopo = new THREE_.MeshStandardMaterial({ vertexColors: true, side: THREE_.DoubleSide, flatShading: true, roughness: 0.85, metalness: 0.05 });
      group.add(new THREE_.Mesh(geoTopo, matTopo));

      // Fundo SÓLIDO (não mais translúcido) na cota final DESTA área — cada
      // área tem seu próprio nível de fundo. Se uma área é mais funda que a
      // vizinha, o fundo forma um DEGRAU real entre elas — não tem como (nem
      // deveria) ficar tudo liso numa profundidade só, como o Milton apontou.
      const geoFundo = new THREE_.BufferGeometry();
      geoFundo.setAttribute('position', new THREE_.Float32BufferAttribute(posFundo, 3));
      geoFundo.setIndex(facesFundo);
      geoFundo.computeVertexNormals();
      const matFundo = new THREE_.MeshStandardMaterial({ color: 0xd97706, side: THREE_.DoubleSide, roughness: 0.9 });
      group.add(new THREE_.Mesh(geoFundo, matFundo));

      // Paredes sólidas seguindo o CONTORNO REAL da malha — fecha o vão entre
      // topo e fundo em toda borda de verdade (inclusive em reentrâncias tipo
      // L), não só num retângulo. Uma aresta de célula vira parede quando a
      // célula do lado de dentro existe mas a vizinha do outro lado não.
      const quadExiste = [];
      for (let j = 0; j < g.ny - 1; j++) {
        const linha = [];
        for (let i = 0; i < g.nx - 1; i++) linha.push(g.grid[j][i].dentro && g.grid[j][i + 1].dentro && g.grid[j + 1][i].dentro && g.grid[j + 1][i + 1].dentro);
        quadExiste.push(linha);
      }
      const posParede = [], facesParede = [];
      function addParede(pA, pB) {
        const cotaA = _ajustarConvencaoEscalar(pA.cota, g.cotaFinal).cota;
        const cotaB = _ajustarConvencaoEscalar(pB.cota, g.cotaFinal).cota;
        const cf = _ajustarConvencaoEscalar(pA.cota, g.cotaFinal).cotaFinal; // mesma pra qualquer ponto desta área
        const base = posParede.length / 3;
        posParede.push(
          (pA.x - cx) * escalaXZ, (cotaA - cy) * escalaY, (pA.y - cz) * escalaXZ,
          (pB.x - cx) * escalaXZ, (cotaB - cy) * escalaY, (pB.y - cz) * escalaXZ,
          (pA.x - cx) * escalaXZ, (cf - cy) * escalaY, (pA.y - cz) * escalaXZ,
          (pB.x - cx) * escalaXZ, (cf - cy) * escalaY, (pB.y - cz) * escalaXZ,
        );
        facesParede.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
      }
      for (let j = 0; j < g.ny - 1; j++) {
        for (let i = 0; i < g.nx - 1; i++) {
          if (!quadExiste[j][i]) continue;
          if (i === 0 || !quadExiste[j][i - 1]) addParede(g.grid[j][i], g.grid[j + 1][i]);
          if (i === g.nx - 2 || !quadExiste[j][i + 1]) addParede(g.grid[j][i + 1], g.grid[j + 1][i + 1]);
          if (j === 0 || !quadExiste[j - 1][i]) addParede(g.grid[j][i], g.grid[j][i + 1]);
          if (j === g.ny - 2 || !quadExiste[j + 1][i]) addParede(g.grid[j + 1][i], g.grid[j + 1][i + 1]);
        }
      }
      if (facesParede.length) {
        const geoParede = new THREE_.BufferGeometry();
        geoParede.setAttribute('position', new THREE_.Float32BufferAttribute(posParede, 3));
        geoParede.setIndex(facesParede);
        geoParede.computeVertexNormals();
        const matParede = new THREE_.MeshStandardMaterial({ color: 0x8b7355, side: THREE_.DoubleSide, roughness: 0.95 });
        group.add(new THREE_.Mesh(geoParede, matParede));
      }
    });

    scene.add(group);
    scene.add(new THREE_.AmbientLight(0xffffff, 0.55));
    const dirLight = new THREE_.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(60, 100, 80);
    scene.add(dirLight);
    const dirLight2 = new THREE_.DirectionalLight(0x88aaff, 0.3);
    dirLight2.position.set(-60, 40, -80);
    scene.add(dirLight2);

    return scene;
  }

  function _posicionarCamera(camera, rotY, rotX, dist) {
    camera.position.set(
      dist * Math.sin(rotY) * Math.cos(rotX),
      dist * Math.sin(rotX) * -1 + 20,
      dist * Math.cos(rotY) * Math.cos(rotX)
    );
    camera.lookAt(0, 0, 0);
  }

  const CAM_PADRAO = { rotY: -0.7, rotX: -0.85, dist: 160 };
  function _montarCena() {
    const container = document.getElementById('tp-3d-container');
    if (!container) return;
    const scene = _construirCena3D();
    const THREE_ = window.THREE;

    const W = container.clientWidth || 600, H = container.clientHeight || 400;
    const camera = new THREE_.PerspectiveCamera(45, W / H, 0.1, 2000);
    const renderer = new THREE_.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    container.appendChild(renderer.domElement);

    let rotY = CAM_PADRAO.rotY, rotX = CAM_PADRAO.rotX, dist = CAM_PADRAO.dist;
    let dragging = false, lastX = 0, lastY = 0;
    const atualizarCamera = () => _posicionarCamera(camera, rotY, rotX, dist);
    atualizarCamera();

    const onDown = ev => { dragging = true; lastX = ev.clientX; lastY = ev.clientY; };
    const onMove = ev => {
      if (!dragging) return;
      rotY += (ev.clientX - lastX) * 0.008;
      rotX = Math.max(-1.55, Math.min(1.55, rotX + (ev.clientY - lastY) * 0.008));
      lastX = ev.clientX; lastY = ev.clientY;
      atualizarCamera();
    };
    const onUp = () => { dragging = false; };
    const onWheel = ev => { ev.preventDefault(); dist = Math.max(30, Math.min(400, dist + ev.deltaY * 0.15)); atualizarCamera(); };
    container.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    container.addEventListener('wheel', onWheel, { passive: false });

    function loop() {
      _3d.raf = requestAnimationFrame(loop);
      renderer.render(scene, camera);
    }
    _3d = {
      renderer, scene, camera, container, onDown, onMove, onUp, onWheel, raf: 0,
      resetar: () => { rotY = CAM_PADRAO.rotY; rotX = CAM_PADRAO.rotX; dist = CAM_PADRAO.dist; atualizarCamera(); },
      verDeCima: () => { rotX = -1.5; atualizarCamera(); }, // quase -90° — câmera acima olhando pra baixo, pra comparar direto com a planta
    };
    loop();

    const legenda = document.getElementById('tp-3d-legenda');
    if (legenda) {
      legenda.innerHTML = `Grade de alturas — todas as áreas · 🟩 corte raso → 🟥 corte fundo · 🟧 cota de referência · ⚠️ profundidade exagerada visualmente (planta é fiel, altura não)`;
    }
  }
  function resetarCamera3D() { if (_3d && _3d.resetar) _3d.resetar(); }
  function verDeCima3D() { if (_3d && _3d.verDeCima) _3d.verDeCima(); }

  // Snapshot do 3D pra imagem (usado no PDF) — renderer offscreen, 1 frame.
  function _snapshot3D(w, h) {
    const scene = _construirCena3D();
    if (!scene) return null;
    const THREE_ = window.THREE;
    const camera = new THREE_.PerspectiveCamera(45, w / h, 0.1, 2000);
    _posicionarCamera(camera, CAM_PADRAO.rotY, CAM_PADRAO.rotX, CAM_PADRAO.dist);
    const renderer = new THREE_.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(w, h);
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/jpeg', 0.85);
    renderer.dispose();
    return url;
  }

  // ══════════════════════════════════════════
  // LIMPAR BASE — apaga TODAS as seções (horizontais e verticais), o
  // projeto (imagem) e a calibração de escala desta obra. Caminhões e
  // config de empolamento/capacidades ficam. Exige a permissão dedicada
  // "limpar" (levantamentoTerra:limpar) + confirmação dupla digitada.
  // ══════════════════════════════════════════
  async function limparBase() {
    if (!Permissions.pode('levantamentoTerra', 'limpar')) { Utils.toast('Sem permissão para limpar a base.', 'erro'); return; }
    const totalSec = (secoes.horizontal || []).length + (secoes.vertical || []).length;
    const ok1 = await Utils.confirmar(`⚠️ Isso vai APAGAR TODAS as ${totalSec} seções (horizontais e verticais), o projeto inserido e a escala calibrada desta obra. Essa ação NÃO pode ser desfeita. Continuar?`);
    if (!ok1) return;
    const palavra = prompt('Pra confirmar, digite LIMPAR (em maiúsculas):');
    if (palavra !== 'LIMPAR') { Utils.toast('Confirmação incorreta — nada foi apagado.', 'alerta'); return; }
    Utils.mostrarLoading('Limpando base do levantamento...');
    try {
      secoes = { horizontal: [], vertical: [] };
      await db.collection('obras').doc(obraId).collection('config').doc(DOC_SECOES).set(secoes, { merge: false });
      try { await db.collection('obras').doc(obraId).collection('config').doc(DOC_PROJETO_IMG).delete(); } catch (e) {}
      config.temImagemProjeto = false; config.imgW = 0; config.imgH = 0; config.escalaPxPorMetro = 0;
      imagemProjetoCache = null;
      secAberta = null; calibrando = false; calibPontoTemp = null;
      await salvarConfig();
      Utils.toast('✓ Base do levantamento limpa.', 'sucesso');
      renderizar();
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao limpar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ══════════════════════════════════════════
  // RELATÓRIO PDF DO LEVANTAMENTO — volumes, projeto com as seções
  // marcadas, snapshot 3D e tabelas de seções. Baixa direto ou
  // compartilha (WhatsApp no menu nativo do celular).
  // ══════════════════════════════════════════

  // Desenha o projeto + linhas/pontos das seções num canvas e devolve dataURL
  function _projetoMarcadoDataURL() {
    if (!config.temImagemProjeto || !imagemProjetoCache) return null;
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        const g = canvas.getContext('2d');
        g.drawImage(img, 0, 0);
        const areas = config.areas || [];
        areas.forEach((a, ai) => {
          const cor = _corSecao(ai);
          g.beginPath();
          a.pontos.forEach((p, pi) => { const x = p.x * canvas.width, y = p.y * canvas.height; pi === 0 ? g.moveTo(x, y) : g.lineTo(x, y); });
          g.closePath();
          g.globalAlpha = 0.18; g.fillStyle = cor; g.fill(); g.globalAlpha = 1;
          g.strokeStyle = cor; g.lineWidth = Math.max(2, canvas.width / 400); g.stroke();
          const raio = Math.max(6, canvas.width / 180);
          (config.pontosCota || []).filter(p => p.areaId === a.id).forEach(p => {
            const x = p.x * canvas.width, y = p.y * canvas.height;
            g.beginPath(); g.arc(x, y, raio, 0, Math.PI * 2); g.fillStyle = cor; g.fill();
            g.strokeStyle = '#fff'; g.lineWidth = Math.max(1.5, raio / 4); g.stroke();
          });
          const p0 = a.pontos[0];
          g.font = `bold ${Math.round(raio * 1.6)}px sans-serif`;
          g.fillStyle = cor; g.strokeStyle = '#fff'; g.lineWidth = Math.max(2, raio / 3);
          g.textAlign = 'center'; g.textBaseline = 'middle';
          const rot = `Área ${ai + 1} (cota ${TC.fmt2(a.cotaFinal)})`;
          const rx = p0.x * canvas.width, ry = Math.max(raio * 2, p0.y * canvas.height - raio * 2.2);
          g.strokeText(rot, rx, ry); g.fillText(rot, rx, ry);
        });
        resolve(TC.canvasParaDataURLLimitado(canvas, 1400000).url);
      };
      img.onerror = () => resolve(null);
      img.src = imagemProjetoCache;
    });
  }

  async function _gerarLevantamentoPdfBlob() {
    if (typeof window.jspdf === 'undefined') {
      await _ls('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      await _ls('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const PW = doc.internal.pageSize.getWidth();
    const k = kpisGerais();
    const obraNome = Router.getObra()?.nome || '';

    // Cabeçalho
    doc.setFillColor(13, 13, 13); doc.rect(0, 0, PW, 26, 'F');
    doc.setFillColor(245, 200, 0); doc.rect(0, 26, PW, 1.5, 'F');
    doc.setTextColor(255); doc.setFontSize(14); doc.setFont(undefined, 'bold');
    doc.text('Relatório de Terraplanagem — Levantamento', 12, 11);
    doc.setFontSize(9); doc.setFont(undefined, 'normal'); doc.setTextColor(245, 200, 0);
    doc.text(obraNome, 12, 18);
    doc.setTextColor(200);
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')} · Absoluta Engenharia`, 12, 23);
    let y = 34;

    // Cards de volume
    const cards = [
      { v: TC.fmt1(k.volH), l: 'VOL. HORIZONTAL (M³)' },
      { v: TC.fmt1(k.volV), l: 'VOL. VERTICAL (M³)' },
      { v: TC.fmt1(k.volMedio), l: 'VOL. MÉDIO BANCO (M³)' },
      { v: TC.fmt1(config.taxaEmpolamento * 100) + '%', l: 'EMPOLAMENTO' },
      { v: TC.fmt1(k.volEmpolado), l: 'A REMOVER (M³)' },
    ];
    const gap = 4, cw = (PW - 24 - gap * (cards.length - 1)) / cards.length, ch = 17;
    cards.forEach((card, i) => {
      const x = 12 + i * (cw + gap);
      doc.setFillColor(250, 250, 250); doc.setDrawColor(229, 229, 229);
      doc.roundedRect(x, y, cw, ch, 1.8, 1.8, 'FD');
      doc.setTextColor(13, 13, 13); doc.setFontSize(12); doc.setFont(undefined, 'bold');
      doc.text(card.v, x + cw / 2, y + 8, { align: 'center' });
      doc.setTextColor(120); doc.setFontSize(5.4); doc.setFont(undefined, 'normal');
      doc.text(card.l, x + cw / 2, y + 13.5, { align: 'center' });
    });
    y += ch + 8;

    // Projeto com as seções marcadas (modo visual)
    const imgProjeto = await _projetoMarcadoDataURL();
    if (imgProjeto && config.imgW > 0) {
      const propor = config.imgH / config.imgW;
      const larguraMax = PW - 24;
      let alturaMm = larguraMax * propor;
      let larguraMm = larguraMax;
      if (alturaMm > 150) { alturaMm = 150; larguraMm = alturaMm / propor; } // limita pra não comer a página toda
      if (y + alturaMm > 270) { doc.addPage(); y = 14; }
      doc.setTextColor(13, 13, 13); doc.setFontSize(9.5); doc.setFont(undefined, 'bold');
      doc.text('Projeto com as seções marcadas (verticais tracejadas)', 12, y + 3);
      y += 5;
      try { doc.addImage(imgProjeto, 'JPEG', 12 + (larguraMax - larguraMm) / 2, y, larguraMm, alturaMm, undefined, 'FAST'); y += alturaMm + 7; } catch (e) {}
    }

    // Snapshot 3D único (grade de alturas, todas as áreas juntas)
    try {
      if (typeof THREE === 'undefined') await _ls('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
      const snap = _snapshot3D(1100, 620);
      if (snap) {
        const larguraMm = PW - 24, alturaMm = larguraMm * (620 / 1100);
        if (y + alturaMm > 275) { doc.addPage(); y = 14; }
        doc.setTextColor(13, 13, 13); doc.setFontSize(9.5); doc.setFont(undefined, 'bold');
        doc.text('Corte de terra em 3D (verde = raso · vermelho = fundo · laranja = cota de referência)', 12, y + 3);
        y += 5;
        doc.addImage(snap, 'JPEG', 12, y, larguraMm, alturaMm, undefined, 'FAST');
        y += alturaMm + 7;
      }
    } catch (e) { console.error('snapshot 3D falhou', e); }

    // Tabelas de seções (uma por direção)
    for (const dir of ['horizontal', 'vertical']) {
      const lista = secoesComVolume(secoes[dir] || []);
      if (!lista.length) continue;
      const volDir = TC.calcVolumeTotalSecoes(secoes[dir] || []);
      if (y > 230) { doc.addPage(); y = 14; }
      doc.setTextColor(13, 13, 13); doc.setFontSize(9.5); doc.setFont(undefined, 'bold');
      doc.text(`Seções ${dir === 'horizontal' ? 'horizontais' : 'verticais'} — volume total ${TC.fmt1(volDir)} m³`, 12, y + 3);
      doc.autoTable({
        startY: y + 5,
        head: [['Seção', 'Área (m²)', 'Comprimento (m)', 'Dist. próxima (m)', 'Vol. entre (m³)']],
        body: lista.map((s, i) => [
          String(s.numero ?? i + 1), TC.fmt2(s.area), TC.fmt1(TC.calcComprimentoSecao(s.distanciasCotas || [])),
          (s.distanciaProxima !== '' && s.distanciaProxima != null) ? TC.fmt1(s.distanciaProxima) : '—',
          (s.distanciaProxima !== '' && s.distanciaProxima != null) ? TC.fmt1(s.volEntre) : '—',
        ]),
        margin: { left: 12, right: 12 },
        styles: { fontSize: 8, cellPadding: 1.8 },
        headStyles: { fillColor: [245, 200, 0], textColor: [13, 13, 13], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' } },
      });
      y = doc.lastAutoTable.finalY + 8;
    }

    return doc.output('blob');
  }

  function _nomeArquivoLev() {
    const nomeObra = (Router.getObra()?.nome || 'obra').replace(/[^a-z0-9]/gi, '_');
    return `Levantamento_Terraplanagem_${nomeObra}_${new Date().toISOString().slice(0, 10)}.pdf`;
  }

  async function baixarLevantamentoPDF() {
    Utils.mostrarLoading('Gerando PDF do levantamento...');
    try {
      if (config.temImagemProjeto && !imagemProjetoCache) await _garantirImagemProjetoCarregada();
      const blob = await _gerarLevantamentoPdfBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = _nomeArquivoLev();
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      Utils.toast('✓ PDF gerado!', 'sucesso');
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao gerar PDF: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  async function compartilharLevantamentoPDF() {
    Utils.mostrarLoading('Preparando PDF pra compartilhar...');
    try {
      if (config.temImagemProjeto && !imagemProjetoCache) await _garantirImagemProjetoCarregada();
      const blob = await _gerarLevantamentoPdfBlob();
      const nome = _nomeArquivoLev();
      const k = kpisGerais();
      let compartilhado = false;
      try {
        const file = new File([blob], nome, { type: 'application/pdf' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          Utils.esconderLoading();
          await navigator.share({
            files: [file], title: 'Levantamento de Terraplanagem',
            text: `📐 Levantamento de Terraplanagem — ${Router.getObra()?.nome || ''}\nVolume a remover: ${TC.fmt1(k.volEmpolado)} m³ (empolamento ${TC.fmt1(config.taxaEmpolamento * 100)}%)`,
          });
          compartilhado = true;
        }
      } catch (eShare) {
        if (eShare.name === 'AbortError') { Utils.esconderLoading(); return; }
      }
      if (!compartilhado) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = nome;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
        Utils.toast('Esse navegador não compartilha arquivo direto — o PDF foi baixado, é só anexar no WhatsApp.', 'info');
      }
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao gerar PDF: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  return {
    init, recarregar, renderizar,
    setSecDir, setModoLevantamento, secAdd, secRemover, secToggle,
    secUpd, secUpdCotas, secUpdCotaFinal, secUpdDistCotas, secUpdAreaManual, salvarSecoesBtn,
    escolherImagemProjeto, processarImagemProjeto, calibrarProjeto,
    setFerramenta, concluirArea, cancelarArea, removerArea, atualizarCotaArea, gerarSecoes,
    togglePontosCota, editarPontoCota, removerPontoCota,
    abrirConfig, salvarConfigBtn, aplicarPresetEmpolamento,
    adicionarTipoCaminhao, atualizarTipoCaminhao, removerTipoCaminhao,
    abrirCaminhoes, salvarCaminhao, excluirCaminhao,
    abrirVerSecoes, fecharVerSecoes, selecionarSecaoVisualizada,
    verSecZoomIn, verSecZoomOut, verSecZoomReset,
    projZoomIn, projZoomOut, projZoomReset,
    abrir3D, fechar3D, resetarCamera3D, verDeCima3D, limparBase,
    baixarLevantamentoPDF, compartilharLevantamentoPDF,
  };
})();

const TP_UI = LevantamentoTerraplanagem;

function onObraChanged() {
  LevantamentoTerraplanagem.recarregar();
}

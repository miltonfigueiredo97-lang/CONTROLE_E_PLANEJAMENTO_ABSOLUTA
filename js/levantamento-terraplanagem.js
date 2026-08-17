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

  function recalcArea(s) {
    if (s.areaManual !== '' && s.areaManual != null && !isNaN(parseFloat(s.areaManual))) {
      s.area = TC.num(s.areaManual);
      return;
    }
    s.area = TC.calcAreaSecao(s.cotas || [], s.cotaFinal || 0, s.distanciasCotas || []);
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
              : `<span style="font-family:var(--cv-mono);font-size:0.72rem;color:var(--cv-text3);">· fim desta área ·</span>`) : ''}
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
    if (modoPontos) _attachImgClickGlobal();
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
        <div style="border:1px solid var(--cv-border);border-radius:6px;overflow:hidden;position:relative;max-width:100%;">
          <img id="tp-img-projeto" src="${imagemProjetoCache}" style="width:100%;display:block;user-select:none;cursor:${ferramenta ? 'crosshair' : 'default'};" draggable="false">
          ${calibPontoTemp ? `<div style="position:absolute;left:${(calibPontoTemp.x * 100).toFixed(3)}%;top:${(calibPontoTemp.y * 100).toFixed(3)}%;transform:translate(-50%,-50%);width:14px;height:14px;border-radius:50%;background:#ef4444;box-shadow:0 0 0 2px #fff;pointer-events:none;"></div>` : ''}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;">
            ${areas.map((a, ai) => `<polygon points="${a.pontos.map(p => `${(p.x * 100).toFixed(3)},${(p.y * 100).toFixed(3)}`).join(' ')}" fill="${_corSecao(ai)}" fill-opacity="0.18" stroke="${_corSecao(ai)}" stroke-width="0.35" vector-effect="non-scaling-stroke"/>`).join('')}
            ${areaEmDesenho && areaEmDesenho.pontos.length ? `<polyline points="${areaEmDesenho.pontos.map(p => `${(p.x * 100).toFixed(3)},${(p.y * 100).toFixed(3)}`).join(' ')}" fill="none" stroke="#fff" stroke-width="0.4" stroke-dasharray="1.2,1" vector-effect="non-scaling-stroke"/>` : ''}
          </svg>
          ${areaEmDesenho ? areaEmDesenho.pontos.map(p => `<div style="position:absolute;left:${(p.x * 100).toFixed(3)}%;top:${(p.y * 100).toFixed(3)}%;transform:translate(-50%,-50%);width:8px;height:8px;border-radius:50%;background:#fff;box-shadow:0 0 0 1.5px #000;pointer-events:none;"></div>`).join('') : ''}
          ${pontosCota.map(p => {
            const ai = areas.findIndex(a => a.id === p.areaId);
            const cor = ai >= 0 ? _corSecao(ai) : '#999';
            return `<div style="position:absolute;left:${(p.x * 100).toFixed(3)}%;top:${(p.y * 100).toFixed(3)}%;transform:translate(-50%,-50%);width:9px;height:9px;border-radius:50%;background:${cor};box-shadow:0 0 0 1.5px #fff;pointer-events:none;" title="Cota ${TC.fmt2(p.cota)}"></div>`;
          }).join('')}
        </div>
        <p class="text-sm text-muted mt-1">${!calibrado ? 'Calibre a escala antes de desenhar áreas: clique em "🎯 Calibrar Escala" e depois em 2 pontos na imagem com distância real conhecida entre eles.' : ferramenta === 'area' ? 'Clique nos cantos da área (mínimo 3) e depois em "✓ Concluir Área" pra fechar e definir a cota final.' : ferramenta === 'cota' ? 'Clique dentro de uma área já desenhada pra marcar a cota do terreno naquele ponto.' : 'Desenhe uma ou mais áreas, marque as cotas do terreno dentro delas, e clique em "▦ Gerar Seções" — o sistema divide cada área numa grade de linhas de 1,5m e calcula a área/volume de cada uma automaticamente.'}</p>
        ${areas.length ? `
        <div class="cc-tableWrap" style="margin-top:8px;">
          <table class="cc-table">
            <thead><tr><th></th><th>Área</th><th class="col-num">Cota Final</th><th class="col-num">Pontos de Cota</th><th class="col-acoes"></th></tr></thead>
            <tbody>
              ${areas.map((a, ai) => `<tr>
                <td><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${_corSecao(ai)};"></span></td>
                <td>Área ${ai + 1}</td>
                <td class="col-num"><input type="text" inputmode="decimal" class="form-control" style="width:90px;display:inline-block;" value="${esc(a.cotaFinal)}" onchange="TP_UI.atualizarCotaArea('${a.id}', this.value)"></td>
                <td class="col-num cc-tdMono">${pontosCota.filter(p => p.areaId === a.id).length}</td>
                <td class="col-acoes"><button class="btn btn-secundario btn-sm" style="color:var(--cv-red);" onclick="TP_UI.removerArea('${a.id}')">🗑</button></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>` : ''}
      </div>
    `;
  }

  // ── Clique na imagem ÚNICA do projeto: calibrar, desenhar área ou marcar cota ──
  function _attachImgClickGlobal() {
    const img = document.getElementById('tp-img-projeto');
    if (!img) return;
    img.onclick = (evt) => {
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
        return;
      }
    };
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
  async function concluirArea() {
    if (!areaEmDesenho || areaEmDesenho.pontos.length < 3) { Utils.toast('Marque pelo menos 3 pontos pra formar a área.', 'alerta'); return; }
    const cotaStr = prompt('Cota Final (referência/projeto) desta área:', config.cotaReferencia || '');
    if (cotaStr === null) return;
    const cotaFinal = TC.num(cotaStr);
    config.areas = config.areas || [];
    config.areas.push({ id: TC.genId('area'), pontos: areaEmDesenho.pontos, cotaFinal });
    areaEmDesenho = null; ferramenta = null;
    Utils.mostrarLoading();
    try { await salvarConfig(); Utils.toast('✓ Área criada!', 'sucesso'); } finally { Utils.esconderLoading(); }
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
  function _gerarSecoesDaArea(area) {
    const PASSO_GRADE = 1.5, PASSO_AMOSTRA = 0.5;
    const pontosArea = (config.pontosCota || []).filter(p => p.areaId === area.id).map(p => ({ ..._paraMetros(p), cota: p.cota }));
    if (pontosArea.length < 3) return { horizontais: [], verticais: [] };

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

    function linhasNaDirecao(fixarX) {
      const linhas = [];
      const inicioFixo = fixarX ? minX : minY, fimFixo = fixarX ? maxX : maxY;
      const outroMin = fixarX ? minY : minX, outroMax = fixarX ? maxY : maxX;
      for (let v = inicioFixo; v <= fimFixo + 1e-6; v += PASSO_GRADE) {
        const amostras = [];
        for (let o = outroMin; o <= outroMax + 1e-6; o += PASSO_AMOSTRA) {
          const pt = fixarX ? { x: v, y: o } : { x: o, y: v };
          if (_pontoDentroPoligono(pt, poligonoM)) amostras.push({ o, cota: interpolarCota(pt.x, pt.y) });
        }
        if (amostras.length < 2) continue;
        const cotas = amostras.map(a2 => a2.cota);
        const distancias = [];
        for (let k = 0; k < amostras.length - 1; k++) distancias.push(+(amostras[k + 1].o - amostras[k].o).toFixed(3));
        const pInicioM = fixarX ? { x: v, y: amostras[0].o } : { x: amostras[0].o, y: v };
        const pFimM = fixarX ? { x: v, y: amostras[amostras.length - 1].o } : { x: amostras[amostras.length - 1].o, y: v };
        linhas.push({
          pos: v, cotas, distanciasCotas: distancias, cotaFinal: area.cotaFinal,
          area: TC.calcAreaSecao(cotas, area.cotaFinal, distancias),
          areaId: area.id, origemFrac: _paraFracao(pInicioM), fimFrac: _paraFracao(pFimM),
        });
      }
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
      let todasH = [], todasV = [];
      areas.forEach(area => {
        const { horizontais, verticais } = _gerarSecoesDaArea(area);
        todasH.push(...horizontais); todasV.push(...verticais);
      });
      if (!todasH.length && !todasV.length) {
        Utils.toast('Nenhuma seção gerada — confira se marcou pontos de cota suficientes (mínimo 3) dentro das áreas.', 'alerta');
        return;
      }
      todasH.sort((a, b) => a.pos - b.pos);
      todasV.sort((a, b) => a.pos - b.pos);
      // IMPORTANTE: seções de áreas DIFERENTES não são vizinhas de verdade —
      // zera a distância entre elas pra "volume entre seções" não somar um
      // volume fantasma ligando dois lugares sem relação (bug que também
      // deixava o 3D com formato errado, misturando sólidos de áreas distintas).
      const monta = linhas => linhas.map((l, i) => {
        const proximaMesmaArea = i < linhas.length - 1 && linhas[i + 1].areaId === l.areaId;
        return {
          id: TC.genId('sec'), numero: i + 1, cotas: l.cotas, distanciasCotas: l.distanciasCotas, cotaFinal: l.cotaFinal,
          area: l.area, distanciaProxima: proximaMesmaArea ? +(linhas[i + 1].pos - l.pos).toFixed(3) : '', areaManual: '',
          areaId: l.areaId, origemFrac: l.origemFrac, fimFrac: l.fimFrac,
        };
      });
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

  // Reamostra o perfil (distância acumulada x cota) de uma seção em N pontos
  // uniformes ao longo do comprimento total dela, via interpolação linear.
  function _reamostrarPerfil(distancias, cotas, n) {
    const acc = [0];
    for (let i = 0; i < distancias.length; i++) acc.push(acc[i] + TC.num(distancias[i]));
    const largura = acc[acc.length - 1] || 0;
    const out = [];
    for (let k = 0; k < n; k++) {
      const alvo = largura * (k / (n - 1));
      let seg = 0;
      while (seg < acc.length - 2 && acc[seg + 1] < alvo) seg++;
      const d0 = acc[seg], d1 = acc[seg + 1] ?? d0;
      const c0 = TC.num(cotas[seg]), c1 = TC.num(cotas[seg + 1] ?? cotas[seg]);
      const t = d1 > d0 ? (alvo - d0) / (d1 - d0) : 0;
      out.push({ x: alvo, cota: c0 + (c1 - c0) * t });
    }
    return out;
  }

  function _corProfundidade(prof, profMin, profMax) {
    const t = profMax > profMin ? Math.max(0, Math.min(1, (prof - profMin) / (profMax - profMin))) : 0;
    // raso (t=0) verde → fundo (t=1) vermelho
    const r = Math.round(34 + t * (220 - 34));
    const g = Math.round(160 - t * (160 - 38));
    const b = Math.round(70 - t * (70 - 38));
    return { r: r / 255, g: g / 255, b: b / 255 };
  }

  // ══════════════════════════════════════════
  // VER SEÇÕES — planta com todas as linhas desenhadas (clicáveis) +
  // perfil lateral (2D) da seção selecionada, mostrando o terreno x cota
  // final com trechos VERDES (corte, acima da referência) e VERMELHOS
  // (abaixo — é aí que a área de uma seção pode sair negativa).
  // ══════════════════════════════════════════
  let secaoVisualizada = 0;
  function abrirVerSecoes() {
    const lista = secoes[secDir] || [];
    if (!lista.length) { Utils.toast('Nenhuma seção nesta direção ainda.', 'alerta'); return; }
    secaoVisualizada = 0;
    renderVerSecoes();
    Utils.abrirModal('modal-tp-versecoes');
  }
  function fecharVerSecoes() { Utils.fecharModal('modal-tp-versecoes'); }
  function selecionarSecaoVisualizada(i) { secaoVisualizada = i; renderVerSecoes(); }

  function renderVerSecoes() {
    const el = document.getElementById('tp-versecoes-body');
    if (!el) return;
    const lista = secoesComVolume(secoes[secDir] || []);
    if (secaoVisualizada >= lista.length) secaoVisualizada = 0;
    const s = lista[secaoVisualizada];
    const temPlanta = config.temImagemProjeto && imagemProjetoCache;
    el.innerHTML = `
      <div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:12px;">
        ${temPlanta ? `
        <div style="flex:1 1 300px;min-width:260px;">
          <div style="border:1px solid var(--cv-border);border-radius:6px;overflow:hidden;position:relative;">
            <img src="${imagemProjetoCache}" style="width:100%;display:block;">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;">
              ${lista.map((sec, i) => sec.origemFrac && sec.fimFrac
                ? `<line x1="${(sec.origemFrac.x * 100).toFixed(2)}" y1="${(sec.origemFrac.y * 100).toFixed(2)}" x2="${(sec.fimFrac.x * 100).toFixed(2)}" y2="${(sec.fimFrac.y * 100).toFixed(2)}" stroke="${i === secaoVisualizada ? '#ffffff' : _corSecao(i)}" stroke-width="${i === secaoVisualizada ? 0.9 : 0.35}" vector-effect="non-scaling-stroke" style="cursor:pointer;pointer-events:auto;" onclick="TP_UI.selecionarSecaoVisualizada(${i})"/>`
                : '').join('')}
            </svg>
          </div>
          <p class="text-sm text-muted mt-1">Clique numa linha da planta pra ver o perfil dela.</p>
        </div>` : ''}
        <div style="flex:1 1 220px;min-width:200px;">
          <div class="cc-tableWrap" style="max-height:260px;overflow-y:auto;">
            <table class="cc-table">
              <thead><tr><th></th><th>#</th><th class="col-num">Área (m²)</th></tr></thead>
              <tbody>
                ${lista.map((sec, i) => `<tr style="cursor:pointer;${i === secaoVisualizada ? 'background:var(--cv-surface2);' : ''}" onclick="TP_UI.selecionarSecaoVisualizada(${i})">
                  <td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${_corSecao(i)};"></span></td>
                  <td class="cc-tdMono">${sec.numero ?? i + 1}</td>
                  <td class="col-num cc-tdMono" style="${sec.area < 0 ? 'color:var(--cv-red);font-weight:700;' : ''}">${TC.fmt2(sec.area)}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      ${s ? `
      <div style="font-family:var(--cv-mono);font-size:.85rem;margin-bottom:8px;">
        Seção ${s.numero ?? secaoVisualizada + 1} — Área: <b style="${s.area < 0 ? 'color:var(--cv-red);' : 'color:var(--cv-accent3);'}">${TC.fmt2(s.area)} m²</b>
        ${s.area < 0 ? ' ⚠️ negativa — tem trecho do terreno ABAIXO da cota final desta área (em vermelho no desenho)' : ''}
      </div>
      ${_svgPerfilLateral(s)}` : `<div class="cc-empty">Selecione uma seção.</div>`}
    `;
  }

  // Desenha o perfil 2D (lateral) de uma seção: linha do terreno, linha
  // pontilhada da cota final, e o preenchimento por trecho — verde onde o
  // terreno tá acima da referência (corte), vermelho onde tá abaixo
  // (contribui NEGATIVO pra área — é aqui que dá pra ver o porquê).
  function _svgPerfilLateral(s) {
    const cotas = (s.cotas || []).map(c => TC.num(c));
    const dist = s.distanciasCotas || [];
    const cf = TC.num(s.cotaFinal);
    if (cotas.length < 2) return `<div class="cc-empty">Esta seção não tem cotas suficientes pra desenhar o perfil.</div>`;
    const xs = [0];
    for (let i = 0; i < dist.length; i++) xs.push(xs[i] + TC.num(dist[i]));
    const minY = Math.min(...cotas, cf), maxY = Math.max(...cotas, cf);
    const pad = Math.max(0.3, (maxY - minY) * 0.15);
    const yLo = minY - pad, yHi = maxY + pad;
    const totalW = xs[xs.length - 1] || 1;
    const PX0 = 55, PX1 = 590, PY0 = 20, PY1 = 250;
    const mapX = x => PX0 + (x / totalW) * (PX1 - PX0);
    const mapY = y => yHi > yLo ? PY1 - ((y - yLo) / (yHi - yLo)) * (PY1 - PY0) : (PY0 + PY1) / 2;
    const quads = [];
    for (let i = 0; i < cotas.length - 1; i++) {
      const x1 = mapX(xs[i]), x2 = mapX(xs[i + 1]);
      const y1 = mapY(cotas[i]), y2 = mapY(cotas[i + 1]), yf = mapY(cf);
      const media = (cotas[i] + cotas[i + 1]) / 2;
      const cor = media >= cf ? '#22c55e' : '#ef4444';
      quads.push(`<polygon points="${x1},${y1} ${x2},${y2} ${x2},${yf} ${x1},${yf}" fill="${cor}" fill-opacity="0.4"/>`);
    }
    const linhaCf = `<line x1="${PX0}" y1="${mapY(cf).toFixed(1)}" x2="${PX1}" y2="${mapY(cf).toFixed(1)}" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="5,3"/>`;
    const linhaTerreno = `<polyline points="${cotas.map((c, i) => `${mapX(xs[i]).toFixed(1)},${mapY(c).toFixed(1)}`).join(' ')}" fill="none" stroke="#fff" stroke-width="2"/>`;
    const pontos = cotas.map((c, i) => `<circle cx="${mapX(xs[i]).toFixed(1)}" cy="${mapY(c).toFixed(1)}" r="3.5" fill="#3b82f6" stroke="#fff" stroke-width="1"/><text x="${mapX(xs[i]).toFixed(1)}" y="${(mapY(c) - 8).toFixed(1)}" font-size="9" fill="#fff" text-anchor="middle" font-family="monospace">${TC.fmt2(c)}</text>`).join('');
    const rotuloCf = `<text x="${PX0 + 4}" y="${(mapY(cf) - 5).toFixed(1)}" font-size="10" fill="#f59e0b" font-family="monospace">Cota Final: ${TC.fmt2(cf)}</text>`;
    return `<svg viewBox="0 0 620 270" style="width:100%;background:#14141f;border-radius:8px;display:block;">${quads.join('')}${linhaCf}${linhaTerreno}${pontos}${rotuloCf}</svg>`;
  }

  async function abrir3D() {
    const lista = (secoes[secDir] || []).filter(s => (s.cotas || []).length >= 2);
    if (lista.length < 1) { Utils.toast('Marque pelo menos uma seção com 2+ pontos pra gerar o 3D.', 'alerta'); return; }
    Utils.mostrarLoading('Montando visualização 3D...');
    try {
      if (typeof THREE === 'undefined') await _ls('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
      Utils.abrirModal('modal-tp-3d');
      await new Promise(r => setTimeout(r, 60)); // deixa o modal montar antes de medir o container
      _montarCena(lista);
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

  // Constrói cena Three.js do loft entre seções — usada tanto no modal
  // interativo quanto no snapshot pro PDF do relatório. Agrupa por área
  // (areaId) — nunca conecta o loft entre seções de áreas DIFERENTES,
  // cada área vira um sólido independente, lado a lado na cena.
  function _construirCena3D(lista) {
    const N = 22; // amostras por seção
    const GAP_ENTRE_AREAS = 3; // metros de respiro entre sólidos de áreas diferentes

    // Agrupa mantendo a ordem original, mas juntando todas as seções da mesma área
    const grupos = [];
    const porAreaId = new Map();
    lista.forEach(s => {
      const chave = s.areaId ?? '__sem_area__';
      if (!porAreaId.has(chave)) { const g = []; porAreaId.set(chave, g); grupos.push(g); }
      porAreaId.get(chave).push(s);
    });

    // Bounds globais (pra cor por profundidade e escala ficarem consistentes entre grupos)
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minProf = Infinity, maxProf = -Infinity, zTotal = 0;
    const dadosGrupos = grupos.map(secs => {
      const perfis = secs.map(s => _reamostrarPerfil(s.distanciasCotas || [], s.cotas || [], N));
      const cotasFinal = secs.map(s => TC.num(s.cotaFinal));
      const zAcumLocal = [0];
      for (let i = 0; i < secs.length - 1; i++) zAcumLocal.push(zAcumLocal[i] + (TC.num(secs[i].distanciaProxima) || 3));
      if (perfis.length === 1) { perfis.push(perfis[0]); cotasFinal.push(cotasFinal[0]); zAcumLocal.push(zAcumLocal[0] + 3); }
      perfis.forEach((p, si) => p.forEach(pt => {
        minX = Math.min(minX, pt.x); maxX = Math.max(maxX, pt.x);
        minY = Math.min(minY, pt.cota, cotasFinal[si]); maxY = Math.max(maxY, pt.cota, cotasFinal[si]);
        const prof = pt.cota - cotasFinal[si];
        minProf = Math.min(minProf, prof); maxProf = Math.max(maxProf, prof);
      }));
      const larguraGrupo = zAcumLocal[zAcumLocal.length - 1];
      const offsetZ = zTotal;
      zTotal += larguraGrupo + GAP_ENTRE_AREAS;
      return { perfis, cotasFinal, zAcum: zAcumLocal.map(z => z + offsetZ) };
    });
    zTotal -= GAP_ENTRE_AREAS; // não conta o respiro depois do último grupo

    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = zTotal / 2;
    const escala = 100 / Math.max(maxX - minX, maxY - minY, zTotal || 1, 1); // normaliza pra caber numa cena ~100 unidades

    const THREE_ = window.THREE;
    const scene = new THREE_.Scene();
    scene.background = new THREE_.Color(0x14141f);
    const group = new THREE_.Group();

    dadosGrupos.forEach(({ perfis, cotasFinal, zAcum }) => {
      const posTopo = [], corTopo = [], posFundo = [];
      perfis.forEach((p, si) => p.forEach(pt => {
        posTopo.push((pt.x - cx) * escala, (pt.cota - cy) * escala, (zAcum[si] - cz) * escala);
        posFundo.push((pt.x - cx) * escala, (cotasFinal[si] - cy) * escala, (zAcum[si] - cz) * escala);
        const c = _corProfundidade(pt.cota - cotasFinal[si], minProf, maxProf);
        corTopo.push(c.r, c.g, c.b);
      }));

      const idx = (si, pi) => si * N + pi;
      const facesTopo = [], facesFundo = [];
      for (let si = 0; si < perfis.length - 1; si++) {
        for (let pi = 0; pi < N - 1; pi++) {
          const a = idx(si, pi), b = idx(si, pi + 1), c = idx(si + 1, pi), d = idx(si + 1, pi + 1);
          facesTopo.push(a, c, b, b, c, d);
          facesFundo.push(a, b, c, b, d, c); // fundo com winding invertido (normal pra baixo)
        }
      }

      const geoTopo = new THREE_.BufferGeometry();
      geoTopo.setAttribute('position', new THREE_.Float32BufferAttribute(posTopo, 3));
      geoTopo.setAttribute('color', new THREE_.Float32BufferAttribute(corTopo, 3));
      geoTopo.setIndex(facesTopo);
      geoTopo.computeVertexNormals();
      const matTopo = new THREE_.MeshStandardMaterial({ vertexColors: true, side: THREE_.DoubleSide, flatShading: true, roughness: 0.85, metalness: 0.05 });
      group.add(new THREE_.Mesh(geoTopo, matTopo));

      const geoFundo = new THREE_.BufferGeometry();
      geoFundo.setAttribute('position', new THREE_.Float32BufferAttribute(posFundo, 3));
      geoFundo.setIndex(perfis.length > 1 ? facesFundo : []);
      geoFundo.computeVertexNormals();
      const matFundo = new THREE_.MeshStandardMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.35, side: THREE_.DoubleSide, roughness: 0.9 });
      if (perfis.length > 1) group.add(new THREE_.Mesh(geoFundo, matFundo));

      // Paredes de fechamento nas duas pontas do grupo — mostra a face do corte
      [0, perfis.length - 1].forEach(si => {
        const posParede = [];
        for (let pi = 0; pi < N; pi++) {
          posParede.push((perfis[si][pi].x - cx) * escala, (perfis[si][pi].cota - cy) * escala, (zAcum[si] - cz) * escala);
          posParede.push((perfis[si][pi].x - cx) * escala, (cotasFinal[si] - cy) * escala, (zAcum[si] - cz) * escala);
        }
        const facesParede = [];
        for (let pi = 0; pi < N - 1; pi++) {
          const a = pi * 2, b = pi * 2 + 1, c = (pi + 1) * 2, d = (pi + 1) * 2 + 1;
          facesParede.push(a, c, b, b, c, d);
        }
        const geoParede = new THREE_.BufferGeometry();
        geoParede.setAttribute('position', new THREE_.Float32BufferAttribute(posParede, 3));
        geoParede.setIndex(facesParede);
        geoParede.computeVertexNormals();
        const matParede = new THREE_.MeshStandardMaterial({ color: 0x8b7355, side: THREE_.DoubleSide, roughness: 0.95 });
        group.add(new THREE_.Mesh(geoParede, matParede));
      });
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

  function _montarCena(lista) {
    const container = document.getElementById('tp-3d-container');
    if (!container) return;
    const scene = _construirCena3D(lista);
    const THREE_ = window.THREE;

    const W = container.clientWidth || 600, H = container.clientHeight || 400;
    const camera = new THREE_.PerspectiveCamera(45, W / H, 0.1, 2000);
    const renderer = new THREE_.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    container.appendChild(renderer.domElement);

    let rotY = -0.7, rotX = -0.35, dist = 130;
    let dragging = false, lastX = 0, lastY = 0;
    const atualizarCamera = () => _posicionarCamera(camera, rotY, rotX, dist);
    atualizarCamera();

    const onDown = ev => { dragging = true; lastX = ev.clientX; lastY = ev.clientY; };
    const onMove = ev => {
      if (!dragging) return;
      rotY += (ev.clientX - lastX) * 0.008;
      rotX = Math.max(-1.3, Math.min(1.3, rotX + (ev.clientY - lastY) * 0.008));
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
    _3d = { renderer, scene, camera, container, onDown, onMove, onUp, onWheel, raf: 0 };
    loop();

    const legenda = document.getElementById('tp-3d-legenda');
    if (legenda) {
      legenda.innerHTML = `${lista.length} seção${lista.length !== 1 ? 'ões' : ''} (${secDir}) · 🟩 corte raso → 🟥 corte fundo · 🟧 cota de referência`;
    }
  }

  // Snapshot do 3D pra imagem (usado no PDF) — renderer offscreen, 1 frame.
  function _snapshot3D(lista, w, h) {
    const scene = _construirCena3D(lista);
    const THREE_ = window.THREE;
    const camera = new THREE_.PerspectiveCamera(45, w / h, 0.1, 2000);
    _posicionarCamera(camera, -0.7, -0.35, 130);
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

    // Snapshots 3D (horizontal e vertical, se tiverem seções com 2+ pontos)
    for (const dir of ['horizontal', 'vertical']) {
      const lista = (secoes[dir] || []).filter(s => (s.cotas || []).length >= 2);
      if (!lista.length) continue;
      try {
        if (typeof THREE === 'undefined') await _ls('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
        const snap = _snapshot3D(lista, 1100, 620);
        const larguraMm = PW - 24, alturaMm = larguraMm * (620 / 1100);
        if (y + alturaMm > 275) { doc.addPage(); y = 14; }
        doc.setTextColor(13, 13, 13); doc.setFontSize(9.5); doc.setFont(undefined, 'bold');
        doc.text(`Corte de terra em 3D — seções ${dir === 'horizontal' ? 'horizontais' : 'verticais'} (verde = raso · vermelho = fundo · laranja = cota de referência)`, 12, y + 3);
        y += 5;
        doc.addImage(snap, 'JPEG', 12, y, larguraMm, alturaMm, undefined, 'FAST');
        y += alturaMm + 7;
      } catch (e) { console.error('snapshot 3D falhou', e); }
    }

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
    abrirConfig, salvarConfigBtn, aplicarPresetEmpolamento,
    adicionarTipoCaminhao, atualizarTipoCaminhao, removerTipoCaminhao,
    abrirCaminhoes, salvarCaminhao, excluirCaminhao,
    abrirVerSecoes, fecharVerSecoes, selecionarSecaoVisualizada,
    abrir3D, fechar3D, limparBase,
    baixarLevantamentoPDF, compartilharLevantamentoPDF,
  };
})();

const TP_UI = LevantamentoTerraplanagem;

function onObraChanged() {
  LevantamentoTerraplanagem.recarregar();
}

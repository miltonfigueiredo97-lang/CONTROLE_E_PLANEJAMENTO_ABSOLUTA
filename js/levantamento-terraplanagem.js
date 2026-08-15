// ============================================
// Módulo: Levantamento de Terraplanagem
// Calculadora de corte de terra (método das seções
// transversais), configuração de empolamento e
// cadastro de caminhões — quantitativo/planejamento.
// A execução (viagens/remoções e progresso) fica em
// Controle de Terraplanagem.
// Dados: Firestore obras/{obraId}/terra*
// ============================================

const LevantamentoTerraplanagem = (() => {
  const TC = TerraplanagemCalculos;
  const COL_CAMINHOES = 'terraCaminhoes';
  const DOC_CONFIG = 'terraplanagem';
  const DOC_SECOES = 'terraplanagemSecoes';

  let obraId = null;
  let caminhoes = [];
  let config = { taxaEmpolamento: 0.3, capacidadeGrande: 15.6, capacidadePequena: 10, cotaReferencia: '' };
  let secoes = { horizontal: [], vertical: [] };

  let secDir = 'horizontal';
  let secAberta = null;

  // Modo visual ("Marcar no Projeto"): imagens ficam em docs separados
  // (config/terraSecaoImg_{id}), fora do doc principal de seções, pra não
  // estourar o limite de ~1MB do documento Firestore. imagensCache guarda
  // o base64 já buscado, em memória, por id de seção.
  let imagensCache = {};
  let calibrando = null;       // índice da seção em modo calibração (aguardando cliques)
  let calibPontoTemp = null;   // 1º ponto clicado da calibração, aguardando o 2º
  let pdfjsCarregado = false;

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
      renderizar();
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
  }
  async function carregarSecoes() {
    try {
      const doc = await db.collection('obras').doc(obraId).collection('config').doc(DOC_SECOES).get();
      if (doc.exists) {
        const d = doc.data();
        secoes = { horizontal: d.horizontal || [], vertical: d.vertical || [] };
      }
    } catch (e) { /* mantém default */ }
    // Compatibilidade: seções salvas antes do modo visual não têm id/modo — preenche em memória
    ['horizontal', 'vertical'].forEach(dir => {
      (secoes[dir] || []).forEach(s => {
        if (!s.id) s.id = TC.genId('sec');
        if (!s.modo) s.modo = 'manual';
      });
    });
  }
  async function salvarConfig() {
    if(!Permissions.pode('levantamentoTerra','editar'))return;
    await db.collection('obras').doc(obraId).collection('config').doc(DOC_CONFIG).set(config, { merge: true });
  }
  async function salvarSecoes() {
    if(!Permissions.pode('levantamentoTerra','criar')&&!Permissions.pode('levantamentoTerra','editar'))return;
    await db.collection('obras').doc(obraId).collection('config').doc(DOC_SECOES).set(secoes, { merge: false });
  }

  async function recarregar() {
    obraId = Router.getObraId();
    if (!obraId) return;
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
          <button class="btn btn-primario btn-sm" onclick="TP_UI.abrirCaminhoes()">🚚 Caminhões</button>
        </div>
      </div>

      <div class="cc-kpiGrid" style="grid-template-columns:repeat(3,1fr);">
        <div class="cc-kpi"><div class="cc-kpiIcon">📐</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Vol. Médio (banco)</div><div class="cc-kpiValue">${TC.fmt1(k.volMedio)}<span class="cc-kpiUnit">m³</span></div><div class="cc-kpiSub">Horiz: ${TC.fmt1(k.volH)} · Vert: ${TC.fmt1(k.volV)}</div></div></div>
        <div class="cc-kpi cc-kpiOrange"><div class="cc-kpiIcon">📦</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Vol. c/ Empolamento (a remover)</div><div class="cc-kpiValue">${TC.fmt1(k.volEmpolado)}<span class="cc-kpiUnit">m³</span></div><div class="cc-kpiSub">taxa ${TC.fmt1(config.taxaEmpolamento * 100)}%</div></div></div>
        <div class="cc-kpi cc-kpiBlue"><div class="cc-kpiIcon">🚚</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Caminhões cadastrados</div><div class="cc-kpiValue">${caminhoes.length}</div></div></div>
      </div>

      <div class="cc-panel">
        <div class="cc-panelTitle">📐 Calculadora de Corte de Terra <span style="font-family:var(--cv-mono);font-size:10px;color:var(--cv-text3);font-weight:400;text-transform:none;letter-spacing:0;">método das seções transversais</span></div>
        <div class="aba-toggle" style="margin-bottom:14px;">
          <button class="aba-btn ${secDir === 'horizontal' ? 'ativo' : ''}" onclick="TP_UI.setSecDir('horizontal')">Seções Horizontais</button>
          <button class="aba-btn ${secDir === 'vertical' ? 'ativo' : ''}" onclick="TP_UI.setSecDir('vertical')">Seções Verticais</button>
        </div>
        <div id="tp-secoes"></div>
      </div>
      </div>
    `;
    renderSecoes();
  }

  // ══════════════════════════════════════════
  // CALCULADORA DE CORTE DE TERRA (seções)
  // ══════════════════════════════════════════
  function setSecDir(dir) { secDir = dir; secAberta = null; renderSecoes(); }

  function renderSecoes() {
    const el = document.getElementById('tp-secoes');
    if (!el) return;
    (secoes[secDir] || []).forEach(recalcArea);
    const lista = secoesComVolume(secoes[secDir] || []);
    const volTotal = TC.calcVolumeTotalSecoes(secoes[secDir] || []);

    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
        <span style="font-family:var(--cv-mono);font-size:0.85rem;font-weight:700;color:var(--cv-accent3);">Volume total ${secDir}: ${TC.fmt1(volTotal)} m³</span>
        <button class="btn btn-secundario btn-sm" onclick="TP_UI.secAdd()">+ Nova Seção</button>
      </div>
      ${!lista.length ? `<div class="cc-empty">Nenhuma seção cadastrada. Clique em "+ Nova Seção" para começar.</div>` :
      lista.map((s, i) => `
        <div style="border:1px solid var(--cv-border);margin-bottom:8px;">
          <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--cv-surface2);cursor:pointer;" onclick="TP_UI.secToggle(${i})">
            <span style="font-weight:700;font-size:0.85rem;color:var(--cv-accent3);min-width:70px;">Seção ${s.numero ?? i + 1}</span>
            <span style="font-family:var(--cv-mono);font-size:0.78rem;color:var(--cv-text2);">Área: ${TC.fmt2(s.area)} m²</span>
            ${i < lista.length - 1 ? `<span style="font-family:var(--cv-mono);font-size:0.78rem;color:var(--cv-text2);">Dist. próxima: ${TC.fmt1(s.distanciaProxima)} m</span>
              <span style="font-family:var(--cv-mono);font-size:0.78rem;color:var(--cv-accent3);font-weight:700;">Vol. entre: ${TC.fmt1(s.volEntre)} m³</span>` : ''}
            <span style="margin-left:auto;color:var(--cv-text3);">${secAberta === i ? '▲' : '▼'}</span>
            <button class="btn btn-secundario btn-sm" style="color:var(--cv-red);" onclick="event.stopPropagation();TP_UI.secRemover(${i})">🗑</button>
          </div>
          ${secAberta === i ? `
          <div style="padding:14px;">
            <div class="form-row">
              <div class="form-grupo"><label>Nº da Seção</label><input type="text" class="form-control" value="${esc(s.numero ?? i + 1)}" oninput="TP_UI.secUpd(${i}, 'numero', this.value)"></div>
              <div class="form-grupo"><label>Distância até a próxima seção (m)</label><input type="text" inputmode="decimal" class="form-control" value="${esc(s.distanciaProxima ?? '')}" placeholder="15" oninput="TP_UI.secUpd(${i}, 'distanciaProxima', this.value)"></div>
            </div>
            <div class="aba-toggle" style="margin-bottom:12px;">
              <button class="aba-btn ${s.modo !== 'pontos' ? 'ativo' : ''}" onclick="TP_UI.secSetModo(${i}, 'manual')">✍️ Digitar Manualmente</button>
              <button class="aba-btn ${s.modo === 'pontos' ? 'ativo' : ''}" onclick="TP_UI.secSetModo(${i}, 'pontos')">🖼️ Marcar no Projeto</button>
            </div>
            ${s.modo === 'pontos' ? _painelPontosHTML(i, s) : _painelManualHTML(i, s)}
            <div style="font-family:var(--cv-mono);font-size:0.8rem;color:var(--cv-text2);margin-top:8px;">Área calculada: <b style="color:var(--cv-accent3);">${TC.fmt2(s.area)} m²</b> · Comprimento: <b>${TC.fmt1(TC.calcComprimentoSecao(s.distanciasCotas || []))} m</b></div>
            <p class="text-sm text-muted mt-1">Se preferir, pode digitar a área diretamente:</p>
            <div class="form-grupo"><label>Área manual (m²) — sobrepõe qualquer cálculo acima</label><input type="text" inputmode="decimal" class="form-control" value="${esc(s.areaManual ?? '')}" placeholder="deixe em branco para usar o cálculo acima" oninput="TP_UI.secUpdAreaManual(${i}, this.value)"></div>
          </div>` : ''}
        </div>`).join('')}
      ${lista.length ? `<div style="text-align:right;margin-top:8px;"><button class="btn btn-secundario btn-sm" onclick="TP_UI.salvarSecoesBtn()">💾 Salvar Seções</button></div>` : ''}
    `;
    if (secAberta !== null) _attachImgClick(secAberta);
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

  // ── Painel modo VISUAL ("Marcar no Projeto") ──
  function _painelPontosHTML(i, s) {
    if (!s.temImagem) {
      return `<div class="cc-empty" style="margin-bottom:10px;">Nenhum projeto (planta/imagem) inserido nesta seção ainda.</div>
        <button class="btn btn-primario btn-sm" onclick="TP_UI.secEscolherImagem(${i})">📎 Inserir Projeto (imagem ou PDF)</button>`;
    }
    const imgUrl = imagensCache[s.id];
    if (!imgUrl) {
      return `<div class="cc-empty" style="margin-bottom:10px;">⏳ Carregando projeto...</div>`;
    }
    const calibrado = s.escalaPxPorMetro > 0;
    const pontos = s.pontos || [];
    return `
      <div class="form-grupo"><label>Cota de Referência desta seção (opcional — em branco usa a padrão da obra${config.cotaReferencia ? ': ' + esc(config.cotaReferencia) : ''})</label><input type="text" inputmode="decimal" class="form-control" value="${esc(s.cotaFinalOverride ?? '')}" placeholder="ex: 93.40" oninput="TP_UI.secUpdCotaFinalOverride(${i}, this.value)"></div>
      ${!(s.cotaFinalOverride !== '' && s.cotaFinalOverride != null) && !config.cotaReferencia ? `<p class="text-sm" style="color:var(--cv-red);margin-top:-6px;">⚠️ Nenhuma cota de referência definida (nem aqui, nem em ⚙️ Config) — a área está sendo calculada com cota 0, provavelmente errada.</p>` : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px;">
        ${!calibrado
          ? `<button class="btn ${calibrando === i ? 'btn-primario' : 'btn-secundario'} btn-sm" onclick="TP_UI.secCalibrar(${i})">${calibrando === i ? (calibPontoTemp ? '🎯 Clique no 2º ponto de referência...' : '🎯 Clique no 1º ponto de referência...') : '🎯 Calibrar Escala'}</button>`
          : `<span style="font-family:var(--cv-mono);font-size:.75rem;color:var(--cv-text2);">📏 Escala: ${TC.fmt1(s.escalaPxPorMetro)} px/m</span>
             <button class="btn btn-secundario btn-sm" onclick="TP_UI.secCalibrar(${i})">🔁 Recalibrar</button>`}
        <button class="btn btn-secundario btn-sm" onclick="TP_UI.secEscolherImagem(${i})">🖼️ Trocar Imagem</button>
      </div>
      <div style="border:1px solid var(--cv-border);border-radius:6px;overflow:hidden;position:relative;max-width:640px;">
        <img id="tp-img-${i}" src="${imgUrl}" style="width:100%;display:block;user-select:none;cursor:crosshair;" draggable="false">
        ${calibPontoTemp && calibrando === i ? `<div style="position:absolute;left:${(calibPontoTemp.x * 100).toFixed(3)}%;top:${(calibPontoTemp.y * 100).toFixed(3)}%;transform:translate(-50%,-50%);width:14px;height:14px;border-radius:50%;background:#ef4444;box-shadow:0 0 0 2px #fff;pointer-events:none;"></div>` : ''}
        ${pontos.map((p, pi) => `<div style="position:absolute;left:${(p.x * 100).toFixed(3)}%;top:${(p.y * 100).toFixed(3)}%;transform:translate(-50%,-50%);width:20px;height:20px;border-radius:50%;background:var(--cv-accent3,#f59e0b);color:#000;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;font-family:var(--cv-mono);pointer-events:none;box-shadow:0 0 0 2px #fff;">${pi + 1}</div>`).join('')}
      </div>
      <p class="text-sm text-muted mt-1">${calibrado ? 'Clique na imagem pra marcar um novo ponto e informar a cota.' : 'Calibre a escala antes de marcar pontos: clique em "🎯 Calibrar Escala" e depois em 2 pontos na imagem com distância real conhecida entre eles.'}</p>
      ${pontos.length ? `
      <div class="cc-tableWrap" style="margin-top:8px;max-height:220px;overflow-y:auto;">
        <table class="cc-table">
          <thead><tr><th>#</th><th class="col-num">Cota</th><th class="col-num">Dist. anterior (m)</th><th class="col-acoes"></th></tr></thead>
          <tbody>
            ${pontos.map((p, pi) => {
              const distAnt = pi > 0 ? TC.fmt1(TC.distanciaMetros(pontos[pi - 1], p, s.imgW, s.imgH, s.escalaPxPorMetro)) : '—';
              return `<tr>
                <td class="cc-tdMono">${pi + 1}</td>
                <td class="col-num cc-tdMono" style="cursor:pointer;" onclick="TP_UI.secEditarCota(${i},${pi})" title="Clique para editar">${TC.fmt2(p.cota)}</td>
                <td class="col-num cc-tdMono">${distAnt}</td>
                <td class="col-acoes" style="display:flex;gap:4px;justify-content:flex-end;">
                  ${pi > 0 ? `<button class="btn btn-secundario btn-sm" onclick="TP_UI.secMoverPonto(${i},${pi},-1)" title="Mover pra cima">▲</button>` : ''}
                  ${pi < pontos.length - 1 ? `<button class="btn btn-secundario btn-sm" onclick="TP_UI.secMoverPonto(${i},${pi},1)" title="Mover pra baixo">▼</button>` : ''}
                  <button class="btn btn-secundario btn-sm" style="color:var(--cv-red);" onclick="TP_UI.secRemoverPonto(${i},${pi})">🗑</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>` : ''}
    `;
  }

  // ── Clique na imagem: calibrar escala (2 cliques) ou marcar ponto+cota ──
  function _attachImgClick(i) {
    const s = secoes[secDir][i];
    if (!s || s.modo !== 'pontos') return;
    const img = document.getElementById('tp-img-' + i);
    if (!img) return;
    img.onclick = (evt) => {
      const p = TC.posRelativa(evt, img);
      if (calibrando === i) {
        if (!calibPontoTemp) { calibPontoTemp = p; renderSecoes(); return; }
        const distStr = prompt('Distância real entre os dois pontos clicados (metros):');
        const distM = TC.num(distStr);
        if (!(distM > 0)) {
          Utils.toast('Calibração cancelada — informe uma distância válida.', 'alerta');
          calibrando = null; calibPontoTemp = null; renderSecoes(); return;
        }
        const distPx = Math.hypot((p.x - calibPontoTemp.x) * s.imgW, (p.y - calibPontoTemp.y) * s.imgH);
        s.escalaPxPorMetro = distPx / distM;
        calibrando = null; calibPontoTemp = null;
        recalcArea(s);
        Utils.toast('✓ Escala calibrada!', 'sucesso');
        renderSecoes();
        return;
      }
      if (!(s.escalaPxPorMetro > 0)) { Utils.toast('Calibre a escala antes de marcar pontos.', 'alerta'); return; }
      const cotaStr = prompt('Cota (elevação) deste ponto:');
      if (cotaStr === null || cotaStr.trim() === '') return;
      s.pontos = s.pontos || [];
      s.pontos.push({ x: p.x, y: p.y, cota: TC.num(cotaStr) });
      recalcArea(s);
      renderSecoes();
    };
  }

  function secAdd() {
    const lista = secoes[secDir];
    lista.push({
      id: TC.genId('sec'), numero: lista.length + 1, modo: 'manual',
      cotas: [], cotaFinal: '', distanciasCotas: [], area: 0, distanciaProxima: '',
      temImagem: false, imgW: 0, imgH: 0, escalaPxPorMetro: 0, pontos: [], cotaFinalOverride: '',
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
    if (secAberta !== null) _garantirImagemCarregada(secAberta);
  }

  function recalcArea(s) {
    if (s.areaManual !== '' && s.areaManual != null && !isNaN(parseFloat(s.areaManual))) {
      s.area = TC.num(s.areaManual);
      return;
    }
    if (s.modo === 'pontos') {
      const cotaFinal = (s.cotaFinalOverride !== '' && s.cotaFinalOverride != null)
        ? TC.num(s.cotaFinalOverride) : TC.num(config.cotaReferencia);
      const pontos = s.pontos || [];
      const cotas = pontos.map(p => p.cota);
      const distancias = [];
      for (let k = 0; k < pontos.length - 1; k++) {
        distancias.push(TC.distanciaMetros(pontos[k], pontos[k + 1], s.imgW, s.imgH, s.escalaPxPorMetro));
      }
      s.cotas = cotas; s.distanciasCotas = distancias; s.cotaFinal = cotaFinal;
      s.area = TC.calcAreaSecao(cotas, cotaFinal, distancias);
    } else {
      s.area = TC.calcAreaSecao(s.cotas || [], s.cotaFinal || 0, s.distanciasCotas || []);
    }
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

  // ══════════════════════════════════════════
  // MODO VISUAL — troca de modo, cota override
  // ══════════════════════════════════════════
  function secSetModo(i, modo) {
    const s = secoes[secDir][i];
    s.modo = modo;
    recalcArea(s);
    renderSecoes();
    if (modo === 'pontos') _garantirImagemCarregada(i);
  }
  function secUpdCotaFinalOverride(i, valor) {
    const s = secoes[secDir][i];
    s.cotaFinalOverride = valor;
    recalcArea(s);
    renderSecoes();
  }

  // ══════════════════════════════════════════
  // MODO VISUAL — imagem/PDF do projeto (armazenada à parte, fora do doc
  // principal de seções, pra não estourar limite de tamanho do Firestore)
  // ══════════════════════════════════════════
  function _ls(src) { return new Promise((r, j) => { const s = document.createElement('script'); s.src = src; s.onload = r; s.onerror = j; document.head.appendChild(s); }); }
  async function _carregarPdfjs() {
    if (pdfjsCarregado || typeof pdfjsLib !== 'undefined') { pdfjsCarregado = true; return; }
    await _ls('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    pdfjsCarregado = true;
  }
  async function _carregarImagemSecao(s) {
    if (imagensCache[s.id]) return imagensCache[s.id];
    if (!s.temImagem) return null;
    try {
      const doc = await db.collection('obras').doc(obraId).collection('config').doc('terraSecaoImg_' + s.id).get();
      const url = doc.exists ? (doc.data().img || null) : null;
      if (url) imagensCache[s.id] = url;
      return url;
    } catch (e) { return null; }
  }
  function _garantirImagemCarregada(i) {
    const s = secoes[secDir][i];
    if (s && s.modo === 'pontos' && s.temImagem && !imagensCache[s.id]) {
      _carregarImagemSecao(s).then(url => { if (url && secAberta === i) renderSecoes(); });
    }
  }

  function secEscolherImagem(i) {
    if (!Permissions.pode('levantamentoTerra', 'criar') && !Permissions.pode('levantamentoTerra', 'editar')) { Utils.toast('Sem permissão.', 'erro'); return; }
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.pdf,image/*';
    inp.onchange = e => secProcessarImagem(i, e.target.files[0]);
    inp.click();
  }

  async function secProcessarImagem(i, file) {
    if (!file) return;
    const s = secoes[secDir][i];
    if (!s.id) s.id = TC.genId('sec');
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
      await db.collection('obras').doc(obraId).collection('config').doc('terraSecaoImg_' + s.id).set({ img: url });
      imagensCache[s.id] = url;
      s.temImagem = true; s.imgW = width; s.imgH = height;
      // Nova imagem invalida calibração/pontos anteriores (referem-se à imagem antiga)
      s.escalaPxPorMetro = 0; s.pontos = [];
      recalcArea(s);
      await salvarSecoes(); // persiste já — evita perder o upload se a sessão cair antes do "Salvar Seções"
      Utils.toast('✓ Projeto inserido! Agora calibre a escala.', 'sucesso');
      renderSecoes();
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao processar arquivo: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ══════════════════════════════════════════
  // MODO VISUAL — calibração de escala e marcação de pontos
  // ══════════════════════════════════════════
  function secCalibrar(i) {
    calibrando = calibrando === i ? null : i;
    calibPontoTemp = null;
    renderSecoes();
  }
  function secEditarCota(i, pi) {
    const s = secoes[secDir][i];
    const atual = s.pontos[pi].cota;
    const novo = prompt('Nova cota para o ponto ' + (pi + 1) + ':', atual);
    if (novo === null) return;
    s.pontos[pi].cota = TC.num(novo);
    recalcArea(s);
    renderSecoes();
  }
  function secRemoverPonto(i, pi) {
    const s = secoes[secDir][i];
    s.pontos.splice(pi, 1);
    recalcArea(s);
    renderSecoes();
  }
  function secMoverPonto(i, pi, dir) {
    const s = secoes[secDir][i];
    const novoIdx = pi + dir;
    if (novoIdx < 0 || novoIdx >= s.pontos.length) return;
    [s.pontos[pi], s.pontos[novoIdx]] = [s.pontos[novoIdx], s.pontos[pi]];
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
      <div class="form-row">
        <div class="form-grupo"><label>Capacidade Caminhão Grande (m³)</label><input type="text" inputmode="decimal" id="tp-cfg-grande" class="form-control" value="${esc(config.capacidadeGrande)}" placeholder="15.6"></div>
        <div class="form-grupo"><label>Capacidade Caminhão Pequeno (m³)</label><input type="text" inputmode="decimal" id="tp-cfg-pequeno" class="form-control" value="${esc(config.capacidadePequena)}" placeholder="10"></div>
      </div>
      <p class="text-sm text-muted">A taxa de empolamento converte o volume de banco (corte) para o volume solto transportado pelos caminhões.</p>
    `;
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
    config.capacidadeGrande = TC.num(document.getElementById('tp-cfg-grande').value) || 15.6;
    config.capacidadePequena = TC.num(document.getElementById('tp-cfg-pequeno').value) || 10;
    config.cotaReferencia = document.getElementById('tp-cfg-cotaref').value.trim();
    Utils.mostrarLoading();
    try {
      await salvarConfig();
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
        <div class="form-grupo"><label>Tamanho</label><select id="tp-cam-tamanho" class="form-control">${TC.TAMANHOS_CAMINHAO.map(t => `<option value="${t}">${t}</option>`).join('')}</select></div>
      </div>
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

  return {
    init, recarregar, renderizar,
    setSecDir, secAdd, secRemover, secToggle, secUpd, secUpdCotas, secUpdCotaFinal, secUpdDistCotas, secUpdAreaManual, salvarSecoesBtn,
    secSetModo, secUpdCotaFinalOverride, secEscolherImagem, secProcessarImagem, secCalibrar, secEditarCota, secRemoverPonto, secMoverPonto,
    abrirConfig, salvarConfigBtn, aplicarPresetEmpolamento,
    abrirCaminhoes, salvarCaminhao, excluirCaminhao,
  };
})();

const TP_UI = LevantamentoTerraplanagem;

function onObraChanged() {
  LevantamentoTerraplanagem.recarregar();
}

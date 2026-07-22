// ============================================
// Módulo: Levantamento de Terraplanagem
// Calculadora de corte de terra (método das seções
// transversais), cadastro de caminhões e registro de
// entregas/remoções (curva de acumulado).
// Port das abas "Calculadora de Corte de Terra",
// "Dados dos Caminhões" e "Preenchimento de Caminhões"
// do Obra Essence V9.6.6.
// Dados: Firestore obras/{obraId}/terra*
// ============================================

const LevantamentoTerraplanagem = (() => {
  const TC = TerraplanagemCalculos;
  const COL_CAMINHOES = 'terraCaminhoes';
  const COL_ENTREGAS = 'terraEntregas';
  const DOC_CONFIG = 'terraplanagem';
  const DOC_SECOES = 'terraplanagemSecoes';

  let obraId = null;
  let caminhoes = [];
  let entregas = [];
  let config = { taxaEmpolamento: 0.3, capacidadeGrande: 15.6, capacidadePequena: 10 };
  let secoes = { horizontal: [], vertical: [] };

  let fBuscaEntrega = '';
  let secDir = 'horizontal'; // aba ativa da calculadora: horizontal | vertical
  let secAberta = null; // índice da seção com o sub-form de cotas aberto

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
      const [cs, es] = await Promise.all([
        Database.listar(obraId, COL_CAMINHOES, null),
        Database.listar(obraId, COL_ENTREGAS, null),
      ]);
      caminhoes = cs; entregas = es;
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
  }
  async function salvarConfig() {
    await db.collection('obras').doc(obraId).collection('config').doc(DOC_CONFIG).set(config, { merge: true });
  }
  async function salvarSecoes() {
    await db.collection('obras').doc(obraId).collection('config').doc(DOC_SECOES).set(secoes, { merge: false });
  }

  async function recarregar() {
    obraId = Router.getObraId();
    if (!obraId) return;
    fBuscaEntrega = '';
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
      const distProx = i < lista.length - 1 ? TC.num(s.distanciaProxima) : 0;
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
    const volRemovido = entregas.reduce((s, e) => s + TC.num(e.volume), 0);
    const pct = volEmpolado > 0 ? Math.min(100, (volRemovido / volEmpolado) * 100) : 0;
    return { volH, volV, volMedio, volEmpolado, volRemovido, pct };
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
          <span class="subtitulo">Corte de terra por seções transversais, caminhões e remoção acumulada</span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-secundario btn-sm" onclick="TP_UI.abrirConfig()">⚙️ Config</button>
          <button class="btn btn-secundario btn-sm" onclick="TP_UI.abrirCaminhoes()">🚚 Caminhões</button>
          <button class="btn btn-primario btn-sm" onclick="TP_UI.abrirEntrega()">+ Registrar Viagem</button>
        </div>
      </div>

      <div class="cc-kpiGrid" style="grid-template-columns:repeat(5,1fr);">
        <div class="cc-kpi"><div class="cc-kpiIcon">📐</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Vol. Médio (banco)</div><div class="cc-kpiValue">${TC.fmt1(k.volMedio)}<span class="cc-kpiUnit">m³</span></div><div class="cc-kpiSub">Horiz: ${TC.fmt1(k.volH)} · Vert: ${TC.fmt1(k.volV)}</div></div></div>
        <div class="cc-kpi cc-kpiOrange"><div class="cc-kpiIcon">📦</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Vol. c/ Empolamento</div><div class="cc-kpiValue">${TC.fmt1(k.volEmpolado)}<span class="cc-kpiUnit">m³</span></div><div class="cc-kpiSub">taxa ${TC.fmt1(config.taxaEmpolamento * 100)}%</div></div></div>
        <div class="cc-kpi cc-kpiGreen"><div class="cc-kpiIcon">✅</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Já Removido</div><div class="cc-kpiValue">${TC.fmt1(k.volRemovido)}<span class="cc-kpiUnit">m³</span></div><div class="cc-kpiSub">${TC.fmt1(k.pct)}% concluído</div></div></div>
        <div class="cc-kpi cc-kpiBlue"><div class="cc-kpiIcon">🚚</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Caminhões</div><div class="cc-kpiValue">${caminhoes.length}</div></div></div>
        <div class="cc-kpi cc-kpiPurple"><div class="cc-kpiIcon">📋</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Viagens Registradas</div><div class="cc-kpiValue">${entregas.length}</div></div></div>
      </div>

      <div class="cc-panel">
        <div class="cc-panelTitle">📐 Calculadora de Corte de Terra <span style="font-family:var(--cv-mono);font-size:10px;color:var(--cv-text3);font-weight:400;text-transform:none;letter-spacing:0;">método das seções transversais</span></div>
        <div class="aba-toggle" style="margin-bottom:14px;">
          <button class="aba-btn ${secDir === 'horizontal' ? 'ativo' : ''}" onclick="TP_UI.setSecDir('horizontal')">Seções Horizontais</button>
          <button class="aba-btn ${secDir === 'vertical' ? 'ativo' : ''}" onclick="TP_UI.setSecDir('vertical')">Seções Verticais</button>
        </div>
        <div id="tp-secoes"></div>
      </div>

      <div class="cc-panel">
        <div class="cc-panelTitle">📋 Viagens / Remoções <span style="font-family:var(--cv-mono);font-size:10px;color:var(--cv-text3);font-weight:400;text-transform:none;letter-spacing:0;">acumulado ${TC.fmt1(k.pct)}%</span></div>
        <input type="text" class="form-control" id="tp-busca-entrega" placeholder="🔍 Buscar por placa ou material..." style="margin-bottom:12px;" value="${esc(fBuscaEntrega)}" oninput="TP_UI.onFiltroEntrega()">
        <div id="tp-tabela-entregas"></div>
      </div>
      </div>
    `;
    renderSecoes();
    renderTabelaEntregas();
  }

  // ══════════════════════════════════════════
  // CALCULADORA DE CORTE DE TERRA (seções)
  // ══════════════════════════════════════════
  function setSecDir(dir) { secDir = dir; secAberta = null; renderSecoes(); }

  function renderSecoes() {
    const el = document.getElementById('tp-secoes');
    if (!el) return;
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
            <p class="text-sm text-muted mb-1">Cotas de nivelamento (separadas por vírgula ou espaço) e a cota final de referência (projeto):</p>
            <div class="form-grupo"><label>Cotas (ex: 99.72, 99.31, 99, 98.65...)</label><textarea class="form-control" rows="2" oninput="TP_UI.secUpdCotas(${i}, this.value)">${esc((s.cotas || []).join(', '))}</textarea></div>
            <div class="form-row">
              <div class="form-grupo"><label>Cota Final (projeto)</label><input type="text" inputmode="decimal" class="form-control" value="${esc(s.cotaFinal ?? '')}" placeholder="93.4" oninput="TP_UI.secUpdCotaFinal(${i}, this.value)"></div>
              <div class="form-grupo"><label>Distâncias entre cotas (ex: 8.71, 5.14...)</label><input type="text" class="form-control" value="${esc((s.distanciasCotas || []).join(', '))}" oninput="TP_UI.secUpdDistCotas(${i}, this.value)"></div>
            </div>
            <div style="font-family:var(--cv-mono);font-size:0.8rem;color:var(--cv-text2);">Área calculada: <b style="color:var(--cv-accent3);">${TC.fmt2(s.area)} m²</b> · Comprimento: <b>${TC.fmt1(TC.calcComprimentoSecao(s.distanciasCotas || []))} m</b></div>
            <p class="text-sm text-muted mt-1">Se preferir, pode digitar a área diretamente:</p>
            <div class="form-grupo"><label>Área manual (m²) — sobrepõe o cálculo por cotas</label><input type="text" inputmode="decimal" class="form-control" value="${esc(s.areaManual ?? '')}" placeholder="deixe em branco para usar o cálculo acima" oninput="TP_UI.secUpdAreaManual(${i}, this.value)"></div>
          </div>` : ''}
        </div>`).join('')}
      ${lista.length ? `<div style="text-align:right;margin-top:8px;"><button class="btn btn-secundario btn-sm" onclick="TP_UI.salvarSecoesBtn()">💾 Salvar Seções</button></div>` : ''}
    `;
  }

  function secAdd() {
    const lista = secoes[secDir];
    lista.push({ numero: lista.length + 1, cotas: [], cotaFinal: '', distanciasCotas: [], area: 0, distanciaProxima: '' });
    secAberta = lista.length - 1;
    renderSecoes();
  }
  function secRemover(i) {
    secoes[secDir].splice(i, 1);
    if (secAberta === i) secAberta = null;
    renderSecoes();
  }
  function secToggle(i) { secAberta = secAberta === i ? null : i; renderSecoes(); }

  function recalcArea(s) {
    if (s.areaManual !== '' && s.areaManual != null && !isNaN(parseFloat(s.areaManual))) {
      s.area = TC.num(s.areaManual);
    } else {
      s.area = TC.calcAreaSecao(s.cotas || [], s.cotaFinal || 0, s.distanciasCotas || []);
    }
  }

  function secUpd(i, campo, valor) { secoes[secDir][i][campo] = valor; renderSecoes(); }
  function secUpdCotas(i, valor) {
    const s = secoes[secDir][i];
    s.cotas = TC.parseLista(valor);
    recalcArea(s);
    atualizarAreaLive(i);
  }
  function secUpdCotaFinal(i, valor) {
    const s = secoes[secDir][i];
    s.cotaFinal = valor;
    recalcArea(s);
    atualizarAreaLive(i);
  }
  function secUpdDistCotas(i, valor) {
    const s = secoes[secDir][i];
    s.distanciasCotas = TC.parseLista(valor);
    recalcArea(s);
    atualizarAreaLive(i);
  }
  function secUpdAreaManual(i, valor) {
    const s = secoes[secDir][i];
    s.areaManual = valor;
    recalcArea(s);
    atualizarAreaLive(i);
  }
  // Atualização leve: reflete a área/volume só quando o sub-form está aberto (sem perder foco no textarea)
  function atualizarAreaLive(i) {
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
      <div class="form-grupo"><label>Taxa de Empolamento (%)</label><input type="text" inputmode="decimal" id="tp-cfg-empolamento" class="form-control" value="${esc((config.taxaEmpolamento * 100).toString())}" placeholder="30"></div>
      <div class="form-row">
        <div class="form-grupo"><label>Capacidade Caminhão Grande (m³)</label><input type="text" inputmode="decimal" id="tp-cfg-grande" class="form-control" value="${esc(config.capacidadeGrande)}" placeholder="15.6"></div>
        <div class="form-grupo"><label>Capacidade Caminhão Pequeno (m³)</label><input type="text" inputmode="decimal" id="tp-cfg-pequeno" class="form-control" value="${esc(config.capacidadePequena)}" placeholder="10"></div>
      </div>
      <p class="text-sm text-muted">A taxa de empolamento converte o volume de banco (corte) para o volume solto transportado pelos caminhões.</p>
    `;
  }
  async function salvarConfigBtn() {
    const empolPct = TC.num(document.getElementById('tp-cfg-empolamento').value);
    config.taxaEmpolamento = empolPct / 100;
    config.capacidadeGrande = TC.num(document.getElementById('tp-cfg-grande').value) || 15.6;
    config.capacidadePequena = TC.num(document.getElementById('tp-cfg-pequeno').value) || 10;
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
        <button class="btn btn-primario btn-sm" style="height:38px;" onclick="TP_UI.salvarCaminhao()">+ Adicionar</button>
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
                <td class="col-acoes"><button class="btn btn-secundario btn-sm" style="color:var(--cv-red);" onclick="TP_UI.excluirCaminhao('${c.id}')">🗑</button></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`}`;
  }
  async function salvarCaminhao() {
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
  // ENTREGAS / REMOÇÕES (viagens de caminhão)
  // ══════════════════════════════════════════
  function abrirEntrega() {
    renderFormEntrega();
    Utils.abrirModal('modal-tp-entrega');
  }
  function renderFormEntrega() {
    const el = document.getElementById('tp-entrega-form');
    if (!el) return;
    el.innerHTML = `
      <div class="form-row">
        <div class="form-grupo"><label>Data</label><input type="date" id="tp-ent-data" class="form-control" value="${esc(Utils.hoje())}"></div>
        <div class="form-grupo"><label>Placa</label>
          <select id="tp-ent-placa" class="form-control">
            <option value="">— selecione ou digite abaixo —</option>
            ${caminhoes.map(c => `<option value="${esc(c.placa)}">${esc(c.placa)} (${esc(c.tamanho)})</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-grupo"><label>Material</label><input type="text" id="tp-ent-material" class="form-control" placeholder="Terra / Aterro"></div>
        <div class="form-grupo"><label>Tipo</label><input type="text" id="tp-ent-tipo" class="form-control" placeholder="Remoção / Entrega"></div>
      </div>
      <div class="form-row">
        <div class="form-grupo"><label>Fornecedor</label><input type="text" id="tp-ent-fornecedor" class="form-control" placeholder="opcional"></div>
        <div class="form-grupo"><label>Volume (m³)</label><input type="text" inputmode="decimal" id="tp-ent-volume" class="form-control" placeholder="15.6" onchange="TP_UI.autoVolumePorPlaca()"></div>
      </div>
      <button class="btn btn-primario" onclick="TP_UI.salvarEntrega()">+ Registrar Viagem</button>
    `;
  }
  function autoVolumePorPlaca() {
    // Preenche o volume automaticamente com a capacidade padrão do caminhão selecionado, se o campo estiver vazio
    const placaSel = document.getElementById('tp-ent-placa').value;
    const volEl = document.getElementById('tp-ent-volume');
    if (volEl.value) return;
    const cam = caminhoes.find(c => c.placa === placaSel);
    if (cam) volEl.value = cam.tamanho === 'Grande' ? config.capacidadeGrande : config.capacidadePequena;
  }
  async function salvarEntrega() {
    const data = document.getElementById('tp-ent-data').value;
    const placaSel = document.getElementById('tp-ent-placa').value;
    const material = document.getElementById('tp-ent-material').value.trim();
    const tipo = document.getElementById('tp-ent-tipo').value.trim();
    const fornecedor = document.getElementById('tp-ent-fornecedor').value.trim();
    const volume = TC.num(document.getElementById('tp-ent-volume').value);
    if (!data || !(volume > 0)) { Utils.toast('Informe data e volume maior que zero.', 'alerta'); return; }
    Utils.mostrarLoading();
    try {
      await Database.criar(obraId, COL_ENTREGAS, { data, placa: placaSel, material, tipo, fornecedor, volume }, TC.genId('ent'));
      Utils.toast('✓ Viagem registrada!', 'sucesso');
      Utils.fecharModal('modal-tp-entrega');
      await carregar();
    } catch (e) {
      Utils.toast('Erro: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }
  async function excluirEntrega(id) {
    const ok = await Utils.confirmar('Excluir este registro de viagem?');
    if (!ok) return;
    Utils.mostrarLoading();
    try {
      await Database.deletar(obraId, COL_ENTREGAS, id);
      await carregar();
    } catch (e) {
      Utils.toast('Erro: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  function onFiltroEntrega() {
    fBuscaEntrega = document.getElementById('tp-busca-entrega').value;
    renderTabelaEntregas();
  }

  function renderTabelaEntregas() {
    const el = document.getElementById('tp-tabela-entregas');
    if (!el) return;
    const busca = fBuscaEntrega.toLowerCase();
    const lista = [...entregas]
      .filter(e => !busca || (e.placa || '').toLowerCase().includes(busca) || (e.material || '').toLowerCase().includes(busca))
      .sort((a, b) => (b.data || '').localeCompare(a.data || '') || 0);

    if (!lista.length) {
      el.innerHTML = `<div class="cc-empty">🚚<br>Nenhuma viagem registrada ainda.</div>`;
      return;
    }
    // Acumulado — calculado em ordem cronológica ascendente
    const ordemAsc = [...lista].sort((a, b) => (a.data || '').localeCompare(b.data || ''));
    const totalGeral = ordemAsc.reduce((s, e) => s + TC.num(e.volume), 0);
    const acumuladoPorId = {};
    let acc = 0;
    ordemAsc.forEach(e => { acc += TC.num(e.volume); acumuladoPorId[e.id] = acc; });

    el.innerHTML = `
      <div class="cc-tableWrap" style="max-height:400px;overflow-y:auto;">
      <table class="cc-table">
        <thead><tr><th>Data</th><th>Placa</th><th>Material</th><th>Tipo</th><th class="col-num">Volume (m³)</th><th class="col-num">Acum. (m³)</th><th class="col-num">Acum. %</th><th class="col-acoes"></th></tr></thead>
        <tbody>
          ${lista.map(e => {
            const acum = acumuladoPorId[e.id] || 0;
            const pctAcum = totalGeral > 0 ? (acum / totalGeral) * 100 : 0;
            return `<tr>
              <td class="cc-tdMono">${esc(e.data)}</td>
              <td class="cc-tdMono" style="font-weight:700;">${esc(e.placa || '—')}</td>
              <td>${esc(e.material || '—')}</td>
              <td>${esc(e.tipo || '—')}</td>
              <td class="col-num cc-tdMono">${TC.fmt1(e.volume)}</td>
              <td class="col-num cc-tdMono">${TC.fmt1(acum)}</td>
              <td class="col-num cc-tdAccent" style="font-weight:700;">${TC.fmt1(pctAcum)}%</td>
              <td class="col-acoes"><button class="btn btn-secundario btn-sm" style="color:var(--cv-red);" onclick="TP_UI.excluirEntrega('${e.id}')">🗑</button></td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot><tr><td colspan="4" style="font-weight:700;">${lista.length} viagem${lista.length !== 1 ? 'ns' : ''}</td><td class="col-num cc-tdMono" style="font-weight:700;">${TC.fmt1(lista.reduce((s, e) => s + TC.num(e.volume), 0))}</td><td colspan="3"></td></tr></tfoot>
      </table>
      </div>`;
  }

  return {
    init, recarregar, renderizar,
    setSecDir, secAdd, secRemover, secToggle, secUpd, secUpdCotas, secUpdCotaFinal, secUpdDistCotas, secUpdAreaManual, salvarSecoesBtn,
    abrirConfig, salvarConfigBtn,
    abrirCaminhoes, salvarCaminhao, excluirCaminhao,
    abrirEntrega, autoVolumePorPlaca, salvarEntrega, excluirEntrega, onFiltroEntrega,
  };
})();

const TP_UI = LevantamentoTerraplanagem;

function onObraChanged() {
  LevantamentoTerraplanagem.recarregar();
}

// ============================================
// Módulo: Controle de Terraplanagem
// Registro de viagens/remoções de caminhão e
// acompanhamento do volume removido x previsto.
// O volume previsto (seções + empolamento) vem do
// Levantamento de Terraplanagem — aqui só se registra
// a EXECUÇÃO (viagens realizadas).
// Dados: Firestore obras/{obraId}/terra*
// ============================================

const ControleTerraplanagem = (() => {
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
  let fBusca = '';

  // ══════════════════════════════════════════
  // INIT / CARREGAMENTO
  // ══════════════════════════════════════════
  async function init() {
    const ok = await Utils.initPagina({ requireObra: true });
    if (!ok) return;
    obraId = Router.getObraId();
    if (!obraId) {
      document.getElementById('tpc-content').innerHTML =
        `<div class="estado-vazio"><div class="icone">✅</div><p>Selecione uma obra para acessar o controle de terraplanagem.</p></div>`;
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

  async function recarregar() {
    obraId = Router.getObraId();
    if (!obraId) return;
    fBusca = '';
    await carregar();
  }

  function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function kpisGerais() {
    const volH = TC.calcVolumeTotalSecoes(secoes.horizontal || []);
    const volV = TC.calcVolumeTotalSecoes(secoes.vertical || []);
    const volMedio = TC.calcVolumeMedio(volH, volV);
    const volEmpolado = TC.calcVolumeComEmpolamento(volMedio, config.taxaEmpolamento);
    const volRemovido = entregas.reduce((s, e) => s + TC.num(e.volume), 0);
    const pct = volEmpolado > 0 ? Math.min(100, (volRemovido / volEmpolado) * 100) : 0;
    return { volEmpolado, volRemovido, pct };
  }

  // ══════════════════════════════════════════
  // RENDER PRINCIPAL
  // ══════════════════════════════════════════
  function renderizar() {
    const c = document.getElementById('tpc-content');
    if (!c) return;
    const k = kpisGerais();

    c.innerHTML = `
      <div class="cc-view">
      <div class="page-header">
        <div>
          <h2>✅ Controle de Terraplanagem</h2>
          <span class="subtitulo">Viagens/remoções de caminhão e progresso do volume removido</span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <a class="btn btn-secundario btn-sm" href="levantamento-terraplanagem.html">🚚 Levantamento Terraplanagem</a>
          <button class="btn btn-primario btn-sm" onclick="TPC_UI.abrirEntrega()">+ Registrar Viagem</button>
        </div>
      </div>

      <div class="cc-kpiGrid" style="grid-template-columns:repeat(4,1fr);">
        <div class="cc-kpi cc-kpiOrange"><div class="cc-kpiIcon">📦</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Volume Previsto (a remover)</div><div class="cc-kpiValue">${TC.fmt1(k.volEmpolado)}<span class="cc-kpiUnit">m³</span></div></div></div>
        <div class="cc-kpi cc-kpiGreen"><div class="cc-kpiIcon">✅</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Já Removido</div><div class="cc-kpiValue">${TC.fmt1(k.volRemovido)}<span class="cc-kpiUnit">m³</span></div><div class="cc-kpiSub">${TC.fmt1(k.pct)}% concluído</div></div></div>
        <div class="cc-kpi cc-kpiBlue"><div class="cc-kpiIcon">🚚</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Caminhões</div><div class="cc-kpiValue">${caminhoes.length}</div></div></div>
        <div class="cc-kpi cc-kpiPurple"><div class="cc-kpiIcon">📋</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Viagens Registradas</div><div class="cc-kpiValue">${entregas.length}</div></div></div>
      </div>

      <div class="cc-panel">
        <div class="cc-panelTitle">📈 Progresso de Remoção</div>
        <div id="tpc-curva"></div>
      </div>

      <div class="cc-panel">
        <div class="cc-panelTitle">📋 Viagens / Remoções <span style="font-family:var(--cv-mono);font-size:10px;color:var(--cv-text3);font-weight:400;text-transform:none;letter-spacing:0;">acumulado ${TC.fmt1(k.pct)}%</span></div>
        <input type="text" class="form-control" id="tpc-busca" placeholder="🔍 Buscar por placa ou material..." style="margin-bottom:12px;" value="${esc(fBusca)}" oninput="TPC_UI.onFiltro()">
        <div id="tpc-tabela"></div>
      </div>
      </div>
    `;
    renderCurva(k.volEmpolado);
    renderTabela();
  }

  function onFiltro() {
    fBusca = document.getElementById('tpc-busca').value;
    renderTabela();
  }

  // ── Curva de progresso acumulado ──
  function renderCurva(volPrevisto) {
    const el = document.getElementById('tpc-curva');
    if (!el) return;
    if (!entregas.length) { el.innerHTML = `<div class="cc-empty">Nenhuma viagem registrada ainda.</div>`; return; }
    const ordemAsc = [...entregas].sort((a, b) => (a.data || '').localeCompare(b.data || ''));
    const porData = {};
    ordemAsc.forEach(e => { porData[e.data] = (porData[e.data] || 0) + TC.num(e.volume); });
    const datas = Object.keys(porData).sort();
    let acc = 0;
    const pontos = datas.map(d => { acc += porData[d]; return { data: d, acumulado: acc }; });
    const maxVal = Math.max(volPrevisto || 0, acc, 1);

    const w = 600, h = 180, padL = 54, padB = 26, padT = 14;
    const chartW = w - padL - 10, chartH = h - padT - padB;
    const pts = pontos.map((p, i) => {
      const x = padL + (pontos.length > 1 ? (i / (pontos.length - 1)) * chartW : 0);
      const y = padT + chartH - (p.acumulado / maxVal) * chartH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const yPrevisto = padT + chartH - ((volPrevisto || 0) / maxVal) * chartH;
    const grades = [0, 0.25, 0.5, 0.75, 1].map(g => {
      const y = padT + chartH - g * chartH;
      return `<line x1="${padL}" y1="${y}" x2="${w - 10}" y2="${y}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="${g === 0 ? '0' : '4,4'}"/>
        <text x="${padL - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="#94a3b8" font-family="JetBrains Mono,monospace">${TC.fmt1(g * maxVal)}</text>`;
    }).join('');
    const ultimo = pontos[pontos.length - 1];
    el.innerHTML = `
      <svg viewBox="0 0 ${w} ${h}" width="100%" style="max-width:${w}px;">
        ${grades}
        ${volPrevisto > 0 ? `<line x1="${padL}" y1="${yPrevisto}" x2="${w - 10}" y2="${yPrevisto}" stroke="#f97316" stroke-width="1.5" stroke-dasharray="6,3"/>
        <text x="${w - 12}" y="${yPrevisto - 4}" text-anchor="end" font-size="9" fill="#f97316" font-weight="bold">Previsto</text>` : ''}
        <polyline points="${pts}" fill="none" stroke="var(--cor-primaria)" stroke-width="2.5"/>
        <circle cx="${pts.split(' ').pop().split(',')[0]}" cy="${pts.split(' ').pop().split(',')[1]}" r="4" fill="var(--cor-primaria-dark,#b8960a)"/>
        <line x1="${padL}" y1="${padT + chartH}" x2="${w - 10}" y2="${padT + chartH}" stroke="#cbd5e1" stroke-width="1.5"/>
      </svg>
      <div style="font-family:var(--font-mono);font-size:0.78rem;color:var(--cor-texto-secundario);margin-top:6px;">
        Último registro: ${esc(ultimo.data)} · ${TC.fmt1(ultimo.acumulado)} m³ acumulados
      </div>`;
  }

  // ══════════════════════════════════════════
  // VIAGENS / ENTREGAS
  // ══════════════════════════════════════════
  function abrirEntrega() {
    renderFormEntrega();
    Utils.abrirModal('modal-tpc-entrega');
  }
  function renderFormEntrega() {
    const el = document.getElementById('tpc-entrega-form');
    if (!el) return;
    el.innerHTML = `
      <div class="form-row">
        <div class="form-grupo"><label>Data</label><input type="date" id="tpc-ent-data" class="form-control" value="${esc(Utils.hoje())}"></div>
        <div class="form-grupo"><label>Placa</label>
          <select id="tpc-ent-placa" class="form-control" onchange="TPC_UI.autoVolumePorPlaca()">
            <option value="">— selecione —</option>
            ${caminhoes.map(c => `<option value="${esc(c.placa)}">${esc(c.placa)} (${esc(c.tamanho)})</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-grupo"><label>Material</label><input type="text" id="tpc-ent-material" class="form-control" placeholder="Terra / Aterro"></div>
        <div class="form-grupo"><label>Tipo</label><input type="text" id="tpc-ent-tipo" class="form-control" placeholder="Remoção / Entrega"></div>
      </div>
      <div class="form-row">
        <div class="form-grupo"><label>Fornecedor</label><input type="text" id="tpc-ent-fornecedor" class="form-control" placeholder="opcional"></div>
        <div class="form-grupo"><label>Volume (m³)</label><input type="text" inputmode="decimal" id="tpc-ent-volume" class="form-control" placeholder="15.6"></div>
      </div>
      <button class="btn btn-primario" onclick="TPC_UI.salvarEntrega()">+ Registrar Viagem</button>
    `;
  }
  function autoVolumePorPlaca() {
    const placaSel = document.getElementById('tpc-ent-placa').value;
    const volEl = document.getElementById('tpc-ent-volume');
    if (volEl.value) return;
    const cam = caminhoes.find(c => c.placa === placaSel);
    if (cam) volEl.value = cam.tamanho === 'Grande' ? config.capacidadeGrande : config.capacidadePequena;
  }
  async function salvarEntrega() {
    const data = document.getElementById('tpc-ent-data').value;
    const placaSel = document.getElementById('tpc-ent-placa').value;
    const material = document.getElementById('tpc-ent-material').value.trim();
    const tipo = document.getElementById('tpc-ent-tipo').value.trim();
    const fornecedor = document.getElementById('tpc-ent-fornecedor').value.trim();
    const volume = TC.num(document.getElementById('tpc-ent-volume').value);
    if (!data || !(volume > 0)) { Utils.toast('Informe data e volume maior que zero.', 'alerta'); return; }
    Utils.mostrarLoading();
    try {
      await Database.criar(obraId, COL_ENTREGAS, { data, placa: placaSel, material, tipo, fornecedor, volume }, TC.genId('ent'));
      Utils.toast('✓ Viagem registrada!', 'sucesso');
      Utils.fecharModal('modal-tpc-entrega');
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

  function renderTabela() {
    const el = document.getElementById('tpc-tabela');
    if (!el) return;
    const busca = fBusca.toLowerCase();
    const lista = [...entregas]
      .filter(e => !busca || (e.placa || '').toLowerCase().includes(busca) || (e.material || '').toLowerCase().includes(busca))
      .sort((a, b) => (b.data || '').localeCompare(a.data || ''));

    if (!lista.length) {
      el.innerHTML = `<div class="cc-empty">🚚<br>Nenhuma viagem registrada ainda.</div>`;
      return;
    }
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
              <td class="col-acoes"><button class="btn btn-secundario btn-sm" style="color:var(--cv-red);" onclick="TPC_UI.excluirEntrega('${e.id}')">🗑</button></td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot><tr><td colspan="4" style="font-weight:700;">${lista.length} viagem${lista.length !== 1 ? 'ns' : ''}</td><td class="col-num cc-tdMono" style="font-weight:700;">${TC.fmt1(lista.reduce((s, e) => s + TC.num(e.volume), 0))}</td><td colspan="3"></td></tr></tfoot>
      </table>
      </div>`;
  }

  return {
    init, recarregar, renderizar, onFiltro,
    abrirEntrega, autoVolumePorPlaca, salvarEntrega, excluirEntrega,
  };
})();

const TPC_UI = ControleTerraplanagem;

function onObraChanged() {
  ControleTerraplanagem.recarregar();
}

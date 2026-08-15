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
  let obraNome = '';
  let caminhoes = [];
  let entregas = [];
  let config = { taxaEmpolamento: 0.3, capacidadeGrande: 15.6, capacidadePequena: 10 };
  let secoes = { horizontal: [], vertical: [] };
  let fBusca = '';
  let abaRel = 'viagens'; // 'viagens' | 'porDia' | 'porCaminhao'

  function _ls(src) { return new Promise((r, j) => { const s = document.createElement('script'); s.src = src; s.onload = r; s.onerror = j; document.head.appendChild(s); }); }

  // ══════════════════════════════════════════
  // INIT / CARREGAMENTO
  // ══════════════════════════════════════════
  async function init() {
    const ok = await Utils.initPagina({ requireObra: true });
    if (!ok) return;
    obraId = Router.getObraId();
    obraNome = Router.getObra()?.nome || '';
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
    obraNome = Router.getObra()?.nome || '';
    if (!obraId) return;
    fBusca = '';
    abaRel = 'viagens';
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
    // Sem volume previsto (Levantamento ainda não feito/cadastrado) não é "0% concluído"
    // — é "sem previsão pra comparar". Lançar viagens/planilha nunca depende disso.
    const pct = volEmpolado > 0 ? Math.min(100, (volRemovido / volEmpolado) * 100) : null;
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
        <div class="cc-kpi cc-kpiOrange"><div class="cc-kpiIcon">📦</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Volume Previsto (a remover)</div><div class="cc-kpiValue">${k.volEmpolado > 0 ? TC.fmt1(k.volEmpolado) + '<span class="cc-kpiUnit">m³</span>' : '—'}</div>${k.volEmpolado > 0 ? '' : '<div class="cc-kpiSub">Sem Levantamento cadastrado ainda</div>'}</div></div>
        <div class="cc-kpi cc-kpiGreen"><div class="cc-kpiIcon">✅</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Já Removido</div><div class="cc-kpiValue">${TC.fmt1(k.volRemovido)}<span class="cc-kpiUnit">m³</span></div>${k.pct !== null ? `<div class="cc-kpiSub">${TC.fmt1(k.pct)}% concluído</div>` : ''}</div></div>
        <div class="cc-kpi cc-kpiBlue"><div class="cc-kpiIcon">🚚</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Caminhões</div><div class="cc-kpiValue">${caminhoes.length}</div></div></div>
        <div class="cc-kpi cc-kpiPurple"><div class="cc-kpiIcon">📋</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Viagens Registradas</div><div class="cc-kpiValue">${entregas.length}</div></div></div>
      </div>

      <div class="cc-panel">
        <div class="cc-panelTitle">📈 Progresso de Remoção</div>
        <div id="tpc-curva"></div>
      </div>

      <div class="cc-panel">
        <div class="cc-panelTitle">📋 Viagens / Remoções ${k.pct !== null ? `<span style="font-family:var(--cv-mono);font-size:10px;color:var(--cv-text3);font-weight:400;text-transform:none;letter-spacing:0;">acumulado ${TC.fmt1(k.pct)}%</span>` : ''}</div>
        <div class="aba-toggle" style="margin-bottom:14px;">
          <button class="aba-btn ${abaRel === 'viagens' ? 'ativo' : ''}" onclick="TPC_UI.setAbaRel('viagens')">Viagens</button>
          <button class="aba-btn ${abaRel === 'porDia' ? 'ativo' : ''}" onclick="TPC_UI.setAbaRel('porDia')">Por Dia</button>
          <button class="aba-btn ${abaRel === 'porCaminhao' ? 'ativo' : ''}" onclick="TPC_UI.setAbaRel('porCaminhao')">Por Caminhão</button>
        </div>
        ${abaRel === 'viagens' ? `<input type="text" class="form-control" id="tpc-busca" placeholder="🔍 Buscar por placa, canhoto ou material..." style="margin-bottom:12px;" value="${esc(fBusca)}" oninput="TPC_UI.onFiltro()">` : ''}
        <div id="tpc-tabela"></div>
      </div>
      </div>
    `;
    renderCurva(k.volEmpolado);
    renderPainelRegistros();
    Permissions.aplicarNaTela();
  }

  function onFiltro() {
    fBusca = document.getElementById('tpc-busca').value;
    renderPainelRegistros();
  }
  function setAbaRel(aba) { abaRel = aba; renderPainelRegistros(); }
  function renderPainelRegistros() {
    if (abaRel === 'porDia') renderPorDia();
    else if (abaRel === 'porCaminhao') renderPorCaminhao();
    else renderTabela();
  }

  // ── Resumo por dia (volume e nº de viagens) ──
  function renderPorDia() {
    const el = document.getElementById('tpc-tabela');
    if (!el) return;
    if (!entregas.length) { el.innerHTML = `<div class="cc-empty">Nenhuma viagem registrada ainda.</div>`; return; }
    const mapa = {};
    entregas.forEach(e => {
      const d = e.data || '—';
      if (!mapa[d]) mapa[d] = { data: d, viagens: 0, volume: 0 };
      mapa[d].viagens++;
      mapa[d].volume += TC.num(e.volume);
    });
    const lista = Object.values(mapa).sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    const totalVol = lista.reduce((s, r) => s + r.volume, 0);
    const totalViagens = lista.reduce((s, r) => s + r.viagens, 0);
    el.innerHTML = `
      <div class="cc-tableWrap" style="max-height:400px;overflow-y:auto;">
      <table class="cc-table">
        <thead><tr><th>Data</th><th class="col-num">Viagens</th><th class="col-num">Volume (m³)</th><th class="col-num">% do total</th></tr></thead>
        <tbody>
          ${lista.map(r => `<tr>
            <td class="cc-tdMono" style="font-weight:700;">${esc(r.data)}</td>
            <td class="col-num cc-tdMono">${r.viagens}</td>
            <td class="col-num cc-tdMono">${TC.fmt1(r.volume)}</td>
            <td class="col-num cc-tdAccent" style="font-weight:700;">${totalVol > 0 ? TC.fmt1((r.volume / totalVol) * 100) : '0,0'}%</td>
          </tr>`).join('')}
        </tbody>
        <tfoot><tr><td style="font-weight:700;">${lista.length} dia${lista.length !== 1 ? 's' : ''}</td><td class="col-num cc-tdMono" style="font-weight:700;">${totalViagens}</td><td class="col-num cc-tdMono" style="font-weight:700;">${TC.fmt1(totalVol)}</td><td></td></tr></tfoot>
      </table>
      </div>`;
  }

  // ── Resumo por caminhão (placa): viagens, volume total e médio ──
  function renderPorCaminhao() {
    const el = document.getElementById('tpc-tabela');
    if (!el) return;
    if (!entregas.length) { el.innerHTML = `<div class="cc-empty">Nenhuma viagem registrada ainda.</div>`; return; }
    const mapa = {};
    entregas.forEach(e => {
      const p = e.placa || '— sem placa —';
      if (!mapa[p]) mapa[p] = { placa: p, viagens: 0, volume: 0 };
      mapa[p].viagens++;
      mapa[p].volume += TC.num(e.volume);
    });
    const lista = Object.values(mapa).sort((a, b) => b.volume - a.volume);
    const totalVol = lista.reduce((s, r) => s + r.volume, 0);
    const totalViagens = lista.reduce((s, r) => s + r.viagens, 0);
    el.innerHTML = `
      <div class="cc-tableWrap" style="max-height:400px;overflow-y:auto;">
      <table class="cc-table">
        <thead><tr><th>Placa</th><th>Empresa</th><th class="col-num">Viagens</th><th class="col-num">Volume Total (m³)</th><th class="col-num">Média/Viagem (m³)</th></tr></thead>
        <tbody>
          ${lista.map(r => {
            const cam = caminhoes.find(c => c.placa === r.placa);
            return `<tr>
              <td class="cc-tdMono" style="font-weight:700;">${esc(r.placa)}</td>
              <td>${esc(cam?.empresa || '—')}</td>
              <td class="col-num cc-tdMono">${r.viagens}</td>
              <td class="col-num cc-tdMono">${TC.fmt1(r.volume)}</td>
              <td class="col-num cc-tdMono">${TC.fmt1(r.volume / r.viagens)}</td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot><tr><td style="font-weight:700;" colspan="2">${lista.length} caminhão${lista.length !== 1 ? 'ões' : ''}</td><td class="col-num cc-tdMono" style="font-weight:700;">${totalViagens}</td><td class="col-num cc-tdMono" style="font-weight:700;">${TC.fmt1(totalVol)}</td><td></td></tr></tfoot>
      </table>
      </div>`;
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
        <div class="form-grupo"><label>N° Canhoto</label><input type="text" id="tpc-ent-canhoto" class="form-control" placeholder="opcional"></div>
        <div class="form-grupo"><label>Data</label><input type="date" id="tpc-ent-data" class="form-control" value="${esc(Utils.hoje())}"></div>
      </div>
      <div class="form-row">
        <div class="form-grupo"><label>Placa</label>
          <select id="tpc-ent-placa" class="form-control" onchange="TPC_UI.autoVolumePorPlaca()">
            <option value="">— selecione —</option>
            ${caminhoes.map(c => `<option value="${esc(c.placa)}">${esc(c.placa)} (${esc(c.tamanho)})</option>`).join('')}
          </select>
        </div>
        <div class="form-grupo"><label>Material</label><input type="text" id="tpc-ent-material" class="form-control" placeholder="Terra / Aterro"></div>
      </div>
      <div class="form-row">
        <div class="form-grupo"><label>Tipo</label><input type="text" id="tpc-ent-tipo" class="form-control" placeholder="Remoção / Entrega"></div>
      </div>
      <div class="form-row">
        <div class="form-grupo"><label>Fornecedor</label><input type="text" id="tpc-ent-fornecedor" class="form-control" placeholder="opcional"></div>
        <div class="form-grupo"><label>Volume (m³)</label><input type="text" inputmode="decimal" id="tpc-ent-volume" class="form-control" placeholder="15.6"></div>
      </div>
      <button class="btn btn-primario" data-perm="controleTerra:criar" onclick="TPC_UI.salvarEntrega()">+ Registrar Viagem</button>
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
    if(!Permissions.pode('controleTerra','criar')&&!Permissions.pode('controleTerra','editar')){Utils.toast('Sem permissão.','erro');return;}
    const nCanhoto = document.getElementById('tpc-ent-canhoto').value.trim();
    const data = document.getElementById('tpc-ent-data').value;
    const placaSel = document.getElementById('tpc-ent-placa').value;
    const material = document.getElementById('tpc-ent-material').value.trim();
    const tipo = document.getElementById('tpc-ent-tipo').value.trim();
    const fornecedor = document.getElementById('tpc-ent-fornecedor').value.trim();
    const volume = TC.num(document.getElementById('tpc-ent-volume').value);
    if (!data || !(volume > 0)) { Utils.toast('Informe data e volume maior que zero.', 'alerta'); return; }
    Utils.mostrarLoading();
    try {
      await Database.criar(obraId, COL_ENTREGAS, { nCanhoto, data, placa: placaSel, material, tipo, fornecedor, volume }, TC.genId('ent'));
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
    if(!Permissions.pode('controleTerra','excluir')){Utils.toast('Sem permissão para excluir.','erro');return;}
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

  // ══════════════════════════════════════════
  // IMPORTAÇÃO DE PLANILHA (N Canhoto, Data, Material, Volume, Placa)
  // Aceita .xlsx/.xls/.csv. Colunas identificadas por nome (com aliases,
  // sem acento/maiúsculas) — ordem das colunas na planilha não importa.
  // Dedup: linhas com N Canhoto já existente em terraEntregas são puladas
  // (evita duplicar se a mesma planilha for importada de novo).
  // Placas não cadastradas em terraCaminhoes são criadas automaticamente
  // (tamanho fica em branco — dá pra completar depois em "🚚 Caminhões").
  // ══════════════════════════════════════════
  function _pDataImport(v) {
    if (!v && v !== 0) return '';
    if (v instanceof Date) return v.toISOString().split('T')[0];
    if (typeof v === 'number') return new Date((v - 25569) * 864e5).toISOString().split('T')[0];
    const s = String(v).trim();
    let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.split('T')[0];
    return '';
  }

  async function importarPlanilha(event) {
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = '';
    if (!Permissions.pode('controleTerra', 'importar')) { Utils.toast('Sem permissão para importar.', 'erro'); return; }
    Utils.mostrarLoading('Lendo planilha...');
    try {
      if (typeof XLSX === 'undefined') await _ls('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab, { type: 'array' });

      // Planilha com mais de uma aba = mais de uma obra na mesma pasta.
      // Cada obra deve ser importada separadamente (na tela da obra certa) —
      // pergunta qual aba corresponde a ESTA obra em vez de adivinhar.
      let sheetName = wb.SheetNames[0];
      if (wb.SheetNames.length > 1) {
        const escolha = prompt(
          `Essa planilha tem ${wb.SheetNames.length} abas (${wb.SheetNames.join(', ')}) — provavelmente uma por obra.\n` +
          `Qual aba é DESTA obra? (digite o nome exatamente como na lista acima)`,
          wb.SheetNames[0]
        );
        if (escolha === null) { Utils.esconderLoading(); return; }
        const achada = wb.SheetNames.find(n => n.trim().toLowerCase() === escolha.trim().toLowerCase());
        if (!achada) throw new Error(`Aba "${escolha}" não encontrada. Abas disponíveis: ${wb.SheetNames.join(', ')}`);
        sheetName = achada;
      }
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (rows.length < 2) throw new Error('Planilha vazia ou sem linhas de dados.');

      const norm = h => String(h ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[:.]+$/g, '').replace(/\s+/g, ' ').trim();
      const ALIASES = {
        nCanhoto: ['n canhoto', 'numero canhoto', 'no canhoto', 'canhoto', 'nº canhoto', 'n° canhoto', 'ticket', 'nota'],
        data: ['data', 'date', 'dia'],
        material: ['material'],
        volume: ['volume', 'volume m3', 'volume (m3)', 'm3', 'qtd', 'quantidade'],
        placa: ['placa veiculo', 'placa do veiculo', 'placa caminhao', 'placa', 'veiculo', 'caminhao'],
      };
      // Colunas podem ter um título/logo acima do cabeçalho de verdade (ex: linha 1
      // = "PIZANI TERRAPLENAGEM, ZENITH", linha 2 = "N° CANHOTO | DATA | ..."). Varre
      // as primeiras linhas e usa a primeira que pareça mesmo um cabeçalho.
      let headerRowIdx = 0;
      for (let r = 0; r < Math.min(rows.length, 10); r++) {
        const normed = (rows[r] || []).map(norm);
        const hits = ['data', 'volume', 'placa'].filter(chave => normed.some(h => h.includes(chave))).length;
        if (hits >= 2) { headerRowIdx = r; break; }
      }
      const hdrs = (rows[headerRowIdx] || []).map(norm);
      // Casa por igualdade OU por conter o alias (ex: "placa veiculo" contém "placa")
      const ci = campo => {
        for (const alias of ALIASES[campo]) {
          let i = hdrs.indexOf(alias);
          if (i >= 0) return i;
        }
        for (const alias of ALIASES[campo]) {
          const i = hdrs.findIndex(h => h.includes(alias));
          if (i >= 0) return i;
        }
        return -1;
      };
      const iCanhoto = ci('nCanhoto'), iData = ci('data'), iMaterial = ci('material'), iVolume = ci('volume'), iPlaca = ci('placa');
      if (iData < 0 || iVolume < 0 || iPlaca < 0) {
        throw new Error('Não encontrei as colunas obrigatórias (Data, Volume, Placa). Confira o cabeçalho da planilha.');
      }

      const canhotosExistentes = new Set(entregas.map(e => (e.nCanhoto || '').trim()).filter(Boolean));
      const placasExistentes = new Set(caminhoes.map(c => c.placa));
      const novosCaminhoes = new Set();
      const regs = [];
      let puladasDuplicadas = 0, puladasInvalidas = 0, puladasSemVolume = 0;
      let linhasSoCanhoto = 0, completadasPorPlaca = 0, completadasPorCadastro = 0;

      const limpa = v => { const s = String(v ?? '').trim(); return (s === '-' || s === '—') ? '' : s; };

      // 1ª passada: extrai as linhas em bruto, já ignorando linhas totalmente vazias
      // e linhas que só têm o N° Canhoto preenchido (pra você, "nem existem").
      const brutos = [];
      for (let r = headerRowIdx + 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || !row.length) continue;
        const nCanhoto = limpa(row[iCanhoto]);
        const data = _pDataImport(row[iData]);
        let material = limpa(row[iMaterial]);
        const volumeBruto = limpa(row[iVolume]);
        const volume = TC.num(volumeBruto);
        const placa = limpa(row[iPlaca]).toUpperCase();
        const outrosCampos = data !== '' || material !== '' || volumeBruto !== '' || placa !== '';
        if (!outrosCampos) { if (nCanhoto) linhasSoCanhoto++; continue; } // só canhoto (ou nada) — nem existe
        if (!data) { puladasInvalidas++; continue; } // sem data não dá pra saber quando foi
        brutos.push({ nCanhoto, data, material, volume, volumeInformado: volume > 0, placa });
      }

      // Volume mais comum já visto pra cada placa NESTA planilha (um caminhão sempre
      // carrega o mesmo volume — "ele vai sempre encher") — usado pra completar linhas
      // sem volume informado, antes de recorrer ao cadastro de Caminhões.
      const contagemVolPorPlaca = {};
      brutos.forEach(b => {
        if (b.volumeInformado && b.placa) {
          contagemVolPorPlaca[b.placa] = contagemVolPorPlaca[b.placa] || {};
          contagemVolPorPlaca[b.placa][b.volume] = (contagemVolPorPlaca[b.placa][b.volume] || 0) + 1;
        }
      });
      const volumeTipicoDaPlaca = placa => {
        const contagem = contagemVolPorPlaca[placa];
        if (!contagem) return 0;
        let melhor = 0, melhorCont = 0;
        for (const [vol, cont] of Object.entries(contagem)) if (cont > melhorCont) { melhorCont = cont; melhor = TC.num(vol); }
        return melhor;
      };

      // 2ª passada: completa volume faltante e monta os registros finais
      for (const b of brutos) {
        let volume = b.volume;
        if (!(volume > 0) && b.placa) {
          const volPlaca = volumeTipicoDaPlaca(b.placa);
          if (volPlaca > 0) { volume = volPlaca; completadasPorPlaca++; }
          else {
            const cam = caminhoes.find(c => c.placa === b.placa);
            if (cam) { volume = cam.tamanho === 'Grande' ? config.capacidadeGrande : config.capacidadePequena; completadasPorCadastro++; }
          }
        }
        if (!(volume > 0)) { puladasSemVolume++; continue; } // sem placa E sem volume — não tem como saber
        if (b.nCanhoto && canhotosExistentes.has(b.nCanhoto)) { puladasDuplicadas++; continue; }
        if (b.nCanhoto) canhotosExistentes.add(b.nCanhoto); // evita duplicar dentro da própria planilha também
        if (b.placa && !placasExistentes.has(b.placa)) { novosCaminhoes.add(b.placa); placasExistentes.add(b.placa); }
        regs.push({ nCanhoto: b.nCanhoto, data: b.data, material: b.material, volume, placa: b.placa });
      }

      if (!regs.length) {
        Utils.esconderLoading();
        Utils.toast('Nenhuma linha válida encontrada para importar.', 'alerta');
        return;
      }

      Utils.mostrarLoading(`Importando ${regs.length} viagens...`);
      const ops = regs.map(reg => ({ type: 'set', ref: Database.ref(obraId, COL_ENTREGAS).doc(TC.genId('ent')), data: reg }));
      [...novosCaminhoes].forEach(placa => {
        ops.push({ type: 'set', ref: Database.ref(obraId, COL_CAMINHOES).doc(TC.genId('cam')), data: { placa, tamanho: '', empresa: '' } });
      });
      for (let i = 0; i < ops.length; i += 400) await Database.batchWrite(ops.slice(i, i + 400));

      await carregar();
      const el = document.getElementById('tpc-import-result-body');
      if (el) {
        el.innerHTML = `
          <p>✅ <strong>${regs.length}</strong> viagem${regs.length !== 1 ? 'ns' : ''} importada${regs.length !== 1 ? 's' : ''}.</p>
          ${novosCaminhoes.size ? `<p>🚚 <strong>${novosCaminhoes.size}</strong> caminhão(ões) novo(s) cadastrado(s) automaticamente: ${[...novosCaminhoes].map(esc).join(', ')}. Complete tamanho/empresa em "🚚 Caminhões".</p>` : ''}
          ${(completadasPorPlaca + completadasPorCadastro) ? `<p>🔧 <strong>${completadasPorPlaca + completadasPorCadastro}</strong> linha(s) sem volume tiveram o volume completado automaticamente (${completadasPorPlaca} pelo volume típico da placa nesta planilha, ${completadasPorCadastro} pela capacidade cadastrada do caminhão).</p>` : ''}
          ${linhasSoCanhoto ? `<p style="color:var(--cv-text3);">${linhasSoCanhoto} linha(s) com só o N° Canhoto (sem mais nenhuma informação) foram ignoradas — não contam como erro.</p>` : ''}
          ${puladasDuplicadas ? `<p>⏭️ <strong>${puladasDuplicadas}</strong> linha(s) pulada(s) por N° Canhoto já existente (duplicata).</p>` : ''}
          ${puladasSemVolume ? `<p>⚠️ <strong>${puladasSemVolume}</strong> linha(s) sem volume e sem placa cadastrada pra estimar — não deu pra completar.</p>` : ''}
          ${puladasInvalidas ? `<p>⚠️ <strong>${puladasInvalidas}</strong> linha(s) ignorada(s) por falta de Data.</p>` : ''}
        `;
      }
      Utils.abrirModal('modal-tpc-import-result');
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao importar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  function renderTabela() {
    const el = document.getElementById('tpc-tabela');
    if (!el) return;
    const busca = fBusca.toLowerCase();
    const lista = [...entregas]
      .filter(e => !busca || (e.placa || '').toLowerCase().includes(busca) || (e.material || '').toLowerCase().includes(busca) || (e.nCanhoto || '').toLowerCase().includes(busca))
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
        <thead><tr><th>Canhoto</th><th>Data</th><th>Placa</th><th>Material</th><th>Tipo</th><th class="col-num">Volume (m³)</th><th class="col-num">Acum. (m³)</th><th class="col-num">Acum. %</th><th class="col-acoes"></th></tr></thead>
        <tbody>
          ${lista.map(e => {
            const acum = acumuladoPorId[e.id] || 0;
            const pctAcum = totalGeral > 0 ? (acum / totalGeral) * 100 : 0;
            return `<tr>
              <td class="cc-tdMono">${esc(e.nCanhoto || '—')}</td>
              <td class="cc-tdMono">${esc(e.data)}</td>
              <td class="cc-tdMono" style="font-weight:700;">${esc(e.placa || '—')}</td>
              <td>${esc(e.material || '—')}</td>
              <td>${esc(e.tipo || '—')}</td>
              <td class="col-num cc-tdMono">${TC.fmt1(e.volume)}</td>
              <td class="col-num cc-tdMono">${TC.fmt1(acum)}</td>
              <td class="col-num cc-tdAccent" style="font-weight:700;">${TC.fmt1(pctAcum)}%</td>
              <td class="col-acoes"><button class="btn btn-secundario btn-sm" data-perm="controleTerra:excluir" style="color:var(--cv-red);" onclick="TPC_UI.excluirEntrega('${e.id}')">🗑</button></td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot><tr><td colspan="5" style="font-weight:700;">${lista.length} viagem${lista.length !== 1 ? 'ns' : ''}</td><td class="col-num cc-tdMono" style="font-weight:700;">${TC.fmt1(lista.reduce((s, e) => s + TC.num(e.volume), 0))}</td><td colspan="3"></td></tr></tfoot>
      </table>
      </div>`;
  }

  // ══════════════════════════════════════════
  // RELATÓRIO DE PERÍODO (PDF) — viagens, volume e caminhões num intervalo
  // Escolhe início/fim, mostra prévia (KPIs + gráfico) e gera PDF pra
  // baixar direto ou compartilhar (Web Share API — WhatsApp entra como
  // opção nativa no celular).
  // ══════════════════════════════════════════
  let _relPeriodo = null;

  function _fBR(iso) {
    if (!iso) return '—';
    const p = String(iso).split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
  }
  function _minMaxData() {
    if (!entregas.length) return { min: Utils.hoje(), max: Utils.hoje() };
    const datas = entregas.map(e => e.data).filter(Boolean).sort();
    return { min: datas[0], max: datas[datas.length - 1] };
  }

  function abrirRelatorioPeriodo() {
    if (!Permissions.pode('controleTerra', 'exportar')) { Utils.toast('Sem permissão para exportar.', 'erro'); return; }
    const { min, max } = _minMaxData();
    _relPeriodo = null;
    const el = document.getElementById('tpc-relatorio-body');
    el.innerHTML = `
      <div class="form-row">
        <div class="form-grupo"><label>Data Início</label><input type="date" id="tpc-rel-inicio" class="form-control" value="${esc(min)}"></div>
        <div class="form-grupo"><label>Data Fim</label><input type="date" id="tpc-rel-fim" class="form-control" value="${esc(max)}"></div>
      </div>
      <button class="btn btn-primario btn-sm" onclick="TPC_UI.gerarRelatorioPeriodo()">📊 Gerar Relatório</button>
      <div id="tpc-relatorio-preview" style="margin-top:16px;"></div>
    `;
    Utils.abrirModal('modal-tpc-relatorio');
  }

  function _calcularRelatorioPeriodo(inicio, fim) {
    const lista = entregas.filter(e => e.data && e.data >= inicio && e.data <= fim).sort((a, b) => (a.data || '').localeCompare(b.data || ''));
    const porDia = {}, porCaminhao = {};
    lista.forEach(e => {
      const d = e.data || '—';
      porDia[d] = porDia[d] || { data: d, viagens: 0, volume: 0 };
      porDia[d].viagens++; porDia[d].volume += TC.num(e.volume);
      const chave = e.placa || '— sem placa —';
      porCaminhao[chave] = porCaminhao[chave] || { placa: chave, viagens: 0, volume: 0 };
      porCaminhao[chave].viagens++; porCaminhao[chave].volume += TC.num(e.volume);
    });
    const dias = Object.values(porDia).sort((a, b) => a.data.localeCompare(b.data));
    const caminhoesList = Object.values(porCaminhao).sort((a, b) => b.volume - a.volume);
    const totalVolume = lista.reduce((s, e) => s + TC.num(e.volume), 0);
    const totalCaminhoes = caminhoesList.filter(c => c.placa !== '— sem placa —').length;
    return { inicio, fim, lista, dias, caminhoesList, totalVolume, totalViagens: lista.length, totalCaminhoes };
  }

  function gerarRelatorioPeriodo() {
    const inicio = document.getElementById('tpc-rel-inicio').value;
    const fim = document.getElementById('tpc-rel-fim').value;
    if (!inicio || !fim || inicio > fim) { Utils.toast('Informe um período válido (início antes do fim).', 'alerta'); return; }
    _relPeriodo = _calcularRelatorioPeriodo(inicio, fim);
    _renderPreviewRelatorio();
  }

  function _renderPreviewRelatorio() {
    const el = document.getElementById('tpc-relatorio-preview');
    if (!el || !_relPeriodo) return;
    const r = _relPeriodo;
    if (!r.lista.length) {
      el.innerHTML = `<div class="cc-empty" style="margin-top:8px;">Nenhuma viagem registrada nesse período.</div>`;
      return;
    }
    const maxVol = Math.max(...r.dias.map(d => d.volume), 1);
    const barW = Math.max(5, Math.min(26, 620 / r.dias.length - 4));
    const chartH = 110;
    const chartW = r.dias.length * (barW + 4);
    const bars = r.dias.map((d, i) => {
      const h = (d.volume / maxVol) * chartH;
      const x = i * (barW + 4);
      return `<rect x="${x}" y="${chartH - h}" width="${barW}" height="${Math.max(1, h)}" fill="var(--cor-primaria,#f5c800)" rx="1.5"><title>${esc(d.data)}: ${TC.fmt1(d.volume)} m³</title></rect>`;
    }).join('');
    el.innerHTML = `
      <div class="cc-kpiGrid" style="grid-template-columns:repeat(4,1fr);margin-bottom:14px;">
        <div class="cc-kpi"><div class="cc-kpiIcon">📋</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Viagens</div><div class="cc-kpiValue">${r.totalViagens}</div></div></div>
        <div class="cc-kpi cc-kpiOrange"><div class="cc-kpiIcon">📦</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Volume Total</div><div class="cc-kpiValue">${TC.fmt1(r.totalVolume)}<span class="cc-kpiUnit">m³</span></div></div></div>
        <div class="cc-kpi cc-kpiBlue"><div class="cc-kpiIcon">🚚</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Caminhões</div><div class="cc-kpiValue">${r.totalCaminhoes}</div></div></div>
        <div class="cc-kpi cc-kpiPurple"><div class="cc-kpiIcon">📅</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Dias c/ Registro</div><div class="cc-kpiValue">${r.dias.length}</div></div></div>
      </div>
      <div style="overflow-x:auto;margin-bottom:14px;background:var(--cv-surface2);border-radius:8px;padding:10px;">
        <svg viewBox="0 0 ${Math.max(chartW, 100)} ${chartH + 6}" width="100%" style="max-width:${Math.max(chartW, 300)}px;height:${chartH + 6}px;display:block;">${bars}</svg>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-primario btn-sm" onclick="TPC_UI.baixarRelatorioPDF()">💾 Baixar PDF</button>
        <button class="btn btn-secundario btn-sm" onclick="TPC_UI.compartilharRelatorioPDF()">📤 Compartilhar</button>
      </div>
    `;
  }

  async function _gerarRelatorioPdfBlob() {
    if (typeof window.jspdf === 'undefined') {
      await _ls('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      await _ls('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const PW = doc.internal.pageSize.getWidth();
    const r = _relPeriodo;
    const k = kpisGerais();

    // Cabeçalho
    doc.setFillColor(13, 13, 13); doc.rect(0, 0, PW, 26, 'F');
    doc.setFillColor(245, 200, 0); doc.rect(0, 26, PW, 1.5, 'F');
    doc.setTextColor(255); doc.setFontSize(14); doc.setFont(undefined, 'bold');
    doc.text('Relatório de Terraplanagem — Controle de Período', 12, 11);
    doc.setFontSize(9); doc.setFont(undefined, 'normal'); doc.setTextColor(245, 200, 0);
    doc.text(obraNome || '', 12, 18);
    doc.setTextColor(200);
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')} · Absoluta Engenharia`, 12, 23);
    let y = 34;

    doc.setTextColor(13, 13, 13); doc.setFontSize(10); doc.setFont(undefined, 'bold');
    doc.text(`Período: ${_fBR(r.inicio)} a ${_fBR(r.fim)}`, 12, y);
    y += 8;

    // Cards de KPI
    const cards = [
      { v: String(r.totalViagens), l: 'VIAGENS' },
      { v: TC.fmt1(r.totalVolume), l: 'VOLUME TOTAL (M³)' },
      { v: String(r.totalCaminhoes), l: 'CAMINHÕES' },
      { v: String(r.dias.length), l: 'DIAS C/ REGISTRO' },
      ...(k.volEmpolado > 0 ? [{ v: TC.fmt1((r.totalVolume / k.volEmpolado) * 100) + '%', l: 'DO PREVISTO TOTAL' }] : []),
    ];
    const gap = 4, cw = (PW - 24 - gap * (cards.length - 1)) / cards.length, ch = 17;
    cards.forEach((card, i) => {
      const x = 12 + i * (cw + gap);
      doc.setFillColor(250, 250, 250); doc.setDrawColor(229, 229, 229);
      doc.roundedRect(x, y, cw, ch, 1.8, 1.8, 'FD');
      doc.setTextColor(13, 13, 13); doc.setFontSize(13); doc.setFont(undefined, 'bold');
      doc.text(card.v, x + cw / 2, y + 8, { align: 'center' });
      doc.setTextColor(120); doc.setFontSize(5.6); doc.setFont(undefined, 'normal');
      doc.text(card.l, x + cw / 2, y + 13.5, { align: 'center' });
    });
    y += ch + 8;

    // Gráfico de barras (volume por dia) — desenhado nativo no PDF
    if (r.dias.length) {
      doc.setTextColor(13, 13, 13); doc.setFontSize(9.5); doc.setFont(undefined, 'bold');
      doc.text('Volume por dia', 12, y + 3);
      y += 7;
      const chartX = 12, chartW2 = PW - 24, chartYTop = y, chartH2 = 36;
      const maxVol = Math.max(...r.dias.map(d => d.volume), 1);
      doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.1);
      for (let g = 0; g <= 4; g++) {
        const gy = chartYTop + chartH2 - (g / 4) * chartH2;
        doc.line(chartX, gy, chartX + chartW2, gy);
      }
      const n = r.dias.length;
      const passoBarra = chartW2 / n;
      const barW2 = Math.max(0.8, passoBarra - 0.6);
      doc.setFillColor(245, 200, 0);
      r.dias.forEach((d, i) => {
        const h = (d.volume / maxVol) * chartH2;
        const x = chartX + i * passoBarra + 0.3;
        doc.rect(x, chartYTop + chartH2 - h, barW2, Math.max(0.3, h), 'F');
      });
      doc.setDrawColor(150); doc.setLineWidth(0.2);
      doc.line(chartX, chartYTop + chartH2, chartX + chartW2, chartYTop + chartH2);
      doc.setFontSize(5.5); doc.setTextColor(100);
      const passoLabel = Math.max(1, Math.ceil(n / 8));
      r.dias.forEach((d, i) => {
        if (i % passoLabel !== 0 && i !== n - 1) return;
        const x = chartX + i * passoBarra + passoBarra / 2;
        doc.text(_fBR(d.data), x, chartYTop + chartH2 + 4, { align: 'center' });
      });
      y = chartYTop + chartH2 + 9;
    }

    // Tabela por dia
    if (y > 235) { doc.addPage(); y = 14; }
    doc.setTextColor(13, 13, 13); doc.setFontSize(9.5); doc.setFont(undefined, 'bold');
    doc.text('Volume por dia (detalhado)', 12, y + 3);
    doc.autoTable({
      startY: y + 5,
      head: [['Data', 'Viagens', 'Volume (m³)', '% do total']],
      body: r.dias.map(d => [_fBR(d.data), String(d.viagens), TC.fmt1(d.volume), r.totalVolume > 0 ? TC.fmt1((d.volume / r.totalVolume) * 100) + '%' : '—']),
      margin: { left: 12, right: 12 },
      styles: { fontSize: 8, cellPadding: 1.8 },
      headStyles: { fillColor: [245, 200, 0], textColor: [13, 13, 13], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    });
    y = doc.lastAutoTable.finalY + 8;

    // Tabela por caminhão
    if (y > 235) { doc.addPage(); y = 14; }
    doc.setTextColor(13, 13, 13); doc.setFontSize(9.5); doc.setFont(undefined, 'bold');
    doc.text('Volume por caminhão', 12, y + 3);
    doc.autoTable({
      startY: y + 5,
      head: [['Placa', 'Empresa', 'Viagens', 'Volume Total (m³)', 'Média/Viagem (m³)']],
      body: r.caminhoesList.map(c => {
        const cam = caminhoes.find(x => x.placa === c.placa);
        return [c.placa, cam?.empresa || '—', String(c.viagens), TC.fmt1(c.volume), TC.fmt1(c.volume / c.viagens)];
      }),
      margin: { left: 12, right: 12 },
      styles: { fontSize: 8, cellPadding: 1.8 },
      headStyles: { fillColor: [13, 13, 13], textColor: [245, 200, 0], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      columnStyles: { 2: { halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
    });
    y = doc.lastAutoTable.finalY + 8;

    // Tabela detalhada — todas as viagens do período
    if (y > 225) { doc.addPage(); y = 14; }
    doc.setTextColor(13, 13, 13); doc.setFontSize(9.5); doc.setFont(undefined, 'bold');
    doc.text(`Viagens do período (${r.lista.length})`, 12, y + 3);
    doc.autoTable({
      startY: y + 5,
      head: [['Canhoto', 'Data', 'Placa', 'Material', 'Volume (m³)']],
      body: r.lista.map(e => [e.nCanhoto || '—', _fBR(e.data), e.placa || '—', e.material || '—', TC.fmt1(e.volume)]),
      margin: { left: 12, right: 12 },
      styles: { fontSize: 7, cellPadding: 1.3 },
      headStyles: { fillColor: [245, 200, 0], textColor: [13, 13, 13], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      columnStyles: { 4: { halign: 'right' } },
    });

    return doc.output('blob');
  }

  function _nomeArquivoRelatorio() {
    const nomeObra = (obraNome || 'obra').replace(/[^a-z0-9]/gi, '_');
    return `Relatorio_Terraplanagem_${nomeObra}_${_relPeriodo.inicio}_a_${_relPeriodo.fim}.pdf`;
  }

  async function baixarRelatorioPDF() {
    if (!_relPeriodo) return;
    Utils.mostrarLoading('Gerando PDF...');
    try {
      const blob = await _gerarRelatorioPdfBlob();
      const nome = _nomeArquivoRelatorio();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = nome;
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

  async function compartilharRelatorioPDF() {
    if (!_relPeriodo) return;
    Utils.mostrarLoading('Preparando PDF pra compartilhar...');
    try {
      const blob = await _gerarRelatorioPdfBlob();
      const nome = _nomeArquivoRelatorio();
      let compartilhado = false;
      try {
        const file = new File([blob], nome, { type: 'application/pdf' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          Utils.esconderLoading();
          await navigator.share({
            files: [file], title: 'Relatório de Terraplanagem',
            text: `📦 Relatório de Terraplanagem — ${obraNome}\nPeríodo: ${_fBR(_relPeriodo.inicio)} a ${_fBR(_relPeriodo.fim)}\n${_relPeriodo.totalViagens} viagens · ${TC.fmt1(_relPeriodo.totalVolume)} m³`,
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

  // ══════════════════════════════════════════
  // LIMPAR BASE — apaga TODAS as viagens e (opcionalmente) caminhões da obra.
  // Exige a permissão dedicada "limpar" (controleTerra:limpar) + confirmação
  // dupla com digitação da palavra LIMPAR (proteção contra clique acidental).
  // ══════════════════════════════════════════
  async function limparBase() {
    if (!Permissions.pode('controleTerra', 'limpar')) { Utils.toast('Sem permissão para limpar a base.', 'erro'); return; }
    const ok1 = await Utils.confirmar(`⚠️ Isso vai APAGAR TODAS as ${entregas.length} viagens registradas desta obra. Essa ação NÃO pode ser desfeita. Continuar?`);
    if (!ok1) return;
    const palavra = prompt('Pra confirmar, digite LIMPAR (em maiúsculas):');
    if (palavra !== 'LIMPAR') { Utils.toast('Confirmação incorreta — nada foi apagado.', 'alerta'); return; }
    const apagarCaminhoes = await Utils.confirmar(`Apagar também os ${caminhoes.length} caminhões cadastrados? (OK = apaga caminhões também · Cancelar = mantém os caminhões)`);
    Utils.mostrarLoading('Limpando base...');
    try {
      const ops = entregas.map(e => ({ type: 'delete', ref: Database.ref(obraId, COL_ENTREGAS).doc(e.id) }));
      if (apagarCaminhoes) caminhoes.forEach(c => ops.push({ type: 'delete', ref: Database.ref(obraId, COL_CAMINHOES).doc(c.id) }));
      for (let i = 0; i < ops.length; i += 400) await Database.batchWrite(ops.slice(i, i + 400));
      await carregar();
      Utils.toast(`✓ Base limpa — ${entregas.length === 0 ? 'todas as viagens apagadas' : 'concluído'}.`, 'sucesso');
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao limpar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  return {
    init, recarregar, renderizar, onFiltro, setAbaRel,
    abrirEntrega, autoVolumePorPlaca, salvarEntrega, excluirEntrega,
    importarPlanilha, limparBase,
    abrirRelatorioPeriodo, gerarRelatorioPeriodo, baixarRelatorioPDF, compartilharRelatorioPDF,
  };
})();

const TPC_UI = ControleTerraplanagem;

function onObraChanged() {
  ControleTerraplanagem.recarregar();
}

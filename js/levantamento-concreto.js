// ============================================
// Módulo: Levantamento de Concreto
// Calculadora de volumes, base de peças,
// importação em lote, concretagens (vínculos + BTs)
// e configuração de andares.
// Dados: Firestore obras/{obraId}/concreto*
// ============================================

const LevantamentoConcreto = (() => {
  const CC = ConcretoCalculos;
  const COL_PECAS = 'concretoPecas';
  const COL_CONCS = 'concretoConcretagens';
  const COL_PC = 'concretoPecaConc';
  const COL_BTS = 'concretoBTs';
  const COL_LANS = 'concretoLancamentos';

  let obraId = null;
  let pecas = [];
  let concretagens = [];
  let pecaConc = [];
  let btsConfig = [];
  let lancamentos = [];
  let config = { ordemAndares: [], andaresCustm: [] };
  let levantamento = [];

  // Filtros da tabela de peças
  let fBusca = '', fAndar = 'todos', fTipo = 'todos';

  // Estado da calculadora
  let calc = null;

  // Estado edição de peça / importação
  let pecaEditId = null;
  let previewImport = [];

  // Estado do wizard de concretagem
  let cw = null;

  // Estado da config (ordem de andares)
  let cfgOrdem = [];
  let cfgDragIdx = null;

  // ══════════════════════════════════════════
  // INIT / CARREGAMENTO
  // ══════════════════════════════════════════
  async function init() {
    const ok = await Utils.initPagina({ requireObra: true });
    if (!ok) return;
    obraId = Router.getObraId();
    if (!obraId) {
      document.getElementById('lc-content').innerHTML =
        `<div class="estado-vazio"><div class="icone">🪨</div><p>Selecione uma obra para acessar o levantamento de concreto.</p></div>`;
      return;
    }
    document.addEventListener('keydown', e => { if (e.key === 'Escape') Utils.fecharTodosModais(); });
    await carregar();
  }

  async function carregar() {
    Utils.mostrarLoading();
    try {
      const [ps, cs, pcs, bts, lans] = await Promise.all([
        Database.listar(obraId, COL_PECAS, null),
        Database.listar(obraId, COL_CONCS, null),
        Database.listar(obraId, COL_PC, null),
        Database.listar(obraId, COL_BTS, null),
        Database.listar(obraId, COL_LANS, null),
      ]);
      pecas = ps; concretagens = cs; pecaConc = pcs; btsConfig = bts; lancamentos = lans;
      await carregarConfig();
      await carregarLevantamentoLocal();
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
      const doc = await db.collection('obras').doc(obraId).collection('config').doc('concreto').get();
      config = doc.exists ? doc.data() : { ordemAndares: [], andaresCustm: [] };
      config.ordemAndares = config.ordemAndares || [];
      config.andaresCustm = config.andaresCustm || [];
    } catch (e) {
      config = { ordemAndares: [], andaresCustm: [] };
    }
  }

  const _LEV_DOC = 'concretoLevantamento';
  async function carregarLevantamentoLocal() {
    try {
      const snap = await db.collection('obras').doc(obraId).collection('config').doc(_LEV_DOC).get();
      levantamento = (snap.exists && Array.isArray(snap.data().itens)) ? snap.data().itens : [];
      // Migração: move do localStorage se ainda existir
      const lsKey = 'concretoLevantamento_' + obraId;
      const ls = localStorage.getItem(lsKey);
      if (ls) {
        try {
          const antigos = JSON.parse(ls);
          if (antigos.length && !levantamento.length) { levantamento = antigos; await salvarLevantamentoLocal(); }
        } catch(e) {}
        localStorage.removeItem(lsKey);
      }
    } catch(e) { levantamento = []; }
  }

  async function salvarLevantamentoLocal() {
    try {
      await db.collection('obras').doc(obraId).collection('config').doc(_LEV_DOC).set({ itens: levantamento }, { merge: false });
    } catch(e) { console.error('Erro ao salvar levantamento concreto:', e); }
  }

  async function recarregar() {
    obraId = Router.getObraId();
    if (!obraId) return;
    fBusca = ''; fAndar = 'todos'; fTipo = 'todos';
    await carregar();
  }

  // ══════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════
  function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function todosAndares() {
    const daBase = [...new Set(pecas.map(p => p.andar))];
    return CC.ordenarAndares([...new Set([...daBase, ...(config.andaresCustm || [])])], config.ordemAndares);
  }

  function optAndares(sel) {
    return todosAndares().map(a =>
      `<option value="${esc(a)}" ${a === sel ? 'selected' : ''}>${esc(a)}</option>`).join('');
  }

  // ══════════════════════════════════════════
  // RENDER PRINCIPAL
  // ══════════════════════════════════════════
  function renderizar() {
    const c = document.getElementById('lc-content');
    if (!c) return;
    const volTotal = pecas.reduce((s, p) => s + (p.volume || 0), 0);
    const volBTs = btsConfig.reduce((s, b) => s + (b.volumePrevisto || 0), 0);
    const lajesComDados = pecas.filter(p => p.tipo === 'Laje' && (p.metragemTrelica || p.areaIsopor));
    const totalTrelica = lajesComDados.reduce((s, p) => s + (p.metragemTrelica || 0), 0);
    const totalIsopor = lajesComDados.reduce((s, p) => s + (p.areaIsopor || 0), 0);

    c.innerHTML = `
      <div class="cc-view">
      <div class="page-header">
        <div>
          <h2>🪨 Levantamento de Concreto</h2>
          <span class="subtitulo">Base de peças, calculadora de volumes e montagem de concretagens</span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-secundario btn-sm" onclick="LC.abrirCalculadora()">📐 Calculadora</button>
          <button class="btn btn-secundario btn-sm" onclick="LC.abrirLevantamento()">📋 Levantamento${levantamento.length ? ` <span class="cc-badge cc-badgePartial" style="margin-left:4px;">${levantamento.length}</span>` : ''}</button>
          <button class="btn btn-secundario btn-sm" onclick="LC.abrirImportar()">⊞ Importar Lote</button>
          <button class="btn btn-dark btn-sm" onclick="LC.abrirConcretagens()">◈ Concretagens</button>
          <button class="btn btn-primario btn-sm" onclick="LC.abrirNovaPeca()">+ Nova Peça</button>
        </div>
      </div>

      <div class="cc-kpiGrid" style="grid-template-columns:repeat(4,1fr);">
        <div class="cc-kpi"><div class="cc-kpiIcon">⬡</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Peças cadastradas</div><div class="cc-kpiValue">${pecas.length}</div></div></div>
        <div class="cc-kpi"><div class="cc-kpiIcon">📦</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Volume total de projeto</div><div class="cc-kpiValue">${CC.fmt4(volTotal)}<span class="cc-kpiUnit">m³</span></div></div></div>
        <div class="cc-kpi"><div class="cc-kpiIcon">◈</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Concretagens montadas</div><div class="cc-kpiValue">${concretagens.length}</div></div></div>
        <div class="cc-kpi"><div class="cc-kpiIcon">📋</div><div class="cc-kpiBody"><div class="cc-kpiLabel">BTs configuradas</div><div class="cc-kpiValue">${btsConfig.length}</div><div class="cc-kpiSub">${CC.fmt4(volBTs)} m³ previstos</div></div></div>
      </div>

      ${lajesComDados.length ? `
      <div class="cc-panel">
        <div class="cc-panelTitle">📐 Resumo de Treliça / Isopor <span style="font-family:var(--cv-mono);font-size:10px;color:var(--cv-text3);font-weight:400;text-transform:none;letter-spacing:0;">${lajesComDados.length} laje${lajesComDados.length !== 1 ? 's' : ''} pré-moldada${lajesComDados.length !== 1 ? 's' : ''}</span></div>
        <div style="display:flex;gap:24px;flex-wrap:wrap;">
          <div><div class="cc-kpiLabel">Metragem total de treliça</div><div class="cc-kpiValue" style="font-size:18px;">${CC.fmt4(totalTrelica)}<span class="cc-kpiUnit">m</span></div></div>
          <div><div class="cc-kpiLabel">Área total de isopor</div><div class="cc-kpiValue" style="font-size:18px;">${CC.fmt4(totalIsopor)}<span class="cc-kpiUnit">m²</span></div></div>
        </div>
      </div>` : ''}

      <div class="cc-panel">
        <div class="cc-panelTitle">⬡ Peças</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
          <input type="text" class="form-control" id="lc-busca" placeholder="🔍 Buscar peça..." style="flex:1;min-width:160px;" value="${esc(fBusca)}" oninput="LC.onFiltro()">
          <select class="form-control" id="lc-f-andar" style="max-width:200px;" onchange="LC.onFiltro()">
            <option value="todos">Todos os andares</option>${optAndares(fAndar)}
          </select>
          <select class="form-control" id="lc-f-tipo" style="max-width:180px;" onchange="LC.onFiltro()">
            <option value="todos">Todos os tipos</option>
            ${[...new Set(pecas.map(p => p.tipo))].sort().map(t => `<option value="${esc(t)}" ${t === fTipo ? 'selected' : ''}>${esc(t)}</option>`).join('')}
          </select>
        </div>
        <div id="lc-tabela-pecas"></div>
      </div>

      <div class="cc-panel">
        <div class="cc-panelTitle">◈ Concretagens</div>
        <div id="lc-tabela-concs"></div>
      </div>
      </div>
    `;
    renderTabelaPecas();
    renderTabelaConcs();
  }

  function onFiltro() {
    fBusca = document.getElementById('lc-busca').value;
    fAndar = document.getElementById('lc-f-andar').value;
    fTipo = document.getElementById('lc-f-tipo').value;
    renderTabelaPecas();
  }

  function renderTabelaPecas() {
    const el = document.getElementById('lc-tabela-pecas');
    if (!el) return;
    const busca = fBusca.toLowerCase();
    const ordem = todosAndares();
    const lista = pecas.filter(p => {
      if (fAndar !== 'todos' && p.andar !== fAndar) return false;
      if (fTipo !== 'todos' && p.tipo !== fTipo) return false;
      if (busca && !(p.nome.toLowerCase().includes(busca) || (p.andar || '').toLowerCase().includes(busca) || (p.tipo || '').toLowerCase().includes(busca))) return false;
      return true;
    }).sort((a, b) => {
      const ia = ordem.indexOf(a.andar), ib = ordem.indexOf(b.andar);
      if (ia !== ib) return ia - ib;
      if (a.tipo !== b.tipo) return (a.tipo || '').localeCompare(b.tipo || '');
      return (a.nome || '').localeCompare(b.nome || '');
    });

    if (!lista.length) {
      el.innerHTML = `<div class="cc-empty">⬡<br>Nenhuma peça encontrada. Use a calculadora ou importe em lote.</div>`;
      return;
    }
    const volFiltro = lista.reduce((s, p) => s + (p.volume || 0), 0);
    el.innerHTML = `
      <div class="cc-tableWrap" style="max-height:480px;overflow-y:auto;">
      <table class="cc-table">
        <thead><tr><th>Nome</th><th>Tipo</th><th>Andar</th><th class="col-num">Volume (m³)</th><th class="col-centro">Concretado</th><th class="col-acoes"></th></tr></thead>
        <tbody>
          ${lista.map(p => {
            const pct = CC.pctConcretado(p, lancamentos);
            const badge = pct >= 100 ? 'cc-badgeComplete' : pct > 0 ? 'cc-badgePartial' : 'cc-badgePending';
            return `<tr>
              <td style="font-weight:600;">${esc(p.nome)}</td>
              <td>${esc(p.tipo)}</td>
              <td>${esc(p.andar)}</td>
              <td class="col-num cc-tdMono">${CC.fmt4(p.volume)}</td>
              <td class="col-centro"><span class="cc-badge ${badge}">${CC.fmt1(pct)}%</span></td>
              <td class="col-acoes">
                <button class="btn btn-secundario btn-sm" onclick="LC.abrirEditarPeca('${p.id}')">✎</button>
                <button class="btn btn-secundario btn-sm" style="color:var(--cv-red);" onclick="LC.excluirPeca('${p.id}')">🗑</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot><tr><td colspan="3" style="font-weight:700;">${lista.length} peça${lista.length !== 1 ? 's' : ''}</td><td class="col-num cc-tdMono" style="font-weight:700;">${CC.fmt4(volFiltro)}</td><td colspan="2"></td></tr></tfoot>
      </table>
      </div>
    `;
  }

  function renderTabelaConcs() {
    const el = document.getElementById('lc-tabela-concs');
    if (!el) return;
    if (!concretagens.length) {
      el.innerHTML = `<div class="cc-empty">◈<br>Nenhuma concretagem montada. Clique em "◈ Concretagens" para criar.</div>`;
      return;
    }
    const lista = [...concretagens].sort((a, b) => (a.numero || 0) - (b.numero || 0));
    el.innerHTML = `
      <div class="cc-tableWrap">
      <table class="cc-table">
        <thead><tr><th>Nº</th><th>Data</th><th>Descrição</th><th class="col-centro">Peças</th><th class="col-num">Vol. vinculado (m³)</th><th class="col-centro">BTs</th><th class="col-num">Vol. BTs (m³)</th><th class="col-acoes"></th></tr></thead>
        <tbody>
          ${lista.map(c => {
            const vincs = pecaConc.filter(pc => pc.concretagemId === c.id);
            const volVinc = vincs.reduce((s, v) => {
              const p = pecas.find(x => x.id === v.pecaId);
              return s + (p ? ((parseFloat(v.pctConcretagem) || 0) / 100) * p.volume : 0);
            }, 0);
            const bts = btsConfig.filter(b => b.concretagemId === c.id);
            const volBts = bts.reduce((s, b) => s + (b.volumePrevisto || 0), 0);
            return `<tr>
              <td class="cc-tdAccent" style="font-weight:700;">Nº ${c.numero}</td>
              <td class="cc-tdMono">${esc(c.data || '')}</td>
              <td>${esc(c.descricao || '—')}</td>
              <td class="col-centro">${vincs.length}</td>
              <td class="col-num cc-tdMono">${CC.fmt4(volVinc)}</td>
              <td class="col-centro">${bts.length}</td>
              <td class="col-num cc-tdMono">${CC.fmt4(volBts)}</td>
              <td class="col-acoes">
                <button class="btn btn-secundario btn-sm" onclick="LC.editarConcretagem('${c.id}')">✎</button>
                <button class="btn btn-secundario btn-sm" style="color:var(--cv-red);" onclick="LC.excluirConcretagem('${c.id}')">🗑</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      </div>
    `;
  }

  // ══════════════════════════════════════════
  // CALCULADORA (Pilar / Rampa / Escada)
  // ══════════════════════════════════════════
  function abrirCalculadora() {
    calc = {
      tipoPeca: null, tipoP: 'ret', andar: '', nome: '',
      peDireito: '', mA: '', mB: '', mC: '', mD: '',
      comprimento: '', largura: '', altLaje: '',
      abaEscada: null,
      lajeInc: [{ compIncl: '', larg: '', esp: '' }],
      patamares: [{ comp: '', larg: '', esp: '' }],
      degraus: [{ pisada: '', espelho: '', larg: '', qtd: '' }],
      // Viga
      vLado: '', vAltura: '', vComprimento: '',
      // Fundação (9 tipos)
      tipoFund: 'Bloco Retângular', fA: '', fB: '', fC: '', fD: '', fE: '', fF: '',
      // Laje
      ljX: '', ljY: '', ljDesconto: '', ljHlaje: '', ljHpainel: '', ljPreMoldada: false,
      ljQtdPaineis: '', ljCompPainel: '', ljLargIsopor: '', ljHisopor: '', ljMaxLinhas: '',
    };
    renderCalc();
    Utils.abrirModal('modal-lc-calc');
  }

  function calcVolumeAtual() {
    if (!calc) return 0;
    if (calc.tipoPeca === 'pilar') return CC.calcVolPilar(calc.tipoP, calc.peDireito, calc.mA, calc.mB, calc.mC, calc.mD);
    if (calc.tipoPeca === 'rampa') return CC.calcVolRampa(calc.comprimento, calc.largura, calc.altLaje);
    if (calc.tipoPeca === 'escada') return CC.calcVolLajesInclinadas(calc.lajeInc) + CC.calcVolPatamares(calc.patamares) + CC.calcVolDegraus(calc.degraus);
    if (calc.tipoPeca === 'viga') return CC.calcVolViga(calc.vLado, calc.vAltura, calc.vComprimento);
    if (calc.tipoPeca === 'fundacao') return CC.calcVolFundacao(calc.tipoFund, { A: calc.fA, B: calc.fB, C: calc.fC, D: calc.fD, E: calc.fE, F: calc.fF });
    if (calc.tipoPeca === 'laje') return CC.calcVolLaje({
      x: calc.ljX, y: calc.ljY, desconto: calc.ljDesconto, hLaje: calc.ljHlaje, hPainel: calc.ljPreMoldada ? calc.ljHpainel : 0,
      qtdPaineis: calc.ljQtdPaineis, compPainel: calc.ljCompPainel, largIsopor: calc.ljLargIsopor, hIsopor: calc.ljHisopor,
    });
    return 0;
  }

  function esquemaPilar(tipoP) {
    const az = '#3b82f6', vd = '#16a34a', vm = '#ef4444', rx = '#a855f7', am = 'var(--cor-primaria)';
    if (tipoP === 'ret') return `
      <svg viewBox="0 0 160 130" width="100%">
        <rect x="35" y="25" width="90" height="60" fill="rgba(245,200,0,0.15)" stroke="${am}" stroke-width="2.5" rx="2"/>
        <line x1="35" y1="100" x2="125" y2="100" stroke="${az}" stroke-width="1.5" stroke-dasharray="4,2"/>
        <text x="80" y="115" text-anchor="middle" font-size="12" fill="${az}" font-weight="bold">A</text>
        <line x1="140" y1="25" x2="140" y2="85" stroke="${vd}" stroke-width="1.5" stroke-dasharray="4,2"/>
        <text x="150" y="60" text-anchor="middle" font-size="12" fill="${vd}" font-weight="bold">B</text>
      </svg>`;
    if (tipoP === 'red') return `
      <svg viewBox="0 0 160 130" width="100%">
        <circle cx="80" cy="60" r="40" fill="rgba(245,200,0,0.15)" stroke="${am}" stroke-width="2.5"/>
        <line x1="40" y1="60" x2="120" y2="60" stroke="${az}" stroke-width="1.5" stroke-dasharray="4,2"/>
        <text x="80" y="120" text-anchor="middle" font-size="12" fill="${az}" font-weight="bold">A = diâmetro</text>
      </svg>`;
    if (tipoP === 'L') return `
      <svg viewBox="0 0 160 140" width="100%">
        <path d="M40,20 L75,20 L75,75 L130,75 L130,105 L40,105 Z" fill="rgba(245,200,0,0.15)" stroke="${am}" stroke-width="2.5"/>
        <line x1="40" y1="115" x2="130" y2="115" stroke="${vd}" stroke-width="1.5" stroke-dasharray="4,2"/>
        <text x="85" y="130" text-anchor="middle" font-size="11" fill="${vd}" font-weight="bold">B</text>
        <line x1="28" y1="20" x2="28" y2="105" stroke="${az}" stroke-width="1.5" stroke-dasharray="4,2"/>
        <text x="16" y="66" text-anchor="middle" font-size="11" fill="${az}" font-weight="bold">A</text>
        <line x1="82" y1="75" x2="130" y2="75" stroke="${vm}" stroke-width="0"/>
        <text x="105" y="68" text-anchor="middle" font-size="11" fill="${vm}" font-weight="bold">C</text>
        <text x="142" y="94" text-anchor="middle" font-size="11" fill="${rx}" font-weight="bold">D</text>
      </svg>`;
    return `
      <svg viewBox="0 0 160 140" width="100%">
        <path d="M30,25 L130,25 L130,55 L95,55 L95,110 L65,110 L65,55 L30,55 Z" fill="rgba(245,200,0,0.15)" stroke="${am}" stroke-width="2.5"/>
        <line x1="30" y1="14" x2="130" y2="14" stroke="${az}" stroke-width="1.5" stroke-dasharray="4,2"/>
        <text x="80" y="10" text-anchor="middle" font-size="11" fill="${az}" font-weight="bold">A</text>
        <text x="142" y="44" text-anchor="middle" font-size="11" fill="${vd}" font-weight="bold">B</text>
        <text x="108" y="88" text-anchor="middle" font-size="11" fill="${vm}" font-weight="bold">C</text>
        <text x="52" y="88" text-anchor="middle" font-size="11" fill="${rx}" font-weight="bold">D</text>
      </svg>`;
  }

  function campoNum(label, campo, valor, cor, placeholder) {
    return `<div class="form-grupo" style="margin-bottom:8px;">
      <label style="${cor ? `color:${cor};` : ''}">${label}</label>
      <input type="text" inputmode="decimal" class="form-control" value="${esc(valor)}" placeholder="${placeholder || ''}"
        oninput="LC.updCalc('${campo}', this.value)">
    </div>`;
  }

  function esquemaViga() {
    return `
      <svg viewBox="0 0 180 120" width="100%">
        <rect x="20" y="40" width="140" height="30" fill="rgba(245,200,0,0.15)" stroke="var(--cor-primaria)" stroke-width="2.5" rx="2"/>
        <line x1="20" y1="80" x2="160" y2="80" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="4,2"/>
        <text x="90" y="94" text-anchor="middle" font-size="11" fill="#3b82f6" font-weight="bold">Comprimento</text>
        <line x1="8" y1="40" x2="8" y2="70" stroke="#16a34a" stroke-width="1.5" stroke-dasharray="4,2"/>
        <text x="8" y="34" text-anchor="middle" font-size="11" fill="#16a34a" font-weight="bold">Altura</text>
        <text x="90" y="59" text-anchor="middle" font-size="11" fill="#ef4444" font-weight="bold">Lado</text>
      </svg>`;
  }

  function esquemaFundacao(tipo) {
    const az = '#3b82f6', vd = '#16a34a', vm = '#ef4444', rx = '#a855f7', am = 'var(--cor-primaria)', tx = '#444';
    if (tipo === 'Estacas') return `
      <svg viewBox="0 0 220 190" width="100%">
        <!-- vista da seção (diâmetro) -->
        <circle cx="42" cy="38" r="20" fill="none" stroke="${tx}" stroke-width="1.5"/>
        <circle cx="42" cy="38" r="11" fill="none" stroke="${tx}" stroke-width="1.2" stroke-dasharray="2,2"/>
        <line x1="22" y1="14" x2="62" y2="14" stroke="${az}" stroke-width="1.2"/>
        <line x1="22" y1="10" x2="22" y2="18" stroke="${az}" stroke-width="1.2"/>
        <line x1="62" y1="10" x2="62" y2="18" stroke="${az}" stroke-width="1.2"/>
        <text x="42" y="10" text-anchor="middle" font-size="10" fill="${az}" font-weight="bold">B</text>
        <text x="42" y="72" text-anchor="middle" font-size="8.5" fill="${tx}">B=DIÂMETRO DA ESTACA</text>
        <!-- vista do fuste -->
        <line x1="90" y1="18" x2="185" y2="18" stroke="#999" stroke-width="1" stroke-dasharray="3,2"/>
        <text x="95" y="14" font-size="8" fill="#888">F.S.F.</text>
        <rect x="118" y="18" width="26" height="92" fill="rgba(245,200,0,0.12)" stroke="${am}" stroke-width="2"/>
        <path d="M118,25 L144,33 M144,25 L118,33 M118,41 L144,49 M144,41 L118,49 M118,57 L144,65 M144,57 L118,65 M118,73 L144,81 M144,73 L118,81 M118,89 L144,97 M144,89 L118,97 M118,102 L144,108 M144,102 L118,108" stroke="${tx}" stroke-width="0.8"/>
        <path d="M118,110 L144,110 L136,150 L126,150 Z" fill="rgba(245,200,0,0.12)" stroke="${am}" stroke-width="2"/>
        <line x1="128" y1="152" x2="134" y2="152" stroke="${tx}" stroke-width="1.5"/>
        <line x1="160" y1="18" x2="160" y2="150" stroke="${az}" stroke-width="1.2" stroke-dasharray="4,2"/>
        <text x="172" y="86" text-anchor="middle" font-size="11" fill="${az}" font-weight="bold">A</text>
        <text x="150" y="16" font-size="7.5" fill="${vm}" font-weight="bold">COTA DE</text>
        <text x="150" y="24" font-size="7.5" fill="${vm}" font-weight="bold">ARRASAMENTO</text>
      </svg>`;
    if (tipo === 'Tubulão a Céu Aberto') return `
      <svg viewBox="0 0 180 190" width="100%">
        <rect x="65" y="15" width="30" height="70" fill="rgba(245,200,0,0.14)" stroke="${am}" stroke-width="2.2"/>
        <path d="M65,85 L95,85 L128,140 L32,140 Z" fill="rgba(245,200,0,0.14)" stroke="${am}" stroke-width="2.2"/>
        <rect x="32" y="140" width="96" height="16" fill="rgba(245,200,0,0.14)" stroke="${am}" stroke-width="2.2"/>
        <line x1="65" y1="6" x2="95" y2="6" stroke="${az}" stroke-width="1.2"/>
        <text x="80" y="4" text-anchor="middle" font-size="10" fill="${az}" font-weight="bold">A</text>
        <line x1="108" y1="15" x2="108" y2="85" stroke="${vd}" stroke-width="1.2" stroke-dasharray="4,2"/>
        <text x="118" y="53" text-anchor="middle" font-size="10" fill="${vd}" font-weight="bold" transform="rotate(90,118,53)">B</text>
        <line x1="32" y1="140" x2="128" y2="140" stroke="${vm}" stroke-width="1" stroke-dasharray="3,2"/>
        <line x1="140" y1="15" x2="140" y2="156" stroke="${tx}" stroke-width="1.2" stroke-dasharray="4,2"/>
        <text x="152" y="88" text-anchor="middle" font-size="10" fill="${tx}" font-weight="bold" transform="rotate(90,152,88)">D</text>
        <line x1="10" y1="140" x2="10" y2="156" stroke="${rx}" stroke-width="1.2" stroke-dasharray="4,2"/>
        <text x="4" y="150" text-anchor="middle" font-size="10" fill="${rx}" font-weight="bold">E</text>
        <line x1="32" y1="166" x2="128" y2="166" stroke="${vm}" stroke-width="1.2"/>
        <text x="80" y="178" text-anchor="middle" font-size="10" fill="${vm}" font-weight="bold">C</text>
      </svg>`;
    if (tipo === 'Sapata Isolada Piramidal') return `
      <svg viewBox="0 0 210 175" width="100%">
        <!-- elevação (simétrica: F dos dois lados) -->
        <path d="M15,140 L15,110 L38,82 L62,82 L62,55 L92,55 L92,82 L116,82 L139,110 L139,140 Z" fill="none" stroke="${tx}" stroke-width="1.2"/>
        <line x1="8" y1="82" x2="8" y2="140" stroke="${rx}" stroke-width="1" stroke-dasharray="4,2"/>
        <text x="2" y="114" text-anchor="middle" font-size="8.5" fill="${rx}" font-weight="bold">F</text>
        <line x1="146" y1="82" x2="146" y2="140" stroke="${rx}" stroke-width="1" stroke-dasharray="4,2"/>
        <text x="154" y="114" text-anchor="middle" font-size="8.5" fill="${rx}" font-weight="bold">F</text>
        <!-- corte frontal -->
        <rect x="168" y="20" width="32" height="35" fill="rgba(245,200,0,0.14)" stroke="${am}" stroke-width="1.8"/>
        <path d="M168,55 L200,55 L210,95 L158,95 Z" fill="rgba(245,200,0,0.14)" stroke="${am}" stroke-width="1.8"/>
        <line x1="168" y1="12" x2="200" y2="12" stroke="${az}" stroke-width="1"/>
        <text x="184" y="10" text-anchor="middle" font-size="8" fill="${az}" font-weight="bold">D</text>
        <line x1="20" y1="150" x2="140" y2="150" stroke="${vd}" stroke-width="1"/>
        <text x="80" y="162" text-anchor="middle" font-size="8.5" fill="${vd}" font-weight="bold">C (pescoço) / B (base)</text>
      </svg>
      <div style="text-align:center;font-size:8.5px;color:#888;margin-top:2px;">A/B = base maior (embaixo) · C/D = pescoço (em cima) · E = altura da base reta · F = altura total</div>`;
    if (tipo === 'Sapata de Divisa Piramidal') return `
      <svg viewBox="0 0 210 175" width="100%">
        <path d="M15,140 L15,82 L45,82 L45,55 L100,55 L100,140 Z" fill="none" stroke="${tx}" stroke-width="1.2"/>
        <line x1="8" y1="82" x2="8" y2="140" stroke="${rx}" stroke-width="1" stroke-dasharray="4,2"/>
        <text x="2" y="114" text-anchor="middle" font-size="8.5" fill="${rx}" font-weight="bold">F</text>
        <line x1="25" y1="82" x2="25" y2="140" stroke="${vm}" stroke-width="1" stroke-dasharray="4,2"/>
        <text x="34" y="114" text-anchor="middle" font-size="8.5" fill="${vm}" font-weight="bold">E</text>
        <line x1="45" y1="46" x2="185" y2="46" stroke="#666" stroke-width="1" stroke-dasharray="3,2"/>
        <text x="150" y="42" text-anchor="middle" font-size="8" fill="#666">Linha de Divisa</text>
        <!-- corte frontal -->
        <rect x="150" y="55" width="34" height="35" fill="rgba(245,200,0,0.14)" stroke="${am}" stroke-width="1.8"/>
        <path d="M150,90 L184,90 L195,130 L140,130 Z" fill="rgba(245,200,0,0.14)" stroke="${am}" stroke-width="1.8"/>
        <line x1="195" y1="55" x2="195" y2="90" stroke="${az}" stroke-width="1"/>
        <text x="204" y="74" text-anchor="middle" font-size="8" fill="${az}" font-weight="bold" transform="rotate(90,204,74)">C</text>
      </svg>
      <div style="text-align:center;font-size:8.5px;color:#888;margin-top:2px;">A/B = base maior · C/D = pescoço · E = altura da base reta (lado da divisa) · F = altura total</div>`;
    if (tipo === 'Bloco Triângular') return `
      <svg viewBox="0 0 190 170" width="100%">
        <path d="M95,25 L165,130 L25,130 Z" fill="rgba(245,200,0,0.12)" stroke="${am}" stroke-width="2"/>
        <circle cx="95" cy="55" r="12" fill="none" stroke="${tx}" stroke-width="1" stroke-dasharray="2,2"/>
        <circle cx="55" cy="115" r="12" fill="none" stroke="${tx}" stroke-width="1" stroke-dasharray="2,2"/>
        <circle cx="135" cy="115" r="12" fill="none" stroke="${tx}" stroke-width="1" stroke-dasharray="2,2"/>
        <line x1="75" y1="14" x2="115" y2="14" stroke="${az}" stroke-width="1.2"/>
        <text x="95" y="11" text-anchor="middle" font-size="10" fill="${az}" font-weight="bold">A</text>
        <line x1="25" y1="142" x2="165" y2="142" stroke="${vd}" stroke-width="1.2"/>
        <text x="95" y="154" text-anchor="middle" font-size="10" fill="${vd}" font-weight="bold">B</text>
        <line x1="45" y1="150" x2="145" y2="150" stroke="${rx}" stroke-width="1.1" stroke-dasharray="3,2"/>
        <text x="95" y="163" text-anchor="middle" font-size="9" fill="${rx}" font-weight="bold">D (opcional)</text>
        <line x1="178" y1="25" x2="178" y2="90" stroke="${vm}" stroke-width="1.1" stroke-dasharray="3,2"/>
        <text x="184" y="60" text-anchor="middle" font-size="9" fill="${vm}" font-weight="bold" transform="rotate(90,184,60)">F</text>
        <line x1="178" y1="90" x2="178" y2="130" stroke="#666" stroke-width="1.1" stroke-dasharray="3,2"/>
        <text x="184" y="112" text-anchor="middle" font-size="9" fill="#666" font-weight="bold" transform="rotate(90,184,112)">E</text>
      </svg>
      <div style="text-align:center;font-size:9px;color:#888;margin-top:2px;">Altura do Bloco = C · D/E/F opcionais (geometria detalhada)</div>`;
    // Bloco Retângular / Viga Baldrame / Sapata Isolada/Divisa em Bloco
    return `
      <svg viewBox="0 0 190 150" width="100%">
        <rect x="30" y="30" width="130" height="80" fill="rgba(245,200,0,0.12)" stroke="${am}" stroke-width="2"/>
        <circle cx="42" cy="42" r="9" fill="none" stroke="${tx}" stroke-width="1" stroke-dasharray="2,2"/>
        <circle cx="148" cy="42" r="9" fill="none" stroke="${tx}" stroke-width="1" stroke-dasharray="2,2"/>
        <circle cx="42" cy="98" r="9" fill="none" stroke="${tx}" stroke-width="1" stroke-dasharray="2,2"/>
        <circle cx="148" cy="98" r="9" fill="none" stroke="${tx}" stroke-width="1" stroke-dasharray="2,2"/>
        <rect x="65" y="63" width="60" height="14" fill="#ddd" stroke="${tx}" stroke-width="1"/>
        <line x1="30" y1="120" x2="160" y2="120" stroke="${az}" stroke-width="1.2"/>
        <text x="95" y="132" text-anchor="middle" font-size="11" fill="${az}" font-weight="bold">A</text>
        <line x1="172" y1="30" x2="172" y2="110" stroke="${vd}" stroke-width="1.2" stroke-dasharray="4,2"/>
        <text x="182" y="70" text-anchor="middle" font-size="11" fill="${vd}" font-weight="bold" transform="rotate(90,182,70)">B</text>
        <text x="95" y="20" text-anchor="middle" font-size="9.5" fill="${tx}">Altura do Bloco = C</text>
      </svg>`;
  }

  function esquemaLaje() {
    return `
      <svg viewBox="0 0 180 140" width="100%">
        <rect x="20" y="20" width="140" height="90" fill="rgba(245,200,0,0.12)" stroke="var(--cor-primaria)" stroke-width="2.5" rx="3"/>
        <circle cx="55" cy="45" r="9" fill="#e2e8f0" stroke="#94a3b8"/>
        <circle cx="85" cy="45" r="9" fill="#e2e8f0" stroke="#94a3b8"/>
        <circle cx="55" cy="75" r="9" fill="#e2e8f0" stroke="#94a3b8"/>
        <circle cx="85" cy="75" r="9" fill="#e2e8f0" stroke="#94a3b8"/>
        <text x="120" y="60" text-anchor="middle" font-size="8" fill="#94a3b8">isopor</text>
        <line x1="20" y1="118" x2="160" y2="118" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="4,2"/>
        <text x="90" y="130" text-anchor="middle" font-size="11" fill="#3b82f6" font-weight="bold">x</text>
        <line x1="8" y1="20" x2="8" y2="110" stroke="#16a34a" stroke-width="1.5" stroke-dasharray="4,2"/>
        <text x="8" y="14" text-anchor="middle" font-size="11" fill="#16a34a" font-weight="bold">y</text>
      </svg>`;
  }

  function renderCalc() {
    const el = document.getElementById('lc-calc-body');
    if (!el || !calc) return;
    const volume = calcVolumeAtual();
    const podeAdd = calc.nome && calc.andar && volume > 0;

    const painelVolume = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--cor-primaria-light,#fef9e7);border:1px solid var(--cor-primaria);border-radius:8px;padding:12px 16px;margin-top:12px;flex-wrap:wrap;">
        <div>
          <div style="font-size:0.7rem;color:var(--cor-texto-muted);text-transform:uppercase;letter-spacing:0.5px;">Volume calculado</div>
          <div id="lc-vol-num" style="font-family:var(--font-mono);font-size:1.6rem;font-weight:700;color:${volume > 0 ? 'var(--cor-primaria-dark,#b8960a)' : 'var(--cor-texto-muted)'};">${volume > 0 ? volume.toFixed(4) : '—'} <span style="font-size:0.85rem;">m³</span></div>
        </div>
        <button id="lc-vol-btn" class="btn btn-primario" ${podeAdd ? '' : 'disabled'} onclick="LC.calcAdicionar()">+ Adicionar ao Levantamento</button>
      </div>
      <div style="margin-top:10px;"><button class="btn btn-secundario btn-sm" onclick="LC.calcVoltar()">← Voltar</button></div>
    `;

    const camposNomeAndar = `
      <div class="form-row">
        <div class="form-grupo" style="margin-bottom:8px;"><label>Andar</label>
          <select class="form-control" onchange="LC.updCalc('andar', this.value)">
            <option value="">— selecione o andar —</option>${optAndares(calc.andar)}
          </select>
        </div>
        <div class="form-grupo" style="margin-bottom:8px;"><label>Nome</label>
          <input type="text" class="form-control" value="${esc(calc.nome)}" placeholder="ex: P-01" oninput="LC.updCalcSilent('nome', this.value)">
        </div>
      </div>`;

    if (!calc.tipoPeca) {
      el.innerHTML = `
        <p class="text-sm text-muted mb-2">Selecione o tipo de peça:</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;">
          ${[
            { id: 'pilar', icon: '▭', label: 'Pilar', sub: 'Ret, Redondo, L ou T' },
            { id: 'viga', icon: '▬', label: 'Viga', sub: 'Lado × Altura × Comprimento' },
            { id: 'laje', icon: '▦', label: 'Laje', sub: 'Convencional ou pré-moldada + isopor' },
            { id: 'fundacao', icon: '⏚', label: 'Fundação', sub: '9 tipos: bloco, sapata, estaca, tubulão' },
            { id: 'rampa', icon: '⟋', label: 'Rampa', sub: 'Comp × Larg × Esp. Laje' },
            { id: 'escada', icon: '🪜', label: 'Escada', sub: 'Laje + Patamares + Degraus' },
          ].map(t => `
            <div class="cc-menuCard" style="text-align:center;" onclick="LC.calcTipoPeca('${t.id}')">
              <div class="cc-menuCardIcon">${t.icon}</div>
              <div class="cc-menuCardTitle">${t.label}</div>
              <div class="cc-menuCardSub">${t.sub}</div>
            </div>`).join('')}
        </div>`;
      return;
    }

    if (calc.tipoPeca === 'pilar') {
      const tipos = [
        { id: 'ret', label: 'Retangular', icon: '▭' },
        { id: 'red', label: 'Redondo', icon: '◯' },
        { id: 'L', label: 'Tipo L', icon: '⌐' },
        { id: 'T', label: 'Tipo T', icon: '⊤' },
      ];
      el.innerHTML = `
        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
          ${tipos.map(t => `
            <button class="btn ${calc.tipoP === t.id ? 'btn-primario' : 'btn-secundario'} btn-sm" onclick="LC.calcTipoPilar('${t.id}')">${t.icon} ${t.label}</button>`).join('')}
        </div>
        <div style="display:grid;grid-template-columns:190px 1fr;gap:16px;align-items:start;" class="lc-calc-grid">
          <div style="background:#f8fafc;border:1px solid var(--cor-borda-light);border-radius:8px;padding:12px;">${esquemaPilar(calc.tipoP)}</div>
          <div>
            ${camposNomeAndar}
            ${campoNum('Pé Direito [cm]', 'peDireito', calc.peDireito, null, '280')}
            <div class="form-row">
              ${campoNum('A [cm]', 'mA', calc.mA, '#3b82f6')}
              ${(calc.tipoP === 'ret' || calc.tipoP === 'L' || calc.tipoP === 'T') ? campoNum('B [cm]', 'mB', calc.mB, '#16a34a') : ''}
            </div>
            ${(calc.tipoP === 'L' || calc.tipoP === 'T') ? `<div class="form-row">${campoNum('C [cm]', 'mC', calc.mC, '#ef4444')}${campoNum('D [cm]', 'mD', calc.mD, '#a855f7')}</div>` : ''}
          </div>
        </div>
        ${painelVolume}`;
      return;
    }

    if (calc.tipoPeca === 'rampa') {
      el.innerHTML = `
        <div style="display:grid;grid-template-columns:190px 1fr;gap:16px;align-items:start;" class="lc-calc-grid">
          <div style="background:#f8fafc;border:1px solid var(--cor-borda-light);border-radius:8px;padding:12px;">
            <div style="font-size:0.65rem;font-weight:700;color:var(--cor-texto-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;text-align:center;">Rampa</div>
            <svg viewBox="0 0 180 120" width="100%">
              <rect x="15" y="15" width="140" height="80" fill="rgba(59,130,246,0.08)" stroke="var(--cor-primaria)" stroke-width="2" rx="3"/>
              <line x1="15" y1="103" x2="155" y2="103" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="4,2"/>
              <text x="85" y="115" text-anchor="middle" font-size="10" fill="#3b82f6" font-weight="bold">Comprimento</text>
              <line x1="162" y1="15" x2="162" y2="95" stroke="#16a34a" stroke-width="1.5" stroke-dasharray="4,2"/>
              <text x="173" y="58" text-anchor="middle" font-size="10" fill="#16a34a" font-weight="bold" transform="rotate(90,173,58)">Largura</text>
              <text x="85" y="59" text-anchor="middle" font-size="11" fill="#ef4444" font-weight="bold">E</text>
            </svg>
          </div>
          <div>
            ${camposNomeAndar}
            ${campoNum('Comprimento [cm]', 'comprimento', calc.comprimento, '#3b82f6', '300')}
            ${campoNum('Largura [cm]', 'largura', calc.largura, '#16a34a', '120')}
            ${campoNum('E — Espessura da Laje [cm]', 'altLaje', calc.altLaje, '#ef4444', '15')}
          </div>
        </div>
        ${painelVolume}`;
      return;
    }

    if (calc.tipoPeca === 'viga') {
      el.innerHTML = `
        <div style="display:grid;grid-template-columns:190px 1fr;gap:16px;align-items:start;" class="lc-calc-grid">
          <div style="background:#f8fafc;border:1px solid var(--cor-borda-light);border-radius:8px;padding:12px;">${esquemaViga()}</div>
          <div>
            ${camposNomeAndar}
            ${campoNum('Lado [cm]', 'vLado', calc.vLado, '#ef4444', '14')}
            <div class="form-row">
              ${campoNum('Altura [cm]', 'vAltura', calc.vAltura, '#16a34a', '60')}
              ${campoNum('Comprimento [cm]', 'vComprimento', calc.vComprimento, '#3b82f6', '135')}
            </div>
          </div>
        </div>
        ${painelVolume}`;
      return;
    }

    if (calc.tipoPeca === 'fundacao') {
      const grupo = tipoF => {
        if (tipoF === 'Estacas') return 'estaca';
        if (tipoF === 'Tubulão a Céu Aberto') return 'tubulao';
        if (tipoF === 'Sapata Isolada Piramidal' || tipoF === 'Sapata de Divisa Piramidal') return 'piramide';
        if (tipoF === 'Bloco Triângular') return 'triangular';
        return 'bloco';
      };
      const g = grupo(calc.tipoFund);
      let campos = '';
      if (g === 'bloco') {
        campos = `
          <div class="form-row">
            ${campoNum('A — Comprimento [cm]', 'fA', calc.fA, '#3b82f6', '244')}
            ${campoNum('B — Largura [cm]', 'fB', calc.fB, '#16a34a', '359')}
          </div>
          ${campoNum('C — Altura [cm]', 'fC', calc.fC, '#ef4444', '100')}`;
      } else if (g === 'estaca') {
        campos = `
          ${campoNum('A — Comprimento / Profundidade [m]', 'fA', calc.fA, '#3b82f6', '6')}
          ${campoNum('B — Diâmetro [cm]', 'fB', calc.fB, '#16a34a', '40')}`;
      } else if (g === 'triangular') {
        campos = `
          <div class="form-row">
            ${campoNum('A [cm]', 'fA', calc.fA, '#3b82f6', '150')}
            ${campoNum('B [cm]', 'fB', calc.fB, '#16a34a', '150')}
          </div>
          ${campoNum('C — Altura [cm]', 'fC', calc.fC, '#ef4444', '100')}
          <p class="text-sm text-muted mb-1" style="margin-top:6px;">Preencha D/E/F apenas se quiser a geometria trapezoidal detalhada — deixando em branco, usa a fórmula padrão (empírica).</p>
          <div class="form-row">
            ${campoNum('D [cm] (opcional)', 'fD', calc.fD, '#a855f7', '')}
            ${campoNum('E [cm] (opcional)', 'fE', calc.fE, '#a855f7', '')}
          </div>
          ${campoNum('F [cm] (opcional)', 'fF', calc.fF, '#a855f7', '')}`;
      } else if (g === 'piramide') {
        campos = `
          <p class="text-sm text-muted mb-1">A/B = base maior (embaixo) · C/D = base menor / pescoço (em cima)</p>
          <div class="form-row">
            ${campoNum('A — Base maior, comp. [cm]', 'fA', calc.fA, '#16a34a', '420')}
            ${campoNum('B — Base maior, larg. [cm]', 'fB', calc.fB, '#16a34a', '510')}
          </div>
          <div class="form-row">
            ${campoNum('C — Base menor, comp. [cm]', 'fC', calc.fC, '#3b82f6', '150')}
            ${campoNum('D — Base menor, larg. [cm]', 'fD', calc.fD, '#3b82f6', '50')}
          </div>
          <div class="form-row">
            ${campoNum('E — Altura da base reta [cm]', 'fE', calc.fE, '#ef4444', '50')}
            ${campoNum('F — Altura total [cm]', 'fF', calc.fF, '#a855f7', '125')}
          </div>`;
      } else if (g === 'tubulao') {
        campos = `
          <div class="form-row">
            ${campoNum('A — Diâmetro do fuste [cm]', 'fA', calc.fA, '#3b82f6', '40')}
            ${campoNum('B — Altura do fuste [cm]', 'fB', calc.fB, '#16a34a', '300')}
          </div>
          <div class="form-row">
            ${campoNum('C — Diâmetro da base/bulbo [cm]', 'fC', calc.fC, '#ef4444', '100')}
            ${campoNum('E — Altura reta da base [cm]', 'fE', calc.fE, '#a855f7', '40')}
          </div>
          ${campoNum('D — Altura total [cm]', 'fD', calc.fD, '#666', '380')}`;
      }
      el.innerHTML = `
        <div class="form-grupo" style="margin-bottom:12px;">
          <label>Tipo de Fundação</label>
          <select class="form-control" onchange="LC.calcTipoFundacao(this.value)">
            ${CC.TIPOS_FUNDACAO.map(t => `<option value="${esc(t)}" ${calc.tipoFund === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}
          </select>
        </div>
        <div style="display:grid;grid-template-columns:170px 1fr;gap:16px;align-items:start;" class="lc-calc-grid">
          <div style="background:#f8fafc;border:1px solid var(--cor-borda-light);border-radius:8px;padding:12px;">${esquemaFundacao(calc.tipoFund)}</div>
          <div>
            ${camposNomeAndar}
            ${campos}
          </div>
        </div>
        ${painelVolume}`;
      return;
    }

    if (calc.tipoPeca === 'laje') {
      const areaIsopor = CC.calcAreaIsopor({ qtdPaineis: calc.ljQtdPaineis, compPainel: calc.ljCompPainel, largIsopor: calc.ljLargIsopor });
      const totalTrelica = CC.calcTotalTrelica({ x: calc.ljX, y: calc.ljY, maxLinhas: calc.ljMaxLinhas });
      el.innerHTML = `
        <div style="display:grid;grid-template-columns:170px 1fr;gap:16px;align-items:start;" class="lc-calc-grid">
          <div style="background:#f8fafc;border:1px solid var(--cor-borda-light);border-radius:8px;padding:12px;">${esquemaLaje()}</div>
          <div>
            ${camposNomeAndar}
            <div class="form-row">
              ${campoNum('x [cm]', 'ljX', calc.ljX, '#3b82f6', '193')}
              ${campoNum('y [cm]', 'ljY', calc.ljY, '#16a34a', '1516')}
            </div>
            <div class="form-row">
              ${campoNum('Descontos de área [cm²]', 'ljDesconto', calc.ljDesconto, null, '0')}
              ${campoNum('Hlaje — altura total [cm]', 'ljHlaje', calc.ljHlaje, '#ef4444', '12')}
            </div>
          </div>
        </div>
        <label style="display:flex;align-items:center;gap:8px;margin:12px 0;cursor:pointer;font-size:0.85rem;font-weight:600;">
          <input type="checkbox" ${calc.ljPreMoldada ? 'checked' : ''} onchange="LC.calcTogglePreMoldada(this.checked)"> Laje pré-moldada (painéis + isopor)
        </label>
        ${calc.ljPreMoldada ? `
          <div style="border:1px solid var(--cor-primaria);border-radius:8px;padding:12px;margin-bottom:10px;">
            ${campoNum('Hpainel — altura do painel pré-moldado [cm]', 'ljHpainel', calc.ljHpainel, '#a855f7', '4')}
            <div class="form-row">
              ${campoNum('Qtd. de painéis (isopor)', 'ljQtdPaineis', calc.ljQtdPaineis, null, '10')}
              ${campoNum('Comprimento do painel [cm]', 'ljCompPainel', calc.ljCompPainel, null, '110')}
            </div>
            <div class="form-row">
              ${campoNum('Largura do isopor [cm]', 'ljLargIsopor', calc.ljLargIsopor, null, '50')}
              ${campoNum('Hisopor — altura do isopor [cm]', 'ljHisopor', calc.ljHisopor, null, '8')}
            </div>
            <div style="font-family:var(--font-mono);font-size:0.78rem;color:var(--cor-texto-secundario);">Área de isopor: <b id="lc-lj-isopor">${CC.fmt4(areaIsopor)} m²</b></div>
          </div>` : ''}
        <div style="border-top:1px solid var(--cor-borda-light);padding-top:10px;margin-top:4px;">
          <p class="text-sm text-muted mb-1">Treliça (para controle de material — não entra no volume de concreto)</p>
          ${campoNum('Máximo de linhas da laje', 'ljMaxLinhas', calc.ljMaxLinhas, null, '2')}
          <div style="font-family:var(--font-mono);font-size:0.78rem;color:var(--cor-texto-secundario);">Metragem total de treliça: <b id="lc-lj-trelica">${CC.fmt4(totalTrelica / 100)} m</b></div>
        </div>
        ${painelVolume}`;
      return;
    }

    // Escada
    const volLaje = CC.calcVolLajesInclinadas(calc.lajeInc);
    const volPat = CC.calcVolPatamares(calc.patamares);
    const volDeg = CC.calcVolDegraus(calc.degraus);
    const volIds = { laje: 'lc-vol-laje', patamar: 'lc-vol-pat', degrau: 'lc-vol-deg' };
    const acordeao = (label, aba, vol) => `
      <button style="width:100%;display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border:1px solid ${calc.abaEscada === aba ? 'var(--cor-primaria)' : 'var(--cor-borda-light)'};border-radius:8px;cursor:pointer;background:${calc.abaEscada === aba ? 'var(--cor-primaria-light,#fef9e7)' : '#fff'};margin-bottom:6px;font-family:var(--font-principal);"
        onclick="LC.calcAbaEscada('${aba}')">
        <span style="font-weight:700;font-size:0.85rem;">${calc.abaEscada === aba ? '▼' : '›'} ${label}</span>
        <span id="${volIds[aba]}" style="font-family:var(--font-mono);font-size:0.8rem;color:${vol > 0 ? 'var(--cor-primaria-dark,#b8960a)' : 'var(--cor-texto-muted)'};">${vol > 0 ? vol.toFixed(4) + ' m³' : '—'}</span>
      </button>`;

    const linhaSeg = (lista, campos, addFn, remFn, updFn) => lista.map((item, i) => `
      <div style="display:grid;grid-template-columns:repeat(${campos.length}, 1fr) auto;gap:6px;margin-bottom:6px;align-items:end;">
        ${campos.map(c => `
          <div class="form-grupo" style="margin-bottom:0;">
            <label style="font-size:0.68rem;">${c.label}</label>
            <input type="text" inputmode="decimal" class="form-control" value="${esc(item[c.campo])}" placeholder="${c.ph || ''}"
              oninput="LC.${updFn}(${i}, '${c.campo}', this.value)">
          </div>`).join('')}
        <button class="btn btn-secundario btn-sm" style="color:#ef4444;" onclick="LC.${remFn}(${i})" ${lista.length <= 1 ? 'disabled' : ''}>✕</button>
      </div>`).join('') + `<button class="btn btn-secundario btn-sm" onclick="LC.${addFn}()">+ Adicionar</button>`;

    el.innerHTML = `
      ${camposNomeAndar}
      ${acordeao('Laje Inclinada', 'laje', volLaje)}
      ${calc.abaEscada === 'laje' ? `<div style="border:1px solid var(--cor-primaria);border-radius:8px;padding:12px;margin-bottom:10px;">
        <p class="text-sm text-muted mb-2"><b>Comp. inclinado</b> = medida diagonal da laje · <b>Largura</b> = largura da escada · <b>E</b> = espessura da laje</p>
        ${linhaSeg(calc.lajeInc, [
          { label: 'Comp. inclinado [cm]', campo: 'compIncl', ph: '260.5' },
          { label: 'Largura [cm]', campo: 'larg', ph: '120' },
          { label: 'E [cm]', campo: 'esp', ph: '12' },
        ], 'escAddLaje', 'escRemLaje', 'escUpdLaje')}
      </div>` : ''}
      ${acordeao('Patamares', 'patamar', volPat)}
      ${calc.abaEscada === 'patamar' ? `<div style="border:1px solid var(--cor-primaria);border-radius:8px;padding:12px;margin-bottom:10px;">
        ${linhaSeg(calc.patamares, [
          { label: 'Comprimento [cm]', campo: 'comp', ph: '120' },
          { label: 'Largura [cm]', campo: 'larg', ph: '120' },
          { label: 'E [cm]', campo: 'esp', ph: '12' },
        ], 'escAddPat', 'escRemPat', 'escUpdPat')}
      </div>` : ''}
      ${acordeao('Degraus', 'degrau', volDeg)}
      ${calc.abaEscada === 'degrau' ? `<div style="border:1px solid var(--cor-primaria);border-radius:8px;padding:12px;margin-bottom:10px;">
        <p class="text-sm text-muted mb-2">Volume do degrau = pisada × espelho ÷ 2 × largura × quantidade</p>
        ${linhaSeg(calc.degraus, [
          { label: 'Pisada [cm]', campo: 'pisada', ph: '28' },
          { label: 'Espelho [cm]', campo: 'espelho', ph: '17.5' },
          { label: 'Largura [cm]', campo: 'larg', ph: '120' },
          { label: 'Qtd', campo: 'qtd', ph: '16' },
        ], 'escAddDeg', 'escRemDeg', 'escUpdDeg')}
      </div>` : ''}
      ${painelVolume}`;
  }

  function calcTipoPeca(t) { calc.tipoPeca = t; renderCalc(); }
  function calcTipoPilar(t) { calc.tipoP = t; renderCalc(); }
  function calcTipoFundacao(t) { calc.tipoFund = t; renderCalc(); }
  function calcTogglePreMoldada(v) { calc.ljPreMoldada = v; renderCalc(); }
  function calcVoltar() { calc.tipoPeca = null; renderCalc(); }
  function calcAbaEscada(aba) { calc.abaEscada = calc.abaEscada === aba ? null : aba; renderCalc(); }

  function updCalc(campo, valor) {
    calc[campo] = valor;
    atualizarVolumeCalc();
  }
  // Campos de texto (nome) — não precisa recalcular volume, só habilitar botão
  function updCalcSilent(campo, valor) {
    calc[campo] = valor;
    atualizarVolumeCalc();
  }

  // Atualização parcial: só o painel de volume (preserva foco nos inputs)
  function atualizarVolumeCalc() {
    const el = document.getElementById('lc-calc-body');
    if (!el) return;
    const volume = calcVolumeAtual();
    const volNum = document.getElementById('lc-vol-num');
    const volBtn = document.getElementById('lc-vol-btn');
    if (volNum) {
      volNum.innerHTML = `${volume > 0 ? volume.toFixed(4) : '—'} <span style="font-size:0.85rem;">m³</span>`;
      volNum.style.color = volume > 0 ? 'var(--cor-primaria-dark,#b8960a)' : 'var(--cor-texto-muted)';
    }
    if (volBtn) {
      const podeAdd = calc.nome && calc.andar && volume > 0;
      volBtn.disabled = !podeAdd;
    }
    // Acordeões da escada mostram volume por seção: atualizar labels
    if (calc.tipoPeca === 'escada') {
      const upd = (id, v) => {
        const e2 = document.getElementById(id);
        if (e2) { e2.textContent = v > 0 ? v.toFixed(4) + ' m³' : '—'; e2.style.color = v > 0 ? 'var(--cor-primaria-dark,#b8960a)' : 'var(--cor-texto-muted)'; }
      };
      upd('lc-vol-laje', CC.calcVolLajesInclinadas(calc.lajeInc));
      upd('lc-vol-pat', CC.calcVolPatamares(calc.patamares));
      upd('lc-vol-deg', CC.calcVolDegraus(calc.degraus));
    }
    // Laje: área de isopor e metragem de treliça (informativos, não fazem parte do volume)
    if (calc.tipoPeca === 'laje') {
      const isoporEl = document.getElementById('lc-lj-isopor');
      if (isoporEl) {
        const areaIsopor = CC.calcAreaIsopor({ qtdPaineis: calc.ljQtdPaineis, compPainel: calc.ljCompPainel, largIsopor: calc.ljLargIsopor });
        isoporEl.textContent = CC.fmt4(areaIsopor) + ' m²';
      }
      const trelicaEl = document.getElementById('lc-lj-trelica');
      if (trelicaEl) {
        const totalTrelica = CC.calcTotalTrelica({ x: calc.ljX, y: calc.ljY, maxLinhas: calc.ljMaxLinhas });
        trelicaEl.textContent = CC.fmt4(totalTrelica / 100) + ' m';
      }
    }
  }

  // Escada: segmentos dinâmicos
  function escAddLaje() { calc.lajeInc.push({ compIncl: '', larg: '', esp: '' }); renderCalc(); }
  function escRemLaje(i) { calc.lajeInc.splice(i, 1); renderCalc(); }
  function escUpdLaje(i, c, v) { calc.lajeInc[i][c] = v; atualizarVolumeCalc(); }
  function escAddPat() { calc.patamares.push({ comp: '', larg: '', esp: '' }); renderCalc(); }
  function escRemPat(i) { calc.patamares.splice(i, 1); renderCalc(); }
  function escUpdPat(i, c, v) { calc.patamares[i][c] = v; atualizarVolumeCalc(); }
  function escAddDeg() { calc.degraus.push({ pisada: '', espelho: '', larg: '', qtd: '' }); renderCalc(); }
  function escRemDeg(i) { calc.degraus.splice(i, 1); renderCalc(); }
  function escUpdDeg(i, c, v) { calc.degraus[i][c] = v; atualizarVolumeCalc(); }

  async function calcAdicionar() {
    const volume = calcVolumeAtual();
    if (!calc.nome || !calc.andar || volume <= 0) return;
    const tipoLabel = {
      pilar: 'Pilar', escada: 'Escada', rampa: 'Rampa',
      viga: 'Viga', laje: 'Laje', fundacao: 'Fundação',
    }[calc.tipoPeca] || 'Outro';
    const item = { id: 'lev_' + Date.now(), nome: calc.nome, andar: calc.andar, tipo: tipoLabel, volume };
    if (calc.tipoPeca === 'fundacao') {
      item.subTipo = calc.tipoFund;
    }
    if (calc.tipoPeca === 'laje') {
      item.areaIsopor = calc.ljPreMoldada
        ? CC.calcAreaIsopor({ qtdPaineis: calc.ljQtdPaineis, compPainel: calc.ljCompPainel, largIsopor: calc.ljLargIsopor })
        : 0;
      item.metragemTrelica = CC.calcTotalTrelica({ x: calc.ljX, y: calc.ljY, maxLinhas: calc.ljMaxLinhas }) / 100;
    }
    levantamento.push(item);
    await salvarLevantamentoLocal();
    Utils.toast(`✓ "${calc.nome}" adicionada ao levantamento (${volume.toFixed(4)} m³)`, 'sucesso');
    // Limpa campos, mantém andar e tipo
    calc.nome = '';
    calc.peDireito = ''; calc.mA = ''; calc.mB = ''; calc.mC = ''; calc.mD = '';
    calc.comprimento = ''; calc.largura = ''; calc.altLaje = '';
    calc.lajeInc = [{ compIncl: '', larg: '', esp: '' }];
    calc.patamares = [{ comp: '', larg: '', esp: '' }];
    calc.degraus = [{ pisada: '', espelho: '', larg: '', qtd: '' }];
    calc.vLado = ''; calc.vAltura = ''; calc.vComprimento = '';
    calc.fA = ''; calc.fB = ''; calc.fC = ''; calc.fD = ''; calc.fE = ''; calc.fF = '';
    calc.ljX = ''; calc.ljY = ''; calc.ljDesconto = ''; calc.ljHlaje = ''; calc.ljHpainel = ''; calc.ljPreMoldada = false;
    calc.ljQtdPaineis = ''; calc.ljCompPainel = ''; calc.ljLargIsopor = ''; calc.ljHisopor = ''; calc.ljMaxLinhas = '';
    renderCalc();
    renderizar();
  }

  // ══════════════════════════════════════════
  // LEVANTAMENTO LOCAL (lista intermediária)
  // ══════════════════════════════════════════
  let levSel = new Set();

  function abrirLevantamento() {
    levSel = new Set(levantamento.map(i => i.id));
    renderLevantamento();
    Utils.abrirModal('modal-lc-lev');
  }

  function renderLevantamento() {
    const el = document.getElementById('lc-lev-body');
    if (!el) return;
    if (!levantamento.length) {
      el.innerHTML = `<div class="cc-empty">📋<br>Levantamento vazio. Use a calculadora para adicionar peças.</div>`;
      return;
    }
    const selecionados = levantamento.filter(i => levSel.has(i.id));
    const volSel = selecionados.reduce((s, i) => s + i.volume, 0);
    el.innerHTML = `
      <p class="text-sm text-muted mb-2">Peças calculadas aguardando envio para a base. Selecione e envie.</p>
      <div style="max-height:340px;overflow-y:auto;border:1px solid var(--cor-borda-light);border-radius:8px;margin-bottom:12px;">
        ${levantamento.map(item => `
          <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--cor-borda-light);">
            <input type="checkbox" ${levSel.has(item.id) ? 'checked' : ''} onchange="LC.levToggle('${item.id}')">
            <div style="flex:1;">
              <div style="font-weight:600;font-size:0.9rem;">${esc(item.nome)}</div>
              <div style="font-family:var(--font-mono);font-size:0.75rem;color:var(--cor-texto-muted);">${esc(item.tipo)} · ${esc(item.andar)} · ${CC.fmt4(item.volume)} m³</div>
            </div>
            <button class="btn btn-secundario btn-sm" style="color:#ef4444;" onclick="LC.levRemover('${item.id}')">✕</button>
          </div>`).join('')}
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
        <span style="font-family:var(--font-mono);font-size:0.85rem;color:var(--cor-texto-secundario);">${selecionados.length} selecionada${selecionados.length !== 1 ? 's' : ''} · ${CC.fmt4(volSel)} m³</span>
        <button class="btn btn-primario" ${selecionados.length ? '' : 'disabled'} onclick="LC.levEnviarBase()">✓ Enviar ${selecionados.length} para a Base</button>
      </div>`;
  }

  function levToggle(id) {
    if (levSel.has(id)) levSel.delete(id); else levSel.add(id);
    renderLevantamento();
  }

  async function levRemover(id) {
    levantamento = levantamento.filter(i => i.id !== id);
    levSel.delete(id);
    await salvarLevantamentoLocal();
    renderLevantamento();
    renderizar();
  }

  async function levEnviarBase() {
    const itens = levantamento.filter(i => levSel.has(i.id));
    if (!itens.length) return;
    Utils.mostrarLoading();
    try {
      await salvarPecasLote(itens.map(i => ({
        nome: i.nome, tipo: i.tipo, andar: i.andar, volume: i.volume,
        subTipo: i.subTipo, areaIsopor: i.areaIsopor, metragemTrelica: i.metragemTrelica,
      })));
      levantamento = levantamento.filter(i => !levSel.has(i.id));
      levSel.clear();
      await salvarLevantamentoLocal();
      Utils.toast(`✓ ${itens.length} peça${itens.length !== 1 ? 's' : ''} enviada${itens.length !== 1 ? 's' : ''} para a base!`, 'sucesso');
      await carregar();
      Utils.fecharModal('modal-lc-lev');
    } catch (e) {
      Utils.toast('Erro ao enviar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ══════════════════════════════════════════
  // CRUD DE PEÇAS
  // ══════════════════════════════════════════
  function abrirNovaPeca() {
    pecaEditId = null;
    document.getElementById('lc-modal-peca-titulo').textContent = '⬡ Nova Peça';
    const f = document.getElementById('form-lc-peca');
    f.reset();
    f.querySelector('[name=tipo]').innerHTML = CC.TIPOS.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
    montarDatalistAndares();
    Utils.abrirModal('modal-lc-peca');
  }

  function abrirEditarPeca(id) {
    const p = pecas.find(x => x.id === id);
    if (!p) return;
    pecaEditId = id;
    document.getElementById('lc-modal-peca-titulo').textContent = `✎ Editando: ${p.nome}`;
    const f = document.getElementById('form-lc-peca');
    f.querySelector('[name=tipo]').innerHTML = CC.TIPOS.map(t => `<option value="${esc(t)}" ${t === p.tipo ? 'selected' : ''}>${esc(t)}</option>`).join('');
    f.querySelector('[name=nome]').value = p.nome || '';
    f.querySelector('[name=andar]').value = p.andar || '';
    f.querySelector('[name=volume]').value = p.volume ?? '';
    montarDatalistAndares();
    Utils.abrirModal('modal-lc-peca');
  }

  function montarDatalistAndares() {
    const dl = document.getElementById('lc-datalist-andares');
    if (dl) dl.innerHTML = todosAndares().map(a => `<option value="${esc(a)}">`).join('');
  }

  async function salvarPeca() {
    const f = document.getElementById('form-lc-peca');
    const nome = f.querySelector('[name=nome]').value.trim();
    const tipo = f.querySelector('[name=tipo]').value;
    const andar = f.querySelector('[name=andar]').value.trim();
    const volume = CC.num(f.querySelector('[name=volume]').value);
    if (!nome || !andar || !(volume > 0)) {
      Utils.toast('Preencha nome, andar e volume maior que zero.', 'alerta');
      return;
    }
    Utils.mostrarLoading();
    try {
      if (pecaEditId) {
        await Database.atualizar(obraId, COL_PECAS, pecaEditId, { nome, tipo, andar, volume });
        Utils.toast(`✓ "${nome}" atualizada!`, 'sucesso');
      } else {
        await Database.criar(obraId, COL_PECAS, { nome, tipo, andar, volume }, CC.genId('p'));
        Utils.toast(`✓ "${nome}" adicionada!`, 'sucesso');
      }
      Utils.fecharModal('modal-lc-peca');
      await carregar();
    } catch (e) {
      Utils.toast('Erro ao salvar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  async function excluirPeca(id) {
    const p = pecas.find(x => x.id === id);
    if (!p) return;
    const ok = await Utils.confirmar(`Excluir "${p.nome}"? Os vínculos com concretagens também serão removidos.`);
    if (!ok) return;
    Utils.mostrarLoading();
    try {
      const ops = [{ type: 'delete', ref: Database.ref(obraId, COL_PECAS).doc(id) }];
      pecaConc.filter(pc => pc.pecaId === id).forEach(pc => {
        ops.push({ type: 'delete', ref: Database.ref(obraId, COL_PC).doc(pc.id) });
      });
      await Database.batchWrite(ops);
      Utils.toast(`"${p.nome}" excluída.`, 'sucesso');
      await carregar();
    } catch (e) {
      Utils.toast('Erro ao excluir: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // Grava peças em lote (batches de 400)
  async function salvarPecasLote(itens) {
    for (let i = 0; i < itens.length; i += 400) {
      const chunk = itens.slice(i, i + 400);
      const ops = chunk.map(item => {
        const data = { nome: item.nome, tipo: item.tipo, andar: item.andar, volume: item.volume, obraId };
        if (item.subTipo) data.subTipo = item.subTipo;
        if (item.areaIsopor) data.areaIsopor = item.areaIsopor;
        if (item.metragemTrelica) data.metragemTrelica = item.metragemTrelica;
        return { type: 'set', ref: Database.ref(obraId, COL_PECAS).doc(CC.genId('p')), data };
      });
      await Database.batchWrite(ops);
    }
  }

  // ══════════════════════════════════════════
  // IMPORTAÇÃO EM LOTE
  // ══════════════════════════════════════════
  function abrirImportar() {
    previewImport = [];
    document.getElementById('lc-import-texto').value = '';
    document.getElementById('lc-import-preview').innerHTML = '';
    document.getElementById('lc-import-erro').style.display = 'none';
    document.getElementById('lc-import-btn').disabled = true;
    document.getElementById('lc-import-btn').textContent = '✓ Importar';
    Utils.abrirModal('modal-lc-importar');
  }

  function baixarModeloTSV() {
    const header = 'Nome\tTipo\tAndar\tVolume (m³)\n';
    const exemplo = 'Pilar P-01\tPilar\tTérreo\t1.5\nViga V-01\tViga\tTérreo\t2.8\nLaje L-01\tLaje\t1º Pavimento\t12.4';
    const blob = new Blob([header + exemplo], { type: 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'base_pecas.tsv'; a.click();
    URL.revokeObjectURL(url);
  }

  function parsearImport(txt) {
    const erroEl = document.getElementById('lc-import-erro');
    erroEl.style.display = 'none';
    const linhas = String(txt || '').trim().split(/\r?\n/).filter(l => l.trim());
    const ps = [];
    linhas.forEach((linha, i) => {
      if (i === 0 && linha.toLowerCase().includes('nome')) return;
      const cols = linha.split('\t').map(c => c.trim());
      const n = cols[0], t = cols[1], a = cols[2], vRaw = cols[3];
      if (!n || n === '') return;
      if (n.toLowerCase() === 'nome') return;
      const v = parseFloat((vRaw || '').replace(',', '.'));
      if (isNaN(v) || v <= 0) return;
      ps.push({ nome: n, tipo: t || 'Viga', andar: CC.normalizarAndar(a), volume: v });
    });
    previewImport = ps;
    renderPreviewImport();
    if (!ps.length && linhas.length) {
      erroEl.textContent = 'Nenhuma linha válida encontrada. Verifique o formato (colunas separadas por TAB).';
      erroEl.style.display = 'block';
    }
  }

  function renderPreviewImport() {
    const el = document.getElementById('lc-import-preview');
    const btn = document.getElementById('lc-import-btn');
    btn.disabled = !previewImport.length;
    btn.textContent = previewImport.length ? `✓ Importar ${previewImport.length} peças` : '✓ Importar';
    if (!previewImport.length) { el.innerHTML = ''; return; }
    el.innerHTML = `
      <div style="max-height:220px;overflow-y:auto;border:1px solid var(--cor-borda-light);border-radius:8px;margin-top:10px;">
        <table class="tabela">
          <thead><tr><th>#</th><th>Nome</th><th>Tipo</th><th>Andar</th><th class="col-num">m³</th></tr></thead>
          <tbody>${previewImport.map((p, i) => `
            <tr><td style="color:var(--cor-texto-muted);">${i + 1}</td><td style="font-weight:600;">${esc(p.nome)}</td><td>${esc(p.tipo)}</td><td>${esc(p.andar)}</td><td class="col-num" style="font-family:var(--font-mono);">${CC.fmt4(p.volume)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function onImportTexto() {
    parsearImport(document.getElementById('lc-import-texto').value);
  }

  function onImportArquivo(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const txt = e.target.result;
      // Detecta encoding quebrado (Latin-1) e relê com windows-1252
      if (txt.includes('\uFFFD') || /[\x80-\x9F]/.test(txt)) {
        const reader2 = new FileReader();
        reader2.onload = e2 => parsearImport(e2.target.result);
        reader2.readAsText(file, 'windows-1252');
        return;
      }
      parsearImport(txt);
    };
    reader.readAsText(file, 'UTF-8');
    input.value = '';
  }

  async function salvarImport() {
    if (!previewImport.length) return;
    Utils.mostrarLoading();
    try {
      await salvarPecasLote(previewImport);
      Utils.toast(`✓ ${previewImport.length} peças importadas!`, 'sucesso');
      previewImport = [];
      Utils.fecharModal('modal-lc-importar');
      await carregar();
    } catch (e) {
      Utils.toast('Erro ao importar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ══════════════════════════════════════════
  // CONCRETAGENS (wizard 4 steps)
  // ══════════════════════════════════════════
  function abrirConcretagens() {
    cw = { modo: 'menu', concSel: '' };
    renderConcretagem();
    Utils.abrirModal('modal-lc-conc');
  }

  function iniciarNovaConc() {
    cw = {
      modo: 'nova', step: 1,
      concId: CC.genId('c'),
      numero: String(concretagens.length + 1),
      data: Utils.hoje(),
      desc: '',
      vinculos: [],
      bts: [],
      filtroAndar: 'todos', filtroTipo: 'todos', busca: '', esconder100: false,
    };
    renderConcretagem();
  }

  function editarConcretagem(id) {
    // Chamado da tabela da página: abre o modal já em edição
    const c = concretagens.find(x => x.id === id);
    if (!c) return;
    cw = {
      modo: 'editar', step: 1,
      concId: c.id,
      numero: String(c.numero),
      data: c.data || '',
      desc: c.descricao || '',
      vinculos: pecaConc.filter(pc => pc.concretagemId === c.id).map(pc => ({ id: pc.id, pecaId: pc.pecaId, pctConcretagem: pc.pctConcretagem })),
      bts: btsConfig.filter(b => b.concretagemId === c.id).map(b => ({ ...b })),
      filtroAndar: 'todos', filtroTipo: 'todos', busca: '', esconder100: false,
    };
    renderConcretagem();
    Utils.abrirModal('modal-lc-conc');
  }

  function cwIniciarEditar() {
    if (!cw.concSel) { Utils.toast('Selecione uma concretagem para editar.', 'alerta'); return; }
    editarConcretagem(cw.concSel);
  }

  function cwSetConcSel(v) { cw.concSel = v; }

  async function excluirConcretagem(id) {
    const c = concretagens.find(x => x.id === id);
    if (!c) return;
    const ok = await Utils.confirmar(`Excluir Concretagem Nº${c.numero}? Isso removerá peças vinculadas, BTs configuradas e lançamentos desta concretagem.`);
    if (!ok) return;
    Utils.mostrarLoading();
    try {
      const ops = [{ type: 'delete', ref: Database.ref(obraId, COL_CONCS).doc(id) }];
      pecaConc.filter(pc => pc.concretagemId === id).forEach(pc =>
        ops.push({ type: 'delete', ref: Database.ref(obraId, COL_PC).doc(pc.id) }));
      btsConfig.filter(b => b.concretagemId === id).forEach(b =>
        ops.push({ type: 'delete', ref: Database.ref(obraId, COL_BTS).doc(b.id) }));
      lancamentos.filter(l => l.concretagemId === id).forEach(l =>
        ops.push({ type: 'delete', ref: Database.ref(obraId, COL_LANS).doc(l.id) }));
      for (let i = 0; i < ops.length; i += 400) {
        await Database.batchWrite(ops.slice(i, i + 400));
      }
      Utils.toast(`Concretagem Nº${c.numero} excluída.`, 'sucesso');
      Utils.fecharModal('modal-lc-conc');
      await carregar();
    } catch (e) {
      Utils.toast('Erro ao excluir: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  async function cwExcluirSelecionada() {
    if (!cw.concSel) { Utils.toast('Selecione uma concretagem para excluir.', 'alerta'); return; }
    await excluirConcretagem(cw.concSel);
  }

  function cwPctJaAlocado(pecaId) {
    return pecaConc
      .filter(pc => pc.pecaId === pecaId && pc.concretagemId !== cw.concId)
      .reduce((s, pc) => s + (parseFloat(pc.pctConcretagem) || 0), 0);
  }

  function renderConcretagem() {
    const el = document.getElementById('lc-conc-body');
    if (!el || !cw) return;

    if (cw.modo === 'menu') {
      el.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;" class="lc-menu-grid">
          <div class="cc-menuCard" style="text-align:center;" onclick="LC.iniciarNovaConc()">
            <div class="cc-menuCardIcon">＋</div>
            <div class="cc-menuCardTitle">Nova Concretagem</div>
            <div class="cc-menuCardSub">Criar do zero com peças e BTs</div>
          </div>
          <div class="cc-menuCard" style="text-align:center;cursor:default;">
            <div class="cc-menuCardIcon">✎</div>
            <div class="cc-menuCardTitle">Editar / Excluir</div>
            <select class="form-control mt-1" onchange="LC.cwSetConcSel(this.value)">
              <option value="">— selecione —</option>
              ${[...concretagens].sort((a, b) => a.numero - b.numero).map(c =>
                `<option value="${c.id}">Nº${c.numero} — ${esc(c.data || '')}${c.descricao ? ` | ${esc(c.descricao)}` : ''}</option>`).join('')}
            </select>
            <div style="display:flex;gap:8px;margin-top:10px;">
              <button class="btn btn-primario btn-sm" style="flex:1;" onclick="LC.cwIniciarEditar()">Editar →</button>
              <button class="btn btn-secundario btn-sm" style="color:var(--cv-red);" onclick="LC.cwExcluirSelecionada()">🗑</button>
            </div>
          </div>
        </div>`;
      return;
    }

    // Wizard
    const stepsHtml = `
      <div class="cc-steps">
        ${['Dados', 'Peças', 'BTs', 'Resumo'].map((label, i) => {
          const n = i + 1;
          const ativo = cw.step === n, feito = cw.step > n;
          return `<div class="cc-step ${ativo ? 'cc-stepActive' : ''} ${feito ? 'cc-stepDone' : ''}">
            <span class="cc-stepNum">${feito ? '✓' : n}</span>
            <span class="cc-stepLabel">${label}</span>
          </div>`;
        }).join('')}
      </div>`;

    if (cw.step === 1) {
      el.innerHTML = `${stepsHtml}
        <div class="form-row">
          <div class="form-grupo"><label>Número</label><input type="number" min="1" class="form-control" value="${esc(cw.numero)}" oninput="LC.cwUpd('numero', this.value)"></div>
          <div class="form-grupo"><label>Data</label><input type="date" class="form-control" value="${esc(cw.data)}" oninput="LC.cwUpd('data', this.value)"></div>
        </div>
        <div class="form-grupo"><label>Descrição</label><input type="text" class="form-control" placeholder="ex: Pilares Térreo eixos A-D" value="${esc(cw.desc)}" oninput="LC.cwUpd('desc', this.value)"></div>
        <div style="display:flex;justify-content:space-between;margin-top:14px;">
          <button class="btn btn-secundario" onclick="LC.cwVoltarMenu()">← Voltar</button>
          <button class="btn btn-primario" onclick="LC.cwStep1Next()">Próximo →</button>
        </div>`;
      return;
    }

    if (cw.step === 2) {
      const volTotal = cwVolTotalVinculos();
      const andares = ['todos', ...todosAndares()];
      const tipos = ['todos', ...[...new Set(pecas.map(p => p.tipo))].sort()];
      el.innerHTML = `${stepsHtml}
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px;">
          <span style="font-family:var(--font-mono);font-size:0.85rem;font-weight:700;color:var(--cor-primaria-dark,#b8960a);">${cw.vinculos.length} peças · ${CC.fmt4(volTotal)} m³</span>
          ${cw.filtroAndar !== 'todos' ? `<button class="btn btn-secundario btn-sm" onclick="LC.cwToggleAndar()">${cwAndarTodoMarcado() ? 'Desmarcar tudo do andar' : 'Marcar tudo do andar'}</button>` : ''}
        </div>
        <div class="form-row" style="margin-bottom:8px;">
          <select class="form-control" onchange="LC.cwUpdFiltro('filtroAndar', this.value)">
            ${andares.map(a => `<option value="${esc(a)}" ${cw.filtroAndar === a ? 'selected' : ''}>${a === 'todos' ? 'Todos os andares' : esc(a)}</option>`).join('')}
          </select>
          <select class="form-control" onchange="LC.cwUpdFiltro('filtroTipo', this.value)">
            ${tipos.map(t => `<option value="${esc(t)}" ${cw.filtroTipo === t ? 'selected' : ''}>${t === 'todos' ? 'Todos os tipos' : esc(t)}</option>`).join('')}
          </select>
        </div>
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
          <input type="text" class="form-control" style="flex:1;" placeholder="🔍 Buscar por nome..." value="${esc(cw.busca)}" oninput="LC.cwBusca(this.value)">
          <label style="display:flex;align-items:center;gap:5px;font-size:0.78rem;color:var(--cor-texto-muted);cursor:pointer;white-space:nowrap;">
            <input type="checkbox" ${cw.esconder100 ? 'checked' : ''} onchange="LC.cwUpdFiltro('esconder100', this.checked)"> Esconder 100%
          </label>
        </div>
        <div id="lc-cw-lista" style="max-height:300px;overflow-y:auto;border:1px solid var(--cor-borda-light);border-radius:8px;"></div>
        <div style="display:flex;justify-content:space-between;margin-top:14px;">
          <button class="btn btn-secundario" onclick="LC.cwSetStep(1)">← Voltar</button>
          <button class="btn btn-primario" onclick="LC.cwStep2Next()">Próximo →</button>
        </div>`;
      renderCwLista();
      return;
    }

    if (cw.step === 3) {
      const volTotal = cwVolTotalVinculos();
      const volBTs = cw.bts.reduce((s, b) => s + (parseFloat(b.volumePrevisto) || 0), 0);
      const btsOk = Math.abs(volBTs - volTotal) < 0.1;
      el.innerHTML = `${stepsHtml}
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
          <div style="font-family:var(--font-mono);font-size:0.85rem;">
            Volume concretagem: <b style="color:var(--cor-primaria-dark,#b8960a);">${CC.fmt4(volTotal)} m³</b>
            ${cw.bts.length ? ` · BTs: <b id="lc-cw-volbts" style="color:${btsOk ? '#16a34a' : '#ef4444'};">${CC.fmt4(volBTs)} m³</b>` : ''}
          </div>
          <button class="btn btn-secundario btn-sm" onclick="LC.cwAddBT()">+ Adicionar BT</button>
        </div>
        <div id="lc-cw-bts">
          ${!cw.bts.length ? `<div class="cc-empty">Clique em "+ Adicionar BT" para configurar as betonadas.</div>` :
          cw.bts.map((b, i) => `
            <div style="display:grid;grid-template-columns:70px 110px 1fr 1fr auto;gap:8px;margin-bottom:8px;align-items:end;" class="lc-bt-row">
              <div class="form-grupo" style="margin-bottom:0;"><label style="font-size:0.68rem;">BT Nº</label><input type="number" min="1" class="form-control" value="${esc(b.numero)}" oninput="LC.cwUpdBT(${i}, 'numero', this.value)"></div>
              <div class="form-grupo" style="margin-bottom:0;"><label style="font-size:0.68rem;">Volume (m³)</label><input type="number" step="0.5" min="0" class="form-control" value="${esc(b.volumePrevisto)}" oninput="LC.cwUpdBT(${i}, 'volumePrevisto', this.value)"></div>
              <div class="form-grupo" style="margin-bottom:0;"><label style="font-size:0.68rem;">Nota Fiscal</label><input type="text" class="form-control" placeholder="opcional" value="${esc(b.notaFiscal || '')}" oninput="LC.cwUpdBT(${i}, 'notaFiscal', this.value)"></div>
              <div class="form-grupo" style="margin-bottom:0;"><label style="font-size:0.68rem;">Código BT</label><input type="text" class="form-control" placeholder="opcional" value="${esc(b.codigoBT || '')}" oninput="LC.cwUpdBT(${i}, 'codigoBT', this.value)"></div>
              <button class="btn btn-secundario btn-sm" style="color:#ef4444;" onclick="LC.cwRemBT(${i})">✕</button>
            </div>`).join('')}
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:14px;">
          <button class="btn btn-secundario" onclick="LC.cwSetStep(2)">← Voltar</button>
          <button class="btn btn-primario" onclick="LC.cwSetStep(4)">Revisar →</button>
        </div>`;
      return;
    }

    // Step 4: resumo
    const volTotal = cwVolTotalVinculos();
    el.innerHTML = `${stepsHtml}
      <div class="cc-kpiGrid" style="grid-template-columns:1fr 1fr;margin-bottom:14px;">
        <div class="cc-kpi"><div class="cc-kpiIcon">◈</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Concretagem</div><div class="cc-kpiValue" style="font-size:18px;">Nº ${esc(cw.numero)}</div><div class="cc-kpiSub">${esc(cw.data)}${cw.desc ? ` · ${esc(cw.desc)}` : ''}</div></div></div>
        <div class="cc-kpi"><div class="cc-kpiIcon">📦</div><div class="cc-kpiBody"><div class="cc-kpiLabel">Volume Total</div><div class="cc-kpiValue">${CC.fmt4(volTotal)}<span class="cc-kpiUnit">m³</span></div><div class="cc-kpiSub">${cw.vinculos.length} peças · ${cw.bts.length} BTs</div></div></div>
      </div>
      <div style="margin-bottom:12px;">
        ${cw.vinculos.slice(0, 6).map(v => {
          const p = pecas.find(x => x.id === v.pecaId);
          if (!p) return '';
          return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--cor-borda-light);font-family:var(--font-mono);font-size:0.8rem;">
            <span>${esc(p.nome)} (${esc(p.andar)})</span>
            <span style="color:var(--cor-primaria-dark,#b8960a);">${v.pctConcretagem}% → ${CC.fmt4(((parseFloat(v.pctConcretagem) || 0) / 100) * p.volume)} m³</span>
          </div>`;
        }).join('')}
        ${cw.vinculos.length > 6 ? `<div style="font-family:var(--font-mono);font-size:0.75rem;color:var(--cor-texto-muted);margin-top:4px;">... e mais ${cw.vinculos.length - 6} peças</div>` : ''}
      </div>
      ${cw.bts.length ? `<div style="margin-bottom:12px;">
        ${cw.bts.map(b => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--cor-borda-light);font-family:var(--font-mono);font-size:0.8rem;">
          <span style="color:var(--cor-primaria-dark,#b8960a);">BT-${esc(b.numero)}</span>
          <span>${CC.fmt4(parseFloat(b.volumePrevisto) || 0)} m³${b.notaFiscal ? ` · NF:${esc(b.notaFiscal)}` : ''}</span>
        </div>`).join('')}
      </div>` : ''}
      <div style="display:flex;justify-content:space-between;margin-top:14px;">
        <button class="btn btn-secundario" onclick="LC.cwSetStep(3)">← Voltar</button>
        <button class="btn btn-primario" onclick="LC.cwSalvar()">✓ Salvar Concretagem</button>
      </div>`;
  }

  function cwVolTotalVinculos() {
    return cw.vinculos.reduce((s, v) => {
      const p = pecas.find(x => x.id === v.pecaId);
      return s + (p ? ((parseFloat(v.pctConcretagem) || 0) / 100) * p.volume : 0);
    }, 0);
  }

  function cwAndarTodoMarcado() {
    const ids = pecas.filter(p => p.andar === cw.filtroAndar).map(p => p.id);
    return ids.length > 0 && ids.every(id => cw.vinculos.find(v => v.pecaId === id));
  }

  function renderCwLista() {
    const el = document.getElementById('lc-cw-lista');
    if (!el || !cw) return;
    const busca = (cw.busca || '').toLowerCase();
    const visiveis = pecas.filter(p => {
      if (cw.filtroAndar !== 'todos' && p.andar !== cw.filtroAndar) return false;
      if (cw.filtroTipo !== 'todos' && p.tipo !== cw.filtroTipo) return false;
      if (busca && !p.nome.toLowerCase().includes(busca)) return false;
      if (cw.esconder100 && CC.pctConcretado(p, lancamentos) >= 100) return false;
      return true;
    });
    if (!visiveis.length) {
      el.innerHTML = `<div class="cc-empty">Nenhuma peça encontrada.</div>`;
      return;
    }
    el.innerHTML = visiveis.map(p => {
      const vinc = cw.vinculos.find(v => v.pecaId === p.id);
      const sel = !!vinc;
      const jaAlocado = cwPctJaAlocado(p.id);
      const disponivel = Math.max(0, 100 - jaAlocado);
      const bloqueada = !sel && disponivel <= 0;
      const concsComPeca = pecaConc.filter(pc => pc.pecaId === p.id && pc.concretagemId !== cw.concId);
      const nomesConc = concsComPeca.map(pc => {
        const c = concretagens.find(x => x.id === pc.concretagemId);
        return `Nº${c?.numero || '?'} (${CC.fmt1(parseFloat(pc.pctConcretagem) || 0)}%)`;
      }).join(', ');
      return `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--cor-borda-light);background:${sel ? 'var(--cor-primaria-light,#fef9e7)' : '#fff'};${bloqueada ? 'opacity:0.55;' : ''}">
          <div onclick="${bloqueada ? '' : `LC.cwTogglePeca('${p.id}')`}" style="width:20px;height:20px;border:2px solid ${sel ? 'var(--cor-primaria)' : 'var(--cor-borda-light)'};border-radius:5px;background:${sel ? 'var(--cor-primaria)' : 'transparent'};display:flex;align-items:center;justify-content:center;cursor:${bloqueada ? 'not-allowed' : 'pointer'};flex-shrink:0;font-size:0.75rem;color:#000;font-weight:700;">${sel ? '✓' : ''}</div>
          <div style="flex:1;cursor:${bloqueada ? 'not-allowed' : 'pointer'};" onclick="${bloqueada ? '' : `LC.cwTogglePeca('${p.id}')`}">
            <div style="font-weight:600;font-size:0.88rem;">${esc(p.nome)}</div>
            <div style="font-family:var(--font-mono);font-size:0.72rem;color:var(--cor-texto-muted);">${esc(p.tipo)} · ${esc(p.andar)} · ${CC.fmt4(p.volume)} m³</div>
            ${jaAlocado > 0 ? `<div style="font-size:0.7rem;color:${disponivel <= 0 ? '#ef4444' : 'var(--cor-primaria-dark,#b8960a)'};margin-top:2px;">
              ${disponivel <= 0 ? '⛔ 100% já alocado' : `${CC.fmt1(jaAlocado)}% em ${esc(nomesConc)} · disponível: ${CC.fmt1(disponivel)}%`}
            </div>` : ''}
          </div>
          ${sel ? `<div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
            <label style="font-family:var(--font-mono);font-size:0.7rem;color:var(--cor-texto-muted);">%</label>
            <input type="text" inputmode="numeric" value="${esc(vinc.pctConcretagem)}" style="width:58px;padding:5px 7px;border:1px solid var(--cor-primaria);border-radius:6px;font-family:var(--font-mono);font-size:0.82rem;color:var(--cor-primaria-dark,#b8960a);outline:none;"
              oninput="LC.cwSetPct('${p.id}', this.value)" onblur="LC.cwBlurPct('${p.id}', this)">
            <span id="lc-cw-vol-${p.id}" style="font-family:var(--font-mono);font-size:0.75rem;color:var(--cor-texto-muted);">${CC.fmt4(((parseFloat(vinc.pctConcretagem) || 0) / 100) * p.volume)} m³</span>
          </div>` : ''}
        </div>`;
    }).join('');
  }

  function cwUpd(campo, valor) { cw[campo] = valor; }
  function cwUpdFiltro(campo, valor) { cw[campo] = valor; renderConcretagem(); }
  function cwBusca(v) { cw.busca = v; renderCwLista(); }
  function cwSetStep(n) { cw.step = n; renderConcretagem(); }
  function cwVoltarMenu() { cw = { modo: 'menu', concSel: '' }; renderConcretagem(); }

  function cwStep1Next() {
    if (!cw.numero || !cw.data) { Utils.toast('Preencha número e data.', 'alerta'); return; }
    cwSetStep(2);
  }
  function cwStep2Next() {
    if (!cw.vinculos.length) { Utils.toast('Vincule ao menos 1 peça.', 'alerta'); return; }
    cwSetStep(3);
  }

  function cwTogglePeca(pecaId) {
    const idx = cw.vinculos.findIndex(v => v.pecaId === pecaId);
    if (idx >= 0) cw.vinculos.splice(idx, 1);
    else {
      const disponivel = Math.max(0, 100 - cwPctJaAlocado(pecaId));
      cw.vinculos.push({ pecaId, pctConcretagem: disponivel > 0 ? Math.min(100, disponivel) : 100 });
    }
    renderConcretagem();
  }

  function cwToggleAndar() {
    const ids = pecas.filter(p => p.andar === cw.filtroAndar).map(p => p.id);
    const todos = ids.every(id => cw.vinculos.find(v => v.pecaId === id));
    if (todos) {
      cw.vinculos = cw.vinculos.filter(v => !ids.includes(v.pecaId));
    } else {
      ids.filter(id => !cw.vinculos.find(v => v.pecaId === id)).forEach(id => {
        const disponivel = Math.max(0, 100 - cwPctJaAlocado(id));
        if (disponivel > 0) cw.vinculos.push({ pecaId: id, pctConcretagem: Math.min(100, disponivel) });
      });
    }
    renderConcretagem();
  }

  function cwSetPct(pecaId, val) {
    const v = val.replace(/[^0-9]/g, '');
    const vinc = cw.vinculos.find(x => x.pecaId === pecaId);
    if (!vinc) return;
    const n = parseFloat(v);
    vinc.pctConcretagem = v === '' ? '' : Math.min(isNaN(n) ? '' : n, 100);
    // Atualização parcial: só o m³ da linha (preserva foco)
    const p = pecas.find(x => x.id === pecaId);
    const volEl = document.getElementById('lc-cw-vol-' + pecaId);
    if (p && volEl) volEl.textContent = CC.fmt4(((parseFloat(vinc.pctConcretagem) || 0) / 100) * p.volume) + ' m³';
  }

  function cwBlurPct(pecaId, input) {
    const vinc = cw.vinculos.find(x => x.pecaId === pecaId);
    if (!vinc) return;
    const ja = cwPctJaAlocado(pecaId);
    const maxVal = Math.max(1, 100 - ja);
    const raw = parseFloat(input.value);
    const v = isNaN(raw) || raw < 1 ? 1 : Math.min(raw, maxVal);
    vinc.pctConcretagem = v;
    renderConcretagem();
  }

  function cwAddBT() {
    cw.bts.push({ id: '', numero: cw.bts.length + 1, volumePrevisto: 8, notaFiscal: '', codigoBT: '' });
    renderConcretagem();
  }
  function cwRemBT(i) { cw.bts.splice(i, 1); renderConcretagem(); }
  function cwUpdBT(i, f, v) {
    cw.bts[i][f] = v;
    // Atualiza só o total das BTs (preserva foco nos inputs)
    const totEl = document.getElementById('lc-cw-volbts');
    if (totEl) {
      const volTotal = cwVolTotalVinculos();
      const volBTs = cw.bts.reduce((s, b) => s + (parseFloat(b.volumePrevisto) || 0), 0);
      totEl.textContent = CC.fmt4(volBTs) + ' m³';
      totEl.style.color = Math.abs(volBTs - volTotal) < 0.1 ? '#16a34a' : '#ef4444';
    }
  }

  async function cwSalvar() {
    if (!cw.numero || !cw.data) { Utils.toast('Preencha número e data.', 'alerta'); return; }
    if (!cw.vinculos.length) { Utils.toast('Vincule ao menos 1 peça.', 'alerta'); return; }
    Utils.mostrarLoading();
    try {
      const ops = [];
      // Documento da concretagem
      ops.push({
        type: 'set',
        ref: Database.ref(obraId, COL_CONCS).doc(cw.concId),
        data: { numero: parseInt(cw.numero) || 0, data: cw.data, descricao: cw.desc || '', obraId },
      });
      // Em edição: remove todos os vínculos e BTs antigos e regrava
      if (cw.modo === 'editar') {
        pecaConc.filter(pc => pc.concretagemId === cw.concId).forEach(pc =>
          ops.push({ type: 'delete', ref: Database.ref(obraId, COL_PC).doc(pc.id) }));
        btsConfig.filter(b => b.concretagemId === cw.concId).forEach(b =>
          ops.push({ type: 'delete', ref: Database.ref(obraId, COL_BTS).doc(b.id) }));
      }
      cw.vinculos.forEach(v => {
        ops.push({
          type: 'set',
          ref: Database.ref(obraId, COL_PC).doc(CC.genId('pc')),
          data: { pecaId: v.pecaId, concretagemId: cw.concId, pctConcretagem: parseFloat(v.pctConcretagem) || 100, obraId },
        });
      });
      cw.bts.forEach(b => {
        // Preserva o id da BT em edição para não perder lançamentos vinculados
        const btId = b.id || CC.genId('bt');
        ops.push({
          type: 'set',
          ref: Database.ref(obraId, COL_BTS).doc(btId),
          data: {
            concretagemId: cw.concId,
            numero: parseInt(b.numero) || 0,
            volumePrevisto: parseFloat(b.volumePrevisto) || 0,
            notaFiscal: b.notaFiscal || '',
            codigoBT: b.codigoBT || '',
            obraId,
          },
        });
      });
      for (let i = 0; i < ops.length; i += 400) {
        await Database.batchWrite(ops.slice(i, i + 400));
      }
      Utils.toast(`✓ Concretagem Nº${cw.numero} salva!`, 'sucesso');
      Utils.fecharModal('modal-lc-conc');
      await carregar();
    } catch (e) {
      Utils.toast('Erro ao salvar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ══════════════════════════════════════════
  // CONFIG — ORDEM DOS ANDARES
  // ══════════════════════════════════════════
  function abrirConfig() {
    const daBase = [...new Set(pecas.map(p => p.andar))];
    cfgOrdem = CC.ordenarAndares([...new Set([...daBase, ...(config.andaresCustm || [])])], config.ordemAndares);
    cfgDragIdx = null;
    renderConfig();
    Utils.abrirModal('modal-lc-config');
  }

  function renderConfig() {
    const el = document.getElementById('lc-config-body');
    if (!el) return;
    const daBase = [...new Set(pecas.map(p => p.andar))];
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <span style="font-weight:600;font-size:0.9rem;">Ordem dos Andares</span>
        <button class="btn btn-secundario btn-sm" onclick="LC.cfgInverter()">⇅ Inverter ordem</button>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:10px;">
        <input type="text" id="lc-cfg-novo" class="form-control" style="flex:1;" placeholder="Adicionar andar (ex: 2º Subsolo, Cobertura...)" onkeydown="if(event.key==='Enter')LC.cfgAdicionar()">
        <button class="btn btn-primario btn-sm" onclick="LC.cfgAdicionar()">+ Adicionar</button>
      </div>
      <p class="text-sm text-muted mb-2">Arraste para reordenar · ▲▼ para mover · ✕ remove da lista</p>
      <div style="border:1px solid var(--cor-borda-light);border-radius:8px;margin-bottom:4px;">
        ${!cfgOrdem.length ? `<div class="cc-empty">Nenhum andar cadastrado ainda.</div>` :
        cfgOrdem.map((a, i) => `
          <div draggable="true"
            ondragstart="LC.cfgDragStart(${i})" ondragover="event.preventDefault();LC.cfgDragOver(${i})" ondragend="LC.cfgDragEnd()"
            style="display:flex;align-items:center;gap:10px;padding:9px 14px;${i < cfgOrdem.length - 1 ? 'border-bottom:1px solid var(--cor-borda-light);' : ''}background:${cfgDragIdx === i ? 'var(--cor-primaria-light,#fef9e7)' : '#fff'};cursor:grab;user-select:none;">
            <span style="color:var(--cor-texto-muted);">⠿</span>
            <span style="font-family:var(--font-mono);font-size:0.75rem;color:var(--cor-texto-muted);width:22px;text-align:right;">${i + 1}</span>
            <span style="flex:1;font-weight:600;font-size:0.88rem;">${esc(a)}</span>
            <button class="btn btn-secundario btn-sm" ${i === 0 ? 'disabled' : ''} onclick="LC.cfgMover(${i}, -1)">▲</button>
            <button class="btn btn-secundario btn-sm" ${i === cfgOrdem.length - 1 ? 'disabled' : ''} onclick="LC.cfgMover(${i}, 1)">▼</button>
            <button class="btn btn-secundario btn-sm" style="color:${daBase.includes(a) ? 'var(--cor-texto-muted)' : '#ef4444'};" title="${daBase.includes(a) ? 'Andar com peças cadastradas' : 'Remover andar'}" onclick="LC.cfgRemover('${esc(a).replace(/'/g, "\\'")}')">✕</button>
          </div>`).join('')}
      </div>`;
  }

  function cfgAdicionar() {
    const input = document.getElementById('lc-cfg-novo');
    const a = input.value.trim();
    if (!a || cfgOrdem.includes(a)) return;
    cfgOrdem.push(a);
    input.value = '';
    renderConfig();
  }

  async function cfgRemover(a) {
    const daBase = [...new Set(pecas.map(p => p.andar))];
    if (daBase.includes(a)) {
      const ok = await Utils.confirmar(`O andar "${a}" tem peças cadastradas. Remover da lista não exclui as peças — elas continuarão com este andar. Remover mesmo assim?`);
      if (!ok) return;
    } else {
      const ok = await Utils.confirmar(`Remover o andar "${a}" da lista?`);
      if (!ok) return;
    }
    cfgOrdem = cfgOrdem.filter(x => x !== a);
    renderConfig();
  }

  function cfgMover(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= cfgOrdem.length) return;
    [cfgOrdem[i], cfgOrdem[j]] = [cfgOrdem[j], cfgOrdem[i]];
    renderConfig();
  }

  function cfgInverter() { cfgOrdem.reverse(); renderConfig(); }
  function cfgDragStart(i) { cfgDragIdx = i; }
  function cfgDragOver(i) {
    if (cfgDragIdx === null || cfgDragIdx === i) return;
    const item = cfgOrdem.splice(cfgDragIdx, 1)[0];
    cfgOrdem.splice(i, 0, item);
    cfgDragIdx = i;
    renderConfig();
  }
  function cfgDragEnd() { cfgDragIdx = null; renderConfig(); }

  async function cfgSalvar() {
    const daBase = [...new Set(pecas.map(p => p.andar))];
    const andaresCustm = cfgOrdem.filter(a => !daBase.includes(a));
    Utils.mostrarLoading();
    try {
      config = { ...config, ordemAndares: cfgOrdem, andaresCustm };
      await db.collection('obras').doc(obraId).collection('config').doc('concreto').set(config, { merge: true });
      Utils.toast('✓ Configuração salva!', 'sucesso');
      Utils.fecharModal('modal-lc-config');
      renderizar();
    } catch (e) {
      Utils.toast('Erro ao salvar config: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  return {
    init, recarregar, renderizar,
    onFiltro,
    abrirCalculadora, calcTipoPeca, calcTipoPilar, calcTipoFundacao, calcTogglePreMoldada, calcVoltar, calcAbaEscada,
    updCalc, updCalcSilent, calcAdicionar,
    escAddLaje, escRemLaje, escUpdLaje,
    escAddPat, escRemPat, escUpdPat,
    escAddDeg, escRemDeg, escUpdDeg,
    abrirLevantamento, levToggle, levRemover, levEnviarBase,
    abrirNovaPeca, abrirEditarPeca, salvarPeca, excluirPeca,
    abrirImportar, baixarModeloTSV, onImportTexto, onImportArquivo, salvarImport,
    abrirConcretagens, iniciarNovaConc, editarConcretagem, excluirConcretagem,
    cwSetConcSel, cwIniciarEditar, cwExcluirSelecionada,
    cwUpd, cwUpdFiltro, cwBusca, cwSetStep, cwVoltarMenu, cwStep1Next, cwStep2Next,
    cwTogglePeca, cwToggleAndar, cwSetPct, cwBlurPct,
    cwAddBT, cwRemBT, cwUpdBT, cwSalvar,
    abrirConfig, cfgAdicionar, cfgRemover, cfgMover, cfgInverter,
    cfgDragStart, cfgDragOver, cfgDragEnd, cfgSalvar,
  };
})();

const LC = LevantamentoConcreto;

function onObraChanged() {
  LevantamentoConcreto.recarregar();
}

// ============================================
// Módulo: Controle de Porcelanatos
// Consolida Levantamento de Piso (pisoAreas) + Levantamento de Paredes
// (paredesAcabamentoPecas, só a fatia "revestimento" = porcelanato/cerâmica
// de parede) num controle só, agrupado por Torre → Andar → Apartamento,
// com controle de execução (apontamento diário de m² aplicado por item)
// e exportação de planilha.
//
// Dados lidos:
//   obras/{obraId}/pisoAreas + config/pisoArvore
//   obras/{obraId}/paredesAcabamentoPecas + config/paredesArvore + config/paredesConfig
// Dados próprios deste módulo:
//   obras/{obraId}/porcelanatosExecucoes   (apontamentos diários de execução)
//   obras/{obraId}/config/porcelanatosConfig  (% de perda)
//
// Observação importante: Piso e Paredes têm árvores de local INDEPENDENTES
// (nodeIds diferentes). O cruzamento por Torre/Andar/Apto aqui é feito pelo
// NOME do caminho na árvore (ex: "Torre A → Andar 3 → Apto 302"), não pelo
// nodeId. Se o mesmo apto tiver nomes escritos diferente nos dois módulos,
// aparece como dois grupos separados — não tem como adivinhar que é o mesmo.
// ============================================

const ControlePorcelanatos = (() => {
  const COL_AREAS_PISO = 'pisoAreas';
  const CONFIG_DOC_PISO = 'pisoArvore';
  const COL_ACAB_PAREDES = 'paredesAcabamentoPecas';
  const CONFIG_DOC_PAREDES = 'paredesArvore';
  const CONFIG_DOC_PAREDES_CALC = 'paredesConfig';
  const COL_EXECUCOES = 'porcelanatosExecucoes';
  const CONFIG_DOC_PROPRIO = 'porcelanatosConfig';

  const CFG_PAREDES_DEF = { vao_modo: 'desconto_total', vao_limite_x: 1.5, vao_valor_y: 1.0, ml_menor_que: 0.50, ml_percentual: 50 };

  let obraId = null;
  let arvorePiso = [];
  let areasPiso = [];
  let arvoreParedes = [];
  let pecasAcabParedes = [];
  let cfgParedesCalc = {};
  let execucoes = [];
  let config = { percentualPerda: 30 };
  let usouCacheNaUltimaCarga = false;

  let itensCache = [];

  // Filtros
  let filtroTorre = 'todas';
  let filtroAndar = 'todos';
  let filtroStatus = 'todos';
  let busca = '';
  let torresColapsadas = new Set();

  // Estado dos modais
  let execForm = null;      // {itemKey,itemLabel,planejado,data,m2,obs}
  let historicoItemKey = null;

  // ══════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════
  function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function fmt2(n) { return (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function fmt1(n) { return (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
  function num(v) { const n = parseFloat(String(v ?? '').replace(',', '.')); return isNaN(n) ? 0 : n; }
  function _ls(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
  function _norm(s) { return String(s || '').trim().toLowerCase().replace(/\s+/g, ' '); }

  // Busca sempre tentando o SERVIDOR primeiro (mesmo motivo de sempre: o app usa
  // cache offline do Firestore, e um .get() comum pode devolver dado velho).
  async function _getServerFirst(ref) {
    try {
      return await ref.get({ source: 'server' });
    } catch (e) {
      console.warn('Sem conexão com o servidor — usando cache local (pode estar desatualizado):', e.message);
      usouCacheNaUltimaCarga = true;
      try { return await ref.get({ source: 'cache' }); } catch (e2) { return await ref.get(); }
    }
  }

  // Genérico — funciona tanto pra pisoArvore quanto pra paredesArvore (mesmo formato: {id,nome,filhos}).
  function _acharNode(id, arvore) {
    function rec(nodes, path) {
      for (const n of nodes) {
        if (n.id === id) return { node: n, path: [...path, n.nome || '(sem nome)'] };
        const r = rec(n.filhos || [], [...path, n.nome || '(sem nome)']);
        if (r) return r;
      }
      return null;
    }
    return rec(arvore || [], []);
  }

  // Convenção esperada no campo "Tipo de Piso": "Nome do Piso - AxB".
  function _separarTipoEDimensao(tipoPiso) {
    const texto = String(tipoPiso || '').trim();
    const m = texto.match(/^(.*?)\s*-\s*([\d]+(?:[.,]\d+)?\s*[xX]\s*[\d]+(?:[.,]\d+)?)\s*$/);
    if (m) return { tipo: m[1].trim(), dimensao: m[2].replace(/\s+/g, '') };
    return { tipo: texto, dimensao: '' };
  }

  // Réplica do desconto de vão do Levantamento de Paredes (mesma regra, pra bater com os números lá).
  function _descontoVao(compV, altV, qtdV, cfg) {
    if (!(qtdV > 0 && compV > 0 && altV > 0)) return 0;
    if (cfg.vao_modo === 'nenhum') return 0;
    const areaUnitaria = compV * altV;
    const areaTotal = areaUnitaria * qtdV;
    const limX = num(cfg.vao_limite_x) || 1.5;
    const valY = num(cfg.vao_valor_y) || 1.0;
    if (cfg.vao_modo === 'desconto_total') return areaTotal;
    if (cfg.vao_modo === 'parcial_considera') return areaUnitaria > limX ? Math.max(0, (areaUnitaria - valY) * qtdV) : 0;
    if (cfg.vao_modo === 'parcial_desconta') return areaUnitaria > limX ? valY * qtdV : 0;
    if (cfg.vao_modo === 'maior_desconta_tudo') return areaUnitaria > limX ? areaTotal : 0;
    if (cfg.vao_modo === 'metade') return areaTotal / 2;
    return 0;
  }

  // m² de Revestimento de Parede de UMA face (já na versão "com ML equivalente",
  // igual ao total mostrado no próprio Levantamento de Paredes — assim os números batem).
  function _m2RevestimentoParede(p, cfg) {
    const compM = num(p.comprimento) / 100;
    const altM = num(p.altura) / 100;
    const areaBruta = compM * altM;
    const areaVaos = (p.vaos || []).reduce((s, v) => s + _descontoVao(num(v.comprimento) / 100, num(v.altura) / 100, num(v.qtd) || 1, cfg), 0);
    const areaLiquida = Math.max(0, areaBruta - areaVaos);
    const podeML = !!p.podeSerML;
    const mlPct = (num(cfg.ml_percentual) || 50) / 100;
    const ml = podeML ? Math.max(compM, altM) : 0;
    let pctRevest = 0;
    (p.acabamentos || []).forEach(a => { if (a.tipo === 'revestimento') pctRevest += (num(a.pct) / 100); });
    if (pctRevest <= 0) return 0;
    return podeML ? (ml * pctRevest * mlPct) : (areaLiquida * pctRevest);
  }

  function _statusInfo(pct) {
    if (pct >= 99.95) return { label: 'Concluído', cls: 'cc-badgeComplete', icone: '✓' };
    if (pct > 0.01) return { label: 'Em andamento', cls: 'cc-badgePartial', icone: '◐' };
    return { label: 'Pendente', cls: 'cc-badgePending', icone: '○' };
  }

  // ══════════════════════════════════════════
  // INIT / CARREGAMENTO
  // ══════════════════════════════════════════
  async function init() {
    const ok = await Utils.initPagina({ requireObra: true });
    if (!ok) return;
    obraId = Router.getObraId();
    if (!obraId) {
      document.getElementById('cp-content').innerHTML =
        `<div class="estado-vazio"><div class="icone">🧱</div><p>Selecione uma obra para acessar o controle de porcelanatos.</p></div>`;
      return;
    }
    document.addEventListener('keydown', e => { if (e.key === 'Escape') Utils.fecharTodosModais(); });
    await carregar();
  }

  async function _carregarTudo() {
    const refCfgProprio = db.collection('obras').doc(obraId).collection('config').doc(CONFIG_DOC_PROPRIO);
    const refCfgPiso = db.collection('obras').doc(obraId).collection('config').doc(CONFIG_DOC_PISO);
    const refCfgParedes = db.collection('obras').doc(obraId).collection('config').doc(CONFIG_DOC_PAREDES);
    const refCfgParedesCalc = db.collection('obras').doc(obraId).collection('config').doc(CONFIG_DOC_PAREDES_CALC);
    const refAreasPiso = db.collection('obras').doc(obraId).collection(COL_AREAS_PISO);
    const refAcabParedes = db.collection('obras').doc(obraId).collection(COL_ACAB_PAREDES);
    const refExecucoes = db.collection('obras').doc(obraId).collection(COL_EXECUCOES);

    const [cfgProprioSnap, cfgPisoSnap, cfgParedesSnap, cfgParedesCalcSnap, areasSnap, acabSnap, execSnap] = await Promise.all([
      _getServerFirst(refCfgProprio),
      _getServerFirst(refCfgPiso),
      _getServerFirst(refCfgParedes),
      _getServerFirst(refCfgParedesCalc),
      _getServerFirst(refAreasPiso),
      _getServerFirst(refAcabParedes),
      _getServerFirst(refExecucoes),
    ]);

    arvorePiso = (cfgPisoSnap.exists && Array.isArray(cfgPisoSnap.data().arvore)) ? cfgPisoSnap.data().arvore : [];
    arvoreParedes = (cfgParedesSnap.exists && Array.isArray(cfgParedesSnap.data().arvore)) ? cfgParedesSnap.data().arvore : [];
    cfgParedesCalc = Object.assign({}, CFG_PAREDES_DEF, cfgParedesCalcSnap.exists ? cfgParedesCalcSnap.data() : {});

    if (cfgProprioSnap.exists && typeof cfgProprioSnap.data().percentualPerda === 'number') {
      config.percentualPerda = cfgProprioSnap.data().percentualPerda;
    } else if (cfgPisoSnap.exists && typeof cfgPisoSnap.data().percentualPerda === 'number') {
      config.percentualPerda = cfgPisoSnap.data().percentualPerda; // herda valor legado do Piso, uma vez
    } else {
      config.percentualPerda = 30;
    }

    areasPiso = areasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    pecasAcabParedes = acabSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    execucoes = execSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async function carregar() {
    Utils.mostrarLoading('Carregando dados (do servidor)...');
    usouCacheNaUltimaCarga = false;
    try {
      await _carregarTudo();
      _buildItens();
      renderizar();
      if (usouCacheNaUltimaCarga) Utils.toast('Sem conexão com o servidor agora — mostrando dados do cache local (podem estar desatualizados).', 'alerta');
    } catch (e) {
      console.error('Erro ao carregar Controle de Porcelanatos:', e);
      Utils.toast('Erro ao carregar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  async function recarregar() { await carregar(); Utils.toast('Recarregado do servidor!', 'sucesso'); }

  // ══════════════════════════════════════════
  // CONSOLIDAÇÃO — junta Piso + Paredes(revestimento) num item só por linha,
  // com o caminho Torre → Andar → Apto de cada árvore.
  // ══════════════════════════════════════════
  function _caminhoTorreAndarApto(path) {
    // Convenção FIXA de profundidade — nível 0 = Torre, nível 1 = Andar, nível 2 = Apto —
    // sempre nesses índices, independente de quão mais profunda a árvore for depois disso.
    // Isso importa porque Piso e Paredes usam árvores INDEPENDENTES e não necessariamente
    // com a mesma profundidade: em Paredes é comum existir um nível de Cômodo dentro do
    // Apto (ex: Torre → Andar → Apto → Banheiro de Serviço), enquanto em Piso a área já
    // fica direto no Apto. Usar "os 2 últimos níveis" (como antes) fazia o Apto de Paredes
    // cair num nível diferente do de Piso — surgiam dois grupos de Torre que nunca se
    // encontravam. Qualquer coisa alem da profundidade 2 (o Cômodo) não é um novo nível
    // de agrupamento: vira só um prefixo no nome do Local do item.
    if (path.length >= 3) return { torre: path[0], andar: path[1], apto: path[2], subLocal: path.slice(3).join(' / ') };
    if (path.length === 2) return { torre: '(sem torre)', andar: path[0], apto: path[1], subLocal: '' };
    return { torre: '(sem torre)', andar: '(sem andar)', apto: path[0] || '(local removido)', subLocal: '' };
  }

  function _comSubLocal(subLocal, nomeLocal) {
    return subLocal ? (subLocal + ' · ' + (nomeLocal || '')) : (nomeLocal || '');
  }

  function _totalExecutado(itemKey) {
    return execucoes.filter(e => e.itemKey === itemKey).reduce((s, e) => s + (e.m2 || 0), 0);
  }

  function _buildItens() {
    const itens = [];

    areasPiso.forEach(a => {
      const r = _acharNode(a.nodeId, arvorePiso);
      const path = r ? r.path : ['(local removido)'];
      const { torre, andar, apto, subLocal } = _caminhoTorreAndarApto(path);
      const { tipo, dimensao } = _separarTipoEDimensao(a.tipoPiso);
      const itemKey = 'piso:' + a.id;
      const m2Plan = a.areaM2 || 0;
      const m2Exec = _totalExecutado(itemKey);
      itens.push({
        itemKey, fonte: 'piso',
        torre, andar, apto,
        local: _comSubLocal(subLocal, a.nome), localDetalhe: 'Piso',
        tipo, dimensao, m2Plan, m2Exec,
      });
    });

    pecasAcabParedes.forEach(p => {
      const m2Plan = _m2RevestimentoParede(p, cfgParedesCalc);
      if (m2Plan <= 0) return; // face sem % de revestimento não entra aqui (é gesso/reboco/pintura)
      const r = _acharNode(p.nodeId, arvoreParedes);
      const path = r ? r.path : ['(local removido)'];
      const { torre, andar, apto, subLocal } = _caminhoTorreAndarApto(path);
      const itemKey = 'parede:' + p.id;
      const m2Exec = _totalExecutado(itemKey);
      itens.push({
        itemKey, fonte: 'parede',
        torre, andar, apto,
        local: _comSubLocal(subLocal, p.nome || 'Face'), localDetalhe: 'Parede',
        tipo: 'Revestimento de Parede', dimensao: '', m2Plan, m2Exec,
      });
    });

    // Canonização — Piso e Paredes vêm de árvores INDEPENDENTES: é comum o mesmo
    // local estar escrito com maiúscula/minúscula ou espaço diferente em cada uma
    // (ex: "Torre" vs "torre ", "AP 1" vs "ap 1"). Sem isso, o agrupamento abaixo
    // (que compara string crua) tratava como locais diferentes e duplicava tudo.
    // Aqui, o primeiro nome visto pra cada combinação normalizada "vence" e todo
    // item equivalente passa a usar EXATAMENTE esse mesmo texto.
    const torreCanon = new Map(), andarCanon = new Map(), aptoCanon = new Map();
    function _canon(mapa, chave, valorBruto) {
      if (!mapa.has(chave)) mapa.set(chave, valorBruto);
      return mapa.get(chave);
    }
    itens.forEach(it => {
      const kTorre = _norm(it.torre);
      it.torre = _canon(torreCanon, kTorre, it.torre);
      const kAndar = kTorre + '»' + _norm(it.andar);
      it.andar = _canon(andarCanon, kAndar, it.andar);
      const kApto = kAndar + '»' + _norm(it.apto);
      it.apto = _canon(aptoCanon, kApto, it.apto);
    });

    itens.forEach(it => {
      it.m2ComPerda = it.m2Plan * (1 + (config.percentualPerda || 0) / 100);
      it.pct = it.m2Plan > 0 ? (it.m2Exec / it.m2Plan) * 100 : (it.m2Exec > 0 ? 100 : 0);
      it.status = _statusInfo(it.pct);
    });

    itens.sort((a, b) =>
      a.torre.localeCompare(b.torre, 'pt-BR', { numeric: true }) ||
      a.andar.localeCompare(b.andar, 'pt-BR', { numeric: true }) ||
      a.apto.localeCompare(b.apto, 'pt-BR', { numeric: true }) ||
      a.local.localeCompare(b.local, 'pt-BR', { numeric: true }));

    itensCache = itens;
  }

  function _itensFiltrados() {
    return itensCache.filter(it => {
      if (filtroTorre !== 'todas' && it.torre !== filtroTorre) return false;
      if (filtroAndar !== 'todos' && it.andar !== filtroAndar) return false;
      if (filtroStatus !== 'todos' && it.status.label !== filtroStatus) return false;
      if (busca) {
        const hay = _norm(it.apto + ' ' + it.andar + ' ' + it.torre + ' ' + it.local + ' ' + it.tipo);
        if (!hay.includes(_norm(busca))) return false;
      }
      return true;
    });
  }

  // Agrupa itens (já filtrados) em Torre → Andar → Apto, na ordem alfabética/numérica.
  function _agrupar(itens) {
    const torres = [];
    const mapaTorres = new Map();
    itens.forEach(it => {
      if (!mapaTorres.has(it.torre)) { const g = { nome: it.torre, andares: [], mapaAndares: new Map() }; mapaTorres.set(it.torre, g); torres.push(g); }
      const gt = mapaTorres.get(it.torre);
      if (!gt.mapaAndares.has(it.andar)) { const g = { nome: it.andar, aptos: [], mapaAptos: new Map() }; gt.mapaAndares.set(it.andar, g); gt.andares.push(g); }
      const ga = gt.mapaAndares.get(it.andar);
      if (!ga.mapaAptos.has(it.apto)) { const g = { nome: it.apto, itens: [] }; ga.mapaAptos.set(it.apto, g); ga.aptos.push(g); }
      ga.mapaAptos.get(it.apto).itens.push(it);
    });
    torres.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }));
    torres.forEach(t => t.andares.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true })));
    torres.forEach(t => t.andares.forEach(a => a.aptos.sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR', { numeric: true }))));
    return torres;
  }

  function _somaItens(itens) {
    return itens.reduce((t, it) => ({
      m2Plan: t.m2Plan + it.m2Plan, m2ComPerda: t.m2ComPerda + it.m2ComPerda, m2Exec: t.m2Exec + it.m2Exec,
    }), { m2Plan: 0, m2ComPerda: 0, m2Exec: 0 });
  }

  // ══════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════
  function renderizar() {
    const actions = document.getElementById('cp-header-actions');
    if (actions) actions.innerHTML = `
      <button class="btn btn-secundario btn-sm" onclick="ControlePorcelanatos.recarregar()" title="Buscar de novo do servidor (ignora cache local)">🔄 Recarregar</button>
      <button class="btn btn-secundario btn-sm" data-perm="controlePorcelanatos:editar" onclick="ControlePorcelanatos.abrirConfig()" title="Configurar % de perda usado na planilha">⚙️ Config</button>
      <button class="btn btn-primario btn-sm" data-perm="controlePorcelanatos:exportar" onclick="ControlePorcelanatos.exportarPlanilha()">📊 Exportar Planilha</button>
    `;

    const el = document.getElementById('cp-content');
    if (!el) return;

    if (!itensCache.length) {
      el.innerHTML = `
        <div class="cc-view">
        <div class="page-header"><div><h2>🧱 Controle de Porcelanatos</h2></div></div>
        <div class="estado-vazio"><div class="icone">🧱</div><p>Nenhuma área de piso ou face de revestimento de parede encontrada ainda. Meça alguma coisa no Levantamento de Piso ou de Paredes primeiro.</p></div>
        </div>
      `;
      Permissions.aplicarNaTela();
      return;
    }

    const itens = _itensFiltrados();
    const totGeral = _somaItens(itensCache);
    const totPiso = _somaItens(itensCache.filter(i => i.fonte === 'piso'));
    const totParede = _somaItens(itensCache.filter(i => i.fonte === 'parede'));
    const pctGeral = totGeral.m2Plan > 0 ? (totGeral.m2Exec / totGeral.m2Plan) * 100 : 0;
    const concluidos = itensCache.filter(i => i.status.label === 'Concluído').length;

    const torresOpts = [...new Set(itensCache.map(i => i.torre))].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
    const andaresOpts = [...new Set(itensCache.filter(i => filtroTorre === 'todas' || i.torre === filtroTorre).map(i => i.andar))].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));

    const grupos = _agrupar(itens);

    // IMPORTANTE: tudo abaixo vive dentro de UM ÚNICO wrapper (.cc-view).
    // #cp-content é filho de `.content` (flex-column + `.content > div{min-height:0}`
    // global, pensado pro Gantt do Planejamento). Se cada seção (kpis, filtros, cada
    // Torre) fosse um <div> direto solto aqui, o flexbox espremia CADA UMA na hora de
    // sobrar pouco espaço (obra com muitos itens) — e como o conteúdo real (texto)
    // não encolhe, tudo passava a se sobrepor visualmente. Com um wrapper só, é ele
    // que "encolhe" (sem problema, o scroll do `.content` mede o conteúdo real, não
    // a altura encolhida da caixa) e as seções internas nunca competem entre si.
    el.innerHTML = `
      <div class="cc-view">
      <div class="page-header">
        <div>
          <h2>🧱 Controle de Porcelanatos</h2>
          <span class="subtitulo">${itensCache.length} item(ns) · ${torresOpts.length} torre(s)/agrupamento(s)</span>
        </div>
      </div>

      <div class="cc-kpiGrid">
        <div class="cc-kpi"><div class="cc-kpiBody"><div class="cc-kpiLabel">Piso planejado</div><div class="cc-kpiValue">${fmt2(totPiso.m2Plan)}<span class="cc-kpiUnit">m²</span></div></div></div>
        <div class="cc-kpi"><div class="cc-kpiBody"><div class="cc-kpiLabel">Parede (revest.) planejado</div><div class="cc-kpiValue">${fmt2(totParede.m2Plan)}<span class="cc-kpiUnit">m²</span></div></div></div>
        <div class="cc-kpi cc-kpiBlue"><div class="cc-kpiBody"><div class="cc-kpiLabel">Total planejado</div><div class="cc-kpiValue">${fmt2(totGeral.m2Plan)}<span class="cc-kpiUnit">m²</span></div></div></div>
        <div class="cc-kpi cc-kpiGreen"><div class="cc-kpiBody"><div class="cc-kpiLabel">Executado</div><div class="cc-kpiValue">${fmt2(totGeral.m2Exec)}<span class="cc-kpiUnit">m²</span></div></div></div>
        <div class="cc-kpi cc-kpiOrange"><div class="cc-kpiBody"><div class="cc-kpiLabel">% de avanço</div><div class="cc-kpiValue">${fmt1(pctGeral)}<span class="cc-kpiUnit">%</span></div></div></div>
        <div class="cc-kpi cc-kpiPurple"><div class="cc-kpiBody"><div class="cc-kpiLabel">Itens concluídos</div><div class="cc-kpiValue">${concluidos}<span class="cc-kpiUnit">/ ${itensCache.length}</span></div></div></div>
      </div>

      <div class="cc-panel" style="margin-bottom:16px;">
        <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;">
          <div class="form-grupo" style="margin:0;min-width:160px;">
            <label style="font-size:11px;">Torre</label>
            <select class="form-control" onchange="ControlePorcelanatos.setFiltroTorre(this.value)">
              <option value="todas" ${filtroTorre === 'todas' ? 'selected' : ''}>Todas</option>
              ${torresOpts.map(t => `<option value="${esc(t)}" ${filtroTorre === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}
            </select>
          </div>
          <div class="form-grupo" style="margin:0;min-width:160px;">
            <label style="font-size:11px;">Andar</label>
            <select class="form-control" onchange="ControlePorcelanatos.setFiltroAndar(this.value)">
              <option value="todos" ${filtroAndar === 'todos' ? 'selected' : ''}>Todos</option>
              ${andaresOpts.map(a => `<option value="${esc(a)}" ${filtroAndar === a ? 'selected' : ''}>${esc(a)}</option>`).join('')}
            </select>
          </div>
          <div class="form-grupo" style="margin:0;min-width:160px;">
            <label style="font-size:11px;">Status</label>
            <select class="form-control" onchange="ControlePorcelanatos.setFiltroStatus(this.value)">
              <option value="todos" ${filtroStatus === 'todos' ? 'selected' : ''}>Todos</option>
              <option value="Pendente" ${filtroStatus === 'Pendente' ? 'selected' : ''}>Pendente</option>
              <option value="Em andamento" ${filtroStatus === 'Em andamento' ? 'selected' : ''}>Em andamento</option>
              <option value="Concluído" ${filtroStatus === 'Concluído' ? 'selected' : ''}>Concluído</option>
            </select>
          </div>
          <div class="form-grupo" style="margin:0;flex:1;min-width:200px;">
            <label style="font-size:11px;">Buscar (apto, andar, torre, local...)</label>
            <input type="text" class="form-control" value="${esc(busca)}" placeholder="Ex: Apto 302, Torre A..." oninput="ControlePorcelanatos.setBusca(this.value)">
          </div>
          <button class="btn btn-secundario btn-sm" onclick="ControlePorcelanatos.limparFiltros()">Limpar filtros</button>
        </div>
      </div>

      ${!itens.length ? `<div class="estado-vazio"><div class="icone">🔍</div><p>Nenhum item bate com os filtros atuais.</p></div>` : grupos.map(_renderTorre).join('')}
      </div>
    `;
    Permissions.aplicarNaTela();
  }

  function _renderTorre(g) {
    const itensTorre = g.andares.flatMap(a => a.aptos.flatMap(ap => ap.itens));
    const tot = _somaItens(itensTorre);
    const pct = tot.m2Plan > 0 ? (tot.m2Exec / tot.m2Plan) * 100 : 0;
    const colapsada = torresColapsadas.has(g.nome);
    return `
      <div class="cc-panel" style="padding:0;overflow:hidden;">
        <div style="padding:14px 18px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;background:var(--cv-surface2);" onclick="ControlePorcelanatos.toggleTorre(${esc(JSON.stringify(g.nome))})">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:14px;">${colapsada ? '▶' : '▼'}</span>
            <strong style="font-size:15px;">🏢 ${esc(g.nome)}</strong>
            <span class="text-sm text-muted">${itensTorre.length} item(ns)</span>
          </div>
          <div style="display:flex;align-items:center;gap:14px;">
            <span class="text-sm text-muted">${fmt2(tot.m2Exec)} / ${fmt2(tot.m2Plan)} m²</span>
            <div class="barra-progresso" style="width:120px;"><div class="barra-progresso-fill" style="width:${Math.min(100, pct)}%;"></div></div>
            <span style="font-weight:700;min-width:48px;text-align:right;">${fmt1(pct)}%</span>
          </div>
        </div>
        ${colapsada ? '' : `<div style="padding:14px 18px;">${g.andares.map(_renderAndar).join('')}</div>`}
      </div>
    `;
  }

  function _renderAndar(g) {
    const itensAndar = g.aptos.flatMap(ap => ap.itens);
    const tot = _somaItens(itensAndar);
    const pct = tot.m2Plan > 0 ? (tot.m2Exec / tot.m2Plan) * 100 : 0;
    return `
      <div style="margin-bottom:18px;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1.5px solid var(--cv-border2);margin-bottom:8px;">
          <strong style="font-size:13px;">📶 ${esc(g.nome)}</strong>
          <span class="text-sm text-muted">${fmt2(tot.m2Exec)} / ${fmt2(tot.m2Plan)} m² · ${fmt1(pct)}%</span>
        </div>
        ${g.aptos.map(_renderApto).join('')}
      </div>
    `;
  }

  function _renderApto(g) {
    const tot = _somaItens(g.itens);
    const pct = tot.m2Plan > 0 ? (tot.m2Exec / tot.m2Plan) * 100 : 0;
    return `
      <div style="margin-bottom:12px;margin-left:8px;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:var(--cv-surface2);border-radius:8px 8px 0 0;">
          <strong style="font-size:12.5px;">🚪 ${esc(g.nome)}</strong>
          <span class="text-sm text-muted">${fmt2(tot.m2Exec)} / ${fmt2(tot.m2Plan)} m² (c/ perda: ${fmt2(tot.m2ComPerda)}) · ${fmt1(pct)}%</span>
        </div>
        <div class="cc-tableWrap">
          <table class="cc-table">
            <thead><tr>
              <th>Local</th><th>Tipo</th><th>Tipo/Modelo</th><th>Dimensões</th>
              <th class="col-num">M²</th><th class="col-num">M² c/ perda</th><th class="col-num">Executado</th>
              <th class="col-num">%</th><th>Status</th><th></th>
            </tr></thead>
            <tbody>
              ${g.itens.map(it => `
                <tr>
                  <td>${esc(it.local)}</td>
                  <td>${it.localDetalhe === 'Piso' ? '◻️ Piso' : '◽ Parede'}</td>
                  <td>${esc(it.tipo)}</td>
                  <td>${esc(it.dimensao)}</td>
                  <td class="col-num cc-tdMono">${fmt2(it.m2Plan)}</td>
                  <td class="col-num cc-tdMuted">${fmt2(it.m2ComPerda)}</td>
                  <td class="col-num cc-tdMono">${fmt2(it.m2Exec)}${it.pct > 100.5 ? ' ⚠' : ''}</td>
                  <td class="col-num">${fmt1(it.pct)}%</td>
                  <td><span class="cc-badge ${it.status.cls}">${it.status.icone} ${it.status.label}</span></td>
                  <td style="white-space:nowrap;">
                    <button class="btn btn-secundario btn-sm" data-perm="controlePorcelanatos:criar" title="Apontar execução" onclick="ControlePorcelanatos.abrirExecucao(${esc(JSON.stringify(it.itemKey))})">📝</button>
                    <button class="btn btn-secundario btn-sm" title="Histórico de apontamentos" onclick="ControlePorcelanatos.abrirHistorico(${esc(JSON.stringify(it.itemKey))})">🗒️</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ══════════════════════════════════════════
  // FILTROS
  // ══════════════════════════════════════════
  function setFiltroTorre(v) { filtroTorre = v; filtroAndar = 'todos'; renderizar(); }
  function setFiltroAndar(v) { filtroAndar = v; renderizar(); }
  function setFiltroStatus(v) { filtroStatus = v; renderizar(); }
  function setBusca(v) { busca = v; renderizar(); }
  function limparFiltros() { filtroTorre = 'todas'; filtroAndar = 'todos'; filtroStatus = 'todos'; busca = ''; renderizar(); }
  function toggleTorre(nome) { if (torresColapsadas.has(nome)) torresColapsadas.delete(nome); else torresColapsadas.add(nome); renderizar(); }

  // ══════════════════════════════════════════
  // CONFIGURAÇÃO — % de perda
  // ══════════════════════════════════════════
  function abrirConfig() {
    if (!Permissions.pode('controlePorcelanatos', 'editar')) { Utils.toast('Sem permissão para editar configurações.', 'alerta'); return; }
    document.getElementById('cp-config-percentual-perda').value = config.percentualPerda;
    Utils.abrirModal('modal-cp-config');
  }

  async function salvarConfig() {
    if (!Permissions.pode('controlePorcelanatos', 'editar')) { Utils.toast('Sem permissão para editar configurações.', 'alerta'); return; }
    const valor = Utils.parseNum(document.getElementById('cp-config-percentual-perda').value);
    if (valor < 0 || valor > 100) { Utils.toast('Informe um percentual entre 0 e 100.', 'alerta'); return; }
    try {
      Utils.mostrarLoading('Salvando configuração...');
      await db.collection('obras').doc(obraId).collection('config').doc(CONFIG_DOC_PROPRIO).set({ percentualPerda: valor }, { merge: true });
      config.percentualPerda = valor;
      _buildItens();
      Utils.fecharModal('modal-cp-config');
      Utils.toast('Configuração salva!', 'sucesso');
      renderizar();
    } catch (e) {
      console.error('Erro ao salvar configuração:', e);
      Utils.toast('Erro ao salvar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ══════════════════════════════════════════
  // EXECUÇÃO — apontamento diário de m² aplicado, por item
  // ══════════════════════════════════════════
  function abrirExecucao(itemKey) {
    if (!Permissions.pode('controlePorcelanatos', 'criar')) { Utils.toast('Sem permissão para apontar execução.', 'alerta'); return; }
    const it = itensCache.find(i => i.itemKey === itemKey);
    if (!it) { Utils.toast('Item não encontrado (pode ter sido excluído no levantamento de origem).', 'alerta'); return; }
    execForm = { itemKey, data: Utils.hoje(), m2: '', obs: '' };
    document.getElementById('cp-exec-titulo').textContent = `📝 Apontar Execução — ${it.apto} · ${it.local} (${it.localDetalhe})`;
    document.getElementById('cp-exec-info').textContent = `Planejado: ${fmt2(it.m2Plan)} m² · Já executado: ${fmt2(it.m2Exec)} m² (${fmt1(it.pct)}%)`;
    document.getElementById('cp-exec-data').value = execForm.data;
    document.getElementById('cp-exec-m2').value = '';
    document.getElementById('cp-exec-obs').value = '';
    Utils.abrirModal('modal-cp-execucao');
  }

  function preencherRestante() {
    const it = itensCache.find(i => i.itemKey === execForm?.itemKey);
    if (!it) return;
    const restante = Math.max(0, it.m2Plan - it.m2Exec);
    document.getElementById('cp-exec-m2').value = restante.toFixed(2).replace('.', ',');
  }

  async function salvarExecucao() {
    if (!Permissions.pode('controlePorcelanatos', 'criar')) { Utils.toast('Sem permissão para apontar execução.', 'alerta'); return; }
    if (!execForm) return;
    const data = document.getElementById('cp-exec-data').value;
    const m2 = Utils.parseNum(document.getElementById('cp-exec-m2').value);
    const obs = document.getElementById('cp-exec-obs').value || '';
    if (!data) { Utils.toast('Informe a data.', 'alerta'); return; }
    if (!(m2 > 0)) { Utils.toast('Informe um m² executado maior que zero.', 'alerta'); return; }
    try {
      Utils.mostrarLoading('Salvando apontamento...');
      await Database.criar(obraId, COL_EXECUCOES, { itemKey: execForm.itemKey, data, m2, obs });
      Utils.fecharModal('modal-cp-execucao');
      Utils.toast('Execução apontada!', 'sucesso');
      await carregar();
    } catch (e) {
      console.error('Erro ao salvar execução:', e);
      Utils.toast('Erro ao salvar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  function abrirHistorico(itemKey) {
    historicoItemKey = itemKey;
    _renderHistorico();
    Utils.abrirModal('modal-cp-historico');
  }

  function _renderHistorico() {
    const it = itensCache.find(i => i.itemKey === historicoItemKey);
    const lista = execucoes.filter(e => e.itemKey === historicoItemKey).sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    document.getElementById('cp-hist-titulo').textContent = it ? `🗒️ Histórico — ${it.apto} · ${it.local}` : '🗒️ Histórico';
    document.getElementById('cp-hist-info').textContent = it ? `Planejado: ${fmt2(it.m2Plan)} m² · Total executado: ${fmt2(it.m2Exec)} m² (${fmt1(it.pct)}%)` : '';
    const body = document.getElementById('cp-hist-lista');
    if (!lista.length) {
      body.innerHTML = `<div class="estado-vazio" style="padding:20px;"><p>Nenhum apontamento registrado ainda.</p></div>`;
      return;
    }
    body.innerHTML = `
      <table class="cc-table">
        <thead><tr><th>Data</th><th class="col-num">M²</th><th>Obs.</th><th></th></tr></thead>
        <tbody>
          ${lista.map(e => `
            <tr>
              <td>${e.data ? new Date(e.data + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</td>
              <td class="col-num cc-tdMono">${fmt2(e.m2)}</td>
              <td>${esc(e.obs || '')}</td>
              <td><button class="btn btn-secundario btn-sm" data-perm="controlePorcelanatos:excluir" onclick="ControlePorcelanatos.excluirApontamento('${e.id}')">🗑️</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    Permissions.aplicarNaTela();
  }

  async function excluirApontamento(id) {
    if (!Permissions.pode('controlePorcelanatos', 'excluir')) { Utils.toast('Sem permissão para excluir.', 'alerta'); return; }
    if (!Utils.confirmar('Excluir este apontamento de execução?')) return;
    try {
      Utils.mostrarLoading('Excluindo...');
      await Database.deletar(obraId, COL_EXECUCOES, id);
      await _carregarTudo();
      _buildItens();
      _renderHistorico();
      renderizar();
      Utils.toast('Apontamento excluído.', 'sucesso');
    } catch (e) {
      console.error('Erro ao excluir apontamento:', e);
      Utils.toast('Erro ao excluir: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ══════════════════════════════════════════
  // EXPORTAR PLANILHA (XLSX) — linhas + resumo por Torre/Andar/Apto.
  // Sempre busca do servidor de novo antes de exportar.
  // ══════════════════════════════════════════
  async function exportarPlanilha() {
    if (!Permissions.pode('controlePorcelanatos', 'exportar')) { Utils.toast('Sem permissão para exportar.', 'alerta'); return; }
    try {
      Utils.mostrarLoading('Buscando dados atualizados e gerando planilha...');
      await _carregarTudo();
      _buildItens();
      if (!itensCache.length) { Utils.toast('Nenhum item medido ainda.', 'alerta'); return; }

      if (typeof XLSX === 'undefined') await _ls('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');

      const obra = Router.getObra();
      const nomeObra = (obra?.nome || 'Obra sem nome').toUpperCase();
      const dataExp = new Date().toLocaleDateString('pt-BR');
      const perda = config.percentualPerda || 0;

      // --- Aba 1: Detalhado (uma linha por item) ---
      const H1 = ['Torre', 'Andar', 'Apartamento', 'Local', 'Local (Nº Parede ou Piso)', 'Tipo', 'Dimensões', 'M²', `M² com perda de ${perda}%`, 'M² Executado', '% Executado', 'Status'];
      const rows1 = itensCache.map(it => [
        it.torre, it.andar, it.apto, it.local, it.localDetalhe, it.tipo, it.dimensao,
        it.m2Plan, it.m2ComPerda, it.m2Exec, Math.round(it.pct * 10) / 10, it.status.label,
      ]);
      const totGeral = _somaItens(itensCache);
      rows1.push(['', '', '', '', '', '', 'TOTAL GERAL', totGeral.m2Plan, totGeral.m2ComPerda, totGeral.m2Exec, totGeral.m2Plan > 0 ? Math.round((totGeral.m2Exec / totGeral.m2Plan) * 1000) / 10 : 0, '']);

      const ncols1 = H1.length;
      const aoa1 = [[nomeObra], ['Controle de Porcelanatos — Detalhado — Exportado em ' + dataExp], [], H1, ...rows1];
      const ws1 = XLSX.utils.aoa_to_sheet(aoa1);
      ws1['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: ncols1 - 1 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: ncols1 - 1 } }];
      ws1['!rows'] = [{ hpx: 34 }, { hpx: 20 }, { hpx: 8 }];
      if (ws1['A1']) ws1['A1'].s = { font: { bold: true, sz: 20 }, alignment: { horizontal: 'center', vertical: 'center' } };
      if (ws1['A2']) ws1['A2'].s = { font: { bold: true, sz: 12, color: { rgb: '8a6d00' } }, alignment: { horizontal: 'center' } };
      ws1['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 20 }, { wch: 18 }, { wch: 24 }, { wch: 14 }, { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 14 }];

      // --- Aba 2: Resumo por Torre/Andar/Apto ---
      const resumoMap = new Map();
      itensCache.forEach(it => {
        const k = it.torre + '»' + it.andar + '»' + it.apto;
        if (!resumoMap.has(k)) resumoMap.set(k, { torre: it.torre, andar: it.andar, apto: it.apto, m2Piso: 0, m2Parede: 0, m2Exec: 0 });
        const r = resumoMap.get(k);
        if (it.fonte === 'piso') r.m2Piso += it.m2Plan; else r.m2Parede += it.m2Plan;
        r.m2Exec += it.m2Exec;
      });
      const resumoRows = [...resumoMap.values()].sort((a, b) =>
        a.torre.localeCompare(b.torre, 'pt-BR', { numeric: true }) || a.andar.localeCompare(b.andar, 'pt-BR', { numeric: true }) || a.apto.localeCompare(b.apto, 'pt-BR', { numeric: true }))
        .map(r => {
          const total = r.m2Piso + r.m2Parede;
          const pct = total > 0 ? Math.round((r.m2Exec / total) * 1000) / 10 : 0;
          return [r.torre, r.andar, r.apto, r.m2Piso, r.m2Parede, total, r.m2Exec, pct];
        });
      const H2 = ['Torre', 'Andar', 'Apartamento', 'M² Piso', 'M² Parede (Revest.)', 'M² Total', 'M² Executado', '% Avanço'];
      const aoa2 = [[nomeObra], ['Controle de Porcelanatos — Resumo por Local — Exportado em ' + dataExp], [], H2, ...resumoRows];
      const ws2 = XLSX.utils.aoa_to_sheet(aoa2);
      const ncols2 = H2.length;
      ws2['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: ncols2 - 1 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: ncols2 - 1 } }];
      ws2['!rows'] = [{ hpx: 34 }, { hpx: 20 }, { hpx: 8 }];
      if (ws2['A1']) ws2['A1'].s = { font: { bold: true, sz: 20 }, alignment: { horizontal: 'center', vertical: 'center' } };
      if (ws2['A2']) ws2['A2'].s = { font: { bold: true, sz: 12, color: { rgb: '8a6d00' } }, alignment: { horizontal: 'center' } };
      ws2['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 12 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws1, 'Detalhado');
      XLSX.utils.book_append_sheet(wb, ws2, 'Resumo por Local');
      const nomeArquivo = `controle_porcelanatos_${(obra?.nome || 'obra').replace(/[^a-z0-9]/gi, '_')}.xlsx`;
      XLSX.writeFile(wb, nomeArquivo, { cellStyles: true });
      Utils.toast(`Planilha exportada! ${itensCache.length} item(ns) em ${resumoMap.size} apartamento(s)/local(is).`, 'sucesso');
      renderizar();
    } catch (e) {
      console.error('Erro ao exportar planilha:', e);
      Utils.toast('Erro ao exportar: ' + e.message, 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  return {
    init, recarregar,
    abrirConfig, salvarConfig,
    setFiltroTorre, setFiltroAndar, setFiltroStatus, setBusca, limparFiltros, toggleTorre,
    abrirExecucao, preencherRestante, salvarExecucao, abrirHistorico, excluirApontamento,
    exportarPlanilha,
  };
})();

function onObraChanged() { ControlePorcelanatos.init(); }

// ============================================
// Dashboard Principal
// Visão geral da obra: hero com seletor, Curva S, Índice de Desempenho
// de Prazo, atividades, avanço por pacotes, PPC semanal/motivos de
// atraso e resumo por apartamento (quantidade/custo).
// ============================================
const Dashboard = (() => {
  let obraAtual = null;
  let tarefas = [];
  let semanas = []; // não é mais buscado (PPC Semanal/Motivos de Atraso saíram da tela a pedido do Milton) — funções mortas mantidas, operam sobre array vazio
  let historicoExecucao = [];
  let suprimentos = []; // coleção 'suprimentos' (pipeline de compra por tarefa)
  let _resumoView = 'unidade';
  let _resumoDados = null;
  let _curvaCache = null; // último cálculo da Curva S (usado pelo tooltip)
  let _curvaGranularidade = 'mensal'; // 'mensal' | 'semanal'
  let _mostrarConcreto = localStorage.getItem('db_mostrar_fundacao_estrutura') === 'true';
  let _feContexto = null; // { obraId, pecas, marcadores, pranchas } — usado pelo popup de prancha (clique no gráfico Fundação/Estaca)

  const MOTIVOS_COR = {
    'Frente/Predecessora Não Liberada': '#f59e0b',
    'Atraso Entrega de Material': '#8b5cf6',
    'Atraso Programação de Material': '#64748b',
    'Falta de Material (Sobreconsumo)': '#ef4444',
    'Material Não Conforme': '#ec4899',
    'Material Não Comprado': '#f97316',
    'Necessidade Não Prevista (EAP)': '#0ea5e9',
    'Especificação de Projeto': '#a3a3a3',
    'Equipamentos Indisponíveis': '#14b8a6',
    'Serviço Não Contratado': '#84cc16',
    'Mudança no Plano de Ataque': '#1e293b',
    'Atraso em Documentações': '#6366f1',
    'Baixa Produtividade Prevista': '#eab308',
    'Intempéries': '#06b6d4',
    'Outros': '#d4d4d4',
  };

  // Módulos de levantamento com árvore hierárquica (Torre > Andar > Apto > Cômodo)
  // usados no Resumo por Apartamento. Espelha (subconjunto) do LEVANTAMENTO_MODULOS
  // do js/planejamento.js — mantido em sincronia manual (mesma convenção já usada
  // em Utils.calcularFachadaM2). Se a fórmula mudar lá, replicar aqui.
  const LEV_TREE = {
    piso: {
      label: 'Piso', configDoc: 'pisoArvore', colecao: 'pisoAreas',
      linhas: [
        { metrica: 'areaContrapiso', label: 'Contrapiso', unidade: 'm²' },
        { metrica: 'areaImperm', label: 'Impermeabilização', unidade: 'm²' },
        { metrica: 'areaM2', label: 'Revestimento de Piso', unidade: 'm²' },
        { metrica: 'mlRodape', label: 'Rodapé', unidade: 'ml' },
      ],
      valor(reg, metrica) {
        if (metrica === 'areaContrapiso') return (reg.tipoContrapiso && reg.tipoContrapiso !== '') ? (Number(reg.areaM2) || 0) : 0;
        if (metrica === 'areaImperm') return (reg.impermeabilizacao === true || reg.impermeabilizacao === 'true') ? (Number(reg.areaM2) || 0) : 0;
        if (metrica === 'areaM2') return Number(reg.areaM2) || 0;
        if (metrica === 'mlRodape') return Number(reg.mlRodape) || 0;
        return 0;
      }
    },
    paredesAlvenaria: {
      label: 'Paredes', configDoc: 'paredesArvore', colecao: 'paredesAlvenariaPecas', moduloVinculo: 'paredes',
      linhas: [
        { metrica: 'vedacao', label: 'Alvenaria de Vedação', unidade: 'm²' },
        { metrica: 'estrutural', label: 'Alvenaria Estrutural', unidade: 'm²' },
      ],
      valor(reg, metrica) {
        const c = _calcParedeBruta(reg);
        if (metrica === 'vedacao') return c.tipoAlvenaria === 'vedacao' ? c.areaLiquida : 0;
        if (metrica === 'estrutural') return c.tipoAlvenaria === 'estrutural' ? c.areaLiquida : 0;
        return 0;
      }
    },
    paredesAcabamento: {
      label: 'Paredes', configDoc: 'paredesArvore', colecao: 'paredesAcabamentoPecas', moduloVinculo: 'paredes',
      linhas: [
        { metrica: 'gesso', label: 'Gesso Liso', unidade: 'm²' },
        { metrica: 'reboco', label: 'Reboco', unidade: 'm²' },
        { metrica: 'revestimento', label: 'Revestimento de Parede', unidade: 'm²' },
        { metrica: 'pinturaParede', label: 'Pintura de Parede', unidade: 'm²' },
      ],
      valor(reg, metrica) {
        const c = _calcAcabBruta(reg);
        if (metrica === 'gesso') return c.gesso;
        if (metrica === 'reboco') return c.reboco;
        if (metrica === 'revestimento') return c.revestimento;
        if (metrica === 'pinturaParede') return c.pinturaM2;
        return 0;
      }
    },
    teto: {
      label: 'Teto / Forro', configDoc: 'tetoArvore', colecao: 'tetoAreas',
      linhas: [
        { metrica: 'areaM2', label: 'Área de Teto', unidade: 'm²' },
        { metrica: 'areaDrywall', label: 'Forro de Drywall', unidade: 'm²' },
        { metrica: 'areaGesso', label: 'Placa de Gesso', unidade: 'm²' },
        { metrica: 'mlTabica', label: 'Tabica', unidade: 'ml' },
        { metrica: 'pinturaTeto', label: 'Pintura de Teto', unidade: 'm²' },
      ],
      valor(reg, metrica) {
        if (metrica === 'areaM2') return Number(reg.areaM2) || 0;
        if (metrica === 'areaDrywall') return (reg.tipoDryWall && reg.tipoDryWall !== '') ? (Number(reg.areaM2) || 0) : 0;
        if (metrica === 'areaGesso') return (reg.tipoPlacaGesso && reg.tipoPlacaGesso !== '') ? (Number(reg.areaM2) || 0) : 0;
        if (metrica === 'mlTabica') return Number(reg.mlTabica) || 0;
        if (metrica === 'pinturaTeto') return _pinturaM2Teto(reg);
        return 0;
      }
    },
  };

  // ---- Fórmulas replicadas de planejamento.js (comentário lá pede sincronia manual) ----
  function _calcParedeBruta(p) {
    const comp = Number(p.comprimento || 0) / 100, alt = Number(p.altura || 0) / 100;
    const areaBruta = comp * alt;
    const areaVaos = (p.vaos || []).reduce((s, v) => s + (Number(v.comprimento || 0) / 100) * (Number(v.altura || 0) / 100) * (Number(v.qtd) || 1), 0);
    return { areaLiquida: Math.max(0, areaBruta - areaVaos), tipoAlvenaria: p.tipoAlvenaria || '' };
  }
  function _calcAcabBruta(p) {
    const comp = Number(p.comprimento || 0) / 100, alt = Number(p.altura || 0) / 100;
    const areaBruta = comp * alt;
    const areaVaos = (p.vaos || []).reduce((s, v) => s + (Number(v.comprimento || 0) / 100) * (Number(v.altura || 0) / 100) * (Number(v.qtd) || 1), 0);
    const areaLiquida = Math.max(0, areaBruta - areaVaos);
    const pinturaM2 = p.temPintura ? (p.pintura || []).reduce((s, pt) => s + areaLiquida * (Number(pt.pct || 0) / 100), 0) : 0;
    const acab = { gesso: 0, reboco: 0, revestimento: 0 };
    (p.acabamentos || []).forEach(a => { if (acab[a.tipo] != null) acab[a.tipo] += areaLiquida * (Number(a.pct || 0) / 100); });
    return { areaLiquida, pinturaM2, gesso: acab.gesso, reboco: acab.reboco, revestimento: acab.revestimento };
  }
  function _pinturaM2Teto(a) {
    if (!a.temPintura || !(a.pintura || []).length) return 0;
    return (a.pintura || []).reduce((s, pt) => s + (Number(a.areaM2) || 0) * (Number(pt.pct || 0) / 100), 0);
  }

  async function init() {
    const ok = await Utils.initPagina();
    if (!ok) return;
    obraAtual = Router.getObra();
    _renderToggleConcreto();
    await _carregarPrefsArvoreRemotas();
    await carregar();
  }

  // Busca uma vez (não depende de obra) a preferência salva do usuário pra
  // nível/horizonte da árvore de Atividades/Suprimentos — permite abrir em
  // outro PC e a árvore já nascer onde o usuário deixou da última vez.
  async function _carregarPrefsArvoreRemotas() {
    const uid = Auth.getUid();
    if (!uid) return;
    try {
      const user = await Database.getUser(uid);
      _aplicarPrefsRemotas(user?.dashboardArvorePrefs);
    } catch (e) {
      // Sem prefs remotas ainda ou erro de rede — segue com o cache local.
    }
  }

  async function onObraChanged(obra) {
    obraAtual = obra;
    await carregar();
  }
  window.onObraChanged = onObraChanged;

  // Toggle "Mostrar Contenção, Fundação e Estrutura" — preferência pessoal de
  // exibição (não é dado da obra), por isso fica em localStorage, igual outras
  // preferências de UI do sistema.
  function _renderToggleConcreto() {
    const host = document.getElementById('header-actions');
    if (!host) return;
    host.innerHTML = `
      <label class="db-toggle-concreto" style="display:flex;align-items:center;gap:6px;font-size:0.78rem;color:var(--cor-texto-secundario);cursor:pointer;">
        <input type="checkbox" id="db-check-concreto" ${_mostrarConcreto ? 'checked' : ''} onchange="Dashboard.toggleMostrarConcreto()">
        Mostrar Contenção, Fundação e Estrutura
      </label>`;
  }

  async function toggleMostrarConcreto() {
    _mostrarConcreto = document.getElementById('db-check-concreto')?.checked || false;
    localStorage.setItem('db_mostrar_fundacao_estrutura', _mostrarConcreto ? 'true' : 'false');
    await _renderFundacaoEstrutura();
  }

  async function carregar() {
    const el = document.getElementById('modulo-content');
    if (!el) return;
    if (!obraAtual || !obraAtual.id) {
      el.innerHTML = _htmlSemObra();
      await _popularSeletorVazio();
      return;
    }
    try {
      Utils.mostrarLoading('Carregando dashboard...');
      const obraId = obraAtual.id;
      const [obraCompleta, tf, hist, sup] = await Promise.all([
        Database.getObra(obraId),
        Database.listar(obraId, 'tarefas', 'ordem').catch(() => []),
        Database.listar(obraId, 'historicoExecucao', 'data', 'asc').catch(() => []),
        Database.listar(obraId, 'suprimentos', null).catch(() => []),
      ]);
      obraAtual = obraCompleta || obraAtual;
      tarefas = tf;
      historicoExecucao = hist;
      suprimentos = sup;
      el.innerHTML = _htmlEsqueleto();
      _renderHero();
      _renderAtividades();
      _renderSuprimentosDash();
      await _renderPainelAndamento();
      _renderSoloGrampeadoPanel();
      await _renderFundacaoEstrutura();
      await _renderEstacasPanel();
      _renderCurvaS();
      await _renderResumoApartamento();
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao carregar dashboard.', 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  function _htmlSemObra() {
    return `<div class="estado-vazio">
      <div class="icone">📊</div>
      <p>Selecione uma obra para ver o Dashboard.</p>
      <select id="db-select-vazio" style="max-width:320px;margin:0 auto;display:block;" class="input"></select>
    </div>`;
  }

  async function _popularSeletorVazio() {
    const sel = document.getElementById('db-select-vazio');
    if (!sel) return;
    try {
      const obras = await Database.getObras();
      sel.innerHTML = '<option value="">Selecione...</option>' + obras.map(o => `<option value="${o.id}">${o.nome}</option>`).join('');
      sel.addEventListener('change', async () => {
        if (!sel.value) return;
        const obra = await Database.getObra(sel.value);
        Router.setObra(obra);
        obraAtual = obra;
        await carregar();
      });
    } catch (e) { console.warn('Erro ao popular seletor vazio', e); }
  }

  function _htmlEsqueleto() {
    return `
      <div id="db-hero"></div>

      <div class="card db-row">
        <div class="card-body">
          <div class="db-secao-header">
            <h3>Atividades</h3>
            <span class="text-sm text-muted" id="db-atualizado-em"></span>
          </div>
          <div id="db-atividades"></div>
        </div>
      </div>

      <div class="card db-row">
        <div class="card-body">
          <div class="db-secao-header"><h3>Suprimentos</h3></div>
          <div id="db-suprimentos-dash"></div>
        </div>
      </div>

      <div id="db-solo-grampeado-wrap"></div>

      <div id="db-fundacao-estrutura-wrap"></div>

      <div id="db-estacas-wrap"></div>

      <div class="card db-row">
        <div class="card-body">
          <div class="db-secao-header">
            <h3>Painel de Andamento</h3>
            <div style="display:flex;align-items:center;gap:8px;">
              <div class="aba-toggle" id="db-painel-toggle">
                <button class="aba-btn ativo" data-v="pavimento" onclick="Dashboard._painelSetModo('pavimento')">Por Pavimento</button>
                <button class="aba-btn" data-v="apartamento" onclick="Dashboard._painelSetModo('apartamento')">Por Apartamento</button>
              </div>
              <button class="btn btn-secundario btn-sm" onclick="Dashboard._abrirConfigPainel()">⚙️ Configurar</button>
            </div>
          </div>
          <div id="db-painel-andamento"></div>
        </div>
      </div>

      <div class="card db-row">
        <div class="card-body">
          <div class="db-secao-header">
            <h3>Curva S — Planejamento</h3>
            <div class="aba-toggle" id="db-curva-toggle">
              <button class="aba-btn ativo" data-v="mensal" onclick="Dashboard.setCurvaGranularidade('mensal')">Mensal</button>
              <button class="aba-btn" data-v="semanal" onclick="Dashboard.setCurvaGranularidade('semanal')">Semanal</button>
            </div>
          </div>
          <div id="db-curva-s" class="db-tooltip-wrap"></div>
        </div>
      </div>

      <div class="card db-row">
        <div class="card-body">
          <div class="db-secao-header">
            <h3>Resumo por Apartamento</h3>
            <div class="aba-toggle" id="db-resumo-toggle">
              <button class="aba-btn ativo" data-v="unidade" onclick="Dashboard.setResumoView('unidade')">Unidade</button>
              <button class="aba-btn" data-v="custo" onclick="Dashboard.setResumoView('custo')">Custo (R$)</button>
            </div>
          </div>
          <div id="db-resumo-apartamento"></div>
        </div>
      </div>
    `;
  }

  // ===================== HERO =====================
  function _renderHero() {
    const host = document.getElementById('db-hero');
    if (!host) return;
    const prog = _calcProgresso(tarefas);
    const perc = Utils.formatarNumero(prog.percConcluido);
    const percEsp = Utils.formatarNumero(prog.percEsperado);
    const atraso = _labelAtraso(prog.terminoAtual, prog.terminoBase);
    const bg = obraAtual.imagemUrl ? `background-image:url('${obraAtual.imagemUrl}');` : '';

    host.className = 'db-hero';
    host.style.cssText = bg;
    host.innerHTML = `
      <div class="db-hero-overlay">
        <div class="db-hero-top">
          <label class="db-hero-select-label">Obra ativa</label>
          <select id="db-obra-select" class="db-hero-select"></select>
        </div>
        <div class="db-hero-info">
          <h1>${obraAtual.nome || 'Obra'}</h1>
          <div class="db-hero-sub">${obraAtual.cliente || ''}</div>
          <div class="db-hero-kpis">
            <div class="db-kpi">
              <div class="db-kpi-valor">${perc}%</div>
              <div class="db-kpi-label">Executado</div>
            </div>
            <div class="db-kpi">
              <div class="db-kpi-valor">${percEsp}%</div>
              <div class="db-kpi-label">Previsto Atual</div>
            </div>
            <div class="db-kpi">
              <div class="db-kpi-valor">${prog.terminoAtual ? Utils.formatarData(prog.terminoAtual) : '—'}</div>
              <div class="db-kpi-label">Término Atual ${atraso.badge}</div>
            </div>
            <div class="db-kpi">
              <div class="db-kpi-valor">${prog.terminoBase ? Utils.formatarData(prog.terminoBase) : '—'}</div>
              <div class="db-kpi-label">Término Linha de Base</div>
            </div>
          </div>
        </div>
      </div>`;
    _popularSeletorHero();
  }

  async function _popularSeletorHero() {
    const sel = document.getElementById('db-obra-select');
    if (!sel) return;
    try {
      const obras = await Database.getObras();
      sel.innerHTML = obras.map(o => `<option value="${o.id}" ${o.id === obraAtual.id ? 'selected' : ''}>${o.nome}</option>`).join('');
      sel.addEventListener('change', async () => {
        const obra = await Database.getObra(sel.value);
        Router.setObra(obra);
        obraAtual = obra;
        await carregar();
      });
    } catch (e) { console.warn('Erro ao popular seletor do hero', e); }
  }

  function _labelAtraso(terminoAtual, terminoBase) {
    if (!terminoAtual || !terminoBase) return { atrasado: false, badge: '' };
    const diffDias = Math.round((terminoAtual - terminoBase) / 86400000);
    if (diffDias <= 0) return { atrasado: false, badge: '<span class="badge badge-sucesso" style="margin-left:4px;">No prazo</span>' };
    const meses = Math.round(diffDias / 30);
    const txt = meses >= 1 ? `${meses} mês${meses > 1 ? 'es' : ''} atrasado` : `${diffDias}d atrasado`;
    return { atrasado: true, badge: `<span class="badge badge-perigo" style="margin-left:4px;">${txt}</span>` };
  }

  // ===================== PROGRESSO / KPIs =====================
  // Detecta tarefa-folha pela MESMA lógica já usada (e comprovada) em
  // obras.js e semanal.js: uma tarefa é folha se a próxima na ORDEM tem
  // nível igual ou menor (ou seja, ninguém "entra" dentro dela). Isso é
  // mais confiável do que confiar no campo `tipo==='grupo'` — se esse
  // campo não estiver 100% consistente nos dados, filtrar por ele pode
  // incluir linha de grupo vazia (derrubando a média pra perto de 0) ou
  // excluir folha de verdade. Por posição, é igual ao que já funciona em
  // Obras (card de % Executado) e Semanal (PPC).
  function _folhas(tf) {
    const sorted = [...tf].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    const folhas = [];
    sorted.forEach((t, i) => {
      const nxt = sorted[i + 1];
      const isFolha = !nxt || (nxt.nivel || 0) <= (t.nivel || 0);
      if (isFolha) folhas.push(t);
    });
    return folhas;
  }
  function _leaves() {
    return _folhas(tarefas);
  }

  // Filhos DIRETOS de um nó, pela mesma lógica de ordem/nível usada no
  // Editor de Estrutura do Planejamento (js/planejamento.js:_arvFilhos) —
  // não existe parentId nos dados, hierarquia é só posição+nível.
  function _filhosDiretos(pai, sorted) {
    const pn = pai.nivel || 0;
    const pi = sorted.findIndex(t => t.id === pai.id);
    const filhos = [];
    for (let i = pi + 1; i < sorted.length; i++) {
      const t = sorted[i];
      if ((t.nivel || 0) <= pn) break;
      if ((t.nivel || 0) === pn + 1) filhos.push(t);
    }
    return filhos;
  }
  function _temFilhos(t, sorted) { return _filhosDiretos(t, sorted).length > 0; }

  // Todas as folhas (recursivo, qualquer profundidade) descendentes de um nó —
  // usado pra agregar % / contagem / datas quando o nó está recolhido.
  function _folhasDescendentes(no, sorted) {
    const filhos = _filhosDiretos(no, sorted);
    if (!filhos.length) return [no]; // já é folha
    let out = [];
    filhos.forEach(f => { out = out.concat(_folhasDescendentes(f, sorted)); });
    return out;
  }

  // ===================== PAINEL DE ANDAMENTO (por Pavimento/Apto) =====================
  // Pré-requisito: módulo "Planejamento — Estrutura da Obra + Vínculo" já em
  // uso (obras/{id}/config/estruturaObra e campo vinculoEstrutura em cada
  // tarefa). Só leitura — não grava nada nas tarefas.
  //
  // Tabela: linha = tarefa-mãe escolhida pelo usuário (config/dashboardPainel);
  // coluna = pavimento OU apartamento (toggle). Célula = % agregado (peso por
  // duração, igual ao resto do Dashboard) + status (borda) das tarefas que
  // batem naquele cruzamento tarefa-mãe × local.
  const PAINEL_FAIXAS = { vermelho: 30, amarelo: 70 }; // 0-30 vermelho, 31-70 amarelo, 71-100 verde — ajustável aqui
  let _painelModo = localStorage.getItem('db_painel_modo') || 'pavimento'; // 'pavimento' | 'apartamento'
  let _painelMaesConfig = []; // ids de tarefa-mãe escolhidos, de config/dashboardPainel
  let _painelEstrutura = null; // { torres: [...] } de config/estruturaObra
  let _painelDados = null; // cache do último cálculo, usado pelo popover de detalhe

  function _painelCorProgresso(pct) {
    if (pct <= PAINEL_FAIXAS.vermelho) return '#dc2626';
    if (pct <= PAINEL_FAIXAS.amarelo) return '#eab308';
    return '#16a34a';
  }
  // Status da célula a partir do conjunto de tarefas que a compõem: todas
  // finalizadas → finalizada; todas pausadas → pausada; qualquer mistura
  // (inclusive uma finalizada + uma em andamento) → em andamento.
  function _painelStatusCelula(tarefasDaCelula) {
    if (tarefasDaCelula.every(t => t.status === 'finalizada')) return 'finalizada';
    if (tarefasDaCelula.every(t => t.status === 'pausada')) return 'pausada';
    return 'andamento';
  }
  function _painelBordaStatus(status) {
    if (status === 'finalizada') return '2px solid #16a34a';
    if (status === 'pausada') return '2px dashed #888';
    return '2px solid #2563eb';
  }

  async function _renderPainelAndamento() {
    const host = document.getElementById('db-painel-andamento');
    if (!host) return;
    try {
      const obraId = obraAtual.id;
      const [cfgPainel, estrutura] = await Promise.all([
        Database.obter(obraId, 'config', 'dashboardPainel').catch(() => null),
        Database.obter(obraId, 'config', 'estruturaObra').catch(() => null),
      ]);
      _painelMaesConfig = cfgPainel?.maesIds || [];
      _painelEstrutura = estrutura || { torres: [] };
      const toggle = document.getElementById('db-painel-toggle');
      if (toggle) toggle.querySelectorAll('.aba-btn').forEach(b => b.classList.toggle('ativo', b.dataset.v === _painelModo));

      if (!_painelEstrutura.torres || !_painelEstrutura.torres.length) {
        host.innerHTML = '<div class="estado-vazio"><p class="text-sm">Nenhuma Estrutura da Obra cadastrada ainda — configure em Planejamento → 🏢 Estrutura da Obra.</p></div>';
        return;
      }
      if (!_painelMaesConfig.length) {
        host.innerHTML = '<div class="estado-vazio"><p class="text-sm">Nenhuma tarefa-mãe escolhida ainda pra este painel — clique em "⚙️ Configurar" acima.</p></div>';
        return;
      }
      const sorted = [...tarefas].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
      const maes = _painelMaesConfig.map(id => sorted.find(t => t.id === id)).filter(Boolean);
      if (!maes.length) {
        host.innerHTML = '<div class="estado-vazio"><p class="text-sm">As tarefas-mãe configuradas não existem mais no Planejamento — reconfigure em "⚙️ Configurar".</p></div>';
        return;
      }

      // Colunas: pavimentos, ou pavimento+apto se modo='apartamento'.
      const colunas = [];
      [...(_painelEstrutura.torres || [])].sort((a, b) => (a.ordem || 0) - (b.ordem || 0)).forEach(torre => {
        [...(torre.pavimentos || [])].sort((a, b) => (a.ordem || 0) - (b.ordem || 0)).forEach(pav => {
          if (_painelModo === 'pavimento' || !(pav.apartamentos || []).length) {
            colunas.push({ label: pav.nome, torreId: torre.id, pavimentoId: pav.id, apartamentoId: null });
          } else {
            [...pav.apartamentos].sort((a, b) => (a.ordem || 0) - (b.ordem || 0)).forEach(apto => {
              colunas.push({ label: `${pav.nome}: ${apto.nome}`, torreId: torre.id, pavimentoId: pav.id, apartamentoId: apto.id });
            });
          }
        });
      });

      // Pra cada mãe × coluna, acha as tarefas-folha da mãe cujo
      // vinculoEstrutura bate com a coluna (pavimento inteiro conta pra
      // TODAS as colunas de apto daquele pavimento também, conforme spec).
      const dados = maes.map(mae => {
        const folhasDaMae = _folhasDescendentes(mae, sorted);
        const celulas = colunas.map(col => {
          const tarefasDaCelula = folhasDaMae.filter(t => (t.vinculoEstrutura || []).some(v => {
            if (v.pavimentoId !== col.pavimentoId) return false;
            if (!col.apartamentoId) return true; // coluna é pavimento inteiro — qualquer vínculo daquele pavimento entra
            return !v.apartamentoId || v.apartamentoId === col.apartamentoId; // vínculo no pavimento inteiro OU no apto certo
          }));
          if (!tarefasDaCelula.length) return null; // célula vazia — sem tarefa vinculada
          let somaPeso = 0, somaConc = 0;
          tarefasDaCelula.forEach(t => {
            const peso = Math.max(1, Number(t.duracao) || 1); // peso por duração — nunca por quantidade (regra 5.1 do projeto)
            somaPeso += peso;
            somaConc += Math.min(100, Number(t.percentualConcluido) || 0) * peso;
          });
          return {
            percentual: somaPeso ? somaConc / somaPeso : 0,
            status: _painelStatusCelula(tarefasDaCelula),
            tarefas: tarefasDaCelula,
          };
        });
        return { mae, celulas };
      });
      _painelDados = { dados, colunas };
      host.innerHTML = _htmlPainelAndamento(dados, colunas);
    } catch (e) {
      console.error(e);
      host.innerHTML = '<div class="estado-vazio"><p class="text-sm">Erro ao carregar o Painel de Andamento.</p></div>';
    }
  }

  function _htmlPainelAndamento(dados, colunas) {
    const corHeader = '#f8f8f8';
    return `
      <div style="overflow-x:auto;">
        <table style="border-collapse:collapse;width:100%;font-size:.78rem;">
          <thead>
            <tr>
              <th style="position:sticky;left:0;background:${corHeader};padding:6px 10px;text-align:left;border:1px solid #e5e5e5;min-width:140px;z-index:1;">Tarefa</th>
              ${colunas.map(c => `<th style="background:${corHeader};padding:6px 8px;border:1px solid #e5e5e5;min-width:64px;font-weight:600;white-space:nowrap;">${c.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${dados.map((linha, li) => `
              <tr>
                <td style="position:sticky;left:0;background:#fff;padding:6px 10px;border:1px solid #e5e5e5;font-weight:600;white-space:nowrap;z-index:1;">${linha.mae.nome || 'Sem nome'}</td>
                ${linha.celulas.map((cel, ci) => {
                  if (!cel) return `<td style="background:#f4f4f4;border:1px solid #e5e5e5;"></td>`;
                  const cor = _painelCorProgresso(cel.percentual);
                  const borda = _painelBordaStatus(cel.status);
                  return `<td style="border:${borda};padding:0;cursor:pointer;text-align:center;" onclick="Dashboard._painelAbrirDetalhe(${li},${ci})">
                    <div style="padding:5px 4px;background:${cor}22;">
                      <div style="font-weight:700;color:${cor};">${Math.round(cel.percentual)}%</div>
                    </div>
                  </td>`;
                }).join('')}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="db-legenda" style="margin-top:8px;">
        <span><i style="background:#dc2626;"></i> 0–${PAINEL_FAIXAS.vermelho}%</span>
        <span><i style="background:#eab308;"></i> ${PAINEL_FAIXAS.vermelho + 1}–${PAINEL_FAIXAS.amarelo}%</span>
        <span><i style="background:#16a34a;"></i> ${PAINEL_FAIXAS.amarelo + 1}–100%</span>
        <span style="margin-left:10px;">Borda: <b style="border-bottom:2px solid #2563eb;">azul</b> em andamento · <b style="border-bottom:2px solid #16a34a;">verde</b> finalizada · <b style="border-bottom:2px dashed #888;">tracejada</b> pausada</span>
      </div>
      <div class="text-sm text-muted" style="margin-top:6px;">Clique numa célula pra ver as tarefas que compõem aquele número.</div>`;
  }

  function _painelSetModo(modo) {
    _painelModo = modo;
    localStorage.setItem('db_painel_modo', modo);
    _renderPainelAndamento();
  }

  function _painelAbrirDetalhe(li, ci) {
    if (!_painelDados) return;
    const linha = _painelDados.dados[li];
    const cel = linha?.celulas[ci];
    if (!cel) return;
    const col = _painelDados.colunas[ci];
    let overlay = document.getElementById('db-painel-detalhe-overlay');
    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.id = 'db-painel-detalhe-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:600;background:rgba(15,23,42,.5);display:flex;align-items:center;justify-content:center;padding:24px;';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:10px;max-width:480px;width:100%;max-height:80vh;overflow-y:auto;padding:16px;">
        <div style="font-weight:700;margin-bottom:2px;">${linha.mae.nome}</div>
        <div class="text-sm text-muted" style="margin-bottom:10px;">${col.label} — ${Math.round(cel.percentual)}% (peso por duração)</div>
        ${cel.tarefas.map(t => `
          <div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid #eee;">
            <div>
              <div style="font-weight:600;font-size:.82rem;">${t.nome || 'Sem nome'}</div>
              <div class="text-sm text-muted">Duração: ${t.duracao || 1}d (peso) · Status: ${t.status || 'em andamento'}</div>
            </div>
            <div style="font-weight:700;color:${_painelCorProgresso(Number(t.percentualConcluido) || 0)};white-space:nowrap;">${Math.round(Number(t.percentualConcluido) || 0)}%</div>
          </div>`).join('')}
        <button class="btn btn-secundario btn-sm" style="width:100%;margin-top:10px;" onclick="document.getElementById('db-painel-detalhe-overlay').remove()">Fechar</button>
      </div>`;
    document.body.appendChild(overlay);
  }

  // Configuração: escolher quais tarefas-mãe (grupos de qualquer nível, não
  // só nível 0) entram nas linhas da tabela. Lista candidata = todos os nós
  // COM filhos (grupos) — folhas puras não fazem sentido como "mãe".
  // Estado da árvore de seleção (config do Painel): quais grupos estão
  // expandidos — só visual, não é salvo (reabre sempre fechado, pra não
  // sobrecarregar em obras com árvore grande).
  let _painelCfgAbertos = new Set();
  async function _abrirConfigPainel() {
    _painelCfgAbertos = new Set();
    let overlay = document.getElementById('db-painelcfg-overlay');
    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.id = 'db-painelcfg-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:600;background:rgba(15,23,42,.5);display:flex;align-items:center;justify-content:center;padding:24px;';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:10px;max-width:460px;width:100%;max-height:82vh;overflow-y:auto;padding:16px;display:flex;flex-direction:column;">
        <div style="font-weight:700;margin-bottom:4px;">⚙️ Configurar Painel de Andamento</div>
        <div class="text-sm text-muted" style="margin-bottom:8px;">Marque as tarefas (de qualquer nível) que devem virar linha na tabela. Clique no nome pra abrir/fechar o grupo.</div>
        <input type="text" id="db-painelcfg-busca" class="input" placeholder="Buscar tarefa..." style="margin-bottom:10px;" oninput="Dashboard._painelCfgFiltrar(this.value)">
        <div id="db-painelcfg-lista" style="display:flex;flex-direction:column;gap:1px;overflow-y:auto;flex:1;"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;">
          <button class="btn btn-secundario btn-sm" onclick="document.getElementById('db-painelcfg-overlay').remove()">Cancelar</button>
          <button class="btn btn-primario btn-sm" onclick="Dashboard._salvarConfigPainel()">Salvar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    _renderPainelCfgArvore();
  }

  // Renderiza a árvore de seleção. Cada grupo (nó com filhos) mostra ▶/▼ +
  // checkbox pra marcar ELE MESMO como tarefa-mãe (o Painel usa as FOLHAS
  // dele pra agregar); folhas puras aparecem só quando o grupo pai está
  // aberto, sem checkbox (folha isolada não faz sentido como linha própria
  // do Painel — spec pede "tarefa-mãe", que sempre tem filhos).
  function _renderPainelCfgArvore(filtroTexto) {
    const el = document.getElementById('db-painelcfg-lista');
    if (!el) return;
    const sorted = [...tarefas].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    const filtro = (filtroTexto || '').toLowerCase().trim();

    // Com filtro de busca ativo: mostra lista achatada só dos GRUPOS cujo
    // nome bate a busca (a árvore normal volta quando o campo é limpo).
    if (filtro) {
      const candidatas = sorted.filter(t => _temFilhos(t, sorted) && (t.nome || '').toLowerCase().includes(filtro));
      el.innerHTML = candidatas.length
        ? candidatas.map(t => _painelCfgLinhaCheckbox(t, 0)).join('')
        : '<div class="text-sm text-muted" style="padding:10px 0;">Nenhum grupo encontrado.</div>';
      return;
    }

    const raizes = sorted.filter(t => (t.nivel || 0) === 0);
    el.innerHTML = _painelCfgRenderNivel(raizes, sorted, 0) || '<div class="text-sm text-muted">Nenhuma tarefa encontrada no Planejamento.</div>';
  }
  function _painelCfgLinhaCheckbox(t, indent) {
    return `<label style="display:flex;align-items:center;gap:8px;font-size:.82rem;padding:4px 2px;cursor:pointer;border-radius:4px;" onmouseover="this.style.background='#f7f7f7'" onmouseout="this.style.background='transparent'">
      <input type="checkbox" value="${t.id}" ${_painelMaesConfig.includes(t.id) ? 'checked' : ''}>
      <span style="padding-left:${indent}px;">${t.nome || 'Sem nome'}</span>
    </label>`;
  }
  function _painelCfgRenderNivel(nos, sorted, indent) {
    let html = '';
    nos.forEach(t => {
      const filhos = _filhosDiretos(t, sorted);
      if (!filhos.length) {
        // Folha pura: só aparece como texto informativo dentro de um grupo
        // já aberto, sem checkbox (não pode ser "tarefa-mãe" sozinha).
        html += `<div style="padding:4px 2px;padding-left:${indent + 22}px;font-size:.78rem;color:#999;">${t.nome || 'Sem nome'}</div>`;
        return;
      }
      const aberto = _painelCfgAbertos.has(t.id);
      html += `<div style="display:flex;align-items:center;gap:4px;padding:4px 2px;border-radius:4px;" onmouseover="this.style.background='#f7f7f7'" onmouseout="this.style.background='transparent'">
        <span onclick="Dashboard._painelCfgToggleAberto('${t.id}')" style="width:16px;text-align:center;cursor:pointer;color:#888;font-size:.7rem;flex-shrink:0;">${aberto ? '▼' : '▶'}</span>
        <label style="display:flex;align-items:center;gap:8px;font-size:.82rem;flex:1;cursor:pointer;padding-left:${indent}px;">
          <input type="checkbox" value="${t.id}" ${_painelMaesConfig.includes(t.id) ? 'checked' : ''}>
          <span style="font-weight:600;">${t.nome || 'Sem nome'}</span>
        </label>
      </div>`;
      if (aberto) html += _painelCfgRenderNivel(filhos, sorted, indent + 18);
    });
    return html;
  }
  function _painelCfgToggleAberto(id) {
    if (_painelCfgAbertos.has(id)) _painelCfgAbertos.delete(id); else _painelCfgAbertos.add(id);
    // Preserva o que já estava marcado antes de re-renderizar.
    _painelCfgSincronizarMarcados();
    _renderPainelCfgArvore();
  }
  function _painelCfgFiltrar(texto) {
    _painelCfgSincronizarMarcados();
    _renderPainelCfgArvore(texto);
  }
  // Antes de qualquer re-render da árvore (expandir/buscar), lê os
  // checkboxes marcados na tela ATUAL e atualiza _painelMaesConfig — senão
  // marcar um item, depois expandir outro grupo, perderia a marcação.
  function _painelCfgSincronizarMarcados() {
    const el = document.getElementById('db-painelcfg-lista');
    if (!el) return;
    const marcados = [...el.querySelectorAll('input[type="checkbox"]:checked')].map(cb => cb.value);
    const desmarcados = [...el.querySelectorAll('input[type="checkbox"]:not(:checked)')].map(cb => cb.value);
    _painelMaesConfig = _painelMaesConfig.filter(id => !desmarcados.includes(id));
    marcados.forEach(id => { if (!_painelMaesConfig.includes(id)) _painelMaesConfig.push(id); });
  }

  async function _salvarConfigPainel() {
    _painelCfgSincronizarMarcados(); // captura o que está marcado na tela ATUAL antes de salvar
    const overlay = document.getElementById('db-painelcfg-overlay');
    try {
      await db.collection('obras').doc(obraAtual.id).collection('config').doc('dashboardPainel').set({ maesIds: _painelMaesConfig }, { merge: true });
      overlay.remove();
      Utils.toast('Configuração salva.', 'sucesso');
      await _renderPainelAndamento();
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao salvar configuração.', 'erro');
    }
  }

  // Estado da árvore navegável: cada card tem SUAS DUAS colunas com estado
  // próprio (nível fixo, expandidos, horizonte de tempo), pra poder abrir
  // fundo em "Próximas" sem afetar "Em Execução" ao lado.
  // horizonteDias: null = sem limite; caso contrário só entram folhas com
  // data dentro de hoje+horizonteDias (aplica-se a Próximas/Suprimentos —
  // Em Execução não usa, já é "agora").
  //
  // Persistência: nivelFixo e horizonteDias são preferência PESSOAL do
  // usuário (não da obra) — precisa seguir o usuário entre PCs, então vai
  // pra Firestore em users/{uid}.dashboardArvorePrefs. localStorage continua
  // sendo usado só como CACHE local instantâneo (evita a árvore nascer no
  // Nível 0 e "pular" pro nível salvo só depois que o Firestore responder).
  // 'abertos' (quais nós estão expandidos) NÃO persiste em lugar nenhum:
  // muda a cada troca de obra e não faz sentido sobreviver a um F5.
  function _chaveLS(chave, campo) { return `db_arvore_${chave}_${campo}`; }
  function _novoEstadoColuna(chave, horizontePadrao) {
    const nivelSalvo = parseInt(localStorage.getItem(_chaveLS(chave, 'nivel')), 10);
    const horizSalvo = localStorage.getItem(_chaveLS(chave, 'horizonte'));
    return {
      nivelFixo: Number.isFinite(nivelSalvo) ? nivelSalvo : 0,
      abertos: new Set(),
      horizonteDias: horizSalvo != null ? (horizSalvo === 'null' ? null : Number(horizSalvo)) : horizontePadrao,
    };
  }
  const _arvoreState = {
    ativ_execucao: _novoEstadoColuna('ativ_execucao', null), // Em Execução nunca filtra por tempo
    ativ_proximas: _novoEstadoColuna('ativ_proximas', 30),
    suprimentos: _novoEstadoColuna('suprimentos', 30),
  };
  // Aplica prefs vindas do Firestore por cima do cache local (Firestore
  // manda, é a fonte de verdade entre PCs) — chamado uma vez no carregar().
  function _aplicarPrefsRemotas(prefs) {
    if (!prefs) return;
    ['ativ_execucao', 'ativ_proximas', 'suprimentos'].forEach(chave => {
      const p = prefs[chave];
      if (!p) return;
      const st = _arvoreState[chave];
      if (typeof p.nivelFixo === 'number') st.nivelFixo = p.nivelFixo;
      if ('horizonteDias' in p) st.horizonteDias = p.horizonteDias;
      // espelha no cache local pra próxima abertura já nascer certa
      localStorage.setItem(_chaveLS(chave, 'nivel'), String(st.nivelFixo));
      localStorage.setItem(_chaveLS(chave, 'horizonte'), String(st.horizonteDias));
    });
  }
  // Salva no Firestore (users/{uid}.dashboardArvorePrefs) — debounced (900ms)
  // pra não gravar a cada clique isolado se o usuário mexer rápido em vários
  // controles seguidos.
  let _salvarPrefsTimer = null;
  function _salvarPrefsRemotas() {
    clearTimeout(_salvarPrefsTimer);
    _salvarPrefsTimer = setTimeout(async () => {
      const uid = Auth.getUid();
      if (!uid) return;
      const payload = {};
      ['ativ_execucao', 'ativ_proximas', 'suprimentos'].forEach(chave => {
        const st = _arvoreState[chave];
        payload[chave] = { nivelFixo: st.nivelFixo, horizonteDias: st.horizonteDias };
      });
      try {
        await Database.atualizarRaiz('users', uid, { dashboardArvorePrefs: payload });
      } catch (e) {
        // Falha silenciosa — preferência de UI, cache local já garante a
        // experiência na mesma máquina; não vale interromper o usuário.
      }
    }, 900);
  }
  function _resetArvore(chave, nivel) {
    const st = _arvoreState[chave];
    st.nivelFixo = nivel;
    st.abertos = new Set();
    localStorage.setItem(_chaveLS(chave, 'nivel'), String(nivel));
    _salvarPrefsRemotas();
  }
  function _toggleNo(chave, id) {
    const st = _arvoreState[chave];
    if (st.abertos.has(id)) st.abertos.delete(id); else st.abertos.add(id);
  }
  // Um nó aparece "aberto por padrão" se o nível dele é MENOR que o nível fixo
  // (precisa estar aberto pra dar acesso aos descendentes do nível fixo) —
  // e a partir do nível fixo, só abre se estiver explicitamente em 'abertos'.
  function _noAberto(chave, t) {
    const st = _arvoreState[chave];
    if ((t.nivel || 0) < st.nivelFixo) return true;
    return st.abertos.has(t.id);
  }
  function _dentroHorizonte(chave, data) {
    const st = _arvoreState[chave];
    if (st.horizonteDias == null) return true;
    if (!data) return true; // sem data planejada não é excluído por horizonte
    const limite = new Date(); limite.setHours(0, 0, 0, 0); limite.setDate(limite.getDate() + st.horizonteDias);
    return new Date(data) <= limite;
  }

  // Agrega % concluído/esperado (peso por duração, mesma convenção do resto
  // do Dashboard — ver _peso), contagem e data mais próxima entre as folhas
  // descendentes de um nó, filtradas por status (execução/próximas) E pelo
  // horizonte de tempo da coluna (Próximas/Suprimentos só, ver _dentroHorizonte).
  function _resumoNo(chave, no, sorted, statusFiltro) {
    const campoData = t => (statusFiltro === _emExecucaoFiltro ? t.terminoPlanejado : t.inicioPlanejado);
    const folhas = _folhasDescendentes(no, sorted)
      .filter(statusFiltro)
      .filter(t => _dentroHorizonte(chave, campoData(t)));
    if (!folhas.length) return null;
    let somaPeso = 0, somaConc = 0, dataMaisProxima = null;
    folhas.forEach(t => {
      const peso = _peso(t);
      somaPeso += peso;
      somaConc += Math.min(100, Number(t.percentualConcluido) || 0) * peso;
      const campoData = statusFiltro === _emExecucaoFiltro ? t.terminoPlanejado : t.inicioPlanejado;
      const d = campoData ? new Date(campoData) : null;
      if (d && (!dataMaisProxima || d < dataMaisProxima)) dataMaisProxima = d;
    });
    return {
      qtd: folhas.length,
      percMedio: somaPeso ? somaConc / somaPeso : 0,
      dataMaisProxima,
    };
  }
  function _emExecucaoFiltro(t) { return (Number(t.percentualConcluido) || 0) > 0 && (Number(t.percentualConcluido) || 0) < 100; }
  function _proximasFiltro(t) { return !(Number(t.percentualConcluido) > 0); }

  // Peso de cada tarefa nos cálculos agregados (Curva S, KPIs do Hero).
  // HISTÓRICO: já foi trocado pra ponderar por QUANTIDADE (convenção de
  // Utils.percFamilia), mas isso distorceu o % geral pra perto de 0 nesta
  // obra — algumas tarefas com quantidade gigante e 0% de progresso afogam
  // o peso de quem já avançou. Revertido pra DURAÇÃO, a mesma fórmula já
  // usada (e comprovadamente correta) no card de % Executado da listagem de
  // Obras (js/obras.js:_calcularProgresso) — garante que o Hero do Dashboard
  // bate com o que já aparece lá.
  function _peso(t) { return Math.max(1, Number(t.duracao) || 1); }

  function _calcProgresso(tf) {
    const leaves = _folhas(tf);
    if (!leaves.length) return { percConcluido: 0, percEsperado: 0, inicioReal: null, terminoAtual: null, terminoBase: null };
    let somaPeso = 0, somaConc = 0, somaEsp = 0;
    let terminoAtual = null, terminoBase = null, inicioReal = null;
    leaves.forEach(t => {
      const peso = _peso(t);
      somaPeso += peso;
      somaConc += Math.min(100, Number(t.percentualConcluido) || 0) * peso;
      somaEsp += Math.min(100, Number(t.percentualEsperado) || 0) * peso;
      const fimA = t.terminoPlanejado ? new Date(t.terminoPlanejado) : null;
      const fimB = (t.terminoPlanejadoBase || t.terminoPlanejado) ? new Date(t.terminoPlanejadoBase || t.terminoPlanejado) : null;
      if (fimA && (!terminoAtual || fimA > terminoAtual)) terminoAtual = fimA;
      if (fimB && (!terminoBase || fimB > terminoBase)) terminoBase = fimB;
      if (t.inicioReal) { const d = new Date(t.inicioReal); if (!inicioReal || d < inicioReal) inicioReal = d; }
    });
    return {
      percConcluido: somaPeso ? somaConc / somaPeso : 0,
      percEsperado: somaPeso ? somaEsp / somaPeso : 0,
      inicioReal, terminoAtual, terminoBase,
    };
  }

  // ===================== ÁRVORE NAVEGÁVEL (Atividades / Suprimentos) =====================
  // Renderiza uma coluna como árvore expansível (mesmo padrão do Editor de
  // Estrutura do Planejamento): começa no nível fixo escolhido, nós com
  // filhos mostram resumo agregado (qtd + % médio + data) quando recolhidos,
  // e abrem/fecham por clique. `statusFiltro` decide quais folhas contam
  // (_emExecucaoFiltro ou _proximasFiltro) e qual data mostrar. `chave`
  // identifica a COLUNA (ativ_execucao / ativ_proximas / suprimentos), cada
  // uma com seu próprio nível fixo, expandidos e horizonte de tempo.
  function _renderArvoreColuna(chave, raizesNivelFixo, sorted, statusFiltro, corDot, vazioMsg) {
    const campoData = t => (statusFiltro === _emExecucaoFiltro ? t.terminoPlanejado : t.inicioPlanejado);
    const rotuloData = statusFiltro === _emExecucaoFiltro ? 'Prazo' : 'Início';

    const linhaFolha = (t) => `
      <div class="db-ativ-item">
        <span class="db-ativ-dot" style="background:${corDot};"></span>
        <div class="db-ativ-info">
          <div class="db-ativ-nome">${t.nome || 'Sem nome'}</div>
          <div class="db-ativ-sub text-sm text-muted">${t.local ? t.local + ' · ' : ''}${rotuloData}: ${Utils.formatarData(campoData(t))}</div>
        </div>
        <div class="db-ativ-perc">${Math.round(Number(t.percentualConcluido) || 0)}%</div>
      </div>`;

    const linhaGrupo = (t, resumo, aberto) => `
      <div class="db-ativ-item db-ativ-grupo" style="cursor:pointer;" onclick="Dashboard._arvToggle('${chave}','${t.id}')">
        <span class="db-ativ-dot" style="background:${corDot};opacity:.5;"></span>
        <span style="width:14px;flex-shrink:0;text-align:center;color:#777;font-size:.7rem;">${aberto ? '▼' : '▶'}</span>
        <div class="db-ativ-info">
          <div class="db-ativ-nome">${t.nome || 'Sem nome'} <span class="text-sm text-muted" style="font-weight:400;">(${resumo.qtd})</span></div>
          ${aberto ? '' : `<div class="db-ativ-sub text-sm text-muted">${resumo.dataMaisProxima ? rotuloData + ' mais próximo: ' + Utils.formatarData(resumo.dataMaisProxima) : 'Sem data'}</div>`}
        </div>
        <div class="db-ativ-perc">${Math.round(resumo.percMedio)}%</div>
      </div>`;

    // Renderiza recursivamente a partir de uma lista de nós de um mesmo nível.
    const renderNivel = (nos, indent) => {
      let html = '';
      nos.forEach(t => {
        const filhos = _filhosDiretos(t, sorted);
        if (!filhos.length) {
          // É folha de verdade — só entra se bater no filtro de status E no horizonte.
          if (statusFiltro(t) && _dentroHorizonte(chave, campoData(t))) {
            html += `<div style="padding-left:${indent}px;">${linhaFolha(t)}</div>`;
          }
          return;
        }
        const resumo = _resumoNo(chave, t, sorted, statusFiltro);
        if (!resumo) return; // nenhum descendente bate no filtro/horizonte — não mostra o grupo
        const aberto = _noAberto(chave, t);
        html += `<div style="padding-left:${indent}px;">${linhaGrupo(t, resumo, aberto)}</div>`;
        if (aberto) html += renderNivel(filhos, indent + 14);
      });
      return html;
    };

    const corpo = renderNivel(raizesNivelFixo, 0);
    return corpo || `<div class="text-sm text-muted" style="padding:10px 0;">${vazioMsg}</div>`;
  }

  // Roteia o re-render pra função certa (renderAtividades cuida de ambas as
  // colunas ativ_execucao/ativ_proximas; suprimentos tem a sua própria).
  function _rerenderColuna(chave) {
    if (chave === 'suprimentos') _renderSuprimentosDash(); else _renderAtividades();
  }

  // Controle de NÍVEL fixo: sem teto artificial (o "trava no 4" reportado
  // era um Math.min(4,...) — removido; o único teto real é a profundidade
  // que existir nos dados). Botão "+" aparece só se houver nível mais fundo
  // disponível além dos já exibidos.
  function _nivelMaximo(sorted) {
    return sorted.reduce((max, t) => Math.max(max, t.nivel || 0), 0);
  }
  function _controleNivel(chave) {
    const sorted = [...tarefas].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    const max = _nivelMaximo(sorted);
    const st = _arvoreState[chave];
    let botoes = '';
    for (let n = 0; n <= max; n++) {
      botoes += `<button class="btn btn-sm ${st.nivelFixo === n ? 'btn-primario' : 'btn-secundario'}" style="font-size:.66rem;padding:2px 8px;" onclick="Dashboard._arvNivelFixo('${chave}',${n})">Nível ${n}</button>`;
    }
    return `<div style="display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap;">${botoes}</div>`;
  }
  // Seletor de horizonte de tempo (só pra colunas que usam — Em Execução não
  // chama isto). Opções em dias; "Tudo" remove o teto.
  const HORIZONTE_OPCOES = [
    { dias: 7, label: '7 dias' },
    { dias: 30, label: '1 mês' },
    { dias: 90, label: '3 meses' },
    { dias: 180, label: '6 meses' },
    { dias: 365, label: '1 ano' },
    { dias: null, label: 'Tudo' },
  ];
  function _controleHorizonte(chave) {
    const st = _arvoreState[chave];
    return `<select class="input" style="max-width:130px;font-size:.72rem;padding:3px 6px;" onchange="Dashboard._arvHorizonte('${chave}',this.value)">
      ${HORIZONTE_OPCOES.map(o => `<option value="${o.dias}" ${st.horizonteDias === o.dias ? 'selected' : ''}>${o.label}</option>`).join('')}
    </select>`;
  }
  function _arvNivelFixo(chave, nivel) {
    _resetArvore(chave, nivel);
    _rerenderColuna(chave);
  }
  function _arvHorizonte(chave, valor) {
    const dias = valor === 'null' ? null : Number(valor);
    _arvoreState[chave].horizonteDias = dias;
    localStorage.setItem(_chaveLS(chave, 'horizonte'), String(dias));
    _salvarPrefsRemotas();
    _rerenderColuna(chave);
  }
  function _arvToggle(chave, id) {
    _toggleNo(chave, id);
    _rerenderColuna(chave);
  }

  // ===================== ATIVIDADES =====================
  function _renderAtividades() {
    const host = document.getElementById('db-atividades');
    const atualizado = document.getElementById('db-atualizado-em');
    if (atualizado) atualizado.textContent = 'Atualizado em ' + Utils.formatarDataHora(new Date());
    if (!host) return;

    const sorted = [...tarefas].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    const raizesExec = sorted.filter(t => (t.nivel || 0) === _arvoreState.ativ_execucao.nivelFixo);
    const raizesProx = sorted.filter(t => (t.nivel || 0) === _arvoreState.ativ_proximas.nivelFixo);

    const corpoExec = _renderArvoreColuna('ativ_execucao', raizesExec, sorted, _emExecucaoFiltro, '#facc15', 'Nenhuma atividade em execução.');
    const corpoProx = _renderArvoreColuna('ativ_proximas', raizesProx, sorted, _proximasFiltro, '#60a5fa', 'Nenhuma atividade pendente neste período.');

    host.innerHTML = `
      <div class="db-ativ-bloco">
        <div class="db-ativ-col-titulo">Em Execução</div>
        ${_controleNivel('ativ_execucao')}
        ${corpoExec}
      </div>
      <div class="db-ativ-bloco" style="margin-top:16px;">
        <div class="db-ativ-col-titulo" style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
          <span>Próximas</span>
          ${_controleHorizonte('ativ_proximas')}
        </div>
        ${_controleNivel('ativ_proximas')}
        ${corpoProx}
      </div>`;
  }

  // ===================== SUPRIMENTOS (resumo no Dashboard) =====================
  // Mostra as Próximas Atividades (ainda não iniciadas no Planejamento) cujo
  // pipeline de Suprimentos ainda não foi tocado (todas as 5 etapas em
  // "não iniciado", ou nem existe doc de suprimentos ainda pra essa tarefa) —
  // ou seja, "falta providenciar suprimento" pras que estão chegando.
  function _statusSuprimento(tarefaId) {
    const doc = suprimentos.find(s => s.tarefaId === tarefaId || s.id === tarefaId);
    if (!doc || !doc.etapas) return 'sem_doc';
    const etapas = Object.values(doc.etapas);
    const tocada = etapas.some(e => e && e.status && e.status !== 'nao_iniciado');
    return tocada ? 'iniciado' : 'nao_iniciado';
  }
  // Próxima (ainda não iniciada) E com pipeline de Suprimentos parado —
  // é o filtro de status usado só na árvore do card Suprimentos.
  function _pendenteSuprimentoFiltro(t) {
    return _proximasFiltro(t) && !!t.inicioPlanejado && _statusSuprimento(t.id) !== 'iniciado';
  }

  function _renderSuprimentosDash() {
    const host = document.getElementById('db-suprimentos-dash');
    if (!host) return;

    const sorted = [...tarefas].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    const raizes = sorted.filter(t => (t.nivel || 0) === _arvoreState.suprimentos.nivelFixo);
    const corpo = _renderArvoreColuna('suprimentos', raizes, sorted, _pendenteSuprimentoFiltro, '#f59e0b',
      'Nenhuma próxima atividade sem Suprimentos iniciado neste período.');

    host.innerHTML = `
      <div class="db-ativ-col-titulo" style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
        <span class="text-sm text-muted" style="font-weight:400;">Próximas atividades cujo pipeline de Suprimentos ainda não foi iniciado:</span>
        ${_controleHorizonte('suprimentos')}
      </div>
      ${_controleNivel('suprimentos')}
      ${corpo}`;
  }

  // ===================== CURVA S =====================
  function _mesLabel(d) { return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', ''); }
  // Mesmo cálculo de semana ISO usado em js/semanal.js (rótulo "S<semana> A<ano>") —
  // mantém a mesma convenção de numeração de semana em todo o sistema.
  function _isoWeek(d) {
    const t = new Date(d); t.setHours(0, 0, 0, 0); t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
    const w1 = new Date(t.getFullYear(), 0, 4);
    return { w: 1 + Math.round(((t - w1) / 864e5 - 3 + ((w1.getDay() + 6) % 7)) / 7), y: t.getFullYear() };
  }

  function _gerarBuckets(dMin, dMax, granularidade) {
    const buckets = [];
    if (granularidade === 'semanal') {
      // Semana de domingo a sábado, igual à convenção do módulo Semanal.
      let cursor = new Date(dMin); cursor.setDate(cursor.getDate() - cursor.getDay());
      const fimCursor = new Date(dMax);
      while (cursor <= fimCursor) {
        const inicioSemana = new Date(cursor);
        const fimSemana = new Date(cursor); fimSemana.setDate(fimSemana.getDate() + 7);
        const { w, y } = _isoWeek(new Date(inicioSemana.getTime() + 864e5));
        buckets.push({ label: `S${w} ${String(y).slice(2)}`, inicio: inicioSemana, fim: fimSemana, planMensal: 0, realMensalEstimado: 0 });
        cursor = fimSemana;
      }
    } else {
      let cursor = new Date(dMin.getFullYear(), dMin.getMonth(), 1);
      const fimCursor = new Date(dMax.getFullYear(), dMax.getMonth(), 1);
      while (cursor <= fimCursor) {
        const inicioMes = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
        const fimMes = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
        buckets.push({ label: _mesLabel(cursor), inicio: inicioMes, fim: fimMes, planMensal: 0, realMensalEstimado: 0 });
        cursor = fimMes;
      }
    }
    return buckets;
  }

  function _calcCurvaS(tf, historico, granularidade) {
    const leaves = _folhas(tf).filter(t => t.inicioPlanejado || t.inicioPlanejadoBase);
    if (!leaves.length) return null;
    const hoje = new Date();

    let dMin = null, dMax = null;
    leaves.forEach(t => {
      const ini = new Date(t.inicioPlanejadoBase || t.inicioPlanejado);
      const fim = new Date(t.terminoPlanejadoBase || t.terminoPlanejado || t.inicioPlanejado);
      if (!dMin || ini < dMin) dMin = ini;
      if (!dMax || fim > dMax) dMax = fim;
    });
    if (!dMin || !dMax) return null;
    if (hoje > dMax) dMax = hoje;

    const meses = _gerarBuckets(dMin, dMax, granularidade);

    function overlapFrac(iniA, fimA, iniB, fimB) {
      const iniOverlap = Math.max(iniA.getTime(), iniB.getTime());
      const fimOverlap = Math.min(fimA.getTime(), fimB.getTime());
      const overlap = Math.max(0, fimOverlap - iniOverlap);
      const total = Math.max(1, fimA.getTime() - iniA.getTime());
      return overlap / total;
    }

    let totalPeso = 0;
    leaves.forEach(t => { totalPeso += _peso(t); });
    if (!totalPeso) totalPeso = 1;

    // ---- Esperado (sempre pelas datas — não depende de histórico) e uma
    // ESTIMATIVA do Executado (usada só como fallback pros meses anteriores
    // ao início do histórico real, ver abaixo). ----
    leaves.forEach(t => {
      const peso = _peso(t);
      const iniP = new Date(t.inicioPlanejadoBase || t.inicioPlanejado);
      const fimP = new Date(t.terminoPlanejadoBase || t.terminoPlanejado || t.inicioPlanejado);
      const fimPValido = fimP > iniP ? fimP : new Date(iniP.getTime() + 864e5);
      meses.forEach(m => { m.planMensal += peso * overlapFrac(iniP, fimPValido, m.inicio, m.fim); });

      const perc = Math.min(100, Number(t.percentualConcluido) || 0);
      if (perc > 0) {
        const pesoReal = peso * (perc / 100);
        if (perc >= 100 && t.terminoReal) {
          const dConcl = new Date(t.terminoReal);
          const mAlvo = meses.find(m => dConcl >= m.inicio && dConcl < m.fim) || meses[meses.length - 1];
          mAlvo.realMensalEstimado += pesoReal;
        } else {
          const iniR = new Date(t.inicioReal || t.inicioPlanejado || iniP);
          const fimR = hoje > iniR ? hoje : new Date(iniR.getTime() + 864e5);
          meses.forEach(m => { m.realMensalEstimado += pesoReal * overlapFrac(iniR, fimR, m.inicio, m.fim); });
        }
      }
    });

    // ---- Executado REAL, reconstruído a partir do histórico salvo em
    // obras/{id}/historicoExecucao (ver Database.js: toda vez que uma tarefa
    // é criada/atualizada com percentualConcluido, o dia fica registrado).
    // Semeia o "estado" de cada tarefa com o valor ATUAL (percentualConcluido
    // de hoje) e depois REAPLICA os snapshots em ordem cronológica — assim,
    // qualquer tarefa nunca tocada durante o período rastreado mantém
    // corretamente o valor de hoje (nada mudou nela), e qualquer tarefa que
    // mudou tem seu valor de cada dia reconstruído com precisão.
    const historicoOrdenado = (historico || []).filter(h => h && h.data).sort((a, b) => String(a.data).localeCompare(String(b.data)));
    let idxInicioHistorico = -1;
    if (historicoOrdenado.length) {
      const dataInicio = new Date(historicoOrdenado[0].data + 'T00:00:00');
      idxInicioHistorico = meses.findIndex(m => m.fim > dataInicio);
      if (idxInicioHistorico === -1) idxInicioHistorico = meses.length - 1;

      const estado = new Map();
      leaves.forEach(t => estado.set(t.id, Math.min(100, Number(t.percentualConcluido) || 0)));
      let hIdx = 0;
      meses.forEach((m, i) => {
        const limite = m.fim < hoje ? m.fim : hoje;
        while (hIdx < historicoOrdenado.length && new Date(historicoOrdenado[hIdx].data + 'T00:00:00') < limite) {
          const diaObj = historicoOrdenado[hIdx].tarefas || {};
          Object.keys(diaObj).forEach(tarefaId => {
            const v = diaObj[tarefaId];
            if (v && v.percentualConcluido != null) estado.set(tarefaId, Math.min(100, Number(v.percentualConcluido) || 0));
          });
          hIdx++;
        }
        if (i >= idxInicioHistorico) {
          let soma = 0;
          leaves.forEach(t => { soma += (estado.get(t.id) || 0) * _peso(t); });
          m.realAcumReal = soma / totalPeso * 100;
        }
      });
    }

    let acumP = 0, acumREstimado = 0, hojeIdx = 0;
    let acumRealAnterior = 0;
    meses.forEach((m, i) => {
      acumP += m.planMensal; acumREstimado += m.realMensalEstimado;
      m.planAcum = Math.min(100, acumP / totalPeso * 100);
      m.planMensalPct = m.planMensal / totalPeso * 100;

      if (idxInicioHistorico !== -1 && i >= idxInicioHistorico) {
        m.realAcum = Math.min(100, m.realAcumReal);
        m.realMensalPct = Math.max(0, m.realAcum - acumRealAnterior);
        m.origemReal = 'historico';
      } else {
        m.realAcum = Math.min(100, acumREstimado / totalPeso * 100);
        m.realMensalPct = m.realMensalEstimado / totalPeso * 100;
        m.origemReal = 'estimado';
      }
      acumRealAnterior = m.realAcum;
      if (m.inicio <= hoje) hojeIdx = i;
    });
    return { meses, hojeIdx, idxInicioHistorico };
  }

  function setCurvaGranularidade(g) {
    _curvaGranularidade = g;
    document.querySelectorAll('#db-curva-toggle .aba-btn').forEach(b => b.classList.toggle('ativo', b.dataset.v === g));
    _renderCurvaS();
  }

  function _renderCurvaS() {
    const host = document.getElementById('db-curva-s');
    if (!host) return;
    const curva = _calcCurvaS(tarefas, historicoExecucao, _curvaGranularidade);
    _curvaCache = curva;
    if (!curva || !curva.meses.length) {
      host.innerHTML = '<div class="estado-vazio"><p class="text-sm">Sem dados de planejamento suficientes para montar a Curva S.</p></div>';
      return;
    }
    const rotuloPeriodo = _curvaGranularidade === 'semanal' ? 'Semanal' : 'Mensal';
    host.innerHTML = _svgCurva(curva.meses, curva.hojeIdx, {
      idTooltip: 'db-curva-tooltip',
      idHits: 'db-curva-hit-',
      alturaGrafico: 420,
      comBarras: true,
      idxInicioHistorico: curva.idxInicioHistorico,
    });
    _attachHover(host, curva.meses, (m) => `
      <div class="db-tt-titulo">${m.label} ${m.origemReal === 'historico' ? '<span class="badge badge-sucesso" style="font-size:.6rem;">real</span>' : '<span class="badge badge-neutro" style="font-size:.6rem;">estimado</span>'}</div>
      <div class="db-tt-linha"><i style="background:#999;"></i>Esperado ${rotuloPeriodo}: <b>${m.planMensalPct.toFixed(2)}%</b></div>
      <div class="db-tt-linha"><i style="background:var(--cor-primaria);"></i>Executado ${rotuloPeriodo}: <b>${m.realMensalPct.toFixed(2)}%</b></div>
      <div class="db-tt-linha"><i style="background:#999;border-radius:50%;"></i>Esperado Acumulado: <b>${m.planAcum.toFixed(2)}%</b></div>
      <div class="db-tt-linha"><i style="background:var(--cor-primaria-dark);border-radius:50%;"></i>Executado Acumulado: <b>${m.realAcum.toFixed(2)}%</b></div>
    `);
  }

  // SVG genérico usado pela Curva S (linhas acumuladas + barras mensais).
  function _svgCurva(meses, hojeIdx, opts) {
    const n = meses.length;
    const W = Math.max(900, n * 46), H = opts.alturaGrafico || 380;
    const padL = 40, padR = 40, padT = 16, padB = 34;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const x = i => padL + (n === 1 ? 0 : (i / (n - 1)) * plotW);
    const yAcum = v => padT + plotH - (Math.max(0, Math.min(100, v)) / 100) * plotH;

    let bars = '';
    if (opts.comBarras) {
      const maxMensal = Math.max(1, ...meses.map(m => Math.max(m.planMensalPct, m.realMensalPct)));
      const barH = v => (v / maxMensal) * (plotH * 0.34);
      const barW = Math.max(3, (plotW / n) * 0.32);
      meses.forEach((m, i) => {
        const cx = x(i);
        const hP = barH(m.planMensalPct), hR = barH(m.realMensalPct);
        bars += `<rect x="${cx - barW - 1}" y="${padT + plotH - hP}" width="${barW}" height="${hP}" fill="#c9c9c9" opacity="0.85"/>`;
        bars += `<rect x="${cx + 1}" y="${padT + plotH - hR}" width="${barW}" height="${hR}" fill="var(--cor-primaria)" opacity="0.95"/>`;
      });
    }

    const pathPlan = meses.map((m, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${yAcum(m.planAcum).toFixed(1)}`).join(' ');
    const pathReal = meses.map((m, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${yAcum(m.realAcum).toFixed(1)}`).join(' ');

    const hojeX = x(hojeIdx);
    let marcadorHistorico = '';
    if (opts.idxInicioHistorico != null && opts.idxInicioHistorico > 0 && opts.idxInicioHistorico < n) {
      const hx = x(opts.idxInicioHistorico);
      marcadorHistorico = `<line x1="${hx.toFixed(1)}" x2="${hx.toFixed(1)}" y1="${padT}" y2="${padT + plotH}" stroke="#16a34a" stroke-width="1" stroke-dasharray="2,3"/>
        <text x="${hx.toFixed(1)}" y="${H - 22}" font-size="9" fill="#16a34a" text-anchor="middle">início do histórico real ▸</text>`;
    }
    const labelStep = Math.max(1, Math.ceil(n / 18));
    let labels = '';
    meses.forEach((m, i) => {
      if (i % labelStep !== 0 && i !== n - 1) return;
      labels += `<text x="${x(i).toFixed(1)}" y="${H - 10}" font-size="10" fill="#888" text-anchor="middle">${m.label}</text>`;
    });

    const gridY = [0, 25, 50, 75, 100].map(v => `<line x1="${padL}" x2="${W - padR}" y1="${yAcum(v).toFixed(1)}" y2="${yAcum(v).toFixed(1)}" stroke="#eee" stroke-width="1"/><text x="4" y="${(yAcum(v) + 3).toFixed(1)}" font-size="9" fill="#999">${v}%</text>`).join('');

    let hits = '';
    meses.forEach((m, i) => {
      const cx = x(i);
      const larguraHit = plotW / n;
      hits += `<rect class="db-hit" data-idx="${i}" x="${(cx - larguraHit / 2).toFixed(1)}" y="${padT}" width="${larguraHit.toFixed(1)}" height="${plotH}" fill="transparent" style="cursor:pointer;"/>`;
    });

    return `
      <div style="overflow-x:auto;">
        <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;min-width:${W}px;">
          ${gridY}
          <line x1="${hojeX.toFixed(1)}" x2="${hojeX.toFixed(1)}" y1="${padT}" y2="${padT + plotH}" stroke="#ef4444" stroke-width="1" stroke-dasharray="4,3"/>
          <text x="${hojeX.toFixed(1)}" y="${padT - 4}" font-size="9" fill="#ef4444" text-anchor="middle">hoje</text>
          ${marcadorHistorico}
          ${bars}
          <path d="${pathPlan}" fill="none" stroke="#999" stroke-width="2" stroke-dasharray="5,3"/>
          <path d="${pathReal}" fill="none" stroke="var(--cor-primaria-dark, #B89400)" stroke-width="2.5"/>
          ${labels}
          ${hits}
        </svg>
      </div>
      <div class="db-tooltip" id="${opts.idTooltip}"></div>
      ${opts.comBarras ? `<div class="db-legenda">
        <span><i style="background:#999;"></i> Esperado (acumulado)</span>
        <span><i style="background:var(--cor-primaria-dark,#B89400);"></i> Executado (acumulado)</span>
        <span><i style="background:#c9c9c9;"></i> Esperado mensal</span>
        <span><i style="background:var(--cor-primaria);"></i> Executado mensal</span>
      </div>
      <div class="text-sm text-muted" style="margin-top:6px;">Esperado: distribuído pelas datas de início/término (linha de base) de cada tarefa, ponderado por duração. Executado: ${opts.idxInicioHistorico > 0 ? 'a partir da linha verde é reconstruído com o histórico real salvo diariamente (obras/{obra}/historicoExecucao); antes dela é uma estimativa retroativa, porque o sistema só passou a guardar o % de cada dia a partir daquele ponto' : (opts.idxInicioHistorico === 0 ? 'já 100% reconstruído a partir do histórico real salvo diariamente' : 'ainda não há histórico salvo nesta obra — os valores mostrados são uma estimativa a partir do % concluído atual; a partir de agora, toda atualização de tarefa vai gerar um registro real e a curva passa a ficar precisa')}.</div>` : ''}`;
  }

  // Liga hover nos retângulos invisíveis (.db-hit) de um gráfico já renderizado,
  // mostrando uma tooltip flutuante com o conteúdo retornado por conteudoFn(item).
  function _attachHover(wrap, itens, conteudoFn) {
    const tooltip = wrap.querySelector('.db-tooltip');
    if (!tooltip) return;
    wrap.querySelectorAll('.db-hit').forEach(hit => {
      const idx = Number(hit.dataset.idx);
      hit.addEventListener('mouseenter', () => {
        tooltip.innerHTML = conteudoFn(itens[idx]);
        tooltip.style.display = 'block';
      });
      hit.addEventListener('mousemove', (e) => {
        const rectWrap = wrap.getBoundingClientRect();
        let left = e.clientX - rectWrap.left + 14;
        const maxLeft = rectWrap.width - 220;
        if (left > maxLeft) left = e.clientX - rectWrap.left - 220 - 14;
        tooltip.style.left = Math.max(4, left) + 'px';
        tooltip.style.top = (e.clientY - rectWrap.top - 20) + 'px';
      });
      hit.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
    });
  }

  // ===================== ÍNDICE DE DESEMPENHO DE PRAZO (IDP) =====================
  function _renderIDP() {
    const host = document.getElementById('db-idp');
    if (!host) return;
    if (!_curvaCache || !_curvaCache.meses.length) {
      host.innerHTML = '<div class="estado-vazio"><p class="text-sm">Sem dados suficientes para calcular o IDP.</p></div>';
      return;
    }
    const meses = _curvaCache.meses.map(m => ({
      label: m.label,
      idp: m.planAcum > 0.01 ? (m.realAcum / m.planAcum) : null,
      origemReal: m.origemReal,
    }));
    host.innerHTML = _svgIDP(meses, _curvaCache.hojeIdx);
    _attachHover(host, meses, (m) => `
      <div class="db-tt-titulo">${m.label} ${m.origemReal === 'historico' ? '<span class="badge badge-sucesso" style="font-size:.6rem;">real</span>' : '<span class="badge badge-neutro" style="font-size:.6rem;">estimado</span>'}</div>
      <div class="db-tt-linha">IDP: <b>${m.idp != null ? m.idp.toFixed(2) : '—'}</b></div>
      <div class="text-sm text-muted" style="margin-top:4px;max-width:190px;">IDP ≥ 1 significa que o executado está igual ou à frente do esperado até este mês.</div>
    `);
  }

  function _svgIDP(meses, hojeIdx) {
    const n = meses.length;
    const W = Math.max(900, n * 46), H = 260;
    const padL = 34, padR = 30, padT = 34, padB = 30;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const valores = meses.map(m => m.idp).filter(v => v != null);
    const maxV = Math.max(2, ...(valores.length ? valores : [1]) .map(v => v * 1.15));
    const x = i => padL + (n === 1 ? 0 : (i / (n - 1)) * plotW);
    const y = v => padT + plotH - (Math.max(0, v) / maxV) * plotH;

    let pathD = '', pontos = '', hits = '';
    let iniciado = false;
    meses.forEach((m, i) => {
      const larguraHit = plotW / n;
      hits += `<rect class="db-hit" data-idx="${i}" x="${(x(i) - larguraHit / 2).toFixed(1)}" y="${padT}" width="${larguraHit.toFixed(1)}" height="${plotH}" fill="transparent" style="cursor:pointer;"/>`;
      if (m.idp == null) return;
      pathD += `${!iniciado ? 'M' : 'L'}${x(i).toFixed(1)},${y(m.idp).toFixed(1)} `;
      iniciado = true;
      pontos += `<circle cx="${x(i).toFixed(1)}" cy="${y(m.idp).toFixed(1)}" r="3.5" fill="var(--cor-primaria-dark,#B89400)"/>
        <rect x="${(x(i) - 17).toFixed(1)}" y="${(y(m.idp) - 24).toFixed(1)}" width="34" height="16" rx="4" fill="#1a1a1a"/>
        <text x="${x(i).toFixed(1)}" y="${(y(m.idp) - 12.5).toFixed(1)}" font-size="9.5" fill="#fff" text-anchor="middle">${m.idp.toFixed(2)}</text>`;
    });

    const labelStep = Math.max(1, Math.ceil(n / 18));
    let labels = '';
    meses.forEach((m, i) => {
      if (i % labelStep !== 0 && i !== n - 1) return;
      labels += `<text x="${x(i).toFixed(1)}" y="${H - 8}" font-size="10" fill="#888" text-anchor="middle">${m.label}</text>`;
    });

    const gridVals = [0, 0.5, 1, 1.5, 2].filter(v => v <= maxV);
    const gridY = gridVals.map(v => `<line x1="${padL}" x2="${W - padR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="#eee" stroke-width="1"/><text x="4" y="${(y(v) + 3).toFixed(1)}" font-size="9" fill="#999">${v.toFixed(2)}</text>`).join('');

    return `
      <div style="overflow-x:auto;">
        <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;min-width:${W}px;">
          ${gridY}
          <line x1="${padL}" x2="${W - padR}" y1="${y(1).toFixed(1)}" y2="${y(1).toFixed(1)}" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="6,3"/>
          <text x="${W - padR}" y="${(y(1) - 5).toFixed(1)}" font-size="10" fill="#ef4444" text-anchor="end">Ideal</text>
          <line x1="${x(hojeIdx).toFixed(1)}" x2="${x(hojeIdx).toFixed(1)}" y1="${padT}" y2="${padT + plotH}" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4,3"/>
          <path d="${pathD}" fill="none" stroke="var(--cor-primaria-dark,#B89400)" stroke-width="2"/>
          ${pontos}
          ${labels}
          ${hits}
        </svg>
      </div>
      <div class="db-tooltip"></div>
      <div class="text-sm text-muted" style="margin-top:6px;">IDP = Executado Acumulado ÷ Esperado Acumulado da Curva S acima. A partir da linha verde na Curva S, usa histórico real salvo diariamente; antes dela, é uma estimativa retroativa.</div>`;
  }

  // ===================== AVANÇO POR PACOTES =====================
  // 4 visões, igual ao modelo de referência: "Pacotes" mostra cada tarefa-folha
  // individualmente (sem agrupar) — é a granularidade real do Planejamento.
  // "Agrupadores"/"Locais"/"Responsáveis" agrupam pelos campos correspondentes
  // da tarefa (grupo/local/responsavel). Todas ponderadas por quantidade.
  let _pacotesView = 'pacotes';

  function setPacotesView(v) {
    _pacotesView = v;
    document.querySelectorAll('#db-pacotes-toggle .aba-btn').forEach(b => b.classList.toggle('ativo', b.dataset.v === v));
    _renderPacotes();
  }

  function _calcPacotes(tf, modo) {
    const leaves = _folhas(tf);
    if (!leaves.length) return [];
    const totalPeso = leaves.reduce((s, t) => s + _peso(t), 0) || 1;

    if (modo === 'pacotes') {
      // Sem agrupar: cada tarefa-folha é o seu próprio "pacote".
      return leaves.map(t => {
        const peso = _peso(t);
        return {
          nome: t.nome || 'Sem nome', pesoPct: peso / totalPeso * 100,
          esperado: Math.min(100, Number(t.percentualEsperado) || 0),
          executado: Math.min(100, Number(t.percentualConcluido) || 0),
        };
      }).sort((a, b) => b.pesoPct - a.pesoPct);
    }

    const campo = modo === 'agrupadores' ? 'grupo' : modo === 'locais' ? 'local' : 'responsavel';
    const semRotulo = modo === 'agrupadores' ? 'Sem Agrupador' : modo === 'locais' ? 'Sem Local' : 'Sem Responsável';
    const grupos = new Map();
    leaves.forEach(t => {
      const nome = (t[campo] && String(t[campo]).trim()) || semRotulo;
      const peso = _peso(t);
      if (!grupos.has(nome)) grupos.set(nome, { nome, peso: 0, somaEsp: 0, somaConc: 0 });
      const g = grupos.get(nome);
      g.peso += peso;
      g.somaEsp += Math.min(100, Number(t.percentualEsperado) || 0) * peso;
      g.somaConc += Math.min(100, Number(t.percentualConcluido) || 0) * peso;
    });
    return [...grupos.values()]
      .map(g => ({ nome: g.nome, pesoPct: g.peso / totalPeso * 100, esperado: g.somaEsp / g.peso, executado: g.somaConc / g.peso }))
      .sort((a, b) => b.pesoPct - a.pesoPct);
  }

  function _renderPacotes() {
    const host = document.getElementById('db-pacotes');
    if (!host) return;
    const pacotes = _calcPacotes(tarefas, _pacotesView);
    if (!pacotes.length) {
      host.innerHTML = `<div class="estado-vazio"><p class="text-sm">${_pacotesView === 'pacotes' ? 'Nenhuma tarefa no Planejamento.' : 'Nenhuma tarefa com esse campo preenchido no Planejamento.'}</p></div>`;
      return;
    }
    host.innerHTML = _svgPacotes(pacotes);
    _attachHover(host, pacotes, (p) => `
      <div class="db-tt-titulo">${_esc(p.nome)}</div>
      <div class="db-tt-linha">Peso no projeto: <b>${p.pesoPct.toFixed(2)}%</b></div>
      <div class="db-tt-linha"><i style="background:#1a1a1a;"></i>Esperado: <b>${Math.round(p.esperado)}%</b></div>
      <div class="db-tt-linha"><i style="background:var(--cor-primaria);"></i>Executado: <b>${Math.round(p.executado)}%</b></div>
    `);
  }

  function _svgPacotes(pacotes) {
    const n = pacotes.length;
    const grupoW = 58;
    const W = Math.max(900, n * grupoW + 60), H = 340;
    const padL = 40, padR = 20, padT = 30, padB = 90;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const barW = Math.min(18, (plotW / n) * 0.32);

    let bars = '', labels = '', pesos = '', hits = '';
    pacotes.forEach((p, i) => {
      const cx = padL + (i + 0.5) * (plotW / n);
      const hEsp = (p.esperado / 100) * plotH, hExec = (p.executado / 100) * plotH;
      bars += `<rect x="${(cx - barW - 1).toFixed(1)}" y="${(padT + plotH - hEsp).toFixed(1)}" width="${barW}" height="${hEsp.toFixed(1)}" fill="#1a1a1a"/>`;
      bars += `<text x="${(cx - barW / 2 - 1).toFixed(1)}" y="${(padT + plotH - hEsp - 4).toFixed(1)}" font-size="9" fill="#1a1a1a" text-anchor="middle">${Math.round(p.esperado)}%</text>`;
      bars += `<rect x="${(cx + 1).toFixed(1)}" y="${(padT + plotH - hExec).toFixed(1)}" width="${barW}" height="${hExec.toFixed(1)}" fill="var(--cor-primaria)"/>`;
      bars += `<text x="${(cx + barW / 2 + 1).toFixed(1)}" y="${(padT + plotH - hExec - 4).toFixed(1)}" font-size="9" fill="var(--cor-primaria-dark,#B89400)" text-anchor="middle">${Math.round(p.executado)}%</text>`;
      const nomeCurto = p.nome.length > 22 ? p.nome.slice(0, 21) + '…' : p.nome;
      labels += `<text x="${cx.toFixed(1)}" y="${(padT + plotH + 14).toFixed(1)}" font-size="9.5" fill="#333" text-anchor="end" transform="rotate(-40 ${cx.toFixed(1)} ${(padT + plotH + 14).toFixed(1)})"><title>${_esc(p.nome)}</title>${_esc(nomeCurto)}</text>`;
      pesos += `<text x="${cx.toFixed(1)}" y="${(padT + plotH + 62).toFixed(1)}" font-size="9" fill="#999" text-anchor="middle">${p.pesoPct.toFixed(2)}%</text>`;
      hits += `<rect class="db-hit" data-idx="${i}" x="${(cx - (plotW / n) / 2).toFixed(1)}" y="${padT}" width="${(plotW / n).toFixed(1)}" height="${plotH}" fill="transparent" style="cursor:pointer;"/>`;
    });

    const gridY = [0, 25, 50, 75, 100].map(v => `<line x1="${padL}" x2="${W - padR}" y1="${(padT + plotH - (v / 100) * plotH).toFixed(1)}" y2="${(padT + plotH - (v / 100) * plotH).toFixed(1)}" stroke="#eee" stroke-width="1"/><text x="4" y="${(padT + plotH - (v / 100) * plotH + 3).toFixed(1)}" font-size="9" fill="#999">${v}%</text>`).join('');

    return `
      <div style="overflow-x:auto;">
        <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;min-width:${W}px;">
          ${gridY}
          ${bars}
          ${labels}
          ${pesos}
          ${hits}
        </svg>
      </div>
      <div class="db-tooltip"></div>
      <div class="db-legenda">
        <span><i style="background:#1a1a1a;"></i> Esperado</span>
        <span><i style="background:var(--cor-primaria);"></i> Executado</span>
        <span style="color:#999;">Peso = participação (por quantidade) no total do projeto</span>
      </div>`;
  }

  function _esc(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // ===================== PPC SEMANAL =====================
  function _periodosFechados() {
    return semanas.filter(s => s.status === 'fechada' && s.relatorio).sort((a, b) => String(a.fim).localeCompare(String(b.fim))).slice(-12);
  }

  function _renderPpcSemanal() {
    const host = document.getElementById('db-ppc-semanal');
    if (!host) return;
    const periodos = _periodosFechados();
    if (!periodos.length) {
      host.innerHTML = '<div class="estado-vazio"><p class="text-sm">Nenhum período fechado no Semanal ainda.</p></div>';
      return;
    }
    host.innerHTML = _svgPpc(periodos);
    _attachHover(host, periodos, (p) => `
      <div class="db-tt-titulo">${p.label}</div>
      <div class="db-tt-linha">PPC: <b>${p.relatorio.resumo.ppc}%</b></div>
      <div class="db-tt-linha text-muted">${p.relatorio.resumo.concluidasNoEsperado}/${p.relatorio.resumo.tarefas} tarefas dentro do esperado</div>
    `);
  }

  function _svgPpc(periodos) {
    const n = periodos.length;
    const W = Math.max(500, n * 60), H = 260;
    const padL = 34, padR = 20, padT = 30, padB = 34;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const maxY = 110;
    const y = v => padT + plotH - (Math.min(v, maxY) / maxY) * plotH;
    const barW = Math.min(34, (plotW / n) * 0.55);

    let bars = '', labels = '', hits = '';
    periodos.forEach((p, i) => {
      const cx = padL + (i + 0.5) * (plotW / n);
      const ppc = p.relatorio.resumo.ppc || 0;
      const h = plotH - (y(ppc) - padT);
      bars += `<rect x="${(cx - barW / 2).toFixed(1)}" y="${y(ppc).toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" fill="#1a1a1a" rx="2"/>`;
      bars += `<text x="${cx.toFixed(1)}" y="${(y(ppc) - 6).toFixed(1)}" font-size="10" fill="#1a1a1a" text-anchor="middle" font-weight="700">${ppc}%</text>`;
      labels += `<text x="${cx.toFixed(1)}" y="${H - 12}" font-size="10" fill="#666" text-anchor="middle">${p.label}</text>`;
      hits += `<rect class="db-hit" data-idx="${i}" x="${(cx - (plotW / n) / 2).toFixed(1)}" y="${padT}" width="${(plotW / n).toFixed(1)}" height="${plotH}" fill="transparent" style="cursor:pointer;"/>`;
    });

    return `
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;">
        <line x1="${padL}" x2="${W - padR}" y1="${y(100).toFixed(1)}" y2="${y(100).toFixed(1)}" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="6,3"/>
        <text x="${W - padR}" y="${(y(100) - 5).toFixed(1)}" font-size="10" fill="#ef4444" text-anchor="end">Ideal</text>
        ${bars}
        ${labels}
        ${hits}
      </svg>
      <div class="db-tooltip"></div>`;
  }

  // ===================== MOTIVOS DE ATRASO SEMANAIS =====================
  function _motivosDoPeriodo(p) {
    const contagem = {};
    (p.relatorio.itens || []).forEach(i => { if (i.justificativa && i.justificativa.motivo) contagem[i.justificativa.motivo] = (contagem[i.justificativa.motivo] || 0) + 1; });
    Object.values(p.omitidas || {}).forEach(o => { if (o.motivo) contagem[o.motivo] = (contagem[o.motivo] || 0) + 1; });
    return contagem;
  }

  function _renderMotivosAtraso() {
    const host = document.getElementById('db-motivos-atraso');
    if (!host) return;
    const periodos = _periodosFechados();
    if (!periodos.length) {
      host.innerHTML = '<div class="estado-vazio"><p class="text-sm">Nenhum período fechado no Semanal ainda.</p></div>';
      return;
    }
    const porPeriodo = periodos.map(p => ({ label: p.label, contagem: _motivosDoPeriodo(p) }));
    const motivosUsados = [...new Set(porPeriodo.flatMap(p => Object.keys(p.contagem)))];
    if (!motivosUsados.length) {
      host.innerHTML = '<div class="estado-vazio"><p class="text-sm">Nenhum motivo de atraso registrado nos períodos recentes.</p></div>';
      return;
    }
    host.innerHTML = _svgMotivos(porPeriodo, motivosUsados);
  }

  function _svgMotivos(porPeriodo, motivos) {
    const n = porPeriodo.length;
    const W = Math.max(500, n * 60), H = 260;
    const padL = 30, padR = 20, padT = 20, padB = 34;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const maxTotal = Math.max(1, ...porPeriodo.map(p => Object.values(p.contagem).reduce((s, v) => s + v, 0)));
    const barW = Math.min(34, (plotW / n) * 0.55);

    let bars = '', labels = '';
    porPeriodo.forEach((p, i) => {
      const cx = padL + (i + 0.5) * (plotW / n);
      let acumH = 0;
      motivos.forEach(m => {
        const v = p.contagem[m] || 0;
        if (!v) return;
        const h = (v / maxTotal) * plotH;
        const y = padT + plotH - acumH - h;
        bars += `<rect x="${(cx - barW / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" fill="${MOTIVOS_COR[m] || '#ccc'}"><title>${_esc(m)}: ${v}</title></rect>`;
        acumH += h;
      });
      labels += `<text x="${cx.toFixed(1)}" y="${H - 12}" font-size="10" fill="#666" text-anchor="middle">${p.label}</text>`;
    });

    const legenda = motivos.map(m => `<span><i style="background:${MOTIVOS_COR[m] || '#ccc'};"></i>${m}</span>`).join('');

    return `
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;">
        ${bars}
        ${labels}
      </svg>
      <div class="db-legenda" style="margin-top:10px;">${legenda}</div>`;
  }

  // ===================== CONTENÇÃO (SOLO GRAMPEADO) =====================
  // Sempre visível — independente do toggle "Mostrar Contenção, Fundação e
  // Estrutura" (esse toggle é só sobre o gráfico de Fundação/Estrutura).
  function _renderSoloGrampeadoPanel() {
    const host = document.getElementById('db-solo-grampeado-wrap');
    if (!host) return;
    host.innerHTML = `
      <div class="card db-row">
        <div class="card-body">
          <div class="db-secao-header"><h3>Contenção (Solo Grampeado)</h3></div>
          <div id="db-solo-grampeado">Carregando...</div>
        </div>
      </div>`;
    _renderSoloGrampeadoMinimapas();
  }

  // ===================== FUNDAÇÃO / ESTRUTURA =====================
  // Ligado pelo toggle "Mostrar Contenção, Fundação e Estrutura" no topo da
  // página (preferência de UI, guardada em localStorage — não é dado da obra).
  // UM gráfico só, por andar, com 3 séries coloridas (Fundação Profunda/
  // Estacas, Fundação, Estrutura) — mesmo critério do Controle de Estacas:
  // "Estaca" = peça tipo==='Fundação' com subTipo==='Estacas' (ou, em peça
  // antiga sem subTipo gravado, diâmetro+comprimento preenchidos — só faz
  // sentido em estaca); "Fundação" = tipo==='Fundação' sem isso (rasa);
  // "Estrutura" = todo o resto (Pilar/Viga/Laje/Cortina/Escada/Rampa/
  // Caixa D'água/Outro).
  // ORDEM DOS ANDARES: usa cfgDoc.ordemAndares EXATAMENTE como está
  // configurada no Controle de Concreto (tela de arrastar) — sem recalcular
  // nem reordenar por número; é a mesma lista, na mesma ordem, ponto.
  const _isEstaca = p => p.subTipo === 'Estacas' || (!p.subTipo && _numGlobal(p.diametro) > 0 && _numGlobal(p.comprimento) > 0);
  function _numGlobal(v) { return parseFloat(String(v ?? '').replace(',', '.')) || 0; }
  const CATEGORIAS_CONCRETO = [
    { chave: 'estaca', titulo: 'Fundação Profunda (Estacas)', cor: '#7a5c00', corClara: '#d4b04d', filtro: p => p.tipo === 'Fundação' && _isEstaca(p) },
    { chave: 'fundacao', titulo: 'Fundação', cor: '#a67c00', corClara: '#e0c05a', filtro: p => p.tipo === 'Fundação' && !_isEstaca(p) },
    { chave: 'estrutura', titulo: 'Estrutura', cor: '#F5C800', corClara: '#fbe480', filtro: p => p.tipo !== 'Fundação' },
  ];
  async function _renderFundacaoEstrutura() {
    const host = document.getElementById('db-fundacao-estrutura-wrap');
    if (!host) return;
    if (!_mostrarConcreto) { host.innerHTML = ''; return; }
    host.innerHTML = `
      <div class="card db-row">
        <div class="card-body">
          <div class="db-secao-header"><h3>Fundação e Estrutura</h3></div>
          <div id="db-fe" class="db-tooltip-wrap">Carregando...</div>
        </div>
      </div>`;
    const elFE = document.getElementById('db-fe');
    // CC pode falhar a carregar por cache de CDN desalinhado entre deploys
    // (script antigo servido junto com HTML novo) — _num() local garante que
    // o gráfico NUNCA quebra por isso, mesmo que window.ConcretoCalculos
    // esteja ausente/desatualizado no momento exato do carregamento.
    const CC = window.ConcretoCalculos;
    const _num = v => (CC && CC.num) ? CC.num(v) : (parseFloat(String(v ?? '').replace(',', '.')) || 0);
    try {
      const obraId = obraAtual.id;
      const [pecas, lancamentos, cfgDoc, pecaConc, concretagens, marcadores, pranchas] = await Promise.all([
        Database.listar(obraId, 'concretoPecas', null).catch(() => []),
        Database.listar(obraId, 'concretoLancamentos', null).catch(() => []),
        Database.obter(obraId, 'config', 'concreto').catch(() => null),
        Database.listar(obraId, 'concretoPecaConc', null).catch(() => []),
        Database.listar(obraId, 'concretoConcretagens', null).catch(() => []),
        Database.listar(obraId, 'estacasMarcadores', null).catch(() => []),
        Database.listar(obraId, 'estacasPranchas', null).catch(() => []),
      ]);
      // Guardado pra _abrirPdfDoAndar (clique numa barra) achar o PDF certo
      // sem buscar tudo de novo — Estaca/Fundação vêm do Controle de Estacas
      // e Fundações (pranchas); Estrutura vem da concretagem no Controle de
      // Concreto (pdfUrl anexado lá).
      _feContexto = { obraId, pecas, lancamentos, pecaConc, concretagens, marcadores, pranchas };
      if (!pecas.length) {
        elFE.innerHTML = '<div class="estado-vazio"><p class="text-sm">Nenhuma peça cadastrada no Controle de Concreto ainda.</p></div>';
        return;
      }
      // Ordem EXATA do Controle de Concreto — só filtra pra quem realmente
      // tem peça na obra, sem reordenar por número/score. Comparação por
      // nome NORMALIZADO (CC.normalizarAndar — mesma função usada na
      // criação de peça): pequenas diferenças de acento/maiúscula/espaço
      // entre o nome salvo em ordemAndares e o nome salvo na peça faziam o
      // andar "não bater" e cair fora de ordem, no final, na ordem crua do
      // Set (causa real do gráfico saindo fora de ordem mesmo com a lista
      // configurada certa). Andar que realmente não está na lista
      // customizada (raríssimo) entra no final, na ordem que apareceu.
      const norm = a => (CC ? CC.normalizarAndar(a) : String(a || '').trim());
      const ordemSalva = cfgDoc?.ordemAndares || [];
      const ordemSalvaNorm = ordemSalva.map(norm);
      // Deduplica por nome NORMALIZADO — evita que 2 grafias do mesmo andar
      // (ex: "2º Subsolo" vs "2° Subsolo") apareçam como 2 barras diferentes,
      // cada uma com só parte do volume real. Prefere o nome exatamente como
      // está em ordemAndares (se existir) pra exibir; senão, o nome bruto
      // mais frequente entre as peças daquele grupo.
      const nomesBrutos = [...new Set(pecas.map(p => p.andar || 'Sem andar'))];
      const gruposPorNorm = new Map(); // norm(andar) -> [nomes brutos equivalentes]
      nomesBrutos.forEach(nome => {
        const key = norm(nome);
        if (!gruposPorNorm.has(key)) gruposPorNorm.set(key, []);
        gruposPorNorm.get(key).push(nome);
      });
      const andaresComPecaBrutos = [...gruposPorNorm.entries()].map(([key, nomes]) => {
        const nomeNaOrdemCustom = ordemSalva.find(o => norm(o) === key);
        if (nomeNaOrdemCustom) return nomeNaOrdemCustom;
        // Sem entrada na lista customizada: usa o nome bruto mais frequente
        // (mais peças com essa grafia) como representante do grupo.
        const contagem = new Map();
        nomes.forEach(n => contagem.set(n, (pecas.filter(p => (p.andar || 'Sem andar') === n).length)));
        return [...contagem.entries()].sort((a, b) => b[1] - a[1])[0][0];
      });
      // Ordena pelos nomes REAIS das peças (não os da lista customizada —
      // grafias podem diferir), usando a posição na lista customizada
      // (por nome normalizado) como critério de ordenação.
      const andares = ordemSalva.length
        ? [...andaresComPecaBrutos].sort((a, b) => {
            const ia = ordemSalvaNorm.indexOf(norm(a));
            const ib = ordemSalvaNorm.indexOf(norm(b));
            if (ia === -1 && ib === -1) return 0; // nenhum na lista — mantém ordem original entre eles
            if (ia === -1) return 1; // não achado vai pro final
            if (ib === -1) return -1;
            return ia - ib;
          })
        : andaresComPecaBrutos;

      const lancsPorPeca = new Map();
      lancamentos.forEach(l => {
        if (!lancsPorPeca.has(l.pecaId)) lancsPorPeca.set(l.pecaId, []);
        lancsPorPeca.get(l.pecaId).push(l);
      });

      const dadosPorAndar = andares.map(andar => {
        const porCategoria = CATEGORIAS_CONCRETO.map(cat => {
          // Agrupa por nome NORMALIZADO (não nome bruto) — evita que duas
          // grafias do mesmo andar (ex: "2º Subsolo" vs "2° Subsolo", símbolo
          // de grau em vez de ordinal — erro comum de digitação/import) sejam
          // tratadas como andares DIFERENTES, cada uma somando só parte do
          // volume real. Essa era a causa real do volume de Fundação
          // aparecer menor do que deveria em obras antigas com essa
          // inconsistência histórica nos dados.
          const pecasDaCategoria = pecas.filter(p => norm(p.andar || 'Sem andar') === norm(andar) && cat.filtro(p));
          // _num() (definida no topo da função) — trata vírgula decimal
          // ("150,5") igual ao resto do sistema, e não quebra mesmo se CC
          // estiver indisponível. Peça com volume salvo em formato de
          // vírgula (import antigo, digitação manual) virava NaN com
          // Number() puro, e NaN||0 some silenciosamente como 0 — causa real
          // de andar com peça de verdade não aparecer no gráfico.
          const previsto = pecasDaCategoria.reduce((s, p) => s + _num(p.volume), 0);
          let executado = 0;
          pecasDaCategoria.forEach(p => {
            (lancsPorPeca.get(p.id) || []).forEach(l => { executado += _num(l.volume); });
          });
          return { chave: cat.chave, previsto, executado };
        });
        return { andar, porCategoria };
      }).filter(d => d.porCategoria.some(c => c.previsto > 0 || c.executado > 0));

      if (!dadosPorAndar.length) {
        elFE.innerHTML = '<div class="estado-vazio"><p class="text-sm">Nenhum volume previsto ou executado lançado ainda.</p></div>';
        return;
      }
      elFE.innerHTML = _svgFundacaoEstruturaPorAndar(dadosPorAndar);
      // Delegação de clique no card (elemento pai fixo, nunca recriado) —
      // sobe manualmente até achar .db-hit em vez de usar closest() (suporte
      // de closest() em nó SVG varia entre navegadores).
      elFE.onclick = (e) => {
        let el = e.target, hit = null;
        for (let i = 0; i < 6 && el; i++) {
          if (el.classList && el.classList.contains('db-hit')) { hit = el; break; }
          el = el.parentNode;
        }
        if (!hit) return;
        const d = dadosPorAndar[Number(hit.dataset.idx)];
        const catChave = hit.dataset.cat;
        if (!d || !catChave) return;
        _abrirPdfDoAndar(d.andar, catChave);
      };
      elFE.querySelectorAll('.db-hit').forEach(hit => { hit.style.cursor = 'pointer'; });
    } catch (e) {
      console.error(e);
      const msgErro = (e && e.message ? e.message : String(e)).replace(/</g, '&lt;');
      elFE.innerHTML = `<div class="estado-vazio"><p class="text-sm">Erro ao carregar dados do Controle de Concreto.</p><p class="text-sm text-muted" style="margin-top:6px;font-family:monospace;">${msgErro}</p></div>`;
    }
  }

  // Roteia o clique por categoria:
  // - Estaca/Fundação → vêm do Controle de Estacas e Fundações (imagem da
  //   prancha já cadastrada lá, vinculada via marcador → peça).
  // - Estrutura → vem do Controle de Concreto (PDF anexado na concretagem,
  //   vínculo peça → concretoPecaConc → concretagem).
  // Ambas abrem no MESMO popup em tela cheia — sem navegar pra outra
  // página — com seta pra trocar de item se o andar tiver mais de um.
  function _abrirPdfDoAndar(andar, categoriaChave) {
    if (categoriaChave === 'estrutura') _abrirPopupConcretagens(andar, categoriaChave);
    else _abrirPopupPranchas(andar, categoriaChave);
  }

  // Estaca/Fundação: acha as pranchas do Controle de Estacas que têm
  // marcador vinculado a uma peça daquele andar+categoria — só os marcadores
  // JÁ EM EXECUÇÃO (% concretado > 0), pra ficar limpo no popup, não a
  // prancha inteira com todas as bolinhas de todo andar/categoria.
  function _abrirPopupPranchas(andar, categoriaChave) {
    const ctx = _feContexto;
    if (!ctx) return;
    const CC = window.ConcretoCalculos;
    const norm = a => (CC ? CC.normalizarAndar(a) : String(a || '').trim());
    const cat = CATEGORIAS_CONCRETO.find(c => c.chave === categoriaChave);
    // Comparação por nome NORMALIZADO — mesmo fix já aplicado no cálculo do
    // gráfico (V2.60.12): grafias diferentes do mesmo andar (ex: "2° Subsolo"
    // com símbolo de grau vs "2º Subsolo" ordinal) faziam esta função nem
    // achar peça nenhuma e sair em silêncio, sem toast — parecia que o popup
    // "não tinha nada pronto" mesmo com dado real cadastrado.
    const pecasDoAndar = ctx.pecas.filter(p => norm(p.andar || 'Sem andar') === norm(andar) && cat.filtro(p));
    if (!pecasDoAndar.length) { Utils.toast('Nenhuma peça encontrada para este andar/categoria.', 'alerta'); return; }
    const pecaPorId = new Map(pecasDoAndar.map(p => [p.id, p]));
    const emExecucao = pecasDoAndar.filter(p => CC ? CC.pctConcretado(p, ctx.lancamentos) > 0 : false);
    if (!emExecucao.length) {
      Utils.toast('Nenhuma peça deste andar está em execução ainda (0% concretado).', 'alerta');
      return;
    }
    const idsEmExecucao = new Set(emExecucao.map(p => p.id));
    const marcadoresDoAndar = ctx.marcadores.filter(m => m.pecaId && idsEmExecucao.has(m.pecaId));
    if (!marcadoresDoAndar.length) {
      Utils.toast('As peças em execução deste andar ainda não têm marcador na prancha do Controle de Estacas.', 'alerta');
      return;
    }
    const idsPranchas = new Set(marcadoresDoAndar.map(m => m.pranchaId));
    const pranchas = ctx.pranchas.filter(p => idsPranchas.has(p.id)).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    if (!pranchas.length) return;
    const itens = pranchas.map(p => ({
      tipo: 'imagem',
      titulo: p.nome || 'Prancha',
      pranchaId: p.id,
      prancha: p,
      marcadores: marcadoresDoAndar.filter(m => m.pranchaId === p.id),
      pecaPorId,
    }));
    _abrirPopupProjeto(andar, itens);
  }

  // Estrutura: acha a(s) concretagem(ns) do andar via peça → concretoPecaConc
  // → concretagem (é onde o PDF é anexado, no Controle de Concreto →
  // Lançar BT → 📎 Inserir PDF desta concretagem).
  function _abrirPopupConcretagens(andar, categoriaChave) {
    const ctx = _feContexto;
    if (!ctx) return;
    const CC = window.ConcretoCalculos;
    const norm = a => (CC ? CC.normalizarAndar(a) : String(a || '').trim());
    const cat = CATEGORIAS_CONCRETO.find(c => c.chave === categoriaChave);
    const pecasDoAndar = ctx.pecas.filter(p => norm(p.andar || 'Sem andar') === norm(andar) && cat.filtro(p));
    if (!pecasDoAndar.length) { Utils.toast('Nenhuma peça encontrada para este andar/categoria.', 'alerta'); return; }
    const idsPecas = new Set(pecasDoAndar.map(p => p.id));
    const concIds = new Set(ctx.pecaConc.filter(pc => idsPecas.has(pc.pecaId)).map(pc => pc.concretagemId));
    const concsDoAndar = ctx.concretagens.filter(c => concIds.has(c.id)).sort((a, b) => a.numero - b.numero);
    const comPdf = concsDoAndar.filter(c => c.pdfUrl);
    if (!comPdf.length) {
      Utils.toast(concsDoAndar.length
        ? 'Nenhuma concretagem deste andar tem PDF anexado ainda. Insira no Controle de Concreto → Lançar BT → 📎 Inserir PDF desta concretagem.'
        : 'Nenhuma concretagem cadastrada ainda para este andar.', 'alerta');
      return;
    }
    const itens = comPdf.map(c => ({ tipo: 'pdf', titulo: `Concretagem Nº${c.numero}${c.descricao ? ' — ' + c.descricao : ''}`, url: c.pdfUrl }));
    _abrirPopupProjeto(andar, itens);
  }

  // Popup único em tela cheia — mostra o item atual (imagem de prancha COM
  // os marcadores desenhados por cima, ou PDF de concretagem) e navega entre
  // os itens com as setas, se houver mais de um pro mesmo andar. Não navega
  // pra outra página em nenhum caso. Zoom com botões +/- e roda do mouse
  // (sem precisar de Ctrl — tela dedicada, sem conflito de scroll da página).
  let _popupItens = [];
  let _popupIdx = 0;
  let _popupZoom = 1;
  function _abrirPopupProjeto(andar, itens) {
    _popupItens = itens;
    _popupIdx = 0;
    _popupZoom = 1;
    _renderPopupProjeto(andar);
  }
  function _popupNavegar(delta, andar) {
    _popupIdx = (_popupIdx + delta + _popupItens.length) % _popupItens.length;
    _popupZoom = 1;
    _renderPopupProjeto(andar);
  }
  function _popupZoomAjustar(delta, andar) {
    _popupZoom = Math.max(0.3, Math.min(4, _popupZoom + delta));
    _renderPopupProjeto(andar, true);
  }
  function _fecharPopupProjeto() {
    const overlay = document.getElementById('db-projeto-overlay');
    if (overlay) overlay.remove();
    document.removeEventListener('keydown', _popupTeclaEsc);
  }
  function _popupTeclaEsc(e) { if (e.key === 'Escape') _fecharPopupProjeto(); }
  // `soZoom` = true: só reaplica o zoom no conteúdo já carregado (evita
  // recarregar a imagem do Firestore a cada scroll da roda).
  async function _renderPopupProjeto(andar, soZoom) {
    let overlay = document.getElementById('db-projeto-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'db-projeto-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:600;background:rgba(15,23,42,.92);display:flex;flex-direction:column;padding:16px;';
      document.body.appendChild(overlay);
      document.addEventListener('keydown', _popupTeclaEsc);
    }
    const item = _popupItens[_popupIdx];
    const temVarios = _popupItens.length > 1;
    const andarEsc = andar.replace(/'/g, "\\'");

    if (soZoom) {
      // Só ajusta a escala do conteúdo já renderizado, sem recarregar nada.
      const zoomEl = document.getElementById('db-projeto-zoomable');
      if (zoomEl) zoomEl.style.transform = `scale(${_popupZoom})`;
      const label = document.getElementById('db-projeto-zoomlabel');
      if (label) label.textContent = Math.round(_popupZoom * 100) + '%';
      return;
    }

    overlay.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 8px 12px;color:#fff;gap:10px;flex-wrap:wrap;">
        <div style="font-weight:700;">${andar} — ${item.titulo}${temVarios ? ` <span style="opacity:.7;font-weight:400;">(${_popupIdx + 1}/${_popupItens.length})</span>` : ''}</div>
        <div style="display:flex;align-items:center;gap:6px;">
          ${item.tipo === 'imagem' ? `
            <button class="btn btn-secundario btn-sm" onclick="Dashboard._popupZoomAjustar(-0.2,'${andarEsc}')">−</button>
            <span id="db-projeto-zoomlabel" style="color:#fff;font-size:0.78rem;min-width:42px;text-align:center;">${Math.round(_popupZoom * 100)}%</span>
            <button class="btn btn-secundario btn-sm" onclick="Dashboard._popupZoomAjustar(0.2,'${andarEsc}')">+</button>
          ` : ''}
          <button class="btn btn-secundario btn-sm" onclick="Dashboard._fecharPopupProjeto()">✕ Fechar</button>
        </div>
      </div>
      <div id="db-projeto-scroll" style="position:relative;flex:1;overflow:auto;display:flex;align-items:flex-start;justify-content:center;background:#fff;border-radius:8px;">
        ${temVarios ? `<button class="btn btn-secundario" style="position:fixed;left:24px;top:50%;transform:translateY(-50%);z-index:2;" onclick="Dashboard._popupNavegar(-1,'${andarEsc}')">‹</button>` : ''}
        <div id="db-projeto-conteudo" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">Carregando...</div>
        ${temVarios ? `<button class="btn btn-secundario" style="position:fixed;right:24px;top:50%;transform:translateY(-50%);z-index:2;" onclick="Dashboard._popupNavegar(1,'${andarEsc}')">›</button>` : ''}
      </div>`;
    const elConteudo = document.getElementById('db-projeto-conteudo');
    if (item.tipo === 'pdf') {
      elConteudo.innerHTML = `<iframe src="${item.url}" style="width:100%;height:100%;border:none;"></iframe>`;
      return;
    }
    // Imagem da prancha COM os marcadores desenhados por cima (stageHTML —
    // mesma função/estilo usado no Controle de Estacas), só os marcadores
    // já filtrados pra "em execução" (feito em _abrirPopupPranchas).
    const EC = window.EstacasCalculos;
    const CC = window.ConcretoCalculos;
    if (!EC) { elConteudo.innerHTML = '<div class="estado-vazio"><p class="text-sm">Motor de cálculo de Estacas não carregado.</p></div>'; return; }
    try {
      const doc = await db.collection('obras').doc(_feContexto.obraId).collection('config').doc('estacasImagem_' + item.pranchaId).get();
      const img = doc.exists ? (doc.data().img || null) : null;
      const mapaCoresGrupo = EC.mapaCoresGrupoEstaca(_feContexto.pecas);
      const statusFn = (m) => {
        const p = m.pecaId ? item.pecaPorId.get(m.pecaId) : null;
        if (!p) return { pct: null, label: 'Sem peça vinculada' };
        const pct = CC ? CC.pctConcretado(p, _feContexto.lancamentos) : 0;
        let corGrupo = null;
        if (p.subTipo === 'Estacas' && (p.diametro || p.comprimento)) {
          corGrupo = mapaCoresGrupo.get(EC.chaveGrupoEstaca(p.diametro, p.comprimento)) || null;
        }
        return { pct, label: `${p.nome} — ${EC.statusLabel(pct)}`, corGrupo };
      };
      const stage = EC.stageHTML(item.prancha, img, item.marcadores, statusFn, { zoom: 1, maxHeight: 999999, stageId: 'db-projeto-stage' });
      // Envolve o stage num wrapper com transform:scale — permite zoom sem
      // reconstruir o HTML a cada clique no +/−.
      elConteudo.innerHTML = `<div id="db-projeto-zoomable" style="transform:scale(${_popupZoom});transform-origin:top center;transition:transform .1s;">${stage}</div>`;
      // Roda do mouse dá zoom direto (sem precisar de Ctrl) — tela dedicada,
      // não tem outro scroll concorrendo pela roda.
      const scrollEl = document.getElementById('db-projeto-scroll');
      if (scrollEl) {
        scrollEl.onwheel = (ev) => {
          ev.preventDefault();
          _popupZoomAjustar(ev.deltaY < 0 ? 0.15 : -0.15, andar);
        };
      }
    } catch (e) {
      console.error(e);
      elConteudo.innerHTML = '<div class="estado-vazio"><p class="text-sm">Erro ao carregar a imagem.</p></div>';
    }
  }

  // Minimapas de Solo Grampeado (Contenção) — um mapa por vista, na
  // proporção real da imagem dela (larga/baixa nas elevações compridas,
  // quadrada nas menores), somente leitura.
  async function _renderSoloGrampeadoMinimapas() {
    const host = document.getElementById('db-solo-grampeado');
    if (!host) return;
    // Pequeno retry defensivo: em rede lenta, o script pode ainda estar
    // sendo interpretado no instante exato em que esta função roda (mesmo
    // vindo antes no HTML) — espera até 1s antes de desistir, em vez de
    // falhar na primeira checagem.
    let SG = window.SoloGrampeadoCalculos;
    for (let tentativa = 0; !SG && tentativa < 5; tentativa++) {
      await new Promise(r => setTimeout(r, 200));
      SG = window.SoloGrampeadoCalculos;
    }
    if (!SG) {
      host.innerHTML = '<div class="estado-vazio"><p class="text-sm">Motor de cálculo de Solo Grampeado não carregou (js/solo-grampeado-calculos.js). Recarregue a página (Ctrl+Shift+R); se persistir, verifique a conexão.</p></div>';
      return;
    }
    try {
      const obraId = obraAtual.id;
      const [vistas, chumbadores, execucoes, areas] = await Promise.all([
        Database.listar(obraId, 'sgVistas', null).catch(() => []),
        Database.listar(obraId, 'sgChumbadores', null).catch(() => []),
        Database.listar(obraId, 'sgExecucoes', null).catch(() => []),
        Database.listar(obraId, 'sgAreaExecutada', null).catch(() => []),
      ]);
      const vistasComImagem = vistas.filter(v => Number(v.imgWidthPx) > 0 && Number(v.imgHeightPx) > 0)
        .sort((a, b) => (a.numero || 0) - (b.numero || 0));
      if (!vistasComImagem.length) {
        host.innerHTML = '<div class="estado-vazio"><p class="text-sm">Nenhuma vista com imagem/PDF cadastrado no Levantamento de Solo Grampeado ainda.</p></div>';
        return;
      }
      const LARGURA_CARD = 340; // px — altura de cada card se ajusta à proporção real da imagem
      const cardsHtml = await Promise.all(vistasComImagem.map(async v => {
        let imagem = null;
        try {
          const doc = await db.collection('obras').doc(obraId).collection('config').doc('sgImagem_' + v.id).get();
          imagem = doc.exists ? (doc.data().img || null) : null;
        } catch (e) {}
        const lista = chumbadores.filter(c => c.vista === v.id);
        const execMap = {};
        lista.forEach(c => { const e = execucoes.find(x => x.chumbadorId === c.id); if (e) execMap[c.id] = e; });
        const areasDaVista = areas.filter(a => a.vistaId === v.id);
        const resumo = SG.calcPctVista(v, lista, execMap, areasDaVista);
        const label = v.nome ? `${v.numero} — ${v.nome}` : `Vista ${v.numero}`;
        const zoom = LARGURA_CARD / Number(v.imgWidthPx);
        const alturaCard = Math.round(Number(v.imgHeightPx) * zoom);
        const svg = SG.mapaHTML(v, imagem, lista, execMap, areasDaVista, { interativo: false, mini: true, zoom, maxHeight: Math.min(280, Math.max(60, alturaCard)) });
        return `<div style="width:${LARGURA_CARD}px;">
          <div style="font-weight:700;font-size:0.85rem;margin-bottom:4px;">${label}</div>
          ${svg}
          <div style="font-size:0.78rem;color:var(--cor-texto-secundario);font-family:var(--font-mono);margin-top:4px;">
            ${SG.fmt1(resumo.pct)}% · ${SG.fmt1(resumo.m2Executado)} / ${SG.fmt1(v.m2Total)} m²
          </div>
        </div>`;
      }));
      host.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:16px;">${cardsHtml.join('')}</div>`;
    } catch (e) {
      console.error(e);
      host.innerHTML = '<div class="estado-vazio"><p class="text-sm">Erro ao carregar dados de Solo Grampeado.</p></div>';
    }
  }

  // ===================== ESTACAS E FUNDAÇÕES =====================
  // Minimapas do Controle de Estacas e Fundações — um mapa por prancha
  // (PDF do projeto), só leitura, com o status de cada marcador vindo
  // do % concretado da peça vinculada (Controle de Concreto).
  async function _renderEstacasPanel() {
    const host = document.getElementById('db-estacas-wrap');
    if (!host) return;
    const EC = window.EstacasCalculos;
    if (!EC) { host.innerHTML = ''; return; }
    try {
      const obraId = obraAtual.id;
      const [pranchas, marcadores, pecas, lancamentos] = await Promise.all([
        Database.listar(obraId, 'estacasPranchas', null).catch(() => []),
        Database.listar(obraId, 'estacasMarcadores', null).catch(() => []),
        Database.listar(obraId, 'concretoPecas', null).catch(() => []),
        Database.listar(obraId, 'concretoLancamentos', null).catch(() => []),
      ]);
      const pranchasComImagem = pranchas.filter(p => Number(p.imgWidthPx) > 0 && Number(p.imgHeightPx) > 0)
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
      if (!pranchasComImagem.length) { host.innerHTML = ''; return; }

      const CC = window.ConcretoCalculos;
      const mapaCoresGrupo = EC.mapaCoresGrupoEstaca(pecas);
      const statusFn = (m) => {
        const p = m.pecaId ? pecas.find(x => x.id === m.pecaId) : null;
        if (!p) return { pct: null, label: 'Sem peça vinculada' };
        const pct = CC ? CC.pctConcretado(p, lancamentos) : 0;
        let corGrupo = null;
        if (p.subTipo === 'Estacas' && (p.diametro || p.comprimento)) {
          corGrupo = mapaCoresGrupo.get(EC.chaveGrupoEstaca(p.diametro, p.comprimento)) || null;
        }
        return { pct, label: `${p.nome} — ${EC.statusLabel(pct)}`, corGrupo };
      };
      const total = marcadores.length;
      const vinculados = marcadores.filter(m => m.pecaId).length;
      const concluidos = marcadores.filter(m => { const s = statusFn(m); return s.pct !== null && s.pct >= 100; }).length;
      const pctMedio = total ? marcadores.reduce((s, m) => s + (statusFn(m).pct || 0), 0) / total : 0;

      host.innerHTML = `
        <div class="card db-row">
          <div class="card-body">
            <div class="db-secao-header"><h3>Estacas e Fundações</h3></div>
            <div class="text-sm text-muted" style="margin-bottom:10px;">${vinculados}/${total} marcadores vinculados · ${concluidos}/${total} concretados · ${EC.fmt1(pctMedio)}% médio · <a href="controle-estacas.html" style="color:var(--cor-primaria-dark);font-weight:600;">abrir controle</a></div>
            <div id="db-estacas-minimapas"></div>
          </div>
        </div>`;

      const LARGURA_CARD = 340;
      const cardsHtml = await Promise.all(pranchasComImagem.map(async p => {
        let imagem = null;
        try {
          const doc = await db.collection('obras').doc(obraId).collection('config').doc('estacasImagem_' + p.id).get();
          imagem = doc.exists ? (doc.data().img || null) : null;
        } catch (e) {}
        const lista = marcadores.filter(m => m.pranchaId === p.id);
        const zoom = LARGURA_CARD / Number(p.imgWidthPx);
        const alturaCard = Math.round(Number(p.imgHeightPx) * zoom);
        const svg = EC.stageHTML(p, imagem, lista, statusFn, { interativo: false, mini: true, zoom, maxHeight: Math.min(280, Math.max(60, alturaCard)) });
        return `<div style="width:${LARGURA_CARD}px;">
          <div style="font-weight:700;font-size:0.85rem;margin-bottom:4px;">${(p.nome || 'Prancha').replace(/</g, '&lt;')}</div>
          ${svg}
        </div>`;
      }));
      document.getElementById('db-estacas-minimapas').innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:16px;">${cardsHtml.join('')}</div>`;
    } catch (e) {
      console.error(e);
      host.innerHTML = '<div class="estado-vazio"><p class="text-sm">Erro ao carregar dados de Estacas e Fundações.</p></div>';
    }
  }

  // Um gráfico com 3 séries por andar (uma por categoria — Estaca/Fundação/
  // Estrutura), cada série com barra clara (previsto) + barra da cor da
  // categoria (executado). `dados` = [{ andar, porCategoria: [{chave,previsto,executado}, ...] }].
  function _svgFundacaoEstruturaPorAndar(dados) {
    const n = dados.length;
    const nCat = CATEGORIAS_CONCRETO.length;
    // Largura por grupo (andar) tem um mínimo confortável e um máximo pra
    // não ficar espremido — com poucos andares (ex: 1), o gráfico inteiro
    // fica compacto em vez de esticar uma barra isolada por 1180px de vazio.
    const larguraGrupoMin = 110, larguraGrupoMax = 230;
    const larguraGrupoPx = Math.max(larguraGrupoMin, Math.min(larguraGrupoMax, 900 / Math.max(1, n)));
    const W = Math.max(360, n * larguraGrupoPx + 60), H = 360;
    const padL = 46, padR = 12, padT = 22, padB = 92;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const maxV = Math.max(1, ...dados.flatMap(d => d.porCategoria.map(c => Math.max(c.previsto, c.executado))));
    // Barra fininha: cabem as 3 categorias (2 barras cada = 6 barras) até no
    // andar de Fundação, que é o único com mais de 1 categoria ativa.
    const barW = Math.max(4, Math.min(22, (larguraGrupoPx * 0.78) / (nCat * 2)));
    const gapBarras = 1; // entre Previsto/Executado da mesma categoria
    const gapCategoria = 3; // entre categorias diferentes do mesmo andar

    let bars = '', labels = '', hits = '', separadores = '', faixas = '', guias = '';
    dados.forEach((d, i) => {
      const grupoX = padL + i * larguraGrupoPx;
      if (i % 2 === 1) faixas += `<rect x="${grupoX.toFixed(1)}" y="${padT}" width="${larguraGrupoPx.toFixed(1)}" height="${plotH}" fill="#f8f8f8"/>`;

      const catsAtivas = d.porCategoria.filter(c => c.previsto > 0 || c.executado > 0);
      const larguraTotalCats = catsAtivas.length * (barW * 2 + gapBarras) + Math.max(0, catsAtivas.length - 1) * gapCategoria;
      let cursorX = grupoX + (larguraGrupoPx - larguraTotalCats) / 2;

      catsAtivas.forEach(c => {
        const cat = CATEGORIAS_CONCRETO.find(cc => cc.chave === c.chave);
        const hPrev = (c.previsto / maxV) * plotH, hExec = (c.executado / maxV) * plotH;
        const xPrev = cursorX, xExec = cursorX + barW + gapBarras;
        // Previsto: preenchimento SÓLIDO no tom claro da categoria (não
        // contorno vazio) — cor sempre forte e visível, do jeito pedido.
        bars += `<rect x="${xPrev.toFixed(1)}" y="${(padT + plotH - hPrev).toFixed(1)}" width="${barW.toFixed(1)}" height="${hPrev.toFixed(1)}" fill="${cat.corClara}"/>`;
        // Executado: preenchimento SÓLIDO no tom forte da categoria.
        bars += `<rect x="${xExec.toFixed(1)}" y="${(padT + plotH - hExec).toFixed(1)}" width="${barW.toFixed(1)}" height="${hExec.toFixed(1)}" fill="${cat.cor}"/>`;
        if (c.previsto > 0 && barW > 4) bars += `<text x="${(xPrev + barW / 2).toFixed(1)}" y="${(padT + plotH - hPrev - 3).toFixed(1)}" font-size="7" fill="#555" font-weight="600" text-anchor="middle">${Utils.formatarNumero(c.previsto, 0)}</text>`;
        // Rótulo do NOME da categoria, inclinado, escrito dentro/sobre a
        // própria barra de Previsto — sempre visível (mesmo com 1 única
        // categoria no andar), pra nunca depender só da cor pra identificar
        // o que é Estaca/Fundação/Estrutura.
        if (barW > 5) {
          const catLabel = cat.chave === 'estaca' ? 'Estacas' : cat.chave === 'fundacao' ? 'Fundação' : 'Estrutura';
          const yBase = padT + plotH - Math.max(hPrev, hExec) / 2;
          bars += `<text x="${(xPrev + barW).toFixed(1)}" y="${yBase.toFixed(1)}" font-size="7.5" fill="#fff" font-weight="700" text-anchor="middle" transform="rotate(-90 ${(xPrev + barW).toFixed(1)} ${yBase.toFixed(1)})" style="paint-order:stroke;stroke:${cat.cor};stroke-width:3px;">${catLabel}</text>`;
        }
        hits += `<rect class="db-hit" data-idx="${i}" data-cat="${cat.chave}" x="${cursorX.toFixed(1)}" y="${padT}" width="${(barW * 2 + gapBarras).toFixed(1)}" height="${plotH}" fill="transparent" style="cursor:pointer;"/>`;
        cursorX += barW * 2 + gapBarras + gapCategoria;
      });

      // Rótulo do andar com LINHA GUIA vertical até a base do grupo — resolve
      // a ambiguidade de "essa barra é de qual andar" quando o texto
      // inclinado fica entre dois rótulos.
      const cxLabel = grupoX + larguraGrupoPx / 2;
      const yBase = padT + plotH;
      guias += `<line x1="${cxLabel.toFixed(1)}" x2="${cxLabel.toFixed(1)}" y1="${yBase.toFixed(1)}" y2="${(yBase + 5).toFixed(1)}" stroke="#999" stroke-width="1"/>`;
      const nomeCurto = d.andar.length > 14 ? d.andar.slice(0, 13) + '…' : d.andar;
      labels += `<text x="${cxLabel.toFixed(1)}" y="${(yBase + 16).toFixed(1)}" font-size="9" fill="#222" font-weight="600" text-anchor="end" transform="rotate(-55 ${cxLabel.toFixed(1)} ${(yBase + 16).toFixed(1)})"><title>${d.andar}</title>${nomeCurto}</text>`;
      if (i < n - 1) separadores += `<line x1="${(grupoX + larguraGrupoPx).toFixed(1)}" x2="${(grupoX + larguraGrupoPx).toFixed(1)}" y1="${padT}" y2="${padT + plotH}" stroke="#ddd" stroke-width="1"/>`;
    });

    const gridY = [0, 0.25, 0.5, 0.75, 1].map(f => {
      const y = padT + plotH - f * plotH;
      return `<line x1="${padL}" x2="${W - padR}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#eee" stroke-width="1"/><text x="4" y="${(y + 3).toFixed(1)}" font-size="9" fill="#999">${Utils.formatarNumero(f * maxV, 0)}</text>`;
    }).join('');

    return `
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;">
        ${faixas}
        ${gridY}
        ${separadores}
        ${bars}
        ${guias}
        ${labels}
        ${hits}
      </svg>
      <div class="db-tooltip"></div>
      <div class="db-legenda">
        ${CATEGORIAS_CONCRETO.map(cat => `<span><i style="background:${cat.corClara};"></i> ${cat.titulo} — Previsto</span>`).join('')}
        ${CATEGORIAS_CONCRETO.map(cat => `<span><i style="background:${cat.cor};"></i> ${cat.titulo} — Executado</span>`).join('')}
      </div>
      <div class="text-sm text-muted" style="margin-top:6px;">Somado do Controle de Concreto por andar (ordem igual à configurada lá). Clique numa barra pra abrir o PDF da concretagem daquele andar/categoria.</div>`;
  }

  // ===================== RESUMO POR APARTAMENTO =====================
  function setResumoView(v) {
    _resumoView = v;
    document.querySelectorAll('#db-resumo-toggle .aba-btn').forEach(b => b.classList.toggle('ativo', b.dataset.v === v));
    _renderTabelaResumo();
  }

  async function _renderResumoApartamento() {
    const host = document.getElementById('db-resumo-apartamento');
    if (!host) return;
    host.innerHTML = '<div class="text-sm text-muted" style="padding:12px 0;">Carregando levantamentos...</div>';
    try {
      _resumoDados = await _calcularResumoApartamento();
      _renderTabelaResumo();
    } catch (e) {
      console.error(e);
      host.innerHTML = '<div class="estado-vazio"><p class="text-sm">Erro ao montar o resumo por apartamento.</p></div>';
    }
  }

  async function _calcularResumoApartamento() {
    const obraId = obraAtual.id;
    const chaves = Object.keys(LEV_TREE);

    const resultados = await Promise.all(chaves.map(async (chave) => {
      const mod = LEV_TREE[chave];
      const [dados, cfg] = await Promise.all([
        Database.listar(obraId, mod.colecao, null).catch(() => []),
        Database.obter(obraId, 'config', mod.configDoc).catch(() => null),
      ]);
      return { chave, dados, arvore: cfg?.arvore || [] };
    }));

    const [materiaisBib, materiaisVinc, maoDeObraVinc] = await Promise.all([
      Database.listar(obraId, 'materiais', 'nome').catch(() => []),
      Database.listar(obraId, 'materiais_vinculos', 'createdAt').catch(() => []),
      Database.listar(obraId, 'maoDeObra_vinculos', 'createdAt').catch(() => []),
    ]);
    const { custoMaterialPorTarefa, custoMaoObraPorTarefa } = _calcularCustosTarefas(materiaisBib, materiaisVinc, maoDeObraVinc);

    // IMPORTANTE: Piso, Teto e Paredes têm árvores INDEPENDENTES entre si (cada
    // módulo guarda seu próprio configDoc). Isso significa que "Torre A" na
    // árvore do Piso e "Torre A" na árvore de Paredes são nós com IDs
    // diferentes, mesmo representando o mesmo lugar físico — então o
    // agrupamento por apartamento não pode usar o ID do nó como chave (cada
    // levantamento apareceria como uma "torre" separada). A chave usada aqui
    // é o CAMINHO/NOME NORMALIZADO (sem acento, maiúsculas ou símbolo de grau —
    // "1° Pavimento" e "1º Pavimento" viram a mesma chave), que é comum aos
    // três módulos desde que o usuário nomeie os locais de forma parecida —
    // pequenas diferenças de digitação entre levantamentos não quebram mais
    // o agrupamento. O texto exibido na tabela continua o original (não o
    // normalizado).
    const mapaPorModulo = {}; // chave (piso/teto/paredesAlvenaria/...) -> Map(nodeId -> {label,chave,torre,torreChave})
    Object.keys(LEV_TREE).forEach(chave => {
      const r = resultados.find(x => x.chave === chave);
      mapaPorModulo[chave] = _mapaApartamentosPorLabel(r ? r.arvore : []);
    });

    // Índice reverso chave-normalizada -> info de exibição (usado só pra
    // "traduzir" as chaves que realmente aparecerem nos dados — ver abaixo).
    const infoPorChave = new Map();
    Object.values(mapaPorModulo).forEach(mapa => {
      mapa.forEach(info => { if (!infoPorChave.has(info.chave)) infoPorChave.set(info.chave, info); });
    });

    const linhas = [];
    resultados.forEach(r => {
      const mod = LEV_TREE[r.chave];
      const mapaNode = mapaPorModulo[r.chave];
      mod.linhas.forEach(linhaCfg => {
        const porApto = new Map(); // chave (apartamento normalizado) -> valor
        let total = 0;
        r.dados.forEach(reg => {
          const v = mod.valor(reg, linhaCfg.metrica);
          if (!v) return;
          total += v;
          const info = mapaNode.get(reg.nodeId);
          const aptoChave = info ? info.chave : '__sem_local__';
          porApto.set(aptoChave, (porApto.get(aptoChave) || 0) + v);
        });
        if (total <= 0) return;
        const moduloVinculo = mod.moduloVinculo || r.chave;
        const custoInfo = _custoMedioPorUnidade(moduloVinculo, linhaCfg.metrica, custoMaterialPorTarefa, custoMaoObraPorTarefa);
        linhas.push({
          categoria: mod.label, metrica: linhaCfg.metrica, label: linhaCfg.label, unidade: linhaCfg.unidade,
          porApto, total, custoUnitario: custoInfo,
        });
      });
    });

    // Só entram na lista de colunas as chaves que REALMENTE têm algum dado
    // lançado em pelo menos uma linha — antes eu montava essa lista andando
    // por TODOS os nós da árvore (Torre, Pavimento, Apto, Cômodo...), então
    // "Torre" e "1º Pavimento" apareciam como colunas fantasma, 100% vazias,
    // só porque esses nós existem na árvore — mesmo sem nenhuma área jamais
    // ter sido lançada neles diretamente.
    const chavesUsadas = new Map(); // chave -> completude (nº de linhas com valor > 0)
    linhas.forEach(l => {
      l.porApto.forEach((v, chave) => {
        if (chave === '__sem_local__' || !(v > 0)) return;
        chavesUsadas.set(chave, (chavesUsadas.get(chave) || 0) + 1);
      });
    });

    function _nivel(caminho, n) { const p = caminho.split(' › '); return p.slice(0, Math.min(p.length, n)).join(' › '); }

    const apartamentos = [...chavesUsadas.keys()]
      .map(chave => infoPorChave.get(chave))
      .filter(Boolean)
      .map(info => ({ ...info, completude: chavesUsadas.get(info.chave) || 0, pavimentoChave: _nivel(info.chave, 2) }))
      .sort((a, b) => {
        const t = a.torreChave.localeCompare(b.torreChave, 'pt-BR', { numeric: true });
        if (t !== 0) return t;
        const p = a.pavimentoChave.localeCompare(b.pavimentoChave, 'pt-BR', { numeric: true });
        if (p !== 0) return p;
        if (b.completude !== a.completude) return b.completude - a.completude; // mais dado lançado primeiro (ex: Hall antes de Escada, que só tem pintura)
        return a.chave.localeCompare(b.chave, 'pt-BR', { numeric: true });
      });

    return { apartamentos, linhas };
  }

  // Remove acentos, símbolo de grau/ordinal (° º) e normaliza espaços/maiúsculas
  // — usado só como CHAVE de agrupamento (comparação), nunca como texto exibido.
  // É o que permite "1° Pavimento" (Piso) e "1º Pavimento" (Teto) caírem na
  // mesma coluna mesmo com digitação levemente diferente entre levantamentos.
  function _normalizarChave(s) {
    return String(s || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[°º]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Constrói, a partir da árvore [{id,nome,filhos:[...]}], um mapa nodeId -> {label,chave,torre,torreChave}
  // onde "apartamento" são SEMPRE os 3 primeiros níveis do caminho — Torre (ou
  // Subsolo/Térreo) / Nº do Pavimento / Nº do Ap, convenção usada em todos os
  // levantamentos do Milton. Isso é diferente de "pegar o nó pai de onde a área
  // foi lançada": em Paredes a área fica num Cômodo ABAIXO do Apto (parent =
  // Apto, ok), mas em Piso/Teto a área costuma ser lançada DIRETO no Apto (sem
  // Cômodo) — nesse caso "pegar o pai" dava o Pavimento por engano, perdendo a
  // divisão por apartamento. Cravar a profundidade em 3 resolve os dois casos:
  // se a área está no próprio Apto (profundidade 3) ou um nível abaixo dele
  // (Cômodo, profundidade 4+), o resultado é o mesmo caminho de 3 segmentos.
  // Locais mais rasos (ex: área comum lançada direto no Pavimento, sem Apto)
  // mantêm o caminho que tiverem (2 ou 1 segmentos) — viram sua própria coluna.
  // "chave"/"torreChave" são a versão normalizada do caminho, usada pra agrupar
  // entre árvores diferentes (Piso, Teto, Paredes) — ver comentário em
  // _calcularResumoApartamento. "label"/"torre" mantêm o texto original.
  function _mapaApartamentosPorLabel(arvore) {
    const mapaNode = new Map();
    const PROFUNDIDADE_APTO = 3; // Torre > Pavimento > Apto
    function ordenar(nodes) { return [...(nodes || [])].sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { numeric: true })); }
    function walk(nodes, caminho, caminhoChave) {
      ordenar(nodes).forEach(n => {
        const nome = n.nome || '';
        const novoCaminho = [...caminho, nome];
        const novoCaminhoChave = [...caminhoChave, _normalizarChave(nome)];
        const filhos = n.filhos || [];
        const corte = Math.min(novoCaminho.length, PROFUNDIDADE_APTO);
        const aptoCaminho = novoCaminho.slice(0, corte);
        const aptoCaminhoChave = novoCaminhoChave.slice(0, corte);
        mapaNode.set(n.id, {
          label: aptoCaminho.join(' › '), chave: aptoCaminhoChave.join(' › '),
          torre: novoCaminho[0] || '', torreChave: novoCaminhoChave[0] || '',
        });
        if (filhos.length) walk(filhos, novoCaminho, novoCaminhoChave);
      });
    }
    walk(arvore, [], []);
    return mapaNode;
  }

  // Réplica simplificada de Planejamento._calcularCustos — só o necessário pra
  // custo direto por tarefa (Material + Mão de Obra), sem distribuição hierárquica
  // pai↔filhos (aqui usamos direto, pois vínculos de levantamento são tipicamente
  // em tarefas-folha). Mantido em sincronia manual com js/planejamento.js.
  function _calcularCustosTarefas(materiaisBib, materiaisVinc, maoDeObraVinc) {
    const custoMaterialPorTarefa = new Map(), custoMaoObraPorTarefa = new Map();
    const bibPorId = new Map(materiaisBib.map(m => [m.id, m]));
    materiaisVinc.forEach(v => {
      const ids = v.tarefaIds || (v.tarefaId ? [v.tarefaId] : []);
      ids.forEach(tarefaId => {
        if (!tarefaId || tarefaId === '__fachada__') return;
        const t = tarefas.find(x => x.id === tarefaId);
        const mat = bibPorId.get(v.materialId);
        if (!t || !mat || !mat.preco) return;
        const cons = parseFloat(v.consumoPrevisto) || 0;
        const custo = (t.quantidade || 0) * cons * parseFloat(mat.preco);
        custoMaterialPorTarefa.set(tarefaId, (custoMaterialPorTarefa.get(tarefaId) || 0) + custo);
      });
    });
    maoDeObraVinc.forEach(v => {
      const ids = v.tarefaIds || (v.tarefaId ? [v.tarefaId] : []);
      ids.forEach(tarefaId => {
        if (!tarefaId) return;
        const t = tarefas.find(x => x.id === tarefaId);
        if (!t) return;
        const valor = parseFloat(v.valor) || 0;
        const custo = t.quantidade ? valor * t.quantidade : valor;
        custoMaoObraPorTarefa.set(tarefaId, (custoMaoObraPorTarefa.get(tarefaId) || 0) + custo);
      });
    });
    return { custoMaterialPorTarefa, custoMaoObraPorTarefa };
  }

  function _custoMedioPorUnidade(modulo, metrica, custoMaterialPorTarefa, custoMaoObraPorTarefa) {
    const alvo = tarefas.filter(t => t.fonteQuantidade === 'levantamento' && t.levantamentoModulo === modulo && t.levantamentoMetrica === metrica);
    if (!alvo.length) return null;
    let custoTotal = 0, qtdTotal = 0;
    alvo.forEach(t => {
      custoTotal += (custoMaterialPorTarefa.get(t.id) || 0) + (custoMaoObraPorTarefa.get(t.id) || 0);
      qtdTotal += Number(t.quantidade) || 0;
    });
    if (!qtdTotal) return null;
    return custoTotal / qtdTotal;
  }

  function _renderTabelaResumo() {
    const host = document.getElementById('db-resumo-apartamento');
    if (!host || !_resumoDados) return;
    const { apartamentos, linhas } = _resumoDados;

    if (!linhas.length) {
      host.innerHTML = `<div class="estado-vazio">
        <div class="icone">📐</div>
        <p>Nenhum dado de levantamento lançado ainda.</p>
        <p class="text-sm text-muted">Assim que Piso, Paredes ou Teto tiverem áreas cadastradas, o resumo aparece aqui automaticamente.</p>
      </div>`;
      return;
    }

    const fmt = (v, unidade) => v ? Utils.formatarNumero(v) + ' ' + unidade : '—';
    const fmtCusto = (v) => (v != null) ? 'R$ ' + Utils.formatarNumero(v) : '<span class="text-muted">—</span>';
    const valorLinha = (l, chave) => l.porApto.get(chave) || 0;
    const celula = (l, v) => {
      if (_resumoView === 'custo') {
        const custo = (l.custoUnitario != null) ? v * l.custoUnitario : null;
        return fmtCusto(custo);
      }
      return fmt(v, l.unidade);
    };

    const semLocal = apartamentos.length === 0;

    // ---------- Sem árvore de local: uma única coluna "Toda a obra" ----------
    if (semLocal) {
      let categoriaAtual = null;
      const linhasHtml = linhas.map(l => {
        let headerCategoria = '';
        if (l.categoria !== categoriaAtual) {
          categoriaAtual = l.categoria;
          headerCategoria = `<tr class="db-resumo-categoria"><td colspan="3">${l.categoria}</td></tr>`;
        }
        const v = valorLinha(l, '__sem_local__');
        return `${headerCategoria}<tr><td>${l.label}</td><td class="col-num">${celula(l, v)}</td><td class="col-num" style="font-weight:700;">${celula(l, l.total)}</td></tr>`;
      }).join('');
      host.innerHTML = `
        <div class="text-sm text-muted" style="margin-bottom:8px;">Nenhuma árvore de local configurada ainda — mostrando totais da obra.</div>
        <div class="tabela-container" style="max-height:520px;">
          <table class="tabela">
            <thead><tr><th>Item</th><th class="col-num">Toda a obra</th><th class="col-num">Total</th></tr></thead>
            <tbody>${linhasHtml}</tbody>
          </table>
        </div>`;
      return;
    }

    // ---------- Com árvore de local: Torre > Pavimento > Apto, com subtotal ----------
    // Estrutura: cada Torre agrupa Pavimentos (na ordem já definida em
    // _calcularResumoApartamento); cada Pavimento agrupa seus Apartamentos +
    // uma coluna de Subtotal do Pavimento; cada Torre fecha com uma coluna de
    // Subtotal da Torre. Isso evita repetir "Torre"/"Pavimento" como se
    // fossem apartamentos soltos — eles só aparecem como somatório no final.
    const torresMap = new Map(); // torreChave -> { torre, pavimentos: Map(pavChave -> {label, cols:[]}) }
    apartamentos.forEach(a => {
      if (!torresMap.has(a.torreChave)) torresMap.set(a.torreChave, { torre: a.torre || '—', pavimentos: new Map() });
      const tg = torresMap.get(a.torreChave);
      if (!tg.pavimentos.has(a.pavimentoChave)) {
        const labelPav = a.label.split(' › ').slice(0, 2).join(' › ');
        tg.pavimentos.set(a.pavimentoChave, { label: labelPav, cols: [] });
      }
      tg.pavimentos.get(a.pavimentoChave).cols.push(a);
    });
    const torres = [...torresMap.values()];

    // Lista "achatada" de colunas na ordem exata em que vão aparecer no corpo
    // da tabela — usada tanto pro cabeçalho quanto pras linhas, garantindo
    // que os dois batam sempre.
    const colunasOrdenadas = [];
    torres.forEach(tg => {
      [...tg.pavimentos.values()].forEach(pav => {
        pav.cols.forEach(a => colunasOrdenadas.push({ tipo: 'apto', a }));
        colunasOrdenadas.push({ tipo: 'subtotalPav', pav });
      });
      colunasOrdenadas.push({ tipo: 'subtotalTorre', tg });
    });

    function valorColuna(l, col) {
      if (col.tipo === 'apto') return valorLinha(l, col.a.chave);
      if (col.tipo === 'subtotalPav') return col.pav.cols.reduce((s, a) => s + valorLinha(l, a.chave), 0);
      let s = 0; col.tg.pavimentos.forEach(pav => { s += pav.cols.reduce((s2, a) => s2 + valorLinha(l, a.chave), 0); });
      return s;
    }

    // ---- Cabeçalho: 3 linhas (Torre / Pavimento / Apto+Subtotais) ----
    let headerTorre = '';
    let headerPav = '';
    let headerApto = '';
    torres.forEach(tg => {
      const pavimentos = [...tg.pavimentos.values()];
      let colsNaTorre = 1; // +1 pelo subtotal da própria torre
      pavimentos.forEach(pav => {
        colsNaTorre += pav.cols.length + 1; // +1 pelo subtotal do pavimento
        headerPav += `<th colspan="${pav.cols.length + 1}" style="text-align:center;">${pav.label}</th>`;
        pav.cols.forEach(a => {
          headerApto += `<th class="col-num" style="text-align:center;" title="${a.label}">${a.label.split(' › ').pop()}</th>`;
        });
        headerApto += `<th class="col-num db-subtotal-col" style="text-align:center;">Subtot.</th>`;
      });
      headerTorre += `<th colspan="${colsNaTorre}" style="text-align:center;">${tg.torre}</th>`;
      headerPav += `<th rowspan="2" class="col-num db-subtotal-col" style="text-align:center;">Subtot.<br>Torre</th>`;
    });

    let categoriaAtual = null;
    const linhasHtml = linhas.map(l => {
      let headerCategoria = '';
      if (l.categoria !== categoriaAtual) {
        categoriaAtual = l.categoria;
        headerCategoria = `<tr class="db-resumo-categoria"><td colspan="${colunasOrdenadas.length + 2}">${l.categoria}</td></tr>`;
      }
      const cels = colunasOrdenadas.map(col => {
        const v = valorColuna(l, col);
        const cls = col.tipo === 'apto' ? 'col-num' : 'col-num db-subtotal-col';
        return `<td class="${cls}">${celula(l, v)}</td>`;
      }).join('');
      const totalCel = `<td class="col-num" style="font-weight:700;">${celula(l, l.total)}</td>`;
      return `${headerCategoria}<tr><td>${l.label}</td>${cels}${totalCel}</tr>`;
    }).join('');

    host.innerHTML = `
      <div class="tabela-container" style="max-height:520px;">
        <table class="tabela">
          <thead>
            <tr><th rowspan="3">Item</th>${headerTorre}<th rowspan="3" class="col-num">Total</th></tr>
            <tr>${headerPav}</tr>
            <tr>${headerApto}</tr>
          </thead>
          <tbody>${linhasHtml}</tbody>
        </table>
      </div>`;
  }

  return { init, onObraChanged, setResumoView, setPacotesView, setCurvaGranularidade, toggleMostrarConcreto, _arvToggle, _arvNivelFixo, _arvHorizonte, _fecharPopupProjeto, _popupNavegar, _popupZoomAjustar, _painelSetModo, _abrirConfigPainel, _salvarConfigPainel, _painelAbrirDetalhe, _painelCfgToggleAberto, _painelCfgFiltrar };
})();

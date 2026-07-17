// ============================================
// Dashboard Principal
// Visão geral da obra: hero com seletor, Curva S, Índice de Desempenho
// de Prazo, atividades, avanço por pacotes, PPC semanal/motivos de
// atraso e resumo por apartamento (quantidade/custo).
// ============================================
const Dashboard = (() => {
  let obraAtual = null;
  let tarefas = [];
  let semanas = [];
  let historicoExecucao = [];
  let _resumoView = 'unidade';
  let _resumoDados = null;
  let _curvaCache = null; // último cálculo da Curva S (usado pelo tooltip)
  let _curvaGranularidade = 'mensal'; // 'mensal' | 'semanal'

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
    await carregar();
  }

  async function onObraChanged(obra) {
    obraAtual = obra;
    await carregar();
  }
  window.onObraChanged = onObraChanged;

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
      const [obraCompleta, tf, sem, hist] = await Promise.all([
        Database.getObra(obraId),
        Database.listar(obraId, 'tarefas', 'ordem').catch(() => []),
        Database.listar(obraId, 'semanas', 'fim').catch(() => []),
        Database.listar(obraId, 'historicoExecucao', 'data', 'asc').catch(() => []),
      ]);
      obraAtual = obraCompleta || obraAtual;
      tarefas = tf;
      semanas = sem;
      historicoExecucao = hist;
      el.innerHTML = _htmlEsqueleto();
      _renderHero();
      _renderAtividades();
      await _renderResumoApartamento();
      _renderCurvaS();
      _renderPpcSemanal();
      _renderMotivosAtraso();
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

      <!-- ===== Resto (prioridade menor) ===== -->

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

      <div class="db-grid-2">
        <div class="card">
          <div class="card-body">
            <div class="db-secao-header"><h3>Curto Prazo — PPC Semanal</h3></div>
            <div id="db-ppc-semanal" class="db-tooltip-wrap"></div>
          </div>
        </div>
        <div class="card">
          <div class="card-body">
            <div class="db-secao-header"><h3>Motivos de Atraso Semanais</h3></div>
            <div id="db-motivos-atraso" class="db-tooltip-wrap"></div>
          </div>
        </div>
      </div>

      <div class="card db-row">
        <div class="card-body">
          <div class="db-secao-header"><h3>Suprimentos</h3></div>
          <div class="estado-vazio">
            <div class="icone">📦</div>
            <p>O módulo Suprimentos ainda não tem dados cadastrados.</p>
            <p class="text-sm text-muted">Assim que Suprimentos for implementado (cadastro de solicitação, cotação, pedido de compra, mobilização), este painel passa a mostrar o status real aqui.</p>
          </div>
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

  // ===================== ATIVIDADES =====================
  function _renderAtividades() {
    const host = document.getElementById('db-atividades');
    const atualizado = document.getElementById('db-atualizado-em');
    if (atualizado) atualizado.textContent = 'Atualizado em ' + Utils.formatarDataHora(new Date());
    if (!host) return;

    const leaves = _leaves();
    const emExecucao = leaves
      .filter(t => (Number(t.percentualConcluido) || 0) > 0 && (Number(t.percentualConcluido) || 0) < 100)
      .sort((a, b) => new Date(a.terminoPlanejado || '9999-12-31') - new Date(b.terminoPlanejado || '9999-12-31'))
      .slice(0, 8);
    const proximas = leaves
      .filter(t => !(Number(t.percentualConcluido) > 0))
      .sort((a, b) => new Date(a.inicioPlanejado || '9999-12-31') - new Date(b.inicioPlanejado || '9999-12-31'))
      .slice(0, 8);

    const item = (t, corBase) => `
      <div class="db-ativ-item">
        <span class="db-ativ-dot" style="background:${corBase};"></span>
        <div class="db-ativ-info">
          <div class="db-ativ-nome">${t.nome || 'Sem nome'}</div>
          <div class="db-ativ-sub text-sm text-muted">${t.local ? t.local + ' · ' : ''}Prazo: ${Utils.formatarData(t.terminoPlanejado)}</div>
        </div>
        <div class="db-ativ-perc">${Math.round(Number(t.percentualConcluido) || 0)}%</div>
      </div>`;

    host.innerHTML = `
      <div class="db-ativ-grid">
        <div class="db-ativ-col">
          <div class="db-ativ-col-titulo">Em Execução</div>
          ${emExecucao.length ? emExecucao.map(t => item(t, '#facc15')).join('') : '<div class="text-sm text-muted" style="padding:10px 0;">Nenhuma atividade em execução.</div>'}
        </div>
        <div class="db-ativ-col">
          <div class="db-ativ-col-titulo">Próximas</div>
          ${proximas.length ? proximas.map(t => item(t, '#60a5fa')).join('') : '<div class="text-sm text-muted" style="padding:10px 0;">Nenhuma atividade pendente.</div>'}
        </div>
      </div>`;
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

  return { init, onObraChanged, setResumoView, setPacotesView, setCurvaGranularidade };
})();

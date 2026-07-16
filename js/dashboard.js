// ============================================
// Dashboard Principal
// Visão geral da obra: hero com seletor, KPIs, Curva S,
// atividades em execução/próximas e resumo por apartamento
// (quantidade/custo) alimentado pelos Levantamentos.
// ============================================
const Dashboard = (() => {
  let obraAtual = null;
  let tarefas = [];
  let _resumoView = 'unidade'; // 'unidade' | 'custo'
  let _resumoDados = null; // cache do último cálculo (linhas, aptos, torres)

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

  // Chamado pelo Router quando o seletor da sidebar muda (sem precisar reload)
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
      const [obraCompleta, tf] = await Promise.all([
        Database.getObra(obraId),
        Database.listar(obraId, 'tarefas', 'ordem').catch(() => []),
      ]);
      obraAtual = obraCompleta || obraAtual;
      tarefas = tf;
      el.innerHTML = _htmlEsqueleto();
      _renderHero();
      _renderAtividades();
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
      <div class="db-grid-top">
        <div class="card db-card-atividades">
          <div class="card-body">
            <div class="db-secao-header">
              <h3>Atividades</h3>
              <span class="text-sm text-muted" id="db-atualizado-em"></span>
            </div>
            <div id="db-atividades"></div>
          </div>
        </div>
        <div class="card db-card-curva">
          <div class="card-body">
            <div class="db-secao-header"><h3>Curva S — Planejamento</h3></div>
            <div id="db-curva-s"></div>
          </div>
        </div>
      </div>
      <div class="card db-card-resumo">
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
    const perc = Math.round(prog.percConcluido);
    const percEsp = Math.round(prog.percEsperado);
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
  function _leaves() {
    return tarefas.filter(t => t.tipo !== 'grupo');
  }

  function _calcProgresso(tf) {
    const leaves = tf.filter(t => t.tipo !== 'grupo');
    if (!leaves.length) return { percConcluido: 0, percEsperado: 0, inicioReal: null, terminoAtual: null, terminoBase: null };
    let somaPeso = 0, somaConc = 0, somaEsp = 0;
    let terminoAtual = null, terminoBase = null, inicioReal = null;
    leaves.forEach(t => {
      const peso = Math.max(1, Number(t.duracao) || 1);
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
      <div class="db-ativ-col">
        <div class="db-ativ-col-titulo">Em Execução</div>
        ${emExecucao.length ? emExecucao.map(t => item(t, '#facc15')).join('') : '<div class="text-sm text-muted" style="padding:10px 0;">Nenhuma atividade em execução.</div>'}
      </div>
      <div class="db-ativ-col">
        <div class="db-ativ-col-titulo">Próximas</div>
        ${proximas.length ? proximas.map(t => item(t, '#60a5fa')).join('') : '<div class="text-sm text-muted" style="padding:10px 0;">Nenhuma atividade pendente.</div>'}
      </div>`;
  }

  // ===================== CURVA S =====================
  function _mesKey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  function _mesLabel(d) { return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', ''); }

  function _calcCurvaS(tf) {
    const leaves = tf.filter(t => t.tipo !== 'grupo' && (t.inicioPlanejado || t.inicioPlanejadoBase));
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

    // Monta buckets mensais [dMin..dMax]
    const meses = [];
    let cursor = new Date(dMin.getFullYear(), dMin.getMonth(), 1);
    const fimCursor = new Date(dMax.getFullYear(), dMax.getMonth(), 1);
    while (cursor <= fimCursor) {
      const inicioMes = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const fimMes = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      meses.push({ label: _mesLabel(cursor), inicio: inicioMes, fim: fimMes, planMensal: 0, realMensal: 0 });
      cursor = fimMes;
    }

    function overlapFrac(iniA, fimA, iniB, fimB) {
      const iniOverlap = Math.max(iniA.getTime(), iniB.getTime());
      const fimOverlap = Math.min(fimA.getTime(), fimB.getTime());
      const overlap = Math.max(0, fimOverlap - iniOverlap);
      const total = Math.max(1, fimA.getTime() - iniA.getTime());
      return overlap / total;
    }

    let totalPeso = 0;
    leaves.forEach(t => { totalPeso += Math.max(1, Number(t.duracao) || 1); });
    if (!totalPeso) totalPeso = 1;

    leaves.forEach(t => {
      const peso = Math.max(1, Number(t.duracao) || 1);
      // Planejado (linha de base se existir)
      const iniP = new Date(t.inicioPlanejadoBase || t.inicioPlanejado);
      const fimP = new Date(t.terminoPlanejadoBase || t.terminoPlanejado || t.inicioPlanejado);
      const fimPValido = fimP > iniP ? fimP : new Date(iniP.getTime() + 864e5);
      meses.forEach(m => { m.planMensal += peso * overlapFrac(iniP, fimPValido, m.inicio, m.fim); });

      // Real
      const perc = Math.min(100, Number(t.percentualConcluido) || 0);
      if (perc > 0) {
        const pesoReal = peso * (perc / 100);
        if (perc >= 100 && t.terminoReal) {
          const dConcl = new Date(t.terminoReal);
          const mAlvo = meses.find(m => dConcl >= m.inicio && dConcl < m.fim) || meses[meses.length - 1];
          mAlvo.realMensal += pesoReal;
        } else {
          const iniR = new Date(t.inicioReal || t.inicioPlanejado || iniP);
          const fimR = hoje > iniR ? hoje : new Date(iniR.getTime() + 864e5);
          meses.forEach(m => { m.realMensal += pesoReal * overlapFrac(iniR, fimR, m.inicio, m.fim); });
        }
      }
    });

    let acumP = 0, acumR = 0, hojeIdx = 0;
    meses.forEach((m, i) => {
      acumP += m.planMensal; acumR += m.realMensal;
      m.planAcum = Math.min(100, acumP / totalPeso * 100);
      m.realAcum = Math.min(100, acumR / totalPeso * 100);
      if (m.inicio <= hoje) hojeIdx = i;
    });
    return { meses, hojeIdx };
  }

  function _renderCurvaS() {
    const host = document.getElementById('db-curva-s');
    if (!host) return;
    const curva = _calcCurvaS(tarefas);
    if (!curva || !curva.meses.length) {
      host.innerHTML = '<div class="estado-vazio"><p class="text-sm">Sem dados de planejamento suficientes para montar a Curva S.</p></div>';
      return;
    }
    host.innerHTML = _svgCurvaS(curva);
  }

  function _svgCurvaS(curva) {
    const meses = curva.meses;
    const W = 900, H = 300, padL = 34, padR = 12, padT = 16, padB = 34;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const n = meses.length;
    const x = i => padL + (n === 1 ? 0 : (i / (n - 1)) * plotW);
    const yAcum = v => padT + plotH - (Math.max(0, Math.min(100, v)) / 100) * plotH;

    const maxMensal = Math.max(1, ...meses.map(m => Math.max(m.planMensal, m.realMensal)));
    const barH = v => (v / maxMensal) * (plotH * 0.32);

    const barW = Math.max(2, (plotW / n) * 0.32);
    let bars = '';
    meses.forEach((m, i) => {
      const cx = x(i);
      const hP = barH(m.planMensal), hR = barH(m.realMensal);
      bars += `<rect x="${cx - barW - 1}" y="${padT + plotH - hP}" width="${barW}" height="${hP}" fill="#c9c9c9" opacity="0.8"><title>Esperado mensal — ${m.label}</title></rect>`;
      bars += `<rect x="${cx + 1}" y="${padT + plotH - hR}" width="${barW}" height="${hR}" fill="var(--cor-primaria)" opacity="0.9"><title>Executado mensal — ${m.label}</title></rect>`;
    });

    const pathPlan = meses.map((m, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${yAcum(m.planAcum).toFixed(1)}`).join(' ');
    const pathReal = meses.map((m, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${yAcum(m.realAcum).toFixed(1)}`).join(' ');

    const hojeX = x(curva.hojeIdx);
    const labelStep = Math.max(1, Math.ceil(n / 14));
    let labels = '';
    meses.forEach((m, i) => {
      if (i % labelStep !== 0 && i !== n - 1) return;
      labels += `<text x="${x(i).toFixed(1)}" y="${H - 10}" font-size="10" fill="var(--cor-texto-muted, #888)" text-anchor="middle">${m.label}</text>`;
    });

    const gridY = [0, 25, 50, 75, 100].map(v => `<line x1="${padL}" x2="${W - padR}" y1="${yAcum(v).toFixed(1)}" y2="${yAcum(v).toFixed(1)}" stroke="#eee" stroke-width="1"/><text x="4" y="${(yAcum(v) + 3).toFixed(1)}" font-size="9" fill="#999">${v}%</text>`).join('');

    return `
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;">
        ${gridY}
        <line x1="${hojeX.toFixed(1)}" x2="${hojeX.toFixed(1)}" y1="${padT}" y2="${padT + plotH}" stroke="#ef4444" stroke-width="1" stroke-dasharray="4,3"/>
        <text x="${hojeX.toFixed(1)}" y="${padT - 4}" font-size="9" fill="#ef4444" text-anchor="middle">hoje</text>
        ${bars}
        <path d="${pathPlan}" fill="none" stroke="#999" stroke-width="2" stroke-dasharray="5,3"/>
        <path d="${pathReal}" fill="none" stroke="var(--cor-primaria-dark, #B89400)" stroke-width="2.5"/>
        ${labels}
      </svg>
      <div class="db-legenda">
        <span><i style="background:#999;"></i> Esperado (acumulado)</span>
        <span><i style="background:var(--cor-primaria-dark,#B89400);"></i> Executado (acumulado)</span>
        <span><i style="background:#c9c9c9;"></i> Esperado mensal</span>
        <span><i style="background:var(--cor-primaria);"></i> Executado mensal</span>
      </div>`;
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

    // Carrega config (árvore) + dados de cada módulo em paralelo
    const cfgsCache = {}; // configDoc -> arvore (evita buscar 2x pra paredesAlvenaria/paredesAcabamento que usam o mesmo configDoc)
    const resultados = await Promise.all(chaves.map(async (chave) => {
      const mod = LEV_TREE[chave];
      const [dados, cfg] = await Promise.all([
        Database.listar(obraId, mod.colecao, null).catch(() => []),
        Database.obter(obraId, 'config', mod.configDoc).catch(() => null),
      ]);
      return { chave, dados, arvore: cfg?.arvore || [] };
    }));

    // Custos: carrega tarefas do planejamento + materiais/mão de obra pra estimar custo médio por unidade
    const [materiaisBib, materiaisVinc, maoDeObraVinc] = await Promise.all([
      Database.listar(obraId, 'materiais', 'nome').catch(() => []),
      Database.listar(obraId, 'materiais_vinculos', 'createdAt').catch(() => []),
      Database.listar(obraId, 'maoDeObra_vinculos', 'createdAt').catch(() => []),
    ]);
    const { custoMaterialPorTarefa, custoMaoObraPorTarefa } = _calcularCustosTarefas(materiaisBib, materiaisVinc, maoDeObraVinc);

    // Mapa nodeId -> {apartamentoId, apartamentoLabel, torreLabel} construído a partir da(s) árvore(s)
    // (paredesAlvenaria e paredesAcabamento compartilham a mesma árvore 'paredesArvore', então
    // qualquer uma das duas serve de fonte — usamos a que tiver árvore não-vazia).
    const apartamentosPorArvore = {}; // configDoc -> {mapaNode, ordemAptos:[{id,label,torre}]}
    resultados.forEach(r => {
      const mod = LEV_TREE[r.chave];
      if (!apartamentosPorArvore[mod.configDoc] || !apartamentosPorArvore[mod.configDoc].ordemAptos.length) {
        apartamentosPorArvore[mod.configDoc] = _mapaApartamentos(r.arvore);
      }
    });

    // Conjunto de todos os apartamentos (union, na ordem em que apareceram)
    const apartamentosMap = new Map(); // id -> {id,label,torre}
    Object.values(apartamentosPorArvore).forEach(({ ordemAptos }) => {
      ordemAptos.forEach(a => { if (!apartamentosMap.has(a.id)) apartamentosMap.set(a.id, a); });
    });
    const apartamentos = [...apartamentosMap.values()];

    // Linhas: para cada módulo/métrica, soma por apartamento
    const linhas = [];
    resultados.forEach(r => {
      const mod = LEV_TREE[r.chave];
      const { mapaNode } = apartamentosPorArvore[mod.configDoc] || { mapaNode: new Map() };
      mod.linhas.forEach(linhaCfg => {
        const porApto = new Map(); // apartamentoId -> valor
        let total = 0;
        r.dados.forEach(reg => {
          const v = mod.valor(reg, linhaCfg.metrica);
          if (!v) return;
          total += v;
          const info = mapaNode.get(reg.nodeId);
          const aptoId = info ? info.id : '__sem_local__';
          porApto.set(aptoId, (porApto.get(aptoId) || 0) + v);
        });
        if (total <= 0) return; // linha sem nenhum dado lançado ainda — não polui a tabela
        const moduloVinculo = mod.moduloVinculo || r.chave;
        const custoInfo = _custoMedioPorUnidade(moduloVinculo, linhaCfg.metrica, custoMaterialPorTarefa, custoMaoObraPorTarefa);
        linhas.push({
          categoria: mod.label, metrica: linhaCfg.metrica, label: linhaCfg.label, unidade: linhaCfg.unidade,
          porApto, total, custoUnitario: custoInfo,
        });
      });
    });

    return { apartamentos, linhas };
  }

  // Constrói, a partir da árvore [{id,nome,filhos:[...]}], um mapa nodeId -> {id,label,torre}
  // onde o "apartamento" é o NÓ PAI do local onde a área/peça foi lançada (convenção
  // Torre > Andar > Apto > Cômodo — a área é lançada no Cômodo, o pai é o Apto).
  // Também devolve a lista de apartamentos na ordem de varredura (alfabética por nível,
  // igual à convenção já usada nos módulos de Levantamento).
  function _mapaApartamentos(arvore) {
    const mapaNode = new Map(); // nodeId (do registro) -> {id,label,torre} do apartamento
    const ordemAptos = [];
    const vistos = new Set();

    function ordenar(nodes) { return [...(nodes || [])].sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR')); }

    function walk(nodes, caminho) {
      ordenar(nodes).forEach(n => {
        const novoCaminho = [...caminho, { id: n.id, nome: n.nome }];
        const filhos = n.filhos || [];
        // Nó "apartamento" = pai imediato de quem tiver filhos folha (sem filhos) OU
        // qualquer nó — resolvido de baixo pra cima quando um registro referenciar este nodeId.
        if (!vistos.has(n.id)) {
          vistos.add(n.id);
          const apto = novoCaminho.length > 1 ? novoCaminho[novoCaminho.length - 2] : novoCaminho[novoCaminho.length - 1];
          const label = novoCaminho.slice(0, novoCaminho.length > 1 ? -1 : undefined).map(c => c.nome).join(' › ');
          const torre = novoCaminho[0].nome;
          const info = { id: apto.id, label, torre };
          mapaNode.set(n.id, info);
          if (!ordemAptos.find(a => a.id === info.id)) ordemAptos.push(info);
        }
        if (filhos.length) walk(filhos, novoCaminho);
      });
    }
    walk(arvore, []);
    return { mapaNode, ordemAptos };
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

  // Custo médio por unidade = soma (custo material+mão de obra) das tarefas vinculadas
  // a este módulo+métrica de levantamento, dividido pela quantidade total vinculada.
  // Aproximação: assume custo uniforme por unidade em toda a obra (V1 — refinar depois
  // se for preciso diferenciar custo por local).
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

    const semLocal = apartamentos.length ? false : true;
    const colunas = apartamentos.length ? apartamentos : [{ id: '__sem_local__', label: 'Toda a obra', torre: '' }];

    // Cabeçalho agrupado por Torre
    const grupos = [];
    colunas.forEach(a => {
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.torre === (a.torre || '')) ultimo.cols.push(a);
      else grupos.push({ torre: a.torre || '', cols: [a] });
    });

    let categoriaAtual = null;
    const linhasHtml = linhas.map(l => {
      let headerCategoria = '';
      if (l.categoria !== categoriaAtual) {
        categoriaAtual = l.categoria;
        headerCategoria = `<tr class="db-resumo-categoria"><td colspan="${colunas.length + 2}">${l.categoria}</td></tr>`;
      }
      const cels = colunas.map(a => {
        const v = l.porApto.get(a.id) || 0;
        if (_resumoView === 'custo') {
          const custo = (l.custoUnitario != null) ? v * l.custoUnitario : null;
          return `<td class="col-num">${fmtCusto(custo)}</td>`;
        }
        return `<td class="col-num">${fmt(v, l.unidade)}</td>`;
      }).join('');
      const totalCel = _resumoView === 'custo'
        ? `<td class="col-num" style="font-weight:700;">${fmtCusto(l.custoUnitario != null ? l.total * l.custoUnitario : null)}</td>`
        : `<td class="col-num" style="font-weight:700;">${fmt(l.total, l.unidade)}</td>`;
      return `${headerCategoria}<tr><td>${l.label}</td>${cels}${totalCel}</tr>`;
    }).join('');

    const gruposHtml = grupos.map(g => `<th colspan="${g.cols.length}" style="text-align:center;border-bottom:1px solid var(--cor-borda-light);">${g.torre || '—'}</th>`).join('');
    const aptosHtml = colunas.map(a => `<th class="col-num" title="${a.label}">${a.label.split(' › ').pop()}</th>`).join('');

    host.innerHTML = `
      ${semLocal ? '<div class="text-sm text-muted" style="margin-bottom:8px;">Nenhuma árvore de local configurada ainda — mostrando totais da obra.</div>' : ''}
      <div class="tabela-container" style="max-height:520px;">
        <table class="tabela">
          <thead>
            <tr><th></th>${gruposHtml}<th></th></tr>
            <tr><th>Item</th>${aptosHtml}<th class="col-num">Total</th></tr>
          </thead>
          <tbody>${linhasHtml}</tbody>
        </table>
      </div>`;
  }

  return { init, onObraChanged, setResumoView };
})();

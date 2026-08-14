// ============================================
// Dashboard — Atividades (DashAtividades)
// Em Execução + Próximas do Planejamento, em árvore navegável (mesmo padrão
// do Editor de Estrutura): pills de nível fixo, grupos expansíveis com
// resumo agregado e, nas Próximas, horizonte de tempo. Preferências por
// usuário (Firestore users/{uid}.dashboardArvorePrefs.ativ_*, mesmas chaves
// de antes da V2.62 — prefs antigas continuam valendo).
// ============================================
const DashAtividades = (() => {
  let _ctx = null;

  const COLS = {
    ativ_execucao: { titulo: 'Em Execução', dot: '#facc15', usaHorizonte: false, rotuloData: 'prazo' },
    ativ_proximas: { titulo: 'Próximas', dot: '#60a5fa', usaHorizonte: true, rotuloData: 'início' },
  };

  function _chaveLS(chave, campo) { return `db_arvore_${chave}_${campo}`; }
  function _novoEstado(chave, horizontePadrao) {
    const nivelSalvo = parseInt(localStorage.getItem(_chaveLS(chave, 'nivel')), 10);
    const horizSalvo = localStorage.getItem(_chaveLS(chave, 'horizonte'));
    return {
      nivelFixo: Number.isFinite(nivelSalvo) ? nivelSalvo : 0,
      abertos: new Set(),
      horizonteDias: horizSalvo != null ? (horizSalvo === 'null' ? null : Number(horizSalvo)) : horizontePadrao,
    };
  }
  const _st = {
    ativ_execucao: _novoEstado('ativ_execucao', null),
    ativ_proximas: _novoEstado('ativ_proximas', 30),
  };

  function aplicarPrefsRemotas(prefs) {
    if (!prefs) return;
    Object.keys(COLS).forEach(chave => {
      const p = prefs[chave];
      if (!p) return;
      if (typeof p.nivelFixo === 'number') _st[chave].nivelFixo = p.nivelFixo;
      if ('horizonteDias' in p) _st[chave].horizonteDias = p.horizonteDias;
      localStorage.setItem(_chaveLS(chave, 'nivel'), String(_st[chave].nivelFixo));
      localStorage.setItem(_chaveLS(chave, 'horizonte'), String(_st[chave].horizonteDias));
    });
  }
  let _salvarTimer = null;
  function _salvarPrefsRemotas() {
    clearTimeout(_salvarTimer);
    _salvarTimer = setTimeout(async () => {
      const uid = Auth.getUid();
      if (!uid) return;
      try {
        await Database.atualizarRaiz('users', uid, {
          dashboardArvorePrefs: {
            ativ_execucao: { nivelFixo: _st.ativ_execucao.nivelFixo, horizonteDias: _st.ativ_execucao.horizonteDias },
            ativ_proximas: { nivelFixo: _st.ativ_proximas.nivelFixo, horizonteDias: _st.ativ_proximas.horizonteDias },
          },
        });
      } catch (e) { /* preferência de UI — falha silenciosa */ }
    }, 900);
  }

  function _emExecucaoFiltro(t) { return (Number(t.percentualConcluido) || 0) > 0 && (Number(t.percentualConcluido) || 0) < 100; }
  function _proximasFiltro(t) { return !(Number(t.percentualConcluido) > 0); }
  function _campoData(chave, t) { return chave === 'ativ_execucao' ? t.terminoPlanejado : t.inicioPlanejado; }
  function _dentroHorizonte(chave, data) {
    // Em Execução NUNCA aplica horizonte: se está em execução, mostra —
    // prefs antigas (pré-V2.62) traziam horizonteDias gravado pra essa
    // coluna e filtravam por TÉRMINO planejado, escondendo tarefas em
    // execução com término distante (ex: Custos Indiretos até 2028).
    if (!COLS[chave].usaHorizonte) return true;
    const st = _st[chave];
    if (st.horizonteDias == null) return true;
    if (!data) return true;
    const limite = new Date(); limite.setHours(0, 0, 0, 0); limite.setDate(limite.getDate() + st.horizonteDias);
    return new Date(data) <= limite;
  }

  function _resumoNo(chave, no, sorted, statusFiltro) {
    const folhas = DashCore.folhasDescendentes(no, sorted)
      .filter(statusFiltro)
      .filter(t => _dentroHorizonte(chave, _campoData(chave, t)));
    if (!folhas.length) return null;
    let somaPeso = 0, somaConc = 0, dataMaisProxima = null;
    folhas.forEach(t => {
      const p = DashCore.peso(t); // peso por duração — regra 5.1
      somaPeso += p;
      somaConc += Math.min(100, Number(t.percentualConcluido) || 0) * p;
      const d = _campoData(chave, t) ? new Date(_campoData(chave, t)) : null;
      if (d && (!dataMaisProxima || d < dataMaisProxima)) dataMaisProxima = d;
    });
    return { qtd: folhas.length, percMedio: somaPeso ? somaConc / somaPeso : 0, dataMaisProxima };
  }

  function _noAberto(chave, t) {
    if ((t.nivel || 0) < _st[chave].nivelFixo) return true;
    return _st[chave].abertos.has(t.id);
  }

  const HORIZONTES = [
    { dias: 7, label: '7 dias' }, { dias: 30, label: '1 mês' }, { dias: 60, label: '2 meses' }, { dias: 90, label: '3 meses' },
    { dias: 180, label: '6 meses' }, { dias: 365, label: '1 ano' }, { dias: null, label: 'Tudo' },
  ];

  function _tomPct(pct) {
    if (pct >= 100) return '#15803d';
    if (pct > 70) return '#16a34a';
    if (pct > 30) return '#a16207';
    if (pct > 0) return '#b91c1c';
    return '#9a9a9a';
  }

  function _renderColuna(chave, sorted) {
    const cfg = COLS[chave];
    const st = _st[chave];
    const statusFiltro = chave === 'ativ_execucao' ? _emExecucaoFiltro : _proximasFiltro;
    const raizes = sorted.filter(t => (t.nivel || 0) === st.nivelFixo);
    const max = sorted.reduce((m, t) => Math.max(m, t.nivel || 0), 0);

    const linhaFolha = (t, indent) => {
      const pct = Math.round(Number(t.percentualConcluido) || 0);
      // Próximas com início planejado já vencido: alerta visual — a tarefa
      // deveria ter começado (ou o % está desatualizado no Planejamento).
      let chipAtraso = '';
      if (chave === 'ativ_proximas' && t.inicioPlanejado) {
        const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
        if (new Date(t.inicioPlanejado) < hoje) chipAtraso = '<span class="db-chip" style="background:#fdf0ef;color:#b91c1c;border-color:transparent;font-weight:600;">deveria ter iniciado</span>';
      }
      return `
      <div class="db-sup-item" style="padding-left:${indent}px;">
        <span class="db-ativ-dot" style="background:${cfg.dot};"></span>
        <div class="db-sup-info">
          <div class="db-sup-nome">${DashCore.esc(t.nome || 'Sem nome')}</div>
          <div class="db-sup-sub">${t.local ? DashCore.esc(t.local) + ' · ' : ''}${cfg.rotuloData} ${Utils.formatarData(_campoData(chave, t))}</div>
        </div>
        ${chipAtraso}
        <span class="db-ativ-pct" style="color:${_tomPct(pct)};">${pct}%</span>
      </div>`;
    };

    const linhaGrupo = (t, resumo, aberto, indent) => `
      <div class="db-sup-item db-sup-grupo" style="padding-left:${indent}px;" onclick="DashAtividades.toggleNo('${chave}','${t.id}')">
        <span class="db-sup-seta">${aberto ? '▾' : '▸'}</span>
        <div class="db-sup-info">
          <div class="db-sup-nome">${DashCore.esc(t.nome || 'Sem nome')} <span class="db-sup-qtd">${resumo.qtd}</span></div>
          ${aberto ? '' : `<div class="db-sup-sub">${resumo.dataMaisProxima ? cfg.rotuloData + ' mais próximo ' + Utils.formatarData(resumo.dataMaisProxima) : 'sem data'}</div>`}
        </div>
        <span class="db-ativ-pct" style="color:${_tomPct(Math.round(resumo.percMedio))};">${Math.round(resumo.percMedio)}%</span>
      </div>`;

    const renderNivel = (nos, indent) => {
      let html = '';
      nos.forEach(t => {
        const filhos = DashCore.filhosDiretos(t, sorted);
        if (!filhos.length) {
          if (statusFiltro(t) && _dentroHorizonte(chave, _campoData(chave, t))) html += linhaFolha(t, indent);
          return;
        }
        const resumo = _resumoNo(chave, t, sorted, statusFiltro);
        if (!resumo) return;
        const aberto = _noAberto(chave, t);
        html += linhaGrupo(t, resumo, aberto, indent);
        if (aberto) html += renderNivel(filhos, indent + 16);
      });
      return html;
    };

    const corpo = renderNivel(raizes, 0) ||
      `<div class="db-vazio-inline">${chave === 'ativ_execucao' ? 'Nenhuma atividade em execução.' : '✅ Nenhuma atividade pendente neste período.'}</div>`;

    let botoesNivel = '';
    for (let n = 0; n <= max; n++) {
      botoesNivel += `<button class="db-pill ${st.nivelFixo === n ? 'ativo' : ''}" onclick="DashAtividades.setNivel('${chave}',${n})">Nível ${n}</button>`;
    }

    return `
      <div class="db-ativ-bloco">
        <div class="db-sup-toolbar">
          <span class="db-ativ-col-titulo"><i class="db-ativ-dot" style="background:${cfg.dot};display:inline-block;margin-right:6px;"></i>${cfg.titulo}</span>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
            <div class="db-pills">${botoesNivel}</div>
            ${cfg.usaHorizonte ? `
              <select class="form-control" style="max-width:120px;font-size:.74rem;padding:4px 8px;" onchange="DashAtividades.setHorizonte('${chave}',this.value)">
                ${HORIZONTES.map(o => `<option value="${o.dias}" ${st.horizonteDias === o.dias ? 'selected' : ''}>${o.label}</option>`).join('')}
              </select>` : ''}
          </div>
        </div>
        <div class="db-sup-lista">${corpo}</div>
      </div>`;
  }

  function render(ctx) {
    _ctx = ctx;
    const host = document.getElementById('db-atividades');
    if (!host) return;
    const sorted = [...ctx.tarefas].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    host.innerHTML = _renderColuna('ativ_execucao', sorted) +
      '<div style="height:18px;"></div>' +
      _renderColuna('ativ_proximas', sorted);
  }

  function setNivel(chave, nivel) {
    _st[chave].nivelFixo = nivel;
    _st[chave].abertos = new Set();
    localStorage.setItem(_chaveLS(chave, 'nivel'), String(nivel));
    _salvarPrefsRemotas();
    if (_ctx) render(_ctx);
  }
  function setHorizonte(chave, valor) {
    _st[chave].horizonteDias = valor === 'null' ? null : Number(valor);
    localStorage.setItem(_chaveLS(chave, 'horizonte'), String(_st[chave].horizonteDias));
    _salvarPrefsRemotas();
    if (_ctx) render(_ctx);
  }
  function toggleNo(chave, id) {
    if (_st[chave].abertos.has(id)) _st[chave].abertos.delete(id); else _st[chave].abertos.add(id);
    if (_ctx) render(_ctx);
  }

  return { render, aplicarPrefsRemotas, setNivel, setHorizonte, toggleNo };
})();
window.DashAtividades = DashAtividades;

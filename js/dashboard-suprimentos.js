// ============================================
// Dashboard — Suprimentos (DashSuprimentos)
// Próximas atividades (ainda não iniciadas no Planejamento) cujo pipeline
// de Suprimentos ainda não foi tocado — "falta providenciar suprimento"
// pras frentes que estão chegando. Árvore navegável com nível fixo e
// horizonte de tempo, preferências salvas por usuário (Firestore).
// ============================================
const DashSuprimentos = (() => {
  let _ctx = null;
  let _visao = localStorage.getItem('db_visao_suprimentos') || 'eap'; // 'eap' | 'grupos'
  let _fEquipe = '';
  let _eqMap = new Map();
  let _equipesDisponiveis = [];

  // ---------- Estado/preferências ----------
  function _chaveLS(campo) { return `db_arvore_suprimentos_${campo}`; }
  const _st = (() => {
    const nivelSalvo = parseInt(localStorage.getItem(_chaveLS('nivel')), 10);
    const horizSalvo = localStorage.getItem(_chaveLS('horizonte'));
    return {
      nivelFixo: Number.isFinite(nivelSalvo) ? nivelSalvo : 0,
      abertos: new Set(),
      horizonteDias: horizSalvo != null ? (horizSalvo === 'null' ? null : Number(horizSalvo)) : 30,
    };
  })();

  // Prefs remotas (users/{uid}.dashboardArvorePrefs.suprimentos) — Firestore
  // manda; localStorage é só cache instantâneo da mesma máquina.
  function aplicarPrefsRemotas(prefs) {
    const p = prefs?.suprimentos;
    if (!p) return;
    if (typeof p.nivelFixo === 'number') _st.nivelFixo = p.nivelFixo;
    if ('horizonteDias' in p) _st.horizonteDias = p.horizonteDias;
    localStorage.setItem(_chaveLS('nivel'), String(_st.nivelFixo));
    localStorage.setItem(_chaveLS('horizonte'), String(_st.horizonteDias));
  }
  let _salvarTimer = null;
  function _salvarPrefsRemotas() {
    clearTimeout(_salvarTimer);
    _salvarTimer = setTimeout(async () => {
      const uid = Auth.getUid();
      if (!uid) return;
      try {
        await Database.atualizarRaiz('users', uid, {
          dashboardArvorePrefs: { suprimentos: { nivelFixo: _st.nivelFixo, horizonteDias: _st.horizonteDias } },
        });
      } catch (e) { /* preferência de UI — falha silenciosa */ }
    }, 900);
  }

  // ---------- Filtros ----------
  function _proximaFiltro(t) { return !(Number(t.percentualConcluido) > 0); }
  function _statusSuprimento(tarefaId) {
    const doc = (_ctx?.suprimentos || []).find(s => s.tarefaId === tarefaId || s.id === tarefaId);
    if (!doc || !doc.etapas) return 'sem_doc';
    const tocada = Object.values(doc.etapas).some(e => e && e.status && e.status !== 'nao_iniciado');
    return tocada ? 'iniciado' : 'nao_iniciado';
  }
  function _pendenteFiltro(t) {
    if (_fEquipe && String(_eqMap.get(t.id) || '') !== _fEquipe) return false;
    return _proximaFiltro(t) && !!t.inicioPlanejado && _statusSuprimento(t.id) !== 'iniciado';
  }
  function _dentroHorizonte(data) {
    if (_st.horizonteDias == null) return true;
    if (!data) return true;
    const limite = new Date(); limite.setHours(0, 0, 0, 0); limite.setDate(limite.getDate() + _st.horizonteDias);
    return new Date(data) <= limite;
  }

  function _resumoNo(no, sorted) {
    const folhas = DashCore.folhasDescendentes(no, sorted)
      .filter(_pendenteFiltro)
      .filter(t => _dentroHorizonte(t.inicioPlanejado));
    if (!folhas.length) return null;
    let somaPeso = 0, somaConc = 0, dataMaisProxima = null;
    folhas.forEach(t => {
      const p = DashCore.peso(t);
      somaPeso += p;
      somaConc += Math.min(100, Number(t.percentualConcluido) || 0) * p;
      const d = t.inicioPlanejado ? new Date(t.inicioPlanejado) : null;
      if (d && (!dataMaisProxima || d < dataMaisProxima)) dataMaisProxima = d;
    });
    return { qtd: folhas.length, percMedio: somaPeso ? somaConc / somaPeso : 0, dataMaisProxima };
  }

  function _noAberto(t) {
    if ((t.nivel || 0) < _st.nivelFixo) return true;
    return _st.abertos.has(t.id);
  }

  // ---------- Render ----------
  const HORIZONTES = [
    { dias: 7, label: '7 dias' }, { dias: 30, label: '1 mês' }, { dias: 60, label: '2 meses' }, { dias: 90, label: '3 meses' },
    { dias: 180, label: '6 meses' }, { dias: 365, label: '1 ano' }, { dias: null, label: 'Tudo' },
  ];

  function render(ctx) {
    _ctx = ctx;
    const host = document.getElementById('db-suprimentos-dash');
    if (!host) return;

    const sorted = [...ctx.tarefas].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    // "Nível N" = profundidade pré-expandida, não filtro (ver DashAtividades).
    const nivelMin = sorted.reduce((m, t) => Math.min(m, t.nivel || 0), 99);
    const raizes = sorted.filter(t => (t.nivel || 0) === (Number.isFinite(nivelMin) ? nivelMin : 0));
    const max = sorted.reduce((m, t) => Math.max(m, t.nivel || 0), 0);

    const linhaFolha = (t, indent) => `
      <div class="db-sup-item" style="padding-left:${indent}px;">
        <span class="db-sup-flag">📦</span>
        <div class="db-sup-info">
          <div class="db-sup-nome">${DashCore.eqBadge(_eqMap.get(t.id))} ${DashCore.esc(t.nome || 'Sem nome')}</div>
          <div class="db-sup-sub">${t.local ? DashCore.esc(t.local) + ' · ' : ''}início ${Utils.formatarData(t.inicioPlanejado)}</div>
        </div>
        <span class="db-chip db-chip-alerta">providenciar</span>
      </div>`;

    const linhaGrupo = (t, resumo, aberto, indent) => `
      <div class="db-sup-item db-sup-grupo" style="padding-left:${indent}px;" onclick="DashSuprimentos.toggleNo('${t.id}')">
        <span class="db-sup-seta">${aberto ? '▾' : '▸'}</span>
        <div class="db-sup-info">
          <div class="db-sup-nome">${DashCore.esc(t.nome || 'Sem nome')} <span class="db-sup-qtd">${resumo.qtd}</span></div>
          ${aberto ? '' : `<div class="db-sup-sub">${resumo.dataMaisProxima ? 'início mais próximo ' + Utils.formatarData(resumo.dataMaisProxima) : 'sem data'}</div>`}
        </div>
      </div>`;

    const renderNivel = (nos, indent) => {
      let html = '';
      nos.forEach(t => {
        const filhos = DashCore.filhosDiretos(t, sorted);
        if (!filhos.length) {
          if (_pendenteFiltro(t) && _dentroHorizonte(t.inicioPlanejado)) html += linhaFolha(t, indent);
          return;
        }
        const resumo = _resumoNo(t, sorted);
        if (!resumo) return;
        const aberto = _noAberto(t);
        html += linhaGrupo(t, resumo, aberto, indent);
        if (aberto) html += renderNivel(filhos, indent + 16);
      });
      return html;
    };

    const modoGrupos = _visao === 'grupos';
    const corpo = (modoGrupos ? _renderPorGrupos(sorted, linhaFolha) : renderNivel(raizes, 0)) ||
      '<div class="db-vazio-inline">✅ Nenhuma próxima atividade sem Suprimentos iniciado neste período.</div>';

    let botoesNivel = '';
    for (let n = 0; n <= max; n++) {
      botoesNivel += `<button class="db-pill ${_st.nivelFixo === n ? 'ativo' : ''}" onclick="DashSuprimentos.setNivel(${n})">Nível ${n}</button>`;
    }

    host.innerHTML = `
      <div class="db-sup-toolbar">
        <span class="text-sm text-muted">Próximas atividades cujo pipeline de Suprimentos ainda não foi iniciado</span>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
          <div class="db-pills">
            <button class="db-pill ${!modoGrupos ? 'ativo' : ''}" onclick="DashSuprimentos.setVisao('eap')">EAP</button>
            <button class="db-pill ${modoGrupos ? 'ativo' : ''}" onclick="DashSuprimentos.setVisao('grupos')">Grupos</button>
          </div>
          ${modoGrupos ? '' : `<div class="db-pills">${botoesNivel}</div>`}
          ${_equipesDisponiveis.length ? `
            <select class="form-control" style="max-width:140px;font-size:.74rem;padding:4px 8px;" onchange="DashSuprimentos.setEquipe(this.value)">
              <option value="">👷 Todas equipes</option>
              ${_equipesDisponiveis.map(eq => `<option value="${DashCore.esc(String(eq))}" ${_fEquipe === String(eq) ? 'selected' : ''}>${DashCore.esc(DashCore.eqLabel(eq))}</option>`).join('')}
            </select>` : ''}
          <select class="form-control" style="max-width:120px;font-size:.74rem;padding:4px 8px;" onchange="DashSuprimentos.setHorizonte(this.value)">
            ${HORIZONTES.map(o => `<option value="${o.dias}" ${_st.horizonteDias === o.dias ? 'selected' : ''}>${o.label}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="db-sup-lista">${corpo}</div>`;
  }

  // Visão GRUPOS: Grupo › Subgrupo (mesmos campos e ordem da matriz de
  // frentes), listando as pendências com a data de início.
  function _renderPorGrupos(sorted, linhaFolha) {
    const v = s => String(s || '').trim();
    const folhas = DashCore.folhas(sorted)
      .filter(_pendenteFiltro)
      .filter(t => _dentroHorizonte(t.inicioPlanejado));
    if (!folhas.length) return '';
    const ordG = (window.DashFrentes && DashFrentes.ordGrupo) || ((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
    const ordS = (window.DashFrentes && DashFrentes.ordSubgrupo) || ordG;

    const porGrupo = new Map();
    folhas.forEach(t => {
      const g = v(t.grupo) || 'Sem grupo';
      const sg = v(t.subgrupo);
      if (!porGrupo.has(g)) porGrupo.set(g, new Map());
      const sub = porGrupo.get(g);
      if (!sub.has(sg)) sub.set(sg, []);
      sub.get(sg).push(t);
    });
    const grupos = [...porGrupo.keys()].sort((a, b) => {
      if (a === 'Sem grupo') return 1;
      if (b === 'Sem grupo') return -1;
      return ordG(a, b);
    });

    // Tudo ABERTO, plano e limpo — faixa do grupo, subtítulo do subgrupo.
    let html = '';
    grupos.forEach(g => {
      const sub = porGrupo.get(g);
      const qtd = [...sub.values()].reduce((s, ts) => s + ts.length, 0);
      html += `<div class="db-grp-faixa">${DashCore.esc(g)} <span class="db-sup-qtd">${qtd}</span></div>`;
      const sgs = [...sub.keys()].sort((a, b) => {
        if (a === '') return -1;
        if (b === '') return 1;
        return ordS(a, b);
      });
      sgs.forEach(sg => {
        const ts = sub.get(sg).sort((a, b) => (a.inicioPlanejado || '9999').localeCompare(b.inicioPlanejado || '9999'));
        if (sg !== '') html += `<div class="db-grp-sub">${DashCore.esc(sg)} <span class="db-sup-qtd">${ts.length}</span></div>`;
        ts.forEach(t => { html += linhaFolha(t, sg !== '' ? 14 : 4); });
      });
    });
    return html;
  }

  function setVisao(v) {
    _visao = v === 'grupos' ? 'grupos' : 'eap';
    localStorage.setItem('db_visao_suprimentos', _visao);
    if (_ctx) render(_ctx);
  }
  function setEquipe(v) {
    _fEquipe = v;
    if (_ctx) render(_ctx);
  }

  function setNivel(nivel) {
    _st.nivelFixo = nivel;
    _st.abertos = new Set();
    localStorage.setItem(_chaveLS('nivel'), String(nivel));
    _salvarPrefsRemotas();
    if (_ctx) render(_ctx);
  }
  function setHorizonte(valor) {
    _st.horizonteDias = valor === 'null' ? null : Number(valor);
    localStorage.setItem(_chaveLS('horizonte'), String(_st.horizonteDias));
    _salvarPrefsRemotas();
    if (_ctx) render(_ctx);
  }
  function toggleNo(id) {
    if (_st.abertos.has(id)) _st.abertos.delete(id); else _st.abertos.add(id);
    if (_ctx) render(_ctx);
  }

  return { render, aplicarPrefsRemotas, setNivel, setHorizonte, setVisao, setEquipe, toggleNo };
})();
window.DashSuprimentos = DashSuprimentos;

// ============================================
// Dashboard — Andamento por Frente de Trabalho (DashFrentes) — v2
// REESCRITO: agora 100% baseado nos campos do Planejamento, sem nenhuma
// configuração própria. A matriz cruza:
//   VERTICAL (linhas)  → Categoria › Subcategoria
//   HORIZONTAL (colunas) → Grupo › Subgrupo
// Célula = % executado das tarefas naquele cruzamento (média ponderada por
// duração — regra 5.1 do projeto). Clique na célula abre a lista de tarefas
// (início, fim, % de cada uma) com totais embaixo.
// Filtros: Grupo, Subgrupo, Categoria, Subcategoria, Nº Equipe e busca livre.
// ============================================
const DashFrentes = (() => {
  const FAIXAS = { baixo: 30, medio: 70 };
  let _ctx = null;
  let _dados = null; // { linhas, colunas, celulas } do último render (pro detalhe)
  let _filtros = { categoria: '', equipe: '', busca: '' };
  // Visão das COLUNAS: 'grupo' = uma coluna por grupo (resumido);
  // 'subgrupo' = abre os subgrupos (detalhado). Persistida por dispositivo.
  let _visaoCols = localStorage.getItem('db_fr_visao') || 'grupo';

  function _tom(pct, concluida) {
    if (concluida || pct >= 100) return { bg: '#e7f6ec', fg: '#15803d', barra: '#16a34a' };
    if (pct > FAIXAS.medio) return { bg: '#f0f9f1', fg: '#16a34a', barra: '#4ade80' };
    if (pct > FAIXAS.baixo) return { bg: '#fdf8e7', fg: '#a16207', barra: '#eab308' };
    if (pct > 0) return { bg: '#fdf0ef', fg: '#b91c1c', barra: '#ef4444' };
    return { bg: '#f6f6f6', fg: '#9a9a9a', barra: '#d4d4d4' };
  }
  const _v = s => String(s || '').trim();
  const _ordena = (a, b) => a.localeCompare(b, 'pt-BR', { numeric: true });

  // ---------- Render ----------
  // Os FILTROS vivem num container próprio e SÓ são recriados quando as
  // opções mudam (nova categoria/equipe no Planejamento) — snapshot do
  // Firestore re-renderiza apenas a MATRIZ. Era a recriação dos selects a
  // cada gravação remota que fazia o menu "não abrir" no celular.
  let _assinaturaFiltros = '';
  function render(ctx) {
    _ctx = ctx;
    const host = document.getElementById('db-frentes');
    if (!host) return;

    if (!document.getElementById('db-fr-matriz-host')) {
      host.innerHTML = '<div id="db-fr-filtros-host"></div><div id="db-fr-matriz-host"></div>';
      _assinaturaFiltros = '';
    }

    // Só tarefas-FOLHA com categoria E grupo entram na matriz.
    const todas = DashCore.folhas(ctx.tarefas).filter(t => _v(t.categoria) && _v(t.grupo));
    const filtrosHost = document.getElementById('db-fr-filtros-host');
    const matrizHost = document.getElementById('db-fr-matriz-host');

    if (!todas.length) {
      filtrosHost.innerHTML = '';
      _assinaturaFiltros = '';
      matrizHost.innerHTML = `<div class="db-vazio">
        <div class="db-vazio-icone">🏷️</div>
        <div class="db-vazio-titulo">Nenhuma tarefa com Categoria e Grupo ainda</div>
        <div class="db-vazio-sub">Preencha as colunas <b>Categoria</b> e <b>Grupo</b> no <a href="planejamento.html">Planejamento</a> (ou use o Importar Correções / Gerar Grupos) — a matriz de frentes se monta sozinha a partir delas.</div>
      </div>`;
      return;
    }

    // Recria os filtros SÓ se as opções mudaram (assinatura).
    const categorias = [...new Set(todas.map(t => _v(t.categoria)))].sort(_ordena);
    const equipes = [...new Set(todas.map(t => t.equipeAlocada).filter(v => v != null && v !== '' && v !== 0))].sort((a, b) => a - b);
    const temSubgrupos = todas.some(t => _v(t.subgrupo));
    const assinatura = categorias.join('|') + '###' + equipes.join('|') + '###' + temSubgrupos;
    if (assinatura !== _assinaturaFiltros) {
      _assinaturaFiltros = assinatura;
      filtrosHost.innerHTML = _htmlFiltros(categorias, equipes, temSubgrupos);
    }

    // Filtros aplicados às tarefas (a matriz é reconstruída do que sobra).
    const f = _filtros;
    // Busca SEM acento: "gas" acha "Gás", "eletrica" acha "Elétrica" etc.
    const busca = DashCore.normalizarChave(f.busca);
    const tarefas = todas.filter(t =>
      (!f.categoria || _v(t.categoria) === f.categoria) &&
      (!f.equipe || String(t.equipeAlocada || '') === f.equipe) &&
      (!busca || DashCore.normalizarChave(`${t.nome || ''} ${t.categoria || ''} ${t.subcategoria || ''} ${t.grupo || ''} ${t.subgrupo || ''}`).includes(busca))
    );
    matrizHost.innerHTML = tarefas.length
      ? _htmlMatriz(tarefas)
      : '<div class="db-vazio-inline">Nenhuma tarefa com esses filtros.</div>';
    _atualizarBotaoLimpar();
  }

  function _atualizarBotaoLimpar() {
    const btn = document.getElementById('db-fr-limpar');
    if (btn) btn.style.display = (_filtros.categoria || _filtros.equipe || _filtros.busca) ? '' : 'none';
  }

  let _opcoesFiltros = { categorias: [], equipes: [], temSubgrupos: false };
  function _htmlFiltros(categorias, equipes, temSubgrupos) {
    _opcoesFiltros = { categorias, equipes, temSubgrupos };
    const f = _filtros;
    const btn = (campo, rotulo, valorLabel, desabilitado, hint) => `
      <div class="db-fr-fgrupo">
        <span>${rotulo}</span>
        <button type="button" class="db-fr-fbtn" id="db-fr-fbtn-${campo}" ${desabilitado ? `disabled title="${hint}"` : ''} onclick="DashFrentes.abrirMenu('${campo}')">
          <b>${DashCore.esc(valorLabel)}</b><span class="db-fr-fbtn-seta">▾</span>
        </button>
      </div>`;
    return `
      <div class="db-fr-filtros">
        ${btn('visao', 'Colunas', _visaoCols === 'subgrupo' ? 'Subgrupos (detalhado)' : 'Grupos (resumido)', !temSubgrupos, 'Não há subgrupos no Planejamento')}
        ${btn('categoria', 'Categoria', f.categoria || 'Todas')}
        ${btn('equipe', 'Equipe', f.equipe ? 'Equipe ' + f.equipe : 'Todas', !equipes.length, 'Preencha a coluna Nº Equipe no Planejamento')}
        <div class="db-fr-fgrupo" style="flex:1;min-width:160px;">
          <span>Buscar</span>
          <input type="text" class="form-control" placeholder="🔎 tarefa, grupo, categoria..." value="${DashCore.esc(f.busca)}" oninput="DashFrentes.setBusca(this.value)">
        </div>
        <button id="db-fr-limpar" class="btn btn-secundario btn-sm" style="align-self:end;display:none;" onclick="DashFrentes.limparFiltros()">✕ Limpar</button>
      </div>`;
  }

  // Painel de opções (overlay) — mesmo mecanismo do detalhe de célula, que
  // funciona em qualquer aparelho. Nada de <select> nativo.
  function abrirMenu(campo) {
    const o = _opcoesFiltros;
    let titulo = '', opcoes = [];
    if (campo === 'visao') {
      titulo = 'Colunas da tabela';
      opcoes = [
        { v: 'grupo', label: 'Grupos (resumido)', sel: _visaoCols === 'grupo' },
        { v: 'subgrupo', label: 'Subgrupos (detalhado)', sel: _visaoCols === 'subgrupo' },
      ];
    } else if (campo === 'categoria') {
      titulo = 'Filtrar por Categoria';
      opcoes = [{ v: '', label: 'Todas as categorias', sel: !_filtros.categoria }]
        .concat(o.categorias.map(cat => ({ v: cat, label: cat, sel: _filtros.categoria === cat })));
    } else if (campo === 'equipe') {
      titulo = 'Filtrar por Equipe';
      opcoes = [{ v: '', label: 'Todas as equipes', sel: !_filtros.equipe }]
        .concat(o.equipes.map(eq => ({ v: String(eq), label: 'Equipe ' + eq, sel: _filtros.equipe === String(eq) })));
    }
    let overlay = document.getElementById('db-fr-menu-overlay');
    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.id = 'db-fr-menu-overlay';
    overlay.className = 'db-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
      <div class="db-overlay-card" style="max-width:380px;padding:14px 14px 10px;">
        <div class="db-overlay-titulo" style="margin-bottom:10px;">${titulo}</div>
        <div class="db-fr-menu-lista">
          ${opcoes.map(op => `
            <div class="db-fr-menu-item ${op.sel ? 'sel' : ''}" onclick="DashFrentes.escolherOpcao('${campo}', '${String(op.v).replace(/'/g, "\\'")}')">
              ${DashCore.esc(op.label)} ${op.sel ? '<span style="margin-left:auto;">✓</span>' : ''}
            </div>`).join('')}
        </div>
      </div>`;
    document.body.appendChild(overlay);
  }
  function escolherOpcao(campo, valor) {
    const overlay = document.getElementById('db-fr-menu-overlay');
    if (overlay) overlay.remove();
    if (campo === 'visao') {
      _visaoCols = valor === 'subgrupo' ? 'subgrupo' : 'grupo';
      localStorage.setItem('db_fr_visao', _visaoCols);
    } else {
      _filtros[campo] = valor;
    }
    _assinaturaFiltros = ''; // rótulos dos botões precisam refletir a escolha
    if (_ctx) render(_ctx);
  }

  function _htmlMatriz(tarefas) {
    // COLUNAS conforme o seletor "Colunas": por Grupo (resumido — uma coluna
    // por grupo somando os subgrupos) ou por Subgrupo (detalhado).
    const detalhado = _visaoCols === 'subgrupo';
    const gruposMap = new Map();
    tarefas.forEach(t => {
      const g = _v(t.grupo), sg = detalhado ? _v(t.subgrupo) : '';
      if (!gruposMap.has(g)) gruposMap.set(g, new Set());
      gruposMap.get(g).add(sg);
    });
    const colunas = [];
    [...gruposMap.keys()].sort(_ordena).forEach(g => {
      const sgs = [...gruposMap.get(g)].sort(_ordena);
      sgs.forEach((sg, i) => colunas.push({ grupo: g, subgrupo: sg, fimGrupo: i === sgs.length - 1 }));
    });

    // LINHAS: Categoria › Subcategoria, ORDENADAS PELA DATA DE EXECUÇÃO —
    // o conjunto que começa antes no cronograma aparece primeiro (empate:
    // ordem alfabética).
    const catsMap = new Map();
    const minInicio = new Map(); // chave cat|||sub -> timestamp do início mais cedo
    const minInicioCat = new Map();
    tarefas.forEach(t => {
      const c = _v(t.categoria), sc = _v(t.subcategoria);
      if (!catsMap.has(c)) catsMap.set(c, new Set());
      catsMap.get(c).add(sc);
      const ini = t.inicioPlanejado ? new Date(t.inicioPlanejado).getTime() : Infinity;
      const k = c + '|||' + sc;
      if (ini < (minInicio.get(k) ?? Infinity)) minInicio.set(k, ini);
      if (ini < (minInicioCat.get(c) ?? Infinity)) minInicioCat.set(c, ini);
    });
    const linhas = [];
    [...catsMap.keys()]
      .sort((a, b) => (minInicioCat.get(a) ?? Infinity) - (minInicioCat.get(b) ?? Infinity) || _ordena(a, b))
      .forEach(c => {
        [...catsMap.get(c)]
          .sort((a, b) => (minInicio.get(c + '|||' + a) ?? Infinity) - (minInicio.get(c + '|||' + b) ?? Infinity) || _ordena(a, b))
          .forEach(sc => linhas.push({ categoria: c, subcategoria: sc }));
      });

    // CÉLULAS
    const celulas = linhas.map(l => colunas.map(col => {
      const ts = tarefas.filter(t =>
        _v(t.categoria) === l.categoria && _v(t.subcategoria) === l.subcategoria &&
        _v(t.grupo) === col.grupo && (!detalhado || _v(t.subgrupo) === col.subgrupo));
      if (!ts.length) return null;
      let sp = 0, sc2 = 0;
      ts.forEach(t => { const p = DashCore.peso(t); sp += p; sc2 += Math.min(100, Number(t.percentualConcluido) || 0) * p; });
      return { pct: sp ? sc2 / sp : 0, tarefas: ts };
    }));
    _dados = { linhas, colunas, celulas };

    // % geral da linha (todas as tarefas da linha, com qualquer grupo)
    const geralLinha = linhas.map(l => {
      const ts = tarefas.filter(t => _v(t.categoria) === l.categoria && _v(t.subcategoria) === l.subcategoria);
      let sp = 0, sc2 = 0;
      ts.forEach(t => { const p = DashCore.peso(t); sp += p; sc2 += Math.min(100, Number(t.percentualConcluido) || 0) * p; });
      return sp ? sc2 / sp : 0;
    });

    // Cabeçalho: linha 1 = grupos (colspan), linha 2 = subgrupos
    const gruposHeader = [];
    colunas.forEach(c => {
      const ult = gruposHeader[gruposHeader.length - 1];
      if (ult && ult.nome === c.grupo) ult.span++;
      else gruposHeader.push({ nome: c.grupo, span: 1 });
    });
    const temSubgrupo = colunas.some(c => c.subgrupo);
    const headGrupos = `<tr class="db-fr-htorre"><th class="db-fr-sticky"></th>${gruposHeader.map(g => `<th colspan="${g.span}">${DashCore.esc(g.nome)}</th>`).join('')}<th class="db-fr-hgeral" ${temSubgrupo ? 'rowspan="2"' : ''}>Geral</th></tr>`;
    const headSub = temSubgrupo
      ? `<tr class="db-fr-hcol"><th class="db-fr-sticky">Categoria</th>${colunas.map(c => `<th class="${c.fimGrupo ? 'db-fr-fimgrupo' : ''}"><div class="db-fr-hcol-main">${DashCore.esc(c.subgrupo || '—')}</div></th>`).join('')}</tr>`
      : '';
    // Sem subgrupos: rótulo "Categoria" na própria linha de grupos
    const headSemSub = !temSubgrupo ? headGrupos.replace('<th class="db-fr-sticky"></th>', '<th class="db-fr-sticky">Categoria</th>') : headGrupos;

    // Corpo: separador por categoria + sublinhas
    let corpo = '';
    let catAtual = null;
    linhas.forEach((l, li) => {
      const multiSub = catsMap.get(l.categoria).size > 1 || l.subcategoria;
      if (l.categoria !== catAtual && multiSub) {
        catAtual = l.categoria;
        corpo += `<tr class="db-fr-catrow"><td class="db-fr-catnome" colspan="${colunas.length + 2}"><span class="db-fr-catlabel">${DashCore.esc(l.categoria)}</span></td></tr>`;
      } else if (l.categoria !== catAtual) {
        catAtual = l.categoria;
      }
      const rotulo = multiSub ? (l.subcategoria || '(sem subcategoria)') : l.categoria;
      const cels = celulas[li].map((cel, ci) => {
        const fimCls = _dados.colunas[ci].fimGrupo ? ' db-fr-fimgrupo' : '';
        if (!cel) return `<td class="db-fr-cel-vazia${fimCls}"></td>`;
        const pct = Math.round(cel.pct);
        const tom = _tom(pct, pct >= 100);
        return `<td class="db-fr-cel${fimCls}" style="background:${tom.bg};" onclick="DashFrentes.abrirDetalhe(${li},${ci})" title="${DashCore.esc(rotulo)} × ${DashCore.esc(_dados.colunas[ci].grupo)}${_dados.colunas[ci].subgrupo ? ' › ' + DashCore.esc(_dados.colunas[ci].subgrupo) : ''} — ${pct}% (${cel.tarefas.length} tarefa${cel.tarefas.length > 1 ? 's' : ''})">
          <div class="db-fr-cel-pct" style="color:${tom.fg};">${pct >= 100 ? '✓' : pct + '%'}</div>
          <div class="db-fr-cel-barra"><i style="width:${Math.min(100, pct)}%;background:${tom.barra};"></i></div>
        </td>`;
      }).join('');
      const tomG = _tom(Math.round(geralLinha[li]), geralLinha[li] >= 100);
      corpo += `<tr>
        <td class="db-fr-sticky db-fr-nome ${multiSub ? 'db-fr-subnome' : ''}">${DashCore.esc(rotulo)}</td>
        ${cels}
        <td class="db-fr-cel db-fr-geral" style="background:${tomG.bg};color:${tomG.fg};">${Math.round(geralLinha[li])}%</td>
      </tr>`;
    });

    return `
      <div class="db-fr-scroll">
        <table class="db-fr-tabela">
          <thead>${headSemSub}${headSub}</thead>
          <tbody>${corpo}</tbody>
        </table>
      </div>
      <div class="db-fr-rodape">
        <div class="db-legenda">
          <span><i style="background:#ef4444;"></i> até ${FAIXAS.baixo}%</span>
          <span><i style="background:#eab308;"></i> ${FAIXAS.baixo + 1}–${FAIXAS.medio}%</span>
          <span><i style="background:#16a34a;"></i> acima de ${FAIXAS.medio}%</span>
          <span><i style="background:#e7f6ec;border:1px solid #16a34a;"></i> ✓ concluída</span>
        </div>
        <span class="db-fr-fonte">Linhas = Categoria › Subcategoria · Colunas = Grupo › Subgrupo (do Planejamento) · clique na célula pra ver as tarefas</span>
      </div>`;
  }

  // ---------- Filtros ----------
  function setFiltro(campo, valor) {
    _filtros[campo] = valor;
    if (_ctx) render(_ctx);
  }
  function setVisao(v) {
    _visaoCols = v === 'subgrupo' ? 'subgrupo' : 'grupo';
    localStorage.setItem('db_fr_visao', _visaoCols);
    if (_ctx) render(_ctx);
  }
  let _buscaTimer = null;
  function setBusca(texto) {
    clearTimeout(_buscaTimer);
    _buscaTimer = setTimeout(() => {
      _filtros.busca = texto;
      // Só a MATRIZ re-renderiza — o campo de busca não é recriado, o foco
      // e o teclado do celular ficam onde estão.
      if (_ctx) render(_ctx);
    }, 300);
  }
  function limparFiltros() {
    _filtros = { categoria: '', equipe: '', busca: '' };
    _assinaturaFiltros = ''; // força recriar os selects zerados
    if (_ctx) render(_ctx);
  }

  // ---------- Detalhe da célula ----------
  function abrirDetalhe(li, ci) {
    if (!_dados) return;
    const linha = _dados.linhas[li];
    const col = _dados.colunas[ci];
    const cel = _dados.celulas[li]?.[ci];
    if (!cel) return;

    const ts = [...cel.tarefas].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    let sp = 0, sc = 0, fimMax = null, iniMin = null;
    ts.forEach(t => {
      const p = DashCore.peso(t);
      sp += p; sc += Math.min(100, Number(t.percentualConcluido) || 0) * p;
      if (t.terminoPlanejado) { const d = new Date(t.terminoPlanejado); if (!fimMax || d > fimMax) fimMax = d; }
      if (t.inicioPlanejado) { const d = new Date(t.inicioPlanejado); if (!iniMin || d < iniMin) iniMin = d; }
    });
    const pctMedia = sp ? sc / sp : 0;
    const tomT = _tom(Math.round(pctMedia), pctMedia >= 100);

    let overlay = document.getElementById('db-fr-detalhe-overlay');
    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.id = 'db-fr-detalhe-overlay';
    overlay.className = 'db-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
      <div class="db-overlay-card" style="max-width:560px;">
        <div class="db-overlay-titulo">${DashCore.esc(linha.categoria)}${linha.subcategoria ? ' › ' + DashCore.esc(linha.subcategoria) : ''}</div>
        <div class="db-overlay-sub">${DashCore.esc(col.grupo)}${col.subgrupo ? ' › ' + DashCore.esc(col.subgrupo) : ''} — ${ts.length} tarefa${ts.length > 1 ? 's' : ''}</div>
        ${ts.map(t => {
          const pct = Math.round(Number(t.percentualConcluido) || 0);
          const tom = _tom(pct, pct >= 100);
          return `<div class="db-fr-det-item">
            <div class="db-fr-det-info">
              <div class="db-fr-det-nome">${DashCore.esc(t.nome || 'Sem nome')}</div>
              <div class="db-fr-det-sub">${Utils.formatarData(t.inicioPlanejado)} → ${Utils.formatarData(t.terminoPlanejado)}${t.equipeAlocada ? ' · equipe ' + t.equipeAlocada : ''}</div>
              <div class="db-fr-cel-barra" style="margin-top:4px;"><i style="width:${Math.min(100, pct)}%;background:${tom.barra};"></i></div>
            </div>
            <div class="db-fr-det-pct" style="color:${tom.fg};">${pct >= 100 ? '✓' : pct + '%'}</div>
          </div>`;
        }).join('')}
        <div class="db-fr-det-total">
          <div>
            <div style="font-weight:800;">TOTAL — ${ts.length} tarefa${ts.length > 1 ? 's' : ''}</div>
            <div class="db-fr-det-sub">${iniMin ? Utils.formatarData(iniMin) : '—'} → ${fimMax ? Utils.formatarData(fimMax) : '—'} (fim mais tardio)</div>
          </div>
          <div class="db-fr-det-pct" style="color:${tomT.fg};font-size:1.05rem;">${Math.round(pctMedia)}%</div>
        </div>
        <button class="btn btn-secundario btn-sm" style="width:100%;margin-top:12px;" onclick="document.getElementById('db-fr-detalhe-overlay').remove()">Fechar</button>
      </div>`;
    document.body.appendChild(overlay);
  }

  return { render, setFiltro, setVisao, setBusca, limparFiltros, abrirDetalhe, abrirMenu, escolherOpcao };
})();
window.DashFrentes = DashFrentes;

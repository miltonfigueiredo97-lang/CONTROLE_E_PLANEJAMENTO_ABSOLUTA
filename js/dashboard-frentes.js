// ============================================
// Dashboard — Andamento por Frente de Trabalho (DashFrentes)
// A visão central do Dashboard: linha = frente/serviço (nome amigável),
// coluna = pavimento ou apartamento (da Estrutura da Obra do Planejamento),
// célula = % agregado (peso por duração) das tarefas naquele cruzamento.
//
// AUTO-CONFIGURAÇÃO: se não existe config manual (config/dashboardPainel),
// as linhas são geradas automaticamente do Planejamento — cada grupo que é
// pai direto de folhas com vínculo de local vira uma frente, com o nome do
// próprio grupo. Grupos de mesmo nome (ex: "Alvenaria" em 2 torres) são
// mesclados numa linha só. Enquanto a config estiver em modo automático
// (auto:true), ela se atualiza sozinha a cada carregamento — configura a
// obra uma vez no Planejamento e o Dashboard se monta sozinho.
// ============================================
const DashFrentes = (() => {
  const FAIXAS = { baixo: 30, medio: 70 }; // 0-30 / 31-70 / 71-100
  let _ctx = null;
  let _modo = localStorage.getItem('db_painel_modo') || 'pavimento'; // 'pavimento' | 'apartamento'
  let _linhasConfig = [];
  let _configAuto = true; // true = gerada do Planejamento; false = editada manualmente
  let _estrutura = null;
  let _dados = null; // cache do último cálculo (popover de detalhe)

  // ---------- Cores por faixa (tons pensados, não saturados) ----------
  function _tom(pct, concluida) {
    if (concluida || pct >= 100) return { bg: '#e7f6ec', fg: '#15803d', barra: '#16a34a' };
    if (pct > FAIXAS.medio) return { bg: '#f0f9f1', fg: '#16a34a', barra: '#4ade80' };
    if (pct > FAIXAS.baixo) return { bg: '#fdf8e7', fg: '#a16207', barra: '#eab308' };
    if (pct > 0) return { bg: '#fdf0ef', fg: '#b91c1c', barra: '#ef4444' };
    return { bg: '#f6f6f6', fg: '#9a9a9a', barra: '#d4d4d4' };
  }
  function _statusCelula(ts) {
    if (ts.every(t => t.status === 'finalizada' || (Number(t.percentualConcluido) || 0) >= 100)) return 'finalizada';
    if (ts.every(t => t.status === 'pausada')) return 'pausada';
    return 'andamento';
  }

  // ---------- Auto-configuração ----------
  // Linhas candidatas = grupos que são pai direto de ≥1 folha com
  // vinculoEstrutura. Mescla por nome normalizado (mesmo serviço em torres
  // diferentes vira uma linha só).
  function _gerarLinhasAuto(sorted) {
    const porNome = new Map(); // nomeNorm -> { nome, tarefaIds:Set }
    DashCore.folhas(sorted)
      .filter(t => (t.vinculoEstrutura || []).length)
      .forEach(f => {
        const pai = DashCore.paiDireto(f, sorted);
        if (!pai) return;
        const chave = DashCore.normalizarChave(pai.nome || '');
        if (!chave) return;
        if (!porNome.has(chave)) porNome.set(chave, { nome: (pai.nome || '').trim(), tarefaIds: new Set() });
        porNome.get(chave).tarefaIds.add(pai.id);
      });
    // Ordena pela posição da primeira tarefa-mãe no planejamento — mantém a
    // ordem natural da EAP, sem o usuário precisar ordenar nada.
    const posPorId = new Map(sorted.map((t, i) => [t.id, i]));
    return [...porNome.values()]
      .map(l => ({ id: 'auto_' + DashCore.normalizarChave(l.nome).replace(/\s+/g, '_'), nome: l.nome, tarefaIds: [...l.tarefaIds] }))
      .sort((a, b) => Math.min(...a.tarefaIds.map(id => posPorId.get(id) ?? 1e9)) - Math.min(...b.tarefaIds.map(id => posPorId.get(id) ?? 1e9)));
  }

  // ---------- Render principal ----------
  async function render(ctx) {
    _ctx = ctx;
    const host = document.getElementById('db-frentes');
    if (!host) return;
    try {
      const [cfgPainel, estrutura] = await Promise.all([
        Database.obter(ctx.obraId, 'config', 'dashboardPainel').catch(() => null),
        Database.obter(ctx.obraId, 'config', 'estruturaObra').catch(() => null),
      ]);
      _estrutura = estrutura || { torres: [] };
      const sorted = [...ctx.tarefas].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

      // Config manual existente e válida → respeita. Senão → modo automático.
      _configAuto = !cfgPainel || cfgPainel.auto !== false || !(cfgPainel.linhas || []).length;
      _linhasConfig = _configAuto ? _gerarLinhasAuto(sorted) : (cfgPainel.linhas || []);

      const toggle = document.getElementById('db-painel-toggle');
      if (toggle) toggle.querySelectorAll('.aba-btn').forEach(b => b.classList.toggle('ativo', b.dataset.v === _modo));

      if (!_estrutura.torres || !_estrutura.torres.length) {
        host.innerHTML = `<div class="db-vazio">
          <div class="db-vazio-icone">🏢</div>
          <div class="db-vazio-titulo">Estrutura da Obra ainda não cadastrada</div>
          <div class="db-vazio-sub">Cadastre torres, pavimentos e apartamentos uma única vez em <a href="planejamento.html">Planejamento → 🏢 Estrutura da Obra</a>. Depois disso, esta visão se monta sozinha.</div>
        </div>`;
        return;
      }
      if (!_linhasConfig.length) {
        host.innerHTML = `<div class="db-vazio">
          <div class="db-vazio-icone">🔗</div>
          <div class="db-vazio-titulo">Nenhuma tarefa vinculada a um local ainda</div>
          <div class="db-vazio-sub">Use o <b>Auto-vincular</b> (ou a coluna Local Pav/Apto) no Planejamento — as frentes de trabalho aparecem aqui automaticamente, com o nome do grupo da tarefa.</div>
        </div>`;
        return;
      }

      const linhasValidas = _linhasConfig
        .map(l => ({ ...l, maes: (l.tarefaIds || []).map(id => sorted.find(t => t.id === id)).filter(Boolean) }))
        .filter(l => l.maes.length);
      if (!linhasValidas.length) {
        host.innerHTML = '<div class="db-vazio"><div class="db-vazio-sub">As tarefas vinculadas às frentes configuradas não existem mais no Planejamento — reconfigure em "⚙️ Configurar".</div></div>';
        return;
      }

      // Colunas (pavimentos, ou pavimento+apto no modo apartamento)
      const colunas = [];
      [...(_estrutura.torres || [])].sort((a, b) => (a.ordem || 0) - (b.ordem || 0)).forEach(torre => {
        [...(torre.pavimentos || [])].sort((a, b) => (a.ordem || 0) - (b.ordem || 0)).forEach(pav => {
          if (_modo === 'pavimento' || !(pav.apartamentos || []).length) {
            colunas.push({ label: pav.nome, torre: torre.nome, torreId: torre.id, pavimentoId: pav.id, apartamentoId: null });
          } else {
            [...pav.apartamentos].sort((a, b) => (a.ordem || 0) - (b.ordem || 0)).forEach(apto => {
              colunas.push({ label: apto.nome, sub: pav.nome, torre: torre.nome, torreId: torre.id, pavimentoId: pav.id, apartamentoId: apto.id });
            });
          }
        });
      });

      const dados = linhasValidas.map(linha => {
        const folhasDaLinha = linha.maes.flatMap(mae => DashCore.folhasDescendentes(mae, sorted));
        const celulas = colunas.map(col => {
          const ts = folhasDaLinha.filter(t => (t.vinculoEstrutura || []).some(v => {
            if (v.pavimentoId !== col.pavimentoId) return false;
            if (!col.apartamentoId) return true;
            return !v.apartamentoId || v.apartamentoId === col.apartamentoId;
          }));
          if (!ts.length) return null;
          let somaPeso = 0, somaConc = 0;
          ts.forEach(t => {
            const p = DashCore.peso(t); // peso por duração — regra 5.1
            somaPeso += p;
            somaConc += Math.min(100, Number(t.percentualConcluido) || 0) * p;
          });
          return { percentual: somaPeso ? somaConc / somaPeso : 0, status: _statusCelula(ts), tarefas: ts };
        });
        // % geral da frente (todas as folhas, com ou sem vínculo)
        let sp = 0, sc = 0;
        folhasDaLinha.forEach(t => { const p = DashCore.peso(t); sp += p; sc += Math.min(100, Number(t.percentualConcluido) || 0) * p; });
        return { nome: linha.nome, percGeral: sp ? sc / sp : 0, celulas };
      });
      _dados = { dados, colunas };
      host.innerHTML = _html(dados, colunas);
    } catch (e) {
      console.error(e);
      host.innerHTML = '<div class="db-vazio"><div class="db-vazio-sub">Erro ao carregar o andamento por frente.</div></div>';
    }
  }

  function _html(dados, colunas) {
    // Cabeçalho agrupado por torre (linha 1) e coluna (linha 2)
    const torres = [];
    colunas.forEach(c => {
      const ult = torres[torres.length - 1];
      if (ult && ult.nome === c.torre) ult.span++;
      else torres.push({ nome: c.torre, span: 1 });
    });
    const multiTorre = torres.length > 1;

    const headTorres = multiTorre
      ? `<tr class="db-fr-htorre"><th class="db-fr-sticky"></th>${torres.map(t => `<th colspan="${t.span}">${DashCore.esc(t.nome)}</th>`).join('')}<th class="db-fr-hgeral" rowspan="2">Geral</th></tr>`
      : '';
    const headCols = `<tr class="db-fr-hcol"><th class="db-fr-sticky">Frente de trabalho</th>${colunas.map(c =>
      `<th><div class="db-fr-hcol-main">${DashCore.esc(c.label)}</div>${c.sub ? `<div class="db-fr-hcol-sub">${DashCore.esc(c.sub)}</div>` : ''}</th>`).join('')}${multiTorre ? '' : '<th class="db-fr-hgeral">Geral</th>'}</tr>`;

    const corpo = dados.map((linha, li) => {
      const cels = linha.celulas.map((cel, ci) => {
        if (!cel) return '<td class="db-fr-cel-vazia"></td>';
        const pct = Math.round(cel.percentual);
        const tom = _tom(pct, cel.status === 'finalizada');
        const done = cel.status === 'finalizada' || pct >= 100;
        return `<td class="db-fr-cel${cel.status === 'pausada' ? ' pausada' : ''}" style="background:${tom.bg};" onclick="DashFrentes.abrirDetalhe(${li},${ci})" title="${DashCore.esc(linha.nome)} — ${pct}%">
          <div class="db-fr-cel-pct" style="color:${tom.fg};">${done ? '✓' : pct + '%'}</div>
          <div class="db-fr-cel-barra"><i style="width:${Math.min(100, pct)}%;background:${tom.barra};"></i></div>
        </td>`;
      }).join('');
      const tomG = _tom(Math.round(linha.percGeral), linha.percGeral >= 100);
      return `<tr>
        <td class="db-fr-sticky db-fr-nome">${DashCore.esc(linha.nome)}</td>
        ${cels}
        <td class="db-fr-cel db-fr-geral" style="background:${tomG.bg};color:${tomG.fg};">${Math.round(linha.percGeral)}%</td>
      </tr>`;
    }).join('');

    return `
      <div class="db-fr-scroll">
        <table class="db-fr-tabela">
          <thead>${headTorres}${headCols}</thead>
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
        <span class="db-fr-fonte">${_configAuto ? '✨ Frentes geradas automaticamente do Planejamento' : '⚙️ Frentes configuradas manualmente'} · clique numa célula pra ver as tarefas</span>
      </div>`;
  }

  function setModo(modo) {
    _modo = modo;
    localStorage.setItem('db_painel_modo', modo);
    if (_ctx) render(_ctx);
  }

  // ---------- Detalhe da célula ----------
  function abrirDetalhe(li, ci) {
    if (!_dados) return;
    const linha = _dados.dados[li];
    const cel = linha?.celulas[ci];
    if (!cel) return;
    const col = _dados.colunas[ci];
    let overlay = document.getElementById('db-fr-detalhe-overlay');
    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.id = 'db-fr-detalhe-overlay';
    overlay.className = 'db-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    const tomTitulo = _tom(Math.round(cel.percentual), cel.status === 'finalizada');
    overlay.innerHTML = `
      <div class="db-overlay-card" style="max-width:520px;">
        <div class="db-overlay-titulo">${DashCore.esc(linha.nome)}</div>
        <div class="db-overlay-sub">${DashCore.esc(col.torre || '')}${col.sub ? ' · ' + DashCore.esc(col.sub) : ''} · ${DashCore.esc(col.label)} — <b style="color:${tomTitulo.fg};">${Math.round(cel.percentual)}%</b></div>
        ${cel.tarefas.map(t => {
          const pct = Math.round(Number(t.percentualConcluido) || 0);
          const tom = _tom(pct, pct >= 100);
          return `<div class="db-fr-det-item">
            <div class="db-fr-det-info">
              <div class="db-fr-det-nome">${DashCore.esc(t.nome || 'Sem nome')}</div>
              <div class="db-fr-det-sub">${t.duracao || 1}d · ${t.status || 'em andamento'}${t.terminoPlanejado ? ' · término ' + Utils.formatarData(t.terminoPlanejado) : ''}</div>
              <div class="db-fr-cel-barra" style="margin-top:4px;"><i style="width:${Math.min(100, pct)}%;background:${tom.barra};"></i></div>
            </div>
            <div class="db-fr-det-pct" style="color:${tom.fg};">${pct >= 100 ? '✓' : pct + '%'}</div>
          </div>`;
        }).join('')}
        <button class="btn btn-secundario btn-sm" style="width:100%;margin-top:12px;" onclick="document.getElementById('db-fr-detalhe-overlay').remove()">Fechar</button>
      </div>`;
    document.body.appendChild(overlay);
  }

  // ---------- Configuração manual (opcional) ----------
  let _cfgAbertos = new Set();
  let _cfgLinhas = [];
  let _cfgLinhaAtiva = null;

  function abrirConfig() {
    _cfgAbertos = new Set();
    _cfgLinhaAtiva = null;
    _cfgLinhas = _linhasConfig.map(l => ({ ...l, tarefaIds: [...(l.tarefaIds || [])] }));
    let overlay = document.getElementById('db-frcfg-overlay');
    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.id = 'db-frcfg-overlay';
    overlay.className = 'db-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
      <div class="db-overlay-card" style="max-width:560px;display:flex;flex-direction:column;">
        <div class="db-overlay-titulo">⚙️ Frentes de Trabalho</div>
        <div class="db-overlay-sub">Por padrão as frentes são geradas <b>automaticamente</b> do Planejamento (grupo pai de cada tarefa vinculada). Edite aqui só se quiser nomes ou agrupamentos diferentes — a edição manual desliga a atualização automática.</div>
        <div style="margin-bottom:10px;display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn btn-secundario btn-sm" onclick="DashFrentes.cfgRegerarAuto()">✨ Regerar do Planejamento</button>
          <button class="btn btn-secundario btn-sm" onclick="DashFrentes.cfgVoltarAuto()">↻ Voltar ao automático</button>
        </div>
        <div id="db-frcfg-linhas" style="display:flex;flex-direction:column;gap:8px;"></div>
        <button class="btn btn-secundario btn-sm" style="margin-top:10px;" onclick="DashFrentes.cfgNovaLinha()">+ Nova frente</button>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;border-top:1px solid var(--cor-borda-light);padding-top:12px;">
          <button class="btn btn-secundario btn-sm" onclick="document.getElementById('db-frcfg-overlay').remove()">Cancelar</button>
          <button class="btn btn-primario btn-sm" onclick="DashFrentes.cfgSalvar()">Salvar (modo manual)</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    _renderCfgLinhas();
  }

  function _renderCfgLinhas() {
    const el = document.getElementById('db-frcfg-linhas');
    if (!el) return;
    const sorted = [...(_ctx?.tarefas || [])].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    if (!_cfgLinhas.length) {
      el.innerHTML = '<div class="text-sm text-muted" style="padding:8px 0;">Nenhuma frente — clique em "+ Nova frente" ou "✨ Regerar".</div>';
      return;
    }
    el.innerHTML = _cfgLinhas.map(linha => {
      const vinculadas = (linha.tarefaIds || []).map(id => sorted.find(t => t.id === id)).filter(Boolean);
      const aberto = _cfgLinhaAtiva === linha.id;
      return `
        <div style="border:1px solid var(--cor-borda);border-radius:8px;padding:8px 10px;">
          <div style="display:flex;align-items:center;gap:6px;">
            <input type="text" value="${(linha.nome || '').replace(/"/g, '&quot;')}" placeholder="Nome da frente (ex: Instalações Hidráulicas)"
              class="form-control" style="flex:1;font-size:.82rem;padding:4px 8px;" oninput="DashFrentes.cfgRenomear('${linha.id}', this.value)">
            <button class="btn btn-secundario btn-sm" style="padding:3px 8px;" onclick="DashFrentes.cfgToggleEditor('${linha.id}')">${aberto ? 'Fechar' : (vinculadas.length ? 'Editar' : 'Vincular')}</button>
            <button class="btn btn-secundario btn-sm" style="padding:3px 8px;color:var(--cor-perigo);" onclick="DashFrentes.cfgRemoverLinha('${linha.id}')">🗑</button>
          </div>
          <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px;">
            ${vinculadas.length
              ? vinculadas.map(t => `<span class="db-chip">${DashCore.esc(t.nome || 'Sem nome')}</span>`).join('')
              : '<span class="text-sm text-muted" style="font-size:.72rem;">Nenhuma tarefa vinculada ainda.</span>'}
          </div>
          ${aberto ? `
            <div style="margin-top:8px;border-top:1px solid var(--cor-borda-light);padding-top:8px;">
              <input type="text" placeholder="Buscar grupo de tarefas..." class="form-control" style="margin-bottom:6px;font-size:.8rem;" oninput="DashFrentes.cfgFiltrar(this.value)">
              <div id="db-frcfg-arvore" style="display:flex;flex-direction:column;gap:1px;max-height:260px;overflow-y:auto;"></div>
            </div>` : ''}
        </div>`;
    }).join('');
    if (_cfgLinhaAtiva) _renderCfgArvore();
  }

  function cfgNovaLinha() {
    const id = 'linha_' + Date.now().toString(36);
    _cfgLinhas.push({ id, nome: '', tarefaIds: [] });
    _cfgLinhaAtiva = id;
    _renderCfgLinhas();
  }
  function cfgRenomear(id, nome) {
    const l = _cfgLinhas.find(x => x.id === id);
    if (l) l.nome = nome; // sem re-render — não perder foco do input
  }
  function cfgRemoverLinha(id) {
    _cfgLinhas = _cfgLinhas.filter(l => l.id !== id);
    if (_cfgLinhaAtiva === id) _cfgLinhaAtiva = null;
    _renderCfgLinhas();
  }
  function cfgToggleEditor(id) {
    _cfgLinhaAtiva = _cfgLinhaAtiva === id ? null : id;
    _cfgAbertos = new Set();
    _renderCfgLinhas();
  }
  function cfgRegerarAuto() {
    const sorted = [...(_ctx?.tarefas || [])].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    _cfgLinhas = _gerarLinhasAuto(sorted);
    _cfgLinhaAtiva = null;
    _renderCfgLinhas();
    Utils.toast('Frentes regeradas do Planejamento. "Salvar" grava como manual; pra voltar ao automático de vez, use "Voltar ao automático".', 'sucesso');
  }

  function _renderCfgArvore(filtroTexto) {
    const el = document.getElementById('db-frcfg-arvore');
    if (!el || !_cfgLinhaAtiva) return;
    const sorted = [...(_ctx?.tarefas || [])].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    const filtro = (filtroTexto || '').toLowerCase().trim();
    if (filtro) {
      const candidatas = sorted.filter(t => DashCore.temFilhos(t, sorted) && (t.nome || '').toLowerCase().includes(filtro));
      el.innerHTML = candidatas.length
        ? candidatas.map(t => _cfgLinhaCheckbox(t, 0)).join('')
        : '<div class="text-sm text-muted" style="padding:10px 0;">Nenhum grupo encontrado.</div>';
      return;
    }
    const raizes = sorted.filter(t => (t.nivel || 0) === 0);
    el.innerHTML = _cfgRenderNivel(raizes, sorted, 0) || '<div class="text-sm text-muted">Nenhuma tarefa no Planejamento.</div>';
  }
  function _cfgMarcada(id) {
    const l = _cfgLinhas.find(x => x.id === _cfgLinhaAtiva);
    return l ? (l.tarefaIds || []).includes(id) : false;
  }
  function _cfgLinhaCheckbox(t, indent) {
    return `<label style="display:flex;align-items:center;gap:8px;font-size:.82rem;padding:4px 2px;cursor:pointer;border-radius:4px;" onmouseover="this.style.background='#f7f7f7'" onmouseout="this.style.background='transparent'">
      <input type="checkbox" value="${t.id}" ${_cfgMarcada(t.id) ? 'checked' : ''} onchange="DashFrentes.cfgToggleTarefa('${t.id}', this.checked)">
      <span style="padding-left:${indent}px;">${DashCore.esc(t.nome || 'Sem nome')}</span>
    </label>`;
  }
  function _cfgRenderNivel(nos, sorted, indent) {
    let html = '';
    nos.forEach(t => {
      const filhos = DashCore.filhosDiretos(t, sorted);
      if (!filhos.length) {
        html += `<div style="padding:4px 2px;padding-left:${indent + 22}px;font-size:.78rem;color:#999;">${DashCore.esc(t.nome || 'Sem nome')}</div>`;
        return;
      }
      const aberto = _cfgAbertos.has(t.id);
      html += `<div style="display:flex;align-items:center;gap:4px;padding:4px 2px;border-radius:4px;" onmouseover="this.style.background='#f7f7f7'" onmouseout="this.style.background='transparent'">
        <span onclick="DashFrentes.cfgToggleAberto('${t.id}')" style="width:16px;text-align:center;cursor:pointer;color:#888;font-size:.7rem;flex-shrink:0;">${aberto ? '▼' : '▶'}</span>
        <label style="display:flex;align-items:center;gap:8px;font-size:.82rem;flex:1;cursor:pointer;padding-left:${indent}px;">
          <input type="checkbox" value="${t.id}" ${_cfgMarcada(t.id) ? 'checked' : ''} onchange="DashFrentes.cfgToggleTarefa('${t.id}', this.checked)">
          <span style="font-weight:600;">${DashCore.esc(t.nome || 'Sem nome')}</span>
        </label>
      </div>`;
      if (aberto) html += _cfgRenderNivel(filhos, sorted, indent + 18);
    });
    return html;
  }
  function cfgToggleAberto(id) {
    if (_cfgAbertos.has(id)) _cfgAbertos.delete(id); else _cfgAbertos.add(id);
    _renderCfgArvore();
  }
  function cfgFiltrar(texto) { _renderCfgArvore(texto); }
  function cfgToggleTarefa(tarefaId, marcado) {
    const l = _cfgLinhas.find(x => x.id === _cfgLinhaAtiva);
    if (!l) return;
    l.tarefaIds = l.tarefaIds || [];
    if (marcado && !l.tarefaIds.includes(tarefaId)) l.tarefaIds.push(tarefaId);
    if (!marcado) l.tarefaIds = l.tarefaIds.filter(id => id !== tarefaId);
    _renderCfgLinhas();
  }

  async function cfgSalvar() {
    const overlay = document.getElementById('db-frcfg-overlay');
    const linhasValidas = _cfgLinhas.filter(l => (l.nome || '').trim() && (l.tarefaIds || []).length);
    try {
      await db.collection('obras').doc(_ctx.obraId).collection('config').doc('dashboardPainel').set({ linhas: linhasValidas, auto: false }, { merge: false });
      if (overlay) overlay.remove();
      Utils.toast('Frentes salvas (modo manual). Pra voltar ao automático, abra Configurar → Voltar ao automático.', 'sucesso');
      await render(_ctx);
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao salvar configuração.', 'erro');
    }
  }

  // Volta ao modo 100% automático (apaga a config manual).
  async function cfgVoltarAuto() {
    try {
      await db.collection('obras').doc(_ctx.obraId).collection('config').doc('dashboardPainel').set({ linhas: [], auto: true }, { merge: false });
      const overlay = document.getElementById('db-frcfg-overlay');
      if (overlay) overlay.remove();
      Utils.toast('Modo automático reativado — frentes voltam a acompanhar o Planejamento sozinhas.', 'sucesso');
      await render(_ctx);
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao reativar modo automático.', 'erro');
    }
  }

  return { render, setModo, abrirDetalhe, abrirConfig, cfgNovaLinha, cfgRenomear, cfgRemoverLinha, cfgToggleEditor, cfgRegerarAuto, cfgToggleAberto, cfgFiltrar, cfgToggleTarefa, cfgSalvar, cfgVoltarAuto };
})();
window.DashFrentes = DashFrentes;

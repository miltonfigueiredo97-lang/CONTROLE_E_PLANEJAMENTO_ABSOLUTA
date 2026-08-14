// ============================================
// Dashboard Principal — Orquestrador
// Este arquivo NÃO desenha seções: só carrega os dados centrais (obra,
// tarefas, suprimentos), monta o esqueleto/hero e delega cada seção ao seu
// módulo próprio, com try/catch individual (uma seção quebrada não derruba
// as outras):
//   js/dashboard-core.js        → DashCore (helpers compartilhados)
//   js/dashboard-frentes.js     → DashFrentes (Andamento por Frente)
//   js/dashboard-suprimentos.js → DashSuprimentos
//   js/dashboard-contencao.js   → DashContencao (Solo Grampeado)
//   js/dashboard-concreto.js    → DashConcreto (Fundação/Estrutura + Estacas)
//   js/dashboard-resumo.js      → DashResumo (Resumo por Apartamento)
// Pra mexer numa seção, edite só o arquivo dela.
// ============================================
const Dashboard = (() => {
  let obraAtual = null;
  let tarefas = [];
  let suprimentos = [];
  let _ultimoLoad = 0;
  let _carregando = false;

  async function init() {
    const ok = await Utils.initPagina();
    if (!ok) return;
    obraAtual = Router.getObra();
    DashConcreto.renderToggle();
    await _carregarPrefsRemotas();
    await carregar();
    // Auto-refresh: ao voltar pra esta aba (depois de editar % no
    // Planejamento em outra aba, por exemplo), recarrega os dados sozinho —
    // o Dashboard sempre mostra o retrato atual sem precisar de F5.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && Date.now() - _ultimoLoad > 5000) carregar(true);
    });
  }

  // Preferências pessoais de UI (nível/horizonte da árvore de Suprimentos)
  // — seguem o usuário entre PCs via users/{uid}.dashboardArvorePrefs.
  async function _carregarPrefsRemotas() {
    const uid = Auth.getUid();
    if (!uid) return;
    try {
      const user = await Database.getUser(uid);
      DashSuprimentos.aplicarPrefsRemotas(user?.dashboardArvorePrefs);
      DashAtividades.aplicarPrefsRemotas(user?.dashboardArvorePrefs);
    } catch (e) { /* segue com o cache local */ }
  }

  async function onObraChanged(obra) {
    obraAtual = obra;
    await carregar();
  }
  window.onObraChanged = onObraChanged;

  async function carregar(silencioso) {
    const el = document.getElementById('modulo-content');
    if (!el) return;
    if (_carregando) return; // evita corrida de dois loads simultâneos
    if (!obraAtual || !obraAtual.id) {
      el.innerHTML = _htmlSemObra();
      await _popularSeletorVazio();
      return;
    }
    try {
      _carregando = true;
      if (!silencioso) Utils.mostrarLoading('Carregando dashboard...');
      const obraId = obraAtual.id;
      const [obraCompleta, tf, sup] = await Promise.all([
        Database.getObra(obraId),
        Database.listar(obraId, 'tarefas', 'ordem').catch(() => []),
        Database.listar(obraId, 'suprimentos', null).catch(() => []),
      ]);
      obraAtual = obraCompleta || obraAtual;
      tarefas = tf;
      suprimentos = sup;
      el.innerHTML = _htmlEsqueleto();
      _renderHero();

      const ctx = { obraId, obra: obraAtual, tarefas, suprimentos };
      const secoes = [
        ['Frentes de Trabalho', () => DashFrentes.render(ctx)],
        ['Atividades', () => DashAtividades.render(ctx)],
        ['Suprimentos', () => DashSuprimentos.render(ctx)],
        ['Contenção', () => DashContencao.render(ctx)],
        ['Fundação e Estrutura', () => DashConcreto.renderFundacaoEstrutura(ctx)],
        ['Estacas', () => DashConcreto.renderEstacas(ctx)],
        ['Resumo por Apartamento', () => DashResumo.render(ctx)],
      ];
      // try/catch por seção — erro em uma não derruba as seguintes.
      for (const [nome, fn] of secoes) {
        try {
          await fn();
        } catch (e) {
          console.error(`Erro na seção "${nome}" do Dashboard:`, e);
        }
      }
      _ultimoLoad = Date.now();
      const atualizado = document.getElementById('db-atualizado-em');
      if (atualizado) atualizado.textContent = 'Atualizado ' + Utils.formatarDataHora(new Date());
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao carregar dashboard.', 'erro');
    } finally {
      _carregando = false;
      Utils.esconderLoading();
    }
  }

  // Botão ↻ das Frentes — recarrega tudo na hora.
  async function atualizar() { await carregar(); }

  function _htmlSemObra() {
    return `<div class="estado-vazio">
      <div class="icone">📊</div>
      <p>Selecione uma obra para ver o Dashboard.</p>
      <select id="db-select-vazio" style="max-width:320px;margin:0 auto;display:block;" class="form-control"></select>
    </div>`;
  }

  async function _popularSeletorVazio() {
    const sel = document.getElementById('db-select-vazio');
    if (!sel) return;
    try {
      const obras = await Database.getObras();
      sel.innerHTML = '<option value="">Selecione...</option>' + obras.map(o => `<option value="${o.id}">${DashCore.esc(o.nome)}</option>`).join('');
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
            <h3>🏗️ Andamento por Frente de Trabalho</h3>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span class="text-sm text-muted" id="db-atualizado-em"></span>
              <button class="btn btn-secundario btn-sm" onclick="Dashboard.atualizar()" title="Recarregar dados do Planejamento agora">↻ Atualizar</button>
              <div class="aba-toggle" id="db-painel-toggle">
                <button class="aba-btn ativo" data-v="pavimento" onclick="DashFrentes.setModo('pavimento')">Por Pavimento</button>
                <button class="aba-btn" data-v="apartamento" onclick="DashFrentes.setModo('apartamento')">Por Apartamento</button>
              </div>
              <button class="btn btn-secundario btn-sm" onclick="DashFrentes.abrirConfig()">⚙️ Configurar</button>
            </div>
          </div>
          <div id="db-frentes"></div>
        </div>
      </div>

      <div class="card db-row">
        <div class="card-body">
          <div class="db-secao-header"><h3>📋 Atividades</h3></div>
          <div id="db-atividades"></div>
        </div>
      </div>

      <div class="card db-row">
        <div class="card-body">
          <div class="db-secao-header"><h3>📦 Suprimentos</h3></div>
          <div id="db-suprimentos-dash"></div>
        </div>
      </div>

      <div id="db-solo-grampeado-wrap"></div>

      <div id="db-fundacao-estrutura-wrap"></div>

      <div id="db-estacas-wrap"></div>

      <div class="card db-row">
        <div class="card-body">
          <div class="db-secao-header">
            <h3>📐 Resumo por Apartamento</h3>
            <div class="aba-toggle" id="db-resumo-toggle">
              <button class="aba-btn ativo" data-v="unidade" onclick="DashResumo.setView('unidade')">Unidade</button>
              <button class="aba-btn" data-v="custo" onclick="DashResumo.setView('custo')">Custo (R$)</button>
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
    const prog = DashCore.calcProgresso(tarefas);
    const perc = Math.min(100, prog.percConcluido);
    const percEsp = Math.min(100, prog.percEsperado);
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
          <h1>${DashCore.esc(obraAtual.nome || 'Obra')}</h1>
          <div class="db-hero-sub">${DashCore.esc(obraAtual.cliente || '')}</div>

          <div class="db-hero-progresso">
            <div class="db-hero-prog-labels">
              <span><b>${Utils.formatarNumero(perc)}%</b> executado</span>
              <span class="db-hero-prog-esp">previsto ${Utils.formatarNumero(percEsp)}%</span>
            </div>
            <div class="db-hero-prog-barra">
              <i class="db-hero-prog-exec" style="width:${perc.toFixed(1)}%;"></i>
              <span class="db-hero-prog-marco" style="left:${percEsp.toFixed(1)}%;" title="Previsto atual: ${Utils.formatarNumero(percEsp)}%"></span>
            </div>
          </div>

          <div class="db-hero-kpis">
            <div class="db-kpi">
              <div class="db-kpi-valor">${prog.terminoAtual ? Utils.formatarData(prog.terminoAtual) : '—'}</div>
              <div class="db-kpi-label">Término Atual ${atraso.badge}</div>
            </div>
            <div class="db-kpi">
              <div class="db-kpi-valor">${prog.terminoBase ? Utils.formatarData(prog.terminoBase) : '—'}</div>
              <div class="db-kpi-label">Término Linha de Base</div>
            </div>
            <div class="db-kpi">
              <div class="db-kpi-valor">${prog.inicioReal ? Utils.formatarData(prog.inicioReal) : '—'}</div>
              <div class="db-kpi-label">Início Real</div>
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
      sel.innerHTML = obras.map(o => `<option value="${o.id}" ${o.id === obraAtual.id ? 'selected' : ''}>${DashCore.esc(o.nome)}</option>`).join('');
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

  return { init, onObraChanged, atualizar };
})();

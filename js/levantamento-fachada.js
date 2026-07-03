// ============================================
// Módulo: Levantamento de Fachada
// Calculadora completa de fachada
// Estrutura: Fachada → Conjunto → Balancim → Vista → Peça
// ============================================

const LevantamentoFachada = (() => {
  let obraId = null;
  let fachadas = [];
  let conjuntos = [];
  let balancins = [];
  let pecas = [];

  // Estado de seleção na árvore
  let selecao = {
    fachadaId: null,
    conjuntoId: null,
    balancimId: null,
    vista: null // 'interna' ou 'externa'
  };

  let editandoPecaId = null;

  // ---- INIT ----
  async function init() {
    const ok = await Utils.initPagina({ requireObra: true });
    if (!ok) return;

    obraId = Router.getObraId();
    if (!obraId) {
      document.getElementById('fachada-main').innerHTML = `
        <div class="estado-vazio"><div class="icone">🏢</div>
        <p>Selecione uma obra na barra lateral.</p></div>`;
      return;
    }

    _bindEvents();
    await carregarTudo();
  }

  function _bindEvents() {
    // Fechar modais com Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') Utils.fecharTodosModais();
    });
  }

  // ---- CARREGAR DADOS ----
  async function carregarTudo() {
    try {
      Utils.mostrarLoading('Carregando fachada...');

      const dados = await Database.listar(obraId, 'levantamentosFachada', 'createdAt');

      // Separar por tipo
      fachadas = dados.filter(d => d.tipo === 'fachada');
      conjuntos = dados.filter(d => d.tipo === 'conjunto');
      balancins = dados.filter(d => d.tipo === 'balancim');
      pecas = dados.filter(d => d.tipo === 'peca');

      renderArvore();
      renderPainel();
    } catch (e) {
      console.error('Erro ao carregar fachada:', e);
      Utils.toast('Erro ao carregar dados.', 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ---- ÁRVORE HIERÁRQUICA ----
  function renderArvore() {
    const container = document.getElementById('fachada-tree-body');
    if (!container) return;

    if (fachadas.length === 0) {
      container.innerHTML = `
        <div class="estado-vazio" style="padding:24px 12px;">
          <p class="text-sm">Nenhuma fachada cadastrada.</p>
          <button class="btn btn-primario btn-sm mt-1" onclick="LevantamentoFachada.novaFachada()">+ Fachada</button>
        </div>`;
      return;
    }

    let html = '';
    fachadas.forEach(fachada => {
      const isFachadaSel = selecao.fachadaId === fachada.id;
      const fachadaConjuntos = conjuntos.filter(c => c.fachadaId === fachada.id);
      const totalPecasFachada = pecas.filter(p => p.fachadaId === fachada.id).length;

      html += `<div class="tree-item ${isFachadaSel && !selecao.conjuntoId ? 'ativo' : ''}" 
                    onclick="LevantamentoFachada.selecionarFachada('${fachada.id}')">
        <span class="tree-toggle">${fachadaConjuntos.length > 0 ? '▾' : '▸'}</span>
        <span class="tree-icon">🏢</span>
        <span class="tree-label">${fachada.nome}</span>
        <span class="tree-badge">${totalPecasFachada}</span>
      </div>`;

      if (isFachadaSel || selecao.fachadaId === fachada.id) {
        html += '<div class="tree-children">';
        fachadaConjuntos.forEach(conj => {
          const isConjSel = selecao.conjuntoId === conj.id;
          const conjBalancins = balancins.filter(b => b.conjuntoId === conj.id);

          html += `<div class="tree-item ${isConjSel && !selecao.balancimId ? 'ativo' : ''}"
                        onclick="LevantamentoFachada.selecionarConjunto('${fachada.id}','${conj.id}')">
            <span class="tree-toggle">${conjBalancins.length > 0 ? '▾' : '▸'}</span>
            <span class="tree-icon">📦</span>
            <span class="tree-label">${conj.nome}</span>
            <span class="tree-badge">${conjBalancins.length}</span>
          </div>`;

          if (isConjSel || selecao.conjuntoId === conj.id) {
            html += '<div class="tree-children">';
            conjBalancins.forEach(bal => {
              const isBalSel = selecao.balancimId === bal.id;
              const pecasBal = pecas.filter(p => p.balancimId === bal.id);

              html += `<div class="tree-item ${isBalSel && !selecao.vista ? 'ativo' : ''}"
                            onclick="LevantamentoFachada.selecionarBalancim('${fachada.id}','${conj.id}','${bal.id}')">
                <span class="tree-toggle">${pecasBal.length > 0 ? '▾' : '▸'}</span>
                <span class="tree-icon">🪜</span>
                <span class="tree-label">${bal.nome}</span>
                <span class="tree-badge">${pecasBal.length}</span>
              </div>`;

              if (isBalSel) {
                const pecasInt = pecasBal.filter(p => p.vista === 'interna');
                const pecasExt = pecasBal.filter(p => p.vista === 'externa');
                html += '<div class="tree-children">';
                html += `<div class="tree-item ${selecao.vista === 'externa' ? 'ativo' : ''}"
                              onclick="LevantamentoFachada.selecionarVista('${fachada.id}','${conj.id}','${bal.id}','externa')">
                  <span class="tree-toggle"></span>
                  <span class="tree-icon">🔵</span>
                  <span class="tree-label">Vista Externa</span>
                  <span class="tree-badge">${pecasExt.length}</span>
                </div>`;
                html += `<div class="tree-item ${selecao.vista === 'interna' ? 'ativo' : ''}"
                              onclick="LevantamentoFachada.selecionarVista('${fachada.id}','${conj.id}','${bal.id}','interna')">
                  <span class="tree-toggle"></span>
                  <span class="tree-icon">🟡</span>
                  <span class="tree-label">Vista Interna</span>
                  <span class="tree-badge">${pecasInt.length}</span>
                </div>`;
                html += '</div>';
              }
            });
            html += '</div>';
          }
        });
        html += '</div>';
      }
    });

    container.innerHTML = html;
  }

  // ---- SELEÇÃO NA ÁRVORE ----
  function selecionarFachada(fachadaId) {
    selecao = { fachadaId, conjuntoId: null, balancimId: null, vista: null };
    renderArvore();
    renderPainel();
  }

  function selecionarConjunto(fachadaId, conjuntoId) {
    selecao = { fachadaId, conjuntoId, balancimId: null, vista: null };
    renderArvore();
    renderPainel();
  }

  function selecionarBalancim(fachadaId, conjuntoId, balancimId) {
    selecao = { fachadaId, conjuntoId, balancimId, vista: null };
    renderArvore();
    renderPainel();
  }

  function selecionarVista(fachadaId, conjuntoId, balancimId, vista) {
    selecao = { fachadaId, conjuntoId, balancimId, vista };
    renderArvore();
    renderPainel();
  }

  // ---- PAINEL PRINCIPAL ----
  function renderPainel() {
    const painel = document.getElementById('fachada-painel');
    if (!painel) return;

    // Sem seleção = resumo geral
    if (!selecao.fachadaId) {
      renderResumoGeral(painel);
      return;
    }

    // Vista selecionada = tabela de peças
    if (selecao.vista && selecao.balancimId) {
      renderPecas(painel);
      return;
    }

    // Balancim selecionado = resumo do balancim
    if (selecao.balancimId) {
      renderResumoBalancim(painel);
      return;
    }

    // Conjunto selecionado = resumo do conjunto
    if (selecao.conjuntoId) {
      renderResumoConjunto(painel);
      return;
    }

    // Fachada selecionada = resumo da fachada
    renderResumoFachada(painel);
  }

  // ---- RESUMO GERAL ----
  function renderResumoGeral(painel) {
    const totais = calcularTotaisGeral();
    painel.innerHTML = `
      <div class="page-header">
        <div>
          <h2>Resumo Geral — Fachada</h2>
          <span class="subtitulo">${fachadas.length} fachada(s) • ${pecas.length} peça(s) cadastrada(s)</span>
        </div>
        <button class="btn btn-primario" onclick="LevantamentoFachada.novaFachada()">+ Nova Fachada</button>
      </div>
      ${_renderInfoCards(totais)}
      ${_renderTabelaResumoFachadas()}
    `;
  }

  function _renderTabelaResumoFachadas() {
    if (fachadas.length === 0) return '';
    
    let rows = '';
    fachadas.forEach(f => {
      const t = calcularTotaisFachada(f.id);
      rows += `<tr>
        <td><a href="#" onclick="LevantamentoFachada.selecionarFachada('${f.id}');return false;">${f.nome}</a></td>
        <td class="col-num">${conjuntos.filter(c => c.fachadaId === f.id).length}</td>
        <td class="col-num">${pecas.filter(p => p.fachadaId === f.id).length}</td>
        <td class="col-num">${Utils.formatarNumero(t.areaBruta)}</td>
        <td class="col-num">${Utils.formatarNumero(t.areaJanelas)}</td>
        <td class="col-num">${Utils.formatarNumero(t.areaLiquida)}</td>
        <td class="col-num">${Utils.formatarNumero(t.metroLinear)}</td>
        <td class="col-acoes">
          <button class="btn btn-secundario btn-sm" onclick="LevantamentoFachada.editarFachada('${f.id}')">✎</button>
          <button class="btn btn-perigo btn-sm btn-icon" onclick="LevantamentoFachada.excluirFachada('${f.id}')">✕</button>
        </td>
      </tr>`;
    });

    const totG = calcularTotaisGeral();
    return `<div class="tabela-container mt-2">
      <table class="tabela">
        <thead><tr>
          <th>Fachada</th><th class="col-num">Conjuntos</th><th class="col-num">Peças</th>
          <th class="col-num">m² Bruto</th><th class="col-num">m² Janelas</th>
          <th class="col-num">m² Líquido</th><th class="col-num">ML</th><th class="col-acoes">Ações</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr>
          <td><strong>TOTAL</strong></td><td class="col-num">${conjuntos.length}</td><td class="col-num">${pecas.length}</td>
          <td class="col-num">${Utils.formatarNumero(totG.areaBruta)}</td>
          <td class="col-num">${Utils.formatarNumero(totG.areaJanelas)}</td>
          <td class="col-num">${Utils.formatarNumero(totG.areaLiquida)}</td>
          <td class="col-num">${Utils.formatarNumero(totG.metroLinear)}</td>
          <td></td>
        </tr></tfoot>
      </table>
    </div>`;
  }

  // ---- RESUMO FACHADA ----
  function renderResumoFachada(painel) {
    const fachada = fachadas.find(f => f.id === selecao.fachadaId);
    if (!fachada) return;
    const fachadaConjs = conjuntos.filter(c => c.fachadaId === fachada.id);
    const totais = calcularTotaisFachada(fachada.id);

    let rowsConj = '';
    fachadaConjs.forEach(c => {
      const tc = calcularTotaisConjunto(c.id);
      const nbals = balancins.filter(b => b.conjuntoId === c.id).length;
      rowsConj += `<tr>
        <td><a href="#" onclick="LevantamentoFachada.selecionarConjunto('${fachada.id}','${c.id}');return false;">${c.nome}</a></td>
        <td class="col-num">${nbals}</td>
        <td class="col-num">${Utils.formatarNumero(tc.areaBruta)}</td>
        <td class="col-num">${Utils.formatarNumero(tc.areaLiquida)}</td>
        <td class="col-num">${Utils.formatarNumero(tc.metroLinear)}</td>
        <td class="col-acoes">
          <button class="btn btn-secundario btn-sm" onclick="LevantamentoFachada.editarConjunto('${c.id}')">✎</button>
          <button class="btn btn-perigo btn-sm btn-icon" onclick="LevantamentoFachada.excluirConjunto('${c.id}')">✕</button>
        </td>
      </tr>`;
    });

    painel.innerHTML = `
      <div class="page-header">
        <div>
          <h2>🏢 ${fachada.nome}</h2>
          <span class="subtitulo">${fachadaConjs.length} conjunto(s) de balancins</span>
        </div>
        <button class="btn btn-primario btn-sm" onclick="LevantamentoFachada.novoConjunto('${fachada.id}')">+ Conjunto de Balancins</button>
      </div>
      ${_renderInfoCards(totais)}
      <div class="tabela-container mt-2">
        <table class="tabela">
          <thead><tr>
            <th>Conjunto</th><th class="col-num">Balancins</th>
            <th class="col-num">m² Bruto</th><th class="col-num">m² Líquido</th><th class="col-num">ML</th>
            <th class="col-acoes">Ações</th>
          </tr></thead>
          <tbody>${rowsConj || '<tr><td colspan="6" class="text-center text-muted">Nenhum conjunto cadastrado.</td></tr>'}</tbody>
          <tfoot><tr>
            <td><strong>Total Fachada</strong></td>
            <td class="col-num">${balancins.filter(b => fachadaConjs.some(c => c.id === b.conjuntoId)).length}</td>
            <td class="col-num">${Utils.formatarNumero(totais.areaBruta)}</td>
            <td class="col-num">${Utils.formatarNumero(totais.areaLiquida)}</td>
            <td class="col-num">${Utils.formatarNumero(totais.metroLinear)}</td>
            <td></td>
          </tr></tfoot>
        </table>
      </div>
    `;
  }

  // ---- RESUMO CONJUNTO ----
  function renderResumoConjunto(painel) {
    const conj = conjuntos.find(c => c.id === selecao.conjuntoId);
    if (!conj) return;
    const conjBals = balancins.filter(b => b.conjuntoId === conj.id);
    const totais = calcularTotaisConjunto(conj.id);

    let rowsBal = '';
    conjBals.forEach(b => {
      const tb = calcularTotaisBalancim(b.id);
      const np = pecas.filter(p => p.balancimId === b.id).length;
      rowsBal += `<tr>
        <td><a href="#" onclick="LevantamentoFachada.selecionarBalancim('${selecao.fachadaId}','${conj.id}','${b.id}');return false;">${b.nome}</a></td>
        <td class="col-num">${np}</td>
        <td class="col-num">${Utils.formatarNumero(tb.areaBruta)}</td>
        <td class="col-num">${Utils.formatarNumero(tb.areaLiquida)}</td>
        <td class="col-num">${Utils.formatarNumero(tb.metroLinear)}</td>
        <td class="col-acoes">
          <button class="btn btn-secundario btn-sm" onclick="LevantamentoFachada.editarBalancim('${b.id}')">✎</button>
          <button class="btn btn-perigo btn-sm btn-icon" onclick="LevantamentoFachada.excluirBalancim('${b.id}')">✕</button>
        </td>
      </tr>`;
    });

    painel.innerHTML = `
      <div class="page-header">
        <div>
          <h2>📦 ${conj.nome}</h2>
          <span class="subtitulo">${conjBals.length} balancim(ns)</span>
        </div>
        <button class="btn btn-primario btn-sm" onclick="LevantamentoFachada.novoBalancim('${conj.id}')">+ Balancim</button>
      </div>
      ${_renderInfoCards(totais)}
      <div class="tabela-container mt-2">
        <table class="tabela">
          <thead><tr>
            <th>Balancim</th><th class="col-num">Peças</th>
            <th class="col-num">m² Bruto</th><th class="col-num">m² Líquido</th><th class="col-num">ML</th>
            <th class="col-acoes">Ações</th>
          </tr></thead>
          <tbody>${rowsBal || '<tr><td colspan="6" class="text-center text-muted">Nenhum balancim cadastrado.</td></tr>'}</tbody>
          <tfoot><tr>
            <td><strong>Total Conjunto</strong></td>
            <td class="col-num">${pecas.filter(p => conjBals.some(b => b.id === p.balancimId)).length}</td>
            <td class="col-num">${Utils.formatarNumero(totais.areaBruta)}</td>
            <td class="col-num">${Utils.formatarNumero(totais.areaLiquida)}</td>
            <td class="col-num">${Utils.formatarNumero(totais.metroLinear)}</td>
            <td></td>
          </tr></tfoot>
        </table>
      </div>
    `;
  }

  // ---- RESUMO BALANCIM ----
  function renderResumoBalancim(painel) {
    const bal = balancins.find(b => b.id === selecao.balancimId);
    if (!bal) return;
    const totais = calcularTotaisBalancim(bal.id);
    const pecasBal = pecas.filter(p => p.balancimId === bal.id);
    const pecasExt = pecasBal.filter(p => p.vista === 'externa');
    const pecasInt = pecasBal.filter(p => p.vista === 'interna');

    painel.innerHTML = `
      <div class="page-header">
        <div>
          <h2>🪜 ${bal.nome}</h2>
          <span class="subtitulo">${pecasBal.length} peça(s) — Selecione Vista Interna ou Externa na árvore</span>
        </div>
      </div>
      ${_renderInfoCards(totais)}
      <div class="resumo-grid mt-2">
        <div class="resumo-card" style="cursor:pointer" onclick="LevantamentoFachada.selecionarVista('${selecao.fachadaId}','${selecao.conjuntoId}','${bal.id}','externa')">
          <div class="resumo-label">🔵 Vista Externa</div>
          <div class="resumo-valor">${pecasExt.length}</div>
          <div class="resumo-unidade">peça(s)</div>
        </div>
        <div class="resumo-card" style="cursor:pointer" onclick="LevantamentoFachada.selecionarVista('${selecao.fachadaId}','${selecao.conjuntoId}','${bal.id}','interna')">
          <div class="resumo-label">🟡 Vista Interna</div>
          <div class="resumo-valor">${pecasInt.length}</div>
          <div class="resumo-unidade">peça(s)</div>
        </div>
      </div>
    `;
  }

  // ---- TABELA DE PEÇAS ----
  function renderPecas(painel) {
    const bal = balancins.find(b => b.id === selecao.balancimId);
    if (!bal) return;
    const vistaLabel = selecao.vista === 'externa' ? '🔵 Vista Externa' : '🟡 Vista Interna';
    const pecasVista = pecas.filter(p => p.balancimId === bal.id && p.vista === selecao.vista);

    let rows = '';
    let totBruto = 0, totJanela = 0, totLiquido = 0, totML = 0;

    pecasVista.forEach(p => {
      const calc = calcularPeca(p);
      totBruto += calc.areaBruta;
      totJanela += calc.areaJanelas;
      totLiquido += calc.areaLiquida;
      totML += calc.metroLinear;

      rows += `<tr>
        <td>${p.nome || '—'}</td>
        <td class="col-num">${Utils.formatarNumero(p.comprimento)}</td>
        <td class="col-num">${Utils.formatarNumero(p.altura)}</td>
        <td class="col-num col-centro">${p.quantidade || 1}</td>
        <td class="col-centro">${p.tipoMedicao || 'm²'}</td>
        <td class="col-centro">${p.possuiJanela ? '✓' : ''}</td>
        <td class="col-num">${Utils.formatarNumero(calc.areaBruta)}</td>
        <td class="col-num">${Utils.formatarNumero(calc.areaJanelas)}</td>
        <td class="col-num">${Utils.formatarNumero(calc.areaLiquida)}</td>
        <td class="col-num">${Utils.formatarNumero(calc.metroLinear)}</td>
        <td class="col-acoes">
          <button class="btn btn-secundario btn-sm" onclick="LevantamentoFachada.editarPeca('${p.id}')">✎</button>
          <button class="btn btn-perigo btn-sm btn-icon" onclick="LevantamentoFachada.excluirPeca('${p.id}')">✕</button>
        </td>
      </tr>`;
    });

    painel.innerHTML = `
      <div class="page-header">
        <div>
          <h2>🪜 ${bal.nome} — ${vistaLabel}</h2>
          <span class="subtitulo">${pecasVista.length} peça(s)</span>
        </div>
        <button class="btn btn-primario btn-sm" onclick="LevantamentoFachada.novaPeca()">+ Nova Peça</button>
      </div>
      <div class="fachada-info-bar">
        <div class="fachada-info-item">
          <div class="info-label">m² Bruto</div>
          <div class="info-valor">${Utils.formatarNumero(totBruto)}</div>
        </div>
        <div class="fachada-info-item">
          <div class="info-label">m² Janelas</div>
          <div class="info-valor">${Utils.formatarNumero(totJanela)}</div>
        </div>
        <div class="fachada-info-item">
          <div class="info-label">m² Líquido</div>
          <div class="info-valor destaque">${Utils.formatarNumero(totLiquido)}</div>
        </div>
        <div class="fachada-info-item">
          <div class="info-label">Metro Linear</div>
          <div class="info-valor">${Utils.formatarNumero(totML)}</div>
        </div>
      </div>
      <div class="tabela-container mt-2">
        <table class="tabela">
          <thead><tr>
            <th>Peça</th><th class="col-num">Comp (m)</th><th class="col-num">Alt (m)</th>
            <th class="col-num col-centro">Qtd</th><th class="col-centro">Tipo</th><th class="col-centro">Janela</th>
            <th class="col-num">m² Bruto</th><th class="col-num">m² Janela</th>
            <th class="col-num">m² Líq.</th><th class="col-num">ML</th>
            <th class="col-acoes">Ações</th>
          </tr></thead>
          <tbody>${rows || '<tr><td colspan="11" class="text-center text-muted">Nenhuma peça cadastrada nesta vista.</td></tr>'}</tbody>
          <tfoot><tr>
            <td colspan="6"><strong>TOTAL</strong></td>
            <td class="col-num">${Utils.formatarNumero(totBruto)}</td>
            <td class="col-num">${Utils.formatarNumero(totJanela)}</td>
            <td class="col-num">${Utils.formatarNumero(totLiquido)}</td>
            <td class="col-num">${Utils.formatarNumero(totML)}</td>
            <td></td>
          </tr></tfoot>
        </table>
      </div>
    `;
  }

  // ---- INFO CARDS (reutilizável) ----
  function _renderInfoCards(totais) {
    return `<div class="fachada-info-bar">
      <div class="fachada-info-item">
        <div class="info-label">m² Bruto</div>
        <div class="info-valor">${Utils.formatarNumero(totais.areaBruta)}</div>
      </div>
      <div class="fachada-info-item">
        <div class="info-label">m² Janelas</div>
        <div class="info-valor">${Utils.formatarNumero(totais.areaJanelas)}</div>
      </div>
      <div class="fachada-info-item">
        <div class="info-label">m² Líquido</div>
        <div class="info-valor destaque">${Utils.formatarNumero(totais.areaLiquida)}</div>
      </div>
      <div class="fachada-info-item">
        <div class="info-label">Metro Linear</div>
        <div class="info-valor">${Utils.formatarNumero(totais.metroLinear)}</div>
      </div>
    </div>`;
  }

  // ==============================================================
  // CÁLCULOS (conforme especificação)
  // ==============================================================

  function calcularPeca(peca) {
    const comp = Utils.parseNum(peca.comprimento);
    const alt = Utils.parseNum(peca.altura);
    const qtd = Utils.parseNum(peca.quantidade) || 1;
    const tipoMedicao = peca.tipoMedicao || 'm2';

    // Área bruta
    const areaBruta = comp * alt * qtd;

    // Área de janelas
    let areaJanelas = 0;
    if (peca.possuiJanela) {
      const largJ = Utils.parseNum(peca.larguraJanela);
      const altJ = Utils.parseNum(peca.alturaJanela);
      const qtdJ = Utils.parseNum(peca.quantidadeJanelas) || 1;
      areaJanelas = largJ * altJ * qtdJ * qtd;
    }

    // Área líquida
    const areaLiquida = areaBruta - areaJanelas;

    // Metro linear (comprimento x quantidade)
    const metroLinear = comp * qtd;

    // Regra: < 50cm → tratar como ML
    const usarML = tipoMedicao === 'ml' || (alt < 0.5 && alt > 0);

    return {
      areaBruta: tipoMedicao === 'ml' ? 0 : areaBruta,
      areaJanelas: tipoMedicao === 'ml' ? 0 : areaJanelas,
      areaLiquida: tipoMedicao === 'ml' ? 0 : areaLiquida,
      metroLinear: usarML ? metroLinear : 0,
      usarML
    };
  }

  function _somarPecas(listaPecas) {
    let areaBruta = 0, areaJanelas = 0, areaLiquida = 0, metroLinear = 0;
    listaPecas.forEach(p => {
      const c = calcularPeca(p);
      areaBruta += c.areaBruta;
      areaJanelas += c.areaJanelas;
      areaLiquida += c.areaLiquida;
      metroLinear += c.metroLinear;
    });
    return { areaBruta, areaJanelas, areaLiquida, metroLinear };
  }

  function calcularTotaisBalancim(balancimId) {
    return _somarPecas(pecas.filter(p => p.balancimId === balancimId));
  }

  function calcularTotaisConjunto(conjuntoId) {
    const bals = balancins.filter(b => b.conjuntoId === conjuntoId);
    const pecasConj = pecas.filter(p => bals.some(b => b.id === p.balancimId));
    return _somarPecas(pecasConj);
  }

  function calcularTotaisFachada(fachadaId) {
    return _somarPecas(pecas.filter(p => p.fachadaId === fachadaId));
  }

  function calcularTotaisGeral() {
    return _somarPecas(pecas);
  }

  // ==============================================================
  // CRUD — FACHADA
  // ==============================================================

  function novaFachada() {
    editandoPecaId = null;
    document.getElementById('modal-fachada-titulo').textContent = 'Nova Fachada';
    document.getElementById('form-entidade-id').value = '';
    document.getElementById('form-entidade-tipo').value = 'fachada';
    Utils.limparForm('form-entidade');
    Utils.abrirModal('modal-entidade');
  }

  function editarFachada(id) {
    const f = fachadas.find(x => x.id === id);
    if (!f) return;
    document.getElementById('modal-fachada-titulo').textContent = 'Editar Fachada';
    document.getElementById('form-entidade-id').value = id;
    document.getElementById('form-entidade-tipo').value = 'fachada';
    document.querySelector('#form-entidade [name="nome"]').value = f.nome;
    document.querySelector('#form-entidade [name="observacao"]').value = f.observacao || '';
    Utils.abrirModal('modal-entidade');
  }

  async function excluirFachada(id) {
    const f = fachadas.find(x => x.id === id);
    if (!Utils.confirmar(`Excluir fachada "${f?.nome}" e TODOS os dados vinculados?`)) return;
    try {
      Utils.mostrarLoading('Excluindo...');
      // Excluir em cascata: peças → balancins → conjuntos → fachada
      const conjsF = conjuntos.filter(c => c.fachadaId === id);
      const balsF = balancins.filter(b => conjsF.some(c => c.id === b.conjuntoId));
      const pecasF = pecas.filter(p => p.fachadaId === id);

      for (const p of pecasF) await Database.deletar(obraId, 'levantamentosFachada', p.id);
      for (const b of balsF) await Database.deletar(obraId, 'levantamentosFachada', b.id);
      for (const c of conjsF) await Database.deletar(obraId, 'levantamentosFachada', c.id);
      await Database.deletar(obraId, 'levantamentosFachada', id);

      await Audit.excluir(obraId, 'levantamento-fachada', 'fachada', id, `Excluiu fachada: ${f?.nome}`);
      selecao = { fachadaId: null, conjuntoId: null, balancimId: null, vista: null };
      Utils.toast('Fachada excluída.', 'sucesso');
      await carregarTudo();
    } catch (e) {
      Utils.toast('Erro ao excluir.', 'erro');
    } finally {
      Utils.esconderLoading();
    }
  }

  // ---- CRUD — CONJUNTO ----
  function novoConjunto(fachadaId) {
    document.getElementById('modal-fachada-titulo').textContent = 'Novo Conjunto de Balancins';
    document.getElementById('form-entidade-id').value = '';
    document.getElementById('form-entidade-tipo').value = 'conjunto';
    document.getElementById('form-entidade-parent').value = fachadaId;
    Utils.limparForm('form-entidade');
    Utils.abrirModal('modal-entidade');
  }

  function editarConjunto(id) {
    const c = conjuntos.find(x => x.id === id);
    if (!c) return;
    document.getElementById('modal-fachada-titulo').textContent = 'Editar Conjunto';
    document.getElementById('form-entidade-id').value = id;
    document.getElementById('form-entidade-tipo').value = 'conjunto';
    document.querySelector('#form-entidade [name="nome"]').value = c.nome;
    document.querySelector('#form-entidade [name="observacao"]').value = c.observacao || '';
    Utils.abrirModal('modal-entidade');
  }

  async function excluirConjunto(id) {
    if (!Utils.confirmar('Excluir este conjunto e todos os balancins/peças?')) return;
    try {
      Utils.mostrarLoading();
      const balsC = balancins.filter(b => b.conjuntoId === id);
      const pecasC = pecas.filter(p => balsC.some(b => b.id === p.balancimId));
      for (const p of pecasC) await Database.deletar(obraId, 'levantamentosFachada', p.id);
      for (const b of balsC) await Database.deletar(obraId, 'levantamentosFachada', b.id);
      await Database.deletar(obraId, 'levantamentosFachada', id);
      selecao.conjuntoId = null; selecao.balancimId = null; selecao.vista = null;
      Utils.toast('Conjunto excluído.', 'sucesso');
      await carregarTudo();
    } catch (e) { Utils.toast('Erro.', 'erro'); }
    finally { Utils.esconderLoading(); }
  }

  // ---- CRUD — BALANCIM ----
  function novoBalancim(conjuntoId) {
    document.getElementById('modal-fachada-titulo').textContent = 'Novo Balancim';
    document.getElementById('form-entidade-id').value = '';
    document.getElementById('form-entidade-tipo').value = 'balancim';
    document.getElementById('form-entidade-parent').value = conjuntoId;
    Utils.limparForm('form-entidade');
    Utils.abrirModal('modal-entidade');
  }

  function editarBalancim(id) {
    const b = balancins.find(x => x.id === id);
    if (!b) return;
    document.getElementById('modal-fachada-titulo').textContent = 'Editar Balancim';
    document.getElementById('form-entidade-id').value = id;
    document.getElementById('form-entidade-tipo').value = 'balancim';
    document.querySelector('#form-entidade [name="nome"]').value = b.nome;
    document.querySelector('#form-entidade [name="observacao"]').value = b.observacao || '';
    Utils.abrirModal('modal-entidade');
  }

  async function excluirBalancim(id) {
    if (!Utils.confirmar('Excluir este balancim e todas as peças?')) return;
    try {
      Utils.mostrarLoading();
      const pecasB = pecas.filter(p => p.balancimId === id);
      for (const p of pecasB) await Database.deletar(obraId, 'levantamentosFachada', p.id);
      await Database.deletar(obraId, 'levantamentosFachada', id);
      selecao.balancimId = null; selecao.vista = null;
      Utils.toast('Balancim excluído.', 'sucesso');
      await carregarTudo();
    } catch (e) { Utils.toast('Erro.', 'erro'); }
    finally { Utils.esconderLoading(); }
  }

  // ---- SALVAR ENTIDADE (fachada/conjunto/balancim) ----
  async function salvarEntidade() {
    const tipo = document.getElementById('form-entidade-tipo').value;
    const id = document.getElementById('form-entidade-id').value;
    const parent = document.getElementById('form-entidade-parent').value;
    const nome = document.querySelector('#form-entidade [name="nome"]').value.trim();
    const observacao = document.querySelector('#form-entidade [name="observacao"]').value.trim();

    if (!nome) {
      Utils.toast('Informe o nome.', 'alerta');
      return;
    }

    const data = { nome, observacao, tipo };

    if (tipo === 'conjunto') {
      data.fachadaId = parent || selecao.fachadaId;
    } else if (tipo === 'balancim') {
      data.conjuntoId = parent || selecao.conjuntoId;
      // Identificar fachada pelo conjunto
      const conj = conjuntos.find(c => c.id === data.conjuntoId);
      if (conj) data.fachadaId = conj.fachadaId;
    }

    try {
      if (id) {
        await Database.atualizar(obraId, 'levantamentosFachada', id, data);
        Utils.toast('Atualizado!', 'sucesso');
      } else {
        const novoId = await Database.criar(obraId, 'levantamentosFachada', data);
        await Audit.criar(obraId, 'levantamento-fachada', tipo, novoId, `Criou ${tipo}: ${nome}`);
        Utils.toast('Criado!', 'sucesso');
      }
      Utils.fecharModal('modal-entidade');
      await carregarTudo();
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao salvar.', 'erro');
    }
  }

  // ==============================================================
  // CRUD — PEÇAS
  // ==============================================================

  function novaPeca() {
    if (!selecao.balancimId || !selecao.vista) {
      Utils.toast('Selecione um balancim e uma vista.', 'alerta');
      return;
    }
    editandoPecaId = null;
    document.getElementById('modal-peca-titulo').textContent = 'Nova Peça';
    Utils.limparForm('form-peca');
    _toggleCamposJanela(false);
    Utils.abrirModal('modal-peca');
  }

  function editarPeca(id) {
    const peca = pecas.find(p => p.id === id);
    if (!peca) return;
    editandoPecaId = id;
    document.getElementById('modal-peca-titulo').textContent = 'Editar Peça';
    Utils.setFormData('form-peca', peca);
    _toggleCamposJanela(peca.possuiJanela);
    Utils.abrirModal('modal-peca');
  }

  async function excluirPeca(id) {
    if (!Utils.confirmar('Excluir esta peça?')) return;
    try {
      await Database.deletar(obraId, 'levantamentosFachada', id);
      Utils.toast('Peça excluída.', 'sucesso');
      await carregarTudo();
    } catch (e) {
      Utils.toast('Erro ao excluir.', 'erro');
    }
  }

  async function salvarPeca() {
    const data = Utils.getFormData('form-peca');

    if (!data.nome) {
      Utils.toast('Informe o nome da peça.', 'alerta');
      return;
    }

    data.tipo = 'peca';
    data.fachadaId = selecao.fachadaId;
    data.conjuntoId = selecao.conjuntoId;
    data.balancimId = selecao.balancimId;
    data.vista = selecao.vista;
    data.comprimento = Utils.parseNum(data.comprimento);
    data.altura = Utils.parseNum(data.altura);
    data.quantidade = Utils.parseNum(data.quantidade) || 1;
    data.tipoMedicao = data.tipoMedicao || 'm2';
    data.possuiJanela = !!data.possuiJanela;
    data.larguraJanela = Utils.parseNum(data.larguraJanela);
    data.alturaJanela = Utils.parseNum(data.alturaJanela);
    data.quantidadeJanelas = Utils.parseNum(data.quantidadeJanelas) || 0;

    // Regra < 50cm → ML
    if (data.altura > 0 && data.altura < 0.5) {
      data.tipoMedicao = 'ml';
    }

    try {
      if (editandoPecaId) {
        await Database.atualizar(obraId, 'levantamentosFachada', editandoPecaId, data);
        Utils.toast('Peça atualizada!', 'sucesso');
      } else {
        const novoId = await Database.criar(obraId, 'levantamentosFachada', data);
        await Audit.criar(obraId, 'levantamento-fachada', 'peca', novoId, `Criou peça: ${data.nome}`);
        Utils.toast('Peça criada!', 'sucesso');
      }
      Utils.fecharModal('modal-peca');
      editandoPecaId = null;
      await carregarTudo();
    } catch (e) {
      console.error(e);
      Utils.toast('Erro ao salvar peça.', 'erro');
    }
  }

  function _toggleCamposJanela(mostrar) {
    const campos = document.getElementById('campos-janela');
    if (campos) {
      campos.style.display = mostrar ? 'grid' : 'none';
    }
  }

  function onToggleJanela(checkbox) {
    _toggleCamposJanela(checkbox.checked);
  }

  // API pública
  return {
    init,
    carregarTudo,
    selecionarFachada,
    selecionarConjunto,
    selecionarBalancim,
    selecionarVista,
    novaFachada,
    editarFachada,
    excluirFachada,
    novoConjunto,
    editarConjunto,
    excluirConjunto,
    novoBalancim,
    editarBalancim,
    excluirBalancim,
    salvarEntidade,
    novaPeca,
    editarPeca,
    excluirPeca,
    salvarPeca,
    onToggleJanela
  };
})();

function onObraChanged() {
  LevantamentoFachada.init();
}

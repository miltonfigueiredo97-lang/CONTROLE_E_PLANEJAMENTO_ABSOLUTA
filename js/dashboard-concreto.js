// ============================================
// Dashboard — Concreto (DashConcreto)
// Duas seções que bebem do Controle de Concreto/Estacas:
//  1) Fundação e Estrutura — gráfico por andar (previsto × executado por
//     categoria), ligado pelo toggle no topo (preferência de UI local).
//  2) Estacas e Fundações — métricas da obra + minimapas de prancha.
// Clique numa barra abre o popup em tela cheia com a prancha (marcadores)
// ou o PDF da concretagem — sem navegar pra outra página.
// ============================================
const DashConcreto = (() => {
  let _ctx = null;
  let _mostrar = localStorage.getItem('db_mostrar_fundacao_estrutura') === 'true';
  let _feContexto = null; // { obraId, pecas, lancamentos, pecaConc, concretagens, marcadores, pranchas }

  const _isEstaca = p => p.subTipo === 'Estacas' || (!p.subTipo && _numGlobal(p.diametro) > 0 && _numGlobal(p.comprimento) > 0);
  function _numGlobal(v) { return parseFloat(String(v ?? '').replace(',', '.')) || 0; }
  const CATEGORIAS = [
    { chave: 'estaca', titulo: 'Fundação Profunda (Estacas)', cor: '#7a5c00', corClara: '#d4b04d', filtro: p => p.tipo === 'Fundação' && _isEstaca(p) },
    { chave: 'fundacao', titulo: 'Fundação', cor: '#a67c00', corClara: '#e0c05a', filtro: p => p.tipo === 'Fundação' && !_isEstaca(p) },
    { chave: 'estrutura', titulo: 'Estrutura', cor: '#F5C800', corClara: '#fbe480', filtro: p => p.tipo !== 'Fundação' },
  ];

  // ---------- Toggle (header) ----------
  function renderToggle() {
    const host = document.getElementById('header-actions');
    if (!host) return;
    host.innerHTML = `
      <label class="db-toggle-concreto">
        <input type="checkbox" id="db-check-concreto" ${_mostrar ? 'checked' : ''} onchange="DashConcreto.toggleMostrar()">
        Mostrar Fundação e Estrutura
      </label>`;
  }
  async function toggleMostrar() {
    _mostrar = document.getElementById('db-check-concreto')?.checked || false;
    localStorage.setItem('db_mostrar_fundacao_estrutura', _mostrar ? 'true' : 'false');
    if (_ctx) await renderFundacaoEstrutura(_ctx);
  }

  // ---------- Fundação e Estrutura ----------
  async function renderFundacaoEstrutura(ctx) {
    _ctx = ctx;
    const host = document.getElementById('db-fundacao-estrutura-wrap');
    if (!host) return;
    if (!_mostrar) { host.innerHTML = ''; return; }
    host.innerHTML = `
      <div class="card db-row">
        <div class="card-body">
          <div class="db-secao-header"><h3>🏛️ Fundação e Estrutura</h3></div>
          <div id="db-fe" class="db-tooltip-wrap">Carregando...</div>
        </div>
      </div>`;
    const elFE = document.getElementById('db-fe');
    // _num() local: não quebra mesmo se window.ConcretoCalculos estiver
    // ausente/desatualizado (cache de CDN desalinhado entre deploys).
    const CC = window.ConcretoCalculos;
    const _num = v => (CC && CC.num) ? CC.num(v) : _numGlobal(v);
    try {
      const obraId = ctx.obraId;
      const [pecas, lancamentos, cfgDoc, pecaConc, concretagens, marcadores, pranchas] = await Promise.all([
        Database.listar(obraId, 'concretoPecas', null).catch(() => []),
        Database.listar(obraId, 'concretoLancamentos', null).catch(() => []),
        Database.obter(obraId, 'config', 'concreto').catch(() => null),
        Database.listar(obraId, 'concretoPecaConc', null).catch(() => []),
        Database.listar(obraId, 'concretoConcretagens', null).catch(() => []),
        Database.listar(obraId, 'estacasMarcadores', null).catch(() => []),
        Database.listar(obraId, 'estacasPranchas', null).catch(() => []),
      ]);
      _feContexto = { obraId, pecas, lancamentos, pecaConc, concretagens, marcadores, pranchas };
      if (!pecas.length) {
        elFE.innerHTML = '<div class="db-vazio-inline">Nenhuma peça cadastrada no Controle de Concreto ainda.</div>';
        return;
      }
      // Ordem EXATA do Controle de Concreto, comparação por nome NORMALIZADO
      // (CC.normalizarAndar) — grafias diferentes do mesmo andar não quebram
      // a ordem nem duplicam barra.
      const norm = a => (CC ? CC.normalizarAndar(a) : String(a || '').trim());
      const ordemSalva = cfgDoc?.ordemAndares || [];
      const ordemSalvaNorm = ordemSalva.map(norm);
      const nomesBrutos = [...new Set(pecas.map(p => p.andar || 'Sem andar'))];
      const gruposPorNorm = new Map();
      nomesBrutos.forEach(nome => {
        const key = norm(nome);
        if (!gruposPorNorm.has(key)) gruposPorNorm.set(key, []);
        gruposPorNorm.get(key).push(nome);
      });
      const andaresComPecaBrutos = [...gruposPorNorm.entries()].map(([key, nomes]) => {
        const nomeNaOrdemCustom = ordemSalva.find(o => norm(o) === key);
        if (nomeNaOrdemCustom) return nomeNaOrdemCustom;
        const contagem = new Map();
        nomes.forEach(n => contagem.set(n, (pecas.filter(p => (p.andar || 'Sem andar') === n).length)));
        return [...contagem.entries()].sort((a, b) => b[1] - a[1])[0][0];
      });
      const andares = ordemSalva.length
        ? [...andaresComPecaBrutos].sort((a, b) => {
            const ia = ordemSalvaNorm.indexOf(norm(a));
            const ib = ordemSalvaNorm.indexOf(norm(b));
            if (ia === -1 && ib === -1) return 0;
            if (ia === -1) return 1;
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
        const porCategoria = CATEGORIAS.map(cat => {
          const pecasDaCategoria = pecas.filter(p => norm(p.andar || 'Sem andar') === norm(andar) && cat.filtro(p));
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
        elFE.innerHTML = '<div class="db-vazio-inline">Nenhum volume previsto ou executado lançado ainda.</div>';
        return;
      }
      elFE.innerHTML = _svgPorAndar(dadosPorAndar);
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
      elFE.innerHTML = `<div class="db-vazio-inline">Erro ao carregar dados do Controle de Concreto.<br><span style="font-family:var(--font-mono);font-size:.72rem;">${msgErro}</span></div>`;
    }
  }

  // Gráfico por andar — largura por grupo fixa (scroll horizontal quando
  // precisa), altura proporcional ao conteúdo.
  function _svgPorAndar(dados) {
    const n = dados.length;
    const larguraGrupoPx = 112;
    const H = n <= 2 ? 300 : 460;
    const padL = 60, padR = 20, padT = 28, padB = n <= 2 ? 90 : 120;
    const W = n * larguraGrupoPx + padL + padR;
    const plotH = H - padT - padB;
    const maxV = Math.max(1, ...dados.flatMap(d => d.porCategoria.map(c => Math.max(c.previsto, c.executado))));
    const barW = 13, gapBarras = 2, gapCategoria = 6;

    let bars = '', labels = '', hits = '', separadores = '', faixas = '', guias = '';
    dados.forEach((d, i) => {
      const grupoX = padL + i * larguraGrupoPx;
      if (i % 2 === 1) faixas += `<rect x="${grupoX.toFixed(1)}" y="${padT}" width="${larguraGrupoPx.toFixed(1)}" height="${plotH}" fill="#f8f8f8"/>`;

      const catsAtivas = d.porCategoria.filter(c => c.previsto > 0 || c.executado > 0);
      const larguraTotalCats = catsAtivas.length * (barW * 2 + gapBarras) + Math.max(0, catsAtivas.length - 1) * gapCategoria;
      let cursorX = grupoX + (larguraGrupoPx - larguraTotalCats) / 2;

      catsAtivas.forEach(c => {
        const cat = CATEGORIAS.find(cc => cc.chave === c.chave);
        const hPrev = (c.previsto / maxV) * plotH, hExec = (c.executado / maxV) * plotH;
        const xPrev = cursorX, xExec = cursorX + barW + gapBarras;
        bars += `<rect x="${xPrev.toFixed(1)}" y="${(padT + plotH - hPrev).toFixed(1)}" width="${barW}" height="${hPrev.toFixed(1)}" fill="${cat.corClara}" rx="1.5"/>`;
        bars += `<rect x="${xExec.toFixed(1)}" y="${(padT + plotH - hExec).toFixed(1)}" width="${barW}" height="${hExec.toFixed(1)}" fill="${cat.cor}" rx="1.5"/>`;
        if (c.previsto > 0) bars += `<text x="${(xPrev + barW / 2).toFixed(1)}" y="${(padT + plotH - hPrev - 5).toFixed(1)}" font-size="11" fill="#333" font-weight="700" text-anchor="middle">${Utils.formatarNumero(c.previsto, 0)}</text>`;
        const catLabel = cat.chave === 'estaca' ? 'Estacas' : cat.chave === 'fundacao' ? 'Fundação' : 'Estrutura';
        const alturaMaior = Math.max(hPrev, hExec);
        if (alturaMaior > 46) {
          const yBase = padT + plotH - alturaMaior / 2;
          bars += `<text x="${(xPrev + barW + gapBarras / 2).toFixed(1)}" y="${yBase.toFixed(1)}" font-size="10" fill="#fff" font-weight="700" text-anchor="middle" transform="rotate(-90 ${(xPrev + barW + gapBarras / 2).toFixed(1)} ${yBase.toFixed(1)})" style="paint-order:stroke;stroke:${cat.cor};stroke-width:3.5px;">${catLabel}</text>`;
        }
        hits += `<rect class="db-hit" data-idx="${i}" data-cat="${cat.chave}" x="${cursorX.toFixed(1)}" y="${padT}" width="${(barW * 2 + gapBarras).toFixed(1)}" height="${plotH}" fill="transparent" style="cursor:pointer;"/>`;
        cursorX += barW * 2 + gapBarras + gapCategoria;
      });

      const cxLabel = grupoX + larguraGrupoPx / 2;
      const yBase = padT + plotH;
      guias += `<line x1="${cxLabel.toFixed(1)}" x2="${cxLabel.toFixed(1)}" y1="${yBase.toFixed(1)}" y2="${(yBase + 6).toFixed(1)}" stroke="#999" stroke-width="1"/>`;
      const nomeCurto = d.andar.length > 18 ? d.andar.slice(0, 17) + '…' : d.andar;
      labels += `<text x="${cxLabel.toFixed(1)}" y="${(yBase + 20).toFixed(1)}" font-size="12" fill="#222" font-weight="600" text-anchor="end" transform="rotate(-45 ${cxLabel.toFixed(1)} ${(yBase + 20).toFixed(1)})"><title>${DashCore.esc(d.andar)}</title>${DashCore.esc(nomeCurto)}</text>`;
      if (i < n - 1) separadores += `<line x1="${(grupoX + larguraGrupoPx).toFixed(1)}" x2="${(grupoX + larguraGrupoPx).toFixed(1)}" y1="${padT}" y2="${padT + plotH}" stroke="#e0e0e0" stroke-width="1"/>`;
    });

    const gridY = [0, 0.25, 0.5, 0.75, 1].map(f => {
      const y = padT + plotH - f * plotH;
      return `<line x1="${padL}" x2="${W - padR}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#eee" stroke-width="1"/><text x="8" y="${(y + 4).toFixed(1)}" font-size="12" fill="#888">${Utils.formatarNumero(f * maxV, 0)}</text>`;
    }).join('');

    return `
      <div style="overflow-x:auto;">
        <svg viewBox="0 0 ${W} ${H}" style="width:${W}px;max-width:none;height:${H}px;display:block;">
          ${faixas}
          ${gridY}
          ${separadores}
          ${bars}
          ${guias}
          ${labels}
          ${hits}
        </svg>
      </div>
      <div class="db-legenda" style="margin-top:8px;">
        ${CATEGORIAS.map(cat => `<span><i style="background:${cat.corClara};"></i> ${cat.titulo} — Previsto</span>`).join('')}
        ${CATEGORIAS.map(cat => `<span><i style="background:${cat.cor};"></i> ${cat.titulo} — Executado</span>`).join('')}
      </div>
      <div class="text-sm text-muted" style="margin-top:6px;">Somado do Controle de Concreto por andar (ordem igual à configurada lá). Clique numa barra pra abrir o projeto/PDF daquele andar.</div>`;
  }

  // ---------- Estacas e Fundações ----------
  async function renderEstacas(ctx) {
    _ctx = ctx;
    const host = document.getElementById('db-estacas-wrap');
    if (!host) return;
    const EC = window.EstacasCalculos;
    if (!EC) { host.innerHTML = ''; return; }
    try {
      const obraId = ctx.obraId;
      const [pranchas, marcadores, pecas, lancamentos, btsConfig] = await Promise.all([
        Database.listar(obraId, 'estacasPranchas', null).catch(() => []),
        Database.listar(obraId, 'estacasMarcadores', null).catch(() => []),
        Database.listar(obraId, 'concretoPecas', null).catch(() => []),
        Database.listar(obraId, 'concretoLancamentos', null).catch(() => []),
        Database.listar(obraId, 'concretoBTs', null).catch(() => []),
      ]);
      const pranchasComImagem = pranchas.filter(p => Number(p.imgWidthPx) > 0 && Number(p.imgHeightPx) > 0)
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

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

      // Métricas de estacas (obra inteira)
      const isEstacaPeca = p => p.tipo === 'Fundação' && (p.subTipo === 'Estacas' || (!p.subTipo && EC.num(p.diametro) > 0 && EC.num(p.comprimento) > 0));
      const pecasEstaca = pecas.filter(isEstacaPeca);
      const idsPecasEstaca = new Set(pecasEstaca.map(p => p.id));
      const lansEstaca = lancamentos.filter(l => idsPecasEstaca.has(l.pecaId));

      // Sem estaca E sem prancha: obra não tem essa disciplina — seção some.
      if (!pecasEstaca.length && !pranchasComImagem.length) { host.innerHTML = ''; return; }

      const total = marcadores.length;
      const vinculados = marcadores.filter(m => m.pecaId).length;
      const concluidos = marcadores.filter(m => { const s = statusFn(m); return s.pct !== null && s.pct >= 100; }).length;
      const pctMedio = total ? marcadores.reduce((s, m) => s + (statusFn(m).pct || 0), 0) / total : 0;

      const qtdTotal = pecasEstaca.length;
      const qtdFeitas = pecasEstaca.filter(p => (CC ? CC.pctConcretado(p, lancamentos) : 0) >= 100).length;
      const volumeTotalProjeto = pecasEstaca.reduce((s, p) => s + EC.num(p.volume), 0);
      const volumeFeitoProjeto = pecasEstaca.reduce((s, p) => {
        const pct = CC ? CC.pctConcretado(p, lancamentos) : 0;
        return s + Math.min(EC.num(p.volume), (pct / 100) * EC.num(p.volume));
      }, 0);
      const volumeRealBTs = lansEstaca.reduce((s, l) => s + EC.num(l.volume), 0);
      const idsBTsUsadas = new Set(lansEstaca.map(l => l.btConfigId));
      let volumePrevistoBTs = 0, perdaBTsRegistrada = 0;
      idsBTsUsadas.forEach(btId => {
        const b = btsConfig.find(x => x.id === btId);
        if (!b) return;
        volumePrevistoBTs += EC.num(b.volumePrevisto);
        const lansDaBT = lansEstaca.filter(l => l.btConfigId === btId);
        lansDaBT.forEach(l => { perdaBTsRegistrada += EC.num(l.sobraCaminhao) + EC.num(l.perdaObra) + EC.num(l.perdaCocho); });
      });
      const perdaSolo = Math.max(0, volumeRealBTs - volumeTotalProjeto);
      const perdaTotalObra = perdaBTsRegistrada + perdaSolo;
      const indicePerdaObra = volumePrevistoBTs > 0 ? (perdaTotalObra / volumePrevistoBTs) * 100 : 0;
      const consumoMedioPorEstaca = qtdFeitas > 0 ? volumeRealBTs / qtdFeitas : 0;

      const gruposPorTipo = new Map();
      pecasEstaca.forEach(p => {
        const chave = EC.chaveGrupoEstaca(p.diametro, p.comprimento);
        if (!gruposPorTipo.has(chave)) gruposPorTipo.set(chave, { diametro: EC.num(p.diametro), comprimento: EC.num(p.comprimento), qtd: 0, qtdFeitas: 0, volumeProjeto: 0, volumeReal: 0 });
        const g = gruposPorTipo.get(chave);
        g.qtd++;
        const pct = CC ? CC.pctConcretado(p, lancamentos) : 0;
        if (pct >= 100) g.qtdFeitas++;
        g.volumeProjeto += EC.num(p.volume);
        g.volumeReal += lancamentos.filter(l => l.pecaId === p.id).reduce((s, l) => s + EC.num(l.volume), 0);
      });
      const gruposOrdenados = [...gruposPorTipo.values()].sort((a, b) => (a.diametro - b.diametro) || (a.comprimento - b.comprimento));

      host.innerHTML = `
        <div class="card db-row">
          <div class="card-body">
            <div class="db-secao-header"><h3>⚓ Estacas e Fundações</h3></div>
            <div class="text-sm text-muted" style="margin-bottom:10px;">${vinculados}/${total} marcadores vinculados · ${concluidos}/${total} concretados · ${EC.fmt1(pctMedio)}% médio · <a href="controle-estacas.html" style="color:var(--cor-primaria-dark);font-weight:600;">abrir controle</a></div>
            <div id="db-estacas-minimapas"></div>
            ${qtdTotal ? `
              <div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--cor-borda-light);">
                <div class="db-secao-header" style="margin-bottom:8px;"><h4 style="font-size:.85rem;">Métricas de Estacas (obra inteira)</h4></div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:14px;">
                  <div class="db-metrica-card"><div class="db-metrica-valor">${qtdTotal}</div><div class="db-metrica-label">Total de estacas</div></div>
                  <div class="db-metrica-card"><div class="db-metrica-valor">${qtdFeitas}</div><div class="db-metrica-label">Estacas feitas</div></div>
                  <div class="db-metrica-card"><div class="db-metrica-valor">${EC.fmt1(volumeTotalProjeto)}</div><div class="db-metrica-label">Volume total (m³)</div></div>
                  <div class="db-metrica-card"><div class="db-metrica-valor">${EC.fmt1(volumeFeitoProjeto)}</div><div class="db-metrica-label">Volume feito (m³)</div></div>
                  <div class="db-metrica-card" style="${indicePerdaObra > 10 ? 'border-color:#dc2626;' : ''}"><div class="db-metrica-valor" style="${indicePerdaObra > 10 ? 'color:#dc2626;' : ''}">${EC.fmt1(indicePerdaObra)}%</div><div class="db-metrica-label">Índice de perda médio</div></div>
                  <div class="db-metrica-card"><div class="db-metrica-valor">${CC ? CC.fmt2(consumoMedioPorEstaca) : consumoMedioPorEstaca.toFixed(2)}</div><div class="db-metrica-label">Consumo médio/estaca (m³)</div></div>
                </div>
                <div style="overflow-x:auto;">
                  <table class="db-tabela-clean">
                    <thead><tr>
                      <th style="text-align:left;">Tipo (Ø × comprimento)</th>
                      <th>Qtd</th>
                      <th>Feitas</th>
                      <th>Vol. Projeto (m³)</th>
                      <th>Vol. Real (m³)</th>
                      <th>Consumo médio (m³)</th>
                    </tr></thead>
                    <tbody>
                      ${gruposOrdenados.map(g => `<tr>
                        <td style="text-align:left;">Ø${EC.fmt1(g.diametro)}cm × ${EC.fmt1(g.comprimento)}m</td>
                        <td>${g.qtd}</td>
                        <td>${g.qtdFeitas}</td>
                        <td>${EC.fmt1(g.volumeProjeto)}</td>
                        <td>${EC.fmt1(g.volumeReal)}</td>
                        <td>${g.qtdFeitas ? (CC ? CC.fmt2(g.volumeReal / g.qtdFeitas) : (g.volumeReal / g.qtdFeitas).toFixed(2)) : '—'}</td>
                      </tr>`).join('')}
                    </tbody>
                  </table>
                </div>
              </div>` : ''}
          </div>
        </div>`;

      if (!pranchasComImagem.length) return;
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
        return `<div class="db-minimapa" style="width:${LARGURA_CARD}px;">
          <div class="db-minimapa-titulo">${DashCore.esc(p.nome || 'Prancha')}</div>
          ${svg}
        </div>`;
      }));
      document.getElementById('db-estacas-minimapas').innerHTML = `<div class="db-minimapas">${cardsHtml.join('')}</div>`;
    } catch (e) {
      console.error(e);
      host.innerHTML = '<div class="db-vazio-inline">Erro ao carregar dados de Estacas e Fundações.</div>';
    }
  }

  // ---------- Popup projeto/PDF ----------
  function _abrirPdfDoAndar(andar, categoriaChave) {
    if (categoriaChave === 'estrutura') _abrirPopupConcretagens(andar, categoriaChave);
    else _abrirPopupPranchas(andar, categoriaChave);
  }

  function _abrirPopupPranchas(andar, categoriaChave) {
    const ctx = _feContexto;
    if (!ctx) return;
    const CC = window.ConcretoCalculos;
    const norm = a => (CC ? CC.normalizarAndar(a) : String(a || '').trim());
    const cat = CATEGORIAS.find(c => c.chave === categoriaChave);
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
    _abrirPopup(andar, itens);
  }

  function _abrirPopupConcretagens(andar, categoriaChave) {
    const ctx = _feContexto;
    if (!ctx) return;
    const CC = window.ConcretoCalculos;
    const norm = a => (CC ? CC.normalizarAndar(a) : String(a || '').trim());
    const cat = CATEGORIAS.find(c => c.chave === categoriaChave);
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
    _abrirPopup(andar, itens);
  }

  let _popupItens = [];
  let _popupIdx = 0;
  let _popupZoom = 1;
  function _abrirPopup(andar, itens) {
    _popupItens = itens;
    _popupIdx = 0;
    _popupZoom = 1;
    _renderPopup(andar);
  }
  function popupNavegar(delta, andar) {
    _popupIdx = (_popupIdx + delta + _popupItens.length) % _popupItens.length;
    _popupZoom = 1;
    _renderPopup(andar);
  }
  function popupZoomAjustar(delta, andar) {
    _popupZoom = Math.max(0.3, Math.min(4, _popupZoom + delta));
    _renderPopup(andar, true);
  }
  function fecharPopup() {
    const overlay = document.getElementById('db-projeto-overlay');
    if (overlay) overlay.remove();
    document.removeEventListener('keydown', _popupTeclaEsc);
  }
  function _popupTeclaEsc(e) { if (e.key === 'Escape') fecharPopup(); }

  async function _renderPopup(andar, soZoom) {
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
      const zoomEl = document.getElementById('db-projeto-zoomable');
      if (zoomEl) zoomEl.style.transform = `scale(${_popupZoom})`;
      const label = document.getElementById('db-projeto-zoomlabel');
      if (label) label.textContent = Math.round(_popupZoom * 100) + '%';
      return;
    }

    overlay.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 8px 12px;color:#fff;gap:10px;flex-wrap:wrap;">
        <div style="font-weight:700;">${DashCore.esc(andar)} — ${DashCore.esc(item.titulo)}${temVarios ? ` <span style="opacity:.7;font-weight:400;">(${_popupIdx + 1}/${_popupItens.length})</span>` : ''}</div>
        <div style="display:flex;align-items:center;gap:6px;">
          ${item.tipo === 'imagem' ? `
            <button class="btn btn-secundario btn-sm" onclick="DashConcreto.popupZoomAjustar(-0.2,'${andarEsc}')">−</button>
            <span id="db-projeto-zoomlabel" style="color:#fff;font-size:0.78rem;min-width:42px;text-align:center;">${Math.round(_popupZoom * 100)}%</span>
            <button class="btn btn-secundario btn-sm" onclick="DashConcreto.popupZoomAjustar(0.2,'${andarEsc}')">+</button>
          ` : ''}
          <button class="btn btn-secundario btn-sm" onclick="DashConcreto.fecharPopup()">✕ Fechar</button>
        </div>
      </div>
      <div id="db-projeto-scroll" style="position:relative;flex:1;overflow:auto;display:flex;align-items:flex-start;justify-content:center;background:#fff;border-radius:8px;">
        ${temVarios ? `<button class="btn btn-secundario" style="position:fixed;left:24px;top:50%;transform:translateY(-50%);z-index:2;" onclick="DashConcreto.popupNavegar(-1,'${andarEsc}')">‹</button>` : ''}
        <div id="db-projeto-conteudo" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">Carregando...</div>
        ${temVarios ? `<button class="btn btn-secundario" style="position:fixed;right:24px;top:50%;transform:translateY(-50%);z-index:2;" onclick="DashConcreto.popupNavegar(1,'${andarEsc}')">›</button>` : ''}
      </div>`;
    const elConteudo = document.getElementById('db-projeto-conteudo');
    if (item.tipo === 'pdf') {
      elConteudo.innerHTML = `<iframe src="${item.url}" style="width:100%;height:100%;border:none;"></iframe>`;
      return;
    }
    const EC = window.EstacasCalculos;
    const CC = window.ConcretoCalculos;
    if (!EC) { elConteudo.innerHTML = '<div class="db-vazio-inline">Motor de cálculo de Estacas não carregado.</div>'; return; }
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
      elConteudo.innerHTML = `<div id="db-projeto-zoomable" style="transform:scale(${_popupZoom});transform-origin:top center;transition:transform .1s;">${stage}</div>`;
      const scrollEl = document.getElementById('db-projeto-scroll');
      if (scrollEl) {
        // Ctrl+scroll (ou pinça do touchpad) = zoom; scroll normal = pan
        // nativo (vertical; Shift+scroll = horizontal, padrão do navegador).
        scrollEl.onwheel = (ev) => {
          if (!ev.ctrlKey) return;
          ev.preventDefault();
          popupZoomAjustar(ev.deltaY < 0 ? 0.15 : -0.15, andar);
        };
        // Pan por arrasto: segurar botão esquerdo (ou do meio) e mover.
        scrollEl.style.cursor = 'grab';
        scrollEl.onmousedown = (ev) => {
          if (ev.button !== 0 && ev.button !== 1) return;
          if (ev.target.closest('button')) return; // não sequestrar cliques nos botões ‹ ›
          ev.preventDefault();
          const startX = ev.clientX, startY = ev.clientY;
          const startL = scrollEl.scrollLeft, startT = scrollEl.scrollTop;
          scrollEl.style.cursor = 'grabbing';
          const mover = (m) => {
            scrollEl.scrollLeft = startL - (m.clientX - startX);
            scrollEl.scrollTop = startT - (m.clientY - startY);
          };
          const soltar = () => {
            scrollEl.style.cursor = 'grab';
            document.removeEventListener('mousemove', mover);
            document.removeEventListener('mouseup', soltar);
          };
          document.addEventListener('mousemove', mover);
          document.addEventListener('mouseup', soltar);
        };
      }
    } catch (e) {
      console.error(e);
      elConteudo.innerHTML = '<div class="db-vazio-inline">Erro ao carregar a imagem.</div>';
    }
  }

  return { renderToggle, toggleMostrar, renderFundacaoEstrutura, renderEstacas, popupNavegar, popupZoomAjustar, fecharPopup };
})();
window.DashConcreto = DashConcreto;

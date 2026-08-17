// ============================================
// Dashboard — Terraplanagem (DashTerra)
// Seção extra (liga/desliga no seletor "Extras" do topo, junto com Fundação
// e Estrutura). Mostra o retrato do Controle de Terraplanagem: KPIs (volume
// previsto empolado, removido, terra/entulho, % concluído, viagens, custo)
// e gráfico por dia com volume (barras) e nº de caminhões/viagens.
// Dados: terraEntregas {data, placa, material, volume, valor},
// config/terraplanagem (empolamento) e config/terraplanagemSecoes (previsto).
// ============================================
const DashTerra = (() => {
  let _ctx = null;
  let _mostrar = localStorage.getItem('db_mostrar_terraplanagem') === 'true';

  function setMostrar(v) {
    _mostrar = !!v;
    localStorage.setItem('db_mostrar_terraplanagem', _mostrar ? 'true' : 'false');
    if (_ctx) render(_ctx);
  }
  function getMostrar() { return _mostrar; }

  function _classMat(material) {
    const m = String(material || '').toLowerCase();
    if (m.includes('entulho') || m.includes('demoli')) return 'ENTULHO';
    return 'TERRA';
  }

  async function render(ctx) {
    _ctx = ctx;
    const host = document.getElementById('db-terraplanagem-wrap');
    if (!host) return;
    if (!_mostrar) { host.innerHTML = ''; return; }
    host.innerHTML = `
      <div class="card db-row">
        <div class="card-body">
          <div class="db-secao-header">
            <h3>🚜 Terraplanagem</h3>
            <a class="btn btn-secundario btn-sm" href="controle-terraplanagem.html?relatorio=1" title="Abre o relatório de período com as datas já preenchidas">📊 Gerar relatório</a>
          </div>
          <div id="db-terra">Carregando...</div>
        </div>
      </div>`;
    const el = document.getElementById('db-terra');
    const TC = window.TerraplanagemCalculos;
    try {
      const obraId = ctx.obraId;
      const [entregas, cfgDoc, secDoc] = await Promise.all([
        Database.listar(obraId, 'terraEntregas', null).catch(() => []),
        Database.obter(obraId, 'config', 'terraplanagem').catch(() => null),
        Database.obter(obraId, 'config', 'terraplanagemSecoes').catch(() => null),
      ]);
      if (!entregas.length && !secDoc) {
        // Ligada no menu Extras mas sem dados ainda: mostra o card com
        // orientação (sumir sem explicação parecia "não funcionou").
        el.innerHTML = `<div class="db-vazio">
          <div class="db-vazio-icone">🚜</div>
          <div class="db-vazio-titulo">Nenhum dado de terraplanagem ainda</div>
          <div class="db-vazio-sub">Lance as viagens no <a href="controle-terraplanagem.html">Controle de Terraplanagem</a> (ou gere as seções no Levantamento) — os gráficos e métricas aparecem aqui automaticamente.</div>
        </div>`;
        return;
      }
      const num = v => (TC ? TC.num(v) : (parseFloat(String(v ?? '').replace(',', '.')) || 0));
      const taxa = num(cfgDoc?.taxaEmpolamento ?? 0.3);

      // Previsto (empolado) — mesmo cálculo do Controle de Terraplanagem.
      let volEmpolado = 0;
      if (TC && secDoc) {
        const volH = TC.calcVolumeTotalSecoes(secDoc.horizontal || []);
        const volV = TC.calcVolumeTotalSecoes(secDoc.vertical || []);
        volEmpolado = TC.calcVolumeComEmpolamento(TC.calcVolumeMedio(volH, volV), taxa);
      }

      const volTerra = entregas.filter(e => _classMat(e.material) === 'TERRA').reduce((s, e) => s + num(e.volume), 0);
      const volEntulho = entregas.filter(e => _classMat(e.material) === 'ENTULHO').reduce((s, e) => s + num(e.volume), 0);
      const volTotal = volTerra + volEntulho;
      const custoTotal = entregas.reduce((s, e) => s + num(e.valor), 0);
      const pct = volEmpolado > 0 ? Math.min(100, (volTerra / volEmpolado) * 100) : null;
      const saldo = volEmpolado > 0 ? Math.max(0, volEmpolado - volTerra) : null;

      // Por dia: viagens, volume (terra × entulho) e custo.
      const porDia = new Map();
      entregas.forEach(e => {
        const d = e.data || 'sem-data';
        if (!porDia.has(d)) porDia.set(d, { viagens: 0, volTerra: 0, volEntulho: 0, custo: 0 });
        const g = porDia.get(d);
        g.viagens++;
        if (_classMat(e.material) === 'ENTULHO') g.volEntulho += num(e.volume);
        else g.volTerra += num(e.volume);
        g.custo += num(e.valor);
      });
      const dias = [...porDia.entries()].sort((a, b) => a[0].localeCompare(b[0]));
      const diasTrabalhados = dias.filter(([d]) => d !== 'sem-data').length || dias.length;
      const mediaDia = diasTrabalhados ? volTotal / diasTrabalhados : 0;

      el.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(125px,1fr));gap:10px;margin-bottom:14px;">
          ${volEmpolado > 0 ? `<div class="db-metrica-card"><div class="db-metrica-valor">${Utils.formatarNumero(volEmpolado, 0)}</div><div class="db-metrica-label">Volume previsto (m³ empolado)</div></div>` : ''}
          <div class="db-metrica-card"><div class="db-metrica-valor">${Utils.formatarNumero(volTotal, 0)}</div><div class="db-metrica-label">Volume removido (m³)</div></div>
          <div class="db-metrica-card"><div class="db-metrica-valor">${Utils.formatarNumero(volTerra, 0)}</div><div class="db-metrica-label">🟤 Terra (m³)</div></div>
          ${volEntulho > 0 ? `<div class="db-metrica-card"><div class="db-metrica-valor">${Utils.formatarNumero(volEntulho, 0)}</div><div class="db-metrica-label">🧱 Entulho (m³)</div></div>` : ''}
          ${pct != null ? `<div class="db-metrica-card"><div class="db-metrica-valor" style="color:${pct >= 100 ? '#15803d' : '#a16207'};">${Utils.formatarNumero(pct, 1)}%</div><div class="db-metrica-label">Concluído (terra × previsto)</div></div>` : ''}
          ${saldo != null ? `<div class="db-metrica-card"><div class="db-metrica-valor">${Utils.formatarNumero(saldo, 0)}</div><div class="db-metrica-label">Saldo restante (m³)</div></div>` : ''}
          <div class="db-metrica-card"><div class="db-metrica-valor">${entregas.length}</div><div class="db-metrica-label">Viagens (caminhões)</div></div>
          <div class="db-metrica-card"><div class="db-metrica-valor">${Utils.formatarNumero(mediaDia, 0)}</div><div class="db-metrica-label">Média m³/dia</div></div>
          ${custoTotal > 0 ? `<div class="db-metrica-card"><div class="db-metrica-valor">R$ ${Utils.formatarNumero(custoTotal, 0)}</div><div class="db-metrica-label">Custo total</div></div>` : ''}
        </div>
        ${dias.length ? _svgPorDia(dias) : '<div class="db-vazio-inline">Nenhuma viagem lançada ainda no Controle de Terraplanagem.</div>'}
        <div class="text-sm text-muted" style="margin-top:6px;">Dados do <a href="controle-terraplanagem.html" style="color:var(--cor-primaria-dark);font-weight:600;">Controle de Terraplanagem</a> — volume por dia (🟤 terra + 🧱 entulho), com nº de caminhões e custo do dia.</div>`;
    } catch (e) {
      console.error(e);
      el.innerHTML = '<div class="db-vazio-inline">Erro ao carregar dados de Terraplanagem.</div>';
    }
  }

  // Barras empilhadas (terra + entulho) por dia, viagens em cima, custo embaixo.
  function _svgPorDia(dias) {
    const n = dias.length;
    const larguraGrupoPx = 64;
    const H = 300;
    const padL = 56, padR = 16, padT = 34, padB = 58;
    const W = n * larguraGrupoPx + padL + padR;
    const plotH = H - padT - padB;
    const maxV = Math.max(1, ...dias.map(([, g]) => g.volTerra + g.volEntulho));
    const barW = 30;

    let faixas = '', bars = '', labels = '';
    dias.forEach(([data, g], i) => {
      const x = padL + i * larguraGrupoPx + (larguraGrupoPx - barW) / 2;
      if (i % 2 === 1) faixas += `<rect x="${(padL + i * larguraGrupoPx).toFixed(1)}" y="${padT}" width="${larguraGrupoPx}" height="${plotH}" fill="#f8f8f8"/>`;
      const hT = (g.volTerra / maxV) * plotH;
      const hE = (g.volEntulho / maxV) * plotH;
      const yT = padT + plotH - hT;
      const yE = yT - hE;
      if (g.volTerra > 0) bars += `<rect x="${x}" y="${yT.toFixed(1)}" width="${barW}" height="${hT.toFixed(1)}" fill="#8b5e34" rx="2"><title>${data} — terra ${Utils.formatarNumero(g.volTerra, 0)} m³</title></rect>`;
      if (g.volEntulho > 0) bars += `<rect x="${x}" y="${yE.toFixed(1)}" width="${barW}" height="${hE.toFixed(1)}" fill="#b0b0b0" rx="2"><title>${data} — entulho ${Utils.formatarNumero(g.volEntulho, 0)} m³</title></rect>`;
      // Volume total + viagens no topo da barra
      bars += `<text x="${(x + barW / 2).toFixed(1)}" y="${(yE - 14).toFixed(1)}" font-size="10" fill="#333" font-weight="700" text-anchor="middle">${Utils.formatarNumero(g.volTerra + g.volEntulho, 0)} m³</text>`;
      bars += `<text x="${(x + barW / 2).toFixed(1)}" y="${(yE - 4).toFixed(1)}" font-size="9" fill="#777" text-anchor="middle">🚚${g.viagens}</text>`;
      // Data + custo embaixo
      const dataBR = data === 'sem-data' ? 'sem data' : data.slice(8, 10) + '/' + data.slice(5, 7);
      labels += `<text x="${(x + barW / 2).toFixed(1)}" y="${(padT + plotH + 14).toFixed(1)}" font-size="10.5" fill="#222" font-weight="600" text-anchor="middle">${dataBR}</text>`;
      if (g.custo > 0) labels += `<text x="${(x + barW / 2).toFixed(1)}" y="${(padT + plotH + 26).toFixed(1)}" font-size="8.5" fill="#888" text-anchor="middle">R$ ${Utils.formatarNumero(g.custo, 0)}</text>`;
    });

    const gridY = [0, 0.25, 0.5, 0.75, 1].map(f => {
      const y = padT + plotH - f * plotH;
      return `<line x1="${padL}" x2="${W - padR}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#eee"/><text x="8" y="${(y + 4).toFixed(1)}" font-size="11" fill="#888">${Utils.formatarNumero(f * maxV, 0)}</text>`;
    }).join('');

    return `
      <div style="overflow-x:auto;">
        <svg viewBox="0 0 ${W} ${H}" style="width:${W}px;max-width:none;height:${H}px;display:block;">
          ${faixas}${gridY}${bars}${labels}
        </svg>
      </div>
      <div class="db-legenda" style="margin-top:6px;">
        <span><i style="background:#8b5e34;"></i> Terra (m³)</span>
        <span><i style="background:#b0b0b0;"></i> Entulho (m³)</span>
        <span>🚚 nº de caminhões (viagens) do dia</span>
      </div>`;
  }

  return { render, setMostrar, getMostrar };
})();
window.DashTerra = DashTerra;

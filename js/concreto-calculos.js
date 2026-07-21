// ============================================
// Módulo: ConcretoCalculos
// Funções puras de cálculo do controle de concreto
// (compartilhado entre levantamento-concreto e controle-concreto)
// Port fiel de lib/calculos.js do concreto-dashboard v2.0
// ============================================

const ConcretoCalculos = (() => {

  // ── Formatação ──────────────────────────────
  const fmt2 = v => (v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmt1 = v => (v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const fmt4 = v => {
    v = v ?? 0;
    if (v === 0) return '0';
    if (Math.abs(v) < 0.01) return v.toFixed(4);
    if (Math.abs(v) < 0.1) return v.toFixed(3);
    return v.toFixed(2);
  };

  // ── Constantes ──────────────────────────────
  const TIPOS = ['Pilar', 'Viga', 'Laje', 'Fundação', 'Cortina', 'Escada', 'Rampa', "Caixa D'água", 'Outro'];
  const TIPO_ORDEM = ['Pilar', 'Viga', 'Laje', 'Escada', 'Rampa', 'Fundação', 'Cortina', 'Outro'];
  const CORES = ['#e8a225', '#4a9eff', '#3ecf7a', '#e85a4f', '#a855f7', '#f59e0b', '#14b8a6', '#06b6d4'];

  // ── IDs ─────────────────────────────────────
  const genId = p => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  // ── Normalização de andar (importação) ──────
  // "1o subsolo", "1� SUBSOLO" → "1º Subsolo"
  function normalizarAndar(a) {
    if (!a) return 'Sem andar';
    let s = String(a).trim()
      .replace(/([0-9]+)\s*o\b/gi, '$1º')
      .replace(/([0-9]+)\s*a\b/gi, '$1ª')
      .replace(/\uFFFD/g, 'º')
      .replace(/\?/g, 'º');
    s = s.toLowerCase().replace(/(^\w|\s\w)/g, c => c.toUpperCase());
    s = s.replace(/\bTerreo\b/i, 'Térreo');
    return s.trim();
  }

  // ── Ordenação de andares ────────────────────
  function ordenarAndares(andares, ordemCustom) {
    if (ordemCustom && ordemCustom.length) {
      return [...andares].sort((a, b) => {
        const ia = ordemCustom.indexOf(a), ib = ordemCustom.indexOf(b);
        if (ia === -1 && ib === -1) return a.localeCompare(b);
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      });
    }
    const prioridade = ['subsolo', 'sub-solo', 'subsolos', 'fundação', 'fundacao', 'fundações', 'fundacoes',
      'infraestrutura', 'infra', 'pilotis', 'térreo', 'terreo', 'piso 0', 'pavimento 0', 'mezanino', 'mez'];
    const score = a => {
      const low = a.toLowerCase();
      for (let i = 0; i < prioridade.length; i++) {
        if (low.includes(prioridade[i])) return -1000 + i;
      }
      const m = a.match(/(\d+)/);
      return m ? parseInt(m[1]) : 9999;
    };
    return [...andares].sort((a, b) => {
      const sa = score(a), sb = score(b);
      if (sa !== sb) return sa - sb;
      return a.localeCompare(b);
    });
  }

  // ── Volume lançado de uma peça ──────────────
  function volLancadoPeca(pecaId, lans) {
    return lans.filter(l => l.pecaId === pecaId).reduce((s, l) => s + (l.volume || 0), 0);
  }

  // ── % concretado de uma peça (tolerância 0.005 m³) ──
  function pctConcretado(peca, lans) {
    if (!peca.volume || peca.volume <= 0) return 0;
    const vc = volLancadoPeca(peca.id, lans);
    const pct = (vc / peca.volume) * 100;
    const faltando = peca.volume - vc;
    if (faltando > 0 && faltando < 0.005) return 100;
    return Math.min(100, pct);
  }

  // ── Volume previsto das BTs ─────────────────
  function calcVolumePrevisto(btsConfig, lans) {
    const btIdsLancadas = new Set(lans.map(l => l.btConfigId));
    const total = btsConfig.reduce((s, b) => s + (b.volumePrevisto || 0), 0);
    const lancado = btsConfig.filter(b => btIdsLancadas.has(b.id)).reduce((s, b) => s + (b.volumePrevisto || 0), 0);
    return { total, lancado, faltando: total - lancado };
  }

  // ── Índice de perda ─────────────────────────
  function calcIndicePerda(lans, btsConfig) {
    const btIds = [...new Set(lans.map(l => l.btConfigId))];
    let totalPrevisto = 0, totalExecutado = 0, totalPerdaObra = 0, totalPerdaCocho = 0;
    const detalhes = [];
    btIds.forEach(btId => {
      const bt = btsConfig.find(b => b.id === btId);
      if (!bt) return;
      const lansBT = lans.filter(l => l.btConfigId === btId);
      const usado = lansBT.reduce((s, l) => s + (l.volume || 0), 0);
      const perdaO = lansBT.reduce((s, l) => s + (l.perdaObra || 0), 0);
      const perdaC = parseFloat(lansBT[0]?.perdaCocho) || 0;
      const difCam = usado - (bt.volumePrevisto || 0);
      totalPrevisto += bt.volumePrevisto || 0;
      totalExecutado += usado;
      totalPerdaObra += perdaO;
      totalPerdaCocho += perdaC;
      detalhes.push({ bt, usado, perdaObra: perdaO, perdaCocho: perdaC, difCaminhao: difCam });
    });
    const perdaCaminhao = totalPrevisto - totalExecutado;
    const perdaTotal = totalPerdaObra + Math.max(0, perdaCaminhao);
    const previstoSemCocho = totalPrevisto - totalPerdaCocho;
    const indice = previstoSemCocho > 0
      ? (Math.max(0, previstoSemCocho - totalExecutado) / previstoSemCocho) * 100
      : 0;
    return {
      indice, perdaTotal, perdaCaminhao,
      perdaObra: totalPerdaObra, perdaCocho: totalPerdaCocho,
      totalPrevisto, totalExecutado, detalhes,
    };
  }

  // ── KPIs do dashboard ───────────────────────
  function calcKPIs(pecas, lans, btsConfig, filtroAndar = 'todos', pecasOrig = null) {
    const ps = filtroAndar === 'todos' ? pecas : pecas.filter(p => p.andar === filtroAndar);
    const totalVol = ps.reduce((s, p) => s + (p.volume || 0), 0);
    const btIdsLancadas = new Set(lans.map(l => l.btConfigId));
    const concVol = btsConfig.filter(b => btIdsLancadas.has(b.id)).reduce((s, b) => s + (b.volumePrevisto || 0), 0);
    const base = pecasOrig || pecas;
    const execVol = ps.reduce((s, p) => {
      const orig = base.find(x => x.id === p.id);
      const volProj = orig ? orig.volume : p.volume;
      return s + Math.min(volProj, volLancadoPeca(p.id, lans));
    }, 0);
    const pecasExcesso = ps.filter(p => {
      const lanTotal = volLancadoPeca(p.id, lans);
      return lanTotal > (p.volume || 0) * 1.001;
    }).map(p => {
      const lanTotal = volLancadoPeca(p.id, lans);
      return { ...p, lanTotal, excesso: lanTotal - p.volume };
    });
    const prev = calcVolumePrevisto(btsConfig, lans);
    const projFaltando = Math.max(0, totalVol - prev.lancado);
    const realFaltando = Math.max(0, totalVol - execVol);
    const pctConc = totalVol > 0 ? (concVol / totalVol) * 100 : 0;
    const perdaInfo = calcIndicePerda(lans, btsConfig);
    return {
      totalVol, concVol, execVol, projFaltando, realFaltando, pctConc,
      volPrevisto: prev.total, volPrevistoFaltando: prev.faltando,
      perdaInfo, pecasExcesso,
    };
  }

  // ── Dados por andar ─────────────────────────
  function calcAndares(pecas, lans, ordemAndares = [], indicePerda = 0) {
    const andares = ordenarAndares([...new Set(pecas.map(p => p.andar))], ordemAndares);
    return andares.map(andar => {
      const ps = pecas.filter(p => p.andar === andar);
      const prog = ps.reduce((s, p) => s + (p.volume || 0), 0);
      const conc = ps.reduce((s, p) => s + Math.min(p.volume || 0, volLancadoPeca(p.id, lans)), 0);
      const falt = Math.max(0, prog - conc);
      const pct = prog > 0 ? (conc / prog) * 100 : 0;
      const projPerda = falt * (1 + indicePerda / 100);
      return { andar, prog, conc, falt, pct, projPerda };
    });
  }

  // ── Dados por tipo de peça ──────────────────
  function calcPorTipo(pecas, lans) {
    const tipos = [...new Set(pecas.map(p => p.tipo))].sort();
    return tipos.map(tipo => {
      const ps = pecas.filter(p => p.tipo === tipo);
      const prog = ps.reduce((s, p) => s + (p.volume || 0), 0);
      const conc = ps.reduce((s, p) => s + Math.min(p.volume || 0, volLancadoPeca(p.id, lans)), 0);
      const faltRaw = Math.max(0, prog - conc);
      const falt = faltRaw < 0.005 ? 0 : faltRaw;
      const pct = prog > 0 ? (conc / prog) * 100 : 0;
      return { tipo, prog, conc, falt, pct, count: ps.length, pecas: ps };
    }).sort((a, b) => {
      const ia = TIPO_ORDEM.indexOf(a.tipo), ib = TIPO_ORDEM.indexOf(b.tipo);
      if (ia === -1 && ib === -1) return a.tipo.localeCompare(b.tipo);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }

  function statusPeca(pct) {
    if (pct >= 100) return 'complete';
    if (pct > 0) return 'partial';
    return 'pending';
  }

  // ── Fórmulas da calculadora (medidas em cm → m³) ──
  const num = v => parseFloat(String(v ?? '').replace(',', '.')) || 0;

  function calcVolPilar(tipoP, peDireito, a, b, c, d) {
    const pd = num(peDireito), A = num(a), B = num(b), C = num(c), D = num(d);
    if (tipoP === 'ret') return (pd * A * B) / 1000000;
    if (tipoP === 'red') return ((Math.PI * A * A / 4) * pd) / 1000000;
    if (tipoP === 'L') return ((A * (B - D)) + (C * D)) * pd / 1000000;
    if (tipoP === 'T') return ((A * B) + (C * D)) * pd / 1000000;
    return 0;
  }

  function calcVolRampa(comprimento, largura, espLaje) {
    return (num(comprimento) * num(largura) * num(espLaje)) / 1000000;
  }

  // Escada: listas de segmentos
  function calcVolLajesInclinadas(lista) {
    return (lista || []).reduce((s, l) => s + (num(l.compIncl) * num(l.larg) * num(l.esp)) / 1000000, 0);
  }
  function calcVolPatamares(lista) {
    return (lista || []).reduce((s, p) => s + (num(p.comp) * num(p.larg) * num(p.esp)) / 1000000, 0);
  }
  function calcVolDegraus(lista) {
    return (lista || []).reduce((s, d) => s + (num(d.pisada) * num(d.espelho) / 2 * num(d.larg) * num(d.qtd)) / 1000000, 0);
  }

  // ── Viga (retangular simples, medidas em cm) ──────
  // Port fiel de "Vigas" do Obra Essence: Lado × Altura × Comprimento
  function calcVolViga(lado, altura, comprimento) {
    return (num(lado) * num(altura) * num(comprimento)) / 1000000;
  }

  // ── Fundação — 9 tipos (port fiel da aba "Fundações" do Obra Essence) ──
  // Todas as medidas de entrada em cm; retorna volume em m³.
  const TIPOS_FUNDACAO = [
    'Viga Baldrame', 'Estacas', 'Bloco Retângular', 'Bloco Triângular',
    'Sapata Isolada Piramidal', 'Sapata de Divisa Piramidal', 'Tubulão a Céu Aberto',
    'Sapata de Divisa em Bloco', 'Sapata Isolada em Bloco',
  ];

  function calcVolFundacao(tipo, p) {
    const A = num(p.A), B = num(p.B), C = num(p.C), D = num(p.D), E = num(p.E), F = num(p.F);
    switch (tipo) {
      case 'Viga Baldrame':
      case 'Bloco Retângular':
      case 'Sapata de Divisa em Bloco':
      case 'Sapata Isolada em Bloco':
        // Bloco retangular simples: comprimento × largura × altura
        return (A * B * C) / 1000000;

      case 'Estacas':
        // A = comprimento/profundidade [m], B = diâmetro [cm]
        return (((Math.PI * (B * B)) / 4) * (A * 100)) / 1000000;

      case 'Bloco Triângular':
        // Sem D/E/F: fórmula empírica. Com D/E/F: seção trapezoidal.
        if (!p.D && !p.E && !p.F) {
          return ((1.74 * A * B) + (0.44 * B * B) + (0.44 * A * A)) * C / 1000000;
        }
        return ((((B + D) / 2) * E) + (((A + D) / 2) * F)) * C / 1000000;

      case 'Sapata Isolada Piramidal':
        // A,B = base maior (embaixo) · C,D = base menor/pescoço (em cima) · E = altura base reta · F = altura total
        return (((F - E) / 3) * ((A * B) + (C * D) + Math.sqrt(A * B * C * D)) + (A * B * E)) / 1000000;

      case 'Sapata de Divisa Piramidal':
        // Mesmos parâmetros da Isolada Piramidal — fundação cortada na divisa (metade de uma pirâmide espelhada)
        return ((((F - E) / 3) * (((C * 2) * D) + (B * (A * 2)) + Math.sqrt(B * (A * 2) * (C * 2) * D))) + (B * (A * 2) * E)) / 1000000 / 2;

      case 'Tubulão a Céu Aberto':
        // A = diâmetro do fuste · B = altura do fuste · C = diâmetro da base/bulbo · D = altura total · E = altura reta da base
        return ((Math.PI * (A / 2) ** 2 * B) + (Math.PI * (C / 2) ** 2 * E) +
          (((Math.PI * (D - E)) / 3) * ((A / 2) ** 2 + (C / 2) ** 2 + ((A / 2) * (B / 2))))) / 1000000;

      default:
        return 0;
    }
  }

  // ── Laje (port fiel da aba "Lajes" do Obra Essence) ──
  // Volume de concreto (convencional ou pré-moldada com isopor) + metragem de treliça / área de isopor
  function calcAreaIsopor(p) {
    // (Qtd de painéis × Comprimento do painel [cm] × Largura do isopor [cm]) / 10.000 → m²
    return (num(p.qtdPaineis) * num(p.compPainel) * num(p.largIsopor)) / 10000;
  }
  function calcMetragemTrelica(p) {
    // Perímetro-base por linha: (x + y) × 2 [cm]
    return (num(p.x) + num(p.y)) * 2;
  }
  function calcTotalTrelica(p) {
    // Máximo de linhas da laje × metragem de treliça por linha
    return num(p.maxLinhas) * calcMetragemTrelica(p);
  }
  function calcVolLaje(p) {
    const x = num(p.x), y = num(p.y), desconto = num(p.desconto);
    const hLaje = num(p.hLaje), hPainel = num(p.hPainel);
    const hConcreto = hLaje - hPainel;
    const areaIsopor = calcAreaIsopor(p);
    const hIsopor = num(p.hIsopor);
    return ((hConcreto * y * x) / 1000000) - ((desconto * hConcreto) / 1000000) - (areaIsopor * (hIsopor / 100));
  }

  return {
    fmt2, fmt1, fmt4,
    TIPOS, TIPO_ORDEM, CORES, TIPOS_FUNDACAO,
    genId, normalizarAndar, ordenarAndares,
    volLancadoPeca, pctConcretado,
    calcVolumePrevisto, calcIndicePerda, calcKPIs, calcAndares, calcPorTipo, statusPeca,
    num, calcVolPilar, calcVolRampa,
    calcVolLajesInclinadas, calcVolPatamares, calcVolDegraus,
    calcVolViga, calcVolFundacao,
    calcAreaIsopor, calcMetragemTrelica, calcTotalTrelica, calcVolLaje,
  };
})();

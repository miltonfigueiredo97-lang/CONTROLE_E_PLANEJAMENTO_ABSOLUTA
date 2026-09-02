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
      .replace(/\?/g, 'º')
      // Símbolo de grau (°, U+00B0) digitado/importado no lugar do ordinal
      // masculino (º, U+00BA) — visualmente quase idênticos, erro comum de
      // teclado/import que fazia o mesmo andar (ex: "2º Subsolo" vs
      // "2° Subsolo") ser tratado como DOIS andares diferentes em qualquer
      // agrupamento por nome (gráficos, relatórios, filtros).
      .replace(/°/g, 'º');
    s = s.toLowerCase().replace(/(^\w|\s\w)/g, c => c.toUpperCase());
    s = s.replace(/\bTerreo\b/i, 'Térreo');
    return s.trim();
  }

  // ── Ordenação de andares ────────────────────
  // Score "inteligente" por nome (subsolo/fundação primeiro, depois pelo
  // número extraído do nome) — usado tanto quando NÃO há ordem customizada
  // quanto para posicionar corretamente andares que ainda não estão em uma
  // ordem customizada existente (ver ordenarAndares abaixo).
  const _PRIORIDADE_ANDAR = ['subsolo', 'sub-solo', 'subsolos', 'fundação', 'fundacao', 'fundações', 'fundacoes',
    'infraestrutura', 'infra', 'pilotis', 'térreo', 'terreo', 'piso 0', 'pavimento 0', 'mezanino', 'mez'];
  function _scoreAndar(a) {
    const low = a.toLowerCase();
    for (let i = 0; i < _PRIORIDADE_ANDAR.length; i++) {
      if (low.includes(_PRIORIDADE_ANDAR[i])) return -1000 + i;
    }
    const m = a.match(/(\d+)/);
    return m ? parseInt(m[1]) : 9999;
  }
  function ordenarAndares(andares, ordemCustom) {
    if (!ordemCustom || !ordemCustom.length) {
      return [...andares].sort((a, b) => {
        const sa = _scoreAndar(a), sb = _scoreAndar(b);
        if (sa !== sb) return sa - sb;
        return a.localeCompare(b);
      });
    }
    // Itens JÁ na ordem customizada mantêm 100% a ordem relativa entre si —
    // é exatamente o que o usuário arrastou manualmente, nunca é sobrescrito.
    // Itens NOVOS (andar criado depois da última vez que a ordem foi salva/
    // arrastada) são inseridos na posição certa dentro dessa sequência,
    // comparando o score numérico do novo com o dos itens customizados
    // adjacentes — evita que todo andar novo caia sempre no final por ordem
    // de criação (bug antigo), sem nunca alterar a ordem já customizada.
    const custom = ordemCustom.filter(nome => andares.includes(nome));
    const novos = andares.filter(a => !custom.includes(a))
      .sort((a, b) => { const sa = _scoreAndar(a), sb = _scoreAndar(b); return sa !== sb ? sa - sb : a.localeCompare(b); });
    const resultado = [...custom];
    novos.forEach(novo => {
      const scoreNovo = _scoreAndar(novo);
      let posInsercao = resultado.length; // padrão: vai pro final, se nenhum score maior for achado
      for (let i = 0; i < resultado.length; i++) {
        if (_scoreAndar(resultado[i]) > scoreNovo) { posInsercao = i; break; }
      }
      resultado.splice(posInsercao, 0, novo);
    });
    return resultado;
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
  function calcIndicePerda(lans, btsConfig, perdaSoloTotal = 0) {
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
    const perdaTotal = totalPerdaObra + Math.max(0, perdaCaminhao) + perdaSoloTotal;
    const previstoSemCocho = totalPrevisto - totalPerdaCocho;
    // Perda de solo (estacas que consomem mais concreto que o projeto) É
    // perda de verdade — sem isso, uma BT 100% usada (sem sobrar nada nela)
    // dava índice 0%, mesmo tendo "sobrado" tudo esse volume extra no solo
    // em vez de na betoneira.
    const indice = previstoSemCocho > 0
      ? ((Math.max(0, previstoSemCocho - totalExecutado) + perdaSoloTotal) / previstoSemCocho) * 100
      : 0;
    return {
      indice, perdaTotal, perdaCaminhao, perdaSolo: perdaSoloTotal,
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
    // Estacas: o volume real normalmente passa do projeto por causa do solo
    // (o furo sai maior que o calculado) — isso é ESPERADO, não erro de
    // lançamento. Separa em "perda de solo" (informativo) do excesso de
    // outras peças (que aí sim é pra corrigir — provável erro de lançamento).
    const todosExcesso = ps.filter(p => {
      const lanTotal = volLancadoPeca(p.id, lans);
      return lanTotal > (p.volume || 0) * 1.001;
    }).map(p => {
      const lanTotal = volLancadoPeca(p.id, lans);
      return { ...p, lanTotal, excesso: lanTotal - p.volume };
    });
    const pecasExcesso = todosExcesso.filter(p => p.subTipo !== 'Estacas');
    const pecasPerdaSolo = todosExcesso.filter(p => p.subTipo === 'Estacas');
    const perdaSoloTotal = pecasPerdaSolo.reduce((s, p) => s + p.excesso, 0);
    const prev = calcVolumePrevisto(btsConfig, lans);
    const projFaltando = Math.max(0, totalVol - prev.lancado);
    const realFaltando = Math.max(0, totalVol - execVol);
    const pctConc = totalVol > 0 ? (concVol / totalVol) * 100 : 0;
    const perdaInfo = calcIndicePerda(lans, btsConfig, perdaSoloTotal);
    return {
      totalVol, concVol, execVol, projFaltando, realFaltando, pctConc,
      volPrevisto: prev.total, volPrevistoFaltando: prev.faltando,
      perdaInfo, pecasExcesso, pecasPerdaSolo, perdaSoloTotal,
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
    'Viga Baldrame', 'Estacas', 'Bloco Retângular', 'Bloco Triângular', 'Bloco Hexagonal',
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

      case 'Bloco Hexagonal':
        // A = meia largura (centro até a lateral reta) · B = altura de cada ponta (topo/base) ·
        // C = altura da parte reta central · D = altura do bloco (espessura)
        // Área (planta) = retângulo central (2A×C) + 2 pontas triangulares (base 2A, altura B) = 2A(B+C)
        // Volume = Área × D
        return (2 * A * (B + C) * D) / 1000000;

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

  // ══════════════════════════════════════════
  // PLANTA DO PROJETO — pranchas (PDF/imagem) com marcadores (polígonos)
  // vinculados a peças do Levantamento. Mesmo princípio de Controle de
  // Estacas (EstacasCalculos), mas só polígono (não tem círculo aqui).
  // ══════════════════════════════════════════
  function posRelativa(evt, stageEl) {
    const r = stageEl.getBoundingClientRect();
    if (!r.width || !r.height) return { x: 0, y: 0 };
    return {
      x: Math.min(1, Math.max(0, (evt.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (evt.clientY - r.top) / r.height)),
    };
  }

  // Compactar imagem (canvas) — usado ao processar PDF/foto no upload, pra
  // não estourar o limite de ~950KB do doc Firestore. (mesmo padrão de
  // EstacasCalculos/SoloGrampeadoCalculos/TerraplanagemCalculos)
  function canvasParaDataURLLimitado(canvas, limiteBytes) {
    limiteBytes = limiteBytes || 950000;
    let quality = 0.85;
    let url = canvas.toDataURL('image/jpeg', quality);
    let tentativas = 0;
    while (url.length > limiteBytes && tentativas < 5) {
      quality -= 0.15;
      if (quality < 0.35) {
        const c2 = document.createElement('canvas');
        c2.width = Math.round(canvas.width * 0.75);
        c2.height = Math.round(canvas.height * 0.75);
        c2.getContext('2d').drawImage(canvas, 0, 0, c2.width, c2.height);
        canvas = c2;
        quality = 0.7;
      }
      url = canvas.toDataURL('image/jpeg', quality);
      tentativas++;
    }
    return { url, width: canvas.width, height: canvas.height, ok: url.length <= limiteBytes };
  }

  // ── Detecção automática de áreas (pilar/viga/laje) por segmentação de
  // cor — NÃO reconhece qual peça é (isso é manual, no vínculo), só isola
  // cada região colorida da planta como um polígono já pronto pra clicar.
  // Pipeline: máscara cromática (saturação+brilho) → preenche buracos
  // PEQUENOS E ISOLADOS na máscara (cotas/números/linhas de chamada
  // desenhados por cima do preenchimento abrem buraquinhos que, sem isso,
  // picotavam peças finas como vigas em vários pedaços soltos — corrigido
  // na V3.26.0.5) → erosão (separa peças vizinhas da MESMA cor de nível
  // que se tocam sem cota nenhuma no meio) → rotula componentes conexos →
  // cresce de volta até a máscara já limpa (BFS multi-fonte) → contorno
  // por varredura de linha → simplificação (Douglas-Peucker).
  // Testado contra plantas reais (CAD exportado em PDF vetorial) — ver
  // notas de versão. Puramente geométrico: não lê nome de peça (P25,
  // V308...) porque o rótulo no PDF é desenho vetorial, não texto.
  function segmentarAreas(imgData, W, H, opts) {
    opts = opts || {};
    const satMin = opts.satMin ?? 25;
    const mxMin = opts.mxMin ?? 150;
    const maxAreaBuraco = opts.maxAreaBuraco ?? Math.max(40, Math.round(W * H * 0.0001));
    const iterErosao = opts.iterErosao ?? 2;
    const minPixels = opts.minPixels ?? Math.max(30, Math.round(W * H * 0.00015));
    const epsilonRDP = opts.epsilonRDP ?? Math.max(1.5, Math.round(Math.max(W, H) * 0.0025));

    const n = W * H;
    const chromatic = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      const r = imgData[o], g = imgData[o + 1], b = imgData[o + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if ((mx - mn) > satMin && mx > mxMin) chromatic[i] = 1;
    }

    // Preenche só buracos PEQUENOS e ISOLADOS (não conectados ao fundo/
    // linhas do desenho) — uma cota ou número desenhado em cima de um
    // preenchimento colorido forma uma ilha branca cercada de cor por
    // todo lado, bem diferente de uma linha divisória de verdade (que faz
    // parte da malha grande de linhas pretas, conectada até a borda da
    // folha). Isso deixa intacta qualquer separação real entre peças.
    const chromaticLimpo = _preencherBuracosPequenos(chromatic, W, H, maxAreaBuraco);

    let mask = chromaticLimpo;
    for (let it = 0; it < iterErosao; it++) {
      const novo = new Uint8Array(n);
      for (let y = 0; y < H; y++) {
        const rowOff = y * W;
        for (let x = 0; x < W; x++) {
          const i = rowOff + x;
          if (!mask[i]) continue;
          const okE = x + 1 < W ? mask[i + 1] : 0;
          const okO = x - 1 >= 0 ? mask[i - 1] : 0;
          const okS = y + 1 < H ? mask[i + W] : 0;
          const okN = y - 1 >= 0 ? mask[i - W] : 0;
          novo[i] = (okE && okO && okS && okN) ? 1 : 0;
        }
      }
      mask = novo;
    }

    const label = new Int32Array(n);
    let numLabels = 0;
    const filaX = new Int32Array(n), filaY = new Int32Array(n);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i0 = y * W + x;
        if (!mask[i0] || label[i0]) continue;
        numLabels++;
        let sp = 0;
        filaX[sp] = x; filaY[sp] = y; sp++;
        label[i0] = numLabels;
        while (sp > 0) {
          sp--;
          const cx = filaX[sp], cy = filaY[sp];
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue;
              const nx = cx + dx, ny = cy + dy;
              if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
              const ni = ny * W + nx;
              if (mask[ni] && !label[ni]) {
                label[ni] = numLabels;
                filaX[sp] = nx; filaY[sp] = ny; sp++;
              }
            }
          }
        }
      }
    }
    if (!numLabels) return [];

    const qX = new Int32Array(n), qY = new Int32Array(n);
    let qh = 0, qt = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (label[i]) { qX[qt] = x; qY[qt] = y; qt++; }
      }
    }
    while (qh < qt) {
      const cx = qX[qh], cy = qY[qh]; qh++;
      const i = cy * W + cx;
      const lab = label[i];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const ni = ny * W + nx;
          if (chromaticLimpo[ni] && !label[ni]) {
            label[ni] = lab;
            qX[qt] = nx; qY[qt] = ny; qt++;
          }
        }
      }
    }

    const bbox = new Array(numLabels + 1);
    const count = new Int32Array(numLabels + 1);
    for (let l = 1; l <= numLabels; l++) bbox[l] = { minX: W, minY: H, maxX: -1, maxY: -1 };
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const l = label[i];
        if (!l) continue;
        count[l]++;
        const bb = bbox[l];
        if (x < bb.minX) bb.minX = x;
        if (x > bb.maxX) bb.maxX = x;
        if (y < bb.minY) bb.minY = y;
        if (y > bb.maxY) bb.maxY = y;
      }
    }

    const resultados = [];
    for (let l = 1; l <= numLabels; l++) {
      if (count[l] < minPixels) continue;
      const bb = bbox[l];
      const areaFracImg = count[l] / n;
      if (areaFracImg > 0.35) continue; // moldura/fundo gigante — descarta
      const contornoPx = _contornoPorVarredura(label, W, bb, l);
      if (contornoPx.length < 3) continue;
      const simplificado = _rdpFechado(contornoPx, epsilonRDP);
      if (simplificado.length < 3) continue;
      resultados.push({
        pontos: simplificado.map(p => ({ x: p.x / W, y: p.y / H })),
        areaPx: count[l],
      });
    }
    return resultados;
  }

  // Rotula componentes conexos do NEGATIVO da máscara (tudo que não é
  // cor: fundo branco + linhas pretas + cotas/textos) e preenche de volta
  // só os componentes PEQUENOS que não tocam a borda da imagem nem fazem
  // parte da maior malha (a rede de linhas de verdade sempre vence por
  // ser, de longe, o maior componente conectado do desenho inteiro).
  function _preencherBuracosPequenos(chromatic, W, H, maxAreaBuraco) {
    const n = W * H;
    const inv = new Uint8Array(n);
    for (let i = 0; i < n; i++) inv[i] = chromatic[i] ? 0 : 1;
    const label = new Int32Array(n);
    let numLabels = 0;
    const filaX = new Int32Array(n), filaY = new Int32Array(n);
    const tocaBordaArr = [0], tamanhoArr = [0];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i0 = y * W + x;
        if (!inv[i0] || label[i0]) continue;
        numLabels++;
        let sp = 0, tam = 0, tocaBorda = false;
        filaX[sp] = x; filaY[sp] = y; sp++;
        label[i0] = numLabels;
        while (sp > 0) {
          sp--;
          const cx = filaX[sp], cy = filaY[sp];
          tam++;
          if (cx === 0 || cy === 0 || cx === W - 1 || cy === H - 1) tocaBorda = true;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue;
              const nx = cx + dx, ny = cy + dy;
              if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
              const ni = ny * W + nx;
              if (inv[ni] && !label[ni]) { label[ni] = numLabels; filaX[sp] = nx; filaY[sp] = ny; sp++; }
            }
          }
        }
        tamanhoArr[numLabels] = tam;
        tocaBordaArr[numLabels] = tocaBorda ? 1 : 0;
      }
    }
    let maiorLabel = 0, maiorTam = 0;
    for (let l = 1; l <= numLabels; l++) if (tamanhoArr[l] > maiorTam) { maiorTam = tamanhoArr[l]; maiorLabel = l; }

    const out = new Uint8Array(n);
    out.set(chromatic);
    for (let i = 0; i < n; i++) {
      if (!inv[i]) continue;
      const l = label[i];
      if (l === maiorLabel || tocaBordaArr[l]) continue; // rede de linhas de verdade — não mexe
      if (tamanhoArr[l] <= maxAreaBuraco) out[i] = 1; // buraco pequeno isolado — preenche
    }
    return out;
  }

  function _contornoPorVarredura(label, W, bb, labelId) {
    const esquerda = [], direita = [];
    for (let y = bb.minY; y <= bb.maxY; y++) {
      let xMin = -1, xMax = -1;
      const rowOff = y * W;
      for (let x = bb.minX; x <= bb.maxX; x++) {
        if (label[rowOff + x] === labelId) {
          if (xMin === -1) xMin = x;
          xMax = x;
        }
      }
      if (xMin === -1) continue;
      esquerda.push({ x: xMin, y });
      direita.push({ x: xMax + 1, y: y + 1 });
    }
    if (!esquerda.length) return [];
    direita.reverse();
    return esquerda.concat(direita);
  }

  // Douglas-Peucker adaptado pra anel FECHADO: ancora nos dois pontos mais
  // distantes entre si (no lugar do primeiro/último, que num anel são
  // vizinhos e não representam bem a forma), simplifica os dois arcos.
  function _rdpFechado(pontos, epsilon) {
    if (pontos.length <= 4) return pontos;
    let iA = 0, iB = 1, maxD = -1;
    const passo = Math.max(1, Math.floor(pontos.length / 200));
    for (let i = 0; i < pontos.length; i += passo) {
      for (let j = i + 1; j < pontos.length; j += passo) {
        const dx = pontos[i].x - pontos[j].x, dy = pontos[i].y - pontos[j].y;
        const d = dx * dx + dy * dy;
        if (d > maxD) { maxD = d; iA = i; iB = j; }
      }
    }
    if (iA > iB) { const t = iA; iA = iB; iB = t; }
    const arco1 = pontos.slice(iA, iB + 1);
    const arco2 = pontos.slice(iB).concat(pontos.slice(0, iA + 1));
    const s1 = _rdp(arco1, epsilon);
    const s2 = _rdp(arco2, epsilon);
    return s1.slice(0, -1).concat(s2.slice(0, -1));
  }

  function _rdp(pontos, epsilon) {
    if (pontos.length < 3) return pontos;
    const pilha = [[0, pontos.length - 1]];
    const manter = new Uint8Array(pontos.length);
    manter[0] = 1; manter[pontos.length - 1] = 1;
    while (pilha.length) {
      const [ini, fim] = pilha.pop();
      if (fim - ini < 2) continue;
      const a = pontos[ini], b = pontos[fim];
      let maxDist = -1, idx = -1;
      for (let i = ini + 1; i < fim; i++) {
        const d = _distPontoSegmentoPx(pontos[i], a, b);
        if (d > maxDist) { maxDist = d; idx = i; }
      }
      if (maxDist > epsilon) {
        manter[idx] = 1;
        pilha.push([ini, idx], [idx, fim]);
      }
    }
    const out = [];
    for (let i = 0; i < pontos.length; i++) if (manter[i]) out.push(pontos[i]);
    return out;
  }

  function _distPontoSegmentoPx(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (!len2) return Math.hypot(p.x - a.x, p.y - a.y);
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  }

  // Wrapper que parte de um <canvas> já renderizado (PDF rasterizado ou
  // imagem) — reduz a resolução de trabalho pra manter a detecção rápida
  // (a imagem ARMAZENADA continua na resolução/qualidade normal).
  function detectarAreas(canvasOrigem, opts) {
    opts = opts || {};
    const maxLado = opts.maxLado || 1400;
    const W0 = canvasOrigem.width, H0 = canvasOrigem.height;
    const fator = Math.min(1, maxLado / Math.max(W0, H0));
    const W = Math.max(1, Math.round(W0 * fator)), H = Math.max(1, Math.round(H0 * fator));
    const work = document.createElement('canvas');
    work.width = W; work.height = H;
    const wctx = work.getContext('2d');
    wctx.drawImage(canvasOrigem, 0, 0, W, H);
    const imgData = wctx.getImageData(0, 0, W, H).data;
    return segmentarAreas(imgData, W, H, opts);
  }

  // ── Hit-test por proximidade (toque de dedo) — só polígono aqui ──
  const TOL_TOQUE_PX = 22;
  function _pontoEmPoligono(p, pontos) {
    let dentro = false;
    for (let i = 0, j = pontos.length - 1; i < pontos.length; j = i++) {
      const xi = pontos[i].x, yi = pontos[i].y, xj = pontos[j].x, yj = pontos[j].y;
      if (((yi > p.y) !== (yj > p.y)) && (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi)) dentro = !dentro;
    }
    return dentro;
  }
  function _distPxSegmento(p, a, b, W, H) {
    const px = p.x * W, py = p.y * H;
    const ax = a.x * W, ay = a.y * H, bx = b.x * W, by = b.y * H;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }
  function marcadorMaisProximo(lista, pontoFrac, stageRect, tolPx) {
    const rect = stageRect || {};
    const W = num(rect.width), H = num(rect.height);
    if (!W || !H || !pontoFrac) return null;
    const tol = (tolPx === undefined || tolPx === null) ? TOL_TOQUE_PX : num(tolPx);
    let melhor = null;
    (lista || []).forEach(m => {
      if (!m.pontos || m.pontos.length < 3) return;
      let dist = Infinity;
      if (_pontoEmPoligono(pontoFrac, m.pontos)) dist = 0;
      else {
        let d = Infinity;
        for (let i = 0, j = m.pontos.length - 1; i < m.pontos.length; j = i++)
          d = Math.min(d, _distPxSegmento(pontoFrac, m.pontos[j], m.pontos[i], W, H));
        if (d <= tol) dist = d;
      }
      if (dist === Infinity) return;
      if (!melhor || dist < melhor.dist) melhor = { m, dist };
    });
    return melhor ? melhor.m : null;
  }

  // ── % de sobreposição de área — usado tanto pra montar uma Concretagem
  // desenhando livre (área desenhada × cada peça já marcada na planta)
  // quanto pra "Controlar pelo Projeto" no lançamento de BT (mesma conta,
  // só que o resultado vira o % da BT em vez do % da Concretagem).
  // Amostra pontos dentro do bounding box do polígono ALVO (a peça) e
  // conta quantos caem também dentro da UNIÃO dos traços desenhados —
  // funciona pra formas livres/irregulares sem precisar de clipping de
  // polígono exato.
  function pctSobreposicao(pontosAlvo, tracos, resolucao) {
    const res = resolucao || 48;
    if (!pontosAlvo || pontosAlvo.length < 3 || !tracos || !tracos.length) return 0;
    let minX = 1, minY = 1, maxX = 0, maxY = 0;
    pontosAlvo.forEach(p => {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    });
    if (maxX <= minX || maxY <= minY) return 0;
    const tracosValidos = tracos.filter(t => t && t.length >= 3);
    if (!tracosValidos.length) return 0;
    let dentroAlvo = 0, dentroAmbos = 0;
    for (let iy = 0; iy < res; iy++) {
      const y = minY + (iy + 0.5) / res * (maxY - minY);
      for (let ix = 0; ix < res; ix++) {
        const x = minX + (ix + 0.5) / res * (maxX - minX);
        const p = { x, y };
        if (!_pontoEmPoligono(p, pontosAlvo)) continue;
        dentroAlvo++;
        if (tracosValidos.some(t => _pontoEmPoligono(p, t))) dentroAmbos++;
      }
    }
    return dentroAlvo ? (dentroAmbos / dentroAlvo * 100) : 0;
  }

  // ══════════════════════════════════════════
  // DETECÇÃO POR MALHA VETORIAL — pra lajes SEM cor de preenchimento,
  // delimitadas só pelas linhas de viga/pilar (a maioria, segundo o
  // levantamento com o Milton). Bem diferente da detecção por cor: aqui
  // lê os dados VETORIAIS de verdade do PDF (as linhas que o CAD desenhou,
  // via page.getOperatorList() do pdf.js) — não os pixels renderizados —
  // e reconstrói os espaços fechados por essa malha (cada espaço fechado
  // = uma laje candidata). Validado numa planta real: os espaços batem
  // exatamente com os cômodos/vãos reais do projeto.
  // ══════════════════════════════════════════

  // Turf.js só pra usar o polygonize (rastreamento de faces de grafo
  // planar) — evita reimplementar esse algoritmo (tem bastante caso de
  // borda: nó com 3+ arestas, aresta pendurada, etc.) do zero.
  async function _carregarTurf() {
    if (typeof turf !== 'undefined') return;
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      // ATENÇÃO: pin explícito de versão — NÃO trocar por "latest" nem por
      // 6.5.0. O @turf/polygonize empacotado na 6.5.0 tem um bug real
      // (RangeError: Invalid array length, dentro do Graph.js da própria
      // lib) que estoura em entradas grandes/complexas e faz a extração
      // de malha voltar sempre vazia, silenciosamente (capturado pelo
      // try/catch abaixo). Confirmado reproduzindo com a 6.5.0 exata
      // instalada localmente; a 7.4.0 não tem esse bug — testado ponta a
      // ponta contra a planta real (389 áreas encontradas).
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Turf.js/7.4.0/turf.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  // Extrai segmentos de linha do operator list do pdf.js — só os que são
  // de verdade TRAÇADOS (stroke), ignorando preenchimentos, hachura de
  // padrão e texto (que não geram stroke de linha).
  function _extrairSegmentosPDF(opList, OPS) {
    const segmentos = [];
    let larguraAtual = 1;
    let pathPendente = null;

    function processaPath(coordOps, coords) {
      let cx = 0, cy = 0, startX = 0, startY = 0, ci = 0;
      for (const op of coordOps) {
        if (op === OPS.moveTo) {
          cx = coords[ci]; cy = coords[ci + 1]; startX = cx; startY = cy; ci += 2;
        } else if (op === OPS.lineTo) {
          const nx = coords[ci], ny = coords[ci + 1];
          segmentos.push({ x1: cx, y1: cy, x2: nx, y2: ny, largura: larguraAtual });
          cx = nx; cy = ny; ci += 2;
        } else if (op === OPS.curveTo) {
          // aproxima a curva por reta início->fim — suficiente pra malha
          // estrutural, que não costuma usar curva pra viga/pilar
          const ex = coords[ci + 4], ey = coords[ci + 5];
          segmentos.push({ x1: cx, y1: cy, x2: ex, y2: ey, largura: larguraAtual });
          cx = ex; cy = ey; ci += 6;
        } else if (op === OPS.closePath) {
          segmentos.push({ x1: cx, y1: cy, x2: startX, y2: startY, largura: larguraAtual });
          cx = startX; cy = startY;
        } else if (op === OPS.rectangle) {
          const rx = coords[ci], ry = coords[ci + 1], rw = coords[ci + 2], rh = coords[ci + 3];
          segmentos.push({ x1: rx, y1: ry, x2: rx + rw, y2: ry, largura: larguraAtual });
          segmentos.push({ x1: rx + rw, y1: ry, x2: rx + rw, y2: ry + rh, largura: larguraAtual });
          segmentos.push({ x1: rx + rw, y1: ry + rh, x2: rx, y2: ry + rh, largura: larguraAtual });
          segmentos.push({ x1: rx, y1: ry + rh, x2: rx, y2: ry, largura: larguraAtual });
          ci += 4;
        }
      }
    }

    for (let i = 0; i < opList.fnArray.length; i++) {
      const fn = opList.fnArray[i];
      const args = opList.argsArray[i];
      if (fn === OPS.setLineWidth) { larguraAtual = args[0]; continue; }
      if (fn === OPS.constructPath) { pathPendente = args; continue; }
      if (fn === OPS.stroke || fn === OPS.closeStroke) {
        if (pathPendente) processaPath(pathPendente[0], pathPendente[1]);
        pathPendente = null;
        continue;
      }
      if (fn !== OPS.setLineWidth && fn !== OPS.constructPath) pathPendente = null;
    }
    return segmentos;
  }

  // Mantém só segmentos LONGOS (corta hachura/texto/ícone, que geram
  // milhares de traços minúsculos) e nos ÂNGULOS DOMINANTES da malha —
  // uma malha estrutural de verdade tem poucas direções (0°/90°, às vezes
  // uma diagonal de escada); linhas soltas em ângulos aleatórios (comum
  // em cota mal extraída ou padrão de hachura) ficam de fora.
  function _filtrarSegmentosEstruturais(segmentos, comprimentoMin) {
    const longos = segmentos.filter(s => Math.hypot(s.x2 - s.x1, s.y2 - s.y1) > comprimentoMin);
    if (!longos.length) return [];
    const hist = new Array(180).fill(0);
    longos.forEach(s => {
      const ang = (((Math.atan2(s.y2 - s.y1, s.x2 - s.x1) * 180 / Math.PI) % 180) + 180) % 180;
      hist[Math.round(ang) % 180] += Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
    });
    // pega os picos do histograma (direções que concentram mais comprimento)
    const ordenado = hist.map((v, i) => [i, v]).sort((a, b) => b[1] - a[1]);
    const dominantes = [];
    for (const [ang, peso] of ordenado) {
      if (peso < ordenado[0][1] * 0.05) break; // despreza direções com <5% do peso do pico principal
      if (dominantes.some(d => Math.min(Math.abs(d - ang), 180 - Math.abs(d - ang)) < 3)) continue; // já tem uma perto
      dominantes.push(ang);
      if (dominantes.length >= 6) break;
    }
    function pertoDominante(s) {
      const ang = (((Math.atan2(s.y2 - s.y1, s.x2 - s.x1) * 180 / Math.PI) % 180) + 180) % 180;
      return dominantes.some(d => Math.min(Math.abs(d - ang), 180 - Math.abs(d - ang)) < 2);
    }
    return longos.filter(pertoDominante);
  }

  // "Noda" a malha: quebra cada segmento nos pontos onde ele cruza outro,
  // pra virar um grafo planar de verdade (o polygonize exige isso — sem
  // nodar, um "X" de duas linhas cruzando no meio não vira 4 arestas).
  function _nodarSegmentos(segmentos) {
    const GRID = 0.05;
    const snap = v => Math.round(v / GRID) * GRID;
    const segs = segmentos.map(s => ({ x1: snap(s.x1), y1: snap(s.y1), x2: snap(s.x2), y2: snap(s.y2) }))
      .filter(s => Math.hypot(s.x2 - s.x1, s.y2 - s.y1) > 0.5);

    function intersecao(a, b) {
      const x1 = a.x1, y1 = a.y1, x2 = a.x2, y2 = a.y2, x3 = b.x1, y3 = b.y1, x4 = b.x2, y4 = b.y2;
      const d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
      if (Math.abs(d) < 1e-9) return null;
      const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / d;
      const u = ((x1 - x3) * (y1 - y2) - (y1 - y3) * (x1 - x2)) / d;
      const eps = 1e-6;
      if (t < -eps || t > 1 + eps || u < -eps || u > 1 + eps) return null;
      return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
    }

    const CELL = 20;
    const bbox = s => [Math.min(s.x1, s.x2), Math.min(s.y1, s.y2), Math.max(s.x1, s.x2), Math.max(s.y1, s.y2)];
    const grade = new Map();
    const celulasDe = bb => {
      const cs = [];
      for (let gx = Math.floor(bb[0] / CELL); gx <= Math.floor(bb[2] / CELL); gx++)
        for (let gy = Math.floor(bb[1] / CELL); gy <= Math.floor(bb[3] / CELL); gy++) cs.push(gx + '_' + gy);
      return cs;
    };
    segs.forEach((s, i) => { celulasDe(bbox(s)).forEach(c => { if (!grade.has(c)) grade.set(c, []); grade.get(c).push(i); }); });

    const cortesPorSeg = segs.map(() => new Set());
    const jaComparado = new Set();
    for (const [, lista] of grade) {
      for (let a = 0; a < lista.length; a++) for (let b = a + 1; b < lista.length; b++) {
        const i = lista[a], j = lista[b];
        const key = i < j ? i + '_' + j : j + '_' + i;
        if (jaComparado.has(key)) continue;
        jaComparado.add(key);
        const pt = intersecao(segs[i], segs[j]);
        if (pt) {
          const k = JSON.stringify([snap(pt.x), snap(pt.y)]);
          cortesPorSeg[i].add(k); cortesPorSeg[j].add(k);
        }
      }
    }

    const nodados = [];
    segs.forEach((s, i) => {
      const pontos = [[s.x1, s.y1], [s.x2, s.y2]];
      cortesPorSeg[i].forEach(k => pontos.push(JSON.parse(k)));
      const dx = s.x2 - s.x1, dy = s.y2 - s.y1, len2 = dx * dx + dy * dy;
      const comT = pontos.map(p => ({ p, t: len2 ? ((p[0] - s.x1) * dx + (p[1] - s.y1) * dy) / len2 : 0 }));
      comT.sort((a, b) => a.t - b.t);
      for (let k = 0; k < comT.length - 1; k++) {
        const p1 = comT[k].p, p2 = comT[k + 1].p;
        if (Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) > 0.3) nodados.push({ x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1] });
      }
    });
    return nodados;
  }

  function _areaPoligonoAbs(coords) {
    let a = 0;
    for (let i = 0; i < coords.length - 1; i++) a += coords[i][0] * coords[i + 1][1] - coords[i + 1][0] * coords[i][1];
    return Math.abs(a) / 2;
  }

  // Função principal — recebe uma `page` do pdf.js (já carregada) e
  // devolve as faces (espaços fechados) candidatas a laje, em coordenadas
  // FRACIONÁRIAS (0..1), no mesmo sistema usado pelos marcadores normais.
  async function extrairFacesMalha(page, OPS) {
    const opList = await page.getOperatorList();
    const viewport = page.getViewport({ scale: 1 });
    const pageW = viewport.width, pageH = viewport.height;

    const segmentos = _extrairSegmentosPDF(opList, OPS);
    const comprimentoMin = Math.max(15, Math.min(pageW, pageH) * 0.006);
    const limpos = _filtrarSegmentosEstruturais(segmentos, comprimentoMin);
    if (!limpos.length) return [];
    const nodados = _nodarSegmentos(limpos);
    if (!nodados.length) return [];

    await _carregarTurf();
    const linhas = turf.featureCollection(nodados.map(s => turf.lineString([[s.x1, s.y1], [s.x2, s.y2]])));
    let poligonizado;
    try { poligonizado = turf.polygonize(linhas); } catch (e) { return []; }

    const areaPagina = pageW * pageH;
    const areaMin = areaPagina * 0.00015; // exclui hachura/ícone/célula de tabela minúscula
    const areaMax = areaPagina * 0.30;    // exclui a moldura da folha inteira

    const faces = [];
    poligonizado.features.forEach(f => {
      const coords = f.geometry.coordinates[0];
      const area = _areaPoligonoAbs(coords);
      if (area < areaMin || area > areaMax) return;
      // remove o último ponto (repete o primeiro, fecha o anel) antes de
      // simplificar/guardar, e inverte Y (PDF cresce pra cima; imagem
      // renderizada cresce pra baixo — mesma convenção já usada nos
      // marcadores normais)
      const pontos = coords.slice(0, -1).map(([x, y]) => ({ x: x / pageW, y: 1 - y / pageH }));
      faces.push({ pontos, areaPt2: area });
    });
    return faces;
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
    posRelativa, canvasParaDataURLLimitado, detectarAreas, segmentarAreas,
    marcadorMaisProximo, pctSobreposicao, extrairFacesMalha,
  };
})();

// Expõe no window: 'const' no topo de um script NÃO vira propriedade de
// window automaticamente (só 'var' faz isso). Sem esta linha, qualquer
// código que cheque window.ConcretoCalculos recebe undefined mesmo com o arquivo
// carregado — foi a causa do "motor de cálculo não carregado" no Dashboard.
window.ConcretoCalculos = ConcretoCalculos;

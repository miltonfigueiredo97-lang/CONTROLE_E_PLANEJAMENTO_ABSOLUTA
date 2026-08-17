// ============================================
// Módulo: TerraplanagemCalculos
// Funções puras de cálculo de corte/aterro de terra
// Port fiel de "Calculadora de Corte de Terra" e
// "Dados dos Caminhões" do Obra Essence V9.6.6
// ============================================

const TerraplanagemCalculos = (() => {
  const fmt2 = v => (v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmt1 = v => (v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const num = v => parseFloat(String(v ?? '').replace(',', '.')) || 0;
  const genId = p => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  // Converte string "99.72, 99.31 99 98.65" em array de números (aceita vírgula, espaço ou quebra de linha)
  function parseLista(str) {
    return String(str ?? '').split(/[,\s;]+/).map(s => s.trim()).filter(Boolean).map(s => parseFloat(s.replace(',', '.'))).filter(n => !isNaN(n));
  }

  // ── Área de uma seção via método da profundidade média (cotas + cota final) ──
  // area = Σ [((cota_i - cotaFinal) + (cota_i+1 - cotaFinal)) * distancia_i] / 2
  function calcAreaSecao(cotas, cotaFinal, distancias) {
    const cf = num(cotaFinal);
    let area = 0;
    for (let i = 0; i < cotas.length - 1; i++) {
      const d = distancias[i] ?? 0;
      area += (((cotas[i] - cf) + (cotas[i + 1] - cf)) * d) / 2;
    }
    return area;
  }
  function calcComprimentoSecao(distancias) {
    return distancias.reduce((s, d) => s + (d || 0), 0);
  }

  // ── Volume entre duas seções consecutivas (método das áreas médias) ──
  function calcVolumeEntreSecoes(areaA, areaB, distancia) {
    return ((num(areaA) + num(areaB)) / 2) * num(distancia);
  }

  // ── Volume total de uma lista de seções [{area, distanciaProxima}] ──
  function calcVolumeTotalSecoes(secoes) {
    let total = 0;
    for (let i = 0; i < secoes.length - 1; i++) {
      total += calcVolumeEntreSecoes(secoes[i].area, secoes[i + 1].area, secoes[i].distanciaProxima);
    }
    return total;
  }

  // ── Volume médio entre a análise Horizontal e Vertical (dupla checagem) ──
  function calcVolumeMedio(volHorizontal, volVertical) {
    const vh = num(volHorizontal), vv = num(volVertical);
    if (!vv) return vh;
    return (vh + vv) / 2;
  }

  // ── Empolamento ──
  // Volume solto (para transporte) = Volume médio (banco) × (1 + taxa)
  function calcVolumeComEmpolamento(volumeMedio, taxaEmpolamento) {
    return num(volumeMedio) * (1 + num(taxaEmpolamento));
  }
  // Capacidade efetiva do caminhão em volume de banco (equivalente compactado)
  function calcCapacidadeAjustada(capacidade, taxaEmpolamento) {
    const t = num(taxaEmpolamento);
    return t > 0 ? num(capacidade) / (1 + t) : num(capacidade);
  }
  function calcViagensNecessarias(volume, capacidadeCaminhao) {
    const cap = num(capacidadeCaminhao);
    return cap > 0 ? Math.ceil(num(volume) / cap) : 0;
  }

  const TAMANHOS_CAMINHAO = ['Grande', 'Pequeno'];

  // ── Presets de taxa de empolamento por tipo de material (ponto de partida editável) ──
  const PRESETS_EMPOLAMENTO = [
    { label: 'Material Útil (30%)', taxa: 0.30 },
    { label: 'Argila (40%)', taxa: 0.40 },
  ];

  // ══════════════════════════════════════════
  // MODO VISUAL — "Marcar no Projeto"
  // Insere uma imagem/PDF da seção, calibra a escala (2 pontos + distância
  // real conhecida) e marca pontos com cota — a distância entre pontos
  // consecutivos vem da escala, não é mais digitada.
  // ══════════════════════════════════════════

  // Posição relativa (0..1) de um clique dentro de um elemento (imagem/stage)
  function posRelativa(evt, el) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return { x: 0, y: 0 };
    return {
      x: Math.min(1, Math.max(0, (evt.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (evt.clientY - r.top) / r.height)),
    };
  }

  // Distância real (metros) entre dois pontos fracionários (0..1), usando as
  // dimensões NATURAIS da imagem (imgW/imgH em px) e a escala calibrada
  // (px por metro) — invariante ao zoom/tamanho de exibição na tela.
  function distanciaMetros(p1, p2, imgW, imgH, escalaPxPorMetro) {
    if (!(escalaPxPorMetro > 0)) return 0;
    const dxPx = (p2.x - p1.x) * imgW;
    const dyPx = (p2.y - p1.y) * imgH;
    return Math.hypot(dxPx, dyPx) / escalaPxPorMetro;
  }

  // Compacta imagem (canvas) pro limite prático de ~950KB do doc Firestore
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

  return {
    fmt2, fmt1, num, genId, parseLista,
    calcAreaSecao, calcComprimentoSecao,
    calcVolumeEntreSecoes, calcVolumeTotalSecoes, calcVolumeMedio,
    calcVolumeComEmpolamento, calcCapacidadeAjustada, calcViagensNecessarias,
    TAMANHOS_CAMINHAO, PRESETS_EMPOLAMENTO,
    posRelativa, distanciaMetros, canvasParaDataURLLimitado,
  };
})();
// Exposto explicitamente: const de top-level NÃO vira propriedade de window,
// e módulos como TerraRel/DashTerra acessam via window.TerraplanagemCalculos.
window.TerraplanagemCalculos = TerraplanagemCalculos;
